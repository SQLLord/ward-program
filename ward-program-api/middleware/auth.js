// middleware/auth.js
const jwt = require('jsonwebtoken');

function verifyToken(req, res, next) {
  // ── Read from HttpOnly cookie first (production + dev)
  // ── Bearer header fallback only in non-production (Postman, curl, local dev tools)
  const token =
    req.cookies?.authToken ??
    (process.env.NODE_ENV !== 'production' &&
     req.headers['authorization']?.startsWith('Bearer ')
      ? req.headers['authorization'].split(' ')[1]
      : null);

  if (!token) {
    return res.status(401).json({ error: 'Not authenticated.' });
  }

  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch (err) {
    // ── L3 fix included: log tampered/malformed tokens server-side,
    //    but suppress noisy TokenExpiredError logging
    if (err.name !== 'TokenExpiredError') {
      console.warn(`[Auth] Token verification failed: ${err.name} — ${err.message}`);
    }
    return res.status(401).json({ error: 'Invalid or expired session.' });
  }
}

module.exports = { verifyToken };