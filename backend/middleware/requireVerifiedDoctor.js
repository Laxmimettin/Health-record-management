const User = require("../models/User");

module.exports = async function requireVerifiedDoctor(req, res, next) {
  if (!req.user || req.user.role !== "doctor") {
    return next();
  }

  try {
    const doctor = await User.findOne({ _id: req.user.id, role: "doctor" }).select("isVerified");

    if (!doctor) {
      return res.status(404).json({ msg: "Doctor account not found" });
    }

    if (!doctor.isVerified) {
      return res.status(403).json({ msg: "Doctor account is pending admin verification" });
    }

    return next();
  } catch (error) {
    return res.status(500).json({ msg: "Unable to verify doctor account" });
  }
};
