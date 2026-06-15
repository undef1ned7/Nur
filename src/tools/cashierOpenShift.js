export const resolveCashierId = ({ currentUser, userId, profile } = {}) => {
  const id = currentUser?.id ?? userId ?? profile?.id;
  return id != null && String(id).trim() ? String(id) : "";
};

export const getShiftCashierId = (shift) => {
  const raw = shift?.cashier ?? shift?.cashier_id ?? shift?.user;
  if (raw != null && typeof raw === "object") {
    const nested = raw.id ?? raw.pk;
    return nested != null && String(nested).trim() ? String(nested) : "";
  }
  return raw != null && String(raw).trim() ? String(raw) : "";
};

export const isOwnOpenShift = (shift, cashierId) =>
  shift?.status === "open" &&
  Boolean(cashierId) &&
  getShiftCashierId(shift) === String(cashierId);

export const findOwnOpenShiftInList = (list, cashierId) =>
  (Array.isArray(list) ? list : []).find((s) => isOwnOpenShift(s, cashierId)) ||
  null;

/** Ищет открытую смену текущего кассира через GET /construction/shifts/?status=open */
export const fetchOwnOpenShift = async (apiClient, cashierId) => {
  if (!cashierId) return null;

  const searchPages = async (params) => {
    let page = 1;
    let hasNext = true;

    while (hasNext && page <= 10) {
      const { data } = await apiClient.get("/construction/shifts/", {
        params: { ...params, page },
      });
      const found = findOwnOpenShiftInList(data?.results, cashierId);
      if (found) return found;
      hasNext = !!data?.next;
      page += 1;
    }

    return null;
  };

  try {
    const fromOpenFilter = await searchPages({ status: "open" });
    if (fromOpenFilter) return fromOpenFilter;
  } catch {
    // фильтр status=open может быть недоступен — ищем по всем страницам
  }

  try {
    return await searchPages({});
  } catch {
    return null;
  }
};
