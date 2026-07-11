const subjectModel = require("../../models/subject.model");
const auditLogModel = require("../../models/auditlog.model");

const updateSubject = async (req, res) => {
    try {

        const { subjectId } = req.params;

        const {
            code,
            name,
            description,
            schoolId,
            programId,
            specializationId,
            semesterId,
            credits,
            status
        } = req.body;

        const allowedRoles = [
            "superAdmin",
            "schoolAdmin"
        ];

        // Authorization
        if (
            !req.user.roles.some(role =>
                allowedRoles.includes(role)
            )
        ) {

            await auditLogModel.create({
                performedBy: req.user?._id,
                action: "UNAUTHORIZED_UPDATE_ATTEMPT",
                module: "Subject",
                remarks: "Unauthorized subject update attempt",
                ipAddress: req.ip,
                userAgent: req.headers["user-agent"]
            });

            return res.status(403).json({
                message: "Unauthorized"
            });
        }

        const subject =
            await subjectModel.findById(subjectId);

        if (!subject) {
            return res.status(404).json({
                message: "Subject not found"
            });
        }

        const isSuperAdmin =
            req.user.roles.includes("superAdmin");

        const restrictedFields = [
            "code",
            "schoolId",
            "programId",
            "specializationId",
            "semesterId"
        ];

        const hasRestrictedUpdate =
            restrictedFields.some(field =>
                Object.prototype.hasOwnProperty.call(req.body, field)
            );

        if (hasRestrictedUpdate && !isSuperAdmin) {
            return res.status(403).json({
                message:
                    "Only super admin can update subject academic context"
            });
        }

        // Validation

        if (
            credits !== undefined &&
            (
                isNaN(credits) ||
                Number(credits) < 0
            )
        ) {
            return res.status(400).json({
                message:
                    "Credits must be a positive number"
            });
        }

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

        // Update only allowed fields

        if (isSuperAdmin && code) {
            subject.code = code.trim().toUpperCase();
        }

        if (isSuperAdmin && schoolId) {
            subject.schoolId = schoolId;
        }

        if (isSuperAdmin && programId) {
            subject.programId = programId;
        }

        if (isSuperAdmin && semesterId) {
            subject.semesterId = semesterId;
        }

        if (
            isSuperAdmin &&
            Object.prototype.hasOwnProperty.call(req.body, "specializationId")
        ) {
            subject.specializationId =
                specializationId || undefined;
        }

        if (name) {
            subject.name = name.trim();
        }

        if (description !== undefined) {
            subject.description =
                description?.trim() || "";
        }

        if (credits !== undefined) {
            subject.credits =
                Number(credits);
        }

        if (status) {
            subject.status = status;
        }

        subject.updatedBy =
            req.user._id;

        await subject.save();

        await auditLogModel.create({
            performedBy: req.user._id,
            action: "UPDATE",
            module: "Subject",
            targetId: subject._id,
            targetName: subject.name,
            remarks:
                "Subject updated successfully",
            ipAddress: req.ip,
            userAgent: req.headers["user-agent"]
        });

        return res.status(200).json({
            message:
                "Subject updated successfully",
            subject
        });

    } catch (err) {

        console.error(err);

        try {

            await auditLogModel.create({
                performedBy: req.user?._id,
                action: "SUBJECT_UPDATE_FAILED",
                module: "Subject",
                targetId: req.params?.subjectId,
                remarks: err.message,
                ipAddress: req.ip,
                userAgent: req.headers["user-agent"]
            });

        } catch (auditErr) {
            console.error(auditErr);
        }

        if (err.code === 11000) {
            return res.status(409).json({
                message:
                    "Subject already exists for this academic context"
            });
        }

        return res.status(500).json({
            message: "Internal Server Error"
        });
    }
};

module.exports = {
    updateSubject
};
