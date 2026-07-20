const auditLogModel = require("../models/auditlog.model");
const eventModel = require("../models/event.model");
const noticeModel = require("../models/notice.model");
const programModel = require("../models/program.model");
const schoolModel = require("../models/school.model");
const academicYearModel = require("../models/academicYear.model");
const sectionModel = require("../models/section.model");
const subjectModel = require("../models/subject.model");
const userModel = require("../models/user.model");

const toIdStrings = (values = []) => values.map((value) => String(value?._id || value || "")).filter(Boolean);

const emptyAudienceField = (field) => ({
  $or: [
    { [field]: { $exists: false } },
    { [field]: { $size: 0 } }
  ]
});

const criterionAllows = (field, values = []) => {
  const emptyField = emptyAudienceField(field);

  if (!values.length) return emptyField;

  return {
    $or: [
      ...emptyField.$or,
      { [field]: { $in: values } }
    ]
  };
};

const buildStudentNoticeFilter = (user = {}) => {
  const roles = user.roles || [];
  const schoolId = user.schoolId?._id || user.schoolId;
  const assignments = user.academicAssignments || [];
  const programIds = toIdStrings(assignments.map((assignment) => assignment.programId));
  const specializationIds = toIdStrings(assignments.map((assignment) => assignment.specializationId));
  const semesterIds = toIdStrings([
    user.currentSemester,
    ...assignments.map((assignment) => assignment.semesterId)
  ]);
  const academicYearIds = toIdStrings(assignments.map((assignment) => assignment.academicYearId));
  const sectionIds = toIdStrings(assignments.map((assignment) => assignment.sectionId));
  const specializationAllows = specializationIds.length
    ? criterionAllows("audienceCriteria.specializationIds", specializationIds)
    : {
        $or: [
          ...emptyAudienceField("audienceCriteria.specializationIds").$or,
          { "audienceCriteria.includeUsersWithoutSpecialization": true }
        ]
      };

  return {
    status: "published",
    clearedBy: { $ne: user._id },
    $or: [
      {
        $and: [
          { audienceCriteria: { $ne: null } },
          { "audienceCriteria.excludeUserIds": { $ne: user._id } },
          { "audienceCriteria.excludeRoles": { $nin: roles } },
          {
            $or: [
              { "audienceCriteria.allUsers": true },
              { "audienceCriteria.userIds": user._id },
              {
                $and: [
                  criterionAllows("audienceCriteria.roles", roles),
                  criterionAllows("audienceCriteria.schoolIds", schoolId ? [schoolId] : []),
                  criterionAllows("audienceCriteria.programIds", programIds),
                  specializationAllows,
                  criterionAllows("audienceCriteria.semesterIds", semesterIds),
                  criterionAllows("audienceCriteria.academicYearIds", academicYearIds),
                  criterionAllows("audienceCriteria.sectionIds", sectionIds)
                ]
              }
            ]
          }
        ]
      },
      {
        $and: [
          {
            $or: [
              { audienceCriteria: null },
              { audienceCriteria: { $exists: false } }
            ]
          },
          { $or: [{ audience: "all" }, { audience: "student" }] },
          {
            $or: [
              { schoolId: null },
              { schoolId: { $exists: false } },
              ...(schoolId ? [{ schoolId }] : [])
            ]
          }
        ]
      }
    ]
  };
};

const getSemesterLabel = (semesterNumber) => {
  if (!semesterNumber) return "Not assigned";
  return `Semester ${semesterNumber}`;
};

const getTermLabel = (semesterNumber) => {
  if (!semesterNumber) return "Current term";
  return Number(semesterNumber) % 2 === 0 ? "Even Semester" : "Odd Semester";
};

const getStudentDashboard = async (req, res) => {
  try {
    if (!req.authUser?.roles?.includes("student")) {
      return res.status(403).json({
        message: "Student dashboard is available only for student users"
      });
    }

    const user = await userModel
      .findById(req.authUser._id)
      .select("-password -setupToken -setupTokenExpiry")
      .populate("schoolId", "name slug")
      .populate("currentSemester", "semesterNumber status")
      .populate("academicAssignments.programId", "name code degreeType duration")
      .populate("academicAssignments.specializationId", "name code")
      .populate("academicAssignments.semesterId", "semesterNumber status")
      .populate("academicAssignments.academicYearId", "name startDate endDate isCurrent")
      .populate("academicAssignments.sectionId", "name capacity status");

    if (!user) {
      return res.status(404).json({ message: "Student not found" });
    }

    const assignments = user.academicAssignments || [];
    const assignment =
      assignments.find((item) => item.status === "active" && item.isPrimary) ||
      assignments.find((item) => item.status === "active") ||
      assignments[0] ||
      {};
    const semesterId = assignment.semesterId?._id || assignment.semesterId || user.currentSemester?._id || user.currentSemester;
    const programId = assignment.programId?._id || assignment.programId;
    const specializationId = assignment.specializationId?._id || assignment.specializationId;
    const semesterNumber = assignment.semesterId?.semesterNumber || user.currentSemester?.semesterNumber || null;

    const subjectFilter = {
      status: "active",
      ...(programId ? { programId } : {}),
      ...(semesterId ? { semesterId } : {})
    };

    subjectFilter.specializationId = specializationId || null;

    const [subjects, notices, events] = await Promise.all([
      subjectModel
        .find(subjectFilter)
        .populate("facultyIds", "firstName lastName")
        .populate("coordinatorId", "firstName lastName")
        .sort({ code: 1, name: 1 })
        .limit(8)
        .lean(),
      noticeModel
        .find(buildStudentNoticeFilter(user))
        .populate("createdBy", "firstName lastName roles")
        .sort({ publishedAt: -1, createdAt: -1 })
        .limit(5)
        .lean(),
      eventModel
        .find({
          status: "scheduled",
          startDate: { $gte: new Date() }
        })
        .populate("createdBy", "firstName lastName")
        .sort({ startDate: 1 })
        .limit(4)
        .lean()
    ]);

    const mappedSubjects = subjects.map((subject) => ({
      _id: subject._id,
      name: subject.name,
      code: subject.code,
      credits: subject.credits,
      faculty:
        subject.coordinatorId ||
        subject.facultyIds?.[0] ||
        null
    }));

    return res.status(200).json({
      student: {
        _id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        fullName: user.fullName,
        school: user.schoolId,
        program: assignment.programId || null,
        specialization: assignment.specializationId || null,
        semester: assignment.semesterId || user.currentSemester || null,
        academicYear: assignment.academicYearId || null,
        section: assignment.sectionId || null,
        semesterLabel: getSemesterLabel(semesterNumber),
        termLabel: getTermLabel(semesterNumber),
        institutionId: user.universityAccount?.institutionId || null
      },
      metrics: {
        subjects: mappedSubjects.length,
        attendance: null,
        cgpa: null,
        resultsEnabled: false
      },
      subjects: mappedSubjects,
      notices,
      events
    });
  } catch (err) {
    console.error(err);

    return res.status(500).json({
      message: "Internal Server Error"
    });
  }
};

