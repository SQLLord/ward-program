// src/utils/printSettingsUtils.js
// ============================================================
// Single source of truth for all print/font sizing math.
// Used by: panelHealth.js, PDFGenerator.js, StepPreviewPanel,
//          CoverPreviewBlock, PrintSettingsFlyout
// ============================================================

export const PANEL_HEIGHT_IN  = 7.9;  // all 4 panels (8.5 - 0.3 top - 0.3 bottom)
export const PANEL_WIDTH_IN   = 4.6;  // cover + announcements right half
export const LEFT_PANEL_WIDTH = 5.1;  // leadership + meeting order left half

// ── Font size presets ──────────────────────────────────────────────────────
export const PRESETS = {
  compact:  { bodyPt: 8,  headingPt: 10 },
  standard: { bodyPt: 9,  headingPt: 11 },
  large:    { bodyPt: 10, headingPt: 13 },
  xl:       { bodyPt: 12, headingPt: 15 },
  xxl:      { bodyPt: 14, headingPt: 17 },
};

export const PRESET_LABELS = [
  { value: 'compact',  label: '📦 Compact',  desc: 'Smaller text — fits more content' },
  { value: 'standard', label: '📄 Standard', desc: 'Default sizing — works for most programs' },
  { value: 'large',    label: '🔤 Large',    desc: 'Bigger text — fewer items per page' },
  { value: 'xl',       label: '🔡 XL',       desc: 'Extra large — accessibility friendly' },
  { value: 'xxl',      label: '🔠 2XL',      desc: 'Maximum size — very few items per page' },
  { value: 'custom',   label: '⚙️ Custom',   desc: 'Set exact point sizes manually' },
];

// ── Default printSettings object ───────────────────────────────────────────
export const DEFAULT_PRINT_SETTINGS = {
  preset:      'standard',
  bodySize:    9,
  headingSize: 11,
};

// ── Resolve actual pt sizes from a printSettings object ───────────────────
// Returns: { bodyPt, headingPt, titlePt, subPt,
//            bodyLineH, headingLineH, titleLineH, subLineH }
export const getResolvedSizes = (printSettings) => {
  const ps = printSettings ?? DEFAULT_PRINT_SETTINGS;

  let bodyPt, headingPt;

  if (ps.preset === 'custom') {
    bodyPt    = parseFloat(ps.bodySize)    || 9;
    headingPt = parseFloat(ps.headingSize) || 11;
  } else {
    const preset = PRESETS[ps.preset] ?? PRESETS.standard;
    bodyPt    = preset.bodyPt;
    headingPt = preset.headingPt;
  }

  // Derived sizes — always relative to body/heading
  const titlePt = headingPt + 4;  // section title (e.g. "Sacrament Meeting Program")
  const subPt   = bodyPt   - 1;   // sub-detail (e.g. speaker topic, baptism detail)

  // Line heights in inches
  // jsPDF renders ~0.0138" per pt. Multiply by 1.15 for comfortable leading.
  const PT_TO_IN = 0.0138;
  const LEADING  = 1.15;

  const bodyLineH    = bodyPt    * PT_TO_IN * LEADING;
  const headingLineH = headingPt * PT_TO_IN * LEADING;
  const titleLineH   = titlePt   * PT_TO_IN * LEADING;
  const subLineH     = subPt     * PT_TO_IN * LEADING;

  return {
    bodyPt, headingPt, titlePt, subPt,
    bodyLineH, headingLineH, titleLineH, subLineH,
  };
};

// ── Estimated characters per line for text wrapping ───────────────────────
// Approximation based on Helvetica metrics at standard sizes.
// charsPerLine scales inversely with font size.

export const charsPerLine = (panelWidthIn, bodyPt) => {
  // Empirically calibrated per font size against actual jsPDF Helvetica output.
  // Linear inverse scaling (9/bodyPt) overcounts wrapping at larger sizes.
  
  const CPI_BY_PT = {
    8:  13.5,
    9:  12.5,
    10: 12.5,
    11: 10.5,
    12:  10.2,
    14:  8.8,
    17:  7.2,
  };

  const cpi = CPI_BY_PT[bodyPt] ?? (8.0 * Math.pow(bodyPt / 9, 0.3));
  return Math.floor(panelWidthIn * cpi);
};


// ── Split text into estimated line count ──────────────────────────────────
export const estimateLines = (text, panelWidthIn, bodyPt) => {
  if (!text?.trim()) return 0;
  const cpl = charsPerLine(panelWidthIn, bodyPt);
  const words = text.trim().split(/\s+/);
  let lines = 1;
  let lineLen = 0;
  for (const word of words) {
    // Long unbreakable tokens (URLs etc) — count as their own line
    // but don't multiply — jsPDF just overflows them on one line
    if (word.length > cpl) {
      if (lineLen > 0) lines++; // finish current line
      lines++;                  // the long word gets its own line
      lineLen = 0;
      continue;
    }
    if (lineLen === 0) {
      lineLen = word.length;
    } else if (lineLen + word.length + 1 > cpl) {
      lines++;
      lineLen = word.length;
    } else {
      lineLen += word.length + 1;
    }
  }
  return lines;
};