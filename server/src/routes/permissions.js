/**
 * Permissions route — exposes the canonical permission registry.
 *
 * GET /api/permissions — returns structured groups and flat array
 */

import { Router } from "express";
import {
  PERMISSION_GROUPS,
  ALL_PERMISSIONS,
} from "../constants/permissions.js";
import { authenticate } from "../middleware/authenticate.js";

const router = Router();

router.get("/", authenticate, (_req, res) => {
  res.json({
    groups: PERMISSION_GROUPS,
    permissionGroups: PERMISSION_GROUPS,
    permissions: ALL_PERMISSIONS,
    total: ALL_PERMISSIONS.length,
  });
});

export default router;
