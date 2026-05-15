const crypto = require("crypto");

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;

function getEncryptionSecret() {
  return process.env.RECORD_ENCRYPTION_SECRET || process.env.JWT_SECRET || "dev-record-secret-change-me";
}

function getEncryptionKey() {
  return crypto.createHash("sha256").update(getEncryptionSecret()).digest();
}

function encryptBuffer(buffer) {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, getEncryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(buffer), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return {
    encrypted,
    iv: iv.toString("base64"),
    authTag: authTag.toString("base64"),
  };
}

function decryptBuffer(buffer, ivBase64, authTagBase64) {
  const decipher = crypto.createDecipheriv(
    ALGORITHM,
    getEncryptionKey(),
    Buffer.from(ivBase64, "base64"),
  );
  decipher.setAuthTag(Buffer.from(authTagBase64, "base64"));

  return Buffer.concat([decipher.update(buffer), decipher.final()]);
}

module.exports = {
  encryptBuffer,
  decryptBuffer,
};
