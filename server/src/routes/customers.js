/**
 * Visa Customers & Document Management Routes.
 *
 * Enforces:
 * 1. customer.add on creation.
 * 2. customer.view on listing and detail.
 * 3. trash.recycleBin on customer recycle bin, restore, and force-delete.
 * 4. Additive file upload on customer update (never deletes old files).
 * 5. Cascade soft-delete & restore between customer and documents.
 * 6. Direct permanent delete of individual document with disk unlinking.
 * 7. Force-delete customer with physical unlinking of all remaining files from disk.
 * 8. Dedicated customer recycle bin independent from bookings and hotels bins.
 */

import { Router } from "express";
import path from "path";
import fs from "fs";
import Customer from "../models/Customer.js";
import Document from "../models/Document.js";
import { authenticate } from "../middleware/authenticate.js";
import { requirePermission } from "../middleware/authorize.js";
import { validate } from "../middleware/validate.js";
import {
  createCustomerRules,
  updateCustomerRules,
  mongoIdParam,
} from "../validators/customer.js";
import {
  uploadCustomerDocs,
  ensureFileInCustomerFolder,
  CUSTOMER_UPLOADS_BASE,
  sanitizePhoneFolder,
} from "../middleware/uploadCustomerDoc.js";

const router = Router();

router.use(authenticate);

/**
 * POST /api/customers
 * Create a new visa customer with optional file uploads.
 * Gated by: customer.add
 */
router.post(
  "/",
  requirePermission("customer.add"),
  uploadCustomerDocs.array("files", 10),
  createCustomerRules,
  validate,
  async (req, res, next) => {
    try {
      const {
        name,
        city = "",
        phone,
        documentType = "Passport",
        reference = "",
        remarks = "",
      } = req.body;

      const customer = new Customer({
        name,
        city,
        phone,
        documentType,
        reference,
        remarks,
        deletedAt: null,
      });

      await customer.save();

      // Process uploaded files into Document records
      const savedDocs = [];
      if (req.files && req.files.length > 0) {
        for (const file of req.files) {
          const { diskPath, filePath } = await ensureFileInCustomerFolder(
            file,
            customer.phone
          );

          const ext = path.extname(file.originalname).replace(".", "").toLowerCase();
          const doc = new Document({
            customerId: customer._id,
            fileName: file.originalname,
            filePath,
            diskPath,
            fileType: ext || "file",
            fileSize: file.size,
            deletedAt: null,
          });

          await doc.save();
          savedDocs.push(doc);
        }
      }

      const responseObj = customer.toJSON();
      responseObj.documents = savedDocs;
      return res.status(201).json(responseObj);
    } catch (err) {
      next(err);
    }
  }
);

/**
 * GET /api/customers
 * List active visa customers.
 * Gated by: customer.view
 */
