// backend/middleware/normalizePrice.js
module.exports = function normalizePrice(req, res, next) {
  try {
    // only touch if a price was provided
    if (req.body && req.body.price !== undefined) {
      let p = req.body.price;
      if (typeof p === 'string') p = p.trim();

      const num = Number(p);
      if (!Number.isFinite(num) || num < 0) {
        return res.status(400).json({ error: 'Invalid price' });
      }

      // normalize to 2 decimals (no floor weirdness)
      req.body.price = Math.round(num * 100) / 100;
    }
    next();
  } catch (e) {
    next(e);
  }
};
