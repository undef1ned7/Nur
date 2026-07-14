/**
 * Проверка срока действия компании (subscription / end_date).
 * Сравнение по календарным датам, без сдвига из‑за часовых поясов.
 */

export const SUBSCRIPTION_MESSAGES = {
  missing: "Срок действия компании не установлен",
  expired: "Срок действия компании истек",
};

/**
 * @param {object | null | undefined} company
 * @returns {{
 *   ok: boolean,
 *   reason: 'active' | 'missing' | 'expired' | 'unknown',
 *   message: string | null,
 * }}
 */
export function getCompanySubscriptionStatus(company) {
  if (!company || typeof company !== "object") {
    return { ok: false, reason: "unknown", message: null };
  }

  if (!company.end_date) {
    return {
      ok: false,
      reason: "missing",
      message: SUBSCRIPTION_MESSAGES.missing,
    };
  }

  const endDate = new Date(company.end_date);
  if (Number.isNaN(endDate.getTime())) {
    return {
      ok: false,
      reason: "missing",
      message: SUBSCRIPTION_MESSAGES.missing,
    };
  }

  const now = new Date();
  endDate.setHours(0, 0, 0, 0);
  now.setHours(0, 0, 0, 0);

  if (endDate < now) {
    return {
      ok: false,
      reason: "expired",
      message: SUBSCRIPTION_MESSAGES.expired,
    };
  }

  return { ok: true, reason: "active", message: null };
}

export function isCompanySubscriptionActive(company) {
  return getCompanySubscriptionStatus(company).ok;
}
