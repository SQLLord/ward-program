// routes/announcements.js
const express = require('express');

const { getPool, sql } = require('../db');
const { sendAnnouncementRequest } = require('../services/emailService');
const router = express.Router();


// ── POST /api/announcements/request ──────────────────────────────────────────
router.post('/request', async (req, res) => {
    const {
        submitterName, title, description,
        isAllDay,
        eventDate, eventEndDate,
        eventTime, eventEndTime,
        location,
    } = req.body;

    // ── Validation ────────────────────────────────────────────────────────────
    if (!submitterName?.trim())
        return res.status(400).json({ error: 'Your name is required.' });
    if (!title?.trim())
        return res.status(400).json({ error: 'Announcement title is required.' });
    if (submitterName.trim().length > 100)
        return res.status(400).json({ error: 'Name must be 100 characters or fewer.' });
    if (title.trim().length > 200)
        return res.status(400).json({ error: 'Title must be 200 characters or fewer.' });
    if (description && description.length > 2000)
        return res.status(400).json({ error: 'Description must be 2000 characters or fewer.' });
    if (eventDate && !/^\d{4}-\d{2}-\d{2}$/.test(eventDate))
        return res.status(400).json({ error: 'Invalid date format.' });
    if (eventEndDate && !/^\d{4}-\d{2}-\d{2}$/.test(eventEndDate))
        return res.status(400).json({ error: 'Invalid end date format.' });
    if (eventTime && !/^\d{2}:\d{2}$/.test(eventTime))
        return res.status(400).json({ error: 'Invalid time format.' });
    if (eventEndTime && !/^\d{2}:\d{2}$/.test(eventEndTime))
        return res.status(400).json({ error: 'Invalid end time format.' });
    if (location && location.length > 2000)
        return res.status(400).json({ error: 'Location must be 2000 characters or fewer.' });

    try {
        const r = await getPool().request().execute('dbo.usp_GetWardSettings');
        const settings = r.recordset[0];

        if (!settings?.announcement_enabled)
            return res.status(503).json({ error: 'Announcement requests are not currently enabled.' });

        const rawEmails = settings.announcement_emails ?? '';
        const toEmails  = rawEmails.split(',').map(e => e.trim()).filter(e => e.includes('@'));

        if (toEmails.length === 0)
            return res.status(503).json({ error: 'Announcement requests are not configured yet.' });

        const result = await sendAnnouncementRequest({
            submitterName: submitterName.trim(),
            title:         title.trim(),
            description:   description?.trim() ?? '',
            isAllDay:      !!isAllDay,
            eventDate:     eventDate     ?? '',
            eventEndDate:  eventEndDate  ?? '',
            eventTime:     eventTime     ?? '',
            eventEndTime:  eventEndTime  ?? '',
            location:      location?.trim() ?? '',
            wardName:      settings.ward_name ?? '',
            toEmails,
        });

        console.log(
            `[Announcements] Request submitted by "${submitterName.trim()}" — "${title.trim()}"`,
            result.devMode ? '(dev mode — not sent)' : `messageId: ${result.messageId}`
        );

        return res.json({
            success: true,
            message: 'Your announcement request has been submitted!',
            ...(result.devMode ? { devMode: true } : {}),
        });

    } catch (err) {
        console.error('[Announcements] POST /request error:', err);
        return res.status(500).json({ error: 'Failed to send announcement request. Please try again.' });
    }
});

// ── GET /api/announcements/settings ──────────────────────────────────────────
router.get('/settings', async (_req, res) => {
    try {
        const r = await getPool().request().execute('dbo.usp_GetWardSettings');
        const s = r.recordset[0];
        return res.json({
            announcementEnabled: !!s?.announcement_enabled,
            hasEmails:           !!(s?.announcement_emails?.trim()),
        });
    } catch (err) {
        console.error('[Announcements] GET /settings error:', err);
        return res.status(500).json({ error: 'Failed to fetch settings.' });
    }
});

module.exports = router;
