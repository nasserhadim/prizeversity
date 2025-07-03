  module.exports = async function blockIfFrozen(req, res, next) {
  const { isFrozen } = await req.user.populate('isFrozen'); // req.user is already loaded by passport
  if (isFrozen) return res.status(403).json({ error: 'Your balance is frozen during a siphon review' });
  next();
};
