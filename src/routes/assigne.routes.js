const express = require("express");
const authMiddleware = require("../middlewares/auth.middleware");

const assigneFaculty = require("../controllers/assigne/assigneFaculty.controller");
const assigneCoordinator = require("../controllers/assigne/assigneCoordinator.controller");

const router = express.Router();

// Assign Faculty to Subject
router.post(
    "/subjects/:subjectId/faculties",
    authMiddleware.chkUser,
    assigneFaculty.assignFacultyToSubject
);

// Assign Coordinator to Subject
router.post(
    "/subjects/:subjectId/coordinator",
    authMiddleware.chkUser,
    assigneCoordinator.assignCoordinatorToSubject
);

module.exports = router;