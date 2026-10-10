/**
 * Режимы цен продажи (B09/B38).
 * В форме товара поле `price` подписано «Оптовая цена», а `wholesale_price` — «Цена агента».
 * Поэтому `is_wholesale: false` = цена из `price` («Оптовая цена»),
 * `is_wholesale: true` = цена из `wholesale_price` («Цена агента»).
 * Подписи режимов везде берём отсюда, чтобы они совпадали с формой товара и с тем,
 * что реально уходит в API. Смена смысла полей — после решения D-B38 (бэк).
 */
export const SALE_PRICE_MODE_LABELS = Object.freeze({
  base: "Оптовая цена",
  agent: "Цена агента",
});

export const resolveProductSalePrice = (product, isWholesale = false) => {
  if (!product) return 0;
  if (isWholesale) {
    const wholesale = Number(product.wholesale_price ?? 0);
    if (wholesale > 0) return wholesale;
  }
  return Number(product.price ?? 0);
};

export const formatWholesaleModeLabel = (isWholesale) =>
  isWholesale
    ? SALE_PRICE_MODE_LABELS.agent
    : SALE_PRICE_MODE_LABELS.base;
