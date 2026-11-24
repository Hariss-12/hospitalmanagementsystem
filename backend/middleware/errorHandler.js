/**
 * Centralized Error Handling Middleware
 *
 * Formats DFA transition conflicts (HTTP 409), validation errors (HTTP 400),
 * authentication/authorization errors (HTTP 401/403), and unexpected exceptions (HTTP 500)
 * without leaking internal stack traces, file paths, or secrets.
 */

const { DFATransitionError } = require('../dfa/dfaEngine');

function notFoundHandler(req, res, _next) {
  res.status(404).json({
    success: false,
    error: {
      message: `API endpoint not found: ${req.method} ${req.path}`,
      code: 'ENDPOINT_NOT_FOUND',
    },
  });
}

function errorHandler(err, _req, res, _next) {
  // 1. DFA State Transition Conflicts (HTTP 409 or 403)
  if (err instanceof DFATransitionError || err.name === 'DFATransitionError') {
    const status = err.statusCode || 409;
    return res.status(status).json({
      success: false,
      error: {
        message: err.message,
        code: err.code || 'INVALID_DFA_TRANSITION',
        currentState: err.currentState,
        event: err.event,
        isTerminal: err.isTerminal,
        allowedEvents: err.allowedEvents,
      },
    });
  }

  // 2. Duplicate Key / Double-Booking Conflict (MongoDB E11000)
  if (err.code === 11000) {
    return res.status(409).json({
      success: false,
      error: {
        message: err.message || 'Resource conflict or duplicate record detected.',
        code: 'DUPLICATE_OR_SLOT_CONFLICT',
      },
    });
  }

  // 3. Mongoose / Schema Validation Error
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      success: false,
      error: {
        message: err.message || 'Input validation failed.',
        code: 'VALIDATION_ERROR',
      },
    });
  }

  // 4. Explicit HTTP Status Errors (400, 401, 403, 404, 409, 429)
  const statusCode = err.statusCode || err.status || 500;
  if (statusCode >= 400 && statusCode < 500) {
    return res.status(statusCode).json({
      success: false,
      error: {
        message: err.message || 'Request could not be processed.',
        code: err.code || 'CLIENT_REQUEST_ERROR',
      },
    });
  }

  // 5. Internal Server Error (Sanitized to prevent stack trace / sensitive data leakage)
  return res.status(500).json({
    success: false,
    error: {
      message: 'An unexpected internal server error occurred.',
      code: 'INTERNAL_SERVER_ERROR',
    },
  });
}

module.exports = {
  notFoundHandler,
  errorHandler,
};
