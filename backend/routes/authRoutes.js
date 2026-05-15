const router = require("express").Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const auth = require("../middleware/auth");
const { getAdminUser } = require("./adminRoutes");
const { createAuditLog } = require("../utils/activity");
const {
  analyseSuccessfulLogin,
  normaliseLoginMeta,
  registerFailedLogin,
} = require("../utils/threatDetection");

function sanitiseUser(user) {
  return {
    id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    specialty: user.specialty,
    publicKey: user.publicKey || "",
    isVerified: user.isVerified,
    verifiedAt: user.verifiedAt,
    verifiedBy: user.verifiedBy,
    preferredLanguage: user.preferredLanguage || "english",
    createdAt: user.createdAt,
    lastLoginAt: user.lastLoginAt,
  };
}

router.post("/signup", async (req, res) => {
  try {
    const { name, email, password, role, specialty = "" } = req.body;

    if (!name || !email || !password || !role) {
      return res.status(400).json({ msg: "Name, email, password, and role are required" });
    }

    if (!["patient", "doctor"].includes(role)) {
      return res.status(400).json({ msg: "Invalid role selected" });
    }

    if (password.length < 8) {
      return res.status(400).json({ msg: "Password must be at least 8 characters long" });
    }

    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(409).json({ msg: "An account with this email already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await User.create({
      name,
      email,
      password: hashedPassword,
      role,
      specialty: role === "doctor" ? specialty : "",
      publicKey: req.body.publicKey || "",
      isVerified: role !== "doctor",
    });

    await createAuditLog({
      user: user._id,
      email: user.email,
      action: "Account created",
      category: "account",
      details: { role: user.role },
    });

    return res.status(201).json({ user: sanitiseUser(user) });
  } catch (error) {
    return res.status(500).json({ msg: "Signup failed" });
  }
});

router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ msg: "Email and password are required" });
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      await registerFailedLogin(email.toLowerCase(), null);
      return res.status(400).json({ msg: "Invalid email or password" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      await registerFailedLogin(user.email, user);
      return res.status(400).json({ msg: "Invalid email or password" });
    }

    const loginMeta = normaliseLoginMeta(req, req.body);
    await analyseSuccessfulLogin(user, loginMeta);

    user.lastLoginAt = new Date();
    user.lastLoginMeta = loginMeta;
    await user.save();

    await createAuditLog({
      user: user._id,
      email: user.email,
      action: "Successful login",
      category: "login",
      details: loginMeta,
    });

    const token = jwt.sign(
      { id: user._id.toString(), role: user.role, name: user.name },
      process.env.JWT_SECRET,
      { expiresIn: "7d" },
    );

    return res.json({ token, user: sanitiseUser(user) });
  } catch (error) {
    return res.status(500).json({ msg: "Login failed" });
  }
});

router.patch("/me/public-key", auth, async (req, res) => {
  try {
    const { publicKey } = req.body;
    if (!publicKey) return res.status(400).json({ msg: "publicKey is required" });
    await User.findByIdAndUpdate(req.user.id, { publicKey });
    return res.json({ ok: true });
  } catch {
    return res.status(500).json({ msg: "Failed to update public key" });
  }
});

router.get("/me", auth, async (req, res) => {
  try {
    if (req.user.role === "admin") {
      return res.json({ user: getAdminUser() });
    }

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ msg: "User not found" });
    }

    return res.json({ user: sanitiseUser(user) });
  } catch (error) {
    return res.status(500).json({ msg: "Unable to fetch user" });
  }
});

// PUT /auth/language — update user's preferred language
router.put("/language", auth, async (req, res) => {
  try {
    const { language } = req.body;
    if (!language) {
      return res.status(400).json({ msg: "Language is required" });
    }

    if (!["english", "kannada", "hindi"].includes(language)) {
      return res.status(400).json({ msg: "Invalid language. Must be english, kannada, or hindi" });
    }

    const user = await User.findByIdAndUpdate(
      req.user.id,
      { preferredLanguage: language },
      { new: true }
    );

    if (!user) {
      return res.status(404).json({ msg: "User not found" });
    }

    return res.json({
      msg: "Language preference updated",
      user: sanitiseUser(user),
    });
  } catch (error) {
    console.error("Language update error:", error);
    return res.status(500).json({ msg: "Failed to update language preference" });
  }
});

module.exports = router;
