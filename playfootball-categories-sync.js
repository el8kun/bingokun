import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";
import { supabaseConfig } from "./supabase-config.js";

const $ = (id) => document.getElementById(id);
const supabase = createClient(supabaseConfig.url, supabaseConfig.anonKey);

const catLoginBtn = $("catLoginBtn");
const catLogoutBtn = $("catLogoutBtn");
const catLoadBtn = $("catLoadBtn");
const catImportNewBtn = $("catImportNewBtn");
const catUpdateExistingBtn = $("catUpdateExistingBtn");
const catSyncAllBtn = $("catSyncAllBtn");
const catSourceUrlInput = $("catSourceUrlInput");
const catLocalFileInput = $("catLocalFileInput");
const catPreferFullNameCheck = $("catPreferFullNameCheck");
const catKeepExistingNamesCheck = $("catKeepExistingNamesCheck");

const catAuthStatus = $("catAuthStatus");
const catStatus = $("catStatus");
const catSourceCount = $("catSourceCount");
const catSupabaseCount = $("catSupabaseCount");
const catNewCount = $("catNewCount");
const catUpdateCount = $("catUpdateCount");
const catNewList = $("catNewList");
const catUpdateList = $("catUpdateList");

const catLoginOverlay = $("catLoginOverlay");
const catLoginForm = $("catLoginForm");
const catEmailInput = $("catEmailInput");
const catPasswordInput = $("catPasswordInput");
const catLoginCancelBtn = $("catLoginCancelBtn");
const catLoginSubmitBtn = $("catLoginSubmitBtn");
const catLoginMessage = $("catLoginMessage");

let currentUser = null;
let isAdmin = false;
let sourceCategories = [];
let supabaseCategories = [];
let newCategories = [];
let updateCategories = [];

const TYPE_TO_VISUAL = {
  1: "flag",
  2: "club",
  3: "league",
  4: "coach",
  5: "player",
  6: "trophy",
  8: "special"
};

const TYPE_TO_KICKER = {
  1: "Nationalité",
  2: "A joué à",
  3: "A joué en",
  4: "Entraîné par",
  5: "A joué avec",
  6: "Palmarès",
  8: "Spécial"
};

catLoginBtn?.addEventListener("click", showLoginModal);
catLogoutBtn?.addEventListener("click", signOut);
catLoadBtn?.addEventListener("click", loadAndCompare);
catImportNewBtn?.addEventListener("click", () => importNewCategories());
catUpdateExistingBtn?.addEventListener("click", () => updateExistingCategories());
catSyncAllBtn?.addEventListener("click", async () => {
  await importNewCategories({ silent: true });
  await updateExistingCategories({ silent: true });
  setStatus("Synchronisation catégories terminée.", "good");
  await loadAndCompare();
});
catLoginCancelBtn?.addEventListener("click", hideLoginModal);
catLoginOverlay?.addEventListener("click", (event) => {
  if (event.target === catLoginOverlay) hideLoginModal();
});
catLoginForm?.addEventListener("submit", handleLoginSubmit);
catLocalFileInput?.addEventListener("change", loadLocalFile);

init();

async function init() {
  await refreshAuth();

  supabase.auth.onAuthStateChange(async (_event, session) => {
    currentUser = session?.user || null;
    isAdmin = currentUser ? await checkAdmin() : false;
    updateAuthUi();
  });

  updateButtons();
}

function withTimeout(promise, ms = 12000, label = "Action trop longue") {
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
  catLoginBtn?.classList.toggle("hidden", isAdmin);
  catLogoutBtn?.classList.toggle("hidden", !currentUser);

  if (isAdmin) {
    catAuthStatus.textContent = "Admin connecté — synchronisation autorisée";
    catAuthStatus.className = "admin-status good";
  } else if (currentUser) {
    catAuthStatus.textContent = "Compte connecté mais non admin";
    catAuthStatus.className = "admin-status bad";
  } else {
    catAuthStatus.textContent = "Lecture seule — connecte-toi en admin.";
    catAuthStatus.className = "admin-status";
  }

  updateButtons();
}

function showLoginModal() {
  catLoginMessage.textContent = "";
  catLoginMessage.className = "admin-login-message";
  catLoginOverlay.classList.remove("hidden");
  document.body.classList.add("overlay-open");
  setTimeout(() => catEmailInput?.focus(), 50);
}

function hideLoginModal() {
  catLoginOverlay.classList.add("hidden");
  document.body.classList.remove("overlay-open");
}

