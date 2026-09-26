// js/firebase-config.js - ANDIKA JAYA V2
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyANLV4G5irPCO6sCSO1iMZSImctS-jTWaA",
  authDomain: "mimikaberjaya.firebaseapp.com",
  databaseURL: "https://mimikaberjaya-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "mimikaberjaya",
  storageBucket: "mimikaberjaya.firebasestorage.app",
  messagingSenderId: "879618299261",
  appId: "1:879618299261:web:4d8c3e67fb7e3708a82814"
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

// Secondary app untuk buat user tanpa logout admin
export const secondaryApp = initializeApp(firebaseConfig, "Secondary");
export const secondaryAuth = getAuth(secondaryApp);
