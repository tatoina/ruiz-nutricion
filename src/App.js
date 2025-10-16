import React, { useState } from 'react';
import Layout from './components/Layout';
import Welcome from './components/Welcome';
import Register from './components/Register';
import Login from './components/Login';
import FichaUsuario from './components/FichaUsuario';
import './estilos.css';

function App() {
  // Controla la pantalla actual: bienvenida, registro, login, o perfil
  const [view, setView] = useState('welcome');
  // Guarda el email del usuario logueado
  const [userEmail, setUserEmail] = useState(null);

  return (
    <Layout>
      {view === "welcome" &&
        <Welcome onSelect={setView} />
      }
      {view === "register" &&
        <Register onBack={() => setView("welcome")} />
      }
      {view === "login" &&
        <Login
          onLogin={({ email }) => {
            setUserEmail(email);
            setView("profile");
          }}
          onBack={() => setView("welcome")}
        />
      }
      {view === "profile" &&
        <>
          <FichaUsuario email={userEmail} />
          <button
            onClick={() => {
              setUserEmail(null);
              setView("welcome");
            }}
            style={{ marginTop: "1rem" }}
          >
            <button className="btn cerrar-sesion-btn">Cerrar sesión</button>

          </button>
        </>
      }
    </Layout>
  );
}

export default App;
