// src/utils/panelHealth.js
// ============================================================
// Pure overflow calculation engine — no React, no side effects.
// Called on every step render and before publish.
// ============================================================
import {
  PANEL_HEIGHT_IN, PANEL_WIDTH_IN, LEFT_PANEL_WIDTH,
  getResolvedSizes, estimateLines,
} from './printSettingsUtils';
import { resolveImgHeight } from './coverImageUtils';

// ── Status thresholds ────────────────────────────────────────────────────
const getStatus = (pct, isCover = false) => {
  if (pct > 500) return 'overflow';               // 🔴 hard block
  if (pct >= (isCover ? 95 : 90)) return 'warning'; // 🟡 caution
  return 'ok';                                     // 🟢 good
};

const makePanel = (usedIn, warnings = [], isCover = false) => {
  const usedPct = Math.round((usedIn / PANEL_HEIGHT_IN) * 100);
  return { usedPct, usedIn, status: getStatus(usedPct, isCover), warnings };
};

// ─────────────────────────────────────────────────────────────────────────
// PANEL 1 — Cover (Page 1 Right)
// ─────────────────────────────────────────────────────────────────────────
const calcCover = (formData) => {
  const cover = formData.cover ?? {};
  const ps = cover.printSettings;
  const sizes = getResolvedSizes(ps);
  const warnings = [];

  if (cover.imageBleed) {
    return makePanel(PANEL_HEIGHT_IN, [], true);
  }

  let used = 0;
  const layout = cover.layout ?? [];

  for (const block of layout) {
    const type = typeof block === 'string' ? block : block?.type;
    if (!type) continue;

    switch (type) {
      case 'date':
        if (cover.date || formData.date) {
          used += sizes.titleLineH + 0.20;       // ← sync: was +0.15, PDF uses +0.20
        }
        break;

      case 'image': {
        const imgHeightIn = resolveImgHeight(cover);
        used += imgHeightIn + 0.30;              // ← sync: was +0.15, PDF uses +0.30
        if (imgHeightIn / PANEL_HEIGHT_IN > 0.90 && layout.length > 1) {
          warnings.push('Image height leaves very little room for other cover blocks.');
        }
        break;
      }

      
      case 'quote': {
        const quoteText = block?.quoteText ?? '';
        const attrText  = block?.attributionText ?? '';
        if (quoteText) {
          const lines = estimateLines(`"${quoteText}"`, PANEL_WIDTH_IN - 0.8, sizes.bodyPt);
          used += Math.max(1, lines) * sizes.bodyLineH + 0.20;
        }
        if (attrText) {
          used += sizes.subLineH + 0.20;
        }
        if (!quoteText && !attrText) {
          used += sizes.bodyLineH + 0.20;
        }
        break;
      }


      case 'welcome':
        used += sizes.headingLineH + 0.35 + 0.10; // ← sync: was +0.30, PDF uses +0.35+0.10
        break;

      case 'custom': {
        const text = block?.customText ?? '';
        if (text.trim()) {
          const lines = estimateLines(text, PANEL_WIDTH_IN - 0.8, sizes.bodyPt);
          used += Math.max(1, lines) * sizes.bodyLineH + 0.20;  // ← sync: was +0.12
        } else {
          used += sizes.bodyLineH + 0.20;                       // ← sync: was +0.20 ✅
        }
        break;
      }

      default: break;
    }
  }

  // Warning threshold for cover is 95%
  if (used / PANEL_HEIGHT_IN > 0.95) {
    warnings.push('Cover content is near the page edge. Consider reducing image height or removing a block.');
  }

  return makePanel(used, warnings, true);
};

