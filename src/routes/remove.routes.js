const express = require("express");
const authMiddleware = require("../middlewares/auth.middleware");

const removeFaculty = require("../controllers/remove/removeFaculty.controller");
const removeCoordinator = require("../controllers/remove/removeCoordinator.controller");
const removeSubject = require("../controllers/remove/softRemoveSubject.controller");
const removeUser = require("../controllers/remove/softRemoveUser.controller");

const router = express.Router();

// Remove Faculty from Subject
router.delete(
    "/subjects/:subjectId/faculty",
    authMiddleware.chkUser,
    removeFaculty.removeFacultyFromSubject
);

// Remove Coordinator from Subject
router.delete(
    "/subjects/:subjectId/coordinator",
    authMiddleware.chkUser,
    removeCoordinator.removeCoordinatorFromSubject
);

// Soft Delete Subject
router.delete(
    "/subjects/:subjectId",
    authMiddleware.chkUser,
    removeSubject.deleteSubject
);

// Soft Delete User
router.delete(
    "/users/:userId",
    authMiddleware.chkUser,
    removeUser.softRemoveUser
);

module.exports = router;