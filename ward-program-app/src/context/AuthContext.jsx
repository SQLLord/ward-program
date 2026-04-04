// src/context/AuthContext.jsx
import React, {
  createContext, useContext, useState,
  useEffect, useRef, useCallback,
} from 'react';
import { api, fetchCsrfToken } from '../utils/api';
import { SESSION_DURATION, INACTIVE_TIMEOUT, WARN_BEFORE_TIMEOUT } from '../constants/authConstants';

const AuthContext = createContext();

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}

export function AuthProvider({ children }) {
  const [user, setUser]               = useState(null);
  const [loading, setLoading]         = useState(true);
  const [showWarning, setShowWarning] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(0);

  const navigateRef       = useRef(null);
  const inactivityTimer   = useRef(null);
  const warningTimer      = useRef(null);
  const warningCountdown  = useRef(null);
  const hasFetchedSession = useRef(false);

  const isBishopric = user?.role === 'bishopric';
  const isEditor    = user?.role === 'editor' || user?.role === 'bishopric';

  const registerNavigate = (fn) => { navigateRef.current = fn; };

  const autoLogout = useCallback(() => {
    clearTimeout(inactivityTimer.current);
    clearTimeout(warningTimer.current);
    clearInterval(warningCountdown.current);
    setShowWarning(false);
    setUser(null);
    // ── Fix 11: Only minimal session token stored — remove it ────────────
    localStorage.removeItem('sessionMeta');
    if (navigateRef.current) navigateRef.current('/login?expired=true');
  }, []);

  const clearAllTimers = useCallback(() => {
    clearTimeout(inactivityTimer.current);
    clearTimeout(warningTimer.current);
    clearInterval(warningCountdown.current);
  }, []);

  const startInactivityTimer = useCallback(() => {
    clearAllTimers();
    setShowWarning(false);

    warningTimer.current = setTimeout(() => {
      setShowWarning(true);
      setSecondsLeft(WARN_BEFORE_TIMEOUT / 1000);
      warningCountdown.current = setInterval(() => {
        setSecondsLeft(s => {
          if (s <= 1) { clearInterval(warningCountdown.current); return 0; }
          return s - 1;
        });
      }, 1000);
    }, INACTIVE_TIMEOUT - WARN_BEFORE_TIMEOUT);

    inactivityTimer.current = setTimeout(autoLogout, INACTIVE_TIMEOUT);
  }, [clearAllTimers, autoLogout]);
  
  const resetInactivityTimer = useCallback(() => {
    if (!user) return;
    startInactivityTimer();
  }, [user, startInactivityTimer]);

  useEffect(() => {
    if (!user) return;
    const events = ['keydown', 'touchstart'];
    events.forEach(e =>
      window.addEventListener(e, resetInactivityTimer, { passive: true })
    );
    startInactivityTimer();
    return () => {
      events.forEach(e => window.removeEventListener(e, resetInactivityTimer));
      clearAllTimers();
      setShowWarning(false);
    };
  }, [user, resetInactivityTimer, startInactivityTimer, clearAllTimers]);

  // ── Restore session on mount ──────────────────────────────────────────────
  // Fix 11: localStorage stores ONLY { expiresAt } — no PII at all.
  // We always call /auth/me to get the real user profile. This means:
  //   - No name, email, role, or any PII ever sits in localStorage
  //   - The fast path only skips the API call if the local expiry has passed
  //     (saves a network round-trip on page load when we know we're expired)
  //   - If the cookie is still valid, /auth/me returns the fresh profile
  useEffect(() => {

    if (hasFetchedSession.current) return;   // ← ADD this one line
      hasFetchedSession.current = true;         // ← ADD this one line


    const restoreSession = async () => {
      // ── Fast-fail path: if we know the session is locally expired, skip ──
      // the API call entirely — the cookie will also be expired

      await fetchCsrfToken();

      const stored = localStorage.getItem('sessionMeta');
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          if (parsed.expiresAt && Date.now() >= parsed.expiresAt) {
            // Local expiry passed — don't even bother calling /me
            localStorage.removeItem('sessionMeta');
            setUser(null);
            setLoading(false);
            return;
          }
        } catch {
          localStorage.removeItem('sessionMeta');
        }
      }

      // ── Always verify with server — cookie is the source of truth ────────
      // No PII is read from localStorage; /me returns the fresh profile
      try {
        const data = await api.get('/auth/me');
        setUser(data);   // ← full profile comes from server, not localStorage
      } catch {
        // Cookie invalid or expired — stay logged out
        localStorage.removeItem('sessionMeta');
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    restoreSession();
  }, []);

  // ── LOGIN ─────────────────────────────────────────────────────────────────
  const login = async (email, password) => {
    const data = await api.post('/auth/login', { email, password });

    // ── Fix 11: Store ONLY expiry in localStorage — NO PII ───────────────
    // The full user object lives in React state only (memory)
    // If the page reloads, /auth/me fetches fresh data from the server
    
    await fetchCsrfToken();

    const sessionMeta = {
      expiresAt: Date.now() + SESSION_DURATION,
    };
    localStorage.setItem('sessionMeta', JSON.stringify(sessionMeta));

    // ── Set full user profile in React state from login response ──────────
    setUser(data.user);
    return data.user;
  };

  // ── LOGOUT ────────────────────────────────────────────────────────────────
  const logout = async () => {
    clearAllTimers();
    setShowWarning(false);
    try {
      await api.post('/auth/logout', {});
    } catch { /* ignore — cookie cleared server-side regardless */ }
    setUser(null);
    // ── Fix 11: Remove the minimal session marker ─────────────────────────
    localStorage.removeItem('sessionMeta');
  };

  const isAuthenticated = () => {
    if (!user) return false;
    // ── Check local expiry as a fast-fail — cookie is the real authority ──
    const stored = localStorage.getItem('sessionMeta');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (parsed.expiresAt && Date.now() >= parsed.expiresAt) {
          autoLogout();
          return false;
        }
      } catch {
        autoLogout();
        return false;
      }
    }
    return true;
  };

  const extendSession = () => {
    startInactivityTimer();
    setShowWarning(false);
  };

  const formatCountdown = (secs) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  };

  const changePassword = async (currentPassword, newPassword) => {
    await api.post('/auth/change-password', { currentPassword, newPassword });
  };

  return (
    <AuthContext.Provider value={{
      user, login, logout, isAuthenticated,
      loading, registerNavigate, extendSession,
      isBishopric, isEditor, changePassword,
    }}>
      {children}

      {showWarning && (
        <div className="fixed bottom-0 left-0 right-0 z-50 flex justify-center px-4 pb-4">
          <div className="bg-amber-50 border-2 border-amber-400 rounded-xl shadow-2xl
                          px-6 py-4 w-full max-w-md flex items-start gap-4">
            <div className="text-3xl mt-0.5">⏰</div>
            <div className="flex-1">
              <p className="font-bold text-amber-800 text-sm">Session Expiring Soon</p>
              <p className="text-amber-700 text-xs mt-1">
                You've been inactive for a while. You'll be automatically
                logged out in{' '}
                <span className="font-bold text-amber-900 tabular-nums">
                  {formatCountdown(secondsLeft)}
                </span>.
              </p>
              <div className="flex gap-2 mt-3">
                <button
                  onClick={extendSession}
                  className="bg-amber-500 hover:bg-amber-600 text-white
                             text-xs font-bold px-4 py-1.5 rounded-lg transition">
                  ✅ Keep Me Logged In
                </button>
                <button
                  onClick={autoLogout}
                  className="bg-gray-200 hover:bg-gray-300 text-gray-700
                             text-xs font-bold px-4 py-1.5 rounded-lg transition">
                  🚪 Log Out Now
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </AuthContext.Provider>
  );
}