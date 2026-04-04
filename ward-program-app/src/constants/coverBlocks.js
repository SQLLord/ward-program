// src/constants/coverBlocks.js
// Shared constants for the Program Cover builder.
// Used by ProgramBuilder, CoverBlockEditor, and CoverPreviewBlock.

/**
 * Defines the available cover block types, their display labels,
 * emoji icons, and Tailwind badge color classes.
 */
export const COVER_BLOCK_TYPES = {
  date:    { label: 'Date',        icon: '📅', color: 'bg-blue-100   dark:bg-blue-900/30   text-blue-800   dark:text-blue-300'   },
  image:   { label: 'Image',       icon: '🖼️', color: 'bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300' },
  quote:   { label: 'Quote',       icon: '💬', color: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300' },
  welcome: { label: 'Welcome',     icon: '👋', color: 'bg-green-100  dark:bg-green-900/30  text-green-800  dark:text-green-300'  },
  custom:  { label: 'Custom Text', icon: '📝', color: 'bg-gray-100   dark:bg-slate-700     text-gray-800   dark:text-slate-200'  },
};

/**
 * Ordered list of steps in the Program Builder wizard.
 * num must match the step index used in ProgramBuilder's setStep() calls.
 */
export const BUILDER_STEPS = [
  { num: 1, name: 'Cover',         icon: '🖼️' },
  { num: 2, name: 'Announcements', icon: '📢' },
  { num: 3, name: 'Meeting Order',       icon: '📋' },
  { num: 4, name: 'Leadership',    icon: '👥' },
  { num: 5, name: 'Preview',       icon: '👁️' },
];