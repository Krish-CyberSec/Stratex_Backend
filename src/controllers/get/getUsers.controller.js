const userModel = require("../../models/user.model");

const getUsers = async (req, res) => {
    try {

        const {
            role,
            schoolId,
            programId,
            specializationId,
            semesterId,
            status,
            page = 1,
            limit = 10
        } = req.query;

        const filter = {};

        // Role Filter
        if (role) {
            filter.roles = role;
        }

        // School Filter
        if (schoolId) {
            filter.schoolId = schoolId;
        }

        // Status Filter
        if (status) {
            filter.status = status;
        }

        // Academic Assignment Filters
        if (programId) {
            filter["academicAssignments.programId"] =
                programId;
        }

        if (specializationId) {
            filter[
                "academicAssignments.specializationId"
            ] = specializationId;
        }

        if (semesterId) {
            filter[
                "academicAssignments.semesterId"
            ] = semesterId;
        }

        const pageNum = Number(page);
        const limitNum = Number(limit);

        const users = await userModel
            .find(filter)
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
                "semesterNumber"
            )
            .populate(
                "createdBy",
                "firstName lastName"
            )
            .populate(
                "updatedBy",
                "firstName lastName"
            )
            .sort({
                createdAt: -1
            })
            .skip((pageNum - 1) * limitNum)
            .limit(limitNum);

        const total =
            await userModel.countDocuments(filter);

        return res.status(200).json({
            total,
            page: pageNum,
            limit: limitNum,
            count: users.length,
            users
        });

    } catch (err) {

        console.error(err);

        return res.status(500).json({
            message: "Internal Server Error"
        });
    }
};

module.exports = {
    getUsers
};