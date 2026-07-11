const express = require("express");
const multer = require("multer");
const authMiddleware = require("../middlewares/auth.middleware");
const validate = require("../middlewares/validate.middleware");
const noticeController = require("../controllers/notice.controller");

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024,
  },
});

router.get("/", authMiddleware.chkUser, noticeController.getNotices);
router.get("/:id", authMiddleware.chkUser, validate.objectIdParam("id"), noticeController.getNoticeById);
router.post(
  "/",
  authMiddleware.chkUser,
  upload.single("attachment"),
  validate({
    title: { required: true, minLength: 2 },
    content: { required: true, minLength: 2 },
    status: { enum: ["draft", "published", "archived", "inactive"] },
  }),
  noticeController.createNotice
);
router.put(
  "/:id",
  authMiddleware.chkUser,
  validate.objectIdParam("id"),
  upload.single("attachment"),
  validate({
    title: { minLength: 2 },
    content: { minLength: 2 },
    status: { enum: ["draft", "published", "archived", "inactive"] },
  }),
  noticeController.updateNotice
);
router.delete("/:id", authMiddleware.chkUser, validate.objectIdParam("id"), noticeController.deleteNotice);

module.exports = router;
