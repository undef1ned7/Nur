/**
 * Fiscal Connector — обёртка над REST API локального драйвера кассы.
 * Все запросы идут напрямую с фронта на localhost:8080 (или другой baseUrl из настроек).
 * Backend Nur используется отдельно для хранения результатов (ФД/ФМ).
 */

const FISCAL_TOKEN_KEY = "cafe_fiscal_access_token";

/* ─── Токен ─────────────────────────────────────────────────────────────── */

export function getFiscalToken() {
  return sessionStorage.getItem(FISCAL_TOKEN_KEY) || null;
}

export function setFiscalToken(token) {
  if (token) sessionStorage.setItem(FISCAL_TOKEN_KEY, token);
  else sessionStorage.removeItem(FISCAL_TOKEN_KEY);
}

export function clearFiscalToken() {
  sessionStorage.removeItem(FISCAL_TOKEN_KEY);
}

/* ─── Коды ошибок коннектора ─────────────────────────────────────────────── */

const FISCAL_ERROR_MESSAGES = {
  40416: "SAM-карта не выбрана в Fiscal Connector",
  40417: "SAM-карта не верифицирована — введите PIN (повторите verify-pin)",
  4008: "Неверный PIN от SAM-карты",
  4005: "Неверный логин или пароль",
  4011: "Требуется повторная авторизация",
  40918: "Смена не открыта — откройте смену",
  40920: "Смена открыта более 24 ч — закройте смену",
  40917: "Недостаточно наличных",
  40919: "Изымите наличные перед закрытием смены",
  4038: "Касса заблокирована из-за оплаты. Обратитесь в поддержку",
  4039: "Касса временно заблокирована. Обратитесь в поддержку",
  40310: "Касса или пользователь неактивны — невозможно открыть смену",
  5002: "Сервис FPO недоступен",
  5040: "Превышено время ожидания ответа от FPO",
};

function makeFiscalError(code, serverMessage) {
  const userMessage =
    code != null && FISCAL_ERROR_MESSAGES[code]
      ? FISCAL_ERROR_MESSAGES[code]
      : serverMessage || `Ошибка коннектора (код: ${code})`;
  const err = new Error(userMessage);
  err.fiscalCode = code;
  err.fiscalServerMessage = serverMessage;
  err.isFiscalError = true;
  return err;
}

/* ─── Базовый fetch ──────────────────────────────────────────────────────── */

function getBaseUrl(settings) {
  return String(settings?.connector_base_url || "http://localhost:8080").replace(/\/$/, "");
}

function buildHeaders(token, extra = {}) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = token;
  return { ...headers, ...extra };
}

async function fiscalFetch(url, options = {}) {
  let res;
  try {
    res = await fetch(url, { ...options, signal: AbortSignal.timeout(15000) });
  } catch (networkErr) {
    const msg =
      networkErr.name === "TimeoutError"
        ? `Fiscal Connector не отвечает — превышено время ожидания`
        : `Fiscal Connector недоступен. Убедитесь, что FiscalConnectorSetup.exe запущен`;
    throw new Error(msg);
  }

  const contentType = res.headers.get("content-type") || "";

  if (contentType.includes("application/pdf")) {
    if (!res.ok) throw new Error(`Fiscal Connector: HTTP ${res.status}`);
    return { type: "pdf", blob: await res.blob() };
  }

  let json = null;
  try {
    json = await res.json();
  } catch {
    // не JSON
  }

  if (!res.ok) {
    const code = json?.code ?? json?.errorCode ?? null;
    const msg = json?.message ?? json?.detail ?? String(res.status);
    throw makeFiscalError(code, msg);
  }

  return { type: "json", data: json };
}

/* ─── API методы ─────────────────────────────────────────────────────────── */

/**
 * Верификация SAM-карты через PIN. Вызывается один раз за сессию.
 * @returns {{ registrationNumber, fiscalModuleNumber, fmExpirationDate }}
 */
export async function verifyPin(settings) {
  const result = await fiscalFetch(`${getBaseUrl(settings)}/driver/verify-pin`, {
    method: "POST",
    headers: buildHeaders(null),
    body: JSON.stringify({
      registrationNumber: settings.registration_number,
      pin: settings.pin,
    }),
  });
  return result.data;
}

/**
 * Авторизация (нужен интернет). Токен живёт 5 минут.
 * Автоматически сохраняет accessToken в sessionStorage.
 * @returns {{ accessToken, fullName, cashierName, tin, fiscalMemoryNumber, ... }}
 */
export async function authConnector(settings) {
  const result = await fiscalFetch(`${getBaseUrl(settings)}/driver/auth`, {
    method: "POST",
    headers: buildHeaders(null),
    body: JSON.stringify({
      login: settings.login,
      password: settings.password,
    }),
  });
  const data = result.data;
  if (data?.accessToken) setFiscalToken(data.accessToken);
  return data;
}

