/**
 * Accounts Routes — Unpaid & Paid Billing Views over the Booking Collection.
 *
 * Enforces:
 * 1. accounts.menu permission check on all endpoints.
 * 2. Role-based visibility rule ($or: [{ createdBy }, { assignedAgent }]) for agents.
 * 3. Dedicated billing update endpoint.
 * 4. Normal activity logging on underlying booking record.
 */

import { Router } from "express";
import Booking from "../models/Booking.js";
import { authenticate } from "../middleware/authenticate.js";
import { requirePermission } from "../middleware/authorize.js";
import { validate } from "../middleware/validate.js";
import { updateBillingRules } from "../validators/accounts.js";
import {
  buildVisibilityFilter,
  canAccessDocument,
  applyRaisedByFilter,
} from "../utils/crmVisibility.js";
import { recordActivity } from "../models/ActivityLog.js";

const router = Router();

router.use(authenticate);
router.use(requirePermission("accounts.menu"));

/** Helper for listing accounts bookings with search, pagination, and visibility */
async function listAccountsWithFilter(req, res, next, billingFilter) {
  try {
    const visibilityFilter = buildVisibilityFilter(req.user, "booking.viewAll");

    const andConditions = [
      { status: "booked", deletedAt: null },
    ];

    if (Object.keys(visibilityFilter).length > 0) {
      andConditions.push(visibilityFilter);
    }

    if (billingFilter && Object.keys(billingFilter).length > 0) {
      andConditions.push(billingFilter);
    }

    if (req.query.q) {
      const searchRegex = new RegExp(req.query.q.trim(), "i");
      andConditions.push({
        $or: [
          { name: searchRegex },
          { email: searchRegex },
          { phone: searchRegex },
          { city: searchRegex },
          { bookingId: searchRegex },
          { billingNumber: searchRegex },
          { billingRemark: searchRegex },
          { propertyName: searchRegex },
        ],
      });
    }

    const queryFilter = andConditions.length > 1 ? { $and: andConditions } : andConditions[0] || {};

    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 25));
    const skip = (page - 1) * limit;

    const sortField = req.query.sort || "createdAt";
    const sortDir = req.query.dir === "asc" ? 1 : -1;
    const sort = { [sortField]: sortDir };

    const [items, total] = await Promise.all([
      Booking.find(queryFilter)
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .populate("assignedAgent", "name email role photoUrl")
        .populate("createdBy", "name email role photoUrl")
        .lean(),
      Booking.countDocuments(queryFilter),
    ]);

    const formatted = items.map((doc) => {
      const item = { ...doc, id: doc._id.toString() };
      delete item.__v;
      return item;
    });

    const filteredData = applyRaisedByFilter(formatted, req.user);

    return res.json({
      data: filteredData,
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

/**
 * GET /api/accounts/unpaid
 * List booked records where billingStatus is null, empty, or 'Unpaid'.
 */
router.get("/unpaid", (req, res, next) => {
  listAccountsWithFilter(req, res, next, {
    $or: [
      { billingStatus: "Unpaid" },
      { billingStatus: "" },
      { billingStatus: null },
      { billingStatus: { $exists: false } },
    ],
  });
});

/**
 * GET /api/accounts/paid
 * List booked records where billingStatus is 'Paid'.
 */
router.get("/paid", (req, res, next) => {
  listAccountsWithFilter(req, res, next, {
    billingStatus: "Paid",
  });
});

/**
 * PUT /api/accounts/:bookingId/billing
 * Dedicated billing update endpoint.
 */
router.put(
  "/:bookingId/billing",
  updateBillingRules,
  validate,
  async (req, res, next) => {
    try {
      const booking = await Booking.findOne({
        _id: req.params.bookingId,
        deletedAt: null,
      });

      if (!booking) {
        return res.status(404).json({
          message: "Booking not found",
          code: "NOT_FOUND",
        });
      }

      if (!canAccessDocument(booking, req.user, "booking.viewAll")) {
        return res.status(403).json({
          message: "Access denied — you cannot modify billing for this booking",
          code: "FORBIDDEN",
        });
      }

      const billingFields = [
        "billingStatus",
        "billingNumber",
        "billingDate",
        "billingRemark",
      ];

      billingFields.forEach((field) => {
        if (req.body[field] !== undefined) {
          booking[field] = req.body[field];
        }
      });

      await booking.save();

      await booking.populate([
        { path: "assignedAgent", select: "name email role photoUrl" },
        { path: "createdBy", select: "name email role photoUrl" },
      ]);

      await recordActivity({
        req,
        activityType: "updated",
        tableName: "booking",
        recordId: booking._id,
        changedData: {
          billingUpdate: {
            billingStatus: booking.billingStatus,
            billingNumber: booking.billingNumber,
            billingDate: booking.billingDate,
            billingRemark: booking.billingRemark,
          },
        },
      });

      const responseData = applyRaisedByFilter(booking, req.user);
      return res.json(responseData);
    } catch (err) {
      next(err);
    }
  }
);

export default router;
