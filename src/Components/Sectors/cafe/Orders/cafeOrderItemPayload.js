/** Сериализация позиций заказа под OpenAPI OrderItemInline (создание / PATCH). */

export const MAX_QTY = 2147483647;

export const numStr = (n) => String(Number(n) || 0).replace(",", ".");

export const toId = (v) => {
  if (v === "" || v === undefined || v === null) return null;
  const s = String(v);
  return /^\d+$/.test(s) ? Number(s) : s;
};

export const stripEmpty = (obj) =>
  Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== undefined && v !== null && v !== "")
  );

/** unit_price как строка decimal или null (x-nullable). */
export const decimalStringOrNull = (v) => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(String(v).replace(",", "."));
  if (!Number.isFinite(n)) return null;
  return numStr(n);
};

/**
 * Одна строка заказа под OpenAPI OrderItemInline:
 * order, line_kind, menu_item | service_title, unit_price, quantity, is_rejected, rejection_reason.
 * `order`: null при создании заказа, uuid при PATCH.
 */
export const serializeOrderItemInline = (i, orderRef) => {
  const qty = Math.max(
    1,
    Math.min(MAX_QTY, Math.floor(Number(i.quantity) || 1))
  );
  const rejected = Boolean(i.is_rejected);
  const reasonRaw = String(i.rejection_reason || "").trim();
  const rejection_reason = rejected ? (reasonRaw || "—").slice(0, 500) : "";

  const lk = String(i.line_kind || "menu").toLowerCase();

  if (lk === "service") {
    const row = {
      order: orderRef,
      line_kind: "service",
      menu_item: null,
      service_title: String(i.service_title || "").trim().slice(0, 255),
      unit_price: decimalStringOrNull(i.unit_price ?? i.price),
      quantity: qty,
      is_rejected: rejected,
      rejection_reason,
    };
    if (i.id) row.id = i.id;
    return row;
  }

  const row = {
    order: orderRef,
    line_kind: "menu",
    menu_item: toId(i.menu_item),
    unit_price: decimalStringOrNull(i.price ?? i.unit_price),
    quantity: qty,
    is_rejected: rejected,
    rejection_reason,
  };
  if (i.id) row.id = i.id;
  return row;
};

export const normalizeOrderPayload = (f, isNew = false, editingOrderId = null) => {
  const orderRef =
    !isNew && editingOrderId != null && String(editingOrderId).trim() !== ""
      ? toId(editingOrderId)
      : null;

  const items = (f.items || [])
    .filter((i) => {
      const qRaw = i.quantity === "" ? 0 : Number(i.quantity);
      if (!i || !Number.isFinite(qRaw) || qRaw < 1) return false;
      const lk = String(i.line_kind || "menu").toLowerCase();
      if (lk === "service") return String(i.service_title || "").trim().length > 0;
      return !!toId(i.menu_item);
    })
    .map((i) => serializeOrderItemInline(i, orderRef));

  return stripEmpty({
    table: toId(f.table),
    waiter: toId(f.waiter),
    client: toId(f.client),
    guests: Math.max(0, Number(f.guests) || 0),
    status: isNew ? "open" : undefined,
    items,
  });
};
