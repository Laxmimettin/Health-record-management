const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema(
  {
    access: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Access",
      required: true,
      index: true,
    },
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    senderRole: {
      type: String,
      enum: ["doctor", "patient"],
      required: true,
    },
    text: {
      type: String,
      required: true,
      trim: true,
      maxlength: 2000,
    },
    originalLanguage: {
      type: String,
      enum: ["english", "kannada", "hindi"],
      default: "english",
    },
    translations: {
      english: { type: String, default: "" },
      kannada: { type: String, default: "" },
      hindi: { type: String, default: "" },
    },
    readBy: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  },
  { timestamps: true },
);

messageSchema.index({ access: 1, createdAt: 1 });

module.exports = mongoose.model("Message", messageSchema);
