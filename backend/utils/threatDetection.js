const Audit = require("../models/Audit");
const { createAuditLog, createNotification } = require("./activity");

function normaliseLoginMeta(req, body = {}) {
  return {
    device: body.device || req.header("x-device-name") || "Unknown device",
    location: body.location || req.header("x-location") || "Unknown location",
    ip:
      req.header("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.socket?.remoteAddress ||
      "",
    time: new Date(),
  };
}

async function registerFailedLogin(email, user) {
  await createAuditLog({
    user: user?._id || null,
    email,
    action: "Failed login attempt",
    category: "login",
    severity: "warning",
    details: { email },
  });

  const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
  const recentFailures = await Audit.countDocuments({
    email,
    category: "login",
    action: "Failed login attempt",
    time: { $gte: tenMinutesAgo },
  });

  if (user && recentFailures >= 3) {
    await createNotification({
      user: user._id,
      title: "Suspicious login activity",
      message: `We detected ${recentFailures} failed login attempts on your account in the last 10 minutes.`,
      type: "warning",
      metadata: { recentFailures },
    });

    await createAuditLog({
      user: user._id,
      email: user.email,
      action: "Suspicious activity detected: multiple login attempts",
      category: "threat",
      severity: "critical",
      details: { recentFailures },
    });
  }
}

async function analyseSuccessfulLogin(user, loginMeta) {
  const alerts = [];

  if (user.lastLoginMeta?.device && user.lastLoginMeta.device !== loginMeta.device) {
    alerts.push("new device");
  }

  if (user.lastLoginMeta?.location && user.lastLoginMeta.location !== loginMeta.location) {
    alerts.push("new location");
  }

  if (alerts.length > 0) {
    await createNotification({
      user: user._id,
      title: "Security warning",
      message: `Login detected from ${alerts.join(" and ")}.`,
      type: "warning",
      metadata: { alerts, loginMeta },
    });

    await createAuditLog({
      user: user._id,
      email: user.email,
      action: `Suspicious activity detected: login from ${alerts.join(" and ")}`,
      category: "threat",
      severity: "warning",
      details: loginMeta,
    });
  }
}

module.exports = {
  analyseSuccessfulLogin,
  normaliseLoginMeta,
  registerFailedLogin,
};
