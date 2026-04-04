const express = require('express');
const { getPool, sql } = require('../db');
const { verifyToken } = require('../middleware/auth');
const { requireRole } = require('../middleware/requireRole');
const { optionalAuth } = require('../middleware/optionalAuth');
const router = express.Router();


const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const isValidDate = (d) => DATE_REGEX.test(d) && !isNaN(new Date(d).getTime());
const isValidUrl = (u) => { try { const p = new URL(u); return ['http:','https:'].includes(p.protocol); } catch { return false; } };


// =============================================================================
// HELPER: buildTVPs(body)
// Converts the request body into mssql Table objects matching each TVP type
// =============================================================================
function buildTVPs(body) {

  // ── Cover blocks ─────────────────────────────────────────────────────────
  const coverTable = new sql.Table();
  coverTable.columns.add('sort_order', sql.Int, { nullable: false });
  coverTable.columns.add('block_type', sql.NVarChar(50), { nullable: false });
  coverTable.columns.add('welcome_text', sql.NVarChar(sql.MAX), { nullable: true });
  coverTable.columns.add('custom_text', sql.NVarChar(sql.MAX), { nullable: true });
  
  coverTable.columns.add('quote_text',       sql.NVarChar(1000),   { nullable: true  }); // ← ADD
  coverTable.columns.add('attribution_text', sql.NVarChar(255),    { nullable: true  }); // ← ADD

  (body.cover?.layout ?? []).forEach((b, i) => {
    if (!b?.type) return;                                    // ← skip invalid blocks
    coverTable.rows.add(
      i,
      String(b.type).slice(0, 50),                         // ← enforce column length
      b.welcomeText ? String(b.welcomeText).slice(0, 2000) : null,
      b.customText  ? String(b.customText).slice(0, 2000)  : null,
      b.quoteText     ? String(b.quoteText).slice(0, 1000)      : null,  // ← NEW
      b.attributionText ? String(b.attributionText).slice(0, 255) : null  // ← NEW

    );
  });

  // ── Meeting items ─────────────────────────────────────────────────────────
  const meetingTable = new sql.Table();
  meetingTable.columns.add('sort_order',   sql.Int,          { nullable: false });
  meetingTable.columns.add('item_type',    sql.NVarChar(50), { nullable: false });
  meetingTable.columns.add('hymn_number',  sql.NVarChar(10), { nullable: true });
  meetingTable.columns.add('hymn_title',   sql.NVarChar(400),{ nullable: true });
  meetingTable.columns.add('person_name',  sql.NVarChar(200),{ nullable: true });
  meetingTable.columns.add('topic',        sql.NVarChar(1000),{ nullable: true });
  meetingTable.columns.add('performers',   sql.NVarChar(400),{ nullable: true });
  meetingTable.columns.add('piece',        sql.NVarChar(400),{ nullable: true });
  meetingTable.columns.add('performed_by', sql.NVarChar(200),{ nullable: true });
  meetingTable.columns.add('witness1',     sql.NVarChar(200),{ nullable: true });
  meetingTable.columns.add('witness2',     sql.NVarChar(200),{ nullable: true });
  meetingTable.columns.add('custom_text',  sql.NVarChar(500),{ nullable: true });
  (body.meetingOrder?.meetingItems ?? []).forEach((m, i) => {
    if (!m?.type) return;                                    // ← skip invalid items
    meetingTable.rows.add(
      i,
      String(m.type).slice(0, 50),
      m.number     ? String(m.number).slice(0, 10)               : null,
      m.title      ? String(m.title).slice(0, 200)               : null,
      (m.personName ?? m.name) ? String(m.personName ?? m.name).slice(0, 200) : null,
      m.topic      ? String(m.topic).slice(0, 1000)               : null,
      m.performers ? String(m.performers).slice(0, 400)          : null,
      m.piece      ? String(m.piece).slice(0, 400)               : null,
      m.performedBy? String(m.performedBy).slice(0, 200)         : null,
      m.witness1   ? String(m.witness1).slice(0, 200)            : null,
      m.witness2   ? String(m.witness2).slice(0, 200)            : null,
      m.text       ? String(m.text).slice(0, 500)                : null
    );
  });

  // ── Announcements ─────────────────────────────────────────────────────────
  const annTable = new sql.Table();
  annTable.columns.add('sort_order',    sql.Int,           { nullable: false });
  annTable.columns.add('title',         sql.NVarChar(200), { nullable: false });
  annTable.columns.add('description',   sql.NVarChar(sql.MAX), { nullable: true });
  annTable.columns.add('event_date',    sql.Date,          { nullable: true });
  annTable.columns.add('event_end_date',sql.Date,          { nullable: true }); // ← NEW
  annTable.columns.add('event_time',    sql.NVarChar(8), { nullable: true });
  annTable.columns.add('event_end_time',sql.NVarChar(8), { nullable: true });
  annTable.columns.add('is_all_day',    sql.Bit,           { nullable: false }); // ← NEW
  annTable.columns.add('is_public',     sql.Bit,           { nullable: false });
  annTable.columns.add('location',      sql.NVarChar(2000), { nullable: true }); // ← NEW
  (body.announcements ?? []).forEach((a, i) => {
    if (!a?.title?.trim()) return;

    const validDate    = /^\d{4}-\d{2}-\d{2}$/.test(a.date    ?? '') ? a.date    : null;
    const validEndDate = /^\d{4}-\d{2}-\d{2}$/.test(a.endDate ?? '') ? a.endDate : null;

    const parseTime = (t) => {
      if (!/^\d{2}:\d{2}$/.test(t ?? '')) return null;
      return `${t}:00`;  // "HH:MM:SS" plain string — no Date object, no conversion
    };


    annTable.rows.add(
      i,                                                          // sort_order
      String(a.title).slice(0, 200),                             // title
      a.description ? String(a.description).slice(0, 10000) : null, // description
      validDate,                                                  // event_date
      validEndDate,                                               // event_end_date
      parseTime(a.time),                                         // event_time
      parseTime(a.endTime),                                      // event_end_time
      a.isAllDay ? 1 : 0,                                        // is_all_day
      a.isPublic === true || a.isPublic === 1 ? 1 : 0,           // is_public
      a.location ? String(a.location).slice(0, 2000) : null      // location
    );
  });

  // ── Leadership entries ────────────────────────────────────────────────────
  const leaderTable = new sql.Table();
  leaderTable.columns.add('sort_order', sql.Int,          { nullable: false });
  leaderTable.columns.add('role',       sql.NVarChar(150),{ nullable: true });
  leaderTable.columns.add('name',       sql.NVarChar(150),{ nullable: true });
  leaderTable.columns.add('phone',      sql.NVarChar(20), { nullable: true });
  (body.leadership ?? []).forEach((l, i) => {
    leaderTable.rows.add(
      i,
      l.role  ? String(l.role).slice(0, 150)  : null,
      l.name  ? String(l.name).slice(0, 150)  : null,
      l.phone ? String(l.phone).slice(0, 20)  : null,
    );
  });

  // ── Schedules ─────────────────────────────────────────────────────────────
  const schedTable = new sql.Table();
  schedTable.columns.add('sort_order',   sql.Int,          { nullable: false });
  schedTable.columns.add('organization', sql.NVarChar(200),{ nullable: true });
  schedTable.columns.add('day',          sql.NVarChar(50), { nullable: true });
  schedTable.columns.add('meeting_time', sql.NVarChar(50), { nullable: true });
  schedTable.columns.add('location',     sql.NVarChar(500),{ nullable: true });
  (body.schedules ?? []).forEach((s, i) => {
    schedTable.rows.add(
      i,
      s.organization ? String(s.organization).slice(0, 200) : null,
      s.day          ? String(s.day).slice(0, 50)           : null,
      (s.time ?? s.meeting_time) ? String(s.time ?? s.meeting_time).slice(0, 50) : null,
      s.location     ? String(s.location).slice(0, 500)     : null
    );
  });

  return { coverTable, meetingTable, annTable, leaderTable, schedTable };
}

