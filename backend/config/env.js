<<<<<<< HEAD

/**
 * Environment Variable Loader & Validator
 * MongoDB Atlas + Local Database Support
=======
/**
 * Environment Variable Loader & Validator
 *
 * Parses .env files without external dependencies if dotenv is unavailable,
 * and enforces presence of critical security secrets.
>>>>>>> ce80f239edc9e0b467abb27280f2a6646f4c47a5
 */

const fs = require('node:fs');
const path = require('node:path');

<<<<<<< HEAD
function parseEnvValue(value) {
  value = value.trim();

  // Handle double-quoted values
  if (value.startsWith('"') && value.endsWith('"')) {
    return value.slice(1, -1)
      .replace(/\\n/g, '\n')
      .replace(/\\r/g, '\r');
  }

  // Handle single-quoted values
  if (value.startsWith("'") && value.endsWith("'")) {
    return value.slice(1, -1);
  }

  // Remove comments from unquoted values
  return value.replace(/\s+#.*$/, '').trim();
}

function loadEnvFile() {
  const envPath = path.resolve(__dirname, '..', '.env');

  if (!fs.existsSync(envPath)) {
    console.warn('Warning: backend/.env file not found.');
    return;
  }

  const content = fs.readFileSync(envPath, 'utf8').replace(/^\uFEFF/, '');

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();

    if (!line || line.startsWith('#')) continue;

    const normalizedLine = line.startsWith('export ')
      ? line.slice(7).trim()
      : line;

    const eqIdx = normalizedLine.indexOf('=');
    if (eqIdx === -1) continue;

    const key = normalizedLine.slice(0, eqIdx).trim();
    const value = parseEnvValue(normalizedLine.slice(eqIdx + 1));

    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue;

    // Do not override existing system environment variables
    if (process.env[key] === undefined) {
      process.env[key] = value;
=======
function loadEnvFile() {
  const envPath = path.resolve(__dirname, '..', '.env');
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf8');
    for (const rawLine of content.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith('#')) continue;
      const eqIdx = line.indexOf('=');
      if (eqIdx === -1) continue;
      const key = line.slice(0, eqIdx).trim();
      const val = line.slice(eqIdx + 1).trim().replace(/^['"]|['"]$/g, '');
      if (process.env[key] === undefined) {
        process.env[key] = val;
      }
>>>>>>> ce80f239edc9e0b467abb27280f2a6646f4c47a5
    }
  }
}

loadEnvFile();

<<<<<<< HEAD
const USE_LOCAL_DB = process.env.USE_LOCAL_DB === 'true';
const NODE_ENV = process.env.NODE_ENV || 'development';

const MONGODB_URI = process.env.MONGODB_URI?.trim();

if (!USE_LOCAL_DB && NODE_ENV !== 'test' && !MONGODB_URI) {
  throw new Error(
    'FATAL: MONGODB_URI is missing. Configure it in backend/.env.'
  );
}

if (
  MONGODB_URI &&
  !MONGODB_URI.startsWith('mongodb://') &&
  !MONGODB_URI.startsWith('mongodb+srv://')
) {
  throw new Error('FATAL: Invalid MongoDB connection URI.');
}

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET || JWT_SECRET.length < 32) {
  throw new Error(
    'FATAL SECURITY ERROR: JWT_SECRET must be configured and at least 32 characters long.'
  );
}

const ENV = {
  PORT: Number(process.env.PORT || 5050),
  NODE_ENV,
  MONGODB_URI: MONGODB_URI || 'mongodb://127.0.0.1:27017/hospital_dfa_db',
  USE_LOCAL_DB,
  JWT_SECRET,
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '4h',

  CORS_ORIGIN: [
    ...new Set([
      ...(process.env.CORS_ORIGIN ||
        'http://localhost:5173,http://127.0.0.1:5173')
        .split(',')
        .map(origin => origin.trim())
=======
const ENV = {
  PORT: Number(process.env.PORT || 5050),
  NODE_ENV: process.env.NODE_ENV || 'development',
  MONGODB_URI: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/hospital_dfa_db',
  USE_LOCAL_DB: process.env.USE_LOCAL_DB === 'true',
  JWT_SECRET: process.env.JWT_SECRET,
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '4h',
  CORS_ORIGIN: [
    ...new Set([
      ...(process.env.CORS_ORIGIN || 'http://localhost:5173,http://127.0.0.1:5173')
        .split(',')
        .map((origin) => origin.trim())
>>>>>>> ce80f239edc9e0b467abb27280f2a6646f4c47a5
        .filter(Boolean),
      'https://hariss-12.github.io',
    ]),
  ].join(','),
<<<<<<< HEAD

  RATE_LIMIT_WINDOW_MS: Number(
    process.env.RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000
  ),

  RATE_LIMIT_MAX_REQUESTS: Number(
    process.env.RATE_LIMIT_MAX_REQUESTS || 500
  ),

  AUTH_RATE_LIMIT_MAX: Number(
    process.env.AUTH_RATE_LIMIT_MAX || 50
  ),
};

=======
  RATE_LIMIT_WINDOW_MS: Number(process.env.RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000),
  RATE_LIMIT_MAX_REQUESTS: Number(process.env.RATE_LIMIT_MAX_REQUESTS || 500),
  AUTH_RATE_LIMIT_MAX: Number(process.env.AUTH_RATE_LIMIT_MAX || 50),
};

if (!ENV.JWT_SECRET || ENV.JWT_SECRET.length < 32) {
  throw new Error(
    'FATAL SECURITY ERROR: JWT_SECRET environment variable must be configured and at least 32 characters long.'
  );
}

>>>>>>> ce80f239edc9e0b467abb27280f2a6646f4c47a5
module.exports = ENV;
