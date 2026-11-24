/**
 * DFA Validator Module
 *
 * Enforces:
 * 1. Direct status manipulation prevention (rejects payloads attempting to set `status` directly).
 * 2. Ownership and role validation before executing any DFA transition.
 * 3. Mandatory reason validation for REJECT, CANCEL, and RESCHEDULE events.
 */

const { DFA_EVENTS, USER_ROLES } = require('./dfaConstants');
const { evaluateTransition, DFATransitionError } = require('./dfaEngine');

/**
 * Ensures incoming request bodies never bypass the DFA by directly supplying a `status` field.
 */
function assertNoDirectStatusMutation(body = {}) {
  if (body && Object.prototype.hasOwnProperty.call(body, 'status')) {
    throw new DFATransitionError(
      'Direct modification of appointment status is strictly prohibited. All status transitions must pass through the DFA Engine via a valid DFA event.',
      409,
      {
        code: 'DIRECT_STATUS_MUTATION_FORBIDDEN',
      }
    );
  }
}

/**
 * Validates that the authenticated user owns or is assigned to the target appointment
 * and that the requested DFA transition is valid for both currentState and role.
 *
 * @param {object} appointment - Appointment document from DB
 * @param {string} event       - DFA event (APPROVE, REJECT, RESCHEDULE, CANCEL, COMPLETE)
 * @param {object} user        - Authenticated user { id, role, doctorProfileId }
 * @returns {object} Evaluated DFA transition result
 */
function validateAppointmentTransition(appointment, event, user) {
  if (!appointment) {
    const err = new Error('Appointment not found.');
    err.statusCode = 404;
    throw err;
  }

  if (!user || !user.id || !user.role) {
    const err = new Error('Authentication required.');
    err.statusCode = 401;
    throw err;
  }

  // Ownership check before evaluating transition
  const patientIdStr = String(appointment.patientId?._id || appointment.patientId);
  const doctorIdStr = String(appointment.doctorId?._id || appointment.doctorId);

  if (user.role === USER_ROLES.PATIENT) {
    if (patientIdStr !== String(user.id)) {
      const err = new Error('Forbidden: Patients may only modify their own appointments.');
      err.statusCode = 403;
      err.code = 'IDOR_PATIENT_OWNERSHIP_VIOLATION';
      throw err;
    }
  } else if (user.role === USER_ROLES.DOCTOR) {
    const userDocProfileId = user.doctorProfileId ? String(user.doctorProfileId) : '';
    if (doctorIdStr !== userDocProfileId && doctorIdStr !== String(user.id)) {
      const err = new Error('Forbidden: Doctors may only manage appointments assigned to them.');
      err.statusCode = 403;
      err.code = 'IDOR_DOCTOR_OWNERSHIP_VIOLATION';
      throw err;
    }
  } else if (user.role !== USER_ROLES.ADMIN) {
    const err = new Error(`Forbidden: Unrecognized role '${user.role}'.`);
    err.statusCode = 403;
    throw err;
  }

  // Evaluate deterministic transition δ(currentState, event) + role permission
  return evaluateTransition(appointment.status, event, { role: user.role });
}

module.exports = {
  assertNoDirectStatusMutation,
  validateAppointmentTransition,
  DFA_EVENTS,
};