// =============================================================================
// HELPER: assembleProgram(recordsets)
// Assembles the 6 result sets from usp_GetFullProgram into React-friendly shape
// =============================================================================
function assembleProgram(recordsets) {
  const [programs, coverBlocks, meetingItems,
         announcements, leadershipEntries, schedules] = recordsets;

  const p = programs[0];
  if (!p) return null;

  return {
    id:          p.id,
    date:        p.program_date ? p.program_date.toISOString().slice(0, 10) : '',
    status:      p.status,
    programName: p.program_name ?? '',
    conducting:  p.conducting  ?? '',
    presiding:   p.presiding   ?? '',
    chorister:   p.chorister   ?? '',
    accompanist: p.accompanist ?? '',

    cover: {
      image:         '',
      imageUrl:      '',
      imageSource:   p.cover_image_source ?? 'url',
      imageId:        p.cover_image_id ?? null,
      imageBleed:    !!p.cover_image_bleed,
      imageHeightPct: p.cover_image_height_pct ?? 50,
      quote:         p.cover_quote ?? '',
      attribution:   p.cover_attribution ?? '',
      printSettings: {
        preset:      p.cover_print_preset      ?? 'standard',
        bodySize:    parseFloat(p.cover_print_body_size)    || 9.0,
        headingSize: parseFloat(p.cover_print_heading_size) || 11.0,
      },
      layout: coverBlocks.map(b => ({
        id: b.id, type: b.block_type,
        welcomeText: b.welcome_text ?? undefined,
        customText:  b.custom_text  ?? undefined,
        quoteText:      b.quote_text       ?? undefined,   // ← NEW
        attributionText: b.attribution_text ?? undefined,  // ← NEW
      })),
    },
    meetingOrder: {
      conducting:  p.conducting  ?? '',
      presiding:   p.presiding   ?? '',
      chorister:   p.chorister   ?? '',
      accompanist: p.accompanist ?? '',
      printSettings: {
        preset:      p.meeting_print_preset      ?? 'standard',
        bodySize:    parseFloat(p.meeting_print_body_size)    || 9.0,
        headingSize: parseFloat(p.meeting_print_heading_size) || 11.0,
      },

      meetingItems: meetingItems.map(m => ({
        id:          m.id,
        type:        m.item_type,
        number:      m.hymn_number  ?? undefined,
        title:       m.hymn_title   ?? undefined,
        name:        m.person_name  ?? undefined,
        personName:  m.person_name  ?? undefined,
        topic:       m.topic        ?? undefined,
        performers:  m.performers   ?? undefined,
        piece:       m.piece        ?? undefined,
        performedBy: m.performed_by ?? undefined,
        witness1:    m.witness1     ?? undefined,
        witness2:    m.witness2     ?? undefined,
        text: m.custom_text ?? undefined,
      })),
    },
    
    announcementSettings: {
      preset:      p.ann_print_preset      ?? 'standard',
      bodySize:    parseFloat(p.ann_print_body_size)    || 9.0,
      headingSize: parseFloat(p.ann_print_heading_size) || 11.0,
    },
    leadershipSettings: {
      preset:      p.leader_print_preset      ?? 'standard',
      bodySize:    parseFloat(p.leader_print_body_size)    || 9.0,
      headingSize: parseFloat(p.leader_print_heading_size) || 11.0,
    },

    announcements: announcements.map(a => {
      const parseDbTime = (t) => {
        if (!t) return '';
        // Now always a string like "13:30:00" — just slice to "HH:MM"
        return String(t).slice(0, 5);
      };
      return {
        id:          a.id,
        title:       a.title,
        description: a.description ?? '',
        date:        a.event_date     ? a.event_date.toISOString().slice(0, 10)     : '',
        endDate:     a.event_end_date ? a.event_end_date.toISOString().slice(0, 10) : '',
        time:        parseDbTime(a.event_time),
        endTime:     parseDbTime(a.event_end_time),
        isAllDay:    !!a.is_all_day,
        isPublic:    !!a.is_public,
        location:    a.location ?? '',
      };
    }),
    leadership: leadershipEntries.map(l => ({
      id:    l.id,
      role:  l.role,
      name:  l.name,
      phone: l.phone ?? '',
    })),
    leadershipPublic:       !!p.leadership_public,
    schedules: schedules.map(s => ({
      id:           s.id,
      organization: s.organization,
      day:          s.day          ?? '',
      time:         s.meeting_time ?? '',
      location:     s.location     ?? '',
    })),
    schedulesPublic:        !!p.schedules_public,
    leadershipMode:         p.use_default_leadership ? 'default' : 'custom',
    schedulesMode:          p.use_default_schedules  ? 'default' : 'custom',
    useDefaultLeadership:   !!p.use_default_leadership,
    useDefaultSchedules:    !!p.use_default_schedules,
    lastModified:           p.last_modified,
    publishedAt:            p.published_at,
    archivedAt:             p.archived_at,
    createdAt:              p.created_at,
  };
}

