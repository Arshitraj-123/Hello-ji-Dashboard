/**
 * Multer upload configuration for Customer documents.
 *
 * Saves files under: server/uploads/customers/{sanitizedPhone}/
 * Validates mime types: PDFs and standard images (JPEG, PNG, WebP, GIF)
 * File size limit: 5MB per file, up to 10 files per upload.
 */

import multer from "multer";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const CUSTOMER_UPLOADS_BASE = path.resolve(
  __dirname,
  "../../uploads/customers"
);

// Ensure base upload directory exists
if (!fs.existsSync(CUSTOMER_UPLOADS_BASE)) {
  fs.mkdirSync(CUSTOMER_UPLOADS_BASE, { recursive: true });
}

/** Sanitizes phone string for safe folder name */
export function sanitizePhoneFolder(phone) {
  if (!phone) return "unknown";
  return String(phone).replace(/[^a-zA-Z0-9_-]/g, "_").trim() || "unknown";
}

const storage = multer.diskStorage({
  destination: (req, _file, cb) => {
    const phone = req.customerPhone || req.body?.phone || "temp";
    const folderName = sanitizePhoneFolder(phone);
    const targetDir = path.join(CUSTOMER_UPLOADS_BASE, folderName);

    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }
    cb(null, targetDir);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const baseName = path
      .basename(file.originalname, ext)
      .replace(/[^a-zA-Z0-9._-]/g, "_")
      .slice(0, 50);
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e4)}`;
    cb(null, `${baseName}-${uniqueSuffix}${ext}`);
  },
});

const fileFilter = (_req, file, cb) => {
  const allowedMimeTypes = [
    "application/pdf",
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
  ];

  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    const err = new Error(
      "Only PDF and image files (JPEG, PNG, WebP, GIF) are allowed for customer documents"
    );
    err.status = 400;
    err.code = "INVALID_FILE_TYPE";
    cb(err, false);
  }
};

export const uploadCustomerDocs = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
    files: 10,
  },
});

/**
 * Ensures uploaded file is located in the correct customer phone directory.
 * Returns { diskPath, filePath }.
 */
export async function ensureFileInCustomerFolder(file, phone) {
  const targetFolder = sanitizePhoneFolder(phone);
  const targetDir = path.join(CUSTOMER_UPLOADS_BASE, targetFolder);
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  const currentPath = file.path;
  const targetPath = path.join(targetDir, file.filename);

  if (currentPath !== targetPath) {
    await fs.promises.rename(currentPath, targetPath);
  }

  return {
    diskPath: targetPath,
    filePath: `/uploads/customers/${targetFolder}/${file.filename}`,
  };
}
