import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";
import { supabaseConfig } from "./supabase-config.js";

const $ = (id) => document.getElementById(id);

const tmApiBaseInput = $("tmApiBaseInput");
const tmPlayerIdInput = $("tmPlayerIdInput");
const tmPlayerNameInput = $("tmPlayerNameInput");
const tmSupabasePlayerIdInput = $("tmSupabasePlayerIdInput");
const tmLoadTransfersBtn = $("tmLoadTransfersBtn");
const tmImportPlayerBtn = $("tmImportPlayerBtn");
const tmSaveAllMappingsBtn = $("tmSaveAllMappingsBtn");
const tmMappingSummary = $("tmMappingSummary");
const tmClubsList = $("tmClubsList");
const tmPreviewBox = $("tmPreviewBox");
const tmRawJson = $("tmRawJson");
const tmStatus = $("tmStatus");
const tmAuthStatus = $("tmAuthStatus");

const tmLoginBtn = $("tmLoginBtn");
const tmLogoutBtn = $("tmLogoutBtn");
const tmLoginOverlay = $("tmLoginOverlay");
const tmLoginForm = $("tmLoginForm");
const tmEmailInput = $("tmEmailInput");
const tmPasswordInput = $("tmPasswordInput");
const tmLoginCancelBtn = $("tmLoginCancelBtn");
const tmLoginSubmitBtn = $("tmLoginSubmitBtn");
const tmLoginMessage = $("tmLoginMessage");

const supabase = createClient(supabaseConfig.url, supabaseConfig.anonKey);

let currentUser = null;
let isAdmin = false;
let categories = [];
let clubCategories = [];
let mappings = [];
let detectedClubs = [];
let transferData = null;

const IGNORED_CLUB_NAMES = new Set([
  "without club",
  "retired",
  "unknown",
  "-",
  "career break"
]);

tmLoadTransfersBtn?.addEventListener("click", loadTransfers);
tmImportPlayerBtn?.addEventListener("click", importPlayer);
tmSaveAllMappingsBtn?.addEventListener("click", saveAllVisibleMappings);
tmLoginBtn?.addEventListener("click", showLoginModal);
tmLogoutBtn?.addEventListener("click", signOut);
tmLoginCancelBtn?.addEventListener("click", hideLoginModal);
tmLoginOverlay?.addEventListener("click", (event) => {
  if (event.target === tmLoginOverlay) hideLoginModal();
});
tmLoginForm?.addEventListener("submit", handleLoginSubmit);

init();

async function init() {
  setStatus("Chargement Supabase...");
  await refreshAuth();

  supabase.auth.onAuthStateChange(async (_event, session) => {
    currentUser = session?.user || null;
    isAdmin = currentUser ? await checkAdmin() : false;
    updateAuthUi();
  });

  await loadSupabaseRefs();
  setStatus("Prêt.");
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
  tmLoginBtn?.classList.toggle("hidden", isAdmin);
  tmLogoutBtn?.classList.toggle("hidden", !currentUser);

  if (isAdmin) {
    tmAuthStatus.textContent = "Admin connecté — import autorisé";
    tmAuthStatus.className = "admin-status good";
  } else if (currentUser) {
    tmAuthStatus.textContent = "Compte connecté mais non admin";
    tmAuthStatus.className = "admin-status bad";
  } else {
    tmAuthStatus.textContent = "Lecture seule — connecte-toi en admin.";
    tmAuthStatus.className = "admin-status";
  }

  renderMappingSummary();
  updateImportButton();
}

