/**
 * Validation runner middleware.
 *
 * Call after an array of express-validator checks.  If any check failed,
 * responds with 422 and a structured error array; otherwise calls next().
 */

import { validationResult } from "express-validator";

export function validate(req, res, next) {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    return res.status(422).json({
      message: "Validation failed",
      code: "VALIDATION_ERROR",
      errors: errors.array().map((e) => ({
        field: e.path,
        message: e.msg,
      })),
    });
  }

  next();
}
