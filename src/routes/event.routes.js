const express = require("express");
const multer = require("multer");
const authMiddleware = require("../middlewares/auth.middleware");
const validate = require("../middlewares/validate.middleware");
const eventController = require("../controllers/event.controller");

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
});

router.get("/login-carousel", eventController.getLoginCarouselEvents);
router.get("/", authMiddleware.chkUser, eventController.getEvents);
router.get("/:id", authMiddleware.chkUser, validate.objectIdParam("id"), eventController.getEventById);
router.post(
  "/",
  authMiddleware.chkUser,
  upload.fields([
    { name: "banner", maxCount: 1 },
    { name: "poster", maxCount: 1 },
  ]),
  validate({
    title: { required: true, minLength: 2 },
    startDate: { required: true, type: "date" },
    endDate: { type: "date" },
    status: { enum: ["scheduled", "completed", "cancelled", "inactive"] },
  }),
  eventController.createEvent
);
router.put(
  "/:id",
  authMiddleware.chkUser,
  validate.objectIdParam("id"),
  upload.fields([
    { name: "banner", maxCount: 1 },
    { name: "poster", maxCount: 1 },
  ]),
  validate({
    title: { minLength: 2 },
    startDate: { type: "date" },
    endDate: { type: "date" },
    status: { enum: ["scheduled", "completed", "cancelled", "inactive"] },
  }),
  eventController.updateEvent
);
router.delete("/:id", authMiddleware.chkUser, validate.objectIdParam("id"), eventController.deleteEvent);

module.exports = router;
