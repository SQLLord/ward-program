// HymnLink.jsx
import React from 'react';
import { getHymnUrl } from '../data/hymns';

function HymnLink({ number, title }) {
  if (!number || !title) return null;
  const url = getHymnUrl(number);
  if (!url) return null;

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      title={`Open "${title}" in Gospel Library`}
      className="inline-flex w-fit items-center gap-1.5 px-3 py-1.5 rounded-full
        text-xs font-semibold
        bg-blue-100 text-blue-700
        dark:bg-blue-500 dark:text-white
        hover:bg-blue-200 dark:hover:bg-blue-400
        active:scale-95 transition-all"
    >
      🎵 Hymn Link
    </a>
  );
}

export default HymnLink;