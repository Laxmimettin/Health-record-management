const mongoose = require("mongoose");

const accessSchema = new mongoose.Schema(
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
      enum: ["pending", "approved", "rejected", "revoked"],
      default: "pending",
    },
    expiry: {
      type: Date,
      required: true,
      default: () => new Date(Date.now() + 24 * 60 * 60 * 1000),
    },
    note: {
      type: String,
      trim: true,
      default: "",
    },
    // E2EE — AES key re-encrypted with doctor's RSA public key per record
    encryptedKeysForDoctor: {
      type: Map,
      of: String,   // recordId -> base64 AES key wrapped with doctor's public key
      default: {},
    },
    grantedAt: Date,
    revokedAt: Date,
    lastViewedAt: Date,
  },
  { timestamps: true },
);

accessSchema.index({ patient: 1, doctor: 1 });
accessSchema.index({ doctor: 1, status: 1, expiry: 1 });

module.exports = mongoose.model("Access", accessSchema);
