const express = require("express");
const authMiddleware = require("../middlewares/auth.middleware");
const dashboardController = require("../controllers/dashboard.controller");

const router = express.Router();

router.get("/student", authMiddleware.chkUser, dashboardController.getStudentDashboard);
router.get("/stats", authMiddleware.chkUser, dashboardController.getStats);
router.get("/recent-users", authMiddleware.chkUser, dashboardController.getRecentUsers);
router.get("/recent-activities", authMiddleware.chkUser, dashboardController.getRecentActivities);
router.get("/recent-notices", authMiddleware.chkUser, dashboardController.getRecentNotices);
router.get("/upcoming-events", authMiddleware.chkUser, dashboardController.getUpcomingEvents);

module.exports = router;
