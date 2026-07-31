// API-клиент настроек кассы сферы «Магазин».
// Контракт описан в docs/market/cashier-settings.md.
// Настройки задаёт владелец/админ компании, кассир получает их только на чтение.
import api from "./index";

export const MARKET_CASHIER_SETTINGS_URL = "/main/pos/cashier-settings/";
export const MARKET_CASHIER_VERIFY_DELETE_CODE_URL = `${MARKET_CASHIER_SETTINGS_URL}verify-delete-code/`;

/** Приводит процент из ответа к числу; null — лимита нет. */
const parsePercent = (raw) => {
  if (raw === null || raw === undefined || raw === "") return null;
  const num = parseFloat(String(raw).replace(",", "."));
  if (!Number.isFinite(num) || num < 0) return null;
  return Math.min(100, num);
};

/**
 * Нормализует ответ бэка в форму, удобную фронту.
 * `deleteCode` приходит только владельцу/админу — кассиру бэк отдаёт лишь флаг.
 */
export const normalizeMarketCashierSettings = (data) => {
  const code = String(data?.delete_item_code ?? "").trim();
  const required =
    data?.delete_item_code_required ?? data?.delete_item_code_set ?? Boolean(code);

  return {
    deleteCodeRequired: Boolean(required),
    deleteCode: code || "",
    maxDiscountPercent: parsePercent(data?.max_discount_percent),
  };
};

/** Значения по умолчанию: код не нужен, ограничения скидки нет. */
export const DEFAULT_MARKET_CASHIER_SETTINGS = {
  deleteCodeRequired: false,
  deleteCode: "",
  maxDiscountPercent: null,
};

/** GET — текущие настройки кассы компании. */
export const fetchMarketCashierSettings = async () => {
  const { data } = await api.get(MARKET_CASHIER_SETTINGS_URL);
  return data;
};

/**
 * PATCH — сохранение настроек (только владелец/админ).
 * `delete_item_code: ""` (или null) отключает запрос кода при удалении,
 * `max_discount_percent: null` снимает ограничение скидки.
 */
export const updateMarketCashierSettings = async (payload) => {
  const { data } = await api.patch(MARKET_CASHIER_SETTINGS_URL, payload);
  return data;
};

/** POST — проверка кода удаления на сервере. Возвращает true/false. */
export const verifyMarketCashierDeleteCode = async (code) => {
  const { data } = await api.post(MARKET_CASHIER_VERIFY_DELETE_CODE_URL, {
    code: String(code ?? "").trim(),
  });
  return Boolean(data?.valid ?? data?.is_valid ?? false);
};
