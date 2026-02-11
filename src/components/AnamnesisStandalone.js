import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { doc, getDoc, onSnapshot } from "firebase/firestore";
import { db, auth } from "../Firebase";
import { onAuthStateChanged } from "firebase/auth";
import AnamnesisForm from "./AnamnesisForm";

export default function AnamnesisStandalone() {
  const { userId } = useParams();
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Verificar autenticación
  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, async (authUser) => {
      if (!authUser) {
        navigate("/login");
        return;
      }
      
      setCurrentUser(authUser);
      
      // Verificar si es admin
      try {
        const userDocRef = doc(db, "users", authUser.uid);
        const userDoc = await getDoc(userDocRef);
        
        if (userDoc.exists()) {
          const isAdminUser = userDoc.data().rol === "admin" || 
                             authUser.email === "admin@admin.es";
          setIsAdmin(isAdminUser);
          
          if (!isAdminUser) {
            setError("Solo los administradores pueden acceder a esta vista");
            setLoading(false);
            return;
          }
        }
      } catch (err) {
        console.error("Error verificando admin:", err);
        setError("Error al verificar permisos");
        setLoading(false);
        return;
      }
    });

    return () => unsubAuth();
  }, [navigate]);

  // Cargar datos del usuario y mantener sincronización en tiempo real
  useEffect(() => {
    if (!userId || !isAdmin) return;

    const userRef = doc(db, "users", userId);
    
    // Usar onSnapshot para mantener sincronización en tiempo real
    const unsubscribe = onSnapshot(
      userRef,
      (docSnap) => {
        if (docSnap.exists()) {
          setUser({ id: docSnap.id, uid: docSnap.id, ...docSnap.data() });
          setLoading(false);
        } else {
          setError("Usuario no encontrado");
          setLoading(false);
        }
      },
      (err) => {
        console.error("Error cargando usuario:", err);
        setError("Error al cargar usuario: " + err.message);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [userId, isAdmin]);

  const handleUpdateUser = (updatedUser) => {
    setUser(updatedUser);
  };

  if (loading) {
    return (
      <div style={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        height: "100vh",
        backgroundColor: "#f7fafc"
      }}>
        <div style={{
          textAlign: "center",
          padding: "40px",
          backgroundColor: "white",
          borderRadius: "12px",
          boxShadow: "0 4px 12px rgba(0,0,0,0.1)"
        }}>
          <div style={{
            width: "50px",
            height: "50px",
            border: "4px solid #e2e8f0",
            borderTop: "4px solid #4299e1",
            borderRadius: "50%",
            margin: "0 auto 20px",
            animation: "spin 1s linear infinite"
          }}></div>
          <p style={{ color: "#4a5568", fontSize: "16px" }}>Cargando anamnesis...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        height: "100vh",
        backgroundColor: "#f7fafc"
      }}>
        <div style={{
          textAlign: "center",
          padding: "40px",
          backgroundColor: "white",
          borderRadius: "12px",
          boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
          maxWidth: "500px"
        }}>
          <div style={{
            fontSize: "48px",
            marginBottom: "20px"
          }}>⚠️</div>
          <h2 style={{ color: "#e53e3e", marginBottom: "10px" }}>Error</h2>
          <p style={{ color: "#4a5568", marginBottom: "20px" }}>{error}</p>
          <button
            onClick={() => window.close()}
            style={{
              padding: "10px 24px",
              backgroundColor: "#4299e1",
              color: "white",
              border: "none",
              borderRadius: "6px",
              cursor: "pointer",
              fontWeight: "600",
              fontSize: "14px"
            }}
          >
            Cerrar ventana
          </button>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div style={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        height: "100vh",
        backgroundColor: "#f7fafc"
      }}>
        <p style={{ color: "#4a5568" }}>Usuario no encontrado</p>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: "100vh",
      backgroundColor: "#f7fafc",
      padding: "0"
    }}>
      {/* Header con información del usuario */}
      <div style={{
        backgroundColor: "white",
        borderBottom: "2px solid #e2e8f0",
        padding: "16px 24px",
        position: "sticky",
        top: 0,
        zIndex: 100,
        boxShadow: "0 2px 4px rgba(0,0,0,0.05)"
      }}>
        <div style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          maxWidth: "1400px",
          margin: "0 auto"
        }}>
          <div>
            <h1 style={{
              margin: 0,
              fontSize: "20px",
              fontWeight: "600",
              color: "#2d3748"
            }}>
              📋 Anamnesis - {user.nombre || user.email || "Usuario"}
            </h1>
            <p style={{
              margin: "4px 0 0 0",
              fontSize: "13px",
              color: "#718096"
            }}>
              Ventana independiente - Los cambios se guardan automáticamente
            </p>
          </div>
          <button
            onClick={() => window.close()}
            style={{
              padding: "8px 16px",
              backgroundColor: "#e2e8f0",
              color: "#4a5568",
              border: "none",
              borderRadius: "6px",
              cursor: "pointer",
              fontWeight: "600",
              fontSize: "14px",
              transition: "all 0.2s"
            }}
            onMouseEnter={(e) => {
              e.target.style.backgroundColor = "#cbd5e0";
            }}
            onMouseLeave={(e) => {
              e.target.style.backgroundColor = "#e2e8f0";
            }}
          >
            ✕ Cerrar
          </button>
        </div>
      </div>

      {/* Formulario de Anamnesis */}
      <div style={{
        maxWidth: "1400px",
        margin: "0 auto"
      }}>
        <AnamnesisForm 
          user={user} 
          onUpdateUser={handleUpdateUser}
          isAdmin={isAdmin}
        />
      </div>

      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
