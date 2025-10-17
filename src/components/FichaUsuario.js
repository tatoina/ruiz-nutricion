import React, { useState, useEffect } from "react";
import { auth, db } from "../Firebase";
import { signOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  LineElement,
  CategoryScale,
  LinearScale,
  PointElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";

ChartJS.register(LineElement, CategoryScale, LinearScale, PointElement, Title, Tooltip, Legend);

export default function FichaUsuario() {
  const [userData, setUserData] = useState(null);
  const [activeTab, setActiveTab] = useState("datos");

  useEffect(() => {
    const fetchUserData = async () => {
      const user = auth.currentUser;
      if (user) {
        const userDoc = doc(db, "users", user.uid);
        const userSnap = await getDoc(userDoc);
        if (userSnap.exists()) setUserData(userSnap.data());
      }
    };
    fetchUserData();
  }, []);

  if (!userData) return <div className="p-6 text-center text-gray-600">Cargando ficha...</div>;

  const pesoHistorico = userData.pesoHistorico || [];
  const labels = pesoHistorico.map((p) => p.fecha);
  const pesos = pesoHistorico.map((p) => p.peso);

  const chartData = {
    labels,
    datasets: [
      {
        label: "Evolución del Peso (kg)",
        data: pesos,
        borderColor: "#4F46E5",
        backgroundColor: "rgba(79, 70, 229, 0.2)",
        tension: 0.3,
        fill: true,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    plugins: {
      legend: { display: false },
      title: { display: true, text: "Evolución del peso" },
    },
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6 flex flex-col items-center">
      <div className="w-full max-w-4xl bg-white rounded-2xl shadow-lg p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-semibold text-indigo-700">
            Bienvenido, {userData.nombre || "Usuario"}
          </h2>
          <button
            onClick={() => signOut(auth)}
            className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg text-sm"
          >
            Cerrar sesión
          </button>
        </div>

        {/* 🟣 NAV TABS */}
        <div className="flex flex-wrap gap-2 border-b pb-2 mb-4">
          {["datos", "dieta", "pesaje"]
            .concat(userData.ejercicios === "si" ? ["ejercicios"] : [])
            .concat(userData.recetas === "si" ? ["recetas"] : [])
            .map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 rounded-t-lg text-sm font-medium ${
                  activeTab === tab
                    ? "bg-indigo-600 text-white"
                    : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                }`}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
        </div>

        {/* 🟢 CONTENIDOS */}
        {activeTab === "datos" && (
          <div>
            <h3 className="text-lg font-semibold mb-4 text-indigo-700">Datos personales</h3>
            <div className="grid grid-cols-2 gap-4 text-gray-700">
              <p><strong>Nombre:</strong> {userData.nombre}</p>
              <p><strong>Apellidos:</strong> {userData.apellidos}</p>
              <p><strong>Email:</strong> {userData.email}</p>
              <p><strong>Fecha de nacimiento:</strong> {userData.nacimiento}</p>
            </div>
          </div>
        )}

        {activeTab === "dieta" && (
          <div>
            <h3 className="text-lg font-semibold mb-4 text-indigo-700">Datos de dieta</h3>
            <div className="grid grid-cols-2 gap-4 text-gray-700">
              <p><strong>Objetivo nutricional:</strong> {userData.objetivonutricional}</p>
              <p><strong>Restricciones:</strong> {userData.restricciones}</p>
              <p><strong>Dieta actual:</strong> {userData.dietaactual}</p>
              <p><strong>Ejercicios:</strong> {userData.ejercicios}</p>
              <p><strong>Recetas:</strong> {userData.recetas}</p>
            </div>
          </div>
        )}

        {activeTab === "pesaje" && (
          <div>
            <h3 className="text-lg font-semibold mb-4 text-indigo-700">Pesaje y medidas</h3>

            <div className="mb-6 bg-gray-100 rounded-lg p-4">
              <p><strong>Peso actual:</strong> {userData.pesoActual || "—"} kg</p>
              {userData.medidas && (
                <div className="grid grid-cols-3 gap-2 mt-2">
                  {Object.entries(userData.medidas).map(([key, value]) => (
                    <p key={key}>
                      <strong>{key.charAt(0).toUpperCase() + key.slice(1)}:</strong> {value} cm
                    </p>
                  ))}
                </div>
              )}
            </div>

            {pesoHistorico.length > 0 ? (
              <div>
                <Line data={chartData} options={chartOptions} />
                <table className="w-full mt-4 border text-sm text-gray-700">
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
                    {pesoHistorico.map((item, i) => (
                      <tr key={i} className="text-center">
                        <td className="border p-2">{item.fecha}</td>
                        <td className="border p-2">{item.peso}</td>
                        <td className="border p-2">{item.medidas?.cintura || "-"}</td>
                        <td className="border p-2">{item.medidas?.cadera || "-"}</td>
                        <td className="border p-2">{item.medidas?.pecho || "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-gray-500">No hay registros de peso aún.</p>
            )}
          </div>
        )}

        {activeTab === "ejercicios" && (
          <div>
            <h3 className="text-lg font-semibold mb-4 text-indigo-700">Ejercicios</h3>
            <p className="text-gray-700 whitespace-pre-line">
              {userData.ejerciciosDescripcion || "No hay información sobre ejercicios."}
            </p>
          </div>
        )}

        {activeTab === "recetas" && (
          <div>
            <h3 className="text-lg font-semibold mb-4 text-indigo-700">Recetas</h3>
            <p className="text-gray-700 whitespace-pre-line">
              {userData.recetasDescripcion || "No hay recetas asignadas aún."}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
