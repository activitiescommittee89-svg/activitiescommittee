// ==================== Firebase SDK Imports ====================
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-app.js";
import {
  getFirestore,
  collection,
  doc,
  onSnapshot,
  setDoc,
  updateDoc,
  writeBatch,
  getDocs,
  addDoc,
  deleteDoc,
  getDoc,
} from "https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js";

// ==================== Firebase Configuration ====================
const firebaseConfig = {
  apiKey: "AIzaSyCHpkIlf8A13cL6TLggr7-3u8FM-PxzfSY",
  authDomain: "activitiescommittee-5b22c.firebaseapp.com",
  projectId: "activitiescommittee-5b22c",
  storageBucket: "activitiescommittee-5b22c.firebasestorage.app",
  messagingSenderId: "378991885059",
  appId: "1:378991885059:web:d8db039a6fc569fffb8736",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// ==================== Firestore refs (we store under collection root for clarity) ====================
const TOURNAMENT_ID = "default";
const teamsRef = collection(db, "tournaments", TOURNAMENT_ID, "teams");
const matchesRef = collection(db, "tournaments", TOURNAMENT_ID, "matches");
const groupsRef = collection(db, "tournaments", TOURNAMENT_ID, "groups");
const knockoutRef = doc(db, "tournaments", TOURNAMENT_ID, "knockout", "main");

// ==================== Local STATE ====================
let STATE = {
  teams: [],
  groups: [],
  groupMatches: [],
  knockout: null,
};

let dataReady = {
  teams: false,
  groups: false,
  matches: false,
  knockout: false,
};

// ==================== Small helpers ====================
const $ = (id) => document.getElementById(id);

function sanitizeId(name) {
  return encodeURIComponent(String(name));
}

function scrollToElement(id) {
  const el = document.getElementById(id);
  if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
}

function computeGroups(numTeams, perOpt) {
  if (perOpt && perOpt >= 2) return Math.max(1, Math.ceil(numTeams / perOpt));
  let g = Math.round(Math.sqrt(numTeams));
  if (g < 2) g = 2;
  while (Math.ceil(numTeams / g) < 2) g--;
  while (g > numTeams) g = numTeams;
  return g;
}

// ==================== Login / Role Control ====================
const PASSWORD = "123";
let CURRENT_ROLE = null;

const loginWrap = $("loginWrap");
const appContainer = $("appContainer");
const btnViewer = $("btnViewer");
const btnAdminShow = $("btnAdminShow");
const passRow = $("passRow");
const adminPass = $("adminPass");
const btnAdmin = $("btnAdmin");

btnViewer.addEventListener("click", () => {
  CURRENT_ROLE = "viewer";
  enterAsViewer();
});

btnAdminShow.addEventListener("click", () => {
  passRow.style.display =
    passRow.style.display === "flex" || passRow.style.display === "block"
      ? "none"
      : "flex";
  if (passRow.style.display === "flex") {
    adminPass.focus();
  }
});

btnAdmin.addEventListener("click", () => {
  const v = adminPass.value || "";
  if (v === PASSWORD) {
    CURRENT_ROLE = "admin";
    enterAsAdmin();
  } else {
    alert("كلمة السر خاطئة.");
    adminPass.value = "";
    adminPass.focus();
  }
});

adminPass.addEventListener("keyup", (e) => {
  if (e.key === "Enter") btnAdmin.click();
});

function enterAsViewer() {
  loginWrap.classList.add("hidden");
  appContainer.classList.remove("hidden");
  applyViewerMode();
  const dashBtn = document.querySelector('[data-tab="tab-dashboard"]');
  if (dashBtn) dashBtn.click();
}

function enterAsAdmin() {
  loginWrap.classList.add("hidden");
  appContainer.classList.remove("hidden");
  applyAdminMode();
  const groupsBtn = document.querySelector('[data-tab="tab-groups"]');
  if (groupsBtn) groupsBtn.click();
}

function applyViewerMode() {
  document.querySelectorAll(".navtabs .tabbtn").forEach((btn) => {
    if (btn.dataset.tab !== "tab-dashboard") btn.style.display = "none";
    else btn.style.display = "inline-flex";
  });

  document
    .querySelectorAll(".actions button")
    .forEach((b) => (b.style.display = "none"));

  document.querySelectorAll("button.primary, button.ghost").forEach((b) => {
    b.dataset._origDisplay = b.style.display || "";
    b.style.pointerEvents = "none";
    b.style.opacity = "0.6";
  });

  document
    .querySelectorAll(".tabcontent")
    .forEach((tc) => tc.classList.remove("active"));
  const tb = $("tab-dashboard");
  if (tb) tb.classList.add("active");

  if (typeof renderDashboard === "function") renderDashboard();
}

function applyAdminMode() {
  document
    .querySelectorAll(".navtabs .tabbtn")
    .forEach((btn) => (btn.style.display = "inline-flex"));

  const actions = document.querySelector(".actions");
  if (actions) actions.style.display = "flex";

  const sb = $("saveBtn");
  const lb = $("loadBtn");
  if (sb) sb.style.display = "inline-block";
  if (lb) lb.style.display = "inline-block";

  document
    .querySelectorAll(".actions button:not(#saveBtn):not(#loadBtn)")
    .forEach((b) => (b.style.display = "inline-flex"));

  document.querySelectorAll("button.primary, button.ghost").forEach((b) => {
    b.style.pointerEvents = "";
    b.style.opacity = "";
  });

  if (typeof renderGroupsOverview === "function") renderGroupsOverview();
  if (typeof renderDashboard === "function") renderDashboard();
}

// ==================== Tabs switching ====================
document.querySelectorAll(".tabbtn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document
      .querySelectorAll(".tabbtn")
      .forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    const tab = btn.dataset.tab;
    document
      .querySelectorAll(".tabcontent")
      .forEach((tc) => tc.classList.remove("active"));
    const el = document.getElementById(tab);
    if (el) el.classList.add("active");
    if (tab === "tab-bracket") renderBracketArea();
    if (tab === "tab-dashboard") renderDashboard();
  });
});

