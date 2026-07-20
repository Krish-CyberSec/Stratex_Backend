const mongoose = require("mongoose");
const academicYearModel = require("../../models/academicYear.model");
const schoolModel = require("../../models/school.model");

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

const normalizeAcademicYearPayload = (body = {}) => ({
  name: String(body.name || "").trim(),
  startDate: body.startDate ? new Date(body.startDate) : null,
  endDate: body.endDate ? new Date(body.endDate) : null,
  status: body.status || "active",
  schoolId: body.schoolId,
  isCurrent: body.isCurrent === true || body.isCurrent === "true",
});

const validateAcademicYearPayload = async (payload, existing = null) => {
  if (!payload.name) {
    throw createHttpError("Academic year name is required");
  }

  if (!payload.startDate || Number.isNaN(payload.startDate.getTime())) {
    throw createHttpError("Academic year startDate is required");
  }

  if (!payload.endDate || Number.isNaN(payload.endDate.getTime())) {
    throw createHttpError("Academic year endDate is required");
  }

  if (payload.endDate <= payload.startDate) {
    throw createHttpError("Academic year endDate must be after startDate");
  }

  if (!["active", "inactive", "archived"].includes(payload.status)) {
    throw createHttpError("Invalid academic year status");
  }

  const schoolId = payload.schoolId || existing?.schoolId;
  assertObjectId(schoolId, "schoolId");

  const school = await schoolModel.exists({ _id: schoolId });
  if (!school) {
    throw createHttpError("School not found", 404);
  }

  return {
    ...payload,
    schoolId,
  };
};

const unsetOtherCurrentYears = async ({ schoolId, exceptId = null, session = null }) => {
  const filter = {
    schoolId,
    isCurrent: true,
    ...(exceptId ? { _id: { $ne: exceptId } } : {}),
  };

  return academicYearModel.updateMany(filter, { $set: { isCurrent: false } }, { session });
};

const createAcademicYear = async (req) => {
  const payload = await validateAcademicYearPayload(normalizeAcademicYearPayload(req.body));
  const session = await mongoose.startSession();

  try {
    session.startTransaction();

    if (payload.isCurrent) {
      await unsetOtherCurrentYears({ schoolId: payload.schoolId, session });
    }

    const [academicYear] = await academicYearModel.create(
      [{
        ...payload,
        createdBy: req.user._id,
        updatedBy: req.user._id,
      }],
      { session }
    );

    await session.commitTransaction();
    return academicYear;
  } catch (err) {
    await session.abortTransaction();
    throw err;
  } finally {
    await session.endSession();
  }
};

const updateAcademicYear = async (req, academicYear) => {
  const payload = await validateAcademicYearPayload(
    {
      ...normalizeAcademicYearPayload({
        ...academicYear.toObject(),
        ...req.body,
      }),
      isCurrent: req.body.isCurrent === undefined ? academicYear.isCurrent : req.body.isCurrent === true || req.body.isCurrent === "true",
    },
    academicYear
  );
  const session = await mongoose.startSession();

  try {
    session.startTransaction();

    if (payload.isCurrent) {
      await unsetOtherCurrentYears({ schoolId: payload.schoolId, exceptId: academicYear._id, session });
    }

    academicYear.set({
      ...payload,
      updatedBy: req.user._id,
    });
    await academicYear.save({ session });

    await session.commitTransaction();
    return academicYear;
  } catch (err) {
    await session.abortTransaction();
    throw err;
  } finally {
    await session.endSession();
  }
};

module.exports = {
  createAcademicYear,
  updateAcademicYear,
};
