import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import DashboardShell from "../components/DashboardShell";
import api from "../lib/api";

const statusBadge = { approved: "badge-green", pending: "badge-amber", rejected: "badge-rose", revoked: "badge-slate" };

export default function AccessManagement({ user, theme, onToggleTheme, onLogout }) {
  const [accessList, setAccessList] = useState([]);
  const [requests, setRequests]     = useState([]);
  const [doctors, setDoctors]       = useState([]);       // patient: all doctors from directory
  const [directory, setDirectory]   = useState([]);       // doctor: patient search results
  const [selectedDoctor, setSelectedDoctor] = useState("");
  const [query, setQuery]           = useState("");
  const [expiry, setExpiry]         = useState("");
  const [message, setMessage]       = useState({ text: "", type: "" });
  const [showMoreDirectory, setShowMoreDirectory] = useState(false);

  const isPatient = user.role === "patient";

  const flash = (text, type = "info") => {
    setMessage({ text, type });
    setTimeout(() => setMessage({ text: "", type: "" }), 4000);
  };

  const loadData = () => {
    const calls = [api.get("/access/mine")];
    if (isPatient) calls.push(api.get("/access/requests"));
    Promise.all(calls).then(([a, r]) => {
      setAccessList(a.data.accessList || []);
      setRequests(r?.data?.requests || []);
    }).catch(() => {});
  };

  useEffect(() => {
    const calls = [api.get("/access/mine")];
    if (isPatient) calls.push(api.get("/access/requests"));
    Promise.all(calls).then(([a, r]) => {
      setAccessList(a.data.accessList || []);
      setRequests(r?.data?.requests || []);
    }).catch(() => {});

    if (isPatient) {
      api.get("/access/directory/doctors", { params: { q: "" } })
        .then((res) => setDoctors(res.data.doctors || []))
        .catch(() => {});
    }
  }, [isPatient]);

  const searchDirectory = async () => {
    try {
      const res = await api.get("/access/directory/patients", { params: { q: query } });
      setDirectory(res.data.patients || []);
      if (!res.data.patients?.length) flash("No patients found.", "warning");
    } catch { flash("Unable to search directory.", "error"); }
  };

  const grantDoctor = async (doctorId) => {
    if (!doctorId) return;
    try {
      await api.post("/access/grant", { doctorId, expiry: expiry || undefined, note: "Granted from access management" });
      flash("Doctor access granted.", "success");
      setSelectedDoctor("");
      loadData();
    } catch (err) { flash(err.response?.data?.msg || "Unable to grant access.", "error"); }
  };

  const updateRequest = async (accessId, status) => {
    try {
      await api.patch(`/access/${accessId}`, { status, expiry: expiry || undefined });
      flash(`Request ${status}.`, status === "approved" ? "success" : "info");

      loadData();
    } catch (err) { flash(err.response?.data?.msg || "Unable to update request.", "error"); }
  };

  const revokeAccess = async (accessId) => {
    try {
      await api.post(`/access/${accessId}/revoke`);
      flash("Access revoked.", "success");
      loadData();
    } catch (err) { flash(err.response?.data?.msg || "Unable to revoke.", "error"); }
  };

  const requestAccess = async (patientId) => {
    try {
      await api.post("/access/request", { patientId, expiry: expiry || undefined, note: "Requested from access management" });
      flash("Access request created.", "success");
      loadData();
    } catch (err) { flash(err.response?.data?.msg || "Unable to request access.", "error"); }
  };

  const msgStyle = {
    success: "border-emerald-500/20 bg-emerald-500/10 text-emerald-400",
    error:   "border-rose-500/20 bg-rose-500/10 text-rose-400",
    warning: "border-amber-500/20 bg-amber-500/10 text-amber-400",
    info:    "border-sky-500/20 bg-sky-500/10 text-sky-400",
  };

  // Group doctors by specialty for the dropdown
  const doctorsBySpecialty = doctors.reduce((acc, d) => {
    const key = d.specialty || "General";
    if (!acc[key]) acc[key] = [];
    acc[key].push(d);
    return acc;
  }, {});

  const selectedDoctorObj = doctors.find((d) => d.id === selectedDoctor);

  return (
    <DashboardShell title="Access Management"
      subtitle="Control who can see records, set expiration windows, review pending requests, and revoke permissions at any time."
      user={user} theme={theme} onToggleTheme={onToggleTheme} onLogout={onLogout}>

      <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">

        {/* ── LEFT ── */}
        <section className="card p-4 sm:p-6">
          <h2 className="text-lg sm:text-xl font-black">{isPatient ? "Grant doctor access" : "Find a patient"}</h2>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            {isPatient ? "Select a doctor from the list to grant access to your records." : "Search patients by name or email."}
          </p>

          {isPatient ? (
            /* ── PATIENT: doctor dropdown ── */
            <div className="mt-5 space-y-4">
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-[var(--text-secondary)]">Select doctor</label>
                <select value={selectedDoctor} onChange={(e) => setSelectedDoctor(e.target.value)}
                  className="input-field appearance-none">
                  <option value="" disabled>Choose a doctor…</option>
                  {Object.entries(doctorsBySpecialty).sort(([a], [b]) => a.localeCompare(b)).map(([specialty, docs]) => (
                    <optgroup key={specialty} label={`🩺 ${specialty}`}>
                      {docs.map((d) => (
                        <option key={d.id} value={d.id}>{d.name}</option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>

              {/* Selected doctor preview */}
              <AnimatePresence>
                {selectedDoctorObj && (
                  <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                    className="card-flat p-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-violet-500/12 text-lg font-bold text-violet-400">
                        {selectedDoctorObj.name?.[0]?.toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold">{selectedDoctorObj.name}</p>
                        <p className="text-xs text-[var(--text-muted)]">{selectedDoctorObj.email}</p>
                        {selectedDoctorObj.specialty && (
                          <span className="badge badge-violet mt-1">🩺 {selectedDoctorObj.specialty}</span>
                        )}
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <div>
                <label className="mb-1.5 block text-xs font-semibold text-[var(--text-secondary)]">Access expiry (optional)</label>
                <input type="datetime-local" value={expiry} onChange={(e) => setExpiry(e.target.value)}
                  className="input-field" />
              </div>

              <motion.button type="button" whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                disabled={!selectedDoctor}
                onClick={() => grantDoctor(selectedDoctor)}
                className="w-full rounded-xl btn-brand py-3 text-sm glow-sky disabled:opacity-40 disabled:cursor-not-allowed">
                ✅ Grant access to selected doctor
              </motion.button>

              {doctors.length === 0 && (
                <div className="rounded-2xl border border-dashed border-[var(--border)] p-8 text-center">
                  <p className="text-3xl mb-2">👨⚕️</p>
                  <p className="text-sm text-[var(--text-muted)]">No doctors registered yet.</p>
                </div>
              )}
            </div>
          ) : (
            /* ── DOCTOR: patient search ── */
            <div className="mt-5 space-y-4">
              <div className="flex gap-2">
                <input value={query} onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && searchDirectory()}
                  placeholder="Search patients…" className="input-field flex-1" />
                <motion.button type="button" whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
                  onClick={searchDirectory} className="rounded-xl btn-brand px-3 sm:px-4 py-2 text-sm glow-sky whitespace-nowrap">
                  Search
                </motion.button>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold text-[var(--text-secondary)]">Access expiry (optional)</label>
                <input type="datetime-local" value={expiry} onChange={(e) => setExpiry(e.target.value)}
                  className="input-field" />
              </div>

              <div className="space-y-3">
                {(showMoreDirectory ? directory : directory.slice(0, 5)).map((entry, i) => (
                  <motion.div key={entry.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                    className="card-flat p-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-sky-500/12 text-lg font-bold text-sky-400">
                        {entry.name?.[0]?.toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-semibold">{entry.name}</p>
                        <p className="truncate text-xs text-[var(--text-muted)]">{entry.email}</p>
                      </div>
                    </div>
                    <motion.button type="button" whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                      onClick={() => requestAccess(entry.id)}
                      className="mt-3 w-full rounded-xl btn-brand py-2 text-xs glow-sky">
                      🔑 Request access
                    </motion.button>
                  </motion.div>
                ))}
                
                {directory.length > 5 && (
                  <div className="text-center">
                    <button type="button" onClick={() => setShowMoreDirectory(!showMoreDirectory)}
                      className="text-xs font-semibold text-[var(--accent-strong)] hover:underline">
                      {showMoreDirectory ? "Show less" : `Show ${directory.length - 5} more patients`}
                    </button>
                  </div>
                )}
                
                {directory.length === 0 && (
                  <div className="rounded-2xl border border-dashed border-[var(--border)] p-8 text-center">
                    <p className="text-3xl mb-2">🧑⚕️</p>
                    <p className="text-sm text-[var(--text-muted)]">Search to find patients.</p>
                  </div>
                )}
              </div>
            </div>
          )}

          <AnimatePresence>
            {message.text && (
              <motion.p initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                className={`mt-4 rounded-xl border px-4 py-3 text-sm ${msgStyle[message.type] || msgStyle.info}`}>
                {message.text}
              </motion.p>
            )}
          </AnimatePresence>
        </section>

        {/* ── RIGHT ── */}
        <div className="space-y-5">
          {/* Pending requests (patient only) */}
          {isPatient && (
            <section className="card p-4 sm:p-6">
              <h2 className="text-lg sm:text-xl font-black">Pending requests</h2>
              <div className="mt-4 space-y-3">
                {requests.map((req) => (
                  <div key={req.id || req._id} className="card-flat p-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-amber-500/12 text-lg">👨⚕️</div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-semibold">{req.doctor?.name}</p>
                        <p className="truncate text-xs text-[var(--text-muted)]">{req.doctor?.email}</p>
                        {req.doctor?.specialty && <span className="badge badge-violet mt-1">🩺 {req.doctor.specialty}</span>}
                      </div>
                      <span className="badge badge-amber flex-shrink-0">Pending</span>
                    </div>
                    <div className="mt-3 flex flex-col sm:flex-row gap-2">
                      <button type="button" onClick={() => updateRequest(req.id || req._id, "approved", req.doctor)}
                        className="flex-1 rounded-xl border border-emerald-500/30 bg-emerald-500/10 py-2 text-xs font-semibold text-emerald-400 hover:bg-emerald-500/20 transition">
                        ✓ Approve
                      </button>
                      <button type="button" onClick={() => updateRequest(req.id || req._id, "rejected", null)}
                        className="flex-1 rounded-xl border border-rose-500/30 bg-rose-500/10 py-2 text-xs font-semibold text-rose-400 hover:bg-rose-500/20 transition">
                        ✕ Reject
                      </button>
                    </div>
                  </div>
                ))}
                {requests.length === 0 && (
                  <div className="flex items-center gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/8 p-4">
                    <span className="text-xl">✅</span>
                    <p className="text-xs font-medium text-emerald-400">No pending requests right now.</p>
                  </div>
                )}
              </div>
            </section>
          )}

          {/* Active permissions / my requests */}
          <section className="card p-4 sm:p-6">
            <h2 className="text-lg sm:text-xl font-black">{isPatient ? "Active permissions" : "My access requests"}</h2>
            <div className="mt-4 space-y-3">
              {accessList.map((a) => (
                <div key={a.id || a._id} className="card-flat p-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-sky-500/12 text-sm font-bold text-sky-400">
                        {(isPatient ? a.doctor?.name : a.patient?.name)?.[0]?.toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold">{isPatient ? a.doctor?.name : a.patient?.name}</p>
                        <p className="truncate text-xs text-[var(--text-muted)]">{isPatient ? a.doctor?.email : a.patient?.email}</p>
                        {isPatient && a.doctor?.specialty && (
                          <span className="badge badge-violet mt-1">🩺 {a.doctor.specialty}</span>
                        )}
                      </div>
                    </div>
                    <span className={`badge flex-shrink-0 ${statusBadge[a.status] || "badge-slate"}`}>{a.status}</span>
                  </div>
                  <p className="mt-2 text-[10px] text-[var(--text-muted)]">Expires {new Date(a.expiry).toLocaleString()}</p>
                  {isPatient && a.status === "approved" && (
                    <button type="button" onClick={() => revokeAccess(a.id || a._id)}
                      className="mt-3 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-1.5 text-xs font-semibold text-rose-400 hover:bg-rose-500/20 transition">
                      Revoke access
                    </button>
                  )}
                </div>
              ))}
              {accessList.length === 0 && (
                <div className="rounded-xl border border-dashed border-[var(--border)] p-5 text-center text-xs text-[var(--text-muted)]">
                  No access relationships yet.
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
    </DashboardShell>
  );
}
