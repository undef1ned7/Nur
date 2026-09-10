/**
 * Консалтинг: списки справочников с серверной пагинацией и поиском —
 * услуги, запросы клиентов, клиенты.
 *
 * Зачем отдельно от redux-thunks (`consultingThunk.js`): thunks тянут ВЕСЬ
 * список целиком и держат его в сторе — это нормально для выпадающих списков в
 * формах, но не годится для таблиц, где нужны `page`/`search`/фильтры на
 * сервере. Экраны-списки ходят сюда, формы продолжают брать справочники из
 * стора.
 */
import { cGet, cPost, cPatch, BASE } from "./consultingHttp";

const notReady = (e) => e?.status === 404 || e?.status === 501;

/**
 * Услуги компании.
 * GET /consalting/services/
 * @param {Object} params - search, custom_role, page, page_size, ordering
 */
export const listConsultingServices = (params = {}, config) =>
  cGet("List Consulting Services Error", `${BASE}/services/`, params, config);

/**
 * Запросы клиентов.
 * GET /consalting/requests/
 * @param {Object} params - search, status, client, date_from, date_to,
 *   page, page_size, ordering
 */
export const listConsultingRequests = (params = {}, config) =>
  cGet("List Consulting Requests Error", `${BASE}/requests/`, params, config);

/**
 * Назначенный сотрудник принимает заявку.
 * POST /consalting/requests/{id}/accept/  → фолбэк PATCH.
 * Контракт: docs/consulting/backend-money-tenant/16-request-assigned-to.md
 */
export const acceptConsultingRequest = async (id) => {
  try {
    return await cPost(
      "Accept Consulting Request Error",
      `${BASE}/requests/${id}/accept/`,
      {},
    );
  } catch (e) {
    if (!notReady(e)) throw e;
    return cPatch("Accept Consulting Request Error", `${BASE}/requests/${id}/`, {
      acceptance: "accepted",
      status: "in_work",
    });
  }
};

/**
 * Назначенный сотрудник отказывается от заявки (причина обязательна).
 * POST /consalting/requests/{id}/decline/ { reason }  → фолбэк PATCH.
 */
export const declineConsultingRequest = async (id, reason) => {
  const body = { reason: String(reason || "").trim() };
  try {
    return await cPost(
      "Decline Consulting Request Error",
      `${BASE}/requests/${id}/decline/`,
      body,
    );
  } catch (e) {
    if (!notReady(e)) throw e;
    return cPatch(
      "Decline Consulting Request Error",
      `${BASE}/requests/${id}/`,
      { assigned_to: null, acceptance: "declined", status: "new", decline_reason: body.reason },
    );
  }
};

/**
 * Клиенты компании (общий домен `/main/clients/`, не `/consalting/`).
 * GET /main/clients/
 * @param {Object} params - search, page, page_size, ordering
 */
export const listConsultingClients = (params = {}, config) =>
  cGet("List Consulting Clients Error", "/main/clients/", params, config);
