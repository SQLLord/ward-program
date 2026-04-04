import React from 'react';

export default function StatusBadge({ status }) {
  const styles = {
    draft:     { bg: 'bg-gray-100  dark:bg-slate-700',       text: 'text-gray-700  dark:text-slate-300',  border: 'border-gray-300  dark:border-slate-500', label: 'Draft'     },
    published: { bg: 'bg-green-100 dark:bg-green-900/30',    text: 'text-green-800 dark:text-green-300',  border: 'border-green-400 dark:border-green-600', label: 'Published' },
    archived:  { bg: 'bg-blue-100  dark:bg-blue-900/30',     text: 'text-blue-800  dark:text-blue-300',   border: 'border-blue-300  dark:border-blue-600',  label: 'Archived'  },
  };
  const style = styles[status] ?? styles.draft;
  return (
    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${style.bg} ${style.text} ${style.border}`}>
      {status === 'published' && '✓ '}
      {style.label}
    </span>
  );
}