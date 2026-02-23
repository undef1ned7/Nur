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

