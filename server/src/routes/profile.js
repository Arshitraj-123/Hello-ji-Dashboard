/**
 * Profile self-service routes — isolated from admin endpoints and password change.
 *
 * GET /api/profile — authenticated, returns caller's own profile
 * PUT /api/profile — authenticated, updates allowed fields (name, email, phone, address, photo)
 */

import { Router } from "express";
import multer from "multer";
import User from "../models/User.js";
import { authenticate } from "../middleware/authenticate.js";
import { validate } from "../middleware/validate.js";
import { uploadProfilePhoto } from "../middleware/upload.js";
import { updateProfileRules } from "../validators/profile.js";

const router = Router();

// All routes operate exclusively on the authenticated user from the JWT
router.use(authenticate);

// Middleware to gracefully handle multer errors (file size, file type)
const handlePhotoUpload = (req, res, next) => {
  uploadProfilePhoto.single("photo")(req, res, (err) => {
    if (err) {
      if (err instanceof multer.MulterError) {
        if (err.code === "LIMIT_FILE_SIZE") {
          return res.status(400).json({
            message: "File size exceeds 5MB limit",
            code: "FILE_TOO_LARGE",
          });
        }
        return res.status(400).json({
          message: err.message,
          code: "UPLOAD_ERROR",
        });
      }
      return res.status(err.status || 400).json({
        message: err.message || "File upload failed",
        code: err.code || "UPLOAD_ERROR",
      });
    }
    next();
  });
};

// ─── GET / — Get authenticated user's profile ────────────────────────────
router.get("/", async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({
        message: "User not found",
        code: "NOT_FOUND",
      });
    }

    return res.json({ user: user.toJSON() });
  } catch (err) {
    next(err);
  }
});

// ─── PUT / — Self-service profile update ─────────────────────────────────
// Allows updating ONLY: name, email, phone, address, photo
// Strictly forbids: password, passwordHash, role, permissions, status, createdBy
router.put(
  "/",
  handlePhotoUpload,
  updateProfileRules,
  validate,
  async (req, res, next) => {
    try {
      // ── Additional server-side safety check: reject forbidden fields ───
      const FORBIDDEN_FIELDS = [
        "password",
        "passwordHash",
        "role",
        "permissions",
        "status",
        "createdBy",
        "id",
        "_id",
      ];
      for (const field of FORBIDDEN_FIELDS) {
        if (req.body[field] !== undefined) {
          return res.status(400).json({
            message: `Field '${field}' cannot be updated via profile self-service`,
            code: "FORBIDDEN_FIELD",
            field,
          });
        }
      }

      const user = await User.findById(req.user.id);
      if (!user) {
        return res.status(404).json({
          message: "User not found",
          code: "NOT_FOUND",
        });
      }

      // Calculate future email & phone values to validate uniqueness and non-empty constraint
      const nextEmail =
        req.body.email !== undefined
          ? req.body.email
            ? req.body.email.toLowerCase().trim()
            : null
          : user.email;

      const nextPhone =
        req.body.phone !== undefined
          ? req.body.phone
            ? req.body.phone.trim()
            : null
          : user.phone;

      if (!nextEmail && !nextPhone) {
        return res.status(400).json({
          message: "At least one of email or phone must be provided",
          code: "VALIDATION_ERROR",
        });
      }

      // Check uniqueness against OTHER users (excluding the user's own current record)
      const duplicateConditions = [];
      if (nextEmail && nextEmail !== user.email) {
        duplicateConditions.push({ email: nextEmail });
      }
      if (nextPhone && nextPhone !== user.phone) {
        duplicateConditions.push({ phone: nextPhone });
      }

      if (duplicateConditions.length > 0) {
        const existing = await User.findOne({
          _id: { $ne: user._id },
          $or: duplicateConditions,
        });

        if (existing) {
          const field = existing.email === nextEmail ? "email" : "phone";
          return res.status(409).json({
            message: `A user with this ${field} already exists`,
            code: "DUPLICATE",
            field,
          });
        }
      }

      // Apply permitted fields
      if (req.body.name !== undefined) {
        user.name = req.body.name.trim();
      }
      if (req.body.email !== undefined) {
        user.email = nextEmail || undefined;
      }
      if (req.body.phone !== undefined) {
        user.phone = nextPhone || undefined;
      }
      if (req.body.address !== undefined) {
        user.address = req.body.address.trim();
      }

      // Handle photo upload (multipart file takes precedence over photo text field)
      if (req.file) {
        user.photo = `/uploads/profile-photos/${req.file.filename}`;
      } else if (req.body.photo !== undefined) {
        user.photo = req.body.photo;
      }

      await user.save();

      return res.json({
        message: "Profile updated successfully",
        user: user.toJSON(),
      });
    } catch (err) {
      if (err.code === 11000) {
        const field = Object.keys(err.keyPattern)[0];
        return res.status(409).json({
          message: `A user with this ${field} already exists`,
          code: "DUPLICATE",
          field,
        });
      }
      next(err);
    }
  }
);

export default router;
