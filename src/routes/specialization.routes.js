const express = require("express");
const authMiddleware = require("../middlewares/auth.middleware");
const validate = require("../middlewares/validate.middleware");
const specializationModel = require("../models/specialization.model");
const {
  Specialization: createSpecialization,
  deleteSpecialization
} = require("../controllers/acadmicgroups/specialization.controller");
const {
  createListController,
  createGetByIdController,
  createUpdateController
} = require("../controllers/rest.controller");

const router = express.Router();

const options = {
  resourceName: "Specialization",
  resourceKey: "specialization",
  collectionName: "specializations",
  searchFields: ["name", "description"],
  filterMap: {
    program: { field: "programId", type: "objectId" },
    programId: { field: "programId", type: "objectId" },
    status: "status",
  },
  allowedSortFields: ["name", "status", "createdAt", "updatedAt"],
  populate: [
    { path: "programId", select: "name degreeType schoolId" },
    { path: "createdBy", select: "firstName lastName" },
    { path: "updatedBy", select: "firstName lastName" }
  ]
};

router.get("/", authMiddleware.chkUser, createListController(specializationModel, options));
router.get("/:id", authMiddleware.chkUser, validate.objectIdParam("id"), createGetByIdController(specializationModel, options));
router.post(
  "/",
  authMiddleware.chkUser,
  validate({
    programId: { required: true, type: "objectId" },
    name: { required: true, minLength: 2 },
    description: { required: true, minLength: 2 },
    status: { enum: ["active", "inactive"] },
  }),
  createSpecialization
);
router.put(
  "/:id",
  authMiddleware.chkUser,
  validate.objectIdParam("id"),
  validate({
    programId: { type: "objectId" },
    name: { minLength: 2 },
    description: { minLength: 2 },
    status: { enum: ["active", "inactive"] },
  }),
  createUpdateController(specializationModel, options)
);
router.delete("/:id", authMiddleware.chkUser, validate.objectIdParam("id"), deleteSpecialization);

module.exports = router;
