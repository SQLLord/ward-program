// src/components/ImportAnnouncementsFromProgramModal.jsx
import React, { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
import { api } from '../utils/api';
import { useError } from '../context/ErrorContext';

function formatDateLabel(dateStr) {
    if (!dateStr) return '';
    return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
        weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
    });
}

function formatTime(timeStr) {
    if (!timeStr) return '';
    try {
        return new Date(`2000-01-01T${timeStr}`).toLocaleTimeString('en-US', {
            hour: 'numeric', minute: '2-digit', hour12: true,
        });
    } catch { return timeStr; }
}

function buildDateTimeLabel(ann) {
    const { date, endDate, time, endTime, isAllDay } = ann;
    if (!date && !time) return null;
    if (isAllDay) {
        const start = date ? formatDateLabel(date) : '';
        const end   = endDate && endDate !== date ? ` – ${formatDateLabel(endDate)}` : '';
        return `📅 ${start}${end} · All Day`;
    }
    const startDate  = date    ? `📅 ${formatDateLabel(date)}`      : '';
    const endDateStr = endDate && endDate !== date ? ` – ${formatDateLabel(endDate)}` : '';
    const startTime  = time    ? ` · 🕐 ${formatTime(time)}`         : '';
    const endTimeStr = endTime ? ` – ${formatTime(endTime)}`          : '';
    return `${startDate}${endDateStr}${startTime}${endTimeStr}` || null;
}

// ── Modes ─────────────────────────────────────────────────────────────────────
const MODE_SELECT  = 'select';   // picking a program
const MODE_PREVIEW = 'preview';  // choosing which announcements to import
const MODE_LOADING = 'loading';  // fetching program announcements

