const router = require("express").Router();
const auth   = require("../middleware/auth");
const Access  = require("../models/Access");
const Message = require("../models/Message");
const User = require("../models/User");
const { translateToAllLanguages } = require("../utils/translator");

const SUPPORTED_LANGUAGES = ["english", "kannada", "hindi"];

function getViewerLanguage(role, preferredLanguage) {
  if (role === "doctor") return "english";
  return SUPPORTED_LANGUAGES.includes(preferredLanguage) ? preferredLanguage : "english";
}

function serialiseMessage(message, viewerLanguage) {
  return {
    id:               message._id,
    text:             message.text,
    originalText:     message.text,
    displayText:      message.translations?.[viewerLanguage] || message.text,
    displayLanguage:  viewerLanguage,
    englishText:      message.translations?.english || message.text,
    originalLanguage: message.originalLanguage,
    translations:     message.translations || {},
    senderRole:       message.senderRole,
    senderName:       message.sender?.name || "Unknown",
    senderId:         message.sender?._id,
    readBy:           message.readBy,
    createdAt:        message.createdAt,
  };
}

// Verify caller is part of this access and it is still active
async function resolveAccess(accessId, userId) {
  const access = await Access.findById(accessId);
  if (!access) return null;
  const isParty =
    access.patient.toString() === userId ||
    access.doctor.toString()  === userId;
  if (!isParty) return null;
  if (access.status !== "approved") return null;
  if (new Date(access.expiry) < new Date()) return null;
  return access;
}

// GET /api/messages/:accessId  — fetch all messages for this access thread
router.get("/:accessId", auth, async (req, res) => {
  try {
    const access = await resolveAccess(req.params.accessId, req.user.id);
    if (!access) return res.status(403).json({ msg: "Chat not available or access expired." });

    const messages = await Message.find({ access: req.params.accessId })
      .populate("sender", "name role")
      .sort({ createdAt: 1 });

    // Get current user's preferred language
    const currentUser = await User.findById(req.user.id);
    const userLanguage = getViewerLanguage(req.user.role, currentUser?.preferredLanguage);

    // Mark unread messages as read for this user
    await Message.updateMany(
      { access: req.params.accessId, readBy: { $ne: req.user.id } },
      { $addToSet: { readBy: req.user.id } },
    );

    return res.json({
      messages: messages.map((m) => serialiseMessage(m, userLanguage)),
      expiry: access.expiry,
      userLanguage,
    });
  } catch {
    return res.status(500).json({ msg: "Failed to fetch messages." });
  }
});

// POST /api/messages/:accessId  — send a message
router.post("/:accessId", auth, async (req, res) => {
  try {
    const { text, language } = req.body;
    if (!text?.trim()) return res.status(400).json({ msg: "Message text is required." });

    const access = await resolveAccess(req.params.accessId, req.user.id);
    if (!access) return res.status(403).json({ msg: "Chat not available or access expired." });

    const senderLanguage = req.user.role === "doctor"
      ? "english"
      : (SUPPORTED_LANGUAGES.includes(language) ? language : "");

    if (req.user.role === "patient" && !senderLanguage) {
      return res.status(400).json({ msg: "Please choose English, Kannada, or Hindi before sending." });
    }
    
    // Generate translations
    let translations = {};
    try {
      translations = await translateToAllLanguages(text.trim(), senderLanguage);
    } catch (err) {
      console.error("Translation failed:", err);
      // Set current language translation to the text itself
      translations[senderLanguage] = text.trim();
      translations.english = text.trim();
      translations.kannada = text.trim();
      translations.hindi = text.trim();
    }

    const message = await Message.create({
      access:     req.params.accessId,
      sender:     req.user.id,
      senderRole: req.user.role,
      text:       text.trim(),
      originalLanguage: senderLanguage,
      translations,
      readBy:     [req.user.id],
    });

    await message.populate("sender", "name role");

    return res.status(201).json({
      ...serialiseMessage(
        message,
        req.user.role === "doctor" ? "english" : senderLanguage,
      ),
    });
  } catch (err) {
    console.error("Message creation error:", err);
    return res.status(500).json({ msg: "Failed to send message." });
  }
});

// GET /api/messages/:accessId/unread-count
router.get("/:accessId/unread/count", auth, async (req, res) => {
  try {
    const access = await resolveAccess(req.params.accessId, req.user.id);
    if (!access) return res.json({ count: 0 });
    const count = await Message.countDocuments({
      access: req.params.accessId,
      readBy: { $ne: req.user.id },
    });
    return res.json({ count });
  } catch {
    return res.json({ count: 0 });
  }
});

module.exports = router;
