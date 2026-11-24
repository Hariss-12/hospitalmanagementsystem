/**
 * Security Headers, CORS, and Input Sanitization (NoSQL Injection & XSS Protection) Middleware
 */

const ENV = require('../config/env');

/**
 * Sets strict HTTP security headers (Helmet equivalent).
 */
function securityHeaders(req, res, next) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '0');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' http://localhost:* https://dfa-hosptal-appoinment-application.onrender.com;"
  );
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  next();
}

/**
 * Strict CORS middleware with origin allowlist and preflight handling.
 */
function corsMiddleware(req, res, next) {
  const allowedOrigins = ENV.CORS_ORIGIN.split(',').map((o) => o.trim());
  const requestOrigin = req.headers.origin;

  if (!requestOrigin || allowedOrigins.includes('*') || allowedOrigins.includes(requestOrigin)) {
    res.setHeader('Access-Control-Allow-Origin', requestOrigin || allowedOrigins[0] || '*');
    res.setHeader('Vary', 'Origin');
  }

  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type, Authorization, X-CSRF-Token, X-Requested-With'
  );
  res.setHeader('Access-Control-Allow-Credentials', 'true');
<<<<<<< HEAD
  res.setHeader('Access-Control-Max-Age', '600');
=======
>>>>>>> ce80f239edc9e0b467abb27280f2a6646f4c47a5

  if (req.method === 'OPTIONS') {
    return res.status(204).send('');
  }
  next();
}

/**
 * Recursively detects and rejects NoSQL operator injection (keys starting with '$' or containing '.')
 * and strips dangerous HTML/script tags from string inputs to prevent stored XSS.
 */
function sanitizeValue(val, pathLabel = 'input') {
  if (typeof val === 'string') {
    // Strip <script> tags and angle brackets to neutralize XSS payloads
    return val
      .replace(/<\s*script[^>]*>[\s\S]*?<\s*\/\s*script\s*>/gi, '')
      .replace(/[<>]/g, '')
      .trim();
  }
  if (Array.isArray(val)) {
    return val.map((item, idx) => sanitizeValue(item, `${pathLabel}[${idx}]`));
  }
  if (val && typeof val === 'object') {
    const cleanObj = {};
    for (const [k, v] of Object.entries(val)) {
      if (k.startsWith('$') || k.includes('.')) {
        const err = new Error(`Security Violation: Prohibited NoSQL operator '${k}' detected in ${pathLabel}.`);
        err.statusCode = 400;
        err.code = 'NOSQL_INJECTION_DETECTED';
        throw err;
      }
      cleanObj[k] = sanitizeValue(v, `${pathLabel}.${k}`);
    }
    return cleanObj;
  }
  return val;
}

function sanitizeInputMiddleware(req, _res, next) {
  try {
    if (req.body && typeof req.body === 'object') {
      req.body = sanitizeValue(req.body, 'body');
    }
    if (req.query && typeof req.query === 'object') {
      req.query = sanitizeValue(req.query, 'query');
    }
    if (req.params && typeof req.params === 'object') {
      req.params = sanitizeValue(req.params, 'params');
    }
    next();
  } catch (err) {
    next(err);
  }
}

module.exports = {
  securityHeaders,
  corsMiddleware,
  sanitizeInputMiddleware,
  sanitizeValue,
};
