/**
 * requireRole(...roles)
 * ---------------------
 * Middleware factory for role-based access control.
 * Must be used AFTER verifyToken so that req.user is populated.
 *
 * Usage:
 *   router.delete('/:id', verifyToken, requireRole('bishopric'), handler);
 *   router.put('/:id',    verifyToken, requireRole('bishopric', 'editor'), handler);
 *
 * @param {...string} roles  One or more allowed role strings.
 */
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated.' });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        error: `Access denied. Required role: ${roles.join(' or ')}.`,
      });
    }
    next();
  };
}

module.exports = { requireRole };
