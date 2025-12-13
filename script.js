/* -------------------------
   Shared storage keys & helpers
   ------------------------- */
const STORAGE = {
  CANDIDATES: "ev_candidates",
  STUDENTS: "ev_students",
  VOTES: "ev_votes",           // array of { usn, candidateName }
  NEEDS: "ev_needs",           // map usn -> message + forwarded flag
  ADMIN_PASS: "ev_admin_pass"  // optional storage (we'll set default)
};

if (!localStorage.getItem(STORAGE.ADMIN_PASS)) {
  localStorage.setItem(STORAGE.ADMIN_PASS, "admin123"); // default password
}

function load(key){ return JSON.parse(localStorage.getItem(key) || "[]"); }
function save(key, data){ localStorage.setItem(key, JSON.stringify(data)); }

// Utility: numeric USN extraction for sorting falling back to alnum compare
function usnValue(usn){
  if (!usn) return 0;
  const digits = (""+usn).match(/\d+/g);
  if (digits && digits.length) return parseInt(digits.join(""), 10);
  return 0;
}
function sortByUSNThenName(arr){
  return arr.sort((a,b)=>{
    const au = usnValue(a.usn||a.USN||a.usnVal), bu = usnValue(b.usn||b.USN||b.usnVal);
    if (au !== bu) return au - bu;
    const an = (a.name||a.Name||a.NAME||"").toString().toLowerCase();
    const bn = (b.name||b.Name||b.NAME||"").toString().toLowerCase();
    return an.localeCompare(bn);
  });
}

/* -------------------------
   Admin: login overlay + nav
   ------------------------- */
document.addEventListener("DOMContentLoaded", () => {
  // NAV
  const nav = document.querySelectorAll(".nav button[data-target]");
  nav.forEach(b => b.addEventListener("click", () => {
    nav.forEach(x => x.classList.remove("active"));
    b.classList.add("active");
    const t = b.getAttribute("data-target");
    document.querySelectorAll(".section").forEach(s => s.classList.remove("active"));
    document.getElementById(t).classList.add("active");

    // refresh views as needed
    if (t === "candidateListSection") renderCandidateTable();
    if (t === "votersSection") renderVotersTable();
    if (t === "resultsSection") renderResults();
    if (t === "needsSection") renderNeedsTable();
  }));

  // ADMIN LOGIN actions
  const loginOverlay = document.getElementById("loginOverlay");
  const adminLoginBtn = document.getElementById("adminLoginBtn");
  
  adminLoginBtn.onclick = () => {
    const entered = document.getElementById("adminPasswordInput").value;
    const real = localStorage.getItem(STORAGE.ADMIN_PASS) || "admin123";
    if (entered === real) {
      loginOverlay.style.display = "none";
    } else {
      alert("Incorrect password.");
    }
  };
  demoBtn.onclick = () => {
    alert("Demo password is 'admin123'. Using it to log in.");
    document.getElementById("adminPasswordInput").value = "admin123";
    adminLoginBtn.click();
  };

  // Hook admin controls
  document.getElementById("registerCandidateBtn").onclick = handleRegisterCandidate;
  document.getElementById("clearCandidateForm").onclick = () => {
    document.getElementById("candidateName").value = "";
    document.getElementById("candidateUSN").value = "";
    document.getElementById("candidateBatch").value = "";
    document.getElementById("candidateBranch").selectedIndex = 0;
  };

  document.getElementById("registerStudentBtn").onclick = handleRegisterStudent;
  document.getElementById("clearStudentForm").onclick = () => {
    document.getElementById("studentName").value = "";
    document.getElementById("studentUSN").value = "";
    document.getElementById("studentBranch").selectedIndex = 0;
  };

  document.getElementById("resetBtn").onclick = resetElection;

  // initial renders (if already logged in)
  if (loginOverlay.style.display === "none") {
    renderCandidateTable();
    renderVotersTable();
    renderResults();
    renderNeedsTable();
  }
});

/* -------------------------
   Candidate Registration (Admin)
   ------------------------- */
