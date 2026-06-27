const programModel = require("../../models/program.model");
const auditLogModel = require("../../models/auditlog.model");
const schoolModel = require("../../models/school.model");
const mongoose = require("mongoose");
const {
    assertDurationCanChange,
    assertProgramCanBeDeleted,
    generateMissingProgramSemesters,
    generateProgramSemesters
} = require("../../services/academic/semesterGeneration.service");
const { sendError, sendSuccess } = require("../../utils/apiResponse");

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

        const session = await mongoose.startSession();
        let program;

        try {
            session.startTransaction();

            [program] = await programModel.create([{
                name: normalizedName,
                schoolId,
                description: normalizedDescription,
                status: status || "active",
                duration: parsedDuration,
                degreeType,
                createdBy: req.user._id
            }], { session });

            const semesterResult = await generateProgramSemesters({
                programId: program._id,
                duration: parsedDuration,
                userId: req.user._id,
                session
            });

            await auditLogModel.create([{
                performedBy: req.user._id,
                action: "CREATE",
                module: "Program",
                targetId: program._id,
                targetName: program.name,
                remarks: "Program created successfully",
                ipAddress: req.ip,
                userAgent: req.headers["user-agent"]
            }, {
                performedBy: req.user._id,
                action: "SEMESTER_AUTO_GENERATED",
                module: "Semester",
                targetId: program._id,
                targetName: program.name,
                newData: {
                    programId: program._id,
                    generatedCount: semesterResult.upsertedCount || 0,
                    duration: parsedDuration
                },
                remarks: "Semesters automatically generated for program",
                ipAddress: req.ip,
                userAgent: req.headers["user-agent"]
            }], { session });

            await session.commitTransaction();
        } catch (err) {
            await session.abortTransaction();
            throw err;
        } finally {
            await session.endSession();
        }

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

const updateProgram = async (req, res) => {
    try {
        const allowedRoles = ["superAdmin", "schoolAdmin"];

        if (!req.user.roles.some(role => allowedRoles.includes(role))) {
            return sendError(res, 403, "Unauthorized");
        }

        const program = await programModel.findById(req.params.id);

        if (!program) {
            return sendError(res, 404, "Program not found");
        }

        if (
            req.user.roles.includes("schoolAdmin") &&
            req.user.schoolId.toString() !== program.schoolId.toString()
        ) {
            return sendError(res, 403, "School Admin can only update programs in their own school");
        }

        const nextDuration = req.body.duration !== undefined
            ? Number(req.body.duration)
            : program.duration;

        if (!Number.isInteger(nextDuration) || nextDuration <= 0) {
            return sendError(res, 400, "Duration must be a positive integer");
        }

        await assertDurationCanChange({
            programId: program._id,
            currentDuration: program.duration,
            nextDuration
        });

        const oldDuration = program.duration;
        const session = await mongoose.startSession();

        try {
            session.startTransaction();

            const update = {
                ...req.body,
                duration: nextDuration,
                updatedBy: req.user._id
            };

            const updatedProgram = await programModel.findByIdAndUpdate(
                req.params.id,
                update,
                {
                    new: true,
                    runValidators: true,
                    session
                }
            );

            if (nextDuration > oldDuration) {
                await generateMissingProgramSemesters({
                    programId: updatedProgram._id,
                    duration: nextDuration,
                    userId: req.user._id,
                    session
                });

                await auditLogModel.create([{
                    performedBy: req.user._id,
                    action: "SEMESTER_REGENERATED",
                    module: "Semester",
                    targetId: updatedProgram._id,
                    targetName: updatedProgram.name,
                    oldData: { duration: oldDuration },
                    newData: { duration: nextDuration },
                    remarks: "Missing semesters generated after program duration increase",
                    ipAddress: req.ip,
                    userAgent: req.headers["user-agent"]
                }, {
                    performedBy: req.user._id,
                    action: "PROGRAM_DURATION_CHANGE",
                    module: "Program",
                    targetId: updatedProgram._id,
                    targetName: updatedProgram.name,
                    oldData: { duration: oldDuration },
                    newData: { duration: nextDuration },
                    remarks: "Program duration updated",
                    ipAddress: req.ip,
                    userAgent: req.headers["user-agent"]
                }], { session });
            }

            await session.commitTransaction();

            return sendSuccess(res, 200, "Program updated successfully", updatedProgram);
        } catch (err) {
            await session.abortTransaction();
            throw err;
        } finally {
            await session.endSession();
        }
    } catch (err) {
        console.error(err);
        return sendError(res, err.statusCode || 500, err.statusCode ? err.message : "Internal Server Error", err.details || []);
    }
};

const deleteProgram = async (req, res) => {
    try {
        const allowedRoles = ["superAdmin", "schoolAdmin"];

        if (!req.user.roles.some(role => allowedRoles.includes(role))) {
            return sendError(res, 403, "Unauthorized");
        }

        const program = await programModel.findById(req.params.id);

        if (!program) {
            return sendError(res, 404, "Program not found");
        }

        if (
            req.user.roles.includes("schoolAdmin") &&
            req.user.schoolId.toString() !== program.schoolId.toString()
        ) {
            return sendError(res, 403, "School Admin can only delete programs in their own school");
        }

        await assertProgramCanBeDeleted(program._id);

        program.status = "inactive";
        program.updatedBy = req.user._id;
        await program.save();

        await auditLogModel.create({
            performedBy: req.user._id,
            action: "DELETE",
            module: "Program",
            targetId: program._id,
            targetName: program.name,
            remarks: "Program deleted successfully",
            ipAddress: req.ip,
            userAgent: req.headers["user-agent"]
        });

        return sendSuccess(res, 200, "Program deleted successfully");
    } catch (err) {
        console.error(err);
        return sendError(res, err.statusCode || 500, err.statusCode ? err.message : "Internal Server Error", err.details || []);
    }
};

module.exports = {
    programs: createProgram,
    updateProgram,
    deleteProgram
};
