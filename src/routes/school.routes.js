const express = require("express");
const multer = require("multer");
const authMiddleware = require("../middlewares/auth.middleware");
const validate = require("../middlewares/validate.middleware");
const schoolModel = require("../models/school.model");
const { schools: createSchool } = require("../controllers/acadmicgroups/school.controller");
const {
  createListController,
  createGetByIdController,
  createUpdateController,
  createDeleteController
} = require("../controllers/rest.controller");

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024
  }
});

const options = {
  resourceName: "School",
  resourceKey: "school",
  collectionName: "schools",
  searchFields: ["name", "slug", "description", "email", "phone", "code"],
  filterMap: {
    status: "status",
  },
  allowedSortFields: ["name", "slug", "status", "createdAt", "updatedAt"],
  populate: [
    { path: "createdBy", select: "firstName lastName" },
    { path: "updatedBy", select: "firstName lastName" }
  ]
};

router.get("/", authMiddleware.chkUser, createListController(schoolModel, options));
router.get("/:id", authMiddleware.chkUser, validate.objectIdParam("id"), createGetByIdController(schoolModel, options));
router.post(
  "/",
  authMiddleware.chkUser,
  upload.fields([
    { name: "logo", maxCount: 1 },
    { name: "banner", maxCount: 1 }
  ]),
  validate({
    name: { required: true, minLength: 3 },
    slug: { required: true, minLength: 2 },
    status: { enum: ["active", "inactive"] },
    email: { type: "email" },
    departmentCount: { type: "number", min: 0 },
  }),
  createSchool
);
router.put(
  "/:id",
  authMiddleware.chkUser,
  validate.objectIdParam("id"),
  validate({
    name: { minLength: 3 },
    slug: { minLength: 2 },
    status: { enum: ["active", "inactive"] },
    email: { type: "email" },
    departmentCount: { type: "number", min: 0 },
  }),
  createUpdateController(schoolModel, options)
);
router.delete("/:id", authMiddleware.chkUser, validate.objectIdParam("id"), createDeleteController(schoolModel, options));

module.exports = router;
