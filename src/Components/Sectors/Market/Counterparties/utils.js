// Утилиты форматирования для компонента Counterparties

/**
 * Форматирует телефонный номер
 * @param {string} phone - Телефон для форматирования
 * @returns {string} Отформатированный телефон или "—"
 */
export const formatPhone = (phone) => {
  if (!phone) return "—";
  return phone;
};

/**
 * Преобразует значение в число
 * @param {string|number|null|undefined} value
 * @returns {number}
 */
export const toNumber = (value) => Number(value) || 0;

/**
 * Форматирует число в ru-RU с 2 знаками после запятой
 * @param {string|number|null|undefined} value
 * @returns {string}
 */
export const formatMoneyRu = (value) =>
  toNumber(value).toLocaleString("ru-RU", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

/**
 * Возвращает "debit/credit" по знаку баланса
 * @param {string|number|null|undefined} value
 * @returns {{ debit: number, credit: number }}
 */
export const splitBySign = (value) => {
  const amount = toNumber(value);
  if (amount >= 0) return { debit: amount, credit: 0 };
  return { debit: 0, credit: Math.abs(amount) };
};

/** Округление до копеек, чтобы 0.1 + 0.2 − 0.3 не превращалось в «−0,00» */
const roundMoney = (v) => Math.round(v * 100) / 100 || 0;

const pickFirstDefined = (...values) => {
  const found = values.find((v) => v !== null && v !== undefined && v !== "");
  return found ?? null;
};

/**
 * Строка оборотно-сальдовой ведомости по контрагенту (как в 1С).
 *
 * Сальдо — это остаток, поэтому у контрагента оно стоит только с одной стороны:
 *   нетто > 0 → Дебет (контрагент должен нам), нетто < 0 → Кредит (мы должны ему / аванс).
 * Бэк сейчас может отдавать в opening_debit/opening_credit валовые суммы
 * (все отгрузки и все оплаты до начала периода) — разница от этого не меняется,
 * поэтому сальдо считаем как разность, а не берём поля как есть.
 *
 *   Сальдо на начало = opening_debit − opening_credit
 *   Оборот Дт        = turnover_debit  (отгрузки за период)
 *   Оборот Кт        = turnover_credit (оплаты и возвраты за период)
 *   Сальдо на конец  = сальдо на начало + Оборот Дт − Оборот Кт
 *
 * @param {Object} counterparty
 * @returns {{
 *   openingDebit: number,
 *   openingCredit: number,
 *   turnoverDebit: number,
 *   turnoverCredit: number,
 *   closingDebit: number,
 *   closingCredit: number
 * }}
 */
export const getCounterpartyAnalyticsView = (counterparty) => {
  const debts = counterparty?.analytics?.debts || {};

  const openingNet =
    toNumber(
      pickFirstDefined(
        debts?.opening_debit,
        debts?.start_debit,
        debts?.period_start_debit
      )
    ) -
    toNumber(
      pickFirstDefined(
        debts?.opening_credit,
        debts?.start_credit,
        debts?.period_start_credit
      )
    );

  // Оборот — строго за период (debts.turnover_*). Без date_from/date_to бэк эти поля
  // не отдаёт: тогда оборот пустой, а не пожизненные движения по кассе.
  const turnoverDebit = toNumber(
    pickFirstDefined(debts?.turnover_debit, debts?.period_debit)
  );
  const turnoverCredit = toNumber(
    pickFirstDefined(debts?.turnover_credit, debts?.period_credit)
  );

  const closingNet = openingNet + turnoverDebit - turnoverCredit;
  const opening = splitBySign(roundMoney(openingNet));
  const closing = splitBySign(roundMoney(closingNet));

  return {
    openingDebit: opening.debit,
    openingCredit: opening.credit,
    turnoverDebit,
    turnoverCredit,
    closingDebit: closing.debit,
    closingCredit: closing.credit,
  };
};

/**
 * Итоги ведомости: сумма каждой колонки по строкам (развёрнутое сальдо, как в 1С —
 * дебетовые и кредитовые остатки разных контрагентов между собой не сворачиваются).
 * @param {Array} counterparties
 */
export const getCounterpartiesLedgerTotals = (counterparties) =>
  (Array.isArray(counterparties) ? counterparties : []).reduce(
    (acc, counterparty) => {
      const m = getCounterpartyAnalyticsView(counterparty);
      acc.openingDebit += m.openingDebit;
      acc.openingCredit += m.openingCredit;
      acc.turnoverDebit += m.turnoverDebit;
      acc.turnoverCredit += m.turnoverCredit;
      acc.closingDebit += m.closingDebit;
      acc.closingCredit += m.closingCredit;
      return acc;
    },
    {
      openingDebit: 0,
      openingCredit: 0,
      turnoverDebit: 0,
      turnoverCredit: 0,
      closingDebit: 0,
      closingCredit: 0,
    }
  );

/**
 * Форматирует сообщение для модального окна удаления
 * @param {number} count - Количество выбранных контрагентов
 * @returns {string} Отформатированное сообщение
 */
export const formatDeleteMessage = (count) => {
  const word = count === 1 ? "контрагента" : count < 5 ? "контрагентов" : "контрагентов";
  return `Вы уверены, что хотите удалить выбранных ${count} ${word}? Это действие нельзя отменить.`;
};

/**
 * Получает полное имя контрагента
 * @param {Object} counterparty - Объект контрагента
 * @returns {string} Полное имя или название
 */
export const getCounterpartyName = (counterparty) => {
  return counterparty?.name ||
         counterparty?.full_name ||
         counterparty?.title ||
         "Без названия";
};

/**
 * Отображаемое значение привязки контрагента к агенту (API: agent — uuid | null, read-only)
 * @param {string|Object|null} agent - UUID агента или объект с id/name
 * @returns {string}
 */
export const formatAgentDisplay = (agent) => {
  if (!agent) return "—";
  if (typeof agent === "object") {
    const name = agent.name || agent.full_name || agent.email;
    if (name) return name;
    if (agent.id) return String(agent.id).slice(0, 8) + "…";
  }
  const s = String(agent);
  return s.length > 8 ? `${s.slice(0, 8)}…` : s;
};

/**
 * Отображаемое имя агента по контрагенту: приоритет agent_display, иначе форматируем agent (uuid)
 * @param {Object} counterparty - Объект контрагента (agent, agent_display)
 * @returns {string}
 */
export const getAgentDisplay = (counterparty) => {
  if (!counterparty) return "—";
  const display = counterparty?.agent_display?.trim?.();
  if (display) return display;
  return formatAgentDisplay(counterparty?.agent);
};

/**
 * Группирует контрагентов по агенту (agent id или null для "Без агента")
 * @param {Array} counterparties - Список контрагентов
 * @param {Function} getAgentDisplayFn - Функция получения отображаемого имени агента
 * @returns {Array<{ agentKey: string|null, agentDisplay: string, counterparties: Array }>}
 */
export const groupCounterpartiesByAgent = (counterparties, getAgentDisplayFn = getAgentDisplay) => {
  if (!Array.isArray(counterparties) || counterparties.length === 0) {
    return [];
  }
  const map = new Map();
  for (const cp of counterparties) {
    const agentId = cp?.agent ?? null;
    const key = agentId ?? "__no_agent__";
    if (!map.has(key)) {
      map.set(key, {
        agentKey: agentId,
        agentDisplay: agentId ? getAgentDisplayFn(cp) : "Без агента",
        counterparties: [],
      });
    }
    map.get(key).counterparties.push(cp);
  }
  const result = Array.from(map.values());
  result.sort((a, b) => a.agentDisplay.localeCompare(b.agentDisplay, "ru"));
  return result;
};

const getCounterpartyResults = (payload) =>
  payload?.results ?? (Array.isArray(payload) ? payload : []);

/**
 * Объединяет несколько ответов listCounterparties без дублей по id.
 */
export const mergeCounterpartyLists = (...payloads) => {
  const ids = new Set();
  const merged = [];
  for (const payload of payloads) {
    if (!payload) continue;
    for (const c of getCounterpartyResults(payload)) {
      if (!c?.id || ids.has(c.id)) continue;
      ids.add(c.id);
      merged.push(c);
    }
  }
  return {
    count: merged.length,
    next: null,
    previous: null,
    results: merged,
  };
};

/**
 * Подмешивает analytics за период (из урезанного ответа API) в полный список контрагентов.
 * Бэкенд с period_start/period_end возвращает только контрагентов с движениями за период.
 */
export const mergeCounterpartyPeriodAnalytics = (fullPayload, periodPayload) => {
  const fullResults = getCounterpartyResults(fullPayload);
  const periodResults = getCounterpartyResults(periodPayload);
  if (!periodResults.length) return fullPayload;

  const periodById = new Map(periodResults.map((c) => [c.id, c]));
  const mergedResults = fullResults.map((c) => {
    const withPeriod = periodById.get(c.id);
    if (!withPeriod?.analytics) return c;
    return { ...c, analytics: withPeriod.analytics };
  });

  if (fullPayload?.results) {
    return { ...fullPayload, results: mergedResults };
  }
  return mergedResults;
};

