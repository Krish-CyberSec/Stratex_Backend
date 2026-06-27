const semesterModel = require("../../models/semester.model");
const specializationModel = require("../../models/specelization.model");
const subjectModel = require("../../models/subject.model");
const userModel = require("../../models/user.model");
const notificationModel = require("../../models/notificaton.Model");

const semestersForDuration = (duration) => Number(duration) * 2;

const buildSemesterOps = ({ programId, duration, userId }) => {
  const totalSemesters = semestersForDuration(duration);
  const ops = [];

  for (let semesterNumber = 1; semesterNumber <= totalSemesters; semesterNumber += 1) {
    ops.push({
      updateOne: {
        filter: {
          programId,
          specializationId: null,
          semesterNumber,
        },
        update: {
          $setOnInsert: {
            programId,
            specializationId: null,
            semesterNumber,
            status: "active",
            createdBy: userId,
          },
        },
        upsert: true,
      },
    });
  }

  return ops;
};

const generateProgramSemesters = async ({ programId, duration, userId, session }) => {
  const ops = buildSemesterOps({
    programId,
    duration,
    userId,
  });

  if (!ops.length) {
    return { upsertedCount: 0, modifiedCount: 0 };
  }

  return semesterModel.bulkWrite(ops, { session, ordered: false });
};

const generateMissingProgramSemesters = async ({
  programId,
  duration,
  userId,
  session,
}) => {
  return generateProgramSemesters({ programId, duration, userId, session });
};

const assertDurationCanChange = async ({ programId, currentDuration, nextDuration }) => {
  if (Number(nextDuration) >= Number(currentDuration)) {
    return;
  }

  const maxAllowedSemester = semestersForDuration(nextDuration);
  const semestersBeyondDuration = await semesterModel
    .find({
      programId,
      semesterNumber: { $gt: maxAllowedSemester },
    })
    .select("_id semesterNumber")
    .lean();

  if (!semestersBeyondDuration.length) {
    return;
  }

  const semesterIds = semestersBeyondDuration.map((semester) => semester._id);
  const [subjects, users, notifications] = await Promise.all([
    subjectModel.countDocuments({ semesterId: { $in: semesterIds } }),
    userModel.countDocuments({
      $or: [
        { currentSemester: { $in: semesterIds } },
        { "academicAssignments.semesterId": { $in: semesterIds } },
      ],
    }),
    notificationModel.countDocuments({
      $or: [
        { "reference.model": "Semester", "reference.id": { $in: semesterIds } },
        { "audience.semesterIds": { $in: semesterIds } },
      ],
    }),
  ]);

  if (subjects || users || notifications) {
    const error = new Error(
      "Program duration cannot be reduced because academic data exists in higher semesters"
    );
    error.statusCode = 409;
    throw error;
  }
};

const assertProgramCanBeDeleted = async (programId) => {
  const [semesters, subjects, users, notifications, specializations] = await Promise.all([
    semesterModel.countDocuments({ programId }),
    subjectModel.countDocuments({ programId }),
    userModel.countDocuments({ "academicAssignments.programId": programId }),
    notificationModel.countDocuments({
      $or: [
        { "reference.model": "Program", "reference.id": programId },
        { "audience.programIds": programId },
      ],
    }),
    specializationModel.countDocuments({ programId }),
  ]);

  if (semesters || subjects || users || notifications || specializations) {
    const error = new Error(
      "Program cannot be deleted because related semesters, subjects, users, notifications, or specializations exist"
    );
    error.statusCode = 409;
    error.details = { semesters, subjects, users, notifications, specializations };
    throw error;
  }
};

module.exports = {
  assertDurationCanChange,
  assertProgramCanBeDeleted,
  generateMissingProgramSemesters,
  generateProgramSemesters,
  semestersForDuration,
};
