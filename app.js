import { CATEGORIES, PLAYERS, TEAMS } from "./data.js";
import { supabaseConfig } from "./supabase-config.js";
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

const supabaseEnabled = Boolean(
  supabaseConfig?.url &&
  supabaseConfig?.anonKey &&
  !String(supabaseConfig.url).includes("COLLE_") &&
  !String(supabaseConfig.anonKey).includes("COLLE_")
);
const supabase = supabaseEnabled ? createClient(supabaseConfig.url, supabaseConfig.anonKey) : null;

function getOrCreateLocalUid() {
  let value = localStorage.getItem("bingo-kun-uid");

  if (!value) {
    value = "guest_" + crypto.randomUUID();
    localStorage.setItem("bingo-kun-uid", value);
  }

  return value;
}


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


function mapSupabasePlayer(row) {
  return {
    id: row.id,
    name: row.name || row.id,
    baseName: row.base_name || row.name || row.id,
    position: row.position || "",
    birthDate: row.birth_date || "",
    tags: Array.isArray(row.tags) ? row.tags : [],
    logos: Array.isArray(row.logos) ? row.logos : []
  };
}

function mapSupabaseCategory(row) {
  return {
    id: row.id,
    sourceIds: Array.isArray(row.source_ids) ? row.source_ids : [],
    kicker: row.kicker || "Catégorie",
    title: row.title || row.name || row.id,
    name: row.name || row.title || row.id,
    type: row.type,
    tags: Array.isArray(row.tags) ? row.tags : [],
    match: row.match_rule || "all",
    logo: row.logo || row.id,
    helperText: row.helper_text || "",
    visualType: row.visual_type || "default",
    image: row.image || "",
    shortLabel: row.short_label || "",
    visuals: Array.isArray(row.visuals) ? row.visuals : []
  };
}

async function fetchAllSupabaseRows(table, select) {
  if (!supabase) return [];

  const pageSize = 1000;
  let from = 0;
  let rows = [];

  while (true) {
    const { data, error } = await supabase
      .from(table)
      .select(select)
      .eq("enabled", true)
      .range(from, from + pageSize - 1);

    if (error) throw error;

    rows = rows.concat(data || []);

    if (!data || data.length < pageSize) break;
    from += pageSize;
  }

  return rows;
}

async function loadSupabaseDatabase() {
  if (!supabaseEnabled || !supabase) {
    return false;
  }

  const [playerRows, categoryRows] = await Promise.all([
    fetchAllSupabaseRows("players", "id,name,base_name,position,birth_date,tags,logos,enabled"),
    fetchAllSupabaseRows("categories", "id,title,name,kicker,type,match_rule,tags,source_ids,logo,visual_type,image,short_label,helper_text,visuals,enabled")
  ]);

  if (!playerRows.length || !categoryRows.length) {
    console.warn("Bingo Kun : Supabase vide, fallback data.js.");
    return false;
  }

  ACTIVE_PLAYERS = playerRows.map(mapSupabasePlayer);
  ACTIVE_CATEGORIES = categoryRows.map(mapSupabaseCategory);

  console.info(`Bingo Kun : données chargées depuis Supabase (${ACTIVE_PLAYERS.length} joueurs, ${ACTIVE_CATEGORIES.length} catégories).`);
  return true;
}



function nowIso() {
  return new Date().toISOString();
}

function parseRoomPreset(rawPreset = "") {
  const value = String(rawPreset || "");
  if (value.startsWith(`${GAME_MODE_SUDDEN_DEATH}:`)) {
    return {
      gameMode: GAME_MODE_SUDDEN_DEATH,
      preset: value.replace(`${GAME_MODE_SUDDEN_DEATH}:`, "") || "global-normal"
    };
  }

  return {
    gameMode: GAME_MODE_BINGO,
    preset: value || "global-normal"
  };
}

function encodeRoomPreset(preset, gameMode = GAME_MODE_BINGO) {
  return gameMode === GAME_MODE_SUDDEN_DEATH ? `${GAME_MODE_SUDDEN_DEATH}:${preset}` : preset;
}

function getGameModeLabel(gameMode = GAME_MODE_BINGO) {
  return gameMode === GAME_MODE_SUDDEN_DEATH ? "Mort Subite" : "Bingo classique";
}

function isSuddenDeathMode(gameMode = roomData?.gameMode || selectedGameMode) {
  return gameMode === GAME_MODE_SUDDEN_DEATH;
}

function getDeckSizeForMode(gameMode = selectedGameMode) {
  return isSuddenDeathMode(gameMode) ? SUDDEN_DEATH_DECK_PLAYERS : MAX_DECK_PLAYERS;
}

function getRequiredPlayableForMode(gameMode = selectedGameMode) {
  return isSuddenDeathMode(gameMode) ? SUDDEN_DEATH_MIN_PLAYABLE_PLAYERS : MIN_PLAYABLE_PLAYERS;
}

function roomRowToApp(row) {
  if (!row) return null;

  const parsed = parseRoomPreset(row.preset || "");

  return {
    code: row.code,
    status: row.status || "waiting",
    hostUid: row.host_uid || "",
    preset: parsed.preset,
    rawPreset: row.preset || "",
    gameMode: parsed.gameMode,
    presetLabel: row.preset_label || "",
    grid: Array.isArray(row.grid) ? row.grid : [],
    deck: Array.isArray(row.deck) ? row.deck : [],
    playableCount: row.playable_count || 0,
    comboCount: row.combo_count || 0,
    scoreMax: row.score_max || 30,
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null,
    gameStartedAt: row.game_started_at || null
  };
}

function participantRowToApp(row) {
  if (!row) return null;

  return {
    id: row.uid,
    rowId: row.id,
    uid: row.uid,
    name: row.name || "Joueur",
    isHost: Boolean(row.is_host),
    currentIndex: Number(row.current_index || 0),
    board: row.board && typeof row.board === "object" ? row.board : {},
    filledCount: Number(row.filled_count || 0),
    finished: Boolean(row.finished),
    finalScore: row.final_score ?? null,
    validCells: row.valid_cells ?? null,
    scoreMax: row.score_max || 30,
    bingos: Array.isArray(row.bingos) ? row.bingos : [],
    resultSaved: Boolean(row.result_saved),
    finishReason: row.finish_reason || null,
    joinedAt: row.joined_at || null,
    updatedAt: row.updated_at || null
  };
}

function participantPayloadToSupabase(payload = {}) {
  const row = {};

  if ("name" in payload) row.name = payload.name;
  if ("isHost" in payload) row.is_host = Boolean(payload.isHost);
  if ("currentIndex" in payload) row.current_index = Number(payload.currentIndex || 0);
  if ("board" in payload) row.board = payload.board || {};
  if ("filledCount" in payload) row.filled_count = Number(payload.filledCount || 0);
  if ("finished" in payload) row.finished = Boolean(payload.finished);
  if ("finalScore" in payload) row.final_score = payload.finalScore == null ? null : Number(payload.finalScore);
  if ("validCells" in payload) row.valid_cells = payload.validCells == null ? null : Number(payload.validCells);
  if ("scoreMax" in payload) row.score_max = Number(payload.scoreMax || 30);
  if ("bingos" in payload) row.bingos = Array.isArray(payload.bingos) ? payload.bingos : [];
  if ("resultSaved" in payload) row.result_saved = Boolean(payload.resultSaved);
  if ("finishReason" in payload) row.finish_reason = payload.finishReason || null;

  row.updated_at = nowIso();
  return row;
}

async function supabaseGetRoom(code) {
  const { data, error } = await supabase
    .from("rooms")
    .select("*")
    .eq("code", code)
    .maybeSingle();

  if (error) throw error;
  return roomRowToApp(data);
}

async function supabaseGetParticipant(code, userId) {
  const { data, error } = await supabase
    .from("participants")
    .select("*")
    .eq("room_code", code)
    .eq("uid", userId)
    .maybeSingle();

  if (error) throw error;
  return participantRowToApp(data);
}

async function supabaseLoadParticipants(code) {
  const { data, error } = await supabase
    .from("participants")
    .select("*")
    .eq("room_code", code)
    .order("joined_at", { ascending: true });

  if (error) throw error;
  return (data || []).map(participantRowToApp);
}

async function supabaseUpdateParticipant(payload) {
  if (!currentRoomCode || !uid) return;

  const { error } = await supabase
    .from("participants")
    .update(participantPayloadToSupabase(payload))
    .eq("room_code", currentRoomCode)
    .eq("uid", uid);

  if (error) throw error;
}

