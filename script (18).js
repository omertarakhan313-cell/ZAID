import { initializeApp } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js";
import { getFirestore, collection, addDoc, updateDoc, doc, onSnapshot, deleteDoc } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";
import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-storage.js";

const firebaseConfig = {
  apiKey: "AIzaSyCndzjH_3la7JREXMrLR3mf8RLI1in4ans",
  authDomain: "advanced-clinics.firebaseapp.com",
  projectId: "advanced-clinics",
  storageBucket: "advanced-clinics.firebasestorage.app",
  messagingSenderId: "345041527949",
  appId: "1:345041527949:web:546375c56287b8d8806ec4",
  measurementId: "G-Y0BVF22C06"
};
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const storage = getStorage(app);
const patientsCol = collection(db, "patients_v3");

let patients = [];
let editingIndex = null;
let uploadedFiles = [];
let currentRole = "";
let currentFilter = "all";

// ========= ربط كل الزراير =========
document.getElementById("loginBtn").onclick = login;
document.getElementById("logoutBtn1").onclick = logout;
document.getElementById("logoutBtn2").onclick = logout;
document.getElementById("saveBtn").onclick = addPatient;
document.getElementById("exportBtn").onclick = exportExcel;
document.getElementById("importBtn").onclick = () => importExcel.click();
document.getElementById("importExcel").onchange = handleImport;
document.getElementById("backupBtn").onclick = backupJSON;
document.getElementById("clearBtn").onclick = clearAll;
document.getElementById("search").onkeyup = () => loadTable(currentRole);
document.getElementById("statusFilter").onchange = (e) => {currentFilter = e.target.value; loadTable(currentRole)};
document.getElementById("searchDoc").onkeyup = searchDocTable;
document.getElementById("closePopupBtn").onclick = closePopup;
document.getElementById("saveEditBtn").onclick = saveDoctorEdit;
document.getElementById("pFiles").onchange = handleFiles;
// ==================================

onSnapshot(patientsCol, (snapshot) => {
  patients = [];
  snapshot.forEach((docSnap) => {
    patients.push({ id: docSnap.id,...docSnap.data() });
  });
  document.getElementById("loading").style.display = "none";
  if(currentRole) loadTable(currentRole);
  generateCode();
});

function handleFiles(e){
  uploadedFiles = []; preview.innerHTML = "";
  [...e.target.files].forEach(file => {
    let reader = new FileReader();
    reader.onload = ev => {
      let img = new Image();
      img.onload = function(){
        let canvas = document.createElement('canvas');
        let maxW = 500;
        let scale = maxW / img.width;
        canvas.width = maxW; canvas.height = img.height * scale;
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        let smallImg = canvas.toDataURL("image/jpeg", 0.5);
        uploadedFiles.push({name: file.name, data: smallImg});
        preview.innerHTML += `<img src="${smallImg}">`;
      }
      img.src = ev.target.result;
    }
    reader.readAsDataURL(file);
  });
}

function login() {
  const user = username.value; const pass = password.value;
  error.innerText = "";
  if(user.startsWith("SR") && pass==="1234"){
    currentRole = "secretary";
    loginBox.style.display = "none"; secretaryBox.style.display = "block";
    generateCode(); loadTable("secretary");
  }
  else if(user==="DR6040" && pass==="1234"){
    currentRole = "doctor_big";
    loginBox.style.display = "none"; doctorBox.style.display = "block";
    doctorName.innerText = "Doctor Dashboard - Senior " + user; loadTable("doctor_big");
  }
  else if(user==="DR5050" && pass==="1224"){
    currentRole = "doctor_small";
    loginBox.style.display = "none"; doctorBox.style.display = "block";
    doctorName.innerText = "Doctor Dashboard - Junior " + user + " [View Only]"; loadTable("doctor_small");
  } else { error.innerText = "Invalid Username or Password!"; }
}

function logout(){ location.reload(); }

