import { useEffect, useState } from "react";
import DashboardShell from "../components/DashboardShell";
import api from "../lib/api";

export default function AdminPanel({ user, theme, onToggleTheme, onLogout }) {
  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");

  const loadDoctors = async () => {
    setLoading(true);
    setError("");

    try {
      const res = await api.get("/admin/doctors");
      setDoctors(res.data.doctors || []);
    } catch (err) {
      setError(err.response?.data?.msg || "Unable to load doctor accounts.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDoctors();
  }, []);

  const verifyDoctor = async (doctorId) => {
    setBusyId(doctorId);
    setError("");

    try {
      const res = await api.patch(`/admin/doctors/${doctorId}/verify`);
      setDoctors((prev) => prev.map((doctor) => (doctor.id === doctorId ? res.data.doctor : doctor)));
    } catch (err) {
      setError(err.response?.data?.msg || "Unable to verify doctor.");
    } finally {
      setBusyId("");
    }
  };

  const pendingDoctors = doctors.filter((doctor) => !doctor.isVerified).length;

  return (
    <DashboardShell
      title="Admin Panel"
      subtitle="Review doctor registrations and verify them before doctor dashboard access is granted."
      user={user}
      theme={theme}
      onToggleTheme={onToggleTheme}
      onLogout={onLogout}
    >
      <div className="grid gap-6 lg:grid-cols-[280px_1fr] xl:grid-cols-[320px_1fr]">
        <section className="card p-4 sm:p-6">
          <p className="text-xs font-semibold uppercase tracking-widest text-[var(--text-muted)]">Verification queue</p>
          <h2 className="mt-2 text-2xl sm:text-3xl font-black">{pendingDoctors}</h2>
          <p className="mt-2 text-sm text-[var(--text-secondary)]">Doctors are blocked from the doctor dashboard until you verify them here.</p>

          <div className="mt-6 rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4 text-sm text-amber-300">
            Fixed admin login protects this panel separately from patient and doctor accounts.
          </div>

          <button type="button" onClick={loadDoctors} className="mt-5 w-full rounded-xl btn-ghost py-3 text-sm font-semibold">
            Refresh doctor list
          </button>
        </section>

        <section className="card p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-[var(--text-muted)]">Doctor accounts</p>
              <h2 className="mt-2 text-xl sm:text-2xl font-black">Manage verification</h2>
            </div>
            <span className="badge badge-amber">{doctors.length} total</span>
          </div>

          {error && <p className="mt-4 rounded-xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-400">{error}</p>}

          <div className="mt-6 space-y-3">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <span className="spinner scale-125" />
              </div>
            ) : doctors.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-[var(--border)] p-8 text-center text-sm text-[var(--text-muted)]">
                No doctor accounts found.
              </div>
            ) : (
              doctors.map((doctor) => (
                <div key={doctor.id} className="card-flat p-4">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-lg font-bold">{doctor.name}</p>
                        <span className={`badge ${doctor.isVerified ? "badge-green" : "badge-amber"}`}>
                          {doctor.isVerified ? "Verified" : "Pending"}
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-[var(--text-secondary)]">{doctor.email}</p>
                      <p className="mt-1 text-sm text-[var(--text-muted)]">{doctor.specialty || "Specialty not provided"}</p>
                      <p className="mt-2 text-xs text-[var(--text-muted)]">
                        Registered {new Date(doctor.createdAt).toLocaleString()}
                      </p>
                      {doctor.verifiedAt && (
                        <p className="mt-1 text-xs text-[var(--text-muted)]">
                          Verified {new Date(doctor.verifiedAt).toLocaleString()} by {doctor.verifiedBy || "admin"}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => verifyDoctor(doctor.id)}
                        disabled={doctor.isVerified || busyId === doctor.id}
                        className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
                          doctor.isVerified
                            ? "cursor-not-allowed border border-emerald-500/20 bg-emerald-500/10 text-emerald-400"
                            : "bg-gradient-to-r from-amber-400 to-orange-500 text-slate-950 hover:brightness-105"
                        }`}
                      >
                        {doctor.isVerified ? "Already verified" : busyId === doctor.id ? "Verifying..." : "Verify doctor"}
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </DashboardShell>
  );
}
