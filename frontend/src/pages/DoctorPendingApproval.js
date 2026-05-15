import { useState } from "react";
import { useNavigate } from "react-router-dom";
import DashboardShell from "../components/DashboardShell";
import api from "../lib/api";
import { getToken, saveSession } from "../lib/auth";

export default function DoctorPendingApproval({ user, theme, onToggleTheme, onLogout, onRefreshUser }) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const refreshStatus = async () => {
    setLoading(true);
    setMessage("");

    try {
      const res = await api.get("/auth/me");
      onRefreshUser(res.data.user);
      saveSession(getToken(), res.data.user);

      if (res.data.user.isVerified) {
        navigate("/doctor", { replace: true });
      } else {
        setMessage("Verification is still pending. Please ask the admin to approve your account.");
      }
    } catch {
      setMessage("Unable to refresh your verification status right now.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <DashboardShell
      title="Verification Pending"
      subtitle="Your doctor account exists, but admin approval is required before you can use the doctor dashboard."
      user={user}
      theme={theme}
      onToggleTheme={onToggleTheme}
      onLogout={onLogout}
    >
      <section className="mx-auto max-w-3xl card p-6 sm:p-8 text-center">
        <div className="mx-auto flex h-16 w-16 sm:h-20 sm:w-20 items-center justify-center rounded-3xl bg-amber-500/12 text-3xl sm:text-4xl text-amber-400">
          ⏳
        </div>
        <h2 className="mt-6 text-2xl sm:text-3xl font-black">Waiting for admin verification</h2>
        <p className="mx-auto mt-3 max-w-xl text-sm leading-7 text-[var(--text-secondary)]">
          Once an admin verifies your doctor account, this page will unlock and redirect you into the doctor dashboard.
        </p>

        <div className="mt-8 rounded-2xl border border-[var(--border)] bg-[var(--panel)] p-4 sm:p-5 text-left">
          <p className="text-xs font-semibold uppercase tracking-widest text-[var(--text-muted)]">Account details</p>
          <div className="mt-3 space-y-1">
            <p className="text-sm"><span className="font-semibold">Name:</span> {user.name}</p>
            <p className="text-sm"><span className="font-semibold">Email:</span> {user.email}</p>
            <p className="text-sm"><span className="font-semibold">Specialty:</span> {user.specialty || "Not provided"}</p>
            <p className="text-sm"><span className="font-semibold">Status:</span> Pending verification</p>
          </div>
        </div>

        {message && <p className="mt-5 rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-300">{message}</p>}

        <button
          type="button"
          onClick={refreshStatus}
          disabled={loading}
          className="mt-6 rounded-xl btn-brand px-6 py-3 text-sm font-semibold glow-sky w-full sm:w-auto"
        >
          {loading ? "Checking status..." : "Check verification status"}
        </button>
      </section>
    </DashboardShell>
  );
}