router.get(
  "/",
  requirePermission("customer.view"),
  async (req, res, next) => {
    try {
      const queryFilter = { deletedAt: null };

      if (req.query.q) {
        const searchRegex = new RegExp(req.query.q.trim(), "i");
        queryFilter.$or = [
          { name: searchRegex },
          { phone: searchRegex },
          { city: searchRegex },
          { documentType: searchRegex },
          { reference: searchRegex },
          { remarks: searchRegex },
        ];
      }

      const page = Math.max(1, parseInt(req.query.page, 10) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 25));
      const skip = (page - 1) * limit;

      const sortField = req.query.sort || "createdAt";
      const sortDir = req.query.dir === "asc" ? 1 : -1;
      const sort = { [sortField]: sortDir };

      const [items, total] = await Promise.all([
        Customer.find(queryFilter).sort(sort).skip(skip).limit(limit).lean(),
        Customer.countDocuments(queryFilter),
      ]);

      // Attach active document counts for each customer
      const customerIds = items.map((c) => c._id);
      const docs = await Document.find({
        customerId: { $in: customerIds },
        deletedAt: null,
      }).lean();

      const docsByCustomer = docs.reduce((acc, d) => {
        const cId = d.customerId.toString();
        acc[cId] = acc[cId] || [];
        acc[cId].push({
          id: d._id.toString(),
          fileName: d.fileName,
          filePath: d.filePath,
          fileType: d.fileType,
          fileSize: d.fileSize,
        });
        return acc;
      }, {});

      const formatted = items.map((doc) => {
        const item = { ...doc, id: doc._id.toString() };
        delete item.__v;
        item.documents = docsByCustomer[item.id] || [];
        return item;
      });

      return res.json({
        data: formatted,
        pagination: {
          total,
          page,
          limit,
          pages: Math.ceil(total / limit) || 1,
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * GET /api/customers/recycle-bin
 * List soft-deleted customers (Customer dedicated bin).
 * Gated by: trash.recycleBin
 */
router.get(
  "/recycle-bin",
  requirePermission("trash.recycleBin"),
  async (req, res, next) => {
    try {
      const queryFilter = { deletedAt: { $ne: null } };

      if (req.query.q) {
        const searchRegex = new RegExp(req.query.q.trim(), "i");
        queryFilter.$or = [
          { name: searchRegex },
          { phone: searchRegex },
          { city: searchRegex },
          { reference: searchRegex },
        ];
      }

      const page = Math.max(1, parseInt(req.query.page, 10) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 25));
      const skip = (page - 1) * limit;

      const sortField = req.query.sort || "deletedAt";
      const sortDir = req.query.dir === "asc" ? 1 : -1;
      const sort = { [sortField]: sortDir };

      const [items, total] = await Promise.all([
        Customer.find(queryFilter).sort(sort).skip(skip).limit(limit).lean(),
        Customer.countDocuments(queryFilter),
      ]);

      const formatted = items.map((doc) => {
        const item = { ...doc, id: doc._id.toString() };
        delete item.__v;
        return item;
      });

      return res.json({
        data: formatted,
        pagination: {
          total,
          page,
          limit,
          pages: Math.ceil(total / limit) || 1,
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * GET /api/customers/:id
 * Detail view of single active customer with populated active documents.
 */
router.get("/:id", mongoIdParam("id"), validate, async (req, res, next) => {
  try {
    const customer = await Customer.findOne({
      _id: req.params.id,
      deletedAt: null,
    });

    if (!customer) {
      return res.status(404).json({
        message: "Customer not found",
        code: "NOT_FOUND",
      });
    }

    const documents = await Document.find({
      customerId: customer._id,
      deletedAt: null,
    }).sort({ createdAt: -1 });

    const responseObj = customer.toJSON();
    responseObj.documents = documents;
    return res.json(responseObj);
  } catch (err) {
    next(err);
  }
});

/**
 * PUT /api/customers/:id
 * Update customer details and additively append newly uploaded files.
 */
router.put(
  "/:id",
  uploadCustomerDocs.array("files", 10),
  updateCustomerRules,
  validate,
  async (req, res, next) => {
    try {
      const customer = await Customer.findOne({
        _id: req.params.id,
        deletedAt: null,
      });

      if (!customer) {
        return res.status(404).json({
          message: "Customer not found",
          code: "NOT_FOUND",
        });
      }

      const updatable = [
        "name",
        "city",
        "phone",
        "documentType",
        "reference",
        "remarks",
      ];

      updatable.forEach((field) => {
        if (req.body[field] !== undefined) {
          customer[field] = req.body[field];
        }
      });

      await customer.save();

      // Additive document uploads — newly uploaded files are added without deleting existing files
      if (req.files && req.files.length > 0) {
        for (const file of req.files) {
          const { diskPath, filePath } = await ensureFileInCustomerFolder(
            file,
            customer.phone
          );

          const ext = path.extname(file.originalname).replace(".", "").toLowerCase();
          const doc = new Document({
            customerId: customer._id,
            fileName: file.originalname,
            filePath,
            diskPath,
            fileType: ext || "file",
            fileSize: file.size,
            deletedAt: null,
          });

          await doc.save();
        }
      }

      const allActiveDocs = await Document.find({
        customerId: customer._id,
        deletedAt: null,
      }).sort({ createdAt: -1 });

      const responseObj = customer.toJSON();
      responseObj.documents = allActiveDocs;
      return res.json(responseObj);
    } catch (err) {
      next(err);
    }
  }
);

/**
 * DELETE /api/customers/:id
 * Soft delete customer AND cascade-soft-delete all associated documents.
 */
router.delete("/:id", mongoIdParam("id"), validate, async (req, res, next) => {
  try {
    const customer = await Customer.findOne({
      _id: req.params.id,
      deletedAt: null,
    });

    if (!customer) {
      return res.status(404).json({
        message: "Customer not found",
        code: "NOT_FOUND",
      });
    }

    const deleteDate = new Date();
    customer.deletedAt = deleteDate;
    await customer.save();

    // Cascade soft-delete on all associated documents
    await Document.updateMany(
      { customerId: customer._id, deletedAt: null },
      { deletedAt: deleteDate }
    );

    return res.json({
      message: "Customer and associated documents moved to recycle bin",
      code: "DELETED",
      id: customer._id.toString(),
    });
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/customers/documents/:documentId
 * Direct, permanent removal of a single document record and its file from disk.
 */
router.delete(
  "/documents/:documentId",
  mongoIdParam("documentId"),
  validate,
  async (req, res, next) => {
    try {
      const doc = await Document.findById(req.params.documentId);

      if (!doc) {
        return res.status(404).json({
          message: "Document not found",
          code: "NOT_FOUND",
        });
      }

      // Unlink physical file from disk
      try {
        if (doc.diskPath && fs.existsSync(doc.diskPath)) {
          await fs.promises.unlink(doc.diskPath);
        }
      } catch (err) {
        console.warn(
          `[customer-doc] Warning: Failed to unlink file ${doc.diskPath}:`,
          err.message
        );
      }

      // Immediately delete DB record (permanent delete, not soft)
      await Document.findByIdAndDelete(doc._id);

      return res.json({
        message: "Document deleted permanently",
        code: "DOCUMENT_DELETED",
        id: doc._id.toString(),
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /api/customers/:id/restore
 * Restore customer AND cascade-restore all associated documents.
 * Gated by: trash.recycleBin
 */
router.post(
  "/:id/restore",
  requirePermission("trash.recycleBin"),
  mongoIdParam("id"),
  validate,
  async (req, res, next) => {
    try {
      const customer = await Customer.findOne({
        _id: req.params.id,
        deletedAt: { $ne: null },
      });

      if (!customer) {
        return res.status(404).json({
          message: "Customer not found in recycle bin",
          code: "NOT_FOUND",
        });
      }

      customer.deletedAt = null;
      await customer.save();

      // Cascade restore on documents
      await Document.updateMany(
        { customerId: customer._id },
        { deletedAt: null }
      );

      return res.json({
        message: "Customer and associated documents restored successfully",
        code: "RESTORED",
        id: customer._id.toString(),
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * DELETE /api/customers/:id/force
 * Permanently delete customer record, its document records, AND unlinks all files from disk.
 * Gated by: trash.recycleBin
 */
router.delete(
  "/:id/force",
  requirePermission("trash.recycleBin"),
  mongoIdParam("id"),
  validate,
  async (req, res, next) => {
    try {
      const customer = await Customer.findOne({
        _id: req.params.id,
        deletedAt: { $ne: null },
      });

      if (!customer) {
        return res.status(404).json({
          message: "Customer not found in recycle bin",
          code: "NOT_FOUND",
        });
      }

      const customerId = customer._id;
      const phone = customer.phone;

      // Find all associated documents
      const docs = await Document.find({ customerId });

      // Physically unlink files from disk
      for (const doc of docs) {
        try {
          if (doc.diskPath && fs.existsSync(doc.diskPath)) {
            await fs.promises.unlink(doc.diskPath);
          }
        } catch (err) {
          console.warn(
            `[customer-doc] Warning: Failed to unlink file ${doc.diskPath}:`,
            err.message
          );
        }
      }

      // Attempt to clean customer phone folder if empty
      const customerDir = path.join(
        CUSTOMER_UPLOADS_BASE,
        sanitizePhoneFolder(phone)
      );
      try {
        if (
          fs.existsSync(customerDir) &&
          fs.readdirSync(customerDir).length === 0
        ) {
          await fs.promises.rmdir(customerDir);
        }
      } catch (err) {
        console.warn(
          `[customer-doc] Warning: Failed to remove directory ${customerDir}:`,
          err.message
        );
      }

      // Delete document records from MongoDB
      await Document.deleteMany({ customerId });

      // Delete customer record from MongoDB
      await Customer.findByIdAndDelete(customerId);

      return res.json({
        message: "Customer and all documents permanently deleted",
        code: "FORCE_DELETED",
        id: customerId.toString(),
      });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
