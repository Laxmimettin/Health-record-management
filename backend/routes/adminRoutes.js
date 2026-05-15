const router = require("express").Router();
const jwt = require("jsonwebtoken");
const auth = require("../middleware/auth");
const requireRole = require("../middleware/requireRole");
const User = require("../models/User");
const { createAuditLog, createNotification } = require("../utils/activity");

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "admin@securehealthvault.com";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "Admin@123";
const ADMIN_NAME = process.env.ADMIN_NAME || "System Admin";

function getAdminUser() {
  return {
    id: "fixed-admin",
    name: ADMIN_NAME,
    email: ADMIN_EMAIL,
    role: "admin",
    isVerified: true,
  };
}

function serialiseDoctor(doctor) {
  return {
    id: doctor._id,
    name: doctor.name,
    email: doctor.email,
    specialty: doctor.specialty,
    isVerified: doctor.isVerified,
    verifiedAt: doctor.verifiedAt,
    verifiedBy: doctor.verifiedBy,
    createdAt: doctor.createdAt,
    lastLoginAt: doctor.lastLoginAt,
  };
}

router.post("/login", async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ msg: "Email and password are required" });
  }

  if (email.toLowerCase() !== ADMIN_EMAIL.toLowerCase() || password !== ADMIN_PASSWORD) {
    return res.status(400).json({ msg: "Invalid admin credentials" });
  }

  const user = getAdminUser();
  const token = jwt.sign(
    { id: user.id, role: user.role, name: user.name, email: user.email },
    process.env.JWT_SECRET,
    { expiresIn: "7d" },
  );

  return res.json({ token, user });
});

router.get("/doctors", auth, requireRole("admin"), async (req, res) => {
  try {
    const doctors = await User.find({ role: "doctor" }).sort({ isVerified: 1, createdAt: -1 });
    return res.json({ doctors: doctors.map(serialiseDoctor) });
  } catch (error) {
    return res.status(500).json({ msg: "Unable to fetch doctors" });
  }
});

router.patch("/doctors/:id/verify", auth, requireRole("admin"), async (req, res) => {
  try {
    const doctor = await User.findOne({ _id: req.params.id, role: "doctor" });

    if (!doctor) {
      return res.status(404).json({ msg: "Doctor not found" });
    }

    doctor.isVerified = true;
    doctor.verifiedAt = new Date();
    doctor.verifiedBy = req.user.email || ADMIN_EMAIL;
    await doctor.save();

    await createAuditLog({
      user: doctor._id,
      email: doctor.email,
      action: "Doctor verified by admin",
      category: "account",
      details: { verifiedBy: doctor.verifiedBy },
    });

    await createNotification({
      user: doctor._id,
      title: "Doctor account verified",
      message: "Your doctor account has been verified. You can now open the doctor dashboard.",
      type: "success",
      metadata: { verifiedBy: doctor.verifiedBy },
    });

    return res.json({ doctor: serialiseDoctor(doctor) });
  } catch (error) {
    return res.status(500).json({ msg: "Unable to verify doctor" });
  }
});

module.exports = { router, getAdminUser };
