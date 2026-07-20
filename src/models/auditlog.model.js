const mongoose = require("mongoose");
const { getAuditContext } = require("../services/audit/auditContext.service");

const auditActions = [
  "LOGIN",
  "LOGIN_FAILED",
  "LOGOUT",
  "PASSWORD_CHANGED",
  "PASSWORD_RESET",
  "PASSWORD_SETUP",
  "EMAIL_VERIFIED",
  "UNAUTHORIZED_ACCESS",
  "PERMISSION_DENIED",
  "ROLE_CHANGED",
  "USER_CREATED",
  "USER_UPDATED",
  "USER_DELETED",
  "USER_STATUS_CHANGED",
  "SCHOOL_CREATED",
  "SCHOOL_UPDATED",
  "SCHOOL_DELETED",
  "PROGRAM_CREATED",
  "PROGRAM_UPDATED",
  "PROGRAM_DELETED",
  "SPECIALIZATION_CREATED",
  "SPECIALIZATION_UPDATED",
  "SPECIALIZATION_DELETED",
  "SEMESTER_GENERATED",
  "SEMESTER_UPDATED",
  "ACADEMIC_YEAR_CREATED",
  "ACADEMIC_YEAR_UPDATED",
  "ACADEMIC_YEAR_DELETED",
  "SECTION_CREATED",
  "SECTION_UPDATED",
  "SECTION_DELETED",
  "SECTION_ASSIGNED",
  "SUBJECT_CREATED",
  "SUBJECT_UPDATED",
  "SUBJECT_DELETED",
  "FACULTY_ASSIGNED",
  "FACULTY_REMOVED",
  "COORDINATOR_ASSIGNED",
  "COORDINATOR_REMOVED",
  "STUDENT_REGISTERED",
  "STUDENT_PROMOTED",
  "NOTICE_CREATED",
  "NOTICE_UPDATED",
  "NOTICE_DELETED",
  "NOTICE_PUBLISHED",
  "EVENT_CREATED",
  "EVENT_UPDATED",
  "EVENT_DELETED",
  "NOTIFICATION_SENT",
  "NOTIFICATION_DELETED",
  "ACCOUNT_LOCKED",
  "ACCOUNT_UNLOCKED",
  "TOKEN_EXPIRED",
  "INVALID_TOKEN",
  "SUSPICIOUS_ACTIVITY",
  "DATABASE_BACKUP",
  "DATA_IMPORT",
  "DATA_EXPORT",
];

