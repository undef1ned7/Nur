import {
  verifyRegisterAccess,
  changeRegisterAccessPassword,
} from "../api/registerAccess";

const STORAGE_HASH_KEY = "nur_register_access_hash";
const SESSION_UNLOCK_KEY = "nur_register_access_unlocked";

const USE_BACKEND = import.meta.env.VITE_REGISTER_ACCESS_BACKEND === "true";

const DEFAULT_PASSWORD =
  import.meta.env.VITE_REGISTER_ACCESS_PASSWORD || "nurcrm2026";

async function hashPassword(password) {
  const data = new TextEncoder().encode(password);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function readStoredHash() {
  try {
    return localStorage.getItem(STORAGE_HASH_KEY);
  } catch {
    return null;
  }
}

function writeStoredHash(hash) {
  try {
    localStorage.setItem(STORAGE_HASH_KEY, hash);
  } catch {
    // ignore quota / private mode errors
  }
}

async function ensureLocalPasswordInitialized() {
  if (readStoredHash()) return;

  const hash = await hashPassword(DEFAULT_PASSWORD);
  writeStoredHash(hash);
}

async function verifyLocalPassword(password) {
  await ensureLocalPasswordInitialized();
  const inputHash = await hashPassword(password);
  return inputHash === readStoredHash();
}

async function changeLocalPassword(currentPassword, newPassword) {
  const isValid = await verifyLocalPassword(currentPassword);
  if (!isValid) {
    return { ok: false, error: "Неверный текущий пароль" };
  }

  const newHash = await hashPassword(newPassword);
  writeStoredHash(newHash);
  return { ok: true };
}

export function isSessionUnlocked() {
  try {
    return sessionStorage.getItem(SESSION_UNLOCK_KEY) === "1";
  } catch {
    return false;
  }
}

export function setSessionUnlocked(unlocked) {
  try {
    if (unlocked) {
      sessionStorage.setItem(SESSION_UNLOCK_KEY, "1");
    } else {
      sessionStorage.removeItem(SESSION_UNLOCK_KEY);
    }
  } catch {
    // ignore
  }
}

export function isBackendMode() {
  return USE_BACKEND;
}

export async function verifyAccessPassword(password) {
  if (USE_BACKEND) {
    try {
      await verifyRegisterAccess(password);
      return { ok: true };
    } catch (error) {
      const detail =
        error?.detail ||
        error?.message ||
        (typeof error === "string" ? error : "Неверный пароль");
      return { ok: false, error: String(detail) };
    }
  }

  const isValid = await verifyLocalPassword(password);
  return isValid ? { ok: true } : { ok: false, error: "Неверный пароль" };
}

export async function unlockRegistration(password) {
  const result = await verifyAccessPassword(password);
  if (result.ok) {
    setSessionUnlocked(true);
  }
  return result;
}

export async function changeAccessPassword(currentPassword, newPassword) {
  if (USE_BACKEND) {
    try {
      await changeRegisterAccessPassword(currentPassword, newPassword);
      return { ok: true };
    } catch (error) {
      const detail =
        error?.current_password?.[0] ||
        error?.new_password?.[0] ||
        error?.detail ||
        error?.message ||
        "Не удалось сменить пароль";
      return { ok: false, error: String(detail) };
    }
  }

  return changeLocalPassword(currentPassword, newPassword);
}

export function lockRegistration() {
  setSessionUnlocked(false);
}
