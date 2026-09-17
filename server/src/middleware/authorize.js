/**
 * Authorization middleware — composable role and permission checks.
 *
 * Both return 403 with code "FORBIDDEN" (distinct from 401 "UNAUTHORIZED")
 * so the frontend can tell "log in again" from "you don't have access."
 */

/**
 * Restrict access to users whose role is in the given list.
 *
 * Usage: router.post('/users', authenticate, authorize('admin'), handler)
 */
export function authorize(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        message: "Authentication required",
        code: "UNAUTHORIZED",
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        message: "You do not have permission to access this resource",
        code: "FORBIDDEN",
      });
    }

    next();
  };
}

/**
 * Restrict access to users who hold a specific permission key.
 *
 * Usage: router.get('/logs', authenticate, requirePermission('user.log'), handler)
 */
export function requirePermission(permissionKey) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        message: "Authentication required",
        code: "UNAUTHORIZED",
      });
    }

    // Admins implicitly pass permission checks
    if (req.user.role === "admin") {
      return next();
    }

    if (!req.user.permissions.includes(permissionKey)) {
      return res.status(403).json({
        message: `Missing required permission: ${permissionKey}`,
        code: "FORBIDDEN",
      });
    }

    next();
  };
}
