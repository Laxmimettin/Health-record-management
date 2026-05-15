import { Navigate, Outlet } from "react-router-dom";

function getHomePath(user) {
  if (!user) {
    return "/";
  }

  if (user.role === "admin") {
    return "/admin";
  }

  if (user.role === "doctor" && !user.isVerified) {
    return "/doctor/pending";
  }

  return user.role === "patient" ? "/patient" : "/doctor";
}

export default function ProtectedRoute({ user, roles, allowUnverifiedDoctor = false }) {
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (user.role === "doctor" && !user.isVerified && !allowUnverifiedDoctor) {
    return <Navigate to="/doctor/pending" replace />;
  }

  if (roles && !roles.includes(user.role)) {
    return <Navigate to={getHomePath(user)} replace />;
  }

  return <Outlet />;
}
