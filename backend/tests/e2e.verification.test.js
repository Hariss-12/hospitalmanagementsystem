/**
 * Phase 8: Final End-to-End 15-Step Project Verification Suite
 *
 * Executes and verifies the exact 15-step workflow specified in Phase 8:
 *  1. Patient registers.
 *  2. Patient logs in.
 *  3. Patient selects a doctor.
 *  4. Patient checks available appointment slots.
 *  5. Patient books an appointment.
 *  6. Appointment enters REQUESTED state.
 *  7. Doctor approves the appointment.
 *  8. DFA changes the state to CONFIRMED.
 *  9. Patient requests rescheduling.
 * 10. DFA changes the state to RESCHEDULED.
 * 11. Doctor approves the rescheduled appointment.
 * 12. DFA changes the state to CONFIRMED.
 * 13. Patient cancels the appointment.
 * 14. DFA changes the state to CANCELLED.
 * 15. Attempting another transition must fail with HTTP 409.
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

test('Phase 8 Final End-to-End 15-Step DFA Lifecycle & Audit History Verification', async (t) => {
  server = await startServer(0, { inMemoryOnly: true });
  baseUrl = `http://127.0.0.1:${server.address().port}/api`;
  await seedDatabase({ forceReset: true });
  apiRateLimiter.reset();
  authRateLimiter.reset();

  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    await disconnectDB();
  });

  // Step 1: Patient registers
  const regRes = await api('/auth/register', {
    method: 'POST',
    body: {
      name: 'Giri Sellamuthu',
      email: 'giri.e2e@aegishealth.org',
      password: 'Hospital@123',
      phone: '+91-6382148559',
      gender: 'Male',
      bloodGroup: 'O+',
      address: 'Erode, Tamil Nadu',
    },
  });
  assert.equal(regRes.status, 201);
  assert.equal(regRes.data.data.user.role, 'Patient');

  // Step 2: Patient logs in
  const loginRes = await api('/auth/login', {
    method: 'POST',
    body: {
      email: 'giri.e2e@aegishealth.org',
      password: 'Hospital@123',
    },
  });
  assert.equal(loginRes.status, 200);
  const patientToken = loginRes.data.data.token;

  // Also login as the Cardiology Doctor & Administrator for approval steps
  const docLogin = await api('/auth/login', {
    method: 'POST',
    body: {
      email: 'ananya.cardio@aegishealth.org',
      password: 'Hospital@123',
    },
  });
  assert.equal(docLogin.status, 200);
  const doctorToken = docLogin.data.data.token;

  const adminLogin = await api('/auth/login', {
    method: 'POST',
    body: {
      email: 'admin@aegishealth.org',
      password: 'Hospital@123',
    },
  });
  assert.equal(adminLogin.status, 200);
  const adminToken = adminLogin.data.data.token;

  // Step 3: Patient selects a doctor from the Doctor Directory
  const doctorsRes = await api('/doctors?department=Cardiology', { token: patientToken });
  assert.equal(doctorsRes.status, 200);
  const selectedDoctor = doctorsRes.data.data.doctors[0];
  assert.ok(selectedDoctor);
  assert.equal(selectedDoctor.name, 'Dr. Ananya Krishnan');

  // Step 4: Patient checks available appointment slots
  const targetDate1 = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const targetDate2 = new Date(Date.now() + 8 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const slotsRes = await api(`/doctors/${selectedDoctor._id}/slots?date=${targetDate1}`, {
    token: patientToken,
  });
  assert.equal(slotsRes.status, 200);
  assert.ok(slotsRes.data.data.availableSlots.includes('10:00 AM'));

  // Step 5 & Step 6: Patient books an appointment -> Appointment enters REQUESTED state
  const bookRes = await api('/appointments', {
    method: 'POST',
    token: patientToken,
    body: {
      doctorId: selectedDoctor._id,
      appointmentDate: targetDate1,
      timeSlot: '10:00 AM',
      reason: 'Preventive cardiac screening and ECG',
      symptoms: 'None',
    },
  });
  assert.equal(bookRes.status, 201);
  const appointmentId = bookRes.data.data.appointment._id;
  assert.equal(bookRes.data.data.appointment.status, 'REQUESTED');

  // Step 7 & Step 8: Doctor approves the appointment -> DFA changes the state to CONFIRMED
  const approve1Res = await api(`/appointments/${appointmentId}/approve`, {
    method: 'PATCH',
    token: doctorToken,
    body: {
      reason: 'Initial slot approved by Dr. Ananya Krishnan',
    },
  });
  assert.equal(approve1Res.status, 200);
  assert.equal(approve1Res.data.data.transition.previousState, 'REQUESTED');
  assert.equal(approve1Res.data.data.transition.event, 'APPROVE');
  assert.equal(approve1Res.data.data.transition.nextState, 'CONFIRMED');
  assert.equal(approve1Res.data.data.appointment.status, 'CONFIRMED');

  // Step 9 & Step 10: Patient requests rescheduling -> DFA changes the state to RESCHEDULED
  const rescheduleRes = await api(`/appointments/${appointmentId}/reschedule`, {
    method: 'PATCH',
    token: patientToken,
    body: {
      appointmentDate: targetDate2,
      timeSlot: '02:00 PM',
      reason: 'University examination conflict on original date',
    },
  });
  assert.equal(rescheduleRes.status, 200);
  assert.equal(rescheduleRes.data.data.transition.previousState, 'CONFIRMED');
  assert.equal(rescheduleRes.data.data.transition.event, 'RESCHEDULE');
  assert.equal(rescheduleRes.data.data.transition.nextState, 'RESCHEDULED');
  assert.equal(rescheduleRes.data.data.appointment.status, 'RESCHEDULED');
  assert.equal(rescheduleRes.data.data.appointment.appointmentDate, targetDate2);
  assert.equal(rescheduleRes.data.data.appointment.timeSlot, '02:00 PM');

  // Step 11 & Step 12: Doctor approves the rescheduled appointment -> DFA changes the state to CONFIRMED
  const approve2Res = await api(`/appointments/${appointmentId}/approve`, {
    method: 'PATCH',
    token: doctorToken,
    body: {
      reason: 'Rescheduled slot approved by Cardiology OPD',
    },
  });
  assert.equal(approve2Res.status, 200);
  assert.equal(approve2Res.data.data.transition.previousState, 'RESCHEDULED');
  assert.equal(approve2Res.data.data.transition.event, 'APPROVE');
  assert.equal(approve2Res.data.data.transition.nextState, 'CONFIRMED');
  assert.equal(approve2Res.data.data.appointment.status, 'CONFIRMED');

  // Step 13 & Step 14: Patient cancels the appointment -> DFA changes the state to CANCELLED
  const cancelRes = await api(`/appointments/${appointmentId}/cancel`, {
    method: 'PATCH',
    token: patientToken,
    body: {
      reason: 'Travelling out of station',
    },
  });
  assert.equal(cancelRes.status, 200);
  assert.equal(cancelRes.data.data.transition.previousState, 'CONFIRMED');
  assert.equal(cancelRes.data.data.transition.event, 'CANCEL');
  assert.equal(cancelRes.data.data.transition.nextState, 'CANCELLED');
  assert.equal(cancelRes.data.data.appointment.status, 'CANCELLED');

  // Step 15: Attempting another transition from terminal state CANCELLED must fail with HTTP 409
  for (const terminalAttempt of [
    { path: 'approve', token: doctorToken },
    { path: 'reschedule', token: patientToken, body: { appointmentDate: targetDate2, timeSlot: '03:00 PM' } },
    { path: 'complete', token: doctorToken },
    { path: 'reject', token: doctorToken },
    { path: 'cancel', token: adminToken }, // Even Administrator cannot bypass terminal state lock!
  ]) {
    const failRes = await api(`/appointments/${appointmentId}/${terminalAttempt.path}`, {
      method: 'PATCH',
      token: terminalAttempt.token,
      body: terminalAttempt.body || { reason: 'Attempt transition after terminal state' },
    });
    assert.equal(failRes.status, 409);
    assert.equal(failRes.data.error.code, 'TERMINAL_STATE_LOCKED');
    assert.equal(failRes.data.error.isTerminal, true);
  }

  // Verify complete AppointmentHistory recorded all 5 lifecycle transitions
  const historyRes = await api(`/appointments/${appointmentId}/history`, {
    token: patientToken,
  });
  assert.equal(historyRes.status, 200);
  assert.equal(historyRes.data.count, 5);
  const trace = historyRes.data.data.history.map(
    (h) => `${h.previousState}->[${h.event}]->${h.nextState}`
  );
  assert.deepEqual(trace, [
    'NONE->[BOOK_INITIAL]->REQUESTED',
    'REQUESTED->[APPROVE]->CONFIRMED',
    'CONFIRMED->[RESCHEDULE]->RESCHEDULED',
    'RESCHEDULED->[APPROVE]->CONFIRMED',
    'CONFIRMED->[CANCEL]->CANCELLED',
  ]);
});
