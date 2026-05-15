const mongoose = require("mongoose");

const loginMetaSchema = new mongoose.Schema(
  {
    device: { type: String, default: "Unknown device" },
    location: { type: String, default: "Unknown location" },
    ip: { type: String, default: "" },
    time: { type: Date, default: Date.now },
  },
  { _id: false },
);

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: true,
    },
    role: {
      type: String,
      enum: ["patient", "doctor"],
      required: true,
    },
    specialty: {
      type: String,
      trim: true,
      default: "",
    },
    publicKey: {
      type: String,   // JSON-stringified JWK of RSA-OAEP public key
      default: "",
    },
    isVerified: {
      type: Boolean,
      default: function setVerificationDefault() {
        return this.role !== "doctor";
      },
    },
    verifiedAt: Date,
    verifiedBy: {
      type: String,
      trim: true,
      default: "",
    },
    lastLoginAt: Date,
    lastLoginMeta: loginMetaSchema,
    preferredLanguage: {
      type: String,
      enum: ["english", "kannada", "hindi"],
      default: "english",
    },
  },
  { timestamps: true },
);

userSchema.index({ role: 1, name: 1 });

module.exports = mongoose.model("User", userSchema);
