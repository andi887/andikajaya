// js/firebase-config.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// Konfigurasi Project Firebase Anda
const firebaseConfig = {
  apiKey: "AIzaSyANLV4G5irPCO6sCSO1iMZSImctS-jTWaA",
  authDomain: "mimikaberjaya.firebaseapp.com",
  databaseURL: "https://mimikaberjaya-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "mimikaberjaya",
  storageBucket: "mimikaberjaya.firebasestorage.app",
  messagingSenderId: "879618299261",
  appId: "1:879618299261:web:4d8c3e67fb7e3708a82814"
};

// Inisialisasi Firebase
const app = initializeApp(firebaseConfig);

// Inisialisasi Authentication
export const auth = getAuth(app);

// Inisialisasi Firestore (Database Realtime untuk struktur Collection & Document)
export const db = getFirestore(app);
