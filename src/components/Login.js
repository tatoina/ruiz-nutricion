import React, { useState } from "react";
import "./estilos.css";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "../Firebase";
import logo from "../assets/logo.png";
import pkg from "../../package.json";
import { useNavigate } from "react-router-dom";

export default function Login({ onLogin /* onShowRegister no usado ahora */ }) {
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const navigate = useNavigate();

  const today = new Date();
  const dateStr = today
    .toLocaleDateString("es-ES", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    })
    .replace(/^./, (c) => c.toUpperCase());

  const appVersion = process.env.REACT_APP_VERSION || (pkg && pkg.version) || "dev";

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const cred = await signInWithEmailAndPassword(auth, email.trim(), pass);
      const user = cred?.user;
      const normalizedEmail = String(user?.email || "").trim().toLowerCase();
      console.debug("[LOGIN] signIn success", { uid: user?.uid, email: user?.email, normalizedEmail });

      if (onLogin && typeof onLogin === "function") {
        try {
          // Pass the firebase user object (callback or wrapper will normalize as needed)
          onLogin(user);
          console.debug("[LOGIN] onLogin callback invoked.");
        } catch (cbErr) {
          console.error("[LOGIN] onLogin callback threw:", cbErr);
          // As fallback, navigate based on email
          if (normalizedEmail === "admin@admin.es") {
            navigate("/admin");
          } else {
            navigate("/mi-ficha");
          }
        }
      } else {
        // Fallback navigation if no callback provided
        if (normalizedEmail === "admin@admin.es") {
          navigate("/admin");
        } else {
          navigate("/mi-ficha");
        }
      }
    } catch (err) {
      setError(err?.message || "Error al iniciar sesión");
      console.error("[LOGIN] signIn error:", err);
    } finally {
      setLoading(false);
    }
  };

  // Registrarse se ha movido a la cabecera (sólo visible para admin).
  // Por eso eliminamos el link/btn de registro dentro de esta vista de login.

  return (
    <div className="login-page">
      <div className="login-header" aria-hidden="true">
        <div className="login-date">{dateStr}</div>
        <div className="app-version">v{appVersion}</div>
      </div>

      <div className="login-card card">
        <img src={logo} alt="App logo" className="login-logo" />

        <form onSubmit={handleSubmit} className="login-form" autoComplete="on" aria-label="Formulario de acceso">
          <label htmlFor="email" className="sr-only">Correo</label>
          <input
            id="email"
            className="input"
            type="email"
            placeholder="Correo electrónico"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
            autoFocus
          />

          <label htmlFor="pass" className="sr-only">Contraseña</label>
          <input
            id="pass"
            className="input"
            type="password"
            placeholder="Contraseña"
            value={pass}
            onChange={(e) => setPass(e.target.value)}
            required
            autoComplete="current-password"
          />

          {error && (
            <div className="mensaje error" role="alert" aria-live="polite" style={{ marginTop: 10 }}>
              {error}
            </div>
          )}

          <div className="actions" style={{ marginTop: 12 }}>
            <button
              type="submit"
              className="btn primary full-width"
              disabled={loading}
              aria-busy={loading ? "true" : "false"}
            >
              {loading ? "Entrando..." : "Entrar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}