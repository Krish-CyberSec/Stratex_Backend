const eventModel = require("../models/event.model");
const { sendError, sendSuccess } = require("../utils/apiResponse");
const auditLogModel = require("../models/auditlog.model");
const notificationModel = require("../models/notificaton.Model");
const userNotificationModel = require("../models/userNotificaton.model");
const { resolveAudience } = require("../services/notification/audience.service");
const notificationCache = require("../services/notification/notificationCache.service");
const { eventImage, deleteFile } = require("../services/storage.service");
const {
  createListController,
  createGetByIdController
} = require("./rest.controller");

const sameId = (left, right) => String(left || "") === String(right || "");
const hasRole = (req, role) => (req.user?.roles || []).includes(role);
const canCreateEvent = (req) =>
  ["superAdmin", "schoolAdmin", "examCell"].some((role) => hasRole(req, role));
const canManageEvent = (req, event) =>
  hasRole(req, "superAdmin") || sameId(event?.createdBy?._id || event?.createdBy, req.user?._id);

const chunk = (items, size) => {
  const chunks = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
};

const decorateEventForUser = (req, event) => {
  const plainEvent = typeof event.toObject === "function" ? event.toObject() : { ...event };

  return {
    ...plainEvent,
    canManage: canManageEvent(req, plainEvent),
  };
};

const decorateEventsForUser = (req, events = []) =>
  events.map((event) => decorateEventForUser(req, event));

const options = {
  resourceName: "Event",
  resourceKey: "event",
  collectionName: "events",
  searchFields: ["title", "description", "location"],
  filterMap: {
    status: "status",
    date: { field: "startDate", type: "dateDay" },
  },
  getExtraFilters: (query) => {
    if (query.upcoming === "true" || query.upcoming === true) {
      if (query.date) {
        const start = new Date(query.date);

        if (!Number.isNaN(start.getTime())) {
          const end = new Date(start);
          end.setDate(end.getDate() + 1);

          return {
            startDate: {
              $gte: start > new Date() ? start : new Date(),
              $lt: end,
            },
          };
        }
      }

      return {
        startDate: { $gte: new Date() },
      };
    }

    return {};
  },
  allowedSortFields: ["title", "startDate", "status", "createdAt", "updatedAt"],
  populate: [
    { path: "createdBy", select: "firstName lastName" },
    { path: "updatedBy", select: "firstName lastName" }
  ],
  mapDocuments: async (req, documents) => decorateEventsForUser(req, documents)
};

const getEvents = createListController(eventModel, options);
const getEventById = async (req, res) => {
  try {
    let request = eventModel.findById(req.params.id);

    options.populate.forEach((item) => {
      request = request.populate(item.path, item.select);
    });

    const event = await request;

    if (!event) {
      return sendError(res, 404, "Event not found");
    }

    return sendSuccess(res, 200, "Event fetched successfully", decorateEventForUser(req, event));
  } catch (err) {
    console.error(err);

    return sendError(res, 500, "Internal Server Error");
  }
};

const getLoginCarouselEvents = async (req, res) => {
  try {
    const fourDaysBack = new Date();
    fourDaysBack.setHours(0, 0, 0, 0);
    fourDaysBack.setDate(fourDaysBack.getDate() - 3);

    const events = await eventModel
      .find({
        poster: { $nin: [null, ""] },
        startDate: {
          $gte: fourDaysBack,
        },
        status: { $ne: "inactive" },
      })
      .sort({ updatedAt: -1, startDate: -1 })
      .limit(4)
      .select("title description location startDate poster banner updatedAt createdAt status")
      .lean();

    return sendSuccess(res, 200, "Login carousel events fetched successfully", events);
  } catch (err) {
    console.error(err);

    return sendError(res, 500, "Internal Server Error");
  }
};

const buildEventMediaPayload = async (files = {}) => {
  const media = {};
  const banner = files?.banner?.[0];
  const poster = files?.poster?.[0];

  if (banner) {
    const upload = await eventImage(banner.buffer, banner.originalname, "banner");
    media.banner = upload.url;
    media.bannerFileId = upload.fileId;
  }

  if (poster) {
    const upload = await eventImage(poster.buffer, poster.originalname, "poster");
    media.poster = upload.url;
    media.posterFileId = upload.fileId;
  }

  return media;
};

const deleteStoredEventFiles = async (event) => {
  const fileIds = [event?.bannerFileId, event?.posterFileId].filter(Boolean);

  if (!fileIds.length) return [];

  const results = await Promise.allSettled(fileIds.map(async (fileId) => deleteFile(fileId)));

  return results
    .map((result, index) => ({
      fileId: fileIds[index],
      status: result.status,
      reason: result.reason?.message,
    }));
};

