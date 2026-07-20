const mongoose = require("mongoose");
const schoolModel = require("../../models/school.model");
const programModel = require("../../models/program.model");
const specializationModel = require("../../models/specelization.model");
const semesterModel = require("../../models/semester.model");
const subjectModel = require("../../models/subject.model");
const academicYearModel = require("../../models/academicYear.model");
const sectionModel = require("../../models/section.model");
const { roleRequiresAcademicAssignments } = require("./validateRole.service");

const toId = (value) => value?.toString();

const assertObjectId = (value, label) => {
  if (!mongoose.isValidObjectId(value)) {
    const error = new Error(`${label} must be a valid ObjectId`);
    error.statusCode = 400;
    throw error;
  }
};

const unique = (values) => [...new Set(values.filter(Boolean).map(String))];

const buildMap = (docs) =>
  new Map(docs.map((doc) => [doc._id.toString(), doc]));

const hydrateAssignmentFromSection = (assignment, section) => {
  if (!section) return assignment;

  return {
    ...assignment,
    academicYearId: assignment.academicYearId || section.academicYearId,
    programId: assignment.programId || section.programId,
    semesterId: assignment.semesterId || section.semesterId,
    specializationId: assignment.specializationId || section.specializationId || null,
  };
};

const assertSemesterOwnership = (semester, assignment) => {
  if (toId(semester.programId) !== toId(assignment.programId)) {
    const error = new Error("Semester does not belong to selected program");
    error.statusCode = 400;
    throw error;
  }
};

const assertSubjectOwnership = (subject, assignment) => {
  if (toId(subject.programId) !== toId(assignment.programId)) {
    const error = new Error("Assigned subject does not belong to selected program");
    error.statusCode = 400;
    throw error;
  }

  if (toId(subject.semesterId) !== toId(assignment.semesterId)) {
    const error = new Error("Assigned subject does not belong to selected semester");
    error.statusCode = 400;
    throw error;
  }

  if (assignment.specializationId) {
    if (toId(subject.specializationId) !== toId(assignment.specializationId)) {
      const error = new Error("Assigned subject does not belong to selected specialization");
      error.statusCode = 400;
      throw error;
    }

    return;
  }

  if (subject.specializationId) {
    const error = new Error("Assigned subject belongs to a specialization");
    error.statusCode = 400;
    throw error;
  }
};

const assertSectionOwnership = (section, assignment) => {
  if (toId(section.programId) !== toId(assignment.programId)) {
    const error = new Error("Section does not belong to selected program");
    error.statusCode = 400;
    throw error;
  }

  if (toId(section.semesterId) !== toId(assignment.semesterId)) {
    const error = new Error("Section does not belong to selected semester");
    error.statusCode = 400;
    throw error;
  }

  if (toId(section.academicYearId) !== toId(assignment.academicYearId)) {
    const error = new Error("Section does not belong to selected academic year");
    error.statusCode = 400;
    throw error;
  }

  if (assignment.specializationId) {
    if (toId(section.specializationId) !== toId(assignment.specializationId)) {
      const error = new Error("Section does not belong to selected specialization");
      error.statusCode = 400;
      throw error;
    }

    return;
  }

  if (section.specializationId) {
    const error = new Error("Core students must be assigned to a core section");
    error.statusCode = 400;
    throw error;
  }
};

