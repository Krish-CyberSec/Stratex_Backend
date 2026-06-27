const auditLogModel = require("../../models/auditlog.model");
const specializationModel = require("../../models/specelization.model");
const programModel = require("../../models/program.model");
const mongoose = require("mongoose");
const subjectModel = require("../../models/subject.model");
const userModel = require("../../models/user.model");
const notificationModel = require("../../models/notificaton.Model");
const { sendError, sendSuccess } = require("../../utils/apiResponse");


const createSpecialization = async (req, res) => {

    try {
        const { programId, name, description, status } = req.body;

        const allowedRoles = ["superAdmin", "schoolAdmin"]
        if (
            !req.user.roles.some(role =>
                allowedRoles.includes(role)
            )
        ) {
            await auditLogModel.create({
                performedBy: req.user?._id,
                action: "UNAUTHORIZED_CREATE_ATTEMPT",
                module: "Specialization",
                remarks: "Unauthorized specialization Creation",
                ipAddress: req.ip,
                userAgent: req.headers["user-agent"]
            });

            return res.status(403).json({
                message: "Unauthorized"
            });
        }


        if (
            !programId ||
            !name ||
            !description
        ) {
            return res.status(400).json({
                message: "All required fields are required"
            });
        }

        if (!mongoose.Types.ObjectId.isValid(programId)) {
            return res.status(400).json({
                message: "Invalid program ID"
            });
        }
        const program = await programModel.findById(programId);

        if (!program) {
            return res.status(404).json({
                message: "Program not found"
            });
        }


        if (
            req.user.roles.includes("schoolAdmin") &&
            req.user.schoolId.toString() !==
            program.schoolId.toString()
        ) {
            return res.status(403).json({
                message:
                    "School Admin can only create specializations in their own school"
            });
        }


        const isSpecialization = await specializationModel.findOne({
            name: name.trim(),
            programId
        });

        if (isSpecialization) {

            await auditLogModel.create({
                performedBy: req.user._id,
                action: "REJECT",
                module: "Specialization",
                targetId: isSpecialization._id,
                targetName: isSpecialization.name,
                remarks: "Specialization with same programID or name already exists",
                ipAddress: req.ip,
                userAgent: req.headers["user-agent"]
            });

            return res.status(409).json({
                message: " Specialization already exists in this program",
                Specialization: isSpecialization._id
            });

        }

        const allowedStatus = ["active", "inactive"];

        if (status && !allowedStatus.includes(status)) {
            return res.status(400).json({
                message: "Invalid status"
            });
        }

        const specialization = await specializationModel.create({
            programId,
            name: name.trim(),
            description: description.trim(),
            status: status ? status : "active",
            createdBy: req.user._id
        });

        await auditLogModel.create({
            performedBy: req.user._id,
            action: "CREATE",
            module: "Specialization",
            targetId: specialization._id,
            targetName: specialization.name,
            remarks: "Specialization created successfully",
            ipAddress: req.ip,
            userAgent: req.headers["user-agent"]
        });

        return res.status(201).json({
            message: "Specialization created successfully",
            specialization: specialization
        });

    }
    catch (err) {
        console.error(err);
        try {
            await auditLogModel.create({
                performedBy: req.user?._id,
                action: "SPECIALIZATION_CREATION_FAILED",
                module: "Specialization",
                targetName: req.body?.name,
                remarks: err.message,
                ipAddress: req.ip,
                userAgent: req.headers["user-agent"]
            });
        } catch (auditErr) {
            console.error(auditErr);
        }
        return res.status(500).json({
            message: "Internal server error"
        });

    }


}

const deleteSpecialization = async (req, res) => {
    try {
        const allowedRoles = ["superAdmin", "schoolAdmin"];

        if (!req.user.roles.some(role => allowedRoles.includes(role))) {
            return sendError(res, 403, "Unauthorized");
        }

        const specialization = await specializationModel.findById(req.params.id);

        if (!specialization) {
            return sendError(res, 404, "Specialization not found");
        }

        const program = await programModel.findById(specialization.programId).lean();

        if (
            req.user.roles.includes("schoolAdmin") &&
            req.user.schoolId.toString() !== program?.schoolId?.toString()
        ) {
            return sendError(res, 403, "School Admin can only delete specializations in their own school");
        }

        const [subjects, users, notifications] = await Promise.all([
            subjectModel.countDocuments({ specializationId: specialization._id }),
            userModel.countDocuments({ "academicAssignments.specializationId": specialization._id }),
            notificationModel.countDocuments({
                $or: [
                    { "reference.model": "Specialization", "reference.id": specialization._id },
                    { "audience.specializationIds": specialization._id },
                ],
            }),
        ]);

        if (subjects || users || notifications) {
            return sendError(
                res,
                409,
                "Specialization cannot be deleted because related subjects, users, or notifications exist",
                { subjects, users, notifications }
            );
        }

        specialization.status = "inactive";
        specialization.updatedBy = req.user._id;
        await specialization.save();

        await auditLogModel.create({
            performedBy: req.user._id,
            action: "DELETE",
            module: "Specialization",
            targetId: specialization._id,
            targetName: specialization.name,
            remarks: "Specialization deleted successfully",
            ipAddress: req.ip,
            userAgent: req.headers["user-agent"]
        });

        return sendSuccess(res, 200, "Specialization deleted successfully");
    } catch (err) {
        console.error(err);
        return sendError(res, 500, "Internal server error");
    }
};



module.exports = {
    Specialization: createSpecialization,
    deleteSpecialization
}




