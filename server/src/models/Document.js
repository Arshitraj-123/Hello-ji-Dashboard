/**
 * Document Model — Files attached to Visa Customers.
 *
 * Stores original filename, web filePath, physical diskPath, file type/size,
 * and reference to parent Customer.
 */

import mongoose from "mongoose";

const documentSchema = new mongoose.Schema(
  {
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
      required: [true, "Customer reference (customerId) is required"],
      index: true,
    },

    fileName: {
      type: String,
      required: [true, "File name is required"],
      trim: true,
    },

    filePath: {
      type: String,
      required: [true, "File URL path is required"],
      trim: true,
    },

    diskPath: {
      type: String,
      required: [true, "Physical disk path is required"],
      trim: true,
    },

    fileType: {
      type: String,
      default: "",
      trim: true,
    },

    fileSize: {
      type: Number,
      default: 0,
    },

    deletedAt: {
      type: Date,
      default: null,
      index: true,
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

documentSchema.set("toJSON", { transform: sanitise });
documentSchema.set("toObject", { transform: sanitise });

const Document = mongoose.model("Document", documentSchema);

export default Document;
