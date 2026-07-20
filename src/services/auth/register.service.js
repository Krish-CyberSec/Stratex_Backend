const mongoose = require("mongoose");
const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const userModel = require("../../models/user.model");
const schoolModel = require("../../models/school.model");
const auditLogModel = require("../../models/auditlog.model");
const sendSetupEmail = require("../email.service");
const { UploadFiles } = require("../storage.service");
const {
  assertCanCreateRoleSet,
  assertCanCreateUsers,
  hasRole,
} = require("../user/permission.service");
const {
  assertNoExistingUsers,
  assertNoPayloadDuplicates,
  normalizeEmail,
} = require("../user/duplicateUser.service");
const { createSetupToken } = require("../user/setupToken.service");
const { validateRoles } = require("../user/validateRole.service");
const {
  validateAcademicAssignments,
} = require("../user/validateAcademicAssignment.service");
const {
  syncStudentEnrollments,
} = require("../studentEnrollment/studentEnrollment.service");

const allowedStatus = ["active", "inactive", "suspended"];

const createHttpError = (message, statusCode) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const generateTemporaryPassword = () => {
  const random = crypto.randomBytes(9).toString("base64url");
  return `Stratex@${random}1`;
};

const validateBasicUserFields = async (userData, roles) => {
  const { firstName, lastName, universityAccount, schoolId, status } = userData;

  if (!firstName || !lastName) {
    throw createHttpError(`Missing required fields for ${firstName || "user"}`, 400);
  }

  if (status && !allowedStatus.includes(status)) {
    throw createHttpError("Invalid status", 400);
  }

  if (!roles.includes("superAdmin")) {
    if (!universityAccount || !schoolId) {
      throw createHttpError(`Missing required fields for ${firstName || "user"}`, 400);
    }

    if (!universityAccount.universityEmail || !universityAccount.institutionId) {
      throw createHttpError("University email and institution ID are required", 400);
    }

    const school = await schoolModel.findById(schoolId).lean();
    if (!school) {
      throw createHttpError("School not found", 404);
    }
  }
};

const prepareUsersForCreation = async (req, usersData) => {
  await assertCanCreateUsers(req);
  assertNoPayloadDuplicates(usersData);
  await assertNoExistingUsers(usersData);

  const usersToCreate = [];

  for (const userData of usersData) {
    const roles = userData.roles || [];
    validateRoles(roles);
    await validateBasicUserFields(userData, roles);
    assertCanCreateRoleSet(req.user, roles, userData.schoolId);

    const normalizedUniversityAccount = userData.universityAccount
      ? {
          universityEmail: normalizeEmail(userData.universityAccount.universityEmail),
          institutionId: userData.universityAccount.institutionId?.trim(),
        }
      : undefined;

    const academic = await validateAcademicAssignments({
      userData,
      roles,
    });

    const setupToken = createSetupToken();
    const temporaryPassword = generateTemporaryPassword();
    const hashedPassword = await bcrypt.hash(temporaryPassword, 10);

    usersToCreate.push({
      firstName: userData.firstName,
      middleName: userData.middleName,
      lastName: userData.lastName,
      personalEmail: normalizeEmail(userData.personalEmail),
      universityAccount: normalizedUniversityAccount,
      roles,
      status: userData.status || "inactive",
      schoolId: userData.schoolId || undefined,
      academicAssignments: academic.academicAssignments,
      currentSemester: academic.currentSemester,
      password: hashedPassword,
      mustChangePassword: true,
      setupToken: setupToken.hashedToken,
      setupTokenExpiry: setupToken.expiresAt,
      createdBy: req.user._id,
      __rawToken: setupToken.rawToken,
      __temporaryPassword: temporaryPassword,
    });
  }

  return usersToCreate;
};

const sendSetupEmails = async (users, usersToCreate) => {
  for (let index = 0; index < users.length; index += 1) {
    const user = users[index];
    const sourceUser = usersToCreate[index];

    const emails = [user.universityAccount?.universityEmail, user.personalEmail].filter(Boolean);
    if (!emails.length || hasRole(user, "superAdmin")) {
      continue;
    }

    const setupLink = `${process.env.CLIENT_URL}/setup-password/${sourceUser.__rawToken}`;
    await sendSetupEmail(
      emails,
      user.fullName,
      setupLink,
      sourceUser.__temporaryPassword
    );
  }
};

const registerUsers = async (req) => {
  const usersData = Array.isArray(req.body) ? req.body : [req.body];
  let usersToCreate = [];

  try {
    usersToCreate = await prepareUsersForCreation(req, usersData);
    const session = await mongoose.startSession();

    try {
      session.startTransaction();

      let uploadedProfileImage = null;
      if (req.file && usersToCreate.length === 1) {
        uploadedProfileImage = await UploadFiles(
          req.file.buffer,
          req.file.originalname
        );
      }

      const users = await userModel.create(
        usersToCreate.map(({ __rawToken, __temporaryPassword, ...dbUser }, index) => ({
          ...dbUser,
          profileImage: index === 0 ? uploadedProfileImage?.url || null : null,
        })),
        { session, ordered: true }
      );

      await sendSetupEmails(users, usersToCreate);

      await Promise.all(
        users.map((user) =>
          syncStudentEnrollments({
            student: user,
            actorId: req.user._id,
            session,
          })
        )
      );

      await auditLogModel.create(
        [
          {
            performedBy: req.user._id,
            action: users.length > 1 ? "BULK_CREATE" : "CREATE",
            module: "User",
            targetIds: users.map((user) => user._id),
            targetNames: usersData.map((user) => `${user.firstName} ${user.lastName}`),
            remarks:
              users.length > 1
                ? `${users.length} user accounts created and setup emails sent`
                : "User account created and setup email sent",
            ipAddress: req.ip,
            userAgent: req.headers["user-agent"],
          },
          ...users.flatMap((user, index) =>
            (usersToCreate[index].academicAssignments || [])
              .filter((assignment) => assignment.sectionId)
              .map((assignment) => ({
                performedBy: req.user._id,
                action: "STUDENT_ENROLLED",
                module: "StudentEnrollment",
                targetId: user._id,
                targetName: `${user.firstName} ${user.lastName}`,
                remarks: `Student enrolled in section ${assignment.sectionId}`,
                ipAddress: req.ip,
                userAgent: req.headers["user-agent"],
              }))
          ),
        ],
        { session }
      );

      await session.commitTransaction();

      const createdUsers = await userModel
        .find({ _id: { $in: users.map((user) => user._id) } })
        .select("-setupToken -setupTokenExpiry")
        .lean();

      return {
        statusCode: 201,
        body: {
          message: `${createdUsers.length} user(s) created successfully`,
          users: createdUsers,
        },
      };
    } catch (error) {
      await session.abortTransaction();
      console.error("User creation/setup email error:", error);
      throw createHttpError("User creation failed because setup email could not be sent", 500);
    } finally {
      await session.endSession();
    }
  } catch (err) {
    try {
      await auditLogModel.create({
        performedBy: req.user?._id,
        action: "ACCOUNT_CREATION_FAILED",
        module: "User",
        targetNames: usersData.map((user) => `${user.firstName} ${user.lastName}`),
        remarks: err.message,
        ipAddress: req.ip,
        userAgent: req.headers["user-agent"],
      });
    } catch (auditErr) {
      console.error("Failed to create audit log:", auditErr);
    }

    throw err;
  }
};

module.exports = {
  registerUsers,
};
