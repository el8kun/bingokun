import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";
import { supabaseConfig } from "./supabase-config.js";

const $ = (id) => document.getElementById(id);
const supabase = createClient(supabaseConfig.url, supabaseConfig.anonKey);

const state = {
  user: null,
  isAdmin: false,
  players: [],
  categories: [],
  scored: []
};

const els = {
  loginBtn: $("qualityLoginBtn"),
  logoutBtn: $("qualityLogoutBtn"),
  authStatus: $("qualityAuthStatus"),
  status: $("qualityStatus"),
  loadBtn: $("qualityLoadBtn"),
  saveBtn: $("qualitySaveBtn"),
  disable01Btn: $("qualityDisable01Btn"),
  disable02Btn: $("qualityDisable02Btn"),
  enable3Btn: $("qualityEnable3Btn"),
  total: $("qualityTotalPlayers"),
  level5: $("qualityLevel5"),
  level4: $("qualityLevel4"),
  level3: $("qualityLevel3"),
  level2: $("qualityLevel2"),
  low: $("qualityLevelLow"),
  lowList: $("qualityLowList"),
  goodList: $("qualityGoodList"),
  overlay: $("qualityLoginOverlay"),
  form: $("qualityLoginForm"),
  email: $("qualityEmailInput"),
  password: $("qualityPasswordInput"),
  cancel: $("qualityLoginCancelBtn"),
  loginMessage: $("qualityLoginMessage"),
  submit: $("qualityLoginSubmitBtn")
};

// Tags connus / visibles pour une V1. On pourra affiner après ton test.
const MAJOR_CLUB_TAGS = new Set([
  "cat_83",  // AC Milan
  "cat_84",  // Inter
  "cat_86",
  "cat_93",  // Liverpool
  "cat_99",
  "cat_112",
  "cat_129", // Marseille
  "cat_133",
  "cat_160", // Real Madrid
  "cat_167",
  "cat_172", // PSG
  "cat_176",
  "cat_179",
  "cat_204", // Manchester United
  "cat_215",
  "cat_262"
]);

const BIG_COMPETITION_TAGS = new Set([
  "cat_354", // World Cup
  "cat_355",
  "cat_356",
  "cat_357",
  "cat_425", // Champions League / European Cup
  "cat_426", // Europa League / UEFA Cup
  "cat_427",
  "cat_550", // Big 5
  "cat_552",
  "cat_553",
  "cat_554",
  "cat_555",
  "cat_556",
  "cat_558",
  "cat_560",
  "cat_564",
  "cat_600",
  "cat_607",
  "cat_608",
  "cat_609"
]);

init();

async function init() {
  els.loginBtn?.addEventListener("click", showLogin);
  els.logoutBtn?.addEventListener("click", logout);
  els.cancel?.addEventListener("click", hideLogin);
  els.overlay?.addEventListener("click", (event) => {
    if (event.target === els.overlay) hideLogin();
  });
  els.form?.addEventListener("submit", handleLogin);

  els.loadBtn?.addEventListener("click", loadAndScore);
  els.saveBtn?.addEventListener("click", saveScores);
  els.disable01Btn?.addEventListener("click", () => applyEnabledByLevel(1, false));
  els.disable02Btn?.addEventListener("click", () => applyEnabledByLevel(2, false));
  els.enable3Btn?.addEventListener("click", () => applyEnabledByLevel(3, true));

  await refreshAuth();
  supabase.auth.onAuthStateChange(async (_event, session) => {
    state.user = session?.user || null;
    state.isAdmin = state.user ? await checkAdmin() : false;
    updateAuthUi();
  });
}

function withTimeout(promise, ms = 12000, label = "Action trop longue") {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(label)), ms))
  ]);
}

async function refreshAuth() {
  const { data } = await supabase.auth.getSession();
  state.user = data?.session?.user || null;
  state.isAdmin = state.user ? await checkAdmin() : false;
  updateAuthUi();
}

