const eventModel = require("../models/event.model");
const { sendError, sendSuccess } = require("../utils/apiResponse");
const auditLogModel = require("../models/auditlog.model");
const { eventImage } = require("../services/storage.service");
const {
  createListController,
  createGetByIdController,
  createDeleteController
} = require("./rest.controller");

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
  ]
};

const getEvents = createListController(eventModel, options);
const getEventById = createGetByIdController(eventModel, options);
const deleteEvent = createDeleteController(eventModel, options);

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

const createEvent = async (req, res) => {
  try {
    const media = await buildEventMediaPayload(req.files);

    const event = await eventModel.create({
      ...req.body,
      ...media,
      createdBy: req.user._id
    });

    await auditLogModel.create({
      performedBy: req.user._id,
      action: "CREATE",
      module: "Event",
      targetId: event._id,
      targetName: event.title,
      remarks: "Event created successfully",
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
    });

    return sendSuccess(res, 201, "Event created successfully", event);
  } catch (err) {
    console.error(err);

    return sendError(res, 500, "Internal Server Error");
  }
};

const updateEvent = async (req, res) => {
  try {
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

module.exports = {
  getEvents,
  getEventById,
  getLoginCarouselEvents,
  createEvent,
  updateEvent,
  deleteEvent
};
