const noticeModel = require("../models/notice.model");
const mongoose = require("mongoose");
const { sendError, sendSuccess } = require("../utils/apiResponse");
const auditLogModel = require("../models/auditlog.model");
const notificationModel = require("../models/notificaton.Model");
const userNotificationModel = require("../models/userNotificaton.model");
const { resolveAudience } = require("../services/notification/audience.service");
const notificationCache = require("../services/notification/notificationCache.service");
const { noticeAttachment } = require("../services/storage.service");
const {
  createListController,
  createGetByIdController,
  createDeleteController
} = require("./rest.controller");

const options = {
  resourceName: "Notice",
  resourceKey: "notice",
  collectionName: "notices",
  searchFields: ["title", "content"],
  filterMap: {
    status: "status",
    createdBy: { field: "createdBy", type: "objectId" },
  },
  getExtraFilters: (query) => {
    if (query.published === "true" || query.published === true) {
      return { status: "published" };
    }

    if (query.published === "false" || query.published === false) {
      return { status: { $ne: "published" } };
    }

    return {};
  },
  allowedSortFields: ["title", "status", "publishedAt", "createdAt", "updatedAt"],
  populate: [
    { path: "createdBy", select: "firstName lastName" },
    { path: "updatedBy", select: "firstName lastName" }
  ]
};

const getNotices = createListController(noticeModel, options);
const getNoticeById = createGetByIdController(noticeModel, options);
const deleteNotice = createDeleteController(noticeModel, options);

const chunk = (items, size) => {
  const chunks = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
};

const normalizeNoticeAudience = (value) => {
  if (!value) return ["all"];

  if (Array.isArray(value)) {
    return value.length ? value : ["all"];
  }

  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) return parsed.length ? parsed : ["all"];
  } catch {
    // Fall back to comma separated values.
  }

  return String(value)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
};

const toNotificationAudience = (audience = []) => {
  if (!audience.length || audience.includes("all")) {
    return { allUsers: true };
  }

  return {
    allUsers: false,
    roles: audience,
  };
};

const buildAttachmentPayload = async (file) => {
  if (!file) return undefined;

  const upload = await noticeAttachment(file.buffer, file.originalname);

  return {
    url: upload.url,
    fileId: upload.fileId,
    name: file.originalname,
    fileType: file.mimetype,
    size: file.size,
  };
};

const createNoticeNotification = async ({ notice, req, session }) => {
  if (notice.status !== "published") return { recipientCount: 0 };

  const audience = toNotificationAudience(notice.audience);
  const { users, count } = await resolveAudience(audience, session);

  if (!count) {
    throw new Error("No active users matched the selected notice audience");
  }

  const attachments = notice.attachment?.url
    ? [
        {
          name: notice.attachment.name,
          url: notice.attachment.url,
          fileType: notice.attachment.fileType,
          size: notice.attachment.size,
        },
      ]
    : [];

  const [notification] = await notificationModel.create(
    [
      {
        title: notice.title,
        message: notice.content,
        type: "notice",
        priority: "normal",
        senderId: req.user._id,
        createdBy: req.user._id,
        audience,
        reference: {
          model: "Notice",
          id: notice._id,
        },
        action: {
          label: "View Notice",
          url: "/dashboard/notices",
        },
        metadata: {
          noticeId: notice._id,
          attachments,
        },
      },
    ],
    { session }
  );

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

  notificationCache.invalidate();

  return { notification, recipientCount: count };
};

const createNotice = async (req, res) => {
  const session = await mongoose.startSession();

  try {
    const audience = normalizeNoticeAudience(req.body.audience);
    const attachment = await buildAttachmentPayload(req.file);

    session.startTransaction();

    const [notice] = await noticeModel.create(
      [
        {
          title: req.body.title,
          content: req.body.content,
          audience,
          status: req.body.status || "published",
          publishedAt: req.body.publishedAt || Date.now(),
          ...(attachment ? { attachment } : {}),
          createdBy: req.user._id,
        },
      ],
      { session }
    );

    const notificationResult = await createNoticeNotification({
      notice,
      req,
      session,
    });

    await auditLogModel.create({
      performedBy: req.user._id,
      action: "CREATE",
      module: "Notice",
      targetId: notice._id,
      targetName: notice.title,
      remarks: "Notice created successfully",
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
    });

    await session.commitTransaction();

    return sendSuccess(res, 201, "Notice created successfully", {
      notice,
      notification: notificationResult.notification || null,
      recipientCount: notificationResult.recipientCount,
    });
  } catch (err) {
    if (session.inTransaction()) {
      await session.abortTransaction();
    }

    console.error(err);

    return sendError(
      res,
      err.message?.includes("No active users") ? 400 : 500,
      err.message?.includes("No active users") ? err.message : "Internal Server Error"
    );
  } finally {
    await session.endSession();
  }
};

const updateNotice = async (req, res) => {
  try {
    const notice = await noticeModel.findById(req.params.id);

    if (!notice) {
      return sendError(res, 404, "Notice not found");
    }

    const update = {
      ...req.body,
      updatedBy: req.user._id,
    };

    if (req.body.audience !== undefined) {
      update.audience = normalizeNoticeAudience(req.body.audience);
    }

    if (req.file) {
      update.attachment = await buildAttachmentPayload(req.file);
    }

    const updatedNotice = await noticeModel.findByIdAndUpdate(
      req.params.id,
      update,
      {
        new: true,
        runValidators: true,
      }
    );

    await auditLogModel.create({
      performedBy: req.user._id,
      action: "UPDATE",
      module: "Notice",
      targetId: updatedNotice._id,
      targetName: updatedNotice.title,
      remarks: "Notice updated successfully",
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
    });

    return sendSuccess(res, 200, "Notice updated successfully", updatedNotice);
  } catch (err) {
    console.error(err);

    return sendError(res, 500, "Internal Server Error");
  }
};

module.exports = {
  getNotices,
  getNoticeById,
  createNotice,
  updateNotice,
  deleteNotice
};