async function checkAdmin() {
  try {
    const rpc = await withTimeout(supabase.rpc("is_admin"), 5000, "Vérification admin trop longue");
    if (!rpc.error && rpc.data === true) return true;

    const { data, error } = await withTimeout(
      supabase.from("admins").select("uid").eq("uid", state.user?.id).maybeSingle(),
      5000,
      "Lecture admins trop longue"
    );

    if (error) throw error;
    return Boolean(data?.uid);
  } catch (error) {
    console.warn("Admin check impossible:", error);
    return false;
  }
}

function updateAuthUi() {
  els.loginBtn?.classList.toggle("hidden", state.isAdmin);
  els.logoutBtn?.classList.toggle("hidden", !state.user);

  if (state.isAdmin) {
    els.authStatus.textContent = "Admin connecté — modification autorisée";
    els.authStatus.className = "admin-status good";
  } else if (state.user) {
    els.authStatus.textContent = "Compte connecté mais non admin";
    els.authStatus.className = "admin-status bad";
  } else {
    els.authStatus.textContent = "Lecture seule — connecte-toi en admin.";
    els.authStatus.className = "admin-status";
  }

  updateButtons();
}

function showLogin() {
  els.loginMessage.textContent = "";
  els.loginMessage.className = "admin-login-message";
  els.overlay.classList.remove("hidden");
  document.body.classList.add("overlay-open");
  setTimeout(() => els.email?.focus(), 50);
}

function hideLogin() {
  els.overlay.classList.add("hidden");
  document.body.classList.remove("overlay-open");
}

async function handleLogin(event) {
  event.preventDefault();

  els.loginMessage.textContent = "Connexion en cours...";
  els.loginMessage.className = "admin-login-message";
  els.submit.disabled = true;
  els.submit.textContent = "Connexion...";

  try {
    const login = await withTimeout(
      supabase.auth.signInWithPassword({
        email: els.email.value.trim(),
        password: els.password.value
      }),
      9000,
      "Connexion trop longue."
    );

    if (login.error) throw login.error;

    state.user = login.data?.user || null;
    state.isAdmin = await checkAdmin();
    updateAuthUi();

    if (!state.isAdmin) throw new Error(`Connecté, mais pas admin. UID : ${state.user?.id}`);

    hideLogin();
  } catch (error) {
    els.loginMessage.textContent = error.message || "Connexion impossible.";
    els.loginMessage.className = "admin-login-message bad";
  } finally {
    els.submit.disabled = false;
    els.submit.textContent = "Se connecter";
  }
}

async function logout() {
  await supabase.auth.signOut();
  state.user = null;
  state.isAdmin = false;
  updateAuthUi();
}

async function loadAndScore() {
  setStatus("Chargement des joueurs et catégories...");
  els.loadBtn.disabled = true;

  try {
    const [players, categories] = await Promise.all([
      fetchAll("players", "id,name,base_name,position,birth_date,tags,logos,enabled"),
      fetchAll("categories", "id,title,name,kicker,type,visual_type,tags,enabled")
    ]);

    state.players = players;
    state.categories = categories;
    state.scored = scorePlayers(players, categories);

    renderStats();
    renderLists();
    updateButtons();

    setStatus("Scores calculés en local. Rien n'est enregistré tant que tu ne cliques pas sur Enregistrer.", "good");
  } catch (error) {
    console.error(error);
    setStatus(error.message || "Erreur chargement.", "bad");
  } finally {
    els.loadBtn.disabled = false;
  }
}

async function fetchAll(table, select) {
  const pageSize = 1000;
  let from = 0;
  let rows = [];

  while (true) {
    const { data, error } = await supabase
      .from(table)
      .select(select)
      .range(from, from + pageSize - 1);

    if (error) throw error;

    rows = rows.concat(data || []);
    if (!data || data.length < pageSize) break;
    from += pageSize;
  }

  return rows;
}

