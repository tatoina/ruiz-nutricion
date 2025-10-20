// src/App.jsx
import React from "react";
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from "react-router-dom";
import AdminUsers from "./components/AdminUsers";
import FichaUsuario from "./components/FichaUsuario";
import Login from "./components/Login";
import Register from "./components/Register";
import PrivateRoute from "./components/PrivateRoute";
import { auth } from "./Firebase";

/**
 * LoginWrapper
 * - Envuelve tu componente Login existente y se encarga de la redirección
 *   tras un login exitoso. También redirige automáticamente si ya hay sesión.
 * - Pasa onShowRegister para que el botón "Registrarse" del Login pueda abrir /register.
 */
function LoginWrapper() {
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from?.pathname || null;
  const ADMIN_EMAIL = "admin@admin.es";

  // Si ya hay usuario al entrar en /login, redirigimos al destino apropiado
  if (auth.currentUser) {
    const emailNow = auth.currentUser.email || "";
    if (from) {
      return <Navigate to={from} replace />;
    }
    if (emailNow === ADMIN_EMAIL) return <Navigate to="/admin" replace />;
    return <Navigate to="/mi-ficha" replace />;
  }

  // onLogin: Login component invoca onLogin(user) cuando el signIn fue correcto
  const handleOnLogin = (user) => {
    if (from) {
      navigate(from, { replace: true });
      return;
    }
    const email = user?.email || "";
    if (email === ADMIN_EMAIL) {
      navigate("/admin", { replace: true });
    } else {
      navigate("/mi-ficha", { replace: true });
    }
  };

  // onShowRegister: llamado por Login cuando el usuario pulsa "Registrarse"
  const handleOnShowRegister = () => {
    navigate("/register");
  };

  return <Login onLogin={handleOnLogin} onShowRegister={handleOnShowRegister} />;
}

/**
 * RegisterWrapper
 * - Simple wrapper para renderizar Register dentro del Router y proporcionar
 *   la función onBackToLogin que vuelve a /login.
 */
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
        {/* raíz: redirige a login para que no vaya directamente a /admin */}
        <Route path="/" element={<Navigate to="/login" replace />} />

        {/* ruta login (usa tu componente Login) */}
        <Route path="/login" element={<LoginWrapper />} />

        {/* ruta register */}
        <Route path="/register" element={<RegisterWrapper />} />

        {/* rutas protegidas */}
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

        {/* fallback: ir a login */}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}