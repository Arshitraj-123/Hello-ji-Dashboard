/**
 * Bookings CRM Routes — Booked, Confirmed, Aborted, Recycle Bin, Detail, Notes, and Soft/Force-Delete Lifecycle.
 *
 * Enforces:
 * 1. Role-based agent visibility filter ($or: [{ createdBy }, { assignedAgent }]) unless admin or holding booking.viewAll.
 * 2. Recycle bin protected by `trash.recycleBin`.
 * 3. 3-state lifecycle: active -> soft-delete (recycle bin) -> force-delete (permanent) or restore.
 * 4. Dedicated Note collection operations.
 * 5. Uses strictly the approved schema fields.
 */

import { Router } from "express";
import Booking from "../models/Booking.js";
import Note from "../models/Note.js";
import { authenticate } from "../middleware/authenticate.js";
import { requirePermission } from "../middleware/authorize.js";
import { validate } from "../middleware/validate.js";
import {
  mongoIdParam,
  addNoteRules,
  convertBookingRules,
} from "../validators/booking.js";
import {
  buildVisibilityFilter,
  canAccessDocument,
  applyRaisedByFilter,
} from "../utils/crmVisibility.js";
import { recordActivity } from "../models/ActivityLog.js";
import brochuresRouter from "./brochures.js";

const router = Router();

router.use(authenticate);

