export const toNum = (v) => {
  const n = typeof v === "string" ? Number(v.replace(",", ".")) : Number(v);
  return Number.isFinite(n) ? n : 0;
};

/** Сумма позиций, скидка и итог к оплате/оплачено по полям заказа API. */
export function resolveCafeOrderFinancials(order, itemsSubtotal = null) {
  const fromItems = itemsSubtotal != null ? toNum(itemsSubtotal) : 0;
  const subtotal =
    order?.total_amount != null && order.total_amount !== ""
      ? toNum(order.total_amount)
      : fromItems;
  const discount = toNum(order?.discount_amount);
  const due = Math.max(0, subtotal - discount);
  const paid = toNum(order?.net_paid_amount) || toNum(order?.paid_amount);
  const total = paid > 0 ? paid : due;
  return { subtotal, discount, due, paid, total };
}

export function resolveCafePrintPayment(order, amount) {
  const method = String(order?.payment_method || "").toLowerCase();
  const amt = toNum(amount);
  if (method === "cash") return { paid_cash: amt, paid_card: 0 };
  if (method === "card") return { paid_cash: 0, paid_card: amt };
  return { paid_cash: 0, paid_card: 0 };
}

export function buildCafeReceiptPrintFinancials(order, itemsSubtotal) {
  const fin = resolveCafeOrderFinancials(order, itemsSubtotal);
  const pay = resolveCafePrintPayment(order, fin.total);
  return {
    subtotal: fin.subtotal,
    discount: fin.discount,
    total: fin.total,
    payment_method: order?.payment_method || "",
    ...pay,
  };
}
