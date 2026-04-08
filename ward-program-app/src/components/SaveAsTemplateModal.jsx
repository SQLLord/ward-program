// src/components/SaveAsTemplateModal.jsx
import React, { useState } from 'react';
import { api } from '../utils/api';
import { useError } from '../context/ErrorContext';

// ── Strips non-template fields from formData ──────────────────────────────────
function buildTemplatePayload(formData) {
    const meetingItems = (formData.meetingOrder?.meetingItems ?? []).map(item => {
        const stripped = { id: item.id, type: item.type };
        if (item.type === 'customText') stripped.text = item.text ?? '';
        return stripped;
    });

    const coverLayout = (formData.cover?.layout ?? []).map(block => {
        if (block?.type === 'image') return { id: block.id, type: 'image' };
        return block;
    });

    return {
        programName:    formData.programName ?? '',
        cover: {
            layout:         coverLayout,
            imageBleed:     false,
            imageHeightPct: formData.cover?.imageHeightPct ?? 50,
            printSettings:  formData.cover?.printSettings ?? { preset: 'standard' },
        },
        meetingOrder: {
            conducting:    formData.meetingOrder?.conducting  ?? '',
            presiding:     formData.meetingOrder?.presiding   ?? '',
            chorister:     formData.meetingOrder?.chorister   ?? '',
            accompanist:   formData.meetingOrder?.accompanist ?? '',
            meetingItems,
            printSettings: formData.meetingOrder?.printSettings ?? { preset: 'standard' },
        },
        announcementSettings: formData.announcementSettings ?? { preset: 'standard' },
        leadershipSettings:   formData.leadershipSettings   ?? { preset: 'standard' },
        leadershipMode:       formData.leadershipMode       ?? 'default',
        schedulesMode:        formData.schedulesMode         ?? 'default',
        schedulesPublic:      formData.schedulesPublic       !== false,
    };
}

// ── Modes ─────────────────────────────────────────────────────────────────────
const MODE_NAME    = 'name';     // entering template name
const MODE_CONFIRM = 'confirm';  // name already exists — ask overwrite or new
const MODE_SAVING  = 'saving';   // in-flight

export default function SaveAsTemplateModal({ formData, onClose }) {
    const { showToast } = useError();
    const [mode, setMode]       = useState(MODE_NAME);
    const [name, setName]       = useState(formData.programName ?? '');
    const [existing, setExisting] = useState(null); // { id, name } if found

    const handleNameSubmit = async () => {
        const trimmed = name.trim();
        if (!trimmed) return showToast('❌ Please enter a template name.', 'error');

        setMode(MODE_SAVING);
        try {
            const result = await api.get(
                `/templates/by-name/${encodeURIComponent(trimmed)}`
            );
            if (result.exists) {
                setExisting(result);
                setMode(MODE_CONFIRM);
            } else {
                await createNew(trimmed);
            }
        } catch (err) {
            showToast('❌ Failed to check template name.', 'error');
            setMode(MODE_NAME);
        }
    };

    const createNew = async (templateName) => {
        setMode(MODE_SAVING);
        try {
            await api.post('/templates', {
                name:    templateName ?? name.trim(),
                program: buildTemplatePayload(formData),
            });
            showToast(`✅ Template "${templateName ?? name.trim()}" saved!`);
            onClose();
        } catch (err) {
            showToast('❌ Failed to save template.', 'error');
            setMode(MODE_NAME);
        }
    };

    const overwriteExisting = async () => {
        setMode(MODE_SAVING);
        try {
            await api.put(`/templates/${existing.id}`, {
                name:    name.trim(),
                program: buildTemplatePayload(formData),
            });
            showToast(`✅ Template "${name.trim()}" updated!`);
            onClose();
        } catch (err) {
            showToast('❌ Failed to update template.', 'error');
            setMode(MODE_CONFIRM);
        }
    };

    const saveAsNewWithSuffix = async () => {
        // Append " (2)", " (3)" etc. to avoid duplicate name
        let newName = `${name.trim()} (2)`;
        let attempt = 2;
        // Simple — just try with (2), server will accept any unique name
        await createNew(newName);
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center
                        justify-center z-50 p-4">
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl p-6
                            max-w-md w-full">

                {/* ── Enter name ─────────────────────────────────────────── */}
                {(mode === MODE_NAME || mode === MODE_SAVING) && (
                    <>
                        <div className="text-center mb-5">
                            <div className="text-4xl mb-2">📋</div>
                            <h3 className="text-xl font-bold dark:text-slate-100">
                                Save as Template
                            </h3>
                            <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">
                                Meeting order, cover layout, and conducting info will be saved.
                                Hymn numbers, speaker names, and announcements will not.
                            </p>
                        </div>

                        <label className="label font-semibold">Template Name</label>
                        <input
                            type="text"
                            value={name}
                            onChange={e => setName(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handleNameSubmit()}
                            className="input w-full mt-1 mb-4"
                            maxLength={200}
                            placeholder="e.g. Fast Sunday, Standard Sacrament"
                            autoFocus
                            disabled={mode === MODE_SAVING}
                        />

                        <div className="flex gap-3">
                            <button
                                onClick={onClose}
                                disabled={mode === MODE_SAVING}
                                className="btn-secondary flex-1"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleNameSubmit}
                                disabled={mode === MODE_SAVING || !name.trim()}
                                className="btn-primary flex-1"
                            >
                                {mode === MODE_SAVING ? '⏳ Checking...' : '💾 Save Template'}
                            </button>
                        </div>
                    </>
                )}

                {/* ── Name conflict prompt ────────────────────────────────── */}
                {mode === MODE_CONFIRM && (
                    <>
                        <div className="text-center mb-5">
                            <div className="text-4xl mb-2">⚠️</div>
                            <h3 className="text-xl font-bold dark:text-slate-100">
                                Template Already Exists
                            </h3>
                            <p className="text-sm text-gray-500 dark:text-slate-400 mt-2">
                                A template named{' '}
                                <strong className="text-gray-700 dark:text-slate-200">
                                    "{name.trim()}"
                                </strong>{' '}
                                already exists. What would you like to do?
                            </p>
                        </div>

                        <div className="flex flex-col gap-2">
                            <button
                                onClick={overwriteExisting}
                                className="btn-primary w-full"
                            >
                                🔄 Update Existing Template
                            </button>
                            <button
                                onClick={saveAsNewWithSuffix}
                                className="btn-secondary w-full"
                            >
                                ➕ Save as New Template
                            </button>
                            <button
                                onClick={() => setMode(MODE_NAME)}
                                className="btn-secondary w-full"
                            >
                                ✏️ Choose a Different Name
                            </button>
                            <button
                                onClick={onClose}
                                className="text-sm text-gray-400 hover:text-gray-600
                                           dark:text-slate-500 dark:hover:text-slate-300
                                           transition text-center mt-1"
                            >
                                Cancel
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
