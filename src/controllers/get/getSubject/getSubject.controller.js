const subjectModel = require("../../../models/subject.model");
const { sendError, sendSuccess } = require("../../../utils/apiResponse");
const {
    buildPagination,
    buildPaginationMeta,
    buildSearchFilter,
    buildSort,
    normalizeObjectIdFilter,
} = require("../../../utils/queryHelper");

const getSubjects = async (req, res) => {
    try {

        const {
            schoolId,
            program,
            programId,
            specializationId,
            semester,
            semesterId,
            facultyId,
            coordinatorId,
            status,
        } = req.query;

        const filter = {};

        if (schoolId) {
            filter.schoolId = normalizeObjectIdFilter(schoolId);
        }

        if (program || programId) {
            filter.programId = normalizeObjectIdFilter(program || programId);
        }

        if (specializationId) {
            filter.$or = [
                { specializationId: null },
                { specializationId: normalizeObjectIdFilter(specializationId) }
            ];
        }

        if (semester || semesterId) {
            filter.semesterId = normalizeObjectIdFilter(semester || semesterId);
        }

        if (facultyId) {
            filter.facultyIds = normalizeObjectIdFilter(facultyId);
        }

        if (coordinatorId) {
            filter.coordinatorId = normalizeObjectIdFilter(coordinatorId);
        }

        if (status) {
            filter.status = status || "active";
        }

        const searchFilter = buildSearchFilter(req.query.search, [
            "code",
            "name",
            "description",
        ]);

        if (filter.$or && searchFilter.$or) {
            filter.$and = [
                { $or: filter.$or },
                searchFilter
            ];
            delete filter.$or;
        } else {
            Object.assign(filter, searchFilter);
        }

        const { page, limit, skip } = buildPagination(req.query);
        const sort = buildSort(req.query, [
            "code",
            "name",
            "credits",
            "status",
            "createdAt",
            "updatedAt",
        ]);

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
            .sort(sort)
            .skip(skip)
            .limit(limit);

        const total =
            await subjectModel.countDocuments(filter);
        const pagination = buildPaginationMeta({
            page,
            limit,
            total,
            count: subjects.length,
        });

        return sendSuccess(
            res,
            200,
            "Subjects fetched successfully",
            subjects,
            pagination
        );

    } catch (err) {

        console.error(err);

        return sendError(res, 500, "Internal Server Error");
    }
};

module.exports = {
    getSubjects
};
