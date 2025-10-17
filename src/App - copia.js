// src/App.js
import React, { useState, useEffect } from "react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth } from "./Firebase";
import Login from "./components/Login";
import Register from "./components/Register";
import FichaUsuario from "./components/FichaUsuario";
import PanelAdmin from "./components/PanelAdmin";
import './estilos.css';

export default function App() {
  const [user, setUser] = useState(null); // info del usuario auth
  const [loading, setLoading] = useState(true);
  const [showRegister, setShowRegister] = useState(false);

  // Detecta cambios en sesión
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  if (loading) return <div>Cargando...</div>;

  if (!user) {
    // Mostrar formulario de registro o login
    if (showRegister) {
      return <Register onRegister={() => setShowRegister(false)} />;
    }
    return <Login onLogin={(u) => setUser(u)} onShowRegister={() => setShowRegister(true)} />;
  }

  // Admin
  if (user.email === "admin@admin.es") {
    return <PanelAdmin onLogout={() => signOut(auth)} />;
  }

  // Usuario normal
  return <FichaUsuario email={user.email} onLogout={() => signOut(auth)} />;
}
