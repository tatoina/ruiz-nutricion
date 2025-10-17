import React, { useState } from "react";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { setDoc, doc } from "firebase/firestore";
import { auth, db } from "../Firebase";
import Layout from "./Layout";

export default function Register({ onRegister, onBack }) {
  const [nombre, setNombre] = useState("");
  const [apellidos, setApellidos] = useState("");
  const [email, setEmail] = useState("");
  const [nacimiento, setNacimiento] = useState("");
  const [pass, setPass] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, pass);
      await setDoc(doc(db, "usuarios", userCredential.user.email), {
        nombre,
        apellidos,
        email,
        nacimiento,
        role: "usuario",
        pesoHistorico: [],
        ejercicios: "no",
        recetas: "no",
      });
      alert("Usuario registrado correctamente");
      onRegister(); // volver a login
    } catch (err) {
      alert("Error: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout>
      <h2>Registro de usuario</h2>
      <form onSubmit={handleSubmit}>
        <input
          type="text"
          placeholder="Nombre"
          value={nombre}
          onChange={e => setNombre(e.target.value)}
          required
        />
        <input
          type="text"
          placeholder="Apellidos"
          value={apellidos}
          onChange={e => setApellidos(e.target.value)}
          required
        />
        <input
          type="email"
          placeholder="Correo"
          value={email}
          onChange={e => setEmail(e.target.value)}
          required
        />
        <input
          type="date"
          value={nacimiento}
          onChange={e => setNacimiento(e.target.value)}
          required
        />
        <input
          type="password"
          placeholder="Contraseña"
          value={pass}
          onChange={e => setPass(e.target.value)}
          required
        />
        <button type="submit" className="btn">
          {loading ? "Registrando..." : "Registrarse"}
        </button>
      </form>
      <button type="button" className="btn" style={{ marginTop: "12px" }} onClick={onBack}>
        Volver
      </button>
    </Layout>
  );
}
