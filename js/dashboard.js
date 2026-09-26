// js/dashboard.js
import { auth, db } from './firebase-config.js';
import {
  onAuthStateChanged,
  signOut,
  createUserWithEmailAndPassword
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  collection, addDoc, doc, setDoc, getDoc, getDocs, query, orderBy,
  onSnapshot, serverTimestamp, runTransaction, where
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// ===== UTILITAS =====
const formatRupiah = (angka) =>
  'Rp ' + (angka || 0).toLocaleString('id-ID');

const formatTanggal = (timestamp) => {
  if (!timestamp) return '-';
  const d = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' });
};

const formatTanggalShort = (timestamp) => {
  if (!timestamp) return '-';
  const d = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
};

function escapeHtml(str) {
  return String(str || '').replace(/[&<>"']/g, m => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[m]));
}

// ===== DAFTAR JENIS IKAN/UDANG =====
const JENIS_BARANG = [
  'Bandeng', 'KKB', 'Manyung', 'Tawar', 'Mubara', 'Bawel', 'Mondo',
  'Daun', 'Kerong', 'Hiu', 'Ikan Merah', 'Banana', 'Tiger', 'Kputi',
  'Sarisi', 'Lajur', 'Lasi', 'Toki', 'Tenggiri', 'Udang Tiger', 'Udang Biasa'
];

// ===== GUARD: CEK AUTENTIKASI =====
let currentUser = null;
let currentUserData = null;

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = 'index.html';
    return;
  }

  try {
    const userDoc = await getDoc(doc(db, 'users', user.uid));
    if (!userDoc.exists()) {
      alert('Akun tidak terdaftar.');
      await signOut(auth);
      window.location.href = 'index.html';
      return;
    }

    currentUser = user;
    currentUserData = userDoc.data();

    // Setup UI berdasarkan role
    setupDashboard();
  } catch (err) {
    console.error(err);
    window.location.href = 'index.html';
  }
});

// ===== SETUP DASHBOARD BERDASARKAN ROLE =====
function setupDashboard() {
  const isAdmin = currentUserData.role === 'admin';

  // Update header
  document.getElementById('userName').textContent = currentUserData.name || 'User';
  document.getElementById('headerSubtitle').textContent = 
    isAdmin ? 'Panel Administrator' : 'Dashboard Pembeli / Supplier';

  // Show/hide tab admin-only
  document.querySelectorAll('.admin-only').forEach(el => {
    el.style.display = isAdmin ? '' : 'none';
  });

  // Update judul tab nota & rekap
  if (isAdmin) {
    document.getElementById('notaTitle').textContent = 'Semua Nota Pembelian';
    document.getElementById('thUser').style.display = '';
    document.getElementById('rekapTitle').textContent = 'Rekap Keseluruhan';
    document.getElementById('rekapGrandTotalLabel').textContent = 'Grand Total (Rp)';
  } else {
    document.getElementById('notaTitle').textContent = 'Nota Pembelian Saya';
    document.getElementById('thUser').style.display = 'none';
    document.getElementById('rekapTitle').textContent = 'Rekap Pembelian Saya';
    document.getElementById('rekapGrandTotalLabel').textContent = 'Total Nominal Saya';
  }

  // Init semua fitur
  initTabNavigation();
  initLogout();
  loadNotas();
  loadRekap();
  initChat();

  // Fitur admin only
  if (isAdmin) {
    initCreateUser();
    loadUsersTable();
    initNotaForm();
    loadUsersDropdown();
  }
}

// ===== LOGOUT =====
function initLogout() {
  document.getElementById('btnLogout').addEventListener('click', async () => {
    await signOut(auth);
    window.location.href = 'index.html';
  });
}

// ===== TAB NAVIGATION =====
function initTabNavigation() {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById('tab-' + btn.dataset.tab).classList.add('active');
    });
  });
}

// ==========================================
// FITUR: BUAT USER (ADMIN ONLY)
// ==========================================
function initCreateUser() {
  document.getElementById('formCreateUser').addEventListener('submit', async (e) => {
    e.preventDefault();
    const msg = document.getElementById('createUserMessage');
    const name = document.getElementById('newUserName').value.trim();
    const email = document.getElementById('newUserEmail').value.trim();
    const password = document.getElementById('newUserPassword').value;

    msg.textContent = 'Membuat user...';
    msg.className = 'message';

    try {
      const userCred = await createUserWithEmailAndPassword(auth, email, password);
      await setDoc(doc(db, 'users', userCred.user.uid), {
        uid: userCred.user.uid,
        name,
        email,
        role: 'user',
        createdAt: serverTimestamp()
      });
      msg.textContent = `User "${name}" berhasil dibuat!`;
      msg.className = 'message success';
      e.target.reset();
      loadUsersDropdown();
    } catch (err) {
      console.error(err);
      msg.textContent = err.code === 'auth/email-already-in-use'
        ? 'Email sudah terdaftar.'
        : 'Gagal: ' + err.message;
      msg.className = 'message error';
    }
  });
}