/** Helper for listing bookings with status, visibility, search, pagination */
async function listBookingsWithFilter(req, res, next, baseFilter) {
  try {
    const visibilityFilter = buildVisibilityFilter(req.user, "booking.viewAll");

    const queryFilter = {
      ...visibilityFilter,
      ...baseFilter,
    };

    if (req.query.product) {
      queryFilter.product = req.query.product;
    }

    if (req.query.q) {
      const searchRegex = new RegExp(req.query.q.trim(), "i");
      queryFilter.$and = queryFilter.$and || [];
      queryFilter.$and.push({
        $or: [
          { name: searchRegex },
          { email: searchRegex },
          { phone: searchRegex },
          { city: searchRegex },
          { bookingId: searchRegex },
          { propertyName: searchRegex },
          { airlineName: searchRegex },
          { airlinePnr: searchRegex },
          { gdsPnr: searchRegex },
          { packageName: searchRegex },
          { billingNumber: searchRegex },
        ],
      });
    }

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

    const formattedItems = items.map((doc) => {
      const item = { ...doc, id: doc._id.toString() };
      delete item.__v;
      return item;
    });

    const filteredData = applyRaisedByFilter(formattedItems, req.user);

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
 * GET /api/bookings
 * List all bookings with status = "booked"
 */
router.get("/", (req, res, next) => {
  listBookingsWithFilter(req, res, next, {
    status: { $in: ["booked", "Booked"] },
    deletedAt: null,
  });
});

/**
 * GET /api/bookings/confirmed
 * List all confirmed bookings with optional date range filter.
 * ?filter=today | last_7_days | last_30_days | all
 */
router.get("/confirmed", (req, res, next) => {
  const filterType = req.query.filter || "all";
  const dateFilter = {};

  if (filterType === "today") {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    dateFilter.createdAt = { $gte: startOfToday };
  } else if (filterType === "last_7_days") {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    dateFilter.createdAt = { $gte: sevenDaysAgo };
  } else if (filterType === "last_30_days") {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    dateFilter.createdAt = { $gte: thirtyDaysAgo };
  }

  listBookingsWithFilter(req, res, next, {
    status: { $in: ["Confirmed", "confirmed"] },
    deletedAt: null,
    ...dateFilter,
  });
});

/**
 * GET /api/bookings/aborted
 * List all aborted bookings.
 */
router.get("/aborted", (req, res, next) => {
  listBookingsWithFilter(req, res, next, {
    status: "Abort",
    deletedAt: null,
  });
});

/**
 * Format bookings into FullCalendar + HelloJi calendar event shape
 */
async function formatCalendarEvents(bookings) {
  const bookingIds = bookings.map((b) => b._id);
  const notesWithBookings = await Note.distinct("bookingId", {
    bookingId: { $in: bookingIds },
  });
  const notesSet = new Set(notesWithBookings.map((id) => id.toString()));

  return bookings.map((b) => {
    const idStr = b._id.toString();
    const hasNotes = notesSet.has(idStr);
    const guestName = b.name || "Guest";
    const agentName =
      typeof b.assignedAgent === "object" && b.assignedAgent
        ? b.assignedAgent.name
        : b.assignedAgent || "";
    const start = b.startDate || b.date || "";
    const end = b.endDate || b.startDate || b.date || "";

    return {
      id: idStr,
      title: guestName,
      start,
      end,
      // Root-level fields for existing frontend UI compatibility
      name: guestName,
      bookingId: b.bookingId,
      product: b.product,
      status: b.status,
      startDate: b.startDate || "",
      endDate: b.endDate || "",
      city: b.city || "",
      propertyName: b.propertyName || "",
      hotelConfirmationNo: b.hotelConfirmationNo || "",
      roomType: b.roomType || "",
      mealPlan: b.mealPlan || "",
      assignedAgent: agentName,
      hasNotes,
      extendedProps: {
        bookingId: b.bookingId,
        hotelConfirmationNo: b.hotelConfirmationNo || "",
        propertyName: b.propertyName || "",
        roomType: b.roomType || "",
        hasNotes,
        status: b.status,
        product: b.product,
        assignedAgent: agentName,
      },
    };
  });
}

/** Helper to build optional date range query for calendar */
function buildCalendarDateQuery(startParam, endParam) {
  const conditions = [];
  if (startParam) {
    conditions.push({
      $or: [
        { endDate: { $gte: startParam } },
        { startDate: { $gte: startParam } },
        { date: { $gte: startParam } },
      ],
    });
  }
  if (endParam) {
    conditions.push({
      $or: [
        { startDate: { $lte: endParam } },
        { date: { $lte: endParam } },
      ],
    });
  }
  return conditions.length > 0 ? { $and: conditions } : {};
}

/**
 * GET /api/bookings/calendar
 * Role-filtered calendar view.
 * Only returns status = 'booked' records, applying agent-visibility filter.
 * Gated by: calendar.menu
 */
router.get(
  "/calendar",
  requirePermission("calendar.menu"),
  async (req, res, next) => {
    try {
      const visibilityFilter = buildVisibilityFilter(
        req.user,
        "booking.viewAll"
      );
      const dateQuery = buildCalendarDateQuery(
        req.query.start,
        req.query.end
      );

      const queryFilter = {
        status: { $in: ["booked", "Booked"] },
        deletedAt: null,
        ...visibilityFilter,
        ...dateQuery,
      };

      const bookings = await Booking.find(queryFilter)
        .sort({ startDate: 1, createdAt: 1 })
        .populate("assignedAgent", "name email role photoUrl")
        .populate("createdBy", "name email role photoUrl")
        .lean();

      const events = await formatCalendarEvents(bookings);
      return res.json(events);
    } catch (err) {
      next(err);
    }
  }
);

/**
 * GET /api/bookings/calendar/full
 * Unfiltered calendar view (shows ALL bookings with status = 'booked').
 * Gated strictly by: calendar.menu AND (admin role OR booking.viewAll permission).
 */
router.get(
  "/calendar/full",
  requirePermission("calendar.menu"),
  async (req, res, next) => {
    try {
      const isAdmin = req.user.role === "admin";
      const hasViewAll = req.user.permissions?.includes("booking.viewAll");

      if (!isAdmin && !hasViewAll) {
        return res.status(403).json({
          message:
            "Access denied — full unfiltered calendar requires administrator role or booking.viewAll permission",
          code: "FORBIDDEN",
        });
      }

      const dateQuery = buildCalendarDateQuery(
        req.query.start,
        req.query.end
      );

      const queryFilter = {
        status: { $in: ["booked", "Booked"] },
        deletedAt: null,
        ...dateQuery,
      };

      const bookings = await Booking.find(queryFilter)
        .sort({ startDate: 1, createdAt: 1 })
        .populate("assignedAgent", "name email role photoUrl")
        .populate("createdBy", "name email role photoUrl")
        .lean();

      const events = await formatCalendarEvents(bookings);
      return res.json(events);
    } catch (err) {
      next(err);
    }
  }
);

/**
 * GET /api/bookings/recycle-bin
 * List all soft-deleted records (queries and bookings).
 * Gated by: trash.recycleBin
 */
router.get(
  "/recycle-bin",
  requirePermission("trash.recycleBin"),
  async (req, res, next) => {
    try {
      const visibilityFilter = buildVisibilityFilter(
        req.user,
        "booking.viewAll"
      );

      const queryFilter = {
        ...visibilityFilter,
        deletedAt: { $ne: null },
      };

      if (req.query.q) {
        const searchRegex = new RegExp(req.query.q.trim(), "i");
        queryFilter.$and = queryFilter.$and || [];
        queryFilter.$and.push({
          $or: [
            { name: searchRegex },
            { email: searchRegex },
            { phone: searchRegex },
            { city: searchRegex },
            { bookingId: searchRegex },
            { propertyName: searchRegex },
            { airlineName: searchRegex },
          ],
        });
      }

      const page = Math.max(1, parseInt(req.query.page, 10) || 1);
      const limit = Math.min(
        100,
        Math.max(1, parseInt(req.query.limit, 10) || 25)
      );
      const skip = (page - 1) * limit;

      const sortField = req.query.sort || "deletedAt";
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

      const formattedItems = items.map((doc) => {
        const item = { ...doc, id: doc._id.toString() };
        delete item.__v;
        return item;
      });

      const filteredData = applyRaisedByFilter(formattedItems, req.user);

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
);

/**
 * GET /api/bookings/:id
 * Detail view of any booking.
 */
router.get("/:id", mongoIdParam("id"), validate, async (req, res, next) => {
  try {
    const bookingDoc = await Booking.findById(req.params.id)
      .populate("assignedAgent", "name email role photoUrl")
      .populate("createdBy", "name email role photoUrl");

    if (!bookingDoc) {
      return res.status(404).json({
        message: "Booking not found",
        code: "NOT_FOUND",
      });
    }

    // If request comes with a scoped brochure render service token, authorize strictly for that booking
    if (req.serviceToken) {
      if (
        req.serviceToken.bookingId !== bookingDoc._id.toString() &&
        req.serviceToken.bookingId !== bookingDoc.bookingId
      ) {
        return res.status(403).json({
          message: "Service token not valid for this booking",
          code: "FORBIDDEN",
        });
      }
      const item = { ...bookingDoc.toObject(), id: bookingDoc._id.toString() };
      delete item.__v;
      item.notes = item.notes || [];
      return res.json(item);
    }

    if (!canAccessDocument(bookingDoc, req.user, "booking.viewAll")) {
      return res.status(403).json({
        message: "Access denied",
        code: "FORBIDDEN",
      });
    }

    const responseData = applyRaisedByFilter(bookingDoc, req.user);
    return res.json(responseData);
  } catch (err) {
    next(err);
  }
});

/** Mount brochure delivery sub-routes (/api/bookings/:id/brochure/*) */
router.use("/:id/brochure", brochuresRouter);

/**
 * PUT /api/bookings/:id
 * General booking edit. Strictly uses approved schema fields.
 * Rejects status and assignedAgent changes.
 */
router.put(
  "/:id",
  convertBookingRules,
  validate,
  async (req, res, next) => {
    try {
      const bookingDoc = await Booking.findOne({
        _id: req.params.id,
        deletedAt: null,
      });

      if (!bookingDoc) {
        return res.status(404).json({
          message: "Booking not found",
          code: "NOT_FOUND",
        });
      }

      if (!canAccessDocument(bookingDoc, req.user, "booking.viewAll")) {
        return res.status(403).json({
          message: "Access denied",
          code: "FORBIDDEN",
        });
      }

      // Reject status changes via general edit
      if (req.body.status && req.body.status !== bookingDoc.status) {
        return res.status(400).json({
          message:
            "Status cannot be updated via general edit; use dedicated status or conversion endpoints",
          code: "STATUS_UPDATE_NOT_ALLOWED",
        });
      }

      // Reject assignedAgent changes via general edit
      if (
        req.body.assignedAgent &&
        req.body.assignedAgent.toString() !== bookingDoc.assignedAgent.toString()
      ) {
        return res.status(400).json({
          message:
            "Assigned agent cannot be updated via general edit; use PATCH /api/queries/:id/assign",
          code: "ASSIGNMENT_NOT_ALLOWED",
        });
      }

      const modifiableFields = [
        "name",
        "email",
        "phone",
        "city",
        "destination",
        "product",
        "priority",
        "details",
        "date",
        "hotelConfirmationNo",
        "startDate",
        "endDate",
        "noOfRooms",
        "noOfAdults",
        "noOfChildren",
        "noOfExtraBed",
        "mealPlan",
        "roomType",
        "propertyName",
        "propertyPhone",
        "propertyEmail",
        "propertyAddress",
        "packageName",
        "duration",
        "inclusion",
        "airlineName",
        "flightNumber",
        "sectorName",
        "airlinePnr",
        "gdsPnr",
        "timeOnward",
        "timeReturn",
        "noOfInfant",
        "visaType",
        "visaReference",
        "insuranceType",
        "insurancePolicyNo",
        "insuranceCoverage",
        "billingStatus",
        "billingNumber",
        "billingDate",
        "billingRemark",
        "specialRequest",
        "bookingPolicy",
        "dmName",
        "dmContact",
      ];

      modifiableFields.forEach((field) => {
        if (req.body[field] !== undefined) {
          bookingDoc[field] = req.body[field];
        }
      });

      // Handle UI aliases
      if (req.body.enquiryType || req.body.enqueryType) {
        bookingDoc.enquiryType = req.body.enquiryType || req.body.enqueryType;
      }
      if (req.body.noRoom !== undefined) bookingDoc.noOfRooms = req.body.noRoom;
      if (req.body.adults !== undefined) bookingDoc.noOfAdults = req.body.adults;
      if (req.body.children !== undefined) bookingDoc.noOfChildren = req.body.children;
      if (req.body.extraBed !== undefined) bookingDoc.noOfExtraBed = req.body.extraBed;
      if (req.body.infants !== undefined) bookingDoc.noOfInfant = req.body.infants;

      await bookingDoc.save();

      await bookingDoc.populate([
        { path: "assignedAgent", select: "name email role photoUrl" },
        { path: "createdBy", select: "name email role photoUrl" },
      ]);

      await recordActivity({
        req,
        activityType: "updated",
        recordId: bookingDoc._id,
        changedData: {
          updatedFields: Object.keys(req.body).filter((k) =>
            modifiableFields.includes(k)
          ),
        },
      });

      const responseData = applyRaisedByFilter(bookingDoc, req.user);
      return res.json(responseData);
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /api/bookings/:id/restore
 * Restore a soft-deleted record from the recycle bin.
 * Gated by: trash.recycleBin
 */
router.post(
  "/:id/restore",
  requirePermission("trash.recycleBin"),
  mongoIdParam("id"),
  validate,
  async (req, res, next) => {
    try {
      const bookingDoc = await Booking.findOne({
        _id: req.params.id,
        deletedAt: { $ne: null },
      });

      if (!bookingDoc) {
        return res.status(404).json({
          message: "Record not found in recycle bin",
          code: "NOT_FOUND",
        });
      }

      bookingDoc.deletedAt = null;
      await bookingDoc.save();

      await recordActivity({
        req,
        activityType: "restored",
        recordId: bookingDoc._id,
        changedData: { bookingId: bookingDoc.bookingId },
      });

      return res.json({
        message: "Record restored successfully",
        code: "RESTORED",
        id: bookingDoc._id.toString(),
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * DELETE /api/bookings/:id/force
 * Permanently delete a record and its notes from MongoDB.
 * Only allowed for records currently in recycle bin.
 * Gated by: trash.recycleBin
 */
router.delete(
  "/:id/force",
  requirePermission("trash.recycleBin"),
  mongoIdParam("id"),
  validate,
  async (req, res, next) => {
    try {
      const bookingDoc = await Booking.findOne({
        _id: req.params.id,
        deletedAt: { $ne: null },
      });

      if (!bookingDoc) {
        return res.status(404).json({
          message:
            "Record not found in recycle bin or already permanently deleted",
          code: "NOT_FOUND",
        });
      }

      const bookingIdStr = bookingDoc.bookingId;
      const targetId = bookingDoc._id;

      // Delete associated notes from dedicated collection
      await Note.deleteMany({ bookingId: targetId });

      // Permanently remove booking
      await Booking.findByIdAndDelete(targetId);

      await recordActivity({
        req,
        activityType: "force_deleted",
        recordId: targetId,
        changedData: { bookingId: bookingIdStr },
      });

      return res.json({
        message: "Record permanently deleted",
        code: "FORCE_DELETED",
        id: targetId.toString(),
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /api/bookings/:id/notes
 * Append a note to the dedicated Note collection.
 */
router.post(
  "/:id/notes",
  addNoteRules,
  validate,
  async (req, res, next) => {
    try {
      const bookingDoc = await Booking.findOne({
        _id: req.params.id,
        deletedAt: null,
      });

      if (!bookingDoc) {
        return res.status(404).json({
          message: "Booking not found",
          code: "NOT_FOUND",
        });
      }

      if (!canAccessDocument(bookingDoc, req.user, "booking.viewAll")) {
        return res.status(403).json({
          message: "Access denied",
          code: "FORBIDDEN",
        });
      }

      const noteDoc = new Note({
        bookingId: bookingDoc._id,
        user: req.user.id,
        note: req.body.note,
      });

      await noteDoc.save();
      await noteDoc.populate("user", "name email role photoUrl");

      await recordActivity({
        req,
        activityType: "note_added",
        recordId: bookingDoc._id,
        changedData: { noteId: noteDoc._id.toString() },
      });

      return res.status(201).json(noteDoc);
    } catch (err) {
      next(err);
    }
  }
);

/**
 * GET /api/bookings/:id/notes
 * List all notes for this booking.
 */
router.get(
  "/:id/notes",
  mongoIdParam("id"),
  validate,
  async (req, res, next) => {
    try {
      const bookingDoc = await Booking.findById(req.params.id);

      if (!bookingDoc) {
        return res.status(404).json({
          message: "Booking not found",
          code: "NOT_FOUND",
        });
      }

      if (!canAccessDocument(bookingDoc, req.user, "booking.viewAll")) {
        return res.status(403).json({
          message: "Access denied",
          code: "FORBIDDEN",
        });
      }

      const notes = await Note.find({ bookingId: bookingDoc._id })
        .sort({ createdAt: -1 })
        .populate("user", "name email role photoUrl");

      return res.json(notes);
    } catch (err) {
      next(err);
    }
  }
);

export default router;
