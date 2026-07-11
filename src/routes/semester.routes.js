const express = require("express");
const authMiddleware = require("../middlewares/auth.middleware");
const semesterModel = require("../models/semester.model");
const {
  createGetByIdController,
  createListController,
} = require("../controllers/rest.controller");

const router = express.Router();

const options = {
  resourceName: "Semester",
  resourceKey: "semester",
  collectionName: "semesters",
  filterMap: {
    program: { field: "programId", type: "objectId" },
    programId: { field: "programId", type: "objectId" },
    specializationId: { field: "specializationId", type: "objectId" },
    status: "status",
  },
  allowedSortFields: ["semesterNumber", "status", "createdAt", "updatedAt"],
  populate: [
    { path: "programId", select: "name code degreeType duration schoolId" },
    { path: "specializationId", select: "name" },
  ],
};

router.get("/", authMiddleware.chkUser, createListController(semesterModel, options));
router.get("/:id", authMiddleware.chkUser, createGetByIdController(semesterModel, options));

module.exports = router;
