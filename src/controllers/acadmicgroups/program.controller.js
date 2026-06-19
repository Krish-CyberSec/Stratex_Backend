const programModel = require("../../models/program.model");
const auditLogModel = require("../../models/auditlog.model");
const schoolModel = require("../../models/school.model");

const createProgram = async (req, res) => {
    try {
        const {
            name,
            schoolId,
            description,
            status,
            duration,
            degreeType
        } = req.body;

        // Authorization
        const allowedRoles = ["superAdmin", "schoolAdmin"];

        if (
            !req.user.roles.some(role =>
                allowedRoles.includes(role)
            )
        ) {
            await auditLogModel.create({
                performedBy: req.user?._id,
                action: "UNAUTHORIZED_CREATE_ATTEMPT",
                module: "Program",
                remarks: "Unauthorized Program Creation",
                ipAddress: req.ip,
                userAgent: req.headers["user-agent"]
            });

            return res.status(403).json({
                message: "Unauthorized"
            });
        }

        // Required fields
        if (
            !name ||
            !schoolId  ||
            !duration ||
            !degreeType
        ) {
            return res.status(400).json({
                message: "All required fields are required"
            });
        }

        const normalizedName = name.trim();
        const normalizedDescription = description?description.trim():null;

        const parsedDuration = Number(duration);

        if (
            !Number.isInteger(parsedDuration) ||
            parsedDuration <= 0
        ) {
            return res.status(400).json({
                message: "Duration must be a positive integer"
            });
        }

        const allowedDegreeTypes = [
            "UG",
            "PG",
            "Diploma",
            "PhD"
        ];

        if (!allowedDegreeTypes.includes(degreeType)) {
            return res.status(400).json({
                message: "Invalid degree type"
            });
        }




        const allowedStatus = ["active", "inactive"];

        if (status && !allowedStatus.includes(status)) {
            return res.status(400).json({
                message: "Invalid status"
            });
        }

        // Check school exists

        const mongoose = require("mongoose");

        if (!mongoose.Types.ObjectId.isValid(schoolId)) {
            return res.status(400).json({
                message: "Invalid school ID"
            });
        }
        const school = await schoolModel.findById(schoolId);

        if (!school) {
            return res.status(404).json({
                message: "School not found"
            });
        }

        // School Admin can only create programs in their own school
        if (
            req.user.roles.includes("schoolAdmin") &&
            req.user.schoolId.toString() !== schoolId.toString()
        ) {
            return res.status(403).json({
                message:
                    "School Admin can only create programs in their own school"
            });
        }

        // Duplicate check inside same school
        const existingProgram =
            await programModel.findOne({
                name: normalizedName,
                schoolId
            });

        if (existingProgram) {
            return res.status(409).json({
                message:
                    "Program already exists in this school"
            });
        }

        // Create Program
        const program = await programModel.create({
            name: normalizedName,
            schoolId,
            description: normalizedDescription,
            status: status || "active",
            duration: parsedDuration,
            degreeType,
            createdBy: req.user._id
        });

        // Audit Log
        await auditLogModel.create({
            performedBy: req.user._id,
            action: "CREATE",
            module: "Program",
            targetId: program._id,
            targetName: program.name,
            remarks: "Program created successfully",
            ipAddress: req.ip,
            userAgent: req.headers["user-agent"]
        });

        return res.status(201).json({
            message: "Program created successfully",
            program
        });

    } catch (err) {
        console.error(err);

        try {
            await auditLogModel.create({
                performedBy: req.user?._id,
                action: "PROGRAM_CREATION_FAILED",
                module: "Program",
                targetName: req.body?.name,
                remarks: err.message,
                ipAddress: req.ip,
                userAgent: req.headers["user-agent"]
            });
        } catch (auditErr) {
            console.error("Audit Log Error:", auditErr);
        }

        return res.status(500).json({
            message: "Internal Server Error"
        });
    }
};

module.exports = {
    programs: createProgram
};