// src/hooks/useWardUnlock.js
import { useState, useEffect, useCallback } from 'react';
import { api } from '../utils/api';

const STORAGE_KEY  = 'ward_view_unlocked';
const SESSION_MINS = 90;
const SESSION_MS   = SESSION_MINS * 60 * 1000;

function getStoredSession() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (Date.now() >= parsed.expiresAt) {
      sessionStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function useWardUnlock() {
  const [isUnlocked, setIsUnlocked]   = useState(() => !!getStoredSession());
  const [expiresAt, setExpiresAt]     = useState(() => getStoredSession()?.expiresAt ?? null);
  const [minutesLeft, setMinutesLeft] = useState(0);

  // ── Fix 12: Track whether the ward has no password set ───────────────────
  // noPasswordSet=true means the server has no password configured — content
  // is publicly accessible. ProgramHome uses this to show an admin warning.
  const [noPasswordSet, setNoPasswordSet] = useState(false);

  // ── Auto-lock when session expires ───────────────────────────────────────
  useEffect(() => {
    if (!isUnlocked || !expiresAt) return;

    const remaining = expiresAt - Date.now();
    if (remaining <= 0) { lock(); return; }

    const updateCountdown = () => {
      const mins = Math.ceil((expiresAt - Date.now()) / 60000);
      setMinutesLeft(Math.max(mins, 0));
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 60000);
    const timeout  = setTimeout(() => { lock(); }, remaining);

    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [isUnlocked, expiresAt]);

  // ── Unlock — validates password against API ──────────────────────────────
  const unlock = useCallback(async (password) => {
    const data = await api.post('/auth/ward-unlock', { password });

    if (data.success) {
      // ── Fix 12: If no password is set, mark it but still allow viewing ───
      // The noPasswordSet flag lets ProgramHome show an admin warning banner
      if (data.noPasswordSet) {
        setNoPasswordSet(true);
        // Still unlock the UI so members can view — but don't start a timed
        // session since there's no real auth happening
        setIsUnlocked(true);
        setExpiresAt(null);   // ← no expiry — open until page reload
        return true;
      }

      // ── Normal unlock — password validated ───────────────────────────────
      setNoPasswordSet(false);
      const exp = Date.now() + SESSION_MS;
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ expiresAt: exp }));
      setIsUnlocked(true);
      setExpiresAt(exp);
      return true;
    }

    return false;
  }, []);

  // ── Lock — clears session ─────────────────────────────────────────────────
  const lock = useCallback(() => {
    sessionStorage.removeItem(STORAGE_KEY);
    setIsUnlocked(false);
    setExpiresAt(null);
    setMinutesLeft(0);
    // Note: intentionally don't reset noPasswordSet here — it's a server
    // config state, not a session state
  }, []);

  // ── Invalidate — called when password changes ─────────────────────────────
  const invalidateSession = useCallback(() => {
    lock();
  }, [lock]);

  return { isUnlocked, unlock, lock, invalidateSession, minutesLeft, noPasswordSet };
}