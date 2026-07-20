const mongoose = require("mongoose");

const facultyAssignmentSchema = new mongoose.Schema(
  {
    facultyId: {
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
    subjectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Subject",
      required: true,
    },
    role: {
      type: String,
      enum: ["faculty", "coordinator"],
      default: "faculty",
    },
    status: {
      type: String,
      enum: ["active", "inactive"],
      default: "active",
    },
    assignedBy: {
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

facultyAssignmentSchema.index(
  { facultyId: 1, academicYearId: 1, sectionId: 1, subjectId: 1, role: 1 },
  { unique: true }
);
facultyAssignmentSchema.index({ academicYearId: 1, sectionId: 1, status: 1 });
facultyAssignmentSchema.index({ subjectId: 1, status: 1 });
facultyAssignmentSchema.index({ facultyId: 1, status: 1 });

module.exports = mongoose.model("FacultyAssignment", facultyAssignmentSchema);
