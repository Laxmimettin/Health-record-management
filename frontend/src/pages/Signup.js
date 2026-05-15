import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import api from "../lib/api";

export default function Signup({ onAuth }) {
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "patient", specialty: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await api.post("/auth/signup", { ...form });

      const loginRes = await api.post("/auth/login", {
        email: form.email, password: form.password,
        device: "Web browser", location: "Unknown location",
      });
      onAuth(loginRes.data);
      navigate(
        loginRes.data.user.role === "patient"
          ? "/patient"
          : loginRes.data.user.isVerified ? "/doctor" : "/doctor/pending",
      );
    } catch (err) {
      setError(err.response?.data?.msg || "Unable to create account. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const roles = [
    { value: "patient", icon: "🧑⚕️", label: "Patient", desc: "Upload, share, and revoke your records." },
    { value: "doctor",  icon: "👨⚕️", label: "Doctor",  desc: "Request access and review approved records." },
  ];

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-[var(--bg)] px-4 py-12 overflow-hidden">
      <div className="pointer-events-none absolute top-0 right-1/3 h-[500px] w-[500px] rounded-full bg-violet-500/10 blur-[120px]" />
      <div className="pointer-events-none absolute bottom-0 left-1/4 h-[400px] w-[400px] rounded-full bg-sky-500/10 blur-[100px]" />

      <motion.div initial={{ opacity: 0, y: 24, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.45 }} className="relative z-10 w-full max-w-lg">

        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-brand text-2xl glow-sky">🏥</div>
          <h1 className="text-3xl font-black text-gradient">Create your account</h1>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">Set up your secure health workspace</p>
        </div>

        <form onSubmit={handleSubmit} className="card p-8">
          <p className="text-xs font-semibold uppercase tracking-widest text-[var(--text-muted)]">Choose your role</p>

          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {roles.map((r) => (
              <button key={r.value} type="button" onClick={() => setForm({ ...form, role: r.value })}
                className={`rounded-2xl border p-4 text-left transition-all duration-200 ${
                  form.role === r.value
                    ? "border-sky-400/60 bg-sky-500/10 shadow-lg shadow-sky-500/10"
                    : "border-[var(--border)] bg-[var(--panel)] hover:border-[var(--border-hover)]"
                }`}>
                <span className="text-2xl">{r.icon}</span>
                <p className="mt-2 font-semibold">{r.label}</p>
                <p className="mt-1 text-xs text-[var(--text-secondary)]">{r.desc}</p>
              </button>
            ))}
          </div>

          <div className="mt-6 space-y-4">
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-[var(--text-secondary)]">Full name</label>
              <input type="text" placeholder="John Doe" value={form.name} required
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="input-field" />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold text-[var(--text-secondary)]">Email address</label>
              <input type="email" placeholder="you@example.com" value={form.email} required
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="input-field" />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold text-[var(--text-secondary)]">Password</label>
              <input type="password" placeholder="Min. 8 characters" value={form.password} required
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                className="input-field" />
            </div>

            <AnimatePresence>
              {form.role === "doctor" && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}>
                  <label className="mb-1.5 block text-xs font-semibold text-[var(--text-secondary)]">Specialty</label>
                  <div className="relative">
                    <select value={form.specialty} required
                      onChange={(e) => setForm({ ...form, specialty: e.target.value })}
                      className="input-field appearance-none pr-8">
                      <option value="" disabled>Select specialty…</option>
                      {["Cardiology","Dermatology","Endocrinology","Gastroenterology","General Practice",
                        "Gynecology","Hematology","Nephrology","Neurology","Oncology","Ophthalmology",
                        "Orthopedics","Pediatrics","Psychiatry","Pulmonology","Radiology","Rheumatology",
                        "Surgery","Urology"].map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                    <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-xs text-[var(--text-muted)]">▼</span>
                  </div>
                  <p className="mt-2 text-xs text-[var(--text-muted)]">Doctor accounts require admin verification before dashboard access.</p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Security notice */}
          <div className="mt-5 flex items-start gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/8 px-4 py-3">
            <span className="mt-0.5 text-sm">🔐</span>
            <p className="text-xs text-emerald-400">
              Your records will be stored in encrypted form and opened only for approved access windows.
            </p>
          </div>

          {error && (
            <motion.p initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}
              className="mt-4 rounded-xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-400">
              ⚠️ {error}
            </motion.p>
          )}

          <motion.button type="submit" disabled={loading} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl btn-brand py-3.5 text-sm glow-sky">
            {loading ? <><span className="spinner" /> Creating account…</> : `Create ${form.role} account →`}
          </motion.button>

          <p className="mt-5 text-center text-sm text-[var(--text-secondary)]">
            Already have an account?{" "}
            <Link to="/login" className="font-semibold text-[var(--accent-strong)] hover:underline">Sign in</Link>
          </p>
        </form>
      </motion.div>
    </div>
  );
}