const createEventNotification = async ({ event, req }) => {
  const audience = { allUsers: true };
  const { users, count } = await resolveAudience(audience);

  if (!count) {
    return { notification: null, recipientCount: 0 };
  }

  const notification = await notificationModel.create({
    title: event.title,
    message: event.description || `${event.title} has been scheduled.`,
    type: "event",
    priority: "normal",
    senderId: req.user._id,
    createdBy: req.user._id,
    audience,
    reference: {
      model: "Event",
      id: event._id,
    },
    action: {
      label: "View Event",
      url: `/dashboard/events/${event._id}`,
    },
    metadata: {
      eventId: event._id,
      startDate: event.startDate,
      endDate: event.endDate,
      location: event.location,
    },
  });

  const now = new Date();
  const userNotificationDocs = users.map((user) => ({
    notificationId: notification._id,
    userId: user._id,
    deliveredAt: now,
    status: "delivered",
  }));

  for (const docs of chunk(userNotificationDocs, 5000)) {
    await userNotificationModel.insertMany(docs, { ordered: false });
  }

  try {
    const socketService = require("../services/socket.service");
    socketService.emitToUsers(users.map((user) => String(user._id)), "notification:new", {
      notification,
      deliveredAt: now,
    });
  } catch (emitErr) {
    console.error("Event notification emit failed:", emitErr);
  }

  notificationCache.invalidate();

  return { notification, recipientCount: count };
};

const createEvent = async (req, res) => {
  try {
    if (!canCreateEvent(req)) {
      return sendError(res, 403, "You are not allowed to create events");
    }

    const media = await buildEventMediaPayload(req.files);

    const event = await eventModel.create({
      ...req.body,
      ...media,
      createdBy: req.user._id
    });
    const notificationResult = await createEventNotification({ event, req });

    await auditLogModel.create({
      performedBy: req.user._id,
      action: "CREATE",
      module: "Event",
      targetId: event._id,
      targetName: event.title,
      newData: event.toObject(),
      metadata: {
        recipientCount: notificationResult.recipientCount,
        notificationId: notificationResult.notification?._id,
      },
      remarks: "Event created successfully",
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
    });

    return sendSuccess(res, 201, "Event created successfully", {
      event,
      notification: notificationResult.notification,
      recipientCount: notificationResult.recipientCount,
    });
  } catch (err) {
    console.error(err);

    return sendError(res, 500, "Internal Server Error");
  }
};

const updateEvent = async (req, res) => {
  try {
    const existingEvent = await eventModel.findById(req.params.id);

    if (!existingEvent) {
      return sendError(res, 404, "Event not found");
    }

    if (!canManageEvent(req, existingEvent)) {
      return sendError(res, 403, "Only super admin or the event creator can edit this event");
    }

    const media = await buildEventMediaPayload(req.files);
    const event = await eventModel.findByIdAndUpdate(
      req.params.id,
      {
        ...req.body,
        ...media,
        updatedBy: req.user._id,
      },
      { new: true, runValidators: true }
    ).populate(options.populate);

    if (!event) {
      return sendError(res, 404, "Event not found");
    }

    await auditLogModel.create({
      performedBy: req.user._id,
      action: "UPDATE",
      module: "Event",
      targetId: event._id,
      targetName: event.title,
      oldData: existingEvent.toObject(),
      newData: event.toObject(),
      remarks: "Event updated successfully",
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
    });

    return sendSuccess(res, 200, "Event updated successfully", event);
  } catch (err) {
    console.error(err);

    return sendError(res, 500, "Internal Server Error");
  }
};

const deleteEvent = async (req, res) => {
  try {
    const event = await eventModel.findById(req.params.id);

    if (!event) {
      return sendError(res, 404, "Event not found");
    }

    if (!canManageEvent(req, event)) {
      return sendError(res, 403, "Only super admin or the event creator can delete this event");
    }

    const oldData = event.toObject();
    const deletedFiles = await deleteStoredEventFiles(event);

    const notifications = await notificationModel
      .find({
        "reference.model": "Event",
        "reference.id": event._id,
      })
      .select("_id")
      .lean();
    const notificationIds = notifications.map((notification) => notification._id);
    const oldDeliveries = notificationIds.length
      ? await userNotificationModel
          .find({ notificationId: { $in: notificationIds } })
          .select("userId")
          .lean()
      : [];

    if (notificationIds.length) {
      await Promise.all([
        userNotificationModel.deleteMany({ notificationId: { $in: notificationIds } }),
        notificationModel.deleteMany({ _id: { $in: notificationIds } }),
      ]);
      notificationCache.invalidate();

      try {
        const socketService = require("../services/socket.service");
        socketService.emitToUsers(
          oldDeliveries.map((delivery) => String(delivery.userId)),
          "notification:removed",
          {
            notificationIds: notificationIds.map(String),
            reference: {
              model: "Event",
              id: String(event._id),
            },
            reason: "event_deleted",
          }
        );
      } catch (emitErr) {
        console.error("Event delete notification removal emit failed:", emitErr);
      }
    }

    await event.deleteOne();

    await auditLogModel.create({
      performedBy: req.user._id,
      action: "DELETE",
      module: "Event",
      targetId: event._id,
      targetName: event.title,
      oldData,
      metadata: {
        deletedFiles,
        deletedNotificationIds: notificationIds,
      },
      remarks: "Event permanently deleted",
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
    });

    return sendSuccess(res, 200, "Event deleted successfully");
  } catch (err) {
    console.error(err);

    return sendError(res, 500, "Internal Server Error");
  }
};

module.exports = {
  getEvents,
  getEventById,
  getLoginCarouselEvents,
  createEvent,
  updateEvent,
  deleteEvent
};
