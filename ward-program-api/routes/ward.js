const express = require('express');
const bcrypt = require('bcrypt');
const { getPool, sql } = require('../db');
const { verifyToken } = require('../middleware/auth');
const { requireRole } = require('../middleware/requireRole');
const router = express.Router();

const SALT_ROUNDS = 12;




const mapWardSettings = (row) => ({
    wardName:            row.ward_name,
    stakeName:           row.stake_name ?? null,
    hasViewPassword:     !!row.has_view_password,
    announcementEmails:  row.announcement_emails ?? '',
    announcementEnabled: row.announcement_enabled !== false && row.announcement_enabled !== 0,
    contactEmails:       row.contact_emails ?? '',
    updatedAt:           row.updated_at ?? null,
    updatedBy:           row.updated_by ?? null,
    wardUrl:             row.ward_url ?? '',
});




// ── GET /api/ward/settings ───────────────────────────────────────────────────
// Auth required — editors and bishopric only
router.get('/settings', verifyToken, requireRole('bishopric', 'editor'), async (_req, res) => {
  try {
    const r = await getPool().request().execute('dbo.usp_GetWardSettings');
    return res.json(mapWardSettings(r.recordset[0]));
  } catch (err) {
    console.error('[Ward] GET /settings error:', err);
    return res.status(500).json({ error: 'Failed to fetch ward settings.' });
  }
});

// ── PUT /api/ward/settings ───────────────────────────────────────────────────
// Auth required — editors and bishopric only
router.put('/settings', verifyToken, requireRole('bishopric', 'editor'), async (req, res) => {
  try {
      const { wardName, stakeName, viewPassword,
              announcementEmails, announcementEnabled, wardUrl, contactEmails } = req.body; 

    if (!wardName?.trim()) {
      return res.status(400).json({ error: 'Ward name is required.' });
    }

    
    if (wardName.trim().length > 100) {
      return res.status(400).json({ error: 'Ward name must be 100 characters or fewer.' });
    }
    if (stakeName && stakeName.trim().length > 100) {
      return res.status(400).json({ error: 'Stake name must be 100 characters or fewer.' });
    }

    if (wardUrl && wardUrl.trim().length > 500) {
      return res.status(400).json({ error: 'Ward URL must be 500 characters or fewer.' });
    }

    // Hash new password if provided, otherwise pass NULL to keep existing
    let passwordHash = null;
    let passwordChanged = false;


    if (viewPassword?.trim()) {
      
      if (viewPassword.trim().length < 8) {
        return res.status(400).json({ error: 'Member view password must be at least 8 characters.' });
      }

      passwordHash = await bcrypt.hash(viewPassword.trim(), SALT_ROUNDS);
      passwordChanged = true;
    }

    const r = await getPool().request()
      .input('ward_name',          sql.NVarChar(100), wardName.trim())
      .input('stake_name',         sql.NVarChar(100), stakeName?.trim() ?? null)
      .input('view_password_hash', sql.NVarChar(255), passwordHash)
      .input('updated_by',         sql.Int,           req.user.id)
      .input('announcement_emails',  sql.NVarChar(2000), announcementEmails?.trim() ?? null)
      .input('announcement_enabled', sql.Bit,            announcementEnabled !== false ? 1 : 0)
      .input('ward_url',             sql.NVarChar(500), wardUrl?.trim() ?? null)
      .input('contact_emails',       sql.NVarChar(2000), contactEmails?.trim() ?? null)
      .execute('dbo.usp_SaveWardSettings');

    
    return res.json({
      ...mapWardSettings(r.recordset[0]),
      passwordChanged,
    });

  } catch (err) {
    console.error('[Ward] PUT /settings error:', err);
    return res.status(500).json({ error: 'Failed to save ward settings.' });
  }
});

// ── GET /api/ward/name ───────────────────────────────────────────────────────
// Public — no auth — used by ProgramHome to show ward name in header
router.get('/name', async (_req, res) => {
  try {
    const r = await getPool().request().execute('dbo.usp_GetWardSettings');
    const row = r.recordset[0];


    // ← L2 FIX: cache ward name for 5 minutes — rarely changes, saves DB hits
    res.set('Cache-Control', 'public, max-age=300');


    return res.json({
      wardName: row?.ward_name ?? '',
      stakeName: row?.stake_name ?? null,
      wardUrl:   row?.ward_url   ?? '',
    });
  } catch (err) {
    console.error('[Ward] GET /name error:', err);
    return res.status(500).json({ error: 'Failed to fetch ward name.' });
  }
});

module.exports = router;