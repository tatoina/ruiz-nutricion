import React, { useState } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "../Firebase";
import Layout from "./Layout";
import logo from "../assets/logo.png"; // Asegúrate de tener el logo en src/assets/

export default function Login({ onLogin, onShowRegister }) {
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, pass);
      const userEmail = userCredential.user.email;
      const docRef = doc(db, "usuarios", userEmail);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const data = docSnap.data();
        alert("Bienvenido, " + data.nombre);
        onLogin(data);
      } else {
        alert("Usuario no encontrado en Firestore");
      }
    } catch (err) {
      alert("Error: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout>
      <img src={logo} alt="Logo" />
      <h2>Iniciar sesión</h2>
      <form onSubmit={handleSubmit}>
        <input
          type="email"
          placeholder="Correo"
          value={email}
          onChange={e => setEmail(e.target.value)}
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
          {loading ? "Entrando..." : "Entrar"}
        </button>
      </form>
      <button className="btn" onClick={onShowRegister}>
        Registrarse
      </button>
    </Layout>
  );
}
