// src/components/ImagePickerModal.jsx
import React, { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';           // ← ADD THIS
import { useError } from '../context/ErrorContext';
import { apiBase, getCsrfToken } from '../utils/api';  // ← add getCsrfToken

export function ImagePickerModal({ onSelect, onClose }) {
  const { showToast } = useError();
  const [images, setImages]       = useState([]);
  const [loading, setLoading]     = useState(true);
  const [uploading, setUploading] = useState(false);
  const [selected, setSelected]   = useState(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    fetch(`${apiBase}/api/images`, { credentials: 'include' })
      .then(r => r.json())
      .then(data => setImages(Array.isArray(data) ? data : []))
      .catch(() => showToast('⚠️ Failed to load image library.', 'error'))
      .finally(() => setLoading(false));
  }, []);

  // ── Lock body scroll while modal is open ───────────────────────────────────
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  const handleUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const ALLOWED = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!ALLOWED.includes(file.type)) {
      showToast(`⚠️ Invalid file type — only JPEG, PNG, GIF, and WebP are allowed. "${file.name}" was skipped.`, 'error');
      e.target.value = '';
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      showToast(`⚠️ File too large (max 5MB) — "${file.name}" was skipped.`, 'error');
      e.target.value = '';
      return;
    }
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('image', file);
      const res = await fetch(`${apiBase}/api/images`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'x-csrf-token': getCsrfToken(),   // ← ADD THIS
          // ⚠️ Do NOT set Content-Type — browser sets it automatically for FormData
        },
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Upload failed.');
      setImages(prev => [data, ...prev]);
      setSelected(data);
      showToast('✅ Image uploaded! Click "Use This Image" to apply it.', 'success');
    } catch (err) {
        showToast(`⚠️ ${err.message ?? 'Upload failed. Please try again.'}`, 'error');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handleConfirm = () => {
    if (!selected) return;
    onSelect(selected);
    onClose();
  };

  // ── Render via portal — escapes overflow-y-auto parent ────────────────────
  return ReactDOM.createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center
                 bg-black/70 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-3xl max-h-[90vh] flex flex-col
           bg-white dark:bg-slate-800 rounded-xl shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* ── Header ── */}
        <div className="flex items-center justify-between px-5 py-4
                        border-b border-gray-200 dark:border-slate-700 shrink-0">
          <div>
            <h3 className="text-lg font-bold dark:text-slate-100">🖼️ Image Library</h3>
            <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
              Select an image or upload a new one
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="btn-secondary text-sm flex items-center gap-1.5"
            >
              {uploading ? '⏳ Uploading...' : '⬆️ Upload New'}
            </button>
            <button onClick={onClose} className="btn-secondary px-3 py-1.5 text-sm">
              ✕
            </button>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/gif,image/webp"
            onChange={handleUpload}
            className="hidden"
          />
        </div>

        {/* ── Image Grid ── */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading && (
            <div className="text-center py-12">
              <div className="text-3xl mb-2">⏳</div>
              <p className="text-gray-500 dark:text-slate-400 text-sm">Loading library...</p>
            </div>
          )}
          {!loading && images.length === 0 && (
            <div className="text-center py-12">
              <div className="text-5xl mb-3">🖼️</div>
              <p className="font-semibold dark:text-slate-100 mb-1">No images yet</p>
              <p className="text-sm text-gray-500 dark:text-slate-400 mb-4">
                Upload your first image using the button above.
              </p>
            </div>
          )}
          {!loading && images.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {images.map(img => {
                const isSelected = selected?.id === img.id;
                return (
                  <button
                    key={img.id}
                    onClick={() => setSelected(isSelected ? null : img)}
                    className={`relative rounded-xl overflow-hidden border-2 transition-all
                                text-left focus:outline-none
                                ${isSelected
                                  ? 'border-lds-blue ring-2 ring-lds-blue/30 scale-[1.02]'
                                  : 'border-gray-200 dark:border-slate-600 hover:border-lds-blue/50'
                                }`}
                  >
                    <div className="aspect-square bg-gray-100 dark:bg-slate-700 overflow-hidden">
                      <img
                        src={`${apiBase}/api/images/${img.id}/serve`}
                        alt={img.fileName}
                        className="w-full h-full object-cover"
                        onError={e => {
                          e.target.style.display = 'none';
                          e.target.nextSibling.style.display = 'flex';
                        }}
                      />
                      <div className="hidden w-full h-full items-center justify-center text-gray-400 dark:text-slate-500 text-sm">
                        ⚠️ Failed to load
                      </div>
                    </div>
                    {isSelected && (
                      <div className="absolute top-2 left-2 w-6 h-6 rounded-full
                                      bg-lds-blue text-white flex items-center
                                      justify-center text-xs font-bold shadow">
                        ✓
                      </div>
                    )}
                    <div className="p-2">
                      <p className="text-xs truncate dark:text-slate-200 font-medium"
                         title={img.fileName}>
                        {img.fileName}
                      </p>
                      <p className="text-xs text-gray-400 dark:text-slate-500">
                        {img.fileSizeKb} KB
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        <div className="px-5 py-4 border-t border-gray-200 dark:border-slate-700
                        flex items-center justify-between shrink-0">
          <p className="text-sm text-gray-500 dark:text-slate-400">
            {selected
              ? `✅ Selected: ${selected.fileName}`
              : 'Click an image to select it'}
          </p>
          <div className="flex gap-2">
            <button onClick={onClose} className="btn-secondary">Cancel</button>
            <button
              onClick={handleConfirm}
              disabled={!selected}
              className="btn-primary disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Use This Image →
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body   // ← Portal target — renders outside all overflow containers
  );
}