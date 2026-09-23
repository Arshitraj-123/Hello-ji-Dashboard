/**
 * Booking Ticket Routes — Comprehensive API for Booking Tickets module.
 *
 * Supports:
 * 1. POST /api/booking-tickets: Create new ticket with auto-generated BT ID (BT0001...)
 * 2. GET /api/booking-tickets: Fetch active tickets (filterable by status: unapproved / approved)
 * 3. GET /api/booking-tickets/:id: Fetch single ticket
 * 4. PUT /api/booking-tickets/:id: Update ticket details
 * 5. PATCH /api/booking-tickets/:id/approve: Transition ticket to approved with remark & record approver
 * 6. DELETE /api/booking-tickets/:id: Soft-delete to Recycle Bin
 * 7. GET /api/booking-tickets/recycle-bin: Fetch soft-deleted tickets
 * 8. POST /api/booking-tickets/:id/restore: Restore from Recycle Bin
 * 9. DELETE /api/booking-tickets/:id/permanent: Permanently delete ticket
 */

import { Router } from "express";
import BookingTicket, {
  generateNextBookingTicketId,
  BOOKING_TICKET_PRODUCTS,
} from "../models/BookingTicket.js";
import { authenticate } from "../middleware/authenticate.js";
import { recordActivity } from "../models/ActivityLog.js";

const router = Router();

router.use(authenticate);

/**
 * GET /api/booking-tickets/recycle-bin
 * Fetch soft-deleted booking tickets.
 */
