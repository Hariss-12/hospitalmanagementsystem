/**
 * Core Deterministic Finite Automaton (DFA) Engine & Validator
 *
 * Enforces:
 * 1. Centralized transition function δ(currentState, event).
 * 2. Strict validation of state ∈ Q and event ∈ Σ.
 * 3. Immediate rejection of transitions from terminal states (CANCELLED, REJECTED, COMPLETED) with HTTP 409.
 * 4. Immediate rejection of undefined transitions (e.g., REQUESTED + COMPLETE) with HTTP 409.
 * 5. Role-based transition authorization guard.
 */

const {
  DFA_STATES,
  DFA_EVENTS,
  INITIAL_STATE,
  TERMINAL_STATES,
} = require('./dfaConstants');
const { TRANSITION_TABLE, getFormalDFADefinition } = require('./dfaTransitionTable');

class DFATransitionError extends Error {
  constructor(message, statusCode = 409, details = {}) {
    super(message);
    this.name = 'DFATransitionError';
    this.statusCode = statusCode;
    this.code = details.code || 'INVALID_DFA_TRANSITION';
    this.currentState = details.currentState || null;
    this.event = details.event || null;
    this.isTerminal = Boolean(details.isTerminal);
    this.allowedEvents = details.allowedEvents || [];
  }
}

/**
 * Checks whether a given state belongs to the formal state set Q.
 */
function isValidState(state) {
  return typeof state === 'string' && Object.values(DFA_STATES).includes(state);
}

/**
 * Checks whether a given event belongs to the formal input alphabet Σ.
 */
function isValidEvent(event) {
  return typeof event === 'string' && Object.values(DFA_EVENTS).includes(event);
}

/**
 * Checks whether a given state is a terminal state in F.
 */
function isTerminalState(state) {
  return TERMINAL_STATES.has(state);
}

/**
 * Returns the list of valid events that can be triggered from `currentState`
 * (optionally filtered by user role).
 */
function getAllowedEvents(currentState, role = null) {
  if (!isValidState(currentState) || isTerminalState(currentState)) {
    return [];
  }
  const stateTransitions = TRANSITION_TABLE[currentState] || {};
  return Object.entries(stateTransitions)
    .filter(([, rule]) => !role || rule.allowedRoles.includes(role))
    .map(([event, rule]) => ({
      event,
      nextState: rule.nextState,
      allowedRoles: rule.allowedRoles,
      description: rule.description,
    }));
}

/**
 * Centralized Deterministic Transition Function: δ(currentState, event, context)
 *
 * @param {string} currentState - Current DFA state (q ∈ Q)
 * @param {string} event        - Input symbol / event (σ ∈ Σ)
 * @param {object} [options]    - Optional actor context { role }
 * @returns {{
 *   previousState: string,
 *   event: string,
 *   nextState: string,
 *   isTerminal: boolean,
 *   allowedRoles: string[],
 *   description: string,
 *   timestamp: string
 * }}
 * @throws {DFATransitionError} with statusCode 409 (or 403 if role is unauthorized for a valid transition)
 */
function evaluateTransition(currentState, event, options = {}) {
  // 1. Validate state ∈ Q
  if (!isValidState(currentState)) {
    throw new DFATransitionError(
      `Invalid current DFA state '${currentState}'. Must be one of: ${Object.values(DFA_STATES).join(', ')}.`,
      409,
      {
        code: 'UNKNOWN_DFA_STATE',
        currentState,
        event,
      }
    );
  }

  // 2. Validate event ∈ Σ
  if (!isValidEvent(event)) {
    throw new DFATransitionError(
      `Invalid DFA input event '${event}'. Must be one of: ${Object.values(DFA_EVENTS).join(', ')}.`,
      409,
      {
        code: 'UNKNOWN_DFA_EVENT',
        currentState,
        event,
        allowedEvents: getAllowedEvents(currentState).map((e) => e.event),
      }
    );
  }

  // 3. Reject any transition out of a terminal state (F = { CANCELLED, REJECTED, COMPLETED })
  if (isTerminalState(currentState)) {
    throw new DFATransitionError(
      `Cannot apply event '${event}' because appointment is in terminal state '${currentState}'. Terminal states do not permit further transitions.`,
      409,
      {
        code: 'TERMINAL_STATE_LOCKED',
        currentState,
        event,
        isTerminal: true,
        allowedEvents: [],
      }
    );
  }

  // 4. Lookup deterministic transition δ(q, σ)
  const stateRules = TRANSITION_TABLE[currentState] || {};
  const transitionRule = stateRules[event];

  if (!transitionRule) {
    const validEvents = Object.keys(stateRules);
    throw new DFATransitionError(
      `Invalid DFA state transition: δ(${currentState}, ${event}) is undefined. Allowed events from '${currentState}': [${validEvents.join(', ')}].`,
      409,
      {
        code: 'INVALID_STATE_TRANSITION',
        currentState,
        event,
        isTerminal: false,
        allowedEvents: validEvents,
      }
    );
  }

  // 5. Optional Role Authorization Check on the transition
  if (options.role && !transitionRule.allowedRoles.includes(options.role)) {
    throw new DFATransitionError(
      `Role '${options.role}' is not permitted to trigger event '${event}' from state '${currentState}'. Permitted roles: [${transitionRule.allowedRoles.join(', ')}].`,
      403,
      {
        code: 'UNAUTHORIZED_DFA_EVENT_ROLE',
        currentState,
        event,
        allowedEvents: getAllowedEvents(currentState, options.role).map((e) => e.event),
      }
    );
  }

  const nextState = transitionRule.nextState;

  return {
    previousState: currentState,
    event,
    nextState,
    isTerminal: isTerminalState(nextState),
    allowedRoles: transitionRule.allowedRoles,
    description: transitionRule.description,
    timestamp: new Date().toISOString(),
  };
}

module.exports = {
  DFA_STATES,
  DFA_EVENTS,
  INITIAL_STATE,
  TERMINAL_STATES,
  DFATransitionError,
  isValidState,
  isValidEvent,
  isTerminalState,
  getAllowedEvents,
  evaluateTransition,
  getFormalDFADefinition,
};
