// routes/templates.js
const express = require('express');
const { getPool, sql } = require('../db');
const { verifyToken } = require('../middleware/auth');
const { requireRole } = require('../middleware/requireRole');
const router = express.Router();

// ── Helper: strip non-template fields from a program ─────────────────────────
// Removes date, announcements, image data, and names from meeting items
function buildTemplateJson(body) {
    const STRIP_ITEM_FIELDS = [
        'number', 'title', 'name', 'personName',
        'performers', 'piece', 'performedBy', 'witness1', 'witness2',
    ];

    const meetingItems = (body.meetingOrder?.meetingItems ?? []).map(item => {
        const stripped = { id: item.id, type: item.type };
        // Keep text for customText items — it's structural not personal
        if (item.type === 'customText') stripped.text = item.text ?? '';
        return stripped;
    });

    // Strip image from cover layout blocks but keep everything else
    const coverLayout = (body.cover?.layout ?? []).map(block => {
        if (block?.type === 'image') return { id: block.id, type: 'image' };
        return block;
    });

    return {
        programName:    body.programName ?? '',
        cover: {
            layout:         coverLayout,
            imageBleed:     false,    // never template the bleed setting
            imageHeightPct: body.cover?.imageHeightPct ?? 50,
            printSettings:  body.cover?.printSettings ?? { preset: 'standard' },
        },
        meetingOrder: {
            conducting:    body.meetingOrder?.conducting  ?? '',
            presiding:     body.meetingOrder?.presiding   ?? '',
            chorister:     body.meetingOrder?.chorister   ?? '',
            accompanist:   body.meetingOrder?.accompanist ?? '',
            meetingItems,
            printSettings: body.meetingOrder?.printSettings ?? { preset: 'standard' },
        },
        announcementSettings: body.announcementSettings ?? { preset: 'standard' },
        leadershipSettings:   body.leadershipSettings   ?? { preset: 'standard' },
        leadershipMode:       body.leadershipMode       ?? 'default',
        schedulesMode:        body.schedulesMode         ?? 'default',
        schedulesPublic:      body.schedulesPublic       !== false,
    };
}

// ── GET /api/templates ────────────────────────────────────────────────────────
router.get('/', verifyToken, async (req, res) => {
    try {
        const r = await getPool().request().execute('dbo.usp_GetProgramTemplates');
        return res.json(r.recordset.map(t => ({
            id:            t.id,
            name:          t.name,
            createdAt:     t.created_at,
            lastModified:  t.last_modified,
            createdByName: t.created_by_name ?? '',
        })));
    } catch (err) {
        console.error('[Templates] GET / error:', err);
        return res.status(500).json({ error: 'Failed to fetch templates.' });
    }
});

// ── GET /api/templates/by-name/:name ─────────────────────────────────────────
// Check if a template name already exists
router.get('/by-name/:name', verifyToken, async (req, res) => {
    try {
        const r = await getPool().request()
            .input('name', sql.NVarChar(200), req.params.name)
            .execute('dbo.usp_GetProgramTemplateByName');

        const row = r.recordset[0];
        if (!row) return res.json({ exists: false });
        return res.json({ exists: true, id: row.id, name: row.name });
    } catch (err) {
        console.error('[Templates] GET /by-name error:', err);
        return res.status(500).json({ error: 'Failed to check template name.' });
    }
});

// ── GET /api/templates/:id ────────────────────────────────────────────────────
router.get('/:id', verifyToken, async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        if (isNaN(id)) return res.status(400).json({ error: 'Invalid template ID.' });

        const r = await getPool().request()
            .input('id', sql.Int, id)
            .execute('dbo.usp_GetProgramTemplate');

        const row = r.recordset[0];
        if (!row) return res.status(404).json({ error: 'Template not found.' });

        return res.json({
            id:            row.id,
            name:          row.name,
            template:      JSON.parse(row.template_json),
            createdAt:     row.created_at,
            lastModified:  row.last_modified,
            createdByName: row.created_by_name ?? '',
        });
    } catch (err) {
        console.error('[Templates] GET /:id error:', err);
        return res.status(500).json({ error: 'Failed to fetch template.' });
    }
});



