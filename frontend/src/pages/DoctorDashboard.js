import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import DashboardShell from "../components/DashboardShell";
import SecureRecordViewer from "../components/SecureRecordViewer";
import api, { resolveFileUrl } from "../lib/api";
import { loadPrivateKey } from "../lib/crypto";

const typeIcon    = { report: "📋", lab: "🧪", prescription: "💊", xray: "🩻", other: "📄" };
const statusBadge = { approved: "badge-green", pending: "badge-amber", rejected: "badge-rose" };

let cachedPrivateKey = null;
async function getLegacyDoctorPrivateKey(userId) {
  if (cachedPrivateKey) return cachedPrivateKey;
  const jwk = loadPrivateKey(userId);
  if (!jwk) throw new Error("Legacy doctor private key not found.");

  cachedPrivateKey = await window.crypto.subtle.importKey(
    "jwk",
    jwk,
    { name: "RSA-OAEP", hash: "SHA-256" },
    false,
    ["decrypt"],
  );

  return cachedPrivateKey;
}

export default function DoctorDashboard({ user, theme, onToggleTheme, onLogout }) {
  const [search, setSearch]                   = useState("");
  const [patients, setPatients]               = useState([]);
  const [records, setRecords]                 = useState([]);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [accessList, setAccessList]           = useState([]);
  const [recordsState, setRecordsState]       = useState("idle");
  const [message, setMessage]                 = useState({ text: "", type: "" });
  const [decryptingId, setDecryptingId]       = useState(null);
  const [decryptStatus, setDecryptStatus]     = useState({});
  const [viewerBlob, setViewerBlob]           = useState(null);   // { blob, mimeType, fileName }
  const [showMoreAccess, setShowMoreAccess]   = useState(false);
  const [showMoreRecords, setShowMoreRecords] = useState(false);
  const [showMorePatients, setShowMorePatients] = useState(false);
  const pollRef = useRef(null);

  const loadAccessList = () =>
    api.get("/access/mine").then((res) => setAccessList(res.data.accessList || [])).catch(() => {});

  useEffect(() => {
    loadAccessList();
    return () => clearInterval(pollRef.current);
  }, []);

  const flash = (text, type = "info") => {
    setMessage({ text, type });
    setTimeout(() => setMessage({ text: "", type: "" }), 5000);
  };

  const searchPatients = async () => {
    if (!search.trim()) return;
    try {
      const res = await api.get("/access/directory/patients", { params: { q: search } });
      setPatients(res.data.patients || []);
      if (!res.data.patients?.length) flash("No patients found.", "warning");
    } catch { flash("Unable to search patients.", "error"); }
  };

  const tryLoadRecords = async (patient) => {
    try {
      const res = await api.get(`/records/doctor/${patient.id || patient._id}`);
      setSelectedPatient(res.data.patient || patient);
      setRecords(res.data.records || []);
      setRecordsState("approved");
      clearInterval(pollRef.current);
      return true;
    } catch { return false; }
  };

  const requestAccess = async (patient) => {
    try {
      await api.post("/access/request", { patientId: patient.id, note: "Requested from doctor dashboard" });
      flash("Access request sent! Waiting for patient approval.", "success");
      setSelectedPatient(patient);
      setRecords([]);
      setRecordsState("pending");
      loadAccessList();
      clearInterval(pollRef.current);
      pollRef.current = setInterval(async () => {
        const loaded = await tryLoadRecords(patient);
        if (loaded) flash("Patient approved! Records loaded.", "success");
      }, 5000);
    } catch (err) { flash(err.response?.data?.msg || "Unable to request access.", "error"); }
  };

  const viewRecords = async (patient) => {
    clearInterval(pollRef.current);
    setSelectedPatient(patient);
    setRecords([]);
    setRecordsState("loading");
    const loaded = await tryLoadRecords(patient);
    if (!loaded) { setRecordsState("denied"); flash("Access not yet approved.", "warning"); }
  };

  const decryptRecord = async (rec) => {
    setDecryptingId(rec.id);
    setDecryptStatus((s) => ({ ...s, [rec.id]: "opening" }));

    try {
      if (rec.authTag) {
        const patientId = selectedPatient?.id || selectedPatient?._id || rec.patient;
        const fileRes = await api.get(`/records/doctor/${patientId}/${rec.id}/view`, { responseType: "blob" });
        setDecryptStatus((s) => ({ ...s, [rec.id]: "done" }));
        setViewerBlob({ blob: fileRes.data, mimeType: rec.originalMimeType || rec.mimeType, fileName: rec.fileName });
      } else {
        const keyRes = await api.get(`/records/encrypted/${rec.id}/my-key`);
        const { encryptedKeyForDoctor, iv, originalMimeType, fileUrl } = keyRes.data;

        const fileResponse = await fetch(resolveFileUrl(fileUrl));
        if (!fileResponse.ok) throw new Error("Legacy encrypted file could not be downloaded.");

        const encryptedBuffer = await fileResponse.arrayBuffer();
        const privateKey = await getLegacyDoctorPrivateKey(user.id);
        const wrappedAesKey = Uint8Array.from(atob(encryptedKeyForDoctor), (c) => c.charCodeAt(0)).buffer;
        const rawAesKey = await window.crypto.subtle.decrypt({ name: "RSA-OAEP" }, privateKey, wrappedAesKey);
        const aesKey = await window.crypto.subtle.importKey("raw", rawAesKey, { name: "AES-GCM" }, false, ["decrypt"]);
        const ivBytes = Uint8Array.from(atob(iv), (c) => c.charCodeAt(0));
        const decryptedBuffer = await window.crypto.subtle.decrypt({ name: "AES-GCM", iv: ivBytes }, aesKey, encryptedBuffer);

        setDecryptStatus((s) => ({ ...s, [rec.id]: "done" }));
        setViewerBlob({ blob: new Blob([decryptedBuffer], { type: originalMimeType || "application/octet-stream" }), mimeType: originalMimeType, fileName: rec.fileName });
      }
    } catch (err) {
      setDecryptStatus((s) => ({ ...s, [rec.id]: "error" }));
      const msg = err.message === "Legacy doctor private key not found."
        ? "This old record needs the original doctor browser key. If that key is gone, please re-upload the record."
        : err.response?.status === 409
        ? "This record was uploaded with the older encryption flow. Please re-upload it to use automatic viewing."
        : err.response?.status === 404
        ? "The legacy record key was not found. Please re-upload the record."
        : err.response?.status === 403
        ? "Access expired or revoked."
        : "Unable to open record. Please try again.";
      flash(msg, "error");
    } finally {
      setDecryptingId(null);
    }
  };

  const msgStyle = {
    success: "border-emerald-500/20 bg-emerald-500/10 text-emerald-400",
    error:   "border-rose-500/20 bg-rose-500/10 text-rose-400",
    warning: "border-amber-500/20 bg-amber-500/10 text-amber-400",
    info:    "border-sky-500/20 bg-sky-500/10 text-sky-400",
  };

  return (
    <DashboardShell title="Doctor Dashboard"
      subtitle="Records are stored encrypted and automatically opened for approved viewing within the allowed timeline."
      user={user} theme={theme} onToggleTheme={onToggleTheme} onLogout={onLogout}>

      {/* Secure record viewer — full screen overlay */}
      {viewerBlob && (
        <SecureRecordViewer
          blob={viewerBlob.blob}
          mimeType={viewerBlob.mimeType}
          fileName={viewerBlob.fileName}
          viewerName={user.name}
          patientId={selectedPatient?.id || selectedPatient?._id}
          onClose={() => setViewerBlob(null)}
        />
      )}

      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">

        {/* ── Patient lookup ── */}
        <section className="card p-6">
          <h2 className="text-xl font-black">Patient lookup</h2>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">Search patients, request access, then open records during the approved timeline.</p>

          <div className="mt-5 flex gap-2">
            <div className="relative flex-1">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm">🔍</span>
              <input value={search} onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && searchPatients()}
                placeholder="Search patients…" className="input-field pl-9" />
            </div>
            <motion.button type="button" whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
              onClick={searchPatients} className="rounded-xl btn-brand px-4 py-2 text-sm glow-sky whitespace-nowrap">
              Search
            </motion.button>
          </div>

          <AnimatePresence>
            {message.text && (
              <motion.p initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                className={`mt-4 rounded-xl border px-4 py-3 text-sm ${msgStyle[message.type] || msgStyle.info}`}>
                {message.text}
              </motion.p>
            )}
          </AnimatePresence>

          <div className="mt-5 space-y-3">
            {(showMorePatients ? patients : patients.slice(0, 5)).map((p, i) => (
              <motion.div key={p.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                className={`card-flat p-4 transition ${selectedPatient?.id === p.id ? "border-sky-400/40" : ""}`}>
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-sky-500/12 text-lg font-bold text-sky-400">
                    {p.name?.[0]?.toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{p.name}</p>
                    <p className="truncate text-xs text-[var(--text-muted)]">{p.email}</p>
                  </div>
                  {selectedPatient?.id === p.id && (
                    <span className={`badge flex-shrink-0 ${
                      recordsState === "approved" ? "badge-green" :
                      recordsState === "pending"  ? "badge-amber" : "badge-slate"
                    }`}>
                      {recordsState === "approved" ? "Approved" : recordsState === "pending" ? "Pending" : "Selected"}
                    </span>
                  )}
                </div>
                <div className="mt-3 flex gap-2">
                  <button type="button" onClick={() => requestAccess(p)}
                    className="flex-1 rounded-xl btn-ghost py-2 text-xs font-semibold">
                    🔑 Request access
                  </button>
                  <button type="button" onClick={() => viewRecords(p)}
                    className="flex-1 rounded-xl btn-brand py-2 text-xs font-semibold glow-sky">
                    📋 View records
                  </button>
                </div>
              </motion.div>
            ))}
            
            {patients.length > 5 && (
              <div className="text-center">
                <button type="button" onClick={() => setShowMorePatients(!showMorePatients)}
                  className="text-xs font-semibold text-[var(--accent-strong)] hover:underline">
                  {showMorePatients ? "Show less" : `Show ${patients.length - 5} more patients`}
                </button>
              </div>
            )}
            
            {patients.length === 0 && (
              <div className="rounded-2xl border border-dashed border-[var(--border)] p-8 text-center">
                <p className="text-3xl mb-2">🔍</p>
                <p className="text-sm text-[var(--text-muted)]">Search for patients to start an access workflow.</p>
              </div>
            )}
          </div>
        </section>

        {/* ── Right column ── */}
        <div className="space-y-5">
          {/* Access requests */}
          <section className="card p-6">
            <h2 className="text-xl font-black">My access requests</h2>
            <div className="mt-4 space-y-3">
              {(showMoreAccess ? accessList : accessList.slice(0, 5)).map((a) => (
                <div key={a.id || a._id} className="card-flat p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-sky-500/12 text-sm font-bold text-sky-400">
                        {a.patient?.name?.[0]?.toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold">{a.patient?.name || "Patient"}</p>
                        <p className="truncate text-xs text-[var(--text-muted)]">{a.patient?.email}</p>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span className={`badge flex-shrink-0 ${statusBadge[a.status] || "badge-slate"}`}>{a.status}</span>
                      {a.status === "approved" && (
                        <button type="button" onClick={() => viewRecords(a.patient)}
                          className="text-[10px] font-semibold text-[var(--accent-strong)] hover:underline">
                          View records →
                        </button>
                      )}
                    </div>
                  </div>
                  <p className="mt-2 text-[10px] text-[var(--text-muted)]">Expires {new Date(a.expiry).toLocaleString()}</p>
                </div>
              ))}
              {accessList.length > 5 && (
                <div className="text-center">
                  <button type="button" onClick={() => setShowMoreAccess(!showMoreAccess)}
                    className="text-xs font-semibold text-[var(--accent-strong)] hover:underline">
                    {showMoreAccess ? "Show less" : `Show ${accessList.length - 5} more requests`}
                  </button>
                </div>
              )}
              {accessList.length === 0 && (
                <div className="rounded-xl border border-dashed border-[var(--border)] p-5 text-center text-xs text-[var(--text-muted)]">
                  No access requests yet.
                </div>
              )}
            </div>
          </section>

          {/* Records panel */}
          <section className="card p-6">
            <h2 className="text-xl font-black">
              {selectedPatient ? `${selectedPatient.name}'s records` : "Patient records"}
            </h2>

            <div className="mt-4">
              {recordsState === "idle" && (
                <div className="rounded-xl border border-dashed border-[var(--border)] p-8 text-center">
                  <p className="text-3xl mb-2">📂</p>
                  <p className="text-sm text-[var(--text-muted)]">Select a patient and click "View records".</p>
                </div>
              )}

              {recordsState === "loading" && (
                <div className="flex items-center justify-center py-10">
                  <span className="spinner scale-125" />
                </div>
              )}

              {recordsState === "pending" && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  className="rounded-xl border border-amber-500/20 bg-amber-500/8 p-6 text-center">
                  <p className="text-3xl mb-3">⏳</p>
                  <p className="font-semibold text-amber-400">Waiting for patient approval</p>
                  <p className="mt-1 text-xs text-[var(--text-secondary)]">
                    Request sent to <span className="font-semibold">{selectedPatient?.name}</span>.<br />
                    Records will load automatically once approved.
                  </p>
                  <div className="mt-4 flex items-center justify-center gap-2 text-xs text-amber-400">
                    <span className="spinner border-amber-400/30 border-t-amber-400" /> Checking every 5s…
                  </div>
                </motion.div>
              )}

              {recordsState === "denied" && (
                <div className="rounded-xl border border-rose-500/20 bg-rose-500/8 p-6 text-center">
                  <p className="text-3xl mb-3">🔒</p>
                  <p className="font-semibold text-rose-400">Access not approved</p>
                  <p className="mt-1 text-xs text-[var(--text-secondary)]">Request access first, then wait for patient approval.</p>
                </div>
              )}

              {recordsState === "approved" && (
                <div className="space-y-3">
                  {records.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-[var(--border)] p-6 text-center text-xs text-[var(--text-muted)]">
                      This patient has no records yet.
                    </div>
                  ) : (
                    <>
                      {(showMoreRecords ? records : records.slice(0, 4)).map((rec, i) => (
                        <motion.div key={rec.id || rec._id}
                          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                          className="card-flat p-4">
                          <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-sky-500/10 text-xl">
                              {typeIcon[rec.type?.toLowerCase()] || "📄"}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <p className="text-sm font-bold truncate">{rec.fileName || rec.type || "Record"}</p>
                                {rec.isEncrypted && <span className="badge badge-green">🔐 Protected</span>}
                              </div>
                              <p className="text-xs text-[var(--text-muted)]">
                                Dr. {rec.doctorName} · {new Date(rec.recordDate || rec.date).toLocaleDateString()}
                              </p>
                            </div>
                          </div>

                          <div className="mt-3">
                            <div className="flex items-center gap-3">
                              <button type="button"
                                disabled={decryptingId === rec.id}
                                onClick={() => decryptRecord(rec)}
                                className="flex items-center gap-2 rounded-xl btn-brand px-4 py-2 text-xs font-semibold glow-sky disabled:opacity-60">
                                {decryptingId === rec.id ? (
                                  <><span className="spinner border-white/30 border-t-white" /> Opening…</>
                                ) : (
                                  "🔐 View securely"
                                )}
                              </button>

                              {decryptStatus[rec.id] === "done" && !decryptingId && (
                                <span className="text-xs text-emerald-400 font-medium">✓ Opened</span>
                              )}
                              {decryptStatus[rec.id] === "error" && (
                                <span className="text-xs text-rose-400 font-medium">✗ Failed</span>
                              )}
                            </div>
                          </div>
                        </motion.div>
                      ))}
                      {records.length > 4 && (
                        <div className="text-center">
                          <button type="button" onClick={() => setShowMoreRecords(!showMoreRecords)}
                            className="text-xs font-semibold text-[var(--accent-strong)] hover:underline">
                            {showMoreRecords ? "Show less" : `Show ${records.length - 4} more records`}
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
    </DashboardShell>
  );
}
