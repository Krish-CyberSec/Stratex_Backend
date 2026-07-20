const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });
const express = require('express');
const cors = require("cors")
const cookieParser = require('cookie-parser');
const auditRequest = require("./middlewares/audit.middleware");
const authRoutes = require('./routes/auth.routes');
const userRoutes = require("./routes/user.routes");
const schoolRoutes = require("./routes/school.routes");
const academicYearRoutes = require("./routes/academicYear.routes");
const programRoutes = require("./routes/program.routes");
const semesterRoutes = require("./routes/semester.routes");
const sectionRoutes = require("./routes/section.routes");
const specializationRoutes = require("./routes/specialization.routes");
const subjectRoutes = require("./routes/subject.routes");
const noticeRoutes = require("./routes/notice.routes");
const eventRoutes = require("./routes/event.routes");
const dashboardRoutes = require("./routes/dashboard.routes");
const notificationRoutes = require("./routes/notification.routes");
const importRoutes = require("./routes/import.routes");
const {
    scheduleNotificationCleanup
} = require("./services/notification/notificationCleanup.service");
const app = express();
app.use(express.json());
app.use(cookieParser());
app.use(cors({
    origin: process.env.CLIENT_URL,
    credentials: true
}));
app.use("/api", auditRequest);

//   #### redirect to routes

// *** auth route
app.use('/api/auth', authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/schools", schoolRoutes);
app.use("/api/academic-years", academicYearRoutes);
app.use("/api/programs", programRoutes);
app.use("/api/semesters", semesterRoutes);
app.use("/api/sections", sectionRoutes);
app.use("/api/specializations", specializationRoutes);
app.use("/api/subjects", subjectRoutes);
app.use("/api/notices", noticeRoutes);
app.use("/api/events", eventRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/import", importRoutes);

scheduleNotificationCleanup();

module.exports = app;