async function supabaseInsertResult(result) {
  const { error } = await supabase
    .from("results")
    .upsert(result, { onConflict: "id" });

  if (error) throw error;
}


let ACTIVE_PLAYERS = clonePlayers(PLAYERS);
let ACTIVE_CATEGORIES = cloneCategories(CATEGORIES);
let databaseOverridesLoaded = false;

async function loadDatabaseOverrides(force = false) {
  if (databaseOverridesLoaded && !force) return;

  ACTIVE_PLAYERS = clonePlayers(PLAYERS);
  ACTIVE_CATEGORIES = cloneCategories(CATEGORIES);

  let loadedFromSupabase = false;

  try {
    loadedFromSupabase = await loadSupabaseDatabase();
  } catch (error) {
    console.warn("Bingo Kun : impossible de charger Supabase, fallback data.js.", error);
    loadedFromSupabase = false;
    ACTIVE_PLAYERS = clonePlayers(PLAYERS);
    ACTIVE_CATEGORIES = cloneCategories(CATEGORIES);
  }

  categoryMatchCache = new Map();
  databaseOverridesLoaded = true;

  if (presetHelp) {
    const source = loadedFromSupabase ? "Données : Supabase" : "Données : data.js secours";
    if (!presetHelp.textContent.includes("Données :")) {
      presetHelp.textContent = `${presetHelp.textContent || ""} · ${source}`;
    }
  }
}

const BOARD_ROWS = 4;
const BOARD_COLS = 5;
const BOARD_SIZE = BOARD_ROWS * BOARD_COLS;
const AUTO_SECONDS = 15;
const GAME_MODE_BINGO = "bingo";
const GAME_MODE_SUDDEN_DEATH = "sudden-death";
const MAX_DECK_PLAYERS = 75;
const SUDDEN_DEATH_DECK_PLAYERS = 100;
const MIN_PLAYABLE_PLAYERS = 65;
const SUDDEN_DEATH_MIN_PLAYABLE_PLAYERS = 80;
const SUDDEN_DEATH_MAX_CONSECUTIVE_SKIPS = 3;
const MIN_PLAYERS_PER_STANDARD_CELL = 3;
const MIN_PLAYERS_PER_COMBO_CELL = 2;
const EXACT_COMBO_CELLS = 5;
const SIMPLE_CELL_POINTS = 1;
const COMBO_CELL_POINTS = 3;

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
const adminLoginOverlay = $("adminLoginOverlay");
const adminLoginForm = $("adminLoginForm");
const adminEmailInput = $("adminEmailInput");
const adminPasswordInput = $("adminPasswordInput");
const adminLoginCancelBtn = $("adminLoginCancelBtn");
const adminLoginMessage = $("adminLoginMessage");
const adminLoginSubmitBtn = $("adminLoginSubmitBtn");
const adminHeaderLink = $("adminHeaderLink");
const creatorLockedNotice = $("creatorLockedNotice");
const createRoomBtn = $("createRoomBtn");
const gameModeSelect = $("gameMode");
const gameModeHelp = $("gameModeHelp");
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
const openFinishRecapBtn = $("openFinishRecapBtn");
const openFinishRankingBtn = $("openFinishRankingBtn");
const historyReopenHint = $("historyReopenHint");
const rankingReopenHint = $("rankingReopenHint");
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
const recapOverlay = $("recapOverlay");
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
const finishRankingStatsEl = $("finishRankingStats");
const finishRankingListEl = $("finishRankingList");
const closeFinishOverlayBtn = $("closeFinishOverlayBtn");
const closeRecapOverlayBtn = $("closeRecapOverlayBtn");
const showRecapFromRankingBtn = $("showRecapFromRankingBtn");
const showRankingFromRecapBtn = $("showRankingFromRecapBtn");
const copyFinishRoomBtn = $("copyFinishRoomBtn");
const finishHomeBtn = $("finishHomeBtn");
const finishNewRoomBtn = $("finishNewRoomBtn");

let uid = getOrCreateLocalUid();
let currentSupabaseUser = null;
let isAdminUser = false;
let selectedGameMode = GAME_MODE_BINGO;
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
let actionInProgress = false;
let actionLockStartedAt = 0;
let lastBoardRenderKey = "";
let lastAutoAdvanceAt = 0;
let localTimerKey = "";
let localTimerStartedAtMs = 0;
let lastPlayerActionAt = 0;
let participantsLoadedForFinish = false;
let participantsLoadingOnce = false;
let roomPollInterval = null;
let mePollInterval = null;
let participantsPollInterval = null;

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

function updateGameModeHelp() {
  if (!gameModeHelp) return;

  gameModeHelp.textContent = selectedGameMode === GAME_MODE_SUDDEN_DEATH
    ? "Mort Subite : 100 joueurs, une erreur élimine, 3 skips consécutifs maximum."
    : "Bingo classique : 75 joueurs, fonctionnement actuel.";
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
  updateGameModeHelp();
}


refreshSupabaseAuthUi().then(() => {
  updateAdminUi(currentSupabaseUser);
});

supabase?.auth?.onAuthStateChange(async (_event, session) => {
  currentSupabaseUser = session?.user || null;
  uid = currentSupabaseUser?.id || getOrCreateLocalUid();
  isAdminUser = currentSupabaseUser ? await checkIsAdmin(currentSupabaseUser.id) : false;
  updateAdminUi(currentSupabaseUser);
});

loadDatabaseOverrides().then(() => {
  selectedGameMode = gameModeSelect?.value || selectedGameMode || GAME_MODE_BINGO;
  selectedPreset = presetModeSelect?.value || selectedPreset || "global-normal";
  updateGameModeHelp();
  updatePresetHelp();
  renderCustomBuilder();
});

createRoomBtn?.addEventListener("click", async () => {
  try {
    if (createRoomBtn) {
      createRoomBtn.disabled = true;
      createRoomBtn.textContent = "Création en cours...";
    }
    await createRoom();
  } catch (error) {
    console.error("Erreur création room :", error);
    alert("Erreur création room : " + (error?.message || error));
  } finally {
    if (createRoomBtn) {
      createRoomBtn.disabled = false;
      createRoomBtn.textContent = "Créer une room";
    }
  }
});
adminLoginBtn?.addEventListener("click", signInAdmin);
adminLogoutBtn?.addEventListener("click", signOutAdmin);
adminLoginCancelBtn?.addEventListener("click", hideAdminLoginModal);
adminLoginOverlay?.addEventListener("click", (event) => {
  if (event.target === adminLoginOverlay) hideAdminLoginModal();
});
adminLoginForm?.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (adminLoginMessage) {
    adminLoginMessage.textContent = "Connexion en cours...";
    adminLoginMessage.className = "admin-login-message";
  }

  if (adminLoginSubmitBtn) {
    adminLoginSubmitBtn.disabled = true;
    adminLoginSubmitBtn.textContent = "Connexion...";
  }

  try {
    await performAdminLogin(adminEmailInput?.value, adminPasswordInput?.value);
    if (adminPasswordInput) adminPasswordInput.value = "";
  } catch (error) {
    if (adminLoginMessage) {
      adminLoginMessage.textContent = error?.message || "Connexion impossible.";
      adminLoginMessage.className = "admin-login-message bad";
    }
    console.error("Connexion admin impossible :", error);
  } finally {
    if (adminLoginSubmitBtn) {
      adminLoginSubmitBtn.disabled = false;
      adminLoginSubmitBtn.textContent = "Se connecter";
    }
  }
});
gameModeSelect?.addEventListener("change", () => {
  selectedGameMode = gameModeSelect.value || GAME_MODE_BINGO;
  updateGameModeHelp();
});

