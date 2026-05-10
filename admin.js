import { firebaseConfig } from "./firebase-config.js";
import { CATEGORIES, PLAYERS, TEAMS } from "./data.js";

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, setPersistence, browserLocalPersistence } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, serverTimestamp, collection, getDocs, deleteDoc } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

const firebaseApp = initializeApp(firebaseConfig);
const auth = getAuth(firebaseApp);
const db = getFirestore(firebaseApp);
let authReady = setPersistence(auth, browserLocalPersistence).catch((error) => {
  console.warn("Persistence Firebase impossible :", error);
});

const $ = (id) => document.getElementById(id);

const playerSearch = $("playerSearch");
const playersList = $("playersList");
const playersCount = $("playersCount");
const categorySearch = $("categorySearch");
const categoriesList = $("categoriesList");
const selectedTagsList = $("selectedTagsList");
const selectedPlayerName = $("selectedPlayerName");
const selectedPlayerId = $("selectedPlayerId");
const playerEditor = $("playerEditor");
const emptyEditor = $("emptyEditor");
const adminStatus = $("adminStatus");
const adminNote = $("adminNote");
const adminGate = $("adminGate");
const adminContent = $("adminContent");
const adminGoogleLoginBtn = $("adminGoogleLoginBtn");
const adminGateStatus = $("adminGateStatus");
const loadRankingAdminBtn = $("loadRankingAdminBtn");
const resetMonthlyRankingBtn = $("resetMonthlyRankingBtn");
const resetAllRankingBtn = $("resetAllRankingBtn");
const rankingAdminStatus = $("rankingAdminStatus");
const rankingAdminList = $("rankingAdminList");
const rankingAdminSearch = $("rankingAdminSearch");
const rankingAdminMonth = $("rankingAdminMonth");

let uid = null;
let playerOverrides = {};
let selectedPlayer = null;
let editedTags = [];
let editedNote = "";
let rankingResults = [];
let rankingSelectedMonth = getCurrentMonthKey();

const categoriesByTag = buildCategoriesByTag();

onAuthStateChanged(auth, async (user) => {
  uid = user?.uid || null;

  if (!user || user.isAnonymous) {
    showAdminGate("Connecte-toi avec Google pour accéder à la base admin.", "bad");
    return;
  }

  const allowed = await checkIsAdmin(user.uid);
  if (!allowed) {
    showAdminGate("Ce compte Google n'est pas autorisé comme admin.", "bad");
    return;
  }

  adminGate?.classList.add("hidden");
  adminContent?.classList.remove("hidden");
  await loadOverrides();
});

adminGoogleLoginBtn?.addEventListener("click", async () => {
  try {
    await authReady;
    const provider = new GoogleAuthProvider();
    await signInWithPopup(auth, provider);
  } catch (error) {
    showAdminGate("Connexion Google impossible : " + error.message, "bad");
  }
});


async function checkIsAdmin(userId) {
  if (!userId) return false;

  try {
    const snap = await getDoc(doc(db, "admins", userId));
    return snap.exists();
  } catch (error) {
    console.warn("Vérification admin impossible :", error);
    return false;
  }
}

function showAdminGate(message, variant = "") {
  adminGate?.classList.remove("hidden");
  adminContent?.classList.add("hidden");

  if (adminGateStatus) {
    adminGateStatus.textContent = message;
    adminGateStatus.className = `admin-status ${variant}`.trim();
  }

  setStatus(message, variant);
}


playerSearch.addEventListener("input", renderPlayersList);
categorySearch.addEventListener("input", renderCategoriesList);
$("reloadAdminBtn").addEventListener("click", loadOverrides);
$("savePlayerBtn").addEventListener("click", saveSelectedPlayer);
$("resetPlayerBtn").addEventListener("click", resetSelectedPlayer);
$("exportOverridesBtn").addEventListener("click", exportOverrides);
adminNote.addEventListener("input", () => {
  editedNote = adminNote.value;
});

loadRankingAdminBtn?.addEventListener("click", loadRankingAdmin);
rankingAdminSearch?.addEventListener("input", renderRankingAdmin);
rankingAdminMonth?.addEventListener("change", () => {
  rankingSelectedMonth = rankingAdminMonth.value || getCurrentMonthKey();
  renderRankingAdmin();
});
resetMonthlyRankingBtn?.addEventListener("click", resetMonthlyRanking);
resetAllRankingBtn?.addEventListener("click", resetAllRanking);

renderPlayersList();
renderCategoriesList();
playersCount.textContent = `${PLAYERS.length} joueurs · ${CATEGORIES.length} catégories`;

