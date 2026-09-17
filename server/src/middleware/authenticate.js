/**
 * JWT authentication middleware.
 *
 * Verifies the Bearer token from the Authorization header.
 * On success, attaches { id, role, permissions } to req.user.
 * On failure, responds with 401.
 */

import jwt from "jsonwebtoken";
import config from "../config/index.js";

export function authenticate(req, res, next) {
  let token = null;
  const header = req.headers.authorization;
  if (header && header.startsWith("Bearer ")) {
    token = header.split(" ")[1];
  } else if (req.query.serviceToken) {
    token = req.query.serviceToken;
  }

  if (!token) {
    return res.status(401).json({
      message: "Authentication required",
      code: "UNAUTHORIZED",
    });
  }

  try {
    const decoded = jwt.verify(token, config.jwt.secret);

    // Scoped service token for headless PDF brochure rendering
    if (decoded.type === "brochure_render") {
      req.serviceToken = decoded;
      req.user = {
        id: "service-brochure",
        role: "service",
        permissions: [],
      };
      return next();
    }

    req.user = {
      id: decoded.id,
      role: decoded.role,
      permissions: decoded.permissions || [],
    };
    next();
  } catch (err) {
    const message =
      err.name === "TokenExpiredError"
        ? "Token expired — please log in again"
        : "Invalid token";

    return res.status(401).json({
      message,
      code: "UNAUTHORIZED",
    });
  }
}
