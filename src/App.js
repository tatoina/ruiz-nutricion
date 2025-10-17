import React, { useEffect, useState } from "react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth, db } from "./Firebase";
import { doc, getDoc } from "firebase/firestore";

import Login from "./components/Login";
import Register from "./components/Register";
import FichaUsuario from "./components/FichaUsuario";
import AdminPanel from "./components/AdminPanel";

export default function App() {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState("");
  const [loading, setLoading] = useState(true);
  const [showRegister, setShowRegister] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (usuario) => {
      if (usuario) {
        setUser(usuario);
        const docRef = doc(db, "usuarios", usuario.email);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setRole(docSnap.data().role);
        } else {
          setRole("");
        }
      } else {
        setUser(null);
        setRole("");
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleLogout = async () => {
    await signOut(auth);
    setUser(null);
    setRole("");
  };

  if (loading) return <p>Cargando...</p>;

  if (!user) {
    return showRegister ? (
      <Register onRegister={() => setShowRegister(false)} />
    ) : (
      <Login onRegisterClick={() => setShowRegister(true)} />
    );
  }

  // ✅ Si es ADMIN → panel completo de usuarios
  if (role === "admin") {
    return <AdminPanel onLogout={handleLogout} />;
  }

  // ✅ Si es USUARIO → ficha personal
  if (role === "usuario") {
    return <FichaUsuario user={user} onLogout={handleLogout} />;
  }

  return <p>No tienes permisos asignados.</p>;
}
