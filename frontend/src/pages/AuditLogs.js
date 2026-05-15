import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import DashboardShell from "../components/DashboardShell";
import api from "../lib/api";

const categoryStyle = {
  login:   { dot: "bg-sky-400",     badge: "badge-sky",    icon: "🔐" },
  upload:  { dot: "bg-emerald-400", badge: "badge-green",  icon: "⬆️" },
  access:  { dot: "bg-violet-400",  badge: "badge-violet", icon: "🔑" },
  view:    { dot: "bg-amber-400",   badge: "badge-amber",  icon: "👁️" },
  threat:  { dot: "bg-rose-400",    badge: "badge-rose",   icon: "⚠️" },
  warning: { dot: "bg-orange-400",  badge: "badge-amber",  icon: "🚨" },
};

const severityBadge = {
  info:     "badge-sky",
  low:      "badge-green",
  medium:   "badge-amber",
  high:     "badge-rose",
  critical: "badge-rose",
};

const filters = ["all", "login", "upload", "access", "view", "threat", "warning"];

function formatThreatTimestamp(dateValue) {
  return new Date(dateValue)
    .toLocaleString("en-US", {
      month: "numeric",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
    })
    .replace(" AM", " am")
    .replace(" PM", " pm");
}

function formatDetails(details) {
  if (!details) {
    return "";
  }

  if (typeof details === "string") {
    return details;
  }

  if (typeof details === "object") {
    // Special formatting for threat details
    if (details.threatType) {
      const parts = [];
      if (details.method) parts.push(`Method: ${details.method}`);
      if (details.context?.recordId) parts.push(`Record: ${details.context.recordId}`);
      if (details.context?.patientId) parts.push(`Patient ID: ${details.context.patientId}`);
      if (details.ip) parts.push(`IP: ${details.ip}`);
      return parts.join(" | ");
    }
    
    return Object.entries(details)
      .map(([key, value]) => `${key}: ${typeof value === "object" ? JSON.stringify(value) : value}`)
      .join(" | ");
  }

  return String(details);
}

