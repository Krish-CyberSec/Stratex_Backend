const mongoose = require("mongoose");

const eventSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true
    },
    description: {
      type: String,
      trim: true
    },
    startDate: {
      type: Date,
      required: true
    },
    endDate: {
      type: Date
    },
    location: {
      type: String,
      trim: true
    },
    banner: {
      type: String,
      default: null
    },
    bannerFileId: {
      type: String,
      default: null
    },
    poster: {
      type: String,
      default: null
    },
    posterFileId: {
      type: String,
      default: null
    },
    status: {
      type: String,
      enum: ["scheduled", "completed", "cancelled", "inactive"],
      default: "scheduled"
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User"
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User"
    }
  },
  {
    timestamps: true
  }
);

eventSchema.index({ startDate: 1 });

module.exports = mongoose.model("Event", eventSchema);
