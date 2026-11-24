/**
 * Cryptographic Password Hashing (scrypt/PBKDF2 + timingSafeEqual) and JWT (HMAC-SHA256) Utility
 *
 * Uses Node.js built-in `node:crypto` module when `bcryptjs` / `jsonwebtoken` packages are not
 * installed in node_modules, while maintaining 100% standard JWT (RFC 7519) format and
 * salted non-reversible cryptographic password hashes.
 */

const crypto = require('node:crypto');
const ENV = require('../config/env');

const SCRYPT_PARAMS = { N: 16384, r: 8, p: 1, keylen: 64 };

/**
 * Hashes a plaintext password using cryptographic random salt + scrypt.
 * Format: $scrypt$saltHex$hashHex
 */
async function hashPassword(plainPassword) {
  if (typeof plainPassword !== 'string' || plainPassword.length < 1) {
    throw new Error('Password must be a non-empty string.');
  }
  const salt = crypto.randomBytes(16).toString('hex');
  return new Promise((resolve, reject) => {
    crypto.scrypt(
      plainPassword,
      salt,
      SCRYPT_PARAMS.keylen,
      { N: SCRYPT_PARAMS.N, r: SCRYPT_PARAMS.r, p: SCRYPT_PARAMS.p },
      (err, derivedKey) => {
        if (err) return reject(err);
        resolve(`$scrypt$${salt}$${derivedKey.toString('hex')}`);
      }
    );
  });
}

/**
 * Verifies a plaintext password against a stored cryptographic hash using constant-time comparison.
 */
async function verifyPassword(plainPassword, storedHash) {
  if (typeof plainPassword !== 'string' || typeof storedHash !== 'string') {
    return false;
  }
  const parts = storedHash.split('$');
  if (parts.length !== 4 || parts[1] !== 'scrypt') {
    return false;
  }
  const [, , salt, hashHex] = parts;
  return new Promise((resolve) => {
    crypto.scrypt(
      plainPassword,
      salt,
      SCRYPT_PARAMS.keylen,
      { N: SCRYPT_PARAMS.N, r: SCRYPT_PARAMS.r, p: SCRYPT_PARAMS.p },
      (err, derivedKey) => {
        if (err) return resolve(false);
        const storedBuf = Buffer.from(hashHex, 'hex');
        if (storedBuf.length !== derivedKey.length) return resolve(false);
        resolve(crypto.timingSafeEqual(storedBuf, derivedKey));
      }
    );
  });
}

function base64UrlEncode(input) {
  const buf = Buffer.isBuffer(input) ? input : Buffer.from(String(input), 'utf8');
  return buf
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function base64UrlDecode(str) {
  let base64 = String(str).replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4 !== 0) {
    base64 += '=';
  }
  return Buffer.from(base64, 'base64').toString('utf8');
}

function parseExpiryToSeconds(expiresIn) {
  if (typeof expiresIn === 'number') return expiresIn;
  const match = /^(\d+)([smhd])$/.exec(String(expiresIn || '4h'));
  if (!match) return 4 * 3600;
  const val = Number(match[1]);
  const unit = match[2];
  if (unit === 's') return val;
  if (unit === 'm') return val * 60;
  if (unit === 'h') return val * 3600;
  if (unit === 'd') return val * 86400;
  return 14400;
}

/**
 * Signs a standard RFC 7519 HS256 JWT token.
 */
function signJwt(payload, expiresIn = ENV.JWT_EXPIRES_IN) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const nowSec = Math.floor(Date.now() / 1000);
  const expSec = nowSec + parseExpiryToSeconds(expiresIn);

  const fullPayload = {
    ...payload,
    iat: nowSec,
    exp: expSec,
    jti: crypto.randomBytes(8).toString('hex'),
  };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(fullPayload));
  const signingInput = `${encodedHeader}.${encodedPayload}`;

  const signature = base64UrlEncode(
    crypto.createHmac('sha256', ENV.JWT_SECRET).update(signingInput).digest()
  );

  return `${signingInput}.${signature}`;
}

/**
 * Verifies an HS256 JWT token and checks signature + expiration.
 */
function verifyJwt(token) {
  if (typeof token !== 'string') {
    throw new Error('Invalid token format.');
  }
  const parts = token.split('.');
  if (parts.length !== 3) {
    throw new Error('Malformed JWT structure.');
  }

  const [encodedHeader, encodedPayload, providedSignature] = parts;
  let header;
  try {
    header = JSON.parse(base64UrlDecode(encodedHeader));
  } catch {
    throw new Error('Invalid JWT header.');
  }

  if (!header || header.alg !== 'HS256') {
    throw new Error('Unsupported or insecure JWT algorithm.');
  }

  const signingInput = `${encodedHeader}.${encodedPayload}`;
  const expectedSignature = base64UrlEncode(
    crypto.createHmac('sha256', ENV.JWT_SECRET).update(signingInput).digest()
  );

  const sigBufA = Buffer.from(providedSignature);
  const sigBufB = Buffer.from(expectedSignature);
  if (sigBufA.length !== sigBufB.length || !crypto.timingSafeEqual(sigBufA, sigBufB)) {
    throw new Error('Invalid JWT signature.');
  }

  let payload;
  try {
    payload = JSON.parse(base64UrlDecode(encodedPayload));
  } catch {
    throw new Error('Invalid JWT payload.');
  }

  const nowSec = Math.floor(Date.now() / 1000);
  if (typeof payload.exp === 'number' && nowSec >= payload.exp) {
    throw new Error('JWT token has expired.');
  }

  return payload;
}

module.exports = {
  hashPassword,
  verifyPassword,
  signJwt,
  verifyJwt,
};
