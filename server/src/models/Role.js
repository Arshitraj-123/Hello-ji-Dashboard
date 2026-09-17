/**
 * Role Model
 *
 * In HelloJi CRM, permissions live directly on the User record (User.permissions),
 * not resolved dynamically through a role at authorization time.
 * A `Role` is a named, reusable permission preset for admin convenience.
 * Applying a role copies its permissions array onto the user.
 * Deleting or modifying a role does not affect already-assigned users.
 */

import mongoose from "mongoose";
import { ALL_PERMISSIONS } from "../constants/permissions.js";

const roleSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Role name is required"],
      unique: true,
      trim: true,
    },

    description: {
      type: String,
      trim: true,
      default: "",
    },

    permissions: {
      type: [String],
      default: [],
      validate: {
        validator: function (perms) {
          if (!Array.isArray(perms)) return false;
          return perms.every((p) => ALL_PERMISSIONS.includes(p));
        },
        message: (props) =>
          `Unknown permission key in [${props.value}]. Must be defined in the canonical permission registry.`,
      },
    },

    isSystem: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

// Strip __v and map _id to id in JSON output
const sanitise = (_doc, ret) => {
  ret.id = ret._id.toString();
  delete ret.__v;
  return ret;
};

roleSchema.set("toJSON", { transform: sanitise });
roleSchema.set("toObject", { transform: sanitise });

const Role = mongoose.model("Role", roleSchema);

export default Role;