const validateAcademicAssignments = async ({ userData, roles }) => {
  const academicAssignments = Array.isArray(userData.academicAssignments)
    ? userData.academicAssignments
    : [];
  const requiresAcademicAssignments = roleRequiresAcademicAssignments(roles);

  if (!requiresAcademicAssignments) {
    if (academicAssignments.length > 0) {
      const label = roles.includes("examCell")
        ? "Exam Cell users cannot have academic assignments"
        : "School Admin users cannot have academic assignments";
      const error = new Error(label);
      error.statusCode = 400;
      throw error;
    }

    return {
      academicAssignments: [],
      currentSemester: null,
    };
  }

  if (!academicAssignments.length) {
    const error = new Error("At least one academic assignment is required");
    error.statusCode = 400;
    throw error;
  }

  if (roles.includes("student") && academicAssignments.length !== 1) {
    const error = new Error("Student must belong to exactly one academic assignment");
    error.statusCode = 400;
    throw error;
  }

  const schoolId = userData.schoolId;
  assertObjectId(schoolId, "School ID");

  const sectionIds = unique(academicAssignments.map((assignment) => assignment.sectionId));
  sectionIds.forEach((id) => assertObjectId(id, "Section ID"));

  const [school, sections] = await Promise.all([
    schoolModel.findById(schoolId).lean(),
    sectionIds.length ? sectionModel.find({ _id: { $in: sectionIds } }).lean() : [],
  ]);

  if (!school) {
    const error = new Error("School not found");
    error.statusCode = 404;
    throw error;
  }

  const sectionMap = buildMap(sections);

  sectionIds.forEach((sectionId) => {
    if (!sectionMap.has(sectionId)) {
      const error = new Error("Section not found");
      error.statusCode = 404;
      throw error;
    }
  });

  const enrichedAssignments = academicAssignments.map((assignment) =>
    hydrateAssignmentFromSection(
      assignment,
      assignment.sectionId ? sectionMap.get(toId(assignment.sectionId)) : null
    )
  );

  const assignmentKeys = enrichedAssignments.map(
    (assignment) =>
      `${toId(assignment.programId)}-${toId(assignment.specializationId) || ""}-${toId(assignment.semesterId)}-${toId(assignment.academicYearId) || ""}-${toId(assignment.sectionId) || ""}`
  );

  if (new Set(assignmentKeys).size !== assignmentKeys.length) {
    const error = new Error("Duplicate academic assignments are not allowed");
    error.statusCode = 400;
    throw error;
  }

  const programIds = unique(enrichedAssignments.map((assignment) => assignment.programId));
  const specializationIds = unique(
    enrichedAssignments.map((assignment) => assignment.specializationId)
  );
  const semesterIds = unique(enrichedAssignments.map((assignment) => assignment.semesterId));
  const academicYearIds = unique(enrichedAssignments.map((assignment) => assignment.academicYearId));
  const subjectIds = unique(
    enrichedAssignments.flatMap((assignment) => assignment.assignedSubjects || [])
  );

  programIds.forEach((id) => assertObjectId(id, "Program ID"));
  specializationIds.forEach((id) => assertObjectId(id, "Specialization ID"));
  semesterIds.forEach((id) => assertObjectId(id, "Semester ID"));
  academicYearIds.forEach((id) => assertObjectId(id, "Academic Year ID"));
  subjectIds.forEach((id) => assertObjectId(id, "Subject ID"));

  const [programs, specializations, semesters, academicYears, subjects] = await Promise.all([
    programModel.find({ _id: { $in: programIds } }).lean(),
    specializationIds.length
      ? specializationModel.find({ _id: { $in: specializationIds } }).lean()
      : [],
    semesterModel.find({ _id: { $in: semesterIds } }).lean(),
    academicYearIds.length
      ? academicYearModel.find({ _id: { $in: academicYearIds } }).lean()
      : [],
    subjectIds.length ? subjectModel.find({ _id: { $in: subjectIds } }).lean() : [],
  ]);

  const programMap = buildMap(programs);
  const specializationMap = buildMap(specializations);
  const semesterMap = buildMap(semesters);
  const academicYearMap = buildMap(academicYears);
  const subjectMap = buildMap(subjects);

  const normalizedAssignments = enrichedAssignments.map((assignment) => {
    if (!assignment.programId) {
      const error = new Error("Program ID is required");
      error.statusCode = 400;
      throw error;
    }

    if (!assignment.semesterId) {
      const error = new Error("Student must have program and semester assigned");
      error.statusCode = 400;
      throw error;
    }

    const program = programMap.get(toId(assignment.programId));
    if (!program) {
      const error = new Error(`Program not found: ${assignment.programId}`);
      error.statusCode = 404;
      throw error;
    }

    if (toId(program.schoolId) !== toId(schoolId)) {
      const error = new Error("Program does not belong to selected school");
      error.statusCode = 400;
      throw error;
    }

    if (assignment.specializationId) {
      const specialization = specializationMap.get(toId(assignment.specializationId));
      if (!specialization) {
        const error = new Error("Specialization not found");
        error.statusCode = 404;
        throw error;
      }

      if (toId(specialization.programId) !== toId(assignment.programId)) {
        const error = new Error("Specialization does not belong to selected program");
        error.statusCode = 400;
        throw error;
      }
    }

    const semester = semesterMap.get(toId(assignment.semesterId));
    if (!semester) {
      const error = new Error("Semester not found");
      error.statusCode = 404;
      throw error;
    }

    assertSemesterOwnership(semester, assignment);

    if (assignment.academicYearId) {
      const academicYear = academicYearMap.get(toId(assignment.academicYearId));
      if (!academicYear) {
        const error = new Error("Academic year not found");
        error.statusCode = 404;
        throw error;
      }

      if (toId(academicYear.schoolId) !== toId(schoolId)) {
        const error = new Error("Academic year does not belong to selected school");
        error.statusCode = 400;
        throw error;
      }
    }

    if (assignment.sectionId) {
      const section = sectionMap.get(toId(assignment.sectionId));
      if (!section) {
        const error = new Error("Section not found");
        error.statusCode = 404;
        throw error;
      }

      assertSectionOwnership(section, assignment);
    }

    const assignedSubjects = roles.includes("student")
      ? []
      : unique(assignment.assignedSubjects || []);

    assignedSubjects.forEach((subjectId) => {
      const subject = subjectMap.get(toId(subjectId));
      if (!subject) {
        const error = new Error("Assigned subject not found");
        error.statusCode = 404;
        throw error;
      }

      assertSubjectOwnership(subject, assignment);
    });

    return {
      ...assignment,
      specializationId: assignment.specializationId || null,
      academicYearId: assignment.academicYearId || null,
      sectionId: assignment.sectionId || null,
      assignedSubjects,
      isCoordinator: roles.includes("coordinator") || Boolean(assignment.isCoordinator),
      isPrimary: Boolean(assignment.isPrimary),
      status: assignment.status || "active",
    };
  });

  return {
    academicAssignments: normalizedAssignments,
    currentSemester: roles.includes("student")
      ? normalizedAssignments[0].semesterId
      : userData.currentSemester || normalizedAssignments[0]?.semesterId || null,
  };
};

module.exports = {
  assertSemesterOwnership,
  assertSubjectOwnership,
  validateAcademicAssignments,
};
