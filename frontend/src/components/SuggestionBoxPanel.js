import { useCallback, useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import ChatBox from "./ChatBox";
import api from "../lib/api";

export default function SuggestionBoxPanel({ user, title = "Suggestion Box", subtitle = "Send and receive messages within the active access window.", className = "" }) {
  const [accessList, setAccessList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState(null);
  const [unreadMap, setUnreadMap] = useState({});
  const selectionKey = `suggestion-box:${user.role}:${user.id}:selected-access`;

  const loadAccessList = useCallback(async () => {
    const res = await api.get("/access/mine");
    const approved = (res.data.accessList || []).filter(
      (a) => a.status === "approved" && new Date(a.expiry) > new Date(),
    );

    setAccessList(approved);
    setSelectedId((current) => {
      const stored = localStorage.getItem(selectionKey);
      const preferred = current || stored;
      const hasPreferred = approved.some((a) => (a.id || a._id) === preferred);
      return hasPreferred ? preferred : (approved[0]?.id || approved[0]?._id || null);
    });
  }, [selectionKey]);

  const fetchUnread = useCallback(async (items) => {
    const counts = {};
    await Promise.all(
      items.map(async (a) => {
        try {
          const res = await api.get(`/messages/${a.id || a._id}/unread/count`);
          counts[a.id || a._id] = res.data.count || 0;
        } catch {
          counts[a.id || a._id] = 0;
        }
      }),
    );
    setUnreadMap(counts);
  }, []);

  useEffect(() => {
    let mounted = true;

    loadAccessList()
      .then(() => {
        if (!mounted) return;
      })
      .catch(() => {
        if (mounted) {
          setAccessList([]);
          setSelectedId(null);
        }
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [loadAccessList]);

  useEffect(() => {
    if (accessList.length === 0) return undefined;

    fetchUnread(accessList);
    const id = setInterval(() => fetchUnread(accessList), 8000);
    return () => clearInterval(id);
  }, [accessList, fetchUnread]);

  useEffect(() => {
    if (!selectedId) {
      localStorage.removeItem(selectionKey);
      return;
    }
    localStorage.setItem(selectionKey, selectedId);
  }, [selectedId, selectionKey]);

  const selected = useMemo(
    () => accessList.find((a) => (a.id || a._id) === selectedId),
    [accessList, selectedId],
  );

  const otherName = (access) => (user.role === "doctor" ? access.patient?.name : access.doctor?.name);
  const otherSub = (access) => (user.role === "doctor" ? "Patient" : `Dr. · ${access.doctor?.specialty || "General"}`);

  if (loading) {
    return (
      <section className={`card p-6 ${className}`}>
        <div className="flex items-center justify-center py-20">
          <span className="spinner scale-125" />
        </div>
      </section>
    );
  }

  if (accessList.length === 0) {
    return (
      <section className={`card p-5 sm:p-6 ${className}`}>
        <div className="flex flex-col gap-5 xl:grid xl:grid-cols-[260px_1fr]">
          <aside>
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-black">{title}</h2>
                <p className="mt-1 text-sm text-[var(--text-secondary)]">{subtitle}</p>
              </div>
              <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-sky-500/12 text-xl xl:hidden">
                💬
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2 text-xs text-[var(--text-muted)]">
              {user.role === "patient" && (
                <>
                  <span className="badge badge-sky">English</span>
                  <span className="badge badge-violet">Kannada</span>
                  <span className="badge badge-green">Hindi</span>
                </>
              )}
              <span className="badge badge-amber">Voice input</span>
              <span className="badge badge-slate">Read aloud</span>
            </div>

            <div className="mt-5 rounded-2xl border border-dashed border-[var(--border)] bg-[var(--panel)] p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--text-muted)]">Chat Status</p>
              <p className="mt-2 text-sm font-semibold">No active chat window</p>
              <p className="mt-1 text-xs text-[var(--text-muted)]">
                {user.role === "patient"
                  ? "Approve a doctor's access request or grant access to start chatting."
                  : "Request access first. The chat will unlock as soon as the patient approves it."}
              </p>
            </div>
          </aside>

          <div>
            <div className="mb-4 flex items-center gap-3 rounded-2xl border border-[var(--border)] bg-[var(--panel)] px-4 py-3">
              <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-slate-500/15 text-base font-bold text-slate-300">
                💬
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="truncate text-lg font-black">Chatbox ready</h3>
                <p className="text-xs text-[var(--text-secondary)]">
                  The chat UI is available and will activate when an approved access window exists.
                </p>
              </div>
              <div className="hidden items-center gap-2 text-xs text-amber-400 sm:flex">
                <span className="h-2 w-2 rounded-full bg-amber-400" />
                Waiting for approval
              </div>
            </div>

            <div className="flex h-[520px] flex-col overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--panel-strong)] opacity-90">
              <div className="flex items-center justify-between border-b border-[var(--border)] bg-[var(--panel)] px-4 py-3">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-slate-500/15 text-sm">
                    {user.role === "doctor" ? "🧑⚕️" : "👨⚕️"}
                  </div>
                  <div>
                    <p className="text-sm font-bold leading-tight">Suggestion box</p>
                    <p className="text-[10px] text-[var(--text-muted)]">Disabled until access is approved</p>
                  </div>
                </div>
                <div className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-[10px] font-semibold text-amber-400">
                  Locked
                </div>
              </div>

              <div className="flex flex-1 items-center justify-center px-6 text-center">
                <div>
                  <p className="text-4xl">💬</p>
                  <p className="mt-3 text-sm font-semibold">Chatbox is created and waiting</p>
                  <p className="mt-2 max-w-md text-xs leading-relaxed text-[var(--text-muted)]">
                    {user.role === "patient"
                      ? "Once you approve a doctor access window, you can choose your language, type or speak in your native language, and hear messages read aloud."
                      : "Once the patient approves your access request, you can reply in English by typing or voice and use read-aloud for every message."}
                  </p>
                </div>
              </div>

              <div className="border-t border-[var(--border)] bg-[var(--panel)] px-3 py-3">
                <div className="flex items-end gap-2">
                  <textarea
                    rows={1}
                    disabled
                    value=""
                    readOnly
                    placeholder="Chat input will unlock after approval"
                    className="input-field min-h-[40px] max-h-24 flex-1 resize-none py-2.5 text-sm opacity-60"
                  />
                  <button
                    type="button"
                    disabled
                    className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--panel-strong)] text-[var(--text-muted)] opacity-60"
                  >
                    🎙
                  </button>
                  <button
                    type="button"
                    disabled
                    className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl btn-brand opacity-40"
                  >
                    ➤
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className={`card p-5 sm:p-6 ${className}`}>
      <div className="flex flex-col gap-5 xl:grid xl:grid-cols-[260px_1fr]">
        <aside>
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-black">{title}</h2>
              <p className="mt-1 text-sm text-[var(--text-secondary)]">{subtitle}</p>
            </div>
            <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-sky-500/12 text-xl xl:hidden">
              💬
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2 text-xs text-[var(--text-muted)]">
            {user.role === "patient" && (
              <>
                <span className="badge badge-sky">English</span>
                <span className="badge badge-violet">Kannada</span>
                <span className="badge badge-green">Hindi</span>
              </>
            )}
            <span className="badge badge-amber">Voice input</span>
            <span className="badge badge-slate">Read aloud</span>
          </div>

          <div className="mt-5 space-y-2">
            {accessList.map((access) => {
              const id = access.id || access._id;
              const name = otherName(access);
              const unread = unreadMap[id] || 0;
              const isSelected = selectedId === id;
              const remainingMs = new Date(access.expiry) - Date.now();
              const remainingHours = Math.floor(remainingMs / 3600000);
              const remainingMinutes = Math.floor((remainingMs % 3600000) / 60000);
              const expiryLabel = remainingHours > 24
                ? `${Math.floor(remainingHours / 24)}d left`
                : remainingHours > 0
                ? `${remainingHours}h ${remainingMinutes}m left`
                : `${Math.max(remainingMinutes, 0)}m left`;

              return (
                <motion.button
                  key={id}
                  type="button"
                  whileHover={{ x: 2 }}
                  onClick={() => setSelectedId(id)}
                  className={`flex w-full items-center gap-3 rounded-2xl border px-3 py-3 text-left transition ${
                    isSelected
                      ? "border-sky-500/30 bg-gradient-to-r from-sky-500/15 to-violet-500/10"
                      : "border-[var(--border)] bg-[var(--panel)] hover:border-[var(--border-hover)]"
                  }`}
                >
                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-brand text-sm font-bold text-white">
                    {name?.[0]?.toUpperCase() || "?"}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-sm font-semibold">{name}</p>
                      {unread > 0 && (
                        <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white">
                          {unread > 9 ? "9+" : unread}
                        </span>
                      )}
                    </div>
                    <p className="truncate text-[11px] text-[var(--text-muted)]">{otherSub(access)}</p>
                    <p className="mt-0.5 text-[10px] font-medium text-emerald-400">⏱ {expiryLabel}</p>
                  </div>
                </motion.button>
              );
            })}
          </div>
        </aside>

        <div>
          <AnimatePresence mode="wait">
            {selected ? (
              <motion.div
                key={selectedId}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2 }}
              >
                <div className="mb-4 flex items-center gap-3 rounded-2xl border border-[var(--border)] bg-[var(--panel)] px-4 py-3">
                  <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-brand text-base font-bold text-white">
                    {otherName(selected)?.[0]?.toUpperCase() || "?"}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate text-lg font-black">{otherName(selected)}</h3>
                    <p className="text-xs text-[var(--text-secondary)]">{otherSub(selected)}</p>
                  </div>
                  <div className="hidden items-center gap-2 text-xs text-emerald-400 sm:flex">
                    <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                    Active window
                  </div>
                </div>

                <ChatBox
                  accessId={selectedId}
                  expiry={selected.expiry}
                  currentUserId={user.id}
                  currentUserRole={user.role}
                  userLanguage={user.preferredLanguage || "english"}
                  patientName={user.role === "doctor" ? otherName(selected) : user.name}
                  doctorName={user.role === "patient" ? otherName(selected) : user.name}
                  onMessagesRead={() => fetchUnread(accessList)}
                />
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>
      </div>
    </section>
  );
}
