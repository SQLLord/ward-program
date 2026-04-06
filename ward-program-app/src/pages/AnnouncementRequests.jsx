// src/pages/AnnouncementRequests.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../utils/api';
import { useError } from '../context/ErrorContext';

const STATUS_TABS = [
    { key: null,        label: 'All' },
    { key: 'pending',   label: '🕐 Pending' },
    { key: 'added',     label: '✅ Added' },
    { key: 'dismissed', label: '🚫 Dismissed' },
];

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

    const dateLabel     = date    ? `📅 ${formatDate(date)}`    : '';
    const endDateLabel  = (endDate && endDate !== date) ? ` – ${formatDate(endDate)}` : '';
    const startTimeLabel = time   ? ` · 🕐 ${formatTime(time)}`  : '';
    const endTimeLabel  = endTime ? ` – ${formatTime(endTime)}`  : '';
    return `${dateLabel}${endDateLabel}${startTimeLabel}${endTimeLabel}` || null;
}

function StatusBadge({ status }) {
    const styles = {
        pending:   'bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300',
        added:     'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300',
        dismissed: 'bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-400',
    };
    const labels = { pending: '🕐 Pending', added: '✅ Added', dismissed: '🚫 Dismissed' };
    return (
        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${styles[status] ?? ''}`}>
            {labels[status] ?? status}
        </span>
    );
}

export default function AnnouncementRequests() {
    const navigate = useNavigate();
    const { showToast } = useError();
    const [requests, setRequests]   = useState([]);
    const [loading, setLoading]     = useState(true);
    const [activeTab, setActiveTab] = useState(null); // null = all
    const [deleting, setDeleting]   = useState(null);
    const [updating, setUpdating]   = useState(null);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const url = activeTab ? `/announcements/requests?status=${activeTab}` : '/announcements/requests';
            const data = await api.get(url);
            setRequests(data);
        } catch (err) {
            showToast('❌ Failed to load announcement requests.', 'error');
        } finally {
            setLoading(false);
        }
    }, [activeTab]);

    useEffect(() => { load(); }, [load]);

    const updateStatus = async (id, status) => {
        setUpdating(id);
        try {
            await api.patch(`/announcements/requests/${id}/status`, { status });
            setRequests(prev => prev.map(r => r.id === id ? { ...r, status } : r));
            showToast(status === 'dismissed' ? '🚫 Request dismissed.' : '✅ Status updated.');
        } catch (err) {
            showToast('❌ Failed to update status.', 'error');
        } finally {
            setUpdating(null);
        }
    };

    const deleteRequest = async (id) => {
        setDeleting(id);
        try {
            await api.delete(`/announcements/requests/${id}`);
            setRequests(prev => prev.filter(r => r.id !== id));
            showToast('🗑️ Request deleted.');
        } catch (err) {
            showToast('❌ Failed to delete request.', 'error');
        } finally {
            setDeleting(null);
        }
    };

    const pendingCount = requests.filter(r => r.status === 'pending').length;

    return (
        <div className="page-container">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h2 className="text-3xl font-bold text-lds-blue dark:text-slate-100">
                        📢 Announcement Requests
                    </h2>
                    <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">
                        Requests submitted by ward members from the public program page.
                        {pendingCount > 0 && (
                            <span className="ml-2 font-semibold text-amber-600 dark:text-amber-400">
                                {pendingCount} pending
                            </span>
                        )}
                    </p>
                </div>
                <button onClick={() => navigate('/admin')} className="btn-secondary">
                    ← Back to Dashboard
                </button>
            </div>

            {/* Tab filters */}
            <div className="flex gap-1 mb-4 border-b border-gray-200 dark:border-slate-700">
                {STATUS_TABS.map(tab => (
                    <button
                        key={String(tab.key)}
                        onClick={() => setActiveTab(tab.key)}
                        className={`px-4 py-2 text-sm font-semibold border-b-2 transition ${
                            activeTab === tab.key
                                ? 'border-lds-blue text-lds-blue dark:text-slate-100 dark:border-slate-100'
                                : 'border-transparent text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200'
                        }`}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Content */}
            {loading ? (
                <div className="text-center py-16 text-gray-400 dark:text-slate-500">
                    <div className="text-4xl mb-3">⏳</div>
                    <p>Loading requests...</p>
                </div>
            ) : requests.length === 0 ? (
                <div className="text-center py-16 border border-dashed border-gray-300 dark:border-slate-600 rounded-xl">
                    <div className="text-5xl mb-3">📭</div>
                    <p className="text-gray-500 dark:text-slate-400 font-medium">No requests found</p>
                    <p className="text-sm text-gray-400 dark:text-slate-500 mt-1">
                        {activeTab ? 'Try a different filter.' : 'No announcement requests have been submitted yet.'}
                    </p>
                </div>
            ) : (
                <div className="space-y-3">
                    {requests.map(req => {
                        const dtLabel = buildDateTimeLabel(req);
                        return (
                            <div key={req.id}
                                className="bg-white dark:bg-slate-800 rounded-xl border border-gray-100
                                           dark:border-slate-700 shadow-sm p-4">
                                <div className="flex items-start justify-between gap-4">
                                    <div className="flex-1 min-w-0">
                                        {/* Title + status */}
                                        <div className="flex items-center gap-2 flex-wrap mb-1">
                                            <h4 className="font-bold text-gray-800 dark:text-slate-100">
                                                {req.title}
                                            </h4>
                                            <StatusBadge status={req.status} />
                                        </div>

                                        {/* Submitter + submitted time */}
                                        <p className="text-xs text-gray-500 dark:text-slate-400 mb-2">
                                            Submitted by <strong className="text-gray-700 dark:text-slate-300">{req.submitterName}</strong>
                                            {' · '}
                                            {new Date(req.submittedAt).toLocaleDateString('en-US', {
                                                month: 'short', day: 'numeric', year: 'numeric',
                                                hour: 'numeric', minute: '2-digit',
                                            })}
                                        </p>

                                        {/* Description */}
                                        {req.description && (
                                            <p className="text-sm text-gray-600 dark:text-slate-300 mb-2 whitespace-pre-line">
                                                {req.description}
                                            </p>
                                        )}

                                        {/* Date/time */}
                                        {dtLabel && (
                                            <p className="text-xs text-gray-500 dark:text-slate-400 mb-1">
                                                {dtLabel}
                                            </p>
                                        )}

                                        {/* Location */}
                                        {req.location && (
                                            <p className="text-xs text-gray-500 dark:text-slate-400">
                                                📍 {req.location}
                                            </p>
                                        )}

                                        {/* Added to program */}
                                        {req.addedToProgram && (
                                            <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                                                ✅ Added to program #{req.addedToProgram}
                                            </p>
                                        )}
                                    </div>

                                    {/* Actions */}
                                    <div className="flex flex-col gap-2 shrink-0">
                                        {req.status === 'pending' && (
                                            <button
                                                onClick={() => updateStatus(req.id, 'dismissed')}
                                                disabled={updating === req.id}
                                                className="btn-secondary text-xs px-3 py-1.5"
                                            >
                                                🚫 Dismiss
                                            </button>
                                        )}
                                        {req.status === 'dismissed' && (
                                            <button
                                                onClick={() => updateStatus(req.id, 'pending')}
                                                disabled={updating === req.id}
                                                className="btn-secondary text-xs px-3 py-1.5"
                                            >
                                                ↩️ Restore
                                            </button>
                                        )}
                                        <button
                                            onClick={() => deleteRequest(req.id)}
                                            disabled={deleting === req.id}
                                            className="btn-danger text-xs px-3 py-1.5"
                                        >
                                            {deleting === req.id ? '⏳' : '🗑️'} Delete
                                        </button>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
