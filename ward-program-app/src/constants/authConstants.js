// src/constants/authConstants.js
// Session and inactivity timeout constants shared across AuthContext.
// Defined here (outside the component) so they are stable references
// and do not cause useCallback/useEffect dependency churn.

/** Total session lifetime: 24 hours */
export const SESSION_DURATION = 24 * 60 * 60 * 1000;

/** Idle time before auto-logout is triggered: 30 minutes */
export const INACTIVE_TIMEOUT = 30 * 60 * 1000;

/** How far before auto-logout to show the warning banner: 5 minutes */
export const WARN_BEFORE_TIMEOUT = 5 * 60 * 1000;