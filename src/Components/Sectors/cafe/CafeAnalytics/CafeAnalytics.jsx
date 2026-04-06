// src/.../CafeAnalytics.jsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  FaChartLine,
  FaSync,
  FaFilter,
  FaBoxOpen,
  FaShoppingCart,
  FaUsers,
  FaDownload,
  FaMoneyBillWave,
  FaBan,
  FaReceipt,
  FaExclamationTriangle,
  FaCoins,
} from "react-icons/fa";
import {
  Chart,
  LineController,
  LineElement,
  PointElement,
  LinearScale,
  CategoryScale,
  Tooltip,
  Filler,
  Legend,
} from "chart.js";
import { pdf, Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import api from "../../../../api";
import { registerPdfFonts } from "../../../../pdf/registerFonts";
import "./CafeAnalytics.scss";
import { CafeAnalyticsModal, CafeAnalyticsModalContent } from "./CafeAnalyticsModals";
import { useUser } from "../../../../store/slices/userSlice";
import { isStartPlan } from "../../../../utils/subscriptionPlan";

Chart.register(
  LineController,
  LineElement,
  PointElement,
  LinearScale,
  CategoryScale,
  Tooltip,
  Filler,
  Legend
);

/* ===== helpers ===== */
const listFrom = (res) => res?.data?.results || res?.data || [];
const asArray = (data) =>
  Array.isArray(data?.results) ? data.results : Array.isArray(data) ? data : [];

const toNum = (v) => {
  if (v == null) return 0;
  const n = Number(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};

const pickCategoryName = (x) =>
  x?.category_name ||
  x?.category?.name ||
  x?.category ||
  x?.name ||
  x?.title ||
  "—";

const fmtInt = (n) =>
  new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 }).format(
    Math.round(Number(n) || 0)
  );

const fmtMoney = (n) =>
  new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 }).format(
    Math.round(Number(n) || 0)
  ) + " сом";

const analyticsPdfStyles = StyleSheet.create({
  page: { padding: 24, fontSize: 10, color: "#0b1220", fontFamily: "Roboto" },
  title: { fontSize: 16, marginBottom: 4, fontWeight: 700 },
  sub: { fontSize: 10, marginBottom: 10, color: "#475569" },
  kpiRow: { flexDirection: "row", gap: 12, marginBottom: 10 },
  kpi: {
    border: "1 solid #e5e7eb",
    borderRadius: 6,
    padding: 8,
    flexGrow: 1,
  },
  kpiLabel: { fontSize: 9, color: "#64748b" },
  kpiVal: { fontSize: 12, marginTop: 2, fontWeight: 700 },
  tableHead: {
    flexDirection: "row",
    backgroundColor: "#f8fafc",
    borderTop: "1 solid #cbd5e1",
    borderLeft: "1 solid #cbd5e1",
    paddingVertical: 0,
    paddingHorizontal: 0,
    fontWeight: 700,
  },
  row: {
    flexDirection: "row",
    borderLeft: "1 solid #e2e8f0",
    paddingVertical: 0,
    paddingHorizontal: 0,
  },
  cTitle: { width: "31%", borderRight: "1 solid #cbd5e1", borderBottom: "1 solid #cbd5e1", padding: 5 },
  cCat: { width: "16%", borderRight: "1 solid #cbd5e1", borderBottom: "1 solid #cbd5e1", padding: 5 },
  cKitchen: { width: "16%", borderRight: "1 solid #cbd5e1", borderBottom: "1 solid #cbd5e1", padding: 5 },
  cPrice: { width: "10%", textAlign: "right", borderRight: "1 solid #cbd5e1", borderBottom: "1 solid #cbd5e1", padding: 5 },
  cQty: { width: "9%", textAlign: "right", borderRight: "1 solid #cbd5e1", borderBottom: "1 solid #cbd5e1", padding: 5 },
  cRevenue: { width: "12%", textAlign: "right", borderRight: "1 solid #cbd5e1", borderBottom: "1 solid #cbd5e1", padding: 5 },
  cAvg: { width: "10%", textAlign: "right", borderRight: "1 solid #cbd5e1", borderBottom: "1 solid #cbd5e1", padding: 5 },
});

const CafeAllMenuPdfDocument = ({ rows = [], periodLabel = "", totals = {} }) => (
  <Document>
    <Page size="A4" style={analyticsPdfStyles.page}>
      <Text style={analyticsPdfStyles.title}>Аналитика блюд</Text>
      <Text style={analyticsPdfStyles.sub}>{periodLabel || "Период не указан"}</Text>

      <View style={analyticsPdfStyles.kpiRow}>
        <View style={analyticsPdfStyles.kpi}>
          <Text style={analyticsPdfStyles.kpiLabel}>Блюд в отчете</Text>
          <Text style={analyticsPdfStyles.kpiVal}>{Math.round(totals.items || 0)}</Text>
        </View>
        <View style={analyticsPdfStyles.kpi}>
          <Text style={analyticsPdfStyles.kpiLabel}>Порций</Text>
          <Text style={analyticsPdfStyles.kpiVal}>{Math.round(totals.qty || 0)}</Text>
        </View>
        <View style={analyticsPdfStyles.kpi}>
          <Text style={analyticsPdfStyles.kpiLabel}>Выручка</Text>
          <Text style={analyticsPdfStyles.kpiVal}>{Math.round(totals.revenue || 0)} сом</Text>
        </View>
      </View>

      <View style={analyticsPdfStyles.tableHead}>
        <Text style={analyticsPdfStyles.cTitle}>Блюдо</Text>
        <Text style={analyticsPdfStyles.cCat}>Категория</Text>
        <Text style={analyticsPdfStyles.cKitchen}>Кухня</Text>
        <Text style={analyticsPdfStyles.cPrice}>Цена</Text>
        <Text style={analyticsPdfStyles.cQty}>Кол-во</Text>
        <Text style={analyticsPdfStyles.cRevenue}>Выручка</Text>
        <Text style={analyticsPdfStyles.cAvg}>Средняя</Text>
      </View>

      {rows.map((x, idx) => (
        <View key={`${x.menu_item_id || "item"}_${idx}`} style={analyticsPdfStyles.row}>
          <Text style={analyticsPdfStyles.cTitle}>{x.title || "—"}</Text>
          <Text style={analyticsPdfStyles.cCat}>{x.category_title || "—"}</Text>
          <Text style={analyticsPdfStyles.cKitchen}>{x.kitchen_title || "—"}</Text>
          <Text style={analyticsPdfStyles.cPrice}>{Math.round(toNum(x.price))}</Text>
          <Text style={analyticsPdfStyles.cQty}>{Math.round(toNum(x.qty))}</Text>
          <Text style={analyticsPdfStyles.cRevenue}>{Math.round(toNum(x.revenue))}</Text>
          <Text style={analyticsPdfStyles.cAvg}>{Math.round(toNum(x.avg_unit_price))}</Text>
        </View>
      ))}
    </Page>
  </Document>
);

