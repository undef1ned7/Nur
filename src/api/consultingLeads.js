/**
 * Консалтинг: входящие лиды (Wazzup WhatsApp/Instagram/Telegram),
 * работа с очередью (отложить / вернуть / купил / отказ), счётчики по статусам,
 * аналитика по лидам и настройки авто-распределения.
 *
 * Контракт: docs/consulting/backend/01-leads.md,
 * docs/consulting/leads-whatsapp.md, docs/consulting/wazzup-integration.md.
 * Аккаунты Wazzup / send-message — src/api/consultingWazzup.js.
 *
 * Пока эндпоинт отвечает 404/501, UI показывает понятную заглушку.
 */
import { BASE, cGet, cPatch, cPost, cPut } from "./consultingHttp";

const URL_LEADS = `${BASE}/inbound-leads/`;

/* ==================== СПРАВОЧНИКИ ==================== */

/** Статусы лида. `deferred` — новый (ТЗ №1, «отложенные»). */
export const LEAD_STATUS = {
  NEW: "new",
  ASSIGNED: "assigned",
  IN_WORK: "in_work",
  DEFERRED: "deferred",
  CONVERTED: "converted",
  REJECTED: "rejected",
};

export const LEAD_STATUS_LABELS = {
  [LEAD_STATUS.NEW]: "Новый",
  [LEAD_STATUS.ASSIGNED]: "Назначен",
  [LEAD_STATUS.IN_WORK]: "В работе",
  [LEAD_STATUS.DEFERRED]: "Отложен",
  [LEAD_STATUS.CONVERTED]: "Купил",
  [LEAD_STATUS.REJECTED]: "Отказ",
};

/**
 * Табы очереди. «Новые» объединяют `new` и `assigned`: назначенный, но ещё не
 * взятый в работу лид для менеджера — та же самая задача «разобрать».
 */
export const LEAD_TABS = [
  { value: "all", label: "Все", statuses: [] },
  {
    value: "new",
    label: "Новые",
    statuses: [LEAD_STATUS.NEW, LEAD_STATUS.ASSIGNED],
  },
  { value: "in_work", label: "В работе", statuses: [LEAD_STATUS.IN_WORK] },
  { value: "deferred", label: "Отложенные", statuses: [LEAD_STATUS.DEFERRED] },
  { value: "converted", label: "Купили", statuses: [LEAD_STATUS.CONVERTED] },
  { value: "rejected", label: "Отказ", statuses: [LEAD_STATUS.REJECTED] },
];

export const leadTabByValue = (value) =>
  LEAD_TABS.find((t) => t.value === value) || LEAD_TABS[0];

/** Причины откладывания — список фиксированный, «other» требует комментария. */
export const DEFER_REASONS = [
  { value: "no_answer_call", label: "Не взял трубку" },
  { value: "no_answer_chat", label: "Не ответил в переписке" },
  { value: "call_later", label: "Просил перезвонить позже" },
  { value: "thinking", label: "Думает / советуется" },
  { value: "no_money", label: "Нет денег сейчас" },
  { value: "other", label: "Другое" },
];

/** Причины отказа — питают блок «причины потерь» в аналитике. */
export const REJECT_REASONS = [
  { value: "expensive", label: "Дорого" },
  { value: "competitor", label: "Ушёл к конкуренту" },
  { value: "no_need", label: "Не актуально" },
  { value: "no_contact", label: "Не выходит на связь" },
  { value: "spam", label: "Спам / нецелевой" },
  { value: "other", label: "Другое" },
];

/** Быстрые пресеты «напомнить через…» для окна откладывания. */
export const DEFER_PRESETS = [
  { value: "2h", label: "Через 2 часа", ms: 2 * 60 * 60 * 1000 },
  { value: "tomorrow", label: "Завтра", ms: 24 * 60 * 60 * 1000 },
  { value: "3d", label: "Через 3 дня", ms: 3 * 24 * 60 * 60 * 1000 },
  { value: "week", label: "Через неделю", ms: 7 * 24 * 60 * 60 * 1000 },
  { value: "month", label: "Через месяц", ms: 30 * 24 * 60 * 60 * 1000 },
];

