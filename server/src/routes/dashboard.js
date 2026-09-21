/**
 * Dashboard summary endpoint — role-filtered live KPI counts and chart data.
 *
 * GET /api/dashboard/summary — authenticated
 *
 * ROLE-BASED VISIBILITY GUARANTEE:
 * - Admin: queries all documents across the system.
 * - Agent: strictly queries only documents where { createdBy: user.id } OR { assignedAgent: user.id }.
 * Filtering is executed entirely server-side in the MongoDB query; an agent never receives
 * another agent's records or counts over the wire.
 */

import { Router } from "express";
import mongoose from "mongoose";
import Booking from "../models/Booking.js";
import { authenticate } from "../middleware/authenticate.js";

const router = Router();

router.use(authenticate);

router.get("/summary", async (req, res, next) => {
  try {
    // ─── Server-side Role-Based Visibility Filter ───────────────────────
    const filter = { deletedAt: null };
    if (req.user.role === "agent") {
      const userObjId = new mongoose.Types.ObjectId(req.user.id);
      filter.$or = [{ createdBy: userObjId }, { assignedAgent: userObjId }];
    }

    // Parallel count queries for the 5 KPI cards
    const [newQueries, pipeline, confirmed, allBooked, totalAborted] =
      await Promise.all([
        Booking.countDocuments({ ...filter, status: "New Query" }),
        Booking.countDocuments({ ...filter, status: "Pipeline" }),
        Booking.countDocuments({ ...filter, status: { $in: ["Confirmed", "confirmed"] } }),
        Booking.countDocuments({ ...filter, status: { $in: ["booked", "Booked"] } }),
        Booking.countDocuments({ ...filter, status: { $in: ["Abort", "abort"] } }),
      ]);

    // Product breakdown for bar chart
    const productAggregation = await Booking.aggregate([
      { $match: filter },
      {
        $group: {
          _id: "$product",
          count: { $sum: 1 },
        },
      },
    ]);

    const productMap = productAggregation.reduce((acc, curr) => {
      acc[curr._id] = curr.count;
      return acc;
    }, {});

    const byProduct = ["hotel", "ticket", "package", "visa", "insurance"].map(
      (product) => ({
        product,
        count: productMap[product] || 0,
      })
    );

    // Recent 6 bookings matching caller's visibility scope
    const recent = await Booking.find(filter)
      .sort({ createdAt: -1 })
      .limit(6)
      .populate("assignedAgent", "name email")
      .populate("createdBy", "name email")
      .lean();

    const formattedRecent = recent.map((b) => ({
      id: b._id.toString(),
      bookingId: b.bookingId,
      name: b.name,
      product: b.product,
      city: b.city || "",
      assignedAgent: b.assignedAgent?.name || "Unassigned",
      status: b.status,
      date: b.createdAt
        ? new Date(b.createdAt).toISOString().slice(0, 10)
        : "",
    }));

    return res.json({
      counts: {
        newQueries,
        pipeline,
        confirmed,
        allBooked,
        totalAborted,
        total: newQueries + pipeline + confirmed + allBooked + totalAborted,
      },
      charts: {
        queriesVsConfirmedVsBooked: [
          {
            name: "New Queries",
            value: newQueries,
            fill: "#475569",
          },
          {
            name: "Confirmed",
            value: confirmed,
            fill: "#0d9488",
          },
          {
            name: "Booked",
            value: allBooked,
            fill: "#c0392b",
          },
        ],
        pipelineVsAborted: [
          {
            name: "Pipeline",
            value: pipeline,
            fill: "#d97706",
          },
          {
            name: "Aborted",
            value: totalAborted,
            fill: "#94a3b8",
          },
        ],
        byProduct,
      },
      recent: formattedRecent,
      meta: {
        role: req.user.role,
        scope: req.user.role === "admin" ? "all" : "assigned_only",
      },
    });
  } catch (err) {
    next(err);
  }
});

export default router;
