import { firebaseConfig } from "./firebase-config.js";
import { CATEGORIES, PLAYERS, TEAMS } from "./data.js";

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import {
  getAuth,
  signInAnonymously,
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  setPersistence,
  browserLocalPersistence
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp,
  collection,
  onSnapshot,
  runTransaction
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

const firebaseApp = initializeApp(firebaseConfig);
const auth = getAuth(firebaseApp);
const db = getFirestore(firebaseApp);
let authReady = setPersistence(auth, browserLocalPersistence).catch((error) => {
  console.warn("Persistence Firebase impossible :", error);
});

function clonePlayers(source) {
  return source.map((player) => ({
    ...player,
    tags: [...(player.tags || [])],
    logos: [...(player.logos || [])]
  }));
}

function cloneCategories(source) {
  return source.map((category) => ({
    ...category,
    tags: [...(category.tags || [])],
    sourceIds: [...(category.sourceIds || [])],
    visuals: Array.isArray(category.visuals)
      ? category.visuals.map((visual) => ({ ...visual }))
      : []
  }));
}

let ACTIVE_PLAYERS = clonePlayers(PLAYERS);
let ACTIVE_CATEGORIES = cloneCategories(CATEGORIES);
let databaseOverridesLoaded = false;

async function loadDatabaseOverrides(force = false) {
  if (databaseOverridesLoaded && !force) return;

  ACTIVE_PLAYERS = clonePlayers(PLAYERS);
  ACTIVE_CATEGORIES = cloneCategories(CATEGORIES);

  try {
    const snap = await getDoc(doc(db, "admin", "database"));
    if (snap.exists()) {
      const data = snap.data();
      const playerOverrides = data.playerOverrides || {};

      ACTIVE_PLAYERS = ACTIVE_PLAYERS.map((player) => {
        const override = playerOverrides[player.id];
        if (!override) return player;

        return {
          ...player,
          name: override.name || player.name,
          tags: Array.isArray(override.tags) ? [...new Set(override.tags)] : player.tags,
          adminNote: override.note || ""
        };
      });
    }
  } catch (error) {
    console.warn("Bingo Kun : impossible de charger les corrections admin.", error);
  }

  categoryMatchCache = new Map();
  databaseOverridesLoaded = true;
}

const BOARD_ROWS = 5;
const BOARD_COLS = 4;
const BOARD_SIZE = BOARD_ROWS * BOARD_COLS;
const AUTO_SECONDS = 15;
const MAX_DECK_PLAYERS = 75;
const MIN_PLAYABLE_PLAYERS = 70;
const MIN_PLAYERS_PER_CELL = 3;
const MAX_COMBO_CELLS = 6;

const $ = (id) => document.getElementById(id);

const setupView = $("setupView");
const waitingView = $("waitingView");
const gameView = $("gameView");
const topTimer = $("topTimer");
const roomPill = $("roomPill");
const roomCodeDisplay = $("roomCodeDisplay");
const waitingRoomCodeDisplay = $("waitingRoomCodeDisplay");
const waitingPlayersList = $("waitingPlayersList");
const waitingPlayerCount = $("waitingPlayerCount");
const waitingGridInfo = $("waitingGridInfo");
const waitingDeckInfo = $("waitingDeckInfo");
const waitingPlayableInfo = $("waitingPlayableInfo");
const startGameBtn = $("startGameBtn");
const waitingHostHint = $("waitingHostHint");
const playerNameInput = $("playerName");
const joinCodeInput = $("joinCode");
const adminLoginBtn = $("adminLoginBtn");
const adminLogoutBtn = $("adminLogoutBtn");
const adminAuthStatus = $("adminAuthStatus");
const adminHeaderLink = $("adminHeaderLink");
const creatorLockedNotice = $("creatorLockedNotice");
const createRoomBtn = $("createRoomBtn");
const presetModeSelect = $("presetMode");
const presetHelp = $("presetHelp");
const gridModeSelect = $("gridMode");
const customBuilder = $("customBuilder");
const customCountEl = $("customCount");
const customCategorySearch = $("customCategorySearch");
const customSelectedGrid = $("customSelectedGrid");
const customSearchResults = $("customSearchResults");
const customAutoBtn = $("customAutoBtn");
const customClearBtn = $("customClearBtn");
const boardEl = $("board");
const currentPlayerNameEl = $("currentPlayerName");
const currentPlayerInitialsEl = $("currentPlayerInitials");
const playerCounterBadgeEl = $("playerCounterBadge");
const currentPlayerSublineEl = $("currentPlayerSubline");
const playedPlayersListEl = $("playedPlayersList");
const globalTimerTextEl = $("globalTimerText");
const globalTimerBarEl = $("globalTimerBar");
const circleTimerTextEl = $("circleTimerText");
const nextPlayerBtn = $("nextPlayerBtn");
const gameMessageEl = $("gameMessage");
const myFilledEl = $("myFilled");
const playersRemainingEl = $("playersRemaining");
const hiddenResultBox = $("hiddenResultBox");
const finalResultBox = $("finalResultBox");
const myResultEl = $("myResult");
const myBingosEl = $("myBingos");
const leaderboardEl = $("leaderboard");
const scoreDisplayEl = $("scoreDisplay");
const scoreSublineEl = $("scoreSubline");
const compactScoreDisplayEl = $("compactScoreDisplay");
const liveBingosEl = $("liveBingos");
const myRankEl = $("myRank");
const myWrongEl = $("myWrong");
const myFinalRankEl = $("myFinalRank");
const myAccuracyEl = $("myAccuracy");
const finishOverlay = $("finishOverlay");
const finishTitleEl = $("finishTitle");
const finishSubtitleEl = $("finishSubtitle");
const finishScoreEl = $("finishScore");
const finishBingosEl = $("finishBingos");
const finishWrongEl = $("finishWrong");
const finishAccuracyEl = $("finishAccuracy");
const finishRankEl = $("finishRank");
const finishTotalPlayersEl = $("finishTotalPlayers");
const finishRecapStatsEl = $("finishRecapStats");
const finishRecapListEl = $("finishRecapList");
const closeFinishOverlayBtn = $("closeFinishOverlayBtn");
const copyFinishRoomBtn = $("copyFinishRoomBtn");

let uid = null;
let isAdminUser = false;
let selectedPreset = "global-normal";
let currentRoomCode = null;
let roomData = null;
let myData = null;
let participantsData = [];

let unsubscribeRoom = null;
let unsubscribeMe = null;
let unsubscribePlayers = null;
let clockInterval = null;
let playerAutoInterval = null;
let hasShownFinishOverlay = false;
let customSelectedCategoryIds = [];
let customSearchTimer = null;
let categoryMatchCache = new Map();
let savingResult = false;

const savedName = localStorage.getItem("bingo-kun-name");
if (savedName) playerNameInput.value = savedName;


const PRESET_CONFIGS = {
  "global-easy": {
    playerMinScore: 7,
    allowedTypes: [1, 2, 3, 6],
    categoryIds: [],
    excludeTypes: [4, 5],
    requireTags: ["cat_331","cat_332","cat_333","cat_334","cat_335","cat_354","cat_355","cat_356","cat_357","cat_425","cat_426","cat_427","cat_564","cat_160","cat_112","cat_204","cat_93","cat_84","cat_83","cat_179","cat_172","cat_133","cat_167"]
  },
  "global-normal": {
    playerMinScore: 4,
    allowedTypes: [1, 2, 3, 6, 8],
    categoryIds: [],
    excludeTypes: [4, 5],
    requireTags: ["cat_83","cat_84","cat_86","cat_93","cat_99","cat_112","cat_129","cat_133","cat_160","cat_167","cat_172","cat_176","cat_179","cat_204","cat_215","cat_262","cat_331","cat_332","cat_333","cat_334","cat_335","cat_354","cat_355","cat_356","cat_357","cat_425","cat_426","cat_427","cat_547","cat_550","cat_564","cat_607","cat_608","cat_609"]
  },
  "global-hard": {
    playerMinScore: 2,
    allowedTypes: [1, 2, 3, 4, 5, 6, 8],
    categoryIds: [],
    excludeTypes: [],
    requireTags: []
  },
  "ligue1": {
    playerMinScore: 1,
    allowedTypes: [1, 2, 3, 6, 8],
    // Note : dans la BDD source, certains clubs L1 existent mais n'ont aucun joueur taggé.
    // On garde donc une sélection L1 jouable : clubs L1 disponibles + championnats/nations/trophées/spéciaux liés aux joueurs passés en L1.
    categoryIds: [
      "cat_172","cat_215","cat_117",
      "cat_611","cat_606","cat_607","cat_608","cat_609","cat_610","cat_601","cat_602","cat_600",
      "cat_3","cat_6","cat_5","cat_13","cat_18","cat_8","cat_11","cat_12","cat_400","cat_403",
      "cat_354","cat_355","cat_356","cat_425","cat_426","cat_564",
      "cat_547","cat_550","cat_568","cat_567","cat_569"
    ],
    excludeTypes: [4, 5],
    requireTags: ["cat_172","cat_215","cat_117","cat_606","cat_611"]
  },
  "premierleague": {
    playerMinScore: 1,
    allowedTypes: [1, 2, 3, 6, 8],
    categoryIds: ["cat_84","cat_92","cat_93","cat_114","cat_133","cat_149","cat_179","cat_191","cat_204","cat_207","cat_1","cat_3","cat_5","cat_6","cat_13","cat_400","cat_403","cat_331","cat_332","cat_333","cat_354","cat_355","cat_356","cat_425","cat_426","cat_547","cat_550","cat_607"],
    excludeTypes: [4, 5],
    requireTags: ["cat_84","cat_92","cat_93","cat_114","cat_133","cat_149","cat_179","cat_191","cat_204","cat_207","cat_607","cat_331","cat_332","cat_333"]
  }
};

function getPresetConfig(preset = selectedPreset) {
  return PRESET_CONFIGS[preset] || PRESET_CONFIGS["global-normal"];
}

function getCategoryType(category) {
  const team = TEAMS[category.logo] || TEAMS[category.id];
  if (team?.type) return Number(team.type);

  const visualType = category.visualType || category.visuals?.[0]?.visualType || "";
  const map = { flag: 1, club: 2, league: 3, coach: 4, player: 5, trophy: 6, special: 8 };
  return map[visualType] || 0;
}

function getPlayerWeight(player) {
  const tags = player.tags || [];
  let score = 0;

  const bigClubs = ["cat_83","cat_84","cat_86","cat_93","cat_99","cat_112","cat_129","cat_133","cat_160","cat_167","cat_172","cat_176","cat_179","cat_204","cat_215","cat_262"];
  const bigTrophies = ["cat_331","cat_332","cat_333","cat_334","cat_335","cat_354","cat_355","cat_356","cat_357","cat_425","cat_426","cat_427","cat_564"];
  const bigLeagues = ["cat_607","cat_608","cat_609","cat_610","cat_611","cat_598","cat_599","cat_600","cat_601","cat_602","cat_603","cat_604","cat_606","cat_620"];

  score += tags.filter((tag) => bigClubs.includes(tag)).length * 2;
  score += tags.filter((tag) => bigTrophies.includes(tag)).length * 2;
  score += tags.filter((tag) => bigLeagues.includes(tag)).length;
  if (player.position) score += 1;
  if (tags.length >= 8) score += 2;
  if (tags.length >= 12) score += 2;

  return score;
}

function getPlayersForPreset(preset = selectedPreset, grid = []) {
  const config = getPresetConfig(preset);
  const required = config.requireTags || [];

  return ACTIVE_PLAYERS.filter((player) => {
    if (getPlayerWeight(player) < config.playerMinScore) return false;
    if (required.length && !player.tags.some((tag) => required.includes(tag))) return false;
    if (grid.length && !canPlayerFillAnyCell(player, grid)) return false;
    return true;
  });
}

function getCategoriesForPreset(preset = selectedPreset) {
  const config = getPresetConfig(preset);
  const allowedTypes = config.allowedTypes || [1, 2, 3, 4, 5, 6, 8];
  const whitelist = new Set(config.categoryIds || []);
  const excludeTypes = new Set(config.excludeTypes || []);

  return ACTIVE_CATEGORIES.filter((category) => {
    const type = getCategoryType(category);
    if (excludeTypes.has(type)) return false;
    if (whitelist.size) return whitelist.has(category.id);
    if (!allowedTypes.includes(type)) return false;
    return true;
  });
}

function updatePresetHelp() {
  if (!presetHelp) return;

  const labels = {
    "global-easy": "Stars, grands clubs et catégories simples.",
    "global-normal": "Équilibré : joueurs connus, moins de profils obscurs.",
    "global-hard": "Plus large : joueurs moins évidents, mais encore filtrés.",
    "ligue1": "Joueurs passés par des clubs de Ligue 1 ou catégories liées.",
    "premierleague": "Joueurs passés par la Premier League ou catégories liées.",
  };

  presetHelp.textContent = labels[selectedPreset] || labels["global-normal"];
}


onAuthStateChanged(auth, async (user) => {
  uid = user?.uid || null;
  isAdminUser = false;

  if (user && !user.isAnonymous) {
    isAdminUser = await checkIsAdmin(user.uid);
  }

  updateAdminUi(user);

  // Important : ne pas reconnecter en anonyme au chargement avant que Firebase
  // ait restauré la session Google locale.
  if (!user) {
    await authReady;
    setTimeout(() => {
      if (!auth.currentUser) {
        signInAnonymously(auth).catch((error) => {
          alert("Erreur Firebase Auth : " + error.message);
        });
      }
    }, 500);
  }
});

createRoomBtn?.addEventListener("click", () => {
  createRoom().catch((error) => {
    console.error("Erreur création room :", error);
    alert("Erreur création room : " + (error?.message || error));
  });
});
adminLoginBtn?.addEventListener("click", signInAdmin);
adminLogoutBtn?.addEventListener("click", signOutAdmin);
presetModeSelect?.addEventListener("change", () => {
  selectedPreset = presetModeSelect.value || "global-normal";
  categoryMatchCache = new Map();
  updatePresetHelp();
  updatePresetHelp();
renderCustomBuilder();
});
$("joinRoomBtn").addEventListener("click", () => joinRoom(joinCodeInput.value.trim().toUpperCase()));
$("copyRoomBtn").addEventListener("click", copyRoomInfo);
$("copyWaitingRoomBtn").addEventListener("click", copyRoomInfo);
$("leaveRoomBtn").addEventListener("click", leaveRoom);
$("leaveWaitingRoomBtn").addEventListener("click", leaveRoom);
startGameBtn.addEventListener("click", startGame);
nextPlayerBtn.addEventListener("click", () => advanceMyPlayer(true));
closeFinishOverlayBtn?.addEventListener("click", () => hideFinishOverlay());
copyFinishRoomBtn?.addEventListener("click", copyRoomInfo);

gridModeSelect?.addEventListener("change", renderCustomBuilder);
customCategorySearch?.addEventListener("input", () => {
  clearTimeout(customSearchTimer);
  customSearchTimer = setTimeout(renderCustomSearchResults, 100);
});
customAutoBtn?.addEventListener("click", autoCompleteCustomGrid);
customClearBtn?.addEventListener("click", () => {
  customSelectedCategoryIds = [];
  renderCustomBuilder();
});
customSearchResults?.addEventListener("click", (event) => {
  const button = event.target.closest("[data-add-category]");
  if (!button) return;
  addCustomCategory(button.dataset.addCategory);
});
customSelectedGrid?.addEventListener("click", (event) => {
  const button = event.target.closest("[data-remove-category]");
  if (!button) return;
  removeCustomCategory(button.dataset.removeCategory);
});

renderCustomBuilder();


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

function updateAdminUi(user) {
  const isGoogleUser = Boolean(user && !user.isAnonymous);

  adminLoginBtn?.classList.toggle("hidden", isAdminUser);
  adminLogoutBtn?.classList.toggle("hidden", !isGoogleUser);
  adminHeaderLink?.classList.toggle("hidden", !isAdminUser);
  creatorLockedNotice?.classList.toggle("hidden", isAdminUser);

  if (createRoomBtn) {
    createRoomBtn.disabled = false;
    createRoomBtn.textContent = "Créer une room";
  }

  if (adminAuthStatus) {
    if (isAdminUser) {
      adminAuthStatus.textContent = "Admin connecté";
      adminAuthStatus.className = "admin-auth-status good";
    } else if (isGoogleUser) {
      adminAuthStatus.textContent = "Compte Google non autorisé";
      adminAuthStatus.className = "admin-auth-status bad";
    } else {
      adminAuthStatus.textContent = "Mode joueur";
      adminAuthStatus.className = "admin-auth-status";
    }
  }
}

async function signInAdmin() {
  const provider = new GoogleAuthProvider();

  try {
    await authReady;
    await signInWithPopup(auth, provider);
  } catch (error) {
    alert("Connexion Google impossible : " + error.message);
  }
}

async function signOutAdmin() {
  try {
    await signOut(auth);
    await signInAnonymously(auth);
  } catch (error) {
    alert("Déconnexion impossible : " + error.message);
  }
}


async function createRoom() {
  const name = getPlayerName();
  if (!name) return;
  if (!uid) return alert("Connexion Firebase en cours, réessaie dans 2 secondes.");

  isAdminUser = await checkIsAdmin(uid);
  updateAdminUi(auth.currentUser);

  if (!isAdminUser) {
    alert(
      "Seul le compte admin peut créer une room.\n\n" +
      "UID actuel : " + uid + "\n\n" +
      "Dans Firestore, il faut créer : admins/" + uid
    );
    return;
  }

  await loadDatabaseOverrides(true);

  selectedPreset = presetModeSelect?.value || selectedPreset || "global-normal";

  const code = generateRoomCode();
  const requestedGrid = getRequestedCustomGrid();
  if (gridModeSelect?.value === "custom" && !requestedGrid.length) {
    alert("Choisis au moins une catégorie pour lancer un Bingo custom.");
    return;
  }

  const setup = generateGameSetup(requestedGrid, selectedPreset);

  if (!setup.perfectSolvable || setup.deck.length !== MAX_DECK_PLAYERS || setup.playableCount < MIN_PLAYABLE_PLAYERS) {
    alert(
      "Impossible de générer une grille équilibrée avec ces paramètres.\n\n" +
      `Objectif : ${MAX_DECK_PLAYERS} joueurs, minimum ${MIN_PLAYABLE_PLAYERS} utiles, minimum ${MIN_PLAYERS_PER_CELL} solutions par case, maximum ${MAX_COMBO_CELLS} combos.\n\n` +
      "Essaie un autre type de partie, ou enlève quelques catégories custom trop rares."
    );
    return;
  }

  const grid = setup.grid;
  const deck = setup.deck.map((player) => player.id);

  await setDoc(doc(db, "rooms", code), {
    code,
    hostUid: uid,
    grid,
    deck,
    playableCount: setup.playableCount,
    minPlayersPerCell: setup.minPlayersPerCell || 0,
    weakCells: setup.weakCells || [],
    perfectSolvable: true,
    perfectAssignment: setup.perfectAssignment || [],
    comboCount: setup.comboCount || countComboCells(grid),
    generationRules: {
      deckSize: MAX_DECK_PLAYERS,
      minPlayablePlayers: MIN_PLAYABLE_PLAYERS,
      minPlayersPerCell: MIN_PLAYERS_PER_CELL,
      maxComboCells: MAX_COMBO_CELLS
    },
    gridMode: requestedGrid.length ? "custom" : "random",
    preset: selectedPreset,
    playerBase: "players-with-categories",
    maxDeckPlayers: MAX_DECK_PLAYERS,
    minPlayablePlayers: MIN_PLAYABLE_PLAYERS,
    secondsPerPlayer: AUTO_SECONDS,
    status: "waiting",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    gameStartedAt: null
  });

  await setDoc(doc(db, "rooms", code, "participants", uid), buildFreshParticipant(name, true));

  await joinRoom(code, true);
}

async function joinRoom(code, alreadyJoined = false) {
  const name = getPlayerName();
  if (!name) return;
  if (!uid) return alert("Connexion Firebase en cours, réessaie dans 2 secondes.");

  if (!/^[A-Z0-9]{4,6}$/.test(code)) {
    alert("Entre un code room valide.");
    return;
  }

  await loadDatabaseOverrides(true);

  const roomRef = doc(db, "rooms", code);
  const roomSnap = await getDoc(roomRef);

  if (!roomSnap.exists()) {
    alert("Room introuvable.");
    return;
  }

  const participantRef = doc(db, "rooms", code, "participants", uid);
  const participantSnap = await getDoc(participantRef);
  const room = roomSnap.data();

  if (room.status !== "waiting" && !participantSnap.exists()) {
    alert("La partie a déjà commencé. Tu pourras rejoindre la prochaine room.");
    return;
  }

  if (!alreadyJoined && !participantSnap.exists()) {
    await setDoc(participantRef, buildFreshParticipant(name, room.hostUid === uid));
  } else if (!alreadyJoined) {
    await updateDoc(participantRef, { name });
  }

  currentRoomCode = code;
  hasShownFinishOverlay = false;
  hideFinishOverlay();
  localStorage.setItem("bingo-kun-name", name);
  showRoomShell(code);
  subscribeToRoom(code);
}

function buildFreshParticipant(name, isHost = false) {
  return {
    name,
    board: {},
    filledCount: 0,
    finalScore: null,
    bingos: [],
    finished: false,
    resultSaved: false,
    resultId: null,
    finishReason: null,
    isHost,
    currentIndex: 0,
    currentStartedAt: null,
    joinedAt: serverTimestamp()
  };
}

function showRoomShell(code) {
  setupView.classList.add("hidden");
  roomPill.classList.remove("hidden");
  roomCodeDisplay.textContent = code;
  waitingRoomCodeDisplay.textContent = code;
}

function subscribeToRoom(code) {
  cleanupSubscriptions();

  unsubscribeRoom = onSnapshot(doc(db, "rooms", code), (snapshot) => {
    if (!snapshot.exists()) {
      setMessage("La room n’existe plus.", "bad");
      return;
    }

    roomData = snapshot.data();
    renderViews();
  });

  unsubscribeMe = onSnapshot(doc(db, "rooms", code, "participants", uid), (snapshot) => {
    myData = snapshot.exists() ? snapshot.data() : null;
    renderViews();
  });

  unsubscribePlayers = onSnapshot(collection(db, "rooms", code, "participants"), (snapshot) => {
    participantsData = [];
    snapshot.forEach((item) => participantsData.push({ id: item.id, ...item.data() }));
    renderParticipants();
    renderViews();
  });
}

function renderViews() {
  if (!roomData || !myData) return;

  if (roomData.status === "waiting") {
    stopTimers();
    waitingView.classList.remove("hidden");
    gameView.classList.add("hidden");
    topTimer.classList.add("hidden");
    renderWaitingRoom();
    return;
  }

  waitingView.classList.add("hidden");
  gameView.classList.remove("hidden");
  topTimer.classList.remove("hidden");
  startTimers();
  renderGame();
}

function renderWaitingRoom() {
  const isHost = roomData.hostUid === uid;
  startGameBtn.classList.toggle("hidden", !isHost);
  waitingHostHint.textContent = isHost
    ? "Tu es le créateur de la room. Lance la partie quand tout le monde est là."
    : "En attente du créateur de la room. La partie commencera quand il lancera le décompte.";

  waitingPlayerCount.textContent = `${participantsData.length} joueur${participantsData.length > 1 ? "s" : ""}`;
  waitingGridInfo.textContent = `${roomData.grid?.length || 0} cases`;
  waitingDeckInfo.textContent = `${roomData.deck?.length || 0} joueurs max`;
  waitingPlayableInfo.textContent = `${roomData.playableCount || 0} jouables`;
  renderParticipants();
}

function renderParticipants() {
  const players = [...participantsData].sort((a, b) => {
    if (a.isHost !== b.isHost) return a.isHost ? -1 : 1;
    return String(a.name || "").localeCompare(String(b.name || ""));
  });

  if (waitingPlayersList) {
    waitingPlayersList.innerHTML = players.length
      ? players.map((player) => `
          <div class="waiting-player">
            <span class="waiting-player-avatar">${escapeHtml(getPlayerInitials(player.name || "Joueur"))}</span>
            <span class="waiting-player-name">${escapeHtml(player.name || "Joueur")}</span>
            ${player.isHost ? `<span class="host-chip">HOST</span>` : ""}
          </div>
        `).join("")
      : `<p class="empty-history">Aucun joueur dans la room.</p>`;
  }

  if (leaderboardEl) renderLeaderboard(players);
}

function getSortedParticipants(players = participantsData) {
  return [...players].sort((a, b) => {
    if (a.finished && b.finished) {
      if ((b.finalScore || 0) !== (a.finalScore || 0)) return (b.finalScore || 0) - (a.finalScore || 0);
      if (((b.bingos || []).length) !== ((a.bingos || []).length)) return ((b.bingos || []).length) - ((a.bingos || []).length);
      return (a.joinedAt?.seconds || 0) - (b.joinedAt?.seconds || 0);
    }
    if (a.finished !== b.finished) return a.finished ? -1 : 1;
    if ((b.filledCount || 0) !== (a.filledCount || 0)) return (b.filledCount || 0) - (a.filledCount || 0);
    if (((b.bingos || []).length) !== ((a.bingos || []).length)) return ((b.bingos || []).length) - ((a.bingos || []).length);
    return String(a.name || "").localeCompare(String(b.name || ""));
  });
}

function getParticipantRank(participantId) {
  const sorted = getSortedParticipants();
  const index = sorted.findIndex((player) => player.id === participantId);
  return index >= 0 ? index + 1 : null;
}

function renderLeaderboard(players = participantsData) {
  const sorted = getSortedParticipants(players);

  leaderboardEl.innerHTML = sorted.map((player, index) => {
    const rank = index + 1;
    const score = player.finished ? (player.finalScore || 0) : (player.filledCount || 0);
    const progress = Math.max(0, Math.min(100, Math.round((score / BOARD_SIZE) * 100)));
    const bingos = (player.bingos || []).length;
    const medal = rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : `#${rank}`;
    const statusText = player.finished ? "TERMINÉ" : "EN JEU";
    const me = player.id === uid ? '<span class="leaderboard-me">TOI</span>' : '';

    return `
      <div class="leaderboard-item ${player.finished ? "finished" : ""} ${player.id === uid ? "me" : ""}">
        <div class="leaderboard-main">
          <div class="leaderboard-rank">${medal}</div>
          <div class="leaderboard-meta">
            <div class="leaderboard-name-row">
              <strong>${escapeHtml(player.name || "Joueur")}</strong>
              ${me}
              <span class="leaderboard-status">${statusText}</span>
            </div>
            <div class="leaderboard-subline">
              <span>${score}/${BOARD_SIZE}</span>
              <span>${bingos} bingo${bingos > 1 ? "s" : ""}</span>
            </div>
            <div class="leaderboard-progress"><span style="width:${progress}%"></span></div>
          </div>
        </div>
      </div>
    `;
  }).join("");
}

async function startGame() {
  if (!roomData || !currentRoomCode || roomData.hostUid !== uid) return;

  await updateDoc(doc(db, "rooms", currentRoomCode), {
    status: "playing",
    gameStartedAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
}

function renderGame() {
  if (!roomData || !myData || roomData.status !== "playing") return;

  const currentPlayer = getCurrentPlayer();
  const finished = Boolean(myData.finished);
  const board = myData.board || {};
  const filledCount = myData.filledCount || 0;
  const validCount = countValidMoves(board);
  const invalidCount = countInvalidMoves(board);
  const liveBingos = calculateBingos(board).length;
  const myRank = getParticipantRank(uid);

  nextPlayerBtn.classList.toggle("hidden", finished);
  nextPlayerBtn.disabled = !currentPlayer || finished;

  const deckLength = roomData.deck?.length || 0;
  const currentIndex = getMyCurrentIndex();
  const remainingPlayers = currentPlayer ? Math.max(0, deckLength - currentIndex - 1) : 0;

  currentPlayerNameEl.textContent = currentPlayer ? currentPlayer.name : finished ? "Grille terminée" : "Fin du deck";
  currentPlayerInitialsEl.textContent = currentPlayer ? getPlayerInitials(currentPlayer.name) : finished ? "✓" : "—";
  playerCounterBadgeEl.textContent = currentPlayer ? `Joueur ${currentIndex + 1} / ${deckLength}` : finished ? `Partie terminée` : `Deck terminé`;
  currentPlayerSublineEl.textContent = finished
    ? "Ton score final est verrouillé. Consulte le classement et tes bingos."
    : currentPlayer
      ? "Choisis une case vide : ton rythme n'impacte pas les autres joueurs."
      : "Tu as terminé ta liste de joueurs.";

  myFilledEl.textContent = `${filledCount} / ${BOARD_SIZE}`;
  playersRemainingEl.textContent = `${remainingPlayers} / ${deckLength}`;
  if (liveBingosEl) liveBingosEl.textContent = `${liveBingos}`;
  if (myRankEl) myRankEl.textContent = myRank ? `#${myRank}` : "#-";
  renderPlayedPlayers(currentIndex);

  if (finished) {
    const finalScore = myData.finalScore || 0;
    const finalBingos = (myData.bingos || []).length;
    const accuracy = Math.round((finalScore / BOARD_SIZE) * 100);
    scoreDisplayEl.textContent = finalScore;
    if (compactScoreDisplayEl) compactScoreDisplayEl.textContent = `${finalScore}/${BOARD_SIZE}`;
    scoreSublineEl.textContent = "score final";
    hiddenResultBox.classList.add("hidden");
    finalResultBox.classList.remove("hidden");
    myResultEl.textContent = `${finalScore} / ${BOARD_SIZE}`;
    myBingosEl.textContent = `${finalBingos}`;
    if (myWrongEl) myWrongEl.textContent = `${BOARD_SIZE - finalScore}`;
    if (myFinalRankEl) myFinalRankEl.textContent = myRank ? `#${myRank}` : "#-";
    if (myAccuracyEl) myAccuracyEl.textContent = `${accuracy}%`;
    updateFinishOverlay(finalScore, finalBingos, BOARD_SIZE - finalScore, accuracy, myRank, participantsData.length);
    ensureResultSaved(board, finalScore, myData.bingos || []);
    if (!hasShownFinishOverlay) {
      showFinishOverlay();
      hasShownFinishOverlay = true;
    }
  } else {
    scoreDisplayEl.textContent = filledCount;
    if (compactScoreDisplayEl) compactScoreDisplayEl.textContent = `${filledCount}/${BOARD_SIZE}`;
    scoreSublineEl.textContent = "cases";
    hiddenResultBox.classList.remove("hidden");
    finalResultBox.classList.add("hidden");
    hideFinishOverlay();
  }

  renderBoard(currentPlayer);
  updateCountdown();
}

function renderBoard(currentPlayer) {
  boardEl.innerHTML = "";

  const board = myData.board || {};
  const reveal = Boolean(myData.finished);
  const bingoCells = reveal ? new Set((myData.bingos || []).flatMap(getLineCells)) : new Set();

  roomData.grid.forEach((category, index) => {
    const move = board[index];
    const cell = document.createElement("button");
    cell.className = "cell";
    cell.type = "button";

    if (move) cell.classList.add("filled");
    if (reveal && move?.isValid) cell.classList.add("valid");
    if (reveal && move && !move.isValid) cell.classList.add("invalid");
    if (bingoCells.has(index)) cell.classList.add("bingo");

    const visualHtml = renderCategoryVisual(category);

    cell.innerHTML = `
      <div class="cell-inner">
        ${visualHtml}
        <div class="cell-kicker">${escapeHtml(category.kicker || "Critère")}</div>
        <div class="cell-title">${escapeHtml(category.title || category.name || category.id)}</div>
        <div class="cell-footer">
          ${move ? `<div class="placed-player">${escapeHtml(getDisplaySurname(move.playerName))}</div>` : ""}
          ${reveal && move ? `<div class="result-chip ${move.isValid ? "good" : "bad"}">${move.isValid ? "VALIDÉ" : "FAUX"}</div>` : ""}
        </div>
      </div>
    `;

    cell.disabled = Boolean(move) || !currentPlayer || Boolean(myData.finished);
    cell.addEventListener("click", () => placeCurrentPlayer(index));
    boardEl.appendChild(cell);
  });
}


function renderCategoryVisual(category) {
  const visuals = Array.isArray(category.visuals) && category.visuals.length
    ? category.visuals.slice(0, 2)
    : [{
        visualType: category.visualType || "default",
        image: category.image || "",
        shortLabel: category.shortLabel || (category.logo && TEAMS[category.logo] ? TEAMS[category.logo].short : iconForCategory(category.id))
      }];

  const visualClass = visuals.length > 1 ? "combo" : (visuals[0]?.visualType || "default");

  const imagesHtml = visuals.map((item) => {
    if (!item?.image) {
      return `<div class="cell-icon-fallback">${escapeHtml(item?.shortLabel || "★")}</div>`;
    }

    return `
      <img
        src="${escapeHtml(item.image)}"
        alt="${escapeHtml(category.title || category.name || category.id)}"
        class="cell-image"
        loading="lazy"
      />
    `;
  }).join("");

  return `
    <div class="cell-visual cell-visual-${escapeHtml(visualClass)}">
      <div class="cell-visual-images ${visuals.length > 1 ? "is-combo" : ""}">
        ${imagesHtml}
      </div>
    </div>
  `;
}

async function placeCurrentPlayer(cellIndex) {
  if (!roomData || !myData || roomData.status !== "playing" || myData.finished) return;

  const currentPlayer = getCurrentPlayer();
  if (!currentPlayer) return;

  const board = myData.board || {};

  if (board[cellIndex]) {
    setMessage("Cette case est déjà remplie.", "bad");
    return;
  }

  const playerAlreadyUsed = Object.values(board).some((move) => move.playerId === currentPlayer.id);
  if (playerAlreadyUsed) {
    setMessage("Tu as déjà utilisé ce joueur sur ta grille.", "bad");
    return;
  }

  const category = roomData.grid[cellIndex];
  const isValid = canPlayerFillCategory(currentPlayer, category);

  const newBoard = {
    ...board,
    [cellIndex]: {
      playerId: currentPlayer.id,
      playerName: currentPlayer.name,
      categoryId: category.id,
      isValid,
      placedAt: Date.now()
    }
  };

  const filledCount = Object.keys(newBoard).length;
  const updatePayload = {
    board: newBoard,
    filledCount
  };

  if (filledCount >= BOARD_SIZE) {
    const validCount = Object.values(newBoard).filter((move) => move.isValid).length;
    updatePayload.finished = true;
    updatePayload.finalScore = validCount;
    updatePayload.bingos = calculateBingos(newBoard);
    updatePayload.resultSaved = false;
    setMessage("Grille complète ! Le verdict est révélé.", "good");
  } else {
    const nextIndex = Math.min(getMyCurrentIndex() + 1, roomData.deck?.length || 0);
    updatePayload.currentIndex = nextIndex;
    updatePayload.currentStartedAt = serverTimestamp();
    setMessage("Joueur placé. Le prochain joueur arrive pour toi uniquement.", "good");
  }

  await updateDoc(doc(db, "rooms", currentRoomCode, "participants", uid), updatePayload);
}

async function advanceMyPlayer(manual = false) {
  if (!roomData || !currentRoomCode || roomData.status !== "playing" || !myData || myData.finished) return;

  const participantRef = doc(db, "rooms", currentRoomCode, "participants", uid);

  const advanced = await runTransaction(db, async (transaction) => {
    const participantSnap = await transaction.get(participantRef);
    if (!participantSnap.exists()) return false;

    const liveParticipant = participantSnap.data();
    if (liveParticipant.finished) return false;

    const currentIndex = Number(liveParticipant.currentIndex || 0);
    const deckLength = roomData.deck?.length || 0;

    if (currentIndex >= deckLength) return false;

    const nextIndex = Math.min(currentIndex + 1, deckLength);
    const updatePayload = {
      currentIndex: nextIndex,
      currentStartedAt: serverTimestamp()
    };

    if (nextIndex >= deckLength) {
      const board = liveParticipant.board || {};
      const finalScore = countValidMoves(board);
      updatePayload.finished = true;
      updatePayload.finalScore = finalScore;
      updatePayload.bingos = calculateBingos(board);
      updatePayload.finishReason = "deck_finished";
    }

    transaction.update(participantRef, updatePayload);

    return true;
  });

  if (manual && advanced) setMessage("Joueur passé pour toi uniquement.", "good");
}

function countValidMoves(board) {
  return Object.values(board || {}).filter((move) => move?.isValid).length;
}

function countInvalidMoves(board) {
  return Object.values(board || {}).filter((move) => move && move.isValid === false).length;
}


async function ensureResultSaved(board, finalScore, bingos) {
  if (!currentRoomCode || !uid || !roomData || !myData || savingResult || myData.resultSaved) return;

  savingResult = true;
  const resultId = `${currentRoomCode}_${uid}`;
  const bingoCount = Array.isArray(bingos) ? bingos.length : 0;
  const wrongAnswers = BOARD_SIZE - Number(finalScore || 0);
  const accuracy = Math.round((Number(finalScore || 0) / BOARD_SIZE) * 100);
  const points = calculateRankingPoints(Number(finalScore || 0), bingoCount);
  const now = new Date();
  const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const playerName = myData.name || getPlayerName() || "Joueur";

  try {
    await setDoc(doc(db, "results", resultId), {
      resultId,
      roomCode: currentRoomCode,
      playerUid: uid,
      playerName,
      playerKey: normalizePlayerKey(playerName),
      score: Number(finalScore || 0),
      finalScore: Number(finalScore || 0),
      bingos: bingoCount,
      bingoIds: Array.isArray(bingos) ? bingos : [],
      wrongAnswers,
      accuracy,
      points,
      filledCount: Object.keys(board || {}).length,
      monthKey,
      year: now.getFullYear(),
      createdAt: serverTimestamp(),
      finishedAt: serverTimestamp(),
      roomCreatedAt: roomData.createdAt || null,
      deckSize: roomData.deck?.length || 0,
      gridSize: roomData.grid?.length || 0
    }, { merge: true });

    await updateDoc(doc(db, "rooms", currentRoomCode, "participants", uid), {
      resultSaved: true,
      resultId,
      rankingPoints: points,
      finishedAt: serverTimestamp()
    });
  } catch (error) {
    console.error("Bingo Kun : impossible d'enregistrer le résultat.", error);
  } finally {
    savingResult = false;
  }
}

function calculateRankingPoints(score, bingoCount) {
  const safeScore = Number(score || 0);
  const safeBingos = Number(bingoCount || 0);
  const perfectBonus = safeScore >= BOARD_SIZE ? 10 : 0;
  const bingoBonus = safeBingos >= 5 ? 5 : 0;
  return safeScore + (safeBingos * 3) + perfectBonus + bingoBonus;
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

function updateFinishOverlay(finalScore, bingoCount, wrongCount, accuracy, rank, totalPlayers) {
  if (!finishTitleEl) return;

  let title = 'Bien joué !';
  let subtitle = 'Ta grille est complète.';

  if (finalScore >= 23) {
    title = 'Masterclass !';
    subtitle = 'Énorme performance sur cette grille.';
  } else if (finalScore >= 18) {
    title = 'Très solide !';
    subtitle = 'Belle partie, ta grille tient bien la route.';
  } else if (finalScore <= 10) {
    title = 'À retenter !';
    subtitle = 'Tu peux faire mieux sur la prochaine room.';
  }

  finishTitleEl.textContent = title;
  finishSubtitleEl.textContent = subtitle;
  finishScoreEl.textContent = `${finalScore} / ${BOARD_SIZE}`;
  finishBingosEl.textContent = String(bingoCount);
  finishWrongEl.textContent = String(wrongCount);
  finishAccuracyEl.textContent = `${accuracy}%`;
  finishRankEl.textContent = rank ? `#${rank}` : '#-';
  finishTotalPlayersEl.textContent = `${totalPlayers} joueur${totalPlayers > 1 ? 's' : ''}`;
  renderFinishRecap();
}


function getCategoryDisplayName(category) {
  if (!category) return "Case inconnue";
  const title = category.title || category.name || category.shortLabel || category.id;
  const kicker = category.kicker || "";
  return `${kicker ? kicker + " · " : ""}${title}`.trim();
}

function renderFinishRecap() {
  if (!finishRecapListEl || !finishRecapStatsEl) return;

  if (!roomData?.deck?.length || !roomData?.grid?.length) {
    finishRecapStatsEl.textContent = "Aucune donnée disponible.";
    finishRecapListEl.innerHTML = "";
    return;
  }

  const board = myData?.board || {};
  const movesByPlayerId = new Map();

  Object.entries(board).forEach(([cellIndex, move]) => {
    if (!move?.playerId) return;
    movesByPlayerId.set(move.playerId, {
      ...move,
      cellIndex: Number(cellIndex)
    });
  });

  const currentIndex = Math.min(getMyCurrentIndex(), roomData.deck.length - 1);
  const hasReachedEnd = myData?.finished && currentIndex >= roomData.deck.length - 1;
  const shownIds = roomData.deck.slice(0, hasReachedEnd ? roomData.deck.length : currentIndex + 1);

  const rows = shownIds
    .map((playerId, index) => {
      const player = ACTIVE_PLAYERS.find((item) => item.id === playerId);
      if (!player) return null;

      const possibleCells = roomData.grid
        .map((category, cellIndex) => ({ category, cellIndex }))
        .filter(({ category }) => canPlayerFillCategory(player, category));

      const move = movesByPlayerId.get(player.id);
      const placedCategory = move ? roomData.grid[move.cellIndex] : null;

      return {
        player,
        index,
        possibleCells,
        move,
        placedCategory
      };
    })
    .filter(Boolean);

  const usefulCount = rows.filter((row) => row.possibleCells.length > 0).length;
  const placedCount = rows.filter((row) => row.move).length;

  finishRecapStatsEl.textContent = `${rows.length} joueurs vus · ${usefulCount} jouables · ${placedCount} placés`;

  finishRecapListEl.innerHTML = rows.map((row) => {
    const possibleHtml = row.possibleCells.length
      ? row.possibleCells.slice(0, 5).map(({ category, cellIndex }) => {
          const isPlacedHere = row.move && Number(row.move.cellIndex) === Number(cellIndex);
          return `<span class="recap-chip ${isPlacedHere ? (row.move.isValid ? "good" : "bad") : ""}">${escapeHtml(getCategoryDisplayName(category))}</span>`;
        }).join("")
      : `<span class="recap-chip muted">Aucune case</span>`;

    const more = row.possibleCells.length > 5
      ? `<span class="recap-chip muted">+${row.possibleCells.length - 5}</span>`
      : "";

    let status = "Passé";
    let statusClass = "passed";

    if (row.move) {
      status = row.move.isValid ? "Placé juste" : "Placé faux";
      statusClass = row.move.isValid ? "good" : "bad";
    } else if (row.possibleCells.length > 0) {
      status = "Jouable";
      statusClass = "playable";
    }

    const placedLine = row.move
      ? `<div class="recap-placed">Mis sur : <strong>${escapeHtml(getCategoryDisplayName(row.placedCategory))}</strong></div>`
      : "";

    return `
      <article class="recap-row ${statusClass}">
        <div class="recap-player">
          <span class="recap-number">${row.index + 1}</span>
          <strong>${escapeHtml(row.player.name)}</strong>
          <em>${escapeHtml(status)}</em>
        </div>
        <div class="recap-cells">
          ${possibleHtml}${more}
        </div>
        ${placedLine}
      </article>
    `;
  }).join("");
}


function showFinishOverlay() {
  if (!finishOverlay) return;
  finishOverlay.classList.remove('hidden');
  document.body.classList.add('overlay-open');
}

function hideFinishOverlay() {
  if (!finishOverlay) return;
  finishOverlay.classList.add('hidden');
  document.body.classList.remove('overlay-open');
}

function startTimers() {
  if (clockInterval || playerAutoInterval) return;

  clockInterval = setInterval(() => {
    updateCountdown();
  }, 250);

  playerAutoInterval = setInterval(() => {
    if (!roomData || roomData.status !== "playing" || !myData || myData.finished) return;
    if (!getCurrentPlayer()) return;
    if (getRemainingSeconds() <= 0) advanceMyPlayer(false);
  }, 1000);
}

function stopTimers() {
  if (clockInterval) clearInterval(clockInterval);
  if (playerAutoInterval) clearInterval(playerAutoInterval);
  clockInterval = null;
  playerAutoInterval = null;
}

function updateCountdown() {
  if (!roomData || roomData.status !== "playing") {
    globalTimerTextEl.textContent = `${AUTO_SECONDS}s`;
    globalTimerBarEl.style.width = "100%";
    circleTimerTextEl.textContent = String(AUTO_SECONDS);
    document.documentElement.style.setProperty("--timer-progress", "100%");
    return;
  }

  const remaining = getRemainingSeconds();
  const seconds = Math.max(0, Math.ceil(remaining));
  const percent = Math.max(0, Math.min(100, (remaining / AUTO_SECONDS) * 100));

  globalTimerTextEl.textContent = `${seconds}s`;
  globalTimerBarEl.style.width = `${percent}%`;
  circleTimerTextEl.textContent = String(seconds);
  document.documentElement.style.setProperty("--timer-progress", `${percent}%`);
}

function getRemainingSeconds() {
  if (!roomData || roomData.status !== "playing") return AUTO_SECONDS;

  const timestamp = myData?.currentStartedAt || roomData.gameStartedAt;
  if (!timestamp) return AUTO_SECONDS;

  const startedAt = timestamp.toMillis ? timestamp.toMillis() : Date.now();
  const elapsed = (Date.now() - startedAt) / 1000;
  return AUTO_SECONDS - elapsed;
}

function getMyCurrentIndex() {
  return Math.max(0, Number(myData?.currentIndex || 0));
}

function getCurrentPlayer() {
  if (!roomData?.deck) return null;
  const id = roomData.deck[getMyCurrentIndex()];
  return ACTIVE_PLAYERS.find((player) => player.id === id) || null;
}

function getDisplaySurname(name) {
  const cleanName = String(name || "").replace(/\s*\([^)]*\)\s*$/g, "");
  const parts = cleanName
    .replace(/[’']/g, " ")
    .split(/\s+/)
    .filter(Boolean);

  if (!parts.length) return "";
  if (parts.length === 1) return parts[0];

  return parts[parts.length - 1];
}

function getPlayerInitials(name) {
  const parts = String(name || "?")
    .replace(/[’']/g, " ")
    .split(/\s+/)
    .filter(Boolean);

  if (!parts.length) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();

  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function renderPlayedPlayers(currentIndex) {
  if (!playedPlayersListEl || !roomData?.deck) return;

  const board = myData?.board || {};
  const usedByPlayerId = new Map(
    Object.values(board).map((move) => [move.playerId, move])
  );

  const history = roomData.deck
    .slice(0, Math.min(currentIndex + 1, roomData.deck.length))
    .map((id, index) => {
      const player = ACTIVE_PLAYERS.find((item) => item.id === id);
      return player ? { player, index } : null;
    })
    .filter(Boolean)
    .slice(-8)
    .reverse();

  if (!history.length) {
    playedPlayersListEl.innerHTML = `<div class="empty-history">Aucun joueur pour l'instant.</div>`;
    return;
  }

  playedPlayersListEl.innerHTML = history.map(({ player, index }) => {
    const isCurrent = index === currentIndex && getCurrentPlayer();
    const move = usedByPlayerId.get(player.id);
    const status = isCurrent ? "EN JEU" : move ? "PLACÉ" : "PASSÉ";
    const statusClass = isCurrent ? "current" : move ? "placed" : "passed";

    return `
      <div class="played-player ${statusClass}">
        <span class="played-player-rank">${index + 1}</span>
        <span class="played-player-name">${escapeHtml(player.name)}</span>
        <span class="played-player-status">${status}</span>
      </div>
    `;
  }).join("");
}

function calculateBingos(board) {
  const lines = [];

  for (let row = 0; row < BOARD_ROWS; row++) {
    lines.push({
      id: `row-${row}`,
      cells: Array.from({ length: BOARD_COLS }, (_, col) => row * BOARD_COLS + col)
    });
  }

  for (let col = 0; col < BOARD_COLS; col++) {
    lines.push({
      id: `col-${col}`,
      cells: Array.from({ length: BOARD_ROWS }, (_, row) => row * BOARD_COLS + col)
    });
  }

  return lines
    .filter((line) => line.cells.every((cellIndex) => board[cellIndex]?.isValid))
    .map((line) => line.id);
}

function getLineCells(lineId) {
  if (lineId.startsWith("row-")) {
    const row = Number(lineId.replace("row-", ""));
    return Array.from({ length: BOARD_COLS }, (_, col) => row * BOARD_COLS + col);
  }

  if (lineId.startsWith("col-")) {
    const col = Number(lineId.replace("col-", ""));
    return Array.from({ length: BOARD_ROWS }, (_, row) => row * BOARD_COLS + col);
  }

  return [];
}

function iconForCategory(id) {
  const icons = {
    premierleague: "PL",
    uclwinner: "LDC",
    worldcupwinner: "CDM",
    eurowinner: "EURO",
    ballondor: "BO",
    striker: "9",
    midfielder: "8",
    defender: "DEF",
    goalkeeper: "GK",
    retired: "RET",
    active: "ACT",
    hundredgoals: "100+",
    leftfoot: "G"
  };

  return icons[id] || "★";
}



function isComboCategory(category) {
  return Array.isArray(category?.visuals) && category.visuals.length > 1;
}

function countComboCells(grid) {
  return grid.filter(isComboCategory).length;
}

function countDeckMatchesForCategory(deck, category) {
  return deck.reduce((total, player) => {
    return total + (canPlayerFillCategory(player, category) ? 1 : 0);
  }, 0);
}

function getGridCoverageStats(grid, deck) {
  const perCell = grid.map((category, index) => ({
    index,
    categoryId: category.id,
    count: countDeckMatchesForCategory(deck, category)
  }));

  return {
    perCell,
    minMatches: perCell.length ? Math.min(...perCell.map((item) => item.count)) : 0,
    allCellsHaveEnoughPlayers: perCell.every((item) => item.count >= MIN_PLAYERS_PER_CELL),
    weakCells: perCell.filter((item) => item.count < MIN_PLAYERS_PER_CELL)
  };
}

function getPerfectAssignment(grid, deck) {
  const matchesByCell = grid.map((category, cellIndex) => ({
    cellIndex,
    category,
    playerIndexes: deck
      .map((player, playerIndex) => ({ player, playerIndex }))
      .filter(({ player }) => canPlayerFillCategory(player, category))
      .map(({ playerIndex }) => playerIndex)
  }));

  // On traite d'abord les cases les plus difficiles.
  matchesByCell.sort((a, b) => a.playerIndexes.length - b.playerIndexes.length);

  const playerToCell = new Map();

  function tryAssign(cellOrderIndex, seenPlayers) {
    if (cellOrderIndex >= matchesByCell.length) return true;

    const cell = matchesByCell[cellOrderIndex];

    for (const playerIndex of cell.playerIndexes) {
      if (seenPlayers.has(playerIndex)) continue;
      seenPlayers.add(playerIndex);

      const previousCellOrderIndex = playerToCell.get(playerIndex);
      if (
        previousCellOrderIndex === undefined ||
        tryAssign(previousCellOrderIndex, seenPlayers)
      ) {
        playerToCell.set(playerIndex, cellOrderIndex);
        return true;
      }
    }

    return false;
  }

  for (let cellOrderIndex = 0; cellOrderIndex < matchesByCell.length; cellOrderIndex++) {
    if (!tryAssign(cellOrderIndex, new Set())) {
      return {
        solvable: false,
        assignedCells: cellOrderIndex,
        assignment: []
      };
    }
  }

  const assignment = Array.from(playerToCell.entries()).map(([playerIndex, cellOrderIndex]) => ({
    playerId: deck[playerIndex]?.id,
    playerName: deck[playerIndex]?.name,
    cellIndex: matchesByCell[cellOrderIndex]?.cellIndex,
    categoryId: matchesByCell[cellOrderIndex]?.category?.id,
    categoryTitle: matchesByCell[cellOrderIndex]?.category?.title || matchesByCell[cellOrderIndex]?.category?.name
  }));

  return {
    solvable: assignment.length >= grid.length,
    assignedCells: assignment.length,
    assignment
  };
}

function isPerfectSolvable(grid, deck) {
  return getPerfectAssignment(grid, deck).solvable;
}



function generateGameSetup(requestedGrid = [], preset = selectedPreset) {
  const playerPoolAll = getPlayersForPreset(preset);
  const maxDeckSize = MAX_DECK_PLAYERS;
  const requiredPlayable = MIN_PLAYABLE_PLAYERS;

  const categoryPool = getCategoriesForPreset(preset).filter((category) => getCategoryMatchCount(category, playerPoolAll) > 0);
  const fixedGrid = normalizeRequestedGrid(requestedGrid).filter((category) => {
    if (!categoryPool.length) return true;
    return categoryPool.some((item) => item.id === category.id);
  });

  const fixedComboCount = countComboCells(fixedGrid);

  if (fixedComboCount > MAX_COMBO_CELLS) {
    return {
      grid: fixedGrid,
      deck: [],
      playableCount: 0,
      minPlayersPerCell: 0,
      weakCells: [],
      perfectSolvable: false,
      perfectAssignment: [],
      comboCount: fixedComboCount,
      error: `Trop de combos dans la grille custom : ${fixedComboCount}/${MAX_COMBO_CELLS}`
    };
  }

  let bestSetup = null;
  const attempts = fixedGrid.length ? 2000 : 6000;

  for (let attempt = 0; attempt < attempts; attempt++) {
    const grid = fixedGrid.length
      ? completeGridFromFixedCategories(fixedGrid, categoryPool, playerPoolAll)
      : buildBalancedRandomGrid(categoryPool.length ? categoryPool : ACTIVE_CATEGORIES, playerPoolAll);

    if (!grid || grid.length !== BOARD_SIZE) continue;

    const comboCount = countComboCells(grid);
    if (comboCount > MAX_COMBO_CELLS) continue;

    const playerPool = getPlayersForPreset(preset, grid);
    const playablePlayers = playerPool.filter((player) => canPlayerFillAnyCell(player, grid));
    const coveredCells = grid.filter((category) => playablePlayers.some((player) => canPlayerFillCategory(player, category))).length;

    if (playablePlayers.length < requiredPlayable) {
      const score = playablePlayers.length * 100 + coveredCells - (comboCount * 10);
      if (!bestSetup || score > bestSetup.score) {
        bestSetup = {
          grid,
          deck: playablePlayers.slice(0, maxDeckSize),
          playableCount: playablePlayers.length,
          score,
          coverageStats: getGridCoverageStats(grid, playablePlayers.slice(0, maxDeckSize)),
          perfectAssignment: { solvable: false, assignedCells: 0, assignment: [] },
          perfectSolvable: false,
          comboCount
        };
      }
      continue;
    }

    const deck = buildDeck(grid, playablePlayers, maxDeckSize, preset);
    const deckPlayableCount = deck.filter((player) => canPlayerFillAnyCell(player, grid)).length;
    const coverageStats = getGridCoverageStats(grid, deck);
    const perfectAssignment = getPerfectAssignment(grid, deck);
    const deckCoversEveryCell = coverageStats.allCellsHaveEnoughPlayers;
    const perfectSolvable = perfectAssignment.solvable;
    const deckHas75Players = deck.length === MAX_DECK_PLAYERS;

    const score =
      deckPlayableCount * 100 +
      coveredCells +
      (coverageStats.minMatches * 50) +
      (perfectAssignment.assignedCells * 75) +
      (deckHas75Players ? 2500 : 0) +
      (perfectSolvable ? 5000 : 0) -
      (comboCount * 20);

    if (!bestSetup || score > bestSetup.score) {
      bestSetup = {
        grid,
        deck,
        playableCount: deckPlayableCount,
        score,
        coverageStats,
        perfectAssignment,
        perfectSolvable,
        comboCount
      };
    }

    if (
      deckHas75Players &&
      deckPlayableCount >= requiredPlayable &&
      deckCoversEveryCell &&
      perfectSolvable &&
      comboCount <= MAX_COMBO_CELLS
    ) {
      return {
        grid,
        deck,
        playableCount: deckPlayableCount,
        minPlayersPerCell: coverageStats.minMatches,
        weakCells: coverageStats.weakCells,
        perfectSolvable: true,
        perfectAssignment: perfectAssignment.assignment,
        comboCount
      };
    }
  }

  console.warn("Bingo Kun : aucune grille v32 parfaite trouvée, meilleure configuration :", preset, bestSetup);
  return {
    grid: bestSetup?.grid || [],
    deck: bestSetup?.deck || [],
    playableCount: bestSetup?.playableCount || 0,
    minPlayersPerCell: bestSetup?.coverageStats?.minMatches || 0,
    weakCells: bestSetup?.coverageStats?.weakCells || [],
    perfectSolvable: Boolean(bestSetup?.perfectSolvable),
    perfectAssignment: bestSetup?.perfectAssignment?.assignment || [],
    comboCount: bestSetup?.comboCount || 0
  };
}

function buildBalancedRandomGrid(categoryPool, playerPool) {
  const shuffled = shuffle(categoryPool.filter((category) => getCategoryMatchCount(category, playerPool) > 0));
  const combos = shuffled.filter(isComboCategory);
  const nonCombos = shuffled.filter((category) => !isComboCategory(category));

  const comboTarget = Math.min(MAX_COMBO_CELLS, Math.max(4, Math.floor(Math.random() * (MAX_COMBO_CELLS + 1))));
  const selectedCombos = combos.slice(0, comboTarget);
  const grid = [...selectedCombos];

  for (const category of nonCombos) {
    if (grid.length >= BOARD_SIZE) break;
    grid.push(category);
  }

  // Si un mode manque de catégories non-combo, on complète sans dépasser le max combo si possible.
  for (const category of shuffled) {
    if (grid.length >= BOARD_SIZE) break;
    if (grid.some((item) => item.id === category.id)) continue;
    if (isComboCategory(category) && countComboCells(grid) >= MAX_COMBO_CELLS) continue;
    grid.push(category);
  }

  return shuffle(grid).slice(0, BOARD_SIZE);
}

function normalizeRequestedGrid(requestedGrid = []) {
  const selectedIds = new Set();
  const selected = [];

  requestedGrid.forEach((category) => {
    if (!category?.id || selectedIds.has(category.id)) return;
    const liveCategory = ACTIVE_CATEGORIES.find((item) => item.id === category.id) || category;
    selectedIds.add(liveCategory.id);
    selected.push(liveCategory);
  });

  return selected.slice(0, BOARD_SIZE);
}

function completeGridFromFixedCategories(fixedGrid, categoryPool = ACTIVE_CATEGORIES, playerPool = ACTIVE_PLAYERS) {
  const selectedIds = new Set(fixedGrid.map((category) => category.id));
  const grid = [...fixedGrid];

  const candidates = shuffle(
    categoryPool.filter((category) => {
      if (selectedIds.has(category.id)) return false;
      return getCategoryMatchCount(category, playerPool) > 0;
    })
  );

  const nonCombos = candidates.filter((category) => !isComboCategory(category));
  const combos = candidates.filter(isComboCategory);

  for (const category of nonCombos) {
    if (grid.length >= BOARD_SIZE) break;
    selectedIds.add(category.id);
    grid.push(category);
  }

  for (const category of combos) {
    if (grid.length >= BOARD_SIZE) break;
    if (countComboCells(grid) >= MAX_COMBO_CELLS) break;
    selectedIds.add(category.id);
    grid.push(category);
  }

  return grid.slice(0, BOARD_SIZE);
}

function getRequestedCustomGrid() {
  if (gridModeSelect?.value !== "custom") return [];

  return customSelectedCategoryIds
    .map((id) => ACTIVE_CATEGORIES.find((category) => category.id === id))
    .filter(Boolean)
    .slice(0, BOARD_SIZE);
}

function renderCustomBuilder() {
  if (!customBuilder || !gridModeSelect) return;

  const isCustom = gridModeSelect.value === "custom";
  customBuilder.classList.toggle("hidden", !isCustom);

  if (!isCustom) return;

  customSelectedCategoryIds = customSelectedCategoryIds
    .filter((id, index, array) => array.indexOf(id) === index)
    .filter((id) => ACTIVE_CATEGORIES.some((category) => category.id === id))
    .slice(0, BOARD_SIZE);

  if (customCountEl) {
    customCountEl.textContent = `${customSelectedCategoryIds.length} / ${BOARD_SIZE} cases`;
  }

  renderCustomSelectedGrid();
  renderCustomSearchResults();
}

function renderCustomSelectedGrid() {
  if (!customSelectedGrid) return;

  if (!customSelectedCategoryIds.length) {
    customSelectedGrid.innerHTML = `<div class="custom-empty">Aucune case choisie pour l'instant.</div>`;
    return;
  }

  customSelectedGrid.innerHTML = customSelectedCategoryIds.map((id, index) => {
    const category = ACTIVE_CATEGORIES.find((item) => item.id === id);
    if (!category) return "";

    return `
      <button class="custom-chip" type="button" data-remove-category="${escapeHtml(id)}">
        <span>${index + 1}</span>
        <strong>${escapeHtml(category.title || category.name || category.id)}</strong>
        <small>${escapeHtml(category.kicker || "Critère")}</small>
      </button>
    `;
  }).join("");
}

function renderCustomSearchResults() {
  if (!customSearchResults || gridModeSelect?.value !== "custom") return;

  const query = normalizeSearch(customCategorySearch?.value || "");
  const selected = new Set(customSelectedCategoryIds);

  const playerPool = getPlayersForPreset(selectedPreset);
  const categoryPool = getCategoriesForPreset(selectedPreset);

  const pool = categoryPool
    .filter((category) => !selected.has(category.id))
    .map((category) => ({
      category,
      count: getCategoryMatchCount(category, playerPool),
      haystack: normalizeSearch(`${category.title || ""} ${category.name || ""} ${category.kicker || ""} ${category.shortLabel || ""}`)
    }))
    .filter((item) => item.count > 0)
    .filter((item) => !query || item.haystack.includes(query))
    .sort((a, b) => {
      if (query) {
        const aStarts = a.haystack.startsWith(query) ? 1 : 0;
        const bStarts = b.haystack.startsWith(query) ? 1 : 0;
        if (aStarts !== bStarts) return bStarts - aStarts;
      }
      return b.count - a.count;
    })
    .slice(0, 24);

  if (!pool.length) {
    customSearchResults.innerHTML = `<div class="custom-empty">Aucune catégorie trouvée.</div>`;
    return;
  }

  customSearchResults.innerHTML = pool.map(({ category, count }) => `
    <button class="custom-result" type="button" data-add-category="${escapeHtml(category.id)}" ${customSelectedCategoryIds.length >= BOARD_SIZE ? "disabled" : ""}>
      <span class="custom-result-visual">${renderCategoryVisual(category)}</span>
      <span class="custom-result-meta">
        <strong>${escapeHtml(category.title || category.name || category.id)}</strong>
        <small>${escapeHtml(category.kicker || "Critère")} · ${count} joueurs</small>
      </span>
    </button>
  `).join("");
}

function addCustomCategory(id) {
  if (!id || customSelectedCategoryIds.includes(id)) return;
  if (customSelectedCategoryIds.length >= BOARD_SIZE) {
    alert(`La grille est déjà complète : ${BOARD_SIZE} cases.`);
    return;
  }

  customSelectedCategoryIds.push(id);
  renderCustomBuilder();
}

function removeCustomCategory(id) {
  customSelectedCategoryIds = customSelectedCategoryIds.filter((item) => item !== id);
  renderCustomBuilder();
}

function autoCompleteCustomGrid() {
  const selected = new Set(customSelectedCategoryIds);
  const playerPool = getPlayersForPreset(selectedPreset);
  const candidates = shuffle(
    getCategoriesForPreset(selectedPreset).filter((category) => !selected.has(category.id) && getCategoryMatchCount(category, playerPool) > 0)
  );

  for (const category of candidates) {
    if (customSelectedCategoryIds.length >= BOARD_SIZE) break;
    selected.add(category.id);
    customSelectedCategoryIds.push(category.id);
  }

  renderCustomBuilder();
}

function getCategoryMatchCount(category, playerPool = ACTIVE_PLAYERS) {
  if (!category?.id) return 0;
  const cacheKey = `${selectedPreset}:${category.id}:${playerPool.length}`;
  if (categoryMatchCache.has(cacheKey)) return categoryMatchCache.get(cacheKey);

  const count = playerPool.reduce((total, player) => {
    return total + (canPlayerFillCategory(player, category) ? 1 : 0);
  }, 0);

  categoryMatchCache.set(cacheKey, count);
  return count;
}

function normalizeSearch(text) {
  return String(text || "")
    .normalize("NFD")
    .replace(/[\\u0300-\\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function buildDeck(grid, playablePlayers, maxDeckSize = MAX_DECK_PLAYERS, preset = selectedPreset) {
  const selected = new Map();

  // On sécurise d'abord les cases les plus rares.
  const categoriesByDifficulty = [...grid].sort((a, b) => {
    const countA = playablePlayers.filter((player) => canPlayerFillCategory(player, a)).length;
    const countB = playablePlayers.filter((player) => canPlayerFillCategory(player, b)).length;
    return countA - countB;
  });

  categoriesByDifficulty.forEach((category) => {
    const candidates = shuffle(playablePlayers).filter((player) => canPlayerFillCategory(player, category));
    for (const player of candidates) {
      if (selected.size >= maxDeckSize) break;
      if (!selected.has(player.id)) {
        selected.set(player.id, player);
        break;
      }
    }
  });

  // Puis on ajoute un maximum de joueurs utiles.
  const remainingPlayable = shuffle(playablePlayers.filter((player) => !selected.has(player.id)));

  for (const player of remainingPlayable) {
    if (selected.size >= maxDeckSize) break;
    selected.set(player.id, player);
  }

  const deck = [...selected.values()];

  // Si un mode/preset ne fournit pas 75 joueurs utiles, on complète quand même à 75
  // avec le pool du mode, puis avec toute la base en dernier recours.
  const usedIds = new Set(deck.map((player) => player.id));
  const presetPool = getPlayersForPreset(preset);
  const presetFillers = shuffle(presetPool.filter((player) => !usedIds.has(player.id)));

  for (const player of presetFillers) {
    if (deck.length >= maxDeckSize) break;
    deck.push(player);
    usedIds.add(player.id);
  }

  const globalFillers = shuffle(ACTIVE_PLAYERS.filter((player) => !usedIds.has(player.id)));

  for (const player of globalFillers) {
    if (deck.length >= maxDeckSize) break;
    deck.push(player);
    usedIds.add(player.id);
  }

  return shuffle(deck).slice(0, maxDeckSize);
}

function canPlayerFillAnyCell(player, grid) {
  return grid.some((category) => canPlayerFillCategory(player, category));
}

function canPlayerFillCategory(player, category) {
  if (!category?.tags?.length) return false;
  const mode = category.match || "any";
  if (mode === "all") return category.tags.every((tag) => player.tags.includes(tag));
  return category.tags.some((tag) => player.tags.includes(tag));
}

function getPlayerName() {
  const name = playerNameInput.value.trim().slice(0, 20);
  if (!name) alert("Mets un pseudo pour jouer.");
  return name;
}

function setMessage(message, type = "") {
  if (!gameMessageEl) return;
  gameMessageEl.textContent = message;
  gameMessageEl.className = "message";
  if (type) gameMessageEl.classList.add(type);
}

function copyRoomInfo() {
  if (!currentRoomCode) return;
  const url = new URL(window.location.href);
  url.searchParams.set("room", currentRoomCode);
  navigator.clipboard?.writeText(`${currentRoomCode} — ${url.toString()}`);
  if (roomData?.status === "waiting") {
    waitingHostHint.textContent = "Code room copié. Tu peux le partager au chat.";
  } else {
    setMessage("Code room copié.", "good");
  }
}

function leaveRoom() {
  cleanupSubscriptions();
  stopTimers();

  currentRoomCode = null;
  roomData = null;
  myData = null;
  participantsData = [];

  hasShownFinishOverlay = false;
  hideFinishOverlay();

  waitingView.classList.add("hidden");
  gameView.classList.add("hidden");
  topTimer.classList.add("hidden");
  roomPill.classList.add("hidden");
  setupView.classList.remove("hidden");
}

function cleanupSubscriptions() {
  if (unsubscribeRoom) unsubscribeRoom();
  if (unsubscribeMe) unsubscribeMe();
  if (unsubscribePlayers) unsubscribePlayers();

  unsubscribeRoom = null;
  unsubscribeMe = null;
  unsubscribePlayers = null;
}

function generateRoomCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";

  for (let i = 0; i < 5; i++) {
    code += alphabet[Math.floor(Math.random() * alphabet.length)];
  }

  return code;
}

function shuffle(items) {
  const copy = [...items];

  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }

  return copy;
}

function escapeHtml(text) {
  const element = document.createElement("div");
  element.textContent = String(text ?? "");
  return element.innerHTML;
}

const roomFromUrl = new URLSearchParams(window.location.search).get("room");
if (roomFromUrl) joinCodeInput.value = roomFromUrl.toUpperCase();
