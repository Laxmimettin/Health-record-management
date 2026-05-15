const router = require("express").Router();
const auth = require("../middleware/auth");
const requireRole = require("../middleware/requireRole");
const requireVerifiedDoctor = require("../middleware/requireVerifiedDoctor");
const Access = require("../models/Access");
const User = require("../models/User");
const { createAuditLog, createNotification } = require("../utils/activity");

function serialiseAccess(access) {
  return {
    id: access._id,
    patient: access.patient && typeof access.patient === "object"
      ? {
          id: access.patient._id,
          name: access.patient.name,
          email: access.patient.email,
        }
      : access.patient,
    doctor: access.doctor && typeof access.doctor === "object"
      ? {
          id: access.doctor._id,
          name: access.doctor.name,
          email: access.doctor.email,
          specialty: access.doctor.specialty,
          publicKey: access.doctor.publicKey || "",
        }
      : access.doctor,
    status: access.status,
    expiry: access.expiry,
    note: access.note,
    grantedAt: access.grantedAt,
    revokedAt: access.revokedAt,
    lastViewedAt: access.lastViewedAt,
    createdAt: access.createdAt,
  };
}

router.get("/directory/patients", auth, requireRole("doctor"), requireVerifiedDoctor, async (req, res) => {
  try {
    const query = (req.query.q || "").trim();
    const filter = {
      role: "patient",
      ...(query
        ? {
            $or: [
              { name: { $regex: query, $options: "i" } },
              { email: { $regex: query, $options: "i" } },
            ],
          }
        : {}),
    };

    const patients = await User.find(filter).select("name email createdAt").limit(20).sort({ createdAt: -1 });
    return res.json({
      patients: patients.map((patient) => ({
        id: patient._id,
        name: patient.name,
        email: patient.email,
        createdAt: patient.createdAt,
      })),
    });
  } catch (error) {
    return res.status(500).json({ msg: "Unable to search patients" });
  }
});

router.get("/directory/doctors", auth, requireRole("patient"), async (req, res) => {
  try {
    const query = (req.query.q || "").trim();
    const filter = {
      role: "doctor",
      isVerified: true,
      ...(query
        ? {
            $or: [
              { name: { $regex: query, $options: "i" } },
              { email: { $regex: query, $options: "i" } },
              { specialty: { $regex: query, $options: "i" } },
            ],
          }
        : {}),
    };

    const doctors = await User.find(filter).select("name email specialty publicKey createdAt").limit(20).sort({ createdAt: -1 });
    return res.json({
      doctors: doctors.map((doctor) => ({
        id: doctor._id,
        name: doctor.name,
        email: doctor.email,
        specialty: doctor.specialty,
        publicKey: doctor.publicKey || "",
        createdAt: doctor.createdAt,
      })),
    });
  } catch (error) {
    return res.status(500).json({ msg: "Unable to search doctors" });
  }
});

router.post("/request", auth, requireRole("doctor"), requireVerifiedDoctor, async (req, res) => {
  try {
    const { patientId, note = "", expiry } = req.body;

    const patient = await User.findOne({ _id: patientId, role: "patient" });
    if (!patient) {
      return res.status(404).json({ msg: "Patient not found" });
    }

    const existing = await Access.findOne({
      patient: patientId,
      doctor: req.user.id,
      status: { $in: ["pending", "approved"] },
      expiry: { $gt: new Date() },
    });

    if (existing) {
      return res.status(409).json({ msg: "There is already an active request or permission for this patient" });
    }

    const access = await Access.create({
      patient: patientId,
      doctor: req.user.id,
      note,
      expiry: expiry || new Date(Date.now() + 24 * 60 * 60 * 1000),
    });

    await createAuditLog({
      user: req.user.id,
      action: "Requested access to patient records",
      category: "access",
      details: { patientId, accessId: access._id, note },
    });

    await createNotification({
      user: patientId,
      title: "New access request",
      message: `${req.user.name || "A doctor"} requested access to your records.`,
      type: "access",
      metadata: { doctorId: req.user.id, accessId: access._id },
    });

    return res.status(201).json({ access: serialiseAccess(access) });
  } catch (error) {
    return res.status(500).json({ msg: "Request failed" });
  }
});

