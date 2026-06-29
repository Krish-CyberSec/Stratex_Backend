const mongoose = require("mongoose");

const requestLogSchema = new mongoose.Schema(
  {
    requestId: {
      type: String,
      index: true,
    },
    method: {
      type: String,
      required: true,
    },
    route: {
      type: String,
      required: true,
      index: true,
    },
    statusCode: {
      type: Number,
      required: true,
      index: true,
    },
    durationMs: {
      type: Number,
      required: true,
    },
    ip: {
      type: String,
    },
    userAgent: {
      type: String,
    },
    responseSize: {
      type: Number,
      default: 0,
    },
    errorType: {
      type: String,
      default: "SERVER_ERROR",
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

module.exports = mongoose.model("RequestLog", requestLogSchema);
