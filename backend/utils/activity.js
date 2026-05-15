const Audit = require("../models/Audit");
const Notification = require("../models/Notification");

async function createAuditLog({
  user = null,
  email = "",
  action,
  category = "general",
  severity = "info",
  details = {},
}) {
  return Audit.create({
    user,
    email,
    action,
    category,
    severity,
    details,
  });
}

async function createNotification({
  user,
  title,
  message,
  type = "info",
  metadata = {},
}) {
  return Notification.create({
    user,
    title,
    message,
    type,
    metadata,
  });
}

module.exports = {
  createAuditLog,
  createNotification,
};
