// src/components/AnnouncementRow.jsx
import React from 'react';

export function AnnouncementRow({ ann, updateAnnouncement, removeAnnouncement, isNew }) {
  const [expanded, setExpanded] = React.useState(isNew ?? false);

  // Build summary line
  const summary = (() => {
    const title = ann.title?.trim() || '(no title)';
    const parts = [];
    if (ann.isAllDay && ann.date) {
      const d = new Date(ann.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      parts.push(ann.endDate
        ? `${d} – ${new Date(ann.endDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} (All Day)`
        : `${d} (All Day)`);
    } else {
      if (ann.date) parts.push(new Date(ann.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
      if (ann.time) parts.push(ann.time);
    }
    if (ann.location) parts.push(`📍 ${ann.location.slice(0, 30)}${ann.location.length > 30 ? '…' : ''}`);
    return `📢 ${title}${parts.length ? ' — ' + parts.join(' · ') : ''}`;
  })();

  return (
    <div className="w-full">

      {/* ── Collapsed header ─────────────────────────────────────────── */}
      <div
        className="flex items-center justify-between gap-2 px-2 py-1.5 cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-600/50 rounded-t-lg transition"
        onClick={() => setExpanded(e => !e)}
      >
        <span className="text-xs text-gray-600 dark:text-slate-300 truncate flex-1 min-w-0" title={summary}>
          {summary}
        </span>
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={e => { e.stopPropagation(); setExpanded(e => !e); }}
            className="text-xs px-1.5 py-0.5 rounded bg-gray-200 dark:bg-slate-600 hover:bg-gray-300 dark:hover:bg-slate-500 text-gray-600 dark:text-slate-300 transition"
          >
            {expanded ? '▲ Less' : '▼ Edit'}
          </button>
          <button
            onClick={e => { e.stopPropagation(); removeAnnouncement(ann.id); }}
            className="btn-danger w-8 h-8 p-0 min-w-[2rem] flex items-center justify-center text-xs"
          >🗑️</button>
        </div>
      </div>

      {/* ── Expanded editor ──────────────────────────────────────────── */}
      {expanded && (
        <div className="px-2 pb-2 border-t border-slate-600/50 pt-2 flex flex-col gap-2">

          {/* Title */}
          <input
            value={ann.title ?? ''}
            onChange={e => updateAnnouncement(ann.id, 'title', e.target.value)}
            placeholder="Title"
            className="input w-full text-xs"
            maxLength={255}
          />

          {/* Description */}
          <textarea
            value={ann.description ?? ''}
            onChange={e => updateAnnouncement(ann.id, 'description', e.target.value)}
            rows={3}
            placeholder="Description"
            className="input w-full text-xs"
            maxLength={2000}
          />

          {/* All Day toggle */}
          <label className="flex items-center gap-2 text-xs cursor-pointer">
            <input
              type="checkbox"
              checked={ann.isAllDay ?? false}
              onChange={e => {
                updateAnnouncement(ann.id, 'isAllDay', e.target.checked);
                if (e.target.checked) {
                  updateAnnouncement(ann.id, 'time', '');
                  updateAnnouncement(ann.id, 'endTime', '');
                }
              }}
              className="w-4 h-4 cursor-pointer"
            />
            📅 All day event
          </label>

          {/* Date row */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-slate-400">
                {ann.endDate ? 'Start Date' : 'Date'} (optional)
              </label>
              <input
                type="date"
                value={ann.date ?? ''}
                onChange={e => updateAnnouncement(ann.id, 'date', e.target.value)}
                className="input text-xs w-full"
              />
            </div>
            <div>
              <label className="text-xs text-slate-400">End Date (optional)</label>
              <input
                type="date"
                value={ann.endDate ?? ''}
                onChange={e => updateAnnouncement(ann.id, 'endDate', e.target.value)}
                className="input text-xs w-full"
                min={ann.date ?? undefined}
              />
            </div>
          </div>

          {/* Time row — hidden when all-day */}
          {!ann.isAllDay && (
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-slate-400">Start Time (optional)</label>
                <input
                  type="time"
                  value={ann.time ?? ''}
                  onChange={e => updateAnnouncement(ann.id, 'time', e.target.value)}
                  className="input text-xs w-full"
                />
              </div>
              <div>
                <label className="text-xs text-slate-400">End Time (optional)</label>
                <input
                  type="time"
                  value={ann.endTime ?? ''}
                  onChange={e => updateAnnouncement(ann.id, 'endTime', e.target.value)}
                  className="input text-xs w-full"
                />
              </div>
            </div>
          )}

          {/* Location */}
          <div>
            <label className="text-xs text-slate-400">Location (optional)</label>
            <input
              value={ann.location ?? ''}
              onChange={e => updateAnnouncement(ann.id, 'location', e.target.value)}
              placeholder="e.g. 1234 Main St, Odessa TX or Chapel"
              className="input w-full text-xs"
              maxLength={2000}
            />
          </div>

          {/* Public toggle */}
          <label className="flex items-center gap-2 text-xs cursor-pointer">
            <input
              type="checkbox"
              checked={ann.isPublic ?? true}
              onChange={e => updateAnnouncement(ann.id, 'isPublic', e.target.checked)}
              className="w-4 h-4 cursor-pointer"
            />
            🌐 Show on public website
          </label>
          {ann.isPublic === false && (
            <p className="text-xs text-amber-500">🔒 Private — prints in PDF only</p>
          )}
        </div>
      )}
    </div>
  );
}
