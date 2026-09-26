// js/dashboard.js - ANDIKA JAYA V2.1 - NO INDEX NEEDED + FIX ADMIN TABS
import { auth, db, secondaryAuth } from './firebase-config.js';
import { formatRupiah, formatTanggal, formatTanggalShort, escapeHtml, generateNoNota } from './utils.js';
import { onAuthStateChanged, signOut, createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { collection, addDoc, doc, setDoc, getDoc, query, onSnapshot, serverTimestamp, where } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const JENIS_BARANG = ['Bandeng','KKB','Manyung','Tawar','Mubara','Bawel','Mondo','Daun','Kerong','Hiu','Ikan Merah','Banana','Tiger','Kputi','Sarisi','Lajur','Lasi','Toki','Tenggiri','Udang Tiger','Udang Biasa'];
let currentUser=null, currentUserData=null;

onAuthStateChanged(auth, async (user)=>{
  if(!user){ window.location.href='index.html'; return; }
  const snap = await getDoc(doc(db,'users',user.uid));
  if(!snap.exists()){ alert('Akun tidak terdaftar di users'); await signOut(auth); window.location.href='index.html'; return; }
  currentUser=user; currentUserData=snap.data();
  setupDashboard();
});

function setupDashboard(){
  const isAdmin = (currentUserData.role||'').toLowerCase().trim() === 'admin';
  console.log('IS ADMIN:', isAdmin, 'role=', currentUserData.role);
  document.getElementById('userName').textContent = currentUserData.name||'User';
  document.getElementById('headerSubtitle').textContent = isAdmin ? 'Panel Administrator' : 'Dashboard Supplier';
  
  // FIX ADMIN TABS - pakai class show
  document.querySelectorAll('.admin-only').forEach(el=>{
    if(isAdmin) el.classList.add('show');
    else el.classList.remove('show');
  });

  document.getElementById('notaTitle').textContent = isAdmin?'Semua Nota Pembelian':'Nota Pembelian Saya';
  document.getElementById('rekapTitle').textContent = isAdmin?'Rekap Keseluruhan':'Rekap Saya';
  
  initTabs(); initLogout(); loadNotasNoIndex(); initChat();
  if(isAdmin){ initCreateUserFix(); loadUsersTableNoIndex(); initNotaFormFix(); loadUsersDropdown(); }
}

function initTabs(){
  document.querySelectorAll('.tab-btn').forEach(btn=>{
    btn.addEventListener('click',()=>{
      document.querySelectorAll('.tab-btn').forEach(b=>b.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c=>c.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById('tab-'+btn.dataset.tab).classList.add('active');
    });
  });
}
function initLogout(){ document.getElementById('btnLogout').addEventListener('click', async()=>{ await signOut(auth); window.location.href='index.html'; }); }

function initCreateUserFix(){
  const form = document.getElementById('formCreateUser');
  if(!form) return;
  form.addEventListener('submit', async (e)=>{
    e.preventDefault();
    const msg=document.getElementById('createUserMessage');
    const name=document.getElementById('newUserName').value.trim();
    const email=document.getElementById('newUserEmail').value.trim();
    const password=document.getElementById('newUserPassword').value;
    msg.textContent='Membuat user...'; msg.className='message';
    try{
      const cred = await createUserWithEmailAndPassword(secondaryAuth, email, password);
      await setDoc(doc(db,'users',cred.user.uid),{uid:cred.user.uid,name,email,role:'user',createdAt:serverTimestamp()});
      msg.textContent=`User "${name}" berhasil dibuat! Admin tetap login.`;
      msg.className='message success';
      e.target.reset();
    }catch(err){ msg.textContent=err.code==='auth/email-already-in-use'?'Email sudah terdaftar':err.message; msg.className='message error'; }
  });
}

function loadUsersTableNoIndex(){
  const tbody=document.querySelector('#tableUsers tbody');
  if(!tbody) return;
  // NO orderBy, sort client side - tidak butuh index
  onSnapshot(collection(db,'users'), snap=>{
    const users=[];
    snap.forEach(d=>{ if(d.data().role==='user') users.push(d.data()); });
    users.sort((a,b)=> (b.createdAt?.toMillis?.()||0) - (a.createdAt?.toMillis?.()||0));
    tbody.innerHTML='';
    users.forEach((u,i)=>{ tbody.innerHTML+=`<tr><td>${i+1}</td><td>${escapeHtml(u.name)}</td><td>${escapeHtml(u.email)}</td><td>${formatTanggal(u.createdAt)}</td></tr>`; });
  });
}

function loadUsersDropdown(){
  const select=document.getElementById('notaUser');
  if(!select) return;
  onSnapshot(collection(db,'users'), snap=>{
    const cur=select.value; select.innerHTML='<option value="">-- Pilih User --</option>';
    const list=[]; snap.forEach(d=>{ if(d.data().role==='user') list.push({id:d.id, ...d.data()}); });
    list.sort((a,b)=> a.name.localeCompare(b.name));
    list.forEach(u=>{ const opt=document.createElement('option'); opt.value=u.id; opt.textContent=u.name; opt.dataset.name=u.name; if(u.id===cur) opt.selected=true; select.appendChild(opt); });
  });
}

function initNotaFormFix(){
  const itemsBody=document.getElementById('itemsBody');
  const btnAdd=document.getElementById('btnAddRow');
  if(!itemsBody) return;
  function addRow(){
    const tr=document.createElement('tr');
    tr.innerHTML=`<td class="row-no"></td><td><select class="input-jenis" required><option value="">Pilih</option>${JENIS_BARANG.map(j=>`<option value="${j}">${j}</option>`).join('')}<option value="Lainnya">Lainnya</option></select></td><td><input type="text" class="input-nama" placeholder="Nama detail" required /></td><td><input type="number" class="input-qty" min="0" step="0.01" value="0" required /></td><td><input type="number" class="input-harga" min="0" step="100" value="0" required /></td><td class="cell-subtotal">${formatRupiah(0)}</td><td><button type="button" class="btn-remove-row">X</button></td>`;
    itemsBody.appendChild(tr);
    tr.querySelector('.btn-remove-row').addEventListener('click',()=>{ tr.remove(); renumber(); calc(); });
    tr.querySelectorAll('.input-qty,.input-harga').forEach(inp=> inp.addEventListener('input',calc));
    renumber(); calc();
  }
  function renumber(){ itemsBody.querySelectorAll('tr').forEach((tr,idx)=> tr.querySelector('.row-no').textContent=idx+1); }
  window.calc = ()=>{
    let grand=0;
    itemsBody.querySelectorAll('tr').forEach(tr=>{
      const qty=Math.max(0, parseFloat(tr.querySelector('.input-qty').value)||0);
      const harga=Math.max(0, parseFloat(tr.querySelector('.input-harga').value)||0);
      const sub=qty*harga; grand+=sub;
      tr.querySelector('.cell-subtotal').textContent=formatRupiah(sub);
    });
    const totalEl=document.getElementById('totalNota'); if(totalEl) totalEl.textContent=formatRupiah(grand);
    return grand;
  };
  if(btnAdd) btnAdd.addEventListener('click',addRow);
  if(itemsBody.children.length===0) addRow();
  const formNota=document.getElementById('formNota');
  if(formNota) formNota.addEventListener('submit', async (e)=>{
    e.preventDefault();
    const msg=document.getElementById('notaMessage');
    const userId=document.getElementById('notaUser').value;
    const tanggal=document.getElementById('notaTanggal').value;
    if(!userId||!tanggal){ msg.textContent='Pilih user dan tanggal'; msg.className='message error'; return; }
    const rows=[]; let err=false;
    itemsBody.querySelectorAll('tr').forEach(tr=>{
      const jenis=tr.querySelector('.input-jenis').value; const nama=tr.querySelector('.input-nama').value.trim();
      const qty=parseFloat(tr.querySelector('.input-qty').value)||0; const harga=parseFloat(tr.querySelector('.input-harga').value)||0;
      if(!jenis||!nama||qty<=0||harga<=0) err=true;
      rows.push({jenis,namaBarang:nama,qtyKg:qty,hargaPerKg:harga,subtotal:qty*harga});
    });
    if(err||rows.length===0){ msg.textContent='Lengkapi semua baris'; msg.className='message error'; return; }
    const totalNota=rows.reduce((s,r)=>s+r.subtotal,0);
    const userName=document.getElementById('notaUser').selectedOptions[0].dataset.name||'User';
    msg.textContent='Menyimpan...'; msg.className='message';
    try{
      await addDoc(collection(db,'notas'),{noNota:generateNoNota(), userId, userName, tanggal:new Date(tanggal), items:rows, totalNota, createdBy:currentUser.uid, createdAt:serverTimestamp()});
      msg.textContent='Nota berhasil disimpan!'; msg.className='message success';
      e.target.reset(); itemsBody.innerHTML=''; addRow(); calc();
    }catch(ex){ msg.textContent='Gagal: '+ex.message; msg.className='message error'; }
  });
}

// LOAD NOTA TANPA BUTUH INDEX - FIX UTAMA
function loadNotasNoIndex(){
  const tbody=document.querySelector('#tableNotas tbody');
  if(!tbody) return;
  const isAdmin = (currentUserData.role||'').toLowerCase().trim() === 'admin';
  const col = collection(db,'notas');
  const q = isAdmin ? col : query(col, where('userId','==', currentUser.uid));
  
  onSnapshot(q, snap=>{
    let all=[];
    snap.forEach(d=> all.push({id:d.id, ...d.data()}));
    // Sort di client, tidak di server - jadi tidak butuh index
    all.sort((a,b)=> (b.createdAt?.toMillis?.()||0) - (a.createdAt?.toMillis?.()||0));
    
    tbody.innerHTML='';
    if(all.length===0){ tbody.innerHTML='<tr><td colspan="5" style="text-align:center;">Belum ada nota. Silakan input di tab Input Nota.</td></tr>'; updateRekap([]); return; }
    all.forEach((n,idx)=>{
      const tr=document.createElement('tr');
      tr.innerHTML=`<td>${idx+1}</td><td>${formatTanggalShort(n.tanggal)}</td><td class="col-user ${isAdmin?'show':''}" style="${isAdmin?'':'display:none'}">${escapeHtml(n.userName)}</td><td>${formatRupiah(n.totalNota)}</td><td><button class="btn-view" data-id="${n.id}">Lihat</button><button class="btn-print" data-id="${n.id}">Cetak</button></td>`;
      tbody.appendChild(tr);
    });
    tbody.querySelectorAll('.btn-view').forEach(b=> b.addEventListener('click',()=> showNotaDetail(b.dataset.id)));
    tbody.querySelectorAll('.btn-print').forEach(b=> b.addEventListener('click',()=> showNotaDetail(b.dataset.id,true)));
    updateRekap(all);
  }, err=>{
    console.error(err);
    tbody.innerHTML=`<tr><td colspan="5" style="color:red;text-align:center;">Error: ${err.message}<br/>Klik link di Console untuk buat index atau pakai file V2.1 ini (sudah fix)</td></tr>`;
  });
}

function showNotaDetail(id, autoPrint=false){
  getDoc(doc(db,'notas',id)).then(snap=>{
    if(!snap.exists()){ alert('Nota tidak ditemukan'); return; }
    const n=snap.data();
    document.getElementById('notaKepada').textContent=n.userName||'-';
    document.getElementById('notaTanggalDetail').textContent=formatTanggal(n.tanggal)+(n.noNota?' | No: '+n.noNota:'');
    const tbody=document.querySelector('#tableNotaDetail tbody'); tbody.innerHTML=''; let total=0;
    (n.items||[]).forEach((it,i)=>{ total+=it.subtotal||0; tbody.innerHTML+=`<tr><td>${i+1}</td><td>${formatTanggalShort(n.tanggal)}</td><td>${escapeHtml(it.jenis)} - ${escapeHtml(it.namaBarang)}</td><td>${(it.qtyKg||0).toFixed(2)}</td><td>${formatRupiah(it.hargaPerKg)}</td><td>${formatRupiah(it.subtotal)}</td></tr>`; });
    document.getElementById('notaTotalDetail').textContent=formatRupiah(total);
    document.getElementById('notaDetailWrapper').style.display='block';
    document.getElementById('notaDetailWrapper').scrollIntoView({behavior:'smooth'});
    if(autoPrint) setTimeout(()=>window.print(),400);
  });
}
document.getElementById('btnBackToList')?.addEventListener('click',()=>{ document.getElementById('notaDetailWrapper').style.display='none'; });
document.getElementById('btnPrintNota')?.addEventListener('click',()=> window.print());

function updateRekap(notas){
  const isAdmin=(currentUserData.role||'').toLowerCase().trim()==='admin';
  let gTrans=notas.length, gBerat=0, gNom=0;
  notas.forEach(n=>{ (n.items||[]).forEach(it=>{ gBerat+=it.qtyKg||0; }); gNom+=n.totalNota||0; });
  document.getElementById('rekapTotalTransaksi').textContent=gTrans;
  document.getElementById('rekapTotalBerat').textContent=gBerat.toFixed(2)+' Kg';
  document.getElementById('rekapGrandTotal').textContent=formatRupiah(gNom);
  if(isAdmin){
    const perUser={};
    notas.forEach(n=>{ if(!perUser[n.userId]) perUser[n.userId]={name:n.userName,count:0,berat:0,nominal:0}; perUser[n.userId].count++; perUser[n.userId].nominal+=n.totalNota||0; (n.items||[]).forEach(it=> perUser[n.userId].berat+=it.qtyKg||0); });
    const tbody=document.querySelector('#tableRekap tbody'); if(tbody){ tbody.innerHTML=''; let i=0; Object.values(perUser).forEach(r=>{ i++; tbody.innerHTML+=`<tr><td>${i}</td><td>${escapeHtml(r.name)}</td><td>${r.count}</td><td>${r.berat.toFixed(2)}</td><td>${formatRupiah(r.nominal)}</td></tr>`; }); }
  }
}

function initChat(){
  const chatBox=document.getElementById('chatBox');
  const formChat=document.getElementById('formChat');
  const chatInput=document.getElementById('chatInput');
  if(!chatBox) return;
  onSnapshot(collection(db,'chats'), snap=>{
    let chats=[]; snap.forEach(d=> chats.push(d.data()));
    chats.sort((a,b)=> (a.createdAt?.toMillis?.()||0) - (b.createdAt?.toMillis?.()||0));
    chatBox.innerHTML='';
    chats.forEach(c=>{ const isMe=c.senderId===currentUser.uid; const div=document.createElement('div'); div.className='chat-bubble '+(isMe?'me':'other'); div.innerHTML=`<div class="chat-sender">${escapeHtml(c.senderName)}</div><div class="chat-text">${escapeHtml(c.text)}</div><div class="chat-time">${formatTanggalShort(c.createdAt)}</div>`; chatBox.appendChild(div); });
    chatBox.scrollTop=chatBox.scrollHeight;
  });
  if(formChat) formChat.addEventListener('submit', async e=>{
    e.preventDefault(); const text=chatInput.value.trim(); if(!text) return;
    try{ await addDoc(collection(db,'chats'),{senderId:currentUser.uid,senderName:currentUserData.name,text,createdAt:serverTimestamp()}); chatInput.value=''; }catch(err){ alert('Gagal kirim'); }
  });
}
