const { AsyncLocalStorage } = require("node:async_hooks");

const auditContext = new AsyncLocalStorage();

const runWithAuditContext = (context, callback) => {
  auditContext.run(context, callback);
};

const getAuditContext = () => auditContext.getStore();

module.exports = {
  getAuditContext,
  runWithAuditContext,
};
