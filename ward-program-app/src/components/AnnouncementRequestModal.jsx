// src/components/AnnouncementRequestModal.jsx
import React, { useState } from 'react';
import { apiBase, getCsrfToken } from '../utils/api';

export default function AnnouncementRequestModal({ onClose }) {
    const [submitterName, setSubmitterName] = useState('');
    const [title, setTitle]                 = useState('');
    const [description, setDescription]     = useState('');
    const [isAllDay, setIsAllDay]           = useState(false);
    const [eventDate, setEventDate]         = useState('');
    const [eventEndDate, setEventEndDate]   = useState('');
    const [eventTime, setEventTime]         = useState('');
    const [eventEndTime, setEventEndTime]   = useState('');
    const [location, setLocation]           = useState('');
    const [submitting, setSubmitting]       = useState(false);
    const [error, setError]                 = useState('');
    const [success, setSuccess]             = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        if (!submitterName.trim()) return setError('Your name is required.');
        if (!title.trim())         return setError('Announcement title is required.');

        setSubmitting(true);
        try {
            const res = await fetch(`${apiBase}/api/announcements/request`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-Token':  getCsrfToken(),
                },
                body: JSON.stringify({
                    submitterName: submitterName.trim(),
                    title:         title.trim(),
                    description:   description.trim(),
                    isAllDay,
                    eventDate:     eventDate || undefined,
                    eventEndDate:  eventEndDate || undefined,
                    eventTime:     isAllDay ? undefined : (eventTime || undefined),
                    eventEndTime:  isAllDay ? undefined : (eventEndTime || undefined),
                    location:      location.trim() || undefined,
                }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error ?? 'Submission failed.');
            setSuccess(true);
            setTimeout(() => onClose(), 3000);
        } catch (err) {
            setError(err.message ?? 'Something went wrong. Please try again.');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="modal-backdrop" onClick={onClose}>
            <div className="modal-container max-w-md relative" onClick={e => e.stopPropagation()}>

                {/* Header */}
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h3 className="text-lg font-bold dark:text-slate-100">
                            📢 Submit Announcement Request
                        </h3>
                        <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
                            Your request will be sent for review.
                        </p>
                    </div>
                    <button onClick={onClose} className="btn-secondary px-2 py-1 text-sm">✕</button>
                </div>

                {success ? (
                    <div className="text-center py-8">
                        <div className="text-6xl mb-3">✅</div>
                        <h4 className="text-lg font-bold dark:text-slate-100 mb-2">Request Submitted!</h4>
                        <p className="text-sm text-gray-500 dark:text-slate-400">
                            Your announcement request has been sent to the ward secretary.
                        </p>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} className="space-y-4">

                        {/* Submitter Name */}
                        <div>
                            <label className="label text-sm">Your Name <span className="text-red-500">*</span></label>
                            <input
                                type="text"
                                value={submitterName}
                                onChange={e => setSubmitterName(e.target.value)}
                                placeholder="e.g. Jane Smith"
                                className="input w-full"
                                maxLength={100}
                                required
                                autoFocus
                            />
                        </div>

                        {/* Title */}
                        <div>
                            <label className="label text-sm">Announcement Title <span className="text-red-500">*</span></label>
                            <input
                                type="text"
                                value={title}
                                onChange={e => setTitle(e.target.value)}
                                placeholder="e.g. Ward Choir Practice"
                                className="input w-full"
                                maxLength={200}
                                required
                            />
                        </div>

                        {/* Description */}
                        <div>
                            <label className="label text-sm">
                                Description
                                <span className="text-gray-400 dark:text-slate-500 font-normal ml-1">(optional)</span>
                            </label>
                            <textarea
                                value={description}
                                onChange={e => setDescription(e.target.value)}
                                placeholder="Additional details..."
                                rows={3}
                                className="input w-full resize-none"
                                maxLength={2000}
                            />
                        </div>

                        {/* All Day toggle */}
                        <label className="flex items-center gap-2 text-sm cursor-pointer">
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
                            📅 All day event
                        </label>

                        {/* Date row */}
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="label text-sm">
                                    {eventEndDate ? 'Start Date' : 'Event Date'}
                                    <span className="text-gray-400 dark:text-slate-500 font-normal ml-1">(optional)</span>
                                </label>
                                <input
                                    type="date"
                                    value={eventDate}
                                    onChange={e => setEventDate(e.target.value)}
                                    className="input w-full"
                                />
                            </div>
                            <div>
                                <label className="label text-sm">
                                    End Date
                                    <span className="text-gray-400 dark:text-slate-500 font-normal ml-1">(optional)</span>
                                </label>
                                <input
                                    type="date"
                                    value={eventEndDate}
                                    onChange={e => setEventEndDate(e.target.value)}
                                    className="input w-full"
                                    min={eventDate || undefined}
                                />
                            </div>
                        </div>

                        {/* Time row — hidden when all-day */}
                        {!isAllDay && (
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="label text-sm">
                                        Start Time
                                        <span className="text-gray-400 dark:text-slate-500 font-normal ml-1">(optional)</span>
                                    </label>
                                    <input
                                        type="time"
                                        value={eventTime}
                                        onChange={e => setEventTime(e.target.value)}
                                        className="input w-full"
                                    />
                                </div>
                                <div>
                                    <label className="label text-sm">
                                        End Time
                                        <span className="text-gray-400 dark:text-slate-500 font-normal ml-1">(optional)</span>
                                    </label>
                                    <input
                                        type="time"
                                        value={eventEndTime}
                                        onChange={e => setEventEndTime(e.target.value)}
                                        className="input w-full"
                                    />
                                </div>
                            </div>
                        )}

                        {/* Location */}
                        <div>
                            <label className="label text-sm">
                                Location
                                <span className="text-gray-400 dark:text-slate-500 font-normal ml-1">(optional)</span>
                            </label>
                            <input
                                type="text"
                                value={location}
                                onChange={e => setLocation(e.target.value)}
                                placeholder="e.g. Chapel, 1234 Main St"
                                className="input w-full"
                                maxLength={2000}
                            />
                        </div>

                        {/* Error */}
                        {error && (
                            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800
                                            text-red-700 dark:text-red-400 px-4 py-3 rounded-lg text-sm">
                                ⚠️ {error}
                            </div>
                        )}

                        {/* Buttons */}
                        <div className="flex gap-3 pt-1">
                            <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancel</button>
                            <button type="submit" disabled={submitting} className="btn-primary flex-1">
                                {submitting ? '⏳ Submitting...' : '📢 Submit Request'}
                            </button>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
}
