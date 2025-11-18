import React, { useEffect, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  Download,
  TrendingUp,
  TrendingDown,
  Search,
  Filter,
  RefreshCw,
} from "lucide-react";
import api from "../../../api";

import { historySellProduct } from "../../../store/creators/saleThunk";
import {
  fetchProductsAsync,
  fetchBrandsAsync,
  fetchCategoriesAsync,
} from "../../../store/creators/productCreators";
import { fetchBranchesAsync } from "../../../store/creators/branchCreators";
import { useSale } from "../../../store/slices/saleSlice";
import { useUser } from "../../../store/slices/userSlice";

import "./Analytics.scss";

/* -------------------- helpers -------------------- */
const parseISO = (s) => {
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
};

const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
const sortKeysAsc = (arr) => [...arr].sort((a, b) => (a > b ? 1 : -1));
const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
const keyByGranularity = (date, g) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  if (g === "day") return `${y}-${m}-${d}`;
  if (g === "year") return `${y}`;
  return `${y}-${m}`; // month
};
const listFrom = (r) => r?.data?.results || r?.data || [];

/* -------------------- Export helpers -------------------- */
const exportToCSV = (data, filename) => {
  if (!data || !data.length) {
    alert("Нет данных для экспорта");
    return;
  }
  const headers = Object.keys(data[0]);
  const csvContent = [
    headers.join(","),
    ...data.map((row) =>
      headers
        .map((header) => {
          const value = row[header];
          if (value === null || value === undefined) return "";
          if (typeof value === "object") return JSON.stringify(value);
          return String(value).replace(/"/g, '""');
        })
        .map((v) => `"${v}"`)
        .join(",")
    ),
  ].join("\n");

  const blob = new Blob(["\uFEFF" + csvContent], {
    type: "text/csv;charset=utf-8;",
  });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  link.setAttribute("href", url);
  link.setAttribute(
    "download",
    `${filename}_${new Date().toISOString().split("T")[0]}.csv`
  );
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

/* -------------------- Trend indicator -------------------- */
const TrendIndicator = ({ current, previous, format = (n) => n }) => {
  if (previous === 0 || previous === null || previous === undefined) {
    return <span style={{ opacity: 0.5 }}>—</span>;
  }
  const diff = current - previous;
  const percent = ((diff / previous) * 100).toFixed(1);
  const isPositive = diff >= 0;
  const Icon = isPositive ? TrendingUp : TrendingDown;
  const color = isPositive ? "#28a745" : "#dc3545";

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        color,
        fontSize: "0.85em",
        fontWeight: 500,
      }}
      title={`${isPositive ? "+" : ""}${format(diff)} (${
        isPositive ? "+" : ""
      }${percent}%)`}
    >
      <Icon size={14} />
      {isPositive ? "+" : ""}
      {percent}%
    </span>
  );
};

/* -------------------- tiny SVG sparkline -------------------- */
/* -------------------- tiny SVG sparkline -------------------- */
const Sparkline = ({ values = [], width = 520, height = 140 }) => {
  if (!values.length) {
    return <div className="analytics-sales__sparkline-empty">Нет данных</div>;
  }
  const pad = 8;
  const W = width - pad * 2;
  const H = height - pad * 2;

  const min = Math.min(...values);
  const max = Math.max(...values);
  const pts = values.map((v, i) => {
    const x = pad + (i * W) / Math.max(1, values.length - 1);
    const ratio = max === min ? 0.5 : (v - min) / (max - min);
    const y = pad + (1 - ratio) * H;
    return [x, y];
  });
  const d = pts
    .map(([x, y], i) => (i === 0 ? `M${x},${y}` : `L${x},${y}`))
    .join(" ");

  return (
    <svg
      className="analytics-sales__sparkline"
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label="График динамики"
    >
      {/* ось X */}
      <polyline
        fill="none"
        stroke="var(--c-border)"
        strokeWidth="1"
        points={`${pad},${height - pad} ${width - pad},${height - pad}`}
      />
      {/* линия — жёлтая */}
      <path d={d} fill="none" stroke="var(--c-accent)" strokeWidth="2.5" />
      {/* точки — жёлтые */}
      {pts.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="2.6" fill="var(--c-accent)" />
      ))}
    </svg>
  );
};

/* ============================================================= */

