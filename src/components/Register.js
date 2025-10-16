import React, { useState } from 'react';
import Layout from './Layout';
import { fetchData } from '../services/googleSheets';

function Register({ onRegister, onBack }) {
  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    // Importante: el campo debe llamarse 'contraseña'
    const res = await fetchData('register', { nombre, email, contraseña: pass });
    if (res.ok) {
      alert('Registro exitoso');
      if (onRegister) onRegister({ nombre, email, tipo: 'usuario' });
      setNombre('');
      setEmail('');
      setPass('');
    } else {
      alert('Error en el registro');
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
          style={{ margin: "8px 0", padding: "8px", width: "90%", borderRadius: 6, border: "1px solid #ccc" }}
        /><br/>
        <input
          type="email"
          placeholder="Correo"
          value={email}
          onChange={e => setEmail(e.target.value)}
          required
          style={{ margin: "8px 0", padding: "8px", width: "90%", borderRadius: 6, border: "1px solid #ccc" }}
        /><br/>
        <input
          type="password"
          placeholder="Contraseña"
          value={pass}
          onChange={e => setPass(e.target.value)}
          required
          style={{ margin: "8px 0", padding: "8px", width: "90%", borderRadius: 6, border: "1px solid #ccc" }}
        /><br/>
        <button
          type="submit"
          style={{
            background: "#36ae67",
            color: "white",
            padding: "10px 35px",
            borderRadius: 6,
            border: "none",
            cursor: "pointer",
            fontWeight: "bold"
          }}>
          Registrarse
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
        }}>
        Volver
      </button>
    </Layout>
  );
}

export default Register;
