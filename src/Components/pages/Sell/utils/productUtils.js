/**
 * Product Utilities
 * Вспомогательные функции для работы с товарами
 */

/**
 * Преобразование строки в число
 */
export const toNum = (v) => {
  const n = Number(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};

/**
 * Определение доступного остатка по товару
 */
export function getAvailableQtyForProduct(productOrId, productsList) {
  if (!productOrId) return 0;
  if (typeof productOrId === "object") {
    const p = productOrId;
    // Приоритет: qty_on_hand, затем quantity
    if (p.qty_on_hand != null) return Number(p.qty_on_hand) || 0;
    if (p.quantity != null) return Number(p.quantity) || 0;
    if (p.id) {
      const found = (productsList || []).find((x) => x.id === p.id);
      if (found) return getAvailableQtyForProduct(found, productsList);
    }
    return 0;
  }
  const found = (productsList || []).find((x) => x.id === productOrId);
  if (!found) return 0;
  return getAvailableQtyForProduct(found, productsList);
}

/**
 * Текущее количество товара в корзине
 */
export function getCartQtyForProduct(productOrId, cartItems) {
  const pid =
    typeof productOrId === "object"
      ? productOrId.id || productOrId.product
      : productOrId;
  if (!pid) return 0;
  const items = Array.isArray(cartItems) ? cartItems : [];
  let sum = 0;
  for (const it of items) {
    const itPid = it.product || it.id;
    if (String(itPid) === String(pid)) {
      sum += Number(it.quantity) || 0;
    }
  }
  return sum;
}

/**
 * Нормализация строки для поиска
 */
export const norm = (s) =>
  String(s ?? "")
    .trim()
    .toLowerCase();
