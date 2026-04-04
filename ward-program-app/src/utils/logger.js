// src/utils/logger.js
// ── Production-safe logger — silenced in prod builds ─────────────────────────
const isDev = import.meta.env.DEV;

export const logger = {
  warn:  (...args) => { if (isDev) console.warn(...args); },
  error: (...args) => { if (isDev) console.error(...args); },
  log:   (...args) => { if (isDev) console.log(...args); },
};