async function loadOverrides() {
  try {
    setStatus("Chargement des corrections Firebase…");
    const snap = await getDoc(doc(db, "admin", "database"));
    playerOverrides = snap.exists() ? (snap.data().playerOverrides || {}) : {};
    setStatus(`${Object.keys(playerOverrides).length} joueur(s) corrigé(s) dans Firebase.`, "good");
    renderPlayersList();
    if (selectedPlayer) selectPlayer(selectedPlayer.id);
  } catch (error) {
    setStatus("Impossible de charger les corrections : " + error.message, "bad");
  }
}

function renderPlayersList() {
  const query = normalize(playerSearch.value);
  const players = PLAYERS
    .filter((player) => normalize(player.name).includes(query) || String(player.id).includes(query))
    .slice(0, 80);

  playersList.innerHTML = players.map((player) => {
    const hasOverride = Boolean(playerOverrides[player.id]);
    return `
      <button class="admin-player-item ${selectedPlayer?.id === player.id ? "active" : ""}" data-player-id="${escapeHtml(player.id)}" type="button">
        <span class="admin-player-avatar">${escapeHtml(getInitials(player.name))}</span>
        <span class="admin-player-main">
          <strong>${escapeHtml(player.name)}</strong>
          <small>${escapeHtml(player.id)} · ${(playerOverrides[player.id]?.tags || player.tags || []).length} tags</small>
        </span>
        ${hasOverride ? `<span class="admin-edited-chip">EDIT</span>` : ""}
      </button>
    `;
  }).join("") || `<div class="admin-empty-list">Aucun joueur trouvé.</div>`;

  playersList.querySelectorAll(".admin-player-item").forEach((button) => {
    button.addEventListener("click", () => selectPlayer(button.dataset.playerId));
  });
}

function selectPlayer(playerId) {
  const player = PLAYERS.find((item) => item.id === playerId);
  if (!player) return;

  selectedPlayer = player;
  const override = playerOverrides[player.id];
  editedTags = [...new Set(override?.tags || player.tags || [])].sort();
  editedNote = override?.note || "";

  emptyEditor.classList.add("hidden");
  playerEditor.classList.remove("hidden");
  selectedPlayerName.textContent = player.name;
  selectedPlayerId.textContent = `ID : ${player.id}`;
  adminNote.value = editedNote;

  renderPlayersList();
  renderSelectedTags();
  renderCategoriesList();
}

function renderCategoriesList() {
  const query = normalize(categorySearch.value);
  const categories = CATEGORIES
    .filter((category) => {
      const haystack = normalize(`${category.title || ""} ${category.name || ""} ${category.kicker || ""} ${category.shortLabel || ""} ${category.id || ""}`);
      return haystack.includes(query);
    })
    .slice(0, 80);

  categoriesList.innerHTML = categories.map((category) => {
    const tags = category.tags || [];
    const alreadyHas = selectedPlayer && tags.every((tag) => editedTags.includes(tag));
    const visual = renderMiniVisual(category);
    return `
      <button class="admin-category-item ${alreadyHas ? "owned" : ""}" data-category-id="${escapeHtml(category.id)}" type="button" ${!selectedPlayer ? "disabled" : ""}>
        ${visual}
        <span>
          <strong>${escapeHtml(category.title || category.name || category.id)}</strong>
          <small>${escapeHtml(category.kicker || "Critère")} · ${escapeHtml((category.tags || []).join(" + "))}</small>
        </span>
        <em>${alreadyHas ? "OK" : "+"}</em>
      </button>
    `;
  }).join("") || `<div class="admin-empty-list">Aucun critère trouvé.</div>`;

  categoriesList.querySelectorAll(".admin-category-item").forEach((button) => {
    button.addEventListener("click", () => addCategoryToPlayer(button.dataset.categoryId));
  });
}

function renderSelectedTags() {
  if (!selectedPlayer) return;

  selectedTagsList.innerHTML = editedTags.map((tag) => {
    const label = getTagLabel(tag);
    return `
      <button class="admin-tag-chip" data-tag="${escapeHtml(tag)}" type="button" title="Retirer ce tag">
        <span>${escapeHtml(label)}</span>
        <small>${escapeHtml(tag)}</small>
        <strong>×</strong>
      </button>
    `;
  }).join("") || `<div class="admin-empty-list">Aucun tag sur ce joueur.</div>`;

  selectedTagsList.querySelectorAll(".admin-tag-chip").forEach((button) => {
    button.addEventListener("click", () => removeTag(button.dataset.tag));
  });
}

function addCategoryToPlayer(categoryId) {
  if (!selectedPlayer) return;
  const category = CATEGORIES.find((item) => item.id === categoryId);
  if (!category) return;

  editedTags = [...new Set([...editedTags, ...(category.tags || [])])].sort();
  renderSelectedTags();
  renderCategoriesList();
  setStatus(`Critère ajouté : ${category.title || category.name}`, "good");
}

function removeTag(tag) {
  editedTags = editedTags.filter((item) => item !== tag);
  renderSelectedTags();
  renderCategoriesList();
}

