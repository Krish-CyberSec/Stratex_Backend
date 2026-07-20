const mongoose = require("mongoose");
const academicYearModel = require("../../models/academicYear.model");
const programModel = require("../../models/program.model");
const semesterModel = require("../../models/semester.model");
const sectionModel = require("../../models/section.model");
const specializationModel = require("../../models/specialization.model");

const createHttpError = (message, statusCode = 400) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const assertObjectId = (id, label) => {
  if (!mongoose.isValidObjectId(id)) {
    throw createHttpError(`${label} must be a valid ObjectId`);
  }
};

const normalizeSectionPayload = (body = {}) => ({
  name: String(body.name || "").trim(),
  academicYearId: body.academicYearId,
  programId: body.programId,
  semesterId: body.semesterId,
  specializationId: body.specializationId || null,
  capacity: body.capacity === undefined || body.capacity === "" ? 0 : Number(body.capacity),
  status: body.status || "active",
});

const validateSectionPayload = async (payload, existing = null) => {
  if (!payload.name) {
    throw createHttpError("Section name is required");
  }

  if (!["active", "inactive", "archived"].includes(payload.status)) {
    throw createHttpError("Invalid section status");
  }

  if (Number.isNaN(payload.capacity) || payload.capacity < 0) {
    throw createHttpError("Section capacity must be a positive number");
  }

  const academicYearId = payload.academicYearId || existing?.academicYearId;
  const programId = payload.programId || existing?.programId;
  const semesterId = payload.semesterId || existing?.semesterId;
  const specializationId = payload.specializationId;

  assertObjectId(academicYearId, "academicYearId");
  assertObjectId(programId, "programId");
  assertObjectId(semesterId, "semesterId");
  if (specializationId) assertObjectId(specializationId, "specializationId");

  const [academicYear, program, semester, specialization] = await Promise.all([
    academicYearModel.findById(academicYearId).lean(),
    programModel.findById(programId).lean(),
    semesterModel.findById(semesterId).lean(),
    specializationId ? specializationModel.findById(specializationId).lean() : null,
  ]);

  if (!academicYear) throw createHttpError("Academic year not found", 404);
  if (!program) throw createHttpError("Program not found", 404);
  if (!semester) throw createHttpError("Semester not found", 404);

  if (String(program.schoolId) !== String(academicYear.schoolId)) {
    throw createHttpError("Program must belong to academic year school");
  }

  if (String(semester.programId) !== String(programId)) {
    throw createHttpError("Semester must belong to selected program");
  }

  if (specializationId) {
    if (!specialization) throw createHttpError("Specialization not found", 404);
    if (String(specialization.programId) !== String(programId)) {
      throw createHttpError("Specialization must belong to selected program");
    }
  }

  return {
    ...payload,
    academicYearId,
    programId,
    semesterId,
    specializationId,
  };
};

const createSection = async (req) => {
  const payload = await validateSectionPayload(normalizeSectionPayload(req.body));

  return sectionModel.create({
    ...payload,
    createdBy: req.user._id,
    updatedBy: req.user._id,
  });
};

const updateSection = async (req, section) => {
  const payload = await validateSectionPayload(
    normalizeSectionPayload({
      ...section.toObject(),
      ...req.body,
    }),
    section
  );

  section.set({
    ...payload,
    updatedBy: req.user._id,
  });

  return section.save();
};

module.exports = {
  createSection,
  updateSection,
};
