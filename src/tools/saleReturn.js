/** Нормализует статус продажи к slug: paid | debt | canceled | new | … */
export const normalizeSaleStatus = (status) => {
  const s = String(status ?? "")
    .trim()
    .toLowerCase();
  if (!s) return "";
  if (["paid", "оплачен", "оплаченный", "оплачена", "оплачено"].includes(s)) {
    return "paid";
  }
  if (["debt", "долг", "в долг"].includes(s)) {
    return "debt";
  }
  if (
    ["canceled", "cancelled", "отменен", "отменён", "отменена", "возвращенный"].includes(
      s,
    )
  ) {
    return "canceled";
  }
  if (["new", "новый", "новая", "open"].includes(s)) {
    return "new";
  }
  return s;
};

export const isReturnableSaleStatus = (status) => {
  const normalized = normalizeSaleStatus(status);
  return normalized === "paid" || normalized === "debt";
};

export const isProfileOwnerOrAdmin = (profile) => {
  const role = String(profile?.role ?? "")
    .trim()
    .toLowerCase();
  const roleDisplay = String(profile?.role_display ?? "")
    .trim()
    .toLowerCase();
  return (
    role === "owner" ||
    role === "admin" ||
    roleDisplay === "владелец" ||
    roleDisplay === "администратор"
  );
};

/** Право на возврат продаж сотрудником маркета (или владелец/админ). */
export const hasMarketReturnPermission = (profile) => {
  if (isProfileOwnerOrAdmin(profile)) return true;
  const flag = profile?.can_view_market_employee_return;
  return flag === true || flag === 1 || flag === "1" || flag === "true";
};

export const isMarketSectorName = (sectorName) => {
  const s = String(sectorName ?? "")
    .trim()
    .toLowerCase();
  return (
    s === "магазин" ||
    s === "цветочный магазин" ||
    s.includes("магазин")
  );
};
