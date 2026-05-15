import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import DashboardShell from "../components/DashboardShell";
import api from "../lib/api";

const typeIcon  = { report: "📋", lab: "🧪", prescription: "💊", xray: "🩻", other: "📄" };
const typeBadge = { report: "badge-sky", lab: "badge-violet", prescription: "badge-green", xray: "badge-amber", other: "badge-slate" };

function StatCard({ icon, label, value, sub, color, delay }) {
  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay }} className="card p-5">
      <div className={`mb-4 flex h-11 w-11 items-center justify-center rounded-xl text-xl ${color}`}>{icon}</div>
      <p className="text-3xl font-black">{value}</p>
      <p className="mt-1 text-sm font-semibold text-[var(--text-primary)]">{label}</p>
      <p className="mt-1 text-xs text-[var(--text-muted)]">{sub}</p>
    </motion.div>
  );
}

export default function PatientDashboard({ user, theme, onToggleTheme, onLogout }) {
  const [records, setRecords]             = useState([]);
  const [accessList, setAccessList]       = useState([]);
  const [pendingReqs, setPendingReqs]     = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [appointments, setAppointments]   = useState([]);
  const [query, setQuery]                 = useState("");
  const [showMoreRecords, setShowMoreRecords] = useState(false);
  const [showMoreAccess, setShowMoreAccess] = useState(false);
  const [showMoreAppts, setShowMoreAppts] = useState(false);
  const [showMoreAlerts, setShowMoreAlerts] = useState(false);

  useEffect(() => {
    Promise.all([
      api.get("/records"),
      api.get("/access/mine"),
      api.get("/access/requests"),
      api.get("/notifications"),
      api.get("/appointments/mine"),
    ]).then(([r, a, p, n, ap]) => {
      setRecords(r.data.records || []);
      setAccessList(a.data.accessList || []);
      setPendingReqs(p.data.requests || []);
      setNotifications(n.data.notifications || []);
      setAppointments(ap.data.appointments || []);
    }).catch(() => {});
  }, []);

  const filtered = useMemo(() => {
    const t = query.trim().toLowerCase();
    if (!t) return records;
    return records.filter((r) => [r.type, r.doctorName, r.fileName].some((v) => v?.toLowerCase().includes(t)));
  }, [records, query]);

  const activePerms    = accessList.filter((a) => a.status === "approved");
  const threatAlerts   = notifications.filter((n) => n.type === "warning");
  const encryptedCount = records.filter((r) => r.isEncrypted).length;
  const pendingAppts   = appointments.filter((a) => a.status === "pending");

  const openRecord = async (recordId) => {
    try {
      const res = await api.get(`/records/${recordId}/view`, { responseType: "blob" });
      window.open(URL.createObjectURL(res.data), "_blank", "noopener,noreferrer");
    } catch {}
  };

  return (
    <DashboardShell title="Patient Dashboard"
      subtitle="Your records are end-to-end encrypted. Only you and doctors you approve can decrypt them."
      user={user} theme={theme} onToggleTheme={onToggleTheme} onLogout={onLogout}>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon="📋" label="Total Records"      value={records.length}                        sub="All medical files"              color="bg-sky-500/12"     delay={0.05} />
        <StatCard icon="🔐" label="Encrypted Records"  value={encryptedCount}                        sub="AES-256-GCM protected"          color="bg-emerald-500/12" delay={0.10} />
        <StatCard icon="🔑" label="Active Permissions" value={activePerms.length}                    sub="Doctors with approved access"   color="bg-violet-500/12"  delay={0.15} />
        <StatCard icon="⏳" label="Pending Requests"   value={pendingReqs.length + pendingAppts.length} sub="Doctor requests & appointments" color="bg-amber-500/12"   delay={0.20} />
      </div>

      {/* Main grid */}
      <div className="mt-6 grid gap-6 xl:grid-cols-[1.3fr_0.7fr]">

        {/* Records */}
        <section className="card p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-black">Health records</h2>
              <p className="text-sm text-[var(--text-secondary)]">All files encrypted before storage.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <input value={query} onChange={(e) => setQuery(e.target.value)}
                placeholder="Search records…" className="input-field text-xs sm:w-52" />
              <Link to="/upload" className="rounded-xl btn-brand px-4 py-2 text-xs glow-sky whitespace-nowrap">
                🔐 Upload
              </Link>
            </div>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            {(showMoreRecords ? filtered : filtered.slice(0, 6)).map((rec, i) => (
              <motion.article key={rec.id || rec._id}
                initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
                className="card-flat p-5 transition hover:border-[var(--border-hover)]">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-sky-500/10 text-xl">
                    {typeIcon[rec.type?.toLowerCase()] || "📄"}
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className={`badge ${typeBadge[rec.type?.toLowerCase()] || "badge-slate"}`}>{rec.type}</span>
                      {rec.isEncrypted && <span className="badge badge-green">🔐 Encrypted</span>}
                    </div>
                    <h3 className="mt-1 text-sm font-bold leading-tight">{rec.fileName || "Record"}</h3>
                  </div>
                </div>
                <div className="mt-3 space-y-1 text-xs text-[var(--text-secondary)]">
                  <p>👨⚕️ Dr. {rec.doctorName}</p>
                  <p>📅 {new Date(rec.recordDate || rec.date).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}</p>
                </div>
                <button type="button" onClick={() => openRecord(rec.id || rec._id)}
                  className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-[var(--accent-strong)] hover:underline">
                  📎 Open record →
                </button>
              </motion.article>
            ))}
            
            {filtered.length > 6 && (
              <div className="col-span-2 text-center">
                <button type="button" onClick={() => setShowMoreRecords(!showMoreRecords)}
                  className="rounded-xl btn-ghost px-4 py-2 text-xs font-semibold">
                  {showMoreRecords ? "Show less" : `Show ${filtered.length - 6} more records`}
                </button>
              </div>
            )}

            {filtered.length === 0 && (
              <div className="col-span-2 rounded-2xl border border-dashed border-[var(--border)] p-10 text-center">
                <p className="text-3xl mb-2">📂</p>
                <p className="text-sm font-semibold">No records found</p>
                <p className="mt-1 text-xs text-[var(--text-muted)]">
                  {query ? "Try a different search term." : "Upload your first encrypted record."}
                </p>
                {!query && <Link to="/upload" className="mt-4 inline-flex rounded-xl btn-brand px-5 py-2 text-xs glow-sky">🔐 Upload now →</Link>}
              </div>
            )}
          </div>
        </section>

        {/* Right column */}
        <div className="space-y-5">
          {/* Access overview */}
          <section className="card p-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-black">Access overview</h2>
              <Link to="/access" className="text-xs font-semibold text-[var(--accent-strong)] hover:underline">Manage →</Link>
            </div>
            <div className="mt-4 space-y-3">
              {(showMoreAccess ? activePerms : activePerms.slice(0, 3)).map((p) => (
                <div key={p.id || p._id} className="card-flat p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-violet-500/12 text-sm">👨⚕️</div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{p.doctor?.name}</p>
                      <p className="truncate text-xs text-[var(--text-muted)]">{p.doctor?.specialty}</p>
                    </div>
                    <span className="badge badge-green">Active</span>
                  </div>
                  <p className="mt-2 text-[10px] text-[var(--text-muted)]">Expires {new Date(p.expiry).toLocaleString()}</p>
                </div>
              ))}
              {activePerms.length > 3 && (
                <div className="text-center">
                  <button type="button" onClick={() => setShowMoreAccess(!showMoreAccess)}
                    className="text-xs font-semibold text-[var(--accent-strong)] hover:underline">
                    {showMoreAccess ? "Show less" : `Show ${activePerms.length - 3} more`}
                  </button>
                </div>
              )}
              {activePerms.length === 0 && (
                <div className="rounded-xl border border-dashed border-[var(--border)] p-5 text-center text-xs text-[var(--text-muted)]">
                  No doctors have active access.
                </div>
              )}
            </div>
          </section>

          {/* Appointments */}
          <section className="card p-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-black">Appointments</h2>
              <Link to="/appointments" className="text-xs font-semibold text-[var(--accent-strong)] hover:underline">Open →</Link>
            </div>
            <div className="mt-4 space-y-3">
              {(showMoreAppts ? appointments : appointments.slice(0, 2)).map((apt) => (
                <div key={apt.id} className="card-flat p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold">{apt.doctor?.name || "Doctor"}</p>
                      <p className="text-xs text-[var(--text-muted)]">{apt.doctor?.specialty || apt.doctor?.email}</p>
                    </div>
                    <span className={`badge ${apt.status === "approved" ? "badge-green" : apt.status === "rejected" ? "badge-rose" : apt.status === "cancelled" ? "badge-slate" : "badge-amber"}`}>
                      {apt.status}
                    </span>
                  </div>
                  <p className="mt-2 text-[10px] text-[var(--text-muted)]">
                    {new Date(apt.appointmentTime).toLocaleString()}
                  </p>
                </div>
              ))}
              {appointments.length > 2 && (
                <div className="text-center">
                  <button type="button" onClick={() => setShowMoreAppts(!showMoreAppts)}
                    className="text-xs font-semibold text-[var(--accent-strong)] hover:underline">
                    {showMoreAppts ? "Show less" : `Show ${appointments.length - 2} more`}
                  </button>
                </div>
              )}
              {appointments.length === 0 && (
                <div className="rounded-xl border border-dashed border-[var(--border)] p-5 text-center text-xs text-[var(--text-muted)]">
                  No appointments yet.
                </div>
              )}
            </div>
          </section>

          {/* Security */}
          <section className="card p-6">
            <h2 className="text-lg font-black">Security status</h2>
            <div className="mt-4 space-y-3">
              <div className="flex items-center gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/8 p-3">
                <span className="text-lg">🔐</span>
                <div>
                  <p className="text-xs font-semibold text-emerald-400">Encrypted storage active</p>
                  <p className="text-[10px] text-[var(--text-muted)]">Records opened only for approved access windows</p>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/8 p-3">
                <span className="text-lg">🛡️</span>
                <div>
                  <p className="text-xs font-semibold text-emerald-400">Timeline-based doctor access</p>
                  <p className="text-[10px] text-[var(--text-muted)]">Doctors can open records only within the active window</p>
                </div>
              </div>
              {(showMoreAlerts ? threatAlerts : threatAlerts.slice(0, 2)).map((a) => (
                <div key={a.id || a._id} className="rounded-xl border border-rose-500/20 bg-rose-500/8 p-3">
                  <div className="flex items-start gap-2">
                    <span className="text-lg mt-0.5">⚠️</span>
                    <div className="flex-1">
                      <p className="text-xs font-semibold text-rose-400">{a.title}</p>
                      <div className="mt-1 text-[10px] text-rose-300 whitespace-pre-line leading-relaxed">
                        {a.message}
                      </div>
                    </div>
                  </div>
                </div>
              ))}}
              {threatAlerts.length > 2 && (
                <div className="text-center">
                  <button type="button" onClick={() => setShowMoreAlerts(!showMoreAlerts)}
                    className="text-xs font-semibold text-rose-400 hover:underline">
                    {showMoreAlerts ? "Show less" : `Show ${threatAlerts.length - 2} more alerts`}
                  </button>
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
    </DashboardShell>
  );
}
