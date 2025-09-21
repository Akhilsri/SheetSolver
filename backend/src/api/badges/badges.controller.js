const badgesService = require('./badges.service');
async function handleGetEarnedBadges(req, res) {
  try {
    const userId = req.user.userId;
    const badges = await badgesService.getEarnedBadges(userId);
    res.status(200).json(badges);
  } catch (error) { res.status(500).json({ message: 'Internal Server Error' }); }
}
module.exports = { handleGetEarnedBadges };