function scorePlayers(players, categories) {
  const categoryMap = new Map(categories.map((category) => [category.id, category]));

  return players.map((player) => {
    const tags = Array.isArray(player.tags) ? player.tags : [];
    const tagSet = new Set(tags);
    const reasons = [];
    let score = 0;

    const majorClubCount = tags.filter((tag) => MAJOR_CLUB_TAGS.has(tag)).length;
    if (majorClubCount >= 1) {
      const pts = Math.min(8, majorClubCount * 4);
      score += pts;
      reasons.push(`${majorClubCount} grand club${majorClubCount > 1 ? "s" : ""} +${pts}`);
    }

    const bigCompetitionCount = tags.filter((tag) => BIG_COMPETITION_TAGS.has(tag)).length;
    if (bigCompetitionCount >= 1) {
      const pts = Math.min(9, bigCompetitionCount * 3);
      score += pts;
      reasons.push(`${bigCompetitionCount} grande compétition/palmarès +${pts}`);
    }

    const clubTags = tags.filter((tag) => {
      const category = categoryMap.get(tag);
      return category && (Number(category.type) === 2 || String(category.visual_type || "").toLowerCase() === "club");
    });

    if (clubTags.length >= 3) {
      score += 3;
      reasons.push("carrière multi-clubs +3");
    } else if (clubTags.length >= 2) {
      score += 2;
      reasons.push("2 clubs détectés +2");
    }

    const trophyOrSpecialTags = tags.filter((tag) => {
      const category = categoryMap.get(tag);
      const type = Number(category?.type || 0);
      return type === 6 || type === 8 || String(category?.visual_type || "").toLowerCase() === "trophy";
    });

    if (trophyOrSpecialTags.length >= 2) {
      score += 2;
      reasons.push("tags trophées/spéciaux +2");
    }

    if (tags.length >= 12) {
      score += 3;
      reasons.push("beaucoup de tags +3");
    } else if (tags.length >= 8) {
      score += 2;
      reasons.push("tags solides +2");
    } else if (tags.length >= 5) {
      score += 1;
      reasons.push("tags corrects +1");
    }

    if (tags.length <= 2) {
      score -= 3;
      reasons.push("très peu de tags -3");
    } else if (tags.length <= 4) {
      score -= 1;
      reasons.push("peu de tags -1");
    }

    if (!majorClubCount && !bigCompetitionCount && clubTags.length <= 1 && tags.length <= 5) {
      score -= 2;
      reasons.push("profil très niche -2");
    }

    score = Math.max(0, score);
    const level = scoreToLevel(score);

    return {
      ...player,
      quality_score: score,
      quality_level: level,
      quality_reasons: reasons,
      quality_label: levelLabel(level)
    };
  });
}

function scoreToLevel(score) {
  if (score >= 16) return 5;
  if (score >= 11) return 4;
  if (score >= 7) return 3;
  if (score >= 4) return 2;
  if (score >= 1) return 1;
  return 0;
}

function levelLabel(level) {
  return {
    5: "Star",
    4: "Connu",
    3: "Jouable",
    2: "Niche",
    1: "Obscur",
    0: "Très obscur"
  }[level] || "Non classé";
}

function renderStats() {
  const counts = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  for (const player of state.scored) counts[player.quality_level] += 1;

  els.total.textContent = state.scored.length.toLocaleString("fr-FR");
  els.level5.textContent = counts[5].toLocaleString("fr-FR");
  els.level4.textContent = counts[4].toLocaleString("fr-FR");
  els.level3.textContent = counts[3].toLocaleString("fr-FR");
  els.level2.textContent = counts[2].toLocaleString("fr-FR");
  els.low.textContent = (counts[0] + counts[1]).toLocaleString("fr-FR");
}

function renderLists() {
  const low = state.scored
    .filter((player) => player.quality_level <= 1)
    .sort((a, b) => a.quality_score - b.quality_score || String(a.name).localeCompare(String(b.name)))
    .slice(0, 400);

  const good = state.scored
    .filter((player) => player.quality_level >= 3)
    .sort((a, b) => b.quality_score - a.quality_score || String(a.name).localeCompare(String(b.name)))
    .slice(0, 400);

  els.lowList.innerHTML = low.length ? low.map(renderPlayerRow).join("") : `<div class="admin-empty-list">Aucun joueur niveau 0-1.</div>`;
  els.goodList.innerHTML = good.length ? good.map(renderPlayerRow).join("") : `<div class="admin-empty-list">Aucun joueur niveau 3+.</div>`;
}