router.get("/recycle-bin", async (req, res, next) => {
  try {
    const { search = "", limit = 100, page = 1 } = req.query;
    const filter = { deletedAt: { $ne: null } };

    if (search) {
      const regex = new RegExp(search.trim(), "i");
      filter.$or = [
        { btId: regex },
        { guestName: regex },
        { saleBy: regex },
        { createdBy: regex },
        { product: regex },
        { detail: regex },
      ];
    }

    const total = await BookingTicket.countDocuments(filter);
    const tickets = await BookingTicket.find(filter)
      .sort({ deletedAt: -1 })
      .skip((parseInt(page, 10) - 1) * parseInt(limit, 10))
      .limit(parseInt(limit, 10))
      .lean();

    res.json({
      data: tickets,
      total,
      page: parseInt(page, 10),
      totalPages: Math.ceil(total / parseInt(limit, 10)),
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/booking-tickets
 * Fetch active tickets with filtering by status ("unapproved" | "approved") and search.
 */
router.get("/", async (req, res, next) => {
  try {
    const { status, search = "", limit = 100, page = 1 } = req.query;
    const filter = { deletedAt: null };

    if (status && (status === "unapproved" || status === "approved")) {
      filter.status = status;
    }

    if (search) {
      const regex = new RegExp(search.trim(), "i");
      filter.$or = [
        { btId: regex },
        { guestName: regex },
        { saleBy: regex },
        { createdBy: regex },
        { approvedBy: regex },
        { sp: regex },
        { product: regex },
        { detail: regex },
        { remark: regex },
      ];
    }

    const total = await BookingTicket.countDocuments(filter);
    const tickets = await BookingTicket.find(filter)
      .sort({ createdAt: -1 })
      .skip((parseInt(page, 10) - 1) * parseInt(limit, 10))
      .limit(parseInt(limit, 10))
      .lean();

    res.json({
      data: tickets,
      total,
      page: parseInt(page, 10),
      totalPages: Math.ceil(total / parseInt(limit, 10)),
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/booking-tickets
 * Create a new booking ticket.
 */
router.post("/", async (req, res, next) => {
  try {
    const { guestName, saleBy = "", sp = "", product = "Ticket", detail = "", remark = "N/A" } = req.body;

    if (!guestName || !guestName.trim()) {
      return res.status(400).json({ message: "Guest Name is required" });
    }

    const createdBy = req.user?.name || "Admin";
    const btId = await generateNextBookingTicketId();

    let finalProduct = "Ticket";
    if (product && product.trim()) {
      const matched = BOOKING_TICKET_PRODUCTS.find(
        (p) => p.toLowerCase() === product.trim().toLowerCase()
      );
      finalProduct = matched || product.trim();
    }

    const ticket = new BookingTicket({
      btId,
      guestName: guestName.trim(),
      saleBy: saleBy.trim(),
      sp: sp.trim(),
      product: finalProduct,
      detail: detail.trim(),
      remark: remark.trim() || "N/A",
      createdBy,
      status: "unapproved",
      approvedBy: "Unapproved",
    });

    await ticket.save();

    await recordActivity({
      userId: req.user?._id,
      userName: req.user?.name,
      userRole: req.user?.role,
      action: "CREATE",
      tableName: "booking_ticket",
      recordId: ticket._id.toString(),
      description: `Created booking ticket ${ticket.btId} for guest ${ticket.guestName}`,
      req,
    }).catch(() => {});

    res.status(201).json({
      message: "Booking ticket created successfully",
      ticket,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/booking-tickets/:id
 * Fetch single ticket by MongoDB _id or btId.
 */
router.get("/:id", async (req, res, next) => {
  try {
    const { id } = req.params;
    const ticket = await BookingTicket.findOne({
      $or: [{ _id: id.match(/^[0-9a-fA-F]{24}$/) ? id : null }, { btId: id }],
    }).lean();

    if (!ticket) {
      return res.status(404).json({ message: "Booking ticket not found" });
    }

    res.json(ticket);
  } catch (err) {
    next(err);
  }
});

/**
 * PUT /api/booking-tickets/:id
 * Update an existing booking ticket.
 */
router.put("/:id", async (req, res, next) => {
  try {
    const { id } = req.params;
    const { guestName, saleBy, sp, product, detail, remark } = req.body;

    const ticket = await BookingTicket.findById(id);
    if (!ticket) {
      return res.status(404).json({ message: "Booking ticket not found" });
    }

    if (guestName !== undefined) ticket.guestName = guestName.trim();
    if (saleBy !== undefined) ticket.saleBy = saleBy.trim();
    if (sp !== undefined) ticket.sp = sp.trim();
    if (product !== undefined) {
      const matched = BOOKING_TICKET_PRODUCTS.find(
        (p) => p.toLowerCase() === product.trim().toLowerCase()
      );
      ticket.product = matched || product.trim();
    }
    if (detail !== undefined) ticket.detail = detail.trim();
    if (remark !== undefined) ticket.remark = remark.trim();

    await ticket.save();

    await recordActivity({
      userId: req.user?._id,
      userName: req.user?.name,
      userRole: req.user?.role,
      action: "UPDATE",
      tableName: "booking_ticket",
      recordId: ticket._id.toString(),
      description: `Updated booking ticket ${ticket.btId}`,
      req,
    }).catch(() => {});

    res.json({
      message: "Booking ticket updated successfully",
      ticket,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * PATCH /api/booking-tickets/:id/approve
 * Transition ticket from unapproved to approved with a remark.
 */
router.patch("/:id/approve", async (req, res, next) => {
  try {
    const { id } = req.params;
    const { remark = "" } = req.body;

    const ticket = await BookingTicket.findById(id);
    if (!ticket) {
      return res.status(404).json({ message: "Booking ticket not found" });
    }

    const approverName = req.user?.name || "Admin";

    ticket.status = "approved";
    ticket.approvedBy = approverName;
    ticket.approvedAt = new Date();
    if (remark && remark.trim()) {
      ticket.remark = remark.trim();
    }

    await ticket.save();

    await recordActivity({
      userId: req.user?._id,
      userName: req.user?.name,
      userRole: req.user?.role,
      action: "UPDATE",
      tableName: "booking_ticket",
      recordId: ticket._id.toString(),
      description: `Approved booking ticket ${ticket.btId} with remark: "${ticket.remark}"`,
      req,
    }).catch(() => {});

    res.json({
      message: "Booking ticket approved successfully",
      ticket,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/booking-tickets/:id
 * Soft delete ticket to Recycle Bin.
 */
router.delete("/:id", async (req, res, next) => {
  try {
    const { id } = req.params;
    const ticket = await BookingTicket.findById(id);
    if (!ticket) {
      return res.status(404).json({ message: "Booking ticket not found" });
    }

    ticket.deletedAt = new Date();
    ticket.deletedBy = req.user?.name || "Admin";
    await ticket.save();

    await recordActivity({
      userId: req.user?._id,
      userName: req.user?.name,
      userRole: req.user?.role,
      action: "DELETE",
      tableName: "booking_ticket",
      recordId: ticket._id.toString(),
      description: `Moved booking ticket ${ticket.btId} to recycle bin`,
      req,
    }).catch(() => {});

    res.json({
      message: "Booking ticket moved to recycle bin",
      id: ticket._id,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/booking-tickets/:id/restore
 * Restore soft-deleted ticket from Recycle Bin.
 */
router.post("/:id/restore", async (req, res, next) => {
  try {
    const { id } = req.params;
    const ticket = await BookingTicket.findById(id);
    if (!ticket) {
      return res.status(404).json({ message: "Booking ticket not found" });
    }

    ticket.deletedAt = null;
    ticket.deletedBy = null;
    await ticket.save();

    await recordActivity({
      userId: req.user?._id,
      userName: req.user?.name,
      userRole: req.user?.role,
      action: "RESTORE",
      tableName: "booking_ticket",
      recordId: ticket._id.toString(),
      description: `Restored booking ticket ${ticket.btId} from recycle bin`,
      req,
    }).catch(() => {});

    res.json({
      message: "Booking ticket restored successfully",
      ticket,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/booking-tickets/:id/permanent
 * Permanently delete ticket from database.
 */
router.delete("/:id/permanent", async (req, res, next) => {
  try {
    const { id } = req.params;
    const ticket = await BookingTicket.findByIdAndDelete(id);
    if (!ticket) {
      return res.status(404).json({ message: "Booking ticket not found" });
    }

    await recordActivity({
      userId: req.user?._id,
      userName: req.user?.name,
      userRole: req.user?.role,
      action: "FORCE_DELETE",
      tableName: "booking_ticket",
      recordId: id,
      description: `Permanently deleted booking ticket ${ticket.btId}`,
      req,
    }).catch(() => {});

    res.json({
      message: "Booking ticket permanently deleted",
      id,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