export default function ImportAnnouncementsFromProgramModal({
    currentProgramId,
    onClose,
    onImport,
}) {
    const { showToast } = useError();
    const [mode, setMode]             = useState(MODE_SELECT);
    const [programs, setPrograms]     = useState([]);
    const [loadingList, setLoadingList] = useState(true);
    const [search, setSearch]         = useState('');
    const [selectedProgram, setSelectedProgram] = useState(null);
    const [announcements, setAnnouncements]     = useState([]);
    const [checkedIds, setCheckedIds] = useState(new Set());
    const searchRef = useRef(null);

    // ── Load program list ─────────────────────────────────────────────────────
    useEffect(() => {
        const load = async () => {
            try {
                const data = await api.get(
                    '/programs/summary?status=all&page=1&pageSize=200'
                );
                // Exclude current program, exclude archived
                setPrograms(
                    (data ?? []).filter(p =>
                        p.id !== currentProgramId &&
                        p.status !== 'archived'
                    )
                );
            } catch (err) {
                showToast('❌ Failed to load programs.', 'error');
            } finally {
                setLoadingList(false);
            }
        };
        load();
    }, [currentProgramId]);

    // ── Focus search on open ──────────────────────────────────────────────────
    useEffect(() => {
        if (mode === MODE_SELECT) searchRef.current?.focus();
    }, [mode]);

    // ── Filter programs by search ─────────────────────────────────────────────
    const filteredPrograms = programs.filter(p => {
        const q = search.toLowerCase();
        return (
            (p.programName ?? 'Sacrament Meeting Program').toLowerCase().includes(q) ||
            (p.date ?? '').includes(q)
        );
    }).sort((a, b) => new Date(b.date) - new Date(a.date));

    // ── Select a program and load its announcements ───────────────────────────
    const handleSelectProgram = async (program) => {
        setSelectedProgram(program);
        setMode(MODE_LOADING);
        try {
            const data = await api.get(`/programs/${program.id}`);
            const anns = data.announcements ?? [];
            setAnnouncements(anns);
            // Check all by default
            setCheckedIds(new Set(anns.map(a => a.id)));
            setMode(MODE_PREVIEW);
        } catch (err) {
            showToast('❌ Failed to load program announcements.', 'error');
            setMode(MODE_SELECT);
        }
    };

    // ── Toggle individual announcement ────────────────────────────────────────
    const toggleCheck = (id) => {
        setCheckedIds(prev => {
            const next = new Set(prev);
            next.has(id) ? next.delete(id) : next.add(id);
            return next;
        });
    };

    const toggleAll = () => {
        if (checkedIds.size === announcements.length) {
            setCheckedIds(new Set());
        } else {
            setCheckedIds(new Set(announcements.map(a => a.id)));
        }
    };

    // ── Import selected announcements ─────────────────────────────────────────
    const handleImport = () => {
        const selected = announcements.filter(a => checkedIds.has(a.id));
        if (selected.length === 0) {
            showToast('❌ No announcements selected.', 'error');
            return;
        }
        // Strip IDs — caller will assign new ones via addAnnouncement
        const cleaned = selected.map(({ id, ...rest }) => rest);
        onImport(cleaned);
        showToast(`✅ ${selected.length} announcement${selected.length !== 1 ? 's' : ''} imported.`);
        onClose();
    };

    const modal = (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center
                        justify-center z-50 p-4">
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl
                            w-full max-w-lg flex flex-col max-h-[85vh]">

                {/* ── Header ── */}
                <div className="flex items-center justify-between px-5 py-4
                                border-b border-gray-200 dark:border-slate-700 shrink-0">
                    <div>
                        <h3 className="text-lg font-bold dark:text-slate-100">
                            📥 Import from Program
                        </h3>
                        {mode === MODE_PREVIEW && selectedProgram && (
                            <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
                                {selectedProgram.programName || 'Sacrament Meeting Program'}
                                {' · '}
                                {formatDateLabel(selectedProgram.date)}
                            </p>
                        )}
                    </div>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-600 dark:hover:text-slate-300
                                   transition text-xl leading-none"
                    >
                        ✕
                    </button>
                </div>

                {/* ── Body ── */}
                <div className="flex-1 overflow-y-auto px-5 py-4">

                    {/* ── Program selection mode ── */}
                    {mode === MODE_SELECT && (
                        <>
                            <input
                                ref={searchRef}
                                type="text"
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                placeholder="Search by program name or date..."
                                className="input w-full mb-3"
                            />
                            {loadingList ? (
                                <div className="text-center py-8 text-gray-400 dark:text-slate-500">
                                    <div className="text-3xl mb-2">⏳</div>
                                    <p className="text-sm">Loading programs...</p>
                                </div>
                            ) : filteredPrograms.length === 0 ? (
                                <div className="text-center py-8 text-gray-400 dark:text-slate-500">
                                    <div className="text-3xl mb-2">📭</div>
                                    <p className="text-sm">No programs found</p>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {filteredPrograms.map(p => (
                                        <button
                                            key={p.id}
                                            onClick={() => handleSelectProgram(p)}
                                            className="w-full text-left px-4 py-3 rounded-lg border
                                                       border-gray-200 dark:border-slate-600
                                                       hover:border-lds-blue dark:hover:border-blue-500
                                                       hover:bg-blue-50 dark:hover:bg-blue-900/20
                                                       transition"
                                        >
                                            <p className="font-semibold text-sm text-gray-800
                                                          dark:text-slate-100 truncate">
                                                {p.programName || 'Sacrament Meeting Program'}
                                            </p>
                                            <div className="flex items-center gap-2 mt-0.5">
                                                <p className="text-xs text-gray-500 dark:text-slate-400">
                                                    {formatDateLabel(p.date)}
                                                </p>
                                                <span className={`text-xs font-semibold px-1.5 py-0.5
                                                    rounded-full ${
                                                    p.status === 'published'
                                                        ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                                                        : 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400'
                                                }`}>
                                                    {p.status === 'published' ? '🟢 Published' : '📝 Draft'}
                                                </span>
                                                <p className="text-xs text-gray-400 dark:text-slate-500">
                                                    {p.announcementCount ?? 0} announcement{p.announcementCount !== 1 ? 's' : ''}
                                                </p>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </>
                    )}

                    {/* ── Loading announcements ── */}
                    {mode === MODE_LOADING && (
                        <div className="text-center py-12 text-gray-400 dark:text-slate-500">
                            <div className="text-3xl mb-2">⏳</div>
                            <p className="text-sm">Loading announcements...</p>
                        </div>
                    )}

                    {/* ── Announcement preview / selection mode ── */}
                    {mode === MODE_PREVIEW && (
                        <>
                            {announcements.length === 0 ? (
                                <div className="text-center py-12 text-gray-400 dark:text-slate-500">
                                    <div className="text-3xl mb-2">📭</div>
                                    <p className="text-sm">This program has no announcements.</p>
                                </div>
                            ) : (
                                <>
                                    {/* Select all toggle */}
                                    <div className="flex items-center justify-between mb-3">
                                        <p className="text-sm text-gray-500 dark:text-slate-400">
                                            {checkedIds.size} of {announcements.length} selected
                                        </p>
                                        <button
                                            onClick={toggleAll}
                                            className="text-xs text-lds-blue dark:text-blue-400
                                                       underline hover:no-underline transition"
                                        >
                                            {checkedIds.size === announcements.length
                                                ? 'Deselect All'
                                                : 'Select All'}
                                        </button>
                                    </div>

                                    {/* Announcement list */}
                                    <div className="space-y-2">
                                        {announcements.map(ann => {
                                            const dtLabel = buildDateTimeLabel(ann);
                                            const isChecked = checkedIds.has(ann.id);
                                            return (
                                                <label
                                                    key={ann.id}
                                                    className={`flex items-start gap-3 p-3 rounded-lg
                                                        border cursor-pointer transition ${
                                                        isChecked
                                                            ? 'border-lds-blue dark:border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                                                            : 'border-gray-200 dark:border-slate-600 hover:border-gray-300 dark:hover:border-slate-500'
                                                    }`}
                                                >
                                                    <input
                                                        type="checkbox"
                                                        checked={isChecked}
                                                        onChange={() => toggleCheck(ann.id)}
                                                        className="mt-0.5 w-4 h-4 cursor-pointer shrink-0"
                                                    />
                                                    <div className="flex-1 min-w-0">
                                                        <p className="font-semibold text-sm text-gray-800
                                                                      dark:text-slate-100 truncate">
                                                            {ann.title}
                                                        </p>
                                                        {ann.description && (
                                                            <p className="text-xs text-gray-500 dark:text-slate-400
                                                                          mt-0.5 line-clamp-2">
                                                                {ann.description}
                                                            </p>
                                                        )}
                                                        {dtLabel && (
                                                            <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">
                                                                {dtLabel}
                                                            </p>
                                                        )}
                                                        {ann.location && (
                                                            <p className="text-xs text-gray-400 dark:text-slate-500">
                                                                📍 {ann.location}
                                                            </p>
                                                        )}
                                                        <span className={`inline-block text-xs mt-1 px-1.5 py-0.5
                                                            rounded-full font-medium ${
                                                            ann.isPublic
                                                                ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                                                                : 'bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-slate-400'
                                                        }`}>
                                                            {ann.isPublic ? '🌐 Public' : '🔒 Private'}
                                                        </span>
                                                    </div>
                                                </label>
                                            );
                                        })}
                                    </div>
                                </>
                            )}
                        </>
                    )}
                </div>

                {/* ── Footer ── */}
                <div className="px-5 py-4 border-t border-gray-200 dark:border-slate-700
                                shrink-0 flex gap-3">
                    {mode === MODE_PREVIEW ? (
                        <>
                            <button
                                onClick={() => {
                                    setMode(MODE_SELECT);
                                    setSelectedProgram(null);
                                    setAnnouncements([]);
                                    setCheckedIds(new Set());
                                }}
                                className="btn-secondary flex-1"
                            >
                                ← Back
                            </button>
                            <button
                                onClick={handleImport}
                                disabled={checkedIds.size === 0}
                                className="btn-primary flex-1 disabled:opacity-50
                                           disabled:cursor-not-allowed"
                            >
                                📥 Import {checkedIds.size > 0 ? `(${checkedIds.size})` : ''}
                            </button>
                        </>
                    ) : (
                        <button onClick={onClose} className="btn-secondary flex-1">
                            Cancel
                        </button>
                    )}
                </div>
            </div>
        </div>
    );

    return ReactDOM.createPortal(modal, document.body);
}
