// src/components/Login.jsx
import React, { useState } from "react";
import "./estilos.css";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "../Firebase";
import logo from "../assets/logo.png";
import pkg from "../../package.json";
import { useNavigate } from "react-router-dom";

export default function Login({ onLogin, onShowRegister }) {
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
      if (onLogin && typeof onLogin === "function") {
        onLogin(cred.user);
      } else {
        navigate("/mi-ficha");
      }
    } catch (err) {
      setError(err?.message || "Error al iniciar sesión");
      console.error("[LOGIN] signIn error:", err);
    } finally {
      setLoading(false);
    }
  };

  // Extremely defensive handler for "Registrarse".
  // - Always logs the click.
  // - If parent provides onShowRegister, call it and prevent navigation.
  // - Otherwise allow anchor to navigate. If navigate fails, fallback to window.location.
  const handleShowRegister = (e) => {
    console.debug("[LOGIN] Registrarse clicked", { onShowRegisterType: typeof onShowRegister });
    // If parent provided a handler, call it and prevent default navigation
    if (typeof onShowRegister === "function") {
      try {
        e && e.preventDefault();
        onShowRegister();
        console.debug("[LOGIN] onShowRegister() called.");
        return;
      } catch (err) {
        console.error("[LOGIN] onShowRegister threw:", err);
        // fallthrough to try navigate
      }
    }

    // Try react-router navigate
    try {
      e && e.preventDefault();
      navigate("/register");
      console.debug("[LOGIN] navigate('/register') called.");
      return;
    } catch (err) {
      console.error("[LOGIN] navigate failed:", err);
    }

    // Final fallback: allow default anchor (no preventDefault) or force full-page redirect
    try {
      // If event present and default prevented earlier, skip; otherwise do assign
      if (e && e.defaultPrevented) {
        console.debug("[LOGIN] default already prevented; not assigning location.");
      } else {
        window.location.assign("/register");
        console.debug("[LOGIN] window.location.assign('/register') used as fallback.");
      }
    } catch (err) {
      console.error("[LOGIN] fallback redirect failed:", err);
    }
  };

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

          {error && <div className="mensaje error" style={{ marginTop: 10 }}>{error}</div>}

          <div className="actions" style={{ marginTop: 12 }}>
            <button type="submit" className="btn primary full-width" disabled={loading}>
              {loading ? "Entrando..." : "Entrar"}
            </button>
          </div>
        </form>

        <div className="login-footer" style={{ marginTop: 14 }}>
          {/* Use an anchor so browser navigation always works if JS handlers fail.
              handleShowRegister will call e.preventDefault() when it wants to intercept. */}
          <a
            href="/register"
            className="btn ghost full-width"
            onClick={handleShowRegister}
            role="button"
            aria-label="Registrarse"
            data-test="login-register"
            style={{ display: "inline-block", textDecoration: "none", textAlign: "center" }}
          >
            Registrarse
          </a>
        </div>
      </div>
    </div>
  );
}