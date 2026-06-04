/** Роль владельца/админа кафе (en или ru). */
export function normalizeCafeMgmtRole(raw) {
  const l = String(raw || "")
    .trim()
    .toLowerCase();
  if (["owner", "владелец"].includes(l)) return "owner";
  if (["admin", "administrator", "админ", "администратор"].includes(l))
    return "admin";
  return l;
}

export function isCafeOwnerOrAdmin(role) {
  const m = normalizeCafeMgmtRole(role);
  return m === "owner" || m === "admin";
}

/** Проведение оплаты заказа (кнопки «Оплатить» / «Провести оплату»). */
export function canCafeOrderPay(profile) {
  if (!profile) return false;
  if (isCafeOwnerOrAdmin(profile.role)) return true;
  return profile.can_view_cafe_order_pay === true;
}

/** Возврат позиций по заказу (история, модалка чека). */
export function canCafeOrderReturn(profile) {
  if (!profile) return false;
  if (isCafeOwnerOrAdmin(profile.role)) return true;
  return profile.can_view_cafe_order_return === true;
}
