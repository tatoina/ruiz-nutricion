import React from "react";
import FileManager from "./FileManager";
import { auth } from "../Firebase";

export default function EjerciciosForm({ user }) {
  const currentUser = auth.currentUser;
  const isAdmin = currentUser?.email === "ruiznutricionapp@gmail.com" || currentUser?.email === "admin@admin.es";
  
  return (
    <div>
      <FileManager 
        userId={user.uid || user.id} 
        type="ejercicios" 
        isAdmin={isAdmin}
        readOnly={!isAdmin}
      />
    </div>
  );
}
