import { useMemo } from "react";

export const useProductFilter = (products, searchQuery, categoryFilter) => {
  const filteredProducts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const productsList = Array.isArray(products) ? products : [];

    let filtered = productsList.filter((p) => {
      const okName =
        !q || (p.name || p.product_name || "").toLowerCase().includes(q);
      const okCat =
        !categoryFilter ||
        String(p.category_id || p.category)?.toLowerCase() ===
          String(categoryFilter).toLowerCase();

      return okName && okCat;
    });

    return filtered.sort((a, b) => {
      return (a.name || a.product_name || "").localeCompare(
        b.name || b.product_name || ""
      );
    });
  }, [products, searchQuery, categoryFilter]);

  return filteredProducts;
};
