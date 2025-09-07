require('dotenv').config();
const http = require('http');
const { Server } = require("socket.io");
const app = require('./app');
const pool = require('./config/db');

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*", methods: ["GET", "POST"] } });

// --- NEW: In-memory queues for players waiting for a match ---
const waitingQueues = {
  'Arrays Part-I': [],
  'Graphs': [],
  'Binary Tree Part-I': [],
  'Dynamic Programming': [],
  'Mixed': []
};

const gameStates = {};

io.on('connection', (socket) => {
  console.log(`✅ A user connected: ${socket.id}`);

  // --- Existing Chat Logic ---
  socket.on('join_room', (roomId) => {
    socket.join(roomId);
    console.log(`User ${socket.id} joined chat room: ${roomId}`);
  });

  socket.on('send_message', async (data) => {
    try {
      const { roomId, senderId, messageText } = data;
      const sql = 'INSERT INTO chat_messages (room_id, sender_id, message_text) VALUES (?, ?, ?)';
      await pool.query(sql, [roomId.replace('room-', ''), senderId, messageText]);
      socket.to(roomId).emit('receive_message', data);
    } catch (error) {
      console.error('Error in send_message:', error);
    }
  });

  // --- NEW: "Compete" Mode Matchmaking Logic ---
  socket.on('find_match', async ({ userId, username, topic }) => {
    console.log(`User ${username} (${socket.id}) is looking for a match in topic: ${topic}`);

    if (!waitingQueues[topic]) {
      socket.emit('match_error', { message: 'This topic is not available for competition.' });
      return;
    }

    const waitingPlayer = waitingQueues[topic].shift();

    if (waitingPlayer) {
      console.log(`Match found between ${username} and ${waitingPlayer.username}`);
      const connection = await pool.getConnection();
      try {
        await connection.beginTransaction();

        // 1. Create a game session
        const [gameResult] = await connection.query(
          'INSERT INTO game_sessions (status, topic) VALUES (?, ?)',
          ['in_progress', topic]
        );
        const gameSessionId = gameResult.insertId;

        // 2. Add both players
        await connection.query(
          'INSERT INTO game_participants (game_session_id, user_id) VALUES (?, ?), (?, ?)',
          [gameSessionId, userId, gameSessionId, waitingPlayer.userId]
        );

        await connection.commit();

        // 3. Create a game room
        const gameRoom = `game-${gameSessionId}`;
        socket.join(gameRoom);
        waitingPlayer.socket.join(gameRoom);

        // 4. Notify both players
        const matchDetails = {
          gameId: gameSessionId,
          gameRoom: gameRoom,
          players: [
            { userId: userId, username: username },
            { userId: waitingPlayer.userId, username: waitingPlayer.username }
          ]
        };
        io.to(gameRoom).emit('match_found', matchDetails);
        console.log(`Started game ${gameSessionId} for room ${gameRoom}`);

      } catch (error) {
        await connection.rollback();
        console.error('Error creating game session:', error);
        io.to(socket.id).to(waitingPlayer.socket.id).emit('match_error', { message: 'Failed to create game session.' });
      } finally {
        connection.release();
      }
    } else {
      waitingQueues[topic].push({ userId, username, socket });
      socket.emit('waiting_for_match');
      console.log(`User ${username} added to the '${topic}' queue.`);
    }
  });

  socket.on('player_ready', async ({ gameId, userId }) => {
    if (!gameStates[gameId]) {
      gameStates[gameId] = {
        players: {},
        questions: [],
        currentQuestionIndex: 0,
        readyPlayers: new Set(),
      };
    }
    gameStates[gameId].readyPlayers.add(userId);
    console.log(`Player ${userId} is ready for game ${gameId}. Ready count: ${gameStates[gameId].readyPlayers.size}`);

    if (gameStates[gameId].readyPlayers.size === 2) {
      console.log(`Both players ready. Starting game ${gameId}`);
      await startGame(gameId);
    }
  });

  socket.on('submit_answer', async ({ gameId, userId, answer }) => {
    const game = gameStates[gameId];
    if (!game || !game.players[userId] || game.players[userId].hasAnswered) return;

    game.players[userId].hasAnswered = true;
    const currentQuestion = game.questions[game.currentQuestionIndex];
    let isCorrect = (answer === currentQuestion.correct_answer);

    if (isCorrect) {
      game.players[userId].score += 10;
      await pool.query(
        'UPDATE game_participants SET score = score + 10 WHERE game_session_id = ? AND user_id = ?',
        [gameId, userId]
      );
    }

    io.to(`game-${gameId}`).emit('score_update', {
      player1: game.players[Object.keys(game.players)[0]],
      player2: game.players[Object.keys(game.players)[1]]
    });
  });

  // --- Updated Disconnect Logic ---
  socket.on('disconnect', () => {
    console.log(`🔥 A user disconnected: ${socket.id}`);
    for (const topic in waitingQueues) {
      const index = waitingQueues[topic].findIndex(player => player.socket.id === socket.id);
      if (index !== -1) {
        waitingQueues[topic].splice(index, 1);
        console.log(`Removed user ${socket.id} from the '${topic}' queue due to disconnect.`);
        break;
      }
    }
  });
});

