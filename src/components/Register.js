// src/components/Register.jsx
import React, { useState } from "react";
import "./estilos.css";
import { createUserWithEmailAndPassword, updateProfile } from "firebase/auth";
import { setDoc, doc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "../Firebase";
import { useNavigate } from "react-router-dom";

/**
 * Register — formulario de registro mejorado
 *
 * Cambios / mejoras:
 * - Validación mínima de campos (email, contraseña longitud mínima).
 * - Muestra mensajes de error amigables por códigos de Firebase.
 * - Actualiza displayName del usuario en Auth (updateProfile).
 * - Crea documento users/{uid} en Firestore (setDoc).
 * - Después de registrar navega automáticamente a /mi-ficha.
 * - Evita dobles envíos con disabled mientras loading=true.
 * - Llamada opcional onBackToLogin para volver a la pantalla de login.
 *
 * Usa:
 * <Register onBackToLogin={() => setShowRegister(false)} />
 */

export default function Register({ onBackToLogin }) {
  const [nombre, setNombre] = useState("");
  const [apellidos, setApellidos] = useState("");
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [nacimiento, setNacimiento] = useState("");
  const [telefono, setTelefono] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const navigate = useNavigate();

  const friendlyError = (err) => {
    const code = err?.code || "";
    const message = err?.message || "";
    if (code.includes("auth/email-already-in-use") || message.includes("email-already-in-use")) {
      return "Ya existe una cuenta con ese correo.";
    }
    if (code.includes("auth/invalid-email") || message.includes("invalid-email")) {
      return "El correo no es válido.";
    }
    if (code.includes("auth/weak-password") || message.includes("weak-password")) {
      return "La contraseña es demasiado débil (mínimo 6 caracteres).";
    }
    if (code.includes("auth/operation-not-allowed")) {
      return "Registro deshabilitado en el proyecto de Firebase.";
    }
    // Fallback
    return message || "Error al registrar usuario.";
  };

  const sanitizeTelefono = (t) => {
    if (!t) return "";
    // keep digits, plus and spaces/dashes
    return String(t).trim();
  };

  const handleRegister = async (e) => {
    e?.preventDefault();
    setError(null);

    // Client-side validations
    if (!email || !pass) {
      setError("Introduce correo y contraseña.");
      return;
    }
    if (pass.length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres.");
      return;
    }

    setLoading(true);
    try {
      const uc = await createUserWithEmailAndPassword(auth, email.trim(), pass);
      const uid = uc.user.uid;

      // update displayName in Auth (optional)
      try {
        const displayName = `${nombre || ""} ${apellidos || ""}`.trim();
        if (displayName) {
          await updateProfile(uc.user, { displayName });
        }
      } catch (updErr) {
        // No crítico: logueamos pero no abortamos
        console.warn("[REGISTER] updateProfile failed:", updErr);
      }

      // create Firestore doc for the user
      await setDoc(doc(db, "users", uid), {
        nombre: nombre || "",
        apellidos: apellidos || "",
        email: email.trim(),
        nacimiento: nacimiento || "",
        telefono: sanitizeTelefono(telefono),
        createdAt: serverTimestamp(),
        pesoActual: null,
        pesoHistorico: [],
        medidas: {},
        ejercicios: false,
        recetas: false,
        mustChangePassword: true,
      });

      // Al registrarse el usuario queda autenticado. Redirigimos a su ficha.
      navigate("/mi-ficha");
    } catch (err) {
      console.error("[REGISTER] error:", err);
      setError(friendlyError(err));
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
            placeholder="Contraseña (mín. 6 caracteres)"
            value={pass}
            onChange={(e) => setPass(e.target.value)}
            required
            autoComplete="new-password"
            minLength={6}
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

            <button
              type="button"
              className="btn ghost full-width"
              onClick={() => {
                if (typeof onBackToLogin === "function") {
                  onBackToLogin();
                } else {
                  navigate("/login");
                }
              }}
              style={{ marginTop: 10 }}
            >
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}