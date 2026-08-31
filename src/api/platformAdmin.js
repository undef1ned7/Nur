import api from "./index";

const BASE = "/platform-admin";

/** Извлекает понятное сообщение об ошибке из ответа API. */
export function pickPlatformAdminError(error, fallback = "Ошибка запроса") {
  const data = error?.response?.data;
  if (!data) return fallback;
  if (typeof data === "string") return data;
  if (typeof data?.detail === "string") return data.detail;
  if (typeof data === "object") {
    try {
      const key = Object.keys(data)[0];
      const val = Array.isArray(data[key]) ? data[key][0] : data[key];
      return String(val || fallback);
    } catch {
      return fallback;
    }
  }
  return fallback;
}

/** true, если эндпоинт ещё не реализован на бэке. */
export function isPlatformAdminUnavailable(error) {
  const status = error?.response?.status;
  return status === 404 || status === 501 || status === 502;
}

export async function fetchPlatformAdminMeta() {
  const { data } = await api.get(`${BASE}/meta/`);
  return data;
}

export async function fetchPlatformCompanies(params = {}) {
  const { data } = await api.get(`${BASE}/companies/`, { params });
  return data;
}

export async function fetchPlatformCompany(id) {
  const { data } = await api.get(`${BASE}/companies/${id}/`);
  return data;
}

export async function patchPlatformCompany(id, payload) {
  const { data } = await api.patch(`${BASE}/companies/${id}/`, payload);
  return data;
}

export async function patchPlatformCompanySubscription(id, payload) {
  const { data } = await api.patch(
    `${BASE}/companies/${id}/subscription/`,
    payload,
  );
  return data;
}

export async function fetchPlatformCompanyUsers(companyId, params = {}) {
  const { data } = await api.get(`${BASE}/companies/${companyId}/users/`, {
    params,
  });
  return data;
}

export async function createPlatformCompanyUser(companyId, payload) {
  const { data } = await api.post(
    `${BASE}/companies/${companyId}/users/`,
    payload,
  );
  return data;
}

export async function fetchPlatformUser(userId) {
  const { data } = await api.get(`${BASE}/users/${userId}/`);
  return data;
}

export async function patchPlatformUser(userId, payload) {
  const { data } = await api.patch(`${BASE}/users/${userId}/`, payload);
  return data;
}

export async function deletePlatformUser(userId) {
  await api.delete(`${BASE}/users/${userId}/`);
}

export async function resetPlatformUserPassword(userId) {
  const { data } = await api.post(`${BASE}/users/${userId}/reset-password/`);
  return data;
}

export async function impersonatePlatformUser(userId) {
  const { data } = await api.post(`${BASE}/users/${userId}/impersonate/`);
  return data;
}