async function startGame(gameId) {
  const gameRoom = `game-${gameId}`;
  const [session] = await pool.query('SELECT topic FROM game_sessions WHERE id = ?', [gameId]);
  if (!session || session.length === 0) return;
  const topic = session[0].topic;

  const [questions] = await pool.query(
    'SELECT id, question_text, option_a, option_b, option_c, option_d, correct_answer FROM quiz_questions WHERE topic = ? ORDER BY RAND() LIMIT 10',
    [topic]
  );
  gameStates[gameId].questions = questions;

  const [participants] = await pool.query('SELECT user_id FROM game_participants WHERE game_session_id = ?', [gameId]);
  participants.forEach(p => {
    gameStates[gameId].players[p.user_id] = { score: 0, hasAnswered: false, userId: p.user_id };
  });

  sendNextQuestion(gameId);
}

function sendNextQuestion(gameId) {
  const game = gameStates[gameId];
  if (game.currentQuestionIndex >= game.questions.length) {
    endGame(gameId);
    return;
  }
  const question = game.questions[game.currentQuestionIndex];
  const { correct_answer, ...questionForClient } = question;

  for (const playerId in game.players) {
    game.players[playerId].hasAnswered = false;
  }

  io.to(`game-${gameId}`).emit('new_question', {
    question: questionForClient,
    questionNumber: game.currentQuestionIndex + 1,
    totalQuestions: game.questions.length
  });

  game.timer = setTimeout(() => {
    console.log(`Time is up for question ${game.currentQuestionIndex + 1} in game ${gameId}`);
    io.to(`game-${gameId}`).emit('times_up', { correctAnswer: correct_answer });

    setTimeout(() => {
      game.currentQuestionIndex++;
      sendNextQuestion(gameId);
    }, 3000);

  }, 10000);
}

async function endGame(gameId) {
  const game = gameStates[gameId];
  const playerIds = Object.keys(game.players);
  const player1 = game.players[playerIds[0]];
  const player2 = game.players[playerIds[1]];

  let winnerId = null;
  if (player1.score > player2.score) winnerId = player1.userId;
  if (player2.score > player1.score) winnerId = player2.userId;

  await pool.query(
    'UPDATE game_sessions SET status = "completed", winner_user_id = ? WHERE id = ?',
    [winnerId, gameId]
  );

  io.to(`game-${gameId}`).emit('game_over', {
    scores: { [player1.userId]: player1.score, [player2.userId]: player2.score },
    winnerId: winnerId
  });

  console.log(`Game ${gameId} has ended.`);
  delete gameStates[gameId];
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 Server is running on http://localhost:${PORT}`);
  console.log('📡 Socket.IO is listening for real-time connections.');
});
