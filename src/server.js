require('dotenv').config();
const http = require('http');
const { Server } = require("socket.io");
const app = require('./app');
const pool = require('./config/db');
const cron = require('node-cron');
const { deleteOldSubmissions } = require('./services/cleanupService');
const eloService = require('./services/eloService');

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*", methods: ["GET", "POST"] } });

// --- Matchmaking queues ---
const waitingQueues = {
  'Arrays Part-I': [],
  'Graphs': [],
  'Binary Tree Part-I': [],
  'Dynamic Programming': [],
  'Mixed': []
};

// --- Active games state ---
const gameStates = {};

io.on('connection', (socket) => {
  console.log(`✅ A user connected: ${socket.id}`);

  // --- Chat Logic ---
  socket.on('join_room', (roomName) => {
    socket.join(roomName);
    console.log(`User ${socket.id} joined chat room: ${roomName}`);
  });

  socket.on('send_message', async (data) => {
    try {
      const { roomId, senderId, messageText } = data;
      const cleanRoomId = roomId.replace('chat-','');

      const sql = 'INSERT INTO chat_messages (room_id, sender_id, message_text) VALUES (?, ?, ?)';
      await pool.query(sql, [cleanRoomId, senderId, messageText]);
      console.log(`Message from ${senderId} in room ${roomId} saved to DB.`);

      socket.to(roomId).emit('receive_message', data);
    } catch (error) {
      console.error('Error in send_message:', error);
    }
  });

  // --- Matchmaking Logic ---
  socket.on('find_match', async ({ userId, username, topic }) => {
    socket.userId = userId;
    if (!waitingQueues[topic]) {
      return socket.emit('match_error', { message: 'This topic is not available.' });
    }
    const waitingPlayer = waitingQueues[topic].shift();
    if (waitingPlayer) {
      const connection = await pool.getConnection();
      try {
        await connection.beginTransaction();
        const [gameResult] = await connection.query('INSERT INTO game_sessions (status, topic) VALUES (?, ?)', ['in_progress', topic]);
        const gameSessionId = gameResult.insertId;
        await connection.query('INSERT INTO game_participants (game_session_id, user_id) VALUES (?, ?), (?, ?)', [gameSessionId, userId, gameSessionId, waitingPlayer.userId]);
        await connection.commit();
        const gameRoom = `game-${gameSessionId}`;
        socket.gameId = gameSessionId;
        waitingPlayer.socket.gameId = gameSessionId;
        waitingPlayer.socket.userId = waitingPlayer.userId;
        socket.join(gameRoom);
        waitingPlayer.socket.join(gameRoom);
        const matchDetails = {
          gameId: gameSessionId, gameRoom, players: [
            { userId, username },
            { userId: waitingPlayer.userId, username: waitingPlayer.username }
          ]
        };
        io.to(gameRoom).emit('match_found', matchDetails);
        console.log(`Started game ${gameSessionId} for room ${gameRoom}`);
      } catch (error) {
        await connection.rollback();
        console.error('Error creating game session:', error);
      } finally {
        connection.release();
      }
    } else {
      waitingQueues[topic].push({ userId, username, socket });
      socket.emit('waiting_for_match');
    }
  });

  // --- Game Play Logic ---
  socket.on('player_ready', async ({ gameId, userId }) => {
    if (!gameStates[gameId]) gameStates[gameId] = { readyPlayers: new Set() };
    gameStates[gameId].readyPlayers.add(userId);
    if (gameStates[gameId].readyPlayers.size === 2) {
      console.log(`Both players ready. Starting game ${gameId}`);
      await startGame(gameId);
    }
  });

  socket.on('submit_answer', async ({ gameId, userId, answer }) => {
    // console.log(`--- SERVER: Received 'submit_answer' from User ${userId} for Game ${gameId}. Answer: ${answer} ---`);
    const game = gameStates[gameId];
    if (!game || !game.players || !game.players[userId] || game.players[userId].hasAnswered) {
      console.log(`--- SERVER: Ignoring submission (game not found, players not ready, or already answered). ---`);
      return;
    }

    game.players[userId].hasAnswered = true;
    const currentQuestion = game.questions[game.currentQuestionIndex];
    let isCorrect = (answer === currentQuestion.correct_answer);
    
    if (isCorrect) {
      // console.log(`--- SERVER: Answer is CORRECT. Updating score. ---`);
      game.players[userId].score += 10;
      await pool.query('UPDATE game_participants SET score = score + 10 WHERE game_session_id = ? AND user_id = ?', [gameId, userId]);
    } else {
      // console.log(`--- SERVER: Answer is INCORRECT. Score remains the same. ---`);
    }
    
    // console.log(`--- SERVER: Broadcasting 'score_update'. New scores payload:`, { players: game.players });
    io.to(`game-${gameId}`).emit('score_update', { players: game.players });
  });

  socket.on('forfeit_match', ({ gameId }) => {
    const game = gameStates[gameId];
    if (game) {
      const playerIds = Object.keys(game.players).map(id => parseInt(id, 10));
      const winnerId = playerIds.find(id => id !== socket.userId);
      endGame(gameId, winnerId, 'forfeit');
    }
  });

  socket.on('disconnect', () => {
    console.log(`🔥 A user disconnected: ${socket.id}`);
    const gameId = socket.gameId;
    if (gameId && gameStates[gameId]) {
      const playerIds = Object.keys(gameStates[gameId].players).map(id => parseInt(id, 10));
      const winnerId = playerIds.find(id => id !== socket.userId);
      endGame(gameId, winnerId, 'disconnect');
    }
    for (const topic in waitingQueues) {
      const index = waitingQueues[topic].findIndex(player => player.socket.id === socket.id);
      if (index !== -1) {
        waitingQueues[topic].splice(index, 1);
        break;
      }
    }
  });
});

