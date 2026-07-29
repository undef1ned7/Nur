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
import { cGet, BASE } from "./consultingHttp";

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
 * Клиенты компании (общий домен `/main/clients/`, не `/consalting/`).
 * GET /main/clients/
 * @param {Object} params - search, page, page_size, ordering
 */
export const listConsultingClients = (params = {}, config) =>
  cGet("List Consulting Clients Error", "/main/clients/", params, config);
