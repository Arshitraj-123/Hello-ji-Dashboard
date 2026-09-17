/**
 * Canonical Permission Key Registry — Single Source of Truth
 *
 * All permission strings in the HelloJi system follow standard camelCase `group.action`
 * naming convention. This file is the authoritative source consumed by:
 * 1. Mongoose User & Role models for persistence validation
 * 2. Express-validator chains to reject unknown keys
 * 3. Seed scripts for bootstrap admin & preset roles
 * 4. GET /api/permissions API endpoint consumed by frontend checkbox grids
 */

export const PERMISSION_GROUPS = Object.freeze([
  {
    group: "Queries",
    key: "queries",
    permissions: [
      "queries.add",
      "queries.viewAll",
      "queries.viewRaisedBy",
      "queries.assign",
      "queries.changeStatus",
    ],
  },
  {
    group: "Booking",
    key: "booking",
    permissions: ["booking.viewAll"],
  },
  {
    group: "Calendar",
    key: "calendar",
    permissions: ["calendar.menu"],
  },
  {
    group: "Trash",
    key: "trash",
    permissions: ["trash.recycleBin"],
  },
  {
    group: "Hotel",
    key: "hotel",
    permissions: ["hotel.add", "hotel.viewAll"],
  },
  {
    group: "Customer",
    key: "customer",
    permissions: ["customer.add", "customer.view", "customer.recycleBin"],
  },
  {
    group: "Accounts",
    key: "accounts",
    permissions: ["accounts.menu"],
  },
  {
    group: "User Management",
    key: "userManagement",
    permissions: ["user.menu", "user.add", "user.viewAll", "user.log"],
  },
]);

/** Flat array of all canonical permission keys */
export const ALL_PERMISSIONS = Object.freeze(
  PERMISSION_GROUPS.flatMap((g) => g.permissions)
);

/** Set of all canonical keys for O(1) membership checks */
export const PERMISSION_SET = Object.freeze(new Set(ALL_PERMISSIONS));

/**
 * Validates whether a permission key belongs to the canonical registry.
 * @param {string} permission
 * @returns {boolean}
 */
export function isValidPermission(permission) {
  return PERMISSION_SET.has(permission);
}
