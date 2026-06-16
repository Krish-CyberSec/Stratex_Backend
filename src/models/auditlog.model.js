const mongoose = require("mongoose");

const auditLogSchema = new mongoose.Schema(
  {
    // Who performed the action
    performedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User"
    },

    // What action happened
    action: {
      type: String,
      required: true,
      enum: [
        "CREATE",
        "UPDATE",
        "DELETE",
        "LOGIN",
        "LOGOUT",
        "APPROVE",
        "REJECT",
        "PUBLISH",
        "ARCHIVE",
        "EMAIL_FAILED",
        "EMAIL_SENT",
        "ACCOUNT_CREATION_FAILED",
        "UNAUTHORIZED_CREATE_ATTEMPT"
      ]
    },

    // Which module was affected
    module: {
      type: String,
      required: true,
      enum: [
        "User",
        "School",
        "Program",
        "Specialization",
        "Notice",
        "Event",
        "Resource"
      ]
    },

    // ID of affected document
    targetId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true
    },

    // Human-readable title
    targetName: {
      type: String
    },

    // Before update
    oldData: {
      type: mongoose.Schema.Types.Mixed
    },

    // After update
    newData: {
      type: mongoose.Schema.Types.Mixed
    },

    // Changed fields only
    changes: {
      type: mongoose.Schema.Types.Mixed
    },

    // Optional reason/comment
    remarks: {
      type: String,
      trim: true
    },

    // Request metadata
    ipAddress: {
      type: String
    },

    userAgent: {
      type: String
    }
  },
  {
    timestamps: true
  }
);

const auditLogModel = mongoose.model("AuditLog", auditLogSchema);
module.exports = auditLogModel