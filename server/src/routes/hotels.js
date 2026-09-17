/**
 * Hotel Directory Routes — Supplier Contacts, Directory Management, and Independent Recycle Bin.
 *
 * Enforces:
 * 1. hotel.add on creation.
 * 2. hotel.viewAll on listing active hotels.
 * 3. trash.recycleBin on recycle bin, restore, and force delete.
 * 4. Automatic activity logging on Hotel lifecycle events with tableName = "hotel".
 * 5. Dedicated Hotel recycle bin independent from bookings and customer bins.
 */

import { Router } from "express";
import Hotel from "../models/Hotel.js";
import { authenticate } from "../middleware/authenticate.js";
import { requirePermission } from "../middleware/authorize.js";
import { validate } from "../middleware/validate.js";
import {
  createHotelRules,
  updateHotelRules,
  mongoIdParam,
} from "../validators/hotel.js";
import { recordActivity } from "../models/ActivityLog.js";

const router = Router();

router.use(authenticate);

/**
 * POST /api/hotels
 * Create new supplier hotel.
 * Gated by: hotel.add
 */
router.post(
  "/",
  requirePermission("hotel.add"),
  createHotelRules,
  validate,
  async (req, res, next) => {
    try {
      const {
        hotelName,
        city = "",
        star = "",
        salesPerson = "",
        email = "",
        phone = "",
        address = "",
        reservationNumber = "",
        totalRooms = "",
        roomsCategory = "",
        remarks = "",
      } = req.body;

      const hotel = new Hotel({
        hotelName,
        city,
        star,
        salesPerson,
        email,
        phone,
        address,
        reservationNumber,
        totalRooms,
        roomsCategory,
        remarks,
        deletedAt: null,
      });

      await hotel.save();

      await recordActivity({
        req,
        activityType: "created",
        tableName: "hotel",
        recordId: hotel._id,
        changedData: {
          hotelName: hotel.hotelName,
          city: hotel.city,
        },
      });

      return res.status(201).json(hotel);
    } catch (err) {
      next(err);
    }
  }
);

/**
 * GET /api/hotels
 * List active supplier hotels.
 * Gated by: hotel.viewAll
 */
