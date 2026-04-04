// src/utils/coverImageUtils.js

// ── Cover panel real dimensions (landscape letter, right half) ───────────────
export const COVER_PANEL_WIDTH_IN  = 4.6;  // halfWidth - margins
export const COVER_PANEL_HEIGHT_IN = 7.9;  // 8.5" - top/bottom margins

/**
 * Converts a percentage (10–100) to real image height in inches.
 * Always clamped to the cover panel height.
 */
export const pctToImgHeight = (pct) => {
  const clamped = Math.max(10, Math.min(100, pct ?? 50));
  return parseFloat(((clamped / 100) * COVER_PANEL_HEIGHT_IN).toFixed(3));
};

/**
 * Backward-compatible height resolver.
 * Handles new pct-based, old raw-inch, and legacy size-key values.
 */
export const resolveImgHeight = (cover) => {
  if (cover?.imageHeightPct != null) return pctToImgHeight(cover.imageHeightPct);
  if (cover?.imageHeight    != null) return Math.min(cover.imageHeight, COVER_PANEL_HEIGHT_IN);
  if (cover?.imageSize      != null) {
    const sizeMap = { small: 2.5, medium: 4, large: 6, full: 7 };
    return Math.min(sizeMap[cover.imageSize] ?? 4, COVER_PANEL_HEIGHT_IN);
  }
  return pctToImgHeight(50); // default 50%
};