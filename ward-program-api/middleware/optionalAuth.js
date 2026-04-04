// middleware/optionalAuth.js
// ─────────────────────────────────────────────────────────────────────────────
// Optional authentication middleware.
// Unlike verifyToken, this does NOT reject unauthenticated requests.
// It simply populates req.user if a valid token is present (cookie or header),
// and silently moves on if not. Use on routes that serve both public
// and authenticated users differently (e.g. GET /api/programs).
// ─────────────────────────────────────────────────────────────────────────────
const jwt = require('jsonwebtoken');

function optionalAuth(req, res, next) {
  // ── Read from HttpOnly cookie first, fall back to Authorization header ────
  const token =
    req.cookies?.authToken ??
    (req.headers['authorization']?.startsWith('Bearer ')
      ? req.headers['authorization'].split(' ')[1]
      : null);

  if (token) {
    try {
      req.user = jwt.verify(token, process.env.JWT_SECRET);
    } catch {
      // Invalid or expired token — treat as unauthenticated, don't reject
      req.user = null;
    }
  }

  next(); // always continue — auth is optional
}

module.exports = { optionalAuth };