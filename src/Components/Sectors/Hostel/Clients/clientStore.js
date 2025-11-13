import api from "../../../../api";

/**
 * Клиенты — ТОЛЬКО через эндпоинт /booking/clients/.
 * На бэке поля: id (uuid), name, phone, text (заметки)
 */

const normalizeClient = (c) => ({
  id: c.id,
  full_name: c.name ?? "", // приводим к единому виду для фронта
  phone: c.phone ?? "",
  notes: c.text ?? "",
  created_at: c.created_at || null,
  updated_at: c.updated_at || null,
});

/* DRF: вытянуть все страницы */
async function fetchAllClients() {
  let url = "/booking/clients/";
  const acc = [];
  let guard = 0;

  while (url && guard < 50) {
    const { data } = await api.get(url);
    const arr = Array.isArray(data?.results)
      ? data.results
      : Array.isArray(data)
      ? data
      : [];
    acc.push(...arr);
    url = data?.next || null;
    guard += 1;
  }
  return acc.map(normalizeClient);
}

/* public */
export async function getAll() {
  return await fetchAllClients();
}

/**
 * Принимаем как {full_name, phone, notes} так и {name, phone, text}
 * и мапим в серверный формат {name, phone, text}
 */
export async function createClient(dto) {
  const payload = {
    name: (dto.full_name ?? dto.name ?? "").trim(),
    phone: (dto.phone ?? "").trim(),
    text: (dto.notes ?? dto.text ?? "").trim(),
  };
  const { data } = await api.post("/booking/clients/", payload);
  return normalizeClient(data);
}

export async function updateClient(id, patch) {
  const payload = {
    name: (patch.full_name ?? patch.name ?? "").trim(),
    phone: (patch.phone ?? "").trim(),
    text: (patch.notes ?? patch.text ?? "").trim(),
  };
  // можно PATCH, но оставим PUT — зависит от бэка
  const { data } = await api.put(`/booking/clients/${id}/`, payload);
  return normalizeClient(data);
}

export async function removeClient(id) {
  await api.delete(`/booking/clients/${id}/`);
  return true;
}