async function loadSupabaseRefs() {
  const [categoriesResult, mappingsResult] = await Promise.all([
    fetchAll("categories", "id,title,name,kicker,tags,visual_type,short_label,enabled"),
    fetchAll("transfermarkt_club_map", "tm_id,tm_name,category_id,enabled")
  ]);

  categories = categoriesResult;
  clubCategories = categories
    .filter((category) => category.enabled !== false && (category.visual_type === "club" || /joué à/i.test(category.kicker || "")))
    .sort((a, b) => String(a.title || a.name).localeCompare(String(b.title || b.name), "fr"));

  mappings = mappingsResult.filter((mapping) => mapping.enabled !== false);
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

    if (error) {
      if (table === "transfermarkt_club_map" && /does not exist/i.test(error.message)) {
        throw new Error("La table transfermarkt_club_map n'existe pas. Lance le SQL v71 dans Supabase.");
      }
      throw error;
    }

    rows = rows.concat(data || []);
    if (!data || data.length < pageSize) break;
    from += pageSize;
  }

  return rows;
}

function showLoginModal() {
  tmLoginMessage.textContent = "";
  tmLoginOverlay.classList.remove("hidden");
  document.body.classList.add("overlay-open");
  setTimeout(() => tmEmailInput?.focus(), 50);
}

function hideLoginModal() {
  tmLoginOverlay.classList.add("hidden");
  document.body.classList.remove("overlay-open");
}

async function handleLoginSubmit(event) {
  event.preventDefault();

  tmLoginMessage.textContent = "Connexion en cours...";
  tmLoginMessage.className = "admin-login-message";
  tmLoginSubmitBtn.disabled = true;
  tmLoginSubmitBtn.textContent = "Connexion...";

  try {
    const login = await withTimeout(
      supabase.auth.signInWithPassword({
        email: tmEmailInput.value.trim(),
        password: tmPasswordInput.value
      }),
      9000,
      "Connexion trop longue."
    );

    if (login.error) throw login.error;

    currentUser = login.data?.user || null;
    isAdmin = await checkAdmin();
    updateAuthUi();

    if (!isAdmin) {
      throw new Error("Connecté, mais ce compte n'est pas admin.");
    }

    hideLoginModal();
  } catch (error) {
    tmLoginMessage.textContent = error.message || "Connexion impossible.";
    tmLoginMessage.className = "admin-login-message bad";
  } finally {
    tmLoginSubmitBtn.disabled = false;
    tmLoginSubmitBtn.textContent = "Se connecter";
  }
}

async function signOut() {
  await supabase.auth.signOut();
  currentUser = null;
  isAdmin = false;
  updateAuthUi();
}

async function loadTransfers() {
  const id = tmPlayerIdInput.value.trim();
  if (!id) {
    alert("Entre un ID Transfermarkt.");
    return;
  }

  tmSupabasePlayerIdInput.value = tmSupabasePlayerIdInput.value.trim() || `tm_${id}`;
  setStatus("Chargement Transfermarkt...");
  tmLoadTransfersBtn.disabled = true;

  try {
    transferData = await fetchTransfermarktPlayerTransfers(id);
    autoFillPlayerNameFromTransfermarkt(transferData);
    detectedClubs = extractClubsFromTransfers(transferData?.transfers || []);
    tmRawJson.textContent = JSON.stringify(transferData, null, 2);

    if (!detectedClubs.length) {
      tmClubsList.innerHTML = `<div class="admin-empty-list">Aucun club exploitable détecté.</div>`;
    } else {
      renderClubs();
    }

    renderPreview();
    setStatus(`${detectedClubs.length} club(s) détecté(s).`);
  } catch (error) {
    console.error(error);
    setStatus(error.message || "Erreur Transfermarkt.", "bad");
  } finally {
    tmLoadTransfersBtn.disabled = false;
  }
}

