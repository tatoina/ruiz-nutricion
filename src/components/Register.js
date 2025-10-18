import React, { useState } from "react";
import "./estilos.css";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { setDoc, doc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "../Firebase";

export default function Register({ onBackToLogin }) {
  const [nombre, setNombre] = useState("");
  const [apellidos, setApellidos] = useState("");
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [nacimiento, setNacimiento] = useState("");
  const [telefono, setTelefono] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleRegister = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const uc = await createUserWithEmailAndPassword(auth, email.trim(), pass);
      const uid = uc.user.uid;

      await setDoc(doc(db, "users", uid), {
        nombre: nombre || "",
        apellidos: apellidos || "",
        email: email.trim(),
        nacimiento: nacimiento || "",
        telefono: telefono || "",
        createdAt: serverTimestamp(),
        pesoActual: null,
        pesoHistorico: [],
        medidas: {},
        ejercicios: false,
        recetas: false,
      });

      // Usuario queda autenticado automáticamente.
      // No forzamos volver a la pantalla de login aquí.
    } catch (err) {
      console.error("[REGISTER] error:", err);
      setError(err?.message || "Error al registrar usuario");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-card card">
        <h2 className="login-title">Crear cuenta</h2>

        {error && <div className="mensaje error" style={{ marginBottom: 12 }}>{error}</div>}

        <form onSubmit={handleRegister} className="login-form" autoComplete="on" aria-label="Formulario de registro">
          <input
            id="nombre"
            className="input"
            type="text"
            placeholder="Nombre"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            autoComplete="given-name"
          />

          <input
            id="apellidos"
            className="input"
            type="text"
            placeholder="Apellidos"
            value={apellidos}
            onChange={(e) => setApellidos(e.target.value)}
            autoComplete="family-name"
          />

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

          <input
            id="pass"
            className="input"
            type="password"
            placeholder="Contraseña"
            value={pass}
            onChange={(e) => setPass(e.target.value)}
            required
            autoComplete="new-password"
          />

          <input
            id="nacimiento"
            className="input"
            type="date"
            placeholder="Fecha de nacimiento"
            value={nacimiento}
            onChange={(e) => setNacimiento(e.target.value)}
            autoComplete="bday"
          />

          <input
            id="telefono"
            className="input"
            type="tel"
            placeholder="Teléfono"
            value={telefono}
            onChange={(e) => setTelefono(e.target.value)}
            autoComplete="tel"
          />

          <div className="actions" style={{ marginTop: 12 }}>
            <button type="submit" className="btn primary full-width" disabled={loading}>
              {loading ? "Creando..." : "Crear cuenta"}
            </button>
            <button type="button" className="btn ghost full-width" onClick={onBackToLogin} style={{ marginTop: 10 }}>
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}