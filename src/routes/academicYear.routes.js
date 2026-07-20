const express = require("express");
const authMiddleware = require("../middlewares/auth.middleware");
const validate = require("../middlewares/validate.middleware");
const academicYearController = require("../controllers/academicYear.controller");

const router = express.Router();

router.get("/", authMiddleware.chkUser, academicYearController.getAcademicYears);
router.get("/:id", authMiddleware.chkUser, validate.objectIdParam("id"), academicYearController.getAcademicYearById);
router.post("/", authMiddleware.chkUser, academicYearController.create);
router.put("/:id", authMiddleware.chkUser, validate.objectIdParam("id"), academicYearController.update);
router.delete("/:id", authMiddleware.chkUser, validate.objectIdParam("id"), academicYearController.remove);

module.exports = router;
