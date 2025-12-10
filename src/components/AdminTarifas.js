import React, { useState, useEffect } from "react";
import { auth, db, storage } from "../Firebase";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { useNavigate } from "react-router-dom";

/**
 * AdminTarifas - Gestión de imagen de tarifas
 * El admin puede subir una imagen de tarifas que los clientes pueden ver maximizada
 */
export default function AdminTarifas() {
  const ADMIN_EMAILS = ["admin@admin.es", "ruiznutricionapp@gmail.com"];
  
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [tarifasUrl, setTarifasUrl] = useState("");
  const [showMaximized, setShowMaximized] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState("");

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setCurrentUser(u);
      if (!u) {
        setIsAdmin(false);
        setLoading(false);
        return;
      }
      const adminCheck = ADMIN_EMAILS.includes((u.email || "").toLowerCase());
      setIsAdmin(adminCheck);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (isAdmin) {
      loadTarifas();
    }
  }, [isAdmin]);

  const loadTarifas = async () => {
    try {
      const docRef = doc(db, "settings", "tarifas");
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data();
        setTarifasUrl(data.imageUrl || "");
      }
    } catch (err) {
      console.error("Error cargando tarifas:", err);
    }
  };

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviewUrl(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      alert("Por favor selecciona una imagen");
      return;
    }

    setUploading(true);
    try {
      // Subir imagen a Storage
      const storageRef = ref(storage, `tarifas/tarifas_${Date.now()}.jpg`);
      await uploadBytes(storageRef, selectedFile);
      const downloadUrl = await getDownloadURL(storageRef);

      // Guardar URL en Firestore
      const docRef = doc(db, "settings", "tarifas");
      await setDoc(docRef, {
        imageUrl: downloadUrl,
        updatedAt: new Date().toISOString(),
        updatedBy: currentUser.email
      });

      setTarifasUrl(downloadUrl);
      setSelectedFile(null);
      setPreviewUrl("");
      alert("✅ Tarifas subidas correctamente");
    } catch (err) {
      console.error("Error subiendo tarifas:", err);
      alert("❌ Error al subir tarifas: " + err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async () => {
    if (!tarifasUrl) return;
    if (!window.confirm("¿Seguro que quieres eliminar la imagen de tarifas?")) return;

    setUploading(true);
    try {
      // Eliminar de Firestore
      const docRef = doc(db, "settings", "tarifas");
      await setDoc(docRef, {
        imageUrl: "",
        updatedAt: new Date().toISOString(),
        updatedBy: currentUser.email
      });

      setTarifasUrl("");
      alert("✅ Tarifas eliminadas");
    } catch (err) {
      console.error("Error eliminando tarifas:", err);
      alert("❌ Error al eliminar: " + err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await auth.signOut();
      navigate("/login");
    } catch (err) {
      console.error("Error al cerrar sesión:", err);
    }
  };

  if (loading) {
    return (
      <div className="layout admin-fullscreen">
        <div className="card"><p style={{ padding: 16 }}>Cargando...</p></div>
      </div>
    );
  }

  if (!currentUser || !isAdmin) {
    return (
      <div className="layout admin-fullscreen">
        <div className="card" style={{ maxWidth: 720, margin: "40px auto", textAlign: "center" }}>
          <h3>Sin permisos de administrador</h3>
          <p>No tienes permisos para acceder a esta sección.</p>
          <button className="btn primary" onClick={() => navigate("/mi-ficha")}>Volver</button>
        </div>
      </div>
    );
  }

  return (
    <div className="layout admin-fullscreen">
      {/* Header */}
      <div className="card header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div className="title">Gestión de Tarifas</div>
          <div className="subtitle">Sube la imagen de tarifas que verán los clientes</div>
        </div>
        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          <button className="btn ghost" onClick={() => navigate("/admin/usuarios")}>← Volver</button>
          <button className="btn danger" onClick={handleSignOut}>Cerrar sesión</button>
        </div>
      </div>

      {/* Content */}
      <div className="card" style={{ maxWidth: 900, margin: "16px auto", padding: 24 }}>
        <h2 style={{ marginTop: 0, color: "#064e3b" }}>📋 Imagen de Tarifas</h2>

        {/* Imagen actual */}
        {tarifasUrl && (
          <div style={{ marginBottom: 24 }}>
            <h3 style={{ fontSize: 14, color: "#666", marginBottom: 8 }}>Imagen actual:</h3>
            <div style={{ 
              border: "2px solid #e5e7eb", 
              borderRadius: "8px", 
              padding: "12px",
              backgroundColor: "#f9fafb",
              textAlign: "center"
            }}>
              <img 
                src={tarifasUrl} 
                alt="Tarifas"
                style={{ 
                  maxWidth: "100%", 
                  maxHeight: "400px", 
                  cursor: "pointer",
                  borderRadius: "4px",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.1)"
                }}
                onClick={() => setShowMaximized(true)}
              />
              <div style={{ marginTop: 12, display: "flex", gap: 8, justifyContent: "center" }}>
                <button 
                  className="btn ghost"
                  onClick={() => setShowMaximized(true)}
                >
                  🔍 Ver completa
                </button>
                <button 
                  className="btn danger"
                  onClick={handleDelete}
                  disabled={uploading}
                >
                  🗑️ Eliminar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Upload nueva imagen */}
        <div>
          <h3 style={{ fontSize: 14, color: "#666", marginBottom: 8 }}>
            {tarifasUrl ? "Reemplazar imagen:" : "Subir imagen:"}
          </h3>
          
          {previewUrl && (
            <div style={{ 
              marginBottom: 12, 
              padding: 12, 
              border: "2px dashed #16a34a",
              borderRadius: 8,
              textAlign: "center"
            }}>
              <p style={{ margin: "0 0 8px 0", fontSize: 13, color: "#666" }}>Vista previa:</p>
              <img 
                src={previewUrl} 
                alt="Preview" 
                style={{ maxWidth: "100%", maxHeight: "300px", borderRadius: 4 }}
              />
            </div>
          )}

          <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
            <input 
              type="file" 
              accept="image/*"
              onChange={handleFileSelect}
              style={{ flex: 1, minWidth: 200 }}
            />
            <button 
              className="btn primary"
              onClick={handleUpload}
              disabled={!selectedFile || uploading}
              style={{ minWidth: 120 }}
            >
              {uploading ? "Subiendo..." : "📤 Subir imagen"}
            </button>
          </div>
          
          <div style={{ 
            marginTop: 12, 
            padding: 12, 
            backgroundColor: "#fef3c7", 
            borderRadius: 6,
            fontSize: 13,
            color: "#92400e"
          }}>
            <strong>💡 Recomendaciones:</strong>
            <ul style={{ margin: "8px 0 0 0", paddingLeft: 20 }}>
              <li>Usa imágenes en formato JPG o PNG</li>
              <li>Resolución recomendada: 1920x1080px o superior</li>
              <li>La imagen se mostrará optimizada para visualización en pantalla</li>
              <li>Los clientes podrán maximizarla para verla en detalle</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Modal maximizado */}
      {showMaximized && tarifasUrl && (
        <div 
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0,0,0,0.9)",
            zIndex: 10000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "20px",
            cursor: "pointer"
          }}
          onClick={() => setShowMaximized(false)}
        >
          <div style={{ position: "relative", maxWidth: "95%", maxHeight: "95%" }}>
            <button
              style={{
                position: "absolute",
                top: "-40px",
                right: "0",
                background: "#fff",
                border: "none",
                borderRadius: "50%",
                width: "36px",
                height: "36px",
                fontSize: "20px",
                cursor: "pointer",
                boxShadow: "0 2px 8px rgba(0,0,0,0.3)"
              }}
              onClick={(e) => {
                e.stopPropagation();
                setShowMaximized(false);
              }}
            >
              ✕
            </button>
            <img 
              src={tarifasUrl}
              alt="Tarifas maximizadas"
              style={{
                maxWidth: "100%",
                maxHeight: "calc(100vh - 40px)",
                objectFit: "contain",
                borderRadius: "8px"
              }}
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </div>
      )}
    </div>
  );
}
