/**
 * Auth routes — login, self-service password change, and session hydration.
 *
 * POST /api/auth/login           — public, rate-limited
 * POST /api/auth/change-password — authenticated
 * GET  /api/auth/me              — authenticated
 */

import { Router } from "express";
import jwt from "jsonwebtoken";
import rateLimit from "express-rate-limit";
import User from "../models/User.js";
import config from "../config/index.js";
import { authenticate } from "../middleware/authenticate.js";
import { validate } from "../middleware/validate.js";
import { loginRules, changePasswordRules } from "../validators/auth.js";

const router = Router();

// ─── Rate limiter for login — 10 attempts per 15 minutes per IP ──────────
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    message: "Too many login attempts. Please try again later.",
    code: "RATE_LIMITED",
  },
});

// ─── POST /login ─────────────────────────────────────────────────────────
router.post("/login", loginLimiter, loginRules, validate, async (req, res, next) => {
  try {
    const { identifier, password } = req.body;

    // Look up by email OR phone — using select('+passwordHash') is not
    // needed here because we query the raw document; the toJSON transform
    // strips it on serialisation, but we need the actual hash for compare.
    const user = await User.findOne({
      $or: [
        { email: identifier.toLowerCase() },
        { phone: identifier },
      ],
    }).select("+passwordHash");

    // ── Generic "invalid credentials" for both not-found and wrong-password
    //    so the endpoint doesn't leak which identifiers are registered. ───
    if (!user) {
      return res.status(401).json({
        message: "Invalid credentials",
        code: "INVALID_CREDENTIALS",
      });
    }

    // The schema transform strips passwordHash from toJSON, but the
    // Mongoose document still has it in memory — access it directly.
    const rawHash = user.get("passwordHash");
    const isMatch = await user.comparePassword(password);

    if (!isMatch) {
      return res.status(401).json({
        message: "Invalid credentials",
        code: "INVALID_CREDENTIALS",
      });
    }

    // ── Active check — reject inactive accounts with a clear error ───
    if (user.status !== "active") {
      return res.status(403).json({
        message: "Account is inactive. Contact your administrator.",
        code: "ACCOUNT_INACTIVE",
      });
    }

    // ── Sign JWT — minimal payload ───────────────────────────────────
    const payload = {
      id: user._id,
      role: user.role,
      permissions: user.permissions,
    };

    const token = jwt.sign(payload, config.jwt.secret, {
      expiresIn: config.jwt.expiresIn,
    });

    // user.toJSON() automatically strips passwordHash via schema transform
    return res.json({
      token,
      user: user.toJSON(),
    });
  } catch (err) {
    next(err);
  }
});

// ─── POST /change-password ───────────────────────────────────────────────
router.post(
  "/change-password",
  authenticate,
  changePasswordRules,
  validate,
  async (req, res, next) => {
    try {
      const { currentPassword, newPassword } = req.body;

      // Always operates on the authenticated user — never accepts a target
      // user id from the request body.
      const user = await User.findById(req.user.id);

      if (!user) {
        return res.status(404).json({
          message: "User not found",
          code: "NOT_FOUND",
        });
      }

      // Verify current password before allowing the change — protects
      // against a hijacked session being used to lock the real owner out.
      const isMatch = await user.comparePassword(currentPassword);

      if (!isMatch) {
        return res.status(401).json({
          message: "Current password is incorrect",
          code: "INVALID_CREDENTIALS",
        });
      }

      user.passwordHash = await User.hashPassword(newPassword);
      await user.save();

      return res.json({
        message: "Password changed successfully",
      });
    } catch (err) {
      next(err);
    }
  }
);

// ─── GET /me ─────────────────────────────────────────────────────────────
router.get("/me", authenticate, async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({
        message: "User not found",
        code: "NOT_FOUND",
      });
    }

    // toJSON() strips passwordHash automatically
    return res.json({ user: user.toJSON() });
  } catch (err) {
    next(err);
  }
});

export default router;