// ==================== State-save/load (local fallback) ====================

const STORAGE_KEY = "tournament.state.v1";

function localSave() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(STATE));
  } catch (e) {}
}
function localLoad() {
  try {
    const s = localStorage.getItem(STORAGE_KEY);
    if (!s) return false;
    STATE = JSON.parse(s);
    return true;
  } catch (e) {
    return false;
  }
}

// ==================== Core logic from original (groups, schedule, renderers) ====================

function scheduleAllGroupMatches() {
  STATE.groupMatches = STATE.groupMatches || [];
  STATE.groupMatches = [];
  let id = 1;
  (STATE.groups || []).forEach((grp, gi) => {
    for (let i = 0; i < (grp || []).length; i++) {
      for (let j = i + 1; j < (grp || []).length; j++) {
        STATE.groupMatches.push({
          id: id++,
          group: gi,
          home: grp[i],
          away: grp[j],
          hg: 0,
          ag: 0,
          finished: false,
        });
      }
    }
  });
}

// ==================== UI: Create groups flow (uses same IDs as your HTML) ====================
const btnCreate = $("btnCreate");
if (btnCreate)
  btnCreate.onclick = () => {
    const total = Math.max(2, parseInt($("inputTotal").value || 0));
    const per = parseInt($("inputPerGroup").value || 0) || null;
    const groupsCount = computeGroups(total, per);
    STATE = {
      teams: [],
      groups: Array.from({ length: groupsCount }, () => []),
      groupMatches: [],
      knockout: null,
    };
    localSave();
    $("teamsInputCard").style.display = "block";
    $("groupsOverview").style.display = "none";
    $("groupDetails").style.display = "none";
    const an = $("assignNote");
    if (an)
      an.textContent = `تم إنشاء ${groupsCount} مجموعات – الآن أدخل ${total} أسماء.`;
    scrollToElement("teamsInputCard");
  };

const btnDemo = $("btnDemo");
if (btnDemo)
  btnDemo.onclick = () => {
    $("inputTotal").value = 16;
    $("teamsText").value = `الأهلي
الزمالك
بيراميدز
سموحة
المصري
انبي
المقاولون
الاتحاد
الاتحاد السكندري
الإسماعيلي
طلائع الجيش
مصر المقاصة
حرس الحدود
فريق أ
فريق ب
فريق ج`;
    $("teamsInputCard").style.display = "block";
    const an = $("assignNote");
    if (an) an.textContent = "ملأ تجريبي – اضغط توزيع تلقائي";
  };

// ==================== Assign Teams (auto/manual) but now write to Firestore and also update UI immediately ====================
const btnAutoAssign = $("btnAutoAssign");
if (btnAutoAssign)
  btnAutoAssign.onclick = async () => {
    const txt = ($("teamsText").value || "").trim();
    if (!txt) return alert("أدخل أسماء الفرق.");
    const names = txt
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
    const totalDeclared = parseInt($("inputTotal").value) || names.length;

    if (names.length !== totalDeclared) {
      if (
        !confirm(
          `عدد الأسطر (${names.length}) لا يساوي العدد المدخل (${totalDeclared}). الاستمرار مع ${names.length}؟`
        )
      )
        return;
    }

    const groupsCount =
      STATE.groups.length || computeGroups(names.length, null);

    STATE.teams = names.map((n) => ({
      name: n,
      group: null,
      played: 0,
      win: 0,
      draw: 0,
      loss: 0,
      gf: 0,
      ga: 0,
      pts: 0,
    }));

    let idx = 0;
    STATE.groups = Array.from({ length: groupsCount }, () => []);
    STATE.teams.forEach((t) => {
      const g = idx % groupsCount;
      STATE.groups[g].push(t.name);
      t.group = g;
      idx++;
    });

    scheduleAllGroupMatches();

    dataReady = {
      teams: false,
      groups: false,
      matches: false,
      knockout: false,
    };

    try {
      const batch = writeBatch(db);

      const existingTeams = await getDocs(teamsRef);
      existingTeams.forEach((d) => batch.delete(doc(teamsRef, d.id)));
      const existingGroups = await getDocs(groupsRef);
      existingGroups.forEach((d) => batch.delete(doc(groupsRef, d.id)));
      const existingMatches = await getDocs(matchesRef);
      existingMatches.forEach((d) => batch.delete(doc(matchesRef, d.id)));

      batch.set(knockoutRef, { rounds: [] });

      STATE.teams.forEach((team) => {
        const teamDocRef = doc(teamsRef, sanitizeId(team.name));
        batch.set(teamDocRef, team);
      });

      STATE.groups.forEach((teamNames, index) => {
        const groupDocRef = doc(groupsRef, `group_${index}`);
        batch.set(groupDocRef, { index: index, teams: teamNames });
      });

      STATE.groupMatches.forEach((match) => {
        const matchDocRef = doc(matchesRef, `match_${match.id}`);
        batch.set(matchDocRef, match);
      });

      await batch.commit();
    } catch (e) {
      console.error("Error writing batch to Firestore:", e);
      alert("حدث خطأ أثناء حفظ المجموعات والفرق.");
      return;
    }

    $("teamsInputCard").style.display = "none";
    $("groupsOverview").style.display = "block";
    $("groupDetails").style.display = "none";
    renderGroupsOverview();

    if (STATE.groups && STATE.groups.length > 0) showGroupDetails(0);
    scrollToElement("groupsOverview");
  };

