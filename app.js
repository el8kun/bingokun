import { firebaseConfig } from "./firebase-config.js";
import { CATEGORIES, PLAYERS, TEAMS } from "./data.js";

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import {
  getAuth,
  signInAnonymously,
  onAuthStateChanged
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

const BOARD_SIZE = 25;
const AUTO_SECONDS = 15;
const MAX_DECK_PLAYERS = 75;
const MIN_PLAYABLE_PLAYERS = 60;

const $ = (id) => document.getElementById(id);

const setupView = $("setupView");
const gameView = $("gameView");
const roomPill = $("roomPill");
const roomCodeDisplay = $("roomCodeDisplay");
const playerNameInput = $("playerName");
const joinCodeInput = $("joinCode");
const boardEl = $("board");
const currentPlayerNameEl = $("currentPlayerName");
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

let uid = null;
let currentRoomCode = null;
let roomData = null;
let myData = null;

let unsubscribeRoom = null;
let unsubscribeMe = null;
let unsubscribePlayers = null;
let clockInterval = null;
let hostInterval = null;

const savedName = localStorage.getItem("bingo-kun-name");
if (savedName) playerNameInput.value = savedName;

onAuthStateChanged(auth, (user) => {
  uid = user?.uid || null;
});

signInAnonymously(auth).catch((error) => {
  alert("Erreur Firebase Auth : " + error.message);
});

$("createRoomBtn").addEventListener("click", createRoom);
$("joinRoomBtn").addEventListener("click", () => joinRoom(joinCodeInput.value.trim().toUpperCase()));
$("copyRoomBtn").addEventListener("click", copyRoomInfo);
$("leaveRoomBtn").addEventListener("click", leaveRoom);
nextPlayerBtn.addEventListener("click", () => advancePlayer(true));

async function createRoom() {
  const name = getPlayerName();
  if (!name) return;
  if (!uid) return alert("Connexion Firebase en cours, réessaie dans 2 secondes.");

  const code = generateRoomCode();
  const setup = generateGameSetup();
  const grid = setup.grid;
  const deck = setup.deck.map((player) => player.id);

  await setDoc(doc(db, "rooms", code), {
    code,
    hostUid: uid,
    grid,
    deck,
    playableCount: setup.playableCount,
    maxDeckPlayers: MAX_DECK_PLAYERS,
    minPlayablePlayers: MIN_PLAYABLE_PLAYERS,
    currentIndex: 0,
    currentStartedAt: serverTimestamp(),
    secondsPerPlayer: AUTO_SECONDS,
    status: "playing",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });

  await setDoc(doc(db, "rooms", code, "participants", uid), {
    name,
    board: {},
    filledCount: 0,
    finalScore: null,
    bingos: [],
    finished: false,
    isHost: true,
    joinedAt: serverTimestamp()
  });

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

  const roomRef = doc(db, "rooms", code);
  const roomSnap = await getDoc(roomRef);

  if (!roomSnap.exists()) {
    alert("Room introuvable.");
    return;
  }

  const participantRef = doc(db, "rooms", code, "participants", uid);
  const participantSnap = await getDoc(participantRef);

  if (!alreadyJoined && !participantSnap.exists()) {
    await setDoc(participantRef, {
      name,
      board: {},
      filledCount: 0,
      finalScore: null,
      bingos: [],
      finished: false,
      isHost: roomSnap.data().hostUid === uid,
      joinedAt: serverTimestamp()
    });
  } else if (!alreadyJoined) {
    await updateDoc(participantRef, { name });
  }

  currentRoomCode = code;
  localStorage.setItem("bingo-kun-name", name);
  showGameView(code);
  subscribeToRoom(code);
  startTimers();
}

function showGameView(code) {
  setupView.classList.add("hidden");
  gameView.classList.remove("hidden");
  roomPill.classList.remove("hidden");
  roomCodeDisplay.textContent = code;
}

function subscribeToRoom(code) {
  cleanupSubscriptions();

  unsubscribeRoom = onSnapshot(doc(db, "rooms", code), (snapshot) => {
    if (!snapshot.exists()) {
      setMessage("La room n’existe plus.", "bad");
      return;
    }

    roomData = snapshot.data();
    renderGame();
  });

  unsubscribeMe = onSnapshot(doc(db, "rooms", code, "participants", uid), (snapshot) => {
    myData = snapshot.exists() ? snapshot.data() : null;
    renderGame();
  });

  unsubscribePlayers = onSnapshot(collection(db, "rooms", code, "participants"), (snapshot) => {
    const players = [];
    snapshot.forEach((item) => players.push(item.data()));

    players.sort((a, b) => {
      if (a.finished && b.finished) return (b.finalScore || 0) - (a.finalScore || 0);
      if (a.finished !== b.finished) return a.finished ? -1 : 1;
      return (b.filledCount || 0) - (a.filledCount || 0);
    });

    leaderboardEl.innerHTML = "";
    players.forEach((player, index) => {
      const li = document.createElement("li");
      const status = player.finished
        ? `${player.finalScore || 0}/25`
        : `${player.filledCount || 0}/25`;
      li.innerHTML = `${index === 0 ? "👑 " : ""}<strong>${escapeHtml(player.name || "Joueur")}</strong> — ${status}`;
      leaderboardEl.appendChild(li);
    });
  });
}

function renderGame() {
  if (!roomData || !myData) return;

  const currentPlayer = getCurrentPlayer();
  const isHost = roomData.hostUid === uid;
  const finished = Boolean(myData.finished);
  const filledCount = myData.filledCount || 0;

  nextPlayerBtn.classList.toggle("hidden", !isHost);

  currentPlayerNameEl.textContent = currentPlayer ? currentPlayer.name : "Fin du deck";

  const deckLength = roomData.deck?.length || 0;
  const currentIndex = roomData.currentIndex || 0;
  const remainingPlayers = currentPlayer ? Math.max(0, deckLength - currentIndex - 1) : 0;

  myFilledEl.textContent = `${filledCount} / 25`;
  playersRemainingEl.textContent = `${remainingPlayers} / ${deckLength}`;

  if (finished) {
    scoreDisplayEl.textContent = myData.finalScore || 0;
    scoreSublineEl.textContent = "score final";
    hiddenResultBox.classList.add("hidden");
    finalResultBox.classList.remove("hidden");
    myResultEl.textContent = `${myData.finalScore || 0} / 25`;
    myBingosEl.textContent = `${(myData.bingos || []).length}`;
  } else {
    scoreDisplayEl.textContent = filledCount;
    scoreSublineEl.textContent = "cases";
    hiddenResultBox.classList.remove("hidden");
    finalResultBox.classList.add("hidden");
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

    const logo = category.logo && TEAMS[category.logo] ? TEAMS[category.logo].short : (category.icon || iconForCategory(category.id));

    cell.innerHTML = `
      <div class="cell-inner">
        <div class="cell-icon">${escapeHtml(logo)}</div>
        <div class="cell-kicker">${escapeHtml(category.kicker || "Critère")}</div>
        <div class="cell-title">${escapeHtml(category.title || category.name || category.id)}</div>
        <div class="cell-footer">
          ${move ? `<div class="placed-player">${escapeHtml(move.playerName)}</div>` : ""}
          ${reveal && move ? `<div class="result-chip ${move.isValid ? "good" : "bad"}">${move.isValid ? "VALIDÉ" : "FAUX"}</div>` : ""}
        </div>
      </div>
    `;

    cell.disabled = Boolean(move) || !currentPlayer || Boolean(myData.finished);
    cell.addEventListener("click", () => placeCurrentPlayer(index));
    boardEl.appendChild(cell);
  });
}