function generateCode(){
  let lastNum = 0;
  patients.forEach(p=>{ let num = parseInt(p.code.replace("P","")); if(num > lastNum) lastNum = num; });
  pCode.value = "P" + String(lastNum + 1).padStart(6, '0');
}

async function addPatient(){
  document.getElementById("saveBtn").disabled = true;
  document.getElementById("saveBtn").innerText = "جاري الرفع...";
  let uploadedUrls = [];
  for(let file of uploadedFiles){
    const storageRef = ref(storage, `patients/${pCode.value}/${Date.now()}_${file.name}`);
    const res = await fetch(file.data);
    const blob = await res.blob();
    const snap = await uploadBytes(storageRef, blob);
    const url = await getDownloadURL(snap.ref);
    uploadedUrls.push(url);
  }
  const patient = {
    code: pCode.value, name: pName.value, age: pAge.value,
    case: pCase.value, diseases: pDiseases.value, plan: pPlan.value,
    totalSessions: pTotalSessions.value, requiredSessions: "", doneSessions: 0,
    pricePerSession: pPaid.value, visits: [{date: pDate.value, paid: pPaid.value}],
    totalPaid: Number(pPaid.value), status: "Not Set", files: uploadedUrls, createdAt: new Date()
  };
  await addDoc(patientsCol, patient);
  document.getElementById("saveBtn").disabled = false;
  document.getElementById("saveBtn").innerText = "Save Patient";
  document.querySelectorAll("#secretaryBox input:not([readonly]), #secretaryBox textarea").forEach(i=>i.value="");
  preview.innerHTML = ""; uploadedFiles = [];
  alert("Patient Saved to Cloud ✅");
}

async function addVisit(index){
  let paid = prompt("الحالة دفعت كام في الزيارة دي؟");
  if(paid === null) return;
  let p = patients[index];
  p.visits.push({date: new Date().toISOString().slice(0,16), paid});
  p.totalPaid += Number(paid); p.doneSessions++;
  await updateDoc(doc(db, "patients_v3", p.id), p);
  alert("تم تسجيل الزيارة ✅");
}

function showDetails(index){
  editingIndex = index; let p = patients[index];
  let remaining = p.totalSessions - p.doneSessions;
  let filesHtml = "";
  if(p.files && p.files.length > 0){ p.files.forEach(f => filesHtml += `<img src="${f}">`); }
  let visitsHtml = "<h3>سجل الزيارات والدفع:</h3>";
  p.visits.forEach(v => visitsHtml += `<div class="visit-box">التاريخ: ${v.date} - دفع: $${v.paid}</div>`);

  detailsBody.innerHTML = `
    <p><b>Code:</b> ${p.code}</p><p><b>Name:</b> ${p.name}</p><p><b>Total Paid:</b> $${p.totalPaid}</p>
    <input type="number" id="editAge" value="${p.age}" placeholder="Age" ${currentRole==="doctor_small"?"disabled":""}>
    <input type="text" id="editCase" value="${p.case}" placeholder="Diagnosis" ${currentRole==="doctor_small"?"disabled":""}>
    <input type="text" id="editDiseases" value="${p.diseases}" placeholder="Diseases" ${currentRole==="doctor_small"?"disabled":""}>
    <textarea id="editPlan" rows="5" placeholder="Plan of treatment" ${currentRole==="doctor_small"?"disabled":""}>${p.plan}</textarea>
    <label>Required Sessions - من 6 الى 12:</label>
    <input type="number" id="editRequired" value="${p.requiredSessions}" min="6" max="12" placeholder="6 to 12" ${currentRole==="doctor_small"?"disabled":""}>
    <p><b>Total Sessions:</b> ${p.totalSessions}</p><p><b>Done Sessions:</b> ${p.doneSessions}</p><p><b>Remaining:</b> ${remaining}</p>
    <input type="number" id="editDone" value="${p.doneSessions}" placeholder="Update Done Sessions" ${currentRole==="doctor_small"?"disabled":""}>
    <h3>Images / X-Ray:</h3><div class="file-preview">${filesHtml}</div>${visitsHtml}
    <button class="btn-blue" onclick="printReport(${editingIndex})">🖨️ طباعة تقرير PDF</button>
  `;
  detailsPopup.style.display = "block";
  document.getElementById("saveEditBtn").style.display = currentRole==="doctor_small"?"none":"block";
}