router.get(
  "/",
  requirePermission("hotel.viewAll"),
  async (req, res, next) => {
    try {
      const queryFilter = { deletedAt: null };

      if (req.query.q) {
        const searchRegex = new RegExp(req.query.q.trim(), "i");
        queryFilter.$or = [
          { hotelName: searchRegex },
          { city: searchRegex },
          { salesPerson: searchRegex },
          { email: searchRegex },
          { phone: searchRegex },
        ];
      }

      if (req.query.city) {
        queryFilter.city = new RegExp(req.query.city.trim(), "i");
      }

      const page = Math.max(1, parseInt(req.query.page, 10) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 25));
      const skip = (page - 1) * limit;

      const sortField = req.query.sort || "createdAt";
      const sortDir = req.query.dir === "asc" ? 1 : -1;
      const sort = { [sortField]: sortDir };

      const [items, total] = await Promise.all([
        Hotel.find(queryFilter).sort(sort).skip(skip).limit(limit).lean(),
        Hotel.countDocuments(queryFilter),
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
 * GET /api/hotels/recycle-bin
 * List soft-deleted hotels (Hotel dedicated bin).
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
          { hotelName: searchRegex },
          { city: searchRegex },
          { salesPerson: searchRegex },
          { email: searchRegex },
          { phone: searchRegex },
        ];
      }

      const page = Math.max(1, parseInt(req.query.page, 10) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 25));
      const skip = (page - 1) * limit;

      const sortField = req.query.sort || "deletedAt";
      const sortDir = req.query.dir === "asc" ? 1 : -1;
      const sort = { [sortField]: sortDir };

      const [items, total] = await Promise.all([
        Hotel.find(queryFilter).sort(sort).skip(skip).limit(limit).lean(),
        Hotel.countDocuments(queryFilter),
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
 * GET /api/hotels/:id
 * Detail view of single active hotel.
 */
router.get("/:id", mongoIdParam("id"), validate, async (req, res, next) => {
  try {
    const hotel = await Hotel.findOne({
      _id: req.params.id,
      deletedAt: null,
    });

    if (!hotel) {
      return res.status(404).json({
        message: "Hotel not found",
        code: "NOT_FOUND",
      });
    }

    return res.json(hotel);
  } catch (err) {
    next(err);
  }
});

/**
 * PUT /api/hotels/:id
 * Update hotel.
 */
router.put(
  "/:id",
  updateHotelRules,
  validate,
  async (req, res, next) => {
    try {
      const hotel = await Hotel.findOne({
        _id: req.params.id,
        deletedAt: null,
      });

      if (!hotel) {
        return res.status(404).json({
          message: "Hotel not found",
          code: "NOT_FOUND",
        });
      }

      const updatable = [
        "hotelName",
        "city",
        "star",
        "salesPerson",
        "email",
        "phone",
        "address",
        "reservationNumber",
        "totalRooms",
        "roomsCategory",
        "remarks",
      ];

      updatable.forEach((field) => {
        if (req.body[field] !== undefined) {
          hotel[field] = req.body[field];
        }
      });

      await hotel.save();

      await recordActivity({
        req,
        activityType: "updated",
        tableName: "hotel",
        recordId: hotel._id,
        changedData: {
          updatedFields: Object.keys(req.body).filter((k) =>
            updatable.includes(k)
          ),
        },
      });

      return res.json(hotel);
    } catch (err) {
      next(err);
    }
  }
);

/**
 * DELETE /api/hotels/:id
 * Soft delete hotel (moves to hotel recycle bin).
 */
router.delete("/:id", mongoIdParam("id"), validate, async (req, res, next) => {
  try {
    const hotel = await Hotel.findOne({
      _id: req.params.id,
      deletedAt: null,
    });

    if (!hotel) {
      return res.status(404).json({
        message: "Hotel not found",
        code: "NOT_FOUND",
      });
    }

    hotel.deletedAt = new Date();
    await hotel.save();

    await recordActivity({
      req,
      activityType: "deleted",
      tableName: "hotel",
      recordId: hotel._id,
      changedData: { hotelName: hotel.hotelName },
    });

    return res.json({
      message: "Hotel moved to recycle bin",
      code: "DELETED",
      id: hotel._id.toString(),
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/hotels/:id/restore
 * Restore soft-deleted hotel from hotel recycle bin.
 * Gated by: trash.recycleBin
 */
router.post(
  "/:id/restore",
  requirePermission("trash.recycleBin"),
  mongoIdParam("id"),
  validate,
  async (req, res, next) => {
    try {
      const hotel = await Hotel.findOne({
        _id: req.params.id,
        deletedAt: { $ne: null },
      });

      if (!hotel) {
        return res.status(404).json({
          message: "Hotel not found in recycle bin",
          code: "NOT_FOUND",
        });
      }

      hotel.deletedAt = null;
      await hotel.save();

      await recordActivity({
        req,
        activityType: "restored",
        tableName: "hotel",
        recordId: hotel._id,
        changedData: { hotelName: hotel.hotelName },
      });

      return res.json({
        message: "Hotel restored successfully",
        code: "RESTORED",
        id: hotel._id.toString(),
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * DELETE /api/hotels/:id/force
 * Permanently delete hotel from database.
 * Gated by: trash.recycleBin
 */
router.delete(
  "/:id/force",
  requirePermission("trash.recycleBin"),
  mongoIdParam("id"),
  validate,
  async (req, res, next) => {
    try {
      const hotel = await Hotel.findOne({
        _id: req.params.id,
        deletedAt: { $ne: null },
      });

      if (!hotel) {
        return res.status(404).json({
          message: "Hotel not found in recycle bin",
          code: "NOT_FOUND",
        });
      }

      const hotelId = hotel._id;
      const hotelName = hotel.hotelName;

      await Hotel.findByIdAndDelete(hotelId);

      await recordActivity({
        req,
        activityType: "force_deleted",
        tableName: "hotel",
        recordId: hotelId,
        changedData: { hotelName },
      });

      return res.json({
        message: "Hotel permanently deleted",
        code: "FORCE_DELETED",
        id: hotelId.toString(),
      });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
