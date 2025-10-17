import React, { useState } from "react";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "../Firebase";

export default function FichaUsuarioAdmin({ user, onBack }) {
  const [formData, setFormData] = useState({ ...user });
  const [saving, setSaving] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateDoc(doc(db, "usuarios", user.email), formData);
      alert("Datos actualizados correctamente ✅");
    } catch (err) {
      alert("Error al guardar: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white p-6 rounded-2xl shadow-lg max-w-4xl mx-auto">
      <button
        onClick={onBack}
        className="bg-gray-300 hover:bg-gray-400 text-gray-800 px-3 py-1 rounded mb-4"
      >
        ← Volver
      </button>

      <h3 className="text-xl font-semibold text-indigo-700 mb-4">
        Ficha editable de {formData.nombre}
      </h3>

      <div className="grid grid-cols-2 gap-4 text-gray-700">
        <label>
          <span className="font-semibold">Nombre:</span>
          <input
            name="nombre"
            value={formData.nombre}
            onChange={handleChange}
            className="border rounded px-2 py-1 w-full"
          />
        </label>

        <label>
          <span className="font-semibold">Apellidos:</span>
          <input
            name="apellidos"
            value={formData.apellidos}
            onChange={handleChange}
            className="border rounded px-2 py-1 w-full"
          />
        </label>

        <label>
          <span className="font-semibold">Objetivo nutricional:</span>
          <input
            name="objetivonutricional"
            value={formData.objetivonutricional || ""}
            onChange={handleChange}
            className="border rounded px-2 py-1 w-full"
          />
        </label>

        <label>
          <span className="font-semibold">Restricciones:</span>
          <input
            name="restricciones"
            value={formData.restricciones || ""}
            onChange={handleChange}
            className="border rounded px-2 py-1 w-full"
          />
        </label>

        <label>
          <span className="font-semibold">Ejercicios:</span>
          <select
            name="ejercicios"
            value={formData.ejercicios}
            onChange={handleChange}
            className="border rounded px-2 py-1 w-full"
          >
            <option value="no">No</option>
            <option value="si">Sí</option>
          </select>
        </label>

        <label>
          <span className="font-semibold">Recetas:</span>
          <select
            name="recetas"
            value={formData.recetas}
            onChange={handleChange}
            className="border rounded px-2 py-1 w-full"
          >
            <option value="no">No</option>
            <option value="si">Sí</option>
          </select>
        </label>
      </div>

      <div className="mt-6 flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving}
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2 rounded-lg"
        >
          {saving ? "Guardando..." : "Guardar cambios"}
        </button>
      </div>
    </div>
  );
}
