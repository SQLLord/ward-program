// src/utils/linkify.jsx
import React from 'react';

const URL_REGEX   = /(https?:\/\/[^\s]+)/g;
const EMAIL_REGEX = /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g;
const PHONE_REGEX = /\b(\(?\d{3}\)?[\s.\-]\d{3}[\s.\-]\d{4})\b/g;
const COMBINED_REGEX = /(https?:\/\/[^\s]+|[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}|\(?\d{3}\)?[\s.\-]\d{3}[\s.\-]\d{4})/g;

export function linkify(text) {
  if (!text) return null;

  const parts = text.split(COMBINED_REGEX);

  return parts.map((part, i) => {

    // ── URL ──────────────────────────────────────────────────────────────────
    if (URL_REGEX.test(part)) {
      URL_REGEX.lastIndex = 0;
      // Fix 10: Validate protocol is strictly http or https — reject javascript:, data:, etc.
      try {
        const parsed = new URL(part);
        if (!['http:', 'https:'].includes(parsed.protocol)) return part;
      } catch {
        return part; // malformed URL — render as plain text
      }
      return (
        <a
          key={i}
          href={part}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 dark:text-blue-400 underline hover:text-blue-800
                     dark:hover:text-blue-300 break-all transition"
        >
          {part}
        </a>
      );
    }

    // ── Email ─────────────────────────────────────────────────────────────────
    if (EMAIL_REGEX.test(part)) {
      EMAIL_REGEX.lastIndex = 0;
      return (
        <a
          key={i}
          href={`mailto:${part}`}
          className="text-blue-600 dark:text-blue-400 underline hover:text-blue-800
                     dark:hover:text-blue-300 transition"
        >
          {part}
        </a>
      );
    }

    // ── Phone ─────────────────────────────────────────────────────────────────

    if (PHONE_REGEX.test(part)) {
      PHONE_REGEX.lastIndex = 0;  // ← ADD THIS (was missing)
      const digits = part.replace(/\D/g, '');
      return (
        <a
          key={i}
          href={`tel:+1${digits}`}
          className="text-blue-600 dark:text-blue-400 underline hover:text-blue-800
          dark:hover:text-blue-300 transition"
        >
          {part}
        </a>
      );
    }


    return part;
  });
}