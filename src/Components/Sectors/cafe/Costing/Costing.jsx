import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  Boxes,
  ChefHat,
  Download,
  LayoutGrid,
  List,
  PackageCheck,
  Pencil,
  Plus,
  Save,
  Search,
  Trash2,
  TrendingUp,
  X,
} from "lucide-react";
import { useDebouncedValue } from "../../../../hooks/useDebounce";
import TechCardsPickerModal from "./TechCardsPickerModal";
import {
  Document,
  Page,
  StyleSheet,
  Text,
  View,
  pdf,
} from "@react-pdf/renderer";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import api from "../../../../api";
import DataContainer from "../../../common/DataContainer/DataContainer";
import { useAlert, useConfirm } from "../../../../hooks/useDialog";
import { validateResErrors } from "../../../../../tools/validateResErrors";
import { registerPdfFonts } from "@/pdf/registerFonts";
import "./Costing.scss";

registerPdfFonts();

const listFrom = (res) => res?.data?.results || res?.data || [];
const processingChargeTypeLabel = (value) => {
  if (value === "per_unit") return "За единицу";
  if (value === "fixed") return "Фиксированно";
  return "—";
};
const unitLabels = {
  kg: "кг",
  g: "г",
  l: "л",
  ml: "мл",
  pcs: "шт",
};
const toFiniteNumber = (value) => {
  if (value === null || value === undefined || value === "") return null;
  const normalized =
    typeof value === "string" ? value.trim().replace(",", ".") : value;
  if (normalized === "") return null;
  const num = Number(normalized);
  return Number.isFinite(num) ? num : null;
};
const coalesceNumber = (...values) => {
  for (const value of values) {
    const num = toFiniteNumber(value);
    if (num !== null) return num;
  }
  return undefined;
};
const formatNumber = (value, maxFractionDigits = 3) => {
  const num = toFiniteNumber(value);
  if (num === null) return value ?? "—";
  return new Intl.NumberFormat("ru-RU", {
    minimumFractionDigits: 0,
    maximumFractionDigits: maxFractionDigits,
  }).format(num);
};
const formatMoney = (value) => {
  if (value === null || value === undefined || value === "") return "—";
  return `${formatNumber(value, 2)} сом`;
};
const formatPercent = (value) => {
  if (value === null || value === undefined || value === "") return "—";
  return `${formatNumber(value, 2)}%`;
};
const safeFilename = (value) =>
  String(value || "tech-card")
    .trim()
    .replace(/[^\wа-яА-ЯёЁ.-]+/g, "_")
    .replace(/^_+|_+$/g, "") || "tech-card";
const downloadBlob = (blob, filename) => {
  if (typeof window === "undefined" || !window.URL || !window.document) return;
  const url = window.URL.createObjectURL(blob);
  const a = window.document.createElement("a");
  a.href = url;
  a.download = filename;
  window.document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
};
const formatUnit = (value) => {
  const raw = String(value || "").trim();
  if (!raw) return "—";
  return unitLabels[raw.toLowerCase()] || raw;
};
const isNewIngredientSchema = (row) =>
  row?.ingredient_type === "product" || row?.ingredient_type === "preparation";

const ingredientTypeLabel = (value, row) => {
  if (row && !isNewIngredientSchema(row)) return "Товар";
  return value === "preparation" ? "Заготовка" : "Товар";
};

const getIngredientName = (row) =>
  row?.product_title ||
  row?.product_name ||
  row?.preparation_name ||
  row?.preparation_title ||
  row?.name ||
  "Ингредиент";

const getMenuItemListCost = (item) => {
  if (!item) return null;
  return {
    cost_price: item?.cost_price,
    margin_amount: item?.margin_amount,
    margin_percent: item?.margin_percent_value ?? item?.margin_percent,
    sale_price: item?.price,
  };
};

const getTechCardCostForDisplay = (item, costsMap = {}) => {
  const id = String(item?.id || "");
  const exported = costsMap[id];
  if (
    exported &&
    (exported.cost_price !== undefined ||
      exported.sale_price !== undefined ||
      exported.margin_amount !== undefined)
  ) {
    return exported;
  }
  return getMenuItemListCost(item) || {};
};
const normalizeIngredientRows = (rows) =>
  (Array.isArray(rows) ? rows : []).map((row) => {
    const processings = Array.isArray(row?.processings) ? row.processings : [];
    const processingItems = Array.isArray(row?.processing_items)
      ? row.processing_items
      : [];
    return {
      ...row,
      processing_items:
        processingItems.length >= processings.length ? processingItems : processings,
    };
  });
const getIngredientRowsFromDetail = (detail, fallbackRows = []) => {
  const sources = [
    detail?.ingredients,
    detail?.dish_ingredients,
    detail?.recipe,
    fallbackRows,
  ];
  const rows =
    sources.find((source) => Array.isArray(source) && source.length > 0) ||
    sources.find((source) => Array.isArray(source)) ||
    [];
  return normalizeIngredientRows(rows);
};
const formatIngredientQuantity = (row) => {
  const quantity = formatNumber(row?.quantity ?? row?.amount);
  const unit = formatUnit(row?.unit || row?.product_unit);
  if (quantity === "—") return unit;
  return unit === "—" ? String(quantity) : `${quantity} ${unit}`;
};
const getIngredientCost = (row) =>
  coalesceNumber(
    row?.total_cost,
    row?.ingredient_cost,
    row?.cost_price_rub,
  );
const getProcessingCost = (row) => coalesceNumber(row?.processing_cost);
const getProcessingLabel = (row) => {
  const items = Array.isArray(row?.processing_items) ? row.processing_items : [];
  if (!items.length) {
    const cost = getProcessingCost(row);
    return cost !== undefined ? formatMoney(cost) : "—";
  }
  return items
    .map((item) => {
      const name = item?.processing_type_name || item?.name || "Обработка";
      const cost = coalesceNumber(item?.cost);
      return cost !== undefined ? `${name}: ${formatMoney(cost)}` : name;
    })
    .join("; ");
};
const getTotalWeightLabel = (rows) => {
  const grams = rows.reduce((sum, row) => {
    const quantity = toFiniteNumber(row?.quantity);
    if (quantity === null) return sum;
    const unit = String(row?.unit || "").trim().toLowerCase();
    if (unit === "kg" || unit === "кг") return sum + quantity * 1000;
    if (unit === "g" || unit === "г" || unit === "гр") return sum + quantity;
    return sum;
  }, 0);
  return grams > 0 ? `${formatNumber(grams, 0)} г` : "—";
};
const TECHCARD_PICKER_SEARCH_PARAM = "techcard_q";
const TECHCARD_PICKER_CATEGORY_PARAM = "techcard_category";
const TECHCARD_LIST_PAGE_PARAM = "techcard_page";

const buildTechCardPdfData = ({ detail, cost, rows }) => {
  const ingredients = normalizeIngredientRows(rows);
  const rowsCost = ingredients.reduce((sum, row) => {
    const value = getIngredientCost(row);
    return value === undefined ? sum : sum + value;
  }, 0);
  const costPrice = coalesceNumber(
    cost?.cost_price,
    cost?.total_cost,
    rowsCost > 0 ? rowsCost : undefined,
  );
  const salePrice = coalesceNumber(cost?.sale_price, detail?.sale_price, detail?.price);
  const fallbackMargin =
    salePrice !== undefined && costPrice !== undefined ? salePrice - costPrice : undefined;
  const marginAmount = coalesceNumber(cost?.margin_amount, fallbackMargin);
  const fallbackMarginPercent =
    salePrice && marginAmount !== undefined ? (marginAmount / salePrice) * 100 : undefined;
  const marginPercent = coalesceNumber(cost?.margin_percent, fallbackMarginPercent);

  return {
    id: detail?.id,
    title: detail?.title || detail?.name || "Блюдо",
    category: detail?.category_title || detail?.category_name || "",
    kitchen: detail?.kitchen_title || detail?.kitchen_name || "",
    status: detail?.is_active === false ? "Архив" : "Активна",
    ingredients,
    totalWeight: getTotalWeightLabel(ingredients),
    cost: {
      cost_price: costPrice,
      sale_price: salePrice,
      margin_amount: marginAmount,
      margin_percent: marginPercent,
    },
  };
};

const techCardItemsFromResponse = (data) => {
  if (Array.isArray(data?.items)) return data.items;
  return listFrom({ data: data?.results || data });
};

const normalizeTechCardBulkItem = (item) => {
  const id = String(item?.id || "").trim();
  if (!id) return null;
  const ingredients = normalizeIngredientRows(
    getIngredientRowsFromDetail(item, item?.ingredients),
  );
  const detail = { ...item, ingredients };
  const cost = item?.cost ?? null;
  const listRow = {
    id,
    title: detail.title || detail.name || "Блюдо",
    name: detail.name,
    price: detail.price,
    category: detail.category_id ?? detail.category,
    category_id: detail.category_id ?? detail.category,
    category_title: detail.category_title || detail.category_name || "",
    image_url: detail.image_url || detail.image || "",
    image: detail.image,
    is_active: detail.is_active,
    ingredients,
  };
  return { id, detail, cost, listRow };
};

const mapExportItemToPdfData = (item) => {
  const normalized = normalizeTechCardBulkItem(item);
  if (!normalized) {
    const detail = item?.menu_item || item?.dish || item;
    const cost = item?.cost || {};
    const rows = getIngredientRowsFromDetail(detail, item?.ingredients);
    return buildTechCardPdfData({ detail, cost, rows });
  }
  return buildTechCardPdfData({
    detail: normalized.detail,
    cost: normalized.cost,
    rows: normalized.detail.ingredients,
  });
};

const techCardPdfStyles = StyleSheet.create({
  page: {
    padding: 26,
    fontFamily: "Roboto",
    fontSize: 9,
    color: "#111827",
    backgroundColor: "#fbfaf4",
  },
  header: {
    marginBottom: 14,
    paddingBottom: 12,
    borderBottom: "1px solid #e5e7eb",
  },
  eyebrow: {
    color: "#8a6f00",
    fontSize: 8,
    fontWeight: "bold",
    letterSpacing: 1.2,
    marginBottom: 5,
    textTransform: "uppercase",
  },
  title: {
    fontSize: 19,
    fontWeight: "bold",
    marginBottom: 5,
  },
  subtitle: {
    color: "#6b7280",
    lineHeight: 1.4,
  },
  dishCard: {
    padding: 12,
    border: "1px solid #e5e7eb",
    borderRadius: 12,
    backgroundColor: "#ffffff",
    marginBottom: 12,
  },
  dishLabel: {
    color: "#6b7280",
    fontSize: 8,
    marginBottom: 4,
  },
  dishTitle: {
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 8,
  },
  metaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  metaItem: {
    marginRight: 18,
    marginBottom: 4,
    color: "#4b5563",
    fontSize: 9,
  },
  summary: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginBottom: 12,
  },
  summaryItem: {
    width: "31.8%",
    border: "1px solid #e5e7eb",
    borderRadius: 10,
    padding: 8,
    backgroundColor: "#ffffff",
    marginRight: 6,
    marginBottom: 7,
  },
  summaryLabel: {
    color: "#6b7280",
    fontSize: 8,
    marginBottom: 4,
  },
  summaryValue: {
    fontSize: 11,
    fontWeight: "bold",
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: "bold",
    marginBottom: 7,
  },
  table: {
    border: "1px solid #e5e7eb",
    borderRadius: 10,
    backgroundColor: "#ffffff",
  },
  row: {
    flexDirection: "row",
    borderBottom: "1px solid #e5e7eb",
  },
  headerRow: {
    backgroundColor: "#111827",
  },
  cell: {
    padding: 6,
    borderRight: "1px solid #e5e7eb",
  },
  lastCell: {
    borderRightWidth: 0,
  },
  typeCell: {
    width: "12%",
  },
  ingredientCell: {
    width: "26%",
  },
  qtyCell: {
    width: "13%",
  },
  unitCostCell: {
    width: "14%",
  },
  processingCell: {
    width: "17%",
  },
  totalCell: {
    width: "18%",
  },
  headerText: {
    fontWeight: "bold",
    color: "#ffffff",
    fontSize: 8,
  },
  totalText: {
    fontWeight: "bold",
    color: "#111827",
    fontSize: 9,
  },
  mutedText: {
    color: "#6b7280",
    fontSize: 8,
  },
  totalRow: {
    backgroundColor: "#f9fafb",
    borderBottomWidth: 0,
  },
  footer: {
    marginTop: 12,
    paddingTop: 8,
    borderTop: "1px solid #e5e7eb",
    color: "#6b7280",
    fontSize: 8,
  },
});

