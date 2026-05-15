import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import api from "../lib/api";
import { getMessageInLanguage, getLanguageName, LANGUAGE_OPTIONS } from "../lib/translator";
import { getToken, getStoredUser, saveSession } from "../lib/auth";

// ─── helpers ────────────────────────────────────────────────────────────────

function timeAgo(date) {
  const s = Math.floor((Date.now() - new Date(date)) / 1000);
  if (s < 60)  return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return new Date(date).toLocaleDateString();
}

function expiryLabel(expiry) {
  const ms = new Date(expiry) - Date.now();
  if (ms <= 0) return "Expired";
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  if (h > 24) return `${Math.floor(h / 24)}d ${h % 24}h left`;
  if (h > 0)  return `${h}h ${m}m left`;
  return `${m}m left`;
}

// Language to voice recognition code mapping
const langToVoiceCode = {
  english: "en-US",
  kannada: "kn-IN",
  hindi: "hi-IN",
};

// ─── component ──────────────────────────────────────────────────────────────

export default function ChatBox({
  accessId,
  expiry,
  currentUserId,
  currentUserRole,
  patientName,
  doctorName,
  userLanguage = "english",
  onMessagesRead = () => {},
}) {
  const [messages, setMessages]   = useState([]);
  const [input, setInput]         = useState("");
  const [sending, setSending]     = useState(false);
  const [loading, setLoading]     = useState(true);
  const [expired, setExpired]     = useState(false);
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking]   = useState(null);   // message id being read aloud
  const [expiryStr, setExpiryStr] = useState("");
  const [error, setError]         = useState("");
  const [selectedLanguage, setSelectedLanguage] = useState(
    currentUserRole === "doctor" ? "english" : (userLanguage || "english"),
  );
  const [languageConfirmed, setLanguageConfirmed] = useState(currentUserRole === "doctor");

  const bottomRef    = useRef(null);
  const inputRef     = useRef(null);
  const recognRef    = useRef(null);
  const pollRef      = useRef(null);
  const scrollRef    = useRef(null);
  const lastMessageIdRef = useRef(null);
  const stickToBottomRef = useRef(true);

  const viewerLanguage = currentUserRole === "doctor" ? "english" : selectedLanguage;
  const canCompose = currentUserRole === "doctor" || languageConfirmed;

  const getDisplayedText = useCallback((msg) => (
    getMessageInLanguage(msg, viewerLanguage)
      || msg.displayText
      || msg.originalText
      || msg.text
      || ""
  ), [viewerLanguage]);

  // ── handle language change ────────────────────────────────────────────────
  const handleLanguageChange = async (newLanguage) => {
    setSelectedLanguage(newLanguage);
    try {
      const res = await api.put("/auth/language", { language: newLanguage });
      const token = getToken();
      const nextUser = res.data.user;
      if (token && nextUser) {
        saveSession(token, nextUser);
      } else {
        const storedUser = getStoredUser();
        if (storedUser) {
          localStorage.setItem("user", JSON.stringify({ ...storedUser, preferredLanguage: newLanguage }));
        }
      }
    } catch (err) {
      console.error("Failed to save language preference:", err);
    }
  };

  // ── expiry countdown ──────────────────────────────────────────────────────
  useEffect(() => {
    const tick = () => {
      const label = expiryLabel(expiry);
      setExpiryStr(label);
      setExpired(new Date(expiry) <= Date.now());
    };
    tick();
    const id = setInterval(tick, 30000);
    return () => clearInterval(id);
  }, [expiry]);

  // ── fetch messages ────────────────────────────────────────────────────────
  const fetchMessages = useCallback(async (silent = false) => {
    try {
      const res = await api.get(`/messages/${accessId}`);
      setMessages(res.data.messages || []);
      setError("");
      onMessagesRead();
      if (!silent) setLoading(false);
    } catch (err) {
      if (!silent) {
        setError(err.response?.data?.msg || "Unable to load chat.");
        setLoading(false);
      }
    }
  }, [accessId, onMessagesRead]);

  useEffect(() => {
    fetchMessages();
    // Poll every 6 seconds for new messages
    pollRef.current = setInterval(() => fetchMessages(true), 6000);
    return () => clearInterval(pollRef.current);
  }, [fetchMessages]);

  useEffect(() => () => {
    recognRef.current?.stop?.();
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
  }, []);

  const updateStickiness = useCallback(() => {
    const node = scrollRef.current;
    if (!node) return;
    const distanceFromBottom = node.scrollHeight - node.scrollTop - node.clientHeight;
    stickToBottomRef.current = distanceFromBottom < 80;
  }, []);

  // ── auto-scroll ───────────────────────────────────────────────────────────
  useEffect(() => {
    const lastMessageId = messages[messages.length - 1]?.id || null;
    const hasNewLastMessage = lastMessageId && lastMessageId !== lastMessageIdRef.current;
    const shouldAutoScroll = stickToBottomRef.current || lastMessageIdRef.current === null;

    if (hasNewLastMessage && shouldAutoScroll) {
      bottomRef.current?.scrollIntoView({
        behavior: lastMessageIdRef.current === null ? "auto" : "smooth",
        block: "end",
      });
    }

    lastMessageIdRef.current = lastMessageId;
  }, [messages]);

  // ── send ──────────────────────────────────────────────────────────────────
  const sendMessage = async () => {
    const text = input.trim();
    if (!text || sending || expired || !canCompose) return;
    setSending(true);
    setInput("");
    try {
      const res = await api.post(`/messages/${accessId}`, { 
        text,
        language: currentUserRole === "doctor" ? "english" : selectedLanguage,
      });
      setMessages((prev) => [...prev, res.data]);
      setError("");
      onMessagesRead();
    } catch (err) {
      setError(err.response?.data?.msg || "Failed to send.");
      setInput(text);
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  };

  const handleKey = (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  // ── voice input ───────────────────────────────────────────────────────────
  const toggleVoice = () => {
    if (!canCompose) {
      setError("Please choose a chat language before using voice input.");
      return;
    }

    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { setError("Voice input is not supported in this browser."); return; }

    if (listening) {
      recognRef.current?.stop();
      setListening(false);
      return;
    }

    const recog = new SR();
    recog.lang = langToVoiceCode[viewerLanguage] || "en-US";
    recog.continuous = false;
    recog.interimResults = false;
    recognRef.current = recog;

    recog.onresult = (e) => {
      const transcript = e.results[0][0].transcript;
      setInput((prev) => (prev ? `${prev} ${transcript}` : transcript));
    };
    recog.onerror  = () => setListening(false);
    recog.onend    = () => setListening(false);

    recog.start();
    setListening(true);
  };

  // ── read aloud ────────────────────────────────────────────────────────────
  const readAloud = (msg) => {
    if (!window.speechSynthesis) { setError("Text-to-speech not supported in this browser."); return; }

    if (speaking === msg.id) {
      window.speechSynthesis.cancel();
      setSpeaking(null);
      return;
    }

    window.speechSynthesis.cancel();
    const utt = new SpeechSynthesisUtterance(getDisplayedText(msg));
    utt.lang  = langToVoiceCode[viewerLanguage] || "en-US";
    utt.rate  = 0.95;
    utt.pitch = 1;
    utt.onend = () => setSpeaking(null);
    utt.onerror = () => setSpeaking(null);
    setSpeaking(msg.id);
    window.speechSynthesis.speak(utt);
  };

  // ── render ────────────────────────────────────────────────────────────────
  const isExpired = expired;
  const otherName = currentUserRole === "doctor" ? patientName : doctorName;

  return (
    <div className="flex flex-col h-[520px] rounded-2xl overflow-hidden border border-[var(--border)] bg-[var(--panel-strong)]">

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)] bg-[var(--panel)]">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-brand text-sm">
            {currentUserRole === "doctor" ? "🧑⚕️" : "👨⚕️"}
          </div>
          <div>
            <p className="text-sm font-bold leading-tight">{otherName || "Chat"}</p>
            <p className="text-[10px] text-[var(--text-muted)]">Suggestion box</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Language selector - only for patient */}
          {currentUserRole === "patient" && (
            <div className="flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--panel-strong)] px-2.5 py-1.5">
              <span className="text-[10px] uppercase tracking-wider text-[var(--text-muted)]">Language</span>
              <select
                value={selectedLanguage}
                onChange={(e) => handleLanguageChange(e.target.value)}
                className="bg-transparent text-xs font-semibold text-[var(--text-primary)] outline-none"
                title="Select your native language"
              >
                {LANGUAGE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label.replace(/🇬🇧|🇮🇳/g, "").trim()}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold border ${
            isExpired
              ? "border-rose-500/30 bg-rose-500/10 text-rose-400"
              : "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
          }`}>
            <span className={`h-1.5 w-1.5 rounded-full ${isExpired ? "bg-rose-400" : "bg-emerald-400 animate-pulse"}`} />
            {expiryStr}
          </div>
        </div>
      </div>

      {/* Messages */}
      <div
        ref={scrollRef}
        onScroll={updateStickiness}
        className="relative flex-1 overflow-y-auto overscroll-y-contain px-4 py-3 space-y-3"
      >
        {currentUserRole === "patient" && !languageConfirmed && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-[var(--panel)]/95 px-4 backdrop-blur-sm">
            <div className="w-full max-w-md rounded-3xl border border-[var(--border)] bg-[var(--panel-strong)] p-6 shadow-2xl">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--text-muted)]">Patient Chat Setup</p>
              <h3 className="mt-2 text-xl font-black">Choose the language for your chat</h3>
              <p className="mt-2 text-sm text-[var(--text-secondary)]">
                You can type or speak in your language. Your doctor will receive the message in English.
              </p>

              <div className="mt-5 space-y-3">
                {LANGUAGE_OPTIONS.map((opt) => {
                  const active = selectedLanguage === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setSelectedLanguage(opt.value)}
                      className={`flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-left transition ${
                        active
                          ? "border-sky-500/40 bg-sky-500/10"
                          : "border-[var(--border)] bg-[var(--panel)] hover:border-[var(--border-hover)]"
                      }`}
                    >
                      <div>
                        <p className="text-sm font-semibold">{getLanguageName(opt.value)}</p>
                        <p className="mt-1 text-xs text-[var(--text-muted)]">
                          {opt.value === "english"
                            ? "Speak or type directly in English."
                            : "Speak or type naturally in your language."}
                        </p>
                      </div>
                      <span className={`text-sm ${active ? "text-sky-400" : "text-[var(--text-muted)]"}`}>
                        {active ? "●" : "○"}
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-xs text-emerald-300">
                <span>Doctor view: English only</span>
                <span>Patient view: {getLanguageName(selectedLanguage)}</span>
              </div>

              <button
                type="button"
                onClick={async () => {
                  await handleLanguageChange(selectedLanguage);
                  setLanguageConfirmed(true);
                  setError("");
                  inputRef.current?.focus();
                }}
                className="mt-5 w-full rounded-2xl btn-brand px-4 py-3 text-sm font-semibold glow-sky"
              >
                Continue to chat
              </button>
            </div>
          </div>
        )}

        {loading && (
          <div className="flex items-center justify-center h-full">
            <span className="spinner scale-110" />
          </div>
        )}

        {!loading && error && (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <p className="text-3xl mb-2">💬</p>
              <p className="text-sm text-rose-400">{error}</p>
            </div>
          </div>
        )}

        {!loading && !error && messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <p className="text-4xl mb-3">💬</p>
            <p className="text-sm font-semibold text-[var(--text-primary)]">Start the conversation</p>
            <p className="mt-1 text-xs text-[var(--text-muted)]">
              {currentUserRole === "doctor"
                ? "Send suggestions, advice, or notes to your patient."
                : "Ask your doctor questions or share updates."}
            </p>
          </div>
        )}

        <AnimatePresence initial={false}>
          {messages.map((msg) => {
            const isMine = msg.senderId?.toString() === currentUserId?.toString()
              || msg.senderRole === currentUserRole;
            const displayedText = getDisplayedText(msg);
            return (
              <motion.div key={msg.id}
                initial={{ opacity: 0, y: 8, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.2 }}
                className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
                <div className={`group relative max-w-[78%] ${isMine ? "items-end" : "items-start"} flex flex-col gap-1`}>
                  {/* Sender label */}
                  <p className={`text-[10px] font-semibold px-1 ${isMine ? "text-right text-sky-400" : "text-left text-violet-400"}`}>
                    {isMine ? "You" : msg.senderName}
                  </p>

                  {/* Bubble */}
                  <div className={`relative rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                    isMine
                      ? "bg-gradient-brand text-white rounded-tr-sm"
                      : "bg-[var(--panel)] border border-[var(--border)] text-[var(--text-primary)] rounded-tl-sm"
                  }`}>
                    <p className="whitespace-pre-wrap break-words">{displayedText}</p>
                    {currentUserRole === "doctor" && msg.originalLanguage && msg.originalLanguage !== "english" && (
                      <p className="mt-2 text-[10px] text-white/70">
                        Translated from {getLanguageName(msg.originalLanguage)}
                      </p>
                    )}

                    <button
                      type="button"
                      onClick={() => readAloud(msg)}
                      title={speaking === msg.id ? "Stop reading" : "Read aloud"}
                      className={`absolute -right-8 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity flex h-6 w-6 items-center justify-center rounded-full text-xs ${
                        speaking === msg.id
                          ? "bg-violet-500/20 text-violet-400"
                          : "bg-[var(--panel)] border border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                      }`}>
                      {speaking === msg.id ? "⏹" : "🔊"}
                    </button>
                  </div>

                  {/* Timestamp + read receipt */}
                  <div className={`flex items-center gap-1.5 px-1 ${isMine ? "justify-end" : "justify-start"}`}>
                    <span className="text-[9px] text-[var(--text-muted)]">{timeAgo(msg.createdAt)}</span>
                    {isMine && (
                      <span className="text-[9px] text-[var(--text-muted)]">
                        {msg.readBy?.length > 1 ? "✓✓" : "✓"}
                      </span>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
        <div ref={bottomRef} />
      </div>

      {/* Input area */}
      <div className="border-t border-[var(--border)] bg-[var(--panel)] px-3 py-3">
        {isExpired ? (
          <div className="flex items-center justify-center gap-2 py-2 text-xs text-rose-400">
            <span>🔒</span> Chat is closed — access window has expired
          </div>
        ) : (
          <div className="flex items-end gap-2">
            <textarea
              ref={inputRef}
              rows={1}
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                e.target.style.height = "auto";
                e.target.style.height = `${Math.min(e.target.scrollHeight, 96)}px`;
              }}
              onKeyDown={handleKey}
              placeholder={
                !canCompose
                  ? "Choose a language to start chatting"
                  : listening
                  ? "Listening…"
                  : currentUserRole === "doctor"
                  ? "Type in English… (Enter to send)"
                  : `Type in ${getLanguageName(selectedLanguage)}… (Enter to send)`
              }
              disabled={!canCompose}
              className="input-field flex-1 resize-none text-sm py-2.5 min-h-[40px] max-h-24 leading-relaxed disabled:opacity-60"
              style={{ overflow: "hidden" }}
            />

            {/* Voice input */}
            <motion.button
              type="button"
              whileHover={{ scale: 1.08 }}
              whileTap={{ scale: 0.92 }}
              onClick={toggleVoice}
              disabled={!canCompose}
              title={listening ? "Stop listening" : "Voice input"}
              className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl border transition-all ${
                listening
                  ? "border-rose-500/40 bg-rose-500/15 text-rose-400 animate-pulse"
                  : "border-[var(--border)] bg-[var(--panel-strong)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:border-[var(--border-hover)]"
              }`}>
              🎙
            </motion.button>

            {/* Send */}
            <motion.button
              type="button"
              whileHover={{ scale: 1.08 }}
              whileTap={{ scale: 0.92 }}
              onClick={sendMessage}
              disabled={!input.trim() || sending || !canCompose}
              className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl btn-brand glow-sky disabled:opacity-40 disabled:cursor-not-allowed">
              {sending ? <span className="spinner border-white/30 border-t-white scale-75" /> : "➤"}
            </motion.button>
          </div>
        )}

        {error && !loading && (
          <p className="mt-1.5 text-[10px] text-rose-400">{error}</p>
        )}
      </div>
    </div>
  );
}