async function fetchTransfermarktPlayerTransfers(id) {
  const baseUrl = tmApiBaseInput.value.trim().replace(/\/+$/, "") || "https://transfermarkt-api.fly.dev";
  const functionUrl = `${supabaseConfig.url.replace(/\/+$/, "")}/functions/v1/tm-transfers`;

  const session = await supabase.auth.getSession();
  const accessToken = session?.data?.session?.access_token || supabaseConfig.anonKey;

  const response = await withTimeout(
    fetch(functionUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": supabaseConfig.anonKey,
        "Authorization": `Bearer ${accessToken}`
      },
      body: JSON.stringify({
        id,
        baseUrl
      })
    }),
    22000,
    "Proxy Transfermarkt trop lent."
  );

  let data = null;
  const text = await response.text();

  try {
    data = text ? JSON.parse(text) : null;
  } catch (_error) {
    throw new Error(`Edge Function non-JSON (${response.status}) : ${text.slice(0, 180)}`);
  }

  if (!response.ok) {
    throw new Error(data?.details ? `${data.error || "Erreur Edge Function"} — ${data.details}` : (data?.error || `Erreur Edge Function ${response.status}`));
  }

  if (data?.error) {
    throw new Error(data.details ? `${data.error} — ${data.details}` : data.error);
  }

  if (!data?.transfers) {
    throw new Error("Réponse Transfermarkt inattendue : aucun champ transfers.");
  }

  return data;
}

function autoFillPlayerNameFromTransfermarkt(data) {
  if (tmPlayerNameInput.value.trim()) return;

  const profile = data?.profile || {};
  const candidates = [
    data?.name,
    data?.playerName,
    data?.fullName,
    profile?.name,
    profile?.playerName,
    profile?.fullName,
    profile?.data?.name,
    profile?.data?.playerName,
    profile?.data?.fullName
  ].filter(Boolean);

  if (candidates.length) {
    tmPlayerNameInput.value = String(candidates[0]);
  }
}

function isReserveOrYouthClubName(name) {
  const n = String(name || "");
  if (/\byouth\b/i.test(n)) return true;
  if (/\bU\d{2}\b/i.test(n)) return true;
  if (/\bB$/i.test(n)) return true;
  if (/\bII$/i.test(n)) return true;
  if (/\breserve\b/i.test(n)) return true;
  if (/\bunder \d{2}\b/i.test(n)) return true;
  return false;
}


function extractClubsFromTransfers(transfers) {
  const map = new Map();

  for (const transfer of transfers) {
    for (const side of ["clubFrom", "clubTo"]) {
      const club = transfer?.[side];
      if (!club?.id || !club?.name) continue;
      if (shouldIgnoreClub(club.name)) continue;

      if (!map.has(String(club.id))) {
        map.set(String(club.id), {
          tm_id: String(club.id),
          tm_name: club.name
        });
      }
    }
  }

  return [...map.values()].sort((a, b) => a.tm_name.localeCompare(b.tm_name, "fr"));
}

function shouldIgnoreClub(name) {
  const normalized = normalize(name);
  if (IGNORED_CLUB_NAMES.has(normalized)) return true;
  if (isReserveOrYouthClubName(name)) return true;
  return false;
}

function getMapping(tmId) {
  return mappings.find((mapping) => String(mapping.tm_id) === String(tmId));
}

function getCategory(categoryId) {
  return categories.find((category) => category.id === categoryId);
}

function renderClubs() {
  const rows = detectedClubs.map((club) => {
    const mapping = getMapping(club.tm_id);
    const guessedCategory = mapping ? null : guessCategoryForClub(club.tm_name);
    const selectedCategoryId = mapping?.category_id || guessedCategory?.id || "";
    const mappedCategory = getCategory(selectedCategoryId);

    return `
      <article class="diagnostic-row ${mapping ? "good" : guessedCategory ? "warning" : "danger"}">
        <div class="tm-club-info">
          <strong>${escapeHtml(club.tm_name)}</strong>
          <span>
            Transfermarkt ID ${escapeHtml(club.tm_id)} ·
            ${mapping ? `mappé vers ${escapeHtml(mappedCategory?.title || mapping.category_id)}` : guessedCategory ? `suggestion : ${escapeHtml(guessedCategory.title || guessedCategory.name)}` : "non mappé"}
          </span>
        </div>
        <div class="tm-map-controls">
          <select data-tm-select="${escapeHtml(club.tm_id)}">
            <option value="">— Ignorer —</option>
            ${clubCategories.map((category) => `
              <option value="${escapeHtml(category.id)}" ${selectedCategoryId === category.id ? "selected" : ""}>
                ${escapeHtml(category.title || category.name || category.id)} (${escapeHtml(category.id)})
              </option>
            `).join("")}
          </select>
          <button class="tiny-btn" type="button" data-save-map="${escapeHtml(club.tm_id)}" ${!isAdmin ? "disabled" : ""}>Sauver</button>
        </div>
      </article>
    `;
  });

  tmClubsList.innerHTML = rows.join("");

  tmClubsList.querySelectorAll("[data-save-map]").forEach((button) => {
    button.addEventListener("click", () => saveMapping(button.dataset.saveMap));
  });

  tmClubsList.querySelectorAll("[data-tm-select]").forEach((select) => {
    select.addEventListener("change", () => {
      renderMappingSummary();
      renderPreview();
      updateImportButton();
    });
  });

  renderMappingSummary();
  updateImportButton();
}