// --- Game Functions ---
async function startGame(gameId) {
  const gameRoom = `game-${gameId}`;
  const [[session]] = await pool.query('SELECT topic FROM game_sessions WHERE id = ?', [gameId]);
  const topic = session.topic;

  const [questions] = await pool.query(
    'SELECT id, question_text, option_a, option_b, option_c, option_d, correct_answer FROM quiz_questions WHERE topic = ? ORDER BY RAND() LIMIT 10', 
    [topic]
  );

  if (!gameStates[gameId]) {
    gameStates[gameId] = { players: {}, questions: [], currentQuestionIndex: 0 };
  }

  gameStates[gameId].questions = questions;
  gameStates[gameId].currentQuestionIndex = 0;

  const [participants] = await pool.query(
    'SELECT user_id FROM game_participants WHERE game_session_id = ?', 
    [gameId]
  );
  const playerStates = {};
  participants.forEach(p => {
    playerStates[p.user_id] = { score: 0, hasAnswered: false, userId: p.user_id };
  });
  gameStates[gameId].players = playerStates;

  sendNextQuestion(gameId);
}

function sendNextQuestion(gameId) {
  const game = gameStates[gameId];
  if (!game || !game.questions || game.currentQuestionIndex == null) {
    console.error(`❌ Game state missing for ${gameId}`);
    return;
  }

  if (game.currentQuestionIndex >= game.questions.length) {
    endGame(gameId);
    return;
  }

  const question = game.questions[game.currentQuestionIndex];
  const { correct_answer, ...questionForClient } = question;

  for(const playerId in game.players) { 
    game.players[playerId].hasAnswered = false; 
  }

  io.to(`game-${gameId}`).emit('new_question', {
    question: questionForClient,
    questionNumber: game.currentQuestionIndex + 1,
    totalQuestions: game.questions.length
  });

  game.timer = setTimeout(() => {
    io.to(`game-${gameId}`).emit('times_up', { correctAnswer: correct_answer });
    setTimeout(() => {
      game.currentQuestionIndex++;
      sendNextQuestion(gameId);
    }, 3000);
  }, 10000);
}

async function endGame(gameId, winnerId = null, reason = 'completed') {
    const game = gameStates[gameId];
    if (!game || !game.players) return;
    clearTimeout(game.timer);
    const playerIds = Object.keys(game.players).map(id => parseInt(id, 10));
    if (playerIds.length < 2) return; // Prevent crash if one player doesn't exist
    const player1 = game.players[playerIds[0]];
    const player2 = game.players[playerIds[1]];
    let finalWinnerId = winnerId;
    if (winnerId === null && reason === 'completed') {
        if (player1.score > player2.score) finalWinnerId = player1.userId;
        if (player2.score > player1.score) finalWinnerId = player2.userId;
    }
    await pool.query('UPDATE game_sessions SET status = "completed", winner_user_id = ? WHERE id = ?', [finalWinnerId, gameId]);
    await eloService.calculateNewRatings(player1.userId, player2.userId, finalWinnerId);
    io.to(`game-${gameId}`).emit('game_over', {
        scores: { [player1.userId]: player1.score, [player2.userId]: player2.score },
        winnerId: finalWinnerId,
        reason: reason
    });
    console.log(`Game ${gameId} has ended. Reason: ${reason}`);
    delete gameStates[gameId];
}

// --- Daily Cleanup Task ---
cron.schedule('0 2 * * *', () => {
  console.log('-------------------------------------');
  console.log('Running scheduled daily cleanup...');
  deleteOldSubmissions();
  console.log('-------------------------------------');
}, {
  scheduled: true,
  timezone: "Asia/Kolkata"
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
  console.log('📡 Socket.IO listening for real-time connections.');
});

server.timeout = 300000;
