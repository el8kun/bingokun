import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";
import { supabaseConfig } from "./supabase-config.js";

const $ = (id) => document.getElementById(id);

const supabase = createClient(supabaseConfig.url, supabaseConfig.anonKey);

const euLoginBtn = $("euLoginBtn");
const euLogoutBtn = $("euLogoutBtn");
const euReloadBtn = $("euReloadBtn");
const euPreviewBtn = $("euPreviewBtn");
const euDisableBtn = $("euDisableBtn");
const euTagSearch = $("euTagSearch");

const euAuthStatus = $("euAuthStatus");
const euStatus = $("euStatus");
const euTotalPlayers = $("euTotalPlayers");
const euEnabledPlayers = $("euEnabledPlayers");
const euEuropePlayers = $("euEuropePlayers");
const euOutsidePlayers = $("euOutsidePlayers");
const euTagsList = $("euTagsList");
const euPlayersList = $("euPlayersList");

const euLoginOverlay = $("euLoginOverlay");
const euLoginForm = $("euLoginForm");
const euEmailInput = $("euEmailInput");
const euPasswordInput = $("euPasswordInput");
const euLoginCancelBtn = $("euLoginCancelBtn");
const euLoginSubmitBtn = $("euLoginSubmitBtn");
const euLoginMessage = $("euLoginMessage");

let currentUser = null;
let isAdmin = false;
let players = [];
let categories = [];
let selectedEuropeTags = new Set();
let outsideEuropePlayers = [];

// Clubs européens connus dans ta BDD actuelle.
// Tu peux cocher/décocher dans l'interface avant de lancer.
const KNOWN_EUROPE_CLUB_TAGS = new Set([
  "cat_176", // Ajax
  "cat_84",  // Arsenal
  "cat_86",  // Atletico
  "cat_112", // Barcelona
  "cat_148", // Celtic
  "cat_179", // Chelsea
  "cat_92",  // Everton
  "cat_113", // Galatasaray
  "cat_99",  // Inter
  "cat_167", // Juventus
  "cat_153", // Lazio
  "cat_207", // Leicester
  "cat_219", // Lille
  "cat_93",  // Liverpool
  "cat_133", // Man City
  "cat_83",  // Milan
  "cat_204", // Man United
  "cat_262", // Napoli
  "cat_159", // Nice
  "cat_191", // Newcastle
  "cat_215", // Olympique Marseille / OLM
  "cat_129", // Olympique Marseille / autre OLM européen
  "cat_186", // Porto
  "cat_172", // PSG
  "cat_151", // PSV
  "cat_109", // Rangers
  "cat_160", // Real Madrid
  "cat_85",  // Roma
  "cat_141", // Sporting CP
  "cat_147", // Sevilla
  "cat_135", // Benfica
  "cat_183", // Sociedad / Sochaux selon ton tag, à vérifier
  "cat_114", // Tottenham
  "cat_217", // Villarreal
  "cat_149"  // West Ham
]);

const EUROPE_KEYWORDS = [
  "premier league",
  "english league",
  "laliga",
  "la liga",
  "spanish league",
  "serie a",
  "italian league",
  "bundesliga",
  "german league",
  "ligue 1",
  "french league",
  "eredivisie",
  "dutch league",
  "liga portugal",
  "portuguese league",
  "scottish league",
  "belgian league",
  "turkish league",
  "swiss league",
  "austrian league",
  "ucl",
  "champions league",
  "europa league",
  "conference league",
  "uefa",
  "ucl final",
  "euros"
];

euLoginBtn?.addEventListener("click", showLoginModal);
euLogoutBtn?.addEventListener("click", signOut);
euReloadBtn?.addEventListener("click", loadData);
euPreviewBtn?.addEventListener("click", recompute);
euDisableBtn?.addEventListener("click", disableOutsideEuropePlayers);
euTagSearch?.addEventListener("input", renderEuropeTags);
euLoginCancelBtn?.addEventListener("click", hideLoginModal);
euLoginOverlay?.addEventListener("click", (event) => {
  if (event.target === euLoginOverlay) hideLoginModal();
});
euLoginForm?.addEventListener("submit", handleLoginSubmit);

init();

async function init() {
  await refreshAuth();

  supabase.auth.onAuthStateChange(async (_event, session) => {
    currentUser = session?.user || null;
    isAdmin = currentUser ? await checkAdmin() : false;
    updateAuthUi();
  });

  await loadData();
}

