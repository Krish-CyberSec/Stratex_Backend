const express = require("express");
const authMiddleware = require("../middlewares/auth.middleware");
const validate = require("../middlewares/validate.middleware");
const programModel = require("../models/program.model");
const {
  programs: createProgram,
  updateProgram,
  deleteProgram
} = require("../controllers/acadmicgroups/program.controller");
const {
  createListController,
  createGetByIdController
} = require("../controllers/rest.controller");

const router = express.Router();

const options = {
  resourceName: "Program",
  resourceKey: "program",
  collectionName: "programs",
  searchFields: ["name", "description", "degreeType"],
  filterMap: {
    school: { field: "schoolId", type: "objectId" },
    schoolId: { field: "schoolId", type: "objectId" },
    status: "status",
  },
  allowedSortFields: ["name", "duration", "degreeType", "status", "createdAt", "updatedAt"],
  populate: [
    { path: "schoolId", select: "name slug" },
    { path: "createdBy", select: "firstName lastName" },
    { path: "updatedBy", select: "firstName lastName" }
  ]
};

router.get("/", authMiddleware.chkUser, createListController(programModel, options));
router.get("/:id", authMiddleware.chkUser, validate.objectIdParam("id"), createGetByIdController(programModel, options));
router.post(
  "/",
  authMiddleware.chkUser,
  validate({
    name: { required: true, minLength: 2 },
    schoolId: { required: true, type: "objectId" },
    duration: { required: true, type: "number", min: 1 },
    degreeType: { required: true, enum: ["UG", "PG", "Diploma", "PhD"] },
    status: { enum: ["active", "inactive"] },
  }),
  createProgram
);
router.put(
  "/:id",
  authMiddleware.chkUser,
  validate.objectIdParam("id"),
  validate({
    name: { minLength: 2 },
    schoolId: { type: "objectId" },
    duration: { type: "number", min: 1 },
    degreeType: { enum: ["UG", "PG", "Diploma", "PhD"] },
    status: { enum: ["active", "inactive"] },
  }),
  updateProgram
);
router.delete("/:id", authMiddleware.chkUser, validate.objectIdParam("id"), deleteProgram);

module.exports = router;
