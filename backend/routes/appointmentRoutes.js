const router = require("express").Router();
const auth = require("../middleware/auth");
const requireRole = require("../middleware/requireRole");
const requireVerifiedDoctor = require("../middleware/requireVerifiedDoctor");
const Appointment = require("../models/Appointment");
const Access = require("../models/Access");
const Record = require("../models/Record");
const User = require("../models/User");
const { createAuditLog, createNotification } = require("../utils/activity");

function normaliseSharedRecordIds(sharedRecords) {
  if (!Array.isArray(sharedRecords)) return [];
  return [...new Set(sharedRecords.map((id) => id?.toString()).filter(Boolean))];
}

function serialiseAppointment(appointment) {
  return {
    id: appointment._id,
    patient: appointment.patient && typeof appointment.patient === "object"
      ? {
          id: appointment.patient._id,
          name: appointment.patient.name,
          email: appointment.patient.email,
        }
      : appointment.patient,
    doctor: appointment.doctor && typeof appointment.doctor === "object"
      ? {
          id: appointment.doctor._id,
          name: appointment.doctor.name,
          email: appointment.doctor.email,
          specialty: appointment.doctor.specialty,
          publicKey: appointment.doctor.publicKey || "",
        }
      : appointment.doctor,
    status: appointment.status,
    appointmentTime: appointment.appointmentTime,
    accessExpiry: appointment.accessExpiry,
    reason: appointment.reason,
    patientNote: appointment.patientNote,
    doctorNote: appointment.doctorNote,
    approvedAt: appointment.approvedAt,
    rejectedAt: appointment.rejectedAt,
    cancelledAt: appointment.cancelledAt,
    sharedRecords: (appointment.sharedRecords || []).map((r) =>
      typeof r === "object" ? r._id?.toString() : r?.toString()
    ),
    createdAt: appointment.createdAt,
  };
}

