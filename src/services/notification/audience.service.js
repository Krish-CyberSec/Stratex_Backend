const userModel = require("../../models/user.model");

const hasValues = (values) => Array.isArray(values) && values.length > 0;

const buildAudienceQuery = (audience) => {
  const query = {
    status: "active",
  };
  const assignmentMatch = {};

  if (!audience.allUsers && hasValues(audience.userIds)) {
    query._id = { $in: audience.userIds };
  }

  if (hasValues(audience.roles)) {
    query.roles = { $in: audience.roles };
  }

  if (hasValues(audience.schoolIds)) {
    query.schoolId = { $in: audience.schoolIds };
  }

  if (hasValues(audience.programIds)) {
    assignmentMatch.programId = { $in: audience.programIds };
  }

  if (hasValues(audience.specializationIds)) {
    assignmentMatch.specializationId = { $in: audience.specializationIds };

    if (audience.includeUsersWithoutSpecialization) {
      assignmentMatch.$or = [
        { specializationId: { $in: audience.specializationIds } },
        { specializationId: null },
        { specializationId: { $exists: false } },
      ];
      delete assignmentMatch.specializationId;
    }
  }

  if (hasValues(audience.semesterIds)) {
    assignmentMatch.semesterId = { $in: audience.semesterIds };
  }

  if (hasValues(audience.academicYearIds)) {
    assignmentMatch.academicYearId = { $in: audience.academicYearIds };
  }

  if (hasValues(audience.sectionIds)) {
    assignmentMatch.sectionId = { $in: audience.sectionIds };
  }

  if (Object.keys(assignmentMatch).length) {
    query.academicAssignments = {
      $elemMatch: assignmentMatch,
    };
  }

  if (
    hasValues(audience.semesterIds) &&
    !hasValues(audience.programIds) &&
    !hasValues(audience.specializationIds) &&
    !hasValues(audience.academicYearIds) &&
    !hasValues(audience.sectionIds)
  ) {
    delete query.academicAssignments;
    query.$and = query.$and || [];
    query.$and.push({
      $or: [
        { currentSemester: { $in: audience.semesterIds } },
        { academicAssignments: { $elemMatch: { semesterId: { $in: audience.semesterIds } } } },
      ],
    });
  }

  if (hasValues(audience.excludeUserIds)) {
    const existingIdFilter = query._id || {};
    query._id = {
      ...existingIdFilter,
      $nin: audience.excludeUserIds,
    };
  }

  if (hasValues(audience.excludeRoles)) {
    query.roles = {
      ...(query.roles || {}),
      $nin: audience.excludeRoles,
    };
  }

  return query;
};

const resolveAudience = async (audience, session = null) => {
  const query = buildAudienceQuery(audience);
  const request = userModel.find(query).select("_id").lean();

  if (session) {
    request.session(session);
  }

  const users = await request;

  return {
    users,
    count: users.length,
  };
};

module.exports = {
  buildAudienceQuery,
  resolveAudience,
};
