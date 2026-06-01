/** Системная категория «Закупки» — нельзя менять/удалять в UI кассы. */
export const isProtectedCashflowCategory = (category) => {
  if (!category || typeof category !== "object") return false;
  if (category.is_system === true) return true;
  const slug = String(category.slug || "")
    .trim()
    .toLowerCase();
  if (slug === "zakupki" || slug === "purchases") return true;
  const title = String(category.title ?? category.name ?? "")
    .trim()
    .toLowerCase();
  return title === "закупки";
};
