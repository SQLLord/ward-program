// routes/proxy.js
const express = require('express');
const { verifyToken } = require('../middleware/auth');
const router = express.Router();

// ── Fix 5: Private/internal IP ranges to block (SSRF prevention) ─────────────
const BLOCKED_HOSTS = [
  /^localhost$/i,
  /^127\./,
  /^10\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^192\.168\./,
  /^169\.254\./,   // Azure IMDS — critical to block
  /^::1$/,
  /^fc00:/i,
  /^0\./,
];

// ── GET /api/proxy/image?url=https://example.com/image.jpg ───────────────────
router.get('/image', verifyToken, async (req, res) => {
  const { url } = req.query;

  if (!url) {
    return res.status(400).json({ error: 'url query parameter is required.' });
  }

  // ── Validate protocol
  let parsed;
  try {
    parsed = new URL(url);
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return res.status(400).json({ error: 'Only http and https URLs are allowed.' });
    }
  } catch {
    return res.status(400).json({ error: 'Invalid URL.' });
  }

  // ── Fix 5: Block private/internal IP ranges ───────────────────────────────
  const { hostname } = parsed;
  if (BLOCKED_HOSTS.some(pattern => pattern.test(hostname))) {
    console.warn(`[Proxy] Blocked SSRF attempt for host: ${hostname}`);
    return res.status(400).json({ error: 'Private or internal URLs are not allowed.' });
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; WardProgramsApp/1.0)',
      },
    });
    clearTimeout(timeout);

    if (!response.ok) {
      return res.status(502).json({ error: `Remote server returned ${response.status}` });
    }

    const contentType = response.headers.get('content-type') ?? '';
    if (!contentType.startsWith('image/')) {
      return res.status(422).json({ error: `Remote URL is not an image (${contentType})` });
    }

    res.set('Content-Type', contentType);
    res.set('Cache-Control', 'public, max-age=86400');
    
    const contentLength = parseInt(response.headers.get('content-length') ?? '0', 10);
    const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // 10 MB
    if (contentLength > MAX_IMAGE_BYTES) {
      return res.status(413).json({ error: 'Remote image exceeds the 10 MB size limit.' });
    }

    const buffer = await response.arrayBuffer();

    
    // Secondary size guard — catches servers that lied about or omitted content-length
    if (buffer.byteLength > MAX_IMAGE_BYTES) {
      return res.status(413).json({ error: 'Remote image exceeds the 10 MB size limit.' });
    }


    return res.send(Buffer.from(buffer));


  } catch (err) {
    if (err.name === 'AbortError') {
      return res.status(504).json({ error: 'Request timed out.' });
    }
    console.error('[Proxy] Image fetch error:', err);
    return res.status(502).json({ error: 'Failed to fetch remote image.' });
  }
});

module.exports = router;