import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import config from "../config/index.js";
import { ALL_PERMISSIONS } from "../constants/permissions.js";

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true,
    },

    email: {
      type: String,
      unique: true,
      sparse: true, // allows null while keeping uniqueness for present values
      lowercase: true,
      trim: true,
    },

    phone: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
    },

    passwordHash: {
      type: String,
      required: [true, "Password is required"],
    },

    role: {
      type: String,
      enum: {
        values: ["admin", "agent"],
        message: "Role must be admin or agent",
      },
      default: "agent",
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

    status: {
      type: String,
      enum: {
        values: ["active", "inactive"],
        message: "Status must be active or inactive",
      },
      default: "active",
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    photo: {
      type: String,
      default: "",
    },

    address: {
      type: String,
      default: "",
    },
  },
  {
    timestamps: true, // adds createdAt, updatedAt
  }
);

// ─── Custom validation: at least one of email or phone must be present ───
userSchema.pre("validate", function (next) {
  if (!this.email && !this.phone) {
    this.invalidate(
      "email",
      "At least one of email or phone must be provided"
    );
    this.invalidate(
      "phone",
      "At least one of email or phone must be provided"
    );
  }
  next();
});

// ─── Schema-level safety net: strip passwordHash and __v from every
//     JSON / object serialisation so no endpoint can accidentally leak
//     the hash — this is intentionally NOT done per-query with .select()
//     which is easy to forget on one route. ───
const sanitise = (doc, ret) => {
  ret.id = ret._id.toString();
  delete ret.passwordHash;
  delete ret.__v;
  return ret;
};

userSchema.set("toJSON", { transform: sanitise });
userSchema.set("toObject", { transform: sanitise });

// ─── Instance helper: compare a plaintext candidate against the stored hash ───
userSchema.methods.comparePassword = async function (candidate) {
  return bcrypt.compare(candidate, this.passwordHash);
};

// ─── Static helper: hash a plaintext password ───
userSchema.statics.hashPassword = async function (plaintext) {
  return bcrypt.hash(plaintext, config.bcryptRounds);
};

const User = mongoose.model("User", userSchema);

export default User;
