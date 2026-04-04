// routes/auth.js
const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { getPool, sql } = require('../db');
const { verifyToken } = require('../middleware/auth');
const router = express.Router();

const SALT_ROUNDS = 12;

// ── Validate JWT_EXPIRES_IN at module load (Fix 3) ───────────────────────────
const ALLOWED_EXPIRY = ['1h', '4h', '8h', '12h', '24h', '48h'];
const jwtExpiry = ALLOWED_EXPIRY.includes(process.env.JWT_EXPIRES_IN)
  ? process.env.JWT_EXPIRES_IN
  : '24h';
if (process.env.JWT_EXPIRES_IN && !ALLOWED_EXPIRY.includes(process.env.JWT_EXPIRES_IN)) {
  console.warn(`[Auth] ⚠️ Invalid JWT_EXPIRES_IN value "${process.env.JWT_EXPIRES_IN}" — falling back to "24h"`);
}

// ── Derive cookie maxAge from jwtExpiry so they stay in sync (Fix 17) ────────
const EXPIRY_MS = {
  '1h':  1  * 60 * 60 * 1000,
  '4h':  4  * 60 * 60 * 1000,
  '8h':  8  * 60 * 60 * 1000,
  '12h': 12 * 60 * 60 * 1000,
  '24h': 24 * 60 * 60 * 1000,
  '48h': 48 * 60 * 60 * 1000,
};

const IS_PROD = process.env.NODE_ENV === 'production';

const makeCookieOptions = () => ({
  httpOnly: true,
  secure: IS_PROD,
  sameSite: IS_PROD ? 'none' : 'lax',
  maxAge: EXPIRY_MS[jwtExpiry],   // ← now always in sync with JWT expiry
  path: '/',
});

// ── POST /api/auth/login ──────────────────────────────────────────────────────
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }

  
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ error: 'Invalid email format.' });
  }
  // Also trim and length-cap before the DB call:
  const cleanEmail = email.toLowerCase().trim().slice(0, 200);


  try {
    const r = await getPool().request()
      .input('email', sql.NVarChar(200), cleanEmail)
      .execute('dbo.usp_GetUserByEmail');

    const user = r.recordset[0];

    // ── Same generic message whether user not found or wrong password (prevents
    //    user enumeration) ──────────────────────────────────────────────────────
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    if (user.status === 'inactive') {
      return res.status(403).json({
        error: 'This account has been deactivated. Contact your administrator.',
      });
    }

    const passwordMatch = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatch) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    // ── Update last_login timestamp ───────────────────────────────────────────
    await getPool().request()
      .input('id', sql.Int, user.id)
      .execute('dbo.usp_UpdateLastLogin');

    // ── Fix 1: Minimal JWT payload — NO PII in the token ─────────────────────
    const tokenPayload = {
      id:   user.id,
      role: user.role,
    };

    const token = jwt.sign(tokenPayload, process.env.JWT_SECRET, {
      expiresIn: jwtExpiry,
    });

    // ── Set JWT in HttpOnly cookie — JS cannot read this ─────────────────────
    res.cookie('authToken', token, makeCookieOptions());

    // ── Return display metadata separately — NOT embedded in the token ────────
    return res.json({
      user: {
        id:      user.id,
        name:    user.name,
        email:   user.email,
        role:    user.role,
        calling: user.calling ?? null,
      },
    });
  } catch (err) {
    console.error('[Auth] Login error:', err);
    return res.status(500).json({ error: 'Login failed. Please try again.' });
  }
});

// ── GET /api/auth/me ──────────────────────────────────────────────────────────
router.get('/me', verifyToken, async (req, res) => {
  try {
    const r = await getPool().request()
      .input('id', sql.Int, req.user.id)
      .execute('dbo.usp_GetUserById');

    const user = r.recordset[0];
    if (!user) return res.status(404).json({ error: 'User not found.' });

    // ── Check account is still active (could have been deactivated mid-session)
    if (user.status === 'inactive') {
      return res.status(403).json({
        error: 'This account has been deactivated. Contact your administrator.',
      });
    }

    return res.json({
      id:        user.id,
      name:      user.name,
      email:     user.email,
      role:      user.role,
      calling:   user.calling ?? null,
      phone:     user.phone ?? null,
      status:    user.status,
      createdAt: user.created_at,
      lastLogin: user.last_login ?? null,
    });
  } catch (err) {
    console.error('[Auth] /me error:', err);
    return res.status(500).json({ error: 'Could not fetch user profile.' });
  }
});

