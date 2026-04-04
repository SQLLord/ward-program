// src/pages/ImageLibrary.jsx
import React, { useState, useEffect, useRef } from 'react';
import { useError } from '../context/ErrorContext';
import { apiBase, getCsrfToken } from '../utils/api';  // ← add getCsrfToken

function ImageLibrary() {
  const { showToast } = useError();
  const [images, setImages]         = useState([]);
  const [loading, setLoading]       = useState(true);
  const [uploading, setUploading]   = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [previewImage, setPreviewImage] = useState(null); // { sasUrl, fileName }
  const fileInputRef = useRef(null);
  const [uploadProgress, setUploadProgress] = useState(null); // { done, total }
  const [confirmDelete, setConfirmDelete] = useState(null); // img object to delete

  // ── Load library on mount ───────────────────────────────────────────────────
  // AFTER — call inline so there's no dependency on the function reference
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const res = await fetch(`${apiBase}/api/images`, { credentials: 'include' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (!cancelled) setImages(Array.isArray(data) ? data : []);
      } catch (err) {
        if (!cancelled) showToast('⚠️ Failed to load image library.', 'error');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; }; // ← cleanup prevents state update on unmount
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  
  // ── Upload ──────────────────────────────────────────────────────────────────
  const handleUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;

    const ALLOWED = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

    // ── Validate all files up front before uploading any ──────────────────────
    for (const file of files) {
      if (!ALLOWED.includes(file.type)) {
        showToast(`⚠️ Invalid file type — only JPEG, PNG, GIF, and WebP are allowed.\n"${file.name}" was skipped.`, 'error');
        e.target.value = '';
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        showToast(`⚠️ File too large (max 5MB) — "${file.name}" was skipped.`, 'error');
        e.target.value = '';
        return;
      }
    }

    setUploading(true);
    setUploadProgress({ done: 0, total: files.length });

    const results = { uploaded: [], failed: [] };

    // ── Upload all files in parallel ───────────────────────────────────────────
    await Promise.all(files.map(async (file) => {
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

        results.uploaded.push(data);
      } catch (err) {
        results.failed.push({ name: file.name, error: err.message });
      } finally {
        setUploadProgress(prev => ({ ...prev, done: (prev?.done ?? 0) + 1 }));
      }
    }));

    // ── Update image list — prepend all successful uploads ────────────────────
    if (results.uploaded.length > 0) {
      setImages(prev => [...results.uploaded.reverse(), ...prev]);
    }

    // ── Show result toast ─────────────────────────────────────────────────────
    if (results.failed.length === 0) {
      showToast(
        files.length === 1
          ? '✅ Image uploaded successfully!'
          : `✅ ${results.uploaded.length} image${results.uploaded.length !== 1 ? 's' : ''} uploaded successfully!`,
        'success'
      );
    } else if (results.uploaded.length === 0) {
      showToast(`⚠️ All ${results.failed.length} uploads failed.`, 'error');
    } else {
      showToast(
        `⚠️ ${results.uploaded.length} uploaded, ${results.failed.length} failed: ${results.failed.map(f => f.name).join(', ')}`,
        'error'
      );
    }

    setUploading(false);
    setUploadProgress(null);
    e.target.value = '';
  };

  // ── Delete ────────────────────────────────────────────────────────────────────
  const handleDeleteClick = (img) => {
    setConfirmDelete(img);
  };

  const confirmDeleteImage = async () => {
    const img = confirmDelete;
    setConfirmDelete(null);
    setDeletingId(img.id);
    try {
      const res = await fetch(`${apiBase}/api/images/${img.id}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: {
            'x-csrf-token': getCsrfToken(),  // ← ADD THIS
          },

      });
      const data = await res.json();
      if (res.status === 409) {
        showToast('⚠️ This image is in use by one or more active programs and cannot be deleted.', 'error');
        return;
      }
      if (!res.ok) throw new Error(data.error ?? 'Delete failed.');
      setImages(prev => prev.filter(i => i.id !== img.id));
      showToast('🗑️ Image deleted from library.', 'success');
    } catch (err) {
      showToast(`⚠️ ${err.message}`, 'error');
    } finally {
      setDeletingId(null);
    }
  };

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="page-container">

      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-lds-blue dark:text-slate-100">
            🖼️ Image Library
          </h2>
          <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">
            Upload and manage cover images for sacrament meeting programs.
          </p>
        </div>
       <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="btn-primary flex items-center gap-2"
        >
          {uploading
            ? uploadProgress
              ? `⏳ Uploading ${uploadProgress.done}/${uploadProgress.total}...`
              : '⏳ Uploading...'
            : '⬆️ Upload Images'}   {/* ← plural */}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/gif,image/webp"
          onChange={handleUpload}
          multiple
          className="hidden"
        />
      </div>

      {/* ── Stats bar ── */}
      {!loading && (
        <div className="bg-gray-50 dark:bg-slate-800 rounded-lg px-4 py-2 mb-6
                        text-sm text-gray-500 dark:text-slate-400 flex items-center gap-4">
          <span>📁 {images.length} image{images.length !== 1 ? 's' : ''} in library</span>
          <span>·</span>
          <span>
            💾 {(images.reduce((sum, i) => sum + i.fileSizeKb, 0) / 1024).toFixed(1)} MB total
          </span>
        </div>
      )}

      {/* ── Loading ── */}
      {loading && (
        <div className="text-center py-16">
          <div className="text-4xl mb-3">⏳</div>
          <p className="text-gray-500 dark:text-slate-400">Loading library...</p>
        </div>
      )}

      {/* ── Empty state ── */}
      {!loading && images.length === 0 && (
        <div className="card text-center py-16">
          <div className="text-6xl mb-4">🖼️</div>
          <h3 className="text-xl font-bold mb-2 dark:text-slate-100">No Images Yet</h3>
          <p className="text-gray-500 dark:text-slate-400 mb-6">
            Upload your first image to get started.
          </p>
          
          <button
            onClick={() => fileInputRef.current?.click()}
            className="btn-primary"
          >
            ⬆️ Upload Images   {/* ← was "Upload First Image" */}
          </button>
        </div>
      )}

      {/* ── Image Grid ── */}
      {!loading && images.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {images.map(img => (
            <div
              key={img.id}
              className="group relative bg-gray-100 dark:bg-slate-800
                         rounded-xl overflow-hidden border border-gray-200
                         dark:border-slate-700 shadow-sm
                         hover:shadow-md transition-shadow"
            >
              {/* Thumbnail */}
              <div
                className="aspect-square cursor-pointer overflow-hidden bg-gray-200 dark:bg-slate-700"
                onClick={() => setPreviewImage(img)}
              >
                <img
                  src={`${apiBase}/api/images/${img.id}/serve`}
                  alt={img.fileName}
                  className="w-full h-full object-cover
                             group-hover:scale-105 transition-transform duration-200"
                  onError={(e) => { e.target.alt = '⚠️ Failed to load image'; }}
                />
                
              </div>

              {/* Info footer */}
              <div className="p-2">
                <p className="text-xs font-medium truncate dark:text-slate-200"
                   title={img.fileName}>
                  {img.fileName}
                </p>
                <p className="text-xs text-gray-400 dark:text-slate-500">
                  {img.fileSizeKb} KB ·{' '}
                  {new Date(img.uploadedAt).toLocaleDateString('en-US', {
                    month: 'short', day: 'numeric', year: 'numeric'
                  })}
                </p>
              </div>

              {/* Action buttons — shown on hover */}
              <div className="absolute top-2 right-2 flex gap-1
                              opacity-0 group-hover:opacity-100 transition-opacity">
                {/* Preview */}
                <button
                  onClick={() => setPreviewImage(img)}
                  className="w-8 h-8 rounded-full bg-white dark:bg-slate-700
                             shadow text-sm flex items-center justify-center
                             hover:bg-gray-100 dark:hover:bg-slate-600 transition"
                  title="Preview"
                >
                  🔍
                </button>
                {/* Delete */}
                <button
                  onClick={() => handleDeleteClick(img)}   // ← was handleDelete(img)
                  disabled={deletingId === img.id}
                  className="w-8 h-8 rounded-full bg-white dark:bg-slate-700
                    shadow text-sm flex items-center justify-center
                    hover:bg-red-50 dark:hover:bg-red-900/30 transition
                    disabled:opacity-50"
                  title="Delete"
                >
                  {deletingId === img.id ? '⏳' : '🗑️'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
      {/* ── Delete Confirmation Modal ── */}
      {confirmDelete && (
        <div className="modal-backdrop">
          <div className="modal-container max-w-md flex flex-col items-center text-center gap-4">

            {/* Icon + Title */}
            <div className="text-5xl">⚠️</div>
            <h3 className="text-xl font-bold dark:text-slate-100">Delete Image?</h3>
            <p className="text-sm text-gray-500 dark:text-slate-400">
              You are about to permanently delete:
            </p>

            {/* Image identity block */}
            <div className="flex flex-col items-center gap-1">
              <p className="font-semibold dark:text-slate-100 truncate max-w-xs"
                title={confirmDelete.fileName}>
                {confirmDelete.fileName}
              </p>
              <p className="text-xs text-gray-400 dark:text-slate-500">
                {confirmDelete.fileSizeKb} KB · uploaded{' '}
                {new Date(confirmDelete.uploadedAt).toLocaleDateString('en-US', {
                  month: 'long', day: 'numeric', year: 'numeric'
                })}
              </p>
            </div>

            {/* Warning */}
            <p className="text-sm font-semibold text-red-600 dark:text-red-400">
              ⚠️ This action cannot be undone.
            </p>

            {/* Buttons */}
            <div className="flex gap-3 w-full">
              <button
                onClick={() => setConfirmDelete(null)}
                className="btn-secondary flex-1"
              >
                Cancel
              </button>
              <button
                onClick={confirmDeleteImage}
                className="btn-danger flex-1"
              >
                🗑️ Yes, Delete
              </button>
            </div>
          </div>
        </div>
      )}


      {/* ── Preview Modal ── */}
      {previewImage && (
        <div className="modal-backdrop" onClick={() => setPreviewImage(null)}>
          <div
            className="modal-container max-w-3xl p-0 overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            {/* Modal header */}
            <div className="flex items-center justify-between px-4 py-3
                            border-b border-gray-200 dark:border-slate-700">
              <div>
                <p className="font-semibold dark:text-slate-100 truncate">
                  {previewImage.fileName}
                </p>
                <p className="text-xs text-gray-400 dark:text-slate-500">
                  {previewImage.fileSizeKb} KB · uploaded{' '}
                  {new Date(previewImage.uploadedAt).toLocaleDateString('en-US', {
                    month: 'long', day: 'numeric', year: 'numeric'
                  })}
                </p>
              </div>
              <button
                onClick={() => setPreviewImage(null)}
                className="btn-secondary px-3 py-1.5 text-sm"
              >
                ✕ Close
              </button>
            </div>
            {/* Image */}
            <div className="bg-gray-100 dark:bg-slate-900 flex items-center justify-center p-4">
              
              <img
                src={`${apiBase}/api/images/${previewImage.id}/serve`}
                alt={previewImage.fileName}
                className="max-h-[60vh] max-w-full object-contain rounded-lg"
                onError={(e) => { e.target.alt = '⚠️ Failed to load image'; }}
              />

            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ImageLibrary;