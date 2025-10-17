import React, { useState, useEffect } from "react";
import { collection, getDocs } from "firebase/firestore";
import { signOut } from "firebase/auth";
import { auth, db } from "../Firebase";

export default function AdminDashboard() {
  const [usuarios, setUsuarios] = useState([]);
  const [search, setSearch] = useState("");
  const [selectedUser, setSelectedUser] = useState(null);

  useEffect(() => {
    const fetchUsers = async () => {
      const querySnapshot = await getDocs(collection(db, "usuarios"));
      const userList = querySnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      setUsuarios(userList);
    };
    fetchUsers();
  }, []);

  const filteredUsers = usuarios.filter(
    (u) =>
      u.nombre?.toLowerCase().includes(search.toLowerCase()) ||
      u.email?.toLowerCase().includes(search.toLowerCase())
  );

  if (selectedUser) {
    return (
      <FichaUsuarioAdmin user={selectedUser} onBack={() => setSelectedUser(null)} />
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto bg-white rounded-2xl shadow-lg p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-semibold text-indigo-700">Panel de Administración</h2>
          <button
            onClick={() => signOut(auth)}
            className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg text-sm"
          >
            Cerrar sesión
          </button>
        </div>

        <div className="mb-4 flex justify-between items-center">
          <input
            type="text"
            placeholder="Buscar por nombre o email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 w-1/2"
          />
          <p className="text-gray-600 text-sm">
            Total usuarios: {filteredUsers.length}
          </p>
        </div>

        <table className="w-full border text-sm text-gray-700">
          <thead>
            <tr className="bg-indigo-100">
              <th className="p-2 border">Nombre</th>
              <th className="p-2 border">Email</th>
              <th className="p-2 border">Nacimiento</th>
              <th className="p-2 border">Ejercicios</th>
              <th className="p-2 border">Recetas</th>
              <th className="p-2 border">Acción</th>
            </tr>
          </thead>
          <tbody>
            {filteredUsers.map((user, i) => (
              <tr key={i} className="hover:bg-gray-50">
                <td className="border p-2">{user.nombre}</td>
                <td className="border p-2">{user.email}</td>
                <td className="border p-2">{user.nacimiento}</td>
                <td className="border p-2">{user.ejercicios}</td>
                <td className="border p-2">{user.recetas}</td>
                <td className="border p-2 text-center">
                  <button
                    onClick={() => setSelectedUser(user)}
                    className="bg-indigo-500 hover:bg-indigo-600 text-white px-3 py-1 rounded-md text-xs"
                  >
                    Ver ficha
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function FichaUsuarioAdmin({ user, onBack }) {
  return (
    <div className="bg-white p-6 rounded-2xl shadow-lg max-w-3xl mx-auto">
      <button
        onClick={onBack}
        className="bg-gray-300 hover:bg-gray-400 text-gray-800 px-3 py-1 rounded mb-4"
      >
        ← Volver
      </button>

      <h3 className="text-xl font-semibold text-indigo-700 mb-4">
        Ficha de {user.nombre}
      </h3>

      <div className="grid grid-cols-2 gap-4 text-gray-700">
        <p><strong>Nombre:</strong> {user.nombre}</p>
        <p><strong>Apellidos:</strong> {user.apellidos}</p>
        <p><strong>Email:</strong> {user.email}</p>
        <p><strong>Nacimiento:</strong> {user.nacimiento}</p>
        <p><strong>Ejercicios:</strong> {user.ejercicios}</p>
        <p><strong>Recetas:</strong> {user.recetas}</p>
      </div>

      {user.pesoHistorico?.length > 0 && (
        <>
          <h4 className="mt-6 font-semibold text-indigo-700">Histórico de peso</h4>
          <table className="w-full mt-2 border text-sm text-gray-700">
            <thead>
              <tr className="bg-indigo-100">
                <th className="p-2 border">Fecha</th>
                <th className="p-2 border">Peso</th>
                <th className="p-2 border">Cintura</th>
                <th className="p-2 border">Cadera</th>
                <th className="p-2 border">Pecho</th>
              </tr>
            </thead>
            <tbody>
              {user.pesoHistorico.map((p, i) => (
                <tr key={i} className="text-center">
                  <td className="border p-2">{p.fecha}</td>
                  <td className="border p-2">{p.peso}</td>
                  <td className="border p-2">{p.medidas?.cintura || "-"}</td>
                  <td className="border p-2">{p.medidas?.cadera || "-"}</td>
                  <td className="border p-2">{p.medidas?.pecho || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}
