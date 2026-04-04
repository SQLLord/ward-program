// src/components/CoverPreviewBlock.jsx
import React from 'react';
import {
  resolveImgHeight, COVER_PANEL_WIDTH_IN, COVER_PANEL_HEIGHT_IN
} from '../utils/coverImageUtils';
import { apiBase } from '../utils/api';




// sizes prop comes from getResolvedSizes() in StepPreviewPanel
export function CoverPreviewBlock({ block, formData, sizes }) {


  switch (block.type) {

    case 'date':

      const formattedDate = new Date(formData.date + 'T00:00:00').toLocaleDateString('en-US', {
            month: 'long', day: 'numeric', year: 'numeric',
          });
      return (
        <h3
          style={{ fontSize: sizes ? `${sizes.titlePt}pt` : undefined }}
          className="font-bold text-lds-blue dark:text-slate-100 mb-2 text-center"
        >
          {formattedDate || '(No date set)'}
        </h3>
      );

    case 'image': {
      const bleed      = formData.cover.imageBleed ?? false;

      const rawUrl = formData.cover.imageUrl ?? formData.cover.image ?? '';
      const isSafeUrl = rawUrl.startsWith('https://') || rawUrl.startsWith('data:');
      const displaySrc = formData.cover.image?.startsWith('data:')
        ? formData.cover.image
        : formData.cover.imageSource === 'library' && formData.cover.imageId
          ? `${apiBase}/api/images/${formData.cover.imageId}/serve`
          : isSafeUrl ? rawUrl : '';


      if (!displaySrc) {
        return (
          <div className="flex items-center justify-center bg-gray-100
                          dark:bg-slate-700 rounded text-gray-400
                          dark:text-slate-500 text-sm py-8 mb-2">
            🖼️ No image set
          </div>
        );
      }

      if (bleed) {
        return (
          <div
            className="w-full overflow-hidden rounded mb-2 relative"
            style={{
              paddingBottom: `${(COVER_PANEL_HEIGHT_IN / COVER_PANEL_WIDTH_IN) * 100}%`,
            }}
          >
            <span className="absolute top-1 left-1 text-xs bg-black/40
                             text-white px-1 rounded z-10">
              Full Bleed
            </span>
            <img
              src={displaySrc}
              alt="Cover"
              className="absolute inset-0 w-full h-full object-cover"
              onError={e => { e.target.style.display = 'none'; }}
            />
          </div>
        );
      }

      // Normal mode — object-fit: cover so wide images crop, never squish
      const imgHeightIn  = resolveImgHeight(formData.cover);
      const aspectRatio  = imgHeightIn / COVER_PANEL_WIDTH_IN;
      const maxRatio     = COVER_PANEL_HEIGHT_IN / COVER_PANEL_WIDTH_IN;
      const clampedRatio = Math.min(aspectRatio, maxRatio);

      return (
        <div
          className="w-full relative overflow-hidden rounded mb-2"
          style={{ paddingBottom: `${clampedRatio * 100}%` }}
        >
          <img
            src={displaySrc}
            alt="Cover"
            className="absolute inset-0 w-full h-full object-cover" // ← object-cover = crop not squish
            onError={e => { e.target.style.display = 'none'; }}
          />
        </div>
      );
    }

    case 'quote':
      return (
        <blockquote
          style={{ fontSize: sizes ? `${sizes.bodyPt}pt` : undefined }}
          className="italic text-gray-700 dark:text-slate-300 text-center px-4 mb-3"
        >
          "{block.quoteText || '(No quote)'}"
          {block.attributionText && (
            <footer
              style={{ fontSize: sizes ? `${sizes.subPt}pt` : undefined }}
              className="text-gray-500 dark:text-slate-400 mt-1 font-semibold not-italic"
            >
              — {block.attributionText}
            </footer>
          )}
        </blockquote>
      );

    case 'welcome':
      return (
        <div className="my-3 px-4">
          <div className="border-t-2 border-lds-blue mb-2" />
          <p
            style={{ fontSize: sizes ? `${sizes.headingPt + 2}pt` : undefined }}
            className="font-bold text-lds-blue dark:text-slate-100 text-center"
          >
            {block.welcomeText || 'Welcome to Sacrament Meeting'}
          </p>
          <div className="border-b-2 border-lds-blue mt-2" />
        </div>
      );

    case 'custom':
      return (
        <p
          style={{ fontSize: sizes ? `${sizes.bodyPt}pt` : undefined }}
          className="text-gray-600 dark:text-slate-400 px-4 mb-2 text-center"
        >
          {block.customText || '(No custom text)'}
        </p>
      );

    default: return null;
  }
}