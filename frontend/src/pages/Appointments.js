import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import DashboardShell from "../components/DashboardShell";
import api from "../lib/api";

const statusBadge = {
  pending:   "badge-amber",
  approved:  "badge-green",
  rejected:  "badge-rose",
  cancelled: "badge-slate",
};

const typeIcon = { report: "📋", lab: "🧪", prescription: "💊", xray: "🩻", other: "📄" };

const emptyForm = {
  doctorId:        "",
  appointmentTime: "",
  accessExpiry:    "",
  reason:          "",
  patientNote:     "",
};

export default function Appointments({ user, theme, onToggleTheme, onLogout }) {
  const isPatient = user.role === "patient";

  const [appointments, setAppointments]   = useState([]);
  const [doctors, setDoctors]             = useState([]);
  const [allRecords, setAllRecords]       = useState([]);   // all patient records
  const [doctorRecords, setDoctorRecords] = useState([]);   // records available to share in this appointment
  const [selectedRecords, setSelectedRecords] = useState([]); // record ids to share
  const [responseNotes, setResponseNotes] = useState({});
  const [form, setForm]                   = useState(emptyForm);
  const [submitting, setSubmitting]       = useState(false);
  const [busyId, setBusyId]               = useState("");
  const [message, setMessage]             = useState({ text: "", type: "" });
  const [showMoreRecords, setShowMoreRecords] = useState(false);

  const flash = (text, type = "info") => {
    setMessage({ text, type });
    setTimeout(() => setMessage({ text: "", type: "" }), 4500);
  };

  const loadAppointments = async () => {
    try {
      const res = await api.get("/appointments/mine");
      setAppointments(res.data.appointments || []);
    } catch { flash("Unable to load appointments.", "error"); }
  };

  useEffect(() => {
    loadAppointments();
    if (!isPatient) return;

    // Load doctors and all patient records in parallel
    Promise.all([
      api.get("/access/directory/doctors", { params: { q: "" } }),
      api.get("/records"),
    ]).then(([docRes, recRes]) => {
      setDoctors(docRes.data.doctors || []);
      setAllRecords(recRes.data.records || []);
    }).catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPatient]);

  // When doctor changes, allow the patient to choose from all their records.
  // The appointment selection itself controls which files the doctor can view.
  useEffect(() => {
    if (!form.doctorId) { setDoctorRecords([]); setSelectedRecords([]); return; }
    const filtered = [...allRecords].sort(
      (a, b) => new Date(b.recordDate || b.date || 0) - new Date(a.recordDate || a.date || 0),
    );
    setDoctorRecords(filtered);
    setSelectedRecords([]); // reset selection when doctor changes
  }, [form.doctorId, allRecords]);

  const toggleRecord = (id) => {
    setSelectedRecords((prev) =>
      prev.includes(id) ? prev.filter((r) => r !== id) : [...prev, id],
    );
  };

  const allSelected = doctorRecords.length > 0 && selectedRecords.length === doctorRecords.length;

  const selectedDoctor = useMemo(
    () => doctors.find((d) => d.id === form.doctorId),
    [doctors, form.doctorId],
  );

  const pendingAppointments   = appointments.filter((a) => a.status === "pending");
  const previousAppointments  = appointments.filter((a) => a.status !== "pending");
  const visibleAppointments   = isPatient ? appointments : previousAppointments;

  const createAppointment = async (e) => {
    e.preventDefault();
    if (selectedRecords.length === 0) {
      flash("Please select at least one record to share with the doctor.", "warning");
      return;
    }
    setSubmitting(true);
    try {
      const res = await api.post("/appointments", { ...form, sharedRecords: selectedRecords });
      setAppointments((prev) =>
        [res.data.appointment, ...prev].sort((a, b) => new Date(a.appointmentTime) - new Date(b.appointmentTime)),
      );
      setForm(emptyForm);
      setSelectedRecords([]);
      flash("Appointment request sent to the doctor.", "success");
    } catch (err) {
      flash(err.response?.data?.msg || "Unable to create appointment.", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const respondToAppointment = async (appointmentId, status) => {
    setBusyId(appointmentId);
    try {
      const res = await api.patch(`/appointments/${appointmentId}/respond`, {
        status,
        doctorNote: responseNotes[appointmentId] || "",
      });
      setAppointments((prev) => prev.map((a) => a.id === appointmentId ? res.data.appointment : a));
      flash(status === "approved" ? "Appointment approved. Record access activated." : "Appointment rejected.", "success");
    } catch (err) {
      flash(err.response?.data?.msg || "Unable to update appointment.", "error");
    } finally { setBusyId(""); }
  };

  const cancelAppointment = async (appointmentId) => {
    setBusyId(appointmentId);
    try {
      const res = await api.post(`/appointments/${appointmentId}/cancel`);
      setAppointments((prev) => prev.map((a) => a.id === appointmentId ? res.data.appointment : a));
      flash("Appointment cancelled.", "success");
    } catch (err) {
      flash(err.response?.data?.msg || "Unable to cancel.", "error");
    } finally { setBusyId(""); }
  };

  const msgStyle = {
    success: "border-emerald-500/20 bg-emerald-500/10 text-emerald-400",
    error:   "border-rose-500/20 bg-rose-500/10 text-rose-400",
    warning: "border-amber-500/20 bg-amber-500/10 text-amber-400",
    info:    "border-sky-500/20 bg-sky-500/10 text-sky-400",
  };

  const renderAppointmentCard = (appointment, showActions = false) => (
    <div key={appointment.id} className="card-flat p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold">
            {isPatient ? appointment.doctor?.name || "Doctor" : appointment.patient?.name || "Patient"}
          </p>
          <p className="truncate text-xs text-[var(--text-muted)]">
            {isPatient ? (appointment.doctor?.specialty || appointment.doctor?.email) : appointment.patient?.email}
          </p>
        </div>
        <span className={`badge ${statusBadge[appointment.status] || "badge-slate"}`}>{appointment.status}</span>
      </div>

      <div className="mt-3 space-y-1 text-xs text-[var(--text-secondary)]">
        <p>📅 Appointment: {new Date(appointment.appointmentTime).toLocaleString()}</p>
        <p>⏱ Records visible until: {new Date(appointment.accessExpiry).toLocaleString()}</p>
        {appointment.reason && <p>📝 Reason: {appointment.reason}</p>}
        {appointment.patientNote && <p>🗒 Patient note: {appointment.patientNote}</p>}
        {appointment.doctorNote && <p>👨⚕️ Doctor note: {appointment.doctorNote}</p>}
        {appointment.sharedRecords?.length > 0 && (
          <p>📎 Shared records: <span className="font-semibold text-sky-400">{appointment.sharedRecords.length} file{appointment.sharedRecords.length !== 1 ? "s" : ""}</span></p>
        )}
      </div>

      {showActions && !isPatient && (
          <div className="mt-4 space-y-3">
            <textarea rows="3" value={responseNotes[appointment.id] || ""}
              onChange={(e) => setResponseNotes((prev) => ({ ...prev, [appointment.id]: e.target.value }))}
              placeholder="Optional doctor note" className="input-field min-h-[80px] resize-none" />
            <div className="flex flex-col sm:flex-row gap-2">
              <button type="button" disabled={busyId === appointment.id}
                onClick={() => respondToAppointment(appointment.id, "approved")}
                className="flex-1 rounded-xl border border-emerald-500/30 bg-emerald-500/10 py-2 text-xs font-semibold text-emerald-400 transition hover:bg-emerald-500/20 disabled:opacity-50">
                ✓ Accept
              </button>
              <button type="button" disabled={busyId === appointment.id}
                onClick={() => respondToAppointment(appointment.id, "rejected")}
                className="flex-1 rounded-xl border border-rose-500/30 bg-rose-500/10 py-2 text-xs font-semibold text-rose-400 transition hover:bg-rose-500/20 disabled:opacity-50">
                ✕ Reject
              </button>
            </div>
          </div>
      )}

      {showActions && isPatient && (
        <button type="button" disabled={busyId === appointment.id}
          onClick={() => cancelAppointment(appointment.id)}
          className="mt-4 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-2 text-xs font-semibold text-rose-400 transition hover:bg-rose-500/20 disabled:opacity-50">
          Cancel request
        </button>
      )}
    </div>
  );

  return (
    <DashboardShell
      title="Appointments"
      subtitle={isPatient
        ? "Request an appointment, choose which records to share, and set when access expires."
        : "Review patient appointment requests and approve or reject the timed record-access window."}
      user={user} theme={theme} onToggleTheme={onToggleTheme} onLogout={onLogout}
    >
      <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">

        {/* ── LEFT: Create appointment (patient) / Pending requests (doctor) ── */}
        {isPatient ? (
          <section className="card p-4 sm:p-6">
            <h2 className="text-lg sm:text-xl font-black">Request an appointment</h2>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">
              Select a doctor, choose which records to share, and set the access window.
            </p>

            <form onSubmit={createAppointment} className="mt-5 space-y-5">

              {/* Doctor selector */}
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-[var(--text-secondary)]">Verified doctor</label>
                <select required value={form.doctorId}
                  onChange={(e) => setForm((prev) => ({ ...prev, doctorId: e.target.value }))}
                  className="input-field">
                  <option value="" disabled>Select doctor…</option>
                  {doctors.map((d) => (
                    <option key={d.id} value={d.id}>{d.name}{d.specialty ? ` — ${d.specialty}` : ""}</option>
                  ))}
                </select>
                {selectedDoctor && (
                  <div className="mt-2 flex items-center gap-2 rounded-xl border border-sky-500/20 bg-sky-500/8 px-3 py-2">
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-brand text-xs font-bold text-white">
                      {selectedDoctor.name?.[0]?.toUpperCase()}
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-sky-400">{selectedDoctor.name}</p>
                      <p className="text-[10px] text-[var(--text-muted)]">{selectedDoctor.specialty || selectedDoctor.email}</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Record selector — only shown after doctor is selected */}
              <AnimatePresence>
                {form.doctorId && (
                  <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                    <div className="mb-2 flex items-center justify-between">
                      <label className="text-xs font-semibold text-[var(--text-secondary)]">
                        Records to share
                        {selectedRecords.length > 0 && (
                          <span className="ml-2 badge badge-sky">{selectedRecords.length} selected</span>
                        )}
                      </label>
                      {doctorRecords.length > 0 && (
                        <button type="button"
                          onClick={() => setSelectedRecords(allSelected ? [] : doctorRecords.map((r) => r.id || r._id))}
                          className="text-[10px] font-semibold text-[var(--accent-strong)] hover:underline">
                          {allSelected ? "Deselect all" : "Select all"}
                        </button>
                      )}
                    </div>

                    {doctorRecords.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-[var(--border)] p-5 text-center">
                        <p className="text-2xl mb-1">📂</p>
                        <p className="text-xs text-[var(--text-muted)]">
                          No records uploaded yet.
                        </p>
                        <p className="text-[10px] text-[var(--text-muted)] mt-0.5">Upload records first, then choose which ones to share with {selectedDoctor?.name}.</p>
                      </div>
                    ) : (
                      <div className="rounded-2xl border border-[var(--border)] overflow-hidden divide-y divide-[var(--border)]">
                        {(showMoreRecords ? doctorRecords : doctorRecords.slice(0, 5)).map((rec) => {
                          const id      = rec.id || rec._id;
                          const checked = selectedRecords.includes(id);
                          return (
                            <label key={id}
                              className={`flex cursor-pointer items-center gap-3 px-4 py-3 transition-colors ${
                                checked ? "bg-sky-500/8" : "hover:bg-[var(--panel-strong)]"
                              }`}>
                              {/* Checkbox */}
                              <div className={`flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-md border-2 transition-all ${
                                checked ? "border-sky-400 bg-sky-500" : "border-[var(--border)]"
                              }`}>
                                {checked && <span className="text-[10px] font-bold text-white">✓</span>}
                              </div>
                              <input type="checkbox" className="hidden" checked={checked} onChange={() => toggleRecord(id)} />

                              {/* Record icon */}
                              <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-sky-500/10 text-base">
                                {typeIcon[rec.type?.toLowerCase()] || "📄"}
                              </div>

                              {/* Record info */}
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-xs font-semibold">{rec.fileName || rec.type || "Record"}</p>
                                <p className="text-[10px] text-[var(--text-muted)]">
                                  {rec.type} · {new Date(rec.recordDate || rec.date).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}
                                </p>
                              </div>

                              {rec.isEncrypted && <span className="badge badge-green flex-shrink-0">🔐</span>}
                              {checked && <span className="badge badge-sky flex-shrink-0">Sharing</span>}
                            </label>
                          );
                        })}
                        
                        {doctorRecords.length > 5 && (
                          <div className="px-4 py-3 text-center bg-[var(--panel-strong)]">
                            <button type="button" onClick={() => setShowMoreRecords(!showMoreRecords)}
                              className="text-xs font-semibold text-[var(--accent-strong)] hover:underline">
                              {showMoreRecords ? "Show less" : `Show ${doctorRecords.length - 5} more records`}
                            </button>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Access summary */}
                    {selectedRecords.length > 0 && (
                      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                        className="mt-2 rounded-xl border border-emerald-500/20 bg-emerald-500/8 px-3 py-2.5">
                        <p className="text-[10px] text-emerald-400 font-semibold">
                          ✓ {selectedRecords.length} record{selectedRecords.length !== 1 ? "s" : ""} will be shared with Dr. {selectedDoctor?.name} upon approval.
                          Only these records will be visible — no others.
                        </p>
                      </motion.div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Date/time fields */}
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-[var(--text-secondary)]">Appointment date & time</label>
                  <input type="datetime-local" required value={form.appointmentTime}
                    onChange={(e) => setForm((prev) => ({ ...prev, appointmentTime: e.target.value }))}
                    className="input-field" />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-[var(--text-secondary)]">Records expiry</label>
                  <input type="datetime-local" required value={form.accessExpiry}
                    onChange={(e) => setForm((prev) => ({ ...prev, accessExpiry: e.target.value }))}
                    className="input-field" />
                  <p className="mt-1 text-[10px] text-[var(--text-muted)]">Doctor loses access after this time.</p>
                </div>
              </div>

              {/* Reason */}
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-[var(--text-secondary)]">Reason</label>
                <input type="text" required value={form.reason}
                  onChange={(e) => setForm((prev) => ({ ...prev, reason: e.target.value }))}
                  placeholder="Describe the appointment reason"
                  className="input-field" />
              </div>

              {/* Patient note */}
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-[var(--text-secondary)]">Patient note</label>
                <textarea rows="4" value={form.patientNote}
                  onChange={(e) => setForm((prev) => ({ ...prev, patientNote: e.target.value }))}
                  placeholder="Add symptoms, concerns, or context for the doctor"
                  className="input-field min-h-[100px] resize-none" />
              </div>

              <motion.button type="submit" disabled={submitting || selectedRecords.length === 0}
                whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                className="w-full rounded-xl btn-brand py-3.5 text-sm font-semibold glow-sky disabled:opacity-40 disabled:cursor-not-allowed">
                {submitting
                  ? "Sending request…"
                  : selectedRecords.length === 0
                  ? "Select records to continue"
                  : `Send appointment request — ${selectedRecords.length} record${selectedRecords.length !== 1 ? "s" : ""} shared`}
              </motion.button>
            </form>
          </section>
        ) : (
          <section className="card p-4 sm:p-6">
            <h2 className="text-lg sm:text-xl font-black">Pending requests</h2>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">
              Approving activates the patient's timed record-access window.
            </p>
            <div className="mt-5 space-y-3">
              {pendingAppointments.map((a) => renderAppointmentCard(a, true))}
              {pendingAppointments.length === 0 && (
                <div className="rounded-xl border border-dashed border-[var(--border)] p-8 text-center text-sm text-[var(--text-muted)]">
                  No pending appointment requests.
                </div>
              )}
            </div>
          </section>
        )}

        {/* ── RIGHT: Appointment list ── */}
        <div className="space-y-5">
          <section className="card p-4 sm:p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4">
              <h2 className="text-lg sm:text-xl font-black">{isPatient ? "My appointments" : "Appointment history"}</h2>
              <span className="badge badge-sky mt-2 sm:mt-0">{appointments.length} total</span>
            </div>

            <AnimatePresence>
              {message.text && (
                <motion.p initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                  className={`mb-4 rounded-xl border px-4 py-3 text-sm ${msgStyle[message.type] || msgStyle.info}`}>
                  {message.text}
                </motion.p>
              )}
            </AnimatePresence>

            <div className="space-y-3">
              {visibleAppointments.map((a) => renderAppointmentCard(a, isPatient && a.status === "pending"))}
              {visibleAppointments.length === 0 && (
                <div className="rounded-xl border border-dashed border-[var(--border)] p-8 text-center text-sm text-[var(--text-muted)]">
                  No appointments yet.
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
    </DashboardShell>
  );
}
