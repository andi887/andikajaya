// js/app.js
import { auth, db } from './firebase-config.js';
import {
  signInWithEmailAndPassword,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { doc, getDoc } 
  from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// ===== HALAMAN LOGIN =====
const loginForm = document.getElementById('loginForm');
if (loginForm) {
  const loginMessage = document.getElementById('loginMessage');
  const btnLogin = document.getElementById('btnLogin');

  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;

    loginMessage.textContent = 'Memproses...';
    loginMessage.className = 'message';
    btnLogin.disabled = true;
    btnLogin.textContent = 'MOHON TUNGGU...';

    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      const userDoc = await getDoc(doc(db, 'users', user.uid));
      
      if (!userDoc.exists()) {
        throw new Error('Akun tidak terdaftar. Hubungi Admin.');
      }

      const userData = userDoc.data();
      loginMessage.textContent = `Login berhasil. Mengalihkan...`;
      loginMessage.className = 'message success';

      setTimeout(() => {
        window.location.href = 'dashboard.html';
      }, 600);

    } catch (error) {
      console.error(error);
      let msg = 'Login gagal.';
      if (error.code === 'auth/invalid-credential' || error.code === 'auth/wrong-password' || error.code === 'auth/user-not-found') {
        msg = 'Email atau password salah.';
      } else if (error.code === 'auth/too-many-requests') {
        msg = 'Terlalu banyak percobaan. Coba lagi nanti.';
      } else if (error.code === 'auth/invalid-email') {
        msg = 'Format email tidak valid.';
      } else if (error.message) {
        msg = error.message;
      }
      loginMessage.textContent = msg;
      loginMessage.className = 'message error';
      btnLogin.disabled = false;
      btnLogin.textContent = 'MASUK';
    }
  });

  // Auto redirect jika sudah login
  onAuthStateChanged(auth, async (user) => {
    if (user && window.location.pathname.endsWith('index.html')) {
      try {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists()) {
          window.location.href = 'dashboard.html';
        }
      } catch (err) {
        console.error(err);
      }
    }
  });
}
