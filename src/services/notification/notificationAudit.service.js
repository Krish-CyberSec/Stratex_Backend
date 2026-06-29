const mongoose = require("mongoose");
const auditLogModel = require("../../models/auditlog.model");

const getActorId = (req) => req.user?._id || req.authUser?._id;

const ignoredNotificationAuditActions = new Set([
  "READ_NOTIFICATION",
  "READ_ALL_NOTIFICATION",
  "READ_MULTIPLE_NOTIFICATION",
]);

const normalizeTargetId = (targetId) =>
  mongoose.isValidObjectId(targetId) ? targetId : undefined;

const writeNotificationAudit = async (
  req,
  {
    action,
    targetId,
    targetName,
    oldData,
    newData,
    changes,
    remarks,
    session,
  }
) => {
  try {
    if (ignoredNotificationAuditActions.has(action)) {
      return;
    }

    const audit = {
      performedBy: getActorId(req),
      action,
      module: "Notification",
      targetId: normalizeTargetId(targetId),
      targetName,
      oldData,
      newData,
      changes,
      remarks,
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
    };

    if (session) {
      await auditLogModel.create([audit], { session });
      return;
    }

    await auditLogModel.create(audit);
  } catch (err) {
    console.error("Notification audit log failed:", err.message);
  }
};

module.exports = {
  writeNotificationAudit,
};
