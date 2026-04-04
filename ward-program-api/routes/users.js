// routes/users.js
const express = require('express');
const bcrypt = require('bcrypt');
const { getPool, sql } = require('../db');
const { verifyToken } = require('../middleware/auth');
const { requireRole } = require('../middleware/requireRole');
const router = express.Router();

const SALT_ROUNDS = 12;

// ── Safe user mapper — NEVER expose password_hash ─────────────────────────
// Fix 22: Added updatedAt — was missing from mapper despite proc returning it
// Fix 24: Added lastLogin — usp_GetAllUsers now returns last_login (see DB fix)
const mapUser = (u) => ({
  id:        u.id,
  name:      u.name,
  email:     u.email,
  phone:     u.phone    ?? null,
  calling:   u.calling  ?? null,
  role:      u.role,
  status:    u.status,
  createdAt: u.created_at,
  updatedAt: u.updated_at  ?? null,   // ← Fix 22: was missing
  lastLogin: u.last_login  ?? null,   // ← Fix 24: now populated from proc
});

// All user management routes require authentication + bishopric role
router.use(verifyToken, requireRole('bishopric'));

// ── GET /api/users ──────────────────────────────────────────────────────────
router.get('/', async (_req, res) => {
  try {
    const r = await getPool().request().execute('dbo.usp_GetAllUsers');
    return res.json(r.recordset.map(mapUser));
  } catch (err) {
    console.error('[Users] GET / error:', err);
    return res.status(500).json({ error: 'Failed to fetch users.' });
  }
});

// ── GET /api/users/:id ──────────────────────────────────────────────────────
router.get('/:id', async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    if (isNaN(userId)) return res.status(400).json({ error: 'Invalid user ID.' });

    const r = await getPool().request()
      .input('id', sql.Int, userId)
      .execute('dbo.usp_GetUserById');

    if (!r.recordset[0]) return res.status(404).json({ error: 'User not found.' });
    return res.json(mapUser(r.recordset[0]));
  } catch (err) {
    console.error('[Users] GET /:id error:', err);
    return res.status(500).json({ error: 'Failed to fetch user.' });
  }
});

// ── POST /api/users ─────────────────────────────────────────────────────────
router.post('/', async (req, res) => {
  const { name, email, password, phone, calling, role, status } = req.body;

  if (!name || !email || !password || !role) {
    return res.status(400).json({ error: 'name, email, password, and role are required.' });
  }

  // ← L1 FIX: enforce minimum password length on create (was only checked on PUT)
  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters.' });
  }


  if (!['bishopric', 'editor'].includes(role)) {
    return res.status(400).json({ error: 'role must be bishopric or editor.' });
  }
  
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ error: 'Invalid email format.' });
  }
  if (name.trim().length > 200) {
    return res.status(400).json({ error: 'Name must be 200 characters or fewer.' });
  }



  try {
    const password_hash = await bcrypt.hash(password, SALT_ROUNDS);
    const r = await getPool().request()
      .input('name',          sql.NVarChar(200),      name.trim())
      .input('email',         sql.NVarChar(200),      email.toLowerCase().trim())
      .input('password_hash', sql.NVarChar(sql.MAX),  password_hash)
      .input('phone',         sql.NVarChar(20),       phone   ?? null)
      .input('calling',       sql.NVarChar(200),      calling ?? null)
      .input('role',          sql.NVarChar(50),       role)
      .input('status',        sql.NVarChar(20),       status  ?? 'active')
      .execute('dbo.usp_CreateUser');

    return res.status(201).json(mapUser(r.recordset[0]));
  } catch (err) {
    if (err.number === 2627) {
      return res.status(409).json({ error: 'A user with that email already exists.' });
    }
    console.error('[Users] POST / error:', err);
    return res.status(500).json({ error: 'Failed to create user.' });
  }
});