function withTimeout(promise, ms = 10000, label = "Action trop longue") {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(label)), ms))
  ]);
}

async function refreshAuth() {
  const { data } = await supabase.auth.getSession();
  currentUser = data?.session?.user || null;
  isAdmin = currentUser ? await checkAdmin() : false;
  updateAuthUi();
}

async function checkAdmin() {
  try {
    const rpc = await withTimeout(supabase.rpc("is_admin"), 5000, "Vérification admin trop longue");
    if (!rpc.error && rpc.data === true) return true;

    const result = await withTimeout(
      supabase.from("admins").select("uid").eq("uid", currentUser?.id).maybeSingle(),
      5000,
      "Lecture admins trop longue"
    );

    if (result.error) throw result.error;
    return Boolean(result.data?.uid);
  } catch (error) {
    console.warn("Admin check impossible:", error);
    return false;
  }
}

function updateAuthUi() {
  euLoginBtn?.classList.toggle("hidden", isAdmin);
  euLogoutBtn?.classList.toggle("hidden", !currentUser);

  if (isAdmin) {
    euAuthStatus.textContent = "Admin connecté — désactivation autorisée";
    euAuthStatus.className = "admin-status good";
  } else if (currentUser) {
    euAuthStatus.textContent = "Compte connecté mais non admin";
    euAuthStatus.className = "admin-status bad";
  } else {
    euAuthStatus.textContent = "Lecture seule — connecte-toi en admin.";
    euAuthStatus.className = "admin-status";
  }

  updateDisableButton();
}

function showLoginModal() {
  euLoginMessage.textContent = "";
  euLoginMessage.className = "admin-login-message";
  euLoginOverlay.classList.remove("hidden");
  document.body.classList.add("overlay-open");
  setTimeout(() => euEmailInput?.focus(), 50);
}

function hideLoginModal() {
  euLoginOverlay.classList.add("hidden");
  document.body.classList.remove("overlay-open");
}

async function handleLoginSubmit(event) {
  event.preventDefault();

  euLoginMessage.textContent = "Connexion en cours...";
  euLoginMessage.className = "admin-login-message";
  euLoginSubmitBtn.disabled = true;
  euLoginSubmitBtn.textContent = "Connexion...";

  try {
    const login = await withTimeout(
      supabase.auth.signInWithPassword({
        email: euEmailInput.value.trim(),
        password: euPasswordInput.value
      }),
      9000,
      "Connexion trop longue."
    );

    if (login.error) throw login.error;

    currentUser = login.data?.user || null;
    isAdmin = await checkAdmin();
    updateAuthUi();

    if (!isAdmin) throw new Error("Connecté, mais ce compte n'est pas admin.");

    hideLoginModal();
  } catch (error) {
    euLoginMessage.textContent = error.message || "Connexion impossible.";
    euLoginMessage.className = "admin-login-message bad";
  } finally {
    euLoginSubmitBtn.disabled = false;
    euLoginSubmitBtn.textContent = "Se connecter";
  }
}

async function signOut() {
  await supabase.auth.signOut();
  currentUser = null;
  isAdmin = false;
  updateAuthUi();
}

