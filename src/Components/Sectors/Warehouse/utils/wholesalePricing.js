export const resolveProductSalePrice = (product, isWholesale = false) => {
  if (!product) return 0;
  if (isWholesale) {
    const wholesale = Number(product.wholesale_price ?? 0);
    if (wholesale > 0) return wholesale;
  }
  return Number(product.price ?? 0);
};

export const formatWholesaleModeLabel = (isWholesale) =>
  Boolean(isWholesale) ? "Опт" : "Розница";