// ───────────────────────────────────────────────────────────────────────────
// PANEL 2 — Leadership & Schedules (Page 1 Left)
// ───────────────────────────────────────────────────────────────────────────
const calcLeadership = (formData, wardDefaults) => {
  const ps = formData.leadershipSettings ?? {};
  const sizes = getResolvedSizes(ps);
  const warnings = [];

  const BASE_ROW_H = 0.175;
  const BASE_FONT_PT = 8;
  const scaledRowH = BASE_ROW_H * (sizes.bodyPt / BASE_FONT_PT);
  const headerRowH = scaledRowH;
  const sectionTitleLineH = sizes.titleLineH;


  let used = 0;

  // ── Leadership table ──────────────────────────────────────────────────
  const useDefault = formData.useDefaultLeadership ??
    (formData.leadershipMode === 'default') ?? true;
  const leaderRows = (!useDefault && formData.leadership?.length > 0)
    ? formData.leadership
    : (wardDefaults?.leadership ?? []);

  if (leaderRows.length > 0) {
    used += sectionTitleLineH + 0.02;
    used += headerRowH;

    // ── Account for cell wrapping at larger font sizes ──────────────────
    // PDF column widths: Role=1.5", Name=1.9", Phone=1.6"
    // Minus cellPadX (0.05") on each side = effective widths:
    const ROLE_COL_W  = 1.5  - 0.10;
    const NAME_COL_W  = 1.9  - 0.10;
    const PHONE_COL_W = 1.6  - 0.10;

    for (const l of leaderRows) {
        const roleLines  = Math.max(1, estimateLines(l.role  ?? '', ROLE_COL_W,  sizes.bodyPt));
        const nameLines  = Math.max(1, estimateLines(l.name  ?? '', NAME_COL_W,  sizes.bodyPt));
        const phoneLines = Math.max(1, estimateLines(l.phone ?? '', PHONE_COL_W, sizes.bodyPt));
        const maxLines   = Math.max(roleLines, nameLines, phoneLines);
        used += maxLines * scaledRowH;
    }

    used += 0.12;
  }

  // ── Schedules table ───────────────────────────────────────────────────
  const useDefaultSched = formData.useDefaultSchedules ??
    (formData.schedulesMode === 'default') ?? true;
  const schedRows = (!useDefaultSched && formData.schedules?.length > 0)
    ? formData.schedules
    : (wardDefaults?.schedules ?? []);

  if (schedRows.length > 0) {
    used += sectionTitleLineH + 0.02;
    used += headerRowH;

    // PDF column widths: Org=2.1", Day=1.5", Time=1.4"
    const ORG_COL_W  = 2.1 - 0.10;
    const DAY_COL_W  = 1.5 - 0.10;
    const TIME_COL_W = 1.4 - 0.10;

    for (const s of schedRows) {
        const orgLines  = Math.max(1, estimateLines(s.organization ?? '', ORG_COL_W,  sizes.bodyPt));
        const dayLines  = Math.max(1, estimateLines(s.day          ?? '', DAY_COL_W,  sizes.bodyPt));
        const timeLines = Math.max(1, estimateLines(s.meeting_time ?? s.time ?? '', TIME_COL_W, sizes.bodyPt));
        const maxLines  = Math.max(orgLines, dayLines, timeLines);
        used += maxLines * scaledRowH;
    }
  }
  if (used / PANEL_HEIGHT_IN > 0.90) {
    warnings.push('Leadership and schedules panel is getting full. Consider reducing entries.');
  }

  return makePanel(used, warnings);
};





