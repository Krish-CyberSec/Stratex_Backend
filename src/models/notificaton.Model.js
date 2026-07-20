const mongoose = require("mongoose");
const { Schema } = mongoose;



const AudienceCriteriaSchema = new mongoose.Schema(
  {
    allUsers: {
      type: Boolean,
      default: false,
    },

    userIds: [
      {
        type: Schema.Types.ObjectId,
        ref: "User",
      },
    ],

    roles: [
      {
        type: String,
        enum: [
          "superAdmin",
          "schoolAdmin",
          "faculty",
          "coordinator",
          "student",
          "examCell",
        ],
      },
    ],

    schoolIds: [
      {
        type: Schema.Types.ObjectId,
        ref: "School",
      },
    ],

    programIds: [
      {
        type: Schema.Types.ObjectId,
        ref: "Program",
      },
    ],

    specializationIds: [
      {
        type: Schema.Types.ObjectId,
        ref: "Specialization",
      },
    ],

    semesterIds: [
      {
        type: Schema.Types.ObjectId,
        ref: "Semester",
      },
    ],

    academicYearIds: [
      {
        type: Schema.Types.ObjectId,
        ref: "AcademicYear",
      },
    ],

    sectionIds: [
      {
        type: Schema.Types.ObjectId,
        ref: "Section",
      },
    ],

    includeUsersWithoutSpecialization: {
      type: Boolean,
      default: false,
    },

    excludeUserIds: [
      {
        type: Schema.Types.ObjectId,
        ref: "User",
      },
    ],

    excludeRoles: [
      {
        type: String,
        enum: [
          "superAdmin",
          "schoolAdmin",
          "faculty",
          "coordinator",
          "student",
          "examCell",
        ],
      },
    ],
  },
  {
    _id: false,
  }
);


const NotificationSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },

    message: {
      type: String,
      required: true,
      trim: true,
      maxlength: 5000,
    },

    type: {
      type: String,
      required: true,
      enum: [
        "system",
        "notice",
        "event",
        "user",
        "program",
        "subject",
        "attendance",
        "exam",
        "result",
        "placement",
        "fee",
        "library",
      ],
    },

    priority: {
      type: String,
      enum: [
        "low",
        "normal",
        "high",
        "urgent",
      ],
      default: "normal",
    },

    senderId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    audience: AudienceCriteriaSchema,

    reference: {
      model: {
        type: String,
        enum: [
          "User",
          "School",
          "Program",
          "Specialization",
          "Semester",
          "AcademicYear",
          "Section",
          "Subject",
          "Notice",
          "Event",
          "Attendance",
          "Exam",
          "Result",
        ],
        default: null,
      },

      id: {
        type: Schema.Types.ObjectId,
        default: null,
      },
    },

    action: {
      label: String,

      url: String,
    },

    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },

    expiresAt: {
      type: Date,
      default: null,
    },

    isExpired: {
      type: Boolean,
      default: false,
    },

    expiredAt: {
      type: Date,
      default: null,
    },

    duplicateKey: {
      type: String,
      default: null,
      index: true,
    },

    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  {
    timestamps: true,
  }
);


// Timeline
NotificationSchema.index({
  createdAt: -1,
});

// Notification type
NotificationSchema.index({
  type: 1,
  createdAt: -1,
});

// Priority feed
NotificationSchema.index({
  priority: 1,
  createdAt: -1,
});

// Sender history
NotificationSchema.index({
  senderId: 1,
  createdAt: -1,
});

// Related document
NotificationSchema.index({
  "reference.model": 1,
  "reference.id": 1,
});

// Audience
NotificationSchema.index({
  "audience.userIds": 1,
});

NotificationSchema.index({
  "audience.roles": 1,
});

NotificationSchema.index({
  "audience.schoolIds": 1,
});

NotificationSchema.index({
  "audience.programIds": 1,
});

NotificationSchema.index({
  "audience.specializationIds": 1,
});

NotificationSchema.index({
  "audience.semesterIds": 1,
});

NotificationSchema.index({
  "audience.academicYearIds": 1,
});

NotificationSchema.index({
  "audience.sectionIds": 1,
});

NotificationSchema.index({
  "audience.allUsers": 1,
});

// Expiry
NotificationSchema.index({
  expiresAt: 1,
});

NotificationSchema.index({
  isExpired: 1,
  expiresAt: 1,
});

NotificationSchema.index({
  duplicateKey: 1,
  createdAt: -1,
});

module.exports = mongoose.model("Notification", NotificationSchema);