// =============================================================================
// ROUTES
// =============================================================================

// ── GET /api/programs ────────────────────────────────────────────────────────
router.get('/', optionalAuth, async (req, res) => {
  try {
    const pool = getPool();
    const { status, date } = req.query;
    const isAuth = !!req.user; // ← clean, single line

    // ✅ Single proc handles all cases — public always gets status='published'
    const r = await pool.request()
      .input('status', sql.NVarChar(20), isAuth ? (status ?? null) : 'published')
      .input('date', sql.Date, date ?? null)
      .execute('dbo.usp_GetProgramIds');

    const ids = r.recordset.map(row => row.id);
    if (ids.length === 0) return res.json([]);

    const programs = await Promise.all(ids.map(async id => {
      const r = await pool.request()
        .input('id', sql.Int, id)
        .execute('dbo.usp_GetFullProgram');
      return assembleProgram(r.recordsets);
    }));

    return res.json(programs.filter(Boolean));
  } catch (err) {
    console.error('[Programs] GET / error:', err);
    return res.status(500).json({ error: 'Failed to fetch programs.' });
  }
});

// ── GET /api/programs/summary ─────────────────────────────────────────────────
router.get('/summary', verifyToken, async (req, res) => {
  try {
    const pool = getPool();
    const status = (req.query.status && req.query.status !== 'all') ? req.query.status : null;
    const page = Math.max(parseInt(req.query.page ?? '1'), 1);
    const pageSize = Math.min(Math.max(parseInt(req.query.pageSize ?? '25'), 1), 200);

    const r = await pool.request()
      .input('status', sql.NVarChar(20), status)
      .input('page', sql.Int, page)
      .input('pageSize', sql.Int, pageSize)
      .execute('dbo.usp_GetProgramSummary');

    const data = r.recordsets?.[0] ?? r.recordset ?? [];

    // ✅ Map snake_case → camelCase to match the rest of the API
    const mapped = data.map(row => ({
      id:                row.id,
      date:              row.date,
      status:            row.status,
      programName:       row.program_name ?? null,   // ← THE KEY FIX
      lastModified:      row.lastModified,
      quote:             row.quote,
      announcementCount: row.announcementCount,
      meetingItemCount:  row.meetingItemCount,
      speakerCount:      row.speakerCount,
    }));

    return res.json(mapped);
  } catch (err) {
    console.error('[Programs] GET /summary error:', err);
    return res.status(500).json({ error: 'Failed to fetch program summary.' });
  }
});

