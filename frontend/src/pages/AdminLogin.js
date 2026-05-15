import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import api from "../lib/api";

export default function AdminLogin({ onAuth }) {
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await api.post("/admin/login", form);
      onAuth(res.data);
      navigate("/admin");
    } catch (err) {
      setError(err.response?.data?.msg || "Unable to sign in as admin.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[var(--bg)] px-4 py-12">
      <div className="pointer-events-none absolute top-0 left-1/3 h-[460px] w-[460px] -translate-x-1/2 rounded-full bg-amber-500/12 blur-[120px]" />
      <div className="pointer-events-none absolute bottom-0 right-1/4 h-[360px] w-[360px] rounded-full bg-sky-500/10 blur-[100px]" />

      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.45 }}
        className="relative z-10 w-full max-w-md"
      >
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 text-2xl text-slate-950 shadow-xl shadow-amber-500/20">🛡️</div>
          <h1 className="text-3xl font-black">Admin Panel</h1>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">Verify doctor accounts before dashboard access is unlocked</p>
        </div>

        <form onSubmit={handleSubmit} className="card p-8">
          <p className="text-xs font-semibold uppercase tracking-widest text-[var(--text-muted)]">Restricted access</p>
          <h2 className="mt-2 text-2xl font-black">Administrator sign in</h2>

          <div className="mt-6 space-y-4">
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-[var(--text-secondary)]">Admin email</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="admin@securehealthvault.com"
                className="input-field"
                required
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold text-[var(--text-secondary)]">Password</label>
              <input
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                placeholder="Admin password"
                className="input-field"
                required
              />
            </div>
          </div>

          {error && <p className="mt-4 rounded-xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-400">{error}</p>}

          <button type="submit" disabled={loading} className="mt-6 flex w-full items-center justify-center rounded-xl bg-gradient-to-r from-amber-400 to-orange-500 px-4 py-3 text-sm font-bold text-slate-950 transition hover:brightness-105 disabled:opacity-70">
            {loading ? "Signing in..." : "Open admin workspace"}
          </button>

          <p className="mt-5 text-center text-sm text-[var(--text-secondary)]">
            Standard account? <Link to="/login" className="font-semibold text-[var(--accent-strong)] hover:underline">Go to user login</Link>
          </p>
        </form>
      </motion.div>
    </div>
  );
}
