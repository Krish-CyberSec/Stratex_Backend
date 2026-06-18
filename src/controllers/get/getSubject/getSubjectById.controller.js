const subjectModel = require("../../../models/subject.model");


const getSubjectById = async (req, res) => {
    try {

        const { subjectId } = req.params;

        const subject = await subjectModel
            .findById(subjectId)
            .populate("schoolId", "name slug")
            .populate("programId", "name degreeType")
            .populate("specializationId", "name")
            .populate(
                "semesterId",
                "semesterNumber name"
            )
            .populate(
                "facultyIds",
                "firstName lastName universityAccount schoolId"
            )
            .populate(
                "coordinatorId",
                "firstName lastName universityAccount schoolId"
            )
            .populate(
                "createdBy",
                "firstName lastName"
            )
            .populate(
                "updatedBy",
                "firstName lastName"
            );

        if (!subject) {
            return res.status(404).json({
                message: "Subject not found"
            });
        }

        return res.status(200).json({
            subject
        });

    } catch (err) {

        console.error(err);

        return res.status(500).json({
            message: "Internal Server Error"
        });
    }
};

module.exports = {
    getSubjectById
};