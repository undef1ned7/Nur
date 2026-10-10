/**
 * Подписи системных значений и форматы склада (QA 06.10.2026: B40, B41).
 * Сырые коды API (CASH_PENDING, SUPPLIER, BOTH…) в интерфейс не выводим.
 */

const pad2 = (n) => String(n).padStart(2, "0");
const DATE_ONLY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Статусы складских и денежных документов */
export const DOCUMENT_STATUS_LABELS = {
  DRAFT: "Черновик",
  SALE_REQUEST: "Заявка на продажу",
  CASH_PENDING: "Ожидает кассы",
  POSTED: "Проведён",
  REJECTED: "Отклонён",
  CANCELLED: "Отменён",
  CANCELED: "Отменён",
};

export const documentStatusLabel = (status) => {
  if (status == null || status === "") return "—";
  return DOCUMENT_STATUS_LABELS[String(status).toUpperCase()] || String(status);
};

/** Типы документов */
export const DOCUMENT_TYPE_LABELS = {
  SALE: "Продажа",
  PURCHASE: "Закуп",
  SALE_RETURN: "Возврат продажи",
  PURCHASE_RETURN: "Возврат покупки",
  INVENTORY: "Инвентаризация",
  RECEIPT: "Оприходование",
  WRITE_OFF: "Списание",
  TRANSFER: "Перемещение",
  COMMERCIAL_OFFER: "Коммерческое предложение",
  MONEY_RECEIPT: "Приход",
  MONEY_EXPENSE: "Расход",
};

export const documentTypeLabel = (docType) => {
  if (docType == null || docType === "") return "—";
  return DOCUMENT_TYPE_LABELS[String(docType).toUpperCase()] || String(docType);
};

/** Типы контрагентов */
export const COUNTERPARTY_TYPE_LABELS = {
  CLIENT: "Клиент",
  SUPPLIER: "Поставщик",
  BOTH: "Клиент и поставщик",
};

export const counterpartyTypeLabel = (type) => {
  if (type == null || type === "") return "—";
  return COUNTERPARTY_TYPE_LABELS[String(type).toUpperCase()] || String(type);
};

/**
 * Сумма в сомах: «1 050 сом», «1 050,50 сом». Единая валюта — «сом»
 * (раньше в разных местах было «с» и «COM»).
 * @param {number} [fractionDigits] — фиксированное число знаков (по умолчанию 0–2)
 */
export const formatSom = (value, fractionDigits) => {
  const n = Number(value) || 0;
  const opts =
    fractionDigits == null
      ? { minimumFractionDigits: 0, maximumFractionDigits: 2 }
      : {
          minimumFractionDigits: fractionDigits,
          maximumFractionDigits: fractionDigits,
        };
  return `${n.toLocaleString("ru-RU", opts)} сом`;
};

/**
 * Дата и время: «18.09.2026 17:10» (раньше было «18.09.2026:17:10:23»).
 * Для значения без времени («YYYY-MM-DD») — только дата, без выдуманного 06:00.
 */
export const formatDateTime = (value) => {
  if (value == null || value === "") return "—";
  if (DATE_ONLY_RE.test(String(value))) return formatDate(value);
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return `${pad2(d.getDate())}.${pad2(d.getMonth() + 1)}.${d.getFullYear()} ${pad2(
    d.getHours(),
  )}:${pad2(d.getMinutes())}`;
};

/** Только дата: «18.09.2026». Строку «YYYY-MM-DD» не сдвигаем по UTC. */
export const formatDate = (value) => {
  if (value == null || value === "") return "—";
  const m = DATE_ONLY_RE.exec(String(value));
  if (m) return `${m[3]}.${m[2]}.${m[1]}`;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return `${pad2(d.getDate())}.${pad2(d.getMonth() + 1)}.${d.getFullYear()}`;
};