// ── GET /api/programs/public-schedules ──────────────────────────────────────
// Public endpoint — returns ward default schedules only if schedulesPublic = true
// Never exposes leadership, contact info, or any other ward defaults
router.get('/public-schedules', async (req, res) => {
  try {
    const r = await getPool().request().execute('dbo.usp_GetWardDefaults');
    const [, schedules] = r.recordsets; // ← second recordset only, skip leadership

    return res.json({
      schedules: schedules.map(s => ({
        organization: s.organization ?? '',
        day: s.day ?? '',
        time: s.meeting_time ?? '',
        location: s.location ?? '',
      })),
    });
  } catch (err) {
    console.error('[Ward] GET /public-schedules error:', err);
    return res.status(500).json({ error: 'Failed to fetch schedules.' });
  }
});
// ── GET /api/programs/ward-defaults ──────────────────────────────────────────
router.get('/ward-defaults', verifyToken, async (req, res) => {
  try {
    const r = await getPool().request().execute('dbo.usp_GetWardDefaults');
    const [leadership, schedules] = r.recordsets;
    return res.json({
      leadership: leadership.map(l => ({ id: l.id, role: l.role ?? '', name: l.name ?? '', phone: l.phone ?? '' })),
      schedules:  schedules.map(s  => ({ id: s.id, organization: s.organization ?? '', day: s.day ?? '', meeting_time: s.meeting_time ?? '', location: s.location ?? '' })),
    });
  } catch (err) {
    console.error('[Ward Defaults] GET error:', err);
    return res.status(500).json({ error: 'Failed to fetch ward defaults.' });
  }
});

// ── GET /api/programs/:id ─────────────────────────────────────────────────────
// Fix 6: Use optionalAuth — filter out non-published programs for public users
router.get('/:id', optionalAuth, async (req, res) => {
  try {
    const programId = parseInt(req.params.id);
    if (isNaN(programId)) return res.status(400).json({ error: 'Invalid program ID.' });

    const r = await getPool().request()
      .input('id', sql.Int, programId)
      .execute('dbo.usp_GetFullProgram');

    const program = assembleProgram(r.recordsets);
    if (!program) return res.status(404).json({ error: 'Program not found.' });

    // ── Fix 6: Non-authenticated users can only see published programs ────────
    if (!req.user && program.status !== 'published') {
      return res.status(404).json({ error: 'Program not found.' });
    }

    return res.json(program);
  } catch (err) {
    console.error('[Programs] GET /:id error:', err);
    return res.status(500).json({ error: 'Failed to fetch program.' });
  }
});

// ── POST /api/programs ────────────────────────────────────────────────────────