async function placeCurrentPlayer(cellIndex) {
  if (!roomData || !myData || myData.finished) return;

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
    setMessage("Grille complète ! Le verdict est révélé.", "good");
  } else {
    setMessage("Réponse enregistrée. Verdict caché jusqu’à la fin.", "good");
  }

  await updateDoc(doc(db, "rooms", currentRoomCode, "participants", uid), updatePayload);

  // Dès qu'un joueur est placé, on passe au joueur suivant.
  // Le currentIndexAtPlacement évite de sauter plusieurs joueurs si plusieurs personnes cliquent presque en même temps.
  await advancePlayer(false, roomData.currentIndex || 0);
}

async function advancePlayer(manual = false, expectedIndex = null) {
  if (!roomData || !currentRoomCode) return;
  if (manual && roomData.hostUid !== uid) return;

  const roomRef = doc(db, "rooms", currentRoomCode);

  const advanced = await runTransaction(db, async (transaction) => {
    const roomSnap = await transaction.get(roomRef);
    if (!roomSnap.exists()) return false;

    const liveRoom = roomSnap.data();
    const currentIndex = liveRoom.currentIndex || 0;
    const deckLength = liveRoom.deck?.length || 0;

    if (expectedIndex !== null && currentIndex !== expectedIndex) return false;
    if (currentIndex >= deckLength - 1) return false;

    transaction.update(roomRef, {
      currentIndex: currentIndex + 1,
      currentStartedAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });

    return true;
  });

  if (manual && advanced) setMessage("Joueur suivant envoyé.", "good");
}

