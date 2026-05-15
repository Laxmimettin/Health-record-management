import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import api from "../lib/api";

const typeStyle = {
  info:    { badge: "badge-sky",    dot: "bg-sky-400",    icon: "ℹ️" },
  access:  { badge: "badge-amber",  dot: "bg-amber-400",  icon: "🔑" },
  success: { badge: "badge-green",  dot: "bg-emerald-400",icon: "✅" },
  warning: { badge: "badge-rose",   dot: "bg-rose-400",   icon: "⚠️" },
};

export default function NotificationBell() {
  const [notifications, setNotifications] = useState([]);
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    api.get("/notifications")
      .then((res) => setNotifications(res.data.notifications || []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    const close = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const unread = useMemo(() => notifications.filter((n) => !n.read).length, [notifications]);

  const markAllRead = async () => {
    try {
      await api.patch("/notifications/read-all");
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    } catch {}
  };

  return (
    <div className="relative" ref={ref}>
      <motion.button
        type="button"
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.92 }}
        onClick={() => setOpen((v) => !v)}
        className="relative flex h-9 w-9 items-center justify-center rounded-xl btn-ghost text-base"
      >
        🔔
        {unread > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[9px] font-bold text-white animate-pulse-glow">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.96 }}
            transition={{ duration: 0.18 }}
            className="absolute right-0 top-12 z-50 w-80 glass-strong rounded-2xl shadow-2xl overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3">
              <div>
                <p className="text-sm font-bold">Notifications</p>
                <p className="text-xs text-[var(--text-muted)]">Security & access events</p>
              </div>
              {unread > 0 && (
                <button type="button" onClick={markAllRead} className="text-xs font-semibold text-[var(--accent-strong)] hover:underline">
                  Mark all read
                </button>
              )}
            </div>

            {/* List */}
            <div className="max-h-80 overflow-y-auto p-3 space-y-2">
              {notifications.length === 0 ? (
                <div className="rounded-xl border border-dashed border-[var(--border)] px-4 py-8 text-center">
                  <p className="text-2xl mb-1">🔕</p>
                  <p className="text-xs text-[var(--text-muted)]">No notifications yet</p>
                </div>
              ) : notifications.map((n) => {
                const s = typeStyle[n.type] || typeStyle.info;
                return (
                  <div key={n.id || n._id}
                    className={`card-flat p-3 transition ${n.read ? "opacity-60" : ""}`}>
                    <div className="flex items-start gap-2.5">
                      <span className="mt-0.5 text-sm">{s.icon}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-xs font-semibold truncate">{n.title || "Alert"}</p>
                          {!n.read && <span className={`h-2 w-2 flex-shrink-0 rounded-full ${s.dot}`} />}
                        </div>
                        <p className="mt-0.5 text-xs text-[var(--text-secondary)] line-clamp-2">{n.message}</p>
                        <p className="mt-1 text-[10px] text-[var(--text-muted)]">{new Date(n.time).toLocaleString()}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
