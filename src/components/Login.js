import React, { useState } from 'react';
import Layout from './Layout';
import { fetchData } from '../services/googleSheets';
import './estilos.css';

function Login({ onLogin, onBack }) {
  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    // Asegura email normalizado (sin espacios y minúsculas)
    const emailNormalized = email.trim().toLowerCase();
    try {
      const res = await fetchData('getUser', { email: emailNormalized });
      if (res.ok) {
        if (res.data.contraseña === pass) {
          alert("Bienvenido, " + res.data.nombre);
          if (onLogin) onLogin({ email: res.data.email.trim().toLowerCase() });
        } else {
          alert("Contraseña incorrecta.");
        }
      } else {
        alert("No existe un usuario con ese correo.");
      }
    } catch (err) {
      alert("Error de conexión. Inténtalo de nuevo.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout>
      <h2>Iniciar sesión</h2>
      <form onSubmit={handleSubmit}>
        <input
          type="email"
          placeholder="Correo"
          value={email}
          onChange={e => setEmail(e.target.value)}
          required
          autoComplete="username"
          style={{ margin: "8px 0", padding: "8px", width: "90%", borderRadius: 6, border: "1px solid #ccc" }}
        /><br/>
        <input
          type="password"
          placeholder="Contraseña"
          value={pass}
          onChange={e => setPass(e.target.value)}
          required
          autoComplete="current-password"
          style={{ margin: "8px 0", padding: "8px", width: "90%", borderRadius: 6, border: "1px solid #ccc" }}
        /><br/>
        <button
          type="submit"
          disabled={loading}
          style={{
            background: "#36ae67",
            color: "white",
            padding: "10px 35px",
            borderRadius: 6,
            border: "none",
            cursor: loading ? "not-allowed" : "pointer",
            fontWeight: "bold"
          }}
        >
          {loading ? "Entrando..." : "Entrar"}
        </button>
      </form>
      <button
        onClick={onBack}
        style={{
          marginTop: "18px",
          background: "#eee",
          color: "#217a3a",
          padding: "8px 28px",
          borderRadius: 6,
          border: "none",
          cursor: "pointer",
          fontWeight: "bold"
        }}
      >
        Volver
      </button>
    </Layout>
  );
}

export default Login;
