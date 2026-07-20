const mongoose = require("mongoose");
const sectionModel = require("../../models/section.model");

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

const validateTeachingSection = async ({ academicYearId, sectionId, subject }) => {
  if (!academicYearId && !sectionId) {
    return null;
  }

  if (!academicYearId || !sectionId) {
    throw createHttpError("academicYearId and sectionId must be provided together");
  }

  assertObjectId(academicYearId, "academicYearId");
  assertObjectId(sectionId, "sectionId");

  const section = await sectionModel.findById(sectionId).lean();

  if (!section) {
    throw createHttpError("Section not found", 404);
  }

  if (String(section.academicYearId) !== String(academicYearId)) {
    throw createHttpError("Section must belong to the selected academic year");
  }

  if (String(section.programId) !== String(subject.programId)) {
    throw createHttpError("Section program must match subject program");
  }

  if (String(section.semesterId) !== String(subject.semesterId)) {
    throw createHttpError("Section semester must match subject semester");
  }

  const subjectSpecializationId = subject.specializationId ? String(subject.specializationId) : null;
  const sectionSpecializationId = section.specializationId ? String(section.specializationId) : null;

  if (subjectSpecializationId !== sectionSpecializationId) {
    throw createHttpError("Section specialization must match subject specialization");
  }

  return section;
};

module.exports = {
  validateTeachingSection,
};
