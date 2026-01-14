import React from "react";

// Cambia la ruta del logo si es necesario
const LOGO_SRC = require("../assets/logoclinica.png");

export default function Welcome({ onSelect }) {
  return (
    <div
      style={{
        background: "var(--color-forma)",
        borderRadius: "24px",
        boxShadow: "0 6px 24px rgba(137,224,62,.10)",
        padding: "38px 20px 32px 20px",
        maxWidth: 420,
        margin: "46px auto",
        display: "flex",
        flexDirection: "column",
        alignItems: "center"
      }}
    >
      <img
        src={LOGO_SRC}
        alt="Logo clínica"
        style={{
          maxWidth: 160,
          width: "100%",
          height: "auto",
          borderRadius: "50%",
          marginBottom: 22,
          boxShadow: "0 4px 18px rgba(89,224,62,0.12)"
        }}
      />
      <h2 style={{
        color: "var(--color-titulo)",
        fontWeight: 700,
        fontSize: "1.35rem",
        marginBottom: 10,
        letterSpacing: ".5px"
      }}>
        Bienvenido a Ruiz Nutrición
      </h2>
      <div style={{
        color: "#559c55",
        fontSize: "1.07rem",
        marginBottom: 28,
        opacity: 0.85,
        fontWeight: 500
      }}>
        Alimentación sana y equilibrada, personalizada para ti
      </div>
      <button
        className="btn"
        onClick={() => onSelect("login")}
        style={{
          width: "88%",
          marginBottom: 15,
          fontSize: "1.12rem"
        }}
      >
        Entrar
      </button>
      <button
        className="btn"
        onClick={() => onSelect("register")}
        style={{
          width: "88%",
          fontSize: "1.12rem",
          marginBottom: 15
        }}
      >
        Registrarse
      </button>
    </div>
  );
}

