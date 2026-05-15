const router = require("express").Router();
const auth = require("../middleware/auth");
const Notification = require("../models/Notification");
const { createAuditLog } = require("../utils/activity");

router.get("/", auth, async (req, res) => {
  try {
    const notifications = await Notification.find({ user: req.user.id }).sort({ time: -1 }).limit(25);
    return res.json({
      notifications: notifications.map((notification) => ({
        id: notification._id,
        title: notification.title,
        message: notification.message,
        type: notification.type,
        read: notification.read,
        metadata: notification.metadata,
        time: notification.time,
      })),
    });
  } catch (error) {
    return res.status(500).json({ msg: "Unable to fetch notifications" });
  }
});

router.patch("/read-all", auth, async (req, res) => {
  try {
    await Notification.updateMany({ user: req.user.id, read: false }, { read: true });
    return res.json({ msg: "Notifications marked as read" });
  } catch (error) {
    return res.status(500).json({ msg: "Unable to update notifications" });
  }
});

// Called by the doctor's browser when a screenshot attempt is detected
router.post("/screenshot-attempt", auth, async (req, res) => {
  try {
    const { patientId, recordName, method } = req.body;
    if (!patientId) return res.status(400).json({ msg: "patientId is required" });

    const doctorName = req.user.name || "A doctor";
    const methodLabel = method === "printscreen" ? "pressed PrintScreen"
      : method === "screenshare"  ? "attempted screen sharing"
      : method === "keyboard"     ? "used a keyboard shortcut"
      : "attempted a screenshot";

    // Notify the patient
    await Notification.create({
      user:    patientId,
      title:   "⚠️ Screenshot attempt detected",
      message: `Dr. ${doctorName} ${methodLabel} while viewing your record${recordName ? ` "${recordName}"` : ""}. The content was hidden automatically.`,
      type:    "warning",
      metadata: {
        doctorId:   req.user.id,
        doctorName,
        patientId,
        recordName: recordName || "",
        method,
        time:       new Date().toISOString(),
      },
    });

    // Audit log
    await createAuditLog({
      user:     req.user.id,
      action:   `Screenshot attempt detected — Dr. ${doctorName} ${methodLabel}`,
      category: "threat",
      severity: "warning",
      details:  { patientId, recordName, method, doctorName },
    });

    return res.json({ ok: true });
  } catch (error) {
    return res.status(500).json({ msg: "Failed to log screenshot attempt" });
  }
});

module.exports = router;
