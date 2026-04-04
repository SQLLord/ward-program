// ChildrensHymnLink.jsx
import React from 'react';
import { getChildrensHymnUrl } from '../data/childrensHymns';

function ChildrensHymnLink({ number, title }) {
  if (!number || !title) return null;

  const url = getChildrensHymnUrl(number);
  if (!url) return null;

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      title={`Open "${title}" in Gospel Library`}
      className="inline-flex w-fit items-center gap-1.5 px-3 py-1.5 rounded-full
        text-xs font-semibold
        bg-green-100 text-green-700
        dark:bg-green-600 dark:text-white
        hover:bg-green-200 dark:hover:bg-green-500
        active:scale-95 transition-all"
    >
      🎶 Children's Song Link
    </a>
  );
}

export default ChildrensHymnLink;