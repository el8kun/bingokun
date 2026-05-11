import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";
import { supabaseConfig } from "./supabase-config.js";

const $ = (id) => document.getElementById(id);

const statusEl = $("supabaseStatus");
const playersCountEl = $("playersCountDiag");
const categoriesCountEl = $("categoriesCountDiag");
const orphanCountEl = $("orphanCountDiag");
const emptyCountEl = $("emptyCountDiag");
const orphanTagsList = $("orphanTagsList");
const emptyCategoriesList = $("emptyCategoriesList");
const categoriesDiagnosticList = $("categoriesDiagnosticList");
const categorySearch = $("categoryDiagnosticSearch");
const reloadBtn = $("reloadDiagnosticBtn");
const diagnosticLoginBtn = $("diagnosticLoginBtn");
const diagnosticLogoutBtn = $("diagnosticLogoutBtn");
const diagnosticAuthStatus = $("diagnosticAuthStatus");

let supabase = null;
let players = [];
let categories = [];
let issues = [];
let categoryCounts = new Map();
let currentUser = null;
let isAdmin = false;

reloadBtn?.addEventListener("click", loadDiagnostic);
categorySearch?.addEventListener("input", renderCategoriesDiagnostic);
diagnosticLoginBtn?.addEventListener("click", signInDiagnosticAdmin);
diagnosticLogoutBtn?.addEventListener("click", signOutDiagnosticAdmin);

init();

async function init() {
  if (!supabaseConfig?.url || !supabaseConfig?.anonKey || supabaseConfig.url.includes("COLLE_")) {
    setStatus("Configure d'abord supabase-config.js avec ton Project URL et ta anon public key.", "bad");
    return;
  }

  supabase = createClient(supabaseConfig.url, supabaseConfig.anonKey);

  supabase.auth.onAuthStateChange(async (_event, session) => {
    currentUser = session?.user || null;
    isAdmin = currentUser ? await checkDiagnosticAdmin(currentUser.id) : false;
    updateDiagnosticAuthUi();
    renderEmptyCategories(issues.filter((issue) => issue.issue_type === "empty_category"));
    renderCategoriesDiagnostic();
  });

  await refreshDiagnosticAuth();
  await loadDiagnostic();
}


async function refreshDiagnosticAuth() {
  const { data } = await supabase.auth.getSession();
  currentUser = data?.session?.user || null;
  isAdmin = currentUser ? await checkDiagnosticAdmin(currentUser.id) : false;
  updateDiagnosticAuthUi();
}

async function checkDiagnosticAdmin(userId) {
  if (!userId) return false;

  try {
    const { data, error } = await supabase
      .from("admins")
      .select("uid")
      .eq("uid", userId)
      .maybeSingle();

    if (error) throw error;
    return Boolean(data?.uid);
  } catch (error) {
    console.warn("Diagnostic admin check impossible :", error);
    return false;
  }
}

function updateDiagnosticAuthUi() {
  diagnosticLoginBtn?.classList.toggle("hidden", isAdmin);
  diagnosticLogoutBtn?.classList.toggle("hidden", !currentUser);

  if (!diagnosticAuthStatus) return;

  if (isAdmin) {
    diagnosticAuthStatus.textContent = "Admin connecté — modification autorisée";
    diagnosticAuthStatus.className = "admin-status good";
  } else if (currentUser) {
    diagnosticAuthStatus.textContent = "Compte connecté mais non admin";
    diagnosticAuthStatus.className = "admin-status bad";
  } else {
    diagnosticAuthStatus.textContent = "Lecture seule — connecte-toi en admin pour modifier";
    diagnosticAuthStatus.className = "admin-status";
  }
}

async function signInDiagnosticAdmin() {
  const email = prompt("Email admin Supabase :");
  if (!email) return;

  const password = prompt("Mot de passe admin Supabase :");
  if (!password) return;

  const { error } = await supabase.auth.signInWithPassword({
    email: email.trim(),
    password
  });

  if (error) {
    alert("Connexion impossible : " + error.message);
    return;
  }

  await refreshDiagnosticAuth();
}

