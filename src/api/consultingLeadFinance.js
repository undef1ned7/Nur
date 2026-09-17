/**
 * Консалтинг → Лиды → кнопка «Финансы»: рекламный отчёт по лидам.
 *
 * Строка отчёта = один день закупки рекламы: показы, полученные лиды,
 * сумма затрат. «Стоимость лида» бэкенд считает сам (spend / leads), но фронт
 * дублирует расчёт для мгновенного отображения при вводе.
 *
 * Контракт бэкенда: docs/consulting/backend/08-lead-ad-spend.md
 * Права: utils/consultingFunnelAccess.js → canManageConsultingLeadFinance
 *
 * Пока эндпоинт отвечает 404/501 — модалка показывает понятную заглушку
 * и не ломается (как остальной сектор, см. consultingHttp.js).
 */
import { BASE, cDelete, cGet, cPost, cPut } from "./consultingHttp";

const URL = `${BASE}/lead-ad-spend/`;

/** Нормализовать сырую строку с API к виду, удобному таблице. */
export const normalizeAdSpendRow = (raw = {}) => {
  const impressions = Number(raw.impressions) || 0;
  const leads = Number(raw.leads) || 0;
  const spend = Number(raw.spend) || 0;
  const cost_per_lead =
    raw.cost_per_lead != null && raw.cost_per_lead !== ""
      ? Number(raw.cost_per_lead)
      : leads > 0
        ? Math.round((spend / leads) * 100) / 100
        : 0;
  return {
    id: raw.id ?? null,
    date: raw.date || "",
    impressions,
    leads,
    spend,
    cost_per_lead,
    note: raw.note || "",
  };
};

/**
 * Список строк рекламного отчёта.
 * GET /consalting/lead-ad-spend/?date_from=&date_to=&ordering=-date&page=&page_size=
 * @returns {{ results: Array, count: number }}
 */
export const listLeadAdSpend = async (params = {}, config) => {
  const data = await cGet(
    "List Lead Ad Spend Error",
    URL,
    { ordering: "-date", page_size: 366, ...params },
    config,
  );
  const rows = Array.isArray(data?.results)
    ? data.results
    : Array.isArray(data)
      ? data
      : [];
  return {
    results: rows.map(normalizeAdSpendRow),
    count: Number(data?.count) || rows.length,
  };
};

/** Создать строку. POST /consalting/lead-ad-spend/ */
export const createLeadAdSpend = (payload) =>
  cPost("Create Lead Ad Spend Error", URL, payload);

/** Изменить строку. PATCH /consalting/lead-ad-spend/{id}/ */
export const updateLeadAdSpend = (id, payload) =>
  cPut("Update Lead Ad Spend Error", `${URL}${id}/`, payload);

/** Удалить строку. DELETE /consalting/lead-ad-spend/{id}/ */
export const deleteLeadAdSpend = (id) =>
  cDelete("Delete Lead Ad Spend Error", `${URL}${id}/`);

/**
 * Пакетное сохранение таблицы за период.
 * PUT /consalting/lead-ad-spend/bulk/
 *   ← { items: [{ id?, date, impressions, leads, spend, note? }], date_from?, date_to? }
 * Бэкенд делает upsert по (company, date) СТРОГО внутри [date_from, date_to]:
 * строки с id обновляет, без id — создаёт, отсутствующие в payload, но
 * попадающие в диапазон — удаляет. Строки вне диапазона не трогает — иначе
 * при открытой модалке с фильтром по месяцу сохранение стирало бы данные
 * всех остальных месяцев (полная замена без диапазона — как было раньше).
 * Без date_from/date_to — обратная совместимость, старое поведение (полная
 * замена всей таблицы компании); фронт всегда передаёт диапазон текущего
 * фильтра, см. docs/consulting/backend/08-lead-ad-spend.md §8.4.1.
 * @param {Array} items
 * @param {{ date_from?: string, date_to?: string }} [range]
 * @returns {{ results: Array }}
 */
export const bulkSaveLeadAdSpend = async (items, range = {}) => {
  const body = { items };
  if (range.date_from) body.date_from = range.date_from;
  if (range.date_to) body.date_to = range.date_to;
  const data = await cPut("Bulk Save Lead Ad Spend Error", `${URL}bulk/`, body);
  const rows = Array.isArray(data?.results)
    ? data.results
    : Array.isArray(data)
      ? data
      : [];
  return { results: rows.map(normalizeAdSpendRow) };
};
