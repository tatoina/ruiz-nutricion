import { useState } from "react";
import DatosPersonalesForm from './DatosPersonalesForm';
import DatosDietaForm from './DatosDietaForm';
import DatosPesoForm from './DatosPesoForm';
import EjerciciosForm from './EjerciciosForm';
import RecetasForm from './RecetasForm';
import DietaActualForm from './DietaActualForm';

const tabs = [
  { name: "Datos personales", comp: DatosPersonalesForm },
  { name: "Datos dieta", comp: DatosDietaForm },
  { name: "Datos peso", comp: DatosPesoForm },
  { name: "Ejercicios", comp: EjerciciosForm },
  { name: "Recetas", comp: RecetasForm },
  { name: "Dieta actual", comp: DietaActualForm }
];

export default function UserSubTabs({ user, onUpdateUser }) {
  const [active, setActive] = useState(0);
  const Comp = tabs[active].comp;

  return (
    <div>
      <div className="subtabs">
        {tabs.map((t, i) => (
          <button key={t.name} onClick={() => setActive(i)}>
            {t.name}
          </button>
        ))}
      </div>
      <div className="subtab-content">
        <Comp user={user} onUpdateUser={onUpdateUser} />
      </div>
    </div>
  );
}