const btnManualAssign = $("btnManualAssign");
if (btnManualAssign)
  btnManualAssign.onclick = async () => {
    const txt = ($("teamsText").value || "").trim();
    if (!txt) return alert("أدخل أسماء الفرق.");
    const names = txt
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);

    STATE.teams = names.map((n) => ({
      name: n,
      group: null,
      played: 0,
      win: 0,
      draw: 0,
      loss: 0,
      gf: 0,
      ga: 0,
      pts: 0,
    }));
    STATE.groups = Array.from(
      { length: STATE.groups.length || computeGroups(names.length, null) },
      () => []
    );

    let remaining = [...STATE.teams.map((t) => t.name)];
    for (const name of [...remaining]) {
      let g = prompt(
        `أدخل رقم المجموعة (1..${STATE.groups.length}) لإضافة الفريق "${name}" أو اترك فارغ للتخطي:`
      );
      if (g === null) break;
      g = g.trim();
      if (!g) continue;
      const gi = parseInt(g) - 1;
      if (isNaN(gi) || gi < 0 || gi >= STATE.groups.length) {
        alert("رقم مجموعة غير صحيح");
        continue;
      }
      STATE.groups[gi].push(name);
      STATE.teams.find((t) => t.name === name).group = gi;
    }

    scheduleAllGroupMatches();
    dataReady = {
      teams: false,
      groups: false,
      matches: false,
      knockout: false,
    };

    try {
      const batch = writeBatch(db);

      const existingTeams = await getDocs(teamsRef);
      existingTeams.forEach((d) => batch.delete(doc(teamsRef, d.id)));
      const existingGroups = await getDocs(groupsRef);
      existingGroups.forEach((d) => batch.delete(doc(groupsRef, d.id)));
      const existingMatches = await getDocs(matchesRef);
      existingMatches.forEach((d) => batch.delete(doc(matchesRef, d.id)));

      STATE.teams.forEach((team) => {
        const teamDocRef = doc(teamsRef, sanitizeId(team.name));
        batch.set(teamDocRef, team);
      });

      STATE.groups.forEach((teamNames, index) => {
        const groupDocRef = doc(groupsRef, `group_${index}`);
        batch.set(groupDocRef, { index: index, teams: teamNames });
      });

      STATE.groupMatches.forEach((match) => {
        const matchDocRef = doc(matchesRef, `match_${match.id}`);
        batch.set(matchDocRef, match);
      });

      batch.set(knockoutRef, { rounds: [] });

      await batch.commit();
    } catch (e) {
      console.error("Error writing batch to Firestore:", e);
      alert("حدث خطأ أثناء حفظ المجموعات والفرق.");
      return;
    }

    $("teamsInputCard").style.display = "none";
    $("groupsOverview").style.display = "block";
    renderGroupsOverview();
    if (STATE.groups && STATE.groups.length > 0) showGroupDetails(0);
    scrollToElement("groupsOverview");
  };

// ==================== Groups Management & UI ====================
function renderGroupsOverview() {
  const list = $("groupsList");
  if (!list) return;
  list.innerHTML = "";
  if (!STATE.groups || STATE.groups.length === 0) {
    return;
  }
  STATE.groups.forEach((g, i) => {
    const div = document.createElement("div");
    div.className = "group-card";
    div.innerHTML = `<strong>المجموعة ${String.fromCharCode(
      65 + i
    )}</strong><div class="small muted">${(g || []).length} فريق</div>`;
    div.onclick = () => showGroupDetails(i);
    list.appendChild(div);
  });
}

function showGroupDetails(gi) {
  const teams = STATE.groups[gi] || [];
  $("groupTitle").textContent = `المجموعة ${String.fromCharCode(65 + gi)}`;
  $("groupTeamsLine").textContent = teams.join(" – ") || "لا توجد فرق";

  const matchesDiv = $("groupMatches");
  matchesDiv.innerHTML = "";
  const matches = (STATE.groupMatches || []).filter((m) => m.group === gi);

  if (matches.length === 0) {
    matchesDiv.innerHTML =
      '<div class="small muted">لا توجد مباريات مجدولة.</div>';
  }

  matches.forEach((m) => {
    const d = document.createElement("div");
    d.className = "match";
    d.innerHTML = `<div class="teams">${
      m.home
    } <span style="opacity:0.6">vs</span> ${m.away}</div>
                   <div>
                     ${
                       m.finished
                         ? `<span class="small muted">${m.hg} - ${m.ag}</span>`
                         : `<button class="primary inline" data-id="${m.id}">إنهاء الماتش</button>`
                     }
                     <button class="ghost inline" data-edit="${
                       m.id
                     }">تعديل</button>
                   </div>`;
    matchesDiv.appendChild(d);
  });

  // wire up buttons
  matchesDiv.querySelectorAll("button.primary").forEach((b) => {
    b.onclick = () => {
      const id = parseInt(b.dataset.id);
      endGroupMatch(id);
    };
  });

  matchesDiv.querySelectorAll("button.ghost").forEach((b) => {
    b.onclick = () => {
      const id = parseInt(b.dataset.edit);
      editMatchTeams(id);
    };
  });

  renderGroupTable(gi);
  $("groupDetails").style.display = "block";
  scrollToElement("groupDetails");
}

