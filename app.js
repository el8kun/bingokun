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

let uid = null;
let currentRoomCode = null;
let roomData = null;
let myData = null;
let participantsData = [];

let unsubscribeRoom = null;
let unsubscribeMe = null;
let unsubscribePlayers = null;
let clockInterval = null;
let playerAutoInterval = null;

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
$("copyWaitingRoomBtn").addEventListener("click", copyRoomInfo);
$("leaveRoomBtn").addEventListener("click", leaveRoom);
$("leaveWaitingRoomBtn").addEventListener("click", leaveRoom);
startGameBtn.addEventListener("click", startGame);
nextPlayerBtn.addEventListener("click", () => advanceMyPlayer(true));

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

function renderLeaderboard(players = participantsData) {
  const sorted = [...players].sort((a, b) => {
    if (a.finished && b.finished) return (b.finalScore || 0) - (a.finalScore || 0);
    if (a.finished !== b.finished) return a.finished ? -1 : 1;
    return (b.filledCount || 0) - (a.filledCount || 0);
  });

  leaderboardEl.innerHTML = "";
  sorted.forEach((player, index) => {
    const li = document.createElement("li");
    const status = player.finished
      ? `${player.finalScore || 0}/25`
      : `${player.filledCount || 0}/25`;
    li.innerHTML = `${index === 0 ? "👑 " : ""}<strong>${escapeHtml(player.name || "Joueur")}</strong> — ${status}`;
    leaderboardEl.appendChild(li);
  });
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
  const filledCount = myData.filledCount || 0;

  nextPlayerBtn.classList.remove("hidden");
  nextPlayerBtn.disabled = !currentPlayer || finished;

  const deckLength = roomData.deck?.length || 0;
  const currentIndex = getMyCurrentIndex();
  const remainingPlayers = currentPlayer ? Math.max(0, deckLength - currentIndex - 1) : 0;

  currentPlayerNameEl.textContent = currentPlayer ? currentPlayer.name : "Fin du deck";
  currentPlayerInitialsEl.textContent = currentPlayer ? getPlayerInitials(currentPlayer.name) : "✓";
  playerCounterBadgeEl.textContent = currentPlayer ? `Joueur ${currentIndex + 1} / ${deckLength}` : `Deck terminé`;
  currentPlayerSublineEl.textContent = currentPlayer
    ? "Choisis une case vide : ton rythme n'impacte pas les autres joueurs."
    : "Tu as terminé ta liste de joueurs.";

  myFilledEl.textContent = `${filledCount} / 25`;
  playersRemainingEl.textContent = `${remainingPlayers} / ${deckLength}`;
  renderPlayedPlayers(currentIndex);

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

    const logo = category.logo && TEAMS[category.logo] ? TEAMS[category.logo].short : iconForCategory(category.id);

    cell.innerHTML = `
      <div class="cell-inner">
        <div class="cell-icon">${escapeHtml(logo)}</div>
        <div class="cell-kicker">${escapeHtml(category.kicker || "Critère")}</div>
        <div class="cell-title">${escapeHtml(category.title || category.name || category.id)}</div>
        <div class="cell-footer">
          ${move ? `<div class="placed-player">${escapeHtml(move.playerName)}</div>` : ""}
          ${move && !reveal ? `<div class="result-chip pending">PLACÉ</div>` : ""}
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

    transaction.update(participantRef, {
      currentIndex: Math.min(currentIndex + 1, deckLength),
      currentStartedAt: serverTimestamp()
    });

    return true;
  });

  if (manual && advanced) setMessage("Joueur passé pour toi uniquement.", "good");
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
  return PLAYERS.find((player) => player.id === id) || null;
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
      const player = PLAYERS.find((item) => item.id === id);
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

  for (let attempt = 0; attempt < 1200; attempt++) {
    const grid = shuffle(CATEGORIES).slice(0, BOARD_SIZE);
    const playablePlayers = PLAYERS.filter((player) => canPlayerFillAnyCell(player, grid));
    const coveredCells = grid.filter((category) => playablePlayers.some((player) => canPlayerFillCategory(player, category))).length;

    const deck = buildDeck(grid, playablePlayers, maxDeckSize);
    const deckPlayableCount = deck.filter((player) => canPlayerFillAnyCell(player, grid)).length;
    const deckCoversEveryCell = grid.every((category) => deck.some((player) => canPlayerFillCategory(player, category)));

    const score = deckPlayableCount * 100 + coveredCells;

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

function buildDeck(grid, playablePlayers, maxDeckSize) {
  const selected = new Map();

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
