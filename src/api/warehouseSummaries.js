// API-клиент раздела «Сводка» (warehouse sales summaries).
// Контракт описан в docs/warehouse-summary-api.md.
// Бэкенд возвращает только JSON; PDF строится на фронте.
import api from "./index";
import { listDocuments } from "./warehouse";

const BASE = "warehouse/summaries/";

/** Нормализует фильтры в query-параметры axios (агенты — повторяемый параметр). */
const buildListParams = (filters = {}) => {
  const {
    date,
    date_from,
    date_to,
    agent,
    author,
    type,
    search,
    ordering,
    page,
    page_size,
  } = filters;

  const params = {};
  if (date) params.date = date;
  if (date_from) params.date_from = date_from;
  if (date_to) params.date_to = date_to;
  if (author) params.author = author;
  if (type) params.type = type;
  if (search) params.search = search;
  if (ordering) params.ordering = ordering;
  if (page) params.page = page;
  if (page_size) params.page_size = page_size;
  // agent может быть массивом — отправляем повторяемым параметром
  if (Array.isArray(agent) && agent.length) params.agent = agent;
  else if (agent) params.agent = agent;
  return params;
};

/** GET /warehouse/summaries/ — список с фильтрами/сортировкой/пагинацией. */
export const listSummaries = async (filters = {}) => {
  const { data } = await api.get(BASE, {
    params: buildListParams(filters),
    // повторяемый параметр agent=a&agent=b
    paramsSerializer: { indexes: null },
  });
  return data;
};

/** GET /warehouse/summaries/calendar/?month=YYYY-MM — количество сводок по дням. */
export const getSummaryCalendar = async (month) => {
  const { data } = await api.get(`${BASE}calendar/`, { params: { month } });
  return data;
};

/** GET /warehouse/summaries/{id}/ — полная сводка (documents/products/totals). */
export const getSummary = async (id) => {
  const { data } = await api.get(`${BASE}${id}/`);
  return data;
};

/** POST /warehouse/summaries/ — создание. */
export const createSummary = async (payload) => {
  const { data } = await api.post(BASE, payload);
  return data;
};

/** PATCH /warehouse/summaries/{id}/ — изменить name/comment/type/agents. */
export const updateSummary = async (id, payload) => {
  const { data } = await api.patch(`${BASE}${id}/`, payload);
  return data;
};

/** DELETE /warehouse/summaries/{id}/. */
export const deleteSummary = async (id) => {
  await api.delete(`${BASE}${id}/`);
  return true;
};

/** POST /warehouse/summaries/{id}/regenerate/ — пересобрать снапшот. */
export const regenerateSummary = async (id) => {
  const { data } = await api.post(`${BASE}${id}/regenerate/`);
  return data;
};

/**
 * Fallback-источник для клиентской агрегации: накладные продаж за дату
 * (опционально по агентам). Используется, если сводка отдаёт «сырые» накладные
 * или для предпросмотра до создания.
 */
export const listSaleDocumentsForDate = async (date, agents = []) => {
  const params = {
    doc_type: "SALE",
    page_size: 500,
    ...(date && { date }),
  };
  if (Array.isArray(agents) && agents.length === 1) params.agent = agents[0];
  const data = await listDocuments(params);
  const list = Array.isArray(data?.results)
    ? data.results
    : Array.isArray(data)
      ? data
      : [];
  // если выбрано несколько агентов — фильтруем на клиенте
  if (Array.isArray(agents) && agents.length > 1) {
    const set = new Set(agents.map(String));
    return list.filter((d) => set.has(String(d.agent || "")));
  }
  return list;
};

export default {
  listSummaries,
  getSummaryCalendar,
  getSummary,
  createSummary,
  updateSummary,
  deleteSummary,
  regenerateSummary,
  listSaleDocumentsForDate,
};
