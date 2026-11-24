/**
 * Formal DFA Constants for Online Hospital Appointment Management System
 *
 * Formal 5-Tuple Definition:
 * M = (Q, Σ, δ, q0, F)
 *
 * Q  = Finite set of appointment states
 * Σ  = Finite input alphabet of transition events
 * δ  = Transition function δ: Q × Σ → Q
 * q0 = Initial state (REQUESTED)
 * F  = Set of terminal/final states { CANCELLED, REJECTED, COMPLETED }
 */

const DFA_STATES = Object.freeze({
  REQUESTED: 'REQUESTED',
  CONFIRMED: 'CONFIRMED',
  RESCHEDULED: 'RESCHEDULED',
  CANCELLED: 'CANCELLED',
  REJECTED: 'REJECTED',
  COMPLETED: 'COMPLETED',
});

const DFA_EVENTS = Object.freeze({
  APPROVE: 'APPROVE',
  RESCHEDULE: 'RESCHEDULE',
  CANCEL: 'CANCEL',
  REJECT: 'REJECT',
  COMPLETE: 'COMPLETE',
});

const INITIAL_STATE = DFA_STATES.REQUESTED;

const TERMINAL_STATES = Object.freeze(
  new Set([
    DFA_STATES.CANCELLED,
    DFA_STATES.REJECTED,
    DFA_STATES.COMPLETED,
  ])
);

const ACTIVE_STATES = Object.freeze(
  new Set([
    DFA_STATES.REQUESTED,
    DFA_STATES.CONFIRMED,
    DFA_STATES.RESCHEDULED,
  ])
);

const USER_ROLES = Object.freeze({
  PATIENT: 'Patient',
  DOCTOR: 'Doctor',
  ADMIN: 'Administrator',
});

module.exports = {
  DFA_STATES,
  DFA_EVENTS,
  INITIAL_STATE,
  TERMINAL_STATES,
  ACTIVE_STATES,
  USER_ROLES,
};
