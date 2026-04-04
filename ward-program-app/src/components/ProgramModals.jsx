// src/components/ProgramModals.jsx
import React from 'react';

export function ProgramModals({
  cancelModal, setCancelModal, handleDiscardAndExit,
  publishConflictModal, setPublishConflictModal, handlePublishConflictOnly, handlePublishConflictBoth,
  republishModal, setRepublishModal, handleSaveAndRepublish, handleSaveAsDraft,
}) {
  return (
    <>
      {/* ── CANCEL CONFIRMATION MODAL ──────────────────────────────────────── */}
      {cancelModal && (
        <div className="modal-backdrop">
          <div className="modal-container max-w-md">
            <div className="text-center mb-4">
              <div className="text-5xl mb-3">⚠️</div>
              <h4 className="text-xl font-bold text-gray-800 dark:text-slate-100">Discard Changes?</h4>
            </div>
            <div className="text-center mb-6">
              <p className="text-gray-600 dark:text-slate-300">Any unsaved changes will be lost.</p>
              <p className="text-red-500 dark:text-red-400 text-sm mt-1">This action cannot be undone.</p>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setCancelModal(false)} className="btn-secondary flex-1">
                ✏️ Keep Editing
              </button>
              <button onClick={handleDiscardAndExit} className="btn-danger flex-1">
                🚪 Discard & Exit
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── PUBLISH CONFLICT MODAL ─────────────────────────────────────────── */}
      {publishConflictModal && (
        <div className="modal-backdrop">
          <div className="modal-container max-w-md">
            <div className="text-center mb-4">
              <div className="text-5xl mb-3">📢</div>
              <h4 className="text-xl font-bold text-gray-800 dark:text-slate-100">
                Program Already Published for This Date
              </h4>
            </div>
            <p className="text-gray-600 dark:text-slate-300 text-center mb-5">
              A program is already published for{' '}
              <strong className="dark:text-slate-100">{publishConflictModal.dateLabel}</strong>.
              How would you like to proceed?
            </p>
            <div className="flex flex-col gap-3 mb-3">
              <button
                onClick={handlePublishConflictOnly}
                className="modal-action-btn border-green-400 dark:border-green-600 bg-green-50 dark:bg-green-900/20 hover:bg-green-100 dark:hover:bg-green-900/30"
              >
                <p className="font-bold text-green-800 dark:text-green-300">✅ Publish This One Only</p>
                <p className="text-xs text-green-700 dark:text-green-400 mt-0.5">Archive the existing program and publish this one</p>
              </button>
              <button
                onClick={handlePublishConflictBoth}
                className="modal-action-btn border-blue-300 dark:border-blue-600 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/30"
              >
                <p className="font-bold text-blue-800 dark:text-blue-300">📋 Publish Both</p>
                <p className="text-xs text-blue-700 dark:text-blue-400 mt-0.5">Keep the existing program live and also publish this one</p>
              </button>
            </div>
            <button onClick={() => setPublishConflictModal(null)} className="w-full btn-secondary">
              Cancel — Keep Editing
            </button>
          </div>
        </div>
      )}

      {/* ── REPUBLISH MODAL ────────────────────────────────────────────────── */}
      {republishModal && (
        <div className="modal-backdrop">
          <div className="modal-container max-w-md">
            <div className="text-center mb-4">
              <div className="text-5xl mb-3">📢</div>
              <h4 className="text-xl font-bold text-gray-800 dark:text-slate-100">
                This Program is Published
              </h4>
            </div>
            <p className="text-gray-600 dark:text-slate-300 text-center mb-5">
              How would you like to save your changes?
            </p>
            <div className="flex flex-col gap-3 mb-3">
              <button
                onClick={handleSaveAndRepublish}
                className="modal-action-btn border-green-400 dark:border-green-600 bg-green-50 dark:bg-green-900/20 hover:bg-green-100 dark:hover:bg-green-900/30"
              >
                <p className="font-bold text-green-800 dark:text-green-300">🚀 Update & Republish</p>
                <p className="text-xs text-green-700 dark:text-green-400 mt-0.5">Save changes and keep program live</p>
              </button>
              <button
                onClick={handleSaveAsDraft}
                className="modal-action-btn border-gray-300 dark:border-slate-600 bg-gray-50 dark:bg-slate-700/50 hover:bg-gray-100 dark:hover:bg-slate-700"
              >
                <p className="font-bold text-gray-800 dark:text-slate-100">💾 Save as Draft</p>
                <p className="text-xs text-gray-600 dark:text-slate-400 mt-0.5">Unpublish and save changes as a draft</p>
              </button>
            </div>
            <button onClick={() => setRepublishModal(false)} className="w-full btn-secondary">
              Cancel — Keep Editing
            </button>
          </div>
        </div>
      )}
    </>
  );
}