// ── POST /api/auth/logout ─────────────────────────────────────────────────────
// Fix 8: No verifyToken — expired sessions must still be able to log out cleanly
router.post('/logout', (_req, res) => {
  res.clearCookie('authToken', {
    httpOnly: true,
    secure:   IS_PROD,
    sameSite: IS_PROD ? 'none' : 'lax',
    path:     '/',
  });
  return res.json({ message: 'Logged out successfully.' });
});

// ── POST /api/auth/ward-unlock ────────────────────────────────────────────────
router.post('/ward-unlock', async (req, res) => {
  const { password } = req.body;
  if (!password) {
    return res.status(400).json({ error: 'Password is required.' });
  }

  try {
    const r = await getPool().request().execute('dbo.usp_ValidateViewPassword');
    const hash = r.recordset[0]?.view_password_hash;

    // ── Fix 2: Explicitly signal no password is set — don't silently succeed ──
    if (!hash) {
      return res.json({ success: true, noPasswordSet: true });
      // NOTE: The frontend (ProgramHome + WardDefaults) should show an admin
      // warning when noPasswordSet=true so they know content is unprotected.
    }

    // ── Fix 20: Trim password before compare ──────────────────────────────────
    const match = await bcrypt.compare(password.trim(), hash);
    if (!match) {
      return res.status(401).json({ error: 'Incorrect password.' });
    }

    return res.json({ success: true });
  } catch (err) {
    console.error('[Auth] ward-unlock error:', err);
    return res.status(500).json({ error: 'Failed to validate password.' });
  }
});

// ── POST /api/auth/change-password ───────────────────────────────────────────
router.post('/change-password', verifyToken, async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'Current and new password are required.' });
  }
  
  if (newPassword.trim().length > 128) {
    return res.status(400).json({ error: 'Password must be 128 characters or fewer.' });
  }

  if (newPassword.trim().length < 8) {
    return res.status(400).json({
      error: 'New password must be at least 8 characters. Consider using a mix of letters, numbers, and symbols for a stronger password.',
    });
  }

  
  const trimmedNew = newPassword.trim();
  const trimmedCurrent = currentPassword.trim();

  try {
    const r = await getPool().request()
      .input('id', sql.Int, req.user.id)
      .execute('dbo.usp_GetUserPasswordHash');

    const user = r.recordset[0];
    if (!user) return res.status(404).json({ error: 'User not found.' });

    const match = await bcrypt.compare(trimmedCurrent, user.password_hash);
    if (!match) {
      return res.status(401).json({ error: 'Current password is incorrect.' });
    }

    const isSame = await bcrypt.compare(trimmedNew, user.password_hash);
    if (isSame) {
      return res.status(400).json({
        error: 'New password must be different from your current password.',
      });
    }

    const newHash = await bcrypt.hash(trimmedNew, SALT_ROUNDS);

    await getPool().request()
      .input('id',            sql.Int,              req.user.id)
      .input('password_hash', sql.NVarChar(sql.MAX), newHash)
      .execute('dbo.usp_UpdateUserPassword');

    // ── Fix 9: Invalidate existing session — force re-login with new password ─
    res.clearCookie('authToken', {
      httpOnly: true,
      secure:   IS_PROD,
      sameSite: IS_PROD ? 'none' : 'lax',
      path:     '/',
    });

    return res.json({
      message: 'Password changed successfully. Please log in again.',
      requiresReLogin: true,   // ← frontend can use this flag to redirect to /login
    });
  } catch (err) {
    console.error('[Auth] change-password error:', err);
    return res.status(500).json({ error: 'Failed to change password.' });
  }
});

module.exports = router;