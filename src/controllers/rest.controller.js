const { sendError, sendSuccess } = require("../utils/apiResponse");
const auditLogModel = require("../models/auditlog.model");
const {
  buildAllowedFilters,
  buildPagination,
  buildPaginationMeta,
  buildSearchFilter,
  buildSort,
} = require("../utils/queryHelper");

const writeAudit = async (req, action, module, targetId, targetName, remarks) => {
  try {
    await auditLogModel.create({
      performedBy: req.user?._id,
      action,
      module,
      targetId,
      targetName,
      remarks,
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
    });
  } catch (err) {
    console.error("Audit log failed:", err.message);
  }
};

const createListController = (model, options = {}) => async (req, res) => {
  try {
    const { page, limit, skip } = buildPagination(req.query, options.maxLimit);
    const filter = {
      ...buildAllowedFilters(req.query, options.filterMap),
      ...buildSearchFilter(req.query.search, options.searchFields),
      ...(options.getExtraFilters ? options.getExtraFilters(req.query) : {}),
    };
    const sort = buildSort(req.query, options.allowedSortFields);
    const total = await model.countDocuments(filter);

    let request = model
      .find(filter)
      .sort(sort)
      .skip(skip)
      .limit(limit);

    if (options.populate) {
      options.populate.forEach((item) => {
        request = request.populate(item.path, item.select);
      });
    }

    const documents = await request;
    const pagination = buildPaginationMeta({
      page,
      limit,
      total,
      count: documents.length,
    });

    return sendSuccess(
      res,
      200,
      `${options.resourceName || "Records"} fetched successfully`,
      documents,
      pagination
    );
  } catch (err) {
    console.error(err);

    return sendError(res, 500, "Internal Server Error");
  }
};

const createGetByIdController = (model, options = {}) => async (req, res) => {
  try {
    let request = model.findById(req.params.id);

    if (options.populate) {
      options.populate.forEach((item) => {
        request = request.populate(item.path, item.select);
      });
    }

    const document = await request;

    if (!document) {
      return sendError(res, 404, `${options.resourceName} not found`);
    }

    return sendSuccess(
      res,
      200,
      `${options.resourceName} fetched successfully`,
      document
    );
  } catch (err) {
    console.error(err);

    return sendError(res, 500, "Internal Server Error");
  }
};

const createUpdateController = (model, options = {}) => async (req, res) => {
  try {
    const documentExists = await model.exists({ _id: req.params.id });

    if (!documentExists) {
      return sendError(res, 404, `${options.resourceName} not found`);
    }

    const update = {
      ...req.body,
      updatedBy: req.user._id
    };

    const document = await model.findByIdAndUpdate(
      req.params.id,
      update,
      {
        new: true,
        runValidators: true
      }
    );

    await writeAudit(
      req,
      "UPDATE",
      options.resourceName,
      document._id,
      document.name || document.title,
      `${options.resourceName} updated successfully`
    );

    return sendSuccess(
      res,
      200,
      `${options.resourceName} updated successfully`,
      document
    );
  } catch (err) {
    console.error(err);

    return sendError(res, 500, "Internal Server Error");
  }
};

const createDeleteController = (model, options = {}) => async (req, res) => {
  try {
    const document = await model.findById(req.params.id);

    if (!document) {
      return sendError(res, 404, `${options.resourceName} not found`);
    }

    if (document.schema.path("status")) {
      document.status = "inactive";
      document.updatedBy = req.user._id;
      await document.save();
    } else {
      await document.deleteOne();
    }

    await writeAudit(
      req,
      "DELETE",
      options.resourceName,
      document._id,
      document.name || document.title,
      `${options.resourceName} deleted successfully`
    );

    return sendSuccess(res, 200, `${options.resourceName} deleted successfully`);
  } catch (err) {
    console.error(err);

    return sendError(res, 500, "Internal Server Error");
  }
};

module.exports = {
  createListController,
  createGetByIdController,
  createUpdateController,
  createDeleteController
};
