const mongoose = require("mongoose");

/* =====================================================
   University Account
===================================================== */

const universityAccountSchema = new mongoose.Schema(
  {
    universityEmail: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },

    institutionId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
  },
  { _id: false }
);

/* =====================================================
   Academic Assignment
===================================================== */

const academicAssignmentSchema = new mongoose.Schema(
  {
    programId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Program",
      required: true,
    },

    specializationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Specialization",
      default: null,
    },

    semesterId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Semester",
      required: true,
    },

    /**
     * Used ONLY for Faculty / Coordinator
     * Students should always have an empty array.
     */
    assignedSubjects: {
      type: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: "Subject"
      }],
      validate: {
        validator: function (subjects) {
          return true;
        }
      }
    },

    /**
     * Coordinator for this academic assignment
     */
    isCoordinator: {
      type: Boolean,
      default: false,
    },

    /**
     * Primary assignment
     * Useful when a faculty belongs to multiple programs.
     */
    isPrimary: {
      type: Boolean,
      default: false,
    },

    /**
     * Assignment Status
     */
    status: {
      type: String,
      enum: ["active", "inactive", "suspended"],
      default: "active",
    },

    assignedAt: {
      type: Date,
      default: Date.now,
    },

    assignedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  { _id: false }
);

/* =====================================================
   User Schema
===================================================== */

const userSchema = new mongoose.Schema(
  {
    // Basic Information
    profileImage: {
      type: String,
      default: null,
    },

    firstName: {
      type: String,
      required: true,
      trim: true,
    },

    middleName: {
      type: String,
      trim: true,
    },

    lastName: {
      type: String,
      required: true,
      trim: true,
    },

    personalEmail: {
      type: String,
      unique: true,
      sparse: true,
      lowercase: true,
      trim: true,
    },

    /* =====================================================
       University Account
    ===================================================== */

    universityAccount: {
      type: universityAccountSchema,
      required: function () {
        return !this.roles?.includes("superAdmin");
      },
    },

    /* =====================================================
       School
    ===================================================== */

    schoolId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "School",
      required: function () {
        return !this.roles?.includes("superAdmin");
      },
    },

    /* =====================================================
       Academic Assignments
    ===================================================== */

    academicAssignments: {
      type: [academicAssignmentSchema],
      default: [],
    },

    /**
     * Keep for fast lookup.
     * Should always match the active primary assignment.
     */
    currentSemester: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Semester",
      default: null,
    },

    /* =====================================================
       Roles
    ===================================================== */

    roles: {
      type: [String],
      enum: [
        "student",
        "faculty",
        "coordinator",
        "schoolAdmin",
        "examCell",
        "superAdmin",
      ],
      required: true,
      validate: {
        validator: (roles) =>
          Array.isArray(roles) && roles.length > 0,
        message: "At least one role is required",
      },
    },

    /* =====================================================
       Status
    ===================================================== */

    status: {
      type: String,
      enum: ["active", "inactive", "suspended"],
      default: "inactive",
    },

    statusUpdatedAt: {
      type: Date,
      default: Date.now,
    },

    /* =====================================================
       Authentication
    ===================================================== */

    password: {
      type: String,
      select: false,
    },

    isEmailVerified: {
      type: Boolean,
      default: false,
    },

    mustChangePassword: {
      type: Boolean,
      default: true,
    },

    setupToken: {
      type: String,
      select: false,
    },

    setupTokenExpiry: {
      type: Date,
      select: false,
    },

    passwordResetToken: {
      type: String,
      select: false,
    },

    passwordResetTokenExpiry: {
      type: Date,
      select: false,
    },

    passwordChangedAt: {
      type: Date,
    },

    lastLogin: {
      type: Date,
    },

    /* =====================================================
       Audit
    ===================================================== */

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  {
    timestamps: true,
  }
);

/* =====================================================
   Virtuals
===================================================== */

userSchema.virtual("fullName").get(function () {
  return [this.firstName, this.middleName, this.lastName]
    .filter(Boolean)
    .join(" ");
});

userSchema.set("toJSON", {
  virtuals: true,
});

userSchema.set("toObject", {
  virtuals: true,
});

/* =====================================================
   Indexes
===================================================== */

userSchema.index({
  schoolId: 1,
});

userSchema.index({
  roles: 1,
});

userSchema.index({
  currentSemester: 1,
});

userSchema.index({
  status: 1,
});

userSchema.index({
  "academicAssignments.programId": 1,
});

userSchema.index({
  "academicAssignments.specializationId": 1,
});

userSchema.index({
  "academicAssignments.semesterId": 1,
});

userSchema.index({
  "academicAssignments.assignedSubjects": 1,
});

userSchema.index({
  "academicAssignments.isCoordinator": 1,
});

userSchema.index({
  "academicAssignments.isPrimary": 1,
});

userSchema.index({
  "academicAssignments.status": 1,
});

userSchema.index({
  "academicAssignments.programId": 1,
  "academicAssignments.specializationId": 1,
  "academicAssignments.semesterId": 1,
});

userSchema.index({
  schoolId: 1,
  roles: 1,
  status: 1,
});

const userModel = mongoose.model("User", userSchema);

module.exports = userModel;