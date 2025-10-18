// ...existing code...
import React, { useState } from "react";
import "./estilos.css";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "../Firebase";
import logo from "../assets/logo.png";

export default function Login({ onLogin, onShowRegister }) {
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const cred = await signInWithEmailAndPassword(auth, email.trim(), pass);
      if (onLogin) onLogin(cred.user);
    } catch (err) {
      setError(err?.message || "Error al iniciar sesión");
      console.error("[LOGIN] ", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
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
            <button type="submit" className="btn primary" style={{ flex: 1 }}>
              {loading ? "Entrando..." : "Entrar"}
            </button>
          </div>
        </form>

        <div className="login-footer" style={{ marginTop: 14 }}>
          <button
            type="button"
            className="btn primary"
            onClick={onShowRegister}
            style={{ width: "86%", maxWidth: 360 }}
          >
            Registrarse
          </button>
        </div>
      </div>
    </div>
  );
}
// ...existing code...