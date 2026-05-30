/** Нормализация ответа POST /main/pos/sales/start/ и связанных POS-операций */

const countItems = (sale) => {
  const items = sale?.items || sale?.cart?.items;
  return Array.isArray(items) ? items.length : 0;
};

export const mapCartTabFromApi = (raw, index = 0) => {
  if (!raw || typeof raw !== "object") return null;
  const saleId = raw.id ?? raw.sale_id ?? raw.saleId;
  if (!saleId) return null;
  const isMain = Boolean(
    raw.is_default ?? raw.isDefault ?? raw.is_main ?? raw.isMain,
  );
  return {
    saleId: String(saleId),
    label:
      raw.label ||
      raw.name ||
      (isMain ? "Основная" : `Корзина ${index + 1}`),
    isMain,
    itemCount: Number(
      raw.items_count ?? raw.itemsCount ?? raw.item_count ?? 0,
    ),
    total: raw.total ?? raw.total_amount ?? null,
    status: raw.status ?? "open",
  };
};

export const mapCartTabsFromApi = (list) => {
  if (!Array.isArray(list)) return [];
  return list.map((c, i) => mapCartTabFromApi(c, i)).filter(Boolean);
};

const cartTabFromSale = (sale) => {
  if (!sale?.id) return null;
  return {
    saleId: String(sale.id),
    label: sale.is_default || sale.is_default === undefined ? "Основная" : "Корзина",
    isMain: sale.is_default !== false,
    itemCount: countItems(sale),
    total: sale.total ?? null,
    status: sale.status ?? "open",
  };
};

/**
 * @returns {{ sale: object|null, carts: Array, activeSaleId: string|null }}
 */
export const normalizePosStartResponse = (data) => {
  if (!data || typeof data !== "object") {
    return { sale: null, carts: [], activeSaleId: null };
  }

  if (Array.isArray(data.carts)) {
    const carts = mapCartTabsFromApi(data.carts);
    const sale =
      data.sale ??
      data.active_sale ??
      data.active ??
      data.current_sale ??
      null;
    const activeSaleId = String(
      sale?.id ??
        data.active_sale_id ??
        data.active_saleId ??
        data.active_id ??
        carts.find((c) => c.isMain)?.saleId ??
        carts[0]?.saleId ??
        "",
    );
    return {
      sale,
      carts,
      activeSaleId: activeSaleId || null,
    };
  }

  if (Array.isArray(data)) {
    const carts = mapCartTabsFromApi(data);
    const active = carts.find((c) => c.isMain) || carts[0];
    return {
      sale: data.find((s) => String(s.id) === String(active?.saleId)) ?? data[0] ?? null,
      carts,
      activeSaleId: active?.saleId ?? null,
    };
  }

  const sale = data;
  const tab = cartTabFromSale(sale);
  return {
    sale,
    carts: tab ? [tab] : [],
    activeSaleId: sale?.id ? String(sale.id) : null,
  };
};

export const applyPosStartToState = (state, data) => {
  const { sale, carts, activeSaleId } = normalizePosStartResponse(data);
  if (sale) {
    const prev = state.start;
    const prevId = prev?.id != null ? String(prev.id) : "";
    const nextId = sale.id != null ? String(sale.id) : "";
    if (prev && prevId && nextId && prevId === nextId) {
      const prevItems = prev.items ?? prev.cart?.items;
      const nextItems = sale.items ?? sale.cart?.items;
      // POST /start/ часто возвращает sale без items — не затираем строки корзины
      if (
        Array.isArray(prevItems) &&
        prevItems.length > 0 &&
        (!Array.isArray(nextItems) || nextItems.length === 0)
      ) {
        state.start = { ...sale, items: prevItems };
      } else {
        state.start = sale;
      }
    } else {
      state.start = sale;
    }
  }
  if (carts.length) state.posCarts = carts;
  if (activeSaleId) state.activeSaleId = activeSaleId;
  else if (sale?.id) state.activeSaleId = String(sale.id);
};

export const patchCartTabFromSale = (carts, sale) => {
  if (!sale?.id || !Array.isArray(carts)) return carts;
  const id = String(sale.id);
  const count = countItems(sale);
  const has = carts.some((c) => String(c.saleId) === id);
  if (!has) {
    const tab = cartTabFromSale(sale);
    return tab ? [...carts, tab] : carts;
  }
  return carts.map((c) =>
    String(c.saleId) === id ? { ...c, itemCount: count, total: sale.total ?? c.total } : c,
  );
};

export const getMainCartSaleId = (carts) => {
  if (!Array.isArray(carts) || !carts.length) return null;
  const main = carts.find((c) => c.isMain);
  return main?.saleId ?? carts[0]?.saleId ?? null;
};

/** Тело POST /main/pos/sales/start/ */
export const buildPosStartPayload = (args = {}) => {
  const normalized =
    typeof args === "number" || typeof args === "string"
      ? { discount_total: Number(args) || 0 }
      : { ...args };

  const {
    discount_total,
    order_discount_total,
    shift = null,
    isNew,
    is_new,
    sale_id,
    saleId,
    ...rest
  } = normalized;

  const payload = { ...rest };

  const discount =
    order_discount_total !== undefined ? order_discount_total : discount_total;
  if (discount !== undefined && payload.order_discount_total === undefined) {
    payload.order_discount_total = discount;
  }
  if (shift) payload.shift = shift;

  if (is_new !== undefined) payload.is_new = Boolean(is_new);
  else if (isNew !== undefined) payload.is_new = Boolean(isNew);

  const sid = sale_id ?? saleId;
  if (sid) payload.sale_id = sid;

  return payload;
};