router.post("/grant", auth, requireRole("patient"), async (req, res) => {
  try {
    const { doctorId, expiry, note = "" } = req.body;

    const doctor = await User.findOne({ _id: doctorId, role: "doctor", isVerified: true });
    if (!doctor) {
      return res.status(404).json({ msg: "Verified doctor not found" });
    }

    let access = await Access.findOne({
      patient: req.user.id,
      doctor: doctorId,
    }).sort({ createdAt: -1 });

    if (!access) {
      access = new Access({
        patient: req.user.id,
        doctor: doctorId,
      });
    }

    access.status = "approved";
    access.expiry = expiry || new Date(Date.now() + 24 * 60 * 60 * 1000);
    access.note = note;
    access.grantedAt = new Date();
    access.revokedAt = null;
    await access.save();

    await createAuditLog({
      user: req.user.id,
      action: "Granted doctor access",
      category: "access",
      details: { doctorId, accessId: access._id, expiry: access.expiry },
    });

    await createNotification({
      user: doctorId,
      title: "Access granted",
      message: "A patient granted you access to their records.",
      type: "success",
      metadata: { patientId: req.user.id, accessId: access._id },
    });

    await access.populate("doctor", "name email specialty publicKey");
    return res.status(201).json({ access: serialiseAccess(access) });
  } catch (error) {
    return res.status(500).json({ msg: "Grant failed" });
  }
});

router.get("/requests", auth, requireRole("patient"), async (req, res) => {
  try {
    const requests = await Access.find({
      patient: req.user.id,
      status: "pending",
    })
      .populate("doctor", "name email specialty publicKey")
      .sort({ createdAt: -1 });

    return res.json({ requests: requests.map(serialiseAccess) });
  } catch (error) {
    return res.status(500).json({ msg: "Error fetching requests" });
  }
});

router.get("/mine", auth, requireVerifiedDoctor, async (req, res) => {
  try {
    const filter =
      req.user.role === "patient"
        ? { patient: req.user.id }
        : { doctor: req.user.id };

    const accesses = await Access.find(filter)
      .populate("patient", "name email")
      .populate("doctor", "name email specialty publicKey")
      .sort({ createdAt: -1 });

    return res.json({ accessList: accesses.map(serialiseAccess) });
  } catch (error) {
    return res.status(500).json({ msg: "Error fetching access list" });
  }
});

router.patch("/:id", auth, requireRole("patient"), async (req, res) => {
  try {
    const { status, expiry } = req.body;

    if (!["approved", "rejected"].includes(status)) {
      return res.status(400).json({ msg: "Invalid access status" });
    }

    const access = await Access.findOne({
      _id: req.params.id,
      patient: req.user.id,
    }).populate("doctor", "name email specialty publicKey");

    if (!access) {
      return res.status(404).json({ msg: "Access request not found" });
    }

    access.status = status;
    access.expiry = expiry || access.expiry;
    access.grantedAt = status === "approved" ? new Date() : access.grantedAt;
    access.revokedAt = status === "rejected" ? new Date() : null;
    await access.save();

    await createAuditLog({
      user: req.user.id,
      action: `Access request ${status}`,
      category: "access",
      details: { accessId: access._id, doctorId: access.doctor._id },
    });

    await createNotification({
      user: access.doctor._id,
      title: status === "approved" ? "Access approved" : "Access rejected",
      message:
        status === "approved"
          ? "Your request to access patient records was approved."
          : "Your request to access patient records was rejected.",
      type: status === "approved" ? "success" : "warning",
      metadata: { accessId: access._id, patientId: req.user.id },
    });

    return res.json({ access: serialiseAccess(access) });
  } catch (error) {
    return res.status(500).json({ msg: "Update failed" });
  }
});

router.post("/:id/revoke", auth, requireRole("patient"), async (req, res) => {
  try {
    const access = await Access.findOne({
      _id: req.params.id,
      patient: req.user.id,
    }).populate("doctor", "name email specialty");

    if (!access) {
      return res.status(404).json({ msg: "Permission not found" });
    }

    access.status = "revoked";
    access.revokedAt = new Date();
    access.expiry = new Date();
    await access.save();

    await createAuditLog({
      user: req.user.id,
      action: "Revoked doctor access",
      category: "access",
      severity: "warning",
      details: { accessId: access._id, doctorId: access.doctor._id },
    });

    await createNotification({
      user: access.doctor._id,
      title: "Access revoked",
      message: "A patient revoked your access to their records.",
      type: "warning",
      metadata: { accessId: access._id, patientId: req.user.id },
    });

    return res.json({ access: serialiseAccess(access) });
  } catch (error) {
    return res.status(500).json({ msg: "Revoke failed" });
  }
});

module.exports = router;
