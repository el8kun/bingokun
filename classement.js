import { firebaseConfig } from "./firebase-config.js";

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import { getAuth, signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import { getFirestore, collection, getDocs } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

const firebaseApp = initializeApp(firebaseConfig);
const auth = getAuth(firebaseApp);
const db = getFirestore(firebaseApp);

const $ = (id) => document.getElementById(id);

const monthlyBtn = $("monthlyBtn");
const allTimeBtn = $("allTimeBtn");
const monthSelect = $("monthSelect");
const refreshBtn = $("refreshRankingsBtn");
const rankingTitle = $("rankingTitle");
const rankingList = $("rankingList");
const recentResults = $("recentResults");
const statPlayers = $("statPlayers");
const statGames = $("statGames");
const statBestScore = $("statBestScore");
const statBingos = $("statBingos");

let allResults = [];
let mode = "monthly";
let selectedMonth = getCurrentMonthKey();

monthlyBtn.addEventListener("click", () => {
  mode = "monthly";
  render();
});

allTimeBtn.addEventListener("click", () => {
  mode = "all";
  render();
});

monthSelect.addEventListener("change", () => {
  selectedMonth = monthSelect.value;
  mode = "monthly";
  render();
});

refreshBtn.addEventListener("click", loadResults);

onAuthStateChanged(auth, (user) => {
  if (user) loadResults();
});

signInAnonymously(auth).catch((error) => {
  rankingList.innerHTML = `<div class="empty-ranking">Erreur Firebase Auth : ${escapeHtml(error.message)}</div>`;
});

async function loadResults() {
  rankingList.innerHTML = `<div class="empty-ranking">Chargement du classement...</div>`;

  try {
    const snap = await getDocs(collection(db, "results"));
    allResults = [];
    snap.forEach((docSnap) => allResults.push({ id: docSnap.id, ...docSnap.data() }));
    allResults.sort((a, b) => getMillis(b.finishedAt || b.createdAt) - getMillis(a.finishedAt || a.createdAt));
    buildMonthSelect();
    render();
  } catch (error) {
    rankingList.innerHTML = `<div class="empty-ranking">Impossible de charger les résultats : ${escapeHtml(error.message)}</div>`;
  }
}

function buildMonthSelect() {
  const months = [...new Set(allResults.map((result) => result.monthKey).filter(Boolean))].sort().reverse();
  if (!months.includes(selectedMonth)) months.unshift(selectedMonth);

  monthSelect.innerHTML = months.map((month) => `<option value="${escapeHtml(month)}">${formatMonth(month)}</option>`).join("");
  monthSelect.value = selectedMonth;
}

function render() {
  const filtered = getFilteredResults();
  const rows = aggregateResults(filtered);

  monthlyBtn.classList.toggle("primary-btn", mode === "monthly");
  monthlyBtn.classList.toggle("secondary-btn", mode !== "monthly");
  allTimeBtn.classList.toggle("primary-btn", mode === "all");
  allTimeBtn.classList.toggle("secondary-btn", mode !== "all");

  rankingTitle.textContent = mode === "monthly" ? `Classement ${formatMonth(selectedMonth)}` : "Classement all-time";
  renderStats(filtered, rows);
  renderRanking(rows);
  renderRecent(filtered.slice(0, 14));
}

function getFilteredResults() {
  if (mode === "all") return [...allResults];
  return allResults.filter((result) => result.monthKey === selectedMonth);
}

function aggregateResults(results) {
  const map = new Map();

  for (const result of results) {
    const key = result.playerKey || normalizePlayerKey(result.playerName);
    if (!map.has(key)) {
      map.set(key, {
        playerKey: key,
        playerName: result.playerName || "Joueur",
        games: 0,
        totalScore: 0,
        totalPoints: 0,
        totalBingos: 0,
        bestScore: 0,
        bestPoints: 0,
        perfects: 0,
        totalAccuracy: 0,
        lastPlayedAt: null
      });
    }

    const row = map.get(key);
    const score = Number(result.score ?? result.finalScore ?? 0);
    const bingos = Number(result.bingos ?? 0);
    const points = Number(result.points ?? calculateRankingPoints(score, bingos));
    const accuracy = Number(result.accuracy ?? Math.round((score / 20) * 100));

    row.playerName = result.playerName || row.playerName;
    row.games += 1;
    row.totalScore += score;
    row.totalPoints += points;
    row.totalBingos += bingos;
    row.bestScore = Math.max(row.bestScore, score);
    row.bestPoints = Math.max(row.bestPoints, points);
    row.perfects += score >= 20 ? 1 : 0;
    row.totalAccuracy += accuracy;

    const playedAt = getMillis(result.finishedAt || result.createdAt);
    if (!row.lastPlayedAt || playedAt > row.lastPlayedAt) row.lastPlayedAt = playedAt;
  }

  return [...map.values()].sort((a, b) => {
    if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
    if (b.bestScore !== a.bestScore) return b.bestScore - a.bestScore;
    if (b.totalBingos !== a.totalBingos) return b.totalBingos - a.totalBingos;
    return (b.lastPlayedAt || 0) - (a.lastPlayedAt || 0);
  });
}

function renderStats(results, rows) {
  statPlayers.textContent = rows.length;
  statGames.textContent = results.length;
  const best = results.reduce((max, result) => Math.max(max, Number(result.score ?? result.finalScore ?? 0)), 0);
  const bingos = results.reduce((sum, result) => sum + Number(result.bingos || 0), 0);
  statBestScore.textContent = `${best}/20`;
  statBingos.textContent = bingos;
}

function renderRanking(rows) {
  if (!rows.length) {
    rankingList.innerHTML = `<div class="empty-ranking">Aucun résultat enregistré pour le moment.</div>`;
    return;
  }

  rankingList.innerHTML = rows.map((row, index) => {
    const rank = index + 1;
    const avgScore = row.totalScore / row.games;
    const avgAccuracy = Math.round(row.totalAccuracy / row.games);
    const medal = rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : `#${rank}`;

    return `
      <div class="ranking-row rank-${rank <= 3 ? rank : "other"}">
        <div class="ranking-rank">${medal}</div>
        <div class="ranking-player-block">
          <div class="ranking-player-name">${escapeHtml(row.playerName)}</div>
          <div class="ranking-player-subline">
            ${row.games} partie${row.games > 1 ? "s" : ""} · moyenne ${avgScore.toFixed(1)}/20 · précision ${avgAccuracy}%
          </div>
          <div class="ranking-mini-stats">
            <span>Best ${row.bestScore}/20</span>
            <span>${row.totalBingos} bingo${row.totalBingos > 1 ? "s" : ""}</span>
            <span>${row.perfects} perfect</span>
          </div>
        </div>
        <div class="ranking-points">
          <strong>${row.totalPoints}</strong>
          <span>pts</span>
        </div>
      </div>
    `;
  }).join("");
}

function renderRecent(results) {
  if (!results.length) {
    recentResults.innerHTML = `<div class="empty-ranking">Aucune partie récente.</div>`;
    return;
  }

  recentResults.innerHTML = results.map((result) => {
    const score = Number(result.score ?? result.finalScore ?? 0);
    const bingos = Number(result.bingos || 0);
    const points = Number(result.points ?? calculateRankingPoints(score, bingos));

    return `
      <div class="recent-result">
        <div>
          <strong>${escapeHtml(result.playerName || "Joueur")}</strong>
          <span>${formatDate(result.finishedAt || result.createdAt)} · room ${escapeHtml(result.roomCode || "----")}</span>
        </div>
        <div class="recent-score">
          <strong>${score}/20</strong>
          <span>${bingos} bingo${bingos > 1 ? "s" : ""} · ${points} pts</span>
        </div>
      </div>
    `;
  }).join("");
}

function calculateRankingPoints(score, bingoCount) {
  const perfectBonus = Number(score || 0) >= 20 ? 10 : 0;
  const bingoBonus = Number(bingoCount || 0) >= 5 ? 5 : 0;
  return Number(score || 0) + (Number(bingoCount || 0) * 3) + perfectBonus + bingoBonus;
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

function formatDate(timestamp) {
  const millis = getMillis(timestamp);
  if (!millis) return "date inconnue";
  return new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(millis));
}

function getMillis(timestamp) {
  if (!timestamp) return 0;
  if (timestamp.toMillis) return timestamp.toMillis();
  if (timestamp.seconds) return timestamp.seconds * 1000;
  if (typeof timestamp === "number") return timestamp;
  return Date.parse(timestamp) || 0;
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

function escapeHtml(text) {
  const element = document.createElement("div");
  element.textContent = String(text ?? "");
  return element.innerHTML;
}
