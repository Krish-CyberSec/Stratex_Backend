const mongoose = require("mongoose");
const userNotificationModel = require("../../models/userNotificaton.model");
const { sendError, sendSuccess } = require("../../utils/apiResponse");
const {
  validateNotificationIds,
} = require("../../services/notification/notificationValidation.service");
const notificationCache = require("../../services/notification/notificationCache.service");
const {
  writeNotificationAudit,
} = require("../../services/notification/notificationAudit.service");

const markNotificationRead = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return sendError(res, 400, "id must be a valid ObjectId");
    }

    const now = new Date();
    const result = await userNotificationModel.updateOne(
      {
        notificationId: req.params.id,
        userId: req.user._id,
        isDeleted: false,
      },
      {
        $set: {
          isRead: true,
          readAt: now,
        },
      }
    );

    if (!result.matchedCount) {
      return sendError(res, 404, "Notification not found");
    }

    await writeNotificationAudit(req, {
      action: "READ_NOTIFICATION",
      targetId: req.params.id,
      newData: {
        notificationId: req.params.id,
        readAt: now,
      },
      remarks: "Notification marked as read",
    });

    notificationCache.invalidate();

    return sendSuccess(res, 200, "Notification marked as read", {
      modifiedCount: result.modifiedCount,
    });
  } catch (err) {
    console.error("Mark notification read failed:", err);

    return sendError(res, 500, "Internal Server Error");
  }
};

const markManyNotificationsRead = async (req, res) => {
  try {
    const { errors, notificationIds } = validateNotificationIds(req.body.notificationIds);

    if (errors.length) {
      return sendError(res, 400, "Validation failed", errors);
    }

    const now = new Date();
    const result = await userNotificationModel.updateMany(
      {
        notificationId: { $in: notificationIds },
        userId: req.user._id,
        isDeleted: false,
      },
      {
        $set: {
          isRead: true,
          readAt: now,
        },
      }
    );

    await writeNotificationAudit(req, {
      action: "READ_MULTIPLE_NOTIFICATION",
      newData: {
        notificationIds,
        matchedCount: result.matchedCount,
        modifiedCount: result.modifiedCount,
        readAt: now,
      },
      remarks: "Multiple notifications marked as read",
    });

    notificationCache.invalidate();

    return sendSuccess(res, 200, "Notifications marked as read", {
      matchedCount: result.matchedCount,
      modifiedCount: result.modifiedCount,
    });
  } catch (err) {
    console.error("Mark many notifications read failed:", err);

    return sendError(res, 500, "Internal Server Error");
  }
};

const markAllNotificationsRead = async (req, res) => {
  try {
    const now = new Date();
    const result = await userNotificationModel.updateMany(
      {
        userId: req.user._id,
        isDeleted: false,
        isRead: false,
      },
      {
        $set: {
          isRead: true,
          readAt: now,
        },
      }
    );

    await writeNotificationAudit(req, {
      action: "READ_ALL_NOTIFICATION",
      newData: {
        matchedCount: result.matchedCount,
        modifiedCount: result.modifiedCount,
        readAt: now,
      },
      remarks: "All notifications marked as read",
    });

    notificationCache.invalidate();

    return sendSuccess(res, 200, "All notifications marked as read", {
      matchedCount: result.matchedCount,
      modifiedCount: result.modifiedCount,
    });
  } catch (err) {
    console.error("Mark all notifications read failed:", err);

    return sendError(res, 500, "Internal Server Error");
  }
};

module.exports = {
  markAllNotificationsRead,
  markManyNotificationsRead,
  markNotificationRead,
};