// ── POST /api/templates ───────────────────────────────────────────────────────
router.post('/', verifyToken, requireRole('bishopric', 'editor'), async (req, res) => {
    try {
        const { name, program } = req.body;
        if (!name?.trim())   return res.status(400).json({ error: 'Template name is required.' });
        if (!program)        return res.status(400).json({ error: 'Program data is required.' });
        if (name.trim().length > 200)
            return res.status(400).json({ error: 'Name must be 200 characters or fewer.' });

        const templateJson = JSON.stringify(buildTemplateJson(program));

        const r = await getPool().request()
            .input('name',          sql.NVarChar(200), name.trim())
            .input('template_json', sql.NVarChar(sql.MAX), templateJson)
            .input('created_by',    sql.Int, req.user.id)
            .execute('dbo.usp_CreateProgramTemplate');

        return res.status(201).json({ id: r.recordset[0].id, name: name.trim() });
    } catch (err) {
        console.error('[Templates] POST / error:', err);
        return res.status(500).json({ error: 'Failed to create template.' });
    }
});

// ── PUT /api/templates/:id ────────────────────────────────────────────────────
// Full update — overwrites template content
router.put('/:id', verifyToken, requireRole('bishopric', 'editor'), async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        if (isNaN(id)) return res.status(400).json({ error: 'Invalid template ID.' });

        const { name, program } = req.body;
        if (!name?.trim())   return res.status(400).json({ error: 'Template name is required.' });
        if (!program)        return res.status(400).json({ error: 'Program data is required.' });
        if (name.trim().length > 200)
            return res.status(400).json({ error: 'Name must be 200 characters or fewer.' });

        const templateJson = JSON.stringify(buildTemplateJson(program));

        await getPool().request()
            .input('id',            sql.Int, id)
            .input('name',          sql.NVarChar(200), name.trim())
            .input('template_json', sql.NVarChar(sql.MAX), templateJson)
            .execute('dbo.usp_UpdateProgramTemplate');

        return res.json({ success: true });
    } catch (err) {
        console.error('[Templates] PUT /:id error:', err);
        if (err.message?.includes('not found'))
            return res.status(404).json({ error: err.message });
        return res.status(500).json({ error: 'Failed to update template.' });
    }
});

// ── PATCH /api/templates/:id/rename ──────────────────────────────────────────
router.patch('/:id/rename', verifyToken, requireRole('bishopric', 'editor'), async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        if (isNaN(id)) return res.status(400).json({ error: 'Invalid template ID.' });

        const { name } = req.body;
        if (!name?.trim()) return res.status(400).json({ error: 'Name is required.' });
        if (name.trim().length > 200)
            return res.status(400).json({ error: 'Name must be 200 characters or fewer.' });

        await getPool().request()
            .input('id',   sql.Int, id)
            .input('name', sql.NVarChar(200), name.trim())
            .execute('dbo.usp_RenameProgramTemplate');

        return res.json({ success: true });
    } catch (err) {
        console.error('[Templates] PATCH /:id/rename error:', err);
        if (err.message?.includes('not found'))
            return res.status(404).json({ error: err.message });
        return res.status(500).json({ error: 'Failed to rename template.' });
    }
});

// ── DELETE /api/templates/:id ─────────────────────────────────────────────────
router.delete('/:id', verifyToken, requireRole('bishopric', 'editor'), async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        if (isNaN(id)) return res.status(400).json({ error: 'Invalid template ID.' });

        await getPool().request()
            .input('id', sql.Int, id)
            .execute('dbo.usp_DeleteProgramTemplate');

        return res.json({ message: 'Template deleted.' });
    } catch (err) {
        console.error('[Templates] DELETE /:id error:', err);
        if (err.message?.includes('not found'))
            return res.status(404).json({ error: err.message });
        return res.status(500).json({ error: 'Failed to delete template.' });
    }
});

module.exports = router;