async function loadData() {
  setStatus("Chargement joueurs/catégories Supabase…");

  try {
    const [playerRows, categoryRows] = await Promise.all([
      fetchAll("players", "id,name,tags,enabled"),
      fetchAll("categories", "id,title,name,kicker,tags,visual_type,short_label,image,logo,visuals,enabled")
    ]);

    players = playerRows;
    categories = categoryRows.filter((category) => category.enabled !== false);

    selectedEuropeTags = new Set(detectEuropeTags(categories));
    recompute();

    setStatus("Données chargées.", "good");
  } catch (error) {
    console.error(error);
    setStatus(error.message || "Erreur chargement.", "bad");
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

function detectEuropeTags(categoryRows) {
  return categoryRows
    .filter((category) => {
      if (KNOWN_EUROPE_CLUB_TAGS.has(category.id)) return true;

      const text = normalize(`${category.title} ${category.name} ${category.kicker} ${category.short_label}`);
      const isLeagueOrCompetition = EUROPE_KEYWORDS.some((keyword) => text.includes(keyword));
      const isNotNationality = !/nationalit/i.test(text);

      return isLeagueOrCompetition && isNotNationality;
    })
    .map((category) => category.id);
}

function recompute() {
  const enabledPlayers = players.filter((player) => player.enabled !== false);
  const europeTags = selectedEuropeTags;

  const europePlayers = [];
  outsideEuropePlayers = [];

  for (const player of enabledPlayers) {
    const tags = Array.isArray(player.tags) ? player.tags : [];
    const hasEurope = tags.some((tag) => europeTags.has(tag));

    if (hasEurope) europePlayers.push(player);
    else outsideEuropePlayers.push(player);
  }

  euTotalPlayers.textContent = players.length.toLocaleString("fr-FR");
  euEnabledPlayers.textContent = enabledPlayers.length.toLocaleString("fr-FR");
  euEuropePlayers.textContent = europePlayers.length.toLocaleString("fr-FR");
  euOutsidePlayers.textContent = outsideEuropePlayers.length.toLocaleString("fr-FR");

  renderEuropeTags();
  renderOutsidePlayers();
  updateDisableButton();
}

function renderEuropeTags() {
  const query = normalize(euTagSearch?.value || "");
  const selected = selectedEuropeTags;

  const rows = categories
    .filter((category) => selected.has(category.id) || isPotentialEuropeCategory(category))
    .filter((category) => {
      const haystack = normalize(`${category.id} ${category.title} ${category.name} ${category.kicker} ${category.short_label}`);
      return !query || haystack.includes(query);
    })
    .sort((a, b) => {
      const aSelected = selected.has(a.id) ? 0 : 1;
      const bSelected = selected.has(b.id) ? 0 : 1;
      if (aSelected !== bSelected) return aSelected - bSelected;
      return String(a.title || a.name || a.id).localeCompare(String(b.title || b.name || b.id), "fr");
    });

  euTagsList.innerHTML = rows.map((category) => {
    const checked = selected.has(category.id);

    return `
      <label class="diagnostic-row eu-tag-row ${checked ? "good" : ""}">
        <input type="checkbox" data-eu-tag="${escapeHtml(category.id)}" ${checked ? "checked" : ""} />
        ${renderCategoryLogo(category)}
        <div>
          <strong>${escapeHtml(category.title || category.name || category.id)}</strong>
          <span>${escapeHtml(category.kicker || "Catégorie")} · ${escapeHtml(category.id)}</span>
        </div>
      </label>
    `;
  }).join("");

  euTagsList.querySelectorAll("[data-eu-tag]").forEach((input) => {
    input.addEventListener("change", () => {
      if (input.checked) selectedEuropeTags.add(input.dataset.euTag);
      else selectedEuropeTags.delete(input.dataset.euTag);
      recompute();
    });
  });
}

function isPotentialEuropeCategory(category) {
  const text = normalize(`${category.title} ${category.name} ${category.kicker} ${category.short_label}`);
  if (/nationalit/i.test(text)) return false;
  if (category.visual_type === "club") return true;
  return EUROPE_KEYWORDS.some((keyword) => text.includes(keyword));
}

function renderOutsidePlayers() {
  if (!outsideEuropePlayers.length) {
    euPlayersList.innerHTML = `<div class="admin-empty-list">Aucun joueur hors Europe détecté avec les tags actuels.</div>`;
    return;
  }

  const preview = outsideEuropePlayers.slice(0, 300);
  euPlayersList.innerHTML = preview.map((player) => `
    <article class="diagnostic-row danger">
      <div>
        <strong>${escapeHtml(player.name || player.id)}</strong>
        <span>${escapeHtml(player.id)} · ${(player.tags || []).length} tag(s)</span>
      </div>
      <span class="eu-muted-chip">sera désactivé</span>
    </article>
  `).join("");

  if (outsideEuropePlayers.length > preview.length) {
    euPlayersList.innerHTML += `<div class="admin-empty-list">+ ${outsideEuropePlayers.length - preview.length} autre(s) joueur(s) non affiché(s).</div>`;
  }
}

function updateDisableButton() {
  if (!euDisableBtn) return;
  euDisableBtn.disabled = !isAdmin || outsideEuropePlayers.length === 0;
  euDisableBtn.textContent = outsideEuropePlayers.length
    ? `Désactiver ${outsideEuropePlayers.length.toLocaleString("fr-FR")} joueurs hors Europe`
    : "Aucun joueur à désactiver";
}

async function disableOutsideEuropePlayers() {
  if (!isAdmin) return alert("Connecte-toi en admin.");
  if (!outsideEuropePlayers.length) return;

  const confirmation = prompt(
    `Tu vas désactiver ${outsideEuropePlayers.length} joueurs. Rien ne sera supprimé. Tape EUROPE pour confirmer.`
  );

  if (confirmation !== "EUROPE") return;

  euDisableBtn.disabled = true;
  setStatus("Désactivation en cours…");

  try {
    const ids = outsideEuropePlayers.map((player) => player.id);
    const chunks = chunk(ids, 250);
    let done = 0;

    for (const part of chunks) {
      const { error } = await supabase
        .from("players")
        .update({
          enabled: false,
          updated_at: new Date().toISOString()
        })
        .in("id", part);

      if (error) throw error;
      done += part.length;
      setStatus(`Désactivation… ${done}/${ids.length}`);
    }

    players = players.map((player) => ids.includes(player.id) ? { ...player, enabled: false } : player);
    recompute();
    setStatus(`${ids.length} joueur(s) hors Europe désactivé(s).`, "good");
  } catch (error) {
    console.error(error);
    setStatus(error.message || "Erreur désactivation.", "bad");
  } finally {
    updateDisableButton();
  }
}

function chunk(items, size) {
  const chunks = [];
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size));
  return chunks;
}

