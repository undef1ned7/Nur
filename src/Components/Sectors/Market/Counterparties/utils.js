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