presetModeSelect?.addEventListener("change", () => {
  selectedPreset = presetModeSelect.value || "global-normal";
  categoryMatchCache = new Map();
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
closeFinishOverlayBtn?.addEventListener("click", hideAllFinishOverlays);
closeRecapOverlayBtn?.addEventListener("click", hideAllFinishOverlays);
showRecapFromRankingBtn?.addEventListener("click", () => {
  if (myData?.finished) {
    renderFinishRecap();
    showRecapOverlay();
  }
});
showRankingFromRecapBtn?.addEventListener("click", () => {
  if (myData?.finished) {
    renderFinishRanking();
    showFinishOverlay();
  }
});
copyFinishRoomBtn?.addEventListener("click", copyRoomInfo);
finishHomeBtn?.addEventListener("click", goHomeFromFinish);
finishNewRoomBtn?.addEventListener("click", recreateRoomFromFinish);

openFinishRecapBtn?.addEventListener("click", () => {
  if (myData?.finished) {
    if (!participantsLoadedForFinish) loadParticipantsOnce("recap");
    renderFinishRecap();
    showRecapOverlay();
  }
});

openFinishRankingBtn?.addEventListener("click", () => {
  if (myData?.finished) {
    if (!participantsLoadedForFinish) loadParticipantsOnce("ranking");
    renderFinishRanking();
    showFinishOverlay();
  }
});

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



function setActionLock(locked) {
  actionInProgress = Boolean(locked);
  actionLockStartedAt = actionInProgress ? Date.now() : 0;

  // Important : on ne désactive plus visuellement toute la grille.
  // Les versions précédentes pouvaient laisser l'interface bloquée.
  if (boardEl) boardEl.classList.remove("is-action-locked");
}

function clearStaleActionLock() {
  if (!actionInProgress) return;
  if (Date.now() - actionLockStartedAt > 2500) {
    console.warn("Bingo Kun : verrou d'action débloqué automatiquement.");
    actionInProgress = false;
    actionLockStartedAt = 0;
  }
}

function canStartPlayerAction() {
  clearStaleActionLock();

  const now = Date.now();
  if (now - lastPlayerActionAt < 650) return false;
  if (actionInProgress) return false;

  lastPlayerActionAt = now;
  return true;
}

async function runPlayerAction(callback) {
  if (!canStartPlayerAction()) return false;

  actionInProgress = true;
  actionLockStartedAt = Date.now();

  try {
    await callback();
    return true;
  } catch (error) {
    console.error("Bingo Kun : action joueur impossible.", error);
    setMessage("Action impossible : " + (error?.message || "réessaie."), "bad");
    return false;
  } finally {
    actionInProgress = false;
    actionLockStartedAt = 0;
    lastBoardRenderKey = "";
    renderBoardIfNeeded(getCurrentPlayer());
  }
}


function withTimeout(promise, ms = 8000, label = "Action trop longue") {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error(label)), ms);
    })
  ]);
}

async function checkIsAdmin(userId) {
  if (!supabase || !userId) return false;

  try {
    // Priorité à la fonction SQL public.is_admin(), plus fiable avec RLS.
    const rpcResult = await withTimeout(
      supabase.rpc("is_admin"),
      5000,
      "Vérification admin trop longue"
    );

    if (!rpcResult.error && rpcResult.data === true) return true;

    // Fallback si la fonction RPC n'existe pas encore.
    const result = await withTimeout(
      supabase
        .from("admins")
        .select("uid,role")
        .eq("uid", userId)
        .maybeSingle(),
      5000,
      "Lecture admins trop longue"
    );

    if (result.error) throw result.error;
    return Boolean(result.data?.uid);
  } catch (error) {
    console.warn("Vérification admin Supabase impossible :", error);
    return false;
  }
}

async function refreshSupabaseAuthUi() {
  if (!supabase) return;

  const { data } = await supabase.auth.getSession();
  currentSupabaseUser = data?.session?.user || null;

  uid = currentSupabaseUser?.id || getOrCreateLocalUid();
  isAdminUser = currentSupabaseUser ? await checkIsAdmin(currentSupabaseUser.id) : false;

  updateAdminUi(currentSupabaseUser);
}

function updateAdminUi(user = currentSupabaseUser) {
  const isLogged = Boolean(user);

  adminLoginBtn?.classList.toggle("hidden", isAdminUser);
  adminLogoutBtn?.classList.toggle("hidden", !isLogged);
  adminHeaderLink?.classList.toggle("hidden", !isAdminUser);
  creatorLockedNotice?.classList.toggle("hidden", isAdminUser);

  if (createRoomBtn) {
    createRoomBtn.disabled = false;
    createRoomBtn.textContent = "Créer une room";
  }

  if (adminAuthStatus) {
    if (isAdminUser) {
      adminAuthStatus.textContent = "Admin Supabase connecté";
      adminAuthStatus.className = "admin-auth-status good";
    } else if (isLogged) {
      adminAuthStatus.textContent = "Compte connecté mais non admin";
      adminAuthStatus.className = "admin-auth-status bad";
    } else {
      adminAuthStatus.textContent = "Mode joueur";
      adminAuthStatus.className = "admin-auth-status";
    }
  }
}

function showAdminLoginModal() {
  if (!adminLoginOverlay) return alert("Fenêtre de connexion introuvable. Recharge la page avec Ctrl + F5.");

  if (adminLoginMessage) adminLoginMessage.textContent = "";
  adminLoginOverlay.classList.remove("hidden");
  document.body.classList.add("overlay-open");
  setTimeout(() => adminEmailInput?.focus(), 50);
}

function hideAdminLoginModal() {
  adminLoginOverlay?.classList.add("hidden");
  document.body.classList.remove("overlay-open");
}

async function signInAdmin() {
  if (!supabase) return alert("Supabase n'est pas configuré.");
  showAdminLoginModal();
}

async function performAdminLogin(email, password) {
  if (!supabase) throw new Error("Supabase n'est pas configuré.");

  const loginResult = await withTimeout(
    supabase.auth.signInWithPassword({
      email: String(email || "").trim(),
      password: String(password || "")
    }),
    9000,
    "Connexion trop longue. Vérifie ton mot de passe ou recharge la page."
  );

  if (loginResult.error) throw loginResult.error;

  currentSupabaseUser = loginResult.data?.user || null;
  uid = currentSupabaseUser?.id || getOrCreateLocalUid();

  if (!currentSupabaseUser) {
    throw new Error("Connexion réussie mais aucun utilisateur reçu.");
  }

  if (adminLoginMessage) {
    adminLoginMessage.textContent = "Connexion OK, vérification admin...";
    adminLoginMessage.className = "admin-login-message";
  }

  isAdminUser = await checkIsAdmin(currentSupabaseUser.id);
  updateAdminUi(currentSupabaseUser);

  if (!isAdminUser) {
    throw new Error("Connecté, mais ce compte n'est pas autorisé admin. Vérifie la table admins et la policy SQL.");
  }

  hideAdminLoginModal();
}

async function signOutAdmin() {
  if (!supabase) return;

  try {
    await supabase.auth.signOut();
    currentSupabaseUser = null;
    uid = getOrCreateLocalUid();
    isAdminUser = false;
    updateAdminUi(null);
  } catch (error) {
    alert("Déconnexion impossible : " + error.message);
  }
}

async function createRoom() {
  const name = getPlayerName();
  if (!name) return;
  if (!uid) uid = getOrCreateLocalUid();
  if (!supabase) return alert("Supabase n'est pas configuré.");

  await refreshSupabaseAuthUi();

  if (!isAdminUser) {
    alert(
      "Seul le compte admin Supabase peut créer une room.\n\n" +
      "Connecte-toi avec le bouton Admin, puis vérifie que ton UID est dans la table admins."
    );
    return;
  }

  await loadDatabaseOverrides(true);

  selectedGameMode = gameModeSelect?.value || selectedGameMode || GAME_MODE_BINGO;
  selectedPreset = presetModeSelect?.value || selectedPreset || "global-normal";

  let code = generateRoomCode();
  const requestedGrid = getRequestedCustomGrid();

  if (gridModeSelect?.value === "custom" && !requestedGrid.length) {
    alert("Choisis au moins une catégorie pour lancer un Bingo custom.");
    return;
  }

  const setup = generateGameSetup(requestedGrid, selectedPreset, selectedGameMode);

  const expectedDeckSize = getDeckSizeForMode(selectedGameMode);
  const expectedPlayable = getRequiredPlayableForMode(selectedGameMode);

  if (!setup.perfectSolvable || setup.deck.length !== expectedDeckSize || setup.playableCount < expectedPlayable || setup.comboCount !== EXACT_COMBO_CELLS) {
    alert(
      "Impossible de générer une grille équilibrée avec ces paramètres.\n\n" +
      `Mode : ${getGameModeLabel(selectedGameMode)}\n` +
      `Objectif : ${expectedDeckSize} joueurs, minimum ${expectedPlayable} utiles, minimum 3 solutions par case simple, 2 par combo, exactement ${EXACT_COMBO_CELLS} combos.\n\n` +
      "Essaie un autre type de partie, ou enlève quelques catégories custom trop rares."
    );
    return;
  }

  const grid = setup.grid;
  const deck = setup.deck.map((player) => player.id);
  const now = nowIso();

  const roomRow = {
    code,
    status: "waiting",
    host_uid: uid,
    preset: encodeRoomPreset(selectedPreset, selectedGameMode),
    preset_label: `${getGameModeLabel(selectedGameMode)} — ${presetModeSelect?.selectedOptions?.[0]?.textContent || selectedPreset}`,
    grid,
    deck,
    playable_count: setup.playableCount,
    combo_count: setup.comboCount || countComboCells(grid),
    score_max: getMaxBoardScore(grid),
    created_at: now,
    updated_at: now
  };

  let insertedRoom = null;

  for (let attempt = 0; attempt < 3; attempt++) {
    const { data, error } = await supabase
      .from("rooms")
      .insert(roomRow)
      .select("*")
      .single();

    if (!error) {
      insertedRoom = data;
      break;
    }

    if (String(error.code) === "23505") {
      code = generateRoomCode();
      roomRow.code = code;
      continue;
    }

    throw error;
  }

  if (!insertedRoom) {
    alert("Impossible de créer une room, réessaie.");
    return;
  }

  await supabase
    .from("participants")
    .upsert({
      room_code: code,
      uid,
      name,
      is_host: true,
      current_index: 0,
      board: {},
      filled_count: 0,
      finished: false,
      score_max: getMaxBoardScore(grid),
      bingos: [],
      result_saved: false,
      joined_at: now,
      updated_at: now
    }, { onConflict: "room_code,uid" });

  localStorage.setItem("bingo-kun-name", name);
  await joinRoom(code, true);
}

