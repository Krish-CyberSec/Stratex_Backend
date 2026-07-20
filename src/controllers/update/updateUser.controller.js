const userModel = require("../../models/user.model");
const auditLogModel = require("../../models/auditlog.model");
const { UploadFiles } = require("../../services/storage.service");
const { validateAcademicAssignments } = require("../../services/user/validateAcademicAssignment.service");
const {
    syncStudentEnrollments,
} = require("../../services/studentEnrollment/studentEnrollment.service");

const normalizeBody = (req) => {
    if (req.body?.payload && typeof req.body.payload === "string") {
        req.body = JSON.parse(req.body.payload);
    }
};

const toId = (value) => String(value?._id || value || "");

const updateUser = async (req, res) => {
    try {
        normalizeBody(req);

        const { userId } = req.params;

        const {
            firstName,
            lastName,
            personalEmail,
            phoneNumber,
            status,
            academicAssignments
        } = req.body;

        const allowedRoles = [
            "superAdmin",
            "schoolAdmin"
        ];

        const isSelfUpdate = req.user._id?.toString() === userId?.toString();
        const canManageUsers = req.user.roles.some(role =>
            allowedRoles.includes(role)
        );

        // Authorization
        if (!isSelfUpdate && !canManageUsers) {

            await auditLogModel.create({
                performedBy: req.user?._id,
                action: "UNAUTHORIZED_UPDATE_ATTEMPT",
                module: "User",
                remarks: "Unauthorized user update attempt",
                ipAddress: req.ip,
                userAgent: req.headers["user-agent"]
            });

            return res.status(403).json({
                message: "Unauthorized"
            });
        }

        const user = await userModel.findById(userId);

        if (!user) {
            return res.status(404).json({
                message: "User not found"
            });
        }

        // Status Validation
        const allowedStatus = [
            "active",
            "inactive"
        ];

        if (
            status &&
            !allowedStatus.includes(status)
        ) {
            return res.status(400).json({
                message: "Invalid status"
            });
        }

        // Email Duplicate Check
        if (
            personalEmail &&
            personalEmail.toLowerCase() !==
                user.personalEmail?.toLowerCase()
        ) {

            const existingUser =
                await userModel.findOne({
                    personalEmail:
                        personalEmail.toLowerCase(),
                    _id: { $ne: userId }
                });

            if (existingUser) {
                return res.status(409).json({
                    message:
                        "Personal email already exists"
                });
            }
        }

        // Update Allowed Fields

        if (firstName) {
            user.firstName = firstName.trim();
        }

        if (lastName) {
            user.lastName = lastName.trim();
        }

        if (personalEmail) {
            user.personalEmail =
                personalEmail.toLowerCase().trim();
        }

        if (phoneNumber) {
            user.phoneNumber = phoneNumber.trim();
        }

        if (status && canManageUsers) {
            user.status = status;
        }

        let newSectionAssignments = [];

        if (Array.isArray(academicAssignments) && canManageUsers) {
            const previousSectionKeys = new Set(
                (user.academicAssignments || [])
                    .filter((assignment) => assignment.sectionId)
                    .map((assignment) => `${toId(assignment.sectionId)}:${toId(assignment.academicYearId)}:${toId(assignment.programId)}:${toId(assignment.semesterId)}`)
            );
            const academic = await validateAcademicAssignments({
                userData: {
                    ...user.toObject(),
                    schoolId: user.schoolId,
                    academicAssignments,
                    currentSemester: user.currentSemester,
                },
                roles: user.roles,
            });

            user.academicAssignments = academic.academicAssignments;
            user.currentSemester = academic.currentSemester;

            newSectionAssignments = academic.academicAssignments.filter((assignment) => {
                if (!assignment.sectionId) return false;
                const key = `${toId(assignment.sectionId)}:${toId(assignment.academicYearId)}:${toId(assignment.programId)}:${toId(assignment.semesterId)}`;
                return !previousSectionKeys.has(key);
            });
        }

        if (req.file) {
            const profileImage = await UploadFiles(
                req.file.buffer,
                req.file.originalname
            );
            user.profileImage = profileImage.url;
        }

        user.updatedBy = req.user._id;

        await user.save();

        await syncStudentEnrollments({
            student: user,
            actorId: req.user._id,
        });

        await auditLogModel.create({
            performedBy: req.user._id,
            action: "UPDATE",
            module: "User",
            targetId: user._id,
            targetName:
                `${user.firstName} ${user.lastName}`,
            remarks: "User updated successfully",
            ipAddress: req.ip,
            userAgent: req.headers["user-agent"]
        });

        if (newSectionAssignments.length) {
            await auditLogModel.create(
                newSectionAssignments.map((assignment) => ({
                    performedBy: req.user._id,
                    action: user.roles.includes("student") ? "STUDENT_ENROLLED" : "SECTION_ASSIGNED",
                    module: user.roles.includes("student") ? "StudentEnrollment" : "User",
                    targetId: user._id,
                    targetName: `${user.firstName} ${user.lastName}`,
                    remarks: user.roles.includes("student")
                        ? `Student enrolled in section ${assignment.sectionId}`
                        : `User assigned to section ${assignment.sectionId}`,
                    ipAddress: req.ip,
                    userAgent: req.headers["user-agent"]
                }))
            );
        }

        return res.status(200).json({
            message: "User updated successfully",
            user
        });

    } catch (err) {

        console.error(err);

        try {

            await auditLogModel.create({
                performedBy: req.user?._id,
                action: "USER_UPDATE_FAILED",
                module: "User",
                targetId: req.params?.userId,
                remarks: err.message,
                ipAddress: req.ip,
                userAgent: req.headers["user-agent"]
            });

        } catch (auditErr) {
            console.error(auditErr);
        }

        return res.status(err.statusCode || 500).json({
            message: err.statusCode ? err.message : "Internal Server Error"
        });
    }
};

module.exports = {
    updateUser
};
