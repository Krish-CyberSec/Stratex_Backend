const mongoose = require("mongoose");

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

const academicAssignmentSchema =
  new mongoose.Schema({
    programId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Program",
      required: true
    },

    specializationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Specialization"
    }
  }, { _id: false });

const userSchema = new mongoose.Schema(
  {
    // Basic Information
    profileImage: {
      type: String,
      default: null
    }
    ,
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

    // University Account
    universityAccount: {
      type: universityAccountSchema,
      required: true,
    },

    // Academic Mapping

    academicAssignments: {
      type:[academicAssignmentSchema],
      default:[]
    },
    schoolId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "School",
      required: function () {
        return !this.roles?.includes("superAdmin");
      }
    },


    // Roles
    roles: {
      type: [String],
      enum: [
        "student",
        "faculty",
        "coordinator",
        "schoolAdmin",
        "admin",
        "superAdmin",
      ],
      required: true,
      validate: {
        validator: (roles) => Array.isArray(roles) && roles.length > 0,
        message: "At least one role is required",
      },
    },

    // Account Status
    status: {
      type: String,
      enum: ["active", "inactive", "suspended"],
      default: "inactive",
    },

    // Authentication
    password: {
      type: String,
      select: false
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
      select: false
    },

    setupTokenExpiry: {
      type: Date,
      select: false,
    },

    // Audit Fields
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    lastLogin: {
      type: Date,
    },

    passwordResetToken: {
      type: String,
      select: false
    },

    passwordResetTokenExpiry: {
      type: Date,
      select: false
    },

    passwordChangedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

// Virtual Full Name
userSchema.virtual("fullName").get(function () {
  return [this.firstName, this.middleName, this.lastName]
    .filter(Boolean)
    .join(" ");
});

// Include virtuals in JSON responses
userSchema.set("toJSON", { virtuals: true });
userSchema.set("toObject", { virtuals: true });

const userModel = mongoose.model("User", userSchema);

module.exports = userModel;