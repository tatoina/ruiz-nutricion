import React, { useState } from 'react';
import Layout from './components/Layout';
import Welcome from './components/Welcome';
import Register from './components/Register';
import Login from './components/Login';
import FichaUsuario from './components/FichaUsuario';
import AdminPage from './components/AdminPage';
import './estilos.css';

function App() {
  const [view, setView] = useState('welcome');
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
          {userEmail && userEmail.trim().toLowerCase() === "admin@admin.es" ? (
            <AdminPage />
          ) : (
            <FichaUsuario email={userEmail} />
          )}
          <button
            onClick={() => {
              setUserEmail(null);
              setView("welcome");
            }}
            style={{ marginTop: "1rem" }}
          >
            <span className="btn cerrar-sesion-btn">Cerrar sesión</span>
          </button>
        </>
      }
    </Layout>
  );
}
export default App;
