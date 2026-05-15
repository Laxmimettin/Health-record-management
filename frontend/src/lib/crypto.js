/**
 * crypto.js — Client-side E2EE using Web Crypto API
 *
 * Flow:
 *  Upload  : AES key generated → file encrypted with AES → AES key wrapped with patient RSA public key
 *  Grant   : Patient unwraps AES key with own private key → re-wraps with doctor RSA public key
 *  View    : Doctor unwraps AES key with own private key → decrypts file with AES key
 */

const PRIVATE_KEY_PREFIX = "e2ee_private_";
const PUBLIC_KEY_PREFIX  = "e2ee_public_";

// ─── RSA KEY PAIR ────────────────────────────────────────────────────────────

export async function generateKeyPair() {
  const keyPair = await window.crypto.subtle.generateKey(
    { name: "RSA-OAEP", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" },
    true,
    ["encrypt", "decrypt"],
  );

  const publicKeyJwk  = await window.crypto.subtle.exportKey("jwk", keyPair.publicKey);
  const privateKeyJwk = await window.crypto.subtle.exportKey("jwk", keyPair.privateKey);

  return { publicKeyJwk, privateKeyJwk };
}

export function savePrivateKey(userId, privateKeyJwk) {
  localStorage.setItem(`${PRIVATE_KEY_PREFIX}${userId}`, JSON.stringify(privateKeyJwk));
}

export function loadPrivateKey(userId) {
  const raw = localStorage.getItem(`${PRIVATE_KEY_PREFIX}${userId}`);
  return raw ? JSON.parse(raw) : null;
}

export function savePublicKey(userId, publicKeyJwk) {
  localStorage.setItem(`${PUBLIC_KEY_PREFIX}${userId}`, JSON.stringify(publicKeyJwk));
}

export function loadPublicKey(userId) {
  const raw = localStorage.getItem(`${PUBLIC_KEY_PREFIX}${userId}`);
  return raw ? JSON.parse(raw) : null;
}

export function hasPrivateKey(userId) {
  return !!localStorage.getItem(`${PRIVATE_KEY_PREFIX}${userId}`);
}

// ─── RSA IMPORT HELPERS ──────────────────────────────────────────────────────

async function importRsaPublicKey(jwk) {
  return window.crypto.subtle.importKey(
    "jwk", jwk,
    { name: "RSA-OAEP", hash: "SHA-256" },
    false, ["encrypt"],
  );
}

async function importRsaPrivateKey(jwk) {
  return window.crypto.subtle.importKey(
    "jwk", jwk,
    { name: "RSA-OAEP", hash: "SHA-256" },
    false, ["decrypt"],
  );
}

// ─── AES-256-GCM ─────────────────────────────────────────────────────────────

async function generateAesKey() {
  return window.crypto.subtle.generateKey(
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"],
  );
}

async function exportAesKey(aesKey) {
  return window.crypto.subtle.exportKey("raw", aesKey);
}

async function importAesKey(rawKey) {
  return window.crypto.subtle.importKey(
    "raw", rawKey,
    { name: "AES-GCM" },
    false, ["encrypt", "decrypt"],
  );
}

// ─── ENCRYPT FILE ────────────────────────────────────────────────────────────

/**
 * Encrypts a File/Blob with AES-256-GCM.
 * Wraps the AES key with the recipient's RSA public key.
 *
 * @param {File} file
 * @param {Object} recipientPublicKeyJwk  — JWK of the patient's public key
 * @returns {{ encryptedBlob, encryptedKeyB64, ivB64, mimeType, fileName }}
 */
export async function encryptFile(file, recipientPublicKeyJwk) {
  const fileBuffer   = await file.arrayBuffer();
  const aesKey       = await generateAesKey();
  const iv           = window.crypto.getRandomValues(new Uint8Array(12));

  // Encrypt file bytes
  const encryptedBuffer = await window.crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    aesKey,
    fileBuffer,
  );

  // Wrap AES key with RSA public key
  const rawAesKey       = await exportAesKey(aesKey);
  const rsaPublicKey    = await importRsaPublicKey(recipientPublicKeyJwk);
  const wrappedAesKey   = await window.crypto.subtle.encrypt(
    { name: "RSA-OAEP" },
    rsaPublicKey,
    rawAesKey,
  );

  return {
    encryptedBlob:    new Blob([encryptedBuffer], { type: "application/octet-stream" }),
    encryptedKeyB64:  arrayBufferToBase64(wrappedAesKey),
    ivB64:            arrayBufferToBase64(iv),
    mimeType:         file.type,
    fileName:         file.name,
  };
}

// ─── DECRYPT FILE ────────────────────────────────────────────────────────────

/**
 * Decrypts an encrypted file blob.
 *
 * @param {ArrayBuffer|Blob} encryptedData
 * @param {string} encryptedKeyB64   — base64 wrapped AES key
 * @param {string} ivB64             — base64 IV
 * @param {Object} privateKeyJwk     — JWK of the decryptor's private key
 * @param {string} mimeType
 * @returns {Blob} decrypted file blob
 */
export async function decryptFile(encryptedData, encryptedKeyB64, ivB64, privateKeyJwk, mimeType) {
  const rsaPrivateKey  = await importRsaPrivateKey(privateKeyJwk);
  const wrappedAesKey  = base64ToArrayBuffer(encryptedKeyB64);
  const iv             = base64ToArrayBuffer(ivB64);

  // Unwrap AES key
  const rawAesKey = await window.crypto.subtle.decrypt(
    { name: "RSA-OAEP" },
    rsaPrivateKey,
    wrappedAesKey,
  );
  const aesKey = await importAesKey(rawAesKey);

  // Decrypt file
  const encryptedBuffer = encryptedData instanceof Blob
    ? await encryptedData.arrayBuffer()
    : encryptedData;

  const decryptedBuffer = await window.crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    aesKey,
    encryptedBuffer,
  );

  return new Blob([decryptedBuffer], { type: mimeType || "application/octet-stream" });
}

// ─── RE-ENCRYPT AES KEY FOR DOCTOR ───────────────────────────────────────────

/**
 * Patient decrypts the AES key with their private key,
 * then re-encrypts it with the doctor's public key.
 *
 * @param {string} encryptedKeyB64     — patient's wrapped AES key (base64)
 * @param {Object} patientPrivateKeyJwk
 * @param {Object} doctorPublicKeyJwk
 * @returns {string} base64 AES key encrypted for doctor
 */
export async function reEncryptKeyForDoctor(encryptedKeyB64, patientPrivateKeyJwk, doctorPublicKeyJwk) {
  const rsaPrivateKey = await importRsaPrivateKey(patientPrivateKeyJwk);
  const wrappedKey    = base64ToArrayBuffer(encryptedKeyB64);

  // Unwrap with patient private key
  const rawAesKey = await window.crypto.subtle.decrypt(
    { name: "RSA-OAEP" },
    rsaPrivateKey,
    wrappedKey,
  );

  // Re-wrap with doctor public key
  const rsaDoctorPublicKey  = await importRsaPublicKey(doctorPublicKeyJwk);
  const wrappedForDoctor    = await window.crypto.subtle.encrypt(
    { name: "RSA-OAEP" },
    rsaDoctorPublicKey,
    rawAesKey,
  );

  return arrayBufferToBase64(wrappedForDoctor);
}

// ─── UTILS ───────────────────────────────────────────────────────────────────

export function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary  = "";
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
  return window.btoa(binary);
}

export function base64ToArrayBuffer(base64) {
  const binary = window.atob(base64);
  const bytes  = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}
