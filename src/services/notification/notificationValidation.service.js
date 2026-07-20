const mongoose = require("mongoose");

const VALID_ROLES = [
  "superAdmin",
  "schoolAdmin",
  "faculty",
  "coordinator",
  "student",
  "examCell",
];

const VALID_TYPES = [
  "system",
  "notice",
  "event",
  "user",
  "program",
  "subject",
  "attendance",
  "exam",
  "result",
  "placement",
  "fee",
  "library",
];

const VALID_PRIORITIES = ["low", "normal", "high", "urgent"];
const VALID_REFERENCE_MODELS = [
  "User",
  "School",
  "Program",
  "Specialization",
  "Semester",
  "AcademicYear",
  "Section",
  "Subject",
  "Notice",
  "Event",
  "Attendance",
  "Exam",
  "Result",
];

const objectIdAudienceFields = [
  "userIds",
  "schoolIds",
  "programIds",
  "specializationIds",
  "semesterIds",
  "academicYearIds",
  "sectionIds",
  "excludeUserIds",
];

const toArray = (value) => {
  if (value === undefined || value === null || value === "") {
    return [];
  }

  return Array.isArray(value) ? value : [value];
};

const uniqueStrings = (values) => [...new Set(toArray(values).map(String))];

const validateObjectIds = (field, values, errors) => {
  uniqueStrings(values).forEach((id) => {
    if (!mongoose.isValidObjectId(id)) {
      errors.push(`${field} contains invalid ObjectId: ${id}`);
    }
  });
};

const normalizeAudience = (audience = {}) => {
  const normalized = {
    allUsers: audience.allUsers === true,
    includeUsersWithoutSpecialization:
      audience.includeUsersWithoutSpecialization === true,
  };

  objectIdAudienceFields.forEach((field) => {
    normalized[field] = uniqueStrings(audience[field]);
  });

  normalized.roles = uniqueStrings(audience.roles);
  normalized.excludeRoles = uniqueStrings(audience.excludeRoles);

  return normalized;
};

const validateAudience = (audience) => {
  const errors = [];
  const normalized = normalizeAudience(audience);

  objectIdAudienceFields.forEach((field) => {
    validateObjectIds(field, normalized[field], errors);
  });

  normalized.roles.forEach((role) => {
    if (!VALID_ROLES.includes(role)) {
      errors.push(`roles contains invalid role: ${role}`);
    }
  });

  normalized.excludeRoles.forEach((role) => {
    if (!VALID_ROLES.includes(role)) {
      errors.push(`excludeRoles contains invalid role: ${role}`);
    }
  });

  const hasAudience =
    normalized.allUsers ||
    normalized.userIds.length ||
    normalized.roles.length ||
    normalized.schoolIds.length ||
    normalized.programIds.length ||
    normalized.specializationIds.length ||
    normalized.semesterIds.length ||
    normalized.academicYearIds.length ||
    normalized.sectionIds.length;

  if (!hasAudience) {
    errors.push("Audience must target at least one user group");
  }

  return { errors, audience: normalized };
};

const validateCreateNotification = (body = {}) => {
  const errors = [];

  if (!body.title || String(body.title).trim().length < 2) {
    errors.push("title is required and must be at least 2 characters");
  }

  if (body.title && String(body.title).length > 200) {
    errors.push("title must not exceed 200 characters");
  }

  if (!body.message || String(body.message).trim().length < 2) {
    errors.push("message is required and must be at least 2 characters");
  }

  if (body.message && String(body.message).length > 5000) {
    errors.push("message must not exceed 5000 characters");
  }

  if (!VALID_TYPES.includes(body.type)) {
    errors.push(`type must be one of: ${VALID_TYPES.join(", ")}`);
  }

  if (body.priority && !VALID_PRIORITIES.includes(body.priority)) {
    errors.push(`priority must be one of: ${VALID_PRIORITIES.join(", ")}`);
  }

  if (body.reference?.model && !VALID_REFERENCE_MODELS.includes(body.reference.model)) {
    errors.push(`reference.model must be one of: ${VALID_REFERENCE_MODELS.join(", ")}`);
  }

  if (body.reference?.id && !mongoose.isValidObjectId(body.reference.id)) {
    errors.push("reference.id must be a valid ObjectId");
  }

  if (body.expiresAt) {
    const expiresAt = new Date(body.expiresAt);
    if (Number.isNaN(expiresAt.getTime())) {
      errors.push("expiresAt must be a valid date");
    }
  }

  const audienceValidation = validateAudience(body.audience);

  return {
    errors: [...errors, ...audienceValidation.errors],
    audience: audienceValidation.audience,
  };
};

const validateNotificationIds = (ids) => {
  const notificationIds = uniqueStrings(ids);
  const errors = [];

  if (!notificationIds.length) {
    errors.push("notificationIds must contain at least one notification id");
  }

  validateObjectIds("notificationIds", notificationIds, errors);

  return { errors, notificationIds };
};

module.exports = {
  VALID_PRIORITIES,
  VALID_ROLES,
  VALID_TYPES,
  normalizeAudience,
  validateAudience,
  validateCreateNotification,
  validateNotificationIds,
};
