const subjectModel = require("../../../models/subject.model");

const getSubjects = async (req, res) => {
    try {

        const {
            schoolId,
            programId,
            specializationId,
            semesterId,
            facultyId,
            coordinatorId,
            status
        } = req.query;

        const filter = {};

        if (schoolId) {
            filter.schoolId = schoolId;
        }

        if (programId) {
            filter.programId = programId;
        }

        if (specializationId) {
            filter.specializationId = specializationId;
        }

        if (semesterId) {
            filter.semesterId = semesterId;
        }

        if (facultyId) {
            filter.facultyIds = facultyId;
        }

        if (coordinatorId) {
            filter.coordinatorId = coordinatorId;
        }

        if (status) {
            filter.status = status || "active";
        }

        const subjects = await subjectModel
            .find(filter)
            .populate("schoolId", "name")
            .populate("programId", "name")
            .populate("specializationId", "name")
            .populate("semesterId", "semesterNumber name")
            .populate(
                "facultyIds",
                "firstName lastName universityAccount"
            )
            .populate(
                "coordinatorId",
                "firstName lastName universityAccount"
            )
            .populate(
                "createdBy",
                "firstName lastName"
            )
            .populate(
                "updatedBy",
                "firstName lastName"
            )
            .sort({ createdAt: -1 })
            .skip((pageNum - 1) * limitNum)
            .limit(limitNum);

        const total =
            await subjectModel.countDocuments(filter);

        return res.status(200).json({
            total,
            page: Number(page),
            limit: Number(limit),
            count: subjects.length,
            subjects
        });

    } catch (err) {

        console.error(err);

        return res.status(500).json({
            message: "Internal Server Error"
        });
    }
};

module.exports = {
    getSubjects
};