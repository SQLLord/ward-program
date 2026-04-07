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

// ── Announcement / Event formatting ──────────────────────────────────────────

/**
 * Formats a YYYY-MM-DD date string for display.
 * @param {string} dateStr
 * @returns {string} e.g. "Sat, Apr 5"
 */
export const formatAnnDate = (dateStr) => {
  if (!dateStr) return '';
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric',
  });
};

/**
 * Formats a HH:MM time string for display.
 * @param {string} timeStr
 * @returns {string} e.g. "3:30 PM"
 */
export const formatAnnTime = (timeStr) => {
  if (!timeStr) return '';
  return new Date(`2000-01-01T${timeStr}`).toLocaleTimeString('en-US', {
    hour: 'numeric', minute: '2-digit', hour12: true,
  });
};

/**
 * Builds a human-readable date/time label for an announcement,
 * accounting for all-day events, multi-day ranges, and start/end times.
 *
 * @param {{ date, endDate, time, endTime, isAllDay }} ann
 * @returns {string|null}
 */
export const buildDateTimeLabel = (ann) => {
  const { date, endDate, time, endTime, isAllDay } = ann;
  if (!date && !time) return null;

  if (isAllDay) {
    if (date && endDate && date !== endDate) {
      return `📅 ${formatAnnDate(date)} – ${formatAnnDate(endDate)}`;
    }
    return date ? `📅 ${formatAnnDate(date)}` : null;
  }

  const dateLabel      = date    ? `📅 ${formatAnnDate(date)}`    : '';
  const endDateLabel   = (endDate && endDate !== date) ? ` – ${formatAnnDate(endDate)}` : '';
  const startTimeLabel = time    ? ` · 🕐 ${formatAnnTime(time)}`  : '';
  const endTimeLabel   = endTime ? ` – ${formatAnnTime(endTime)}`  : '';

  return `${dateLabel}${endDateLabel}${startTimeLabel}${endTimeLabel}` || null;
};

/**
 * Builds a Google Maps URL for a location string.
 * @param {string} location
 * @returns {string|null}
 */
export const buildMapsLink = (location) => {
  if (!location?.trim()) return null;

  const loc = location.trim();

  // Only build a maps link if the location looks like a real address.
  // Must contain a street number (digits) OR a zip code pattern,
  // AND not be a generic room/building reference.
  const genericTerms = /^(chapel|church|stake center|relief society room|cultural hall|gym|gymnasium|foyer|room|building|office|lobby|overflow|multipurpose|annex|rs room)\b/i;
  const hasStreetNumber = /\d+\s+\w/;  // e.g. "1234 Main St"
  const hasZip = /\b\d{5}\b/;          // e.g. "75001"

  if (genericTerms.test(loc)) return null;
  if (!hasStreetNumber.test(loc) && !hasZip.test(loc)) return null;

  return `https://maps.google.com/maps?q=${encodeURIComponent(loc)}`;
};
/**
 * Builds a Google Calendar "Add Event" URL for an announcement.
 * @param {{ title, date, endDate, time, endTime, location }} ann
 * @returns {string|null}
 */
export const buildGoogleCalendarLink = ({ title, date, endDate, time, endTime, location, description }) => {
  if (!date) return null;

  let dates;
  if (time) {
    const start = new Date(`${date}T${time}`);
    const end   = endTime
      ? new Date(`${endDate || date}T${endTime}`)
      : new Date(start.getTime() + 60 * 60 * 1000);
    const fmt = (d) => d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    dates = `${fmt(start)}/${fmt(end)}`;
  } else {
    const [y, m, d] = (endDate || date).split('-').map(Number);
    const dayAfterEnd = new Date(y, m - 1, d + 1);
    const pad = (n) => String(n).padStart(2, '0');
    const endStr = `${dayAfterEnd.getFullYear()}${pad(dayAfterEnd.getMonth() + 1)}${pad(dayAfterEnd.getDate())}`;
    dates = `${date.replace(/-/g, '')}/${endStr}`;
  }

  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text:   title || 'Ward Announcement',
    dates,
  });
  if (location) params.set('location', location);
  if (description) params.set('details', description);  // ← ADD
  return `https://www.google.com/calendar/render?${params.toString()}`;
};

/**
 * Triggers a download of an .ics calendar file for an announcement.
 * @param {{ title, date, endDate, time, endTime, location }} ann
 */
export const downloadIcs = ({ title, date, endDate, time, endTime, location, description }) => {
  if (!date) return;

  const now          = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  const safeTitle    = (title || 'Ward Announcement').replace(/[\\;,]/g, '\\$&');
  const safeLocation = location ? location.replace(/[\\;,]/g, '\\$&') : '';

  let dtStart, dtEnd;
  if (time) {
    const start = new Date(`${date}T${time}`);
    const end   = endTime
      ? new Date(`${endDate || date}T${endTime}`)
      : new Date(start.getTime() + 60 * 60 * 1000);
    const fmt = (d) => d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    dtStart = `DTSTART:${fmt(start)}`;
    dtEnd   = `DTEND:${fmt(end)}`;
  } else {
    const [y, m, d] = (endDate || date).split('-').map(Number);
    const dayAfterEnd = new Date(y, m - 1, d + 1);
    const pad = (n) => String(n).padStart(2, '0');
    const endStr = `${dayAfterEnd.getFullYear()}${pad(dayAfterEnd.getMonth() + 1)}${pad(dayAfterEnd.getDate())}`;
    dtStart = `DTSTART;VALUE=DATE:${date.replace(/-/g, '')}`;
    dtEnd   = `DTEND;VALUE=DATE:${endStr}`;
  }

   const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//WardPrograms//EN',
    'BEGIN:VEVENT',
    `UID:${now}-${Math.random().toString(36).slice(2)}@wardprograms`,
    `DTSTAMP:${now}`,
    dtStart,
    dtEnd,
    `SUMMARY:${safeTitle}`,
    safeLocation ? `LOCATION:${safeLocation}` : '',
    description ? `DESCRIPTION:${description.replace(/\n/g, '\\n').replace(/,/g, '\\,')}` : '',  // ← ADD
    'END:VEVENT',
    'END:VCALENDAR',
  ].filter(Boolean).join('\r\n');

  const blob = new Blob([lines], { type: 'text/calendar;charset=utf-8' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `${(title || 'event').replace(/\s+/g, '-').toLowerCase()}.ics`;
  a.click();
  URL.revokeObjectURL(url);
};