/**
 * Получить состояние смены.
 * @returns {{ shiftOpened: boolean, openShiftDateTime, fmExpirationDate }}
 */
export async function getShiftState(settings) {
  const token = getFiscalToken();
  const result = await fiscalFetch(`${getBaseUrl(settings)}/driver/state-shift`, {
    method: "GET",
    headers: buildHeaders(token),
  });
  return result.data;
}

/**
 * Открыть смену (нужен интернет, accessToken должен быть свежим).
 * Возвращает JSON с данными смены.
 */
export async function openShiftConnector(settings) {
  const token = getFiscalToken();
  const width = settings?.receipt_width ?? 384;
  const result = await fiscalFetch(`${getBaseUrl(settings)}/driver/open-shift`, {
    method: "POST",
    headers: buildHeaders(token, {
      "Response-Type": "JSON",
      "WIDTH-RECEIPT": String(width),
    }),
  });
  return result.type === "pdf" ? {} : (result.data ?? {});
}

/**
 * Закрыть смену.
 */
export async function closeShiftConnector(settings) {
  const token = getFiscalToken();
  const width = settings?.receipt_width ?? 384;
  const result = await fiscalFetch(`${getBaseUrl(settings)}/driver/close-shift`, {
    method: "POST",
    headers: buildHeaders(token, {
      "Response-Type": "JSON",
      "WIDTH-RECEIPT": String(width),
    }),
  });
  return result.type === "pdf" ? {} : (result.data ?? {});
}

/**
 * Пробить чек.
 * @param {object} body - тело чека (positions, operationType, суммы)
 * @returns {{ fdNumber, fnSerialNumber, ... }}
 */
export async function sendReceipt(settings, body) {
  const token = getFiscalToken();
  const width = settings?.receipt_width ?? 384;
  const result = await fiscalFetch(
    `${getBaseUrl(settings)}/driver/cash-register/receipt`,
    {
      method: "POST",
      headers: buildHeaders(token, {
        "Response-Type": "JSON",
        "WIDTH-RECEIPT": String(width),
      }),
      body: JSON.stringify(body),
    },
  );
  return result.type === "pdf" ? {} : (result.data ?? {});
}

/**
 * Получить сумму наличных в кассе.
 * @returns {{ totalAmount, withdrawTotal, withdrawCount, depositTotal, depositCount }}
 */
export async function getCashTransaction(settings) {
  const token = getFiscalToken();
  const result = await fiscalFetch(
    `${getBaseUrl(settings)}/driver/cash-transaction`,
    {
      method: "GET",
      headers: buildHeaders(token),
    },
  );
  return result.data;
}

/**
 * Внесение наличных.
 * @returns {{ fdNumber, fnSerialNumber, ... }}
 */
export async function depositCash(settings, amount) {
  const token = getFiscalToken();
  const width = settings?.receipt_width ?? 384;
  const result = await fiscalFetch(
    `${getBaseUrl(settings)}/driver/cash-transaction/deposit`,
    {
      method: "POST",
      headers: buildHeaders(token, {
        "Response-Type": "JSON",
        "WIDTH-RECEIPT": String(width),
      }),
      body: JSON.stringify({ amount }),
    },
  );
  return result.type === "pdf" ? {} : (result.data ?? {});
}

/**
 * Изъятие наличных.
 * @returns {{ fdNumber, fnSerialNumber, ... }}
 */
export async function withdrawCash(settings, amount) {
  const token = getFiscalToken();
  const width = settings?.receipt_width ?? 384;
  const result = await fiscalFetch(
    `${getBaseUrl(settings)}/driver/cash-transaction/withdraw`,
    {
      method: "POST",
      headers: buildHeaders(token, {
        "Response-Type": "JSON",
        "WIDTH-RECEIPT": String(width),
      }),
      body: JSON.stringify({ amount }),
    },
  );
  return result.type === "pdf" ? {} : (result.data ?? {});
}

/**
 * X-отчёт.
 */
export async function getXReport(settings) {
  const token = getFiscalToken();
  const width = settings?.receipt_width ?? 384;
  const result = await fiscalFetch(`${getBaseUrl(settings)}/driver/x-report`, {
    method: "GET",
    headers: buildHeaders(token, {
      "Response-Type": "JSON",
      "WIDTH-RECEIPT": String(width),
    }),
  });
  return result.type === "pdf" ? {} : (result.data ?? {});
}

/**
 * Получить доступные налоговые ставки (для маппинга блюд).
 */
export async function getAvailableTaxRates(settings) {
  const token = getFiscalToken();
  const result = await fiscalFetch(
    `${getBaseUrl(settings)}/driver/cash-register/available-tax-rates`,
    {
      method: "GET",
      headers: buildHeaders(token),
    },
  );
  return result.data;
}
