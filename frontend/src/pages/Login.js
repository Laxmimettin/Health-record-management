import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import api from "../lib/api";

export default function Login({ onAuth }) {
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: "", password: "", device: "Web browser", location: "Unknown location" });
  // device & location kept in state for backend audit logging but not shown in UI
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await api.post("/auth/login", form);
      onAuth(res.data);
      navigate(
        res.data.user.role === "patient"
          ? "/patient"
          : res.data.user.isVerified
            ? "/doctor"
            : "/doctor/pending",
      );
    } catch (err) {
      setError(err.response?.data?.msg || "Invalid credentials. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-[var(--bg)] px-4 py-12 overflow-hidden">
      {/* Ambient */}
      <div className="pointer-events-none absolute top-0 left-1/3 h-[500px] w-[500px] -translate-x-1/2 rounded-full bg-sky-500/12 blur-[120px]" />
      <div className="pointer-events-none absolute bottom-0 right-1/4 h-[400px] w-[400px] rounded-full bg-violet-500/10 blur-[100px]" />

      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.45 }}
        className="relative z-10 w-full max-w-md"
      >
        {/* Logo */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-brand text-2xl glow-sky">🏥</div>
          <h1 className="text-3xl font-black text-gradient">SecureHealthVault</h1>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">Sign in to your secure workspace</p>
        </div>

        <form onSubmit={handleSubmit} className="card p-8">
          <p className="text-xs font-semibold uppercase tracking-widest text-[var(--text-muted)]">Secure login</p>
          <h2 className="mt-2 text-2xl font-black">Welcome back</h2>

          <div className="mt-6 space-y-4">
            {/* Email */}
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-[var(--text-secondary)]">Email address</label>
              <input type="email" placeholder="you@example.com" value={form.email} required
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="input-field" />
            </div>

            {/* Password */}
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-[var(--text-secondary)]">Password</label>
              <div className="relative">
                <input type={showPass ? "text" : "password"} placeholder="••••••••" value={form.password} required
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  className="input-field pr-10" />
                <button type="button" onClick={() => setShowPass((v) => !v)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-sm text-[var(--text-muted)] hover:text-[var(--text-primary)]">
                  {showPass ? "🙈" : "👁️"}
                </button>
              </div>
            </div>


          </div>

          {error && (
            <motion.p initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}
              className="mt-4 rounded-xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-400">
              ⚠️ {error}
            </motion.p>
          )}

          <motion.button type="submit" disabled={loading} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl btn-brand py-3.5 text-sm glow-sky">
            {loading ? <><span className="spinner" /> Signing in...</> : "Sign in →"}
          </motion.button>

          <p className="mt-5 text-center text-sm text-[var(--text-secondary)]">
            New here?{" "}
            <Link to="/signup" className="font-semibold text-[var(--accent-strong)] hover:underline">Create an account</Link>
          </p>
          <p className="mt-2 text-center text-xs text-[var(--text-muted)]">
            Admin access? <Link to="/admin/login" className="font-semibold text-[var(--accent-strong)] hover:underline">Open admin panel</Link>
          </p>
        </form>

        <p className="mt-4 text-center text-xs text-[var(--text-muted)]">🔐 Protected by end-to-end encryption</p>
      </motion.div>
    </div>
  );
}
