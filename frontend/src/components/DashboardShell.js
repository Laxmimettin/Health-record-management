import { useEffect, useState } from "react";
import { NavLink } from "react-router-dom";
import { motion } from "framer-motion";
import NotificationBell from "./NotificationBell";
import ThemeToggle from "./ThemeToggle";
import api from "../lib/api";

function buildLinks(role) {
  if (role === "admin") {
    return [{ to: "/admin", label: "Doctor Management", icon: "🛠️", exact: true }];
  }
  if (role === "doctor") {
    return [
      { to: "/doctor",       label: "Dashboard",       icon: "🩺", exact: true },
      { to: "/appointments", label: "Appointments",    icon: "📅" },
      { to: "/access",       label: "Access Requests", icon: "🔑" },
      { to: "/audit",        label: "Audit Logs",      icon: "📜" },
    ];
  }
  return [
    { to: "/patient",      label: "Dashboard",         icon: "🏥", exact: true },
    { to: "/appointments", label: "Appointments",      icon: "📅" },
    { to: "/upload",       label: "Upload Records",    icon: "⬆️" },
    { to: "/access",       label: "Access Management", icon: "🔐" },
    { to: "/audit",        label: "Audit Logs",        icon: "📜" },
  ];
}

const roleColors = { admin: "badge-amber", patient: "badge-sky", doctor: "badge-violet" };

// Polls total unread message count for the sidebar badge
function useTotalUnread(role) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (role === "admin") return;

    const fetch = async () => {
      try {
        const res = await api.get("/access/mine");
        const approved = (res.data.accessList || []).filter(
          (a) => a.status === "approved" && new Date(a.expiry) > new Date(),
        );
        let total = 0;
        await Promise.all(
          approved.map(async (a) => {
            try {
              const r = await api.get(`/messages/${a.id || a._id}/unread/count`);
              total += r.data.count || 0;
            } catch {}
          }),
        );
        setCount(total);
      } catch {}
    };

    fetch();
    const id = setInterval(fetch, 10000);
    return () => clearInterval(id);
  }, [role]);

  return count;
}

export default function DashboardShell({ title, subtitle, user, theme, onToggleTheme, onLogout, children }) {
  const links       = buildLinks(user.role);
  const totalUnread = useTotalUnread(user.role);

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text-primary)] transition-colors duration-300">
      {/* Ambient background */}
      <div className="pointer-events-none fixed inset-0 bg-mesh opacity-60" />
      <div className="pointer-events-none fixed top-0 left-1/3 h-[500px] w-[500px] -translate-x-1/2 rounded-full bg-sky-500/10 blur-[120px]" />
      <div className="pointer-events-none fixed bottom-0 right-1/4 h-[400px] w-[400px] rounded-full bg-violet-500/8 blur-[100px]" />

      <div className="relative mx-auto flex min-h-screen max-w-[1400px] flex-col lg:flex-row">

        {/* ── SIDEBAR ── */}
        <aside className="glass-strong flex flex-col border-b border-[var(--border)] px-4 py-6 lg:min-h-screen lg:w-64 lg:border-b-0 lg:border-r xl:w-72">
          {/* Logo */}
          <div className="flex items-center gap-3 px-2">
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-brand text-lg glow-sky">
              🏥
            </div>
            <div>
              <p className="text-sm font-black text-gradient">SecureHealthVault</p>
              <p className="text-[11px] text-[var(--text-muted)]">Health data platform</p>
            </div>
          </div>

          {/* User card */}
          <div className="mt-6 rounded-2xl bg-gradient-to-br from-sky-500/10 to-violet-500/10 border border-[var(--border)] p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-brand text-base font-bold text-white">
                {user.name?.[0]?.toUpperCase() || "U"}
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{user.name}</p>
                <p className="truncate text-xs text-[var(--text-muted)]">{user.email}</p>
              </div>
            </div>
            <span className={`badge mt-3 ${roleColors[user.role] || "badge-slate"}`}>{user.role}</span>
          </div>

          {/* Nav links */}
          <nav className="mt-6 flex-1 space-y-1">
            {links.map((link, i) => (
              <motion.div key={link.to} initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.06 }}>
                <NavLink
                  to={link.to}
                  end={link.exact}
                  className={({ isActive }) => `nav-link ${isActive ? "active" : ""}`}
                >
                  <span className="text-base">{link.icon}</span>
                  <span>{link.label}</span>
                </NavLink>
              </motion.div>
            ))}

            {/* Suggestion Box — navigates to /chat page */}
            {user.role !== "admin" && (
              <motion.div initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: links.length * 0.06 }}>
                <NavLink
                  to="/chat"
                  className={({ isActive }) => `nav-link ${isActive ? "active" : ""}`}
                >
                  <span className="text-base">💬</span>
                  <span className="flex-1">Suggestion Box</span>
                  {totalUnread > 0 && (
                    <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-gradient-brand px-1 text-[10px] font-bold text-white animate-pulse-glow">
                      {totalUnread > 9 ? "9+" : totalUnread}
                    </span>
                  )}
                </NavLink>
              </motion.div>
            )}
          </nav>

          {/* Sign out */}
          <button
            type="button"
            onClick={onLogout}
            className="mt-6 flex w-full items-center gap-3 rounded-xl border border-rose-500/20 bg-rose-500/8 px-4 py-2.5 text-sm font-semibold text-rose-400 transition hover:bg-rose-500/15"
          >
            <span>🚪</span> Sign out
          </button>
        </aside>

        {/* ── MAIN ── */}
        <main className="flex-1 overflow-x-hidden px-4 py-6 sm:px-6 lg:px-8">
          <motion.header
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8 flex flex-col gap-4 rounded-2xl glass border border-[var(--border)] px-6 py-5 sm:flex-row sm:items-center sm:justify-between"
          >
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-[var(--text-muted)]">
                SecureHealthVault
              </p>
              <h1 className="mt-1 text-2xl font-black tracking-tight sm:text-3xl">{title}</h1>
              {subtitle && <p className="mt-1 max-w-xl text-sm text-[var(--text-secondary)]">{subtitle}</p>}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <ThemeToggle theme={theme} onToggle={onToggleTheme} />
              {user.role !== "admin" && <NotificationBell />}
            </div>
          </motion.header>

          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            {children}
          </motion.div>
        </main>
      </div>
    </div>
  );
}
