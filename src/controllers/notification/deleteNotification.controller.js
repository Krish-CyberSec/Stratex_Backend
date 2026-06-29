const mongoose = require("mongoose");
const userNotificationModel = require("../../models/userNotificaton.model");
const { sendError, sendSuccess } = require("../../utils/apiResponse");
const notificationCache = require("../../services/notification/notificationCache.service");
const {
  writeNotificationAudit,
} = require("../../services/notification/notificationAudit.service");

const softDeleteNotification = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return sendError(res, 400, "id must be a valid ObjectId");
    }

    const oldRecord = await userNotificationModel.findOne({
      notificationId: req.params.id,
      userId: req.user._id,
    }).lean();

    if (!oldRecord) {
      return sendError(res, 404, "Notification not found");
    }

    const now = new Date();
    const updated = await userNotificationModel.findOneAndUpdate(
      {
        notificationId: req.params.id,
        userId: req.user._id,
      },
      {
        $set: {
          isDeleted: true,
          deletedAt: now,
        },
      },
      { new: true }
    );

    await writeNotificationAudit(req, {
      action: "DELETE_NOTIFICATION",
      targetId: req.params.id,
      oldData: oldRecord,
      newData: {
        isDeleted: updated.isDeleted,
        deletedAt: updated.deletedAt,
      },
      remarks: "Notification deleted successfully",
    });

    notificationCache.invalidate();

    return sendSuccess(res, 200, "Notification deleted successfully", updated);
  } catch (err) {
    console.error("Soft delete notification failed:", err);

    return sendError(res, 500, "Internal Server Error");
  }
};

const restoreNotification = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return sendError(res, 400, "id must be a valid ObjectId");
    }

    const oldRecord = await userNotificationModel.findOne({
      notificationId: req.params.id,
      userId: req.user._id,
    }).lean();

    if (!oldRecord) {
      return sendError(res, 404, "Notification not found");
    }

    const updated = await userNotificationModel.findOneAndUpdate(
      {
        notificationId: req.params.id,
        userId: req.user._id,
      },
      {
        $set: {
          isDeleted: false,
          deletedAt: null,
        },
      },
      { new: true }
    );

    await writeNotificationAudit(req, {
      action: "RESTORE_NOTIFICATION",
      targetId: req.params.id,
      oldData: oldRecord,
      newData: {
        isDeleted: updated.isDeleted,
        deletedAt: updated.deletedAt,
      },
      remarks: "Notification restored successfully",
    });

    notificationCache.invalidate();

    return sendSuccess(res, 200, "Notification restored successfully", updated);
  } catch (err) {
    console.error("Restore notification failed:", err);

    return sendError(res, 500, "Internal Server Error");
  }
};

module.exports = {
  restoreNotification,
  softDeleteNotification,
};
