const express = require("express");
const authMiddleware = require("../middlewares/auth.middleware");
const validate = require("../middlewares/validate.middleware");
const sectionController = require("../controllers/section.controller");

const router = express.Router();

router.get("/", authMiddleware.chkUser, sectionController.getSections);
router.get("/:id", authMiddleware.chkUser, validate.objectIdParam("id"), sectionController.getSectionById);
router.post("/", authMiddleware.chkUser, sectionController.create);
router.put("/:id", authMiddleware.chkUser, validate.objectIdParam("id"), sectionController.update);
router.delete("/:id", authMiddleware.chkUser, validate.objectIdParam("id"), sectionController.remove);

module.exports = router;
