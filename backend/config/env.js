
/**
 * Environment Variable Loader & Validator
 * MongoDB Atlas + Local Database Support
 */

const fs = require('node:fs');
const path = require('node:path');

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
    }
  }
}

loadEnvFile();

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
        .filter(Boolean),
      'https://hariss-12.github.io',
    ]),
  ].join(','),

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

module.exports = ENV;