router.post("/", auth, requireRole("patient"), async (req, res) => {
  try {
    const {
      doctorId,
      appointmentTime,
      accessExpiry,
      reason = "",
      patientNote = "",
      sharedRecords = [],
    } = req.body;

    if (!doctorId || !appointmentTime || !accessExpiry) {
      return res.status(400).json({ msg: "Doctor, appointment time, and access expiry are required" });
    }

    const appointmentDate = new Date(appointmentTime);
    const expiryDate = new Date(accessExpiry);

    if (Number.isNaN(appointmentDate.getTime()) || Number.isNaN(expiryDate.getTime())) {
      return res.status(400).json({ msg: "Appointment time and access expiry must be valid dates" });
    }

    if (appointmentDate <= new Date()) {
      return res.status(400).json({ msg: "Appointment time must be in the future" });
    }

    if (expiryDate <= appointmentDate) {
      return res.status(400).json({ msg: "Access expiry must be later than the appointment time" });
    }

    const doctor = await User.findOne({ _id: doctorId, role: "doctor", isVerified: true });
    if (!doctor) {
      return res.status(404).json({ msg: "Verified doctor not found" });
    }

    const selectedRecordIds = normaliseSharedRecordIds(sharedRecords);
    if (selectedRecordIds.length === 0) {
      return res.status(400).json({ msg: "Please select at least one record to share" });
    }

    const selectedRecords = await Record.find({
      _id: { $in: selectedRecordIds },
      patient: req.user.id,
    }).select("_id");

    if (selectedRecords.length !== selectedRecordIds.length) {
      return res.status(400).json({ msg: "One or more selected records are invalid" });
    }

    let appointment = await Appointment.findOne({
      patient: req.user.id,
      doctor: doctorId,
      status: "pending",
      appointmentTime: { $gte: new Date() },
    });

    if (appointment) {
      appointment.appointmentTime = appointmentDate;
      appointment.accessExpiry = expiryDate;
      appointment.reason = reason;
      appointment.patientNote = patientNote;
      appointment.sharedRecords = selectedRecordIds;
      appointment.doctorNote = "";
      appointment.rejectedAt = null;
      appointment.cancelledAt = null;
      appointment.approvedAt = null;
      await appointment.save();
    } else {
      appointment = await Appointment.create({
        patient: req.user.id,
        doctor: doctorId,
        appointmentTime: appointmentDate,
        accessExpiry: expiryDate,
        reason,
        patientNote,
        sharedRecords: selectedRecordIds,
      });
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

    access.status = appointment.status === "approved" ? "approved" : "pending";
    access.expiry = expiryDate;
    access.note = reason || `Appointment requested for ${appointmentDate.toISOString()}`;
    access.revokedAt = null;
    if (access.status === "approved") {
      access.grantedAt = access.grantedAt || new Date();
    }
    await access.save();

    await createAuditLog({
      user: req.user.id,
      action: "Booked doctor appointment",
      category: "access",
      details: {
        doctorId,
        appointmentId: appointment._id,
        accessId: access._id,
        appointmentTime: appointment.appointmentTime,
        accessExpiry: appointment.accessExpiry,
      },
    });

    await createNotification({
      user: doctorId,
      title: "New appointment request",
      message: `${req.user.name || "A patient"} requested an appointment and a timed records-access window.`,
      type: "access",
      metadata: { patientId: req.user.id, appointmentId: appointment._id },
    });

    await appointment.populate("doctor", "name email specialty publicKey");
    return res.status(201).json({
      appointment: serialiseAppointment(appointment),
      msg: "Appointment request submitted successfully",
    });
  } catch (error) {
    return res.status(500).json({ msg: "Unable to create appointment" });
  }
});

router.get("/mine", auth, async (req, res) => {
  try {
    const filter = req.user.role === "patient" ? { patient: req.user.id } : { doctor: req.user.id };
    const appointments = await Appointment.find(filter)
      .populate("patient", "name email")
      .populate("doctor", "name email specialty")
      .sort({ appointmentTime: 1, createdAt: -1 });

    return res.json({ appointments: appointments.map(serialiseAppointment) });
  } catch (error) {
    return res.status(500).json({ msg: "Unable to fetch appointments" });
  }
});

router.get("/pending", auth, requireRole("doctor"), requireVerifiedDoctor, async (req, res) => {
  try {
    const appointments = await Appointment.find({
      doctor: req.user.id,
      status: "pending",
    })
      .populate("patient", "name email")
      .populate("doctor", "name email specialty")
      .sort({ appointmentTime: 1, createdAt: -1 });

    return res.json({ appointments: appointments.map(serialiseAppointment) });
  } catch (error) {
    return res.status(500).json({ msg: "Unable to fetch pending appointments" });
  }
});

router.patch("/:id/respond", auth, requireRole("doctor"), requireVerifiedDoctor, async (req, res) => {
  try {
    const { status, doctorNote = "" } = req.body;

    if (!["approved", "rejected"].includes(status)) {
      return res.status(400).json({ msg: "Invalid appointment response" });
    }

    const appointment = await Appointment.findOne({
      _id: req.params.id,
      doctor: req.user.id,
      status: "pending",
    })
      .populate("patient", "name email")
      .populate("doctor", "name email specialty");

    if (!appointment) {
      return res.status(404).json({ msg: "Pending appointment not found" });
    }

    appointment.status = status;
    appointment.doctorNote = doctorNote;
    appointment.approvedAt = status === "approved" ? new Date() : null;
    appointment.rejectedAt = status === "rejected" ? new Date() : null;
    await appointment.save();

    if (status === "approved") {
      let access = await Access.findOne({
        patient: appointment.patient._id,
        doctor: appointment.doctor._id,
      }).sort({ createdAt: -1 });

      if (!access) {
        access = new Access({
          patient: appointment.patient._id,
          doctor: appointment.doctor._id,
        });
      }

      access.status = "approved";
      access.expiry = appointment.accessExpiry;
      access.note = `Appointment approved for ${appointment.appointmentTime.toISOString()}`;
      access.grantedAt = new Date();
      access.revokedAt = null;
      await access.save();

      await createAuditLog({
        user: req.user.id,
        action: "Approved appointment and granted timed record access",
        category: "access",
        details: {
          appointmentId: appointment._id,
          patientId: appointment.patient._id,
          accessExpiry: appointment.accessExpiry,
          accessId: access._id,
        },
      });

      await createNotification({
        user: appointment.patient._id,
        title: "Appointment approved",
        message: "Your doctor approved the appointment. The timed record-access window is now active.",
        type: "success",
        metadata: { appointmentId: appointment._id, accessExpiry: appointment.accessExpiry },
      });
    } else {
      await Access.findOneAndUpdate(
        {
          patient: appointment.patient._id,
          doctor: appointment.doctor._id,
          status: { $in: ["pending", "approved"] },
        },
        {
          status: "rejected",
          revokedAt: new Date(),
          expiry: new Date(),
        },
      );

      await createAuditLog({
        user: req.user.id,
        action: "Rejected appointment request",
        category: "access",
        details: {
          appointmentId: appointment._id,
          patientId: appointment.patient._id,
        },
      });

      await createNotification({
        user: appointment.patient._id,
        title: "Appointment rejected",
        message: "Your appointment request was rejected by the doctor.",
        type: "warning",
        metadata: { appointmentId: appointment._id },
      });
    }

    return res.json({ appointment: serialiseAppointment(appointment) });
  } catch (error) {
    return res.status(500).json({ msg: "Unable to update appointment" });
  }
});

router.post("/:id/cancel", auth, requireRole("patient"), async (req, res) => {
  try {
    const appointment = await Appointment.findOne({
      _id: req.params.id,
      patient: req.user.id,
      status: "pending",
    })
      .populate("patient", "name email")
      .populate("doctor", "name email specialty");

    if (!appointment) {
      return res.status(404).json({ msg: "Pending appointment not found" });
    }

    appointment.status = "cancelled";
    appointment.cancelledAt = new Date();
    await appointment.save();

    await Access.findOneAndUpdate(
      {
        patient: req.user.id,
        doctor: appointment.doctor._id,
        status: { $in: ["pending", "approved"] },
      },
      {
        status: "revoked",
        revokedAt: new Date(),
        expiry: new Date(),
      },
    );

    await createAuditLog({
      user: req.user.id,
      action: "Cancelled appointment request",
      category: "access",
      details: { appointmentId: appointment._id, doctorId: appointment.doctor._id },
    });

    await createNotification({
      user: appointment.doctor._id,
      title: "Appointment cancelled",
      message: `${req.user.name || "A patient"} cancelled an appointment request.`,
      type: "warning",
      metadata: { appointmentId: appointment._id, patientId: req.user.id },
    });

    return res.json({ appointment: serialiseAppointment(appointment) });
  } catch (error) {
    return res.status(500).json({ msg: "Unable to cancel appointment" });
  }
});

module.exports = router;
