import { firebaseConfig } from "./firebase-config.js";
import { CATEGORIES, PLAYERS, TEAMS } from "./data.js";

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, setPersistence, browserLocalPersistence } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

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

let uid = null;
let playerOverrides = {};
let selectedPlayer = null;
let editedTags = [];
let editedNote = "";

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
