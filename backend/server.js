const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const path = require("path");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 5000;

// Trust proxy for accurate IP addresses
app.set('trust proxy', true);

app.use(
  cors({
    origin: process.env.CLIENT_URL || "http://localhost:3000",
    credentials: true,
  }),
);
app.use(express.json());
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

app.use("/api/auth", require("./routes/authRoutes"));
app.use("/api/admin", require("./routes/adminRoutes").router);
app.use("/api/appointments", require("./routes/appointmentRoutes"));
app.use("/api/records", require("./routes/recordRoutes"));
app.use("/api/access", require("./routes/accessRoutes"));
app.use("/api/audit", require("./routes/auditRoutes"));
app.use("/api/audit", require("./routes/threatRoutes")); // Threat detection routes
app.use("/api/notifications", require("./routes/notificationRoutes"));
app.use("/api/messages", require("./routes/messageRoutes"));

app.use((err, req, res, next) => {
  return res.status(500).json({ msg: err.message || "Internal server error" });
});

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  })
  .catch((error) => {
    console.error("MongoDB connection failed", error);
  });