function TechCardPdfPage({ data, generatedAt }) {
  const rows = Array.isArray(data?.ingredients) ? data.ingredients : [];
  return (
    <Page size="A4" style={techCardPdfStyles.page}>
      <View style={techCardPdfStyles.header}>
        <Text style={techCardPdfStyles.eyebrow}>NUR CRM · Кафе</Text>
        <Text style={techCardPdfStyles.title}>Технологическая карта блюда</Text>
        <Text style={techCardPdfStyles.subtitle}>
          Автоматически сформирована из текущей техкарты: состав, граммовки,
          себестоимость, цена продажи и маржа.
        </Text>
      </View>

      <View style={techCardPdfStyles.dishCard}>
        <Text style={techCardPdfStyles.dishLabel}>Блюдо</Text>
        <Text style={techCardPdfStyles.dishTitle}>{data?.title || "Блюдо"}</Text>
        <View style={techCardPdfStyles.metaRow}>
          <Text style={techCardPdfStyles.metaItem}>Категория: {data?.category || "—"}</Text>
          <Text style={techCardPdfStyles.metaItem}>Кухня: {data?.kitchen || "—"}</Text>
          <Text style={techCardPdfStyles.metaItem}>Статус: {data?.status || "—"}</Text>
          <Text style={techCardPdfStyles.metaItem}>Дата: {generatedAt}</Text>
        </View>
      </View>

      <View style={techCardPdfStyles.summary}>
        {[
          ["Ингредиенты", formatNumber(rows.length, 0)],
          ["Граммовка", data?.totalWeight || "—"],
          ["Себестоимость", formatMoney(data?.cost?.cost_price)],
          ["Цена продажи", formatMoney(data?.cost?.sale_price)],
          ["Маржа", formatMoney(data?.cost?.margin_amount)],
          ["Маржа %", formatPercent(data?.cost?.margin_percent)],
        ].map(([label, value]) => (
          <View key={label} style={techCardPdfStyles.summaryItem}>
            <Text style={techCardPdfStyles.summaryLabel}>{label}</Text>
            <Text style={techCardPdfStyles.summaryValue}>{value}</Text>
          </View>
        ))}
      </View>

      <Text style={techCardPdfStyles.sectionTitle}>Состав блюда</Text>
      <View style={techCardPdfStyles.table}>
        <View style={[techCardPdfStyles.row, techCardPdfStyles.headerRow]}>
          <View style={[techCardPdfStyles.cell, techCardPdfStyles.typeCell]}>
            <Text style={techCardPdfStyles.headerText}>Тип</Text>
          </View>
          <View style={[techCardPdfStyles.cell, techCardPdfStyles.ingredientCell]}>
            <Text style={techCardPdfStyles.headerText}>Ингредиент</Text>
          </View>
          <View style={[techCardPdfStyles.cell, techCardPdfStyles.qtyCell]}>
            <Text style={techCardPdfStyles.headerText}>Граммовка</Text>
          </View>
          <View style={[techCardPdfStyles.cell, techCardPdfStyles.unitCostCell]}>
            <Text style={techCardPdfStyles.headerText}>Себест. ед.</Text>
          </View>
          <View style={[techCardPdfStyles.cell, techCardPdfStyles.processingCell]}>
            <Text style={techCardPdfStyles.headerText}>Обработки</Text>
          </View>
          <View
            style={[
              techCardPdfStyles.cell,
              techCardPdfStyles.totalCell,
              techCardPdfStyles.lastCell,
            ]}
          >
            <Text style={techCardPdfStyles.headerText}>Итог</Text>
          </View>
        </View>

        {rows.length === 0 ? (
          <View style={[techCardPdfStyles.row, { borderBottomWidth: 0 }]}>
            <View
              style={[
                techCardPdfStyles.cell,
                techCardPdfStyles.lastCell,
                { width: "100%" },
              ]}
            >
              <Text style={techCardPdfStyles.mutedText}>
                Ингредиенты пока не добавлены
              </Text>
            </View>
          </View>
        ) : (
          rows.map((row, idx) => (
            <View
              key={`${row?.id || "ingredient"}-${idx}`}
              style={[
                techCardPdfStyles.row,
                idx === rows.length - 1 ? { borderBottomWidth: 0 } : {},
              ]}
              wrap={false}
            >
              <View style={[techCardPdfStyles.cell, techCardPdfStyles.typeCell]}>
                <Text>{ingredientTypeLabel(row?.ingredient_type, row)}</Text>
              </View>
              <View style={[techCardPdfStyles.cell, techCardPdfStyles.ingredientCell]}>
                <Text>{getIngredientName(row)}</Text>
              </View>
              <View style={[techCardPdfStyles.cell, techCardPdfStyles.qtyCell]}>
                <Text>{formatIngredientQuantity(row)}</Text>
              </View>
              <View style={[techCardPdfStyles.cell, techCardPdfStyles.unitCostCell]}>
                <Text>{formatMoney(row?.unit_cost)}</Text>
              </View>
              <View style={[techCardPdfStyles.cell, techCardPdfStyles.processingCell]}>
                <Text>{getProcessingLabel(row)}</Text>
              </View>
              <View
                style={[
                  techCardPdfStyles.cell,
                  techCardPdfStyles.totalCell,
                  techCardPdfStyles.lastCell,
                ]}
              >
                <Text>{formatMoney(getIngredientCost(row))}</Text>
              </View>
            </View>
          ))
        )}

        <View style={[techCardPdfStyles.row, techCardPdfStyles.totalRow]}>
          <View
            style={[
              techCardPdfStyles.cell,
              techCardPdfStyles.ingredientCell,
              { width: "65%" },
            ]}
          >
            <Text style={techCardPdfStyles.totalText}>Итого себестоимость</Text>
          </View>
          <View
            style={[
              techCardPdfStyles.cell,
              techCardPdfStyles.totalCell,
              techCardPdfStyles.lastCell,
              { width: "35%" },
            ]}
          >
            <Text style={techCardPdfStyles.totalText}>
              {formatMoney(data?.cost?.cost_price)}
            </Text>
          </View>
        </View>
      </View>

      <Text style={techCardPdfStyles.footer}>
        Документ создан при скачивании PDF и отражает актуальные данные блюда,
        ингредиентов, граммовок и маржи.
      </Text>
    </Page>
  );
}

function TechCardPdfDocument({ data }) {
  const generatedAt = new Intl.DateTimeFormat("ru-RU").format(new Date());
  return (
    <Document>
      <TechCardPdfPage data={data} generatedAt={generatedAt} />
    </Document>
  );
}

function TechCardsPdfDocument({ items = [] }) {
  const generatedAt = new Intl.DateTimeFormat("ru-RU").format(new Date());
  const list = Array.isArray(items) ? items : [];
  return (
    <Document>
      {list.map((data, idx) => (
        <TechCardPdfPage
          key={`${data?.id || "dish"}-${idx}`}
          data={data}
          generatedAt={generatedAt}
        />
      ))}
    </Document>
  );
}

const emptyPreparation = {
  name: "",
  source_product: "",
  input_quantity: "",
  input_unit: "kg",
  output_quantity: "",
  output_unit: "kg",
  processing_cost: "",
  stock_quantity: "0",
  is_active: true,
};
const emptyPreparationProcessing = {
  id: "",
  name: "",
  cost: "",
  charge_type: "fixed",
  unit: "",
};
const emptyReceiveForm = {
  input_quantity: "",
  output_quantity: "",
  processing_cost: "",
};

const emptyPreviewIngredient = {
  ingredient_type: "product",
  product: "",
  preparation: "",
  quantity: "",
  unit: "g",
  processing_type_ids: [],
};