function closePopup(){ detailsPopup.style.display = "none"; }

async function saveDoctorEdit(){
  let requiredVal = Number(document.getElementById("editRequired").value);
  if(requiredVal!== "" && (requiredVal < 6 || requiredVal > 12)){
    alert("Required Sessions must be between 6 and 12"); return;
  }
  let p = patients[editingIndex];
  p.age = document.getElementById("editAge").value;
  p.case = document.getElementById("editCase").value;
  p.diseases = document.getElementById("editDiseases").value;
  p.plan = document.getElementById("editPlan").value;
  p.requiredSessions = document.getElementById("editRequired").value;
  p.doneSessions = document.getElementById("editDone").value;
  await updateDoc(doc(db, "patients_v3", p.id), p);
  closePopup();
  alert("Saved to Cloud ✅");
}

async function setStatus(index, status){
  let p = patients[index];
  p.status = status;
  await updateDoc(doc(db, "patients_v3", p.id), {status});
}

async function deletePatient(index){
  if(confirm("متأكد عايز تحذف المريض: " + patients[index].name + " ؟")){
    await deleteDoc(doc(db, "patients_v3", patients[index].id));
  }
}

function loadTable(role){
  let table = role.includes("doctor")? doctorTable : patientTable;
  let searchVal = document.getElementById(role.includes("doctor")?"searchDoc":"search").value.toLowerCase();

  let filtered = patients.filter(p => {
    let matchSearch = p.name.toLowerCase().includes(searchVal) || p.code.toLowerCase().includes(searchVal) || p.case.toLowerCase().includes(searchVal);
    let matchStatus = currentFilter === "all" || p.status === currentFilter;
    return matchSearch && matchStatus;
  });

  let html = `<tr>
    <th>Code</th><th>Name</th><th>Diagnosis</th><th>Required</th><th>Done</th>
    <th>Total Paid</th><th>Status</th><th>Action</th>
  </tr>`;

  filtered.forEach((p, i) => {
    let realIndex = patients.findIndex(x => x.id === p.id);
    let statusColor = p.status === "Present"? "green" : p.status === "Absent"? "red" : "gray";
    let requiredText = p.requiredSessions === ""? "<span style='color:orange'>Not Set</span>" : p.requiredSessions;
    html += `<tr>
      <td>${p.code}</td><td>${p.name}</td><td>${p.case}</td>
      <td>${requiredText}</td><td>${p.doneSessions}</td>
      <td><b style="color:#f39c12">$${p.totalPaid}</b></td>
      <td><span style="color:${statusColor}; font-weight:bold;">${p.status}</span></td>
      <td id="actions-${realIndex}"></td></tr>`;
  });
  table.innerHTML = html;

  filtered.forEach((p) => {
    let realIndex = patients.findIndex(x => x.id === p.id);
    let cell = document.getElementById(`actions-${realIndex}`);
    if(role === "secretary"){
      cell.innerHTML = `
        <button class="btn-green" onclick="setStatus(${realIndex},'Present')">Present</button>
        <button class="btn-red" onclick="setStatus(${realIndex},'Absent')">Absent</button>
        <button class="btn-purple" onclick="addVisit(${realIndex})">+ زيارة</button>
        <button class="btn-red" onclick="deletePatient(${realIndex})">حذف</button>`;
    }
    if(role.includes("doctor")){
      cell.innerHTML = `<button class="btn-orange" onclick="showDetails(${realIndex})">Details</button>`;
    }
  });
}

