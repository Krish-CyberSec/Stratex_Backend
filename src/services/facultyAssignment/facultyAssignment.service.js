const facultyAssignmentModel = require("../../models/facultyAssignment.model");

const upsertFacultyAssignment = async ({
  facultyId,
  academicYearId,
  sectionId,
  subjectId,
  role = "faculty",
  actorId = null,
  session = null,
}) => {
  if (!facultyId || !academicYearId || !sectionId || !subjectId) {
    return null;
  }

  return facultyAssignmentModel.findOneAndUpdate(
    {
      facultyId,
      academicYearId,
      sectionId,
      subjectId,
      role,
    },
    {
      $set: {
        facultyId,
        academicYearId,
        sectionId,
        subjectId,
        role,
        status: "active",
        updatedBy: actorId,
      },
      $setOnInsert: {
        assignedBy: actorId,
      },
    },
    {
      new: true,
      upsert: true,
      session,
    }
  );
};

module.exports = {
  upsertFacultyAssignment,
};
