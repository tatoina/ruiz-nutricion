import React, { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "./Firebase";

import Login from "./components/Login";
import Register from "./components/Register";
import FichaUsuario from "./components/FichaUsuario";
import AdminPanel from "./components/AdminPanel";

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showRegister, setShowRegister] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(
      auth,
      (u) => {
        console.log("[APP] onAuthStateChanged:", u);
        setUser(u);
        setLoading(false);
      },
      (err) => {
        console.error("[APP] onAuthStateChanged error:", err);
        setLoading(false);
      }
    );
    return () => unsub();
  }, []);

  if (loading) return <p>Cargando...</p>;

  if (!user) {
    return showRegister ? (
      <Register onBackToLogin={() => setShowRegister(false)} />
    ) : (
      <Login onLogin={setUser} onShowRegister={() => setShowRegister(true)} />
    );
  }

  if (user.email === "admin@admin.es") return <AdminPanel />;

  return <FichaUsuario />;
}