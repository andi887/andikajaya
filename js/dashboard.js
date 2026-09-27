// js/dashboard.js - ANDIKA JAYA V3.0 - FITUR PELUNASAN - NO INDEX + TAB FIX
import { auth, db, secondaryAuth } from './firebase-config.js';
import { formatRupiah, formatTanggal, formatTanggalShort, escapeHtml, generateNoNota } from './utils.js';
import { onAuthStateChanged, signOut, createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { collection, addDoc, doc, setDoc, getDoc, updateDoc, query, onSnapshot, serverTimestamp, where } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

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
  document.getElementById('userName').textContent = currentUserData.name||'User';
  document.getElementById('headerSubtitle').textContent = isAdmin ? 'Panel Administrator' : 'Dashboard Supplier';
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
    tr.innerHTML=`<td class="row-no"></td><td><select class="input-jenis" required><option value="">Pilih</option>${JENIS_BARANG.map(j=>`<option value="${j}">${j}</option>`).join('')}<option value="Lainnya">Lainnya</option></select></td><td><input type="text" class="input-nama" placeholder="Nama detail" required /></td><td><input type="number" class="input-qty" min="0" step="any" value="0" required /></td><td><input type="number" class="input-harga" min="0" step="any" value="0" required /></td><td class="cell-subtotal">${formatRupiah(0)}</td><td><button type="button" class="btn-remove-row">X</button></td>`;
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
      await addDoc(collection(db,'notas'),{
        noNota:generateNoNota(), userId, userName, tanggal:new Date(tanggal), items:rows, totalNota,
        status:'belum_lunas',
        createdBy:currentUser.uid, createdAt:serverTimestamp()
      });
      msg.textContent='Nota berhasil disimpan! Status: BELUM LUNAS'; msg.className='message success';
      e.target.reset(); itemsBody.innerHTML=''; addRow(); calc();
    }catch(ex){ msg.textContent='Gagal: '+ex.message; msg.className='message error'; }
  });
}

function loadNotasNoIndex(){
  const tbody=document.querySelector('#tableNotas tbody');
  if(!tbody) return;
  const isAdmin = (currentUserData.role||'').toLowerCase().trim() === 'admin';
  const col = collection(db,'notas');
  const q = isAdmin ? col : query(col, where('userId','==', currentUser.uid));
  
  onSnapshot(q, snap=>{
    let all=[];
    snap.forEach(d=> all.push({id:d.id, ...d.data()}));
    all.sort((a,b)=> (b.createdAt?.toMillis?.()||0) - (a.createdAt?.toMillis?.()||0));
    
    tbody.innerHTML='';
    if(all.length===0){ tbody.innerHTML='<tr><td colspan="6" style="text-align:center;">Belum ada nota. Silakan input di tab Input Nota.</td></tr>'; updateRekap([]); return; }
    all.forEach((n,idx)=>{
      const status = n.status || 'belum_lunas';
      const isLunas = status === 'lunas';
      const badge = isLunas ? '<span class="badge badge-lunas">LUNAS</span>' : '<span class="badge badge-belum">BELUM</span>';
      let actionBtns = `<button class="btn-view" data-id="${n.id}">Lihat</button><button class="btn-print" data-id="${n.id}">Cetak</button>`;
      if(isAdmin){
        if(isLunas) actionBtns += `<button class="btn-batal" data-id="${n.id}">Batal Lunas</button>`;
        else actionBtns += `<button class="btn-lunas" data-id="${n.id}">Lunasi</button>`;
      }
      const tr=document.createElement('tr');
      tr.innerHTML=`<td>${idx+1}</td><td>${formatTanggalShort(n.tanggal)}</td><td class="col-user ${isAdmin?'show':''}" style="${isAdmin?'':'display:none'}">${escapeHtml(n.userName)}</td><td>${formatRupiah(n.totalNota)}</td><td>${badge}</td><td>${actionBtns}</td>`;
      tbody.appendChild(tr);
    });
    tbody.querySelectorAll('.btn-view').forEach(b=> b.addEventListener('click',()=> showNotaDetail(b.dataset.id)));
    tbody.querySelectorAll('.btn-print').forEach(b=> b.addEventListener('click',()=> showNotaDetail(b.dataset.id,true)));
    tbody.querySelectorAll('.btn-lunas').forEach(b=> b.addEventListener('click',()=> tandaiLunas(b.dataset.id)));
    tbody.querySelectorAll('.btn-batal').forEach(b=> b.addEventListener('click',()=> batalLunas(b.dataset.id)));
    updateRekap(all);
  }, err=>{
    console.error(err);
    tbody.innerHTML=`<tr><td colspan="6" style="color:red;text-align:center;">Error: ${err.message}</td></tr>`;
  });
}

