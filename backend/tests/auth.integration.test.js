/**
 * Phase 2 & Phase 7: Authentication, JWT, and Role-Based Access Control Integration Tests
 */

const test = require('node:test');
const assert = require('node:assert/strict');
process.env.NODE_ENV = 'test';
const { startServer } = require('../server');
const { disconnectDB } = require('../config/db');
const { seedDatabase } = require('../utils/seed');
const { apiRateLimiter, authRateLimiter } = require('../middleware/rateLimiter');
const User = require('../models/User');

let server;
let baseUrl;

async function api(path, { method = 'GET', body, token, headers = {} } = {}) {
  const reqHeaders = {
    'Content-Type': 'application/json',
    ...headers,
  };
  if (token) {
    reqHeaders.Authorization = `Bearer ${token}`;
  }
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers: reqHeaders,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data, headers: res.headers };
}

test('Phase 1 & Phase 2 Integration: Health Check, Registration, Login, Logout, & RBAC Guards', async (t) => {
  server = await startServer(0, { inMemoryOnly: true });
  const addr = server.address();
  baseUrl = `http://127.0.0.1:${addr.port}/api`;
  await seedDatabase({ forceReset: true });
  apiRateLimiter.reset();
  authRateLimiter.reset();

  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    await disconnectDB();
  });

  await t.test('1. Health Check endpoint confirms server & database connection', async () => {
    const res = await api('/health');
    assert.equal(res.status, 200);
    assert.equal(res.data.success, true);
    assert.equal(res.data.database.connected, true);
    assert.equal(res.data.dfaStates.length, 6);
  });

  await t.test('1a. Cross-origin preflight responses can be cached', async () => {
    const res = await api('/auth/login', {
      method: 'OPTIONS',
      headers: {
        Origin: 'https://hariss-12.github.io',
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'content-type',
      },
    });
    assert.equal(res.status, 204);
    assert.equal(res.headers.get('access-control-max-age'), '600');
  });

  await t.test('2. Patient Registration hashes password, never exposes passwordHash, and ignores role spoofing', async () => {
    const res = await api('/auth/register', {
      method: 'POST',
      body: {
        name: 'Kavin Kumar',
        email: 'kavin.patient@aegishealth.org',
        password: 'Patient@123',
        role: 'Administrator', // Attempted privilege escalation!
        phone: '+91-9840099111',
      },
    });
    assert.equal(res.status, 201);
    assert.equal(res.data.success, true);
    assert.equal(res.data.data.user.role, 'Patient'); // Enforced as Patient!
    assert.equal(res.data.data.user.passwordHash, undefined);
    assert.ok(res.data.data.token);
  });

  await t.test('3. Duplicate email registration is rejected with HTTP 409', async () => {
    const res = await api('/auth/register', {
      method: 'POST',
      body: {
        name: 'Duplicate User',
        email: 'kavin.patient@aegishealth.org',
        password: 'Patient@123',
      },
    });
    assert.equal(res.status, 409);
    assert.equal(res.data.error.code, 'EMAIL_ALREADY_REGISTERED');
  });

  await t.test('4. Login succeeds for valid credentials and fails with HTTP 401 for wrong password', async () => {
    const badRes = await api('/auth/login', {
      method: 'POST',
      body: { email: 'kavin.patient@aegishealth.org', password: 'WrongPassword123' },
    });
    assert.equal(badRes.status, 401);

    const goodRes = await api('/auth/login', {
      method: 'POST',
      body: { email: 'kavin.patient@aegishealth.org', password: 'Patient@123' },
    });
    assert.equal(goodRes.status, 200);
    assert.ok(goodRes.data.data.token);
  });

  await t.test('5. Role-Based Access Control (RBAC): Patient cannot access Admin or Doctor-only endpoints', async () => {
    const loginRes = await api('/auth/login', {
      method: 'POST',
      body: { email: 'kavin.patient@aegishealth.org', password: 'Patient@123' },
    });
    const patientToken = loginRes.data.data.token;

    const adminAttempt = await api('/admin/overview', { token: patientToken });
    assert.equal(adminAttempt.status, 403);
    assert.equal(adminAttempt.data.error.code, 'FORBIDDEN_ROLE');
  });

  await t.test('6. Logout revokes JWT JTI so subsequent API calls with the logged-out token fail with HTTP 401', async () => {
    const loginRes = await api('/auth/login', {
      method: 'POST',
      body: { email: 'kavin.patient@aegishealth.org', password: 'Patient@123' },
    });
    const token = loginRes.data.data.token;

    const originalFindById = User.findById;
    let userLookups = 0;
    User.findById = function (...args) {
      userLookups += 1;
      return originalFindById.apply(User, args);
    };
    let meBefore;
    try {
      meBefore = await api('/auth/me', { token });
    } finally {
      User.findById = originalFindById;
    }
    assert.equal(meBefore.status, 200);
    assert.equal(userLookups, 1, 'GET /auth/me should use the user loaded by authentication middleware');

    const logoutRes = await api('/auth/logout', { method: 'POST', token });
    assert.equal(logoutRes.status, 200);

    const meAfter = await api('/auth/me', { token });
    assert.equal(meAfter.status, 401);
    assert.equal(meAfter.data.error.code, 'AUTH_TOKEN_REVOKED');
  });
});