function searchDocTable(){
  loadTable("doctor_big");
}

function exportExcel(){
  let csv = "Code,Name,Age,Diagnosis,Diseases,Plan,TotalSessions,RequiredSessions,DoneSessions,TotalPaid,Status\n";
  patients.forEach(p=>{
    csv += `${p.code},${p.name},${p.age},${p.case},"${p.diseases}","${p.plan}",${p.totalSessions},${p.requiredSessions},${p.doneSessions},$${p.totalPaid},${p.status}\n`;
  });
  let blob = new Blob(["\uFEFF" + csv], {type: "text/csv;charset=utf-8;"});
  let link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "patients_backup.csv";
  link.click();
}

function backupJSON(){
  let blob = new Blob([JSON.stringify(patients)], {type: "application/json"});
  let a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "backup_" + new Date().toISOString().slice(0,10) + ".json";
  a.click();
}

async function clearAll(){
  if(confirm("متأكد عايز تمسح كل المرضى من السحابة؟")){
    for(let p of patients){ await deleteDoc(doc(db, "patients_v3", p.id)); }
  }
}

function handleImport(e){
  const file = e.target.files[0];
  const reader = new FileReader();
  reader.onload = function(event){
    const csv = event.target.result;
    const lines = csv.split("\n");
    lines.forEach(async (line, i) => {
      if(i==0 || line.trim() === "") return;
      let data = line.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g) || [];
      data = data.map(d => d.replace(/^"|"$/g, ''));
      if(data[0]){
        const patient = {
          code: data[0], name: data[1], age: data[2], case: data[3],
          diseases: data[4], plan: data[5], totalSessions: data[6],
          requiredSessions: data[7], doneSessions: data[8],
          totalPaid: Number(String(data[9]).replace('$','')), status: data[10],
          visits: [{date: "", paid: String(data[9]).replace('$','')}], files: [], createdAt: new Date()
        }
        await addDoc(patientsCol, patient);
      }
    });
    alert("تم بدء استيراد البيانات للسحابة ✅");
  }
  reader.readAsText(file, "UTF-8");
}

// 1. طباعة تقرير PDF
function printReport(index){
  let p = patients[index];
  let w = window.open('', '', 'width=800,height=1000');
  w.document.write(`
    <html dir="rtl"><head><title>تقرير ${p.name}</title>
    <style>body{font-family:Cairo;padding:20px} h1{color:#0077cc} table{width:100%; border-collapse:collapse} td,th{border:1px solid #ccc; padding:8px}</style></head><body>
    <h1>مركز Advanced Clinics</h1>
    <h2>تقرير حالة: ${p.name}</h2>
    <p><b>الكود:</b> ${p.code} | <b>السن:</b> ${p.age}</p>
    <p><b>التشخيص:</b> ${p.case}</p>
    <p><b>الامراض المزمنة:</b> ${p.diseases}</p>
    <p><b>الخطة العلاجية:</b> ${p.plan}</p>
    <p><b>اجمالي الجلسات:</b> ${p.totalSessions} | <b>تم:</b> ${p.doneSessions} | <b>المطلوب:</b> ${p.requiredSessions}</p>
    <p><b>المبلغ المدفوع:</b> $${p.totalPaid}</p>
    <h3>سجل الزيارات</h3>
    <table><tr><th>التاريخ</th><th>المبلغ</th></tr>
    ${p.visits.map(v=>`<tr><td>${v.date}</td><td>$${v.paid}</td></tr>`).join('')}
    </table>
    <hr><p>التاريخ: ${new Date().toLocaleDateString('ar-EG')}</p>
    </body></html>
  `);
  w.print();
}

// مهم جدا عشان onclick يشتغل مع module
window.printReport = printReport;
window.setStatus = setStatus;
window.addVisit = addVisit;
window.deletePatient = deletePatient;
window.showDetails = showDetails;