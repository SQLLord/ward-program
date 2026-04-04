require('dotenv').config();
const sql  = require('mssql');

// ── SSL / TLS configuration driven by DB_SSL_MODE env var ────────────────────
//
//  azure    → encrypt=true,  trustServerCertificate=false
//             Use this for Azure SQL Database (production + dev pointing to Azure)
//
//  localdev → encrypt=true,  trustServerCertificate=true
//             Use this when connecting to a local SQL Server that has a
//             self-signed certificate (most common local dev scenario)
//
//  trust    → encrypt=false, trustServerCertificate=true
//             Use this for a local SQL Server with no SSL at all
//
// db.js

// Only imported when needed — avoids errors if not installed in local dev


// ── SSL profiles ──────────────────────────────────────────────────────────────
const SSL_PROFILES = {
  azure: {
    encrypt: true,
    trustServerCertificate: false,
  },
  localdev: {
    encrypt: true,
    trustServerCertificate: true,
  },
  trust: {
    encrypt: false,
    trustServerCertificate: true,
  },
};
const isDev = process.env.NODE_ENV !== 'production';
const sslMode    = process.env.DB_SSL_MODE ?? 'azure';
const sslOptions = SSL_PROFILES[sslMode] ?? SSL_PROFILES.azure;
if (isDev) console.log(`[DB] SSL mode: ${sslMode} → encrypt=${sslOptions.encrypt}, trustServerCertificate=${sslOptions.trustServerCertificate}`);

// ── Auth mode ─────────────────────────────────────────────────────────────────
// DB_AUTH_MODE=managed  → Azure System Assigned Managed Identity (production)
// DB_AUTH_MODE=sql      → SQL username + password (local dev, default)
const authMode = process.env.DB_AUTH_MODE ?? 'sql';
if (isDev) console.log(`[DB] Auth mode: ${authMode}`);

// ── Validate required env vars ────────────────────────────────────────────────
const REQUIRED_ALWAYS = ['DB_SERVER', 'DB_NAME'];
const REQUIRED_SQL    = ['DB_USER', 'DB_PASSWORD'];

const missingAlways = REQUIRED_ALWAYS.filter(k => !process.env[k]);
if (missingAlways.length > 0) {
  console.error(`[DB] ❌ Missing required environment variables: ${missingAlways.join(', ')}`);
  process.exit(1);
}

if (authMode === 'sql') {
  const missingSql = REQUIRED_SQL.filter(k => !process.env[k]);
  if (missingSql.length > 0) {
    console.error(`[DB] ❌ Missing SQL auth variables: ${missingSql.join(', ')}`);
    console.error('[DB] Make sure your .env file exists and is in the ward-program-api/ folder.');
    process.exit(1);
  }
}

// ── Build config ──────────────────────────────────────────────────────────────
function buildConfig() {                          // ← remove the accessToken parameter
  const base = {
    server: process.env.DB_SERVER,
    database: process.env.DB_NAME,
    port: parseInt(process.env.DB_PORT ?? '1433'),
    options: {
      ...sslOptions,
      enableArithAbort: true,
      connectTimeout: 30000,
      requestTimeout: 30000,
    },
    pool: {
      max: 10,
      min: 0,
      idleTimeoutMillis: 30000,
    },
  };

  if (authMode === 'managed') {
    // ── M6: Use azure-active-directory-default — auto-refreshes tokens,
    //    no manual IMDS fetch needed. Requires @azure/identity installed.
    return {
      ...base,
      authentication: {
        type: 'azure-active-directory-default',
      },
    };
  }

  // SQL auth — local dev
  return {
    ...base,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
  };
}

let pool = null;


/**
 * Connect to the database and create the connection pool.
 * Called once at server startup from server.js.
 */
async function connectDb() {
  
  if (isDev) console.log(`[DB] Connecting to ${process.env.DB_SERVER}/${process.env.DB_NAME}...`);

  const config = buildConfig();   // ← no token argument needed anymore

  if (authMode === 'managed') {
    if (isDev) console.log('[DB] Using Azure Managed Identity (auto-refresh via DefaultAzureCredential)');
  }

  pool = await sql.connect(config);
    console.log('[DB] ✅ Connected to SQL Database successfully');
  return pool;
}

/**
 * Returns the active connection pool.
 * Usage in route files: const pool = getPool();
 */
function getPool() {
  if (!pool) throw new Error('Database not connected. Call connectDb() first.');
  return pool;
}

module.exports = { connectDb, getPool, sql };