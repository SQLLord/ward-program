// src/components/CoverBlockEditor.jsx
import React, { useState } from 'react';
import { uploadUrlToLibrary, uploadFileToLibrary } from '../utils/imageUtils'; // ← CHANGED import
import { COVER_BLOCK_TYPES } from '../constants/coverBlocks';
import { useError } from '../context/ErrorContext';
import { ImagePickerModal } from './ImagePickerModal';
import { apiBase } from '../utils/api';

// ── Summary line per cover block type ────────────────────────────────────────
function getCoverSummary(block, formData) {
  switch (block.type) {
    case 'date':
      return `📅 Date — ${formData.date ?? '(no date set)'}`;
    case 'image': {
      const src = formData.cover?.imageSource;
      if (src === 'library') return `🖼️ Image — Library: ${formData.cover?.imageFileName ?? 'selected'}`;
      
      if (src === 'file' && formData.cover?.image?.startsWith('data:'))
        return `🖼️ Image — File: ${formData.cover?.imageFileName ?? 'uploaded'}`;

      if (formData.cover?.imageUrl) return `🖼️ Image — URL (not yet uploaded)`;
      return `🖼️ Image — (none selected)`;
    }
    case 'quote': {
      const q = block.quoteText?.trim();   // ← was formData.cover?.quote
      return q ? `💬 Quote — "${q.substring(0, 50)}${q.length > 50 ? '…' : ''}"` : `💬 Quote — (empty)`;
    }
    case 'welcome': {
      const w = block.welcomeText?.trim();
      return w ? `👋 Welcome — ${w}` : `👋 Welcome — (empty)`;
    }
    case 'custom': {
      const c = block.customText?.trim();
      return c
        ? `📄 Custom — "${c.substring(0, 50)}${c.length > 50 ? '…' : ''}"`
        : `📄 Custom Text — (empty)`;
    }
    default:
      return `📋 ${block.type}`;
  }
}

