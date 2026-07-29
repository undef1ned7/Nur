/**
 * Консалтинг: карточка сотрудника — показатели работы, КПД, рейтинг команды
 * (ТЗ №6) и личные финансы: продажи, принятые и сданные деньги (ТЗ №7).
 *
 * Контракт: docs/consulting/backend/06-employee-card.md,
 * docs/consulting/backend/07-employee-finance.md.
 */
import { BASE, cGet } from "./consultingHttp";

const URL = `${BASE}/employees`;

/**
 * Сводные показатели сотрудника за период.
 * GET /consalting/employees/{id}/stats/
 * @param {Object} params - date_from, date_to
 * @returns {{
 *   leads: { received, claimed, in_work, deferred, overdue, processed, no_reply_in_time },
 *   sales: { deals, revenue, avg_check, conversion, plan, plan_done_percent, canceled, cancel_rate },
 *   speed: { first_reply_avg_minutes, deal_cycle_avg_days, by_stage: [{stage, avg_hours}] },
 *   kpi: { score, conversion_score, plan_score, speed_score, discipline_score, rank, of },
 *   salary: { accrued, paid, remaining },
 *   top_services: [{ service, service_name, deals, revenue }]
 * }}
 */
export const getEmployeeStats = (id, params = {}, config) =>
  cGet("Employee Stats Error", `${URL}/${id}/stats/`, params, config);

/**
 * Рейтинг команды за период — та же метрика, что в карточке, по всем.
 * GET /consalting/employees/rating/
 * @param {Object} params - date_from, date_to, ordering, search, page, page_size
 */
export const getEmployeesRating = (params = {}, config) =>
  cGet("Employees Rating Error", `${URL}/rating/`, params, config);

/**
 * Финансовая сводка сотрудника (деньги на руках).
 * GET /consalting/employees/{id}/finance/
 * @returns {{
 *   sold, cash_received, transfer_received, handed_over, on_hands,
 *   pending_handover, overdue_amount, debts: { total, overdue }
 * }}
 */
export const getEmployeeFinance = (id, params = {}, config) =>
  cGet("Employee Finance Error", `${URL}/${id}/finance/`, params, config);

/**
 * Продажи сотрудника с расшифровкой (оплата, статус, начислено ему).
 * GET /consalting/employees/{id}/sales/
 * @param {Object} params - date_from, date_to, status, search, page, page_size
 */
export const listEmployeeSales = (id, params = {}, config) =>
  cGet("Employee Sales Error", `${URL}/${id}/sales/`, params, config);

/**
 * История сдачи наличных сотрудником.
 * GET /consalting/employees/{id}/handovers/
 * @param {Object} params - status, date_from, date_to, page, page_size
 */
export const listEmployeeHandovers = (id, params = {}, config) =>
  cGet("Employee Handovers Error", `${URL}/${id}/handovers/`, params, config);

/**
 * Долги клиентов, оформленные этим сотрудником.
 * GET /consalting/employees/{id}/debts/
 * @param {Object} params - overdue, search, page, page_size
 */
export const listEmployeeDebts = (id, params = {}, config) =>
  cGet("Employee Debts Error", `${URL}/${id}/debts/`, params, config);

/**
 * Последняя активность (лиды, сделки, переписки) — лента карточки.
 * GET /consalting/employees/{id}/activity/
 */
export const listEmployeeActivity = (id, params = {}, config) =>
  cGet("Employee Activity Error", `${URL}/${id}/activity/`, params, config);

/* ==================== ВСПОМОГАТЕЛЬНОЕ ==================== */

/** Веса КПД по умолчанию — сервер может прислать свои в /stats/. */
export const KPI_WEIGHTS = {
  conversion: 0.35,
  plan: 0.3,
  speed: 0.2,
  discipline: 0.15,
};

/**
 * Резервный расчёт КПД на фронте, если сервер прислал только сырые показатели.
 * Каждая составляющая нормируется в 0..100, затем взвешивается.
 */
export const calcKpiScore = (stats, weights = KPI_WEIGHTS) => {
  if (!stats) return null;
  const clamp = (v) => Math.max(0, Math.min(100, Number(v) || 0));

  const conversion = clamp(stats?.sales?.conversion);
  const plan = clamp(stats?.sales?.plan_done_percent);

  // Скорость: 5 минут и быстрее — 100, 120 минут и дольше — 0.
  const reply = Number(stats?.speed?.first_reply_avg_minutes);
  const speed = Number.isFinite(reply)
    ? clamp(((120 - Math.min(reply, 120)) / 115) * 100)
    : 0;

  // Дисциплина: доля просроченных отложенных лидов.
  const deferred = Number(stats?.leads?.deferred) || 0;
  const overdue = Number(stats?.leads?.overdue) || 0;
  const discipline = deferred > 0 ? clamp((1 - overdue / deferred) * 100) : 100;

  const score =
    conversion * weights.conversion +
    plan * weights.plan +
    speed * weights.speed +
    discipline * weights.discipline;

  return {
    score: Math.round(score),
    conversion_score: Math.round(conversion),
    plan_score: Math.round(plan),
    speed_score: Math.round(speed),
    discipline_score: Math.round(discipline),
  };
};