const normalizeLegacyAction = (action, module, remarks) => {
  const normalizedRemarks = String(remarks || "").toLowerCase();

  if (module === "Subject" && action === "UPDATE") {
    if (normalizedRemarks.includes("faculty assigned")) {
      return "FACULTY_ASSIGNED";
    }

    if (normalizedRemarks.includes("faculty removed")) {
      return "FACULTY_REMOVED";
    }

    if (normalizedRemarks.includes("coordinator assigned")) {
      return "COORDINATOR_ASSIGNED";
    }

    if (normalizedRemarks.includes("coordinator removed")) {
      return "COORDINATOR_REMOVED";
    }
  }

  const genericByModule = {
    User: {
      CREATE: "USER_CREATED",
      BULK_CREATE: "USER_CREATED",
      UPDATE: "USER_UPDATED",
      DELETE: "USER_DELETED",
      ACCOUNT_CREATION_FAILED: "USER_CREATED",
      USER_UPDATE_FAILED: "USER_UPDATED",
      USER_DELETE_FAILED: "USER_DELETED",
      UNAUTHORIZED_CREATE_ATTEMPT: "PERMISSION_DENIED",
      UNAUTHORIZED_UPDATE_ATTEMPT: "PERMISSION_DENIED",
      UNAUTHORIZED_DELETE_ATTEMPT: "PERMISSION_DENIED",
    },
    School: {
      CREATE: "SCHOOL_CREATED",
      BULK_CREATE: "SCHOOL_CREATED",
      UPDATE: "SCHOOL_UPDATED",
      DELETE: "SCHOOL_DELETED",
      SCHOOL_CREATION_FAILED: "SCHOOL_CREATED",
      UNAUTHORIZED_CREATE_ATTEMPT: "PERMISSION_DENIED",
      REJECT: "PERMISSION_DENIED",
    },
    Program: {
      CREATE: "PROGRAM_CREATED",
      BULK_CREATE: "PROGRAM_CREATED",
      UPDATE: "PROGRAM_UPDATED",
      DELETE: "PROGRAM_DELETED",
      PROGRAM_CREATION_FAILED: "PROGRAM_CREATED",
      PROGRAM_DURATION_CHANGE: "PROGRAM_UPDATED",
      SEMESTER_AUTO_GENERATED: "SEMESTER_GENERATED",
      SEMESTER_REGENERATED: "SEMESTER_GENERATED",
      UNAUTHORIZED_CREATE_ATTEMPT: "PERMISSION_DENIED",
    },
    Specialization: {
      CREATE: "SPECIALIZATION_CREATED",
      UPDATE: "SPECIALIZATION_UPDATED",
      DELETE: "SPECIALIZATION_DELETED",
      SPECIALIZATION_CREATION_FAILED: "SPECIALIZATION_CREATED",
      UNAUTHORIZED_CREATE_ATTEMPT: "PERMISSION_DENIED",
      REJECT: "PERMISSION_DENIED",
    },
    Semester: {
      CREATE: "SEMESTER_GENERATED",
      UPDATE: "SEMESTER_UPDATED",
      SEMESTER_CREATION_FAILED: "SEMESTER_GENERATED",
      SEMESTER_AUTO_GENERATED: "SEMESTER_GENERATED",
      SEMESTER_REGENERATED: "SEMESTER_GENERATED",
      UNAUTHORIZED_CREATE_ATTEMPT: "PERMISSION_DENIED",
    },
    AcademicYear: {
      CREATE: "ACADEMIC_YEAR_CREATED",
      UPDATE: "ACADEMIC_YEAR_UPDATED",
      DELETE: "ACADEMIC_YEAR_DELETED",
    },
    Section: {
      CREATE: "SECTION_CREATED",
      UPDATE: "SECTION_UPDATED",
      DELETE: "SECTION_DELETED",
      ASSIGN: "SECTION_ASSIGNED",
    },
    Subject: {
      CREATE: "SUBJECT_CREATED",
      BULK_CREATE: "SUBJECT_CREATED",
      UPDATE: "SUBJECT_UPDATED",
      DELETE: "SUBJECT_DELETED",
      SUBJECT_CREATION_FAILED: "SUBJECT_CREATED",
      SUBJECT_UPDATE_FAILED: "SUBJECT_UPDATED",
      SUBJECT_DELETE_FAILED: "SUBJECT_DELETED",
      FACULTY_REMOVAL_FAILED: "FACULTY_REMOVED",
      COORDINATOR_ASSIGNMENT_FAILED: "COORDINATOR_ASSIGNED",
      COORDINATOR_REMOVAL_FAILED: "COORDINATOR_REMOVED",
      UNAUTHORIZED_CREATE_ATTEMPT: "PERMISSION_DENIED",
      UNAUTHORIZED_UPDATE_ATTEMPT: "PERMISSION_DENIED",
      UNAUTHORIZED_DELETE_ATTEMPT: "PERMISSION_DENIED",
    },
    Notice: {
      CREATE: "NOTICE_CREATED",
      UPDATE: "NOTICE_UPDATED",
      DELETE: "NOTICE_DELETED",
      PUBLISH: "NOTICE_PUBLISHED",
    },
    Event: {
      CREATE: "EVENT_CREATED",
      UPDATE: "EVENT_UPDATED",
      DELETE: "EVENT_DELETED",
    },
    Notification: {
      CREATE: "NOTIFICATION_SENT",
      CREATE_NOTIFICATION: "NOTIFICATION_SENT",
      DELETE: "NOTIFICATION_DELETED",
      DELETE_NOTIFICATION: "NOTIFICATION_DELETED",
      RESTORE_NOTIFICATION: "NOTIFICATION_SENT",
      UNAUTHORIZED_NOTIFICATION_CREATE_ATTEMPT: "PERMISSION_DENIED",
      CREATE_NOTIFICATION_FAILED: "SUSPICIOUS_ACTIVITY",
      DUPLICATE_NOTIFICATION_PREVENTED: "SUSPICIOUS_ACTIVITY",
      NOTIFICATION_EXPIRED: "NOTIFICATION_DELETED",
      NOTIFICATION_PINNED: "NOTIFICATION_SENT",
      NOTIFICATION_UNPINNED: "NOTIFICATION_SENT",
      PIN_NOTIFICATION: "NOTIFICATION_SENT",
      UNPIN_NOTIFICATION: "NOTIFICATION_SENT",
      ANALYTICS_CACHE_REFRESH: "DATA_EXPORT",
    },
    Auth: {
      SETUP_PASSWORD: "PASSWORD_SETUP",
      LOGIN: "LOGIN",
      LOGIN_FAILED: "LOGIN_FAILED",
      LOGOUT: "LOGOUT",
    },
  };

  if (["READ", "READ_NOTIFICATION", "READ_ALL_NOTIFICATION", "READ_MULTIPLE_NOTIFICATION"].includes(action)) {
    return undefined;
  }

  return genericByModule[module]?.[action] || action;
};

