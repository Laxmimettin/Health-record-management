import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import DashboardShell from "../components/DashboardShell";
import api from "../lib/api";

const recordTypes = [
  { value: "report",       label: "Report",      icon: "📋" },
  { value: "lab",          label: "Lab",          icon: "🧪" },
  { value: "prescription", label: "Prescription", icon: "💊" },
  { value: "xray",         label: "X-Ray",        icon: "🩻" },
  { value: "other",        label: "Other",        icon: "📄" },
];

export default function UploadPage({ user, theme, onToggleTheme, onLogout }) {
  const navigate = useNavigate();
  const [form, setForm]           = useState({ type: "report", date: "", recordExpiry: "", file: null });
  const [selectedDoctors, setSelectedDoctors] = useState([]);   // array of doctor ids
  const [doctors, setDoctors]     = useState([]);
  const [message, setMessage]     = useState({ text: "", ok: null });
  const [loading, setLoading]     = useState(false);
  const [dragOver, setDragOver]   = useState(false);
  const [showMoreDoctors, setShowMoreDoctors] = useState(false);

  useEffect(() => {
    api.get("/access/directory/doctors", { params: { q: "" } })
      .then((res) => setDoctors(res.data.doctors || []))
      .catch(() => {});
  }, []);

  const toggleDoctor = (id) => {
    setSelectedDoctors((prev) =>
      prev.includes(id) ? prev.filter((d) => d !== id) : [...prev, id],
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.file || selectedDoctors.length === 0) return;
    setLoading(true);
    setMessage({ text: "", ok: null });

    try {
      const fd = new FormData();
      fd.append("file",           form.file, form.file.name);
      fd.append("type",           form.type);
      fd.append("date",           form.date);
      fd.append("allowedDoctors", JSON.stringify(selectedDoctors));
      // doctorId = first selected (for legacy compat)
      fd.append("doctorId",       selectedDoctors[0]);
      if (form.recordExpiry) fd.append("recordExpiry", form.recordExpiry);

      await api.post("/records/upload", fd, { headers: { "Content-Type": "multipart/form-data" } });

      setMessage({ text: "Record uploaded successfully!", ok: true });
      setTimeout(() => navigate("/patient"), 1200);
    } catch (err) {
      setMessage({ text: err.response?.data?.msg || "Upload failed.", ok: false });
    } finally {
      setLoading(false);
    }
  };

  // Group doctors by specialty
  const bySpecialty = doctors.reduce((acc, d) => {
    const key = d.specialty || "General";
    if (!acc[key]) acc[key] = [];
    acc[key].push(d);
    return acc;
  }, {});

  const selectedType = recordTypes.find((t) => t.value === form.type);
  const allSelected  = doctors.length > 0 && selectedDoctors.length === doctors.length;

  return (
    <DashboardShell title="Upload Health Record"
      subtitle="Choose which doctors can access this record and set an optional per-record expiry."
      user={user} theme={theme} onToggleTheme={onToggleTheme} onLogout={onLogout}>

      <div className="mx-auto max-w-4xl">

        {/* Info banner */}
        <div className="mb-5 flex items-start gap-3 rounded-2xl border border-sky-500/20 bg-sky-500/8 px-4 sm:px-5 py-4">
          <span className="text-lg sm:text-xl mt-0.5">🔐</span>
          <div>
            <p className="text-sm font-semibold text-sky-400">Per-record access control</p>
            <p className="text-xs text-[var(--text-secondary)] mt-0.5">
              Only the doctors you select below can view this record — even if other doctors have general access approval.
              You can also set a record-level expiry independent of the access window.
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="card p-6 sm:p-8 space-y-6 sm:space-y-7">

          {/* Record type */}
          <div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-[var(--text-muted)]">Record type</p>
            <div className="flex flex-wrap gap-2">
              {recordTypes.map((t) => (
                <button key={t.value} type="button" onClick={() => setForm({ ...form, type: t.value })}
                  className={`flex items-center gap-2 rounded-xl border px-3 sm:px-4 py-2.5 text-sm font-semibold transition-all ${
                    form.type === t.value
                      ? "border-sky-400/60 bg-sky-500/12 text-sky-400"
                      : "border-[var(--border)] bg-[var(--panel)] text-[var(--text-secondary)] hover:border-[var(--border-hover)]"
                  }`}>
                  <span>{t.icon}</span> <span className="hidden sm:inline">{t.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Date + Record expiry */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-[var(--text-secondary)]">Record date</label>
              <input type="date" value={form.date} required
                onChange={(e) => setForm({ ...form, date: e.target.value })}
                className="input-field" />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-[var(--text-secondary)]">
                Record access expiry
                <span className="ml-1 font-normal text-[var(--text-muted)]">(optional)</span>
              </label>
              <input type="datetime-local" value={form.recordExpiry}
                onChange={(e) => setForm({ ...form, recordExpiry: e.target.value })}
                className="input-field" />
              <p className="mt-1 text-[10px] text-[var(--text-muted)]">
                After this time, no doctor can open this record regardless of access approval.
              </p>
            </div>
          </div>

          {/* Doctor selection */}
          <div>
            <div className="mb-3 flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-widest text-[var(--text-muted)]">
                Doctors who can view this record
                {selectedDoctors.length > 0 && (
                  <span className="ml-2 badge badge-sky normal-case tracking-normal">
                    {selectedDoctors.length} selected
                  </span>
                )}
              </p>
              {doctors.length > 0 && (
                <button type="button"
                  onClick={() => setSelectedDoctors(allSelected ? [] : doctors.map((d) => d.id))}
                  className="text-xs font-semibold text-[var(--accent-strong)] hover:underline">
                  {allSelected ? "Deselect all" : "Select all"}
                </button>
              )}
            </div>

            {doctors.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-[var(--border)] p-6 text-center text-sm text-[var(--text-muted)]">
                No verified doctors registered yet.
              </div>
            ) : (
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--panel)] divide-y divide-[var(--border)] overflow-hidden">
                {Object.entries(bySpecialty).sort(([a], [b]) => a.localeCompare(b)).map(([specialty, docs]) => {
                  const visibleDocs = showMoreDoctors ? docs : docs.slice(0, 3);
                  const hasMore = docs.length > 3;
                  
                  return (
                    <div key={specialty}>
                      {/* Specialty group header */}
                      <div className="px-4 py-2 bg-[var(--panel-strong)]">
                        <div className="flex items-center justify-between">
                          <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">
                            🩺 {specialty}
                          </p>
                          {hasMore && (
                            <button type="button"
                              onClick={() => setShowMoreDoctors(!showMoreDoctors)}
                              className="text-[9px] font-semibold text-[var(--accent-strong)] hover:underline">
                              {showMoreDoctors ? "Show less" : `+${docs.length - 3} more`}
                            </button>
                          )}
                        </div>
                      </div>
                      {visibleDocs.map((d) => {
                        const checked = selectedDoctors.includes(d.id);
                        return (
                          <label key={d.id}
                            className={`flex cursor-pointer items-center gap-3 px-4 py-3 transition-colors ${
                              checked ? "bg-sky-500/8" : "hover:bg-[var(--panel-strong)]"
                            }`}>
                            {/* Custom checkbox */}
                            <div className={`flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-md border-2 transition-all ${
                              checked
                                ? "border-sky-400 bg-sky-500"
                                : "border-[var(--border)] bg-transparent"
                            }`}>
                              {checked && <span className="text-[10px] font-bold text-white">✓</span>}
                            </div>
                            <input type="checkbox" className="hidden" checked={checked}
                              onChange={() => toggleDoctor(d.id)} />

                            {/* Doctor info */}
                            <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-gradient-brand text-xs font-bold text-white">
                              {d.name?.[0]?.toUpperCase()}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-semibold">{d.name}</p>
                              <p className="text-xs text-[var(--text-muted)]">{d.email}</p>
                            </div>
                            {checked && <span className="badge badge-sky flex-shrink-0">Selected</span>}
                          </label>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            )}

            {selectedDoctors.length === 0 && (
              <p className="mt-2 text-xs text-rose-400">⚠️ Select at least one doctor to continue.</p>
            )}
          </div>

          {/* Access summary */}
          <AnimatePresence>
            {selectedDoctors.length > 0 && (
              <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                className="rounded-xl border border-emerald-500/20 bg-emerald-500/8 px-4 py-3">
                <p className="text-xs font-semibold text-emerald-400 mb-1">Access summary</p>
                <p className="text-xs text-[var(--text-secondary)]">
                  This record will be visible to{" "}
                  <span className="font-semibold text-emerald-400">
                    {selectedDoctors.map((id) => {
                      const d = doctors.find((x) => x.id === id);
                      return d ? `Dr. ${d.name}` : id;
                    }).join(", ")}
                  </span>
                  {form.recordExpiry
                    ? ` until ${new Date(form.recordExpiry).toLocaleString()}.`
                    : " within their approved access window."}
                </p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* File upload */}
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-[var(--text-secondary)]">Document file</label>
            <label
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) setForm({ ...form, file: f }); }}
              className={`flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed p-10 text-center transition-all duration-200 ${
                dragOver ? "border-sky-400 bg-sky-500/10"
                : form.file ? "border-emerald-400/50 bg-emerald-500/8"
                : "border-[var(--border)] hover:border-sky-400/40 hover:bg-sky-500/5"
              }`}>
              <input type="file" accept=".pdf,image/*" className="hidden" required
                onChange={(e) => setForm({ ...form, file: e.target.files?.[0] || null })} />
              <AnimatePresence mode="wait">
                {form.file ? (
                  <motion.div key="file" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}>
                    <p className="text-4xl mb-2">✅</p>
                    <p className="text-sm font-bold text-emerald-400">{form.file.name}</p>
                    <p className="mt-1 text-xs text-[var(--text-muted)]">{(form.file.size / 1024).toFixed(1)} KB · Click to change</p>
                  </motion.div>
                ) : (
                  <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                    <p className="text-4xl mb-2">{selectedType?.icon || "📁"}</p>
                    <p className="text-sm font-semibold">Drag & drop or <span className="text-[var(--accent-strong)]">browse</span></p>
                    <p className="mt-1 text-xs text-[var(--text-muted)]">PDF, JPG, PNG — up to 10 MB</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </label>
          </div>

          <AnimatePresence>
            {message.text && (
              <motion.p initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                className={`rounded-xl border px-4 py-3 text-sm ${
                  message.ok
                    ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-400"
                    : "border-rose-500/20 bg-rose-500/10 text-rose-400"
                }`}>
                {message.ok ? "✅" : "⚠️"} {message.text}
              </motion.p>
            )}
          </AnimatePresence>

          <motion.button type="submit"
            disabled={loading || !form.file || selectedDoctors.length === 0}
            whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
            className="flex w-full items-center justify-center gap-2 rounded-xl btn-brand py-3.5 text-sm glow-sky disabled:opacity-40 disabled:cursor-not-allowed">
            {loading
              ? <><span className="spinner" /> Uploading…</>
              : <span className="text-center">🔐 Upload record — visible to {selectedDoctors.length || 0} doctor{selectedDoctors.length !== 1 ? "s" : ""}</span>}
          </motion.button>
        </form>
      </div>
    </DashboardShell>
  );
}