router.post('/', verifyToken, async (req, res) => {
  try {
    const pool = getPool();
    const body = req.body;

    
    if (body.date && !isValidDate(body.date)) {
      return res.status(400).json({ error: 'Invalid program date format. Use YYYY-MM-DD.' });
    }
    if (body.status && !['draft', 'published'].includes(body.status)) {
      return res.status(400).json({ error: 'status must be draft or published.' });
    }

    const { coverTable, meetingTable, annTable, leaderTable, schedTable } = buildTVPs(body);

    // ── Step 1: Create program — pass base64 as NULL to avoid TDS corruption
    const r = await pool.request()
      .input('program_date',           sql.Date,          body.date ?? new Date().toISOString().slice(0, 10))
      .input('status',                 sql.NVarChar(20),  ['draft','published'].includes(body.status) ? body.status : 'draft')
      .input('program_name',           sql.NVarChar(200), body.programName ?? null)
      .input('conducting',             sql.NVarChar(150), body.meetingOrder?.conducting  ?? body.conducting  ?? null)
      .input('presiding',              sql.NVarChar(150), body.meetingOrder?.presiding   ?? body.presiding   ?? null)
      .input('chorister',              sql.NVarChar(150), body.meetingOrder?.chorister   ?? body.chorister   ?? null)
      .input('accompanist',            sql.NVarChar(150), body.meetingOrder?.accompanist ?? body.accompanist ?? null)
      .input('cover_image_source',     sql.NVarChar(20),  body.cover?.imageSource        ?? 'url')
      .input('cover_image_id',     sql.Int,             body.cover?.imageId ?? null)  // ← ADD 
      .input('cover_image_bleed',      sql.Bit,           body.cover?.imageBleed         ? 1 : 0)

      .input('cover_image_height_pct', sql.Int, body.cover?.imageHeightPct ?? 50)
      // In addHeaderInputs() — replace old print_preset/body_size/heading_size with:
      .input('cover_print_preset',        sql.NVarChar(20),  body.cover?.printSettings?.preset      ?? 'standard')
      .input('cover_print_body_size',     sql.Decimal(4,1),  body.cover?.printSettings?.bodySize    ?? 9.0)
      .input('cover_print_heading_size',  sql.Decimal(4,1),  body.cover?.printSettings?.headingSize ?? 11.0)
      .input('meeting_print_preset',      sql.NVarChar(20),  body.meetingOrder?.printSettings?.preset      ?? 'standard')
      .input('meeting_print_body_size',   sql.Decimal(4,1),  body.meetingOrder?.printSettings?.bodySize    ?? 9.0)
      .input('meeting_print_heading_size',sql.Decimal(4,1),  body.meetingOrder?.printSettings?.headingSize ?? 11.0)
      .input('ann_print_preset',          sql.NVarChar(20),  body.announcementSettings?.preset      ?? 'standard')
      .input('ann_print_body_size',       sql.Decimal(4,1),  body.announcementSettings?.bodySize    ?? 9.0)
      .input('ann_print_heading_size',    sql.Decimal(4,1),  body.announcementSettings?.headingSize ?? 11.0)
      .input('leader_print_preset',       sql.NVarChar(20),  body.leadershipSettings?.preset        ?? 'standard')
      .input('leader_print_body_size',    sql.Decimal(4,1),  body.leadershipSettings?.bodySize      ?? 9.0)
      .input('leader_print_heading_size', sql.Decimal(4,1),  body.leadershipSettings?.headingSize   ?? 11.0)

      .input('cover_quote',            sql.NVarChar(1000), body.cover?.quote              ?? null)
      .input('cover_attribution',      sql.NVarChar(255), body.cover?.attribution        ?? null)
      .input('leadership_public', sql.Bit, 0)
      .input('schedules_public',       sql.Bit,           body.schedulesPublic  !== false ? 1 : 0)
      .input('use_default_leadership', sql.Bit,           (body.leadershipMode ?? 'default') === 'default' ? 1 : 0)
      .input('use_default_schedules',  sql.Bit,           (body.schedulesMode  ?? 'default') === 'default' ? 1 : 0)
      .input('created_by',             sql.Int,           req.user.id)
      .input('published_at',           sql.DateTime2,     body.status === 'published' ? new Date() : null)
      .input('coverBlocks',   sql.TVP('dbo.CoverBlockList'),      coverTable)
      .input('meetingItems',  sql.TVP('dbo.MeetingItemList'),     meetingTable)
      .input('announcements', sql.TVP('dbo.AnnouncementList'),    annTable)
      .input('leadership',    sql.TVP('dbo.LeadershipEntryList'), leaderTable)
      .input('schedules',     sql.TVP('dbo.ScheduleEntryList'),   schedTable)
      .execute('dbo.usp_CreateProgram');

    const newId = r.recordset[0].id;

    
    const program = assembleProgram(
      (await pool.request().input('id', sql.Int, newId).execute('dbo.usp_GetFullProgram')).recordsets
    );
    return res.status(201).json(program);
  } catch (err) {
    console.error('[Programs] POST / error:', err);
    return res.status(500).json({ error: 'Failed to create program.' });
  }
});