const getStats = async (_req, res) => {
  try {
    const [
      totalUsers,
      totalSchools,
      totalPrograms,
      totalSubjects,
      totalNotices,
      totalEvents,
      academicYearCount,
      sectionCount,
      currentAcademicYears,
      studentsPerAcademicYear,
      studentsPerSection
    ] = await Promise.all([
      userModel.countDocuments(),
      schoolModel.countDocuments(),
      programModel.countDocuments(),
      subjectModel.countDocuments(),
      noticeModel.countDocuments(),
      eventModel.countDocuments(),
      academicYearModel.countDocuments(),
      sectionModel.countDocuments(),
      academicYearModel.find({ isCurrent: true }).populate("schoolId", "name slug").lean(),
      userModel.aggregate([
        { $match: { roles: "student", "academicAssignments.academicYearId": { $ne: null } } },
        { $unwind: "$academicAssignments" },
        { $match: { "academicAssignments.academicYearId": { $ne: null } } },
        { $group: { _id: "$academicAssignments.academicYearId", students: { $sum: 1 } } }
      ]),
      userModel.aggregate([
        { $match: { roles: "student", "academicAssignments.sectionId": { $ne: null } } },
        { $unwind: "$academicAssignments" },
        { $match: { "academicAssignments.sectionId": { $ne: null } } },
        { $group: { _id: "$academicAssignments.sectionId", students: { $sum: 1 } } }
      ])
    ]);

    return res.status(200).json({
      totalUsers,
      totalSchools,
      totalPrograms,
      totalSubjects,
      totalNotices,
      totalEvents,
      academicYearCount,
      sectionCount,
      currentAcademicYears,
      studentsPerAcademicYear,
      studentsPerSection
    });
  } catch (err) {
    console.error(err);

    return res.status(500).json({
      message: "Internal Server Error"
    });
  }
};

const getRecentUsers = async (_req, res) => {
  try {
    const users = await userModel
      .find()
      .select("-password -setupToken -setupTokenExpiry")
      .populate("schoolId", "name slug")
      .populate("createdBy", "firstName lastName")
      .sort({ createdAt: -1 })
      .limit(10);

    return res.status(200).json({ users });
  } catch (err) {
    console.error(err);

    return res.status(500).json({
      message: "Internal Server Error"
    });
  }
};

const getRecentActivities = async (_req, res) => {
  try {
    const activities = await auditLogModel
      .find()
      .populate("performedBy", "firstName lastName")
      .sort({ createdAt: -1 })
      .limit(10);

    return res.status(200).json({ activities });
  } catch (err) {
    console.error(err);

    return res.status(500).json({
      message: "Internal Server Error"
    });
  }
};

const getRecentNotices = async (_req, res) => {
  try {
    const notices = await noticeModel
      .find({ status: { $ne: "inactive" } })
      .populate("createdBy", "firstName lastName")
      .sort({ createdAt: -1 })
      .limit(10);

    return res.status(200).json({ notices });
  } catch (err) {
    console.error(err);

    return res.status(500).json({
      message: "Internal Server Error"
    });
  }
};

const getUpcomingEvents = async (_req, res) => {
  try {
    const events = await eventModel
      .find({
        status: "scheduled",
        startDate: { $gte: new Date() }
      })
      .populate("createdBy", "firstName lastName")
      .sort({ startDate: 1 })
      .limit(10);

    return res.status(200).json({ events });
  } catch (err) {
    console.error(err);

    return res.status(500).json({
      message: "Internal Server Error"
    });
  }
};

module.exports = {
  getStudentDashboard,
  getStats,
  getRecentUsers,
  getRecentActivities,
  getRecentNotices,
  getUpcomingEvents
};
