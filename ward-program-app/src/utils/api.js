

// src/utils/api.js

  import { logger } from './logger';
const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3001/api';

// ── CSRF token — fetched once on app load, attached to all mutating requests ──
let csrfToken = null;

export const fetchCsrfToken = async () => {
  try {
    const res = await fetch(`${BASE_URL}/auth/csrf-token`, {
      credentials: 'include',
    });
    if (res.ok) {
      const data = await res.json();
      csrfToken = data.csrfToken;
    }
  } catch (err) {
    
  logger.warn('[CSRF] Could not fetch CSRF token:', err.message);

  }
};

export const getCsrfToken = () => csrfToken;

async function request(path, options = {}) {
  const isMutating = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(
    (options.method ?? 'GET').toUpperCase()
  );

  const headers = {
    'Content-Type': 'application/json',
    ...(isMutating && csrfToken ? { 'x-csrf-token': csrfToken } : {}),
    ...(options.headers ?? {}),
  };

  const response = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers,
    credentials: 'include',
  });

  // ── CSRF token expired or rotated — refresh and retry once ──────────────
  if (response.status === 403 && !options._csrfRetried) {
    await fetchCsrfToken();
    return request(path, { ...options, _csrfRetried: true });
  }

  let data;
  const ct = response.headers.get('content-type') ?? '';
  if (ct.includes('application/json')) {
    data = await response.json();
  } else {
    data = await response.text();
  }

  if (!response.ok) {
    const message =
      (typeof data === 'object' && data?.error) ??
      `API error ${response.status}: ${response.statusText}`;
    const err = new Error(message);
    err.status = response.status;
    err.data = data;
    throw err;
  }

  return data;
}

export const api = {
  get:    (path)        => request(path, { method: 'GET' }),
  post:   (path, body)  => request(path, { method: 'POST',   body: JSON.stringify(body) }),
  put:    (path, body)  => request(path, { method: 'PUT',    body: JSON.stringify(body) }),
  patch:  (path, body)  => request(path, { method: 'PATCH',  body: JSON.stringify(body) }),
  delete: (path)        => request(path, { method: 'DELETE' }),
};

export const apiBase = BASE_URL.replace(/\/api$/, '');