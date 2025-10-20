import React from "react";

/**
 * DriveFolderViewer
 * - folderId: id de la carpeta en Google Drive (p. ej. "1EN-1h1VcV4K4kG2JgmRpxFSY-izas-9c")
 * - height: alto del iframe en px (opcional, default 600)
 *
 * Nota: la carpeta debe estar compartida "Cualquiera con el enlace" para que funcione.
 */
export default function DriveFolderViewer({ folderId, height = 600 }) {
  if (!folderId) {
    return <div className="mensaje">No se proporcionó folderId de Google Drive.</div>;
  }

  // URL embebida soportada por Google Drive
  const src = `https://drive.google.com/embeddedfolderview?id=${encodeURIComponent(folderId)}#list`;

  return (
    <div style={{ border: "1px solid #eee", borderRadius: 8, overflow: "hidden" }}>
      <iframe
        title={`Google Drive - ${folderId}`}
        src={src}
        style={{ width: "100%", height: `${height}px`, border: 0 }}
        loading="lazy"
      />
      <div style={{ padding: 8, background: "#fafafa", borderTop: "1px solid #f0f0f0", fontSize: 13 }}>
        <a href={`https://drive.google.com/drive/folders/${folderId}`} target="_blank" rel="noreferrer">
          Abrir en Google Drive
        </a>
        <span style={{ marginLeft: 12, color: "#666" }}>Asegúrate de que la carpeta esté compartida como "Cualquiera con el enlace".</span>
      </div>
    </div>
  );
}