registerPdfFonts();

const isoDate = (d) => {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
};

const addDays = (d, days) => {
  const x = new Date(d);
  x.setDate(x.getDate() + days);
  return x;
};

const clampRangeDays = (fromStr, toStr, maxDays = 62) => {
  if (!fromStr || !toStr) return { ok: true, days: 0 };
  const from = new Date(`${fromStr}T00:00:00`);
  const to = new Date(`${toStr}T00:00:00`);
  const diff = Math.floor((to.getTime() - from.getTime()) / 86400000) + 1;
  return { ok: diff <= maxDays, days: diff };
};

const buildBuckets = (fromStr, toStr) => {
  if (!fromStr || !toStr) return [];
  const from = new Date(`${fromStr}T00:00:00`);
  const to = new Date(`${toStr}T00:00:00`);

  const { ok } = clampRangeDays(fromStr, toStr, 62);
  const step = ok ? 1 : 7;

  const buckets = [];
  let cur = new Date(from);

  while (cur.getTime() <= to.getTime()) {
    const start = new Date(cur);
    const end = addDays(cur, step - 1);
    const endClamped = end.getTime() > to.getTime() ? new Date(to) : end;

    buckets.push({
      key: step === 1 ? isoDate(start) : `${isoDate(start)}—${isoDate(endClamped)}`,
      date_from: isoDate(start),
      date_to: isoDate(endClamped),
    });

    cur = addDays(cur, step);
  }

  return buckets;
};

/* DRF fetch-all (для клиентов) */
async function fetchAllPages(url0) {
  let url = url0;
  const acc = [];
  let guard = 0;

  while (url && guard < 80) {
    // eslint-disable-next-line no-await-in-loop
    const { data } = await api.get(url);
    acc.push(...asArray(data));
    url = data?.next || null;
    guard += 1;
  }
  return acc;
}

/* ===== kitchen analytics normalizers ===== */
const pickName = (x) =>
  x?.waiter_label ||
  x?.kitchen_name ||
  x?.kitchen?.name ||
  x?.name ||
  x?.full_name ||
  x?.fullName ||
  x?.username ||
  x?.user?.full_name ||
  x?.user?.username ||
  x?.user?.email ||
  x?.waiter?.full_name ||
  x?.cook?.full_name ||
  x?.title ||
  "—";

const pickId = (x, idx) =>
  x?.id ||
  x?.kitchen_id ||
  x?.kitchen?.id ||
  x?.user_id ||
  x?.user?.id ||
  x?.waiter_id ||
  x?.cook_id ||
  `${pickName(x)}_${idx}`;

const normalizeStaffRow = (x, idx) => {
  const revenue =
    toNum(x?.revenue) ||
    toNum(x?.waiter_revenue) ||
    toNum(x?.sum) ||
    toNum(x?.total) ||
    toNum(x?.total_revenue) ||
    toNum(x?.total_amount);

  const orders =
    toNum(x?.orders_count) ||
    toNum(x?.orders) ||
    toNum(x?.count) ||
    toNum(x?.checks_count) ||
    toNum(x?.transactions);

  const items =
    toNum(x?.items_qty) ||
    toNum(x?.items) ||
    toNum(x?.qty) ||
    toNum(x?.positions) ||
    toNum(x?.positions_qty);

  const avgCheck =
    toNum(x?.avg_check) ||
    toNum(x?.avg) ||
    toNum(x?.average_check) ||
    (orders > 0 ? revenue / orders : 0);

  const prepared =
    toNum(x?.prepared_count) ||
    toNum(x?.done_count) ||
    toNum(x?.ready_count) ||
    toNum(x?.completed);

  const avgTime =
    toNum(x?.avg_time) ||
    toNum(x?.avg_cook_time) ||
    toNum(x?.avg_prepare_time) ||
    toNum(x?.avg_minutes);

  return {
    _id: pickId(x, idx),
    name: pickName(x),
    orders_count: orders,
    items_qty: items,
    revenue,
    avg_check: avgCheck,
    prepared_count: prepared,
    avg_time: avgTime,
    raw: x,
  };
};

const sumBy = (arr, key) => arr.reduce((acc, x) => acc + toNum(x?.[key]), 0);

const PAYMENT_INFLOW_LABELS = {
  cash: "Наличные",
  card: "Карта",
  transfer: "Перевод",
  mixed: "Смешанная оплата",
  debt: "В долг",
  other: "Прочее",
};

const labelPaymentMethod = (code) =>
  (code && PAYMENT_INFLOW_LABELS[String(code).toLowerCase()]) ||
  (code ? String(code) : "—");

/** Нормализует ответы list | { results } | { items } и т.п. */
const apiListPayload = (data) => {
  if (Array.isArray(data)) return data;
  if (!data || typeof data !== "object") return [];
  const inner =
    data.results ||
    data.items ||
    data.rows ||
    data.debts ||
    data.open_debts ||
    data.data;
  if (Array.isArray(inner)) return inner;
  return [];
};

const normalizeRevenueInflowRows = (data) => {
  const rows = apiListPayload(data);
  return rows.map((x, idx) => ({
    _id: String(x.payment_method ?? x.method ?? x.code ?? idx),
    method: x.payment_method ?? x.method ?? x.code,
    label: labelPaymentMethod(x.payment_method ?? x.method ?? x.code),
    amount: toNum(x.amount ?? x.revenue ?? x.sum ?? x.total ?? x.total_amount),
    orders_count: toNum(x.orders_count ?? x.orders ?? x.count ?? x.checks_count),
  }));
};