function loadUsersTable() {
  onSnapshot(query(collection(db, 'users'), where('role', '==', 'user'), orderBy('createdAt', 'desc')), (snap) => {
    const tbody = document.querySelector('#tableUsers tbody');
    tbody.innerHTML = '';
    snap.forEach((docSnap, idx) => {
      const u = docSnap.data();
      tbody.innerHTML += `
        <tr>
          <td>${idx + 1}</td>
          <td>${u.name}</td>
          <td>${u.email}</td>
          <td>${formatTanggal(u.createdAt)}</td>
        </tr>`;
    });
  });
}

// ==========================================
// FITUR: INPUT NOTA (ADMIN ONLY)
// ==========================================
function loadUsersDropdown() {
  const select = document.getElementById('notaUser');
  getDocs(query(collection(db, 'users'), where('role', '==', 'user')))
    .then(snap => {
      select.innerHTML = '<option value="">-- Pilih User --</option>';
      snap.forEach(d => {
        const u = d.data();
        select.innerHTML += `<option value="${d.id}" data-name="${u.name}">${u.name}</option>`;
      });
    });
}

function initNotaForm() {
  document.getElementById('notaTanggal').valueAsDate = new Date();
  document.getElementById('btnAddRow').addEventListener('click', addRow);
  document.getElementById('formNota').addEventListener('submit', submitNota);
  addRow();
}

function addRow() {
  const tbody = document.getElementById('itemsBody');
  const row = document.createElement('tr');
  const options = JENIS_BARANG.map(b => `<option value="${b}">${b}</option>`).join('');
  row.innerHTML = `
    <td class="row-num"></td>
    <td>
      <select class="input-jenis">
        <option value="Ikan">Ikan</option>
        <option value="Udang">Udang</option>
      </select>
    </td>
    <td><select class="input-nama">${options}</select></td>
    <td><input type="number" class="input-qty" min="0" step="0.01" value="0" /></td>
    <td><input type="number" class="input-harga" min="0" value="0" /></td>
    <td class="cell-subtotal">Rp 0</td>
    <td><button type="button" class="btn-remove-row">✕</button></td>
  `;
  tbody.appendChild(row);
  updateRowNumbers();

  row.querySelectorAll('input').forEach(inp => inp.addEventListener('input', () => calcRow(row)));
  row.querySelector('.btn-remove-row').addEventListener('click', () => {
    row.remove();
    updateRowNumbers();
    calcTotal();
  });
}

function updateRowNumbers() {
  document.querySelectorAll('#itemsBody tr').forEach((tr, i) => {
    tr.querySelector('.row-num').textContent = i + 1;
  });
}

function calcRow(row) {
  const qty = parseFloat(row.querySelector('.input-qty').value) || 0;
  const harga = parseFloat(row.querySelector('.input-harga').value) || 0;
  const subtotal = qty * harga;
  row.querySelector('.cell-subtotal').textContent = formatRupiah(subtotal);
  calcTotal();
}

function calcTotal() {
  let total = 0;
  document.querySelectorAll('#itemsBody tr').forEach(row => {
    const qty = parseFloat(row.querySelector('.input-qty').value) || 0;
    const harga = parseFloat(row.querySelector('.input-harga').value) || 0;
    total += qty * harga;
  });
  document.getElementById('totalNota').textContent = formatRupiah(total);
  return total;
}