async function saveSelectedPlayer() {
  if (!selectedPlayer || !uid) return;

  const originalTags = [...(selectedPlayer.tags || [])].sort();
  const cleanEditedTags = [...new Set(editedTags)].sort();
  const isSameTags = JSON.stringify(originalTags) === JSON.stringify(cleanEditedTags);
  const cleanNote = adminNote.value.trim();

  if (isSameTags && !cleanNote) {
    delete playerOverrides[selectedPlayer.id];
  } else {
    playerOverrides[selectedPlayer.id] = {
      name: selectedPlayer.name,
      tags: cleanEditedTags,
      note: cleanNote,
      updatedBy: uid,
      updatedAtMs: Date.now()
    };
  }

  await persistOverrides();
  setStatus(`Corrections sauvegardées pour ${selectedPlayer.name}.`, "good");
  renderPlayersList();
}

async function resetSelectedPlayer() {
  if (!selectedPlayer) return;
  delete playerOverrides[selectedPlayer.id];
  editedTags = [...(selectedPlayer.tags || [])].sort();
  editedNote = "";
  adminNote.value = "";
  await persistOverrides();
  renderSelectedTags();
  renderCategoriesList();
  renderPlayersList();
  setStatus(`${selectedPlayer.name} remis à zéro.`, "good");
}

async function persistOverrides() {
  await setDoc(doc(db, "admin", "database"), {
    playerOverrides,
    updatedAt: serverTimestamp(),
    updatedAtMs: Date.now()
  }, { merge: true });
}

