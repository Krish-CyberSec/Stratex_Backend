const crypto = require("node:crypto");
const auditLogModel = require("../models/auditlog.model");
const requestLogModel = require("../models/requestlog.model");
const {
  runWithAuditContext,
} = require("../services/audit/auditContext.service");

const ignoredRequestMethods = new Set(["OPTIONS", "HEAD"]);

const ignoredPathPatterns = [
  /\/favicon\.ico$/i,
  /\/health$/i,
  /\/ping$/i,
  /\/poll/i,
];

const shouldIgnoreRequest = (req, statusCode) => {
  const path = req.originalUrl.split("?")[0];

  return (
    ignoredRequestMethods.has(req.method) ||
    statusCode === 304 ||
    ignoredPathPatterns.some((pattern) => pattern.test(path))
  );
};

const getRoute = (req) => req.originalUrl.split("?")[0];

const getResponseSize = (res) => {
  const contentLength = res.getHeader("content-length");
  const parsed = Number(contentLength);

  return Number.isFinite(parsed) ? parsed : 0;
};

const auditRequest = (req, res, next) => {
  const startedAt = Date.now();
  const requestId = req.headers["x-request-id"] || crypto.randomUUID();
  const route = getRoute(req);

  req.requestId = requestId;
  res.setHeader("X-Request-Id", requestId);

  const context = {
    requestId,
    route,
    method: req.method,
    ipAddress: req.ip,
    userAgent: req.headers["user-agent"],
  };

  res.on("finish", async () => {
    const durationMs = Date.now() - startedAt;

    try {
      await auditLogModel.updateMany(
        {
          requestId,
          statusCode: { $exists: false },
        },
        {
          $set: {
            statusCode: res.statusCode,
          },
        }
      );

      if (shouldIgnoreRequest(req, res.statusCode) || res.statusCode < 500) {
        return;
      }

      await requestLogModel.create({
        requestId,
        method: req.method,
        route,
        statusCode: res.statusCode,
        durationMs,
        ip: req.ip,
        userAgent: req.headers["user-agent"],
        responseSize: getResponseSize(res),
      });
    } catch (err) {
      console.error("Request logging middleware error:", err.message);
    }
  });

  runWithAuditContext(context, next);
};

module.exports = auditRequest;