function handleRegisterCandidate(){
  const name = (document.getElementById("candidateName").value || "").trim();
  const usn = (document.getElementById("candidateUSN").value || "").trim();
  const branch = document.getElementById("candidateBranch").value;
  const batch = (document.getElementById("candidateBatch").value || "").trim();

  if (!name || !usn) return alert("Please provide candidate name and USN.");

  let candidates = load(STORAGE.CANDIDATES);
  // Prevent duplicate candidate USN for same election
  if (candidates.some(c => (""+c.usn).toLowerCase() === usn.toLowerCase())) {
    return alert("A candidate with this USN is already registered.");
  }

  candidates.push({ name, usn, branch, batch, votes: 0 });
  candidates = sortByUSNThenName(candidates);
  save(STORAGE.CANDIDATES, candidates);

  // clear form
  document.getElementById("candidateName").value = "";
  document.getElementById("candidateUSN").value = "";
  document.getElementById("candidateBatch").value = "";

  alert("Candidate registered.");
}

/* -------------------------
   Candidate List rendering (Admin)
   ------------------------- */
function renderCandidateTable(){
  const tbody = document.querySelector("#candidateTable tbody");
  tbody.innerHTML = "";
  let candidates = sortByUSNThenName(load(STORAGE.CANDIDATES));
  candidates.forEach(c=>{
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${c.usn}</td><td>${c.name}</td><td>${c.branch}</td><td>${c.batch||""}</td>`;
    tbody.appendChild(tr);
  });
}

/* -------------------------
   Student Registration (Admin)
   ------------------------- */
function handleRegisterStudent(){
  const name = (document.getElementById("studentName").value || "").trim();
  const usn = (document.getElementById("studentUSN").value || "").trim();
  const branch = document.getElementById("studentBranch").value;

  if (!name || !usn) return alert("Please enter student name and USN.");

  let students = load(STORAGE.STUDENTS);
  if (students.some(s => (""+s.usn).toLowerCase() === usn.toLowerCase())) {
    return alert("Student USN already registered.");
  }
  students.push({ name, usn, branch, voted:false });
  students = sortByUSNThenName(students);
  save(STORAGE.STUDENTS, students);

  document.getElementById("studentName").value = "";
  document.getElementById("studentUSN").value = "";

  alert("Student registered.");
}

/* -------------------------
   Voters list (Admin)
   ------------------------- */
function renderVotersTable(){
  const tbody = document.querySelector("#votersTable tbody");
  tbody.innerHTML = "";
  const votes = load(STORAGE.VOTES);
  const students = load(STORAGE.STUDENTS);
  votes.forEach(v => {
    const s = students.find(st => (""+st.usn).toLowerCase() === (""+v.usn).toLowerCase());
    const name = s ? s.name : "(unknown)";
    const branch = s ? s.branch : v.branch || "";
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${name}</td><td>${v.usn}</td><td>${branch}</td><td>${v.candidate}</td>`;
    tbody.appendChild(tr);
  });
}

/* -------------------------
   Needs table (Admin)
   ------------------------- */
