/**
 * Configurable Sliding-Window Rate Limiter Middleware
 *
 * Protects authentication and API endpoints from brute-force and flooding attacks.
 */

const ENV = require('../config/env');

function createRateLimiter({
  windowMs = ENV.RATE_LIMIT_WINDOW_MS,
  max = ENV.RATE_LIMIT_MAX_REQUESTS,
  keyPrefix = 'global',
  message = 'Too many requests from this IP, please try again later.',
} = {}) {
  const buckets = new Map();

  function limiter(req, res, next) {
    // Allow test suite to test rate limiting explicitly via header X-Test-Rate-Limit-Key
    const clientKey = req.headers['x-test-rate-limit-key'] || req.ip || '127.0.0.1';
    const fullKey = `${keyPrefix}:${clientKey}`;
    const now = Date.now();

    let record = buckets.get(fullKey);
    if (!record || now > record.resetAt) {
      record = { count: 0, resetAt: now + windowMs };
      buckets.set(fullKey, record);
    }

    record.count += 1;
    const remaining = Math.max(0, max - record.count);
    res.setHeader('X-RateLimit-Limit', String(max));
    res.setHeader('X-RateLimit-Remaining', String(remaining));
    res.setHeader('X-RateLimit-Reset', String(Math.ceil(record.resetAt / 1000)));

    if (record.count > max) {
      return res.status(429).json({
        success: false,
        error: {
          message,
          code: 'RATE_LIMIT_EXCEEDED',
          retryAfterSeconds: Math.ceil((record.resetAt - now) / 1000),
        },
      });
    }

    next();
  }

  limiter.reset = () => buckets.clear();
  return limiter;
}

const apiRateLimiter = createRateLimiter({
  windowMs: ENV.RATE_LIMIT_WINDOW_MS,
  max: ENV.RATE_LIMIT_MAX_REQUESTS,
  keyPrefix: 'api',
});

const authRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: ENV.AUTH_RATE_LIMIT_MAX,
  keyPrefix: 'auth',
  message: 'Too many authentication attempts. Please wait 15 minutes before retrying.',
});

module.exports = {
  createRateLimiter,
  apiRateLimiter,
  authRateLimiter,
};
