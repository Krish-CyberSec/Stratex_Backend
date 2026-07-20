const subjectModel = require("../../models/subject.model");
const userModel = require("../../models/user.model");
const auditLogModel = require("../../models/auditlog.model");
const {
    validateTeachingSection,
} = require("../../services/section/sectionAssignment.service");
const {
    upsertFacultyAssignment,
} = require("../../services/facultyAssignment/facultyAssignment.service");

const assignCoordinatorToSubject = async (req, res) => {
    try {

        const { subjectId } = req.params;
        const { academicYearId, coordinatorId, sectionId } = req.body;

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
                module: "Subject",
                remarks: "Unauthorized coordinator assignment attempt",
                ipAddress: req.ip,
                userAgent: req.headers["user-agent"]
            });

            return res.status(403).json({
                message: "Unauthorized"
            });
        }

        if (!coordinatorId) {
            return res.status(400).json({
                message: "Coordinator ID is required"
            });
        }

        // Subject Validation
        const subject = await subjectModel.findById(subjectId);

        if (!subject) {
            return res.status(404).json({
                message: "Subject not found"
            });
        }

        await validateTeachingSection({
            academicYearId,
            sectionId,
            subject
        });

        // Coordinator Validation
        const coordinator =
            await userModel.findById(coordinatorId);

        if (!coordinator) {
            return res.status(404).json({
                message: "Coordinator not found"
            });
        }

        if (
            !coordinator.roles.includes("coordinator")
        ) {
            return res.status(400).json({
                message:
                    "User does not have coordinator role"
            });
        }

        // Coordinator must also be faculty
        if (
            !coordinator.roles.includes("faculty")
        ) {
            return res.status(400).json({
                message:
                    "Coordinator must also have faculty role"
            });
        }

        // Same School Validation
        if (
            coordinator.schoolId.toString() !==
            subject.schoolId.toString()
        ) {
            return res.status(400).json({
                message:
                    "Coordinator belongs to another school"
            });
        }

        // Must already be assigned as faculty
        const isFacultyAssigned =
            subject.facultyIds.some(
                facultyId =>
                    facultyId.toString() ===
                    coordinatorId.toString()
            );

        if (!isFacultyAssigned) {
            return res.status(400).json({
                message:
                    "Coordinator must first be assigned as faculty to this subject"
            });
        }

        if (
            subject.coordinatorId &&
            subject.coordinatorId.toString() ===
            coordinatorId.toString()
        ) {
            return res.status(400).json({
                message:
                    "User is already the coordinator of this subject"
            });
        }

        // Assign Coordinator
        subject.coordinatorId = coordinatorId;
        subject.updatedBy = req.user._id;

        await subject.save();

        if (academicYearId && sectionId) {
            const alreadyTeaching = coordinator.teachingAssignments?.some(
                item =>
                    item.subjectId?.toString() === subject._id.toString() &&
                    item.academicYearId?.toString() === academicYearId.toString() &&
                    item.sectionId?.toString() === sectionId.toString()
            );

            if (!alreadyTeaching) {
                coordinator.teachingAssignments = coordinator.teachingAssignments || [];
                coordinator.teachingAssignments.push({
                    academicYearId,
                    sectionId,
                    subjectId: subject._id,
                    assignedBy: req.user._id,
                    status: "active",
                });
                await coordinator.save();
            }

            await upsertFacultyAssignment({
                facultyId: coordinator._id,
                academicYearId,
                sectionId,
                subjectId: subject._id,
                role: "coordinator",
                actorId: req.user._id,
            });
        }

        await auditLogModel.create({
            performedBy: req.user._id,
            action: academicYearId && sectionId ? "SECTION_ASSIGNED" : "UPDATE",
            module: "Subject",
            targetId: subject._id,
            targetName: subject.name,
            remarks: `Coordinator assigned successfully`,
            ipAddress: req.ip,
            userAgent: req.headers["user-agent"]
        });

        return res.status(200).json({
            message:
                "Coordinator assigned successfully",
            subject
        });

    } catch (err) {

        console.error(err);

        try {

            await auditLogModel.create({
                performedBy: req.user?._id,
                action: "COORDINATOR_ASSIGNMENT_FAILED",
                module: "Subject",
                targetId: req.params?.subjectId,
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
    assignCoordinatorToSubject
};
