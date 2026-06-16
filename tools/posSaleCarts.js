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

/**
 * Бэк на add-item часто кладёт sale_package только в added_item, не в items[].
 * Без этого поштучная строка теряет sale_package и пачка PATCH-ит её же.
 */
export const enrichPosSaleResponse = (data, options = {}) => {
  if (!data || typeof data !== "object") return data;

  const addedItemId = data.added_item_id ?? data.added_item?.id ?? null;
  const addedSalePackage =
    data.added_item?.sale_package ??
    data.added_item?.sale_package_id ??
    options.salePackageId ??
    null;

  if (!Array.isArray(data.items) && !Array.isArray(data.cart?.items)) {
    if (
      options.salePackageId &&
      isCartLineItemResponse(data) &&
      !data.sale_package
    ) {
      return { ...data, sale_package: options.salePackageId };
    }
    return data;
  }

  const rawItems = data.items ?? data.cart?.items ?? [];
  const items = rawItems.map((item) => {
    const existing = item.sale_package ?? item.sale_package_id ?? null;
    if (existing != null && String(existing) !== "") {
      return item;
    }
    const isAdded =
      addedItemId != null && String(item.id) === String(addedItemId);
    const pkg = isAdded ? addedSalePackage : null;
    if (pkg == null || String(pkg) === "") return item;
    return { ...item, sale_package: pkg };
  });

  const next = { ...data, items };
  if (data.cart) {
    next.cart = { ...data.cart, items };
  }
  return next;
};

const preserveSalePackageFromPrevItems = (nextItems, prevItems) => {
  if (!Array.isArray(nextItems) || !Array.isArray(prevItems)) return nextItems;
  return nextItems.map((item) => {
    const existing = item.sale_package ?? item.sale_package_id ?? null;
    if (existing != null && String(existing) !== "") return item;
    const prevLine = prevItems.find((p) => String(p.id) === String(item.id));
    if (prevLine?.sale_package) {
      return { ...item, sale_package: prevLine.sale_package };
    }
    return item;
  });
};

const mergeSaleIntoStateStart = (state, sale, options = {}) => {
  if (!sale?.id) return;
  const prev = state.start;
  const prevId = prev?.id != null ? String(prev.id) : "";
  const nextId = String(sale.id);

  let nextSale = enrichPosSaleResponse(sale, options);

  if (prev && prevId && nextId && prevId === nextId) {
    const prevItems = prev.items ?? prev.cart?.items;
    const nextItemsMissing =
      nextSale.items === undefined &&
      (nextSale.cart === undefined || nextSale.cart.items === undefined);
    // POST /start/ и иногда PATCH — sale без items: не затираем строки корзины.
    // Пустой массив items[] (после удаления последней позиции) — применяем.
    if (Array.isArray(prevItems) && prevItems.length > 0 && nextItemsMissing) {
      state.start = { ...nextSale, items: prevItems };
      return;
    }

    const nextItems = nextSale.items ?? nextSale.cart?.items;
    if (Array.isArray(nextItems) && Array.isArray(prevItems)) {
      const mergedItems = preserveSalePackageFromPrevItems(nextItems, prevItems);
      nextSale = {
        ...nextSale,
        items: mergedItems,
        ...(nextSale.cart
          ? { cart: { ...nextSale.cart, items: mergedItems } }
          : {}),
      };
    }
  }
  state.start = nextSale;
};

/** Ответ POST add-item / PATCH строки — одна позиция, не вся продажа */
export const isCartLineItemResponse = (data) => {
  if (!data || typeof data !== "object") return false;
  if (Array.isArray(data.carts) || data.sale != null) return false;
  if (Array.isArray(data.items) || Array.isArray(data.cart?.items)) return false;
  const productId = data.product ?? data.product_id;
  if (productId == null || data.id == null) return false;
  if (
    data.shift != null &&
    data.quantity == null &&
    data.product_name == null &&
    data.display_name == null
  ) {
    return false;
  }
  return true;
};

export const mergeCartLineIntoStart = (state, lineItem) => {
  if (!state.start?.id) return false;
  const prevItems = [...(state.start.items ?? state.start.cart?.items ?? [])];
  const lineId = lineItem.id;
  const idx = prevItems.findIndex((it) => String(it.id) === String(lineId));
  const nextItems =
    idx >= 0
      ? prevItems.map((it, i) =>
          i === idx
            ? {
                ...it,
                ...lineItem,
                sale_package:
                  lineItem.sale_package ??
                  lineItem.sale_package_id ??
                  it.sale_package ??
                  null,
              }
            : it,
        )
      : [
          ...prevItems,
          {
            ...lineItem,
            sale_package:
              lineItem.sale_package ?? lineItem.sale_package_id ?? null,
          },
        ];

  state.start = {
    ...state.start,
    items: nextItems,
    ...(state.start.cart
      ? { cart: { ...state.start.cart, items: nextItems } }
      : {}),
  };
  if (Array.isArray(state.posCarts) && state.posCarts.length) {
    state.posCarts = patchCartTabFromSale(state.posCarts, state.start);
  }
  return true;
};

export const removeCartLineFromStart = (state, itemId) => {
  if (!state.start?.id || itemId == null) return false;
  const prevItems = state.start.items ?? state.start.cart?.items ?? [];
  if (!Array.isArray(prevItems)) return false;
  const nextItems = prevItems.filter((it) => String(it.id) !== String(itemId));
  if (nextItems.length === prevItems.length) return false;

  state.start = {
    ...state.start,
    items: nextItems,
    ...(state.start.cart
      ? { cart: { ...state.start.cart, items: nextItems } }
      : {}),
  };
  if (Array.isArray(state.posCarts) && state.posCarts.length) {
    state.posCarts = patchCartTabFromSale(state.posCarts, state.start);
  }
  return true;
};

export const applyPosStartToState = (state, data) => {
  const { sale, carts, activeSaleId } = normalizePosStartResponse(data);
  if (sale) {
    mergeSaleIntoStateStart(state, sale);
  }
  if (carts.length) state.posCarts = carts;
  if (activeSaleId) state.activeSaleId = activeSaleId;
  else if (sale?.id) state.activeSaleId = String(sale.id);
};

/**
 * PATCH /main/pos/carts/{saleId}/items/{itemId}/ — ответ с одной продажей.
 * Не подменяет список вкладок (posCarts), только активную продажу и метаданные вкладки.
 */
export const applyPosCartItemPatchToState = (state, data, options = {}) => {
  if (!data || typeof data !== "object") return;

  const payload = enrichPosSaleResponse(data, options);

  if (Array.isArray(payload.carts)) {
    applyPosStartToState(state, payload);
    return;
  }

  if (isCartLineItemResponse(payload)) {
    mergeCartLineIntoStart(state, payload);
    return;
  }

  const { sale } = normalizePosStartResponse(payload);
  const patchSale =
    sale ?? (payload.id != null || payload.sale_id != null ? payload : null);
  if (!patchSale?.id) return;

  const patchId = String(patchSale.id ?? patchSale.sale_id);
  const activeId = state.activeSaleId
    ? String(state.activeSaleId)
    : state.start?.id != null
      ? String(state.start.id)
      : "";

  if (activeId && patchId !== activeId) return;

  mergeSaleIntoStateStart(state, patchSale, options);

  if (Array.isArray(state.posCarts) && state.posCarts.length) {
    state.posCarts = patchCartTabFromSale(state.posCarts, state.start ?? patchSale);
  }
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