function startTimers() {
  stopTimers();

  clockInterval = setInterval(() => {
    updateCountdown();
  }, 250);

  hostInterval = setInterval(() => {
    if (!roomData || roomData.hostUid !== uid) return;
    if (getRemainingSeconds() <= 0) advancePlayer(false);
  }, 1000);
}

function stopTimers() {
  if (clockInterval) clearInterval(clockInterval);
  if (hostInterval) clearInterval(hostInterval);
  clockInterval = null;
  hostInterval = null;
}

function updateCountdown() {
  const remaining = getRemainingSeconds();
  const seconds = Math.max(0, Math.ceil(remaining));
  const percent = Math.max(0, Math.min(100, (remaining / AUTO_SECONDS) * 100));

  globalTimerTextEl.textContent = `${seconds}s`;
  globalTimerBarEl.style.width = `${percent}%`;
  circleTimerTextEl.textContent = String(seconds);
  document.documentElement.style.setProperty("--timer-progress", `${percent}%`);
}

function getRemainingSeconds() {
  if (!roomData?.currentStartedAt) return AUTO_SECONDS;

  const startedAt = roomData.currentStartedAt.toMillis
    ? roomData.currentStartedAt.toMillis()
    : Date.now();

  const elapsed = (Date.now() - startedAt) / 1000;
  return AUTO_SECONDS - elapsed;
}

function getCurrentPlayer() {
  if (!roomData?.deck) return null;
  const id = roomData.deck[roomData.currentIndex || 0];
  return PLAYERS.find((player) => player.id === id) || null;
}

function calculateBingos(board) {
  const lines = [];

  for (let row = 0; row < 5; row++) {
    lines.push({ id: `row-${row}`, cells: [0, 1, 2, 3, 4].map((col) => row * 5 + col) });
  }

  for (let col = 0; col < 5; col++) {
    lines.push({ id: `col-${col}`, cells: [0, 1, 2, 3, 4].map((row) => row * 5 + col) });
  }

  lines.push({ id: "diag-1", cells: [0, 6, 12, 18, 24] });
  lines.push({ id: "diag-2", cells: [4, 8, 12, 16, 20] });

  return lines
    .filter((line) => line.cells.every((cellIndex) => board[cellIndex]?.isValid))
    .map((line) => line.id);
}

