const userModel = require("../../models/user.model");

const getUserById = async (req, res) => {
    try {

        const { userId } = req.params;

        const user = await userModel
            .findById(userId)
            .select(
                "-password -setupToken -setupTokenExpiry"
            )
            .populate(
                "schoolId",
                "name slug"
            )
            .populate(
                "academicAssignments.programId",
                "name degreeType"
            )
            .populate(
                "academicAssignments.specializationId",
                "name"
            )
            .populate(
                "academicAssignments.semesterId",
                "semesterNumber name"
            )
            .populate(
                "academicAssignments.academicYearId",
                "name startDate endDate isCurrent"
            )
            .populate(
                "academicAssignments.sectionId",
                "name capacity status"
            )
            .populate(
                "academicAssignments.assignedSubjects",
                "code name"
            )
            .populate(
                "teachingAssignments.academicYearId",
                "name startDate endDate isCurrent"
            )
            .populate(
                "teachingAssignments.sectionId",
                "name capacity status"
            )
            .populate(
                "teachingAssignments.subjectId",
                "code name"
            )
            .populate(
                "createdBy",
                "firstName lastName"
            )
            .populate(
                "updatedBy",
                "firstName lastName"
            );

        if (!user) {
            return res.status(404).json({
                message: "User not found"
            });
        }

        return res.status(200).json({
            user
        });

    } catch (err) {

        console.error(err);

        return res.status(500).json({
            message: "Internal Server Error"
        });
    }
};

module.exports = {
    getUserById
};
