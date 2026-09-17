/**
 * Queries CRM Routes — Pipeline, detail, general edit, dedicated status/assign, soft-delete, and conversion.
 *
 * Enforces:
 * 1. Agent visibility rule ($or: [{ createdBy }, { assignedAgent }]) on all queries.
 * 2. Dedicated permission gates:
 *    - POST /api/queries -> queries.add
 *    - PATCH /:id/status -> queries.changeStatus
 *    - PATCH /:id/assign -> queries.assign
 * 3. General PUT rejects status and assignedAgent modifications.
 * 4. Conditional omission of createdBy if user lacks `queries.viewRaisedBy`.
 * 5. Conversion in-place preserving _id AND bookingId with approved schema fields only.
 */

import { Router } from "express";
import Booking from "../models/Booking.js";
import User from "../models/User.js";
import Note from "../models/Note.js";
import { authenticate } from "../middleware/authenticate.js";
import { requirePermission } from "../middleware/authorize.js";
import { validate } from "../middleware/validate.js";
import {
  createQueryRules,
  updateQueryRules,
  updateStatusRules,
  assignQueryRules,
  convertBookingRules,
  addNoteRules,
  mongoIdParam,
} from "../validators/booking.js";
import {
  buildVisibilityFilter,
  canAccessDocument,
  applyRaisedByFilter,
} from "../utils/crmVisibility.js";
import { recordActivity } from "../models/ActivityLog.js";

const router = Router();

router.use(authenticate);

/**
 * POST /api/queries
 * Create a new query.
 * Gated by: queries.add
 */
router.post(
  "/",
  requirePermission("queries.add"),
  createQueryRules,
  validate,
  async (req, res, next) => {
    try {
      const {
        name,
        email,
        phone,
        city,
        enquiryType,
        enqueryType,
        destination = "Domestic",
        product,
        priority = "Normal",
        details = "",
        date,
        startDate = "",
        endDate = "",
        noOfRooms,
        noRoom,
        noOfAdults,
        adults,
        noOfChildren,
        children,
        noOfExtraBed,
        extraBed,
        noOfInfant,
        infants,
        assignedAgent: requestedAgent,
      } = req.body;

      // Normalize field names
      const finalEnquiryType = enquiryType || enqueryType || "B2C";
      const finalRooms = noOfRooms || noRoom || "";
      const finalAdults = noOfAdults || adults || "";
      const finalChildren = noOfChildren || children || "";
      const finalExtraBed = noOfExtraBed || extraBed || "";
      const finalInfant = noOfInfant || infants || "";

      // Only users with queries.assign permission or admin may specify a different assigned agent at creation
      let assignedAgent = req.user.id;
      if (
        requestedAgent &&
        (req.user.role === "admin" ||
          req.user.permissions?.includes("queries.assign"))
      ) {
        const targetUser = await User.findById(requestedAgent);
        if (targetUser) {
          assignedAgent = targetUser._id;
        }
      }

      const queryDoc = new Booking({
        name,
        email: email || "",
        phone: phone || "",
        city: city || "",
        enquiryType: finalEnquiryType,
        destination,
        product,
        priority,
        details,
        date: date || new Date().toISOString().slice(0, 10),
        startDate,
        endDate,
        noOfRooms: finalRooms,
        noOfAdults: finalAdults,
        noOfChildren: finalChildren,
        noOfExtraBed: finalExtraBed,
        noOfInfant: finalInfant,
        status: "New Query",
        createdBy: req.user.id,
        assignedAgent,
        deletedAt: null,
      });

      await queryDoc.save();

      await queryDoc.populate([
        { path: "assignedAgent", select: "name email role photoUrl" },
        { path: "createdBy", select: "name email role photoUrl" },
      ]);

      await recordActivity({
        req,
        activityType: "created",
        recordId: queryDoc._id,
        changedData: {
          bookingId: queryDoc.bookingId,
          name: queryDoc.name,
          product: queryDoc.product,
          status: queryDoc.status,
        },
      });

      const responseData = applyRaisedByFilter(queryDoc, req.user);
      return res.status(201).json(responseData);
    } catch (err) {
      next(err);
    }
  }
);

/**
 * GET /api/queries
 * List active pipeline queries.
 * Pipeline statuses: not Confirmed, booked, or Abort.
 */
