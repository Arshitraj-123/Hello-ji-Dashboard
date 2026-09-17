/**
 * Multer upload configuration for profile photos.
 *
 * Saves uploaded images to server/uploads/profile-photos/
 * Validates mime types (JPEG, PNG, WebP, GIF) and restricts file size to 5MB.
 */

import multer from "multer";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Uploads root directory: <server-root>/uploads/profile-photos
export const UPLOAD_DIR = path.resolve(__dirname, "../../uploads/profile-photos");

// Ensure directory exists synchronously on initialization
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    if (!fs.existsSync(UPLOAD_DIR)) {
      fs.mkdirSync(UPLOAD_DIR, { recursive: true });
    }
    cb(null, UPLOAD_DIR);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || ".jpg";
    const userId = req.user?.id || "anon";
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e5)}`;
    cb(null, `photo-${userId}-${uniqueSuffix}${ext}`);
  },
});

const fileFilter = (_req, file, cb) => {
  const allowedMimeTypes = [
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
  ];
  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    const err = new Error("Only JPEG, PNG, WebP, and GIF images are allowed");
    err.status = 400;
    err.code = "INVALID_FILE_TYPE";
    cb(err, false);
  }
};

export const uploadProfilePhoto = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
  },
});
