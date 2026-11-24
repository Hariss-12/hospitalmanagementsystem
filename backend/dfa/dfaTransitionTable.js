/**
 * Deterministic Finite Automaton (DFA) Transition Table δ(q, σ)
 *
 * Strictly maps each valid (CurrentState, Event) pair to its deterministic NextState
 * and specifies which user roles are permitted to trigger that specific transition.
 *
 * Any transition not explicitly present in TRANSITION_TABLE is undefined/invalid
 * and MUST be rejected with HTTP 409 Conflict.
 */

const { DFA_STATES, DFA_EVENTS, USER_ROLES } = require('./dfaConstants');

const TRANSITION_TABLE = Object.freeze({
  [DFA_STATES.REQUESTED]: Object.freeze({
    [DFA_EVENTS.APPROVE]: Object.freeze({
      nextState: DFA_STATES.CONFIRMED,
      allowedRoles: [USER_ROLES.DOCTOR, USER_ROLES.ADMIN],
      description: 'Doctor or Administrator approves a newly requested appointment.',
    }),
    [DFA_EVENTS.REJECT]: Object.freeze({
      nextState: DFA_STATES.REJECTED,
      allowedRoles: [USER_ROLES.DOCTOR, USER_ROLES.ADMIN],
      description: 'Doctor or Administrator rejects a newly requested appointment.',
    }),
    [DFA_EVENTS.RESCHEDULE]: Object.freeze({
      nextState: DFA_STATES.RESCHEDULED,
      allowedRoles: [USER_ROLES.PATIENT, USER_ROLES.DOCTOR, USER_ROLES.ADMIN],
      description: 'Patient, Doctor, or Administrator reschedules a pending appointment request.',
    }),
    [DFA_EVENTS.CANCEL]: Object.freeze({
      nextState: DFA_STATES.CANCELLED,
      allowedRoles: [USER_ROLES.PATIENT, USER_ROLES.ADMIN],
      description: 'Patient or Administrator cancels a pending appointment request.',
    }),
  }),

  [DFA_STATES.CONFIRMED]: Object.freeze({
    [DFA_EVENTS.RESCHEDULE]: Object.freeze({
      nextState: DFA_STATES.RESCHEDULED,
      allowedRoles: [USER_ROLES.PATIENT, USER_ROLES.DOCTOR, USER_ROLES.ADMIN],
      description: 'Patient, Doctor, or Administrator requests rescheduling a confirmed appointment.',
    }),
    [DFA_EVENTS.CANCEL]: Object.freeze({
      nextState: DFA_STATES.CANCELLED,
      allowedRoles: [USER_ROLES.PATIENT, USER_ROLES.DOCTOR, USER_ROLES.ADMIN],
      description: 'Patient, Doctor, or Administrator cancels a confirmed appointment.',
    }),
    [DFA_EVENTS.COMPLETE]: Object.freeze({
      nextState: DFA_STATES.COMPLETED,
      allowedRoles: [USER_ROLES.DOCTOR, USER_ROLES.ADMIN],
      description: 'Doctor or Administrator marks a confirmed consultation as completed.',
    }),
  }),

  [DFA_STATES.RESCHEDULED]: Object.freeze({
    [DFA_EVENTS.APPROVE]: Object.freeze({
      nextState: DFA_STATES.CONFIRMED,
      allowedRoles: [USER_ROLES.DOCTOR, USER_ROLES.ADMIN],
      description: 'Doctor or Administrator approves a rescheduled appointment slot.',
    }),
    [DFA_EVENTS.REJECT]: Object.freeze({
      nextState: DFA_STATES.REJECTED,
      allowedRoles: [USER_ROLES.DOCTOR, USER_ROLES.ADMIN],
      description: 'Doctor or Administrator rejects a rescheduled appointment request.',
    }),
    [DFA_EVENTS.RESCHEDULE]: Object.freeze({
      nextState: DFA_STATES.RESCHEDULED,
      allowedRoles: [USER_ROLES.PATIENT, USER_ROLES.DOCTOR, USER_ROLES.ADMIN],
      description: 'Patient, Doctor, or Administrator updates the proposed rescheduled slot.',
    }),
    [DFA_EVENTS.CANCEL]: Object.freeze({
      nextState: DFA_STATES.CANCELLED,
      allowedRoles: [USER_ROLES.PATIENT, USER_ROLES.DOCTOR, USER_ROLES.ADMIN],
      description: 'Patient, Doctor, or Administrator cancels a rescheduled appointment.',
    }),
  }),

  // Terminal states have NO valid outgoing transitions
  [DFA_STATES.CANCELLED]: Object.freeze({}),
  [DFA_STATES.REJECTED]: Object.freeze({}),
  [DFA_STATES.COMPLETED]: Object.freeze({}),
});

/**
 * Generates a serializable representation of the formal DFA 5-tuple and transition matrix
 * for academic inspection and frontend DFA visualization.
 */
function getFormalDFADefinition() {
  const transitions = [];
  for (const [fromState, eventMap] of Object.entries(TRANSITION_TABLE)) {
    for (const [event, rule] of Object.entries(eventMap)) {
      transitions.push({
        fromState,
        event,
        toState: rule.nextState,
        allowedRoles: rule.allowedRoles,
        description: rule.description,
      });
    }
  }

  return {
    tuple: {
      Q: Object.values(DFA_STATES),
      Sigma: Object.values(DFA_EVENTS),
      q0: DFA_STATES.REQUESTED,
      F: [DFA_STATES.CANCELLED, DFA_STATES.REJECTED, DFA_STATES.COMPLETED],
    },
    transitions,
  };
}

module.exports = {
  TRANSITION_TABLE,
  getFormalDFADefinition,
};
