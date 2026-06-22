const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const TAKEAWAY_LABEL = "С собой";

function normalizeLabel(raw) {
  if (raw === null || raw === undefined) return "";
  const v = String(raw).trim();
  if (!v) return "";
  const low = v.toLowerCase();
  if (v === "?" || low === "null" || low === "undefined") return "";
  if (UUID_RE.test(v)) return "";
  return v;
}

export function resolveTableLabel(order, tablesMap) {
  // 1. table_number directly on order — most reliable, added by backend
  const directNumber =
    order?.table_number ??
    order?.table_num ??
    null;
  if (directNumber !== null && directNumber !== undefined && String(directNumber).trim() !== "") {
    return String(directNumber).trim();
  }

  const tableId =
    order?.table_id ??
    order?.tableId ??
    order?.table?.id ??
    order?.table ??
    null;

  const isEmpty =
    tableId === null ||
    tableId === undefined ||
    tableId === "" ||
    String(tableId).trim() === "";

  if (isEmpty) return TAKEAWAY_LABEL;

  const t = tablesMap?.get(String(tableId));

  if (t) {
    const named = normalizeLabel(
      t.title || t.name || t.label ||
      t.table_name || t.table_label || t.table_title || ""
    );
    if (named) return named;

    if (t.number !== null && t.number !== undefined && t.number !== "") {
      return String(t.number);
    }
  }

  const fallback = normalizeLabel(
    order?.table_name ||
    order?.table_label ||
    order?.table_title ||
    order?.table_number
  );
  if (fallback) return fallback;

  return "—";
}