const Analytics = () => {
  const dispatch = useDispatch();

  // из saleSlice
  const { history = [], loading: salesLoading, error: salesError } = useSale();

  // из productSlice
  const {
    list: products = [],
    brands = [],
    categories = [],
    loading: productsLoading,
  } = useSelector((s) => s.product);

  // из branchSlice
  const { list: branches = [], loading: branchesLoading } = useSelector(
    (s) => s.branches
  );

  // из userSlice
  const { profile } = useUser();

  /* ---------- controls ---------- */
  // По умолчанию показываем текущий месяц (с 1 числа)
  const [startDate, setStartDate] = useState(() => {
    const n = new Date();
    const firstDayOfMonth = new Date(n.getFullYear(), n.getMonth(), 1);
    return firstDayOfMonth.toISOString().slice(0, 10);
  });
  const [endDate, setEndDate] = useState(() =>
    new Date().toISOString().slice(0, 10)
  );
  const [granularity, setGranularity] = useState("day"); // day | month | year
  const [activeTab, setActiveTab] = useState("cashbox"); // sales | inventory | taxonomy | cashbox
  const [searchQuery, setSearchQuery] = useState(""); // Поиск в таблицах
  const [showFilters, setShowFilters] = useState(false); // Показать/скрыть фильтры

  /* ---------- fetch once ---------- */
  useEffect(() => {
    dispatch(historySellProduct({ search: "" }));
    dispatch(fetchProductsAsync({ page: 1, page_size: 1000 }));
    dispatch(fetchBrandsAsync());
    dispatch(fetchCategoriesAsync());
    dispatch(fetchBranchesAsync());
  }, [dispatch]);

  /* ---------- Автоматический сброс статистики первого числа месяца ---------- */
  useEffect(() => {
    const now = new Date();
    const today = now.getDate();

    // Если сегодня первое число месяца, сбрасываем на текущий месяц
    if (today === 1) {
      const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

      // Проверяем, не установлены ли уже даты на текущий месяц
      const currentStart = parseISO(startDate);
      const currentEnd = parseISO(endDate);

      if (
        !currentStart ||
        !currentEnd ||
        currentStart.getTime() !== firstDayOfMonth.getTime() ||
        currentEnd.getTime() !== lastDayOfMonth.getTime()
      ) {
        setStartDate(firstDayOfMonth.toISOString().slice(0, 10));
        setEndDate(lastDayOfMonth.toISOString().slice(0, 10));
        setGranularity("day");
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Выполняется только при монтировании компонента

  /* ---------- formatters ---------- */
  const lan =
    (typeof localStorage !== "undefined" &&
      localStorage.getItem("i18nextLng")) ||
    "ru";
  const nfMoney = useMemo(() => {
    try {
      return new Intl.NumberFormat(lan === "en" ? "en-US" : "ru-RU", {
        style: "currency",
        currency: "KGS",
        maximumFractionDigits: 0,
      });
    } catch {
      return { format: (n) => `${Number(n).toLocaleString("ru-RU")} сом` };
    }
  }, [lan]);
  const nfInt = useMemo(
    () => new Intl.NumberFormat(lan === "en" ? "en-US" : "ru-RU"),
    [lan]
  );

  /* ---------- date range ---------- */
  const inRange = (d) => {
    const sd = parseISO(startDate);
    const ed = parseISO(endDate);
    if (!d || !sd || !ed) return false;
    const from = new Date(
      sd.getFullYear(),
      sd.getMonth(),
      sd.getDate(),
      0,
      0,
      0
    );
    const to = new Date(
      ed.getFullYear(),
      ed.getMonth(),
      ed.getDate(),
      23,
      59,
      59
    );
    return d >= from && d <= to;
  };

  const quickPreset = (preset) => {
    const now = new Date();
    if (preset === "thisMonth") {
      // Текущий месяц с 1 числа
      const sd = new Date(now.getFullYear(), now.getMonth(), 1);
      const ed = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      setStartDate(sd.toISOString().slice(0, 10));
      setEndDate(ed.toISOString().slice(0, 10));
      setGranularity("day");
    }
    if (preset === "lastMonth") {
      // Прошлый месяц (с 1 по последнее число)
      const sd = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const ed = new Date(now.getFullYear(), now.getMonth(), 0);
      setStartDate(sd.toISOString().slice(0, 10));
      setEndDate(ed.toISOString().slice(0, 10));
      setGranularity("day");
    }
    if (preset === "ytd") {
      // С начала года до сегодня
      const sd = new Date(now.getFullYear(), 0, 1);
      setStartDate(sd.toISOString().slice(0, 10));
      setEndDate(now.toISOString().slice(0, 10));
      setGranularity("month");
    }
    if (preset === "thisYear") {
      // Весь текущий год
      const sd = new Date(now.getFullYear(), 0, 1);
      const ed = new Date(now.getFullYear(), 11, 31);
      setStartDate(sd.toISOString().slice(0, 10));
      setEndDate(ed.toISOString().slice(0, 10));
      setGranularity("month");
    }
    if (preset === "lastYear") {
      // Прошлый год (с 1 января по 31 декабря)
      const lastYear = now.getFullYear() - 1;
      const sd = new Date(lastYear, 0, 1);
      const ed = new Date(lastYear, 11, 31);
      setStartDate(sd.toISOString().slice(0, 10));
      setEndDate(ed.toISOString().slice(0, 10));
      setGranularity("month");
    }
  };

  /* ====================== SALES ====================== */
  const salesFiltered = useMemo(
    () => (history || []).filter((r) => inRange(parseISO(r?.created_at))),
    [history, startDate, endDate]
  );

  const salesTotals = useMemo(() => {
    const count = salesFiltered.length;
    const revenue = salesFiltered.reduce((acc, r) => acc + num(r?.total), 0);
    return { count, revenue, avg: count ? revenue / count : 0 };
  }, [salesFiltered]);

  // Предыдущий период для сравнения
  const previousPeriodSales = useMemo(() => {
    if (!startDate || !endDate) return null;
    const start = parseISO(startDate);
    const end = parseISO(endDate);
    if (!start || !end) return null;

    const diff = end.getTime() - start.getTime();
    const prevEnd = new Date(start.getTime() - 1);
    const prevStart = new Date(prevEnd.getTime() - diff);

    const prevSales = (history || []).filter((r) => {
      const d = parseISO(r?.created_at);
      if (!d) return false;
      return d >= prevStart && d <= prevEnd;
    });

    const prevCount = prevSales.length;
    const prevRevenue = prevSales.reduce((acc, r) => acc + num(r?.total), 0);
    return {
      count: prevCount,
      revenue: prevRevenue,
      avg: prevCount ? prevRevenue / prevCount : 0,
    };
  }, [history, startDate, endDate]);

  const salesSeries = useMemo(() => {
    const bucket = new Map();
    for (const r of salesFiltered) {
      const d = parseISO(r?.created_at);
      if (!d) continue;
      const key = keyByGranularity(d, granularity);
      const currentValue = bucket.get(key) || 0;
      bucket.set(key, currentValue + num(r?.total));
    }
    const keys = sortKeysAsc(Array.from(bucket.keys()));
    return {
      labels: keys,
      values: keys.map((k) => Math.round(num(bucket.get(k) || 0))),
    };
  }, [salesFiltered, granularity]);

  /* ====================== INVENTORY ====================== */
  const LOW_STOCK_THRESHOLD = 5;

  const inventoryKPIs = useMemo(() => {
    const totalSkus = products.length;
    const lowStock = products.filter(
      (p) => num(p?.quantity) <= LOW_STOCK_THRESHOLD
    ).length;

    const stockValueByPrice = products.reduce(
      (acc, p) => acc + num(p?.price) * num(p?.quantity),
      0
    );

    const stockValueByCost = products.some((p) => "cost_price" in p)
      ? products.reduce(
          (acc, p) => acc + num(p?.cost_price) * num(p?.quantity),
          0
        )
      : null;

    return { totalSkus, lowStock, stockValueByPrice, stockValueByCost };
  }, [products]);

  const topCategories = useMemo(() => {
    const m = new Map();
    products.forEach((p) => {
      const key = p?.category || p?.category_name || "Без категории";
      m.set(key, num(m.get(key)) + 1);
    });
    return Array.from(m.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);
  }, [products]);

  const lowStockList = useMemo(
    () =>
      [...products]
        .sort((a, b) => num(a?.quantity) - num(b?.quantity))
        .slice(0, 10),
    [products]
  );

  // ABC по стоимости запаса
  const abcStats = useMemo(() => {
    if (!products.length) return { A: 0, B: 0, C: 0, list: [] };
    const items = products.map((p) => {
      const value =
        "cost_price" in p
          ? num(p.cost_price) * num(p.quantity)
          : num(p.price) * num(p.quantity);
      return { id: p.id, name: p.name, value };
    });
    items.sort((a, b) => b.value - a.value);
    const total = items.reduce((s, x) => s + x.value, 0) || 1;
    let acc = 0;
    let A = 0,
      B = 0,
      C = 0;
    const tagged = items.map((it) => {
      acc += it.value;
      const share = acc / total;
      let tag = "C";
      if (share <= 0.8) tag = "A";
      else if (share <= 0.95) tag = "B";
      if (tag === "A") A += 1;
      else if (tag === "B") B += 1;
      else C += 1;
      return { ...it, tag };
    });
    return { A, B, C, list: tagged.slice(0, 10) };
  }, [products]);

  /* ====================== TAXONOMY ====================== */
  const brandStats = useMemo(() => {
    const m = new Map();
    products.forEach((p) => {
      const key = p?.brand || p?.brand_name || "Без бренда";
      m.set(key, num(m.get(key)) + 1);
    });
    const pairs = Array.from(m.entries()).sort((a, b) => b[1] - a[1]);
    return { total: brands.length || pairs.length, top: pairs.slice(0, 10) };
  }, [products, brands]);

  const categoryStats = useMemo(() => {
    const m = new Map();
    products.forEach((p) => {
      const key = p?.category || p?.category_name || "Без категории";
      m.set(key, num(m.get(key)) + 1);
    });
    const pairs = Array.from(m.entries()).sort((a, b) => b[1] - a[1]);
    return {
      total: categories.length || pairs.length,
      top: pairs.slice(0, 10),
    };
  }, [products, categories]);

  /* ====================== CASHBOX (бизнес-аналитика) ====================== */
  const [boxes, setBoxes] = useState([]);
  const [flows, setFlows] = useState([]);
  const [boxId, setBoxId] = useState("all");
  const [cashLoading, setCashLoading] = useState(false);
  const [cashError, setCashError] = useState("");

  // загрузка касс
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await api.get("/construction/cashboxes/", {
          params: { page_size: 1000 },
        });
        if (!cancelled) {
          const boxesList = listFrom(res);
          setBoxes(boxesList);
          // Автоматически выбираем первую кассу по индексу
          if (boxesList.length > 0) {
            const firstBoxId = boxesList[0]?.id || boxesList[0]?.uuid || "";
            if (firstBoxId) {
              setBoxId(firstBoxId);
            }
          }
        }
      } catch (e) {
        if (!cancelled) setBoxes([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Всегда выбираем первую кассу по индексу при изменении списка касс
  useEffect(() => {
    if (boxes.length > 0 && (!boxId || boxId === "all")) {
      const firstBoxId = boxes[0]?.id || boxes[0]?.uuid || "";
      if (firstBoxId) {
        setBoxId(firstBoxId);
      }
    }
  }, [boxes]);

  /* ---------- Refresh handler (moved after loadFlows definition) ---------- */
  const handleRefresh = () => {
    dispatch(historySellProduct({ search: "" }));
    dispatch(fetchProductsAsync({ page: 1, page_size: 1000 }));
    dispatch(fetchBrandsAsync());
    dispatch(fetchCategoriesAsync());
    loadFlows();
  };

  // загрузка cashflows (всё сразу, фильтруем по периоду и кассе на клиенте)
  const loadFlows = async () => {
    setCashError("");
    setCashLoading(true);
    try {
      const params = { page_size: 1000 };
      if (boxId !== "all") params.cashbox = boxId;
      const r = await api.get("/construction/cashflows/", { params });
      const raw = listFrom(r) || [];

      const normalized = raw.map((x, i) => {
        const rawAmt = num(x.amount ?? x.sum ?? x.value ?? x.total ?? 0);
        let type = String(x.type ?? x.kind ?? x.direction ?? "")
          .toLowerCase()
          .trim();

        // Если тип не указан явно, определяем по знаку суммы
        // Отрицательная сумма = расход, положительная = приход
        if (type !== "income" && type !== "expense") {
          type = rawAmt < 0 ? "expense" : "income";
        }

        // Всегда используем абсолютное значение суммы для хранения
        // но сохраняем информацию о типе операции
        const amount = Math.abs(rawAmt);

        const cashboxId = x.cashbox?.id || x.cashbox || x.cashbox_uuid || null;
        const cashboxName =
          x.cashbox?.department_name ||
          x.cashbox?.name ||
          x.cashbox_name ||
          null;
        return {
          id: x.id || x.uuid || `${i}`,
          type, // 'income' | 'expense'
          amount, // всегда положительное значение
          title:
            x.title ||
            x.name ||
            x.description ||
            x.note ||
            (type === "income" ? "Приход" : "Расход"),
          created_at:
            x.created_at ||
            x.created ||
            x.date ||
            x.timestamp ||
            x.createdAt ||
            null,
          cashboxId,
          cashboxName,
        };
      });

      setFlows(normalized);
    } catch (e) {
      console.error(e);
      setCashError("Не удалось загрузить операции кассы");
      setFlows([]);
    } finally {
      setCashLoading(false);
    }
  };

  useEffect(() => {
    loadFlows();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boxId]);

  // отфильтрованные по диапазону
  const flowsFiltered = useMemo(() => {
    return flows.filter((f) => inRange(parseISO(f.created_at)));
  }, [flows, startDate, endDate]);

  const cashTotals = useMemo(() => {
    let income = 0,
      expense = 0;
    for (const f of flowsFiltered) {
      const amt = num(f.amount);
      if (f.type === "income") {
        income += amt;
      } else if (f.type === "expense") {
        expense += amt;
      }
      // Если тип не определен, пропускаем запись (не должно происходить после нормализации)
    }
    return { income, expense, net: income - expense };
  }, [flowsFiltered]);

  const cashSeries = useMemo(() => {
    const inc = new Map();
    const exp = new Map();
    for (const f of flowsFiltered) {
      const d = parseISO(f.created_at);
      if (!d) continue;
      const k = keyByGranularity(d, granularity);
      // Используем 0 как значение по умолчанию, если ключа нет
      const currentInc = inc.get(k) || 0;
      const currentExp = exp.get(k) || 0;
      if (f.type === "income") {
        inc.set(k, currentInc + num(f.amount));
      } else if (f.type === "expense") {
        exp.set(k, currentExp + num(f.amount));
      }
    }
    const keys = sortKeysAsc(
      Array.from(new Set([...inc.keys(), ...exp.keys()]))
    );
    const incomeVals = keys.map((k) => Math.round(num(inc.get(k) || 0)));
    const expenseVals = keys.map((k) => Math.round(num(exp.get(k) || 0)));
    const netVals = keys.map((_, i) =>
      Math.round(num(incomeVals[i]) - num(expenseVals[i]))
    );
    return { labels: keys, incomeVals, expenseVals, netVals };
  }, [flowsFiltered, granularity]);

  const perBox = useMemo(() => {
    const map = new Map();
    for (const f of flowsFiltered) {
      const id = f.cashboxId || "—";
      const name =
        f.cashboxName ||
        boxes.find((b) => (b.id || b.uuid) === id)?.department_name ||
        boxes.find((b) => (b.id || b.uuid) === id)?.name ||
        "—";
      const cur = map.get(id) || { name, income: 0, expense: 0 };
      const amt = num(f.amount);
      if (f.type === "income") {
        cur.income += amt;
      } else if (f.type === "expense") {
        cur.expense += amt;
      }
      map.set(id, cur);
    }
    const rows = Array.from(map.entries()).map(([id, v]) => ({
      id,
      name: v.name,
      income: v.income,
      expense: v.expense,
      net: v.income - v.expense,
    }));
    rows.sort((a, b) => b.net - a.net);
    return rows;
  }, [flowsFiltered, boxes]);

  const topExpenseByTitle = useMemo(() => {
    const m = new Map();
    for (const f of flowsFiltered) {
      if (f.type !== "expense") continue;
      const key = (f.title || "Расход").toString();
      m.set(key, num(m.get(key)) + f.amount);
    }
    return Array.from(m.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);
  }, [flowsFiltered]);

  // Прочие расходы - кассы с is_consumption: true
  const consumptionBoxes = useMemo(() => {
    return boxes.filter((box) => box.is_consumption === true);
  }, [boxes]);

  const consumptionFlows = useMemo(() => {
    if (!consumptionBoxes.length) return [];
    const consumptionBoxIds = consumptionBoxes.map((box) => box.id || box.uuid);
    return flowsFiltered.filter((flow) =>
      consumptionBoxIds.includes(flow.cashboxId)
    );
  }, [flowsFiltered, consumptionBoxes]);

  const consumptionTotals = useMemo(() => {
    let income = 0,
      expense = 0;
    for (const f of consumptionFlows) {
      const amt = num(f.amount);
      if (f.type === "income") {
        income += amt;
      } else if (f.type === "expense") {
        expense += amt;
      }
    }
    return { income, expense, net: income - expense };
  }, [consumptionFlows]);

  const consumptionByBox = useMemo(() => {
    const map = new Map();
    for (const f of consumptionFlows) {
      const id = f.cashboxId || "—";
      const name = f.cashboxName || "—";
      const cur = map.get(id) || { name, income: 0, expense: 0 };
      const amt = num(f.amount);
      if (f.type === "income") {
        cur.income += amt;
      } else if (f.type === "expense") {
        cur.expense += amt;
      }
      map.set(id, cur);
    }
    const rows = Array.from(map.entries()).map(([id, v]) => ({
      id,
      name: v.name,
      income: v.income,
      expense: v.expense,
      net: v.income - v.expense,
    }));
    rows.sort((a, b) => b.expense - a.expense);
    return rows;
  }, [consumptionFlows]);

  /* ====================== Export functions ====================== */
  const exportSalesData = () => {
    const data = salesFiltered.map((r, i) => ({
      "#": i + 1,
      Пользователь: r?.user_display || "—",
      Сумма: num(r?.total),
      Статус: r?.status || "—",
      Дата: r?.created_at ? new Date(r.created_at).toLocaleString() : "—",
    }));
    exportToCSV(data, "sales");
  };

  const exportCashFlows = () => {
    const data = flowsFiltered.map((f, i) => ({
      "#": i + 1,
      Тип: f.type === "income" ? "Приход" : "Расход",
      Статья: f.title,
      Сумма: f.amount,
      Касса: f.cashboxName || "—",
      Дата: f.created_at ? new Date(f.created_at).toLocaleString() : "—",
    }));
    exportToCSV(data, "cashflows");
  };

  const exportInventory = () => {
    const data = products.map((p) => ({
      Название: p?.name || "—",
      Категория: p?.category || p?.category_name || "—",
      Бренд: p?.brand || p?.brand_name || "—",
      Цена: num(p?.price),
      "Закупочная цена": num(p?.purchase_price || p?.cost_price || 0),
      Количество: num(p?.quantity),
      Стоимость: num(p?.price) * num(p?.quantity),
    }));
    exportToCSV(data, "inventory");
  };

  /* ====================== Filtered data with search ====================== */
  const filteredSalesForTable = useMemo(() => {
    if (!searchQuery.trim()) return salesFiltered.slice(0, 10);
    const q = searchQuery.toLowerCase();
    return salesFiltered
      .filter((r) => {
        const user = (r?.user_display || "").toLowerCase();
        const status = (r?.status || "").toLowerCase();
        const total = String(num(r?.total));
        return user.includes(q) || status.includes(q) || total.includes(q);
      })
      .slice(0, 10);
  }, [salesFiltered, searchQuery]);

  const filteredCashFlowsForTable = useMemo(() => {
    if (!searchQuery.trim()) return flowsFiltered.slice(0, 50);
    const q = searchQuery.toLowerCase();
    return flowsFiltered
      .filter((f) => {
        const title = (f.title || "").toLowerCase();
        const cashbox = (f.cashboxName || "").toLowerCase();
        const type = f.type === "income" ? "приход" : "расход";
        return title.includes(q) || cashbox.includes(q) || type.includes(q);
      })
      .slice(0, 50);
  }, [flowsFiltered, searchQuery]);

  /* ====================== BRANCHES ANALYTICS ====================== */
  // Аналитика по филиалам
  const branchAnalytics = useMemo(() => {
    if (!branches.length) return [];

    return branches.map((branch) => {
      const branchId = branch.id || branch.uuid;

      // Продажи по филиалу
      const branchSales = salesFiltered.filter(
        (sale) => sale.branch === branchId || sale.branch_id === branchId
      );
      const branchSalesRevenue = branchSales.reduce(
        (acc, r) => acc + num(r?.total),
        0
      );

      // Касса по филиалу
      // Находим кассы, принадлежащие филиалу
      const branchBoxes = boxes.filter((b) => {
        const boxBranchId = b.branch || b.branch_id || b.branch_uuid;
        return (
          boxBranchId === branchId ||
          boxBranchId === branch?.id ||
          boxBranchId === branch?.uuid
        );
      });
      const branchBoxIds = branchBoxes
        .map((b) => b.id || b.uuid)
        .filter(Boolean);

      // Фильтруем потоки по кассам филиала
      const branchFlows = flowsFiltered.filter((flow) => {
        if (!flow.cashboxId) return false;
        return branchBoxIds.includes(flow.cashboxId);
      });
      const branchCashIncome = branchFlows
        .filter((f) => f.type === "income")
        .reduce((acc, f) => acc + num(f.amount), 0);
      const branchCashExpense = branchFlows
        .filter((f) => f.type === "expense")
        .reduce((acc, f) => acc + num(f.amount), 0);

      // Склад по филиалу
      const branchProducts = products.filter(
        (p) => p.branch === branchId || p.branch_id === branchId
      );
      const branchStockValue = branchProducts.reduce(
        (acc, p) => acc + num(p?.price) * num(p?.quantity),
        0
      );

      return {
        id: branchId,
        name: branch.name || branch.department_name || "Филиал",
        sales: {
          count: branchSales.length,
          revenue: branchSalesRevenue,
        },
        cashbox: {
          income: branchCashIncome,
          expense: branchCashExpense,
          net: branchCashIncome - branchCashExpense,
        },
        warehouse: {
          productsCount: branchProducts.length,
          stockValue: branchStockValue,
        },
      };
    });
  }, [branches, salesFiltered, flowsFiltered, boxes, products]);

  /* ====================== UI ====================== */
  // Проверяем, является ли пользователь филиалом
  // Если у пользователя есть branch_ids, это означает, что он является филиалом
  const isBranchUser =
    profile?.branch_ids &&
    Array.isArray(profile.branch_ids) &&
    profile.branch_ids.length > 0;

  const TABS = [
    { key: "sales", label: "Продажи" },
    { key: "inventory", label: "Склад" },
    // { key: "taxonomy", label: "Бренды/Категории" },
    { key: "cashbox", label: "Касса" },
    // Показываем вкладку "Филиалы" только если есть филиалы И пользователь НЕ является филиалом
    ...(branches.length > 0 && !isBranchUser
      ? [{ key: "branches", label: "Филиалы" }]
      : []),
  ];

  return (
    <div className="analytics">
      {/* Header with actions */}
      <div className="analytics__header">
        <h2 className="analytics__title">Аналитика</h2>
        <div className="analytics__actions">
          <button
            onClick={handleRefresh}
            className="analytics__refresh-btn"
            title="Обновить данные"
          >
            <RefreshCw size={16} />
            <span className="analytics__refresh-text">Обновить</span>
          </button>
        </div>
      </div>

      <div
        className="analytics__tabs"
        role="tablist"
        aria-label="Вкладки аналитики"
      >
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className={`analytics__tab ${
              activeTab === t.key ? "analytics__tab--active" : ""
            }`}
            role="tab"
            aria-selected={activeTab === t.key}
            aria-controls={`panel-${t.key}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ---------------- SALES ---------------- */}
      {activeTab === "sales" && (
        <section
          id="panel-sales"
          className="analytics-sales"
          role="tabpanel"
          aria-labelledby="sales"
        >
          <div className="analytics-sales__controls">
            <div
              className="analytics-sales__presets"
              role="group"
              aria-label="Быстрые периоды"
            >
              <button onClick={() => quickPreset("thisMonth")}>
                Этот месяц
              </button>
              <button onClick={() => quickPreset("lastMonth")}>
                Прошлый месяц
              </button>
              <button onClick={() => quickPreset("ytd")}>Год-к-дате</button>
              <button onClick={() => quickPreset("thisYear")}>Весь год</button>
              <button onClick={() => quickPreset("lastYear")}>
                Прошлый год
              </button>
            </div>
            <div className="analytics-sales__range">
              <label className="analytics-sales__label">
                С
                <input
                  type="date"
                  className="analytics-sales__input"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  max={endDate}
                />
              </label>
              <label className="analytics-sales__label">
                До
                <input
                  type="date"
                  className="analytics-sales__input"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  min={startDate}
                  max={new Date().toISOString().slice(0, 10)}
                />
              </label>

              <div
                className="analytics-sales__segmented"
                role="group"
                aria-label="Гранулярность"
              >
                <button
                  className={granularity === "day" ? "is-active" : ""}
                  onClick={() => setGranularity("day")}
                >
                  Дни
                </button>
                <button
                  className={granularity === "month" ? "is-active" : ""}
                  onClick={() => setGranularity("month")}
                >
                  Месяцы
                </button>
                <button
                  className={granularity === "year" ? "is-active" : ""}
                  onClick={() => setGranularity("year")}
                >
                  Годы
                </button>
              </div>
            </div>
          </div>

          <div className="analytics-sales__kpis">
            <div className="analytics-sales__kpi">
              <div className="analytics-sales__kpi-label">
                Число продаж
                {previousPeriodSales && (
                  <TrendIndicator
                    current={salesTotals.count}
                    previous={previousPeriodSales.count}
                    format={(n) => nfInt.format(n)}
                  />
                )}
              </div>
              <div className="analytics-sales__kpi-value">
                {nfInt.format(salesTotals.count)}
              </div>
            </div>
            <div className="analytics-sales__kpi">
              <div className="analytics-sales__kpi-label">
                Выручка
                {previousPeriodSales && (
                  <TrendIndicator
                    current={salesTotals.revenue}
                    previous={previousPeriodSales.revenue}
                    format={(n) => nfMoney.format(n)}
                  />
                )}
              </div>
              <div className="analytics-sales__kpi-value">
                {nfMoney.format(salesTotals.revenue)}
              </div>
            </div>
            <div className="analytics-sales__kpi">
              <div className="analytics-sales__kpi-label">
                Средний чек
                {previousPeriodSales && (
                  <TrendIndicator
                    current={salesTotals.avg}
                    previous={previousPeriodSales.avg}
                    format={(n) => nfMoney.format(n)}
                  />
                )}
              </div>
              <div className="analytics-sales__kpi-value">
                {nfMoney.format(salesTotals.avg)}
              </div>
            </div>
          </div>

          <div className="analytics-sales__card">
            {salesLoading ? (
              <div className="analytics-sales__note">
                Загрузка истории продаж…
              </div>
            ) : salesError ? (
              <div className="analytics-sales__error">
                Ошибка: {String(salesError)}
              </div>
            ) : (
              <>
                <div className="analytics-sales__card-title">
                  Динамика выручки (
                  {granularity === "day"
                    ? "дни"
                    : granularity === "month"
                    ? "месяцы"
                    : "годы"}
                  )
                </div>
                <Sparkline values={salesSeries.values} />
                <div
                  className="analytics-sales__legend"
                  aria-label="Подписи оси X"
                >
                  {salesSeries.labels.map((l, i) => (
                    <span className="analytics-sales__legend-item" key={i}>
                      {l}
                    </span>
                  ))}
                </div>
              </>
            )}
          </div>

          <div className="analytics-sales__card">
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 16,
              }}
            >
              <div className="analytics-sales__card-title">
                Последние продажи
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <div
                  style={{
                    position: "relative",
                    display: "flex",
                    alignItems: "center",
                  }}
                >
                  <Search
                    size={16}
                    style={{
                      position: "absolute",
                      left: 10,
                      opacity: 0.5,
                      pointerEvents: "none",
                    }}
                  />
                  <input
                    type="text"
                    placeholder="Поиск..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    style={{
                      padding: "6px 12px 6px 32px",
                      border: "1px solid var(--c-border, #ccc)",
                      borderRadius: 6,
                      fontSize: 14,
                      width: 200,
                    }}
                  />
                </div>
                <button
                  onClick={exportSalesData}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "6px 12px",
                    background: "var(--c-accent, #f9cf00)",
                    border: "none",
                    borderRadius: 6,
                    cursor: "pointer",
                    fontSize: 14,
                  }}
                  title="Экспорт в CSV"
                >
                  <Download size={16} />
                  Экспорт
                </button>
              </div>
            </div>
            {filteredSalesForTable.length ? (
              <div
                className="analytics-sales__table-wrap"
                role="region"
                aria-label="Таблица продаж"
              >
                <table className="analytics-sales__table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Пользователь</th>
                      <th>Сумма</th>
                      <th>Статус</th>
                      <th>Дата</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredSalesForTable.map((r, i) => (
                      <tr key={r?.id ?? i}>
                        <td>{i + 1}</td>
                        <td>{r?.user_display || "—"}</td>
                        <td>{nfMoney.format(num(r?.total))}</td>
                        <td>{r?.status || "—"}</td>
                        <td>
                          {r?.created_at
                            ? new Date(r.created_at).toLocaleString()
                            : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {searchQuery &&
                  filteredSalesForTable.length < salesFiltered.length && (
                    <div
                      style={{
                        padding: 12,
                        textAlign: "center",
                        opacity: 0.7,
                        fontSize: 14,
                      }}
                    >
                      Показано {filteredSalesForTable.length} из{" "}
                      {salesFiltered.length} записей
                    </div>
                  )}
              </div>
            ) : (
              <div className="analytics-sales__note">
                {searchQuery
                  ? "Ничего не найдено по запросу"
                  : "Нет продаж в выбранном периоде."}
              </div>
            )}
          </div>
        </section>
      )}

      {/* ---------------- INVENTORY ---------------- */}
      {activeTab === "inventory" && (
        <section
          id="panel-inventory"
          className="analytics-inventory"
          role="tabpanel"
        >
          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              marginBottom: 16,
            }}
          >
            <button
              onClick={exportInventory}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "8px 16px",
                background: "var(--c-accent, #f9cf00)",
                border: "none",
                borderRadius: 6,
                cursor: "pointer",
                fontSize: 14,
              }}
              title="Экспорт в CSV"
            >
              <Download size={16} />
              Экспорт склада
            </button>
          </div>
          <div className="analytics-inventory__kpis">
            <div className="analytics-inventory__kpi">
              <div className="analytics-inventory__kpi-label">Всего SKU</div>
              <div className="analytics-inventory__kpi-value">
                {nfInt.format(products.length)}
              </div>
            </div>
            <div className="analytics-inventory__kpi">
              <div className="analytics-inventory__kpi-label">
                Стоимость склада
              </div>
              <div className="analytics-inventory__kpi-value">
                {inventoryKPIs.stockValueByCost != null
                  ? nfMoney.format(inventoryKPIs.stockValueByCost)
                  : nfMoney.format(inventoryKPIs.stockValueByPrice)}
              </div>
            </div>
            <div className="analytics-inventory__kpi">
              <div className="analytics-inventory__kpi-label">
                Низкие остатки (≤5)
              </div>
              <div className="analytics-inventory__kpi-value">
                {nfInt.format(inventoryKPIs.lowStock)}
              </div>
            </div>
          </div>

          <div className="analytics-inventory__grid">
            <div className="analytics-inventory__card">
              <div className="analytics-inventory__card-title">
                Топ-10 категорий по кол-ву SKU
              </div>
              <ul
                className="analytics-inventory__bars"
                aria-label="Топ категорий"
              >
                {topCategories.length ? (
                  topCategories.map(([name, count], i) => {
                    const max = topCategories[0][1] || 1;
                    const width = clamp(
                      Math.round((count / max) * 100),
                      5,
                      100
                    );
                    return (
                      <li className="analytics-inventory__bar" key={i}>
                        <span
                          className="analytics-inventory__bar-name"
                          title={name}
                        >
                          {name}
                        </span>
                        <span className="analytics-inventory__bar-track">
                          <span
                            className="analytics-inventory__bar-fill"
                            style={{ width: `${width}%` }}
                          />
                        </span>
                        <span className="analytics-inventory__bar-value">
                          {nfInt.format(count)}
                        </span>
                      </li>
                    );
                  })
                ) : (
                  <li className="analytics-inventory__empty">Нет данных</li>
                )}
              </ul>
            </div>

            <div className="analytics-inventory__card">
              <div className="analytics-inventory__card-title">
                Топ-10 с минимальными остатками
              </div>
              <ul
                className="analytics-inventory__list"
                aria-label="Минимальные остатки"
              >
                {lowStockList.length ? (
                  lowStockList.map((p, i) => (
                    <li className="analytics-inventory__row" key={p?.id ?? i}>
                      <span
                        className="analytics-inventory__row-name"
                        title={p?.name || "—"}
                      >
                        {p?.name || "—"}
                      </span>
                      <span className="analytics-inventory__row-qty">
                        Остаток: {nfInt.format(num(p?.quantity))}
                      </span>
                    </li>
                  ))
                ) : (
                  <li className="analytics-inventory__empty">Нет данных</li>
                )}
              </ul>
            </div>
          </div>

          <div className="analytics-inventory__card">
            <div className="analytics-inventory__card-title">
              ABC по стоимости запаса
            </div>
            <div className="analytics-inventory__abc">
              <div className="analytics-inventory__abc-badge analytics-inventory__abc-badge--a">
                A: {nfInt.format(abcStats.A)}
              </div>
              <div className="analytics-inventory__abc-badge analytics-inventory__abc-badge--b">
                B: {nfInt.format(abcStats.B)}
              </div>
              <div className="analytics-inventory__abc-badge analytics-inventory__abc-badge--c">
                C: {nfInt.format(abcStats.C)}
              </div>
            </div>
            <ul className="analytics-inventory__list" aria-label="ABC Товары">
              {abcStats.list.length ? (
                abcStats.list.map((it, i) => (
                  <li className="analytics-inventory__row" key={it.id ?? i}>
                    <span
                      className="analytics-inventory__row-name"
                      title={it.name}
                    >
                      {it.name}
                    </span>
                    <span className="analytics-inventory__row-qty">
                      {it.tag} · {nfMoney.format(it.value)}
                    </span>
                  </li>
                ))
              ) : (
                <li className="analytics-inventory__empty">Нет данных</li>
              )}
            </ul>
            <p className="analytics-inventory__note">
              * Если есть <code>cost_price</code>, используется он. Иначе
              считаем по <code>price</code>.
            </p>
          </div>
        </section>
      )}

      {/* ---------------- TAXONOMY ---------------- */}
      {activeTab === "taxonomy" && (
        <section
          id="panel-taxonomy"
          className="analytics-taxonomy"
          role="tabpanel"
        >
          <div className="analytics-taxonomy__grid">
            <div className="analytics-taxonomy__card">
              <div className="analytics-taxonomy__card-title">
                Бренды{" "}
                <span className="analytics-taxonomy__muted">
                  (всего: {nfInt.format(brandStats.total)})
                </span>
              </div>
              <ul className="analytics-taxonomy__bars" aria-label="Бренды">
                {brandStats.top.length ? (
                  brandStats.top.map(([name, count], i) => {
                    const max = brandStats.top[0][1] || 1;
                    const width = clamp(
                      Math.round((count / max) * 100),
                      5,
                      100
                    );
                    return (
                      <li className="analytics-taxonomy__bar" key={i}>
                        <span
                          className="analytics-taxonomy__bar-name"
                          title={name}
                        >
                          {name}
                        </span>
                        <span className="analytics-taxonomy__bar-track">
                          <span
                            className="analytics-taxonomy__bar-fill"
                            style={{ width: `${width}%` }}
                          />
                        </span>
                        <span className="analytics-taxonomy__bar-value">
                          {nfInt.format(count)}
                        </span>
                      </li>
                    );
                  })
                ) : (
                  <li className="analytics-taxonomy__empty">Нет данных</li>
                )}
              </ul>
            </div>

            <div className="analytics-taxonomy__card">
              <div className="analytics-taxonomy__card-title">
                Категории{" "}
                <span className="analytics-taxonomy__muted">
                  (всего: {nfInt.format(categoryStats.total)})
                </span>
              </div>
              <ul className="analytics-taxonomy__bars" aria-label="Категории">
                {categoryStats.top.length ? (
                  categoryStats.top.map(([name, count], i) => {
                    const max = categoryStats.top[0][1] || 1;
                    const width = clamp(
                      Math.round((count / max) * 100),
                      5,
                      100
                    );
                    return (
                      <li className="analytics-taxonomy__bar" key={i}>
                        <span
                          className="analytics-taxonomy__bar-name"
                          title={name}
                        >
                          {name}
                        </span>
                        <span className="analytics-taxonomy__bar-track">
                          <span
                            className="analytics-taxonomy__bar-fill"
                            style={{ width: `${width}%` }}
                          />
                        </span>
                        <span className="analytics-taxonomy__bar-value">
                          {nfInt.format(count)}
                        </span>
                      </li>
                    );
                  })
                ) : (
                  <li className="analytics-taxonomy__empty">Нет данных</li>
                )}
              </ul>
            </div>
          </div>
        </section>
      )}

      {/* ---------------- CASHBOX ---------------- */}
      {activeTab === "cashbox" && (
        <section
          id="panel-cashbox"
          className="analytics-cashbox"
          role="tabpanel"
        >
          <div className="analytics-cashbox__controls">
            <div
              className="analytics-cashbox__presets"
              role="group"
              aria-label="Быстрые периоды"
            >
              <button onClick={() => quickPreset("thisMonth")}>
                Этот месяц
              </button>
              <button onClick={() => quickPreset("lastMonth")}>
                Прошлый месяц
              </button>
              <button onClick={() => quickPreset("ytd")}>Год-к-дате</button>
              <button onClick={() => quickPreset("thisYear")}>Весь год</button>
              <button onClick={() => quickPreset("lastYear")}>
                Прошлый год
              </button>
            </div>
            <div className="analytics-cashbox__range">
              <label className="analytics-cashbox__label">
                С
                <input
                  type="date"
                  className="analytics-cashbox__input"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  max={endDate}
                />
              </label>
              <label className="analytics-cashbox__label">
                До
                <input
                  type="date"
                  className="analytics-cashbox__input"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  min={startDate}
                  max={new Date().toISOString().slice(0, 10)}
                />
              </label>

              <div
                className="analytics-cashbox__segmented"
                role="group"
                aria-label="Гранулярность"
              >
                <button
                  className={granularity === "day" ? "is-active" : ""}
                  onClick={() => setGranularity("day")}
                >
                  Дни
                </button>
                <button
                  className={granularity === "month" ? "is-active" : ""}
                  onClick={() => setGranularity("month")}
                >
                  Месяцы
                </button>
                <button
                  className={granularity === "year" ? "is-active" : ""}
                  onClick={() => setGranularity("year")}
                >
                  Годы
                </button>
              </div>
            </div>
          </div>

          <div className="analytics-cashbox__kpis">
            <div className="analytics-cashbox__kpi">
              <div className="analytics-cashbox__kpi-label">Приход</div>
              <div className="analytics-cashbox__kpi-value">
                {nfMoney.format(cashTotals.income)}
              </div>
            </div>
            <div className="analytics-cashbox__kpi">
              <div className="analytics-cashbox__kpi-label">Расход</div>
              <div className="analytics-cashbox__kpi-value">
                {nfMoney.format(cashTotals.expense)}
              </div>
            </div>
            <div className="analytics-cashbox__kpi">
              <div className="analytics-cashbox__kpi-label">Сальдо</div>
              <div className="analytics-cashbox__kpi-value">
                {nfMoney.format(cashTotals.net)}
              </div>
            </div>
          </div>

          <div className="analytics-cashbox__grid">
            <div className="analytics-cashbox__card">
              <div className="analytics-cashbox__card-title">
                Динамика чистого потока (
                {granularity === "day"
                  ? "дни"
                  : granularity === "month"
                  ? "месяцы"
                  : "годы"}
                )
              </div>
              {cashLoading ? (
                <div className="analytics-cashbox__note">
                  Загрузка операций…
                </div>
              ) : cashError ? (
                <div className="analytics-cashbox__error">{cashError}</div>
              ) : (
                <>
                  <Sparkline values={cashSeries.netVals} />
                  <div
                    className="analytics-sales__legend"
                    aria-label="Подписи оси X"
                  >
                    {cashSeries.labels.map((l, i) => (
                      <span className="analytics-sales__legend-item" key={i}>
                        {l}
                      </span>
                    ))}
                  </div>
                </>
              )}
            </div>

            <div className="analytics-cashbox__card">
              <div className="analytics-cashbox__card-title">
                Срез по кассам
              </div>
              <div
                className="analytics-sales__table-wrap"
                role="region"
                aria-label="Срез по кассам"
              >
                <table className="analytics-sales__table">
                  <thead>
                    <tr>
                      <th>Касса</th>
                      <th>Приход</th>
                      <th>Расход</th>
                      <th>Сальдо</th>
                    </tr>
                  </thead>
                  <tbody>
                    {perBox.length ? (
                      perBox.map((r) => (
                        <tr key={r.id}>
                          <td>{r.name}</td>
                          <td>{nfMoney.format(r.income)}</td>
                          <td>{nfMoney.format(r.expense)}</td>
                          <td>{nfMoney.format(r.net)}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={4}>Нет данных</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="analytics-cashbox__card">
              <div className="analytics-cashbox__card-title">
                Топ-10 статей расхода
              </div>
              <ul
                className="analytics-cashbox__bars"
                aria-label="Топ статей расхода"
              >
                {topExpenseByTitle.length ? (
                  topExpenseByTitle.map(([title, sum], i) => {
                    const max = topExpenseByTitle[0][1] || 1;
                    const width = clamp(Math.round((sum / max) * 100), 5, 100);
                    return (
                      <li className="analytics-cashbox__bar" key={i}>
                        <span
                          className="analytics-cashbox__bar-name"
                          title={title}
                        >
                          {title}
                        </span>
                        <span className="analytics-cashbox__bar-track">
                          <span
                            className="analytics-cashbox__bar-fill"
                            style={{ width: `${width}%` }}
                          />
                        </span>
                        <span className="analytics-cashbox__bar-value">
                          {nfMoney.format(sum)}
                        </span>
                      </li>
                    );
                  })
                ) : (
                  <li className="analytics-cashbox__empty">Нет данных</li>
                )}
              </ul>
            </div>
          </div>

          <div className="analytics-cashbox__card analytics-sales__card--scroll">
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 16,
              }}
            >
              <div className="analytics-cashbox__card-title">
                Последние операции
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <div
                  style={{
                    position: "relative",
                    display: "flex",
                    alignItems: "center",
                  }}
                >
                  <Search
                    size={16}
                    style={{
                      position: "absolute",
                      left: 10,
                      opacity: 0.5,
                      pointerEvents: "none",
                    }}
                  />
                  <input
                    type="text"
                    placeholder="Поиск..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    style={{
                      padding: "6px 12px 6px 32px",
                      border: "1px solid var(--c-border, #ccc)",
                      borderRadius: 6,
                      fontSize: 14,
                      width: 200,
                    }}
                  />
                </div>
                <button
                  onClick={exportCashFlows}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "6px 12px",
                    background: "var(--c-accent, #f9cf00)",
                    border: "none",
                    borderRadius: 6,
                    cursor: "pointer",
                    fontSize: 14,
                  }}
                  title="Экспорт в CSV"
                >
                  <Download size={16} />
                  Экспорт
                </button>
              </div>
            </div>
            <div
              className="analytics-sales__table-wrap"
              role="region"
              aria-label="Последние операции"
            >
              <table className="analytics-sales__table">
                <thead>
                  <tr>
                    <th>Тип</th>
                    <th>Статья</th>
                    <th>Сумма</th>
                    <th>Касса</th>
                    <th>Дата</th>
                  </tr>
                </thead>
                <tbody>
                  {cashLoading ? (
                    <tr>
                      <td colSpan={5}>Загрузка…</td>
                    </tr>
                  ) : filteredCashFlowsForTable.length ? (
                    filteredCashFlowsForTable
                      .slice()
                      .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
                      .map((f, i) => (
                        <tr key={f.id ?? i}>
                          <td>
                            <span
                              style={{
                                padding: "2px 8px",
                                borderRadius: 4,
                                fontSize: 12,
                                background:
                                  f.type === "income"
                                    ? "rgba(40, 167, 69, 0.1)"
                                    : "rgba(220, 53, 69, 0.1)",
                                color:
                                  f.type === "income" ? "#28a745" : "#dc3545",
                              }}
                            >
                              {f.type === "income" ? "Приход" : "Расход"}
                            </span>
                          </td>
                          <td>{f.title}</td>
                          <td>{nfMoney.format(f.amount)}</td>
                          <td>{f.cashboxName || "—"}</td>
                          <td>
                            {f.created_at
                              ? new Date(f.created_at).toLocaleString()
                              : "—"}
                          </td>
                        </tr>
                      ))
                  ) : (
                    <tr>
                      <td colSpan={5}>
                        {searchQuery
                          ? "Ничего не найдено по запросу"
                          : "Нет операций"}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
              {searchQuery &&
                filteredCashFlowsForTable.length < flowsFiltered.length && (
                  <div
                    style={{
                      padding: 12,
                      textAlign: "center",
                      opacity: 0.7,
                      fontSize: 14,
                    }}
                  >
                    Показано {filteredCashFlowsForTable.length} из{" "}
                    {flowsFiltered.length} записей
                  </div>
                )}
            </div>
          </div>

          {cashLoading && (
            <div className="analytics__loading">Обновляем операции…</div>
          )}
        </section>
      )}

      {/* ---------------- CONSUMPTION (Прочие расходы) ---------------- */}
      {activeTab === "cashbox" && consumptionBoxes.length > 0 && (
        <section
          id="panel-consumption"
          className="analytics-consumption"
          role="tabpanel"
        >
          <div className="analytics-consumption__header">
            <h3 className="analytics-consumption__title">Прочие расходы</h3>
            <p className="analytics-consumption__subtitle">
              Кассы с пометкой "потребление" (is_consumption: true)
            </p>
          </div>

          <div className="analytics-consumption__kpis">
            <div className="analytics-consumption__kpi">
              <div className="analytics-consumption__kpi-label">Приход</div>
              <div className="analytics-consumption__kpi-value">
                {nfMoney.format(consumptionTotals.income)}
              </div>
            </div>
            <div className="analytics-consumption__kpi">
              <div className="analytics-consumption__kpi-label">Расход</div>
              <div className="analytics-consumption__kpi-value">
                {nfMoney.format(consumptionTotals.expense)}
              </div>
            </div>
            <div className="analytics-consumption__kpi">
              <div className="analytics-consumption__kpi-label">Сальдо</div>
              <div className="analytics-consumption__kpi-value">
                {nfMoney.format(consumptionTotals.net)}
              </div>
            </div>
          </div>

          <div className="analytics-consumption__grid">
            <div className="analytics-consumption__card">
              <div className="analytics-consumption__card-title">
                Срез по кассам потребления
              </div>
              <div
                className="analytics-sales__table-wrap"
                role="region"
                aria-label="Срез по кассам потребления"
              >
                <table className="analytics-sales__table">
                  <thead>
                    <tr>
                      <th>Касса</th>
                      <th>Приход</th>
                      <th>Расход</th>
                      <th>Сальдо</th>
                    </tr>
                  </thead>
                  <tbody>
                    {consumptionByBox.length ? (
                      consumptionByBox.map((r) => (
                        <tr key={r.id}>
                          <td>{r.name}</td>
                          <td>{nfMoney.format(r.income)}</td>
                          <td>{nfMoney.format(r.expense)}</td>
                          <td>{nfMoney.format(r.net)}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={4}>Нет данных</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="analytics-consumption__card">
              <div className="analytics-consumption__card-title">
                Последние операции потребления
              </div>
              <div
                className="analytics-sales__table-wrap"
                role="region"
                aria-label="Последние операции потребления"
              >
                <table className="analytics-sales__table">
                  <thead>
                    <tr>
                      <th>Тип</th>
                      <th>Статья</th>
                      <th>Сумма</th>
                      <th>Касса</th>
                      <th>Дата</th>
                    </tr>
                  </thead>
                  <tbody>
                    {consumptionFlows.length ? (
                      consumptionFlows
                        .slice()
                        .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
                        .slice(0, 20)
                        .map((f, i) => (
                          <tr key={f.id ?? i}>
                            <td>{f.type === "income" ? "Приход" : "Расход"}</td>
                            <td>{f.title}</td>
                            <td>{nfMoney.format(f.amount)}</td>
                            <td>{f.cashboxName || "—"}</td>
                            <td>
                              {f.created_at
                                ? new Date(f.created_at).toLocaleString()
                                : "—"}
                            </td>
                          </tr>
                        ))
                    ) : (
                      <tr>
                        <td colSpan={5}>Нет операций</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ---------------- BRANCHES ---------------- */}
      {activeTab === "branches" && branches.length > 0 && !isBranchUser && (
        <section
          id="panel-branches"
          className="analytics-branches"
          role="tabpanel"
        >
          <div className="analytics-branches__header">
            <h3 className="analytics-branches__title">Аналитика по филиалам</h3>
            <p className="analytics-branches__subtitle">
              Статистика по всем филиалам за выбранный период
            </p>
          </div>

          {branchesLoading ? (
            <div className="analytics-branches__loading">
              Загрузка данных о филиалах…
            </div>
          ) : branchAnalytics.length === 0 ? (
            <div className="analytics-branches__empty">
              Нет данных по филиалам
            </div>
          ) : (
            <div className="analytics-branches__grid">
              {branchAnalytics.map((branch) => (
                <div key={branch.id} className="analytics-branches__card">
                  <div className="analytics-branches__card-header">
                    <h4 className="analytics-branches__card-title">
                      {branch.name}
                    </h4>
                  </div>

                  <div className="analytics-branches__kpis">
                    <div className="analytics-branches__kpi">
                      <div className="analytics-branches__kpi-label">
                        Продажи
                      </div>
                      <div className="analytics-branches__kpi-value">
                        {nfInt.format(branch.sales.count)}
                      </div>
                      <div className="analytics-branches__kpi-subvalue">
                        {nfMoney.format(branch.sales.revenue)}
                      </div>
                    </div>

                    <div className="analytics-branches__kpi">
                      <div className="analytics-branches__kpi-label">
                        Приход
                      </div>
                      <div className="analytics-branches__kpi-value">
                        {nfMoney.format(branch.cashbox.income)}
                      </div>
                    </div>

                    <div className="analytics-branches__kpi">
                      <div className="analytics-branches__kpi-label">
                        Расход
                      </div>
                      <div className="analytics-branches__kpi-value">
                        {nfMoney.format(branch.cashbox.expense)}
                      </div>
                    </div>

                    <div className="analytics-branches__kpi">
                      <div className="analytics-branches__kpi-label">
                        Сальдо
                      </div>
                      <div
                        className="analytics-branches__kpi-value"
                        style={{
                          color:
                            branch.cashbox.net >= 0 ? "#28a745" : "#dc3545",
                        }}
                      >
                        {nfMoney.format(branch.cashbox.net)}
                      </div>
                    </div>

                    <div className="analytics-branches__kpi">
                      <div className="analytics-branches__kpi-label">
                        Товаров на складе
                      </div>
                      <div className="analytics-branches__kpi-value">
                        {nfInt.format(branch.warehouse.productsCount)}
                      </div>
                      <div className="analytics-branches__kpi-subvalue">
                        {nfMoney.format(branch.warehouse.stockValue)}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Сводная таблица по филиалам */}
          {branchAnalytics.length > 0 && (
            <div className="analytics-branches__table-card">
              <div className="analytics-branches__card-title">
                Сводная таблица по филиалам
              </div>
              <div
                className="analytics-sales__table-wrap"
                role="region"
                aria-label="Сводная таблица филиалов"
              >
                <table className="analytics-sales__table">
                  <thead>
                    <tr>
                      <th>Филиал</th>
                      <th>Продажи (кол-во)</th>
                      <th>Выручка</th>
                      <th>Приход</th>
                      <th>Расход</th>
                      <th>Сальдо</th>
                      <th>Товаров</th>
                      <th>Стоимость склада</th>
                    </tr>
                  </thead>
                  <tbody>
                    {branchAnalytics.map((branch) => (
                      <tr key={branch.id}>
                        <td style={{ fontWeight: "600" }}>{branch.name}</td>
                        <td>{nfInt.format(branch.sales.count)}</td>
                        <td>{nfMoney.format(branch.sales.revenue)}</td>
                        <td>{nfMoney.format(branch.cashbox.income)}</td>
                        <td>{nfMoney.format(branch.cashbox.expense)}</td>
                        <td
                          style={{
                            color:
                              branch.cashbox.net >= 0 ? "#28a745" : "#dc3545",
                            fontWeight: "600",
                          }}
                        >
                          {nfMoney.format(branch.cashbox.net)}
                        </td>
                        <td>{nfInt.format(branch.warehouse.productsCount)}</td>
                        <td>{nfMoney.format(branch.warehouse.stockValue)}</td>
                      </tr>
                    ))}
                    {/* Итоговая строка */}
                    <tr style={{ fontWeight: "600", background: "#f8f9fa" }}>
                      <td>Итого</td>
                      <td>
                        {nfInt.format(
                          branchAnalytics.reduce(
                            (acc, b) => acc + b.sales.count,
                            0
                          )
                        )}
                      </td>
                      <td>
                        {nfMoney.format(
                          branchAnalytics.reduce(
                            (acc, b) => acc + b.sales.revenue,
                            0
                          )
                        )}
                      </td>
                      <td>
                        {nfMoney.format(
                          branchAnalytics.reduce(
                            (acc, b) => acc + b.cashbox.income,
                            0
                          )
                        )}
                      </td>
                      <td>
                        {nfMoney.format(
                          branchAnalytics.reduce(
                            (acc, b) => acc + b.cashbox.expense,
                            0
                          )
                        )}
                      </td>
                      <td
                        style={{
                          color:
                            branchAnalytics.reduce(
                              (acc, b) => acc + b.cashbox.net,
                              0
                            ) >= 0
                              ? "#28a745"
                              : "#dc3545",
                        }}
                      >
                        {nfMoney.format(
                          branchAnalytics.reduce(
                            (acc, b) => acc + b.cashbox.net,
                            0
                          )
                        )}
                      </td>
                      <td>
                        {nfInt.format(
                          branchAnalytics.reduce(
                            (acc, b) => acc + b.warehouse.productsCount,
                            0
                          )
                        )}
                      </td>
                      <td>
                        {nfMoney.format(
                          branchAnalytics.reduce(
                            (acc, b) => acc + b.warehouse.stockValue,
                            0
                          )
                        )}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>
      )}

      {(productsLoading || salesLoading) && (
        <div className="analytics__loading">Обновляем данные…</div>
      )}
    </div>
  );
};

export default Analytics;
