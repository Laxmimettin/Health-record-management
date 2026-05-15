const mongoose = require("mongoose");

const appointmentSchema = new mongoose.Schema(
  {
    patient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    doctor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected", "cancelled"],
      default: "pending",
    },
    appointmentTime: {
      type: Date,
      required: true,
    },
    accessExpiry: {
      type: Date,
      required: true,
    },
    reason: {
      type: String,
      trim: true,
      default: "",
    },
    patientNote: {
      type: String,
      trim: true,
      default: "",
    },
    doctorNote: {
      type: String,
      trim: true,
      default: "",
    },
    // Records the patient explicitly shares for this appointment
    sharedRecords: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: "Record",
    }],
    approvedAt: Date,
    rejectedAt: Date,
    cancelledAt: Date,
  },
  { timestamps: true },
);

appointmentSchema.index({ patient: 1, createdAt: -1 });
appointmentSchema.index({ doctor: 1, status: 1, appointmentTime: 1 });

module.exports = mongoose.model("Appointment", appointmentSchema);