async function submitNota(e) {
  e.preventDefault();
  const msg = document.getElementById('notaMessage');
  const userId = document.getElementById('notaUser').value;
  const userName = document.getElementById('notaUser').selectedOptions[0].dataset.name;
  const tanggalInput = document.getElementById('notaTanggal').value;

  if (!userId) {
    msg.textContent = 'Pilih user terlebih dahulu.';
    msg.className = 'message error';
    return;
  }

  const rows = document.querySelectorAll('#itemsBody tr');
  const items = [];
  let totalNota = 0;
  let totalBerat = 0;

  rows.forEach(row => {
    const jenis = row.querySelector('.input-jenis').value;
    const namaBarang = row.querySelector('.input-nama').value;
    const qtyKg = parseFloat(row.querySelector('.input-qty').value) || 0;
    const hargaPerKg = parseFloat(row.querySelector('.input-harga').value) || 0;
    const subtotal = qtyKg * hargaPerKg;
    if (qtyKg > 0) {
      items.push({ jenis, namaBarang, qtyKg, hargaPerKg, subtotal });
      totalNota += subtotal;
      totalBerat += qtyKg;
    }
  });

  if (items.length === 0) {
    msg.textContent = 'Tambahkan minimal 1 item dengan berat > 0.';
    msg.className = 'message error';
    return;
  }

  msg.textContent = 'Menyimpan nota...';
  msg.className = 'message';

  try {
    const tanggal = new Date(tanggalInput);

    await addDoc(collection(db, 'notas'), {
      userId,
      userName,
      tanggal,
      items,
      totalNota,
      createdByAdmin: currentUser.uid,
      createdAt: serverTimestamp()
    });

    const rekapRef = doc(db, 'rekap', userId);
    await runTransaction(db, async (tx) => {
      const rekapSnap = await tx.get(rekapRef);
      const current = rekapSnap.exists() ? rekapSnap.data() : {
        userId, userName, totalTransaksi: 0, totalBeratKg: 0, totalNominal: 0
      };
      tx.set(rekapRef, {
        ...current,
        userName,
        totalTransaksi: current.totalTransaksi + 1,
        totalBeratKg: current.totalBeratKg + totalBerat,
        totalNominal: current.totalNominal + totalNota,
        lastUpdated: serverTimestamp()
      });
    });

    msg.textContent = `Nota berhasil disimpan untuk ${userName}. Total: ${formatRupiah(totalNota)}`;
    msg.className = 'message success';

    document.getElementById('itemsBody').innerHTML = '';
    addRow();
    calcTotal();
  } catch (err) {
    console.error(err);
    msg.textContent = 'Gagal menyimpan: ' + err.message;
    msg.className = 'message error';
  }
}

// ==========================================
// FITUR: NOTA (SEMUA ROLE)
// ==========================================
function loadNotas() {
  const isAdmin = currentUserData.role === 'admin';
  const tbody = document.querySelector('#tableNotas tbody');

  let q;
  if (isAdmin) {
    q = query(collection(db, 'notas'), orderBy('tanggal', 'desc'));
  } else {
    q = query(
      collection(db, 'notas'),
      where('userId', '==', currentUser.uid),
      orderBy('tanggal', 'desc')
    );
  }

  onSnapshot(q, (snap) => {
    tbody.innerHTML = '';
    if (snap.empty) {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">Belum ada nota.</td></tr>';
      return;
    }
    snap.forEach((docSnap, idx) => {
      const n = docSnap.data();
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${idx + 1}</td>
        <td>${formatTanggalShort(n.tanggal)}</td>
        ${isAdmin ? `<td>${n.userName}</td>` : ''}
        <td>${(n.items || []).length}</td>
        <td>${formatRupiah(n.totalNota || 0)}</td>
        <td>
          <button class="btn-view" data-id="${docSnap.id}">Lihat</button>
          <button class="btn-print" data-id="${docSnap.id}">Cetak</button>
        </td>
      `;
      tbody.appendChild(tr);
    });

    tbody.querySelectorAll('.btn-view').forEach(btn => {
      btn.addEventListener('click', () => showNotaDetail(btn.dataset.id));
    });
    tbody.querySelectorAll('.btn-print').forEach(btn => {
      btn.addEventListener('click', () => showNotaDetail(btn.dataset.id, true));
    });
  }, (err) => {
    console.error(err);
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:red;">Gagal memuat data.</td></tr>';
  });
}

function showNotaDetail(notaId, autoPrint = false) {
  getDoc(doc(db, 'notas', notaId)).then((snap) => {
    if (!snap.exists()) {
      alert('Nota tidak ditemukan.');
      return;
    }
    const n = snap.data();

    document.getElementById('notaKepada').textContent = n.userName || '-';
    document.getElementById('notaTanggalDetail').textContent = formatTanggal(n.tanggal);

    const tbody = document.querySelector('#tableNotaDetail tbody');
    tbody.innerHTML = '';
    let total = 0;
    (n.items || []).forEach((item, i) => {
      const subtotal = (item.qtyKg || 0) * (item.hargaPerKg || 0);
      total += subtotal;
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${i + 1}</td>
        <td>${escapeHtml(item.jenis)} - ${escapeHtml(item.namaBarang)}</td>
        <td>${(item.qtyKg || 0).toFixed(2)}</td>
        <td>${formatRupiah(item.hargaPerKg || 0)}</td>
        <td>${formatRupiah(subtotal)}</td>
      `;
      tbody.appendChild(tr);
    });
    document.getElementById('notaTotalDetail').textContent = formatRupiah(total);

    document.getElementById('notaDetailWrapper').style.display = 'block';
    document.getElementById('notaDetailWrapper').scrollIntoView({ behavior: 'smooth' });

    if (autoPrint) {
      setTimeout(() => window.print(), 300);
    }
  }).catch(err => {
    console.error(err);
    alert('Gagal memuat detail nota.');
  });
}

