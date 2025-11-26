// src/App.jsx
import React, { useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from "react-router-dom";
import AdminUsers from "./components/AdminUsers";
import AdminAgenda from "./components/AdminAgenda";
import AdminMenus from "./components/AdminMenus";
import AdminTipoDieta from "./components/AdminTipoDieta";
import FichaUsuario from "./components/FichaUsuario";
import Login from "./components/Login";
import Register from "./components/Register";
import ChangePassword from "./components/ChangePassword";
import PrivateRoute from "./components/PrivateRoute";
import { auth } from "./Firebase";
import { onAuthStateChanged } from "firebase/auth";

/**
 * LoginWrapper
 * - Redirige automáticamente según el email tras login o si ya hay sesión activa.
 * - Prioriza admin@admin.es: si el usuario es admin siempre va a /admin, aunque exista `from`.
 */
function LoginWrapper() {
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from?.pathname || null;
  const ADMIN_EMAIL = "admin@admin.es";

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      if (!u) return;
      const emailNow = String(u.email || "").trim().toLowerCase();
      if (emailNow === ADMIN_EMAIL) {
        navigate("/admin", { replace: true });
        return;
      }
      // No es admin: si veníamos de una ruta protegida, volvemos a ella; si no, a /mi-ficha
      if (from) {
        navigate(from, { replace: true });
        return;
      }
      navigate("/mi-ficha", { replace: true });
    });
    return () => unsub();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigate, from]);

  const handleOnLogin = (user) => {
    if (!user) {
      // fallback: rely on onAuthStateChanged
      return;
    }
    const email = String(user?.email || "").trim().toLowerCase();
    if (email === ADMIN_EMAIL) {
      navigate("/admin", { replace: true });
      return;
    }
    // No es admin: respeta from si existe
    if (from) {
      navigate(from, { replace: true });
      return;
    }
    navigate("/mi-ficha", { replace: true });
  };

  const handleOnShowRegister = () => {
    navigate("/register");
  };

  return <Login onLogin={handleOnLogin} onShowRegister={handleOnShowRegister} />;
}

function RegisterWrapper() {
  const navigate = useNavigate();

  const handleBackToLogin = () => {
    navigate("/login");
  };

  return <Register onBackToLogin={handleBackToLogin} />;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<LoginWrapper />} />
        <Route path="/register" element={<RegisterWrapper />} />

        <Route
          path="/mi-ficha"
          element={
            <PrivateRoute>
              <FichaUsuario />
            </PrivateRoute>
          }
        />

        <Route
          path="/admin"
          element={
            <PrivateRoute>
              <AdminUsers />
            </PrivateRoute>
          }
        />

        <Route
          path="/admin/agenda"
          element={
            <PrivateRoute>
              <AdminAgenda />
            </PrivateRoute>
          }
        />

        <Route
          path="/admin/menus"
          element={
            <PrivateRoute>
              <AdminMenus />
            </PrivateRoute>
          }
        />

        <Route
          path="/admin/tipodieta"
          element={
            <PrivateRoute>
              <AdminTipoDieta />
            </PrivateRoute>
          }
        />

        <Route
          path="/cambiar-password"
          element={
            <PrivateRoute>
              <ChangePassword />
            </PrivateRoute>
          }
        />

        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}