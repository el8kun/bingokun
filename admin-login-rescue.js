import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";
import { supabaseConfig } from "./supabase-config.js";

const $ = (id) => document.getElementById(id);

const supabase = createClient(supabaseConfig.url, supabaseConfig.anonKey);

const overlay = $("adminLoginOverlay");
const form = $("adminLoginForm");
const emailInput = $("adminEmailInput");
const passwordInput = $("adminPasswordInput");
const message = $("adminLoginMessage");
const submitBtn = $("adminLoginSubmitBtn");
const loginBtn = $("adminLoginBtn");
const logoutBtn = $("adminLogoutBtn");
const authStatus = $("adminAuthStatus");
const creatorNotice = $("creatorLockedNotice");
const adminHeaderLink = $("adminHeaderLink");

let busy = false;

function setMessage(text, type = "") {
  if (!message) return;
  message.textContent = text;
  message.className = "admin-login-message";
  if (type) message.classList.add(type);
}

function showOverlay(event) {
  event?.preventDefault?.();
  event?.stopPropagation?.();

  if (!overlay) return;
  overlay.classList.remove("hidden");
  document.body.classList.add("overlay-open");

  setTimeout(() => emailInput?.focus(), 50);
}

function hideOverlay() {
  overlay?.classList.add("hidden");
  document.body.classList.remove("overlay-open");
}

function withTimeout(promise, ms = 12000, label = "Action trop longue") {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(label)), ms))
  ]);
}

async function isAdmin(uid) {
  if (!uid) return false;

  try {
    const rpc = await withTimeout(supabase.rpc("is_admin"), 5000, "Vérification admin trop longue");
    if (!rpc.error && rpc.data === true) return true;
  } catch (_error) {
    // Fallback table admins juste dessous.
  }

  const { data, error } = await withTimeout(
    supabase.from("admins").select("uid").eq("uid", uid).maybeSingle(),
    5000,
    "Lecture table admins trop longue"
  );

  if (error) throw error;
  return Boolean(data?.uid);
}

function applyAdminUi(user, adminOk) {
  loginBtn?.classList.toggle("hidden", adminOk);
  logoutBtn?.classList.toggle("hidden", !user);
  adminHeaderLink?.classList.toggle("hidden", !adminOk);
  creatorNotice?.classList.toggle("hidden", adminOk);

  if (authStatus) {
    if (adminOk) {
      authStatus.textContent = "Admin Supabase connecté";
      authStatus.className = "admin-auth-status good";
    } else if (user) {
      authStatus.textContent = "Compte connecté mais non admin";
      authStatus.className = "admin-auth-status bad";
    } else {
      authStatus.textContent = "Mode joueur";
      authStatus.className = "admin-auth-status";
    }
  }
}

async function submitLogin(event) {
  event?.preventDefault?.();
  event?.stopPropagation?.();

  if (busy) return;

  const email = String(emailInput?.value || "").trim();
  const password = String(passwordInput?.value || "");

  if (!email || !password) {
    setMessage("Renseigne l'email et le mot de passe.", "bad");
    return;
  }

  busy = true;

  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = "Connexion...";
  }

  setMessage("Connexion Supabase en cours...");

  try {
    const login = await withTimeout(
      supabase.auth.signInWithPassword({ email, password }),
      12000,
      "Connexion trop longue. Recharge la page puis réessaie."
    );

    if (login.error) throw login.error;

    const sessionResult = await supabase.auth.getSession();
    const user = sessionResult.data?.session?.user || login.data?.user;

    if (!user) throw new Error("Connexion réussie, mais utilisateur introuvable.");

    setMessage("Connexion OK, vérification admin...");

    const adminOk = await isAdmin(user.id);
    applyAdminUi(user, adminOk);

    if (!adminOk) {
      throw new Error(`Connecté, mais pas admin. UID à ajouter dans admins : ${user.id}`);
    }

    setMessage("Admin connecté. Rechargement...", "good");
    if (passwordInput) passwordInput.value = "";

    // Recharge volontaire : app.js relit la session Supabase et récupère isAdminUser correctement.
    setTimeout(() => window.location.reload(), 650);
  } catch (error) {
    console.error("Admin rescue login failed:", error);
    setMessage(error?.message || "Connexion impossible.", "bad");
  } finally {
    busy = false;

    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = "Se connecter";
    }
  }
}

loginBtn?.addEventListener("click", showOverlay, true);
form?.addEventListener("submit", submitLogin, true);
submitBtn?.addEventListener("click", submitLogin, true);

document.addEventListener("submit", (event) => {
  if (event.target?.id === "adminLoginForm") submitLogin(event);
}, true);

document.addEventListener("click", (event) => {
  if (event.target?.closest?.("#adminLoginSubmitBtn")) submitLogin(event);
  if (event.target?.closest?.("#adminLoginBtn")) showOverlay(event);
}, true);

logoutBtn?.addEventListener("click", async (event) => {
  event?.preventDefault?.();
  await supabase.auth.signOut();
  window.location.reload();
}, true);

try {
  const { data } = await supabase.auth.getSession();
  const user = data?.session?.user || null;

  if (user) {
    const adminOk = await isAdmin(user.id);
    applyAdminUi(user, adminOk);
  }
} catch (error) {
  console.warn("Admin rescue session check failed:", error);
}

window.bingoKunAdminRescue = {
  showOverlay,
  submitLogin
};
