// src/components/ImportAnnouncementsModal.jsx
import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { api } from '../utils/api';
import { useError } from '../context/ErrorContext';
import { generateId } from '../utils/generateId';

function formatDate(dateStr) {
    if (!dateStr) return '';
    return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
        month: 'short', day: 'numeric', year: 'numeric',
    });
}

function formatTime(timeStr) {
    if (!timeStr) return '';
    return new Date(`2000-01-01T${timeStr}`).toLocaleTimeString('en-US', {
        hour: 'numeric', minute: '2-digit', hour12: true,
    });
}

function buildDateTimeLabel(req) {
    const { date, endDate, time, endTime, isAllDay } = req;
    if (!date && !time) return null;

    if (isAllDay) {
        if (date && endDate && date !== endDate)
            return `📅 ${formatDate(date)} – ${formatDate(endDate)} · All Day`;
        return date ? `📅 ${formatDate(date)} · All Day` : null;
    }

    const dateLabel      = date    ? `📅 ${formatDate(date)}`    : '';
    const endDateLabel   = (endDate && endDate !== date) ? ` – ${formatDate(endDate)}` : '';
    const startTimeLabel = time    ? ` · 🕐 ${formatTime(time)}`  : '';
    const endTimeLabel   = endTime ? ` – ${formatTime(endTime)}`  : '';
    return `${dateLabel}${endDateLabel}${startTimeLabel}${endTimeLabel}` || null;
}

// Convert a request record into an announcement form object
function requestToAnnouncement(req) {
    return {
        id:          generateId(),
        title:       req.title,
        description: req.description ?? '',
        isAllDay:    req.isAllDay,
        date:        req.date ?? '',
        endDate:     req.endDate ?? '',
        time:        req.time ?? '',
        endTime:     req.endTime ?? '',
        location:    req.location ?? '',
        isPublic:    true,
    };
}

export default function ImportAnnouncementsModal({ onClose, onImport, alreadyImported }) {
    const { showToast } = useError();
    const [requests, setRequests]   = useState([]);
    const [loading, setLoading]     = useState(true);
    const [selected, setSelected]   = useState(new Set()); // request IDs selected to import

    useEffect(() => {
        api.get('/announcements/requests?status=pending')
            .then(data => setRequests(data))
            .catch(() => showToast('❌ Failed to load announcement requests.', 'error'))
            .finally(() => setLoading(false));
    }, []);

    const toggle = (id) => {
        setSelected(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const selectAll = () => setSelected(new Set(requests.map(r => r.id)));
    const clearAll  = () => setSelected(new Set());

    const handleImport = () => {
        if (selected.size === 0) return;
        const toImport = requests.filter(r => selected.has(r.id));
        const announcements = toImport.map(requestToAnnouncement);
        onImport(announcements, [...selected]);
        onClose();
    };

    // Requests not yet imported this session
    const available = requests.filter(r => !alreadyImported?.has(r.id));

    return ReactDOM.createPortal(
        <div className="modal-backdrop" onClick={onClose}>
            <div className="modal-container max-w-lg relative" onClick={e => e.stopPropagation()}>

                {/* Header */}
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h3 className="text-lg font-bold dark:text-slate-100">
                            📥 Import Announcement Requests
                        </h3>
                        <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
                            Select pending requests to add to this program.
                        </p>
                    </div>
                    <button onClick={onClose} className="btn-secondary px-2 py-1 text-sm">✕</button>
                </div>

                {/* Content */}
                {loading ? (
                    <div className="text-center py-12 text-gray-400 dark:text-slate-500">
                        <div className="text-4xl mb-2">⏳</div>
                        <p>Loading requests...</p>
                    </div>
                ) : available.length === 0 ? (
                    <div className="text-center py-12 border border-dashed border-gray-300
                                    dark:border-slate-600 rounded-xl">
                        <div className="text-4xl mb-2">📭</div>
                        <p className="text-gray-500 dark:text-slate-400 font-medium">
                            No pending requests
                        </p>
                        <p className="text-sm text-gray-400 dark:text-slate-500 mt-1">
                            All pending requests have already been imported or none exist yet.
                        </p>
                    </div>
                ) : (
                    <>
                        {/* Select all / clear controls */}
                        <div className="flex items-center justify-between mb-3">
                            <p className="text-xs text-gray-500 dark:text-slate-400">
                                {selected.size} of {available.length} selected
                            </p>
                            <div className="flex gap-2">
                                <button
                                    onClick={selectAll}
                                    className="text-xs text-lds-blue dark:text-blue-400 hover:underline"
                                >
                                    Select All
                                </button>
                                <span className="text-gray-300 dark:text-slate-600">|</span>
                                <button
                                    onClick={clearAll}
                                    className="text-xs text-gray-500 dark:text-slate-400 hover:underline"
                                >
                                    Clear
                                </button>
                            </div>
                        </div>

                        {/* Request list */}
                        <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                            {available.map(req => {
                                const dtLabel = buildDateTimeLabel(req);
                                const isSelected = selected.has(req.id);
                                return (
                                    <div
                                        key={req.id}
                                        onClick={() => toggle(req.id)}
                                        className={`rounded-lg border p-3 cursor-pointer transition ${
                                            isSelected
                                                ? 'border-lds-blue bg-blue-50 dark:bg-blue-900/20 dark:border-blue-500'
                                                : 'border-gray-200 dark:border-slate-600 hover:border-gray-300 dark:hover:border-slate-500'
                                        }`}
                                    >
                                        <div className="flex items-start gap-3">
                                            {/* Checkbox */}
                                            <div className={`mt-0.5 w-4 h-4 rounded border-2 shrink-0 flex items-center justify-center transition ${
                                                isSelected
                                                    ? 'bg-lds-blue border-lds-blue'
                                                    : 'border-gray-300 dark:border-slate-500'
                                            }`}>
                                                {isSelected && (
                                                    <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                                    </svg>
                                                )}
                                            </div>

                                            <div className="flex-1 min-w-0">
                                                <p className="font-semibold text-sm text-gray-800 dark:text-slate-100">
                                                    {req.title}
                                                </p>
                                                <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
                                                    From: <strong>{req.submitterName}</strong>
                                                </p>
                                                {req.description && (
                                                    <p className="text-xs text-gray-600 dark:text-slate-300 mt-1 line-clamp-2">
                                                        {req.description}
                                                    </p>
                                                )}
                                                {dtLabel && (
                                                    <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">
                                                        {dtLabel}
                                                    </p>
                                                )}
                                                {req.location && (
                                                    <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
                                                        📍 {req.location}
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </>
                )}

                {/* Footer buttons */}
                {!loading && available.length > 0 && (
                    <div className="flex gap-3 mt-4 pt-4 border-t border-gray-200 dark:border-slate-700">
                        <button onClick={onClose} className="btn-secondary flex-1">
                            Cancel
                        </button>
                        <button
                            onClick={handleImport}
                            disabled={selected.size === 0}
                            className="btn-primary flex-1 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            📥 Add {selected.size > 0 ? `${selected.size} ` : ''}to Program
                        </button>
                    </div>
                )}
            </div>
        </div>
    , document.body
    );
}
