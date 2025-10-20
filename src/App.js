import React from "react";
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from "react-router-dom";
import AdminUsers from "./components/AdminUsers";
import FichaUsuario from "./components/FichaUsuario";
import Login from "./components/Login";
import PrivateRoute from "./components/PrivateRoute";
import { auth } from "./Firebase";

/**
 * LoginWrapper
 * - Envuelve tu componente Login existente y se encarga de la redirección
 *   tras un login exitoso. También redirige automáticamente si ya hay sesión.
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
    // si veníamos de una ruta protegida, volver a ella
    if (from) {
      navigate(from, { replace: true });
      return;
    }
    // si es admin -> /admin, si no -> /mi-ficha
    const email = user?.email || "";
    if (email === ADMIN_EMAIL) {
      navigate("/admin", { replace: true });
    } else {
      navigate("/mi-ficha", { replace: true });
    }
  };

  // Pasa onLogin al componente Login (tu Login llama onLogin(cred.user))
  return <Login onLogin={handleOnLogin} />;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* raíz: redirige a login para que no vaya directamente a /admin */}
        <Route path="/" element={<Navigate to="/login" replace />} />

        {/* ruta login (usa tu componente Login existente) */}
        <Route path="/login" element={<LoginWrapper />} />

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