// ── PUT /api/programs/ward-defaults/leadership ────────────────────────────────
router.put('/ward-defaults/leadership', verifyToken, requireRole('bishopric', 'editor'), async (req, res) => {
  try {
    const rows = req.body;
    if (!Array.isArray(rows)) return res.status(400).json({ error: 'Expected an array.' });

    const table = new sql.Table();
    table.columns.add('id',         sql.Int,           { nullable: true });
    table.columns.add('sort_order', sql.Int,           { nullable: false });
    table.columns.add('role',       sql.NVarChar(100), { nullable: true });
    table.columns.add('name',       sql.NVarChar(100), { nullable: true });
    table.columns.add('phone',      sql.NVarChar(20),  { nullable: true });
    rows.forEach((r, i) => table.rows.add(r.id ?? null, i, r.role ?? null, r.name ?? null, r.phone ?? null));

    await getPool().request()
      .input('rows', sql.TVP('dbo.WardLeadershipList'), table)
      .execute('dbo.usp_SaveWardLeadership');

    return res.json({ message: 'Ward leadership saved.' });
  } catch (err) {
    console.error('[Ward Defaults] PUT /leadership error:', err);
    return res.status(500).json({ error: 'Failed to save ward leadership.' });
  }
});

// ── PUT /api/programs/ward-defaults/schedules ─────────────────────────────────

router.put('/ward-defaults/schedules', verifyToken, requireRole('bishopric', 'editor'), async (req, res) => {
  try {
    const rows = req.body;
    if (!Array.isArray(rows)) return res.status(400).json({ error: 'Expected an array.' });

    const table = new sql.Table();
    table.columns.add('id',           sql.Int,           { nullable: true });
    table.columns.add('sort_order',   sql.Int,           { nullable: false });
    table.columns.add('organization', sql.NVarChar(200), { nullable: true }); // ← 100 → 200
    table.columns.add('day',          sql.NVarChar(50),  { nullable: true }); // ← 20  → 50
    table.columns.add('meeting_time', sql.NVarChar(50),  { nullable: true }); // ← 20  → 50
    table.columns.add('location',     sql.NVarChar(500), { nullable: true }); // ← 100 → 500 ✅ THE FIX

    rows.forEach((r, i) => table.rows.add(
      r.id ?? null,
      i,
      r.organization ? String(r.organization).slice(0, 200) : null, // ← defensive truncation
      r.day          ? String(r.day).slice(0, 50)          : null,
      (r.meeting_time ?? r.time) ? String(r.meeting_time ?? r.time).slice(0, 50) : null,
      r.location     ? String(r.location).slice(0, 500)    : null   // ← defensive truncation
    ));

    await getPool().request()
      .input('rows', sql.TVP('dbo.WardScheduleList'), table)
      .execute('dbo.usp_SaveWardSchedules');

    return res.json({ message: 'Ward schedules saved.' });
  } catch (err) {
    console.error('[Ward Defaults] PUT /schedules error:', err);
    return res.status(500).json({ error: 'Failed to save ward schedules.' });
  }
});


// ── PUT /api/programs/:id ─────────────────────────────────────────────────────

