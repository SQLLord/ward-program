// routes/contact.js
const express = require('express');
const { getPool, sql } = require('../db');
const { sendContactRequest } = require('../services/emailService');
const router = express.Router();

// ── POST /api/contact/request ─────────────────────────────────────────────────
router.post('/request', async (req, res) => {
    const { name, email, phone, message } = req.body;

    // ── Validation ────────────────────────────────────────────────────────────
    if (!name?.trim())
        return res.status(400).json({ error: 'Your name is required.' });
    if (!message?.trim())
        return res.status(400).json({ error: 'A message is required.' });
    if (!email?.trim() && !phone?.trim())
        return res.status(400).json({ error: 'Please provide at least one contact method — email or phone.' });
    if (name.trim().length > 100)
        return res.status(400).json({ error: 'Name must be 100 characters or fewer.' });
    if (message.trim().length > 2000)
        return res.status(400).json({ error: 'Message must be 2000 characters or fewer.' });
    if (email && email.trim().length > 255)
        return res.status(400).json({ error: 'Email address must be 255 characters or fewer.' });
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))
        return res.status(400).json({ error: 'Please provide a valid email address.' });
    if (phone && phone.trim().length > 20)
        return res.status(400).json({ error: 'Phone number must be 20 characters or fewer.' });

    try {
        const r = await getPool().request().execute('dbo.usp_GetWardSettings');
        const settings = r.recordset[0];

        if (!settings?.contact_enabled && settings?.contact_enabled !== undefined) {
            return res.status(503).json({ error: 'Contact requests are not currently enabled.' });
        }

        const rawEmails = settings?.contact_emails ?? '';
        const toEmails = rawEmails.split(',').map(e => e.trim()).filter(e => e.includes('@'));

        if (toEmails.length === 0)
            return res.status(503).json({ error: 'Contact is not configured yet. Please try again later.' });

        const result = await sendContactRequest({
            name:     name.trim(),
            email:    email?.trim() ?? '',
            phone:    phone?.trim() ?? '',
            message:  message.trim(),
            wardName: settings.ward_name ?? '',
            toEmails,
        });

        console.log(
            `[Contact] Request from "${name.trim()}"`,
            result.devMode ? '(dev mode — not sent)' : `messageId: ${result.messageId}`
        );

        return res.json({
            success: true,
            message: 'Your message has been sent!',
            ...(result.devMode ? { devMode: true } : {}),
        });

    } catch (err) {
        console.error('[Contact] POST /request error:', err);
        return res.status(500).json({ error: 'Failed to send your message. Please try again.' });
    }
});

// ── GET /api/contact/settings ─────────────────────────────────────────────────
// Public — tells the frontend whether to show the Contact Us button
router.get('/settings', async (_req, res) => {
    try {
        const r = await getPool().request().execute('dbo.usp_GetWardSettings');
        const s = r.recordset[0];
        return res.json({
            contactEnabled: !!(s?.contact_emails?.trim()),
        });
    } catch (err) {
        console.error('[Contact] GET /settings error:', err);
        return res.status(500).json({ error: 'Failed to fetch settings.' });
    }
});

module.exports = router;
