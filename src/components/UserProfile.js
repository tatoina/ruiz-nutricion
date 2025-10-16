import React, { useState, useEffect } from 'react';
import Layout from './Layout';
import { fetchData } from '../services/googleSheets';

function UserProfile({ userEmail, onLogout }) {
  // Estado para los datos del usuario
  const [datos, setDatos] = useState({
    nombre: '',
    apellidos: '',
    nacimiento: '',
    pesoActual: '',
    pesoHistorico: [] // Array de objetos { fecha, peso }
  });

  // Cargar datos del usuario al montar el componente
  useEffect(() => {
    async function cargarDatos() {
      const res = await fetchData('getUser', { email: userEmail });
      if (res.ok && res.data) {
        setDatos(res.data);
      }
    }
    if (userEmail) cargarDatos();
  }, [userEmail]);

  // Guardar los cambios en Google Sheets
  const handleGuardar = async (e) => {
    e.preventDefault();
    const res = await fetchData('updateUser', { email: userEmail, ...datos });
    if (res.ok) alert("Datos guardados correctamente");
    else alert("Error al guardar los datos");
  };

  // Añadir nuevo registro al histórico de peso
  const añadirPeso = () => {
    if (datos.pesoActual) {
      setDatos(old => ({
        ...old,
        pesoHistorico: [
          ...old.pesoHistorico,
          { fecha: new Date().toISOString().slice(0, 10), peso: old.pesoActual }
        ]
      }));
    }
  };

  return (
    <Layout>
      <h2>Mi ficha</h2>
      <form onSubmit={handleGuardar}>
        <input
          type="text"
          placeholder="Nombre"
          value={datos.nombre}
          onChange={e => setDatos({ ...datos, nombre: e.target.value })}
          required
        /><br/>
        <input
          type="text"
          placeholder="Apellidos"
          value={datos.apellidos}
          onChange={e => setDatos({ ...datos, apellidos: e.target.value })}
        /><br/>
        <input
          type="date"
          placeholder="Fecha de nacimiento"
          value={datos.nacimiento}
          onChange={e => setDatos({ ...datos, nacimiento: e.target.value })}
        /><br/>
        <input
          type="number"
          placeholder="Peso actual (kg)"
          value={datos.pesoActual}
          onChange={e => setDatos({ ...datos, pesoActual: e.target.value })}
        /><br/>
        <button type="button" onClick={añadirPeso} style={{ margin: "8px" }}>
          Añadir a histórico
        </button>
        <button type="submit" style={{
          background: "#36ae67",
          color: "white",
          padding: "10px 35px",
          borderRadius: 6,
          border: "none",
          cursor: "pointer",
          fontWeight: "bold",
          margin: "8px"
        }}>
          Guardar ficha
        </button>
      </form>

      <h3>Peso histórico</h3>
      <ul style={{ textAlign: "left" }}>
        {datos.pesoHistorico.map((p, i) => (
          <li key={i}>
            {p.fecha}: {p.peso} kg
          </li>
        ))}
      </ul>
      <button
        onClick={onLogout}
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
        Cerrar sesión
      </button>
    </Layout>
  );
}

export default UserProfile;