async function joinRoom(code, alreadyJoined = false) {
  const name = getPlayerName();
  if (!name) return;
  if (!uid) uid = getOrCreateLocalUid();
  if (!supabase) return alert("Supabase n'est pas configuré.");

  if (!/^[A-Z0-9]{4,6}$/.test(code)) {
    alert("Entre un code room valide.");
    return;
  }

  await loadDatabaseOverrides(true);

  const room = await supabaseGetRoom(code);

  if (!room) {
    alert("Room introuvable.");
    return;
  }

  const participant = await supabaseGetParticipant(code, uid);

  if (room.status !== "waiting" && !participant) {
    alert("La partie a déjà commencé. Tu pourras rejoindre la prochaine room.");
    return;
  }

  if (!alreadyJoined && !participant) {
    const now = nowIso();
    const { error } = await supabase
      .from("participants")
      .insert({
        room_code: code,
        uid,
        name,
        is_host: room.hostUid === uid,
        current_index: 0,
        board: {},
        filled_count: 0,
        finished: false,
        score_max: room.scoreMax || 30,
        bingos: [],
        result_saved: false,
        joined_at: now,
        updated_at: now
      });

    if (error) throw error;
  } else if (!alreadyJoined) {
    const { error } = await supabase
      .from("participants")
      .update({ name, updated_at: nowIso() })
      .eq("room_code", code)
      .eq("uid", uid);

    if (error) throw error;
  }

  currentRoomCode = code;
  roomData = room;
  myData = await supabaseGetParticipant(code, uid);
  participantsData = [];

  hasShownFinishOverlay = false;
  resetLocalTimer();
  if (historyReopenHint) historyReopenHint.classList.add("hidden");
  if (rankingReopenHint) rankingReopenHint.classList.add("hidden");
  hideFinishOverlay();

  const cleanUrl = new URL(window.location.href);
  cleanUrl.searchParams.delete("room");
  window.history.replaceState({}, "", cleanUrl.toString());
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
    joinedAt: nowIso()
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
  participantsLoadedForFinish = false;
  participantsLoadingOnce = false;

  async function refreshRoomAndMe() {
    try {
      const [room, participant] = await Promise.all([
        supabaseGetRoom(code),
        supabaseGetParticipant(code, uid)
      ]);

      if (!room) {
        setMessage("La room n’existe plus.", "bad");
        cleanupSubscriptions();
        return;
      }

      roomData = room;
      myData = participant;
      mergeMyParticipantData();
      renderViews();
    } catch (error) {
      console.warn("Bingo Kun Supabase refresh error:", error);
    }
  }

  async function refreshParticipantsLobby() {
    if (!roomData || roomData.status !== "waiting") return;

    try {
      participantsData = await supabaseLoadParticipants(code);
      mergeMyParticipantData();
      renderParticipants();
      renderViews();
    } catch (error) {
      console.warn("Participants lobby refresh impossible:", error);
    }
  }

  refreshRoomAndMe();
  refreshParticipantsLobby();

  roomPollInterval = setInterval(refreshRoomAndMe, 1200);
  mePollInterval = setInterval(refreshRoomAndMe, 900);
  participantsPollInterval = setInterval(refreshParticipantsLobby, 2500);

  unsubscribeRoom = () => {
    if (roomPollInterval) clearInterval(roomPollInterval);
    roomPollInterval = null;
  };

  unsubscribeMe = () => {
    if (mePollInterval) clearInterval(mePollInterval);
    mePollInterval = null;
  };

  unsubscribePlayers = () => {
    if (participantsPollInterval) clearInterval(participantsPollInterval);
    participantsPollInterval = null;
  };
}


function mergeMyParticipantData() {
  if (!uid || !myData) return;

  const existingIndex = participantsData.findIndex((player) => player.id === uid);
  const merged = { id: uid, ...myData };

  if (existingIndex >= 0) {
    participantsData[existingIndex] = merged;
  } else {
    participantsData.push(merged);
  }
}

async function loadParticipantsOnce(reason = "") {
  if (!currentRoomCode || participantsLoadingOnce) return;

  participantsLoadingOnce = true;

  try {
    participantsData = await supabaseLoadParticipants(currentRoomCode);
    mergeMyParticipantData();
    participantsLoadedForFinish = true;

    renderLeaderboard(participantsData);
    if (myData?.finished) renderFinishRanking();
  } catch (error) {
    console.warn("Bingo Kun : impossible de charger les participants une fois.", error);
    setMessage("Impossible de charger le classement complet pour l'instant.", "bad");
  } finally {
    participantsLoadingOnce = false;
  }
}