document.getElementById('btnBackToList').addEventListener('click', () => {
  document.getElementById('notaDetailWrapper').style.display = 'none';
  window.scrollTo({ top: 0, behavior: 'smooth' });
});

document.getElementById('btnPrintNota').addEventListener('click', () => {
  window.print();
});

// ==========================================
// FITUR: REKAP (SEMUA ROLE)
// ==========================================
function loadRekap() {
  const isAdmin = currentUserData.role === 'admin';

  if (isAdmin) {
    // Admin: tampilkan rekap semua user
    onSnapshot(collection(db, 'rekap'), (snap) => {
      const tbody = document.querySelector('#tableRekap tbody');
      tbody.innerHTML = '';
      let gTransaksi = 0, gBerat = 0, gNominal = 0;

      snap.forEach((docSnap, idx) => {
        const r = docSnap.data();
        gTransaksi += r.totalTransaksi || 0;
        gBerat += r.totalBeratKg || 0;
        gNominal += r.totalNominal || 0;
        tbody.innerHTML += `
          <tr>
            <td>${idx + 1}</td>
            <td>${r.userName}</td>
            <td>${r.totalTransaksi || 0}</td>
            <td>${(r.totalBeratKg || 0).toFixed(2)}</td>
            <td>${formatRupiah(r.totalNominal || 0)}</td>
          </tr>`;
      });

      document.getElementById('rekapTotalTransaksi').textContent = gTransaksi;
      document.getElementById('rekapTotalBerat').textContent = gBerat.toFixed(2) + ' Kg';
      document.getElementById('rekapGrandTotal').textContent = formatRupiah(gNominal);
    });
  } else {
    // User: tampilkan rekap pribadi saja
    const rekapRef = doc(db, 'rekap', currentUser.uid);
    onSnapshot(rekapRef, (snap) => {
      if (snap.exists()) {
        const r = snap.data();
        document.getElementById('rekapTotalTransaksi').textContent = r.totalTransaksi || 0;
        document.getElementById('rekapTotalBerat').textContent = (r.totalBeratKg || 0).toFixed(2) + ' Kg';
        document.getElementById('rekapGrandTotal').textContent = formatRupiah(r.totalNominal || 0);
      } else {
        document.getElementById('rekapTotalTransaksi').textContent = '0';
        document.getElementById('rekapTotalBerat').textContent = '0 Kg';
        document.getElementById('rekapGrandTotal').textContent = 'Rp 0';
      }
    });
  }
}

// ==========================================
// FITUR: LIVE CHAT (SEMUA ROLE)
// ==========================================
function initChat() {
  const chatBox = document.getElementById('chatBox');
  const formChat = document.getElementById('formChat');
  const chatInput = document.getElementById('chatInput');

  onSnapshot(query(collection(db, 'chats'), orderBy('createdAt', 'asc')), (snap) => {
    chatBox.innerHTML = '';
    snap.forEach(d => {
      const c = d.data();
      const isMe = c.senderId === currentUser.uid;
      const div = document.createElement('div');
      div.className = 'chat-bubble ' + (isMe ? 'me' : 'other');
      div.innerHTML = `
        <div class="chat-sender">${escapeHtml(c.senderName)}</div>
        <div class="chat-text">${escapeHtml(c.text)}</div>
        <div class="chat-time">${formatTanggalShort(c.createdAt)}</div>
      `;
      chatBox.appendChild(div);
    });
    chatBox.scrollTop = chatBox.scrollHeight;
  });

  formChat.addEventListener('submit', async (e) => {
    e.preventDefault();
    const text = chatInput.value.trim();
    if (!text) return;
    try {
      await addDoc(collection(db, 'chats'), {
        senderId: currentUser.uid,
        senderName: currentUserData.name,
        text,
        createdAt: serverTimestamp()
      });
      chatInput.value = '';
    } catch (err) {
      console.error(err);
      alert('Gagal mengirim pesan.');
    }
  });
}