const normalizeRejectionRows = (data) => {
  const rows = apiListPayload(data);
  return rows.map((x, idx) => ({
    _id: String(x.id ?? `${String(x.rejection_reason ?? x.reason ?? idx)}_${idx}`),
    reason: String(x.rejection_reason ?? x.reason ?? x.title ?? "—").trim() || "—",
    qty: toNum(x.qty ?? x.count ?? x.items_count ?? x.rejected_count ?? x.lines),
    lost_revenue: toNum(
      x.lost_revenue ?? x.lost_amount ?? x.revenue_lost ?? x.sum ?? x.amount
    ),
    employee_name:
      String(
        x.employee_name ??
          x.waiter_name ??
          x.user_name ??
          x.created_by_name ??
          x.employee ??
          ""
      ).trim() || "—",
    created_at: x.created_at ?? x.rejected_at ?? x.last_rejected_at ?? x.last_at ?? null,
  }));
};

const normalizeExpensesBlock = (data) => {
  if (!data) return { total: 0, count: 0, categories: [] };
  if (Array.isArray(data)) {
    const categories = data.map((x, idx) => ({
      _id: x.category ?? x.id ?? idx,
      name:
        x.category_name ??
        x.category ??
        x.title ??
        x.name ??
        `Статья ${idx + 1}`,
      amount: toNum(x.amount ?? x.sum ?? x.total),
      count: toNum(x.count ?? x.expenses_count ?? 1),
    }));
    return {
      total: sumBy(categories, "amount"),
      count: categories.reduce((a, c) => a + toNum(c.count), 0) || categories.length,
      categories,
    };
  }
  const total = toNum(
    data.total_amount ?? data.total ?? data.sum ?? data.amount ?? data.expenses_sum
  );
  const count = toNum(
    data.count ?? data.expenses_count ?? data.items_count ?? data.cafe_expenses_count
  );
  const rawCat = data.by_category ?? data.categories ?? data.breakdown ?? data.items;
  const catList = apiListPayload(rawCat);
  const categories = catList.map((x, idx) => ({
    _id: x.category_id ?? x.category ?? x.id ?? idx,
    name:
      x.category_name ??
      x.category ??
      x.title ??
      x.name ??
      "—",
    amount: toNum(x.amount ?? x.sum ?? x.total),
    count: toNum(x.count ?? x.expenses_count ?? 1),
  }));
  const catSum = sumBy(categories, "amount");
  return {
    total: total || catSum,
    count: count || categories.reduce((a, c) => a + toNum(c.count), 0),
    categories,
  };
};

const normalizeDebtRows = (data) => {
  const rows = apiListPayload(data);
  return rows.map((x, idx) => ({
    _id: x.id ?? x.order_id ?? idx,
    check_label: x.check_label ?? x.label ?? "",
    order_number: x.order_number ?? x.number ?? x.order_num,
    balance: toNum(x.balance_due ?? x.balance ?? x.amount_due ?? x.due ?? x.total),
    table_number: x.table_number ?? x.table,
    created_at: x.created_at ?? x.opened_at,
    waiter_label: x.waiter_label,
  }));
};

const normalizeWaiterSalaryRows = (data) => {
  const rows = apiListPayload(data);
  return rows.map((x, idx) => ({
    _id: x.user_id ?? x.user?.id ?? x.id ?? idx,
    name:
      x.waiter_label ??
      pickName(x),
    waiter_revenue: toNum(x.waiter_revenue ?? x.revenue ?? x.personal_revenue),
    base_part: toNum(
      x.base_salary_part ?? x.monthly_part ?? x.salary_base ?? x.base_part
    ),
    percent_part: toNum(
      x.percent_part ?? x.commission_part ?? x.revenue_bonus ?? x.percent_bonus
    ),
    total: toNum(x.total_salary ?? x.salary ?? x.total ?? x.amount),
    scope: x.profile_scope ?? x.scope ?? "",
    days: toNum(x.days_in_period ?? x.days),
  }));
};

