import React, { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "../Firebase";

/**
 * PrivateRoute
 * - children: componente a renderizar si hay usuario autenticado
 * - redirectTo: ruta de login (default "/login")
 *
 * Mientras se comprueba el estado de auth muestra un placeholder.
 * Si no hay usuario, redirige a redirectTo guardando la ruta destino en state.
 */
export default function PrivateRoute({ children, redirectTo = "/login" }) {
  const [checking, setChecking] = useState(true);
  const [user, setUser] = useState(null);
  const location = useLocation();

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setChecking(false);
    });
    return () => unsub();
  }, []);

  if (checking) {
    return (
      <div className="layout">
        <div className="card">
          <p style={{ padding: 16 }}>Comprobando sesión...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    // redirige a login y pasa la ruta de origen en state (para volver tras login)
    return <Navigate to={redirectTo} state={{ from: location }} replace />;
  }

  return children;
}