function exportOverrides() {
  const blob = new Blob([JSON.stringify({ playerOverrides }, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "bingo-kun-overrides.json";
  a.click();
  URL.revokeObjectURL(url);
}


async function loadRankingAdmin() {
  try {
    setRankingStatus("Chargement du classement…");
    const snap = await getDocs(collection(db, "results"));
    rankingResults = [];
    snap.forEach((docSnap) => rankingResults.push({ id: docSnap.id, ...docSnap.data() }));

    buildRankingMonthSelect();
    renderRankingAdmin();
    setRankingStatus(`${rankingResults.length} résultat(s) chargé(s).`, "good");
  } catch (error) {
    setRankingStatus("Impossible de charger le classement : " + error.message, "bad");
  }
}

function buildRankingMonthSelect() {
  if (!rankingAdminMonth) return;

  const months = [...new Set(rankingResults.map((result) => result.monthKey).filter(Boolean))].sort().reverse();
  const current = getCurrentMonthKey();
  if (!months.includes(current)) months.unshift(current);

  rankingAdminMonth.innerHTML = months.map((month) => {
    return `<option value="${escapeHtml(month)}">${escapeHtml(formatMonth(month))}</option>`;
  }).join("");

  if (!months.includes(rankingSelectedMonth)) rankingSelectedMonth = months[0] || current;
  rankingAdminMonth.value = rankingSelectedMonth;
}

function renderRankingAdmin() {
  if (!rankingAdminList) return;

  const query = normalize(rankingAdminSearch?.value || "");
  const rows = aggregateRankingAdmin(rankingResults)
    .filter((row) => !query || normalize(row.playerName).includes(query) || normalize(row.playerKey).includes(query))
    .sort((a, b) => {
      if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
      if (b.bestScore !== a.bestScore) return b.bestScore - a.bestScore;
      return b.games - a.games;
    });

  if (!rows.length) {
    rankingAdminList.innerHTML = `<div class="admin-empty-list">Aucun joueur trouvé dans le classement.</div>`;
    return;
  }

  rankingAdminList.innerHTML = rows.map((row, index) => {
    return `
      <div class="ranking-admin-row">
        <div>
          <strong>#${index + 1} ${escapeHtml(row.playerName)}</strong>
          <span>${row.games} résultat(s) · ${row.totalPoints} pts · best ${row.bestScore}/${row.scoreMax || 30}</span>
        </div>
        <div class="ranking-admin-row-actions">
          <button class="tiny-btn" type="button" data-delete-player="${escapeHtml(row.playerKey)}">Supprimer ce joueur</button>
        </div>
      </div>
    `;
  }).join("");

  rankingAdminList.querySelectorAll("[data-delete-player]").forEach((button) => {
    button.addEventListener("click", () => deleteRankingPlayer(button.dataset.deletePlayer));
  });
}

function aggregateRankingAdmin(results) {
  const month = rankingSelectedMonth;
  const filtered = results.filter((result) => !month || result.monthKey === month);
  const map = new Map();

  for (const result of filtered) {
    const key = result.playerKey || normalizePlayerKey(result.playerName);
    if (!map.has(key)) {
      map.set(key, {
        playerKey: key,
        playerName: result.playerName || "Joueur",
        games: 0,
        totalPoints: 0,
        bestScore: 0,
        scoreMax: Number(result.scoreMax || 30),
        resultIds: []
      });
    }

    const row = map.get(key);
    const score = Number(result.score ?? result.finalScore ?? 0);
    row.playerName = result.playerName || row.playerName;
    row.games += 1;
    row.totalPoints += Number(result.points || score || 0);
    row.bestScore = Math.max(row.bestScore, score);
    row.scoreMax = Number(result.scoreMax || row.scoreMax || 30);
    row.resultIds.push(result.id);
  }

  return [...map.values()];
}

async function deleteRankingPlayer(playerKey) {
  const row = aggregateRankingAdmin(rankingResults).find((item) => item.playerKey === playerKey);
  if (!row) return;

  const confirmation = confirm(
    `Supprimer ${row.playerName} du classement ${formatMonth(rankingSelectedMonth)} ?\n\n` +
    `${row.resultIds.length} résultat(s) seront supprimés.`
  );

  if (!confirmation) return;

  await deleteResultIds(row.resultIds);
  setRankingStatus(`${row.playerName} supprimé du classement ${formatMonth(rankingSelectedMonth)}.`, "good");
  await loadRankingAdmin();
}

async function resetMonthlyRanking() {
  const month = rankingSelectedMonth || getCurrentMonthKey();
  const ids = rankingResults.filter((result) => result.monthKey === month).map((result) => result.id);

  if (!ids.length) {
    setRankingStatus(`Aucun résultat à supprimer pour ${formatMonth(month)}.`, "bad");
    return;
  }

  const confirmation = confirm(
    `Réinitialiser le classement ${formatMonth(month)} ?\n\n` +
    `${ids.length} résultat(s) seront supprimés. Cette action est définitive.`
  );

  if (!confirmation) return;

  await deleteResultIds(ids);
  setRankingStatus(`Classement ${formatMonth(month)} réinitialisé.`, "good");
  await loadRankingAdmin();
}

async function resetAllRanking() {
  if (!rankingResults.length) {
    await loadRankingAdmin();
  }

  const ids = rankingResults.map((result) => result.id);

  if (!ids.length) {
    setRankingStatus("Aucun résultat à supprimer.", "bad");
    return;
  }

  const typed = prompt(
    `Tu vas supprimer TOUT le classement (${ids.length} résultat(s)).\n\n` +
    `Tape RESET pour confirmer.`
  );

  if (typed !== "RESET") {
    setRankingStatus("Reset total annulé.", "bad");
    return;
  }

  await deleteResultIds(ids);
  setRankingStatus("Classement total réinitialisé.", "good");
  await loadRankingAdmin();
}

async function deleteResultIds(ids = []) {
  const uniqueIds = [...new Set(ids)].filter(Boolean);

  for (const id of uniqueIds) {
    await deleteDoc(doc(db, "results", id));
  }

  rankingResults = rankingResults.filter((result) => !uniqueIds.includes(result.id));
  renderRankingAdmin();
}

function setRankingStatus(message, type = "") {
  if (!rankingAdminStatus) return;
  rankingAdminStatus.textContent = message;
  rankingAdminStatus.className = "admin-status";
  if (type) rankingAdminStatus.classList.add(type);
}

function normalizePlayerKey(name) {
  return String(name || "joueur")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "joueur";
}

function getCurrentMonthKey() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function formatMonth(monthKey) {
  const [year, month] = String(monthKey).split("-").map(Number);
  if (!year || !month) return monthKey;
  return new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric" }).format(new Date(year, month - 1, 1));
}


function buildCategoriesByTag() {
  const map = new Map();
  CATEGORIES.forEach((category) => {
    (category.tags || []).forEach((tag) => {
      if (!map.has(tag)) map.set(tag, []);
      map.get(tag).push(category);
    });
  });
  return map;
}

function getTagLabel(tag) {
  const team = TEAMS[tag];
  if (team) return team.name || team.short || tag;
  const categories = categoriesByTag.get(tag) || [];
  if (categories[0]) return categories[0].title || categories[0].name || tag;
  return tag;
}

function renderMiniVisual(category) {
  const first = Array.isArray(category.visuals) ? category.visuals[0] : null;
  const image = first?.image || category.image;
  const label = category.shortLabel || first?.shortLabel || "★";
  if (!image) return `<span class="admin-mini-visual">${escapeHtml(label)}</span>`;
  return `<span class="admin-mini-visual"><img src="${escapeHtml(image)}" alt="" /></span>`;
}

function setStatus(message, type = "") {
  adminStatus.textContent = message;
  adminStatus.className = "admin-status";
  if (type) adminStatus.classList.add(type);
}

function getInitials(name) {
  const parts = String(name || "?").split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function normalize(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function escapeHtml(text) {
  const element = document.createElement("div");
  element.textContent = String(text ?? "");
  return element.innerHTML;
}