async function tandaiLunas(id){
  if(!confirm('Tandai nota ini sebagai LUNAS?\n\nNota bisa dilunasi kapan saja, bahkan 1 minggu/bulan setelah dibuat.')) return;
  try{
    await updateDoc(doc(db,'notas',id),{
      status:'lunas',
      lunasAt: serverTimestamp(),
      lunasBy: currentUser.uid
    });
  }catch(e){ alert('Gagal: '+e.message); }
}
async function batalLunas(id){
  if(!confirm('Batalkan pelunasan? Nota jadi BELUM LUNAS lagi.')) return;
  try{
    await updateDoc(doc(db,'notas',id),{
      status:'belum_lunas',
      lunasAt: null,
      lunasBy: null
    });
  }catch(e){ alert('Gagal: '+e.message); }
}

function showNotaDetail(id, autoPrint=false){
  getDoc(doc(db,'notas',id)).then(snap=>{
    if(!snap.exists()){ alert('Nota tidak ditemukan'); return; }
    const n=snap.data();
    const status = n.status || 'belum_lunas';
    document.getElementById('notaKepada').textContent=n.userName||'-';
    document.getElementById('notaTanggalDetail').textContent=formatTanggal(n.tanggal)+(n.noNota?' | No: '+n.noNota:'');
    const statusEl=document.getElementById('notaStatusDetail');
    if(statusEl){
      statusEl.innerHTML = status==='lunas' ? '<span class="badge badge-lunas">LUNAS</span> - '+formatTanggal(n.lunasAt) : '<span class="badge badge-belum">BELUM LUNAS</span>';
    }
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
  let gTrans=notas.length, gBerat=0, gNom=0, gLunasCount=0, gBelumCount=0, gPiutang=0;
  notas.forEach(n=>{
    (n.items||[]).forEach(it=>{ gBerat+=it.qtyKg||0; });
    gNom+=n.totalNota||0;
    const st = n.status || 'belum_lunas';
    if(st==='lunas') gLunasCount++;
    else { gBelumCount++; gPiutang+=n.totalNota||0; }
  });
  const elTrans=document.getElementById('rekapTotalTransaksi'); if(elTrans) elTrans.textContent=gTrans;
  const elBerat=document.getElementById('rekapTotalBerat'); if(elBerat) elBerat.textContent=gBerat.toFixed(2)+' Kg';
  const elBelum=document.getElementById('rekapBelumLunas'); if(elBelum) elBelum.textContent=gBelumCount+' nota';
  const elLunas=document.getElementById('rekapLunas'); if(elLunas) elLunas.textContent=gLunasCount+' nota';
  const elGrand=document.getElementById('rekapGrandTotal'); if(elGrand) elGrand.textContent=formatRupiah(gPiutang);
  const elLabel=document.getElementById('rekapGrandTotalLabel'); if(elLabel) elLabel.textContent='Sisa Piutang (Rp)';

  if(isAdmin){
    const perUser={};
    notas.forEach(n=>{
      if(!perUser[n.userId]) perUser[n.userId]={name:n.userName,count:0,berat:0,nominal:0,lunas:0,belum:0,piutang:0};
      perUser[n.userId].count++; perUser[n.userId].nominal+=n.totalNota||0;
      (n.items||[]).forEach(it=> perUser[n.userId].berat+=it.qtyKg||0);
      if((n.status||'belum_lunas')==='lunas') perUser[n.userId].lunas++;
      else { perUser[n.userId].belum++; perUser[n.userId].piutang+=n.totalNota||0; }
    });
    const tbody=document.querySelector('#tableRekap tbody'); if(tbody){ tbody.innerHTML=''; let i=0; Object.values(perUser).forEach(r=>{ i++; tbody.innerHTML+=`<tr><td>${i}</td><td>${escapeHtml(r.name)}</td><td>${r.count} (${r.lunas} lunas, ${r.belum} belum)</td><td>${r.berat.toFixed(2)}</td><td>${formatRupiah(r.nominal)}<br/><small style="color:#c0392b;">Piutang: ${formatRupiah(r.piutang)}</small></td></tr>`; }); }
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
