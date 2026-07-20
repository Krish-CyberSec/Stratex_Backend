const subjectModel = require("../../../models/subject.model");
const semesterModel = require("../../../models/semester.model");
const sectionModel = require("../../../models/section.model");
const { sendError, sendSuccess } = require("../../../utils/apiResponse");
const {
    buildPagination,
    buildPaginationMeta,
    buildSearchFilter,
    buildSort,
    normalizeObjectIdFilter,
} = require("../../../utils/queryHelper");

const getId = (value) => value?._id || value || null;

const getPrimaryAssignment = (user = {}) =>
    user.academicAssignments?.find((assignment) => assignment.isPrimary && assignment.status !== "inactive") ||
    user.academicAssignments?.find((assignment) => assignment.status !== "inactive") ||
    user.academicAssignments?.[0];

const getSubjects = async (req, res) => {
    try {

        const {
            schoolId,
            program,
            programId,
            specializationId,
            semester,
            semesterId,
            academicYearId,
            sectionId,
            facultyId,
            coordinatorId,
            status,
        } = req.query;

        const userRoles = req.authUser?.roles || req.user?.roles || [];
        const isStudent = userRoles.includes("student");
        const filter = {};

        if (isStudent) {
            const assignment = getPrimaryAssignment(req.authUser);
            const assignedProgramId = getId(assignment?.programId);
            const assignedSpecializationId = getId(assignment?.specializationId);
            const currentSemesterId = getId(assignment?.semesterId || req.authUser?.currentSemester);

            if (!assignedProgramId || !currentSemesterId) {
                return sendSuccess(
                    res,
                    200,
                    "Subjects fetched successfully",
                    [],
                    buildPaginationMeta({ page: 1, limit: Number(req.query.limit || 10), total: 0, count: 0 })
                );
            }

            const currentSemester = await semesterModel
                .findById(currentSemesterId)
                .select("semesterNumber")
                .lean();

            const allowedSemesters = await semesterModel
                .find({
                    programId: assignedProgramId,
                    ...(currentSemester?.semesterNumber ? { semesterNumber: { $lte: currentSemester.semesterNumber } } : {}),
                })
                .select("_id")
                .lean();

            filter.programId = assignedProgramId;
            filter.semesterId = { $in: allowedSemesters.map((item) => item._id) };

            filter.specializationId = assignedSpecializationId || null;
        }

        if (!isStudent && schoolId) {
            filter.schoolId = normalizeObjectIdFilter(schoolId);
        }

        if (!isStudent && (program || programId)) {
            filter.programId = normalizeObjectIdFilter(program || programId);
        }

        if (!isStudent && specializationId) {
            filter.$or = [
                { specializationId: null },
                { specializationId: normalizeObjectIdFilter(specializationId) }
            ];
        }

        if (!isStudent && (semester || semesterId)) {
            filter.semesterId = normalizeObjectIdFilter(semester || semesterId);
        }

        if ((academicYearId || sectionId) && !isStudent) {
            const sectionFilter = {
                ...(academicYearId ? { academicYearId: normalizeObjectIdFilter(academicYearId) } : {}),
                ...(sectionId ? { _id: normalizeObjectIdFilter(sectionId) } : {}),
            };
            const sections = await sectionModel
                .find(sectionFilter)
                .select("programId semesterId specializationId")
                .lean();
            const scopeKeys = new Set();
            const sectionSubjectScopes = sections
                .map((section) => ({
                    programId: section.programId,
                    semesterId: section.semesterId,
                    specializationId: section.specializationId || null,
                }))
                .filter((scope) => {
                    const key = `${scope.programId}:${scope.semesterId}:${scope.specializationId || ""}`;
                    if (scopeKeys.has(key)) return false;
                    scopeKeys.add(key);
                    return true;
                });

            filter.$and = filter.$and || [];
            filter.$and.push(
                sectionSubjectScopes.length
                    ? { $or: sectionSubjectScopes }
                    : { _id: { $in: [] } }
            );
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
                ...(filter.$and || []),
                { $or: filter.$or },
                searchFilter
            ];
            delete filter.$or;
        } else if (searchFilter.$or && filter.$and) {
            filter.$and.push(searchFilter);
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
