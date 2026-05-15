import { useEffect, useState } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import ProtectedRoute from "./components/ProtectedRoute";
import api from "./lib/api";
import {
  clearSession,
  getStoredTheme,
  getStoredUser,
  getToken,
  saveSession,
  setStoredTheme,
} from "./lib/auth";
import AccessManagement from "./pages/AccessManagement";
import AdminLogin from "./pages/AdminLogin";
import AdminPanel from "./pages/AdminPanel";
import Appointments from "./pages/Appointments";
import AuditLogs from "./pages/AuditLogs";
import DoctorDashboard from "./pages/DoctorDashboard";
import DoctorPendingApproval from "./pages/DoctorPendingApproval";
import Login from "./pages/Login";
import PatientDashboard from "./pages/PatientDashboard";
import Signup from "./pages/Signup";
import SuggestionBoxPage from "./pages/SuggestionBoxPage";
import UploadPage from "./pages/UploadPage";
import Welcome from "./pages/Welcome";

function App() {
  const [user, setUser] = useState(getStoredUser());
  const [theme, setTheme] = useState(getStoredTheme());
  const [bootstrapping, setBootstrapping] = useState(true);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    setStoredTheme(theme);
  }, [theme]);

  useEffect(() => {
    const token = getToken();

    if (!token) {
      setBootstrapping(false);
      return;
    }

    api
      .get("/auth/me")
      .then((res) => {
        const loggedInUser = res.data.user;
        saveSession(token, loggedInUser);

        setUser(loggedInUser);
      })
      .catch(() => {
        clearSession();
        setUser(null);
      })
      .finally(() => setBootstrapping(false));
  }, []);

  const handleAuth = ({ token, user: nextUser }) => {
    saveSession(token, nextUser);
    setUser(nextUser);
  };

  const handleLogout = () => {
    clearSession();
    setUser(null);
  };

  if (bootstrapping) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--bg)] text-[var(--text-primary)]">
        <div className="rounded-[2rem] border border-[var(--border)] bg-[var(--panel-strong)] px-8 py-6 text-center shadow-xl">
          <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-4 border-[var(--accent-soft)] border-t-[var(--accent)]" />
          <p className="text-sm text-[var(--text-secondary)]">Loading secure workspace...</p>
        </div>
      </div>
    );
  }

  const getDashboardPath = (currentUser) => {
    if (!currentUser) {
      return "/";
    }

    if (currentUser.role === "admin") {
      return "/admin";
    }

    if (currentUser.role === "patient") {
      return "/patient";
    }

    return currentUser.isVerified ? "/doctor" : "/doctor/pending";
  };

  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/"
          element={<Welcome user={user} theme={theme} onToggleTheme={() => setTheme(theme === "dark" ? "light" : "dark")} />}
        />
        <Route
          path="/login"
          element={user ? <Navigate to={getDashboardPath(user)} replace /> : <Login onAuth={handleAuth} />}
        />
        <Route
          path="/signup"
          element={user ? <Navigate to={getDashboardPath(user)} replace /> : <Signup onAuth={handleAuth} />}
        />
        <Route
          path="/admin/login"
          element={user ? <Navigate to={getDashboardPath(user)} replace /> : <AdminLogin onAuth={handleAuth} />}
        />

        <Route element={<ProtectedRoute user={user} roles={["patient"]} />}>
          <Route
            path="/patient"
            element={<PatientDashboard user={user} theme={theme} onToggleTheme={() => setTheme(theme === "dark" ? "light" : "dark")} onLogout={handleLogout} />}
          />
          <Route
            path="/upload"
            element={<UploadPage user={user} theme={theme} onToggleTheme={() => setTheme(theme === "dark" ? "light" : "dark")} onLogout={handleLogout} />}
          />
        </Route>

        <Route element={<ProtectedRoute user={user} roles={["patient", "doctor"]} />}>
          <Route
            path="/appointments"
            element={<Appointments user={user} theme={theme} onToggleTheme={() => setTheme(theme === "dark" ? "light" : "dark")} onLogout={handleLogout} />}
          />
          <Route
            path="/chat"
            element={<SuggestionBoxPage user={user} theme={theme} onToggleTheme={() => setTheme(theme === "dark" ? "light" : "dark")} onLogout={handleLogout} />}
          />
          <Route
            path="/access"
            element={<AccessManagement user={user} theme={theme} onToggleTheme={() => setTheme(theme === "dark" ? "light" : "dark")} onLogout={handleLogout} />}
          />
          <Route
            path="/audit"
            element={<AuditLogs user={user} theme={theme} onToggleTheme={() => setTheme(theme === "dark" ? "light" : "dark")} onLogout={handleLogout} />}
          />
        </Route>

        <Route element={<ProtectedRoute user={user} roles={["doctor"]} allowUnverifiedDoctor />}>
          <Route
            path="/doctor/pending"
            element={<DoctorPendingApproval user={user} theme={theme} onToggleTheme={() => setTheme(theme === "dark" ? "light" : "dark")} onLogout={handleLogout} onRefreshUser={setUser} />}
          />
        </Route>

        <Route element={<ProtectedRoute user={user} roles={["doctor"]} />}>
          <Route
            path="/doctor"
            element={<DoctorDashboard user={user} theme={theme} onToggleTheme={() => setTheme(theme === "dark" ? "light" : "dark")} onLogout={handleLogout} />}
          />
        </Route>

        <Route element={<ProtectedRoute user={user} roles={["admin"]} />}>
          <Route
            path="/admin"
            element={<AdminPanel user={user} theme={theme} onToggleTheme={() => setTheme(theme === "dark" ? "light" : "dark")} onLogout={handleLogout} />}
          />
        </Route>

        <Route
          path="*"
          element={<Navigate to={user ? getDashboardPath(user) : "/"} replace />}
        />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