function renderPlayerRow(player) {
  const active = player.enabled === false ? "désactivé" : "actif";
  const reasonText = (player.quality_reasons || []).slice(0, 4).join(" · ") || "aucune raison";
  return `
    <article class="diagnostic-row quality-row level-${player.quality_level}">
      <div>
        <strong>${escapeHtml(player.name || player.base_name || player.id)}</strong>
        <span>Niveau ${player.quality_level} — ${escapeHtml(player.quality_label)} · score ${player.quality_score} · ${escapeHtml(active)}</span>
        <em>${escapeHtml(reasonText)}</em>
      </div>
    </article>
  `;
}

async function saveScores() {
  if (!state.isAdmin) return alert("Connecte-toi en admin.");
  if (!state.scored.length) return;

  const ok = confirm(`Enregistrer les scores qualité pour ${state.scored.length.toLocaleString("fr-FR")} joueurs ?`);
  if (!ok) return;

  setStatus("Enregistrement des scores...");
  await upsertQualityRows(state.scored.map((player) => ({
    ...player,
    quality_updated_at: new Date().toISOString()
  })));

  setStatus("Scores qualité enregistrés.", "good");
}

async function applyEnabledByLevel(threshold, enabled) {
  if (!state.isAdmin) return alert("Connecte-toi en admin.");
  if (!state.scored.length) return;

  const targets = enabled
    ? state.scored.filter((player) => player.quality_level >= threshold)
    : state.scored.filter((player) => player.quality_level <= threshold);

  const action = enabled ? "réactiver" : "désactiver";
  const ok = confirm(`${action} ${targets.length.toLocaleString("fr-FR")} joueur(s) ?`);
  if (!ok) return;

  setStatus(`${action} joueurs...`);

  const rows = targets.map((player) => ({
    ...player,
    enabled,
    quality_updated_at: new Date().toISOString()
  }));

  await upsertQualityRows(rows);

  const enabledMap = new Map(rows.map((player) => [player.id, player.enabled]));
  state.scored = state.scored.map((player) => enabledMap.has(player.id) ? { ...player, enabled: enabledMap.get(player.id) } : player);

  renderLists();
  setStatus(`${targets.length.toLocaleString("fr-FR")} joueur(s) mis à jour.`, "good");
}

async function upsertQualityRows(players) {
  const rows = players.map((player) => ({
    id: player.id,
    name: player.name || player.base_name || player.id,
    base_name: player.base_name || player.name || player.id,
    position: player.position || null,
    birth_date: player.birth_date || null,
    tags: Array.isArray(player.tags) ? player.tags : [],
    logos: Array.isArray(player.logos) ? player.logos : [],
    enabled: player.enabled !== false,
    quality_score: Number(player.quality_score || 0),
    quality_level: Number(player.quality_level || 0),
    quality_reasons: Array.isArray(player.quality_reasons) ? player.quality_reasons : [],
    quality_updated_at: player.quality_updated_at || new Date().toISOString()
  }));

  const chunks = chunk(rows, 350);
  let done = 0;

  for (const part of chunks) {
    const { error } = await supabase
      .from("players")
      .upsert(part, { onConflict: "id" });

    if (error) {
      if (String(error.message || "").includes("quality_")) {
        throw new Error("Colonnes quality manquantes. Lance d'abord le fichier supabase_v90_player_quality.sql dans Supabase SQL Editor.");
      }
      throw error;
    }

    done += part.length;
    setStatus(`Mise à jour... ${done}/${rows.length}`);
  }
}

function updateButtons() {
  const hasScores = state.scored.length > 0;
  els.saveBtn.disabled = !state.isAdmin || !hasScores;
  els.disable01Btn.disabled = !state.isAdmin || !hasScores;
  els.disable02Btn.disabled = !state.isAdmin || !hasScores;
  els.enable3Btn.disabled = !state.isAdmin || !hasScores;
}

function setStatus(message, type = "") {
  els.status.textContent = message;
  els.status.className = "admin-status";
  if (type) els.status.classList.add(type);
}

function chunk(items, size) {
  const chunks = [];
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size));
  return chunks;
}

function escapeHtml(text) {
  const element = document.createElement("div");
  element.textContent = String(text ?? "");
  return element.innerHTML;
}