// ── PUT /api/users/:id ──────────────────────────────────────────────────────
router.put('/:id', async (req, res) => {
  const { name, email, password, phone, calling, role, status } = req.body;
  const userId = parseInt(req.params.id);

  if (isNaN(userId)) return res.status(400).json({ error: 'Invalid user ID.' });
  if (!name || !email || !role) {
    return res.status(400).json({ error: 'name, email, and role are required.' });
  }

  try {
    let password_hash = null;

     const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({ error: 'Invalid email format.' });
      }
      if (name.trim().length > 200) {
        return res.status(400).json({ error: 'Name must be 200 characters or fewer.' });
      }

    if (password) {
      if (password.length < 8) {
        return res.status(400).json({ error: 'Password must be at least 8 characters.' });
      }

      const r = await getPool().request()
        .input('id', sql.Int, userId)
        .execute('dbo.usp_GetUserPasswordHash');

      const existing = r.recordset[0];
      if (existing) {
        const isSame = await bcrypt.compare(password, existing.password_hash);
        if (isSame) {
          return res.status(400).json({
            error: 'New password must be different from the current password.',
          });
        }
      }
      password_hash = await bcrypt.hash(password, SALT_ROUNDS);
    }

    await getPool().request()
      .input('id',            sql.Int,            userId)
      .input('name',          sql.NVarChar(200),  name.trim())
      .input('email',         sql.NVarChar(200),  email.toLowerCase().trim())
      .input('password_hash', sql.NVarChar(sql.MAX), password_hash)
      .input('phone',         sql.NVarChar(20),   phone   ?? null)
      .input('calling',       sql.NVarChar(200),  calling ?? null)
      .input('role',          sql.NVarChar(50),   role)
      .input('status',        sql.NVarChar(20),   status  ?? 'active')
      .execute('dbo.usp_UpdateUser');

    return res.json({ message: 'User updated successfully.' });
  } catch (err) {
    if (err.number === 2627) {
      return res.status(409).json({ error: 'A user with that email already exists.' });
    }
    if (err.message?.includes('not found')) {
      return res.status(404).json({ error: err.message });
    }
    console.error('[Users] PUT /:id error:', err);
    return res.status(500).json({ error: 'Failed to update user.' });
  }
});

// ── PATCH /api/users/:id/status ─────────────────────────────────────────────
router.patch('/:id/status', async (req, res) => {
  const { status } = req.body;
  const userId = parseInt(req.params.id);

  if (isNaN(userId)) return res.status(400).json({ error: 'Invalid user ID.' });
  if (!['active', 'inactive'].includes(status)) {
    return res.status(400).json({ error: 'status must be active or inactive.' });
  }
  if (userId === req.user.id) {
    return res.status(400).json({ error: 'You cannot change your own account status.' });
  }

  try {
    await getPool().request()
      .input('id',     sql.Int,        userId)
      .input('status', sql.NVarChar(20), status)
      .execute('dbo.usp_UpdateUserStatus');

    return res.json({
      message: `User ${status === 'active' ? 'reactivated' : 'deactivated'} successfully.`,
    });
  } catch (err) {
    if (err.message?.includes('not found')) {
      return res.status(404).json({ error: err.message });
    }
    console.error('[Users] PATCH /:id/status error:', err);
    return res.status(500).json({ error: 'Failed to update user status.' });
  }
});

// ── DELETE /api/users/:id ───────────────────────────────────────────────────
router.delete('/:id', async (req, res) => {
  const userId = parseInt(req.params.id);

  if (isNaN(userId)) return res.status(400).json({ error: 'Invalid user ID.' });
  if (userId === req.user.id) {
    return res.status(400).json({ error: 'You cannot delete your own account.' });
  }

  try {
    await getPool().request()
      .input('id', sql.Int, userId)
      .execute('dbo.usp_DeleteUser');

    return res.json({ message: 'User deleted successfully.' });
  } catch (err) {
    if (err.message?.includes('not found')) {
      return res.status(404).json({ error: err.message });
    }
    console.error('[Users] DELETE /:id error:', err);
    return res.status(500).json({ error: 'Failed to delete user.' });
  }
});

module.exports = router;