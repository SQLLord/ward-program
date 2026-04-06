// routes/announcements.js
const express = require('express');
const { getPool, sql } = require('../db');
const { sendAnnouncementRequest } = require('../services/emailService');
const { verifyToken } = require('../middleware/auth');
const { requireRole } = require('../middleware/requireRole');
const router = express.Router();

// ── POST /api/announcements/request ──────────────────────────────────────────
// Public — no auth required
router.post('/request', async (req, res) => {
    const {
        submitterName, title, description,
        isAllDay, eventDate, eventEndDate,
        eventTime, eventEndTime, location,
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
        const pool = getPool();
        const r = await pool.request().execute('dbo.usp_GetWardSettings');
        const settings = r.recordset[0];

        if (!settings?.announcement_enabled)
            return res.status(503).json({ error: 'Announcement requests are not currently enabled.' });

        const rawEmails = settings.announcement_emails ?? '';
        const toEmails = rawEmails.split(',').map(e => e.trim()).filter(e => e.includes('@'));

        if (toEmails.length === 0)
            return res.status(503).json({ error: 'Announcement requests are not configured yet.' });

        // ── Save to DB ────────────────────────────────────────────────────────
        const parseTime = (t) => /^\d{2}:\d{2}$/.test(t ?? '') ? `${t}:00` : null;

        await pool.request()
            .input('submitter_name',  sql.NVarChar(100),  submitterName.trim())
            .input('title',           sql.NVarChar(200),  title.trim())
            .input('description',     sql.NVarChar(2000), description?.trim() || null)
            .input('is_all_day',      sql.Bit,            isAllDay ? 1 : 0)
            .input('event_date',      sql.Date,           eventDate || null)
            .input('event_end_date',  sql.Date,           eventEndDate || null)
            .input('event_time',      sql.NVarChar(8),    parseTime(eventTime))
            .input('event_end_time',  sql.NVarChar(8),    parseTime(eventEndTime))
            .input('location',        sql.NVarChar(2000), location?.trim() || null)
            .execute('dbo.usp_CreateAnnouncementRequest');

        // ── Send email ────────────────────────────────────────────────────────
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
// Public — tells the frontend whether to show the Submit Announcement button
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

// ── GET /api/announcements/requests ──────────────────────────────────────────
// Auth required — editor or bishopric
router.get('/requests', verifyToken, requireRole('bishopric', 'editor'), async (req, res) => {
    try {
        const status = req.query.status ?? null;
        const validStatuses = ['pending', 'added', 'dismissed', null];
        if (!validStatuses.includes(status))
            return res.status(400).json({ error: 'Invalid status filter.' });

        const r = await getPool().request()
            .input('status', sql.NVarChar(20), status)
            .execute('dbo.usp_GetAnnouncementRequests');

        return res.json(r.recordset.map(row => ({
            id:             row.id,
            submitterName:  row.submitter_name,
            title:          row.title,
            description:    row.description ?? '',
            isAllDay:       !!row.is_all_day,
            date:           row.event_date     ? row.event_date.toISOString().slice(0, 10)     : '',
            endDate:        row.event_end_date ? row.event_end_date.toISOString().slice(0, 10) : '',
            time:           row.event_time     ? String(row.event_time).slice(0, 5)            : '',
            endTime:        row.event_end_time ? String(row.event_end_time).slice(0, 5)        : '',
            location:       row.location ?? '',
            status:         row.status,
            submittedAt:    row.submitted_at,
            addedToProgram: row.added_to_program ?? null,
        })));
    } catch (err) {
        console.error('[Announcements] GET /requests error:', err);
        return res.status(500).json({ error: 'Failed to fetch announcement requests.' });
    }
});

// ── PATCH /api/announcements/requests/:id/status ─────────────────────────────
// Auth required — editor or bishopric
router.patch('/requests/:id/status', verifyToken, requireRole('bishopric', 'editor'), async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        if (isNaN(id)) return res.status(400).json({ error: 'Invalid request ID.' });

        const { status } = req.body;
        if (!['pending', 'added', 'dismissed'].includes(status))
            return res.status(400).json({ error: 'status must be pending, added, or dismissed.' });

        await getPool().request()
            .input('id',     sql.Int,          id)
            .input('status', sql.NVarChar(20), status)
            .execute('dbo.usp_UpdateAnnouncementRequestStatus');

        return res.json({ success: true });
    } catch (err) {
        console.error('[Announcements] PATCH /requests/:id/status error:', err);
        if (err.message?.includes('not found')) return res.status(404).json({ error: err.message });
        return res.status(500).json({ error: 'Failed to update request status.' });
    }
});

// ── POST /api/announcements/requests/mark-added ───────────────────────────────
// Auth required — editor or bishopric
// Called after a successful program save to bulk-mark imported requests
router.post('/requests/mark-added', verifyToken, requireRole('bishopric', 'editor'), async (req, res) => {
    try {
        const { requestIds, programId } = req.body;
        if (!Array.isArray(requestIds) || requestIds.length === 0)
            return res.json({ success: true }); // nothing to mark

        if (!programId || isNaN(parseInt(programId)))
            return res.status(400).json({ error: 'Invalid program ID.' });

        const ids = requestIds
            .map(id => parseInt(id))
            .filter(id => !isNaN(id))
            .join(',');

        if (!ids)
            return res.json({ success: true });

        await getPool().request()
            .input('ids',        sql.NVarChar(sql.MAX), ids)
            .input('program_id', sql.Int,               parseInt(programId))
            .execute('dbo.usp_MarkAnnouncementRequestsAdded');

        console.log(`[Announcements] Marked ${requestIds.length} request(s) as added to program ${programId}`);
        return res.json({ success: true });
    } catch (err) {
        console.error('[Announcements] POST /requests/mark-added error:', err);
        return res.status(500).json({ error: 'Failed to mark requests as added.' });
    }
});

// ── DELETE /api/announcements/requests/:id ────────────────────────────────────
// Auth required — editor or bishopric
router.delete('/requests/:id', verifyToken, requireRole('bishopric', 'editor'), async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        if (isNaN(id)) return res.status(400).json({ error: 'Invalid request ID.' });

        await getPool().request()
            .input('id', sql.Int, id)
            .execute('dbo.usp_DeleteAnnouncementRequest');

        return res.json({ success: true });
    } catch (err) {
        console.error('[Announcements] DELETE /requests/:id error:', err);
        if (err.message?.includes('not found')) return res.status(404).json({ error: err.message });
        return res.status(500).json({ error: 'Failed to delete announcement request.' });
    }
});

module.exports = router;