export default function AuditLogs({ user, theme, onToggleTheme, onLogout }) {
  const [logs, setLogs]     = useState([]);
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [showMoreLogs, setShowMoreLogs] = useState(false);
  const [threatStats, setThreatStats] = useState({ totalThreats: 0, threats: [] });

  useEffect(() => {
    // Load audit logs
    api.get("/audit")
      .then((res) => setLogs(res.data.logs || []))
      .catch(() => {})
      .finally(() => setLoading(false));
      
    // Load threat statistics only for patients (since threats are logged under patient accounts)
    if (user.role === 'patient') {
      api.get(`/audit/threats/patient/${user.id}`)
        .then((res) => setThreatStats({ threats: res.data.threats || [], totalThreats: res.data.threats?.length || 0 }))
        .catch(() => {});
    }
  }, [user.role, user.id]);

  const filtered = useMemo(() => {
    if (filter === "all") return logs;
    return logs.filter((l) => l.category === filter || l.severity === filter);
  }, [filter, logs]);

  // Count threats in logs
  const threatCount = user.role === "patient"
    ? Math.max(
        threatStats.totalThreats || 0,
        logs.filter((l) => l.category === "threat" || l.category === "warning").length,
      )
    : logs.filter((l) => l.category === "threat" || l.category === "warning").length;

  return (
    <DashboardShell title="Audit Logs"
      subtitle="Every login, permission change, file upload, and record access is tracked in a timeline for compliance visibility."
      user={user} theme={theme} onToggleTheme={onToggleTheme} onLogout={onLogout}>

      {/* Threat Alert Banner - Only show for patients */}
      {user.role === 'patient' && threatCount > 0 && (
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 rounded-xl border border-rose-500/20 bg-rose-500/10 p-4"
        >
          <div className="flex items-center gap-3">
            <motion.div
              animate={{ rotate: [0, 10, -10, 0] }}
              transition={{ duration: 1, repeat: Infinity }}
              className="text-2xl"
            >
              🚨
            </motion.div>
            <div>
              <h3 className="font-bold text-rose-400">Security Threats Detected on Your Records</h3>
              <p className="text-sm text-rose-300">
                {threatCount} security threat{threatCount !== 1 ? 's' : ''} detected on your medical records. 
                These include screenshot attempts or unauthorized access by doctors.
              </p>
            </div>
            <div className="ml-auto text-right">
              <div className="text-lg font-bold text-rose-400">{threatCount}</div>
              <div className="text-xs text-rose-300">Total threats</div>
            </div>
          </div>
        </motion.div>
      )}

      {/* Filter pills */}
      <div className="mb-6 flex flex-wrap gap-2">
        {filters.map((f) => {
          const count = logs.filter((l) => f === 'all' || l.category === f || l.severity === f).length;
          return (
            <motion.button key={f} type="button" whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
              onClick={() => setFilter(f)}
              className={`rounded-xl px-3 sm:px-4 py-2 text-xs font-semibold capitalize transition-all ${
                filter === f
                  ? "btn-brand glow-sky"
                  : "btn-ghost"
              }`}>
              {categoryStyle[f]?.icon || "📋"} <span className="hidden sm:inline">{f === "all" ? "All events" : f}</span>
              {filter !== f && count > 0 && (
                <span className={`ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] ${
                  f === 'threat' || f === 'warning' ? 'bg-rose-500/20 text-rose-400' : 'bg-white/10'
                }`}>
                  {count}
                </span>
              )}
            </motion.button>
          );
        })}
        <span className="ml-auto self-center text-xs text-[var(--text-muted)] hidden sm:block">
          {filtered.length} event{filtered.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Timeline */}
      <div className="card p-4 sm:p-6">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="spinner scale-150" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[var(--border)] p-8 sm:p-12 text-center">
            <p className="text-3xl sm:text-4xl mb-3">📭</p>
            <p className="font-semibold">No audit events</p>
            <p className="mt-1 text-sm text-[var(--text-muted)]">No events match the selected filter.</p>
          </div>
        ) : (
          <div className="relative pl-6 sm:pl-8">
            {/* Vertical line */}
            <div className="timeline-line" />

            <div className="space-y-4">
              {(showMoreLogs ? filtered : filtered.slice(0, 10)).map((log, i) => {
                const s = categoryStyle[log.category] || categoryStyle.login;
                const isThreat = log.category === 'threat' || log.category === 'warning';
                
                return (
                  <motion.div key={log.id || log._id || i}
                    initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.03 }}
                    className={`relative ${isThreat ? 'threat-entry' : ''}`}>
                    {/* Dot */}
                    <span className={`timeline-dot ${s.dot} ${isThreat ? 'animate-pulse' : ''}`} />

                    <div className={`card-flat p-3 sm:p-4 transition hover:border-[var(--border-hover)] ${
                      isThreat ? 'border-rose-500/20 bg-rose-500/5' : ''
                    }`}>
                      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                        <div className="flex items-start gap-3">
                          <motion.span 
                            className="mt-0.5 text-base"
                            animate={isThreat ? { rotate: [0, 10, -10, 0] } : {}}
                            transition={isThreat ? { duration: 2, repeat: Infinity } : {}}
                          >
                            {s.icon}
                          </motion.span>
                          <div>
                            <p className={`font-semibold text-sm ${
                              isThreat ? 'text-rose-400' : ''
                            }`}>{log.action}</p>
                            <div className="mt-1.5 flex flex-wrap gap-1.5">
                              {log.category && <span className={`badge ${s.badge}`}>{log.category}</span>}
                              {log.severity && <span className={`badge ${severityBadge[log.severity] || "badge-slate"}`}>{log.severity}</span>}
                              {isThreat && (
                                <span className="badge badge-rose animate-pulse">🚨 BLOCKED</span>
                              )}
                            </div>
                          </div>
                        </div>
                        <p className="text-xs text-[var(--text-muted)] whitespace-nowrap">
                          {new Date(log.time).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                        </p>
                      </div>
                      {log.details && (
                        <p className={`mt-2 pl-5 sm:pl-7 text-xs ${
                          isThreat ? 'text-rose-300' : 'text-[var(--text-secondary)]'
                        }`}>
                          {formatDetails(log.details)}
                        </p>
                      )}
                      
                      {/* Special threat information */}
                      {isThreat && log.details?.threatType === 'SCREENSHOT_ATTEMPT' && (
                        <div className="mt-3 pl-5 sm:pl-7">
                          <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-3">
                            <div className="flex items-start gap-2">
                              <span className="text-lg">📸</span>
                              <div>
                                <p className="text-xs font-semibold text-rose-400 mb-2">Screenshot Attempt Details:</p>
                                <div className="text-xs text-rose-300 space-y-1">
                                  <p className="font-medium">
                                    Dr. {log.details.doctorName || 'Unknown'} {log.details.method === 'printscreen' ? 'pressed PrintScreen' : log.details.method === 'keyboard_shortcut' || log.details.method === 'keyboard' ? 'pressed a keyboard shortcut' : log.details.method === 'screenshare' ? 'attempted screen sharing' : 'attempted to capture'} while viewing your record "{log.details.context?.recordId || 'Unknown Record'}"
                                  </p>
                                  <p>The content was hidden automatically.</p>
                                  <p className="text-rose-400 font-medium mt-2">
                                    {formatThreatTimestamp(log.time)}
                                  </p>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </motion.div>
                );
              })}
              
              {filtered.length > 10 && (
                <div className="text-center pt-4">
                  <button type="button" onClick={() => setShowMoreLogs(!showMoreLogs)}
                    className="rounded-xl btn-ghost px-4 py-2 text-xs font-semibold">
                    {showMoreLogs ? "Show less" : `Show ${filtered.length - 10} more events`}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </DashboardShell>
  );
}
