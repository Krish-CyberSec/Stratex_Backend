const semesterModel = require("../../models/semester.model");
const programModel = require("../../models/program.model");
const auditLogModel = require("../../models/auditlog.model");

const createSemester = async (req, res) => {
    try {

        const {
            programId,
            semesterNumber,
            status
        } = req.body;

        // Authorization
        const allowedRoles = [
            "superAdmin",
            "schoolAdmin"
        ];

        if (
            !req.user.roles.some(role =>
                allowedRoles.includes(role)
            )
        ) {

            await auditLogModel.create({
                performedBy: req.user?._id,
                action: "UNAUTHORIZED_CREATE_ATTEMPT",
                module: "Semester",
                remarks: "Unauthorized semester creation",
                ipAddress: req.ip,
                userAgent: req.headers["user-agent"]
            });

            return res.status(403).json({
                message: "Unauthorized"
            });
        }

        // Required Fields
        if (
            !programId ||
            !semesterNumber
        ) {
            return res.status(400).json({
                message:
                    "Program ID and Semester Number are required"
            });
        }

        // Semester Validation
        if (
            !Number.isInteger(Number(semesterNumber)) ||
            Number(semesterNumber) <= 0
        ) {
            return res.status(400).json({
                message:
                    "Semester number must be a positive integer"
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

        // Program Validation
        const program =
            await programModel.findById(programId);

        if (!program) {
            return res.status(404).json({
                message: "Program not found"
            });
        }

        // School Admin Restriction
        if (
            req.user.roles.includes("schoolAdmin") &&
            req.user.schoolId.toString() !==
            program.schoolId.toString()
        ) {
            return res.status(403).json({
                message:
                    "School Admin can only create semesters in their own school"
            });
        }

        // Duplicate Check
        const existingSemester =
            await semesterModel.findOne({
                programId,
                specializationId: null,
                semesterNumber
            });

        if (existingSemester) {

            return res.status(409).json({
                message:
                    "Semester already exists"
            });
        }

        // Create Semester
        const semester =
            await semesterModel.create({
                programId,
                specializationId: null,
                semesterNumber:semesterNumber,
                status:
                    status || "active",
                createdBy:
                    req.user._id
            });

        // Audit Log
        await auditLogModel.create({
            performedBy: req.user._id,
            action: "CREATE",
            module: "Semester",
            targetId: semester._id,
            targetName:
                semester.semesterNumber,
            remarks:
                "Semester created successfully",
            ipAddress: req.ip,
            userAgent: req.headers["user-agent"]
        });

        return res.status(201).json({
            message:
                "Semester created successfully",
            semester
        });

    }
    catch (err) {

        console.error(err);

        try {

            await auditLogModel.create({
                performedBy: req.user?._id,
                action:
                    "SEMESTER_CREATION_FAILED",
                module: "Semester",
                remarks: err.message,
                ipAddress: req.ip,
                userAgent:
                    req.headers["user-agent"]
            });

        } catch (auditErr) {
            console.error(auditErr);
        }

        return res.status(500).json({
            message:
                "Internal Server Error"
        });
    }
};

module.exports = {
    createSemester
};
