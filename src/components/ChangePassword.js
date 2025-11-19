import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { auth, db } from "../Firebase";
import { updatePassword } from "firebase/auth";
import { doc, updateDoc } from "firebase/firestore";
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

      // Redirigir a su ficha
      navigate("/mi-ficha");
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
        </form>
      </div>
    </div>
  );
}
