import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { auth, db } from "../Firebase";
import { updatePassword, signOut } from "firebase/auth";
import { doc, updateDoc, getDoc } from "firebase/firestore";
import "./estilos.css";
import logo from "../assets/logo.png";

export default function ChangePassword() {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const navigate = useNavigate();
  const location = useLocation();
  const isFirstLogin = location.state?.firstLogin || false;

  useEffect(() => {
    if (!auth.currentUser) {
      navigate("/login");
    }
  }, [navigate]);

  // Bloquear salida si es primer login
  useEffect(() => {
    if (!isFirstLogin) return;

    const handleBeforeUnload = (e) => {
      e.preventDefault();
      e.returnValue = "Debes cambiar tu contraseña antes de continuar";
      return "Debes cambiar tu contraseña antes de continuar";
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [isFirstLogin]);

  const handleCancelFirstLogin = async () => {
    if (isFirstLogin) {
      if (window.confirm("Si no cambias tu contraseña, se cerrará tu sesión. ¿Deseas continuar?")) {
        await signOut(auth);
        navigate("/login");
      }
    } else {
      navigate(-1); // Volver a la página anterior
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (!newPassword || !confirmPassword) {
      setError("Por favor, completa ambos campos.");
      return;
    }

    if (newPassword.length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Las contraseñas no coinciden.");
      return;
    }

    setLoading(true);
    try {
      const user = auth.currentUser;
      
      // Actualizar contraseña en Firebase Auth
      await updatePassword(user, newPassword);
      
      // Marcar que ya no necesita cambiar contraseña
      await updateDoc(doc(db, "users", user.uid), {
        mustChangePassword: false
      });

      // Obtener datos del usuario para redirigir correctamente
      const userDoc = await getDoc(doc(db, "users", user.uid));
      const userData = userDoc.data();
      const isAdmin = userData?.rol === "admin" || user.email === "admin@admin.es";

      // Redirigir según el rol
      if (isAdmin) {
        navigate("/admin", { replace: true });
      } else {
        navigate("/mi-ficha", { replace: true });
      }
    } catch (err) {
      console.error("Error al cambiar contraseña:", err);
      if (err.code === "auth/requires-recent-login") {
        setError("Por seguridad, debes volver a iniciar sesión antes de cambiar tu contraseña.");
      } else {
        setError(err.message || "Error al cambiar la contraseña");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-card card">
        <img src={logo} alt="App logo" className="login-logo" />
        
        <h2 className="login-title">
          {isFirstLogin ? "Cambiar Contraseña" : "Nueva Contraseña"}
        </h2>

        {isFirstLogin && (
          <div style={{
            padding: "12px",
            background: "#fef3c7",
            borderRadius: "8px",
            marginBottom: "16px",
            fontSize: "14px",
            color: "#92400e",
            textAlign: "center"
          }}>
            Por seguridad, debes cambiar tu contraseña antes de continuar.
          </div>
        )}

        {error && (
          <div className="mensaje error" style={{ marginBottom: 12 }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="login-form">
          <input
            className="input"
            type="password"
            placeholder="Nueva contraseña"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
            autoFocus
            minLength={6}
          />

          <input
            className="input"
            type="password"
            placeholder="Confirmar contraseña"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            minLength={6}
          />

          <button
            type="submit"
            className="btn primary"
            disabled={loading}
            style={{ width: "100%" }}
          >
            {loading ? "Cambiando..." : "Cambiar Contraseña"}
          </button>

          {!isFirstLogin && (
            <button
              type="button"
              onClick={handleCancelFirstLogin}
              className="btn ghost"
              disabled={loading}
              style={{ 
                width: "100%",
                marginTop: "10px",
                border: "1px solid #cbd5e0",
                color: "#4a5568"
              }}
            >
              Cancelar
            </button>
          )}

          {isFirstLogin && (
            <button
              type="button"
              onClick={handleCancelFirstLogin}
              className="btn ghost"
              disabled={loading}
              style={{ 
                width: "100%",
                marginTop: "10px",
                fontSize: "13px",
                color: "#e53e3e",
                textDecoration: "underline"
              }}
            >
              Cerrar sesión
            </button>
          )}
        </form>
      </div>
    </div>
  );
}
