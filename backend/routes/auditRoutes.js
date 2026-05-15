const router = require("express").Router();
const auth = require("../middleware/auth");
const Audit = require("../models/Audit");

router.get("/", auth, async (req, res) => {
  try {
    const filter = req.user.role === "patient" ? { user: req.user.id } : { $or: [{ user: req.user.id }, { "details.doctorId": req.user.id }] };
    const logs = await Audit.find(filter).sort({ time: -1 }).limit(100);

    return res.json({
      logs: logs.map((log) => ({
        id: log._id,
        action: log.action,
        category: log.category,
        severity: log.severity,
        details: log.details,
        email: log.email,
        time: log.time,
      })),
    });
  } catch (error) {
    return res.status(500).json({ msg: "Error fetching logs" });
  }
});

module.exports = router;
