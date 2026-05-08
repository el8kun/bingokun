import { firebaseConfig } from "./firebase-config.js";
import { CATEGORIES, PLAYERS } from "./data.js";

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
  query,
  orderBy
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const $ = (id) => document.getElementById(id);

const setupView = $("setupView");
const gameView = $("gameView");
const roomPill = $("roomPill");
const roomCodeDisplay = $("roomCodeDisplay");
const playerNameInput = $("playerName");
const joinCodeInput = $("joinCode");
const boardEl = $("board");
const currentPlayerNameEl = $("currentPlayerName");
const currentPlayerMetaEl = $("currentPlayerMeta");
const gameMessageEl = $("gameMessage");
const myScoreEl = $("myScore");
const myBingosEl = $("myBingos");
const leaderboardEl = $("leaderboard");
const nextPlayerBtn = $("nextPlayerBtn");

let uid = null;
let currentRoomCode = null;
let roomData = null;
let myData = null;
let unsubscribeRoom = null;
let unsubscribeMe = null;
let unsubscribeLeaderboard = null;

const safeLocalName = localStorage.getItem("kun-bingo-name");
if (safeLocalName) playerNameInput.value = safeLocalName;

onAuthStateChanged(auth, (user) => {
  uid = user?.uid || null;
});

signInAnonymously(auth).catch((error) => {
  setMessage("Erreur Firebase Auth : " + error.message, "bad");
});

$("createRoomBtn").addEventListener("click", createRoom);
$("joinRoomBtn").addEventListener("click", () => joinRoom(joinCodeInput.value.trim().toUpperCase()));
$("copyRoomBtn").addEventListener("click", copyRoomInfo);
$("leaveRoomBtn").addEventListener("click", leaveRoom);
nextPlayerBtn.addEventListener("click", nextPlayer);

async function createRoom() {
  const name = getPlayerName();
  if (!name || !uid) return;

  const code = generateRoomCode();
  const grid = shuffle(CATEGORIES).slice(0, 25);
  const deck = shuffle(PLAYERS).slice(0, 60).map(p => p.id);

  const roomRef = doc(db, "rooms", code);
  await setDoc(roomRef, {
    code,
    hostUid: uid,
    grid,
    deck,
    currentIndex: 0,
    status: "playing",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });

  await setDoc(doc(db, "rooms", code, "participants", uid), {
    name,
    score: 0,
    bingos: [],
    board: {},
    isHost: true,
    joinedAt: serverTimestamp()
  });

  joinRoom(code, true);
}

async function joinRoom(code, alreadyJoined = false) {
  const name = getPlayerName();
  if (!name || !uid) return;

  if (!/^[A-Z0-9]{4,6}$/.test(code)) {
    setSetupError("Entre un code room valide.");
    return;
  }

  const roomRef = doc(db, "rooms", code);
  const snapshot = await getDoc(roomRef);

  if (!snapshot.exists()) {
    setSetupError("Room introuvable.");
    return;
  }

  if (!alreadyJoined) {
    await setDoc(doc(db, "rooms", code, "participants", uid), {
      name,
      score: 0,
      bingos: [],
      board: {},
      isHost: snapshot.data().hostUid === uid,
      joinedAt: serverTimestamp()
    }, { merge: true });
  }

  currentRoomCode = code;
  localStorage.setItem("kun-bingo-name", name);
  showGameView(code);
  subscribeToRoom(code);
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

  const q = query(collection(db, "rooms", code, "participants"), orderBy("score", "desc"));
  unsubscribeLeaderboard = onSnapshot(q, (snapshot) => {
    leaderboardEl.innerHTML = "";
    snapshot.forEach((docSnap, index) => {
      const player = docSnap.data();
      const li = document.createElement("li");
      li.innerHTML = `<strong>${escapeHtml(player.name || "Joueur")}</strong> — ${player.score || 0}/25`;
      if (index === 0 && (player.score || 0) > 0) li.innerHTML = "👑 " + li.innerHTML;
      leaderboardEl.appendChild(li);
    });
  });
}

function renderGame() {
  if (!roomData || !myData) return;

  const currentPlayer = getCurrentPlayer();
  const isHost = roomData.hostUid === uid;

  nextPlayerBtn.classList.toggle("hidden", !isHost);
  currentPlayerNameEl.textContent = currentPlayer ? currentPlayer.name : "Fin de la manche";
  currentPlayerMetaEl.textContent = currentPlayer
    ? "Clique une case vide compatible avec ce joueur."
    : "Plus aucun joueur dans le deck.";

  myScoreEl.textContent = `${myData.score || 0} / 25`;
  myBingosEl.textContent = `${(myData.bingos || []).length}`;

  renderBoard(currentPlayer);
}

