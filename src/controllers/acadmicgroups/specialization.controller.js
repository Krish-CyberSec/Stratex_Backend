const auditLogModel = require("../../models/auditlog.model");
const specializationModel = require("../../models/specelization.model");
const programModel = require("../../models/program.model");


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

        const mongoose = require("mongoose");

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
        })

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




module.exports = { Specialization: createSpecialization }




