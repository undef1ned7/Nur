import { productSearchHaystackLower } from "../../../../../../tools/productBarcode";
import { isKitCompositionCandidate } from "../../../../../tools/marketWarehouseFilters";

export const getProductCategoryKey = (product) => {
  const category = product?.category;
  if (category && typeof category === "object") {
    return String(category.id ?? category.uuid ?? "").trim();
  }
  return String(category ?? product?.category_id ?? "").trim();
};

export const getProductCategoryLabel = (product, categories = []) => {
  const key = getProductCategoryKey(product);
  if (key) {
    const found = categories.find((c) => String(c.id) === key);
    if (found?.name) return found.name;
  }
  return (
    product?.category_name ||
    product?.category_title ||
    (typeof product?.category === "string" ? product.category : "") ||
    "Без категории"
  );
};

export const filterKitCompositionCandidates = (
  products = [],
  { excludeProductId = "", alreadyInKitIds = [] } = {},
) => {
  const excluded = new Set(
    [excludeProductId, ...alreadyInKitIds].map((id) => String(id)).filter(Boolean),
  );

  return (Array.isArray(products) ? products : []).filter((product) => {
    if (!isKitCompositionCandidate(product)) return false;
    if (excluded.has(String(product.id))) return false;
    return true;
  });
};

export const filterKitPickerList = (
  candidates = [],
  { search = "", categoryId = "", categories = [] } = {},
) => {
  const q = String(search || "").trim().toLowerCase();
  const cat = String(categoryId || "").trim();

  return candidates
    .filter((product) => {
      if (cat && getProductCategoryKey(product) !== cat) return false;
      if (!q) return true;
      return productSearchHaystackLower(product).includes(q);
    })
    .map((product) => {
      const qty = parseFloat(product.quantity);
      const unit = product.unit || "шт";
      return {
        id: String(product.id),
        title: product.name || product.title || "Без названия",
        subtitle: getProductCategoryLabel(product, categories),
        meta: `Остаток: ${Number.isFinite(qty) ? qty : 0} ${unit}`,
        product,
      };
    });
};
