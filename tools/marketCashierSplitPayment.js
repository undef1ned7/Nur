const PENDING_KEY_PREFIX = "market_cashier_pending_split_v1_";

export const savePendingSplitPayment = (saleId, payload) => {
  if (!saleId || !payload) return;
  try {
    sessionStorage.setItem(
      `${PENDING_KEY_PREFIX}${saleId}`,
      JSON.stringify({ ...payload, savedAt: Date.now() }),
    );
  } catch {
    // ignore
  }
};

export const loadPendingSplitPayment = (saleId) => {
  if (!saleId) return null;
  try {
    const raw = sessionStorage.getItem(`${PENDING_KEY_PREFIX}${saleId}`);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

export const clearPendingSplitPayment = (saleId) => {
  if (!saleId) return;
  try {
    sessionStorage.removeItem(`${PENDING_KEY_PREFIX}${saleId}`);
  } catch {
    // ignore
  }
};

/** Суммы онлайн + наличные должны совпадать с итогом (допуск 0.01 сом). */
export const validateSplitAmounts = (total, onlineAmount, transferAmount) => {
  const t = Number(total) || 0;
  const online = Math.round((Number(onlineAmount) || 0) * 100) / 100;
  const transfer = Math.round((Number(transferAmount) || 0) * 100) / 100;
  const sum = Math.round((online + transfer) * 100) / 100;
  const target = Math.round(t * 100) / 100;

  if (online <= 0 && transfer <= 0) {
    return { ok: false, message: "Укажите суммы онлайн-оплаты и наличных" };
  }
  if (online < 0 || transfer < 0) {
    return { ok: false, message: "Суммы не могут быть отрицательными" };
  }
  if (Math.abs(sum - target) > 0.01) {
    return {
      ok: false,
      message: `Сумма частей (${sum.toFixed(2)}) должна равняться итогу (${target.toFixed(2)} сом)`,
    };
  }
  return { ok: true, online, transfer, total: target };
};
