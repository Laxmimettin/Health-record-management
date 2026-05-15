const mongoose = require("mongoose");

const auditSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    email: {
      type: String,
      default: "",
    },
    action: {
      type: String,
      required: true,
      trim: true,
    },
    category: {
      type: String,
      default: "general",
    },
    severity: {
      type: String,
      enum: ["info", "low", "medium", "warning", "high", "critical"],
      default: "info",
    },
    details: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    time: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true },
);

auditSchema.index({ user: 1, time: -1 });
auditSchema.index({ email: 1, time: -1 });

module.exports = mongoose.model("Audit", auditSchema);