router.get("/", async (req, res, next) => {
  try {
    const visibilityFilter = buildVisibilityFilter(req.user, "queries.viewAll");

    const queryFilter = {
      ...visibilityFilter,
      deletedAt: null,
      status: { $nin: ["Confirmed", "booked", "Abort"] },
    };

    // Optional status filter within active pipeline (e.g. ?status=Pipeline)
    if (req.query.status) {
      queryFilter.status = req.query.status;
    }

    // Optional product filter
    if (req.query.product) {
      queryFilter.product = req.query.product;
    }

    // Optional priority filter
    if (req.query.priority) {
      queryFilter.priority = req.query.priority;
    }

    // Search filter across text fields
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
        ],
      });
    }

    // Pagination
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 25));
    const skip = (page - 1) * limit;

    // Sorting
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
});

/**
 * GET /api/queries/:id
 * Detail view of a query.
 * Returns 403 if unauthorized agent accesses another agent's query.
 */
router.get("/:id", mongoIdParam("id"), validate, async (req, res, next) => {
  try {
    const queryDoc = await Booking.findOne({
      _id: req.params.id,
      deletedAt: null,
    })
      .populate("assignedAgent", "name email role photoUrl")
      .populate("createdBy", "name email role photoUrl");

    if (!queryDoc) {
      return res.status(404).json({
        message: "Query not found",
        code: "NOT_FOUND",
      });
    }

    if (!canAccessDocument(queryDoc, req.user, "queries.viewAll")) {
      return res.status(403).json({
        message: "Access denied — you are neither the creator nor assigned agent",
        code: "FORBIDDEN",
      });
    }

    const responseData = applyRaisedByFilter(queryDoc, req.user);
    return res.json(responseData);
  } catch (err) {
    next(err);
  }
});

/**
 * PUT /api/queries/:id
 * General query edit.
 * Rejects status and assignedAgent tampering.
 */
router.put(
  "/:id",
  updateQueryRules,
  validate,
  async (req, res, next) => {
    try {
      const queryDoc = await Booking.findOne({
        _id: req.params.id,
        deletedAt: null,
      });

      if (!queryDoc) {
        return res.status(404).json({
          message: "Query not found",
          code: "NOT_FOUND",
        });
      }

      if (!canAccessDocument(queryDoc, req.user, "queries.viewAll")) {
        return res.status(403).json({
          message: "Access denied — you cannot edit this query",
          code: "FORBIDDEN",
        });
      }

      // Strictly reject status changes via general edit
      if (req.body.status && req.body.status !== queryDoc.status) {
        return res.status(400).json({
          message:
            "Status cannot be updated via general edit; use PATCH /api/queries/:id/status",
          code: "STATUS_UPDATE_NOT_ALLOWED",
        });
      }

      // Strictly reject assignedAgent changes via general edit
      if (
        req.body.assignedAgent &&
        req.body.assignedAgent.toString() !== queryDoc.assignedAgent.toString()
      ) {
        return res.status(400).json({
          message:
            "Assigned agent cannot be updated via general edit; use PATCH /api/queries/:id/assign",
          code: "ASSIGNMENT_NOT_ALLOWED",
        });
      }

      const updatableFields = [
        "name",
        "email",
        "phone",
        "city",
        "destination",
        "product",
        "priority",
        "details",
        "date",
        "startDate",
        "endDate",
        "noOfRooms",
        "noOfAdults",
        "noOfChildren",
        "noOfExtraBed",
        "noOfInfant",
        "specialRequest",
        "bookingPolicy",
        "dmName",
        "dmContact",
      ];

      updatableFields.forEach((field) => {
        if (req.body[field] !== undefined) {
          queryDoc[field] = req.body[field];
        }
      });

      // Handle aliases
      if (req.body.enquiryType || req.body.enqueryType) {
        queryDoc.enquiryType = req.body.enquiryType || req.body.enqueryType;
      }
      if (req.body.noRoom !== undefined) queryDoc.noOfRooms = req.body.noRoom;
      if (req.body.adults !== undefined) queryDoc.noOfAdults = req.body.adults;
      if (req.body.children !== undefined) queryDoc.noOfChildren = req.body.children;
      if (req.body.extraBed !== undefined) queryDoc.noOfExtraBed = req.body.extraBed;
      if (req.body.infants !== undefined) queryDoc.noOfInfant = req.body.infants;

      await queryDoc.save();

      await queryDoc.populate([
        { path: "assignedAgent", select: "name email role photoUrl" },
        { path: "createdBy", select: "name email role photoUrl" },
      ]);

      await recordActivity({
        req,
        activityType: "updated",
        recordId: queryDoc._id,
        changedData: {
          updatedFields: Object.keys(req.body).filter((k) =>
            updatableFields.includes(k)
          ),
        },
      });

      const responseData = applyRaisedByFilter(queryDoc, req.user);
      return res.json(responseData);
    } catch (err) {
      next(err);
    }
  }
);