function renderNeedsTable(){
  const tbody = document.querySelector("#needsTable tbody");
  tbody.innerHTML = "";
  const needs = JSON.parse(localStorage.getItem(STORAGE.NEEDS) || "{}");
  const students = load(STORAGE.STUDENTS);

  Object.keys(needs).forEach(usn => {
    const item = needs[usn];
    const s = students.find(st => (""+st.usn).toLowerCase() === (""+usn).toLowerCase()) || { name: "(unknown)", branch: item.branch || "" };
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${s.name}</td><td>${usn}</td><td>${s.branch}</td><td>${item.message||""}</td><td><input type="checkbox" ${item.forwarded ? 'checked':''} data-usn="${usn}" class="forwardChk" /></td>`;
    tbody.appendChild(tr);
  });

  // add forward toggles
  document.querySelectorAll(".forwardChk").forEach(chk => {
    chk.addEventListener("change", e => {
      const u = e.target.dataset.usn;
      const needs = JSON.parse(localStorage.getItem(STORAGE.NEEDS) || "{}");
      needs[u] = needs[u] || {};
      needs[u].forwarded = e.target.checked;
      localStorage.setItem(STORAGE.NEEDS, JSON.stringify(needs));
    });
  });
}

/* -------------------------
   Results (Chart + list)
   ------------------------- */
function renderResults(){
  const candidates = load(STORAGE.CANDIDATES);
  const votes = load(STORAGE.VOTES);
  // compute counts
  const counts = {};
  candidates.forEach(c=> counts[c.name] = 0);
  votes.forEach(v => { if (counts[v.candidate] !== undefined) counts[v.candidate]++; });

  // Chart
  const labels = Object.keys(counts);
  const data = Object.values(counts);

  // destroy prior if exists
  if (window._resultsChart) { window._resultsChart.destroy(); window._resultsChart = null; }

  const ctx = document.getElementById("resultsChart").getContext("2d");
  window._resultsChart = new Chart(ctx, {
    type: 'bar',
    data: { labels, datasets: [{ label: 'Votes', data }] },
    options: { responsive:true, maintainAspectRatio:false, scales:{ y:{ beginAtZero:true } } }
  });

  // also show textual list
  const list = document.getElementById("resultsList");
  list.innerHTML = "";
  const total = votes.length;
  labels.forEach(name => {
    const count = counts[name] || 0;
    const pct = total ? ((count/total)*100).toFixed(2) : "0.00";
    const div = document.createElement("div");
    div.className = "box";
    div.innerHTML = `<strong>${name}</strong> — ${count} votes (${pct}%)`;
    list.appendChild(div);
  });
}

/* -------------------------
   Reset election
   ------------------------- */
function resetElection(){
  if (!confirm("Reset election? This will clear candidates, votes, students and messages.")) return;
  localStorage.removeItem(STORAGE.CANDIDATES);
  localStorage.removeItem(STORAGE.VOTES);
  localStorage.removeItem(STORAGE.STUDENTS);
  localStorage.removeItem(STORAGE.NEEDS);
  alert("Election data cleared.");
  // refresh visible tables
  renderCandidateTable();
  renderVotersTable();
  renderResults();
  renderNeedsTable();
}

/* -------------------------
   Student page functionality
   (student.html uses same script file)
   ------------------------- */
(function studentPageBindings(){
  // only run bindings if elements exist (so same file can be used for admin+student)
  const stuRegBtn = document.getElementById("stuRegisterBtn");
  if (!stuRegBtn) return;

  // Load candidate list for student branch when student continues
  stuRegBtn.addEventListener("click", () => {
    const name = (document.getElementById("stuName").value || "").trim();
    const usn = (document.getElementById("stuUSN").value || "").trim();
    const branch = document.getElementById("stuBranch").value;
    const needMsg = (document.getElementById("stuNeed").value || "").trim();

    if (!name || !usn) return alert("Please enter name and USN.");

    // register student if not exists
    let students = load(STORAGE.STUDENTS);
    let student = students.find(s => (""+s.usn).toLowerCase() === (""+usn).toLowerCase());
    if (!student){
      students.push({ name, usn, branch, voted:false });
      students = sortByUSNThenName(students);
      save(STORAGE.STUDENTS, students);
    } else {
      // Update name/branch if changed
      student.name = name;
      student.branch = branch;
      save(STORAGE.STUDENTS, students);
    }

    // Save the "need" in NEEDS store even before voting; forwarded=false default
    const needs = JSON.parse(localStorage.getItem(STORAGE.NEEDS) || "{}");
    needs[usn] = { message: needMsg, forwarded: (needs[usn] && needs[usn].forwarded) || false, branch };
    localStorage.setItem(STORAGE.NEEDS, JSON.stringify(needs));

    // Now show voting section
    document.getElementById("votingCard").style.display = "block";
    document.getElementById("votingIntro").innerText = `Hello ${name} — select one candidate from your branch (${branch}) to vote for. You can vote only once.`;
    loadCandidatesForStudent(branch, usn);
  });

  // Clear button
  const stuClearBtn = document.getElementById("stuClearBtn");
  if (stuClearBtn) stuClearBtn.onclick = () => {
    document.getElementById("stuName").value = "";
    document.getElementById("stuUSN").value = "";
    document.getElementById("stuNeed").value = "";
    document.getElementById("stuBranch").selectedIndex = 0;
  };
})();

function loadCandidatesForStudent(branch, studentUSN){
  const container = document.getElementById("candidateButtons");
  container.innerHTML = "";
  const candidates = load(STORAGE.CANDIDATES).filter(c => c.branch === branch);
  if (!candidates.length) {
    container.innerHTML = "<div class='box'>No candidates registered for your branch.</div>";
    return;
  }

  candidates.forEach(c => {
    const btn = document.createElement("button");
    btn.className = "btn small";
    btn.style.textAlign = "left";
    btn.textContent = `${c.name} (USN: ${c.usn})`;
    btn.onclick = () => studentCastVote(studentUSN, c.name);
    container.appendChild(btn);
  });
}

function studentCastVote(studentUSN, candidateName){
  // Ensure student registered
  let students = load(STORAGE.STUDENTS);
  let student = students.find(s => (""+s.usn).toLowerCase() === (""+studentUSN).toLowerCase());
  if (!student) return alert("Student must be registered first.");

  if (student.voted) {
    return alert("You have already voted. Duplicate votes are not allowed.");
  }

  // mark voted
  student.voted = true;
  save(STORAGE.STUDENTS, students);

  // push to votes
  let votes = load(STORAGE.VOTES);
  votes.push({ usn: studentUSN, candidate: candidateName });
  save(STORAGE.VOTES, votes);

  // increment candidate votes in candidate store
  let candidates = load(STORAGE.CANDIDATES);
  const cand = candidates.find(c => c.name === candidateName);
  if (cand) {
    cand.votes = (cand.votes || 0) + 1;
    save(STORAGE.CANDIDATES, candidates);
  }

  // ensure need stored (already stored on register), fetch it
  const needs = JSON.parse(localStorage.getItem(STORAGE.NEEDS) || "{}");
  const entry = needs[studentUSN] || {};
  entry.message = entry.message || ""; // could be blank
  entry.branch = student.branch;
  needs[studentUSN] = entry;
  localStorage.setItem(STORAGE.NEEDS, JSON.stringify(needs));

  // show immediate confirmation and the submitted need
  const afterVote = document.getElementById("afterVote");
  const yourVoteBox = document.getElementById("yourVoteBox");
  afterVote.style.display = "block";
  yourVoteBox.innerHTML = `
    <p><strong>You voted for:</strong> ${candidateName}</p>
    <p><strong>Your registered name:</strong> ${student.name} (USN: ${studentUSN})</p>
    <p><strong>Your message / need:</strong><br/> ${entry.message ? entry.message : "<em>(no message submitted)</em>"}</p>
  `;

  // optionally update admin UI if admin open in another tab (they can refresh)
  alert("Vote recorded. Thank you!");
}
/* -------------------------
   New Voting Page Binding
   -------------------------*/
window.addEventListener("load-vote-page", e => {
  const studentUSN = e.detail;

  const students = load(STORAGE.STUDENTS);
  const student = students.find(s => (""+s.usn).toLowerCase() === studentUSN.toLowerCase());

  if (!student) {
    alert("Student not registered.");
    window.location.href = "student.html";
    return;
  }

  document.getElementById("votingIntro").innerText =
    `Hello ${student.name} — Select one candidate from your branch (${student.branch}).`;

  loadCandidatesForStudent(student.branch, student.usn);
});

/* -------------------------
   Student Register Event (from student.html)
   -------------------------*/
window.addEventListener("student-register", e => {
  const { name, usn, branch, need } = e.detail;

  let students = load(STORAGE.STUDENTS);
  let student = students.find(s => (""+s.usn).toLowerCase() === usn.toLowerCase());

  if (!student) {
    students.push({ name, usn, branch, voted:false });
    save(STORAGE.STUDENTS, students);
  }

  const needs = JSON.parse(localStorage.getItem(STORAGE.NEEDS) || "{}");
  needs[usn] = { message: need, forwarded:false, branch };
  localStorage.setItem(STORAGE.NEEDS, JSON.stringify(needs));
});
