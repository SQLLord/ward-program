// src/components/ContactUsModal.jsx
import React, { useState } from 'react';
import { apiBase } from '../utils/api';
import { formatPhoneNumber } from '../utils/formatters';

export default function ContactUsModal({ onClose, wardName }) {
    const [name, setName]         = useState('');
    const [email, setEmail]       = useState('');
    const [phone, setPhone]       = useState('');
    const [message, setMessage]   = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [error, setError]       = useState('');
    const [success, setSuccess]   = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        // Validation
        if (!name.trim()) return setError('Your name is required.');
        if (!message.trim()) return setError('Please enter a message.');

        const hasEmail = !!email.trim();
        const hasPhone = !!phone.trim();
        if (!hasEmail && !hasPhone) {
            return setError('Please provide at least one way to contact you — an email address or phone number.');
        }

        // Basic email format check if provided
        if (hasEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
            return setError('Please enter a valid email address.');
        }

        setSubmitting(true);
        try {
            const res = await fetch(`${apiBase}/api/contact/request`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name:    name.trim(),
                    email:   email.trim() || undefined,
                    phone:   phone.trim() || undefined,
                    message: message.trim(),
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
                            ✉️ Contact Us
                        </h3>
                        <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
                            {wardName ? `Send a message to ${wardName}` : 'Send us a message'}
                        </p>
                    </div>
                    <button onClick={onClose} className="btn-secondary px-2 py-1 text-sm">✕</button>
                </div>

                {success ? (
                    <div className="text-center py-8">
                        <div className="text-6xl mb-3">✅</div>
                        <h4 className="text-lg font-bold dark:text-slate-100 mb-2">Message Sent!</h4>
                        <p className="text-sm text-gray-500 dark:text-slate-400">
                            Your message has been sent. Someone will be in touch with you soon.
                        </p>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} className="space-y-4">

                        {/* Name */}
                        <div>
                            <label className="label text-sm">
                                Your Name <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="text"
                                value={name}
                                onChange={e => setName(e.target.value)}
                                placeholder="e.g. Jane Smith"
                                className="input w-full"
                                maxLength={100}
                                required
                                autoFocus
                            />
                        </div>

                        {/* Contact info — at least one required */}
                        <div className="rounded-lg border border-gray-200 dark:border-slate-600
                                        bg-gray-50 dark:bg-slate-700/50 p-3 space-y-3">
                            <p className="text-xs text-gray-500 dark:text-slate-400 font-medium">
                                Please provide at least one way to contact you:
                            </p>

                            {/* Email */}
                            <div>
                                <label className="label text-sm">Email Address</label>
                                <input
                                    type="email"
                                    value={email}
                                    onChange={e => setEmail(e.target.value)}
                                    placeholder="e.g. jane@example.com"
                                    className="input w-full"
                                    maxLength={255}
                                />
                            </div>

                            {/* Phone */}
                            <div>
                                <label className="label text-sm">Phone Number</label>
                                <input
                                    type="tel"
                                    value={phone}
                                    onChange={e => setPhone(formatPhoneNumber(e.target.value))}
                                    placeholder="e.g. (555) 123-4567"
                                    className="input w-full"
                                    maxLength={20}
                                />
                            </div>
                        </div>

                        {/* Message */}
                        <div>
                            <label className="label text-sm">
                                Message <span className="text-red-500">*</span>
                            </label>
                            <textarea
                                value={message}
                                onChange={e => setMessage(e.target.value)}
                                placeholder="How can we help you?"
                                rows={4}
                                className="input w-full resize-none"
                                maxLength={2000}
                            />
                            <p className="text-xs text-gray-400 dark:text-slate-500 mt-1 text-right">
                                {message.length}/2000
                            </p>
                        </div>

                        {/* Error */}
                        {error && (
                            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200
                                            dark:border-red-800 text-red-700 dark:text-red-400
                                            px-4 py-3 rounded-lg text-sm">
                                ⚠️ {error}
                            </div>
                        )}

                        {/* Buttons */}
                        <div className="flex gap-3 pt-1">
                            <button type="button" onClick={onClose} className="btn-secondary flex-1">
                                Cancel
                            </button>
                            <button type="submit" disabled={submitting} className="btn-primary flex-1">
                                {submitting ? '⏳ Sending...' : '✉️ Send Message'}
                            </button>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
}
