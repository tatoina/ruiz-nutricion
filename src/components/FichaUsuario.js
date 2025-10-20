import React, { useEffect, useState, useRef } from "react";
import { signOut } from "firebase/auth";
import { auth, db } from "../firebase";
import { doc, getDoc } from "firebase/firestore";
import { Chart } from "react-chartjs-2";
import { Bar } from "react-chartjs-2";
import { useParams } from "react-router-dom";

const FichaUsuario = () => {
  const { userId } = useParams();
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const rootRef = useRef(null);

  const DRIVE_FOLDER_EXERCISES = "1abcdEjemploFolderEjercicios";
  const DRIVE_FOLDER_RECIPES = "1abcdEjemploFolderRecetas";

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const userDocRef = doc(db, "usuarios", userId);
        const userDoc = await getDoc(userDocRef);
        if (userDoc.exists()) {
          setUserData(userDoc.data());
        } else {
          setError("No se encontró el usuario.");
        }
      } catch (err) {
        console.error(err);
        setError("Error al obtener los datos del usuario.");
      } finally {
        setLoading(false);
      }
    };

    fetchUserData();
  }, [userId]);

  const exercisesFolder = (userData && userData.driveEjerciciosFolderId)
    ? userData.driveEjerciciosFolderId
    : DRIVE_FOLDER_EXERCISES;

  const recipesFolder = (userData && userData.driveRecetasFolderId)
    ? userData.driveRecetasFolderId
    : DRIVE_FOLDER_RECIPES;

  // ✅ Función añadida para solucionar el error
  const handleSignOut = async () => {
    try {
      await signOut(auth);
      console.log("Sesión cerrada correctamente");
      // Si usas React Router, puedes redirigir al login:
      // window.location.href = "/login";
    } catch (error) {
      console.error("Error al cerrar sesión:", error);
      setError("No se pudo cerrar la sesión.");
    }
  };

  if (loading) return <p>Cargando datos del usuario...</p>;
  if (error) return <p>{error}</p>;

  return (
    <div ref={rootRef} className="ficha-usuario">
      <h2>Ficha de Usuario</h2>
      <p><strong>Nombre:</strong> {userData?.nombre}</p>
      <p><strong>Email:</strong> {userData?.email}</p>

      <h3>Progreso semanal</h3>
      <Bar
        data={{
          labels: ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes"],
          datasets: [
            {
              label: "Ejercicio (minutos)",
              data: userData?.progreso || [30, 45, 40, 50, 60],
              backgroundColor: "rgba(75,192,192,0.6)",
            },
          ],
        }}
        options={{
          responsive: true,
          plugins: {
            legend: {
              position: "top",
            },
          },
        }}
      />

      <div className="enlaces-drive">
        <h3>Recursos del usuario</h3>
        <a
          href={`https://drive.google.com/drive/folders/${exercisesFolder}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          📁 Carpeta de Ejercicios
        </a>
        <a
          href={`https://drive.google.com/drive/folders/${recipesFolder}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          📁 Carpeta de Recetas
        </a>
      </div>

      <button className="btn danger" onClick={handleSignOut}>
        Cerrar sesión
      </button>
    </div>
  );
};

export default FichaUsuario;