async function endGroupMatch(matchId) {
  const m = STATE.groupMatches.find((x) => x.id === matchId);
  if (!m) return alert("مباراة غير موجودة");

  const hg = prompt(`أهداف ${m.home}:`, m.hg || 0);
  if (hg === null) return;
  const ag = prompt(`أهداف ${m.away}:`, m.ag || 0);
  if (ag === null) return;

  m.hg = parseInt(hg) || 0;
  m.ag = parseInt(ag) || 0;
  m.finished = true;

  try {
    const matchDocRef = doc(matchesRef, `match_${matchId}`);
    await updateDoc(matchDocRef, { hg: m.hg, ag: m.ag, finished: true });
  } catch (e) {
    console.error("Error updating match doc:", e);
  }

  recomputeTeamsFromMatches();
  await updateTeamStatsFromMatches();

  showGroupDetails(m.group);
  renderDashboard();
}

// edit match teams
async function editMatchTeams(matchId) {
  const m = STATE.groupMatches.find((x) => x.id === matchId);
  if (!m) return alert("مباراة غير موجودة");

  const h = prompt("اسم الفريق الأول:", m.home || "");
  const a = prompt("اسم الفريق الثاني:", m.away || "");
  if (h === null || a === null) return;

  m.home = h.trim() || m.home;
  m.away = a.trim() || m.away;

  try {
    const matchDocRef = doc(matchesRef, `match_${matchId}`);
    await updateDoc(matchDocRef, { home: m.home, away: m.away });
  } catch (e) {
    console.error("Error editing match teams:", e);
  }

  showGroupDetails(m.group);
}

// ==================== Stats recomputation (same logic) ====================
function findGroupOfTeam(name) {
  for (let i = 0; i < STATE.groups.length; i++) {
    if ((STATE.groups[i] || []).includes(name)) return i;
  }
  return null;
}

function recomputeTeamsFromMatches() {
  const names = new Set();
  (STATE.groups || []).forEach((g) => (g || []).forEach((n) => names.add(n)));
  (STATE.groupMatches || []).forEach((m) => {
    names.add(m.home);
    names.add(m.away);
  });

  STATE.teams = Array.from(names).map((n) => {
    const existing = (STATE.teams || []).find((t) => t.name === n);
    if (existing) {
      return {
        ...{
          name: n,
          played: 0,
          win: 0,
          draw: 0,
          loss: 0,
          gf: 0,
          ga: 0,
          pts: 0,
          group: existing.group ?? findGroupOfTeam(n),
        },
        ...existing,
        played: 0,
        win: 0,
        draw: 0,
        loss: 0,
        gf: 0,
        ga: 0,
        pts: 0,
      };
    }
    return {
      name: n,
      played: 0,
      win: 0,
      draw: 0,
      loss: 0,
      gf: 0,
      ga: 0,
      pts: 0,
      group: findGroupOfTeam(n),
    };
  });

  STATE.teams.forEach((t) => {
    t.played = 0;
    t.win = 0;
    t.draw = 0;
    t.loss = 0;
    t.gf = 0;
    t.ga = 0;
    t.pts = 0;
  });

  (STATE.groupMatches || [])
    .filter((m) => m.finished)
    .forEach((m) => {
      const H = STATE.teams.find((t) => t.name === m.home);
      const A = STATE.teams.find((t) => t.name === m.away);
      if (!H || !A) return;

      H.played++;
      A.played++;
      H.gf += m.hg;
      H.ga += m.ag;
      A.gf += m.ag;
      A.ga += m.hg;

      if (m.hg > m.ag) {
        H.win++;
        H.pts += 3;
        A.loss++;
      } else if (m.hg < m.ag) {
        A.win++;
        A.pts += 3;
        H.loss++;
      } else {
        H.draw++;
        A.draw++;
        H.pts++;
        A.pts++;
      }
    });

  if (STATE.knockout && STATE.knockout.rounds) {
    STATE.knockout.rounds
      .flat()
      .filter((s) => s && s.finished && s.home && s.away)
      .forEach((s) => {
        const H = STATE.teams.find((t) => t.name === s.home) || {
          name: s.home,
          played: 0,
          win: 0,
          draw: 0,
          loss: 0,
          gf: 0,
          ga: 0,
          pts: 0,
        };
        const A = STATE.teams.find((t) => t.name === s.away) || {
          name: s.away,
          played: 0,
          win: 0,
          draw: 0,
          loss: 0,
          gf: 0,
          ga: 0,
          pts: 0,
        };

        if (!STATE.teams.find((t) => t.name === s.home)) STATE.teams.push(H);
        if (!STATE.teams.find((t) => t.name === s.away)) STATE.teams.push(A);

        H.played++;
        A.played++;
        H.gf += s.hg;
        H.ga += s.ag;
        A.gf += s.ag;
        A.ga += s.hg;

        if (s.hg > s.ag) {
          H.win++;
          H.pts += 3;
          A.loss++;
        } else if (s.hg < s.ag) {
          A.win++;
          A.pts += 3;
          H.loss++;
        } else {
          H.draw++;
          A.draw++;
          H.pts++;
          A.pts++;
        }
      });
  }
}

