// API-клиент настроек кассы сферы «Магазин».
// Контракт описан в docs/market/cashier-settings.md.
// Настройки задаёт владелец/админ компании, кассир получает их только на чтение.
import api from "./index";
import {
  hasMigratedDebtScheduleToV2,
  markMigratedDebtScheduleToV2,
  parseDebtScheduleVersion,
  shouldUpgradeDebtScheduleToV2,
} from "../tools/debtScheduleVersion";

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
    debtScheduleVersion: parseDebtScheduleVersion(
      data?.debt_schedule_version ?? data?.deferred_schedule_version,
    ),
  };
};

/** Значения по умолчанию: код не нужен, ограничения скидки нет, отсрочка v2. */
export const DEFAULT_MARKET_CASHIER_SETTINGS = {
  deleteCodeRequired: false,
  deleteCode: "",
  maxDiscountPercent: null,
  debtScheduleVersion: "v2",
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

export function rawDebtScheduleVersion(data) {
  return data?.debt_schedule_version ?? data?.deferred_schedule_version;
}

const overlayDebtScheduleV2 = (data) => ({
  ...(data || {}),
  debt_schedule_version: "v2",
});

const ensureInflight = new Map();

/**
 * Первый заход маркета: бэкенд default — v1 / нет поля.
 * Если явно v2 — не трогаем. Иначе один раз PATCH на v2 (owner/admin).
 * После успешного апдейта больше не форсим v2 — пользователь может вернуть v1.
 */
export async function ensureMarketDebtScheduleV2(
  data,
  companyId,
  { canWrite = true } = {},
) {
  const key = String(companyId || "_");
  if (ensureInflight.has(key)) {
    return ensureInflight.get(key);
  }

  const run = (async () => {
    const raw = rawDebtScheduleVersion(data);
    if (!shouldUpgradeDebtScheduleToV2(raw)) {
      markMigratedDebtScheduleToV2(companyId);
      return data;
    }
    if (hasMigratedDebtScheduleToV2(companyId)) {
      return data;
    }
    if (!canWrite) {
      return overlayDebtScheduleV2(data);
    }
    try {
      const updated = await updateMarketCashierSettings({
        debt_schedule_version: "v2",
      });
      markMigratedDebtScheduleToV2(companyId);
      return updated ?? overlayDebtScheduleV2(data);
    } catch {
      return overlayDebtScheduleV2(data);
    }
  })();

  ensureInflight.set(key, run);
  try {
    return await run;
  } finally {
    ensureInflight.delete(key);
  }
}
