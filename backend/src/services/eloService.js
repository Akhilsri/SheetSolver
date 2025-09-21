const pool = require('../config/db');

// The K-factor determines how much a rating changes after a game.
const K_FACTOR = 32;

function getExpectedScore(playerRating, opponentRating) {
  return 1 / (1 + Math.pow(10, (opponentRating - playerRating) / 400));
}

async function calculateNewRatings(player1Id, player2Id, winnerId) {
  // 1. Get current ratings from the database
  const [players] = await pool.query(
    'SELECT id, rating FROM users WHERE id IN (?, ?)',
    [player1Id, player2Id] // Corrected parameter format
  );

  const player1 = players.find(p => p.id === player1Id);
  const player2 = players.find(p => p.id === player2Id);

  // If a player is not found, we can't calculate ratings.
  if (!player1 || !player2) {
      console.error("Could not find one or both players to calculate ELO.");
      return;
  }

  // 2. Determine the score (1 for win, 0.5 for draw, 0 for loss)
  let player1Score, player2Score;
  if (winnerId === null) {
    player1Score = 0.5;
    player2Score = 0.5;
  } else if (winnerId === player1Id) {
    player1Score = 1;
    player2Score = 0;
  } else {
    player1Score = 0;
    player2Score = 1;
  }

  // 3. Calculate the expected scores
  const expectedScore1 = getExpectedScore(player1.rating, player2.rating);
  const expectedScore2 = getExpectedScore(player2.rating, player1.rating);

  // 4. Calculate the new ratings using the ELO formula
  const newRating1 = player1.rating + K_FACTOR * (player1Score - expectedScore1);
  const newRating2 = player2.rating + K_FACTOR * (player2Score - expectedScore2);
  
  // 5. Update the new ratings in the database
  await pool.query('UPDATE users SET rating = ? WHERE id = ?', [Math.round(newRating1), player1Id]);
  await pool.query('UPDATE users SET rating = ? WHERE id = ?', [Math.round(newRating2), player2Id]);

  console.log(`Ratings updated: User ${player1.id} -> ${Math.round(newRating1)}, User ${player2.id} -> ${Math.round(newRating2)}`);
}

// This is the crucial part that ensures the function can be used in other files.
module.exports = {
  calculateNewRatings
};