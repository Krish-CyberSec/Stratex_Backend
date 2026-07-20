const studentEnrollmentModel = require("../../models/studentEnrollment.model");

const toId = (value) => value?._id || value || null;

const buildEnrollmentPayload = ({ studentId, assignment, actorId }) => ({
  studentId,
  academicYearId: toId(assignment.academicYearId),
  sectionId: toId(assignment.sectionId),
  programId: toId(assignment.programId),
  semesterId: toId(assignment.semesterId),
  specializationId: toId(assignment.specializationId),
  status: assignment.status || "active",
  enrolledBy: actorId || assignment.assignedBy || null,
  updatedBy: actorId || null,
});

const syncStudentEnrollments = async ({
  student,
  actorId = null,
  session = null,
}) => {
  if (!student?.roles?.includes("student")) {
    return [];
  }

  const assignments = (student.academicAssignments || []).filter(
    (assignment) => assignment.academicYearId && assignment.sectionId
  );

  if (!assignments.length) {
    return [];
  }

  const writes = assignments.map((assignment) => {
    const payload = buildEnrollmentPayload({
      studentId: student._id,
      assignment,
      actorId,
    });

    return {
      updateOne: {
        filter: {
          studentId: payload.studentId,
          academicYearId: payload.academicYearId,
          sectionId: payload.sectionId,
        },
        update: {
          $set: {
            studentId: payload.studentId,
            academicYearId: payload.academicYearId,
            sectionId: payload.sectionId,
            programId: payload.programId,
            semesterId: payload.semesterId,
            specializationId: payload.specializationId,
            status: payload.status,
            updatedBy: payload.updatedBy,
          },
          $setOnInsert: { enrolledBy: payload.enrolledBy },
        },
        upsert: true,
      },
    };
  });

  return studentEnrollmentModel.bulkWrite(writes, { session });
};

module.exports = {
  syncStudentEnrollments,
};
