/**
 * Общие форматтеры для списка и формы складских документов.
 * QA 06.10.2026: B20 (стабильный номер черновика), B22 (откуда → куда),
 * B29 (подзаголовок по типу), B41 (формат даты).
 */

const pad2 = (n) => String(n).padStart(2, "0");

/** Дата/время документа: 18.09.2026 17:10 (B41). */
export const formatDocumentDateTime = (value) => {
  if (value == null || value === "") return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return `${pad2(d.getDate())}.${pad2(d.getMonth() + 1)}.${d.getFullYear()} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
};

/** Короткий стабильный идентификатор из uuid/id документа. */
export const getShortDocumentId = (id) => {
  if (id == null || id === "") return "";
  return String(id).replace(/-/g, "").slice(0, 8).toUpperCase();
};

/**
 * Номер документа для отображения (B20/B21): реальный number, если он есть,
 * иначе «Черновик <короткий id>» — одинаковый во всех вкладках и на всех страницах.
 */
export const formatDocumentNumber = (doc) => {
  const number = doc?.number != null ? String(doc.number).trim() : "";
  if (number) return number;
  const shortId = getShortDocumentId(doc?.id ?? doc?.uuid);
  return shortId ? `Черновик ${shortId}` : "Черновик";
};

const resolveId = (value) => {
  if (value == null || value === "") return "";
  if (typeof value === "object") return String(value.id ?? value.uuid ?? "");
  return String(value);
};

/** Название склада документа: *_name → вложенный объект → справочник складов → id. */
export const resolveDocumentWarehouseName = (doc, side, warehouses = []) => {
  const key = side === "to" ? "warehouse_to" : "warehouse_from";
  const nameField = doc?.[`${key}_name`];
  if (nameField) return String(nameField);
  const raw = doc?.[key] ?? (side === "from" ? doc?.warehouse : null);
  if (raw && typeof raw === "object" && (raw.name || raw.title)) {
    return String(raw.name || raw.title);
  }
  const id = resolveId(raw);
  if (!id) return "";
  const found = (Array.isArray(warehouses) ? warehouses : []).find(
    (w) => String(w?.id ?? w?.uuid) === id,
  );
  return found?.name || found?.title || `Склад ${id.slice(0, 8)}`;
};

/** «Склад А → Склад Б» для перемещения (B22). */
export const formatTransferRoute = (doc, warehouses = []) => {
  const from = resolveDocumentWarehouseName(doc, "from", warehouses) || "—";
  const to = resolveDocumentWarehouseName(doc, "to", warehouses) || "—";
  return `${from} → ${to}`;
};

const DOC_SUBTITLES = {
  SALE: "Создание документа продажи",
  PURCHASE: "Создание документа закупа",
  SALE_RETURN: "Создание документа возврата продажи",
  PURCHASE_RETURN: "Создание документа возврата поставщику",
  INVENTORY: "Создание документа инвентаризации",
  RECEIPT: "Создание документа прихода",
  WRITE_OFF: "Создание документа списания",
  TRANSFER: "Создание документа перемещения",
};

/** Подзаголовок формы документа по типу (B29). */
export const getDocumentSubtitle = (docType, isEdit = false) => {
  const base = DOC_SUBTITLES[docType] || "Создание документа";
  return isEdit ? base.replace(/^Создание/, "Редактирование") : base;
};
