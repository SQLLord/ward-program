// src/components/PrintSettingsFlyout.jsx
import React, { useState, useRef, useEffect } from 'react';  // ← ADD useRef, useEffect
import { PRESET_LABELS, DEFAULT_PRINT_SETTINGS, PRESETS } from '../utils/printSettingsUtils';

const STEP_LABELS = {
  1: { title: 'Cover Panel', hint: 'Affects date, quote, welcome, and custom text on the cover.' },
  2: { title: 'Meeting Order Panel', hint: 'Affects program title, hymns, prayers, and speaker text.' },
  3: { title: 'Announcements Panel', hint: 'Affects announcement titles and description text.' },
  4: { title: 'Leadership & Schedules Panel', hint: 'Affects section headings on the leadership panel.' },
};

export function PrintSettingsFlyout({ step, formData, updateField }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);  // ← ADD THIS

  // ── Click-outside handler ─────────────────────────────────────────────
  useEffect(() => {                                           // ← ADD THIS BLOCK
    if (!open) return;
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  const getSettings = () => {
    switch (step) {
      case 1: return formData.cover?.printSettings ?? DEFAULT_PRINT_SETTINGS;
      case 2: return formData.meetingOrder?.printSettings ?? DEFAULT_PRINT_SETTINGS;
      case 3: return formData.announcementSettings ?? DEFAULT_PRINT_SETTINGS;
      case 4: return formData.leadershipSettings ?? DEFAULT_PRINT_SETTINGS;
      default: return DEFAULT_PRINT_SETTINGS;
    }
  };

  const updateSettings = (field, value) => {
    if (field === 'preset' && value !== 'custom') {
      const resolved = PRESETS[value] ?? PRESETS.standard;
      switch (step) {
        case 1:
          updateField(`cover.printSettings.preset`, value);
          updateField(`cover.printSettings.bodySize`, resolved.bodyPt);
          updateField(`cover.printSettings.headingSize`, resolved.headingPt);
          return;
        case 2:
          updateField(`meetingOrder.printSettings.preset`, value);
          updateField(`meetingOrder.printSettings.bodySize`, resolved.bodyPt);
          updateField(`meetingOrder.printSettings.headingSize`, resolved.headingPt);
          return;
        case 3:
          updateField(`announcementSettings.preset`, value);
          updateField(`announcementSettings.bodySize`, resolved.bodyPt);
          updateField(`announcementSettings.headingSize`, resolved.headingPt);
          return;
        case 4:
          updateField(`leadershipSettings.preset`, value);
          updateField(`leadershipSettings.bodySize`, resolved.bodyPt);
          updateField(`leadershipSettings.headingSize`, resolved.headingPt);
          return;
        default: return;
      }
    }
    switch (step) {
      case 1: return updateField(`cover.printSettings.${field}`, value);
      case 2: return updateField(`meetingOrder.printSettings.${field}`, value);
      case 3: return updateField(`announcementSettings.${field}`, value);
      case 4: return updateField(`leadershipSettings.${field}`, value);
      default: return;
    }
  };

  const settings = getSettings();
  const stepMeta = STEP_LABELS[step];
  if (!stepMeta) return null;

  return (
    <div className="relative inline-block" ref={containerRef}>  {/* ← ADD ref={containerRef} */}
      {/* Trigger button */}
      <button
        onClick={() => setOpen(prev => !prev)}
        className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-slate-400
          hover:text-lds-blue dark:hover:text-blue-400 transition font-medium"
        title="Print Settings for this panel"
      >
        🖨️ Print Settings
        <span className={`transition-transform duration-200 ${open ? 'rotate-180' : ''}`}>▾</span>
      </button>

      {/* Flyout panel */}
      {open && (
        <div className="absolute right-0 top-7 z-50 w-72 bg-white dark:bg-slate-800
          border border-gray-200 dark:border-slate-700
          rounded-xl shadow-xl p-4">
          {/* Header */}
          <div className="flex justify-between items-start mb-3">
            <div>
              <p className="text-sm font-bold text-gray-800 dark:text-slate-100">
                🖨️ {stepMeta.title}
              </p>
              <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">
                {stepMeta.hint}
              </p>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-slate-300 text-lg leading-none"
            >×</button>
          </div>

          {/* Preset selector */}
          <div className="mb-3">
            <label className="label text-xs">Font Size Preset</label>
            <div className="grid grid-cols-2 gap-1.5">
              {PRESET_LABELS.map(p => (
                <button
                  key={p.value}
                  onClick={() => updateSettings('preset', p.value)}
                  className={`text-left px-2 py-1.5 rounded-lg border text-xs transition
                    ${settings.preset === p.value
                      ? 'border-lds-blue bg-blue-50 dark:bg-blue-900/30 text-lds-blue dark:text-blue-400 font-semibold'
                      : 'border-gray-200 dark:border-slate-600 text-gray-600 dark:text-slate-300 hover:border-lds-blue'
                    }`}
                  title={p.desc}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Custom size inputs */}
          {settings.preset === 'custom' && (
            <div className="grid grid-cols-2 gap-3 mb-3 pt-3 border-t border-gray-100 dark:border-slate-700">
              <div>
                <label className="label text-xs">Body Size (pt)</label>
                <input
                  type="number" min={6} max={14} step={0.5}
                  value={settings.bodySize ?? 9}
                  onChange={e => updateSettings('bodySize', parseFloat(e.target.value))}
                  className="input text-sm"
                />
              </div>
              <div>
                <label className="label text-xs">Heading Size (pt)</label>
                <input
                  type="number" min={8} max={18} step={0.5}
                  value={settings.headingSize ?? 11}
                  onChange={e => updateSettings('headingSize', parseFloat(e.target.value))}
                  className="input text-sm"
                />
              </div>
            </div>
          )}

          {/* Reset to standard */}
          <button
            onClick={() => updateSettings('preset', 'standard')}
            className="w-full text-xs text-gray-400 dark:text-slate-500
              hover:text-gray-600 dark:hover:text-slate-300 transition text-center"
          >
            ↺ Reset to Standard
          </button>
        </div>
      )}
    </div>
  );
}