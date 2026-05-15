const path = require("path");
const fs = require("fs/promises");
const router = require("express").Router();
const multer = require("multer");
const auth = require("../middleware/auth");
const requireRole = require("../middleware/requireRole");
const requireVerifiedDoctor = require("../middleware/requireVerifiedDoctor");
const Record = require("../models/Record");
const Access = require("../models/Access");
const Appointment = require("../models/Appointment");
const User = require("../models/User");
const { createAuditLog, createNotification } = require("../utils/activity");
const { encryptBuffer, decryptBuffer } = require("../utils/recordCrypto");
const UPLOAD_DIR = path.join(__dirname, "..", "uploads");

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOAD_DIR);
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname.replace(/\s+/g, "-")}`);
  },
});

const allowedMimeTypes = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/jpg",
  "image/webp",
];

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!allowedMimeTypes.includes(file.mimetype)) {
      cb(new Error("Only PDF and image files are allowed"));
      return;
    }

    cb(null, true);
  },
});

function serialiseRecord(record) {
  return {
    id: record._id,
    patient: record.patient,
    doctor: record.doctor && typeof record.doctor === "object"
      ? { id: record.doctor._id, name: record.doctor.name, email: record.doctor.email, specialty: record.doctor.specialty }
      : record.doctor,
    type: record.type,
    doctorName: record.doctorName,
    recordDate: record.recordDate,
    fileName: record.fileName,
    fileUrl: record.fileUrl,
    mimeType: record.mimeType,
    originalMimeType: record.originalMimeType,
    size: record.size,
    storageProvider: record.storageProvider,
    isEncrypted: record.isEncrypted || false,
    encryptedKey: record.encryptedKey || "",
    encryptedKeysByDoctor: record.encryptedKeysByDoctor || {},
    iv: record.iv || "",
    authTag: record.authTag || "",
    allowedDoctors: (record.allowedDoctors || []).map((d) => d.toString()),
    recordExpiry: record.recordExpiry || null,
    createdAt: record.createdAt,
  };
}

async function streamRecordFile(res, record) {
  const fileName = path.basename(record.fileUrl || "");
  const absolutePath = path.join(UPLOAD_DIR, fileName);

  // Security headers — prevent download, embedding, caching
  res.setHeader("Content-Disposition", `inline; filename="${record.fileName || fileName}"`);
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, private");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "SAMEORIGIN");
  res.setHeader("Content-Security-Policy", "default-src 'self'; script-src 'none'; object-src 'none'");
  res.setHeader("X-Download-Options", "noopen");
  res.setHeader("X-Permitted-Cross-Domain-Policies", "none");

  if (record.isEncrypted && !record.authTag) {
    const legacyError = new Error("Legacy encrypted record requires re-upload for automatic viewing.");
    legacyError.statusCode = 409;
    throw legacyError;
  }

  if (record.isEncrypted && record.iv && record.authTag) {
    const encryptedBuffer = await fs.readFile(absolutePath);
    const decryptedBuffer = decryptBuffer(encryptedBuffer, record.iv, record.authTag);
    res.setHeader("Content-Type", record.originalMimeType || record.mimeType || "application/octet-stream");
    return res.send(decryptedBuffer);
  }

  res.setHeader("Content-Type", record.mimeType || "application/octet-stream");
  return res.sendFile(absolutePath);
}

async function verifyDoctorAccess(patientId, doctorId) {
  const accesses = await Access.find({
    patient: patientId,
    doctor: doctorId,
    status: "approved",
    expiry: { $gt: new Date() },
  }).sort({ grantedAt: -1, createdAt: -1 });

  return accesses[0] || null;
}

async function getActiveAppointmentRecordScope(patientId, doctorId) {
  const appointments = await Appointment.find({
    patient: patientId,
    doctor: doctorId,
    status: "approved",
    accessExpiry: { $gt: new Date() },
    sharedRecords: { $exists: true, $ne: [] },
  }).select("sharedRecords");

  if (!appointments.length) {
    return { hasScopedAppointments: false, sharedRecordIds: new Set() };
  }

  const sharedRecordIds = new Set();
  appointments.forEach((appointment) => {
    (appointment.sharedRecords || []).forEach((recordId) => {
      if (recordId) sharedRecordIds.add(recordId.toString());
    });
  });

  return { hasScopedAppointments: true, sharedRecordIds };
}

function canDoctorOpenRecord(record, doctorId, appointmentScope, now = new Date()) {
  if (record.recordExpiry && record.recordExpiry < now) return false;

  if (appointmentScope.hasScopedAppointments) {
    return appointmentScope.sharedRecordIds.has(record._id.toString());
  }

  return record.allowedDoctors && record.allowedDoctors.some((d) => d.toString() === doctorId.toString());
}

router.post(
  "/upload",
  auth,
  requireRole("patient"),
  upload.single("file"),
  async (req, res) => {
    try {
      const { type, doctorId, date, recordExpiry } = req.body;
      // allowedDoctors can be a JSON array string or a single id
      let allowedDoctors = [];
      try {
        allowedDoctors = req.body.allowedDoctors
          ? JSON.parse(req.body.allowedDoctors)
          : doctorId ? [doctorId] : [];
      } catch { allowedDoctors = doctorId ? [doctorId] : []; }

      if (!type || !date || !req.file || allowedDoctors.length === 0) {
        return res.status(400).json({ msg: "Type, at least one doctor, date, and file are required" });
      }

      // Validate all selected doctors exist
      const doctors = await User.find({ _id: { $in: allowedDoctors }, role: "doctor", isVerified: true }).select("name email specialty");
      if (doctors.length === 0) {
        return res.status(404).json({ msg: "No verified doctors found" });
      }

      // Use first doctor as primary for doctorName field (legacy compat)
      const primaryDoctor = doctors[0];

      const plaintextBuffer = await fs.readFile(req.file.path);
      const { encrypted, iv, authTag } = encryptBuffer(plaintextBuffer);
      await fs.writeFile(req.file.path, encrypted);

      const record = await Record.create({
        patient: req.user.id,
        doctor: primaryDoctor._id,
        type,
        doctorName: doctors.map((d) => d.name).join(", "),
        recordDate: date,
        fileName: req.file.originalname,
        fileUrl: `/uploads/${req.file.filename}`,
        mimeType: "application/octet-stream",
        originalMimeType: req.file.mimetype,
        size: req.file.size,
        isEncrypted: true,
        iv,
        authTag,
        allowedDoctors: doctors.map((d) => d._id),
        recordExpiry: recordExpiry ? new Date(recordExpiry) : null,
      });

      await createAuditLog({
        user: req.user.id,
        action: "Uploaded a health record",
        category: "upload",
        details: { recordId: record._id, type, allowedDoctors: doctors.map((d) => d._id) },
      });

      await record.populate("doctor", "name email specialty");
      return res.status(201).json({ record: serialiseRecord(record) });
    } catch (error) {
      return res.status(500).json({ msg: "Upload failed" });
    }
  },
);

router.get("/", auth, requireRole("patient"), async (req, res) => {
  try {
    const records = await Record.find({ patient: req.user.id })
      .populate("doctor", "name email specialty")
      .sort({ recordDate: -1, createdAt: -1 });
    return res.json({ records: records.map(serialiseRecord) });
  } catch (error) {
    return res.status(500).json({ msg: "Error fetching records" });
  }
});

router.get("/:recordId/view", auth, requireRole("patient"), async (req, res) => {
  try {
    const record = await Record.findOne({
      _id: req.params.recordId,
      patient: req.user.id,
    });

    if (!record) {
      return res.status(404).json({ msg: "Record not found" });
    }

    return streamRecordFile(res, record);
  } catch (error) {
    return res.status(error.statusCode || 500).json({ msg: error.message || "Unable to open record" });
  }
});

router.get("/doctor/:patientId/:recordId/view", auth, requireRole("doctor"), requireVerifiedDoctor, async (req, res) => {
  try {
    const access = await verifyDoctorAccess(req.params.patientId, req.user.id);

    if (!access) {
      return res.status(403).json({ msg: "Access denied or expired" });
    }

    const record = await Record.findOne({
      _id: req.params.recordId,
      patient: req.params.patientId,
    });

    if (!record) {
      return res.status(404).json({ msg: "Record not found" });
    }

    const appointmentScope = await getActiveAppointmentRecordScope(req.params.patientId, req.user.id);
    if (!canDoctorOpenRecord(record, req.user.id, appointmentScope)) {
      return res.status(403).json({ msg: "You are not authorised to view this specific record." });
    }

    return streamRecordFile(res, record);
  } catch (error) {
    return res.status(error.statusCode || 500).json({ msg: error.message || "Unable to open record" });
  }
});

router.get("/doctor/:patientId", auth, requireRole("doctor"), requireVerifiedDoctor, async (req, res) => {
  try {
    const access = await verifyDoctorAccess(req.params.patientId, req.user.id);

    if (!access) {
      return res.status(403).json({ msg: "Access denied or expired" });
    }

    const patient = await User.findById(req.params.patientId).select("name email");

    // STRICT: only return records where this doctor is explicitly in allowedDoctors
    // AND the per-record expiry has not passed.
    // Records with an empty allowedDoctors array are NOT shown — they were never
    // shared with this doctor.
    const now = new Date();
    const appointmentScope = await getActiveAppointmentRecordScope(req.params.patientId, req.user.id);
    const allRecords = await Record.find({ patient: req.params.patientId }).sort({ recordDate: -1, createdAt: -1 });
    const records = allRecords.filter((rec) => canDoctorOpenRecord(rec, req.user.id, appointmentScope, now));

    access.lastViewedAt = new Date();
    await access.save();

    await createAuditLog({
      user: req.user.id,
      action: "Viewed patient records",
      category: "view",
      details: { patientId: req.params.patientId, accessId: access._id },
    });

    await createNotification({
      user: req.params.patientId,
      title: "Record access alert",
      message: `${req.user.name || "A doctor"} accessed your records.`,
      type: "info",
      metadata: { doctorId: req.user.id, patientId: req.params.patientId },
    });

    return res.json({
      patient: patient
        ? { id: patient._id, name: patient.name, email: patient.email }
        : { id: req.params.patientId, name: "Patient" },
      records: records.map(serialiseRecord),
    });
  } catch (error) {
    return res.status(500).json({ msg: "Error fetching records" });
  }
});

router.use((error, req, res, next) => {
  if (error instanceof multer.MulterError || error?.message) {
    return res.status(400).json({ msg: error.message || "Upload failed" });
  }
  return next(error);
});

// ─── E2EE ENCRYPTED UPLOAD ───────────────────────────────────────────────────
// Accepts an encrypted binary blob + metadata. Server stores ciphertext only.
const encryptedStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename:    (req, file, cb) => cb(null, `enc_${Date.now()}_${file.originalname.replace(/\s+/g, "-")}`),
});
const encryptedUpload = multer({ storage: encryptedStorage, limits: { fileSize: 20 * 1024 * 1024 } });

router.post(
  "/upload-encrypted",
  auth,
  requireRole("patient"),
  encryptedUpload.single("file"),
  async (req, res) => {
    try {
      const { type, doctorId, date, encryptedKey, encryptedKeyForDoctor, iv, originalMimeType, fileName } = req.body;

      if (!type || !doctorId || !date || !req.file || !encryptedKey || !iv) {
        return res.status(400).json({ msg: "Missing required encrypted upload fields" });
      }

      const doctor = await User.findOne({ _id: doctorId, role: "doctor", isVerified: true }).select("name email specialty");
      if (!doctor) return res.status(404).json({ msg: "Verified doctor not found" });

      const record = await Record.create({
        patient:          req.user.id,
        doctor:           doctor._id,
        type,
        doctorName:       doctor.name,
        recordDate:       date,
        fileName:         fileName || req.file.originalname,
        fileUrl:          `/uploads/${req.file.filename}`,
        mimeType:         "application/octet-stream",
        originalMimeType: originalMimeType || "",
        size:             req.file.size,
        isEncrypted:      true,
        encryptedKey,
        encryptedKeysByDoctor: encryptedKeyForDoctor
          ? { [doctor._id.toString()]: encryptedKeyForDoctor }
          : {},
        iv,
      });

      await createAuditLog({
        user: req.user.id,
        action: "Uploaded encrypted health record",
        category: "upload",
        details: { recordId: record._id, type, encrypted: true },
      });

      await record.populate("doctor", "name email specialty");
      return res.status(201).json({ record: serialiseRecord(record) });
    } catch (error) {
      return res.status(500).json({ msg: "Encrypted upload failed" });
    }
  },
);

// ─── FETCH ENCRYPTED RECORD METADATA (patient or authorised doctor) ──────────
router.get("/encrypted/:id", auth, async (req, res) => {
  try {
    const record = await Record.findById(req.params.id);
    if (!record) return res.status(404).json({ msg: "Record not found" });

    const isOwner  = record.patient.toString() === req.user.id;
    const isDoctor = req.user.role === "doctor";

    if (!isOwner && !isDoctor) {
      return res.status(403).json({ msg: "Access denied" });
    }

    if (isDoctor) {
      const access = await verifyDoctorAccess(record.patient, req.user.id);
      if (!access) return res.status(403).json({ msg: "Access denied or expired" });
      const appointmentScope = await getActiveAppointmentRecordScope(record.patient, req.user.id);
      if (!canDoctorOpenRecord(record, req.user.id, appointmentScope)) {
        return res.status(403).json({ msg: "You are not authorised to view this specific record." });
      }
    }

    return res.json({
      id:              record._id,
      fileUrl:         record.fileUrl,
      encryptedKey:    record.encryptedKey,
      iv:              record.iv,
      originalMimeType: record.originalMimeType,
      fileName:        record.fileName,
      isEncrypted:     record.isEncrypted,
    });
  } catch (error) {
    return res.status(500).json({ msg: "Unable to fetch encrypted record" });
  }
});

// ─── STORE DOCTOR'S RE-ENCRYPTED KEY FOR A RECORD ────────────────────────────
router.post("/encrypted/:id/share-key", auth, requireRole("patient"), async (req, res) => {
  try {
    const { encryptedKeyForDoctor, doctorId } = req.body;
    if (!encryptedKeyForDoctor || !doctorId) {
      return res.status(400).json({ msg: "encryptedKeyForDoctor and doctorId are required" });
    }

    const record = await Record.findOne({ _id: req.params.id, patient: req.user.id });
    if (!record) return res.status(404).json({ msg: "Record not found" });

    // CRITICAL: Only allow key sharing if access is APPROVED (not pending)
    // This ensures doctor can retrieve keys from approved-status Access documents
    const accesses = await Access.find({
      patient: req.user.id,
      doctor:  doctorId,
      status:  "approved",  // ← Only approved status
      expiry:  { $gt: new Date() },  // ← Also check expiry
    }).sort({ grantedAt: -1, createdAt: -1 });
    
    if (!accesses.length) {
      return res.status(403).json({ msg: "Access not approved yet. Doctor must have approved access before sharing keys." });
    }

    // Strict: doctor must be in allowedDoctors for this record
    const isAllowed = record.allowedDoctors && record.allowedDoctors.some((d) => d.toString() === doctorId.toString());
    if (!isAllowed) {
      return res.status(403).json({ msg: "This record was not shared with this doctor." });
    }

    record.encryptedKeysByDoctor.set(doctorId.toString(), encryptedKeyForDoctor);
    await record.save();

    // Legacy sync for records that still rely on access-linked key storage.
    await Promise.all(
      accesses.map((access) => {
        access.encryptedKeysForDoctor.set(record._id.toString(), encryptedKeyForDoctor);
        return access.save();
      }),
    );

    return res.json({ ok: true });
  } catch (error) {
    return res.status(500).json({ msg: "Failed to share key" });
  }
});

// ─── DOCTOR FETCHES THEIR RE-ENCRYPTED KEY FOR A RECORD ──────────────────────
router.get("/encrypted/:id/my-key", auth, requireRole("doctor"), async (req, res) => {
  try {
    const record = await Record.findById(req.params.id);
    if (!record) return res.status(404).json({ msg: "Record not found" });

    const accesses = await Access.find({
      patient: record.patient,
      doctor:  req.user.id,
      status:  "approved",
      expiry:  { $gt: new Date() },
    }).sort({ grantedAt: -1, createdAt: -1 });
    if (!accesses.length) return res.status(403).json({ msg: "Access denied or expired" });

    const appointmentScope = await getActiveAppointmentRecordScope(record.patient, req.user.id);
    if (!canDoctorOpenRecord(record, req.user.id, appointmentScope)) {
      return res.status(403).json({ msg: "You are not authorised to view this specific record." });
    }

    const encryptedKeyForDoctor =
      record.encryptedKeysByDoctor?.get(req.user.id)
      || accesses.find((access) => access.encryptedKeysForDoctor?.get(req.params.id))
        ?.encryptedKeysForDoctor?.get(req.params.id);
    if (!encryptedKeyForDoctor) {
      return res.status(404).json({ msg: "Key not shared yet. Patient must re-grant access." });
    }

    await createAuditLog({
      user: req.user.id,
      action: "Fetched encrypted record key",
      category: "view",
      details: { recordId: req.params.id, patientId: record.patient },
    });

    return res.json({
      encryptedKeyForDoctor,
      iv:              record.iv,
      originalMimeType: record.originalMimeType,
      fileName:        record.fileName,
      fileUrl:         record.fileUrl,
    });
  } catch (error) {
    return res.status(500).json({ msg: "Unable to fetch key" });
  }
});

module.exports = router;
