/**
 * Note Model — Dedicated collection for append-only booking/query notes.
 *
 * Indexed on bookingId for fast retrieval per booking, and on user for
 * cross-booking auditor/activity queries.
 */

import mongoose from "mongoose";

const noteSchema = new mongoose.Schema(
  {
    bookingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Booking",
      required: [true, "Booking ID is required"],
      index: true,
    },

    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Author user ID is required"],
      index: true,
    },

    note: {
      type: String,
      required: [true, "Note text is required"],
      trim: true,
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

noteSchema.set("toJSON", { transform: sanitise });
noteSchema.set("toObject", { transform: sanitise });

const Note = mongoose.model("Note", noteSchema);

export default Note;
