// server.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { rateLimit, ipKeyGenerator  } = require('express-rate-limit');  // ← destructure both
const cookieParser = require('cookie-parser');
const { connectDb } = require('./db');
const authRoutes    = require('./routes/auth');
const userRoutes    = require('./routes/users');
const programRoutes = require('./routes/programs');
const wardRoutes    = require('./routes/ward');
const proxyRouter   = require('./routes/proxy');
const imageRouter = require('./routes/images');
const { doubleCsrf } = require('csrf-csrf');
const announcementsRouter = require('./routes/announcements')
const contactRouter = require('./routes/contact');
const templatesRouter = require('./routes/templates');

const app  = express();
app.set('trust proxy', 1);

// ── Strip port from IP for rate limiter key (Azure passes IP:port) ──────────


const getClientIp = (req) => {
  const raw = req.headers['x-forwarded-for']?.split(',')[0]?.trim()
           ?? req.ip
           ?? 'unknown';
  const cleaned = raw.replace(/^::ffff:/, '').replace(/:\d+$/, '');
  return ipKeyGenerator(req, cleaned);  // ← pass req AND cleaned IP
};

const PORT = process.env.PORT ?? 3001;

// ── Fix 4: Validate critical env vars at startup ──────────────────────────────
const REQUIRED_ENV = ['JWT_SECRET', 'DB_SERVER', 'DB_NAME'];
const missingEnv = REQUIRED_ENV.filter(k => !process.env[k]);
if (missingEnv.length > 0) {
  console.error(`[Server] ❌ Missing required environment variables: ${missingEnv.join(', ')}`);
  process.exit(1);
}
if (process.env.JWT_SECRET.length < 32) {
  console.error('[Server] ❌ JWT_SECRET is too short — minimum 32 characters required.');
  process.exit(1);
}

// ── CORS origins — defined early so helmet CSP can reuse them ────────────────
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim()).filter(Boolean)
  : [];

if (ALLOWED_ORIGINS.length === 0 && process.env.NODE_ENV === 'production') {
  console.warn('[Server] ⚠️  ALLOWED_ORIGINS is not set — all cross-origin requests will be blocked.');
}

// ── Fix 14: Security Headers with Content Security Policy ────────────────────
const cspConnectSrc = ["'self'", ...ALLOWED_ORIGINS];

app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  contentSecurityPolicy: {
    directives: {
      defaultSrc:  ["'self'"],
      scriptSrc:   ["'self'"],
      styleSrc:    ["'self'", "'unsafe-inline'"],
      imgSrc:      ["'self'", "data:", "https:"],
      connectSrc:  cspConnectSrc,
      fontSrc:     ["'self'"],
      objectSrc:   ["'none'"],
      frameSrc:    ["'none'"],
      upgradeInsecureRequests: [],
    },
  },
}));


// ── Rate Limiters ────────────────────────────────────────────────────────────

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  keyGenerator: getClientIp,          // ← ADD
  message: { error: 'Too many attempts. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const wardUnlockLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  keyGenerator: getClientIp,          // ← ADD
  message: { error: 'Too many unlock attempts. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  keyGenerator: getClientIp,          // ← ADD
  message: { error: 'Too many requests. Please slow down.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// ── Request Logger ────────────────────────────────────────────────────────────
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const ms = Date.now() - start;
    console.log(`${req.method} ${req.path} ${res.statusCode} (${ms}ms)`);
  });
  next();
});

// ── Fix 19: HTTPS redirect in production ─────────────────────────────────────
app.use((req, res, next) => {
  if (
    process.env.NODE_ENV === 'production' &&
    req.headers['x-forwarded-proto'] !== 'https'
  ) {
    return res.redirect(301, `https://${req.headers.host}${req.url}`);
  }
  next();
});

// ── CORS ──────────────────────────────────────────────────────────────────────

