const mongoose = require("mongoose");

const recordSchema = new mongoose.Schema(
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
    type: {
      type: String,
      required: true,
      trim: true,
    },
    doctorName: {
      type: String,
      required: true,
      trim: true,
    },
    recordDate: {
      type: Date,
      required: true,
    },
    fileName: {
      type: String,
      required: true,
    },
    fileUrl: {
      type: String,
      required: true,
    },
    mimeType: {
      type: String,
      default: "",
    },
    size: {
      type: Number,
      default: 0,
    },
    storageProvider: {
      type: String,
      default: "local",
    },
    // E2EE fields — server never sees plaintext
    isEncrypted: { type: Boolean, default: false },
    encryptedKey: { type: String, default: "" },
    encryptedKeysByDoctor: {
      type: Map,
      of: String,
      default: {},
    },
    iv:           { type: String, default: "" },
    authTag:      { type: String, default: "" },
    originalMimeType: { type: String, default: "" },
    // Per-record access control
    allowedDoctors: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    }],
    recordExpiry: {
      type: Date,
      default: null,   // null = no per-record expiry (falls back to Access expiry)
    },
  },
  { timestamps: true },
);

recordSchema.index({ patient: 1, createdAt: -1 });
recordSchema.index({ doctor: 1, patient: 1, createdAt: -1 });

module.exports = mongoose.model("Record", recordSchema);