// ==================== renderGroupTable ====================
function renderGroupTable(gi) {
  recomputeTeamsFromMatches();
  const tbody = document.querySelector("#groupTable tbody");
  if (!tbody) return;
  tbody.innerHTML = "";

  const groupNames = STATE.groups[gi] || [];
  const rows = STATE.teams
    .filter((t) => t.group === gi)
    .map((t) => ({ ...t, gd: t.gf - t.ga }));

  if (rows.length === 0 && groupNames.length > 0) {
    groupNames.forEach((n, idx) => {
      tbody.innerHTML += `<tr><td>${
        idx + 1
      }</td><td>${n}</td><td>0</td><td>0</td><td>0</td><td>0</td><td>0</td><td>0</td><td>0</td><td>0</td></tr>`;
    });
    return;
  }

  rows.sort(
    (a, b) =>
      b.pts - a.pts ||
      b.gd - a.gd ||
      b.gf - a.gf ||
      a.name.localeCompare(b.name)
  );

  rows.forEach((r, i) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${i + 1}</td><td>${r.name}</td><td>${
      r.played
    }</td><td>${r.win}</td><td>${r.draw}</td><td>${r.loss}</td><td>${
      r.gf
    }</td><td>${r.ga}</td><td>${r.gf - r.ga}</td><td>${r.pts}</td>`;
    tbody.appendChild(tr);
  });
}

// ==================== Bracket / knockout ====================
const btnBuildBracket = $("btnBuildBracket");
if (btnBuildBracket)
  btnBuildBracket.onclick = async () => {
    const qual = parseInt($("qualifyCount").value) || 1;
    recomputeTeamsFromMatches();
    const qualifiers = [];

    STATE.groups.forEach((grp, gi) => {
      const stats = (STATE.teams.filter((t) => t.group === gi) || []).slice();
      stats.sort(
        (a, b) => b.pts - a.pts || b.gf - b.ga - (a.gf - a.ga) || b.gf - a.gf
      );
      for (let i = 0; i < qual && i < stats.length; i++) {
        qualifiers.push(stats[i].name);
      }
    });

    if (qualifiers.length < 2) return alert("لا يوجد عدد كاف من المتأهلين.");

    buildKnockout(qualifiers);

    try {
      await setDoc(knockoutRef, {
        rounds: Object.fromEntries(
          (STATE.knockout?.rounds || []).map((r, i) => [`r${i}`, r])
        ),
      });

      const tabBtns = document.querySelectorAll(".tabbtn");
      tabBtns.forEach((b) => b.classList.remove("active"));
      const tabBtn = document.querySelector('[data-tab="tab-bracket"]');
      if (tabBtn) tabBtn.classList.add("active");

      document
        .querySelectorAll(".tabcontent")
        .forEach((tc) => tc.classList.remove("active"));
      const tabEl = document.getElementById("tab-bracket");
      if (tabEl) tabEl.classList.add("active");

      renderBracketArea();

      scrollToElement("tab-bracket");
    } catch (e) {
      console.error("Error writing knockout:", e);
    }
  };

function buildKnockout(qualifiers) {
  let n = qualifiers.length;
  let pow = 1;
  while (pow < n) pow *= 2;

  const slots = pow / 2;
  const rounds = [];
  const first = [];

  for (let i = 0; i < slots; i++) {
    const a = qualifiers[i] || null;
    const b = qualifiers[qualifiers.length - 1 - i] || null;
    first.push({
      home: a,
      away: b,
      hg: 0,
      ag: 0,
      finished: false,
      id: `r0s${i}`,
    });
  }

  rounds.push(first);
  let rem = slots / 2;
  let r = 1;

  while (rem >= 1) {
    rounds.push(
      Array.from({ length: rem }, (_, i) => ({
        home: null,
        away: null,
        hg: 0,
        ag: 0,
        finished: false,
        id: `r${r}s${i}`,
      }))
    );
    rem = Math.floor(rem / 2);
    r++;
  }

  STATE.knockout = { rounds };
}

function renderBracketArea() {
  const area = $("bracketArea");
  if (!area) return;
  area.innerHTML = "";

  if (!STATE.knockout || !STATE.knockout.rounds) {
    area.innerHTML =
      '<div class="small muted">لا توجد شجرة حالياً – أنشأ المتأهلين ثم اضغط بناء الشجرة.</div>';
    return;
  }

  const rounds = STATE.knockout.rounds;

  rounds.forEach((rnd, ri) => {
    const col = document.createElement("div");
    col.className = "bracket-col";
    const title = document.createElement("div");
    title.style.fontWeight = "700";
    title.textContent = ri === rounds.length - 1 ? "النهائي" : `دور ${ri + 1}`;
    col.appendChild(title);

    rnd.forEach((slot) => {
      const box = document.createElement("div");
      box.className = "slot";
      const h = slot.home || "—";
      const a = slot.away || "—";
      box.innerHTML = `<div class="team">${h}</div><div style="opacity:0.6;margin:6px 0">vs</div><div class="team">${a}</div>
        <div class="controls">
          <button class="primary" data-id="${slot.id}">إنهاء الماتش</button>
          <button class="ghost" data-edit="${slot.id}">تعديل</button>
        </div>`;
      col.appendChild(box);
    });

    area.appendChild(col);
  });

  area.querySelectorAll(".slot .primary").forEach((b) => {
    b.onclick = async () => {
      const id = b.dataset.id;
      const slot = findKnockoutSlotById(id);
      if (!slot) return alert("خطأ");
      if (!slot.home || !slot.away) return alert("حدد كلا الفريقين أولاً");

      const hg = prompt(`أهداف ${slot.home}:`, slot.hg || 0);
      if (hg === null) return;
      const ag = prompt(`أهداف ${slot.away}:`, slot.ag || 0);
      if (ag === null) return;

      slot.hg = parseInt(hg) || 0;
      slot.ag = parseInt(ag) || 0;
      slot.finished = true;

      try {
        await setDoc(knockoutRef, {
          rounds: Object.fromEntries(
            (STATE.knockout?.rounds || []).map((r, i) => [`r${i}`, r])
          ),
        });

        await updateTeamStatsFromMatches();

        const winner =
          slot.hg > slot.ag ? slot.home : slot.hg < slot.ag ? slot.away : null;
        if (winner) await advanceKnockout(slot.id, winner);

        renderBracketArea();
      } catch (e) {
        console.error("Error ending knockout match:", e);
      }
    };
  });

  area.querySelectorAll(".slot .ghost").forEach((b) => {
    b.onclick = async () => {
      const id = b.dataset.edit;
      const slot = findKnockoutSlotById(id);
      if (!slot) return;
      const h = prompt("اسم الفريق الأول:", slot.home || "");
      const a = prompt("اسم الفريق الثاني:", slot.away || "");
      if (h === null || a === null) return;
      slot.home = h.trim() || slot.home;
      slot.away = a.trim() || slot.away;
      try {
        await setDoc(knockoutRef, {
          rounds: Object.fromEntries(
            (STATE.knockout?.rounds || []).map((r, i) => [`r${i}`, r])
          ),
        });
      } catch (e) {
        console.error("Error editing knockout:", e);
      }
    };
  });
}

function findKnockoutSlotById(id) {
  if (!STATE.knockout) return null;
  for (const rnd of STATE.knockout.rounds) {
    for (const s of rnd) {
      if (s.id === id) return s;
    }
  }
  return null;
}

async function advanceKnockout(slotId, winner) {
  if (!STATE.knockout || !STATE.knockout.rounds) return;

  for (let r = 0; r < STATE.knockout.rounds.length; r++) {
    const idx = STATE.knockout.rounds[r].findIndex((s) => s.id === slotId);
    if (idx !== -1) {
      const nextRound = r + 1;

      if (nextRound < STATE.knockout.rounds.length) {
        const targetSlot =
          STATE.knockout.rounds[nextRound][Math.floor(idx / 2)];

        if (!targetSlot.home) targetSlot.home = winner;
        else if (!targetSlot.away) targetSlot.away = winner;
        else targetSlot.home = winner;

        try {
          await setDoc(knockoutRef, {
            rounds: Object.fromEntries(
              (STATE.knockout?.rounds || []).map((r, i) => [`r${i}`, r])
            ),
          });

          await updateTeamStatsFromMatches();

          renderBracketArea();
        } catch (e) {
          console.error("Error advancing knockout:", e);
        }
      } else {
        alert("🏆 الفائز النهائي هو: " + winner);
      }
      break;
    }
  }
}

// ==================== Dashboard rendering ====================
function renderDashboard() {
  recomputeTeamsFromMatches();

  const winnersBody = document.querySelector("#winnersTable tbody");
  if (winnersBody) winnersBody.innerHTML = "";

  const losersBody = document.querySelector("#losersTable tbody");
  if (losersBody) losersBody.innerHTML = "";

  const arr = STATE.teams.slice();
  const winners = arr
    .filter((t) => t.win > t.loss)
    .sort((a, b) => b.pts - a.pts);
  const losers = arr
    .filter((t) => t.loss > t.win)
    .sort((a, b) => b.loss - a.loss);

  winners.forEach((w) => {
    if (winnersBody)
      winnersBody.innerHTML += `<tr class="winner"><td>${w.name}</td><td>${w.win}</td><td>${w.pts}</td></tr>`;
  });

  losers.forEach((l) => {
    if (losersBody)
      losersBody.innerHTML += `<tr class="loser"><td>${l.name}</td><td>${l.loss}</td><td>${l.pts}</td></tr>`;
  });

  const groupsTables = $("groupsTables");
  if (!groupsTables) return;
  groupsTables.innerHTML = "";

  (STATE.groups || []).forEach((grp, gi) => {
    const box = document.createElement("div");
    box.style.minWidth = "320px";
    box.style.flex = "1";

    let rows = STATE.teams
      .filter((t) => t.group === gi)
      .map((t) => ({ ...t, gd: t.gf - t.ga }));

    if (rows.length === 0) {
      rows = (grp || []).map((n) => ({
        name: n,
        played: 0,
        win: 0,
        draw: 0,
        loss: 0,
        gf: 0,
        ga: 0,
        pts: 0,
        gd: 0,
      }));
    } else {
      rows.sort((a, b) => b.pts - a.pts || b.gd - a.gd || b.gf - a.gf);
    }

    box.innerHTML = `<div class="card"><h4 class="center">المجموعة ${String.fromCharCode(
      65 + gi
    )}</h4>
      <table><thead><tr><th>الفريق</th><th>نقاط</th><th>له</th><th>عليه</th><th>فرق</th></tr></thead>
      <tbody>${rows
        .map(
          (r) =>
            `<tr><td>${r.name}</td><td>${r.pts}</td><td>${r.gf}</td><td>${
              r.ga
            }</td><td>${r.gf - r.ga}</td></tr>`
        )
        .join("")}</tbody></table></div>`;

    groupsTables.appendChild(box);
  });
}

// ==================== Update team stats back to Firestore ====================
async function updateTeamStatsFromMatches() {
  recomputeTeamsFromMatches();
  try {
    const batch = writeBatch(db);
    STATE.teams.forEach((team) => {
      const tid = sanitizeId(team.name);
      const teamDocRef = doc(teamsRef, tid);

      batch.set(teamDocRef, {
        name: team.name,
        group: team.group,
        played: team.played,
        win: team.win,
        draw: team.draw,
        loss: team.loss,
        gf: team.gf,
        ga: team.ga,
        pts: team.pts,
      });
    });
    await batch.commit();
  } catch (e) {
    console.error("Error updating team stats:", e);
  }
}

// ==================== RenderAll wrapper ====================
function renderAll() {
  try {
    if (document.getElementById("groupsList")) renderGroupsOverview();
    if (
      document.getElementById("tab-bracket") &&
      document.getElementById("tab-bracket").classList.contains("active")
    )
      renderBracketArea();
    if (
      document.getElementById("tab-dashboard") &&
      document.getElementById("tab-dashboard").classList.contains("active")
    )
      renderDashboard();

    // Re-render active group details
    const groupTitleEl = $("groupTitle");
    if (groupTitleEl && $("groupDetails").style.display === "block") {
      const t = groupTitleEl.textContent || "";
      const match = t.match(/([A-Z])/);
      if (match) {
        const gi = match[1].charCodeAt(0) - 65;
        if (gi >= 0 && STATE.groups && gi < STATE.groups.length) {
          showGroupDetails(gi);
        } else {
          $("groupDetails").style.display = "none";
        }
      }
    }
  } catch (e) {
    console.error("renderAll error:", e);
  }
}

// ==================== Save / Load buttons (Admin) ====================
const saveBtnEl = $("saveBtn");
if (saveBtnEl)
  saveBtnEl.addEventListener("click", async () => {
    if (CURRENT_ROLE !== "admin") return alert("غير مصرح");

    try {
      const batch = writeBatch(db);

      STATE.teams.forEach((t) => {
        const teamRef = doc(teamsRef, sanitizeId(t.name));
        batch.set(teamRef, t, { merge: true });
      });

      STATE.groups.forEach((g, idx) => {
        const groupRef = doc(groupsRef, `group_${idx}`);
        batch.set(groupRef, { index: idx, teams: g }, { merge: true });
      });

      STATE.groupMatches.forEach((m) => {
        const matchRef = doc(matchesRef, `match_${m.id}`);
        batch.set(matchRef, m, { merge: true });
      });

      if (STATE.knockout) {
        const knockoutData = {
          rounds: Object.fromEntries(
            (STATE.knockout.rounds || []).map((r, i) => [`r${i}`, r])
          ),
        };
        batch.set(knockoutRef, knockoutData, { merge: true });
      }

      await batch.commit();
      alert("✅تم الحفظ بنجاح ");
    } catch (e) {
      console.error("Save error:", e);
      alert("⚠️ حدث خطأ أثناء الحفظ");
    }
  });

const loadBtnEl = $("loadBtn");
if (loadBtnEl)
  loadBtnEl.addEventListener("click", async () => {
    if (CURRENT_ROLE !== "admin") return alert("غير مصرح");
    try {
      const [teamsSnap, groupsSnap, matchesSnap, knockoutSnap] =
        await Promise.all([
          getDocs(teamsRef),
          getDocs(groupsRef),
          getDocs(matchesRef),
          getDoc(knockoutRef),
        ]);

      STATE.teams = teamsSnap.docs.map((d) => d.data());
      const groupsArr = groupsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
      groupsArr.sort((a, b) => (a.index || 0) - (b.index || 0));
      STATE.groups = groupsArr.map((g) => g.teams || []);
      STATE.groupMatches = matchesSnap.docs.map((d) => d.data());
      const kdoc = knockoutSnap.exists() ? knockoutSnap.data() : null;
      if (kdoc && kdoc.rounds && !Array.isArray(kdoc.rounds)) {
        STATE.knockout = {
          rounds: Object.values(kdoc.rounds),
        };
      } else {
        STATE.knockout = kdoc;
      }

      renderAll();
      alert("✅ تم التحميل");
    } catch (e) {
      console.error("Load error:", e);
      alert("خطأ أثناء الاسترجاع");
    }
  });
// ==================== Reset button (مسح كل البيانات) ====================
const resetBtnEl = $("resetBtn");
if (resetBtnEl)
  resetBtnEl.addEventListener("click", async () => {
    if (CURRENT_ROLE !== "admin") return alert("غير مصرح");
    const sure = confirm("⚠️ هل أنت متأكد أنك تريد مسح كل البيانات؟");
    if (!sure) return;

    try {
      const [teamsSnap, groupsSnap, matchesSnap] = await Promise.all([
        getDocs(teamsRef),
        getDocs(groupsRef),
        getDocs(matchesRef),
      ]);

      const batch = writeBatch(db);
      teamsSnap.forEach((d) => batch.delete(doc(teamsRef, d.id)));
      groupsSnap.forEach((d) => batch.delete(doc(groupsRef, d.id)));
      matchesSnap.forEach((d) => batch.delete(doc(matchesRef, d.id)));
      batch.delete(knockoutRef);

      await batch.commit();

      STATE = {
        teams: [],
        groups: [],
        groupMatches: [],
        knockout: null,
      };

      renderAll();
      alert("🗑️ تم مسح كل البيانات بنجاح!");
    } catch (e) {
      console.error("Reset error:", e);
      alert("⚠️ حدث خطأ أثناء المسح");
    }
  });

// ==================== Firestore listeners (real-time sync) ====================

onSnapshot(teamsRef, (snapshot) => {
  STATE.teams = [];
  snapshot.forEach((d) => {
    const data = d.data();

    if (!data.name) data.name = decodeURIComponent(d.id);
    STATE.teams.push(data);
  });
  dataReady.teams = true;
  tryRender();
});

onSnapshot(groupsRef, (snapshot) => {
  const groups = [];
  snapshot.forEach((d) => {
    const data = d.data();
    groups.push(data.teams || []);
  });

  const docs = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
  docs.sort((a, b) => (a.index || 0) - (b.index || 0));
  STATE.groups = docs.map((g) => g.teams || []);
  dataReady.groups = true;
  tryRender();
});

onSnapshot(matchesRef, (snapshot) => {
  const arr = [];
  snapshot.forEach((d) => {
    const data = d.data();
    if (!data.id) {
      // try parse from id name match_#
      const m = d.id.match(/match_(\d+)/);
      if (m) data.id = parseInt(m[1], 10);
    }
    arr.push(data);
  });
  arr.sort((a, b) => (a.id || 0) - (b.id || 0));
  STATE.groupMatches = arr;
  dataReady.matches = true;
  tryRender();
});

onSnapshot(knockoutRef, (snap) => {
  if (snap.exists() && snap.data().rounds) {
    const data = snap.data();
    STATE.knockout = {
      rounds: Array.isArray(data.rounds)
        ? data.rounds
        : Object.values(data.rounds),
    };
  } else {
    STATE.knockout = null;
  }
  dataReady.knockout = true;
  renderBracketArea();

  tryRender();
});

function tryRender() {
  if (
    dataReady.teams &&
    dataReady.groups &&
    dataReady.matches &&
    dataReady.knockout
  ) {
    recomputeTeamsFromMatches();
    renderAll();
  } else {
    renderAll();
  }
}

// ==================== Init: if no data at all, create empty baseline doc(s) ====================
setTimeout(async () => {
  if (
    !dataReady.teams &&
    !dataReady.groups &&
    !dataReady.matches &&
    !dataReady.knockout
  ) {
    try {
      const g0 = doc(groupsRef, "group_0");
      await setDoc(g0, { index: 0, teams: [] });
      await setDoc(knockoutRef, { rounds: [] });
    } catch (e) {
      console.error("Initialization error:", e);
    }
  }
}, 2000);

// ==================== Done ====================

window.addEventListener("load", async () => {
  try {
    const [teamsSnap, groupsSnap, matchesSnap, knockoutSnap] =
      await Promise.all([
        getDocs(teamsRef),
        getDocs(groupsRef),
        getDocs(matchesRef),
        getDoc(knockoutRef),
      ]);

    STATE.teams = teamsSnap.docs.map((d) => d.data());

    const groupsArr = groupsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
    groupsArr.sort((a, b) => (a.index || 0) - (b.index || 0));
    STATE.groups = groupsArr.map((g) => g.teams || []);

    STATE.groupMatches = matchesSnap.docs.map((d) => d.data());

    if (knockoutSnap.exists()) {
      const kd = knockoutSnap.data();
      // convert object->array if necessary
      if (
        kd.rounds &&
        typeof kd.rounds === "object" &&
        !Array.isArray(kd.rounds)
      ) {
        const keys = Object.keys(kd.rounds).sort();
        STATE.knockout = { rounds: keys.map((k) => kd.rounds[k]) };
      } else {
        STATE.knockout = kd;
      }
    } else {
      STATE.knockout = null;
    }

    $("teamsInputCard").style.display = "none";
    $("groupsOverview").style.display = "block";
    $("groupDetails").style.display = "block";

    if (STATE.groups && STATE.groups.length > 0) {
      renderGroupsOverview();
      showGroupDetails(0);
    }

    renderAll();
  } catch (e) {
    console.error("Error auto-loading data:", e);
  }
});


