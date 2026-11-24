/**
 * Automated Unit Tests for the Deterministic Finite Automaton (DFA) Engine
 *
 * Tests all 30 (6 states × 5 events) state-event combinations, terminal-state
 * immutability, malformed inputs, and role-level transition guards.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  DFA_STATES,
  DFA_EVENTS,
  INITIAL_STATE,
  TERMINAL_STATES,
  DFATransitionError,
  evaluateTransition,
  isTerminalState,
  getAllowedEvents,
  getFormalDFADefinition,
} = require('../dfa/dfaEngine');
const { USER_ROLES } = require('../dfa/dfaConstants');

test('DFA Formal 5-Tuple Definition Integrity', () => {
  const def = getFormalDFADefinition();
  assert.equal(def.tuple.q0, 'REQUESTED');
  assert.deepEqual(def.tuple.Q, [
    'REQUESTED',
    'CONFIRMED',
    'RESCHEDULED',
    'CANCELLED',
    'REJECTED',
    'COMPLETED',
  ]);
  assert.deepEqual(def.tuple.Sigma, [
    'APPROVE',
    'RESCHEDULE',
    'CANCEL',
    'REJECT',
    'COMPLETE',
  ]);
  assert.deepEqual(def.tuple.F, ['CANCELLED', 'REJECTED', 'COMPLETED']);
  assert.equal(INITIAL_STATE, DFA_STATES.REQUESTED);
});

test('DFA Valid Transitions — All 11 defined transitions succeed deterministically', () => {
  const validCases = [
    // From REQUESTED
    { from: DFA_STATES.REQUESTED, event: DFA_EVENTS.APPROVE, expected: DFA_STATES.CONFIRMED, terminal: false },
    { from: DFA_STATES.REQUESTED, event: DFA_EVENTS.REJECT, expected: DFA_STATES.REJECTED, terminal: true },
    { from: DFA_STATES.REQUESTED, event: DFA_EVENTS.RESCHEDULE, expected: DFA_STATES.RESCHEDULED, terminal: false },
    { from: DFA_STATES.REQUESTED, event: DFA_EVENTS.CANCEL, expected: DFA_STATES.CANCELLED, terminal: true },

    // From CONFIRMED
    { from: DFA_STATES.CONFIRMED, event: DFA_EVENTS.RESCHEDULE, expected: DFA_STATES.RESCHEDULED, terminal: false },
    { from: DFA_STATES.CONFIRMED, event: DFA_EVENTS.CANCEL, expected: DFA_STATES.CANCELLED, terminal: true },
    { from: DFA_STATES.CONFIRMED, event: DFA_EVENTS.COMPLETE, expected: DFA_STATES.COMPLETED, terminal: true },

    // From RESCHEDULED
    { from: DFA_STATES.RESCHEDULED, event: DFA_EVENTS.APPROVE, expected: DFA_STATES.CONFIRMED, terminal: false },
    { from: DFA_STATES.RESCHEDULED, event: DFA_EVENTS.REJECT, expected: DFA_STATES.REJECTED, terminal: true },
    { from: DFA_STATES.RESCHEDULED, event: DFA_EVENTS.RESCHEDULE, expected: DFA_STATES.RESCHEDULED, terminal: false },
    { from: DFA_STATES.RESCHEDULED, event: DFA_EVENTS.CANCEL, expected: DFA_STATES.CANCELLED, terminal: true },
  ];

  for (const tc of validCases) {
    const result = evaluateTransition(tc.from, tc.event);
    assert.equal(result.previousState, tc.from);
    assert.equal(result.event, tc.event);
    assert.equal(result.nextState, tc.expected);
    assert.equal(result.isTerminal, tc.terminal);
    assert.ok(result.timestamp);
  }
});

test('DFA Invalid Active-State Transitions — Reject with HTTP 409 Conflict', () => {
  const invalidActiveCases = [
    // Cannot complete an unconfirmed appointment
    { from: DFA_STATES.REQUESTED, event: DFA_EVENTS.COMPLETE },
    // Cannot re-approve or reject an already confirmed appointment directly
    { from: DFA_STATES.CONFIRMED, event: DFA_EVENTS.APPROVE },
    { from: DFA_STATES.CONFIRMED, event: DFA_EVENTS.REJECT },
    // Cannot complete a rescheduled appointment without approving first
    { from: DFA_STATES.RESCHEDULED, event: DFA_EVENTS.COMPLETE },
  ];

  for (const tc of invalidActiveCases) {
    assert.throws(
      () => evaluateTransition(tc.from, tc.event),
      (err) => {
        assert.ok(err instanceof DFATransitionError);
        assert.equal(err.statusCode, 409);
        assert.equal(err.code, 'INVALID_STATE_TRANSITION');
        assert.equal(err.currentState, tc.from);
        assert.equal(err.event, tc.event);
        return true;
      }
    );
  }
});

test('DFA Terminal State Lock — All 15 transitions from CANCELLED, REJECTED, COMPLETED fail with HTTP 409', () => {
  const terminalStates = Array.from(TERMINAL_STATES);
  const allEvents = Object.values(DFA_EVENTS);

  assert.equal(terminalStates.length, 3);
  assert.equal(allEvents.length, 5);

  for (const state of terminalStates) {
    assert.equal(isTerminalState(state), true);
    assert.deepEqual(getAllowedEvents(state), []);

    for (const event of allEvents) {
      assert.throws(
        () => evaluateTransition(state, event),
        (err) => {
          assert.ok(err instanceof DFATransitionError);
          assert.equal(err.statusCode, 409);
          assert.equal(err.code, 'TERMINAL_STATE_LOCKED');
          assert.equal(err.isTerminal, true);
          return true;
        }
      );
    }
  }
});

test('DFA Unknown State or Unknown Event — Reject with HTTP 409 Conflict', () => {
  assert.throws(
    () => evaluateTransition('HACKED_STATE', DFA_EVENTS.APPROVE),
    (err) => err instanceof DFATransitionError && err.statusCode === 409 && err.code === 'UNKNOWN_DFA_STATE'
  );

  assert.throws(
    () => evaluateTransition(DFA_STATES.REQUESTED, 'FORCE_CONFIRM'),
    (err) => err instanceof DFATransitionError && err.statusCode === 409 && err.code === 'UNKNOWN_DFA_EVENT'
  );
});

test('DFA Role-Based Event Guard — Rejects unauthorized role triggers with HTTP 403', () => {
  // Patient cannot APPROVE, REJECT, or COMPLETE
  for (const forbidden of [
    { state: DFA_STATES.REQUESTED, event: DFA_EVENTS.APPROVE },
    { state: DFA_STATES.REQUESTED, event: DFA_EVENTS.REJECT },
    { state: DFA_STATES.CONFIRMED, event: DFA_EVENTS.COMPLETE },
    { state: DFA_STATES.RESCHEDULED, event: DFA_EVENTS.APPROVE },
  ]) {
    assert.throws(
      () => evaluateTransition(forbidden.state, forbidden.event, { role: USER_ROLES.PATIENT }),
      (err) => err instanceof DFATransitionError && err.statusCode === 403 && err.code === 'UNAUTHORIZED_DFA_EVENT_ROLE'
    );
  }

  // Doctor can APPROVE and COMPLETE
  const docApprove = evaluateTransition(DFA_STATES.REQUESTED, DFA_EVENTS.APPROVE, {
    role: USER_ROLES.DOCTOR,
  });
  assert.equal(docApprove.nextState, DFA_STATES.CONFIRMED);

  const docComplete = evaluateTransition(DFA_STATES.CONFIRMED, DFA_EVENTS.COMPLETE, {
    role: USER_ROLES.DOCTOR,
  });
  assert.equal(docComplete.nextState, DFA_STATES.COMPLETED);
});
