/**
 * Phase 4 & Phase 7: Appointment Management & DFA Workflow Integration Tests
 */

const test = require('node:test');
const assert = require('node:assert/strict');
process.env.NODE_ENV = 'test';
const { startServer } = require('../server');
const { disconnectDB } = require('../config/db');
const { seedDatabase } = require('../utils/seed');
const { apiRateLimiter, authRateLimiter } = require('../middleware/rateLimiter');

let server;
let baseUrl;

async function api(path, { method = 'GET', body, token } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

test('Phase 4 Integration: Doctor Directory, Slot Availability, Booking, Approval, Rejection, Completion & Filtering', async (t) => {
  server = await startServer(0, { inMemoryOnly: true });
  baseUrl = `http://127.0.0.1:${server.address().port}/api`;
  await seedDatabase({ forceReset: true });
  apiRateLimiter.reset();
  authRateLimiter.reset();

  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    await disconnectDB();
  });

  // Login as Patient 1, Doctor 1 (Cardiology), and Admin
  const patLogin = await api('/auth/login', {
    method: 'POST',
    body: { email: 'aravind.patient@aegishealth.org', password: 'Hospital@123' },
  });
  const patientToken = patLogin.data.data.token;

  const docLogin = await api('/auth/login', {
    method: 'POST',
    body: { email: 'ananya.cardio@aegishealth.org', password: 'Hospital@123' },
  });
  const doctorToken = docLogin.data.data.token;
  const doctorId = docLogin.data.data.user.doctorProfileId;

  const futureDate = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  let bookedAppointmentId;

  await t.test('1. Doctor Directory & Slot Availability lookup returns accurate slots', async () => {
    const dirRes = await api('/doctors?department=Cardiology');
    assert.equal(dirRes.status, 200);
    assert.equal(dirRes.data.count, 1);

    const slotRes = await api(`/doctors/${doctorId}/slots?date=${futureDate}`);
    assert.equal(slotRes.status, 200);
    assert.ok(slotRes.data.data.availableSlots.includes('10:30 AM'));
  });

  await t.test('2. Booking an appointment enters initial DFA state REQUESTED (q0)', async () => {
    const bookRes = await api('/appointments', {
      method: 'POST',
      token: patientToken,
      body: {
        doctorId,
        appointmentDate: futureDate,
        timeSlot: '10:30 AM',
        reason: 'Chest discomfort and ECG checkup',
      },
    });
    assert.equal(bookRes.status, 201);
    assert.equal(bookRes.data.data.appointment.status, 'REQUESTED');
    bookedAppointmentId = bookRes.data.data.appointment._id;
  });

  await t.test('3. Attempting to COMPLETE a REQUESTED appointment before approval fails with HTTP 409', async () => {
    const invalidComplete = await api(`/appointments/${bookedAppointmentId}/complete`, {
      method: 'PATCH',
      token: doctorToken,
      body: { reason: 'Premature completion attempt' },
    });
    assert.equal(invalidComplete.status, 409);
    assert.equal(invalidComplete.data.error.code, 'INVALID_STATE_TRANSITION');
  });

  await t.test('4. Doctor APPROVES appointment (REQUESTED -> CONFIRMED) and COMPLETES it (CONFIRMED -> COMPLETED)', async () => {
    const approveRes = await api(`/appointments/${bookedAppointmentId}/approve`, {
      method: 'PATCH',
      token: doctorToken,
      body: { reason: 'Approved for Cardiology OPD' },
    });
    assert.equal(approveRes.status, 200);
    assert.equal(approveRes.data.data.appointment.status, 'CONFIRMED');

    const completeRes = await api(`/appointments/${bookedAppointmentId}/complete`, {
      method: 'PATCH',
      token: doctorToken,
      body: { reason: 'Consultation finished successfully', notes: 'Normal sinus rhythm' },
    });
    assert.equal(completeRes.status, 200);
    assert.equal(completeRes.data.data.appointment.status, 'COMPLETED');

    // Terminal state check: cannot cancel after COMPLETED
    const cancelAfterComplete = await api(`/appointments/${bookedAppointmentId}/cancel`, {
      method: 'PATCH',
      token: patientToken,
      body: { reason: 'Late cancel attempt' },
    });
    assert.equal(cancelAfterComplete.status, 409);
    assert.equal(cancelAfterComplete.data.error.code, 'TERMINAL_STATE_LOCKED');
  });

  await t.test('5. Doctor REJECT workflow transitions REQUESTED -> REJECTED (Terminal)', async () => {
    const book2 = await api('/appointments', {
      method: 'POST',
      token: patientToken,
      body: {
        doctorId,
        appointmentDate: futureDate,
        timeSlot: '11:00 AM',
        reason: 'Follow-up consultation',
      },
    });
    assert.equal(book2.status, 201);
    const apt2Id = book2.data.data.appointment._id;

    const rejectRes = await api(`/appointments/${apt2Id}/reject`, {
      method: 'PATCH',
      token: doctorToken,
      body: { reason: 'Doctor in cath lab procedure at 11:00 AM' },
    });
    assert.equal(rejectRes.status, 200);
    assert.equal(rejectRes.data.data.appointment.status, 'REJECTED');

    // Subsequent transition from REJECTED must fail with HTTP 409
    const reApprove = await api(`/appointments/${apt2Id}/approve`, {
      method: 'PATCH',
      token: doctorToken,
    });
    assert.equal(reApprove.status, 409);
    assert.equal(reApprove.data.error.code, 'TERMINAL_STATE_LOCKED');
  });
});