const inferSeverity = (action, remarks) => {
  if (["ACCOUNT_LOCKED", "SUSPICIOUS_ACTIVITY"].includes(action)) {
    return "CRITICAL";
  }

  if (
    [
      "LOGIN_FAILED",
      "UNAUTHORIZED_ACCESS",
      "PERMISSION_DENIED",
      "TOKEN_EXPIRED",
      "INVALID_TOKEN",
    ].includes(action)
  ) {
    return "WARNING";
  }

  if (String(remarks || "").toLowerCase().includes("failed")) {
    return "ERROR";
  }

  return "INFO";
};

const auditLogSchema = new mongoose.Schema(
  {
    performedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    action: {
      type: String,
      required: true,
      enum: auditActions,
      index: true,
    },
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
        "Resource",
        "Subject",
        "AcademicYear",
        "Section",
        "Auth",
        "Semester",
        "Dashboard",
        "Notification",
        "System",
        "Security",
      ],
      index: true,
    },
    severity: {
      type: String,
      enum: ["INFO", "WARNING", "ERROR", "CRITICAL"],
      default: "INFO",
      index: true,
    },
    requestId: {
      type: String,
      index: true,
    },
    route: {
      type: String,
    },
    method: {
      type: String,
    },
    statusCode: {
      type: Number,
    },
    targetType: {
      type: String,
    },
    targetId: {
      type: mongoose.Schema.Types.ObjectId,
    },
    targetIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
      },
    ],
    targetName: {
      type: String,
    },
    targetNames: [
      {
        type: String,
      },
    ],
    oldData: {
      type: mongoose.Schema.Types.Mixed,
    },
    newData: {
      type: mongoose.Schema.Types.Mixed,
    },
    changes: {
      type: mongoose.Schema.Types.Mixed,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    remarks: {
      type: String,
      trim: true,
    },
    ipAddress: {
      type: String,
    },
    userAgent: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

auditLogSchema.pre("validate", function normalizeAuditLog() {
  const normalizedAction = normalizeLegacyAction(
    this.action,
    this.module,
    this.remarks
  );

  if (!normalizedAction) {
    this.invalidate("action", "Technical read events are not business audit events");
    return;
  }

  this.action = normalizedAction;

  const context = getAuditContext();

  if (context) {
    this.requestId = this.requestId || context.requestId;
    this.route = this.route || context.route;
    this.method = this.method || context.method;
    this.ipAddress = this.ipAddress || context.ipAddress;
    this.userAgent = this.userAgent || context.userAgent;
  }

  this.targetType = this.targetType || this.module;

  if (!this.severity || this.severity === "INFO") {
    this.severity = inferSeverity(this.action, this.remarks);
  }

  if (!this.metadata) {
    this.metadata = {};
  }

});

auditLogSchema.index({ createdAt: -1 });
auditLogSchema.index({ module: 1, action: 1, createdAt: -1 });
auditLogSchema.index({ performedBy: 1, createdAt: -1 });

module.exports = mongoose.model("AuditLog", auditLogSchema);