function guessCategoryForClub(clubName) {
  const target = normalize(clubName);
  if (!target) return null;

  const exact = clubCategories.find((category) => {
    return normalize(category.title) === target || normalize(category.name) === target || normalize(category.short_label) === target;
  });
  if (exact) return exact;

  return clubCategories.find((category) => {
    const title = normalize(category.title || category.name || "");
    if (!title) return false;
    return title.includes(target) || target.includes(title);
  }) || null;
}

function getSelectedMappingStats() {
  const mapped = getSelectedTagIds().length;
  const total = detectedClubs.length;
  const unmapped = Math.max(0, total - mapped);
  return { total, mapped, unmapped };
}

function renderMappingSummary() {
  if (!tmMappingSummary) return;

  const { total, mapped, unmapped } = getSelectedMappingStats();
  tmMappingSummary.textContent = `${mapped}/${total} clubs utilisables · ${unmapped} ignoré(s). Sauvegarde les suggestions importantes pour les prochains imports.`;

  if (tmSaveAllMappingsBtn) {
    tmSaveAllMappingsBtn.disabled = !isAdmin || mapped === 0;
  }
}

async function saveAllVisibleMappings() {
  if (!isAdmin) return alert("Connecte-toi en admin.");

  const buttons = [...tmClubsList.querySelectorAll("[data-save-map]")];
  let saved = 0;

  for (const button of buttons) {
    const tmId = button.dataset.saveMap;
    const select = tmClubsList.querySelector(`[data-tm-select="${CSS.escape(tmId)}"]`);
    if (!select?.value) continue;
    await saveMapping(tmId, { silent: true });
    saved++;
  }

  setStatus(`${saved} mapping(s) sauvegardé(s).`, "good");
  renderClubs();
  renderPreview();
}


async function saveMapping(tmId, options = {}) {
  if (!isAdmin) return alert("Connecte-toi en admin.");
  const club = detectedClubs.find((item) => item.tm_id === tmId);
  const select = tmClubsList.querySelector(`[data-tm-select="${CSS.escape(tmId)}"]`);
  const categoryId = select?.value || "";

  if (!categoryId) {
    const { error } = await supabase
      .from("transfermarkt_club_map")
      .delete()
      .eq("tm_id", tmId);

    if (error) {
      if (!options.silent) setStatus("Suppression mapping impossible : " + error.message, "bad");
      return;
    }

    mappings = mappings.filter((mapping) => String(mapping.tm_id) !== String(tmId));
    renderClubs();
    renderPreview();
    return;
  }

  const { error } = await supabase
    .from("transfermarkt_club_map")
    .upsert({
      tm_id: tmId,
      tm_name: club?.tm_name || tmId,
      category_id: categoryId,
      enabled: true,
      updated_at: new Date().toISOString()
    }, { onConflict: "tm_id" });

  if (error) {
    if (!options.silent) setStatus("Mapping impossible : " + error.message, "bad");
    return;
  }

  const existing = mappings.find((mapping) => String(mapping.tm_id) === String(tmId));
  if (existing) {
    existing.category_id = categoryId;
    existing.tm_name = club?.tm_name || existing.tm_name;
  } else {
    mappings.push({ tm_id: tmId, tm_name: club?.tm_name || tmId, category_id: categoryId, enabled: true });
  }

  if (!options.silent) setStatus("Mapping sauvegardé.");
  renderClubs();
  renderPreview();
}

