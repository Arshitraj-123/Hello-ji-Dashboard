/**
 * ActivityLog Model — Audit trail for booking/query lifecycle events.
 *
 * Tracks creations, updates, conversions, status changes, assignments, and deletions.
 */

import mongoose from "mongoose";

const activityLogSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },

    userName: {
      type: String,
      default: "System",
      trim: true,
    },

    activityType: {
      type: String,
      required: true,
      enum: [
        "created",
        "updated",
        "deleted",
        "status_changed",
        "assigned",
        "converted",
        "restored",
        "force_deleted",
        "note_added",
        "brochure_emailed",
        "brochure_whatsapp",
      ],
      index: true,
    },

    tableName: {
      type: String,
      required: true,
      default: "booking",
      index: true,
    },

    recordId: {
      type: String,
      required: true,
      index: true,
    },

    changedData: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },

    ip: {
      type: String,
      default: "",
    },
  },
  {
    timestamps: true,
  }
);

// Format sanitised JSON output
const sanitise = (_doc, ret) => {
  ret.id = ret._id.toString();
  ret.user = ret.userName;
  ret.tableId = ret.recordId;
  ret.at = ret.createdAt ? new Date(ret.createdAt).toISOString() : "";
  delete ret.__v;
  return ret;
};

activityLogSchema.set("toJSON", { transform: sanitise });
activityLogSchema.set("toObject", { transform: sanitise });

const ActivityLog = mongoose.model("ActivityLog", activityLogSchema);

/**
 * Audit log recording helper.
 */
export async function recordActivity({
  req,
  userId,
  userName,
  activityType,
  tableName = "booking",
  recordId,
  changedData = {},
}) {
  try {
    const user = req?.user;
    const ip =
      req?.ip ||
      req?.headers?.["x-forwarded-for"]?.split(",")[0]?.trim() ||
      req?.socket?.remoteAddress ||
      "127.0.0.1";

    await ActivityLog.create({
      userId: userId || user?.id || null,
      userName: userName || user?.name || "System",
      activityType,
      tableName,
      recordId: String(recordId),
      changedData:
        typeof changedData === "string"
          ? changedData
          : JSON.stringify(changedData),
      ip,
    });
  } catch (err) {
    console.error("[ActivityLog] Failed to record log:", err.message);
  }
}

export default ActivityLog;
