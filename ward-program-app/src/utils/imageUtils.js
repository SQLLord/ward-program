// src/utils/imageUtils.js
import { apiBase } from './api';
import { logger } from './logger';

/**
 * Fetches a remote image via the API proxy and returns it as a base64 data URL.
 * Used as a fallback/utility — prefer uploadUrlToLibrary for new flows.
 */

// ── Blocked internal/private address patterns (SSRF protection) ────────────
const BLOCKED_HOSTNAMES = [
  'localhost',
  '127.',
  '0.0.0.0',
  '169.254.',   // AWS/Azure metadata service
  '10.',        // RFC1918 private
  '172.16.',    // RFC1918 private
  '192.168.',   // RFC1918 private
  '::1',        // IPv6 loopback
];

export const fetchUrlAsBase64 = async (url) => {
  if (!url || url.startsWith('data:')) return url;

  // ── SSRF pre-check — block internal/private addresses ───────────────────
  try {
    const parsed = new URL(url);
    if (!['http:', 'https:'].includes(parsed.protocol)) return null;
    if (BLOCKED_HOSTNAMES.some(b => parsed.hostname.startsWith(b))) {
      logger.warn('[ImageFetch] ⛔ Blocked internal address:', parsed.hostname);
      return null;
    }
  } catch {
    return null; // malformed URL — reject silently
  }

  const blobToBase64 = (blob) => new Promise((res, rej) => {
    if (!blob.type.startsWith('image/')) {
      rej(new Error(`Not an image: ${blob.type}`));
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => res(reader.result);
    reader.onerror = rej;
    reader.readAsDataURL(blob);
  });

  // ── Attempt 0: Own API proxy ───────────────────────────────────────────────
  try {
    const proxyUrl = `${apiBase}/api/proxy/image?url=${encodeURIComponent(url)}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    const res = await fetch(proxyUrl, { signal: controller.signal, credentials: 'include' });
    clearTimeout(timeout);
    if (res.status === 401 || res.status === 403) throw new Error('AUTH');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const base64 = await blobToBase64(await res.blob());
    return base64;
  } catch (e) {
    if (e.message === 'AUTH') {
      logger.warn('[ImageFetch] 🔒 Auth error — session may have expired');
      return null;
    }
    logger.warn('[ImageFetch] ❌ API proxy failed:', e.message);
  }
  logger.error('[ImageFetch] 💥 All attempts failed for:', url);
  return null;
};

/**
 * Fetches a remote image via the API proxy and uploads it to the image library.
 * Returns { id, fileName } on success, or throws on failure.
 *
 * This replaces the old "cache as base64" flow — images are stored in Azure
 * Blob Storage and referenced by ID, keeping base64 data out of the database.
 */

export const uploadUrlToLibrary = async (url) => {
  if (!url) throw new Error('No URL provided');

  // ── SSRF pre-check ───────────────────────────────────────────────────────
  try {
    const parsed = new URL(url);
    if (!['http:', 'https:'].includes(parsed.protocol))
      throw new Error('Only http:// and https:// URLs are allowed.');
    if (BLOCKED_HOSTNAMES.some(b => parsed.hostname.startsWith(b)))
      throw new Error('URL points to a blocked internal address.');
  } catch (e) {
    throw new Error(e.message ?? 'Invalid URL.');
  }


  // ── Step 1: Fetch image bytes via proxy ──────────────────────────────────
  const proxyUrl = `${apiBase}/api/proxy/image?url=${encodeURIComponent(url)}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  let blob;
  try {
    const res = await fetch(proxyUrl, { signal: controller.signal, credentials: 'include' });
    clearTimeout(timeout);
    if (res.status === 401 || res.status === 403) throw new Error('AUTH');
    if (!res.ok) throw new Error(`Proxy returned HTTP ${res.status}`);
    blob = await res.blob();
    if (!blob.type.startsWith('image/')) throw new Error(`Not an image: ${blob.type}`);
  } catch (e) {
    clearTimeout(timeout);
    throw e; // re-throw so caller can handle AUTH vs other errors
  }

  // ── Step 2: Derive a filename from the URL ───────────────────────────────
  // e.g. https://example.com/path/photo.jpg?v=1 → photo.jpg
  // Fall back to a generated name if the URL has no recognizable filename
  let fileName;
  try {
    const pathname = new URL(url).pathname;
    const raw = pathname.split('/').pop() || '';
    // Strip query params that might have slipped in, keep extension
    const clean = raw.split('?')[0].replace(/[^a-zA-Z0-9._-]/g, '_');
    fileName = clean && clean.includes('.') ? clean : `url-import-${Date.now()}.jpg`;
  } catch {
    fileName = `url-import-${Date.now()}.jpg`;
  }

  // ── Step 3: Upload to image library via /api/images/upload ──────────────
  const file = new File([blob], fileName, { type: blob.type });
  const formData = new FormData();
  formData.append('image', file);
  const uploadController = new AbortController();
  const uploadTimeout = setTimeout(() => uploadController.abort(), 30000); // 30s

  const uploadRes = await fetch(`${apiBase}/api/images`, {
    method: 'POST',
    credentials: 'include',
    signal: uploadController.signal,  // ← ADDED for upload timeout
    body: formData,
    // ← No Content-Type header — browser sets multipart boundary automatically
  });

  clearTimeout(uploadTimeout);

  if (uploadRes.status === 401 || uploadRes.status === 403) throw new Error('AUTH');
  if (!uploadRes.ok) {
    const text = await uploadRes.text().catch(() => '');
    throw new Error(`Upload failed: HTTP ${uploadRes.status} ${text}`);
  }

  const result = await uploadRes.json();
  // API returns { id, fileName, ... } — same shape as ImagePickerModal selection
  if (!result?.id) throw new Error('Upload succeeded but no image ID returned');


 
  return { id: result.id, fileName: result.fileName ?? fileName };
};


/**
 * Uploads a local File object to the image library.
 * Returns { id, fileName } on success, or throws on failure.
 * Mirrors uploadUrlToLibrary but skips the proxy fetch step.
 */


const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const MAX_IMAGE_SIZE_MB = 5;


export const uploadFileToLibrary = async (file) => {
  if (!file) throw new Error('No file provided');

  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    throw new Error(
      `Unsupported file type: ${file.type}. Only JPEG, PNG, GIF, and WebP are allowed.`
    );
  }
  if (file.size > MAX_IMAGE_SIZE_MB * 1024 * 1024) {
    throw new Error(`File exceeds the ${MAX_IMAGE_SIZE_MB}MB size limit.`);
  }

  const formData = new FormData();
  formData.append('image', file);

  const uploadController = new AbortController();
  const uploadTimeout = setTimeout(() => uploadController.abort(), 30000);

  const uploadRes = await fetch(`${apiBase}/api/images`, {
    method: 'POST',
    credentials: 'include',
    signal: uploadController.signal,
    body: formData,
  });

  clearTimeout(uploadTimeout);

  if (uploadRes.status === 401 || uploadRes.status === 403) throw new Error('AUTH');
  if (!uploadRes.ok) {
    const text = await uploadRes.text().catch(() => '');
    throw new Error(`Upload failed: HTTP ${uploadRes.status} ${text}`);
  }

  const result = await uploadRes.json();
  if (!result?.id) throw new Error('Upload succeeded but no image ID returned');
  return { id: result.id, fileName: result.fileName ?? file.name };
};
