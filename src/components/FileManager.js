import React, { useState, useEffect } from "react";
import { storage, db } from "../Firebase";
import {
  ref,
  uploadBytesResumable,
  getDownloadURL,
  deleteObject,
  listAll,
} from "firebase/storage";
import { doc, updateDoc, arrayUnion, arrayRemove } from "firebase/firestore";

/**
 * Componente para gestionar archivos de ejercicios o recetas de un usuario
 * @param {string} userId - UID del usuario
 * @param {string} type - 'ejercicios' o 'recetas'
 * @param {boolean} isAdmin - Si el usuario es administrador
 */
export default function FileManager({ userId, type, isAdmin }) {
  const [files, setFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const folderPath = `users/${userId}/${type}`;

  // Cargar lista de archivos
  useEffect(() => {
    loadFiles();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, type]);

  const loadFiles = async () => {
    setLoading(true);
    setError(null);
    try {
      const folderRef = ref(storage, folderPath);
      const result = await listAll(folderRef);

      const filePromises = result.items.map(async (itemRef) => {
        const url = await getDownloadURL(itemRef);
        return {
          name: itemRef.name,
          fullPath: itemRef.fullPath,
          url: url,
          ref: itemRef,
        };
      });

      const fileList = await Promise.all(filePromises);
      setFiles(fileList);
    } catch (err) {
      console.error("Error al cargar archivos:", err);
      if (err.code === "storage/object-not-found") {
        setFiles([]);
      } else {
        setError("Error al cargar los archivos");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Validar tipo de archivo
    const allowedTypes = [
      "application/pdf",
      "image/jpeg",
      "image/jpg",
      "image/png",
      "image/gif",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ];

    if (!allowedTypes.includes(file.type)) {
      setError("Tipo de archivo no permitido. Solo PDF, imágenes y documentos Word.");
      return;
    }

    // Validar tamaño (máximo 10MB)
    if (file.size > 10 * 1024 * 1024) {
      setError("El archivo es demasiado grande. Máximo 10MB.");
      return;
    }

    setUploading(true);
    setUploadProgress(0);
    setError(null);

    try {
      const timestamp = Date.now();
      const fileName = `${timestamp}_${file.name}`;
      const storageRef = ref(storage, `${folderPath}/${fileName}`);

      const uploadTask = uploadBytesResumable(storageRef, file);

      uploadTask.on(
        "state_changed",
        (snapshot) => {
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          setUploadProgress(Math.round(progress));
        },
        (error) => {
          console.error("Error al subir archivo:", error);
          setError("Error al subir el archivo");
          setUploading(false);
        },
        async () => {
          const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);

          // Guardar referencia en Firestore
          const userRef = doc(db, "users", userId);
          await updateDoc(userRef, {
            [`${type}Files`]: arrayUnion({
              name: fileName,
              originalName: file.name,
              url: downloadURL,
              uploadedAt: new Date().toISOString(),
              path: uploadTask.snapshot.ref.fullPath,
            }),
          });

          setUploading(false);
          setUploadProgress(0);
          loadFiles();
        }
      );
    } catch (err) {
      console.error("Error al subir archivo:", err);
      setError("Error al subir el archivo");
      setUploading(false);
    }
  };

  const handleDelete = async (file) => {
    if (!window.confirm(`¿Estás seguro de eliminar "${file.name}"?`)) {
      return;
    }

    try {
      // Eliminar de Storage
      const fileRef = ref(storage, file.fullPath);
      await deleteObject(fileRef);

      // Eliminar referencia de Firestore
      const userRef = doc(db, "users", userId);
      await updateDoc(userRef, {
        [`${type}Files`]: arrayRemove({
          name: file.name,
          url: file.url,
          path: file.fullPath,
        }),
      });

      loadFiles();
    } catch (err) {
      console.error("Error al eliminar archivo:", err);
      setError("Error al eliminar el archivo");
    }
  };

  const getFileIcon = (fileName) => {
    const ext = fileName.split(".").pop().toLowerCase();
    if (["pdf"].includes(ext)) return "📄";
    if (["jpg", "jpeg", "png", "gif"].includes(ext)) return "🖼️";
    if (["doc", "docx"].includes(ext)) return "📝";
    return "📎";
  };

  const getFileSize = (url) => {
    // En una implementación real, deberías almacenar el tamaño en Firestore
    return "- KB";
  };

  return (
    <div style={{ padding: "12px" }}>
      <div style={{ marginBottom: "20px" }}>
        <h4 style={{ marginBottom: "12px", color: "#2d3748" }}>
          {type === "ejercicios" ? "Archivos de Ejercicios" : "Archivos de Recetas"}
        </h4>

        {/* Botón de subir archivo - Solo para admins */}
        {isAdmin && (
          <div style={{ marginBottom: "20px" }}>
            <input
              type="file"
              id={`file-upload-${type}`}
              onChange={handleFileUpload}
              disabled={uploading}
              style={{ display: "none" }}
              accept=".pdf,.jpg,.jpeg,.png,.gif,.doc,.docx"
            />
            <label htmlFor={`file-upload-${type}`}>
              <div
                style={{
                  display: "inline-block",
                  padding: "10px 20px",
                  backgroundColor: uploading ? "#cbd5e0" : "#4299e1",
                  color: "white",
                  borderRadius: "6px",
                  cursor: uploading ? "not-allowed" : "pointer",
                  fontWeight: "500",
                  fontSize: "14px",
                }}
              >
                {uploading ? `Subiendo... ${uploadProgress}%` : "📤 Subir archivo"}
              </div>
            </label>
            <p style={{ fontSize: "12px", color: "#718096", marginTop: "8px" }}>
              Formatos permitidos: PDF, imágenes (JPG, PNG, GIF), Word. Máximo 10MB.
            </p>
          </div>
        )}

        {/* Barra de progreso */}
        {uploading && (
          <div style={{ marginBottom: "20px" }}>
            <div
              style={{
                width: "100%",
                height: "8px",
                backgroundColor: "#e2e8f0",
                borderRadius: "4px",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  width: `${uploadProgress}%`,
                  height: "100%",
                  backgroundColor: "#4299e1",
                  transition: "width 0.3s ease",
                }}
              />
            </div>
          </div>
        )}

        {/* Mensaje de error */}
        {error && (
          <div
            style={{
              padding: "12px",
              backgroundColor: "#fed7d7",
              color: "#c53030",
              borderRadius: "6px",
              marginBottom: "20px",
              fontSize: "14px",
            }}
          >
            {error}
          </div>
        )}
      </div>

      {/* Lista de archivos */}
      {loading ? (
        <div style={{ padding: "40px", textAlign: "center", color: "#718096" }}>
          Cargando archivos...
        </div>
      ) : files.length === 0 ? (
        <div
          style={{
            padding: "40px",
            textAlign: "center",
            color: "#718096",
            backgroundColor: "#f7fafc",
            borderRadius: "8px",
          }}
        >
          No hay archivos subidos todavía.
        </div>
      ) : (
        <div style={{ display: "grid", gap: "12px" }}>
          {files.map((file, index) => (
            <div
              key={index}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "16px",
                backgroundColor: "#f7fafc",
                borderRadius: "8px",
                border: "1px solid #e2e8f0",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "12px", flex: 1 }}>
                <span style={{ fontSize: "24px" }}>{getFileIcon(file.name)}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: "500", color: "#2d3748", marginBottom: "4px" }}>
                    {file.name}
                  </div>
                  <div style={{ fontSize: "12px", color: "#718096" }}>
                    {getFileSize(file.url)}
                  </div>
                </div>
              </div>

              <div style={{ display: "flex", gap: "8px" }}>
                <a
                  href={file.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    padding: "8px 16px",
                    backgroundColor: "#48bb78",
                    color: "white",
                    borderRadius: "6px",
                    textDecoration: "none",
                    fontSize: "14px",
                    fontWeight: "500",
                  }}
                >
                  👁️ Ver
                </a>
                {isAdmin && (
                  <button
                    onClick={() => handleDelete(file)}
                    style={{
                      padding: "8px 16px",
                      backgroundColor: "#f56565",
                      color: "white",
                      border: "none",
                      borderRadius: "6px",
                      cursor: "pointer",
                      fontSize: "14px",
                      fontWeight: "500",
                    }}
                  >
                    🗑️ Eliminar
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
