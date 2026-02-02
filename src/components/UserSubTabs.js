import { useState } from "react";
import DatosPersonalesForm from './DatosPersonalesForm';
import DatosDietaForm from './DatosDietaForm';
import DatosPesoForm from './DatosPesoForm';
import EjerciciosForm from './EjerciciosForm';
import RecetasForm from './RecetasForm';
import DietaActualForm from './DietaActualForm';
import AnamnesisForm from './AnamnesisForm';
import MensajesUsuario from './MensajesUsuario';

const tabs = [
  { name: "Datos personales", comp: DatosPersonalesForm },
  { name: "Datos dieta", comp: DatosDietaForm },
  { name: "Datos peso", comp: DatosPesoForm },
  { name: "Ejercicios", comp: EjerciciosForm },
  { name: "Recetas", comp: RecetasForm },
  { name: "Dieta actual", comp: DietaActualForm },
  // { name: "MSG", comp: MensajesUsuario }, // Eliminado para dejar solo el acceso desde el botón junto a salir
  { name: "Anamnesis", comp: AnamnesisForm, adminOnly: true }
];

export default function UserSubTabs({ user, onUpdateUser, isAdmin }) {
  const [active, setActive] = useState(0);
  const Comp = tabs[active].comp;

  // Filtrar tabs según permisos
  const visibleTabs = tabs.filter(tab => !tab.adminOnly || isAdmin);

  return (
    <div>
      <div className="subtabs">
        {visibleTabs.map((t, i) => (
          <button key={t.name} onClick={() => setActive(i)}>
            {t.name}
          </button>
        ))}
      </div>
      <div className="subtab-content">
        <Comp user={user} onUpdateUser={onUpdateUser} isAdmin={isAdmin} />
      </div>
    </div>
  );
}