async function signOutDiagnosticAdmin() {
  await supabase.auth.signOut();
  currentUser = null;
  isAdmin = false;
  updateDiagnosticAuthUi();
}


async function loadDiagnostic() {
  try {
    setStatus("Chargement des données Supabase…");

    const [playersResult, categoriesResult, issuesResult] = await Promise.all([
      fetchAll("players", "id,name,tags,enabled"),
      fetchAll("categories", "id,title,name,kicker,type,tags,enabled,visual_type,short_label"),
      fetchAll("import_issues", "id,issue_type,tag_id,title,details")
    ]);

    players = playersResult;
    categories = categoriesResult;
    issues = issuesResult;

    buildCategoryCounts();

    playersCountEl.textContent = players.length.toLocaleString("fr-FR");
    categoriesCountEl.textContent = categories.length.toLocaleString("fr-FR");

    const orphanIssues = issues.filter((issue) => issue.issue_type === "orphan_player_tag");
    const emptyIssues = issues.filter((issue) => issue.issue_type === "empty_category");

    orphanCountEl.textContent = orphanIssues.length;
    emptyCountEl.textContent = emptyIssues.length;

    renderOrphanTags(orphanIssues);
    renderEmptyCategories(emptyIssues);
    renderCategoriesDiagnostic();

    setStatus("Diagnostic chargé.", "good");
  } catch (error) {
    console.error(error);
    setStatus("Erreur Supabase : " + error.message, "bad");
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

function buildCategoryCounts() {
  categoryCounts = new Map();

  for (const category of categories) {
    const tags = Array.isArray(category.tags) ? category.tags : [];
    let count = 0;

    if (tags.length) {
      for (const player of players) {
        const playerTags = Array.isArray(player.tags) ? player.tags : [];
        const ok = tags.every((tag) => playerTags.includes(tag));
        if (ok) count++;
      }
    }

    categoryCounts.set(category.id, count);
  }
}

function renderOrphanTags(orphanIssues) {
  if (!orphanTagsList) return;

  if (!orphanIssues.length) {
    orphanTagsList.innerHTML = `<div class="admin-empty-list">Aucun tag orphelin.</div>`;
    return;
  }

  orphanTagsList.innerHTML = orphanIssues.map((issue) => {
    const count = issue.details?.player_count ?? "—";
    const examples = getPlayersWithTag(issue.tag_id).slice(0, 5).map((p) => p.name).join(", ");

    return `
      <article class="diagnostic-row warning">
        <div>
          <strong>${escapeHtml(issue.tag_id)}</strong>
          <span>${count} joueur(s) · ${escapeHtml(examples || "aucun exemple")}</span>
        </div>
        <button class="tiny-btn" type="button" data-copy-tag="${escapeHtml(issue.tag_id)}">Copier tag</button>
      </article>
    `;
  }).join("");

  orphanTagsList.querySelectorAll("[data-copy-tag]").forEach((button) => {
    button.addEventListener("click", () => navigator.clipboard?.writeText(button.dataset.copyTag));
  });
}

function renderEmptyCategories(emptyIssues) {
  if (!emptyCategoriesList) return;

  if (!emptyIssues.length) {
    emptyCategoriesList.innerHTML = `<div class="admin-empty-list">Aucune catégorie vide.</div>`;
    return;
  }

  emptyCategoriesList.innerHTML = emptyIssues.map((issue) => {
    const category = categories.find((item) => item.id === issue.tag_id);
    const disabled = category?.enabled === false;
    const title = category?.title || issue.title || issue.tag_id;

    return `
      <article class="diagnostic-row danger">
        <div>
          <strong>${escapeHtml(issue.tag_id)} — ${escapeHtml(title)}</strong>
          <span>${escapeHtml(category?.kicker || "Catégorie")} · ${disabled ? "désactivée" : "active"}</span>
        </div>
        <button class="tiny-btn danger-btn" type="button" data-disable-category="${escapeHtml(issue.tag_id)}" ${disabled || !isAdmin ? "disabled" : ""}>
          ${!isAdmin ? "Lecture seule" : disabled ? "Déjà désactivée" : "Désactiver"}
        </button>
      </article>
    `;
  }).join("");

  emptyCategoriesList.querySelectorAll("[data-disable-category]").forEach((button) => {
    button.addEventListener("click", () => disableCategory(button.dataset.disableCategory));
  });
}

function renderCategoriesDiagnostic() {
  if (!categoriesDiagnosticList) return;

  const query = normalize(categorySearch?.value || "");
  const filtered = categories
    .filter((category) => {
      const haystack = normalize(`${category.id} ${category.title} ${category.name} ${category.kicker} ${category.short_label}`);
      return !query || haystack.includes(query);
    })
    .slice(0, 120);

  if (!filtered.length) {
    categoriesDiagnosticList.innerHTML = `<div class="admin-empty-list">Aucune catégorie trouvée.</div>`;
    return;
  }

  categoriesDiagnosticList.innerHTML = filtered.map((category) => {
    const count = categoryCounts.get(category.id) || 0;
    const disabled = category.enabled === false;
    const empty = count === 0;
    const rowClass = disabled ? "disabled" : empty ? "danger" : "good";

    return `
      <article class="diagnostic-row ${rowClass}">
        <div>
          <strong>${escapeHtml(category.id)} — ${escapeHtml(category.title || category.name || category.id)}</strong>
          <span>${escapeHtml(category.kicker || "Catégorie")} · ${count} joueur(s) · ${disabled ? "désactivée" : "active"}</span>
        </div>
        <button class="tiny-btn ${disabled ? "" : "danger-btn"}" type="button" data-toggle-category="${escapeHtml(category.id)}" ${!isAdmin ? "disabled" : ""}>
          ${!isAdmin ? "Lecture seule" : disabled ? "Réactiver" : "Désactiver"}
        </button>
      </article>
    `;
  }).join("");

  categoriesDiagnosticList.querySelectorAll("[data-toggle-category]").forEach((button) => {
    button.addEventListener("click", () => toggleCategory(button.dataset.toggleCategory));
  });
}

async function disableCategory(categoryId) {
  await updateCategoryEnabled(categoryId, false);
}

async function toggleCategory(categoryId) {
  const category = categories.find((item) => item.id === categoryId);
  if (!category) return;
  await updateCategoryEnabled(categoryId, category.enabled === false);
}

async function updateCategoryEnabled(categoryId, enabled) {
  if (!isAdmin) {
    alert("Connecte-toi en admin pour modifier les catégories.");
    return;
  }

  const category = categories.find((item) => item.id === categoryId);
  const label = category?.title || categoryId;

  const confirmation = confirm(`${enabled ? "Réactiver" : "Désactiver"} ${label} ?`);
  if (!confirmation) return;

  const { error } = await supabase
    .from("categories")
    .update({ enabled })
    .eq("id", categoryId);

  if (error) {
    setStatus("Impossible de modifier la catégorie : " + error.message, "bad");
    return;
  }

  if (category) category.enabled = enabled;
  renderEmptyCategories(issues.filter((issue) => issue.issue_type === "empty_category"));
  renderCategoriesDiagnostic();
  setStatus(`${label} ${enabled ? "réactivée" : "désactivée"}.`, "good");
}

function getPlayersWithTag(tagId) {
  return players.filter((player) => Array.isArray(player.tags) && player.tags.includes(tagId));
}

function setStatus(message, type = "") {
  if (!statusEl) return;
  statusEl.textContent = message;
  statusEl.className = "admin-status";
  if (type) statusEl.classList.add(type);
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