function getLineCells(lineId) {
  if (lineId.startsWith("row-")) {
    const row = Number(lineId.replace("row-", ""));
    return [0, 1, 2, 3, 4].map((col) => row * 5 + col);
  }

  if (lineId.startsWith("col-")) {
    const col = Number(lineId.replace("col-", ""));
    return [0, 1, 2, 3, 4].map((row) => row * 5 + col);
  }

  if (lineId === "diag-1") return [0, 6, 12, 18, 24];
  if (lineId === "diag-2") return [4, 8, 12, 16, 20];

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


function generateGameSetup() {
  const maxDeckSize = Math.min(MAX_DECK_PLAYERS, PLAYERS.length);
  const requiredPlayable = Math.min(MIN_PLAYABLE_PLAYERS, maxDeckSize);

  let bestSetup = null;

  for (let attempt = 0; attempt < 1500; attempt++) {
    const grid = generateRandomGrid();
    const playablePlayers = PLAYERS.filter((player) => canPlayerFillAnyCell(player, grid));
    const coveredCells = grid.filter((category) => playablePlayers.some((player) => canPlayerFillCategory(player, category))).length;

    const deck = buildDeck(grid, playablePlayers, maxDeckSize);
    const deckPlayableCount = deck.filter((player) => canPlayerFillAnyCell(player, grid)).length;
    const deckCoversEveryCell = grid.every((category) => deck.some((player) => canPlayerFillCategory(player, category)));

    // On favorise d'abord les decks avec au moins 60 joueurs utiles,
    // puis les grilles qui couvrent les 25 cases, puis la variété des types de cases.
    const varietyScore = new Set(grid.map((category) => category.kind || "other")).size;
    const comboScore = grid.filter((category) => category.match === "all").length;
    const score = deckPlayableCount * 1000 + coveredCells * 100 + varietyScore * 10 + comboScore;

    if (!bestSetup || score > bestSetup.score) {
      bestSetup = {
        grid,
        deck,
        playableCount: deckPlayableCount,
        score
      };
    }

    if (
      deck.length <= MAX_DECK_PLAYERS &&
      deckPlayableCount >= requiredPlayable &&
      deckCoversEveryCell
    ) {
      return {
        grid,
        deck,
        playableCount: deckPlayableCount
      };
    }
  }

  console.warn("Bingo Kun : impossible de garantir parfaitement 60 joueurs jouables avec cette base. Meilleure configuration utilisée.", bestSetup);
  return {
    grid: bestSetup.grid,
    deck: bestSetup.deck,
    playableCount: bestSetup.playableCount
  };
}

function generateRandomGrid() {
  const simpleCategories = CATEGORIES.filter((category) => category.match !== "all");
  const comboCategories = CATEGORIES.filter((category) => category.match === "all");

  // Mix volontaire : assez de catégories simples pour garder 60+ joueurs jouables,
  // et plusieurs combos pour que les grilles ne se ressemblent pas.
  const simpleCount = Math.min(17, simpleCategories.length);
  const comboCount = Math.min(8, comboCategories.length, BOARD_SIZE - simpleCount);

  const picked = [
    ...weightedShuffle(simpleCategories).slice(0, simpleCount),
    ...weightedShuffle(comboCategories).slice(0, comboCount)
  ];

  if (picked.length < BOARD_SIZE) {
    const pickedIds = new Set(picked.map((category) => category.id));
    const fallback = weightedShuffle(CATEGORIES.filter((category) => !pickedIds.has(category.id)));
    picked.push(...fallback.slice(0, BOARD_SIZE - picked.length));
  }

  return shuffle(picked).slice(0, BOARD_SIZE);
}

function buildDeck(grid, playablePlayers, maxDeckSize) {
  const selected = new Map();

  // On garantit d'abord que chaque case de la grille peut être remplie par au moins un joueur du deck.
  grid.forEach((category) => {
    const candidates = shuffle(playablePlayers).filter((player) => canPlayerFillCategory(player, category));
    if (candidates[0]) selected.set(candidates[0].id, candidates[0]);
  });

  const requiredPlayable = Math.min(MIN_PLAYABLE_PLAYERS, maxDeckSize);
  const remainingPlayable = shuffle(playablePlayers.filter((player) => !selected.has(player.id)));

  for (const player of remainingPlayable) {
    if (selected.size >= requiredPlayable) break;
    selected.set(player.id, player);
  }

  const selectedIds = new Set(selected.keys());
  const nonPlayablePlayers = shuffle(
    PLAYERS.filter((player) => !selectedIds.has(player.id) && !canPlayerFillAnyCell(player, grid))
  );

  const deck = [...selected.values()];

  for (const player of nonPlayablePlayers) {
    if (deck.length >= maxDeckSize) break;
    deck.push(player);
  }

  // Si la base n'a pas assez de joueurs non jouables, on complète avec d'autres joueurs jouables.
  for (const player of shuffle(PLAYERS.filter((player) => !deck.some((item) => item.id === player.id)))) {
    if (deck.length >= maxDeckSize) break;
    deck.push(player);
  }

  return shuffle(deck).slice(0, maxDeckSize);
}

function canPlayerFillAnyCell(player, grid) {
  return grid.some((category) => canPlayerFillCategory(player, category));
}

function canPlayerFillCategory(player, category) {
  const requiredTags = category.tags || [];
  const playerTags = player.tags || [];

  if (category.match === "all") {
    return requiredTags.every((tag) => playerTags.includes(tag));
  }

  return requiredTags.some((tag) => playerTags.includes(tag));
}

function getPlayerName() {
  const name = playerNameInput.value.trim().slice(0, 20);
  if (!name) alert("Mets un pseudo pour jouer.");
  return name;
}

function setMessage(message, type = "") {
  gameMessageEl.textContent = message;
  gameMessageEl.className = "message";
  if (type) gameMessageEl.classList.add(type);
}

function copyRoomInfo() {
  if (!currentRoomCode) return;
  const url = new URL(window.location.href);
  url.searchParams.set("room", currentRoomCode);
  navigator.clipboard?.writeText(`${currentRoomCode} — ${url.toString()}`);
  setMessage("Code room copié.", "good");
}

function leaveRoom() {
  cleanupSubscriptions();
  stopTimers();

  currentRoomCode = null;
  roomData = null;
  myData = null;

  gameView.classList.add("hidden");
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


function weightedShuffle(items) {
  // On duplique virtuellement les catégories avec un poids plus fort,
  // puis on retire les doublons après mélange. Ça permet de voir plus souvent
  // les catégories fortes sans bloquer l'aléatoire.
  const weighted = [];

  items.forEach((item) => {
    const weight = Math.max(1, Number(item.weight || 1));
    for (let i = 0; i < weight; i++) weighted.push(item);
  });

  const seen = new Set();
  return shuffle(weighted).filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
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