export function CoverBlockEditor({
  block, formData, setFormData, updateField,
  updateCoverBlock, removeCoverBlock,
  imageUrlLoading, setImageUrlLoading,
  lastFetchedUrlRef, wardName, isNew,
}) {
  const blockDef = COVER_BLOCK_TYPES[block.type] ?? {};
  const { showToast } = useError();
  const [showImagePicker, setShowImagePicker] = useState(false);
  const [expanded, setExpanded] = useState(isNew ?? false);
  const [urlInput, setUrlInput] = useState(formData.cover?.imageUrl ?? '');
  // ↑ local controlled input — only committed to formData on upload success

  return (
    <div className="w-full">

      {/* ── Collapsed header ──────────────────────────────────────────────── */}
      <div 
        className="flex items-center justify-between gap-2 px-2 py-1.5 cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-600/50 rounded-t-lg transition"
          onClick={() => setExpanded(e => !e)}
        >

        <span className="text-xs text-gray-600 dark:text-slate-200 truncate flex-1 min-w-0">
          {getCoverSummary(block, formData)}
        </span>
        <div className="flex items-center gap-1 shrink-0">
          
          <button
            type="button"
            onClick={e => { e.stopPropagation(); setExpanded(e => !e); }}
            className="text-xs px-1.5 py-0.5 rounded bg-gray-200 dark:bg-slate-600 hover:bg-gray-300 dark:hover:bg-slate-500 text-gray-600 dark:text-slate-300 transition shrink-0"
            title={expanded ? 'Collapse' : 'Expand to edit'}
          >
            {expanded ? '▲ Less' : '▼ Edit'}
          </button>
          
          
          <button
            onClick={e => { e.stopPropagation(); removeCoverBlock(block.id); }}
            className="btn-danger w-8 h-8 p-0 min-w-[2rem] flex items-center justify-center text-xs shrink-0"
            title="Delete"
          >🗑️</button>

        </div>
      </div>

      {/* ── Expanded editor ───────────────────────────────────────────────── */}
      {expanded && (
        <div className="px-3 pb-3 border-t border-slate-600/50 pt-2">

          {/* ── DATE ── */}
          {block.type === 'date' && (
            <div>
              <input
                type="date"
                value={formData.date ?? ''}
                onChange={e => updateField('date', e.target.value)}
                className="input w-full"
              />
              <p className="text-xs text-amber-500 mt-1">
                💡 This controls the date shown on the cover design.
              </p>
            </div>
          )}

          {/* ── IMAGE ── */}
          {block.type === 'image' && (
            <div className="flex flex-col gap-3">

              {/* Source toggle — URL or Library */}
              <div className="flex gap-3 text-xs">
                {[
                  { val: 'url',     label: '🔗 Upload from URL' },
                  { val: 'file',    label: '📁 Upload File' },
                  { val: 'library', label: '🖼️ Image Library'   },
                ].map(({ val, label }) => (
                  <label key={val} className="flex items-center gap-1 cursor-pointer">
                    <input
                      type="radio"
                      name={`imageSource-${block.id}`}
                      checked={(formData.cover.imageSource ?? 'url') === val}
                      onChange={() => {
                        lastFetchedUrlRef.current = '';
                        setUrlInput('');
                        setFormData({ ...formData, cover: {
                          ...formData.cover,
                          imageSource: val,
                          image: '', imageUrl: '',
                          imageId: null, imageFileName: null,
                        }});
                      }}
                    />
                    {label}
                  </label>
                ))}
              </div>

              {/* ── URL → Upload to Library ── */}
              {(!formData.cover.imageSource || formData.cover.imageSource === 'url') && (
                <div className="flex flex-col gap-2">
                  <p className="text-xs text-slate-400">
                    Paste an image URL — it will be fetched and saved to your image library automatically.
                  </p>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={urlInput}
                      onChange={e => setUrlInput(e.target.value)}
                      className="input flex-1 text-xs"
                      placeholder="https://example.com/image.jpg"
                      maxLength={2048}
                      disabled={imageUrlLoading}
                    />
                    <button
                      type="button"
                      disabled={!urlInput.trim() || imageUrlLoading}
                      onClick={async () => {
                        const url = urlInput.trim();

                        // Basic URL validation
                        try {
                          const parsed = new URL(url);
                          if (!['http:', 'https:'].includes(parsed.protocol)) {
                            showToast('⚠️ Only http:// and https:// URLs are allowed.', 'error');
                            return;
                          }
                        } catch {
                          showToast('⚠️ Invalid URL.', 'error');
                          return;
                        }

                        setImageUrlLoading(true);
                        try {
                          const { id, fileName } = await uploadUrlToLibrary(url);
                          // ── Success — switch to library mode with the new image
                          setFormData(prev => ({
                            ...prev,
                            cover: {
                              ...prev.cover,
                              imageSource: 'library',
                              imageId: id,
                              imageFileName: fileName,
                              image: '',      // ← clear any old base64
                              imageUrl: '',   // ← clear raw URL from DB
                            },
                          }));
                          setUrlInput('');   // ← clear the input
                          lastFetchedUrlRef.current = '';
                          showToast(`✅ Image uploaded to library: ${fileName}`);
                        } catch (err) {
                          if (err.message === 'AUTH') {
                            showToast('⚠️ Session expired — please log out and back in.', 'error');
                          } else {
                            showToast(`⚠️ Upload failed: ${err.message}`, 'error');
                          }
                        } finally {
                          setImageUrlLoading(false);
                        }
                      }}
                      className="btn-primary text-xs px-3 whitespace-nowrap
                                 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {imageUrlLoading ? '⏳ Uploading...' : '⬆️ Upload'}
                    </button>
                  </div>

                  {/* Show currently selected library image if one exists */}
                  {formData.cover.imageId && (
                    <p className="text-xs text-green-500">
                      ✅ Using library image: {formData.cover.imageFileName ?? 'selected'}
                    </p>
                  )}
                </div>
              )}

              {/* ── Local File Upload ── */}
              {formData.cover.imageSource === 'file' && (
                <div className="flex flex-col gap-2 text-xs text-slate-400">
                  <p>Choose an image file from your device (max 5MB).</p>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/gif,image/webp"
                    onChange={async (e) => {
                      const file = e.target.files[0];
                      if (!file) return;
                      if (file.size > 5 * 1024 * 1024) {
                        showToast('⚠️ Image too large. Please choose an image under 5MB.', 'error');
                        return;
                      }
                      setImageUrlLoading(true);
                      try {
                        const { id, fileName } = await uploadFileToLibrary(file);
                        // ── Success — switch to library mode with the new image
                        setFormData(prev => ({
                          ...prev,
                          cover: {
                            ...prev.cover,
                            imageSource: 'library',
                            imageId: id,
                            imageFileName: fileName,
                            image: '',
                            imageUrl: '',
                          },
                        }));
                        showToast(`✅ Image uploaded to library: ${fileName}`);
                      } catch (err) {
                        if (err.message === 'AUTH') {
                          showToast('⚠️ Session expired — please log out and back in.', 'error');
                        } else {
                          showToast(`⚠️ Upload failed: ${err.message}`, 'error');
                        }
                      } finally {
                        setImageUrlLoading(false);
                      }
                    }}
                    className="input w-full text-xs"
                    disabled={imageUrlLoading}
                  />
                  {imageUrlLoading && (
                    <p className="text-xs text-blue-400">⏳ Uploading to library...</p>
                  )}
                </div>
              )}


              {/* ── Image Library Picker ── */}
              {formData.cover.imageSource === 'library' && (
                <div>
                  <button
                    onClick={() => setShowImagePicker(true)}
                    className="btn-secondary w-full flex items-center justify-center gap-2 text-xs"
                  >
                    🖼️ {formData.cover.imageId ? 'Change Image from Library' : 'Choose from Library'}
                  </button>
                  {formData.cover.imageId && (
                    <div className="flex items-center gap-2 mt-1">
                      <p className="text-xs text-green-500 flex-1 truncate">
                        ✅ {formData.cover.imageFileName ?? 'Image selected'}
                      </p>
                      <button
                        type="button"
                        onClick={() => setFormData(prev => ({
                          ...prev,
                          cover: {
                            ...prev.cover,
                            image: '', imageUrl: '',
                            imageId: null, imageFileName: null,
                          },
                        }))}
                        className="text-red-500 hover:text-red-400 text-xs shrink-0"
                      >✕ Remove</button>
                    </div>
                  )}
                </div>
              )}

              {/* Image Picker Modal */}
              {showImagePicker && (
                <ImagePickerModal
                  onSelect={img => {
                    setFormData(prev => ({
                      ...prev,
                      cover: {
                        ...prev.cover,
                        imageSource: 'library',
                        imageId: img.id,
                        image: '', imageUrl: '',
                        imageFileName: img.fileName,
                      },
                    }));
                    setShowImagePicker(false);
                  }}
                  onClose={() => setShowImagePicker(false)}
                />
              )}

              {/* Full Bleed Toggle */}
              <label className="flex items-start gap-2 text-xs cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.cover.imageBleed ?? false}
                  onChange={e => updateField('cover.imageBleed', e.target.checked)}
                  className="mt-0.5 cursor-pointer"
                />
                <span>🖨️ Full Bleed — Fill entire cover panel edge to edge</span>
              </label>

              {/* Height Slider */}
              {!formData.cover.imageBleed && (
                <div>
                  <p className="text-xs text-slate-400 mb-1">
                    Image Height: {Math.round(formData.cover.imageHeightPct ?? 50)}%
                    (~{(((formData.cover.imageHeightPct ?? 50) / 100) * 7.9).toFixed(1)}")
                  </p>
                  <input
                    type="range" min={10} max={100} step={5}
                    value={formData.cover.imageHeightPct ?? 50}
                    onChange={e => updateField('cover.imageHeightPct', parseInt(e.target.value))}
                        className="w-full h-2 rounded-lg appearance-none cursor-pointer accent-lds-blue bg-gray-300 dark:bg-slate-400"
                      />

                  <div className="flex justify-between text-xs text-slate-500 mt-0.5">
                    <span>Small (10%)</span><span>Half (50%)</span><span>Full (100%)</span>
                  </div>
                </div>
              )}

            </div>
          )}

          {/* ── QUOTE ── */}
          {block.type === 'quote' && (
            <div className="space-y-2">
              <textarea
                value={block.quoteText ?? ''}
                onChange={e => updateCoverBlock(block.id, 'quoteText', e.target.value)}
                rows={3}
                className="input w-full text-xs"
                placeholder="Enter a scripture or quote..."
                maxLength={1000}
              />
              <input
                type="text"
                value={block.attributionText ?? ''}
                onChange={e => updateCoverBlock(block.id, 'attributionText', e.target.value)}
                className="input w-full text-xs"
                placeholder="— Attribution (e.g. - President Nelson)"
                maxLength={255}
              />
            </div>
          )}

          {/* ── WELCOME ── */}
          {block.type === 'welcome' && (
            <div>
              <input
                value={block.welcomeText ?? ''}
                onChange={e => updateCoverBlock(block.id, 'welcomeText', e.target.value)}
                className="input w-full text-xs"
                placeholder={wardName ? `Welcome to ${wardName}` : 'Welcome to Sacrament Meeting'}
                maxLength={500}
              />
              {!block.welcomeText && wardName && (
                <button
                  onClick={() => updateCoverBlock(block.id, 'welcomeText', `Welcome to ${wardName}`)}
                  className="text-xs text-lds-blue hover:underline mt-1"
                  type="button"
                >
                  ✨ Use "Welcome to {wardName}"
                </button>
              )}
              <p className="text-xs text-slate-400 mt-1">
                This will appear as a styled welcome heading on the cover.
              </p>
            </div>
          )}

          {/* ── CUSTOM TEXT ── */}
          {block.type === 'custom' && (
            <textarea
              value={block.customText ?? ''}
              onChange={e => updateCoverBlock(block.id, 'customText', e.target.value)}
              rows={4}
              className="input w-full text-xs"
              placeholder="Enter any custom text here..."
              maxLength={2000}
            />
          )}

        </div>
      )}
    </div>
  );
}