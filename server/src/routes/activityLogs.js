/**
 * Activity Log Routes — Audit trail listing endpoint.
 *
 * Enforces:
 * 1. user.log permission gating (spec section 4.16).
 * 2. Populates acting user details.
 * 3. Supports filtering by tableName, activityType, userId, date range, and text search.
 * 4. Standard pagination (page, limit, total, pages).
 */

import { Router } from "express";
import ActivityLog from "../models/ActivityLog.js";
import { authenticate } from "../middleware/authenticate.js";
import { requirePermission } from "../middleware/authorize.js";

const router = Router();

router.use(authenticate);
router.use(requirePermission("user.log"));

/**
 * GET /api/activity-logs
 * List activity logs sorted by most recent first.
 */
router.get("/", async (req, res, next) => {
  try {
    const queryFilter = {};

    // Filter by table (booking, hotel, customer)
    if (req.query.tableName) {
      queryFilter.tableName = req.query.tableName.toLowerCase().trim();
    }

    // Filter by activity type
    if (req.query.activityType) {
      queryFilter.activityType = req.query.activityType.trim();
    }

    // Filter by acting user ID
    if (req.query.userId) {
      queryFilter.userId = req.query.userId;
    }

    // Date range filter on createdAt
    const start = req.query.startDate || req.query.start;
    const end = req.query.endDate || req.query.end;
    if (start || end) {
      queryFilter.createdAt = {};
      if (start) {
        queryFilter.createdAt.$gte = new Date(start);
      }
      if (end) {
        const endDateObj = new Date(end);
        // If date string has no time, extend to end of day
        if (typeof end === "string" && end.length <= 10) {
          endDateObj.setHours(23, 59, 59, 999);
        }
        queryFilter.createdAt.$lte = endDateObj;
      }
    }

    // Text search filter
    if (req.query.q) {
      const searchRegex = new RegExp(req.query.q.trim(), "i");
      queryFilter.$or = [
        { userName: searchRegex },
        { recordId: searchRegex },
        { ip: searchRegex },
        { activityType: searchRegex },
        { tableName: searchRegex },
        { changedData: searchRegex },
      ];
    }

    // Pagination
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 25));
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      ActivityLog.find(queryFilter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate("userId", "name email role photoUrl")
        .lean(),
      ActivityLog.countDocuments(queryFilter),
    ]);

    const formatted = items.map((doc) => {
      const item = { ...doc, id: doc._id.toString() };
      delete item.__v;
      item.user = doc.userName || doc.userId?.name || "System";
      item.tableId = doc.recordId;
      item.at = doc.createdAt ? new Date(doc.createdAt).toISOString() : "";
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
});

export default router;