/* ===== component ===== */
const CafeAnalytics = () => {
  const { tariff, company } = useUser();
  const hideKitchenStaffKpi = useMemo(
    () => isStartPlan(tariff || company?.subscription_plan?.name),
    [tariff, company?.subscription_plan?.name],
  );

  const chartRef = useRef(null);
  const chartInstanceRef = useRef(null);

  const [loading, setLoading] = useState(false);

  // дефолт: последние 14 дней (включительно)
  const [dateFrom, setDateFrom] = useState(() => isoDate(addDays(new Date(), -13)));
  const [dateTo, setDateTo] = useState(() => isoDate(new Date()));

  // данные
  const [salesSummary, setSalesSummary] = useState({
    orders_count: 0,
    items_qty: 0,
    revenue: "0.00",
  });
  const [salesItems, setSalesItems] = useState([]);
  const [allMenuItems, setAllMenuItems] = useState([]);
  const [allMenuItemsLoading, setAllMenuItemsLoading] = useState(false);
  const [menuAllHideZeroQty, setMenuAllHideZeroQty] = useState(false);
  const [menuAllDateFrom, setMenuAllDateFrom] = useState(() => isoDate(addDays(new Date(), -13)));
  const [menuAllDateTo, setMenuAllDateTo] = useState(() => isoDate(new Date()));
  const [allMenuMeta, setAllMenuMeta] = useState({
    date_from: "",
    date_to: "",
    basis: "paid_at",
    offset: 0,
    limit: 5000,
    total_items: 0,
  });
  const [salesCategories, setSalesCategories] = useState([]);
  const [lowStock, setLowStock] = useState([]);

  // гости (список с /cafe/clients/ для модалки)
  const [guestsCount, setGuestsCount] = useState(0);
  const [cafeClients, setCafeClients] = useState([]);

  // кухня аналитика
  const [cooksRows, setCooksRows] = useState([]);
  const [waitersRows, setWaitersRows] = useState([]);
  const [kitchenLoading, setKitchenLoading] = useState(false);

  // series для графика
  const [revenueSeries, setRevenueSeries] = useState([]);

  const [revenueInflowRows, setRevenueInflowRows] = useState([]);
  const [rejectionRows, setRejectionRows] = useState([]);
  const [expensesBlock, setExpensesBlock] = useState({
    total: 0,
    count: 0,
    categories: [],
  });
  const [debtRows, setDebtRows] = useState([]);
  const [waiterSalaryRows, setWaiterSalaryRows] = useState([]);

  // modal
  const [modalKey, setModalKey] = useState(null); // revenue | avg | clients | stock | cooks | waiters | payment_inflow | rejections | expenses | debts | salary_waiters
  const [staffQ, setStaffQ] = useState("");
  const [staffSort, setStaffSort] = useState("revenue_desc"); // revenue_desc | orders_desc | avg_desc | name_asc
  const [exportReport, setExportReport] = useState("analytics");
  const [exportFormat, setExportFormat] = useState("excel");
  const [exportDateFrom, setExportDateFrom] = useState("");
  const [exportDateTo, setExportDateTo] = useState("");
  const [exportLoading, setExportLoading] = useState(false);
  const [exportError, setExportError] = useState("");

  const params = useMemo(() => {
    const p = {};
    if (dateFrom) p.date_from = dateFrom;
    if (dateTo) p.date_to = dateTo;
    return p;
  }, [dateFrom, dateTo]);

  const fetchAllMenuItems = useCallback(
    async (from, to) => {
      setAllMenuItemsLoading(true);
      try {
        const r = await api.get("/cafe/analytics/menu/all/", {
          params: {
            date_from: from || undefined,
            date_to: to || undefined,
            limit: 5000,
          },
        });
        const payload = r?.data || {};
        const rows = Array.isArray(payload?.rows)
          ? payload.rows
          : Array.isArray(listFrom(r))
            ? listFrom(r)
            : [];
        setAllMenuItems(rows);
        setAllMenuMeta({
          date_from: payload?.date_from || from || "",
          date_to: payload?.date_to || to || "",
          basis: payload?.basis || "paid_at",
          offset: Number(payload?.offset || 0),
          limit: Number(payload?.limit || 5000),
          total_items: Number(payload?.total_items || rows.length || 0),
        });
      } catch (e) {
        console.error("CafeAnalytics fetch all menu items error:", e);
        setAllMenuItems([]);
        setAllMenuMeta({
          date_from: from || "",
          date_to: to || "",
          basis: "paid_at",
          offset: 0,
          limit: 5000,
          total_items: 0,
        });
      } finally {
        setAllMenuItemsLoading(false);
      }
    },
    []
  );

  const fetchGuestsCount = useCallback(async () => {
    try {
      const clients = await fetchAllPages("/cafe/clients/");
      const list = Array.isArray(clients) ? clients : [];
      setGuestsCount(list.length);
      setCafeClients(list);
    } catch (e) {
      setGuestsCount(0);
      setCafeClients([]);
    }
  }, []);

  const fetchKitchenAnalytics = useCallback(async () => {
    setKitchenLoading(true);
    try {
      const [rCooks, rWaiters] = await Promise.all([
        api
          .get("/cafe/analytics/sales/kitchens/", { params })
          .catch(() => ({ data: [] })),
        api
          .get("/cafe/analytics/waiter-sales/", { params })
          .catch(() => ({ data: [] })),
      ]);

      const cooks = asArray(rCooks?.data).map(normalizeStaffRow);
      const waiters = asArray(rWaiters?.data).map(normalizeStaffRow);

      setCooksRows(Array.isArray(cooks) ? cooks : []);
      setWaitersRows(Array.isArray(waiters) ? waiters : []);
    } catch (e) {
      console.error("CafeAnalytics kitchen analytics error:", e);
      setCooksRows([]);
      setWaitersRows([]);
    } finally {
      setKitchenLoading(false);
    }
  }, [params]);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const salaryReq = hideKitchenStaffKpi
        ? Promise.resolve({ data: null })
        : api.get("/cafe/analytics/waiter-salary/", { params }).catch(() => ({ data: null }));

      const [
        rSalesSummary,
        rSalesItems,
        rSalesCategories,
        rLowStock,
        rInflow,
        rRejections,
        rExpenses,
        rDebts,
        rSalary,
      ] = await Promise.all([
        api.get("/cafe/analytics/sales/summary/", { params }).catch(() => ({ data: null })),
        api
          .get("/cafe/analytics/sales/items/", { params: { ...params, limit: 10 } })
          .catch(() => ({ data: [] })),
        api.get("/cafe/analytics/sales/categories/", { params }).catch(() => ({ data: [] })),
        api.get("/cafe/analytics/warehouse/low-stock/").catch(() => ({ data: [] })),
        api.get("/cafe/analytics/revenue-inflow/", { params }).catch(() => ({ data: null })),
        api.get("/cafe/analytics/rejections/", { params }).catch(() => ({ data: null })),
        api.get("/cafe/analytics/expenses/summary/", { params }).catch(() => ({ data: null })),
        api.get("/cafe/analytics/debts/", { params }).catch(() => ({ data: null })),
        salaryReq,
      ]);

      setSalesSummary(rSalesSummary?.data || { orders_count: 0, items_qty: 0, revenue: "0.00" });
      setSalesItems(Array.isArray(listFrom(rSalesItems)) ? listFrom(rSalesItems) : []);
      setSalesCategories(
        Array.isArray(listFrom(rSalesCategories)) ? listFrom(rSalesCategories) : []
      );
      setLowStock(Array.isArray(listFrom(rLowStock)) ? listFrom(rLowStock) : []);

      setRevenueInflowRows(normalizeRevenueInflowRows(rInflow?.data));
      setRejectionRows(normalizeRejectionRows(rRejections?.data));
      setExpensesBlock(normalizeExpensesBlock(rExpenses?.data));
      setDebtRows(normalizeDebtRows(rDebts?.data));
      setWaiterSalaryRows(
        hideKitchenStaffKpi ? [] : normalizeWaiterSalaryRows(rSalary?.data)
      );

      fetchGuestsCount().catch(() => {});
      if (!hideKitchenStaffKpi) {
        fetchKitchenAnalytics().catch(() => {});
      } else {
        setCooksRows([]);
        setWaitersRows([]);
      }
    } catch (e) {
      console.error("CafeAnalytics fetchAll error:", e);
      setSalesSummary({ orders_count: 0, items_qty: 0, revenue: "0.00" });
      setSalesItems([]);
      setSalesCategories([]);
      setLowStock([]);
      setRevenueInflowRows([]);
      setRejectionRows([]);
      setExpensesBlock({ total: 0, count: 0, categories: [] });
      setDebtRows([]);
      setWaiterSalaryRows([]);
    } finally {
      setLoading(false);
    }
  }, [params, fetchGuestsCount, fetchKitchenAnalytics, hideKitchenStaffKpi]);

  const fetchRevenueSeries = useCallback(async () => {
    if (!dateFrom || !dateTo) {
      setRevenueSeries([]);
      return;
    }
    const buckets = buildBuckets(dateFrom, dateTo);
    if (!buckets.length) {
      setRevenueSeries([]);
      return;
    }

    try {
      const chunkSize = 8;
      const out = [];

      for (let i = 0; i < buckets.length; i += chunkSize) {
        const part = buckets.slice(i, i + chunkSize);

        // eslint-disable-next-line no-await-in-loop
        const resArr = await Promise.all(
          part.map((b) =>
            api
              .get("/cafe/analytics/sales/summary/", {
                params: { date_from: b.date_from, date_to: b.date_to },
              })
              .catch(() => ({ data: null }))
          )
        );

        for (let j = 0; j < part.length; j += 1) {
          const b = part[j];
          const payload = resArr[j]?.data;
          out.push({ label: b.key, value: toNum(payload?.revenue) });
        }
      }

      setRevenueSeries(out);
    } catch (e) {
      console.error("CafeAnalytics fetchRevenueSeries error:", e);
      setRevenueSeries([]);
    }
  }, [dateFrom, dateTo]);

  useEffect(() => {
    fetchAll();
    fetchRevenueSeries();
  }, [fetchAll, fetchRevenueSeries]);

  // Chart.js mount/update
  useEffect(() => {
    const canvas = chartRef.current;
    if (!canvas) return;

    if (chartInstanceRef.current) {
      chartInstanceRef.current.destroy();
      chartInstanceRef.current = null;
    }

    const labels = revenueSeries.map((x) => x.label);
    const values = revenueSeries.map((x) => x.value);

    const ctx = canvas.getContext("2d");
    chartInstanceRef.current = new Chart(ctx, {
      type: "line",
      data: {
        labels,
        datasets: [
          {
            label: "Выручка (сом)",
            data: values,
            tension: 0.35,
            fill: true,
            borderWidth: 3,
            borderColor: "#f7d74f",
            backgroundColor: "rgba(247, 215, 79, 0.16)",
            pointRadius: 3,
            pointHoverRadius: 4,
            pointBackgroundColor: "#ffffff",
            pointBorderColor: "#f7d74f",
            pointBorderWidth: 2,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: "index", intersect: false },
        plugins: {
          legend: {
            display: true,
            position: "bottom",
            labels: { boxWidth: 30, boxHeight: 10, padding: 18 },
          },
          tooltip: {
            callbacks: {
              label: (ctx2) => ` ${ctx2.dataset.label}: ${fmtMoney(ctx2.parsed.y)}`,
            },
          },
        },
        scales: {
          x: { grid: { display: true }, ticks: { maxRotation: 0, autoSkip: true } },
          y: { beginAtZero: true, grid: { display: true }, ticks: { callback: (v) => fmtInt(v) } },
        },
      },
    });

    return () => {
      if (chartInstanceRef.current) {
        chartInstanceRef.current.destroy();
        chartInstanceRef.current = null;
      }
    };
  }, [revenueSeries]);

  const revenueTotal = useMemo(() => toNum(salesSummary?.revenue), [salesSummary]);
  const trxCount = useMemo(() => Number(salesSummary?.orders_count || 0), [salesSummary]);
  const avgCheck = useMemo(() => (trxCount > 0 ? revenueTotal / trxCount : 0), [revenueTotal, trxCount]);

  // кухонные KPI
  const cooksCount = useMemo(() => cooksRows.length, [cooksRows]);
  const waitersCount = useMemo(() => waitersRows.length, [waitersRows]);

  const inflowTotal = useMemo(
    () => sumBy(revenueInflowRows, "amount"),
    [revenueInflowRows]
  );
  const rejectionLinesTotal = useMemo(
    () => sumBy(rejectionRows, "qty"),
    [rejectionRows]
  );
  const expensesTotal = useMemo(() => toNum(expensesBlock?.total), [expensesBlock]);
  const debtsSum = useMemo(() => sumBy(debtRows, "balance"), [debtRows]);
  const debtsCount = useMemo(() => debtRows.length, [debtRows]);
  const salaryAccruedTotal = useMemo(
    () => sumBy(waiterSalaryRows, "total"),
    [waiterSalaryRows]
  );

  const openModal = (key) => {
    setModalKey(key);
    setStaffQ("");
    setStaffSort("revenue_desc");
    if (key === "menu_all") {
      const from = dateFrom || isoDate(addDays(new Date(), -13));
      const to = dateTo || isoDate(new Date());
      setMenuAllDateFrom(from);
      setMenuAllDateTo(to);
      fetchAllMenuItems(from, to);
    }
    if (key === "export") {
      setExportReport("analytics");
      setExportFormat("excel");
      setExportDateFrom(dateFrom || "");
      setExportDateTo(dateTo || "");
      setExportError("");
    }
  };
  const closeModal = () => setModalKey(null);

  const modalTitle = useMemo(() => {
    if (modalKey === "revenue") return "Выручка";
    if (modalKey === "avg") return "Средний чек";
    if (modalKey === "clients") return "Гости";
    if (modalKey === "stock") return "Склад";
    if (modalKey === "cooks") return "По кухням";
    if (modalKey === "waiters") return "Официанты (выручка)";
    if (modalKey === "export") return "Экспорт отчета";
    if (modalKey === "payment_inflow") return "Оплаты по способу";
    if (modalKey === "rejections") return "Отказы по позициям";
    if (modalKey === "menu_all") return "Все блюда";
    if (modalKey === "expenses") return "Операционные расходы";
    if (modalKey === "debts") return "Открытые долги";
    if (modalKey === "salary_waiters") return "Зарплата официантов (расчёт)";
    return "";
  }, [modalKey]);

  const modalSubtitle = useMemo(() => {
    const p = [];
    if (dateFrom) p.push(`от ${dateFrom}`);
    if (dateTo) p.push(`до ${dateTo}`);
    return p.join(" ");
  }, [dateFrom, dateTo]);

  const activeStaffRows = useMemo(() => {
    const base = modalKey === "cooks" ? cooksRows : modalKey === "waiters" ? waitersRows : [];
    const q = (staffQ || "").trim().toLowerCase();

    const filtered = q ? base.filter((x) => String(x?.name || "").toLowerCase().includes(q)) : base.slice();

    const sorted = filtered.sort((a, b) => {
      if (staffSort === "name_asc") return String(a.name).localeCompare(String(b.name), "ru");
      if (staffSort === "orders_desc") return toNum(b.orders_count) - toNum(a.orders_count);
      if (staffSort === "avg_desc") return toNum(b.avg_check) - toNum(a.avg_check);
      return toNum(b.revenue) - toNum(a.revenue);
    });

    return sorted;
  }, [modalKey, cooksRows, waitersRows, staffQ, staffSort]);

  const staffTotals = useMemo(() => {
    const rows = activeStaffRows;
    return {
      revenue: sumBy(rows, "revenue"),
      orders: sumBy(rows, "orders_count"),
      items: sumBy(rows, "items_qty"),
    };
  }, [activeStaffRows]);

  const handleExport = useCallback(async () => {
    setExportLoading(true);
    setExportError("");
    try {
      const exportParams = {
        report: exportReport,
        format: exportFormat,
      };
      if (exportDateFrom) exportParams.date_from = exportDateFrom;
      if (exportDateTo) exportParams.date_to = exportDateTo;

      const response = await api.get("/cafe/analytics/export/", {
        params: exportParams,
        responseType: "blob",
        // axios по умолчанию шлёт Accept: application/json — DRF отказывает для .xlsx/.doc
        headers: { Accept: "*/*" },
      });

      const contentDisposition = response.headers?.["content-disposition"] || "";
      const match = contentDisposition.match(/filename\*=UTF-8''([^;]+)|filename="?([^"]+)"?/i);
      const fallbackExt = exportFormat === "excel" ? "xlsx" : "doc";
      const fallbackName = `${exportReport}_${exportDateFrom || "all"}_${exportDateTo || "all"}.${fallbackExt}`;
      const rawFileName = decodeURIComponent(match?.[1] || match?.[2] || fallbackName);

      const blob = new Blob([response.data], {
        type:
          exportFormat === "excel"
            ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            : "application/msword",
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = rawFileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      closeModal();
    } catch (e) {
      setExportError("Не удалось выполнить экспорт. Проверьте параметры и попробуйте снова.");
    } finally {
      setExportLoading(false);
    }
  }, [exportReport, exportFormat, exportDateFrom, exportDateTo]);

  const handleExportAllMenuPdf = useCallback(async () => {
    const rawRows = Array.isArray(allMenuItems) ? allMenuItems : [];
    const rows = menuAllHideZeroQty
      ? rawRows.filter((x) => toNum(x?.qty) !== 0)
      : rawRows;
    const totals = {
      items: rows.length,
      qty: rows.reduce((a, x) => a + toNum(x?.qty), 0),
      revenue: rows.reduce((a, x) => a + toNum(x?.revenue), 0),
    };
    const periodLabel = `Период: ${allMenuMeta?.date_from || dateFrom || "—"} — ${allMenuMeta?.date_to || dateTo || "—"}`;
    try {
      const blob = await pdf(
        <CafeAllMenuPdfDocument rows={rows} periodLabel={periodLabel} totals={totals} />
      ).toBlob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `cafe_menu_all_${allMenuMeta?.date_from || dateFrom || "all"}_${allMenuMeta?.date_to || dateTo || "all"}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (e) {
      console.error("CafeAnalytics export menu PDF error:", e);
    }
  }, [allMenuItems, allMenuMeta, dateFrom, dateTo, menuAllHideZeroQty]);

  const handleMenuAllApplyDates = useCallback(() => {
    fetchAllMenuItems(menuAllDateFrom, menuAllDateTo);
  }, [fetchAllMenuItems, menuAllDateFrom, menuAllDateTo]);

  const handleMenuAllQuickRange = useCallback(
    (kind) => {
      const today = isoDate(new Date());
      let from = today;
      let to = today;
      if (kind === "yesterday") {
        from = isoDate(addDays(new Date(), -1));
        to = from;
      } else if (kind === "3days") {
        from = isoDate(addDays(new Date(), -2));
      } else if (kind === "week") {
        from = isoDate(addDays(new Date(), -6));
      }
      setMenuAllDateFrom(from);
      setMenuAllDateTo(to);
      fetchAllMenuItems(from, to);
    },
    [fetchAllMenuItems]
  );

  return (
    <section className="cafeAnalytics">
      <div className="cafeAnalytics__top">
        <div className="cafeAnalytics__head">
          <div className="cafeAnalytics__headLeft">
          </div>

          <div className="cafeAnalytics__headRight">
            <div className="cafeAnalytics__range">
              <div className="cafeAnalytics__rangeLabel">
                <FaFilter /> Период
              </div>

              <label className="cafeAnalytics__rangeField">
                <span>От</span>
                <input
                  type="date"
                  className="cafeAnalytics__input"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                />
              </label>

              <label className="cafeAnalytics__rangeField">
                <span>До</span>
                <input
                  type="date"
                  className="cafeAnalytics__input"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                />
              </label>

              <button
                className="cafeAnalytics__btn"
                onClick={() => {
                  fetchAll();
                  fetchRevenueSeries();
                }}
                disabled={loading || (!hideKitchenStaffKpi && kitchenLoading)}
                type="button"
              >
                <FaSync /> Обновить
              </button>
              <button
                className="cafeAnalytics__btn"
                onClick={() => openModal("export")}
                type="button"
                disabled={exportLoading}
              >
                <FaDownload /> Экспорт
              </button>
            </div>
          </div>
        </div>

        {/* KPI */}
        <div className="cafeAnalytics__kpis cafeAnalytics__kpis--3">
          <button className="cafeAnalytics__kpi" type="button" onClick={() => openModal("revenue")}>
            <div className="cafeAnalytics__kpiTop">
              <div className="cafeAnalytics__kpiLabel">ВЫРУЧКА</div>
              <div className="cafeAnalytics__kpiIcon cafeAnalytics__kpiIcon--yellow">
                <FaShoppingCart />
              </div>
            </div>
            <div className="cafeAnalytics__kpiValue">
              <span className="cafeAnalytics__kpiCur">сом</span> {fmtInt(revenueTotal)}
            </div>
          </button>

          <div className="cafeAnalytics__kpi cafeAnalytics__kpi--static" aria-disabled="true">
            <div className="cafeAnalytics__kpiTop">
              <div className="cafeAnalytics__kpiLabel">ТРАНЗАКЦИИ</div>
              <div className="cafeAnalytics__kpiIcon cafeAnalytics__kpiIcon--yellow">
                <FaShoppingCart />
              </div>
            </div>
            <div className="cafeAnalytics__kpiValue">{fmtInt(trxCount)}</div>
          </div>

          <button className="cafeAnalytics__kpi" type="button" onClick={() => openModal("clients")}>
            <div className="cafeAnalytics__kpiTop">
              <div className="cafeAnalytics__kpiLabel">ГОСТИ</div>
              <div className="cafeAnalytics__kpiIcon cafeAnalytics__kpiIcon--yellow">
                <FaUsers />
              </div>
            </div>
            <div className="cafeAnalytics__kpiValue">{fmtInt(guestsCount)}</div>
          </button>
        </div>

        {!hideKitchenStaffKpi && (
          <div className="cafeAnalytics__kpis cafeAnalytics__kpis--2">
            <button
              className="cafeAnalytics__kpi cafeAnalytics__kpi--kitchen"
              type="button"
              onClick={() => openModal("cooks")}
              disabled={kitchenLoading}
            >
              <div className="cafeAnalytics__kpiTop">
                <div className="cafeAnalytics__kpiLabel">КУХНИ</div>
                <div className="cafeAnalytics__kpiIcon cafeAnalytics__kpiIcon--yellow">
                  <FaUsers />
                </div>
              </div>
              <div className="cafeAnalytics__kpiValue">{fmtInt(cooksCount)}</div>
              <div className="cafeAnalytics__kpiHint">{kitchenLoading ? "Загрузка…" : "Выручка по кухням"}</div>
            </button>

            <button
              className="cafeAnalytics__kpi cafeAnalytics__kpi--kitchen"
              type="button"
              onClick={() => openModal("waiters")}
              disabled={kitchenLoading}
            >
              <div className="cafeAnalytics__kpiTop">
                <div className="cafeAnalytics__kpiLabel">ОФИЦИАНТЫ</div>
                <div className="cafeAnalytics__kpiIcon cafeAnalytics__kpiIcon--yellow">
                  <FaUsers />
                </div>
              </div>
              <div className="cafeAnalytics__kpiValue">{fmtInt(waitersCount)}</div>
              <div className="cafeAnalytics__kpiHint">{kitchenLoading ? "Загрузка…" : "Выручка, чеки, позиции"}</div>
            </button>
          </div>
        )}
      </div>

      <div className="cafeAnalytics__opsSection">
        <div className="cafeAnalytics__opsSectionTitle">Дополнительная аналитика</div>
        <div className="cafeAnalytics__opsMinis">
          <button
            className="cafeAnalytics__mini"
            type="button"
            onClick={() => openModal("payment_inflow")}
          >
            <div className="cafeAnalytics__miniTop">
              <div className="cafeAnalytics__miniIcon cafeAnalytics__miniIcon--dark">
                <FaMoneyBillWave />
              </div>
              <div className="cafeAnalytics__miniLabel">Оплаты</div>
            </div>
            <div className="cafeAnalytics__miniValue">{fmtMoney(inflowTotal)}</div>
            <div className="cafeAnalytics__miniMeta">По способу оплаты за период</div>
          </button>

          <button
            className="cafeAnalytics__mini"
            type="button"
            onClick={() => openModal("rejections")}
          >
            <div className="cafeAnalytics__miniTop">
              <div className="cafeAnalytics__miniIcon cafeAnalytics__miniIcon--red">
                <FaBan />
              </div>
              <div className="cafeAnalytics__miniLabel">Отказы</div>
            </div>
            <div className="cafeAnalytics__miniValue">{fmtInt(rejectionLinesTotal)}</div>
            <div className="cafeAnalytics__miniMeta">Строк меню с отказом</div>
          </button>

          <button
            className="cafeAnalytics__mini"
            type="button"
            onClick={() => openModal("expenses")}
          >
            <div className="cafeAnalytics__miniTop">
              <div className="cafeAnalytics__miniIcon cafeAnalytics__miniIcon--dark">
                <FaReceipt />
              </div>
              <div className="cafeAnalytics__miniLabel">Расходы</div>
            </div>
            <div className="cafeAnalytics__miniValue">{fmtMoney(expensesTotal)}</div>
            <div className="cafeAnalytics__miniMeta">
              Операционные расходы кафе
              {expensesBlock?.count ? (
                <>
                  {" "}
                  · <b>{fmtInt(expensesBlock.count)}</b> записей
                </>
              ) : null}
            </div>
          </button>

          <button
            className="cafeAnalytics__mini"
            type="button"
            onClick={() => openModal("debts")}
          >
            <div className="cafeAnalytics__miniTop">
              <div className="cafeAnalytics__miniIcon cafeAnalytics__miniIcon--red">
                <FaExclamationTriangle />
              </div>
              <div className="cafeAnalytics__miniLabel">Долги</div>
            </div>
            <div className="cafeAnalytics__miniValue">{fmtMoney(debtsSum)}</div>
            <div className="cafeAnalytics__miniMeta">
              Неоплаченный баланс · <b>{fmtInt(debtsCount)}</b> чеков
            </div>
          </button>

          {!hideKitchenStaffKpi && (
            <button
              className="cafeAnalytics__mini"
              type="button"
              onClick={() => openModal("salary_waiters")}
            >
              <div className="cafeAnalytics__miniTop">
                <div className="cafeAnalytics__miniIcon cafeAnalytics__miniIcon--dark">
                  <FaCoins />
                </div>
                <div className="cafeAnalytics__miniLabel">Зарплата</div>
              </div>
              <div className="cafeAnalytics__miniValue">{fmtMoney(salaryAccruedTotal)}</div>
              <div className="cafeAnalytics__miniMeta">Оклад + % за период (по профилям)</div>
            </button>
          )}
        </div>
      </div>

      {/* Chart */}
      <div className="cafeAnalytics__card">
        <div className="cafeAnalytics__cardHead">
          <div className="cafeAnalytics__cardTitle">Динамика продаж</div>
        </div>

        <div className="cafeAnalytics__cardBody">
          <div className="cafeAnalytics__chartWrap">
            <canvas ref={chartRef} />
          </div>

          {!loading && revenueSeries.length === 0 && (
            <div className="cafeAnalytics__note">Нет данных по выручке за выбранный период.</div>
          )}
          {loading && <div className="cafeAnalytics__note">Загрузка аналитики…</div>}
        </div>
      </div>

      {/* Bottom */}
      <div className="cafeAnalytics__bottom">
        <div className="cafeAnalytics__card cafeAnalytics__card--full">
          <div className="cafeAnalytics__cardHead cafeAnalytics__cardHead--tight">
            <div className="cafeAnalytics__cardHeadActions">
              <div className="cafeAnalytics__cardTitle">Топ блюд по выручке</div>
              <button
                type="button"
                className="cafeAnalytics__btn cafeAnalytics__btn--sm"
                onClick={() => openModal("menu_all")}
                disabled={allMenuItemsLoading}
              >
                {allMenuItemsLoading ? "Загрузка..." : "Все блюда"}
              </button>
            </div>
          </div>

          <div className="cafeAnalytics__cardBody cafeAnalytics__cardBody--tight">
            <div className="cafeAnalytics__tableWrap">
              <table className="cafeAnalytics__table">
                <thead>
                  <tr>
                    <th>Блюдо</th>
                    <th>Кол-во</th>
                    <th>Выручка</th>
                  </tr>
                </thead>
                <tbody>
                  {salesItems.map((x) => (
                    <tr key={x.menu_item_id || x.title}>
                      <td className="cafeAnalytics__tdTitle" title={x.title}>
                        {x.title}
                      </td>
                      <td>{fmtInt(x.qty)}</td>
                      <td>{fmtMoney(toNum(x.revenue))}</td>
                    </tr>
                  ))}
                  {!salesItems.length && (
                    <tr>
                      <td colSpan={3} className="cafeAnalytics__tdEmpty">
                        Нет данных.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="cafeAnalytics__card cafeAnalytics__card--full">
          <div className="cafeAnalytics__cardHead cafeAnalytics__cardHead--tight">
            <div className="cafeAnalytics__cardTitle">Продажи по категориям</div>
          </div>

          <div className="cafeAnalytics__cardBody cafeAnalytics__cardBody--tight">
            <div className="cafeAnalytics__tableWrap">
              <table className="cafeAnalytics__table">
                <thead>
                  <tr>
                    <th>Категория</th>
                    <th>Кол-во</th>
                    <th>Выручка</th>
                  </tr>
                </thead>
                <tbody>
                  {salesCategories.map((x, idx) => (
                    <tr key={x?.category_id || x?.id || `${pickCategoryName(x)}_${idx}`}>
                      <td className="cafeAnalytics__tdTitle" title={pickCategoryName(x)}>
                        {pickCategoryName(x)}
                      </td>
                      <td>{fmtInt(toNum(x?.qty ?? x?.items_qty ?? x?.orders_count ?? 0))}</td>
                      <td>{fmtMoney(toNum(x?.revenue ?? x?.total ?? x?.amount ?? 0))}</td>
                    </tr>
                  ))}
                  {!salesCategories.length && (
                    <tr>
                      <td colSpan={3} className="cafeAnalytics__tdEmpty">
                        Нет данных.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <button className="cafeAnalytics__mini" type="button" onClick={() => openModal("stock")}>
          <div className="cafeAnalytics__miniTop">
            <div className="cafeAnalytics__miniIcon cafeAnalytics__miniIcon--red">
              <FaBoxOpen />
            </div>
            <div className="cafeAnalytics__miniLabel">СКЛАД</div>
          </div>
          <div className="cafeAnalytics__miniValue">{fmtInt(lowStock.length)}</div>
          <div className="cafeAnalytics__miniMeta">Позиции ниже минимума</div>
        </button>

        <button className="cafeAnalytics__mini" type="button" onClick={() => openModal("avg")}>
          <div className="cafeAnalytics__miniTop">
            <div className="cafeAnalytics__miniIcon cafeAnalytics__miniIcon--dark">
              <FaChartLine />
            </div>
            <div className="cafeAnalytics__miniLabel">СРЕДНИЙ ЧЕК</div>
          </div>
          <div className="cafeAnalytics__miniValue">{fmtMoney(avgCheck)}</div>
          <div className="cafeAnalytics__miniMeta">Выручка / транзакции</div>
        </button>
      </div>

      {/* Modal */}
      <CafeAnalyticsModal open={!!modalKey} title={modalTitle} subtitle={modalSubtitle} onClose={closeModal}>
        <CafeAnalyticsModalContent
          modalKey={modalKey}
          revenueTotal={revenueTotal}
          trxCount={trxCount}
          avgCheck={avgCheck}
          guestsCount={guestsCount}
          cafeClients={cafeClients}
          salesItems={salesItems}
          allMenuItems={allMenuItems}
          allMenuItemsLoading={allMenuItemsLoading}
          allMenuMeta={allMenuMeta}
          onExportMenuAllPdf={handleExportAllMenuPdf}
          menuAllHideZeroQty={menuAllHideZeroQty}
          setMenuAllHideZeroQty={setMenuAllHideZeroQty}
          menuAllDateFrom={menuAllDateFrom}
          setMenuAllDateFrom={setMenuAllDateFrom}
          menuAllDateTo={menuAllDateTo}
          setMenuAllDateTo={setMenuAllDateTo}
          onMenuAllApplyDates={handleMenuAllApplyDates}
          onMenuAllQuickRange={handleMenuAllQuickRange}
          lowStock={lowStock}
          kitchenLoading={kitchenLoading}
          staffQ={staffQ}
          setStaffQ={setStaffQ}
          staffSort={staffSort}
          setStaffSort={setStaffSort}
          onRefreshKitchen={fetchKitchenAnalytics}
          activeStaffRows={activeStaffRows}
          staffTotals={staffTotals}
          fmtInt={fmtInt}
          fmtMoney={fmtMoney}
          toNum={toNum}
          exportReport={exportReport}
          setExportReport={setExportReport}
          exportFormat={exportFormat}
          setExportFormat={setExportFormat}
          exportDateFrom={exportDateFrom}
          setExportDateFrom={setExportDateFrom}
          exportDateTo={exportDateTo}
          setExportDateTo={setExportDateTo}
          exportLoading={exportLoading}
          exportError={exportError}
          onExport={handleExport}
          revenueInflowRows={revenueInflowRows}
          rejectionRows={rejectionRows}
          expensesBlock={expensesBlock}
          debtRows={debtRows}
          waiterSalaryRows={waiterSalaryRows}
        />
      </CafeAnalyticsModal>
    </section>
  );
};

export default CafeAnalytics;
