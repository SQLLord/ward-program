// src/utils/formatters.js
// General-purpose string formatting utilities.

/**
 * Auto-formats a phone number string as the user types.
 * Strips all non-numeric characters and formats as (xxx) xxx-xxxx.
 *
 * @param {string} value - Raw input string.
 * @returns {string} Formatted phone number string.
 */
export const formatPhoneNumber = (value) => {
  const cleaned = value.replace(/\D/g, '');
  if (cleaned.length <= 3) return cleaned;
  if (cleaned.length <= 6) return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3)}`;
  return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6, 10)}`;
};
