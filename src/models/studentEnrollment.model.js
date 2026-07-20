const mongoose = require("mongoose");

const studentEnrollmentSchema = new mongoose.Schema(
  {
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    academicYearId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "AcademicYear",
      required: true,
    },
    sectionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Section",
      required: true,
    },
    programId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Program",
      required: true,
    },
    semesterId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Semester",
      required: true,
    },
    specializationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Specialization",
      default: null,
    },
    status: {
      type: String,
      enum: ["active", "inactive", "withdrawn", "completed"],
      default: "active",
    },
    enrolledBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

studentEnrollmentSchema.index(
  { studentId: 1, academicYearId: 1, sectionId: 1 },
  { unique: true }
);
studentEnrollmentSchema.index({ academicYearId: 1, sectionId: 1, status: 1 });
studentEnrollmentSchema.index({ programId: 1, semesterId: 1 });
studentEnrollmentSchema.index({ specializationId: 1 });

module.exports = mongoose.model("StudentEnrollment", studentEnrollmentSchema);
