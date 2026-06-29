const mongoose = require("mongoose");
const notificationModel = require("../../models/notificaton.Model");
const userNotificationModel = require("../../models/userNotificaton.model");
const { sendError, sendSuccess } = require("../../utils/apiResponse");
const { resolveAudience } = require("../../services/notification/audience.service");
const {
  validateCreateNotification,
} = require("../../services/notification/notificationValidation.service");
const {
  findRecentDuplicate,
} = require("../../services/notification/notificationDuplicate.service");
const notificationCache = require("../../services/notification/notificationCache.service");
const {
  writeNotificationAudit,
} = require("../../services/notification/notificationAudit.service");

const creatorRoles = ["superAdmin", "schoolAdmin", "faculty", "coordinator", "examCell"];

const hasAllowedRole = (user, allowedRoles) => {
  const roles = user?.roles || [];
  return roles.some((role) => allowedRoles.includes(role));
};

const chunk = (items, size) => {
  const chunks = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
};

const createNotification = async (req, res) => {
  const session = await mongoose.startSession();

  try {
    if (!hasAllowedRole(req.authUser || req.user, creatorRoles)) {
      await writeNotificationAudit(req, {
        action: "UNAUTHORIZED_NOTIFICATION_CREATE_ATTEMPT",
        newData: {
          title: req.body?.title,
          type: req.body?.type,
          priority: req.body?.priority,
          audience: req.body?.audience,
        },
        remarks: "Unauthorized notification create attempt",
      });

      return sendError(res, 403, "You are not allowed to create notifications");
    }

    const { errors, audience } = validateCreateNotification(req.body);

    if (errors.length) {
      await writeNotificationAudit(req, {
        action: "CREATE_NOTIFICATION_FAILED",
        newData: {
          title: req.body?.title,
          type: req.body?.type,
          priority: req.body?.priority,
          audience: req.body?.audience,
          validationErrors: errors,
        },
        remarks: "Notification create validation failed",
      });

      return sendError(res, 400, "Validation failed", errors);
    }

    const duplicateResult = await findRecentDuplicate(
      {
        title: req.body.title,
        message: req.body.message,
        type: req.body.type,
        reference: req.body.reference,
        audience,
      },
      {
        allowDuplicate: req.body.allowDuplicate === true,
      }
    );

    if (duplicateResult?.notification) {
      await writeNotificationAudit(req, {
        action: "DUPLICATE_NOTIFICATION_PREVENTED",
        targetId: duplicateResult.notification._id,
        targetName: duplicateResult.notification.title,
        newData: {
          notificationId: duplicateResult.notification._id,
          duplicateKey: duplicateResult.duplicateKey,
          audience,
        },
        remarks: "Duplicate notification prevented",
      });

      return sendSuccess(res, 200, "Duplicate notification prevented", {
        notification: duplicateResult.notification,
        duplicate: true,
      });
    }

    session.startTransaction();

    const [notification] = await notificationModel.create(
      [
        {
          title: String(req.body.title).trim(),
          message: String(req.body.message).trim(),
          type: req.body.type,
          priority: req.body.priority || "normal",
          senderId: req.user._id,
          createdBy: req.user._id,
          audience,
          reference: req.body.reference || undefined,
          action: req.body.action || undefined,
          metadata: req.body.metadata || {},
          expiresAt: req.body.expiresAt || null,
          duplicateKey: duplicateResult.duplicateKey,
        },
      ],
      { session }
    );

    const { users, count } = await resolveAudience(audience, session);

    if (!count) {
      throw new Error("No active users matched the selected audience");
    }

    const now = new Date();
    const userNotificationDocs = users.map((user) => ({
      notificationId: notification._id,
      userId: user._id,
      deliveredAt: now,
      status: "delivered",
    }));

    for (const docs of chunk(userNotificationDocs, 5000)) {
      await userNotificationModel.insertMany(docs, {
        session,
        ordered: false,
      });
    }

    await session.commitTransaction();
    notificationCache.invalidate();

    await writeNotificationAudit(req, {
      action: "CREATE_NOTIFICATION",
      targetId: notification._id,
      targetName: notification.title,
      newData: {
        notificationId: notification._id,
        recipientCount: count,
        audience,
      },
      remarks: "Notification created and delivered",
    });

    return sendSuccess(res, 201, "Notification created successfully", {
      notification,
      recipientCount: count,
    });
  } catch (err) {
    if (session.inTransaction()) {
      await session.abortTransaction();
    }

    const statusCode = err.message?.includes("No active users") ? 400 : 500;
    console.error("Create notification failed:", err);

    await writeNotificationAudit(req, {
      action: "CREATE_NOTIFICATION_FAILED",
      newData: {
        title: req.body?.title,
        type: req.body?.type,
        priority: req.body?.priority,
        audience: req.body?.audience,
        error: err.message,
      },
      remarks:
        statusCode === 400 ? err.message : "Notification create failed",
    });

    return sendError(
      res,
      statusCode,
      statusCode === 400 ? err.message : "Internal Server Error"
    );
  } finally {
    await session.endSession();
  }
};

module.exports = {
  createNotification,
};
