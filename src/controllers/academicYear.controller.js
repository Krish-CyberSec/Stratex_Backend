const academicYearModel = require("../models/academicYear.model");
const auditLogModel = require("../models/auditlog.model");
const { createAcademicYear, updateAcademicYear } = require("../services/academicYear/academicYear.service");
const { sendError, sendSuccess } = require("../utils/apiResponse");
const {
  createGetByIdController,
  createListController,
} = require("./rest.controller");

const writeAudit = async (req, action, academicYear, remarks) => {
  await auditLogModel.create({
    performedBy: req.user?._id,
    action,
    module: "AcademicYear",
    targetId: academicYear?._id,
    targetName: academicYear?.name,
    remarks,
    ipAddress: req.ip,
    userAgent: req.headers["user-agent"],
  });
};

const canManageAcademicYears = (req) =>
  req.user?.roles?.some((role) => ["superAdmin", "schoolAdmin"].includes(role));

const assertCanManage = (req, res) => {
  if (canManageAcademicYears(req)) return true;

  sendError(res, 403, "You are not allowed to manage academic years");
  return false;
};

const options = {
  resourceName: "Academic Year",
  resourceKey: "academicYear",
  collectionName: "academicYears",
  searchFields: ["name"],
  filterMap: {
    schoolId: { field: "schoolId", type: "objectId" },
    status: "status",
    isCurrent: { field: "isCurrent", type: "boolean" },
  },
  allowedSortFields: ["name", "startDate", "endDate", "status", "createdAt", "updatedAt"],
  populate: [
    { path: "schoolId", select: "name slug" },
    { path: "createdBy", select: "firstName lastName" },
    { path: "updatedBy", select: "firstName lastName" },
  ],
};

const getAcademicYears = createListController(academicYearModel, options);
const getAcademicYearById = createGetByIdController(academicYearModel, options);

const create = async (req, res) => {
  try {
    if (!assertCanManage(req, res)) return;

    const academicYear = await createAcademicYear(req);
    await writeAudit(req, "ACADEMIC_YEAR_CREATED", academicYear, "Academic year created");

    return sendSuccess(res, 201, "Academic year created successfully", academicYear);
  } catch (err) {
    console.error(err);
    return sendError(res, err.statusCode || 500, err.statusCode ? err.message : "Internal Server Error");
  }
};

const update = async (req, res) => {
  try {
    if (!assertCanManage(req, res)) return;

    const academicYear = await academicYearModel.findById(req.params.id);
    if (!academicYear) return sendError(res, 404, "Academic year not found");

    const updated = await updateAcademicYear(req, academicYear);
    await writeAudit(req, "ACADEMIC_YEAR_UPDATED", updated, "Academic year updated");

    return sendSuccess(res, 200, "Academic year updated successfully", updated);
  } catch (err) {
    console.error(err);
    return sendError(res, err.statusCode || 500, err.statusCode ? err.message : "Internal Server Error");
  }
};

const remove = async (req, res) => {
  try {
    if (!assertCanManage(req, res)) return;

    const academicYear = await academicYearModel.findById(req.params.id);
    if (!academicYear) return sendError(res, 404, "Academic year not found");

    academicYear.status = "inactive";
    academicYear.isCurrent = false;
    academicYear.updatedBy = req.user._id;
    await academicYear.save();

    await writeAudit(req, "ACADEMIC_YEAR_DELETED", academicYear, "Academic year deactivated");

    return sendSuccess(res, 200, "Academic year deleted successfully", academicYear);
  } catch (err) {
    console.error(err);
    return sendError(res, 500, "Internal Server Error");
  }
};

module.exports = {
  create,
  getAcademicYearById,
  getAcademicYears,
  remove,
  update,
};