function getSelectedTagIds() {
  if (!detectedClubs.length) return [];

  const tags = [];

  for (const club of detectedClubs) {
    const select = tmClubsList.querySelector(`[data-tm-select="${CSS.escape(club.tm_id)}"]`);
    const selected = select?.value || getMapping(club.tm_id)?.category_id || "";
    if (selected) tags.push(selected);
  }

  return [...new Set(tags)];
}

function renderPreview() {
  const name = tmPlayerNameInput.value.trim() || "(nom à renseigner)";
  const playerId = tmSupabasePlayerIdInput.value.trim() || (tmPlayerIdInput.value.trim() ? `tm_${tmPlayerIdInput.value.trim()}` : "");
  const tags = getSelectedTagIds();

  tmPreviewBox.innerHTML = `
    <div class="tm-preview-card">
      <strong>${escapeHtml(name)}</strong>
      <span>ID Supabase : ${escapeHtml(playerId || "—")}</span>
      <span>ID Transfermarkt : ${escapeHtml(tmPlayerIdInput.value.trim() || "—")}</span>
      <span>Tags clubs : ${tags.length}</span>
      <span>Profil TM : ${transferData?.profile ? "détecté" : "non disponible"}</span>
      <div class="tm-tags">
        ${tags.length ? tags.map((tag) => `<code>${escapeHtml(tag)}</code>`).join("") : "<em>Aucun tag mappé pour l'instant.</em>"}
      </div>
    </div>
  `;

  updateImportButton();
}

function updateImportButton() {
  const canImport = Boolean(isAdmin && tmPlayerIdInput.value.trim() && tmPlayerNameInput.value.trim() && getSelectedTagIds().length);
  if (tmImportPlayerBtn) tmImportPlayerBtn.disabled = !canImport;
}

tmPlayerNameInput?.addEventListener("input", renderPreview);
tmSupabasePlayerIdInput?.addEventListener("input", renderPreview);
tmPlayerIdInput?.addEventListener("input", () => {
  if (!tmSupabasePlayerIdInput.value.trim() && tmPlayerIdInput.value.trim()) {
    tmSupabasePlayerIdInput.value = `tm_${tmPlayerIdInput.value.trim()}`;
  }
  renderPreview();
});

async function importPlayer() {
  if (!isAdmin) return alert("Connecte-toi en admin.");

  const tmId = tmPlayerIdInput.value.trim();
  const name = tmPlayerNameInput.value.trim();
  const supabasePlayerId = tmSupabasePlayerIdInput.value.trim() || `tm_${tmId}`;
  const tags = getSelectedTagIds();

  if (!tmId || !name || !tags.length) {
    alert("Il manque l'ID, le nom ou des tags mappés.");
    return;
  }

  const { data: existing, error: readError } = await supabase
    .from("players")
    .select("id,tags,logos")
    .eq("id", supabasePlayerId)
    .maybeSingle();

  if (readError) {
    setStatus("Lecture joueur impossible : " + readError.message, "bad");
    return;
  }

  const mergedTags = [...new Set([...(existing?.tags || []), ...tags])];

  const { error } = await supabase
    .from("players")
    .upsert({
      id: supabasePlayerId,
      name,
      base_name: name,
      tags: mergedTags,
      logos: existing?.logos || [],
      enabled: true,
      updated_at: new Date().toISOString()
    }, { onConflict: "id" });

  if (error) {
    setStatus("Import joueur impossible : " + error.message, "bad");
    return;
  }

  setStatus(`${name} importé / mis à jour avec ${mergedTags.length} tag(s).`, "good");
}

function setStatus(message, type = "") {
  tmStatus.textContent = message;
  tmStatus.className = "admin-status";
  if (type) tmStatus.classList.add(type);
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
