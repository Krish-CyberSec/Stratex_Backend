const sectionModel = require("../models/section.model");
const auditLogModel = require("../models/auditlog.model");
const { createSection, updateSection } = require("../services/section/section.service");
const { sendError, sendSuccess } = require("../utils/apiResponse");
const {
  createGetByIdController,
  createListController,
} = require("./rest.controller");

const writeAudit = async (req, action, section, remarks) => {
  await auditLogModel.create({
    performedBy: req.user?._id,
    action,
    module: "Section",
    targetId: section?._id,
    targetName: section?.name,
    remarks,
    ipAddress: req.ip,
    userAgent: req.headers["user-agent"],
  });
};

const canManageSections = (req) =>
  req.user?.roles?.some((role) => ["superAdmin", "schoolAdmin"].includes(role));

const assertCanManage = (req, res) => {
  if (canManageSections(req)) return true;

  sendError(res, 403, "You are not allowed to manage sections");
  return false;
};

const options = {
  resourceName: "Section",
  resourceKey: "section",
  collectionName: "sections",
  searchFields: ["name"],
  filterMap: {
    academicYearId: { field: "academicYearId", type: "objectId" },
    programId: { field: "programId", type: "objectId" },
    semesterId: { field: "semesterId", type: "objectId" },
    specializationId: { field: "specializationId", type: "objectId" },
    status: "status",
  },
  allowedSortFields: ["name", "capacity", "status", "createdAt", "updatedAt"],
  populate: [
    { path: "academicYearId", select: "name startDate endDate isCurrent status" },
    { path: "programId", select: "name code degreeType" },
    { path: "semesterId", select: "semesterNumber status" },
    { path: "specializationId", select: "name code" },
    { path: "createdBy", select: "firstName lastName" },
    { path: "updatedBy", select: "firstName lastName" },
  ],
};

const getSections = createListController(sectionModel, options);
const getSectionById = createGetByIdController(sectionModel, options);

const create = async (req, res) => {
  try {
    if (!assertCanManage(req, res)) return;

    const section = await createSection(req);
    await writeAudit(req, "SECTION_CREATED", section, "Section created");

    return sendSuccess(res, 201, "Section created successfully", section);
  } catch (err) {
    console.error(err);
    return sendError(res, err.statusCode || 500, err.statusCode ? err.message : "Internal Server Error");
  }
};

const update = async (req, res) => {
  try {
    if (!assertCanManage(req, res)) return;

    const section = await sectionModel.findById(req.params.id);
    if (!section) return sendError(res, 404, "Section not found");

    const updated = await updateSection(req, section);
    await writeAudit(req, "SECTION_UPDATED", updated, "Section updated");

    return sendSuccess(res, 200, "Section updated successfully", updated);
  } catch (err) {
    console.error(err);
    return sendError(res, err.statusCode || 500, err.statusCode ? err.message : "Internal Server Error");
  }
};

const remove = async (req, res) => {
  try {
    if (!assertCanManage(req, res)) return;

    const section = await sectionModel.findById(req.params.id);
    if (!section) return sendError(res, 404, "Section not found");

    section.status = "inactive";
    section.updatedBy = req.user._id;
    await section.save();

    await writeAudit(req, "SECTION_DELETED", section, "Section deactivated");

    return sendSuccess(res, 200, "Section deleted successfully", section);
  } catch (err) {
    console.error(err);
    return sendError(res, 500, "Internal Server Error");
  }
};

module.exports = {
  create,
  getSectionById,
  getSections,
  remove,
  update,
};