router.put('/:id', verifyToken, requireRole('bishopric', 'editor'), async (req, res) => {
  try {
    const pool = getPool();
    
    const programId = parseInt(req.params.id);
    if (isNaN(programId)) return res.status(400).json({ error: 'Invalid program ID.' });

    const body = req.body;

    
    if (body.date && !isValidDate(body.date)) {
      return res.status(400).json({ error: 'Invalid program date format. Use YYYY-MM-DD.' });
    }
    if (body.status && !['draft', 'published', 'archived'].includes(body.status)) {
      return res.status(400).json({ error: 'status must be draft, published, or archived.' });
    }

    const { coverTable, meetingTable, annTable, leaderTable, schedTable } = buildTVPs(body);

    // ── Step 1: Save program — pass base64 as NULL to avoid TDS corruption ───
    await pool.request()
      .input('id',                     sql.Int,           programId)
      .input('program_date',           sql.Date,          body.date                      ?? null)
      .input('status',                 sql.NVarChar(20),  body.status                    ?? 'draft')
      .input('program_name',           sql.NVarChar(200), body.programName ?? null) 
      .input('conducting',             sql.NVarChar(200), body.meetingOrder?.conducting  ?? body.conducting  ?? null)
      .input('presiding',              sql.NVarChar(200), body.meetingOrder?.presiding   ?? body.presiding   ?? null)
      .input('chorister',              sql.NVarChar(200), body.meetingOrder?.chorister   ?? body.chorister   ?? null)
      .input('accompanist',            sql.NVarChar(200), body.meetingOrder?.accompanist ?? body.accompanist ?? null)
      .input('cover_image_source',     sql.NVarChar(20),  body.cover?.imageSource        ?? 'url')
      .input('cover_image_id',     sql.Int,             body.cover?.imageId ?? null)  // ← ADD 
      .input('cover_image_bleed',      sql.Bit,           body.cover?.imageBleed         ? 1 : 0)
      .input('cover_image_height_pct', sql.Int,         body.cover?.imageHeightPct ?? 50)
      // In addHeaderInputs() — replace old print_preset/body_size/heading_size with:
      .input('cover_print_preset',        sql.NVarChar(20),  body.cover?.printSettings?.preset      ?? 'standard')
      .input('cover_print_body_size',     sql.Decimal(4,1),  body.cover?.printSettings?.bodySize    ?? 9.0)
      .input('cover_print_heading_size',  sql.Decimal(4,1),  body.cover?.printSettings?.headingSize ?? 11.0)
      .input('meeting_print_preset',      sql.NVarChar(20),  body.meetingOrder?.printSettings?.preset      ?? 'standard')
      .input('meeting_print_body_size',   sql.Decimal(4,1),  body.meetingOrder?.printSettings?.bodySize    ?? 9.0)
      .input('meeting_print_heading_size',sql.Decimal(4,1),  body.meetingOrder?.printSettings?.headingSize ?? 11.0)
      .input('ann_print_preset',          sql.NVarChar(20),  body.announcementSettings?.preset      ?? 'standard')
      .input('ann_print_body_size',       sql.Decimal(4,1),  body.announcementSettings?.bodySize    ?? 9.0)
      .input('ann_print_heading_size',    sql.Decimal(4,1),  body.announcementSettings?.headingSize ?? 11.0)
      .input('leader_print_preset',       sql.NVarChar(20),  body.leadershipSettings?.preset        ?? 'standard')
      .input('leader_print_body_size',    sql.Decimal(4,1),  body.leadershipSettings?.bodySize      ?? 9.0)
      .input('leader_print_heading_size', sql.Decimal(4,1),  body.leadershipSettings?.headingSize   ?? 11.0)
      
      .input('cover_quote',            sql.NVarChar(500), body.cover?.quote              ?? null)
      .input('cover_attribution',      sql.NVarChar(500), body.cover?.attribution        ?? null)
      .input('leadership_public', sql.Bit, 0)
      .input('schedules_public',       sql.Bit,           body.schedulesPublic  !== false ? 1 : 0)
      .input('use_default_leadership', sql.Bit,           (body.leadershipMode ?? 'default') === 'default' ? 1 : 0)
      .input('use_default_schedules',  sql.Bit,           (body.schedulesMode  ?? 'default') === 'default' ? 1 : 0)
      .input('coverBlocks',   sql.TVP('dbo.CoverBlockList'),      coverTable)
      .input('meetingItems',  sql.TVP('dbo.MeetingItemList'),     meetingTable)
      .input('announcements', sql.TVP('dbo.AnnouncementList'),    annTable)
      .input('leadership',    sql.TVP('dbo.LeadershipEntryList'), leaderTable)
      .input('schedules',     sql.TVP('dbo.ScheduleEntryList'),   schedTable)
      .execute('dbo.usp_SaveProgram');

    
    const program = assembleProgram(
      (await pool.request().input('id', sql.Int, programId).execute('dbo.usp_GetFullProgram')).recordsets
    );
    return res.json(program);
  } catch (err) {
    console.error('[Programs] PUT /:id error:', err);
    if (err.message?.includes('not found')) return res.status(404).json({ error: err.message });
    return res.status(500).json({ error: 'Failed to save program.' });
  }
});


