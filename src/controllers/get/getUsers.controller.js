const userModel = require("../../models/user.model");
const { sendError, sendSuccess } = require("../../utils/apiResponse");
const {
    buildPagination,
    buildPaginationMeta,
    buildSearchFilter,
    buildSort,
    normalizeObjectIdFilter,
} = require("../../utils/queryHelper");

const getUsers = async (req, res) => {
    try {

        const {
            role,
            school,
            schoolId,
            program,
            programId,
            specialization,
            specializationId,
            semesterId,
            academicYearId,
            sectionId,
            status,
        } = req.query;

        const filter = {};

        // Role Filter
        if (role) {
            filter.roles = role;
        }

        // School Filter
        if (school || schoolId) {
            filter.schoolId = normalizeObjectIdFilter(school || schoolId);
        }

        // Status Filter
        if (status) {
            filter.status = status;
        }

        // Academic Assignment Filters
        if (program || programId) {
            filter["academicAssignments.programId"] =
                normalizeObjectIdFilter(program || programId);
        }

        if (specialization || specializationId) {
            filter[
                "academicAssignments.specializationId"
            ] = normalizeObjectIdFilter(specialization || specializationId);
        }

        if (semesterId) {
            filter[
                "academicAssignments.semesterId"
            ] = normalizeObjectIdFilter(semesterId);
        }

        if (academicYearId) {
            filter[
                "academicAssignments.academicYearId"
            ] = normalizeObjectIdFilter(academicYearId);
        }

        if (sectionId) {
            filter[
                "academicAssignments.sectionId"
            ] = normalizeObjectIdFilter(sectionId);
        }

        Object.assign(filter, buildSearchFilter(req.query.search, [
            "firstName",
            "middleName",
            "lastName",
            "personalEmail",
            "universityAccount.universityEmail",
            "universityAccount.institutionId",
        ]));

        const { page, limit, skip } = buildPagination(req.query);
        const sort = buildSort(req.query, [
            "firstName",
            "lastName",
            "personalEmail",
            "status",
            "createdAt",
            "updatedAt",
            "lastLogin",
        ]);

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
                "academicAssignments.academicYearId",
                "name startDate endDate isCurrent"
            )
            .populate(
                "academicAssignments.sectionId",
                "name capacity status"
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
                ...sort
            })
            .skip(skip)
            .limit(limit);

        const total =
            await userModel.countDocuments(filter);
        const pagination = buildPaginationMeta({
            page,
            limit,
            total,
            count: users.length,
        });

        return sendSuccess(
            res,
            200,
            "Users fetched successfully",
            users,
            pagination
        );

    } catch (err) {

        console.error(err);

        return sendError(res, 500, "Internal Server Error");
    }
};

module.exports = {
    getUsers
};
