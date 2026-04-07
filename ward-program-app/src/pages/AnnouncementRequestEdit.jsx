// src/pages/AnnouncementRequestEdit.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../utils/api';
import { useError } from '../context/ErrorContext';

export default function AnnouncementRequestEdit() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { showToast } = useError();

    const [loading, setLoading] = useState(true);
    const [saving, setSaving]   = useState(false);
    const [status, setStatus]   = useState('');

    const [submitterName, setSubmitterName] = useState('');
    const [title, setTitle]                 = useState('');
    const [description, setDescription]     = useState('');
    const [isAllDay, setIsAllDay]           = useState(false);
    const [eventDate, setEventDate]         = useState('');
    const [eventEndDate, setEventEndDate]   = useState('');
    const [eventTime, setEventTime]         = useState('');
    const [eventEndTime, setEventEndTime]   = useState('');
    const [location, setLocation]           = useState('');

    // ── Load by ID ────────────────────────────────────────────────────────────
    useEffect(() => {
        const load = async () => {
            try {
                const req = await api.get(`/announcements/requests/${id}`);
                setSubmitterName(req.submitterName ?? '');
                setTitle(req.title ?? '');
                setDescription(req.description ?? '');
                setIsAllDay(!!req.isAllDay);
                setEventDate(req.date ?? '');
                setEventEndDate(req.endDate ?? '');
                setEventTime(req.time ?? '');
                setEventEndTime(req.endTime ?? '');
                setLocation(req.location ?? '');
                setStatus(req.status ?? '');
            } catch (err) {
                showToast('❌ Failed to load announcement request.', 'error');
                navigate('/announcement-requests');
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [id]);

    // ── Save ──────────────────────────────────────────────────────────────────
    const handleSave = async () => {
        if (!submitterName.trim()) return showToast('❌ Submitter name is required.', 'error');
        if (!title.trim())         return showToast('❌ Title is required.', 'error');

        setSaving(true);
        try {
            await api.patch(`/announcements/requests/${id}`, {
                submitterName: submitterName.trim(),
                title:         title.trim(),
                description:   description.trim() || undefined,
                isAllDay,
                eventDate:     eventDate || undefined,
                eventEndDate:  eventEndDate || undefined,
                eventTime:     isAllDay ? undefined : (eventTime || undefined),
                eventEndTime:  isAllDay ? undefined : (eventEndTime || undefined),
                location:      location.trim() || undefined,
            });
            showToast('✅ Request updated successfully.');
            navigate('/announcement-requests');
        } catch (err) {
            showToast('❌ Failed to save changes.', 'error');
        } finally {
            setSaving(false);
        }
    };

    // ── Loading state ─────────────────────────────────────────────────────────
    if (loading) return (
        <div className="page-container text-center py-20 text-gray-400 dark:text-slate-500">
            <div className="text-4xl mb-3">⏳</div>
            <p>Loading request...</p>
        </div>
    );

    const statusStyles = {
        pending:   'bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300',
        added:     'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300',
        dismissed: 'bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-400',
    };
    const statusLabels = {
        pending: '🕐 Pending', added: '✅ Added', dismissed: '🚫 Dismissed',
    };

    return (
        <div className="page-container max-w-2xl">

            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h2 className="text-3xl font-bold text-lds-blue dark:text-slate-100">
                        ✏️ Edit Announcement Request
                    </h2>
                    <p className="text-sm text-gray-500 dark:text-slate-400 mt-1 flex items-center gap-2">
                        Request #{id}
                        {status && (
                            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${statusStyles[status] ?? ''}`}>
                                {statusLabels[status] ?? status}
                            </span>
                        )}
                    </p>
                </div>
                <button onClick={() => navigate('/announcement-requests')} className="btn-secondary">
                    ← Back
                </button>
            </div>

            {/* Form */}
            <div className="card space-y-5">

                {/* Submitter Name */}
                <div>
                    <label className="label font-semibold">
                        Submitter Name <span className="text-red-500">*</span>
                    </label>
                    <input
                        type="text"
                        value={submitterName}
                        onChange={e => setSubmitterName(e.target.value)}
                        placeholder="e.g. Jane Smith"
                        className="input w-full mt-1"
                        maxLength={100}
                    />
                </div>

                {/* Title */}
                <div>
                    <label className="label font-semibold">
                        Announcement Title <span className="text-red-500">*</span>
                    </label>
                    <input
                        type="text"
                        value={title}
                        onChange={e => setTitle(e.target.value)}
                        placeholder="e.g. Ward Choir Practice"
                        className="input w-full mt-1"
                        maxLength={200}
                    />
                </div>

                {/* Description */}
                <div>
                    <label className="label font-semibold">
                        Description{' '}
                        <span className="text-gray-400 dark:text-slate-500 font-normal">(optional)</span>
                    </label>
                    <textarea
                        value={description}
                        onChange={e => setDescription(e.target.value)}
                        rows={4}
                        placeholder="Additional details..."
                        className="input w-full mt-1 resize-none"
                        maxLength={2000}
                    />
                    <p className="text-xs text-gray-400 dark:text-slate-500 mt-1 text-right">
                        {description.length}/2000
                    </p>
                </div>

                {/* All Day toggle */}
                <label className="flex items-center gap-3 cursor-pointer">
                    <input
                        type="checkbox"
                        checked={isAllDay}
                        onChange={e => {
                            setIsAllDay(e.target.checked);
                            if (e.target.checked) {
                                setEventTime('');
                                setEventEndTime('');
                            }
                        }}
                        className="w-4 h-4 cursor-pointer"
                    />
                    <span className="text-sm font-medium dark:text-slate-200">📅 All day event</span>
                </label>

                {/* Date row */}
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="label text-sm">
                            {eventEndDate ? 'Start Date' : 'Event Date'}{' '}
                            <span className="text-gray-400 dark:text-slate-500 font-normal">(optional)</span>
                        </label>
                        <input
                            type="date"
                            value={eventDate}
                            onChange={e => setEventDate(e.target.value)}
                            className="input w-full mt-1"
                        />
                    </div>
                    <div>
                        <label className="label text-sm">
                            End Date{' '}
                            <span className="text-gray-400 dark:text-slate-500 font-normal">(optional)</span>
                        </label>
                        <input
                            type="date"
                            value={eventEndDate}
                            onChange={e => setEventEndDate(e.target.value)}
                            className="input w-full mt-1"
                            min={eventDate || undefined}
                        />
                    </div>
                </div>

                {/* Time row — hidden when all-day */}
                {!isAllDay && (
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="label text-sm">
                                Start Time{' '}
                                <span className="text-gray-400 dark:text-slate-500 font-normal">(optional)</span>
                            </label>
                            <input
                                type="time"
                                value={eventTime}
                                onChange={e => setEventTime(e.target.value)}
                                className="input w-full mt-1"
                            />
                        </div>
                        <div>
                            <label className="label text-sm">
                                End Time{' '}
                                <span className="text-gray-400 dark:text-slate-500 font-normal">(optional)</span>
                            </label>
                            <input
                                type="time"
                                value={eventEndTime}
                                onChange={e => setEventEndTime(e.target.value)}
                                className="input w-full mt-1"
                            />
                        </div>
                    </div>
                )}

                {/* Location */}
                <div>
                    <label className="label font-semibold">
                        Location{' '}
                        <span className="text-gray-400 dark:text-slate-500 font-normal">(optional)</span>
                    </label>
                    <input
                        type="text"
                        value={location}
                        onChange={e => setLocation(e.target.value)}
                        placeholder="e.g. Chapel, 1234 Main St"
                        className="input w-full mt-1"
                        maxLength={2000}
                    />
                </div>

                {/* Buttons */}
                <div className="flex gap-3 pt-2 border-t border-gray-200 dark:border-slate-700">
                    <button
                        onClick={() => navigate('/announcement-requests')}
                        className="btn-secondary flex-1"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="btn-primary flex-1"
                    >
                        {saving ? '⏳ Saving...' : '💾 Save Changes'}
                    </button>
                </div>
            </div>
        </div>
    );
}
