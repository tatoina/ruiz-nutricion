import React, { useState } from "react";
import { db } from "../Firebase";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { getAuth } from "firebase/auth";

export default function HelpForm({ onClose }) {
  const [mensaje, setMensaje] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setEnviando(true);
    setError("");
    setEnviado(false);
    try {
      const user = getAuth().currentUser;
      const nombre = user?.displayName || "Usuario anónimo";
      const email = user?.email || "No disponible";
      await addDoc(collection(db, 'mail'), {
        to: 'inaviciba@gmail.com',
        message: {
          subject: `Ayuda/Fallo/Sugerencia de ${nombre}`,
          html: `
            <h2>Nuevo mensaje de ayuda/sugerencia</h2>
            <p><strong>Usuario:</strong> ${nombre}</p>
            <p><strong>Email:</strong> ${email}</p>
            <p><strong>Mensaje:</strong></p>
            <div style="white-space:pre-line; border:1px solid #eee; background:#f8fafc; padding:16px; border-radius:8px;">${mensaje.replace(/</g, '&lt;')}</div>
            <p style="color:#888; font-size:13px; margin-top:24px;">NutriApp - ${new Date().toLocaleString('es-ES')}</p>
          `,
          text: `Ayuda/Fallo/Sugerencia\nUsuario: ${nombre}\nEmail: ${email}\nMensaje: ${mensaje}`
        },
        createdAt: serverTimestamp(),
      });
      setEnviado(true);
      setMensaje("");
      window.alert('Mensaje enviado. ¡Gracias por tu consulta!');
      if (onClose) onClose();
    } catch (err) {
      setError("No se pudo enviar el mensaje. Intenta más tarde.");
    } finally {
      setEnviando(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <textarea
        value={mensaje}
        onChange={e => setMensaje(e.target.value)}
        placeholder="Escribe aquí tu consulta o sugerencia..."
        rows={5}
        style={{ width: '100%', borderRadius: 8, border: '1px solid #bbb', padding: 10, fontSize: 15, resize: 'vertical' }}
        required
      />
      {error && <div style={{ color: '#b91c1c', fontSize: 14 }}>{error}</div>}
      {/* El popup de confirmación y cierre se maneja por window.alert y onClose */}
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <button type="button" onClick={onClose} style={{ background: '#eee', color: '#333', border: 'none', borderRadius: 6, padding: '8px 18px', cursor: 'pointer' }}>Cancelar</button>
        <button type="submit" disabled={enviando || !mensaje.trim()} style={{ background: '#2196F3', color: 'white', border: 'none', borderRadius: 6, padding: '8px 18px', fontWeight: 600, cursor: enviando ? 'not-allowed' : 'pointer', opacity: enviando ? 0.7 : 1 }}>
          {enviando ? 'Enviando...' : 'Enviar'}
        </button>
      </div>
    </form>
  );
}