/* ==================== ВХОДЯЩИЕ ЛИДЫ ==================== */

/**
 * Список входящих лидов.
 * GET /consalting/inbound-leads/
 * @param {Object} params - status (можно список через запятую), owner, source,
 *   search, date_from, date_to, overdue, page, page_size, ordering
 * @param {Object} config - { signal }
 * @returns {{results: Array, count: number}}
 */
export const listInboundLeads = (params = {}, config) =>
  cGet("List Inbound Leads Error", URL_LEADS, params, config);

/**
 * Счётчики по табам очереди с учётом текущих фильтров.
 * GET /consalting/inbound-leads/counters/
 * @returns {{ all, new, in_work, deferred, converted, rejected, overdue }}
 */
export const getLeadCounters = (params = {}, config) =>
  cGet("Lead Counters Error", `${URL_LEADS}counters/`, params, config);

/**
 * Аналитика по лидам за период.
 * GET /consalting/inbound-leads/analytics/
 * @param {Object} params - date_from, date_to, owner, source
 * @returns {{ totals, by_source, by_user, by_day, defer_reasons, reject_reasons }}
 */
export const getLeadsAnalytics = (params = {}, config) =>
  cGet("Leads Analytics Error", `${URL_LEADS}analytics/`, params, config);

/** Ручное создание лида (когда обращение пришло не из мессенджера). */
export const createInboundLead = (payload) =>
  cPost("Create Inbound Lead Error", URL_LEADS, payload);

/** Обновить произвольные поля лида. */
export const updateInboundLead = (id, payload) =>
  cPatch("Update Inbound Lead Error", `${URL_LEADS}${id}/`, payload);

/** Назначить лид сотруднику. */
export const assignInboundLead = (id, payload) =>
  cPost("Assign Inbound Lead Error", `${URL_LEADS}${id}/assign/`, payload);

/**
 * Отложить лид «на потом».
 * POST /consalting/inbound-leads/{id}/defer/
 * @param {Object} payload - { remind_at: ISO, reason, comment? }
 */
export const deferInboundLead = (id, payload) =>
  cPost("Defer Inbound Lead Error", `${URL_LEADS}${id}/defer/`, payload);

/** Вернуть отложенный лид в работу. */
export const resumeInboundLead = (id, payload = {}) =>
  cPost("Resume Inbound Lead Error", `${URL_LEADS}${id}/resume/`, payload);

/** Пометить лид покупкой (сделка оформляется на воронке/в продажах). */
export const markInboundLeadWon = (id, payload = {}) =>
  cPost("Mark Lead Won Error", `${URL_LEADS}${id}/won/`, payload);

/**
 * Отказ по лиду.
 * @param {Object} payload - { reason, comment? } — причина обязательна,
 *   иначе блок «причины отказов» в аналитике останется пустым.
 */
export const markInboundLeadLost = (id, payload) =>
  cPost("Mark Lead Lost Error", `${URL_LEADS}${id}/lost/`, payload);

/* ==================== НАСТРОЙКИ РАСПРЕДЕЛЕНИЯ ==================== */

/** GET /consalting/lead-distribution/ → { enabled, strategy, role_ids, recipients } */
export const getLeadDistribution = (config) =>
  cGet("Get Lead Distribution Error", `${BASE}/lead-distribution/`, {}, config);

/** PUT /consalting/lead-distribution/ ← { enabled, strategy, role_ids } */
export const updateLeadDistribution = (payload) =>
  cPut("Update Lead Distribution Error", `${BASE}/lead-distribution/`, payload);

/* ==================== ВСПОМОГАТЕЛЬНОЕ ==================== */

/** Просрочен ли отложенный лид (срок напоминания уже прошёл). */
export const isLeadOverdue = (lead) => {
  if (!lead || lead.status !== LEAD_STATUS.DEFERRED) return false;
  const at = lead.remind_at || lead.deferred_until;
  if (!at) return false;
  const ts = new Date(at).getTime();
  return Number.isFinite(ts) && ts <= Date.now();
};

/** Человекочитаемая причина откладывания/отказа по коду. */
export const reasonLabel = (list, value) =>
  list.find((r) => r.value === value)?.label || value || "—";
