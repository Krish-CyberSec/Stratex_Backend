const express = require("express");
const authMiddleware = require("../middlewares/auth.middleware");

const { updateSubject } = require("../controllers/update/updateSubject.controller");
const { updateUser } = require("../controllers/update/updateUser.controller");

const router = express.Router();

// Update Subject
router.patch(
    "/subjects/:subjectId",
    authMiddleware.chkUser,
    updateSubject
);

// Update User
router.patch(
    "/users/:userId",
    authMiddleware.chkUser,
    updateUser
);

module.exports = router;