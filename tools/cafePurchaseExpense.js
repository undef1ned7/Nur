import api from "../src/api";

const MIN_AMOUNT = 0.01;

let zakupkiCategoryIdCache = null;

const listFrom = (data) =>
  Array.isArray(data?.results) ? data.results : Array.isArray(data) ? data : [];

/** ID системной категории «Закупки» (slug zakupki). */
export async function fetchZakupkiCategoryId() {
  if (zakupkiCategoryIdCache) return zakupkiCategoryIdCache;
  try {
    const { data } = await api.get("/cafe/expense-categories/", {
      params: { page_size: 200 },
    });
    const cat = listFrom(data).find((c) => {
      const slug = String(c?.slug || "").toLowerCase();
      const title = String(c?.title ?? c?.name ?? "").trim().toLowerCase();
      return slug === "zakupki" || slug === "purchases" || title === "закупки";
    });
    zakupkiCategoryIdCache = cat?.id ? String(cat.id) : null;
  } catch {
    zakupkiCategoryIdCache = null;
  }
  return zakupkiCategoryIdCache;
}

export function pickExpenseIdFromResponse(data) {
  if (!data || typeof data !== "object") return null;
  const direct = data.expense_id ?? data.expenseId;
  if (direct) return String(direct);
  if (data.expense?.id) return String(data.expense.id);
  if (data.movement?.expense_id) return String(data.movement.expense_id);
  return null;
}

/**
 * Операционный расход CafeExpense (категория «Закупки»).
 * @returns {Promise<string|null>} id расхода
 */
export async function recordCafePurchaseExpense({
  title,
  amount,
  note = "",
  source = "manual",
  sourceId = null,
  expenseDate = null,
}) {
  const amt = Number(String(amount).replace(",", "."));
  if (!Number.isFinite(amt) || amt < MIN_AMOUNT) return null;

  const categoryId = await fetchZakupkiCategoryId();
  const payload = {
    title: String(title || "Закупка").trim() || "Закупка",
    amount: amt.toFixed(2),
    expense_date: expenseDate || new Date().toISOString().slice(0, 10),
    note: String(note || "").trim(),
  };

  if (categoryId) payload.category_id = categoryId;
  else payload.category = "Закупки";

  if (source) payload.source = source;
  if (sourceId) payload.source_id = String(sourceId);

  const { data } = await api.post("/cafe/expenses/", payload);
  return data?.id ? String(data.id) : pickExpenseIdFromResponse(data);
}