async function handleLoginSubmit(event) {
  event.preventDefault();

  catLoginMessage.textContent = "Connexion en cours...";
  catLoginMessage.className = "admin-login-message";
  catLoginSubmitBtn.disabled = true;
  catLoginSubmitBtn.textContent = "Connexion...";

  try {
    const login = await withTimeout(
      supabase.auth.signInWithPassword({
        email: catEmailInput.value.trim(),
        password: catPasswordInput.value
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
    catLoginMessage.textContent = error.message || "Connexion impossible.";
    catLoginMessage.className = "admin-login-message bad";
  } finally {
    catLoginSubmitBtn.disabled = false;
    catLoginSubmitBtn.textContent = "Se connecter";
  }
}

async function signOut() {
  await supabase.auth.signOut();
  currentUser = null;
  isAdmin = false;
  updateAuthUi();
}

async function loadAndCompare() {
  setStatus("Chargement du fichier _gameIndex_...");
  catLoadBtn.disabled = true;

  try {
    const [sourceText, current] = await Promise.all([
      fetchSourceText(),
      fetchAllSupabaseCategories()
    ]);

    sourceCategories = extractCategoriesFromGameIndex(sourceText);
    supabaseCategories = current;

    compareCategories();
    renderStats();
    renderLists();
    updateButtons();

    setStatus("Comparaison catégories terminée.", "good");
  } catch (error) {
    console.error(error);
    setStatus(error.message || "Erreur comparaison.", "bad");
  } finally {
    catLoadBtn.disabled = false;
  }
}

async function fetchSourceText() {
  const url = catSourceUrlInput.value.trim();
  const response = await withTimeout(fetch(url), 20000, "Source _gameIndex_ trop lente.");

  if (!response.ok) {
    throw new Error(`Erreur source _gameIndex_ : ${response.status} ${response.statusText}`);
  }

  return await response.text();
}

async function loadLocalFile() {
  const file = catLocalFileInput.files?.[0];
  if (!file) return;

  try {
    setStatus("Lecture du fichier local...");
    const text = await file.text();
    supabaseCategories = await fetchAllSupabaseCategories();
    sourceCategories = extractCategoriesFromGameIndex(text);
    compareCategories();
    renderStats();
    renderLists();
    updateButtons();
    setStatus("Fichier local chargé et comparé.", "good");
  } catch (error) {
    console.error(error);
    setStatus(error.message || "Erreur fichier local.", "bad");
  }
}

async function fetchAllSupabaseCategories() {
  const pageSize = 1000;
  let from = 0;
  let rows = [];

  while (true) {
    const { data, error } = await supabase
      .from("categories")
      .select("id,title,name,kicker,type,match_rule,tags,source_ids,logo,visual_type,image,short_label,helper_text,visuals,enabled")
      .range(from, from + pageSize - 1);

    if (error) throw error;

    rows = rows.concat(data || []);
    if (!data || data.length < pageSize) break;
    from += pageSize;
  }

  return rows;
}

function extractCategoriesFromGameIndex(text) {
  const byId = new Map();
  const objectRegex = /\{id:(\d+),name:"((?:\\.|[^"\\])*)",type:(\d+),displayName:"((?:\\.|[^"\\])*)"(?:,suffix:"((?:\\.|[^"\\])*)")?(?:,prefix:"((?:\\.|[^"\\])*)")?(?:,helperText:"((?:\\.|[^"\\])*)")?\}/g;

  let match;

  while ((match = objectRegex.exec(text)) !== null) {
    const numericId = Number(match[1]);
    const id = `cat_${numericId}`;
    const name = unescapeJsString(match[2]);
    const type = Number(match[3]);
    const displayName = unescapeJsString(match[4]);
    const suffix = match[5] ? unescapeJsString(match[5]) : "";
    const prefix = match[6] ? unescapeJsString(match[6]) : "";
    const helperText = match[7] ? unescapeJsString(match[7]) : "";

    if (!byId.has(id)) {
      byId.set(id, mapSourceCategory({
        numericId,
        id,
        name,
        type,
        displayName,
        suffix,
        prefix,
        helperText
      }));
    } else {
      // Conserve la version avec le helperText le plus informatif.
      const current = byId.get(id);
      if (!current.helper_text && helperText) {
        byId.set(id, mapSourceCategory({
          numericId,
          id,
          name,
          type,
          displayName,
          suffix,
          prefix,
          helperText
        }));
      }
    }
  }

  const categories = [...byId.values()].sort((a, b) => Number(a.id.replace("cat_", "")) - Number(b.id.replace("cat_", "")));

  if (!categories.length) {
    throw new Error("Aucune catégorie détectée dans le fichier _gameIndex_.");
  }

  return categories;
}

function unescapeJsString(value) {
  try {
    return JSON.parse(`"${value}"`);
  } catch (_error) {
    return String(value || "");
  }
}

function mapSourceCategory(source) {
  const visualType = TYPE_TO_VISUAL[source.type] || "default";
  const kicker = source.prefix || TYPE_TO_KICKER[source.type] || "Catégorie";
  const useFullName = Boolean(catPreferFullNameCheck?.checked);
  const title = useFullName && [1, 2, 3, 4, 5].includes(source.type)
    ? source.name
    : source.displayName || source.name;

  return {
    id: source.id,
    title,
    name: source.name,
    kicker,
    type: source.type,
    match_rule: "all",
    tags: [source.id],
    source_ids: [source.numericId],
    logo: source.id,
    visual_type: visualType,
    image: `./assets/icons/${getVisualFolder(visualType)}/${source.id}.svg`,
    short_label: source.displayName || source.name,
    helper_text: source.helperText,
    visuals: [{
      visualType,
      image: `./assets/icons/${getVisualFolder(visualType)}/${source.id}.svg`,
      shortLabel: source.displayName || source.name
    }],
    enabled: true
  };
}

function getVisualFolder(visualType = "") {
  const map = {
    club: "clubs",
    flag: "flags",
    league: "leagues",
    trophy: "trophies",
    special: "special"
  };

  return map[String(visualType || "").toLowerCase()] || "ui";
}

function compareCategories() {
  const existingById = new Map(supabaseCategories.map((category) => [category.id, category]));

  newCategories = [];
  updateCategories = [];

  for (const source of sourceCategories) {
    const existing = existingById.get(source.id);

    if (!existing) {
      newCategories.push(source);
      continue;
    }

    const patch = buildCategoryPatch(existing, source);

    if (Object.keys(patch).length) {
      updateCategories.push({ existing, source, patch });
    }
  }
}

function buildCategoryPatch(existing, source) {
  const keepNames = Boolean(catKeepExistingNamesCheck?.checked);
  const patch = {};

  if (!keepNames) {
    if ((existing.title || "") !== source.title) patch.title = source.title;
    if ((existing.name || "") !== source.name) patch.name = source.name;
    if ((existing.short_label || "") !== source.short_label) patch.short_label = source.short_label;
  } else {
    // Même quand on garde tes noms, on remplit les champs vides.
    if (!existing.title && source.title) patch.title = source.title;
    if (!existing.name && source.name) patch.name = source.name;
    if (!existing.short_label && source.short_label) patch.short_label = source.short_label;
  }

  if ((existing.kicker || "") !== source.kicker && !existing.kicker) patch.kicker = source.kicker;
  if (Number(existing.type || 0) !== Number(source.type || 0)) patch.type = source.type;
  if ((existing.visual_type || "") !== source.visual_type) patch.visual_type = source.visual_type;
  if ((existing.helper_text || "") !== source.helper_text && source.helper_text) patch.helper_text = source.helper_text;

  const existingTags = JSON.stringify(existing.tags || []);
  const sourceTags = JSON.stringify(source.tags || []);
  if (existingTags !== sourceTags) patch.tags = source.tags;

  const existingSourceIds = JSON.stringify(existing.source_ids || []);
  const sourceSourceIds = JSON.stringify(source.source_ids || []);
  if (existingSourceIds !== sourceSourceIds) patch.source_ids = source.source_ids;

  if (!existing.logo) patch.logo = source.logo;
  if (!existing.image) patch.image = source.image;
  if (!existing.visuals || !existing.visuals.length) patch.visuals = source.visuals;
  if (existing.enabled === false) patch.enabled = true;

  return patch;
}

function renderStats() {
  catSourceCount.textContent = sourceCategories.length.toLocaleString("fr-FR");
  catSupabaseCount.textContent = supabaseCategories.length.toLocaleString("fr-FR");
  catNewCount.textContent = newCategories.length.toLocaleString("fr-FR");
  catUpdateCount.textContent = updateCategories.length.toLocaleString("fr-FR");
}

function renderLists() {
  if (!newCategories.length) {
    catNewList.innerHTML = `<div class="admin-empty-list">Aucune nouvelle catégorie.</div>`;
  } else {
    catNewList.innerHTML = newCategories.slice(0, 300).map((category) => `
      <article class="diagnostic-row good">
        <div>
          <strong>${escapeHtml(category.id)} — ${escapeHtml(category.title || category.name)}</strong>
          <span>${escapeHtml(category.kicker)} · type ${category.type} · ${escapeHtml(category.short_label || "")}</span>
        </div>
      </article>
    `).join("");

    if (newCategories.length > 300) {
      catNewList.innerHTML += `<div class="admin-empty-list">+ ${newCategories.length - 300} catégorie(s) non affichée(s).</div>`;
    }
  }

  if (!updateCategories.length) {
    catUpdateList.innerHTML = `<div class="admin-empty-list">Aucune catégorie à corriger.</div>`;
  } else {
    catUpdateList.innerHTML = updateCategories.slice(0, 300).map((item) => `
      <article class="diagnostic-row warning">
        <div>
          <strong>${escapeHtml(item.existing.id)} — ${escapeHtml(item.existing.title || item.existing.name || item.source.title)}</strong>
          <span>${escapeHtml(Object.keys(item.patch).join(", "))}</span>
        </div>
      </article>
    `).join("");

    if (updateCategories.length > 300) {
      catUpdateList.innerHTML += `<div class="admin-empty-list">+ ${updateCategories.length - 300} catégorie(s) non affichée(s).</div>`;
    }
  }
}

function updateButtons() {
  const hasCompared = sourceCategories.length > 0;
  catImportNewBtn.disabled = !isAdmin || !hasCompared || !newCategories.length;
  catUpdateExistingBtn.disabled = !isAdmin || !hasCompared || !updateCategories.length;
  catSyncAllBtn.disabled = !isAdmin || !hasCompared || (!newCategories.length && !updateCategories.length);
}

async function importNewCategories(options = {}) {
  if (!isAdmin) return alert("Connecte-toi en admin.");
  if (!newCategories.length) return;

  if (!options.silent) {
    const ok = confirm(`Créer ${newCategories.length} nouvelle(s) catégorie(s) ?`);
    if (!ok) return;
  }

  setStatus("Création catégories manquantes...");
  await upsertCategories(newCategories);

  if (!options.silent) {
    setStatus(`${newCategories.length} catégorie(s) créée(s).`, "good");
    await loadAndCompare();
  }
}

async function updateExistingCategories(options = {}) {
  if (!isAdmin) return alert("Connecte-toi en admin.");
  if (!updateCategories.length) return;

  if (!options.silent) {
    const ok = confirm(`Corriger ${updateCategories.length} catégorie(s) existante(s) ?`);
    if (!ok) return;
  }

  setStatus("Correction catégories existantes...");
  await upsertCategories(updateCategories.map((item) => ({
    ...item.existing,
    ...item.patch,
    updated_at: new Date().toISOString()
  })));

  if (!options.silent) {
    setStatus(`${updateCategories.length} catégorie(s) corrigée(s).`, "good");
    await loadAndCompare();
  }
}

async function upsertCategories(rows) {
  const chunks = chunk(rows.map(normalizeCategoryForUpsert), 250);
  let done = 0;

  for (const part of chunks) {
    const { error } = await supabase
      .from("categories")
      .upsert(part, { onConflict: "id" });

    if (error) throw error;

    done += part.length;
    setStatus(`Synchronisation catégories… ${done}/${rows.length}`);
  }
}

function normalizeCategoryForUpsert(category) {
  return {
    id: category.id,
    title: category.title || category.name || category.id,
    name: category.name || category.title || category.id,
    kicker: category.kicker || "Catégorie",
    type: category.type || 0,
    match_rule: category.match_rule || "all",
    tags: Array.isArray(category.tags) ? category.tags : [category.id],
    source_ids: Array.isArray(category.source_ids) ? category.source_ids : [Number(String(category.id).replace("cat_", ""))],
    logo: category.logo || category.id,
    visual_type: category.visual_type || "default",
    image: category.image || "",
    short_label: category.short_label || category.title || category.name || category.id,
    helper_text: category.helper_text || "",
    visuals: Array.isArray(category.visuals) ? category.visuals : [],
    enabled: category.enabled !== false,
    updated_at: new Date().toISOString()
  };
}

function chunk(items, size) {
  const chunks = [];
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size));
  return chunks;
}

function setStatus(message, type = "") {
  catStatus.textContent = message;
  catStatus.className = "admin-status";
  if (type) catStatus.classList.add(type);
}

function escapeHtml(text) {
  const element = document.createElement("div");
  element.textContent = String(text ?? "");
  return element.innerHTML;
}
