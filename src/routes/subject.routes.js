const express = require("express");
const authMiddleware = require("../middlewares/auth.middleware");
const validate = require("../middlewares/validate.middleware");
const { subjects: createSubject } = require("../controllers/acadmicgroups/subject.controller");
const { getSubjects } = require("../controllers/get/getSubject/getSubject.controller");
const { getSubjectById } = require("../controllers/get/getSubject/getSubjectById.controller");
const { updateSubject } = require("../controllers/update/updateSubject.controller");
const { deleteSubject } = require("../controllers/remove/softRemoveSubject.controller");

const router = express.Router();

const mapIdToSubjectId = (req, _res, next) => {
  req.params.subjectId = req.params.id;
  next();
};

router.get("/", authMiddleware.chkUser, getSubjects);
router.get("/:id", authMiddleware.chkUser, validate.objectIdParam("id"), mapIdToSubjectId, getSubjectById);
router.post(
  "/",
  authMiddleware.chkUser,
  validate({
    code: { required: true, minLength: 2 },
    name: { required: true, minLength: 2 },
    schoolId: { required: true, type: "objectId" },
    programId: { required: true, type: "objectId" },
    specializationId: { type: "objectId" },
    semesterId: { required: true, type: "objectId" },
    credits: { type: "number", min: 0 },
    status: { enum: ["active", "inactive"] },
  }),
  createSubject
);
router.put(
  "/:id",
  authMiddleware.chkUser,
  validate.objectIdParam("id"),
  validate({
    code: { minLength: 2 },
    name: { minLength: 2 },
    schoolId: { type: "objectId" },
    programId: { type: "objectId" },
    specializationId: { type: "objectId" },
    semesterId: { type: "objectId" },
    credits: { type: "number", min: 0 },
    status: { enum: ["active", "inactive"] },
  }),
  mapIdToSubjectId,
  updateSubject
);
router.delete("/:id", authMiddleware.chkUser, validate.objectIdParam("id"), mapIdToSubjectId, deleteSubject);

module.exports = router;