function renderBoard(currentPlayer) {
  boardEl.innerHTML = "";

  const board = myData.board || {};
  const bingoCells = new Set((myData.bingos || []).flatMap(line => getLineCells(line)));

  roomData.grid.forEach((category, index) => {
    const move = board[index];
    const cell = document.createElement("button");
    cell.className = "cell";
    if (move) cell.classList.add(move.isValid ? "filled" : "invalid");
    if (bingoCells.has(index)) cell.classList.add("bingo");

    const categoryDiv = document.createElement("div");
    categoryDiv.className = "category-name";
    categoryDiv.textContent = category.name;

    const hint = document.createElement("small");
    hint.textContent = move ? "Rempli" : "Case vide";

    const placed = document.createElement("div");
    placed.className = "placed-player";
    placed.textContent = move ? move.playerName : "";

    cell.appendChild(categoryDiv);
    cell.appendChild(hint);
    cell.appendChild(placed);

    cell.disabled = Boolean(move) || !currentPlayer;
    cell.addEventListener("click", () => placeCurrentPlayer(index));

    boardEl.appendChild(cell);
  });
}

async function placeCurrentPlayer(cellIndex) {
  if (!roomData || !myData) return;

  const currentPlayer = getCurrentPlayer();
  if (!currentPlayer) return;

  const board = myData.board || {};
  if (board[cellIndex]) {
    setMessage("Cette case est déjà remplie.", "bad");
    return;
  }

  const category = roomData.grid[cellIndex];
  const isValid = category.tags.some(tag => currentPlayer.tags.includes(tag));

  if (!isValid) {
    setMessage(`${currentPlayer.name} ne correspond pas à “${category.name}”.`, "bad");
    return;
  }

  const newBoard = {
    ...board,
    [cellIndex]: {
      playerId: currentPlayer.id,
      playerName: currentPlayer.name,
      categoryId: category.id,
      categoryName: category.name,
      isValid,
      placedAt: Date.now()
    }
  };

  const newBingos = calculateBingos(newBoard);
  const newScore = Object.keys(newBoard).length;

  await updateDoc(doc(db, "rooms", currentRoomCode, "participants", uid), {
    board: newBoard,
    score: newScore,
    bingos: newBingos
  });

  if (newBingos.length > (myData.bingos || []).length) {
    setMessage("BINGO ! Nouvelle ligne complétée 🔥", "good");
  } else {
    setMessage(`${currentPlayer.name} placé sur “${category.name}”.`, "good");
  }
}

async function nextPlayer() {
  if (!roomData || roomData.hostUid !== uid) return;

  const nextIndex = Math.min((roomData.currentIndex || 0) + 1, (roomData.deck || []).length);
  await updateDoc(doc(db, "rooms", currentRoomCode), {
    currentIndex: nextIndex,
    updatedAt: serverTimestamp()
  });

  setMessage("Joueur suivant envoyé à toute la room.", "good");
}

function getCurrentPlayer() {
  if (!roomData?.deck) return null;
  const playerId = roomData.deck[roomData.currentIndex || 0];
  return PLAYERS.find(p => p.id === playerId) || null;
}

function calculateBingos(board) {
  const lines = [];

  for (let r = 0; r < 5; r++) {
    lines.push({ id: `row-${r}`, cells: [0, 1, 2, 3, 4].map(c => r * 5 + c) });
  }

  for (let c = 0; c < 5; c++) {
    lines.push({ id: `col-${c}`, cells: [0, 1, 2, 3, 4].map(r => r * 5 + c) });
  }

  lines.push({ id: "diag-1", cells: [0, 6, 12, 18, 24] });
  lines.push({ id: "diag-2", cells: [4, 8, 12, 16, 20] });

  return lines
    .filter(line => line.cells.every(cellIndex => board[cellIndex]?.isValid))
    .map(line => line.id);
}

function getLineCells(lineId) {
  if (lineId.startsWith("row-")) {
    const r = Number(lineId.replace("row-", ""));
    return [0, 1, 2, 3, 4].map(c => r * 5 + c);
  }

  if (lineId.startsWith("col-")) {
    const c = Number(lineId.replace("col-", ""));
    return [0, 1, 2, 3, 4].map(r => r * 5 + c);
  }

  if (lineId === "diag-1") return [0, 6, 12, 18, 24];
  if (lineId === "diag-2") return [4, 8, 12, 16, 20];
  return [];
}

function getPlayerName() {
  const name = playerNameInput.value.trim().slice(0, 20);

  if (!name) {
    setSetupError("Mets un pseudo pour jouer.");
    return "";
  }

  return name;
}

function setSetupError(message) {
  alert(message);
}

function setMessage(message, type = "") {
  gameMessageEl.textContent = message;
  gameMessageEl.className = "message";
  if (type) gameMessageEl.classList.add(type);
}

function copyRoomInfo() {
  const url = new URL(window.location.href);
  url.searchParams.set("room", currentRoomCode);
  navigator.clipboard?.writeText(`${currentRoomCode} — ${url.toString()}`);
  setMessage("Code room copié.", "good");
}

function leaveRoom() {
  cleanupSubscriptions();
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
  if (unsubscribeLeaderboard) unsubscribeLeaderboard();

  unsubscribeRoom = null;
  unsubscribeMe = null;
  unsubscribeLeaderboard = null;
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
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

const roomFromUrl = new URLSearchParams(window.location.search).get("room");
if (roomFromUrl) {
  joinCodeInput.value = roomFromUrl.toUpperCase();
}
