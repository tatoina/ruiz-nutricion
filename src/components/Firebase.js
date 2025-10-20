// Configuración de Firebase para tu proyecto NutricionApp
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyAPfkczL6ekY_82BQHpMrT5Rd1lwpTrRNQ",
  authDomain: "nutricionapp-b7b7d.firebaseapp.com",
  projectId: "nutricionapp-b7b7d",
  storageBucket: "nutricionapp-b7b7d.appspot.com",
  messagingSenderId: "23998467905",
  appId: "1:23998467905:web:c619b3390f5831eccadbc0"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export default app;