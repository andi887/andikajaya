// js/dashboard.js - ANDIKA JAYA V2 FIX
import { auth, db, secondaryAuth } from './firebase-config.js';
import { formatRupiah, formatTanggal, formatTanggalShort, escapeHtml, generateNoNota } from './utils.js';
import { onAuthStateChanged, signOut, createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { collection, addDoc, doc, setDoc, getDoc, getDocs, query, orderBy, onSnapshot, serverTimestamp, where } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const JENIS_BARANG = ['Bandeng','KKB','Manyung','Tawar','Mubara','Bawel','Mondo','Daun','Kerong','Hiu','Ikan Merah','Banana','Tiger','Kputi','Sarisi','Lajur','Lasi','Toki','Tenggiri','Udang Tiger','Udang Biasa'];

let currentUser=null, currentUserData=null, allNotasCache=[];

onAuthStateChanged(auth, async (user)=>{
  if(!user){ window.location.href='index.html'; return; }
  const snap = await getDoc(doc(db,'users',user.uid));
  if(!snap.exists()){ alert('Akun tidak terdaftar'); await signOut(auth); window.location.href='index.html'; return; }
  currentUser=user; currentUserData=snap.data();
  setupDashboard();
});

function setupDashboard(){
  const isAdmin = currentUserData.role==='admin';
  document.getElementById('userName').textContent = currentUserData.name||'User';
  document.getElementById('headerSubtitle').textContent = isAdmin ? 'Panel Administrator' : 'Dashboard Supplier';
  document.querySelectorAll('.admin-only').forEach(el=> el.style.display=isAdmin?'':'none');
  document.querySelectorAll('.col-user').forEach(el=> el.style.display=isAdmin?'':'none');
  document.getElementById('notaTitle').textContent = isAdmin?'Semua Nota Pembelian':'Nota Pembelian Saya';
  document.getElementById('rekapTitle').textContent = isAdmin?'Rekap Keseluruhan':'Rekap Saya';
  
  initTabs(); initLogout(); loadNotasRealtime(); initChat();
  if(isAdmin){ initCreateUserFix(); loadUsersTable(); initNotaFormFix(); loadUsersDropdown(); }
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

// CREATE USER FIX - pakai secondaryAuth
function initCreateUserFix(){
  document.getElementById('formCreateUser').addEventListener('submit', async (e)=>{
    e.preventDefault();
    const msg=document.getElementById('createUserMessage');
    const name=document.getElementById('newUserName').value.trim();
    const email=document.getElementById('newUserEmail').value.trim();
    const password=document.getElementById('newUserPassword').value;
    if(name.length<3){ msg.textContent='Nama minimal 3 huruf'; msg.className='message error'; return; }
    msg.textContent='Membuat user...'; msg.className='message';
    try{
      const cred = await createUserWithEmailAndPassword(secondaryAuth, email, password);
      await setDoc(doc(db,'users',cred.user.uid),{uid:cred.user.uid,name,email,role:'user',createdAt:serverTimestamp()});
      // jangan logout secondaryAuth, tapi tidak mengganggu primary auth
      msg.textContent=`User "${name}" berhasil dibuat! Admin tetap login.`;
      msg.className='message success';
      e.target.reset();
      loadUsersDropdown();
    }catch(err){
      msg.textContent = err.code==='auth/email-already-in-use'?'Email sudah terdaftar':err.message;
      msg.className='message error';
    }
  });
}
function loadUsersTable(){
  onSnapshot(query(collection(db,'users'), where('role','==','user'), orderBy('createdAt','desc')), snap=>{
    const tbody=document.querySelector('#tableUsers tbody'); tbody.innerHTML='';
    let i=0; snap.forEach(d=>{ const u=d.data(); i++; tbody.innerHTML+=`<tr><td>${i}</td><td>${escapeHtml(u.name)}</td><td>${escapeHtml(u.email)}</td><td>${formatTanggal(u.createdAt)}</td></tr>`; });
  });
}
function loadUsersDropdown(){
  const select=document.getElementById('notaUser');
  if(!select) return;
  onSnapshot(query(collection(db,'users'), where('role','==','user'), orderBy('name')), snap=>{
    const cur=select.value; select.innerHTML='<option value="">-- Pilih User --</option>';
    snap.forEach(d=>{ const u=d.data(); const opt=document.createElement('option'); opt.value=d.id; opt.textContent=u.name; opt.dataset.name=u.name; if(d.id===cur) opt.selected=true; select.appendChild(opt); });
  });
}

// INPUT NOTA FIX
function initNotaFormFix(){
  const itemsBody=document.getElementById('itemsBody');
  const btnAdd=document.getElementById('btnAddRow');
  function addRow(){
    const tr=document.createElement('tr');
    tr.innerHTML=`
      <td class="row-no"></td>
      <td><select class="input-jenis" required><option value="">Pilih</option>${JENIS_BARANG.map(j=>`<option value="${j}">${j}</option>`).join('')}<option value="Lainnya">Lainnya</option></select></td>
      <td><input type="text" class="input-nama" placeholder="Nama detail" required /></td>
      <td><input type="number" class="input-qty" min="0" step="0.01" value="0" required /></td>
      <td><input type="number" class="input-harga" min="0" step="100" value="0" required /></td>
      <td class="cell-subtotal">${formatRupiah(0)}</td>
      <td><button type="button" class="btn-remove-row">X</button></td>`;
    itemsBody.appendChild(tr);
    attachRowEvents(tr); renumberRows(); calcTotal();
  }
  function attachRowEvents(tr){
    tr.querySelector('.btn-remove-row').addEventListener('click',()=>{ tr.remove(); renumberRows(); calcTotal(); });
    tr.querySelectorAll('.input-qty,.input-harga').forEach(inp=> inp.addEventListener('input',calcTotal));
  }
  function renumberRows(){ itemsBody.querySelectorAll('tr').forEach((tr,idx)=> tr.querySelector('.row-no').textContent=idx+1); }
  window.calcTotal = ()=>{
    let grand=0;
    itemsBody.querySelectorAll('tr').forEach(tr=>{
      const qty=Math.max(0, parseFloat(tr.querySelector('.input-qty').value)||0);
      const harga=Math.max(0, parseFloat(tr.querySelector('.input-harga').value)||0);
      const sub=qty*harga; grand+=sub;
      tr.querySelector('.cell-subtotal').textContent=formatRupiah(sub);
    });
    document.getElementById('totalNota').textContent=formatRupiah(grand);
    return grand;
  };
  btnAdd.addEventListener('click',addRow);
  if(itemsBody.children.length===0) addRow();
  document.getElementById('formNota').addEventListener('submit', async (e)=>{
    e.preventDefault();
    const msg=document.getElementById('notaMessage');
    const userId=document.getElementById('notaUser').value;
    const tanggal=document.getElementById('notaTanggal').value;
    if(!userId||!tanggal){ msg.textContent='Pilih user dan tanggal'; msg.className='message error'; return; }
    const rows=[]; let hasError=false;
    itemsBody.querySelectorAll('tr').forEach(tr=>{
      const jenis=tr.querySelector('.input-jenis').value; const nama=tr.querySelector('.input-nama').value.trim();
      const qty=parseFloat(tr.querySelector('.input-qty').value)||0; const harga=parseFloat(tr.querySelector('.input-harga').value)||0;
      if(!jenis||!nama||qty<=0||harga<=0) hasError=true;
      rows.push({jenis,namaBarang:nama,qtyKg:qty,hargaPerKg:harga,subtotal:qty*harga});
    });
    if(hasError||rows.length===0){ msg.textContent='Lengkapi semua baris, qty dan harga >0'; msg.className='message error'; return; }
    const totalNota=rows.reduce((s,r)=>s+r.subtotal,0);
    const userName=document.getElementById('notaUser').selectedOptions[0].dataset.name||'User';
    msg.textContent='Menyimpan...'; msg.className='message';
    try{
      await addDoc(collection(db,'notas'),{
        noNota: generateNoNota(), userId, userName, tanggal: new Date(tanggal), items: rows, totalNota, createdBy: currentUser.uid, createdAt: serverTimestamp()
      });
      msg.textContent='Nota berhasil disimpan!'; msg.className='message success';
      e.target.reset(); itemsBody.innerHTML=''; addRow(); calcTotal();
    }catch(err){ msg.textContent='Gagal: '+err.message; msg.className='message error'; }
  });
}

// DAFTAR NOTA + REKAP REALTIME DARI NOTAS (TANPA COLLECTION REKAP)
function loadNotasRealtime(){
  const tbody=document.querySelector('#tableNotas tbody');
  const isAdmin=currentUserData.role==='admin';
  const q = isAdmin ? query(collection(db,'notas'), orderBy('createdAt','desc')) : query(collection(db,'notas'), where('userId','==',currentUser.uid), orderBy('createdAt','desc'));
  onSnapshot(q, snap=>{
    allNotasCache=[]; tbody.innerHTML='';
    if(snap.empty){ tbody.innerHTML='<tr><td colspan="5" style="text-align:center;">Belum ada nota.</td></tr>'; updateRekap([]); return; }
    snap.forEach(d=>{ allNotasCache.push({id:d.id,...d.data()}); });
    allNotasCache.forEach((n,idx)=>{
      const tr=document.createElement('tr');
      tr.innerHTML=`<td>${idx+1}</td><td>${formatTanggalShort(n.tanggal)}</td><td class="col-user" style="display:${isAdmin?'':'none'}">${escapeHtml(n.userName)}</td><td>${formatRupiah(n.totalNota)}</td><td><button class="btn-view" data-id="${n.id}">Lihat</button><button class="btn-print" data-id="${n.id}">Cetak</button></td>`;
      tbody.appendChild(tr);
    });
    tbody.querySelectorAll('.btn-view').forEach(b=> b.addEventListener('click',()=> showNotaDetail(b.dataset.id)));
    tbody.querySelectorAll('.btn-print').forEach(b=> b.addEventListener('click',()=> showNotaDetail(b.dataset.id,true)));
    updateRekap(allNotasCache);
  }, err=>{ tbody.innerHTML=`<tr><td colspan="5" style="color:red;text-align:center;">Gagal load: ${err.message}</td></tr>`; });
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
document.getElementById('btnBackToList')?.addEventListener('click',()=>{ document.getElementById('notaDetailWrapper').style.display='none'; window.scrollTo({top:0,behavior:'smooth'}); });
document.getElementById('btnPrintNota')?.addEventListener('click',()=> window.print());

function updateRekap(notas){
  const isAdmin=currentUserData.role==='admin';
  let gTrans=notas.length, gBerat=0, gNom=0;
  notas.forEach(n=>{ (n.items||[]).forEach(it=>{ gBerat+=it.qtyKg||0; }); gNom+=n.totalNota||0; });
  document.getElementById('rekapTotalTransaksi').textContent=gTrans;
  document.getElementById('rekapTotalBerat').textContent=gBerat.toFixed(2)+' Kg';
  document.getElementById('rekapGrandTotal').textContent=formatRupiah(gNom);
  if(isAdmin){
    const perUser={};
    notas.forEach(n=>{ if(!perUser[n.userId]) perUser[n.userId]={name:n.userName,count:0,berat:0,nominal:0}; perUser[n.userId].count++; perUser[n.userId].nominal+=n.totalNota||0; (n.items||[]).forEach(it=> perUser[n.userId].berat+=it.qtyKg||0); });
    const tbody=document.querySelector('#tableRekap tbody'); tbody.innerHTML=''; let i=0;
    Object.values(perUser).forEach(r=>{ i++; tbody.innerHTML+=`<tr><td>${i}</td><td>${escapeHtml(r.name)}</td><td>${r.count}</td><td>${r.berat.toFixed(2)}</td><td>${formatRupiah(r.nominal)}</td></tr>`; });
  }
}

function initChat(){
  const chatBox=document.getElementById('chatBox');
  const formChat=document.getElementById('formChat');
  const chatInput=document.getElementById('chatInput');
  onSnapshot(query(collection(db,'chats'), orderBy('createdAt','asc')), snap=>{
    chatBox.innerHTML='';
    snap.forEach(d=>{ const c=d.data(); const isMe=c.senderId===currentUser.uid; const div=document.createElement('div'); div.className='chat-bubble '+(isMe?'me':'other'); div.innerHTML=`<div class="chat-sender">${escapeHtml(c.senderName)}</div><div class="chat-text">${escapeHtml(c.text)}</div><div class="chat-time">${formatTanggalShort(c.createdAt)}</div>`; chatBox.appendChild(div); });
    chatBox.scrollTop=chatBox.scrollHeight;
  });
  formChat.addEventListener('submit', async e=>{
    e.preventDefault(); const text=chatInput.value.trim(); if(!text) return;
    try{ await addDoc(collection(db,'chats'),{senderId:currentUser.uid,senderName:currentUserData.name,text,createdAt:serverTimestamp()}); chatInput.value=''; }catch(err){ alert('Gagal kirim'); }
  });
}
