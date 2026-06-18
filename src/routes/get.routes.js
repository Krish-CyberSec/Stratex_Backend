const express = require("express");
const authMiddleware = require("../middlewares/auth.middleware");

const { getSubjects } = require("../controllers/get/getSubject/getSubject.controller");
const { getSubjectById } = require("../controllers/get/getSubject/getSubjectById.controller");

const { getUsers } = require("../controllers/get/getUsers.controller");
const { getUserById } = require("../controllers/get/getUserById.controller");

const router = express.Router();


// ==================== SUBJECTS ====================

// Get all subjects (supports query params)
router.get(
    "/subjects",
    authMiddleware.chkUser,
    getSubjects
);

// Get subject by ID
router.get(
    "/subjects/:subjectId",
    authMiddleware.chkUser,
    getSubjectById
);


// ==================== USERS ====================

// Get all users (supports query params)
router.get(
    "/users",
    authMiddleware.chkUser,
    getUsers
);

// Get user by ID
router.get(
    "/users/:userId",
    authMiddleware.chkUser,
    getUserById
);

module.exports = router;