app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    const isLocalhost = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
    const isLocalNetwork = process.env.NODE_ENV !== 'production' &&
      /^http:\/\/(192\.168\.|172\.(1[6-9]|2\d|3[01])\.|10\.)\d+\.\d+(:\d+)?$/.test(origin);
    if (ALLOWED_ORIGINS.includes(origin) || isLocalhost || isLocalNetwork) {
      return callback(null, true);
    }
    console.warn(`[CORS] Blocked origin: ${origin}`);
    callback(new Error(`CORS blocked: ${origin}`));
  },
  credentials: true,
}));

// ── Body parsing ──────────────────────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(cookieParser());


// ── Fix 1: CSRF Protection (Double Submit Cookie pattern) ──────────────────

const { generateCsrfToken, doubleCsrfProtection } = doubleCsrf({
  getSecret: () => process.env.JWT_SECRET,
  // ── v4.x requires getSessionIdentifier — use the auth cookie as the
  // per-session identifier (unique per user session, stable per request)
  getSessionIdentifier: (req) => req.cookies?.authToken ?? '',
  getCsrfTokenFromRequest: (req) => req.headers['x-csrf-token'],  // ← v4.x renamed
  cookieName: 'x-csrf-token',
  cookieConfig: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    path: '/',
  },
  size: 32,                                        // ← v4.x default is 32
  ignoredMethods: ['GET', 'HEAD', 'OPTIONS'],
});

// ── CSRF token endpoint — frontend calls this on app load ──────────────────
app.get('/api/auth/csrf-token', (req, res) => {
  res.json({ csrfToken: generateCsrfToken(req, res, { overwrite: true }) }); // ← v4.x syntax
});

// ── Apply CSRF protection to all mutating routes ────────────────────────────
const EXEMPT = ['/api/auth/login', '/api/auth/ward-unlock', '/api/announcements/request', '/api/contact/request',];


app.use((req, res, next) => {
  // ← Skip CSRF in local dev — CORS already blocks cross-origin requests
  if (process.env.NODE_ENV !== 'production') return next();
  if (EXEMPT.includes(req.path)) return next();
  return doubleCsrfProtection(req, res, next);
});




// ── Fix 16: Content-Type enforcement on mutating requests ─────────────────────
app.use((req, res, next) => {
  if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
    const ct = req.headers['content-type'] ?? '';
    // ← Exclude image upload route — it uses multipart/form-data not JSON
    if (req.path.startsWith('/api/images')) return next();
    if (!ct.includes('application/json')) {
      return res.status(415).json({ error: 'Content-Type must be application/json.' });
    }
  }
  next();
});

// ── Rate limiters applied to routes ──────────────────────────────────────────
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/ward-unlock', wardUnlockLimiter);
app.use('/api', generalLimiter);


// ── Health check ──────────────────────────────────────────────────────────────
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ── Routes ────────────────────────────────────────────────────────────────────
app.use('/api/auth',     authRoutes);
app.use('/api/users',    userRoutes);
app.use('/api/programs', programRoutes);
app.use('/api/ward',     wardRoutes);
app.use('/api/proxy',    proxyRouter);
app.use('/api/images',  imageRouter);
app.use('/api/announcements', announcementsRouter);
app.use('/api/contact', contactRouter);
app.use('/api/templates', templatesRouter);

// ── Global error handler ──────────────────────────────────────────────────────
app.use((err, _req, res, _next) => {
  // ── Multer errors (file size, file type) — return 400 not 500 ────────────
  const isDev = process.env.NODE_ENV !== 'production';
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ error: 'Image too large. Maximum size is 5MB.' });
  }
  if (err.message?.includes('Only JPEG')) {
    return res.status(400).json({ error: err.message });
  }
  console.error('[Server Error]', err);
  res.status(err.status ?? 500).json({
    error: isDev ? (err.message ?? 'Internal server error') : 'Internal server error',
  });
});
// ── Start ─────────────────────────────────────────────────────────────────────
connectDb().then(() => {
  app.listen(PORT, () => {
    console.log(`Ward Program API running on port ${PORT}`);
  });
}).catch((err) => {
  console.error('Failed to connect to database:', err);
  process.exit(1);
});