/**
 * PATCH /api/queries/:id/status
 * Dedicated status update endpoint.
 * Gated by: queries.changeStatus
 */
router.patch(
  "/:id/status",
  requirePermission("queries.changeStatus"),
  updateStatusRules,
  validate,
  async (req, res, next) => {
    try {
      const queryDoc = await Booking.findOne({
        _id: req.params.id,
        deletedAt: null,
      });

      if (!queryDoc) {
        return res.status(404).json({
          message: "Query not found",
          code: "NOT_FOUND",
        });
      }

      if (!canAccessDocument(queryDoc, req.user, "queries.viewAll")) {
        return res.status(403).json({
          message: "Access denied — you cannot modify this query",
          code: "FORBIDDEN",
        });
      }

      const previousStatus = queryDoc.status;
      queryDoc.status = req.body.status;
      await queryDoc.save();

      await queryDoc.populate([
        { path: "assignedAgent", select: "name email role photoUrl" },
        { path: "createdBy", select: "name email role photoUrl" },
      ]);

      await recordActivity({
        req,
        activityType: "status_changed",
        recordId: queryDoc._id,
        changedData: { previousStatus, newStatus: queryDoc.status },
      });

      const responseData = applyRaisedByFilter(queryDoc, req.user);
      return res.json(responseData);
    } catch (err) {
      next(err);
    }
  }
);

/**
 * PATCH /api/queries/:id/assign
 * Dedicated agent assignment endpoint.
 * Gated by: queries.assign
 */
router.patch(
  "/:id/assign",
  requirePermission("queries.assign"),
  assignQueryRules,
  validate,
  async (req, res, next) => {
    try {
      const queryDoc = await Booking.findOne({
        _id: req.params.id,
        deletedAt: null,
      });

      if (!queryDoc) {
        return res.status(404).json({
          message: "Query not found",
          code: "NOT_FOUND",
        });
      }

      if (!canAccessDocument(queryDoc, req.user, "queries.viewAll")) {
        return res.status(403).json({
          message: "Access denied — you cannot reassign this query",
          code: "FORBIDDEN",
        });
      }

      const targetAgent = await User.findById(req.body.assignedAgent);
      if (!targetAgent) {
        return res.status(404).json({
          message: "Target agent user not found",
          code: "USER_NOT_FOUND",
        });
      }

      const previousAgent = queryDoc.assignedAgent;
      queryDoc.assignedAgent = targetAgent._id;
      await queryDoc.save();

      await queryDoc.populate([
        { path: "assignedAgent", select: "name email role photoUrl" },
        { path: "createdBy", select: "name email role photoUrl" },
      ]);

      await recordActivity({
        req,
        activityType: "assigned",
        recordId: queryDoc._id,
        changedData: {
          previousAgent: previousAgent.toString(),
          newAgent: targetAgent._id.toString(),
        },
      });

      const responseData = applyRaisedByFilter(queryDoc, req.user);
      return res.json(responseData);
    } catch (err) {
      next(err);
    }
  }
);

/**
 * DELETE /api/queries/:id
 * Soft delete query (moves to recycle bin).
 */
