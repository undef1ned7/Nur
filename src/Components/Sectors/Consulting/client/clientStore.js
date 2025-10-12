// src/components/Clients/clientStore.js
/**
 * Локальный стор клиентов (без бэка)
 * Данные храним в localStorage под ключом CRM_CLIENTS_KEY.
 * Структура записи:
 * { id, full_name, phone, date, seller, service, price, created_at, updated_at }
 */

const CRM_CLIENTS_KEY = "crm_clients_simple_v1";

const lsGet = (k, fallback) => {
  try {
    const raw = localStorage.getItem(k);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
};
const lsSet = (k, v) => {
  try {
    localStorage.setItem(k, JSON.stringify(v));
  } catch {}
};
const genId = () => `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

const normalize = (c = {}) => ({
  id: c.id ?? genId(),
  full_name: c.full_name ?? "",
  phone: c.phone ?? "",
  date: c.date ?? "", // YYYY-MM-DD
  seller: c.seller ?? "",
  service: c.service ?? "",
  price: Number(c.price ?? 0) || 0,
  created_at: c.created_at || new Date().toISOString(),
  updated_at: c.updated_at || c.created_at || new Date().toISOString(),
});

export async function getAll() {
  const arr = lsGet(CRM_CLIENTS_KEY, []);
  return Array.isArray(arr) ? arr.map(normalize) : [];
}

export async function createClient(dto) {
  const cur = (await getAll()) || [];
  const rec = normalize({
    id: genId(),
    full_name: (dto.full_name || "").trim(),
    phone: (dto.phone || "").trim(),
    date: (dto.date || "").trim(),
    seller: (dto.seller || "").trim(),
    service: (dto.service || "").trim(),
    price: Number(dto.price || 0) || 0,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });
  const next = [rec, ...cur];
  lsSet(CRM_CLIENTS_KEY, next);
  return rec;
}

export async function updateClient(id, patch) {
  const cur = (await getAll()) || [];
  const next = cur.map((c) => {
    if (String(c.id) !== String(id)) return c;
    return normalize({
      ...c,
      ...patch,
      full_name: (patch.full_name ?? c.full_name).trim(),
      phone: (patch.phone ?? c.phone).trim(),
      date: (patch.date ?? c.date).trim(),
      seller: (patch.seller ?? c.seller).trim(),
      service: (patch.service ?? c.service).trim(),
      price: patch.price != null ? Number(patch.price) || 0 : c.price,
      updated_at: new Date().toISOString(),
    });
  });
  lsSet(CRM_CLIENTS_KEY, next);
  return next.find((x) => String(x.id) === String(id));
}

export async function removeClient(id) {
  const cur = (await getAll()) || [];
  const next = cur.filter((c) => String(c.id) !== String(id));
  lsSet(CRM_CLIENTS_KEY, next);
  return true;
}
