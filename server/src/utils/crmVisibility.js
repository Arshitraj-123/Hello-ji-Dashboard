/**
 * CRM Access Control & Visibility Helpers
 *
 * Implements strict database-level filtering and field-level permission gating:
 * - Admin or holders of `viewAll` permission see all records.
 * - Standard agents only see documents where createdBy = agent.id OR assignedAgent = agent.id.
 * - `queries.viewRaisedBy`: omits `createdBy` from JSON output if requester lacks this permission.
 */

import mongoose from "mongoose";

/**
 * Builds the MongoDB query visibility filter based on user role and permissions.
 *
 * @param {Object} user - req.user ({ id, role, permissions })
 * @param {string} [viewAllPermission] - e.g. "queries.viewAll" or "booking.viewAll"
 * @returns {Object} MongoDB filter object
 */
export function buildVisibilityFilter(user, viewAllPermission) {
  if (
    user.role === "admin" ||
    (viewAllPermission && user.permissions?.includes(viewAllPermission))
  ) {
    return {};
  }

  if (!mongoose.isValidObjectId(user.id)) {
    return { _id: null };
  }

  const userObjId = new mongoose.Types.ObjectId(user.id);
  return {
    $or: [{ createdBy: userObjId }, { assignedAgent: userObjId }],
  };
}

/**
 * Checks if a specific document is visible/accessible to the user.
 *
 * @param {Object} doc - Mongoose document or plain object with createdBy and assignedAgent
 * @param {Object} user - req.user ({ id, role, permissions })
 * @param {string} [viewAllPermission] - e.g. "queries.viewAll" or "booking.viewAll"
 * @returns {boolean}
 */
export function canAccessDocument(doc, user, viewAllPermission) {
  if (user.role === "admin") return true;
  if (viewAllPermission && user.permissions?.includes(viewAllPermission)) {
    return true;
  }

  const userIdStr = user.id.toString();
  const createdByStr = (doc.createdBy?._id || doc.createdBy)?.toString();
  const assignedAgentStr = (
    doc.assignedAgent?._id || doc.assignedAgent
  )?.toString();

  return createdByStr === userIdStr || assignedAgentStr === userIdStr;
}

/**
 * Conditionally strips `createdBy` if the requester lacks `queries.viewRaisedBy`.
 * Admins always retain it.
 *
 * @param {Object|Array} data - Single doc or array of docs
 * @param {Object} user - req.user
 * @returns {Object|Array}
 */
export function applyRaisedByFilter(data, user) {
  const canView =
    user.role === "admin" ||
    user.permissions?.includes("queries.viewRaisedBy");

  if (canView) return data;

  if (Array.isArray(data)) {
    return data.map((item) => stripRaisedBy(item));
  }
  return stripRaisedBy(data);
}

function stripRaisedBy(item) {
  if (!item) return item;
  const obj =
    typeof item.toObject === "function" ? item.toObject() : { ...item };
  delete obj.createdBy;
  return obj;
}