router.delete("/:id", mongoIdParam("id"), validate, async (req, res, next) => {
  try {
    const queryDoc = await Booking.findOne({
      _id: req.params.id,
      deletedAt: null,
    });

    if (!queryDoc) {
      return res.status(404).json({
        message: "Query not found",
        code: "NOT_FOUND",
      });
    }

    if (!canAccessDocument(queryDoc, req.user, "queries.viewAll")) {
      return res.status(403).json({
        message: "Access denied — you cannot delete this query",
        code: "FORBIDDEN",
      });
    }

    queryDoc.deletedAt = new Date();
    await queryDoc.save();

    await recordActivity({
      req,
      activityType: "deleted",
      recordId: queryDoc._id,
      changedData: { bookingId: queryDoc.bookingId },
    });

    return res.json({
      message: "Query moved to recycle bin",
      code: "DELETED",
      id: queryDoc._id.toString(),
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/queries/:id/convert
 * In-place conversion from query to booked status with product attributes.
 * Asserts preservation of MongoDB _id AND sequential bookingId.
 * Strictly accepts approved schema fields only.
 */
router.post(
  "/:id/convert",
  convertBookingRules,
  validate,
  async (req, res, next) => {
    try {
      const queryDoc = await Booking.findOne({
        _id: req.params.id,
        deletedAt: null,
      });

      if (!queryDoc) {
        return res.status(404).json({
          message: "Query not found",
          code: "NOT_FOUND",
        });
      }

      if (!canAccessDocument(queryDoc, req.user, "queries.viewAll")) {
        return res.status(403).json({
          message: "Access denied — you cannot convert this query",
          code: "FORBIDDEN",
        });
      }

      const originalId = queryDoc._id.toString();
      const originalBookingId = queryDoc.bookingId;

      // Status transitions to 'booked'
      queryDoc.status = "booked";

      // Product-specific attributes matching the approved specification
      const allowedProductFields = [
        // Hotel & Stay
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

        // Package
        "packageName",
        "duration",
        "inclusion",

        // Ticket (distinct airlinePnr AND gdsPnr)
        "airlineName",
        "flightNumber",
        "sectorName",
        "airlinePnr",
        "gdsPnr",
        "timeOnward",
        "timeReturn",
        "noOfInfant",

        // Visa
        "visaType",
        "visaReference",

        // Insurance
        "insuranceType",
        "insurancePolicyNo",
        "insuranceCoverage",

        // Accounts & Billing
        "billingStatus",
        "billingNumber",
        "billingDate",
        "billingRemark",

        // General
        "details",
        "specialRequest",
        "bookingPolicy",
        "dmName",
        "dmContact",
      ];

      allowedProductFields.forEach((field) => {
        if (req.body[field] !== undefined) {
          queryDoc[field] = req.body[field];
        }
      });

      // Handle UI aliases if present
      if (req.body.noRoom !== undefined) queryDoc.noOfRooms = req.body.noRoom;
      if (req.body.adults !== undefined) queryDoc.noOfAdults = req.body.adults;
      if (req.body.children !== undefined) queryDoc.noOfChildren = req.body.children;
      if (req.body.extraBed !== undefined) queryDoc.noOfExtraBed = req.body.extraBed;
      if (req.body.infants !== undefined) queryDoc.noOfInfant = req.body.infants;

      await queryDoc.save();

      // Explicitly assert identity preservation
      if (
        queryDoc._id.toString() !== originalId ||
        queryDoc.bookingId !== originalBookingId
      ) {
        throw new Error(
          "Critical error: Conversion corrupted document _id or bookingId!"
        );
      }

      await queryDoc.populate([
        { path: "assignedAgent", select: "name email role photoUrl" },
        { path: "createdBy", select: "name email role photoUrl" },
      ]);

      await recordActivity({
        req,
        activityType: "converted",
        recordId: queryDoc._id,
        changedData: {
          bookingId: queryDoc.bookingId,
          newStatus: "booked",
        },
      });

      const responseData = applyRaisedByFilter(queryDoc, req.user);
      return res.json(responseData);
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /api/queries/:id/notes
 * Append a note to the dedicated Note collection for this query.
 */
router.post(
  "/:id/notes",
  addNoteRules,
  validate,
  async (req, res, next) => {
    try {
      const queryDoc = await Booking.findOne({
        _id: req.params.id,
        deletedAt: null,
      });

      if (!queryDoc) {
        return res.status(404).json({
          message: "Query not found",
          code: "NOT_FOUND",
        });
      }

      if (!canAccessDocument(queryDoc, req.user, "queries.viewAll")) {
        return res.status(403).json({
          message: "Access denied",
          code: "FORBIDDEN",
        });
      }

      const noteDoc = new Note({
        bookingId: queryDoc._id,
        user: req.user.id,
        note: req.body.note,
      });

      await noteDoc.save();
      await noteDoc.populate("user", "name email role photoUrl");

      await recordActivity({
        req,
        activityType: "note_added",
        recordId: queryDoc._id,
        changedData: { noteId: noteDoc._id.toString() },
      });

      return res.status(201).json(noteDoc);
    } catch (err) {
      next(err);
    }
  }
);

/**
 * GET /api/queries/:id/notes
 * List all notes for this query.
 */
router.get(
  "/:id/notes",
  mongoIdParam("id"),
  validate,
  async (req, res, next) => {
    try {
      const queryDoc = await Booking.findById(req.params.id);

      if (!queryDoc) {
        return res.status(404).json({
          message: "Query not found",
          code: "NOT_FOUND",
        });
      }

      if (!canAccessDocument(queryDoc, req.user, "queries.viewAll")) {
        return res.status(403).json({
          message: "Access denied",
          code: "FORBIDDEN",
        });
      }

      const notes = await Note.find({ bookingId: queryDoc._id })
        .sort({ createdAt: -1 })
        .populate("user", "name email role photoUrl");

      return res.json(notes);
    } catch (err) {
      next(err);
    }
  }
);

export default router;