function renderViews() {
  if (!roomData || !myData) return;

  clearStaleActionLock();

  if (roomData.status === "waiting") {
    participantsLoadedForFinish = false;
    lastBoardRenderKey = "";
    resetLocalTimer();
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
    ? `Tu es le créateur de la room. Mode : ${getGameModeLabel(roomData.gameMode)}. Lance la partie quand tout le monde est là.`
    : `En attente du créateur de la room. Mode : ${getGameModeLabel(roomData.gameMode)}.`;

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
  const economyNotice = roomData?.status === "playing" && !participantsLoadedForFinish
    ? `<div class="leaderboard-economy">Classement allégé pendant la partie pour limiter les requêtes.</div>`
    : "";

  leaderboardEl.innerHTML = economyNotice + sorted.map((player, index) => {
    const rank = index + 1;
    const isFinished = Boolean(player.finished);
    const liveScore = calculateBoardScore(player.board || {}, roomData?.grid || []);
    const score = isFinished ? (player.finalScore || 0) : (isSuddenDeathMode() ? liveScore : Number(player.filledCount ?? getBoardFilledCount(player.board || {}) || 0));
    const scoreMax = isFinished || isSuddenDeathMode() ? (player.scoreMax || getMaxBoardScore(roomData?.grid || []) || 30) : BOARD_SIZE;
    const progress = Math.max(0, Math.min(100, Math.round((score / scoreMax) * 100)));
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
              <span>${score}/${scoreMax} ${isFinished ? "pts" : "cases"}</span>
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

  const now = nowIso();
  const { error } = await supabase
    .from("rooms")
    .update({
      status: "playing",
      updated_at: now
    })
    .eq("code", currentRoomCode);

  if (error) throw error;

  roomData = {
    ...roomData,
    status: "playing",
    updatedAt: now
  };

  renderViews();
}

function renderGame() {
  if (!roomData || !myData || roomData.status !== "playing") return;

  clearStaleActionLock();

  if (!actionInProgress && boardEl) boardEl.classList.remove("is-action-locked");

  const currentPlayer = getCurrentPlayer();
  const finished = Boolean(myData.finished);
  const board = myData.board || {};
  const filledCount = myData.filledCount ?? getBoardFilledCount(board);
  const skipStreak = isSuddenDeathMode() ? getSkipStreak(board) : 0;
  const currentScore = calculateBoardScore(board, roomData.grid);
  const scoreMax = getMaxBoardScore(roomData.grid);
  const validCount = countValidCells(board);
  const invalidCount = countInvalidMoves(board);
  const liveBingos = calculateBingos(board).length;
  const myRank = getParticipantRank(uid);

  nextPlayerBtn.classList.toggle("hidden", finished);
  nextPlayerBtn.disabled = !currentPlayer || finished;

  if (isSuddenDeathMode()) {
    nextPlayerBtn.textContent = skipStreak >= SUDDEN_DEATH_MAX_CONSECUTIVE_SKIPS
      ? "Skip = élimination"
      : `Skip ${skipStreak}/${SUDDEN_DEATH_MAX_CONSECUTIVE_SKIPS}`;
  } else {
    nextPlayerBtn.textContent = "Passer";
  }

  const deckLength = roomData.deck?.length || 0;
  const currentIndex = getMyCurrentIndex();

  ensureLocalTimerForCurrentPlayer();

  if (!finished && deckLength > 0 && currentIndex >= deckLength) {
    finishParticipant("deck_finished");
  }

  const remainingPlayers = currentPlayer ? Math.max(0, deckLength - currentIndex - 1) : 0;

  currentPlayerNameEl.textContent = currentPlayer ? currentPlayer.name : finished ? "Grille terminée" : "Fin du deck";
  currentPlayerInitialsEl.textContent = currentPlayer ? getPlayerInitials(currentPlayer.name) : finished ? "✓" : "—";
  playerCounterBadgeEl.textContent = currentPlayer ? `Joueur ${currentIndex + 1} / ${deckLength}` : finished ? `Partie terminée` : `Deck terminé`;
  currentPlayerSublineEl.textContent = finished
    ? `Score final verrouillé. ${getFinishMessage(myData.finishReason)}`
    : currentPlayer
      ? (isSuddenDeathMode()
          ? `Mort Subite : une erreur t'élimine. Skips : ${skipStreak}/${SUDDEN_DEATH_MAX_CONSECUTIVE_SKIPS}.`
          : "Choisis une case vide : ton rythme n'impacte pas les autres joueurs.")
      : "Tu as terminé ta liste de joueurs.";

  myFilledEl.textContent = `${filledCount} / ${BOARD_SIZE}`;
  playersRemainingEl.textContent = `${remainingPlayers} / ${deckLength}`;
  if (liveBingosEl) liveBingosEl.textContent = `${liveBingos}`;
  if (myRankEl) myRankEl.textContent = myRank ? `#${myRank}` : "#-";
  renderPlayedPlayers(currentIndex);

  if (finished) {
    if (!participantsLoadedForFinish && !participantsLoadingOnce) {
      loadParticipantsOnce("finish");
    }

    const finalScore = myData.finalScore || 0;
    const finalBingos = (myData.bingos || []).length;
    const finalScoreMax = myData.scoreMax || scoreMax || 30;
    const finalValidCells = Number(myData.validCells ?? validCount);
    const accuracy = Math.round((finalScore / finalScoreMax) * 100);
    scoreDisplayEl.textContent = finalScore;
    if (compactScoreDisplayEl) compactScoreDisplayEl.textContent = `${finalScore}/${finalScoreMax}`;
    scoreSublineEl.textContent = "points";
    hiddenResultBox.classList.add("hidden");
    finalResultBox.classList.remove("hidden");
    myResultEl.textContent = `${finalScore} / ${finalScoreMax}`;
    myBingosEl.textContent = `${finalBingos}`;
    if (myWrongEl) myWrongEl.textContent = `${invalidCount}`;
    if (myFinalRankEl) myFinalRankEl.textContent = myRank ? `#${myRank}` : "#-";
    if (myAccuracyEl) myAccuracyEl.textContent = `${accuracy}%`;
    updateFinishOverlay(finalScore, finalBingos, invalidCount, accuracy, myRank, participantsData.length, finalScoreMax, finalValidCells);
    if (historyReopenHint) historyReopenHint.classList.remove("hidden");
    if (rankingReopenHint) rankingReopenHint.classList.remove("hidden");
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
    if (historyReopenHint) historyReopenHint.classList.add("hidden");
    if (rankingReopenHint) rankingReopenHint.classList.add("hidden");
  }

  renderBoardIfNeeded(currentPlayer);
  updateCountdown();
}


function getBoardCellEntries(board = {}) {
  return Object.entries(board || {}).filter(([cellIndex, move]) => /^\d+$/.test(String(cellIndex)) && move && typeof move === "object");
}

function getBoardCellValues(board = {}) {
  return getBoardCellEntries(board).map(([, move]) => move);
}

function getBoardFilledCount(board = {}) {
  return getBoardCellEntries(board).length;
}

function getBoardMeta(board = {}) {
  return board?.__meta && typeof board.__meta === "object" ? board.__meta : {};
}

function getSkipStreak(board = myData?.board || {}) {
  return Number(getBoardMeta(board).skipStreak || 0);
}

function setBoardMeta(board = {}, meta = {}) {
  return {
    ...board,
    __meta: {
      ...getBoardMeta(board),
      ...meta
    }
  };
}

function getFinishMessage(reason = "") {
  const messages = {
    deck_finished: "Deck terminé ! Ton score final est calculé.",
    grid_completed: "Grille complète ! Score verrouillé.",
    wrong_answer: "Mort Subite : mauvaise réponse, partie terminée.",
    skip_limit: "Mort Subite : 3 skips déjà utilisés, partie terminée.",
    sudden_death_clear: "Mort Subite réussie ! Tu as survécu au deck."
  };

  return messages[reason] || "Partie terminée.";
}


function getBoardRenderKey(currentPlayer) {
  const board = myData?.board || {};
  const boardKey = getBoardCellEntries(board)
    .sort(([a], [b]) => Number(a) - Number(b))
    .map(([cellIndex, move]) => `${cellIndex}:${move?.playerId || ""}:${move?.isValid ? 1 : 0}`)
    .join("|") + `::skip:${getSkipStreak(board)}`;

  return [
    currentRoomCode || "",
    roomData?.status || "",
    Boolean(myData?.finished) ? "finished" : "playing",
    getMyCurrentIndex(),
    currentPlayer?.id || "none",
    boardKey
  ].join("::");
}

function renderBoardIfNeeded(currentPlayer) {
  const key = getBoardRenderKey(currentPlayer);
  if (key === lastBoardRenderKey) return;
  lastBoardRenderKey = key;
  renderBoard(currentPlayer);
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
        <div class="cell-points">${getCategoryPoints(category)} pt${getCategoryPoints(category) > 1 ? "s" : ""}</div>
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



function getVisualFolder(visualType = "") {
  const map = {
    club: "clubs",
    flag: "flags",
    league: "leagues",
    trophy: "trophies",
    special: "special"
  };

  return map[String(visualType || "").toLowerCase()] || "imported";
}

function getCategoryNumberFromVisual(item = {}, category = {}, visualIndex = null) {
  const categoryTags = Array.isArray(category.tags) ? category.tags : [];
  const indexedTag = Number.isInteger(visualIndex) ? categoryTags[visualIndex] : "";

  const candidates = [
    item.logo,
    item.id,
    indexedTag,
    item.image
  ].filter(Boolean).map(String);

  // Only use category-level fallback when this is not a multi-tag combo visual.
  if (!indexedTag) {
    candidates.push(String(category.logo || ""));
    candidates.push(String(category.id || ""));
    candidates.push(String(category.image || ""));
  }

  for (const value of candidates) {
    const match = value.match(/cat_(\d+)/);
    if (match) return match[1];

    const numberOnly = value.match(/(?:^|\/)(\d+)\.(?:webp|png|svg|jpg|jpeg)$/i);
    if (numberOnly) return numberOnly[1];
  }

  return "";
}

function getCategoryByTagId(tagId) {
  if (!tagId) return null;
  return ACTIVE_CATEGORIES.find((category) => category.id === tagId || category.logo === tagId) || null;
}

function getVisualTypeForTag(tagId, fallbackType = "") {
  const linked = getCategoryByTagId(tagId);
  return linked?.visualType || linked?.visuals?.[0]?.visualType || fallbackType || "default";
}

function getImageForTag(tagId) {
  const linked = getCategoryByTagId(tagId);
  return linked?.image || linked?.visuals?.[0]?.image || "";
}

function getShortLabelForTag(tagId, fallback = "") {
  const linked = getCategoryByTagId(tagId);
  return linked?.shortLabel || linked?.title || linked?.name || fallback || tagId || "★";
}

function getVisualImageCandidates(item = {}, category = {}, visualIndex = null) {
  const categoryTags = Array.isArray(category.tags) ? category.tags : [];
  const indexedTag = Number.isInteger(visualIndex) ? categoryTags[visualIndex] : "";
  const original = item.image || getImageForTag(indexedTag) || (!indexedTag ? category.image : "") || "";
  const number = getCategoryNumberFromVisual(item, category, visualIndex);
  const visualType = item.visualType || getVisualTypeForTag(indexedTag, category.visualType) || "";
  const folder = getVisualFolder(visualType);

  const candidates = [];

  if (number) {
    // Dossier recommandé pour tes vrais logos importés.
    candidates.push(`./assets/icons/imported/${number}.webp`);
    candidates.push(`./assets/icons/imported/cat_${number}.webp`);

    // Sécurité si les fichiers ont été uploadés à la racine de assets/icons.
    candidates.push(`./assets/icons/${number}.webp`);
    candidates.push(`./assets/icons/cat_${number}.webp`);

    // Sécurité si tu ranges les .webp dans clubs/flags/leagues/etc.
    candidates.push(`./assets/icons/${folder}/${number}.webp`);
    candidates.push(`./assets/icons/${folder}/cat_${number}.webp`);
  }

  if (original) candidates.push(original);

  return [...new Set(candidates.filter(Boolean))];
}

window.bingoKunImageFallback = function bingoKunImageFallback(img) {
  try {
    const fallbacks = JSON.parse(img.dataset.fallbacks || "[]");
    const next = fallbacks.shift();

    if (!next) {
      img.onerror = null;
      img.style.display = "none";
      return;
    }

    img.dataset.fallbacks = JSON.stringify(fallbacks);
    img.src = next;
  } catch (error) {
    img.onerror = null;
    img.style.display = "none";
  }
};


function renderCategoryVisual(category) {
  const categoryTags = Array.isArray(category.tags) ? category.tags : [];
  const isComboCategory = categoryTags.length > 1;

  // For combo cells, rebuild the two visuals from category.tags.
  // This avoids a bug where both images can inherit the first category logo.
  const visuals = isComboCategory
    ? categoryTags.slice(0, 2).map((tagId, index) => ({
        id: tagId,
        logo: tagId,
        visualType: getVisualTypeForTag(tagId, category.visualType || "default"),
        image: getImageForTag(tagId),
        shortLabel: getShortLabelForTag(tagId, category.shortLabel || iconForCategory(tagId)),
        _comboIndex: index
      }))
    : (Array.isArray(category.visuals) && category.visuals.length
      ? category.visuals.slice(0, 2)
      : [{
          visualType: category.visualType || "default",
          image: category.image || "",
          shortLabel: category.shortLabel || (category.logo && TEAMS[category.logo] ? TEAMS[category.logo].short : iconForCategory(category.id))
        }]);

  const visualClass = visuals.length > 1 ? "combo" : (visuals[0]?.visualType || "default");

  const imagesHtml = visuals.map((item, index) => {
    const visualIndex = Number.isInteger(item?._comboIndex) ? item._comboIndex : index;
    const candidates = getVisualImageCandidates(item, category, isComboCategory ? visualIndex : null);

    if (!candidates.length) {
      return `<div class="cell-icon-fallback">${escapeHtml(item?.shortLabel || "★")}</div>`;
    }

    const [firstImage, ...fallbacks] = candidates;

    return `
      <img
        src="${escapeHtml(firstImage)}"
        data-fallbacks='${escapeHtml(JSON.stringify(fallbacks))}'
        onerror="window.bingoKunImageFallback(this)"
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
  await runPlayerAction(async () => {
    const currentPlayer = getCurrentPlayer();
    if (!currentPlayer) return;

    const board = myData.board || {};

    if (board[cellIndex]) {
      setMessage("Cette case est déjà remplie.", "bad");
      return;
    }

    const playerAlreadyUsed = getBoardCellValues(board).some((move) => move.playerId === currentPlayer.id);
    if (playerAlreadyUsed) {
      setMessage("Tu as déjà utilisé ce joueur sur ta grille.", "bad");
      return;
    }

    const category = roomData.grid[cellIndex];
    const isValid = canPlayerFillCategory(currentPlayer, category);
    const suddenDeath = isSuddenDeathMode();

    let newBoard = {
      ...board,
      [cellIndex]: {
        playerId: currentPlayer.id,
        playerName: currentPlayer.name,
        categoryId: category.id,
        isValid,
        placedAt: Date.now()
      }
    };

    if (suddenDeath && isValid) {
      newBoard = setBoardMeta(newBoard, { skipStreak: 0 });
    }

    const filledCount = getBoardFilledCount(newBoard);
    const updatePayload = {
      board: newBoard,
      filledCount
    };

    if (suddenDeath && !isValid) {
      const finalScore = calculateBoardScore(newBoard, roomData.grid);
      updatePayload.finished = true;
      updatePayload.finalScore = finalScore;
      updatePayload.validCells = countValidCells(newBoard);
      updatePayload.scoreMax = getMaxBoardScore(roomData.grid);
      updatePayload.bingos = calculateBingos(newBoard);
      updatePayload.finishReason = "wrong_answer";
      updatePayload.resultSaved = false;
      updatePayload.finishedAt = nowIso();
      setMessage("Mort Subite : mauvaise réponse, partie terminée.", "bad");
    } else if (filledCount >= BOARD_SIZE) {
      const finalScore = calculateBoardScore(newBoard, roomData.grid);
      updatePayload.finished = true;
      updatePayload.finalScore = finalScore;
      updatePayload.validCells = countValidCells(newBoard);
      updatePayload.scoreMax = getMaxBoardScore(roomData.grid);
      updatePayload.bingos = calculateBingos(newBoard);
      updatePayload.finishReason = "grid_completed";
      updatePayload.resultSaved = false;
      updatePayload.finishedAt = nowIso();
      setMessage(suddenDeath ? "Mort Subite : grille complète, score verrouillé !" : "Grille complète ! Le verdict est révélé.", "good");
    } else {
      const deckLength = roomData.deck?.length || 0;
      const nextIndex = Math.min(getMyCurrentIndex() + 1, deckLength);
      updatePayload.currentIndex = nextIndex;
      updatePayload.currentStartedAt = nowIso();

      if (nextIndex >= deckLength) {
        const finalScore = calculateBoardScore(newBoard, roomData.grid);
        updatePayload.finished = true;
        updatePayload.finalScore = finalScore;
        updatePayload.validCells = countValidCells(newBoard);
        updatePayload.scoreMax = getMaxBoardScore(roomData.grid);
        updatePayload.bingos = calculateBingos(newBoard);
        updatePayload.finishReason = suddenDeath ? "sudden_death_clear" : "deck_finished";
        updatePayload.resultSaved = false;
        updatePayload.finishedAt = nowIso();
        setMessage(suddenDeath ? "Mort Subite réussie ! Tu as survécu au deck." : "Deck terminé ! Ton score final est calculé.", "good");
      } else {
        setMessage(suddenDeath ? "Bon placement ! Skips remis à zéro." : "Joueur placé. Le prochain joueur arrive pour toi uniquement.", "good");
      }
    }

    await supabaseUpdateParticipant(updatePayload);

    // Rendu local immédiat : évite l'impression que le joueur ne passe pas.
    myData = {
      ...myData,
      ...updatePayload,
      currentStartedAt: updatePayload.currentStartedAt || myData.currentStartedAt
    };
    mergeMyParticipantData();
    lastBoardRenderKey = "";
    renderViews();
  });
}

async function finishParticipant(reason = "deck_finished") {
  if (!roomData || !currentRoomCode || !myData || myData.finished) return;

  const board = myData.board || {};
  const finalScore = calculateBoardScore(board, roomData.grid);

  const updatePayload = {
    finished: true,
    finalScore,
    validCells: countValidCells(board),
    scoreMax: getMaxBoardScore(roomData.grid),
    bingos: calculateBingos(board),
    finishReason: reason,
    resultSaved: false,
    finishedAt: nowIso()
  };

  try {
    await supabaseUpdateParticipant(updatePayload);
    myData = { ...myData, ...updatePayload };
    mergeMyParticipantData();
    lastBoardRenderKey = "";
    renderViews();
    setMessage(getFinishMessage(reason), reason === "wrong_answer" || reason === "skip_limit" ? "bad" : "good");
  } catch (error) {
    console.warn("Impossible de terminer la partie :", error);
  }
}


async function advanceMyPlayer(manual = false) {
  if (!roomData || !currentRoomCode || roomData.status !== "playing" || !myData || myData.finished) return;
  await runPlayerAction(async () => {
    const currentIndex = Number(myData.currentIndex || 0);
    const deckLength = roomData.deck?.length || 0;
    const board = myData.board || {};
    const suddenDeath = isSuddenDeathMode();

    if (currentIndex >= deckLength) {
      await finishParticipant(suddenDeath ? "sudden_death_clear" : "deck_finished");
      return;
    }

    if (manual && suddenDeath && getSkipStreak(board) >= SUDDEN_DEATH_MAX_CONSECUTIVE_SKIPS) {
      await finishParticipant("skip_limit");
      return;
    }

    const nextIndex = Math.min(currentIndex + 1, deckLength);
    const updatePayload = {
      currentIndex: nextIndex,
      currentStartedAt: nowIso()
    };

    if (manual && suddenDeath) {
      updatePayload.board = setBoardMeta(board, {
        skipStreak: getSkipStreak(board) + 1
      });
      updatePayload.filledCount = getBoardFilledCount(updatePayload.board);
    }

    if (nextIndex >= deckLength) {
      const finalBoard = updatePayload.board || board;
      const finalScore = calculateBoardScore(finalBoard, roomData.grid);
      updatePayload.finished = true;
      updatePayload.finalScore = finalScore;
      updatePayload.validCells = countValidCells(finalBoard);
      updatePayload.scoreMax = getMaxBoardScore(roomData.grid);
      updatePayload.bingos = calculateBingos(finalBoard);
      updatePayload.finishReason = suddenDeath ? "sudden_death_clear" : "deck_finished";
      updatePayload.resultSaved = false;
      updatePayload.finishedAt = nowIso();
    }

    await supabaseUpdateParticipant(updatePayload);

    // Rendu local immédiat : évite l'impression que rien ne se passe.
    myData = {
      ...myData,
      ...updatePayload,
      currentStartedAt: updatePayload.currentStartedAt || myData.currentStartedAt
    };
    mergeMyParticipantData();
    lastBoardRenderKey = "";
    renderViews();

    if (manual) {
      if (suddenDeath) {
        const newStreak = getSkipStreak(myData.board || {});
        setMessage(newStreak >= SUDDEN_DEATH_MAX_CONSECUTIVE_SKIPS
          ? "3 skips utilisés : le prochain skip t'élimine, tu dois placer le prochain joueur."
          : `Joueur passé. Skips : ${newStreak}/${SUDDEN_DEATH_MAX_CONSECUTIVE_SKIPS}.`, "good");
      } else {
        setMessage("Joueur passé pour toi uniquement.", "good");
      }
    }
  });
}

function countValidMoves(board) {
  return getBoardCellValues(board || {}).filter((move) => move?.isValid).length;
}

function countInvalidMoves(board) {
  return getBoardCellValues(board || {}).filter((move) => move && move.isValid === false).length;
}


async function ensureResultSaved(board, finalScore, bingos) {
  if (!currentRoomCode || !uid || !roomData || !myData || savingResult || myData.resultSaved) return;

  savingResult = true;
  const resultId = `${currentRoomCode}_${uid}`;
  const bingoCount = Array.isArray(bingos) ? bingos.length : 0;
  const scoreMax = myData.scoreMax || getMaxBoardScore(roomData.grid) || 30;
  const validCells = Number(myData.validCells ?? countValidCells(board));
  const wrongAnswers = countInvalidMoves(board);
  const accuracy = Math.round((Number(finalScore || 0) / scoreMax) * 100);
  const points = calculateRankingPoints(Number(finalScore || 0), bingoCount, scoreMax);
  const now = new Date();
  const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const playerName = myData.name || getPlayerName() || "Joueur";

  try {
    await supabaseInsertResult({
      id: resultId,
      room_code: currentRoomCode,
      player_uid: uid,
      player_name: playerName,
      player_key: normalizePlayerKey(playerName),
      score: Number(finalScore || 0),
      score_max: scoreMax,
      bingos: bingoCount,
      wrong_answers: wrongAnswers,
      accuracy,
      points,
      month_key: monthKey,
      mode_label: roomData.presetLabel || `${getGameModeLabel(roomData.gameMode)} — ${roomData.preset || selectedPreset || "mode libre"}`,
      created_at: nowIso()
    });

    await supabaseUpdateParticipant({
      resultSaved: true
    });

    myData = {
      ...myData,
      resultSaved: true
    };
    mergeMyParticipantData();
  } catch (error) {
    console.error("Bingo Kun : impossible d'enregistrer le résultat Supabase.", error);
  } finally {
    savingResult = false;
  }
}

function calculateRankingPoints(score, bingoCount, scoreMax = 30) {
  const safeScore = Number(score || 0);
  const safeBingos = Number(bingoCount || 0);
  const perfectBonus = safeScore >= Number(scoreMax || 30) ? 10 : 0;
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

function updateFinishOverlay(finalScore, bingoCount, wrongCount, accuracy, rank, totalPlayers, scoreMax = 30, validCells = 0) {
  if (!finishTitleEl) return;

  let title = isSuddenDeathMode() ? "Mort Subite terminée" : "Bien joué !";
  let subtitle = isSuddenDeathMode() ? getFinishMessage(myData?.finishReason) : "Ta grille est complète.";

  if (!isSuddenDeathMode() && finalScore >= 25) {
    title = 'Masterclass !';
    subtitle = 'Énorme performance sur cette grille.';
  } else if (!isSuddenDeathMode() && finalScore >= 20) {
    title = 'Très solide !';
    subtitle = 'Belle partie, ta grille tient bien la route.';
  } else if (!isSuddenDeathMode() && finalScore <= 12) {
    title = 'À retenter !';
    subtitle = 'Tu peux faire mieux sur la prochaine room.';
  }

  finishTitleEl.textContent = title;
  finishSubtitleEl.textContent = subtitle;
  finishScoreEl.textContent = `${finalScore} / ${scoreMax}`;
  finishBingosEl.textContent = String(bingoCount);
  finishWrongEl.textContent = String(wrongCount);
  finishAccuracyEl.textContent = `${accuracy}%`;
  finishRankEl.textContent = rank ? `#${rank}` : '#-';
  finishTotalPlayersEl.textContent = `${totalPlayers} joueur${totalPlayers > 1 ? 's' : ''}`;
  renderFinishRanking();
}



function renderFinishRanking() {
  if (!finishRankingListEl || !finishRankingStatsEl) return;

  const sorted = getSortedParticipants(participantsData);
  const total = sorted.length;
  const finishedCount = sorted.filter((player) => player.finished).length;

  finishRankingStatsEl.textContent = `${finishedCount}/${total} joueur${total > 1 ? "s" : ""} terminé${finishedCount > 1 ? "s" : ""}`;

  if (!sorted.length) {
    finishRankingListEl.innerHTML = `<div class="empty-history">Aucun joueur dans cette room.</div>`;
    return;
  }

  finishRankingListEl.innerHTML = sorted.map((player, index) => {
    const rank = index + 1;
    const score = player.finished ? (player.finalScore || 0) : calculateBoardScore(player.board || {}, roomData?.grid || []);
    const scoreMax = player.scoreMax || getMaxBoardScore(roomData?.grid || []) || 30;
    const bingos = (player.bingos || []).length;
    const medal = rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : `#${rank}`;
    const me = player.id === uid ? `<span class="leaderboard-me">TOI</span>` : "";
    const status = player.finished ? "TERMINÉ" : "EN JEU";

    return `
      <div class="finish-ranking-row ${player.id === uid ? "me" : ""}">
        <span class="finish-ranking-rank">${medal}</span>
        <div class="finish-ranking-player">
          <strong>${escapeHtml(player.name || "Joueur")}</strong>
          <small>${me} ${status} · ${bingos} bingo${bingos > 1 ? "s" : ""}</small>
        </div>
        <strong class="finish-ranking-score">${score}/${scoreMax}</strong>
      </div>
    `;
  }).join("");
}

function goHomeFromFinish() {
  const keepName = playerNameInput?.value || myData?.name || localStorage.getItem("bingo-kun-name") || "";
  leaveRoom();
  if (playerNameInput && keepName) playerNameInput.value = keepName;
  window.scrollTo({ top: 0, behavior: "smooth" });
}

async function recreateRoomFromFinish() {
  const keepName = playerNameInput?.value || myData?.name || localStorage.getItem("bingo-kun-name") || "";
  const canCreate = Boolean(isAdminUser);

  leaveRoom();
  if (playerNameInput && keepName) playerNameInput.value = keepName;
  window.scrollTo({ top: 0, behavior: "smooth" });

  if (!canCreate) {
    setTimeout(() => alert("Tu es revenu à l’accueil. Connecte-toi en admin pour recréer une room."), 100);
    return;
  }

  setTimeout(() => {
    createRoomBtn?.click();
  }, 150);
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

  getBoardCellEntries(board).forEach(([cellIndex, move]) => {
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
  recapOverlay?.classList.add('hidden');
  finishOverlay.classList.remove('hidden');
  document.body.classList.add('overlay-open');
}

function showRecapOverlay() {
  if (!recapOverlay) return;
  finishOverlay?.classList.add('hidden');
  recapOverlay.classList.remove('hidden');
  document.body.classList.add('overlay-open');
}

function hideFinishOverlay() {
  hideAllFinishOverlays();
}

function hideAllFinishOverlays() {
  finishOverlay?.classList.add('hidden');
  recapOverlay?.classList.add('hidden');
  document.body.classList.remove('overlay-open');
}

function startTimers() {
  if (clockInterval || playerAutoInterval) return;

  clockInterval = setInterval(() => {
    updateCountdown();
  }, 250);

  playerAutoInterval = setInterval(() => {
    if (!roomData || roomData.status !== "playing" || !myData || myData.finished) return;
    clearStaleActionLock();
    if (actionInProgress) return;
    if (!getCurrentPlayer()) return;
    if (getRemainingSeconds() <= 0) {
      const now = Date.now();
      if (now - lastAutoAdvanceAt < 2000) return;
      lastAutoAdvanceAt = now;
      advanceMyPlayer(false);
    }
  }, 1000);
}

function stopTimers() {
  if (clockInterval) clearInterval(clockInterval);
  if (playerAutoInterval) clearInterval(playerAutoInterval);
  clockInterval = null;
  playerAutoInterval = null;
}


function getCurrentTimerKey() {
  if (!roomData || roomData.status !== "playing" || !myData || myData.finished) return "";
  const index = getMyCurrentIndex();
  const player = getCurrentPlayer();
  return [
    currentRoomCode || "",
    uid || "",
    index,
    player?.id || "none"
  ].join("::");
}

function ensureLocalTimerForCurrentPlayer() {
  const key = getCurrentTimerKey();

  if (!key) {
    localTimerKey = "";
    localTimerStartedAtMs = 0;
    return;
  }

  if (key !== localTimerKey) {
    localTimerKey = key;
    localTimerStartedAtMs = Date.now();
  }
}

function resetLocalTimer() {
  localTimerKey = "";
  localTimerStartedAtMs = 0;
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
  if (!roomData || roomData.status !== "playing" || !myData || myData.finished) return AUTO_SECONDS;

  ensureLocalTimerForCurrentPlayer();

  if (!localTimerStartedAtMs) return AUTO_SECONDS;

  const elapsed = (Date.now() - localTimerStartedAtMs) / 1000;
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
    getBoardCellValues(board).map((move) => [move.playerId, move])
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

function getMinPlayersForCategory(category) {
  return isComboCategory(category) ? MIN_PLAYERS_PER_COMBO_CELL : MIN_PLAYERS_PER_STANDARD_CELL;
}

function getCategoryPoints(category) {
  return isComboCategory(category) ? COMBO_CELL_POINTS : SIMPLE_CELL_POINTS;
}

function getMaxBoardScore(grid = roomData?.grid || []) {
  return (Array.isArray(grid) ? grid : []).reduce((total, category) => total + getCategoryPoints(category), 0);
}

function getMovePoints(cellIndex, move, grid = roomData?.grid || []) {
  if (!move?.isValid) return 0;
  const category = grid[Number(cellIndex)];
  return getCategoryPoints(category);
}

function calculateBoardScore(board = {}, grid = roomData?.grid || []) {
  return getBoardCellEntries(board || {}).reduce((total, [cellIndex, move]) => {
    return total + getMovePoints(cellIndex, move, grid);
  }, 0);
}

function countValidCells(board = {}) {
  return getBoardCellValues(board || {}).filter((move) => move?.isValid).length;
}

function countDeckMatchesForCategory(deck, category) {
  return deck.reduce((total, player) => {
    return total + (canPlayerFillCategory(player, category) ? 1 : 0);
  }, 0);
}

function getGridCoverageStats(grid, deck) {
  const perCell = grid.map((category, index) => {
    const required = getMinPlayersForCategory(category);
    return {
      index,
      categoryId: category.id,
      title: category.title || category.name || category.id,
      isCombo: isComboCategory(category),
      required,
      count: countDeckMatchesForCategory(deck, category)
    };
  });

  return {
    perCell,
    minMatches: perCell.length ? Math.min(...perCell.map((item) => item.count)) : 0,
    allCellsHaveEnoughPlayers: perCell.every((item) => item.count >= item.required),
    weakCells: perCell.filter((item) => item.count < item.required)
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



function generateGameSetup(requestedGrid = [], preset = selectedPreset, gameMode = selectedGameMode) {
  const playerPoolAll = getPlayersForPreset(preset);
  const maxDeckSize = getDeckSizeForMode(gameMode);
  const requiredPlayable = getRequiredPlayableForMode(gameMode);

  const categoryPool = getCategoriesForPreset(preset).filter((category) => getCategoryMatchCount(category, playerPoolAll) >= getMinPlayersForCategory(category));
  const fixedGrid = normalizeRequestedGrid(requestedGrid).filter((category) => {
    if (!categoryPool.length) return true;
    return categoryPool.some((item) => item.id === category.id);
  });

  const fixedComboCount = countComboCells(fixedGrid);

  if (fixedComboCount > EXACT_COMBO_CELLS) {
    return {
      grid: fixedGrid,
      deck: [],
      playableCount: 0,
      minPlayersPerCell: 0,
      weakCells: [],
      perfectSolvable: false,
      perfectAssignment: [],
      comboCount: fixedComboCount,
      error: `Trop de combos dans la grille custom : ${fixedComboCount}/${EXACT_COMBO_CELLS}`
    };
  }

  let bestSetup = null;
  const attempts = fixedGrid.length ? 120 : 450;

  for (let attempt = 0; attempt < attempts; attempt++) {
    const grid = fixedGrid.length
      ? completeGridFromFixedCategories(fixedGrid, categoryPool, playerPoolAll)
      : buildBalancedRandomGrid(categoryPool.length ? categoryPool : ACTIVE_CATEGORIES, playerPoolAll);

    if (!grid || grid.length !== BOARD_SIZE) continue;

    const comboCount = countComboCells(grid);
    if (comboCount > EXACT_COMBO_CELLS) continue;

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
    const deckHasExpectedPlayers = deck.length === maxDeckSize;

    const score =
      deckPlayableCount * 100 +
      coveredCells +
      (coverageStats.minMatches * 50) +
      (perfectAssignment.assignedCells * 75) +
      (deckHasExpectedPlayers ? 2500 : 0) +
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
      deckHasExpectedPlayers &&
      deckPlayableCount >= requiredPlayable &&
      deckCoversEveryCell &&
      perfectSolvable &&
      comboCount === EXACT_COMBO_CELLS
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
  const eligible = categoryPool.filter((category) => getCategoryMatchCount(category, playerPool) >= getMinPlayersForCategory(category));
  const shuffled = shuffle(eligible);
  const combos = shuffled.filter(isComboCategory);
  const nonCombos = shuffled.filter((category) => !isComboCategory(category));

  if (combos.length < EXACT_COMBO_CELLS || nonCombos.length < BOARD_SIZE - EXACT_COMBO_CELLS) {
    return [];
  }

  const selectedCombos = combos.slice(0, EXACT_COMBO_CELLS);
  const selectedNonCombos = nonCombos.slice(0, BOARD_SIZE - EXACT_COMBO_CELLS);

  return shuffle([...selectedCombos, ...selectedNonCombos]).slice(0, BOARD_SIZE);
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
      return getCategoryMatchCount(category, playerPool) >= getMinPlayersForCategory(category);
    })
  );

  const combos = candidates.filter(isComboCategory);
  const nonCombos = candidates.filter((category) => !isComboCategory(category));

  for (const category of combos) {
    if (countComboCells(grid) >= EXACT_COMBO_CELLS) break;
    selectedIds.add(category.id);
    grid.push(category);
  }

  for (const category of nonCombos) {
    if (grid.length >= BOARD_SIZE) break;
    selectedIds.add(category.id);
    grid.push(category);
  }

  // Si le custom avait trop de combos, on refuse en amont. Ici on garde exactement 20 cases.
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
  resetLocalTimer();
  if (historyReopenHint) historyReopenHint.classList.add("hidden");
  if (rankingReopenHint) rankingReopenHint.classList.add("hidden");
  hideFinishOverlay();

  const cleanUrl = new URL(window.location.href);
  cleanUrl.searchParams.delete("room");
  window.history.replaceState({}, "", cleanUrl.toString());

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
  roomPollInterval = null;
  mePollInterval = null;
  participantsPollInterval = null;
  participantsLoadingOnce = false;
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