function setStatus(message, type = "") {
  euStatus.textContent = message;
  euStatus.className = "admin-status";
  if (type) euStatus.classList.add(type);
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

function getCategoryNumber(category = {}) {
  const candidates = [
    category.logo,
    category.id,
    category.image,
    Array.isArray(category.visuals) ? category.visuals?.[0]?.image : ""
  ].filter(Boolean).map(String);

  for (const value of candidates) {
    const match = value.match(/cat_(\d+)/);
    if (match) return match[1];

    const numberOnly = value.match(/(?:^|\/)(\d+)\.(?:webp|png|svg|jpg|jpeg)$/i);
    if (numberOnly) return numberOnly[1];
  }

  return "";
}

function getCategoryImageCandidates(category = {}) {
  const original = category.image || category.visuals?.[0]?.image || "";
  const number = getCategoryNumber(category);
  const folder = getVisualFolder(category.visual_type);
  const candidates = [];

  if (number) {
    candidates.push(`./assets/icons/imported/${number}.webp`);
    candidates.push(`./assets/icons/imported/cat_${number}.webp`);
    candidates.push(`./assets/icons/${number}.webp`);
    candidates.push(`./assets/icons/cat_${number}.webp`);
    candidates.push(`./assets/icons/${folder}/${number}.webp`);
    candidates.push(`./assets/icons/${folder}/cat_${number}.webp`);
  }

  if (original) candidates.push(original);
  return [...new Set(candidates.filter(Boolean))];
}

window.bingoKunEuropeImageFallback = function bingoKunEuropeImageFallback(img) {
  try {
    const fallbacks = JSON.parse(img.dataset.fallbacks || "[]");
    const next = fallbacks.shift();

    if (!next) {
      img.onerror = null;
      img.style.display = "none";
      img.parentElement?.classList.add("is-missing-logo");
      return;
    }

    img.dataset.fallbacks = JSON.stringify(fallbacks);
    img.src = next;
  } catch (_error) {
    img.onerror = null;
    img.style.display = "none";
    img.parentElement?.classList.add("is-missing-logo");
  }
};

function renderCategoryLogo(category) {
  const candidates = getCategoryImageCandidates(category);
  const label = category.short_label || category.title || category.name || category.id || "?";

  if (!candidates.length) {
    return `<div class="tm-category-logo is-missing-logo"><span>${escapeHtml(String(label).slice(0, 3).toUpperCase())}</span></div>`;
  }

  const [first, ...fallbacks] = candidates;

  return `
    <div class="tm-category-logo">
      <img
        src="${escapeHtml(first)}"
        data-fallbacks='${escapeHtml(JSON.stringify(fallbacks))}'
        onerror="window.bingoKunEuropeImageFallback(this)"
        alt="${escapeHtml(label)}"
        loading="lazy"
      />
      <span>${escapeHtml(String(label).slice(0, 3).toUpperCase())}</span>
    </div>
  `;
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