// ─────────────────────────────────────────────────────────────────────────
// PANEL 3 — Meeting Order (Page 2 Left)
// ─────────────────────────────────────────────────────────────────────────
const calcMeetingOrder = (formData) => {
  const ps = formData.meetingOrder?.printSettings ?? {};
  const sizes = getResolvedSizes(ps);
  const warnings = [];

  const CONTENT_WIDTH = LEFT_PANEL_WIDTH - 0.6;
  let used = 0;

  // Program title
  used += sizes.titleLineH + 0.25;                // ✅ was + 0.60

  // 4 header fields
  used += 4 * (sizes.bodyLineH + 0.05);           // ✅ was + 0.10 each

  // gap after header block
  used += 0.10;                                   // ✅ was implicit in padding

  // Meeting items
  const items = formData.meetingOrder?.meetingItems ?? [];
  for (const item of items) {
    switch (item.type) {
      case 'openingHymn':
      case 'sacramentHymn':
      case 'closingHymn':
        used += sizes.headingLineH;               // ✅ was + 0.20 extra
        used += sizes.bodyLineH + 0.08;           // ✅ was + 0.05 + implicit gap
        break;


      case 'hymn':
        used += sizes.headingLineH;            // ← ADD: "Hymn" heading
        used += sizes.bodyLineH + 0.10;        // hymn detail
        break;

        
      // ── ADD THIS CASE ──────────────────────────────────────────────────────
      case 'childrensHymn':
        used += sizes.headingLineH;       // "Children's Song" heading
        used += sizes.bodyLineH + 0.10;   // number: title detail
        break;
      // ───────────────────────────────────────────────────────────────────────


      case 'openingPrayer':
      case 'closingPrayer':
        used += sizes.headingLineH;               // ✅ was + 0.20 extra
        used += sizes.bodyLineH + 0.08;           // ✅ was + 0.05
        break;

      case 'sacramentAdmin':
        used += sizes.headingLineH + 0.08;
        break;

      case 'announce':
        used += sizes.bodyLineH + 0.20;
        break;


      case 'speaker': {
        used += sizes.headingLineH;            // ← ADD: "Speaker" heading
        used += sizes.bodyLineH + 0.05;        // name
        const topicLines = estimateLines(item.topic ?? '', CONTENT_WIDTH, sizes.subPt);
        used += Math.max(1, topicLines) * sizes.subLineH + 0.10; // topic
        used += 0.05;                          // ← ADD: matches the extra yPos += 0.05
        break;
      }
      

      case 'customText': {
        const text = item.text?.trim() ?? '';
        if (text) {
          // bodyPt + 2 matches PDFGenerator's italic sacramentAdmin-style font size
          const lines = estimateLines(text, CONTENT_WIDTH - 0.1, sizes.headingPt);
          used += Math.max(1, lines) * sizes.headingLineH + 0.08;
        } else {
          used += 2 * sizes.bodyLineH; // blank spacer unchanged ✅
        }
        break;
      }



      case 'musical':
        used += sizes.headingLineH;            // ← ADD: "Musical Number" heading
        used += sizes.bodyLineH + 0.10;        // performers/piece
        break;

      case 'testimony':
        used += sizes.headingLineH + 0.08;
        break;

      case 'baptism':
        used += sizes.bodyLineH + 0.05;
        used += sizes.subLineH + 0.05;
        used += sizes.subLineH + 0.10;
        break;

      case 'confirmation':
        used += sizes.bodyLineH + 0.05;
        used += sizes.subLineH + 0.10;
        break;

      default: break;
    }
  }

  if (used / PANEL_HEIGHT_IN > 0.90) {
    warnings.push('Meeting order panel is getting full. Consider removing items or switching to Compact font size.');
  }

  return makePanel(used, warnings);
};

// ─────────────────────────────────────────────────────────────────────────
// PANEL 4 — Announcements (Page 2 Right)
// ─────────────────────────────────────────────────────────────────────────
const calcAnnouncements = (formData) => {
  const ps = formData.announcementSettings ?? {};
  const sizes = getResolvedSizes(ps);
  const warnings = [];

  const halfWidth = (11 - 0.6) / 2;
  const CONTENT_WIDTH = halfWidth - 0.5;

  let used = 0;

  // "Announcements" heading
  used += sizes.titleLineH + 0.25;

  const announcements = formData.announcements ?? [];
  for (const ann of announcements) {
    // Title
    used += sizes.headingLineH;

    // Description
    if (ann.description?.trim()) {
      const descLines = estimateLines(ann.description, CONTENT_WIDTH, sizes.bodyPt);
      used += descLines * sizes.bodyLineH;
    }

    // Date / time line — always one line in PDF regardless of all-day/timed/range
    if (ann.date || ann.time) {
      if (!ann.description?.trim()) used += sizes.subLineH * 0.5;
      used += sizes.subLineH;
    }

    // Location — estimate wrapped lines same as PDFGenerator
    if (ann.location?.trim()) {
      const locLines = estimateLines(ann.location, CONTENT_WIDTH, sizes.subPt);
      used += Math.max(1, locLines) * sizes.subLineH;
    }

    used += 0.2; // between-announcement padding
  }

  if (used / PANEL_HEIGHT_IN > 0.90) {
    warnings.push('Announcements panel is getting full. Consider shortening descriptions or removing announcements.');
  }

  return makePanel(used, warnings);
};

// ─────────────────────────────────────────────────────────────────────────
// MAIN EXPORT — calculatePanelHealth
// ─────────────────────────────────────────────────────────────────────────
export const calculatePanelHealth = (formData, wardDefaults) => {
  if (!formData) return null;

  const cover       = calcCover(formData);
  const leadership  = calcLeadership(formData, wardDefaults);
  const meetingOrder = calcMeetingOrder(formData);
  const announcements = calcAnnouncements(formData);

  const allClear = [cover, leadership, meetingOrder, announcements]
    .every(p => p.status !== 'overflow');

  return { cover, leadership, meetingOrder, announcements, allClear };
};