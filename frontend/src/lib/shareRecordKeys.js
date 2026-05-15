import api from "./api";
import { loadPrivateKey, reEncryptKeyForDoctor } from "./crypto";

/**
 * Shares encrypted record keys with a doctor.
 * @param {Object} options
 * @param {string} options.patientId
 * @param {Object} options.doctor - { id, publicKey }
 * @param {Array} options.records
 * @returns {number} count of successfully shared records
 */
export async function shareEncryptedRecordKeysForDoctor({ patientId, doctor, records }) {
  if (!patientId || !doctor?.id || !doctor?.publicKey) {
    return 0;
  }

  const privateKeyJwk = loadPrivateKey(patientId);
  if (!privateKeyJwk) {
    return 0;
  }

  let doctorPublicKeyJwk;
  try {
    doctorPublicKeyJwk = JSON.parse(doctor.publicKey);
  } catch {
    return 0;
  }

  const encryptedRecords = (records || []).filter((record) => record.isEncrypted && record.encryptedKey);
  let sharedCount = 0;
  let accessNotApprovedCount = 0;

  for (const record of encryptedRecords) {
    try {
      const encryptedKeyForDoctor = await reEncryptKeyForDoctor(
        record.encryptedKey,
        privateKeyJwk,
        doctorPublicKeyJwk,
      );

      await api.post(`/records/encrypted/${record.id}/share-key`, {
        encryptedKeyForDoctor,
        doctorId: doctor.id,
      });

      sharedCount += 1;
    } catch (error) {
      // Track if access is not approved (403 error)
      if (error?.response?.status === 403) {
        accessNotApprovedCount += 1;
      }
      // Skip individual record failures so one bad record does not block the rest.
    }
  }

  // If all records failed due to access not approved, return negative to signal this
  if (sharedCount === 0 && accessNotApprovedCount > 0) {
    return -1; // Signal: access not approved
  }

  return sharedCount;
}

export async function shareEncryptedRecordKeysForDoctors({ patientId, doctors, records }) {
  const approvedDoctors = (doctors || []).filter((doctor) => doctor?.id && doctor?.publicKey);
  let sharedCount = 0;

  for (const doctor of approvedDoctors) {
    sharedCount += await shareEncryptedRecordKeysForDoctor({ patientId, doctor, records });
  }

  return sharedCount;
}