export default function CafeCosting() {
  const navigate = useNavigate();
  const { preparationId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const alert = useAlert();
  const confirm = useConfirm();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [warehouseProducts, setWarehouseProducts] = useState([]);
  const [preparations, setPreparations] = useState([]);
  const [processingTypes, setProcessingTypes] = useState([]);
  const [techCards, setTechCards] = useState([]);
  const [techCardCosts, setTechCardCosts] = useState({});
  const [techCardDetails, setTechCardDetails] = useState({});
  const [selectedTechCardId, setSelectedTechCardId] = useState("");

  const [dishId, setDishId] = useState("");
  const [dishCost, setDishCost] = useState(null);
  const [dishIngredients, setDishIngredients] = useState([]);
  const [editingIngredientId, setEditingIngredientId] = useState("");
  const [editIngredientForm, setEditIngredientForm] = useState({
    ingredient_type: "product",
    product: "",
    preparation: "",
    quantity: "",
    unit: "g",
  });
  const [pdfDownloading, setPdfDownloading] = useState(false);
  const [pdfAllDownloading, setPdfAllDownloading] = useState(false);
  const [menuCategories, setMenuCategories] = useState([]);
  const [techCardsPickerOpen, setTechCardsPickerOpen] = useState(false);
  const [techCardsPickerSelectedIds, setTechCardsPickerSelectedIds] = useState(
    () => new Set(),
  );
  const [pickerMenuItems, setPickerMenuItems] = useState([]);
  const [pickerMenuItemsLoading, setPickerMenuItemsLoading] = useState(false);
  const [pickerCategoryFilter, setPickerCategoryFilter] = useState("");
  const debouncedPickerCategoryFilter = useDebouncedValue(pickerCategoryFilter, 300);
  const techCardsMenuRequestIdRef = useRef(0);
  const pickerMenuRequestIdRef = useRef(0);
  const prevTechCardSearchRef = useRef("");
  const [techCardsListCount, setTechCardsListCount] = useState(0);
  const [techCardsListNext, setTechCardsListNext] = useState(null);
  const [techCardsListPrevious, setTechCardsListPrevious] = useState(null);
  const [ingredientForm, setIngredientForm] = useState({
    ingredient_type: "product",
    product: "",
    preparation: "",
    quantity: "",
    unit: "g",
  });

  const [prepModalOpen, setPrepModalOpen] = useState(false);
  const [prepEditingId, setPrepEditingId] = useState("");
  const [prepForm, setPrepForm] = useState(emptyPreparation);
  const [prepProcessings, setPrepProcessings] = useState([]);
  const [prepProcessingModalOpen, setPrepProcessingModalOpen] = useState(false);
  const [prepProcessingEditIdx, setPrepProcessingEditIdx] = useState(-1);
  const [prepProcessingForm, setPrepProcessingForm] = useState({
    name: "",
    cost: "",
    charge_type: "fixed",
    unit: "",
  });
  const [detailPreparation, setDetailPreparation] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailProcessingModalOpen, setDetailProcessingModalOpen] = useState(false);
  const [detailProcessingEditIdx, setDetailProcessingEditIdx] = useState(-1);
  const [detailProcessingForm, setDetailProcessingForm] = useState({
    name: "",
    cost: "",
    charge_type: "fixed",
    unit: "",
  });
  const [receiveModalOpen, setReceiveModalOpen] = useState(false);
  const [receivePreparationId, setReceivePreparationId] = useState("");
  const [receivePreparationName, setReceivePreparationName] = useState("");
  const [receiveForm, setReceiveForm] = useState(emptyReceiveForm);

  const [previewForm, setPreviewForm] = useState({
    sale_price: "",
    other_expenses: "0",
    ingredients: [emptyPreviewIngredient],
  });
  const [previewResult, setPreviewResult] = useState(null);
  const activeTab = useMemo(() => {
    const raw = String(searchParams.get("tab") || "").trim().toLowerCase();
    return raw === "techcards" || raw === "preview" || raw === "preparations"
      ? raw
      : "preparations";
  }, [searchParams]);
  const setActiveTab = useCallback(
    (tab) => {
      const next = String(tab || "").trim();
      setSearchParams(
        (prev) => {
          const sp = new URLSearchParams(prev);
          if (next) sp.set("tab", next);
          else sp.delete("tab");
          return sp;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );
  const [preparationsViewMode, setPreparationsViewMode] = useState("cards");
  const [preparationSearch, setPreparationSearch] = useState("");

  const techCardPickerSearch = String(
    searchParams.get(TECHCARD_PICKER_SEARCH_PARAM) || "",
  );
  const debouncedTechCardPickerSearch = useDebouncedValue(techCardPickerSearch, 400);
  const techCardPickerCategory = String(
    searchParams.get(TECHCARD_PICKER_CATEGORY_PARAM) || "",
  );
  const techCardListPage = useMemo(() => {
    const page = parseInt(searchParams.get(TECHCARD_LIST_PAGE_PARAM) || "1", 10);
    return Number.isFinite(page) && page > 0 ? page : 1;
  }, [searchParams]);
  const debouncedPreparationSearch = useDebouncedValue(preparationSearch, 400);

  const setTechCardPickerSearch = useCallback(
    (value) => {
      setSearchParams(
        (prev) => {
          const sp = new URLSearchParams(prev);
          const next = String(value || "").trim();
          if (next) sp.set(TECHCARD_PICKER_SEARCH_PARAM, next);
          else sp.delete(TECHCARD_PICKER_SEARCH_PARAM);
          return sp;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  const setTechCardPickerCategory = useCallback(
    (value) => {
      setSearchParams(
        (prev) => {
          const sp = new URLSearchParams(prev);
          const next = String(value || "").trim();
          if (next) sp.set(TECHCARD_PICKER_CATEGORY_PARAM, next);
          else sp.delete(TECHCARD_PICKER_CATEGORY_PARAM);
          return sp;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  const applyTechCardsFromItems = useCallback((items, { replace = true } = {}) => {
    const list = [];
    const details = {};
    const costs = {};
    (Array.isArray(items) ? items : []).forEach((item) => {
      const normalized = normalizeTechCardBulkItem(item);
      if (!normalized) return;
      list.push(normalized.listRow);
      details[normalized.id] = normalized.detail;
      costs[normalized.id] = normalized.cost;
    });

    if (replace) {
      setTechCards(list);
      setTechCardDetails(details);
      setTechCardCosts(costs);
      return;
    }

    setTechCards((prev) => {
      const map = new Map(prev.map((row) => [String(row?.id || ""), row]));
      list.forEach((row) => map.set(String(row.id), row));
      return [...map.values()];
    });
    setTechCardDetails((prev) => ({ ...prev, ...details }));
    setTechCardCosts((prev) => ({ ...prev, ...costs }));
  }, []);

  const fetchMenuItemsList = useCallback(
    async ({ page = 1, search = "", category = "", signal } = {}) => {
      const { data } = await api.get("/cafe/menu-items/", {
        params: {
          page,
          search: search || "",
          ...(category ? { category } : {}),
        },
        signal,
      });
      const payload = data || {};
      const results = Array.isArray(payload?.results)
        ? payload.results
        : listFrom({ data: payload?.results || payload });
      return {
        results,
        count: payload?.count ?? results.length,
        next: payload?.next ?? null,
        previous: payload?.previous ?? null,
      };
    },
    [],
  );

  const syncMenuItemsToTechCards = useCallback((rows, { replace = true } = {}) => {
    const list = Array.isArray(rows) ? rows : [];
    const details = {};
    const costs = {};
    list.forEach((item) => {
      const id = String(item?.id || "");
      if (!id) return;
      details[id] = {
        ...item,
        ingredients: normalizeIngredientRows(getIngredientRowsFromDetail(item)),
      };
      costs[id] = getMenuItemListCost(item);
    });

    if (replace) {
      setTechCards(list);
      setTechCardDetails(details);
      setTechCardCosts(costs);
      return;
    }

    setTechCards((prev) => {
      const map = new Map(prev.map((row) => [String(row?.id || ""), row]));
      list.forEach((row) => {
        const id = String(row?.id || "");
        if (id) map.set(id, row);
      });
      return [...map.values()];
    });
    setTechCardDetails((prev) => ({ ...prev, ...details }));
  }, []);

  const fetchTechCardsBulk = useCallback(
    async ({ dishIds, isAll = false, search = "", categoryId = "" } = {}) => {
      if (!isAll && (!Array.isArray(dishIds) || dishIds.length === 0)) {
        return [];
      }
      const { data } = await api.post("/cafe/tech-cards/export/", {
        dish_ids: isAll ? [] : dishIds,
        is_all: Boolean(isAll),
        search: isAll ? search || "" : undefined,
        category_id: isAll ? categoryId || null : undefined,
      });
      return techCardItemsFromResponse(data);
    },
    [],
  );

  const refreshTechCardById = useCallback(
    async (id) => {
      const techCardId = String(id || dishId || "").trim();
      if (!techCardId) return null;
      const items = await fetchTechCardsBulk({ dishIds: [techCardId] });
      if (!items.length) return null;
      applyTechCardsFromItems(items, { replace: false });
      const normalized = normalizeTechCardBulkItem(items[0]);
      if (!normalized) return null;
      setDishId(techCardId);
      setDishCost(normalized.cost);
      setDishIngredients(normalized.detail.ingredients || []);
      return normalized;
    },
    [applyTechCardsFromItems, dishId, fetchTechCardsBulk],
  );

  const loadTechCardDetail = async (id) => {
    const techCardId = String(id || "").trim();
    if (!techCardId) return null;
    const refreshed = await refreshTechCardById(techCardId);
    if (!refreshed) return null;
    return { detail: refreshed.detail, cost: refreshed.cost };
  };

  const loadTechCardsMenuList = useCallback(
    async ({ page = 1, search = "", category = "", signal } = {}) => {
      const requestId = ++techCardsMenuRequestIdRef.current;
      const { results, count, next, previous } = await fetchMenuItemsList({
        page,
        search,
        category,
        signal,
      });
      if (requestId !== techCardsMenuRequestIdRef.current) return results;
      syncMenuItemsToTechCards(results);
      setTechCardsListCount(count);
      setTechCardsListNext(next);
      setTechCardsListPrevious(previous);
      return results;
    },
    [fetchMenuItemsList, syncMenuItemsToTechCards],
  );

  const setTechCardListPage = useCallback(
    (page) => {
      const nextPage = Math.max(1, Number(page) || 1);
      setSearchParams(
        (prev) => {
          const sp = new URLSearchParams(prev);
          if (nextPage > 1) sp.set(TECHCARD_LIST_PAGE_PARAM, String(nextPage));
          else sp.delete(TECHCARD_LIST_PAGE_PARAM);
          return sp;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  const loadAll = async () => {
    try {
      setLoading(true);
      const [productsRes, prepRes, procRes, categoriesRes] = await Promise.all([
        api.get("/cafe/warehouse/"),
        api.get("/cafe/preparations/"),
        api.get("/cafe/processing-types/"),
        api.get("/cafe/categories/"),
      ]);
      setWarehouseProducts(Array.isArray(listFrom(productsRes)) ? listFrom(productsRes) : []);
      setPreparations(Array.isArray(listFrom(prepRes)) ? listFrom(prepRes) : []);
      setProcessingTypes(Array.isArray(listFrom(procRes)) ? listFrom(procRes) : []);
      setMenuCategories(
        Array.isArray(listFrom(categoriesRes)) ? listFrom(categoriesRes) : [],
      );
      await loadTechCardsMenuList({ page: techCardListPage, search: "" });
    } catch (error) {
      alert(validateResErrors(error, "Ошибка загрузки данных себестоимости"), true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadAll();
  }, []);

  useEffect(() => {
    if (activeTab !== "techcards") return undefined;

    if (prevTechCardSearchRef.current !== debouncedPreparationSearch) {
      prevTechCardSearchRef.current = debouncedPreparationSearch;
      if (techCardListPage > 1) {
        setTechCardListPage(1);
        return undefined;
      }
    }

    const controller = new AbortController();
    (async () => {
      try {
        await loadTechCardsMenuList({
          page: techCardListPage,
          search: debouncedPreparationSearch,
          category: "",
          signal: controller.signal,
        });
      } catch (error) {
        if (controller.signal.aborted) return;
        alert(validateResErrors(error, "Ошибка загрузки списка техкарт"), true);
      }
    })();

    return () => {
      controller.abort();
    };
  }, [activeTab, debouncedPreparationSearch, loadTechCardsMenuList, techCardListPage]);

  useEffect(() => {
    if (!techCardsPickerOpen) return undefined;

    const controller = new AbortController();
    const requestId = ++pickerMenuRequestIdRef.current;

    (async () => {
      try {
        setPickerMenuItemsLoading(true);
        const { results } = await fetchMenuItemsList({
          page: 1,
          search: debouncedTechCardPickerSearch,
          category: debouncedPickerCategoryFilter,
          signal: controller.signal,
        });
        if (requestId !== pickerMenuRequestIdRef.current) return;
        setPickerMenuItems(results);
      } catch (error) {
        if (controller.signal.aborted) return;
        setPickerMenuItems([]);
        alert(validateResErrors(error, "Ошибка загрузки списка блюд"), true);
      } finally {
        if (requestId === pickerMenuRequestIdRef.current) {
          setPickerMenuItemsLoading(false);
        }
      }
    })();

    return () => {
      controller.abort();
    };
  }, [
    debouncedPickerCategoryFilter,
    debouncedTechCardPickerSearch,
    fetchMenuItemsList,
    techCardsPickerOpen,
  ]);

  useEffect(() => {
    if (!preparationId) {
      setDetailPreparation(null);
      return;
    }
    let mounted = true;
    (async () => {
      try {
        setDetailLoading(true);
        const res = await api.get(`/cafe/preparations/${encodeURIComponent(preparationId)}/`);
        if (mounted) setDetailPreparation(res?.data || null);
      } catch (error) {
        if (mounted) {
          setDetailPreparation(null);
          alert(validateResErrors(error, "Ошибка загрузки заготовки"), true);
        }
      } finally {
        if (mounted) setDetailLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [preparationId]);

  const productOptions = useMemo(
    () =>
      warehouseProducts.map((p) => ({
        id: String(p.id || ""),
        label: p.title || p.name || p.code || "Товар",
      })),
    [warehouseProducts],
  );

  const preparationOptions = useMemo(
    () =>
      preparations.map((p) => ({
        id: String(p.id || ""),
        label: p.name || "Заготовка",
      })),
    [preparations],
  );

  const filteredPreparations = useMemo(() => {
    const q = preparationSearch.trim().toLowerCase();
    return preparations.filter((item) => {
      const matchesSearch =
        !q ||
        String(item?.name || "").toLowerCase().includes(q) ||
        String(item?.source_product_name || item?.source_product_title || "")
          .toLowerCase()
          .includes(q);
      return matchesSearch;
    });
  }, [preparationSearch, preparations]);

  const preparationStats = useMemo(() => {
    const totalStock = preparations.reduce(
      (sum, item) => sum + (Number(item?.stock_quantity) || 0),
      0,
    );
    const totalCost = preparations.reduce(
      (sum, item) => sum + (Number(item?.unit_cost) || 0),
      0,
    );
    const activeCount = preparations.filter((item) => item?.is_active !== false).length;
    const avgUnitCost = preparations.length ? totalCost / preparations.length : 0;
    return {
      total: preparations.length,
      active: activeCount,
      totalStock,
      avgUnitCost,
    };
  }, [preparations]);

  const filteredTechCards = useMemo(() => techCards, [techCards]);

  const techCardStats = useMemo(() => {
    const costValues = techCards
      .map((item) => Number(getTechCardCostForDisplay(item, techCardCosts)?.cost_price))
      .filter((value) => Number.isFinite(value));
    const marginValues = techCards
      .map((item) =>
        Number(getTechCardCostForDisplay(item, techCardCosts)?.margin_percent),
      )
      .filter((value) => Number.isFinite(value));
    const avgCost = costValues.length
      ? costValues.reduce((sum, value) => sum + value, 0) / costValues.length
      : 0;
    const avgMargin = marginValues.length
      ? marginValues.reduce((sum, value) => sum + value, 0) / marginValues.length
      : 0;
    return {
      total: techCards.length,
      active: techCards.filter((item) => {
        const detail = techCardDetails[String(item?.id)] || {};
        return (detail?.is_active ?? item?.is_active) !== false;
      }).length,
      avgCost,
      avgMargin,
    };
  }, [techCardCosts, techCardDetails, techCards]);

  const getTechCardIngredients = (item) => {
    const detail = techCardDetails[String(item?.id)] || {};
    const rows =
      detail.ingredients ||
      detail.dish_ingredients ||
      item.ingredients ||
      item.dish_ingredients ||
      [];
    return normalizeIngredientRows(rows);
  };

  const mapMenuItemToPickerCard = useCallback(
    (item) => {
      const id = String(item?.id || "");
      const detail = techCardDetails[id] || {};
      const merged = { ...item, ...detail, id };
      return {
        ...merged,
        title: merged?.title || merged?.name || "Блюдо",
        category_title:
          merged?.category_title ||
          merged?.category_name ||
          menuCategories.find(
            (cat) => String(cat?.id) === String(merged?.category ?? merged?.category_id),
          )?.title ||
          "",
        category_id: merged?.category ?? merged?.category_id ?? "",
        image_url: merged?.image_url || merged?.image || "",
        ingredients_count: getTechCardIngredients(merged).length,
      };
    },
    [menuCategories, techCardDetails],
  );

  const pickerModalDishes = useMemo(
    () => pickerMenuItems.map(mapMenuItemToPickerCard),
    [mapMenuItemToPickerCard, pickerMenuItems],
  );

  const isAllPickerDishesSelected = useMemo(() => {
    const ids = pickerModalDishes
      .map((item) => String(item?.id || ""))
      .filter(Boolean);
    return (
      ids.length > 0 && ids.every((id) => techCardsPickerSelectedIds.has(id))
    );
  }, [pickerModalDishes, techCardsPickerSelectedIds]);

  const getIngredientOptionId = (value) => {
    if (!value) return "";
    if (typeof value === "object") return String(value?.id || "");
    return String(value);
  };

  const buildIngredientFormFromRow = (row) => ({
    ingredient_type: row?.ingredient_type === "preparation" ? "preparation" : "product",
    product: getIngredientOptionId(row?.product || row?.product_id),
    preparation: getIngredientOptionId(row?.preparation || row?.preparation_id),
    quantity: String(row?.quantity ?? ""),
    unit: row?.unit || "g",
  });

  const buildIngredientPayload = (form) => ({
    ingredient_type: form.ingredient_type,
    quantity: form.quantity || "0",
    unit: form.unit || "g",
    ...(form.ingredient_type === "product"
      ? { product: form.product || null }
      : { preparation: form.preparation || null }),
  });

  const handleLoadDishCost = async () => {
    const id = String(dishId || "").trim();
    if (!id) {
      alert("Введите dish_id", true);
      return;
    }
    try {
      await refreshTechCardById(id);
    } catch (error) {
      setDishCost(null);
      alert(validateResErrors(error, "Ошибка получения себестоимости блюда"), true);
    }
  };

  const handleAddDishIngredient = async () => {
    const id = String(dishId || "").trim();
    if (!id) {
      alert("Введите dish_id", true);
      return;
    }
    try {
      const payload = buildIngredientPayload(ingredientForm);
      await api.post(`/cafe/dishes/${encodeURIComponent(id)}/ingredients/`, payload);
      setIngredientForm({
        ingredient_type: "product",
        product: "",
        preparation: "",
        quantity: "",
        unit: "g",
      });
      await refreshTechCardById(id);
    } catch (error) {
      alert(validateResErrors(error, "Ошибка добавления ингредиента"), true);
    }
  };

  const startEditDishIngredient = (row) => {
    const id = String(row?.id || "");
    if (!id) return;
    setEditingIngredientId(id);
    setEditIngredientForm(buildIngredientFormFromRow(row));
  };

  const cancelEditDishIngredient = () => {
    setEditingIngredientId("");
    setEditIngredientForm({
      ingredient_type: "product",
      product: "",
      preparation: "",
      quantity: "",
      unit: "g",
    });
  };

  const handleUpdateDishIngredient = async () => {
    const id = String(editingIngredientId || "").trim();
    if (!id) return;
    try {
      await api.patch(
        `/cafe/dish-ingredients/${encodeURIComponent(id)}/`,
        buildIngredientPayload(editIngredientForm),
      );
      cancelEditDishIngredient();
      await refreshTechCardById(dishId);
    } catch (error) {
      alert(validateResErrors(error, "Ошибка изменения ингредиента"), true);
    }
  };

  const handleDownloadTechCardPdf = async ({ detail, cost, rows }) => {
    try {
      setPdfDownloading(true);
      const techCardId = String(detail?.id || selectedTechCardId || dishId || "").trim();
      let pdfDetail = detail || {};
      let pdfCost = cost || {};
      let pdfRows = normalizeIngredientRows(rows);

      if (techCardId) {
        const items = await fetchTechCardsBulk({ dishIds: [techCardId] });
        const normalized = items.length ? normalizeTechCardBulkItem(items[0]) : null;
        if (normalized) {
          pdfDetail = normalized.detail;
          pdfCost = normalized.cost || pdfCost;
          pdfRows = normalized.detail.ingredients || pdfRows;
          applyTechCardsFromItems(items, { replace: false });
        }
      }

      const pdfData = buildTechCardPdfData({
        detail: pdfDetail,
        cost: pdfCost,
        rows: pdfRows,
      });
      const blob = await pdf(
        <TechCardPdfDocument data={pdfData} />,
      ).toBlob();
      downloadBlob(blob, `tech_card_${safeFilename(pdfData.title || techCardId)}.pdf`);
    } catch (error) {
      alert(validateResErrors(error, "Ошибка скачивания PDF техкарты"), true);
    } finally {
      setPdfDownloading(false);
    }
  };

  const fetchTechCardPdfItems = async ({
    dishIds = [],
    isAll = false,
    search = "",
    categoryId = "",
  }) => {
    const items = await fetchTechCardsBulk({
      dishIds,
      isAll,
      search,
      categoryId,
    });
    return items.map(mapExportItemToPdfData);
  };

  const handlePickerCategoryChange = useCallback((value) => {
    setPickerCategoryFilter(String(value || "").trim());
  }, []);

  const openTechCardsPicker = () => {
    setPickerCategoryFilter(techCardPickerCategory);
    setTechCardsPickerSelectedIds(new Set());
    setTechCardsPickerOpen(true);
  };

  const closeTechCardsPicker = () => {
    setTechCardPickerCategory(pickerCategoryFilter);
    setTechCardsPickerOpen(false);
  };

  const toggleTechCardPickerDish = (id) => {
    const key = String(id || "").trim();
    if (!key) return;
    setTechCardsPickerSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const toggleTechCardPickerSelectAll = () => {
    const ids = pickerModalDishes
      .map((item) => String(item?.id || ""))
      .filter(Boolean);
    setTechCardsPickerSelectedIds((prev) => {
      const allSelected = ids.length > 0 && ids.every((id) => prev.has(id));
      if (allSelected) return new Set();
      return new Set(ids);
    });
  };

  const handleDownloadSelectedTechCardsPdf = async () => {
    const selectedIds = [...techCardsPickerSelectedIds];
    if (selectedIds.length === 0) {
      alert("Выберите хотя бы одно блюдо", true);
      return;
    }

    const filteredIds = pickerModalDishes
      .map((item) => String(item?.id || ""))
      .filter(Boolean);
    const useIsAll =
      filteredIds.length > 0 &&
      filteredIds.every((id) => techCardsPickerSelectedIds.has(id)) &&
      selectedIds.length === filteredIds.length;

    try {
      setPdfAllDownloading(true);
      const idsForRequest = useIsAll ? filteredIds : selectedIds;
      const items = await fetchTechCardPdfItems({
        dishIds: idsForRequest,
        isAll: useIsAll,
        search: debouncedTechCardPickerSearch,
        categoryId: pickerCategoryFilter,
      });

      if (items.length === 0) {
        alert("Не удалось сформировать PDF: данные техкарт не получены", true);
        return;
      }

      const blob = await pdf(<TechCardsPdfDocument items={items} />).toBlob();
      downloadBlob(
        blob,
        `tech_cards_${new Intl.DateTimeFormat("ru-RU").format(new Date())}.pdf`,
      );
      closeTechCardsPicker();
    } catch (error) {
      alert(validateResErrors(error, "Ошибка скачивания PDF техкарт"), true);
    } finally {
      setPdfAllDownloading(false);
    }
  };

  const handleDeleteDishIngredient = async (id) => {
    if (!id) return;
    confirm("Удалить ингредиент?", async (ok) => {
      if (!ok) return;
      try {
        await api.delete(`/cafe/dish-ingredients/${encodeURIComponent(id)}/`);
        await refreshTechCardById(dishId);
      } catch (error) {
        alert(validateResErrors(error, "Ошибка удаления ингредиента"), true);
      }
    });
  };

  const openCreatePreparation = () => {
    setPrepEditingId("");
    setPrepForm(emptyPreparation);
    setPrepProcessings([]);
    setPrepModalOpen(true);
  };

  const openEditPreparation = (row) => {
    setPrepEditingId(String(row?.id || ""));
    setPrepForm({
      name: row?.name || "",
      source_product: String(row?.source_product || ""),
      input_quantity: String(row?.input_quantity || ""),
      input_unit: row?.input_unit || "kg",
      output_quantity: String(row?.output_quantity || ""),
      output_unit: row?.output_unit || "kg",
      processing_cost: String(row?.processing_cost || "0"),
      stock_quantity: String(row?.stock_quantity || "0"),
      is_active: Boolean(row?.is_active),
    });
    setPrepProcessings(
      (Array.isArray(row?.processings) ? row.processings : []).map((it) => ({
        id: String(it?.id || ""),
        name: String(it?.name || ""),
        cost: String(it?.cost || ""),
        charge_type: it?.charge_type === "per_unit" ? "per_unit" : "fixed",
        unit: String(it?.unit || ""),
      })),
    );
    setPrepModalOpen(true);
  };

  const openCreatePrepProcessingModal = () => {
    setPrepProcessingEditIdx(-1);
    setPrepProcessingForm({ name: "", cost: "", charge_type: "fixed", unit: "" });
    setPrepProcessingModalOpen(true);
  };

  const openEditPrepProcessingModal = (idx, row) => {
    setPrepProcessingEditIdx(idx);
    setPrepProcessingForm({
      name: String(row?.name || ""),
      cost: String(row?.cost || ""),
      charge_type: row?.charge_type === "per_unit" ? "per_unit" : "fixed",
      unit: String(row?.unit || ""),
    });
    setPrepProcessingModalOpen(true);
  };

  const savePrepProcessingModal = (e) => {
    e.preventDefault();
    if (!String(prepProcessingForm.name || "").trim()) {
      alert("Введите название обработки", true);
      return;
    }
    const costNum = Number(String(prepProcessingForm.cost || "").replace(",", "."));
    if (!Number.isFinite(costNum) || costNum < 0) {
      alert("Стоимость обработки должна быть >= 0", true);
      return;
    }
    setPrepProcessings((prev) => {
      if (prepProcessingEditIdx >= 0) {
        return prev.map((it, idx) =>
          idx === prepProcessingEditIdx ? { ...it, ...prepProcessingForm } : it,
        );
      }
      return [...prev, { ...emptyPreparationProcessing, ...prepProcessingForm }];
    });
    setPrepProcessingModalOpen(false);
  };

  const removePrepProcessingRow = (idx) => {
    setPrepProcessings((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSavePreparation = async (e) => {
    e.preventDefault();
    try {
      setSaving(true);
      const normalizedProcessings = prepProcessings
        .map((it) => ({
          name: String(it?.name || "").trim(),
          cost: String(it?.cost || "").trim(),
          charge_type: it?.charge_type === "per_unit" ? "per_unit" : "fixed",
          unit: String(it?.unit || "").trim(),
        }))
        .filter((it) => it.name && it.cost !== "");
      const invalidProcessing = normalizedProcessings.some((it) => Number(it.cost) < 0);
      if (invalidProcessing) {
        alert("Стоимость обработки не может быть отрицательной", true);
        setSaving(false);
        return;
      }
      const payload = {
        ...prepForm,
        source_product: prepForm.source_product || null,
        processings: normalizedProcessings,
      };
      if (prepEditingId) {
        await api.patch(`/cafe/preparations/${encodeURIComponent(prepEditingId)}/`, payload);
      } else {
        await api.post("/cafe/preparations/", payload);
      }
      setPrepModalOpen(false);
      await loadAll();
    } catch (error) {
      alert(validateResErrors(error, "Ошибка сохранения заготовки"), true);
    } finally {
      setSaving(false);
    }
  };

  const handleDeletePreparation = async (id) => {
    confirm("Удалить заготовку?", async (ok) => {
      if (!ok) return;
      try {
        await api.delete(`/cafe/preparations/${encodeURIComponent(id)}/`);
        await loadAll();
      } catch (error) {
        alert(validateResErrors(error, "Ошибка удаления заготовки"), true);
      }
    });
  };

  const openReceivePreparation = (row) => {
    setReceivePreparationId(String(row?.id || ""));
    setReceivePreparationName(String(row?.name || "Заготовка"));
    setReceiveForm({
      input_quantity: "",
      output_quantity: "",
      processing_cost: String(row?.processing_cost ?? ""),
    });
    setReceiveModalOpen(true);
  };

  const handleReceivePreparation = async (e) => {
    e.preventDefault();
    const preparationId = String(receivePreparationId || "");
    if (!preparationId) return;

    const inputQ = Number(String(receiveForm.input_quantity || "").replace(",", "."));
    const outputQ = Number(String(receiveForm.output_quantity || "").replace(",", "."));
    const processingCostRaw = String(receiveForm.processing_cost || "").trim();
    const processingCostNum =
      processingCostRaw === "" ? null : Number(processingCostRaw.replace(",", "."));

    if (!Number.isFinite(inputQ) || inputQ <= 0) {
      alert("Входное количество должно быть больше 0", true);
      return;
    }
    if (!Number.isFinite(outputQ) || outputQ <= 0) {
      alert("Выходное количество должно быть больше 0", true);
      return;
    }
    if (outputQ > inputQ) {
      alert("Выходное количество не может быть больше входного", true);
      return;
    }
    if (processingCostNum !== null && (!Number.isFinite(processingCostNum) || processingCostNum < 0)) {
      alert("Стоимость обработки не может быть отрицательной", true);
      return;
    }

    const payload = {
      input_quantity: String(inputQ),
      output_quantity: String(outputQ),
      ...(processingCostNum !== null
        ? { processing_cost: String(processingCostNum) }
        : {}),
    };

    try {
      setSaving(true);
      await api.post(
        `/cafe/preparations/${encodeURIComponent(preparationId)}/receive/`,
        payload,
      );
      setReceiveModalOpen(false);
      await loadAll();
      alert("Приход заготовки успешно выполнен");
    } catch (error) {
      alert(validateResErrors(error, "Ошибка при оприходовании заготовки"), true);
    } finally {
      setSaving(false);
    }
  };

  const openCreateDetailProcessing = () => {
    setDetailProcessingEditIdx(-1);
    setDetailProcessingForm({ name: "", cost: "", charge_type: "fixed", unit: "" });
    setDetailProcessingModalOpen(true);
  };

  const openEditDetailProcessing = (idx, row) => {
    setDetailProcessingEditIdx(idx);
    setDetailProcessingForm({
      name: String(row?.name || ""),
      cost: String(row?.cost || ""),
      charge_type: row?.charge_type === "per_unit" ? "per_unit" : "fixed",
      unit: String(row?.unit || ""),
    });
    setDetailProcessingModalOpen(true);
  };

  const saveDetailProcessings = async (nextRows) => {
    if (!preparationId) return;
    const normalized = (Array.isArray(nextRows) ? nextRows : [])
      .map((it) => ({
        name: String(it?.name || "").trim(),
        cost: String(it?.cost || "").trim(),
        charge_type: it?.charge_type === "per_unit" ? "per_unit" : "fixed",
        unit: String(it?.unit || "").trim(),
      }))
      .filter((it) => it.name && it.cost !== "");
    const invalid = normalized.some((it) => Number(it.cost) < 0);
    if (invalid) {
      alert("Стоимость обработки не может быть отрицательной", true);
      return;
    }
    const { data } = await api.patch(
      `/cafe/preparations/${encodeURIComponent(preparationId)}/`,
      { processings: normalized },
    );
    setDetailPreparation(data || null);
    await loadAll();
  };

  const handleSaveDetailProcessing = async (e) => {
    e.preventDefault();
    if (!detailPreparation) return;
    const currentRows = Array.isArray(detailPreparation?.processings)
      ? detailPreparation.processings
      : [];
    const nextRows =
      detailProcessingEditIdx >= 0
        ? currentRows.map((it, idx) =>
            idx === detailProcessingEditIdx ? { ...it, ...detailProcessingForm } : it,
          )
        : [...currentRows, detailProcessingForm];
    try {
      setSaving(true);
      await saveDetailProcessings(nextRows);
      setDetailProcessingModalOpen(false);
    } catch (error) {
      alert(validateResErrors(error, "Ошибка сохранения обработки заготовки"), true);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteDetailProcessing = async (idx) => {
    if (!detailPreparation) return;
    if (!window.confirm("Удалить обработку?")) return;
    try {
      setSaving(true);
      const currentRows = Array.isArray(detailPreparation?.processings)
        ? detailPreparation.processings
        : [];
      const nextRows = currentRows.filter((_, i) => i !== idx);
      await saveDetailProcessings(nextRows);
    } catch (error) {
      alert(validateResErrors(error, "Ошибка удаления обработки заготовки"), true);
    } finally {
      setSaving(false);
    }
  };

  const updatePreviewIngredient = (idx, patch) => {
    setPreviewForm((prev) => ({
      ...prev,
      ingredients: prev.ingredients.map((it, i) => (i === idx ? { ...it, ...patch } : it)),
    }));
  };

  const addPreviewIngredient = () => {
    setPreviewForm((prev) => ({ ...prev, ingredients: [...prev.ingredients, emptyPreviewIngredient] }));
  };

  const removePreviewIngredient = (idx) => {
    setPreviewForm((prev) => ({
      ...prev,
      ingredients: prev.ingredients.filter((_, i) => i !== idx),
    }));
  };
  const openPreparationDetails = (id) => {
    navigate(`/crm/cafe/costing/preparations/${encodeURIComponent(id)}`);
  };

  const openTechCardDetails = async (item) => {
    const id = String(item?.id || "").trim();
    if (!id) return;
    setSelectedTechCardId(id);
    setDishId(id);
    setIngredientForm({
      ingredient_type: "product",
      product: "",
      preparation: "",
      quantity: "",
      unit: "g",
    });
    const detail = techCardDetails[id] || item;
    setDishIngredients(getTechCardIngredients({ ...item, ...detail, id }));
    setDishCost(techCardCosts[id] || null);
    try {
      await loadTechCardDetail(id);
    } catch (error) {
      alert(validateResErrors(error, "Ошибка загрузки технической карты"), true);
    }
  };

  const handlePreview = async () => {
    try {
      const payload = {
        sale_price: previewForm.sale_price || "0",
        other_expenses: previewForm.other_expenses || "0",
        ingredients: previewForm.ingredients
          .map((it) => ({
            ingredient_type: it.ingredient_type,
            ...(it.ingredient_type === "product"
              ? { product: it.product || null }
              : { preparation: it.preparation || null }),
            quantity: it.quantity || "0",
            unit: it.unit || "g",
            processing_type_ids: Array.isArray(it.processing_type_ids) ? it.processing_type_ids : [],
          }))
          .filter((it) => Number(it.quantity) > 0),
      };
      const { data } = await api.post("/cafe/dishes/calculate-preview/", payload);
      setPreviewResult(data || null);
    } catch (error) {
      setPreviewResult(null);
      alert(validateResErrors(error, "Ошибка расчета предпросмотра"), true);
    }
  };

  const isTechCardDetailOpen = activeTab === "techcards" && Boolean(selectedTechCardId);

  return (
    <div className="cafe-costing-page">
      <DataContainer>
        <div className="cafe-costing-page__card">
          {!isTechCardDetailOpen && (
            <div className="cafe-costing-page__hero">
              <div>
                <span className="cafe-costing-page__eyebrow">Кафе</span>
                <h1 className="cafe-costing-page__title">Заготовки</h1>
                <p className="cafe-costing-page__subtitle">
                  Управление заготовками, обработками и расчетом себестоимости.
                </p>
              </div>
              {activeTab === "techcards" && (
                <button
                  className="cafe-costing-page__btn"
                  type="button"
                  disabled={pdfAllDownloading}
                  onClick={openTechCardsPicker}
                >
                  <Download size={16} />
                  {pdfAllDownloading ? "Скачивание..." : "Скачать техкарты"}
                </button>
              )}
            </div>
          )}

          {!preparationId && !isTechCardDetailOpen && (
            <>
              <div className="cafe-costing-page__stats-grid">
                <div className="cafe-costing-page__stat-card">
                  <span className="cafe-costing-page__stat-icon">
                    <ChefHat size={18} />
                  </span>
                  <span className="cafe-costing-page__stat-label">Заготовки</span>
                  <strong>{formatNumber(preparationStats.total, 0)}</strong>
                  <small>Заготовки и полуфабрикаты</small>
                </div>
                <div className="cafe-costing-page__stat-card cafe-costing-page__stat-card--success">
                  <span className="cafe-costing-page__stat-icon">
                    <PackageCheck size={18} />
                  </span>
                  <span className="cafe-costing-page__stat-label">Техкарты блюд</span>
                  <strong>{formatNumber(techCardStats.total, 0)}</strong>
                  <small>Из раздела меню</small>
                </div>
                <div className="cafe-costing-page__stat-card cafe-costing-page__stat-card--warning">
                  <span className="cafe-costing-page__stat-icon">
                    <Boxes size={18} />
                  </span>
                  <span className="cafe-costing-page__stat-label">Остаток</span>
                  <strong>{formatNumber(preparationStats.totalStock)}</strong>
                  <small>Суммарно по заготовкам</small>
                </div>
                <div className="cafe-costing-page__stat-card cafe-costing-page__stat-card--accent">
                  <span className="cafe-costing-page__stat-icon">
                    <TrendingUp size={18} />
                  </span>
                  <span className="cafe-costing-page__stat-label">Средняя маржа</span>
                  <strong>{formatPercent(techCardStats.avgMargin)}</strong>
                  <small>По техкартам блюд</small>
                </div>
              </div>

              <div className="cafe-costing-page__toolbar">
                <div className="cafe-costing-page__tabs">
                  <button
                    type="button"
                    className={`cafe-costing-page__tab ${activeTab === "preparations" ? "cafe-costing-page__tab--active" : ""}`}
                    onClick={() => setActiveTab("preparations")}
                  >
                    Заготовки
                  </button>
                  <button
                    type="button"
                    className={`cafe-costing-page__tab ${activeTab === "techcards" ? "cafe-costing-page__tab--active" : ""}`}
                    onClick={() => setActiveTab("techcards")}
                  >
                    Технические карты
                  </button>
                  <button
                    type="button"
                    className={`cafe-costing-page__tab ${activeTab === "preview" ? "cafe-costing-page__tab--active" : ""}`}
                    onClick={() => setActiveTab("preview")}
                  >
                    Калькуляция
                  </button>
                </div>
                <label className="cafe-costing-page__search">
                  <Search size={16} />
                  <input
                    value={preparationSearch}
                    onChange={(e) => setPreparationSearch(e.target.value)}
                    placeholder="Поиск по названию или сырью"
                  />
                </label>
              </div>
            </>
          )}

          {loading ? (
            <div className="cafe-costing-page__skeleton-grid">
              {Array.from({ length: 6 }).map((_, idx) => (
                <div key={idx} className="cafe-costing-page__skeleton-card" />
              ))}
            </div>
          ) : (
            <>
              {preparationId ? (
                <section className="cafe-costing-page__section">
                  <div className="cafe-costing-page__editor-header">
                    <div>
                      <button
                        className="cafe-costing-page__ghost-btn"
                        type="button"
                        onClick={() => navigate("/crm/cafe/costing")}
                      >
                        <ArrowLeft size={16} />
                        Назад к списку
                      </button>
                      <span className="cafe-costing-page__eyebrow">Редактор заготовки</span>
                      <h2>
                        {detailLoading
                          ? "Загрузка..."
                          : detailPreparation?.name || "Заготовка"}
                      </h2>
                      <p className="cafe-costing-page__subtitle">
                        Управление обработками, себестоимостью и оприходованием.
                      </p>
                    </div>
                    <div className="cafe-costing-page__editor-actions">
                      <button
                        className="cafe-costing-page__btn cafe-costing-page__btn--secondary"
                        type="button"
                        onClick={openCreateDetailProcessing}
                      >
                        + Обработка
                      </button>
                      <button
                        className="cafe-costing-page__btn cafe-costing-page__btn--dark"
                        type="button"
                        disabled={!detailPreparation}
                        onClick={() => detailPreparation && openReceivePreparation(detailPreparation)}
                      >
                        Оприходовать
                      </button>
                    </div>
                  </div>
                  {detailPreparation && (
                    <div className="cafe-costing-page__summary-grid">
                      <div>
                        <span>Выход</span>
                        <strong>
                          {formatNumber(detailPreparation.output_quantity)}{" "}
                          {detailPreparation.output_unit || ""}
                        </strong>
                      </div>
                      <div>
                        <span>Себестоимость ед.</span>
                        <strong>{formatMoney(detailPreparation.unit_cost)}</strong>
                      </div>
                      <div>
                        <span>Остаток</span>
                        <strong>{formatNumber(detailPreparation.stock_quantity)}</strong>
                      </div>
                      <div>
                        <span>Статус</span>
                        <strong>
                          <span
                            className={`cafe-costing-page__badge ${
                              detailPreparation.is_active === false
                                ? "cafe-costing-page__badge--muted"
                                : "cafe-costing-page__badge--success"
                            }`}
                          >
                            {detailPreparation.is_active === false ? "Архив" : "Активна"}
                          </span>
                        </strong>
                      </div>
                    </div>
                  )}
                  <div className="cafe-costing-page__section-head">
                    <div>
                      <h3>Обработки</h3>
                      <p>Стоимость технологических операций для этой заготовки.</p>
                    </div>
                    <button
                      className="cafe-costing-page__btn"
                      type="button"
                      onClick={openCreateDetailProcessing}
                    >
                      + Добавить обработку
                    </button>
                  </div>
                  <div className="cafe-costing-page__table-wrap">
                    <table className="cafe-costing-page__table">
                      <thead>
                        <tr>
                          <th>Название</th>
                          <th>Ставка</th>
                          <th>Тип</th>
                          <th>Ед.</th>
                          <th />
                        </tr>
                      </thead>
                      <tbody>
                        {(Array.isArray(detailPreparation?.processings)
                          ? detailPreparation.processings
                          : []
                        ).map((p, idx) => (
                          <tr key={String(p?.id || idx)}>
                            <td>{p?.name || "—"}</td>
                            <td>{p?.cost || "0"}</td>
                            <td>{processingChargeTypeLabel(p?.charge_type)}</td>
                            <td>{p?.unit || "—"}</td>
                            <td className="cafe-costing-page__actions">
                              <button
                                type="button"
                                onClick={() => openEditDetailProcessing(idx, p)}
                              >
                                Изм.
                              </button>
                              <button
                                type="button"
                                className="cafe-costing-page__danger-btn"
                                onClick={() => handleDeleteDetailProcessing(idx)}
                                title="Удалить"
                                aria-label="Удалить"
                              >
                                <Trash2 size={14} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              ) : activeTab === "preparations" && (
                <section className="cafe-costing-page__section">
                <div className="cafe-costing-page__section-head">
                  <div>
                    <h2>Заготовки</h2>
                    <p>Технологические карты полуфабрикатов с остатками и себестоимостью за единицу.</p>
                  </div>
                  <div className="cafe-costing-page__section-actions">
                    <div className="cafe-costing-page__view-toggle">
                      <button
                        type="button"
                        className={`cafe-costing-page__view-btn ${
                          preparationsViewMode === "cards"
                            ? "cafe-costing-page__view-btn--active"
                            : ""
                        }`}
                        onClick={() => setPreparationsViewMode("cards")}
                        title="Карточки"
                      >
                        <LayoutGrid size={14} />
                      </button>
                      <button
                        type="button"
                        className={`cafe-costing-page__view-btn ${
                          preparationsViewMode === "list"
                            ? "cafe-costing-page__view-btn--active"
                            : ""
                        }`}
                        onClick={() => setPreparationsViewMode("list")}
                        title="Список"
                      >
                        <List size={14} />
                      </button>
                    </div>
                    <button
                      className="cafe-costing-page__btn cafe-costing-page__btn--dark"
                      onClick={openCreatePreparation}
                      type="button"
                    >
                      <Plus size={16} />
                      Заготовка
                    </button>
                  </div>
                </div>
                {preparationsViewMode === "cards" ? (
                  <div className="cafe-costing-page__prep-grid">
                    {filteredPreparations.length === 0 ? (
                      <div className="cafe-costing-page__empty-state">
                        <ChefHat size={28} />
                        <h3>Заготовки не найдены</h3>
                        <p>Измените поиск или создайте новую технологическую карту.</p>
                      </div>
                    ) : filteredPreparations.map((p) => (
                      <article
                        key={p.id}
                        className="cafe-costing-page__prep-card cafe-costing-page__prep-card--clickable"
                        role="button"
                        tabIndex={0}
                        onClick={() => openPreparationDetails(p.id)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            openPreparationDetails(p.id);
                          }
                        }}
                      >
                        <div className="cafe-costing-page__prep-top">
                          <div>
                            <h3 className="cafe-costing-page__prep-title">{p.name}</h3>
                          </div>
                        </div>
                        <div className="cafe-costing-page__prep-stats">
                          <span>Выход: {formatNumber(p.output_quantity)} {p.output_unit}</span>
                          <span>Себестоимость ед.: {formatMoney(p.unit_cost)}</span>
                          <span>Остаток: {formatNumber(p.stock_quantity)}</span>
                        </div>
                        <div className="cafe-costing-page__actions">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              openReceivePreparation(p);
                            }}
                          >
                            Приход
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              openEditPreparation(p);
                            }}
                          >
                            Изм.
                          </button>
                          <button
                            type="button"
                            className="cafe-costing-page__danger-btn"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeletePreparation(p.id);
                            }}
                            title="Удалить"
                            aria-label="Удалить"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </article>
                    ))}
                  </div>
                ) : (
                  <div className="cafe-costing-page__table-wrap">
                    <table className="cafe-costing-page__table">
                      <thead>
                        <tr>
                          <th>Название</th>
                          <th>Выход</th>
                          <th>Себестоимость ед.</th>
                          <th>Остаток</th>
                          <th />
                        </tr>
                      </thead>
                      <tbody>
                        {filteredPreparations.length === 0 ? (
                          <tr>
                            <td colSpan={5}>
                              <div className="cafe-costing-page__empty">
                                Заготовки не найдены
                              </div>
                            </td>
                          </tr>
                        ) : filteredPreparations.map((p) => (
                          <tr
                            key={p.id}
                            className="cafe-costing-page__table-row--clickable"
                            onClick={() => openPreparationDetails(p.id)}
                          >
                            <td>
                              <div className="cafe-costing-page__table-title">
                                <strong>{p.name}</strong>
                              </div>
                            </td>
                            <td>{formatNumber(p.output_quantity)} {p.output_unit}</td>
                            <td>{formatMoney(p.unit_cost)}</td>
                            <td>{formatNumber(p.stock_quantity)}</td>
                            <td className="cafe-costing-page__actions">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openReceivePreparation(p);
                                }}
                              >
                                Приход
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openEditPreparation(p);
                                }}
                              >
                                Изм.
                              </button>
                              <button
                                type="button"
                                className="cafe-costing-page__danger-btn"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeletePreparation(p.id);
                                }}
                                title="Удалить"
                                aria-label="Удалить"
                              >
                                <Trash2 size={14} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                </section>
              )}

              {activeTab === "techcards" && (
                <section className="cafe-costing-page__section">
                  {selectedTechCardId ? (() => {
                    const selectedItem =
                      techCards.find(
                        (item) => String(item?.id) === String(selectedTechCardId),
                      ) || {};
                    const detail = techCardDetails[selectedTechCardId] || selectedItem;
                    const cost =
                      dishCost ||
                      getTechCardCostForDisplay(
                        { ...selectedItem, id: selectedTechCardId },
                        techCardCosts,
                      );
                    const rows = Array.isArray(dishIngredients) ? dishIngredients : [];
                    return (
                      <>
                        <div className="cafe-costing-page__editor-header cafe-costing-page__editor-header--techcard">
                          <div>
                            <button
                              className="cafe-costing-page__ghost-btn"
                              type="button"
                              onClick={() => setSelectedTechCardId("")}
                            >
                              <ArrowLeft size={16} />
                              Назад к списку
                            </button>
                            <span className="cafe-costing-page__eyebrow">
                              Техническая карта
                            </span>
                            <h2>{detail?.title || "Блюдо"}</h2>
                            <p className="cafe-costing-page__subtitle">
                              Состав, себестоимость, цена продажи и маржа блюда.
                            </p>
                          </div>
                          <div className="cafe-costing-page__editor-actions">
                            <button
                              className="cafe-costing-page__btn"
                              type="button"
                              disabled={pdfDownloading}
                              onClick={() =>
                                handleDownloadTechCardPdf({ detail, cost, rows })
                              }
                            >
                              <Download size={16} />
                              {pdfDownloading ? "Скачивание..." : "Скачать PDF"}
                            </button>
                            <button
                              className="cafe-costing-page__btn cafe-costing-page__btn--secondary"
                              type="button"
                              onClick={() =>
                                navigate(
                                  `/crm/cafe/menu/item/${encodeURIComponent(selectedTechCardId)}`,
                                )
                              }
                            >
                              Редактировать блюдо
                            </button>
                          </div>
                        </div>
                        <div className="cafe-costing-page__summary-grid">
                          <div>
                            <span>Ингредиенты</span>
                            <strong>{formatNumber(rows.length, 0)}</strong>
                          </div>
                          <div>
                            <span>Себестоимость</span>
                            <strong>{formatMoney(cost?.cost_price)}</strong>
                          </div>
                          <div>
                            <span>Цена продажи</span>
                            <strong>{formatMoney(cost?.sale_price ?? detail?.price)}</strong>
                          </div>
                          <div>
                            <span>Маржа</span>
                            <strong>{formatMoney(cost?.margin_amount)}</strong>
                          </div>
                          <div>
                            <span>Маржа %</span>
                            <strong>
                              <span
                                className={`cafe-costing-page__metric-pill ${
                                  Number(cost?.margin_percent) < 0
                                    ? "cafe-costing-page__metric-pill--danger"
                                    : "cafe-costing-page__metric-pill--success"
                                }`}
                              >
                                {formatPercent(cost?.margin_percent)}
                              </span>
                            </strong>
                          </div>
                        </div>

                        <div className="cafe-costing-page__section-head">
                          <div>
                            <h3>Ингредиенты</h3>
                            <p>Добавляйте товары или заготовки и управляйте составом блюда.</p>
                          </div>
                        </div>
                        <div className="cafe-costing-page__table-wrap">
                          <table className="cafe-costing-page__table cafe-costing-page__table--ingredients">
                            <thead>
                              <tr>
                                <th>Тип</th>
                                <th>Ингредиент</th>
                                <th>Количество</th>
                                <th>Ед.</th>
                                <th>Себестоимость ед.</th>
                                <th>Стоимость</th>
                                <th />
                              </tr>
                            </thead>
                            <tbody>
                              {rows.length === 0 ? (
                                <tr>
                                  <td colSpan={7}>
                                    <div className="cafe-costing-page__empty">
                                      Ингредиенты пока не добавлены
                                    </div>
                                  </td>
                                </tr>
                              ) : (
                                rows.map((row, idx) => {
                                  const rowId = String(row?.id || "");
                                  const isEditing = rowId && rowId === editingIngredientId;
                                  return (
                                    <tr key={`${row?.id || "ingredient"}-${idx}`}>
                                      <td>
                                        {isEditing ? (
                                          <select
                                            className="cafe-costing-page__input cafe-costing-page__input--compact"
                                            value={editIngredientForm.ingredient_type}
                                            onChange={(e) =>
                                              setEditIngredientForm((prev) => ({
                                                ...prev,
                                                ingredient_type: e.target.value,
                                                product: "",
                                                preparation: "",
                                              }))
                                            }
                                          >
                                            <option value="product">Товар</option>
                                            <option value="preparation">Заготовка</option>
                                          </select>
                                        ) : (
                                          <span className="cafe-costing-page__badge cafe-costing-page__badge--accent">
                                            {ingredientTypeLabel(row?.ingredient_type, row)}
                                          </span>
                                        )}
                                      </td>
                                      <td>
                                        {isEditing ? (
                                          editIngredientForm.ingredient_type === "product" ? (
                                            <select
                                              className="cafe-costing-page__input cafe-costing-page__input--compact"
                                              value={editIngredientForm.product}
                                              onChange={(e) =>
                                                setEditIngredientForm((prev) => ({
                                                  ...prev,
                                                  product: e.target.value,
                                                }))
                                              }
                                            >
                                              <option value="">Выберите товар</option>
                                              {productOptions.map((opt) => (
                                                <option key={opt.id} value={opt.id}>
                                                  {opt.label}
                                                </option>
                                              ))}
                                            </select>
                                          ) : (
                                            <select
                                              className="cafe-costing-page__input cafe-costing-page__input--compact"
                                              value={editIngredientForm.preparation}
                                              onChange={(e) =>
                                                setEditIngredientForm((prev) => ({
                                                  ...prev,
                                                  preparation: e.target.value,
                                                }))
                                              }
                                            >
                                              <option value="">Выберите заготовку</option>
                                              {preparationOptions.map((opt) => (
                                                <option key={opt.id} value={opt.id}>
                                                  {opt.label}
                                                </option>
                                              ))}
                                            </select>
                                          )
                                        ) : (
                                          row?.product_title ||
                                          row?.product_name ||
                                          row?.preparation_name ||
                                          "Ингредиент"
                                        )}
                                      </td>
                                      <td>
                                        {isEditing ? (
                                          <input
                                            className="cafe-costing-page__input cafe-costing-page__input--compact"
                                            value={editIngredientForm.quantity}
                                            onChange={(e) =>
                                              setEditIngredientForm((prev) => ({
                                                ...prev,
                                                quantity: e.target.value,
                                              }))
                                            }
                                          />
                                        ) : (
                                          formatNumber(row?.quantity)
                                        )}
                                      </td>
                                      <td>
                                        {isEditing ? (
                                          <select
                                            className="cafe-costing-page__input cafe-costing-page__input--compact"
                                            value={editIngredientForm.unit}
                                            onChange={(e) =>
                                              setEditIngredientForm((prev) => ({
                                                ...prev,
                                                unit: e.target.value,
                                              }))
                                            }
                                          >
                                            <option value="kg">кг</option>
                                            <option value="g">г</option>
                                            <option value="l">л</option>
                                            <option value="ml">мл</option>
                                            <option value="pcs">шт</option>
                                          </select>
                                        ) : (
                                          row?.unit || "—"
                                        )}
                                      </td>
                                      <td>{formatMoney(row?.unit_cost)}</td>
                                      <td>{formatMoney(row?.total_cost ?? row?.ingredient_cost)}</td>
                                      <td className="cafe-costing-page__actions">
                                        <div className="cafe-costing-page__ingredient-actions">
                                          {isEditing ? (
                                            <>
                                            <button
                                              type="button"
                                              onClick={handleUpdateDishIngredient}
                                              title="Сохранить"
                                              aria-label="Сохранить"
                                            >
                                              <Save size={14} />
                                            </button>
                                            <button
                                              type="button"
                                              onClick={cancelEditDishIngredient}
                                              title="Отмена"
                                              aria-label="Отмена"
                                            >
                                              <X size={14} />
                                            </button>
                                            </>
                                          ) : (
                                            <>
                                            <button
                                              type="button"
                                              onClick={() => startEditDishIngredient(row)}
                                              disabled={!rowId}
                                              title="Изменить"
                                              aria-label="Изменить"
                                            >
                                              <Pencil size={14} />
                                            </button>
                                            <button
                                              type="button"
                                              className="cafe-costing-page__danger-btn"
                                              onClick={() => handleDeleteDishIngredient(row?.id)}
                                              disabled={!row?.id}
                                              title="Удалить"
                                              aria-label="Удалить"
                                            >
                                              <Trash2 size={14} />
                                            </button>
                                            </>
                                          )}
                                        </div>
                                      </td>
                                    </tr>
                                  );
                                })
                              )}
                            </tbody>
                          </table>
                        </div>

                        <div className="cafe-costing-page__ingredient-editor">
                          <div className="cafe-costing-page__ingredient-editor-head">
                            <div>
                              <span className="cafe-costing-page__eyebrow">
                                Состав блюда
                              </span>
                              <h3>Добавить ингредиент</h3>
                            </div>
                            <p>
                              Выберите товар или заготовку, укажите количество и единицу
                              измерения.
                            </p>
                          </div>
                          <div className="cafe-costing-page__ingredient-editor-grid">
                            <label className="cafe-costing-page__field">
                              <span className="cafe-costing-page__field-label">Тип</span>
                              <select
                                className="cafe-costing-page__input"
                                value={ingredientForm.ingredient_type}
                                onChange={(e) =>
                                  setIngredientForm((prev) => ({
                                    ...prev,
                                    ingredient_type: e.target.value,
                                    product: "",
                                    preparation: "",
                                  }))
                                }
                              >
                                <option value="product">Товар</option>
                                <option value="preparation">Заготовка</option>
                              </select>
                            </label>
                            {ingredientForm.ingredient_type === "product" ? (
                              <label className="cafe-costing-page__field">
                                <span className="cafe-costing-page__field-label">
                                  Товар
                                </span>
                                <select
                                  className="cafe-costing-page__input"
                                  value={ingredientForm.product}
                                  onChange={(e) =>
                                    setIngredientForm((prev) => ({
                                      ...prev,
                                      product: e.target.value,
                                    }))
                                  }
                                >
                                  <option value="">Выберите товар</option>
                                  {productOptions.map((opt) => (
                                    <option key={opt.id} value={opt.id}>
                                      {opt.label}
                                    </option>
                                  ))}
                                </select>
                              </label>
                            ) : (
                              <label className="cafe-costing-page__field">
                                <span className="cafe-costing-page__field-label">
                                  Заготовка
                                </span>
                                <select
                                  className="cafe-costing-page__input"
                                  value={ingredientForm.preparation}
                                  onChange={(e) =>
                                    setIngredientForm((prev) => ({
                                      ...prev,
                                      preparation: e.target.value,
                                    }))
                                  }
                                >
                                  <option value="">Выберите заготовку</option>
                                  {preparationOptions.map((opt) => (
                                    <option key={opt.id} value={opt.id}>
                                      {opt.label}
                                    </option>
                                  ))}
                                </select>
                              </label>
                            )}
                            <label className="cafe-costing-page__field">
                              <span className="cafe-costing-page__field-label">Количество</span>
                              <input
                                className="cafe-costing-page__input"
                                value={ingredientForm.quantity}
                                onChange={(e) =>
                                  setIngredientForm((prev) => ({
                                    ...prev,
                                    quantity: e.target.value,
                                  }))
                                }
                                placeholder="Например: 150"
                              />
                            </label>
                            <label className="cafe-costing-page__field">
                              <span className="cafe-costing-page__field-label">Ед.</span>
                              <select
                                className="cafe-costing-page__input"
                                value={ingredientForm.unit}
                                onChange={(e) =>
                                  setIngredientForm((prev) => ({
                                    ...prev,
                                    unit: e.target.value,
                                  }))
                                }
                              >
                                <option value="kg">кг</option>
                                <option value="g">г</option>
                                <option value="l">л</option>
                                <option value="ml">мл</option>
                                <option value="pcs">шт</option>
                              </select>
                            </label>
                            <button
                              className="cafe-costing-page__btn cafe-costing-page__btn--dark cafe-costing-page__ingredient-editor-submit"
                              type="button"
                              onClick={handleAddDishIngredient}
                            >
                              <Plus size={16} />
                              Добавить
                            </button>
                          </div>
                        </div>
                      </>
                    );
                  })() : (
                    <>
                      <div className="cafe-costing-page__section-head">
                        <div>
                          <h2>Технические карты</h2>
                          <p>
                            Блюда из меню с ингредиентами, себестоимостью, ценой продажи и маржой.
                          </p>
                        </div>
                        <button
                          className="cafe-costing-page__btn cafe-costing-page__btn--dark"
                          type="button"
                          onClick={() => navigate("/crm/cafe/menu/item/new")}
                        >
                          <Plus size={16} />
                          Новое блюдо
                        </button>
                      </div>
                      <div className="cafe-costing-page__table-wrap">
                        <table className="cafe-costing-page__table cafe-costing-page__table--techcards">
                          <thead>
                            <tr>
                              <th>Название</th>
                              <th>Ингредиенты</th>
                              <th>Себестоимость</th>
                              <th>Цена продажи</th>
                              <th>Маржа</th>
                              <th>Маржа %</th>
                            </tr>
                          </thead>
                          <tbody>
                            {filteredTechCards.length === 0 ? (
                              <tr>
                                <td colSpan={6}>
                                  <div className="cafe-costing-page__empty">
                                    Технические карты не найдены
                                  </div>
                                </td>
                              </tr>
                            ) : (
                              filteredTechCards.map((item) => {
                                const id = String(item?.id || "");
                                const detail = techCardDetails[id] || {};
                                const cost = getTechCardCostForDisplay(item, techCardCosts);
                                const ingredients = getTechCardIngredients(item);
                                const isActive =
                                  (detail?.is_active ?? item?.is_active) !== false;
                                return (
                                  <tr
                                    key={id}
                                    className="cafe-costing-page__table-row--clickable"
                                    onClick={() => openTechCardDetails(item)}
                                  >
                                    <td>
                                      <div className="cafe-costing-page__table-title cafe-costing-page__table-title--stack">
                                        <strong>{detail?.title || item?.title || "Блюдо"}</strong>
                                        <span>
                                          <span className="cafe-costing-page__badge cafe-costing-page__badge--accent">
                                            Техкарта
                                          </span>
                                          <span
                                            className={`cafe-costing-page__badge ${
                                              isActive
                                                ? "cafe-costing-page__badge--success"
                                                : "cafe-costing-page__badge--muted"
                                            }`}
                                          >
                                            {isActive ? "Активна" : "Архив"}
                                          </span>
                                        </span>
                                      </div>
                                    </td>
                                    <td>
                                      <div className="cafe-costing-page__ingredient-preview">
                                        <strong>{formatNumber(ingredients.length, 0)}</strong>
                                        <span>
                                          {ingredients
                                            .slice(0, 2)
                                            .map(
                                              (row) =>
                                                row?.product_title ||
                                                row?.product_name ||
                                                row?.preparation_name ||
                                                "Ингредиент",
                                            )
                                            .join(", ") || "Не добавлены"}
                                        </span>
                                      </div>
                                    </td>
                                    <td>{formatMoney(cost?.cost_price)}</td>
                                    <td>{formatMoney(cost?.sale_price ?? detail?.price ?? item?.price)}</td>
                                    <td>{formatMoney(cost?.margin_amount)}</td>
                                    <td>
                                      <span
                                        className={`cafe-costing-page__metric-pill ${
                                          Number(cost?.margin_percent) < 0
                                            ? "cafe-costing-page__metric-pill--danger"
                                            : "cafe-costing-page__metric-pill--success"
                                        }`}
                                      >
                                        {formatPercent(cost?.margin_percent)}
                                      </span>
                                    </td>
                                  </tr>
                                );
                              })
                            )}
                          </tbody>
                        </table>
                      </div>
                      {(techCardsListNext || techCardsListPrevious) && (
                        <div className="cafe-costing-page__techcards-pagination">
                          <button
                            type="button"
                            className="cafe-costing-page__btn cafe-costing-page__btn--secondary"
                            disabled={!techCardsListPrevious}
                            onClick={() => setTechCardListPage(techCardListPage - 1)}
                          >
                            Назад
                          </button>
                          <span>
                            Страница {techCardListPage}
                            {techCardsListCount > 0 ? ` · всего ${techCardsListCount}` : ""}
                          </span>
                          <button
                            type="button"
                            className="cafe-costing-page__btn cafe-costing-page__btn--secondary"
                            disabled={!techCardsListNext}
                            onClick={() => setTechCardListPage(techCardListPage + 1)}
                          >
                            Далее
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </section>
              )}

              {activeTab === "preview" && (
                <section className="cafe-costing-page__section">
                <h2>Предпросмотр расчета</h2>
                <div className="cafe-costing-page__row">
                  <label className="cafe-costing-page__field">
                    <span className="cafe-costing-page__field-label">Цена продажи блюда</span>
                  <input
                    className="cafe-costing-page__input"
                    value={previewForm.sale_price}
                    onChange={(e) => setPreviewForm((prev) => ({ ...prev, sale_price: e.target.value }))}
                    placeholder="Например: 350"
                  />
                  </label>
                  <label className="cafe-costing-page__field">
                    <span className="cafe-costing-page__field-label">Прочие расходы</span>
                  <input
                    className="cafe-costing-page__input"
                    value={previewForm.other_expenses}
                    onChange={(e) =>
                      setPreviewForm((prev) => ({ ...prev, other_expenses: e.target.value }))
                    }
                    placeholder="Например: 25"
                  />
                  </label>
                  <button
                    className="cafe-costing-page__btn cafe-costing-page__btn--small"
                    onClick={addPreviewIngredient}
                    type="button"
                  >
                    + Ингредиент
                  </button>
                </div>
                <div className="cafe-costing-page__ingredients-list">
                  {previewForm.ingredients.map((it, idx) => (
                  <div key={`ing-${idx}`} className="cafe-costing-page__row cafe-costing-page__ingredient-row">
                    <label className="cafe-costing-page__field">
                      <span className="cafe-costing-page__field-label">Тип ингредиента</span>
                      <select
                      className="cafe-costing-page__input"
                      value={it.ingredient_type}
                      onChange={(e) =>
                        updatePreviewIngredient(idx, {
                          ingredient_type: e.target.value,
                          product: "",
                          preparation: "",
                        })
                      }
                    >
                      <option value="product">Товар</option>
                      <option value="preparation">Заготовка</option>
                      </select>
                    </label>
                    {it.ingredient_type === "product" ? (
                      <label className="cafe-costing-page__field">
                        <span className="cafe-costing-page__field-label">Товар со склада</span>
                        <select
                        className="cafe-costing-page__input"
                        value={it.product}
                        onChange={(e) => updatePreviewIngredient(idx, { product: e.target.value })}
                      >
                        <option value="">Товар</option>
                        {productOptions.map((opt) => (
                          <option key={opt.id} value={opt.id}>
                            {opt.label}
                          </option>
                        ))}
                        </select>
                      </label>
                    ) : (
                      <label className="cafe-costing-page__field">
                        <span className="cafe-costing-page__field-label">Заготовка</span>
                        <select
                        className="cafe-costing-page__input"
                        value={it.preparation}
                        onChange={(e) => updatePreviewIngredient(idx, { preparation: e.target.value })}
                      >
                        <option value="">Заготовка</option>
                        {preparationOptions.map((opt) => (
                          <option key={opt.id} value={opt.id}>
                            {opt.label}
                          </option>
                        ))}
                        </select>
                      </label>
                    )}
                    <div className="cafe-costing-page__qty-unit">
                      <label className="cafe-costing-page__field cafe-costing-page__field--qty">
                        <span className="cafe-costing-page__field-label">Количество</span>
                        <input
                          className="cafe-costing-page__input"
                          value={it.quantity}
                          onChange={(e) => updatePreviewIngredient(idx, { quantity: e.target.value })}
                          placeholder="Например: 150"
                        />
                      </label>
                      <label className="cafe-costing-page__field cafe-costing-page__field--unit">
                        <span className="cafe-costing-page__field-label">Ед. изм.</span>
                        <select
                          className="cafe-costing-page__input"
                          value={it.unit}
                          onChange={(e) => updatePreviewIngredient(idx, { unit: e.target.value })}
                        >
                          <option value="kg">кг</option>
                          <option value="g">г</option>
                          <option value="l">л</option>
                          <option value="ml">мл</option>
                          <option value="pcs">шт</option>
                        </select>
                      </label>
                    </div>
                    <button
                      type="button"
                      className="cafe-costing-page__danger-btn cafe-costing-page__ingredient-remove"
                      onClick={() => removePreviewIngredient(idx)}
                      title="Удалить ингредиент"
                      aria-label="Удалить ингредиент"
                    >
                      <X size={12} />
                    </button>
                  </div>
                ))}
                </div>
                <div className="cafe-costing-page__row">
                  <button className="cafe-costing-page__btn" onClick={handlePreview} type="button">
                    Рассчитать предпросмотр
                  </button>
                </div>
                {previewResult && (
                  <div className="cafe-costing-page__stats">
                    <span>Себестоимость: {previewResult.cost_price}</span>
                    <span>Сумма маржи: {previewResult.margin_amount}</span>
                    <span>Маржа (%): {previewResult.margin_percent}</span>
                  </div>
                )}
                </section>
              )}
            </>
          )}
        </div>
      </DataContainer>

      <TechCardsPickerModal
        open={techCardsPickerOpen}
        onClose={closeTechCardsPicker}
        dishes={pickerModalDishes}
        categories={menuCategories}
        searchValue={techCardPickerSearch}
        onSearchChange={setTechCardPickerSearch}
        categoryId={pickerCategoryFilter}
        onCategoryChange={handlePickerCategoryChange}
        selectedIds={techCardsPickerSelectedIds}
        onToggleDish={toggleTechCardPickerDish}
        onToggleSelectAll={toggleTechCardPickerSelectAll}
        isAllFilteredSelected={isAllPickerDishesSelected}
        onDownload={handleDownloadSelectedTechCardsPdf}
        downloading={pdfAllDownloading}
        loadingDishes={pickerMenuItemsLoading}
      />

      {prepModalOpen && (
        <div className="cafe-costing-page__overlay" onClick={() => setPrepModalOpen(false)}>
          <form
            className="cafe-costing-page__modal cafe-costing-page__modal--wide cafe-costing-page__form-modal"
            onClick={(e) => e.stopPropagation()}
            onSubmit={handleSavePreparation}
          >
            <div className="cafe-costing-page__modal-head">
              <div>
                <span className="cafe-costing-page__eyebrow">
                  {prepEditingId ? "Редактирование" : "Создание"}
                </span>
                <h3>{prepEditingId ? "Изменить заготовку" : "Новая заготовка"}</h3>
                <p>
                  Укажите исходное сырье, норму выхода и дополнительные обработки.
                  Эти данные используются для расчета себестоимости.
                </p>
              </div>
              <button
                type="button"
                className="cafe-costing-page__modal-close"
                onClick={() => setPrepModalOpen(false)}
                aria-label="Закрыть"
              >
                <X size={18} />
              </button>
            </div>

            <div className="cafe-costing-page__form-section">
              <div className="cafe-costing-page__form-section-head">
                <strong>Основные данные</strong>
                <span>Название и сырье, из которого готовится заготовка.</span>
              </div>
              <div className="cafe-costing-page__form-grid cafe-costing-page__form-grid--2">
                <label className="cafe-costing-page__field">
                  <span className="cafe-costing-page__field-label">Название заготовки *</span>
                  <input
                    className="cafe-costing-page__input"
                    value={prepForm.name}
                    onChange={(e) =>
                      setPrepForm((prev) => ({ ...prev, name: e.target.value }))
                    }
                    placeholder="Например: Очищенная картошка"
                    required
                  />
                </label>
                <label className="cafe-costing-page__field">
                  <span className="cafe-costing-page__field-label">Исходный товар *</span>
                  <select
                    className="cafe-costing-page__input"
                    value={prepForm.source_product}
                    onChange={(e) =>
                      setPrepForm((prev) => ({ ...prev, source_product: e.target.value }))
                    }
                    required
                  >
                    <option value="">Выберите товар</option>
                    {productOptions.map((opt) => (
                      <option key={opt.id} value={opt.id}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </div>

            <div className="cafe-costing-page__form-section">
              <div className="cafe-costing-page__form-section-head">
                <strong>Норма выхода</strong>
                <span>Сколько сырья уходит и сколько готовой заготовки получается.</span>
              </div>
              <div className="cafe-costing-page__form-grid cafe-costing-page__form-grid--4">
                <label className="cafe-costing-page__field">
                  <span className="cafe-costing-page__field-label">Входное количество *</span>
                  <input
                    className="cafe-costing-page__input"
                    value={prepForm.input_quantity}
                    onChange={(e) =>
                      setPrepForm((prev) => ({ ...prev, input_quantity: e.target.value }))
                    }
                    placeholder="Например: 1"
                    required
                  />
                </label>
                <label className="cafe-costing-page__field">
                  <span className="cafe-costing-page__field-label">Ед. входа</span>
                  <select
                    className="cafe-costing-page__input"
                    value={prepForm.input_unit}
                    onChange={(e) =>
                      setPrepForm((prev) => ({ ...prev, input_unit: e.target.value }))
                    }
                  >
                    <option value="kg">кг</option>
                    <option value="g">г</option>
                    <option value="l">л</option>
                    <option value="ml">мл</option>
                    <option value="pcs">шт</option>
                  </select>
                </label>
                <label className="cafe-costing-page__field">
                  <span className="cafe-costing-page__field-label">Выходное количество *</span>
                  <input
                    className="cafe-costing-page__input"
                    value={prepForm.output_quantity}
                    onChange={(e) =>
                      setPrepForm((prev) => ({ ...prev, output_quantity: e.target.value }))
                    }
                    placeholder="Например: 0.8"
                    required
                  />
                </label>
                <label className="cafe-costing-page__field">
                  <span className="cafe-costing-page__field-label">Ед. выхода</span>
                  <select
                    className="cafe-costing-page__input"
                    value={prepForm.output_unit}
                    onChange={(e) =>
                      setPrepForm((prev) => ({ ...prev, output_unit: e.target.value }))
                    }
                  >
                    <option value="kg">кг</option>
                    <option value="g">г</option>
                    <option value="l">л</option>
                    <option value="ml">мл</option>
                    <option value="pcs">шт</option>
                  </select>
                </label>
              </div>
            </div>

            <div className="cafe-costing-page__form-section">
              <div className="cafe-costing-page__form-section-head">
                <strong>Стоимость и остаток</strong>
                <span>Дополнительные расходы и текущий остаток готовой заготовки.</span>
              </div>
              <div className="cafe-costing-page__form-grid cafe-costing-page__form-grid--2">
                <label className="cafe-costing-page__field">
                  <span className="cafe-costing-page__field-label">Стоимость обработки</span>
                  <input
                    className="cafe-costing-page__input"
                    value={prepForm.processing_cost}
                    onChange={(e) =>
                      setPrepForm((prev) => ({ ...prev, processing_cost: e.target.value }))
                    }
                    placeholder="Например: 10"
                  />
                </label>
                <label className="cafe-costing-page__field">
                  <span className="cafe-costing-page__field-label">Остаток заготовки</span>
                  <input
                    className="cafe-costing-page__input"
                    value={prepForm.stock_quantity}
                    onChange={(e) =>
                      setPrepForm((prev) => ({ ...prev, stock_quantity: e.target.value }))
                    }
                    placeholder="Например: 0"
                  />
                </label>
              </div>
            </div>

            <div className="cafe-costing-page__form-section">
              <div className="cafe-costing-page__form-section-head cafe-costing-page__form-section-head--inline">
                <div>
                  <strong>Обработки заготовки</strong>
                  <span>Мойка, очистка, нарезка и другие операции.</span>
                </div>
                <button
                  type="button"
                  className="cafe-costing-page__btn cafe-costing-page__btn--secondary"
                  onClick={openCreatePrepProcessingModal}
                >
                  <Plus size={16} />
                  Добавить обработку
                </button>
              </div>
              <div className="cafe-costing-page__table-wrap cafe-costing-page__modal-table-wrap">
                {prepProcessings.length === 0 ? (
                  <div className="cafe-costing-page__empty cafe-costing-page__modal-empty">
                    Обработки не добавлены. Можно сохранить заготовку без них.
                  </div>
                ) : (
                  <table className="cafe-costing-page__table">
                    <thead>
                      <tr>
                        <th>Название</th>
                        <th>Ставка</th>
                        <th>Тип</th>
                        <th>Ед.</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {prepProcessings.map((pr, idx) => (
                        <tr key={`prep-proc-${pr.id || "new"}-${idx}`}>
                          <td>{pr.name || "—"}</td>
                          <td>{pr.cost || "0"}</td>
                          <td>{processingChargeTypeLabel(pr.charge_type)}</td>
                          <td>{pr.unit || "—"}</td>
                          <td className="cafe-costing-page__actions">
                            <button
                              type="button"
                              onClick={() => openEditPrepProcessingModal(idx, pr)}
                            >
                              Изм.
                            </button>
                            <button
                              type="button"
                              className="cafe-costing-page__danger-btn"
                              onClick={() => removePrepProcessingRow(idx)}
                              title="Удалить"
                              aria-label="Удалить"
                            >
                              <Trash2 size={14} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>

            <div className="cafe-costing-page__modal-actions">
              <button
                type="button"
                className="cafe-costing-page__btn"
                onClick={() => setPrepModalOpen(false)}
              >
                Отмена
              </button>
              <button
                type="submit"
                className="cafe-costing-page__btn cafe-costing-page__btn--dark"
                disabled={saving}
              >
                {saving ? "Сохранение..." : "Сохранить заготовку"}
              </button>
            </div>
          </form>
        </div>
      )}

      {detailProcessingModalOpen && (
        <div
          className="cafe-costing-page__overlay"
          onClick={() => setDetailProcessingModalOpen(false)}
        >
          <form
            className="cafe-costing-page__modal"
            onClick={(e) => e.stopPropagation()}
            onSubmit={handleSaveDetailProcessing}
          >
            <h3>{detailProcessingEditIdx >= 0 ? "Изменить обработку" : "Новая обработка"}</h3>
            <label className="cafe-costing-page__field">
              <span className="cafe-costing-page__field-label">Название обработки *</span>
              <input
              className="cafe-costing-page__input"
              value={detailProcessingForm.name}
              onChange={(e) =>
                setDetailProcessingForm((prev) => ({ ...prev, name: e.target.value }))
              }
              placeholder="Например: Жарка"
              required
            />
            </label>
            <label className="cafe-costing-page__field">
              <span className="cafe-costing-page__field-label">Стоимость *</span>
              <input
              className="cafe-costing-page__input"
              value={detailProcessingForm.cost}
              onChange={(e) =>
                setDetailProcessingForm((prev) => ({ ...prev, cost: e.target.value }))
              }
              placeholder="Например: 15"
              required
            />
            </label>
            <label className="cafe-costing-page__field">
              <span className="cafe-costing-page__field-label">Тип начисления</span>
              <select
              className="cafe-costing-page__input"
              value={detailProcessingForm.charge_type}
              onChange={(e) =>
                setDetailProcessingForm((prev) => ({ ...prev, charge_type: e.target.value }))
              }
            >
              <option value="fixed">Фиксированно</option>
              <option value="per_unit">За единицу</option>
            </select>
            </label>
            <label className="cafe-costing-page__field">
              <span className="cafe-costing-page__field-label">Единица (необязательно)</span>
              <input
              className="cafe-costing-page__input"
              value={detailProcessingForm.unit}
              onChange={(e) =>
                setDetailProcessingForm((prev) => ({ ...prev, unit: e.target.value }))
              }
              placeholder="Например: g или pcs"
            />
            </label>
            <div className="cafe-costing-page__row">
              <button type="button" onClick={() => setDetailProcessingModalOpen(false)}>
                Отмена
              </button>
              <button type="submit" disabled={saving}>
                {saving ? "Сохранение..." : "Сохранить"}
              </button>
            </div>
          </form>
        </div>
      )}

      {receiveModalOpen && (
        <div className="cafe-costing-page__overlay" onClick={() => setReceiveModalOpen(false)}>
          <form
            className="cafe-costing-page__modal cafe-costing-page__form-modal cafe-costing-page__receive-modal"
            onClick={(e) => e.stopPropagation()}
            onSubmit={handleReceivePreparation}
          >
            <div className="cafe-costing-page__modal-head">
              <div>
                <span className="cafe-costing-page__eyebrow">Оприходование</span>
                <h3>Приход заготовки</h3>
                <p>
                  {receivePreparationName || "Выбранная заготовка"} будет добавлена на
                  остаток после сохранения прихода.
                </p>
              </div>
              <button
                type="button"
                className="cafe-costing-page__modal-close"
                onClick={() => setReceiveModalOpen(false)}
                aria-label="Закрыть"
              >
                <X size={18} />
              </button>
            </div>
            <div className="cafe-costing-page__receive-summary">
              <div>
                <span>Заготовка</span>
                <strong>{receivePreparationName || "—"}</strong>
              </div>
            </div>
            <div className="cafe-costing-page__form-section">
              <div className="cafe-costing-page__form-section-head">
                <strong>Количество и затраты</strong>
                <span>
                  Входное количество — сырье до обработки, выходное — готовый объем.
                </span>
              </div>
              <div className="cafe-costing-page__form-grid cafe-costing-page__form-grid--3">
                <label className="cafe-costing-page__field">
                  <span className="cafe-costing-page__field-label">Входное количество *</span>
                  <input
                    className="cafe-costing-page__input"
                    value={receiveForm.input_quantity}
                    onChange={(e) =>
                      setReceiveForm((prev) => ({ ...prev, input_quantity: e.target.value }))
                    }
                    placeholder="Например: 5.0"
                    required
                  />
                </label>
                <label className="cafe-costing-page__field">
                  <span className="cafe-costing-page__field-label">Выходное количество *</span>
                  <input
                    className="cafe-costing-page__input"
                    value={receiveForm.output_quantity}
                    onChange={(e) =>
                      setReceiveForm((prev) => ({ ...prev, output_quantity: e.target.value }))
                    }
                    placeholder="Например: 4.7"
                    required
                  />
                </label>
                <label className="cafe-costing-page__field">
                  <span className="cafe-costing-page__field-label">Стоимость обработки</span>
                  <input
                    className="cafe-costing-page__input"
                    value={receiveForm.processing_cost}
                    onChange={(e) =>
                      setReceiveForm((prev) => ({ ...prev, processing_cost: e.target.value }))
                    }
                    placeholder="Например: 10.00"
                  />
                </label>
              </div>
            </div>
            <div className="cafe-costing-page__modal-actions">
              <button
                type="button"
                className="cafe-costing-page__btn"
                onClick={() => setReceiveModalOpen(false)}
              >
                Отмена
              </button>
              <button
                type="submit"
                className="cafe-costing-page__btn cafe-costing-page__btn--dark"
                disabled={saving}
              >
                {saving ? "Сохранение..." : "Сделать приход"}
              </button>
            </div>
          </form>
        </div>
      )}

      {prepProcessingModalOpen && (
        <div
          className="cafe-costing-page__overlay"
          onClick={() => setPrepProcessingModalOpen(false)}
        >
          <form
            className="cafe-costing-page__modal"
            onClick={(e) => e.stopPropagation()}
            onSubmit={savePrepProcessingModal}
          >
            <h3>{prepProcessingEditIdx >= 0 ? "Изменить обработку" : "Новая обработка"}</h3>
            <label className="cafe-costing-page__field">
              <span className="cafe-costing-page__field-label">Название обработки *</span>
              <input
                className="cafe-costing-page__input"
                value={prepProcessingForm.name}
                onChange={(e) =>
                  setPrepProcessingForm((prev) => ({ ...prev, name: e.target.value }))
                }
                placeholder="Например: Перемол"
                required
              />
            </label>
            <label className="cafe-costing-page__field">
              <span className="cafe-costing-page__field-label">Ставка *</span>
              <input
                className="cafe-costing-page__input"
                value={prepProcessingForm.cost}
                onChange={(e) =>
                  setPrepProcessingForm((prev) => ({ ...prev, cost: e.target.value }))
                }
                placeholder="Например: 100"
                required
              />
            </label>
            <label className="cafe-costing-page__field">
              <span className="cafe-costing-page__field-label">Тип начисления</span>
              <select
                className="cafe-costing-page__input"
                value={prepProcessingForm.charge_type}
                onChange={(e) =>
                  setPrepProcessingForm((prev) => ({ ...prev, charge_type: e.target.value }))
                }
              >
                <option value="fixed">Фиксированно</option>
                <option value="per_unit">За единицу</option>
              </select>
            </label>
            <label className="cafe-costing-page__field">
              <span className="cafe-costing-page__field-label">Единица (необязательно)</span>
              <input
                className="cafe-costing-page__input"
                value={prepProcessingForm.unit}
                onChange={(e) =>
                  setPrepProcessingForm((prev) => ({ ...prev, unit: e.target.value }))
                }
                placeholder="Например: kg"
              />
            </label>
            <div className="cafe-costing-page__row">
              <button type="button" onClick={() => setPrepProcessingModalOpen(false)}>
                Отмена
              </button>
              <button type="submit">Сохранить</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