// ── DELETE /api/programs/:id ──────────────────────────────────────────────────
router.delete('/:id', verifyToken, requireRole('bishopric', 'editor'), async (req, res) => {
  try {
    const programId = parseInt(req.params.id);
    if (isNaN(programId)) return res.status(400).json({ error: 'Invalid program ID.' });

    await getPool().request()
      .input('id',     sql.Int, programId)
      .input('userId', sql.Int, req.user.id)
      .execute('dbo.usp_DeleteProgram');
    return res.json({ message: 'Program deleted successfully.' });
  } catch (err) {
    console.error('[Programs] DELETE /:id error:', err);
    if (err.message?.includes('not found'))  return res.status(404).json({ error: err.message });
    if (err.message?.includes('published'))  return res.status(400).json({ error: err.message });
    return res.status(500).json({ error: 'Failed to delete program.' });
  }
});

// ── POST /api/programs/:id/publish ────────────────────────────────────────────
router.post('/:id/publish', verifyToken, requireRole('bishopric', 'editor'), async (req, res) => {
  try {
    
    const programId = parseInt(req.params.id);
    if (isNaN(programId)) return res.status(400).json({ error: 'Invalid program ID.' });


    const r = await getPool().request()
      .input('id',              sql.Int,          programId)
      .input('conflict_action', sql.NVarChar(20), req.body?.conflict_action ?? null)
      .execute('dbo.usp_PublishProgram');

    // Conflict detected — first row has result='conflict'
    if (r.recordset?.[0]?.result === 'conflict') {
      return res.status(409).json({
        conflict: true,
        conflicting_programs: r.recordset.map(c => ({
          id:           c.id,
          program_date: c.program_date,
        })),
      });
    }

    // Log audit
    
    await getPool().request()
      .input('programId', sql.Int,          programId)
      .input('userId',    sql.Int,          req.user.id)
      .input('action',    sql.NVarChar(50), 'publish')
      .execute('dbo.usp_LogAudit');
    return res.json({ message: 'Program published successfully.' });
  } catch (err) {
    console.error('[Programs] POST /:id/publish error:', err);
    if (err.message?.includes('not found')) return res.status(404).json({ error: err.message });
    return res.status(500).json({ error: 'Failed to publish program.' });
  }
});

// ── POST /api/programs/:id/unpublish ─────────────────────────────────────────
router.post('/:id/unpublish', verifyToken, requireRole('bishopric', 'editor'), async (req, res) => {
  try {
    
    const programId = parseInt(req.params.id);
    if (isNaN(programId)) return res.status(400).json({ error: 'Invalid program ID.' });

    await getPool().request()
      .input('id',     sql.Int, programId)
      .input('userId', sql.Int, req.user.id)
      .execute('dbo.usp_UnpublishProgram');
    return res.json({ message: 'Program unpublished and moved to draft.' });
  } catch (err) {
    console.error('[Programs] POST /:id/unpublish error:', err);
    if (err.message?.includes('not found')) return res.status(404).json({ error: err.message });
    return res.status(500).json({ error: 'Failed to unpublish program.' });
  }
});

// ── POST /api/programs/:id/archive ────────────────────────────────────────────
router.post('/:id/archive', verifyToken, requireRole('bishopric', 'editor'), async (req, res) => {
  try {
    
    const programId = parseInt(req.params.id);
    if (isNaN(programId)) return res.status(400).json({ error: 'Invalid program ID.' });

    await getPool().request()
      .input('id',     sql.Int, programId)
      .input('userId', sql.Int, req.user.id)
      .execute('dbo.usp_ArchiveProgram');
    return res.json({ message: 'Program archived successfully.' });
  } catch (err) {
    console.error('[Programs] POST /:id/archive error:', err);
    if (err.message?.includes('not found')) return res.status(404).json({ error: err.message });
    return res.status(500).json({ error: 'Failed to archive program.' });
  }
});

// ── POST /api/programs/:id/duplicate ─────────────────────────────────────────
router.post('/:id/duplicate', verifyToken, requireRole('bishopric', 'editor'), async (req, res) => {
  try {
    
    const programId = parseInt(req.params.id);
    if (isNaN(programId)) return res.status(400).json({ error: 'Invalid program ID.' });

    const r = await getPool().request()
      .input('sourceId',  sql.Int, programId)
      .input('createdBy', sql.Int, req.user.id)
      .execute('dbo.usp_DuplicateProgram');

    const newId = r.recordset[0].id;
    const program = assembleProgram(
      (await getPool().request().input('id', sql.Int, newId).execute('dbo.usp_GetFullProgram')).recordsets
    );
    return res.status(201).json(program);
  } catch (err) {
    console.error('[Programs] POST /:id/duplicate error:', err);
    if (err.message?.includes('not found')) return res.status(404).json({ error: err.message });
    return res.status(500).json({ error: 'Failed to duplicate program.' });
  }
});

module.exports = router;