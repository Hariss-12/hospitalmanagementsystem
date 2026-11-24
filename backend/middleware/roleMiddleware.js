/**
 * Role-Based Access Control (RBAC) Authorization Middleware
 *
 * Enforces that `req.user.role` (hydrated from the database by `authenticate`)
 * belongs to the list of permitted roles for the endpoint.
 */

function authorizeRoles(...allowedRoles) {
  const flatRoles = allowedRoles.flat();
  return function roleGuard(req, res, next) {
    if (!req.user || !req.user.role) {
      return res.status(401).json({
        success: false,
        error: {
          message: 'Authentication required before role authorization.',
          code: 'UNAUTHENTICATED',
        },
      });
    }

    if (!flatRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: {
          message: `Access denied: Role '${req.user.role}' is not authorized to access this resource.`,
          code: 'FORBIDDEN_ROLE',
          requiredRoles: flatRoles,
        },
      });
    }

    next();
  };
}

module.exports = {
  authorizeRoles,
};
