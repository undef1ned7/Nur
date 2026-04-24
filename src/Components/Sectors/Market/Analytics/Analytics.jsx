import React, { useState, useMemo, useEffect } from "react";
import {
  ArrowLeft,
  DollarSign,
  ShoppingCart,
  BarChart3,
  Users,
  Package,
  TrendingUp,
  Calendar,
  HelpCircle,
  Filter,
  X,
  ChevronDown,
} from "lucide-react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Tooltip,
  Legend,
  Filler,
} from "chart.js";
import { Line, Bar, Doughnut } from "react-chartjs-2";
import { useSelector } from "react-redux";
import api from "../../../../api/index";
import { useUser } from "../../../../store/slices/userSlice";
import { useCash } from "../../../../store/slices/cashSlice";
import "./Analytics.scss";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Tooltip,
  Legend,
  Filler,
);

const translateLowStockStatus = (status) => {
  const normalized = String(status || "")
    .trim()
    .toLowerCase();
  if (normalized === "critical") return "Критично";
  if (normalized === "low") return "Низкий";
  return String(status || "Низкий").trim() || "Низкий";
};

const normalizeLowStockStatusType = (status) => {
  const normalized = String(status || "")
    .trim()
    .toLowerCase();
  if (normalized === "critical" || normalized === "критично") return "critical";
  return "low";
};

const MARKET_ANALYTICS_TIMEOUT_MS = 160000;

const Analytics = () => {
  const { company, currentUser } = useUser();
  const { list: cashBoxes } = useCash();
  const { list: branches } = useSelector(
    (state) => state.branches || { list: [] },
  );
  const [activeTab, setActiveTab] = useState("sales");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [analyticsData, setAnalyticsData] = useState(null);
  const [showFilters, setShowFilters] = useState(false);
  const [openProductTable, setOpenProductTable] = useState("topByRevenue");
  const [openFinanceTable, setOpenFinanceTable] = useState("expenseBreakdown");
  const [salaryAnalyticsRows, setSalaryAnalyticsRows] = useState([]);
  /** Вкладка «Сотрудники»: раскрытый tr с product_names / sold_products */
  const [expandedUserPerformanceId, setExpandedUserPerformanceId] =
    useState(null);
  const [period, setPeriod] = useState(() => {
    const now = new Date();
    const from = new Date(now.getFullYear(), now.getMonth(), 1);
    const to = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    return { from, to };
  });

  useEffect(() => {
    if (activeTab !== "users") setExpandedUserPerformanceId(null);
  }, [activeTab]);

  // Фильтры для всех вкладок
  const [filters, setFilters] = useState({
    branch: "",
    include_global: false,
    // Sales filters
    cashbox: "",
    shift: "",
    cashier: "",
    payment_method: "",
    min_total: "",
    max_total: "",
    purchase_date_from: "",
    purchase_date_to: "",
    // Stock filters
    product: "",
    category: "",
    kind: "",
    low_only: false,
    // Cashboxes filters (используются те же что и sales)
    // Shifts filters
    status: "",
    // Common
    limit: "",
  });

  const currentDate = new Date();
  const monthName = currentDate.toLocaleDateString("ru-RU", {
    month: "long",
    year: "numeric",
  });

  // На маркете кассу выбирать нельзя: фиксируем "Основная касса"
  const DEFAULT_CASHBOX_NAME = "Основная касса";
  const mainCashbox = useMemo(() => {
    if (!Array.isArray(cashBoxes) || cashBoxes.length === 0) return null;

    const getName = (box) => box?.name || box?.department_name || "";
    const norm = (v) =>
      String(v || "")
        .trim()
        .toLowerCase();

    const exact = cashBoxes.find(
      (box) => norm(getName(box)) === norm(DEFAULT_CASHBOX_NAME),
    );
    if (exact) return exact;

    const fuzzy = cashBoxes.find((box) => {
      const n = norm(getName(box));
      return n.includes("основ") && n.includes("кас");
    });
    return fuzzy || cashBoxes[0];
  }, [cashBoxes]);

  const mainCashboxId =
    mainCashbox?.id !== undefined && mainCashbox?.id !== null
      ? String(mainCashbox.id)
      : "";
  const mainCashboxTitle =
    mainCashbox?.name || mainCashbox?.department_name || DEFAULT_CASHBOX_NAME;

  useEffect(() => {
    if (!mainCashboxId) return;
    setFilters((prev) => {
      const prevId = prev?.cashbox ? String(prev.cashbox) : "";
      if (prevId === mainCashboxId) return prev;
      return { ...prev, cashbox: mainCashboxId };
    });
  }, [mainCashboxId]);

  // Форматирование даты для API (YYYY-MM-DD или YYYY-MM-DDTHH:MM:SS)
  const formatDateForAPI = (date, includeTime = true) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    if (!includeTime) {
      return `${year}-${month}-${day}`;
    }
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");
    const seconds = String(date.getSeconds()).padStart(2, "0");
    return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;
  };

  // Маппинг внутренних названий вкладок на названия для API
  // API поддерживает: sales|stock|cashboxes|shifts|products|suppliers|users|finance
  const mapTabToAPI = (tab) => {
    const tabMap = {
      sales: "sales",
      warehouse: "stock", // "warehouse" -> "stock" для API
      cashiers: "cashboxes", // "cashiers" -> "cashboxes" для API
      shifts: "shifts",
      products: "products",
      suppliers: "suppliers",
      users: "users",
      finance: "finance",
    };
    return tabMap[tab] || "sales";
  };

  // Загрузка данных аналитики
  const fetchAnalytics = React.useCallback(
    async (tab = "sales") => {
      setLoading(true);
      setError(null);
      try {
        // Преобразуем внутреннее название вкладки в название для API
        const apiTab = mapTabToAPI(tab);
        const params = {
          tab: apiTab,
          period_start: formatDateForAPI(period.from, false),
          period_end: formatDateForAPI(period.to, false),
        };

        // Добавляем branch и include_global если branch выбран
        if (filters.branch) {
          params.branch = filters.branch;
          if (filters.include_global) {
            params.include_global = "1";
          }
        }

        if (filters.limit) {
          params.limit = filters.limit;
        }

        // Добавляем фильтры в зависимости от вкладки
        if (tab === "sales" || tab === "cashiers" || tab === "suppliers") {
          if (filters.cashbox) params.cashbox = filters.cashbox;
          if (filters.shift) params.shift = filters.shift;
          if (filters.cashier) params.cashier = filters.cashier;
          if (filters.payment_method)
            params.payment_method = filters.payment_method;
          if (filters.min_total) params.min_total = filters.min_total;
          if (filters.max_total) params.max_total = filters.max_total;
          if (tab === "suppliers") {
            if (filters.purchase_date_from) {
              params.purchase_date_from = filters.purchase_date_from;
            }
            if (filters.purchase_date_to) {
              params.purchase_date_to = filters.purchase_date_to;
            }
          }
        }

        if (tab === "warehouse") {
          if (filters.product) params.product = filters.product;
          if (filters.category) params.category = filters.category;
          if (filters.kind) params.kind = filters.kind;
          if (filters.low_only) params.low_only = "1";
        }

        if (tab === "shifts") {
          if (filters.status) params.status = filters.status;
          if (filters.cashbox) params.cashbox = filters.cashbox;
          if (filters.cashier) params.cashier = filters.cashier;
        }

        const response = await api.get("/main/analytics/market/", {
          params,
          timeout: MARKET_ANALYTICS_TIMEOUT_MS,
        });
        setAnalyticsData(response.data);
        if (tab === "finance") {
          try {
            const salaryParams = {
              tab: "salary",
              period_start: formatDateForAPI(period.from, false),
              period_end: formatDateForAPI(period.to, false),
            };
            if (filters.branch) {
              salaryParams.branch = filters.branch;
              if (filters.include_global) salaryParams.include_global = "1";
            }
            const salaryResponse = await api.get("/main/analytics/market/", {
              params: salaryParams,
              timeout: MARKET_ANALYTICS_TIMEOUT_MS,
            });
            setSalaryAnalyticsRows(
              Array.isArray(salaryResponse?.data?.rows)
                ? salaryResponse.data.rows
                : [],
            );
          } catch (salaryErr) {
            console.error("Ошибка при загрузке salary-аналитики:", salaryErr);
            setSalaryAnalyticsRows([]);
          }
        } else {
          setSalaryAnalyticsRows([]);
        }
      } catch (err) {
        console.error("Ошибка при загрузке аналитики:", err);
        const isTimeout =
          err?.code === "ECONNABORTED" ||
          (typeof err?.message === "string" &&
            err.message.toLowerCase().includes("timeout"));
        setError(
          err.response?.data?.detail ||
            (isTimeout
              ? "Сервер долго отвечает. Уменьшите период или попробуйте позже."
              : "Ошибка при загрузке данных"),
        );
        setSalaryAnalyticsRows([]);
      } finally {
        setLoading(false);
      }
    },
    [period.from, period.to, filters],
  );

  useEffect(() => {
    fetchAnalytics(activeTab);
  }, [activeTab, fetchAnalytics]);

  // Функция для сброса фильтров
  const resetFilters = () => {
    setFilters({
      branch: "",
      include_global: false,
      cashbox: mainCashboxId || "",
      shift: "",
      cashier: "",
      payment_method: "",
      min_total: "",
      max_total: "",
      purchase_date_from: "",
      purchase_date_to: "",
      product: "",
      category: "",
      kind: "",
      low_only: false,
      status: "",
      limit: "",
    });
  };

  // Функция для обновления фильтра
  const updateFilter = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };
  const toggleProductTable = (key) => {
    setOpenProductTable((prev) => (prev === key ? null : key));
  };
  const toggleFinanceTable = (key) => {
    setOpenFinanceTable((prev) => (prev === key ? null : key));
  };

  const openProductAnchorSection = React.useCallback((key) => {
    const anchorId = `products-section-${key}`;
    setOpenProductTable(key);

    if (typeof window !== "undefined") {
      window.history.replaceState(null, "", `#${anchorId}`);
      window.setTimeout(() => {
        const target = document.getElementById(anchorId);
        if (target) {
          target.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      }, 80);
    }
  }, []);

  // Форматирование числа с разделителями
  const formatNumber = (num) => {
    if (typeof num === "string") {
      num = parseFloat(num);
    }
    return num.toLocaleString("ru-RU", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    });
  };

  /** Количества из API (строки с до 3 знаков после запятой) */
  const formatAnalyticsQty = (v) => {
    if (v == null || v === "") return "—";
    const n =
      typeof v === "string"
        ? parseFloat(String(v).replace(",", "."))
        : Number(v);
    if (Number.isNaN(n)) return String(v);
    return n.toLocaleString("ru-RU", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 3,
    });
  };

  // Форматирование даты для графика
  const formatDateForChart = (dateString) => {
    const date = new Date(dateString);
    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    return `${day}.${month}`;
  };

  // Данные для вкладки "Продажи"
  const salesData = useMemo(() => {
    if (!analyticsData || activeTab !== "sales") {
      return {
        kpis: [
          {
            title: "Выручка",
            value: "0",
            currency: "сом",
            icon: DollarSign,
            color: "#f7d617",
          },
          {
            title: "Себестоимость",
            value: "0",
            currency: "сом",
            icon: Package,
            color: "#f7d617",
          },
          {
            title: "Валовая прибыль",
            value: "0",
            currency: "сом",
            icon: TrendingUp,
            color: "#f7d617",
          },
          {
            title: "Маржа",
            value: "0%",
            icon: HelpCircle,
            color: "#f7d617",
          },
          {
            title: "Транзакции",
            value: "0",
            icon: ShoppingCart,
            color: "#f7d617",
          },
          {
            title: "Средний чек",
            value: "0",
            currency: "сом",
            icon: BarChart3,
            color: "#f7d617",
          },
          {
            title: "Клиенты",
            value: "0",
            icon: Users,
            color: "#f7d617",
          },
        ],
        salesChart: {
          labels: [],
          data: [],
        },
        topProducts: [],
        documents: [],
        paymentMethods: {
          labels: [],
          data: [],
        },
      };
    }

    const cards = analyticsData.cards || {};
    const charts = analyticsData.charts || {};
    const tables = analyticsData.tables || {};

    const paymentMethodLabels = {
      cash: "Наличные",
      card: "Карта",
      transfer: "Перевод",
    };

    return {
      kpis: [
        {
          title: "Выручка",
          value: formatNumber(cards.revenue || "0"),
          currency: "сом",
          icon: DollarSign,
          color: "#f7d617",
        },
        {
          title: "Себестоимость",
          value: formatNumber(cards.cogs || "0"),
          currency: "сом",
          subtitle: cards.cogs_warning ? String(cards.cogs_warning) : "",
          icon: Package,
          color: "#f7d617",
        },
        {
          title: "Валовая прибыль",
          value: formatNumber(cards.gross_profit || "0"),
          currency: "сом",
          icon: TrendingUp,
          color: "#f7d617",
        },
        {
          title: "Маржа",
          value: `${Number(cards.margin_percent || 0).toLocaleString("ru-RU", {
            minimumFractionDigits: 0,
            maximumFractionDigits: 2,
          })}%`,
          icon: HelpCircle,
          color: "#f7d617",
        },
        {
          title: "Транзакции",
          value: formatNumber(cards.transactions || 0),
          icon: ShoppingCart,
          color: "#f7d617",
        },
        {
          title: "Средний чек",
          value: formatNumber(cards.avg_check || "0"),
          currency: "сом",
          icon: BarChart3,
          color: "#f7d617",
        },
        {
          title: "Клиенты",
          value: formatNumber(cards.clients || 0),
          icon: Users,
          color: "#f7d617",
        },
      ],
      salesChart: {
        labels:
          charts.sales_dynamics?.map((item) => formatDateForChart(item.date)) ||
          [],
        data:
          charts.sales_dynamics?.map((item) => parseFloat(item.value || 0)) ||
          [],
      },
      topProducts:
        tables.top_products?.map((product) => ({
          name: product.name,
          sold: product.sold || 0,
          revenue: parseFloat(product.revenue || 0),
        })) || [],
      documents:
        tables.documents?.map((doc) => ({
          name: doc.name,
          quantity: doc.count || 0,
          amount: parseFloat(doc.sum || 0),
          warehouse: doc.stock ? parseFloat(doc.stock) : 0,
        })) || [],
      paymentMethods: {
        labels:
          charts.payment_methods?.map(
            (item) => paymentMethodLabels[item.method] || item.method,
          ) || [],
        data:
          charts.payment_methods?.map((item) =>
            parseFloat(item.total || item.count || 0),
          ) || [],
      },
    };
  }, [analyticsData, activeTab]);

  // Данные для вкладки "Склад"
  const warehouseData = useMemo(() => {
    if (!analyticsData || activeTab !== "warehouse") {
      return {
        kpis: [
          {
            title: "Всего товаров",
            value: "0",
            subtitle: "В 0 категориях",
            icon: Package,
            color: "#f7d617",
          },
          {
            title: "Стоимость склада",
            value: "0",
            currency: "сом",
            icon: DollarSign,
            color: "#f7d617",
          },
          {
            title: "Заканчиваются",
            value: "0",
            subtitle: "Требуют заказа",
            icon: TrendingUp,
            color: "#f7d617",
          },
          {
            title: "Оборачиваемость",
            value: "0 дн.",
            icon: BarChart3,
            color: "#f7d617",
          },
        ],
        categoryChart: {
          labels: [],
          data: [],
          colors: [],
        },
        movementChart: {
          labels: [],
          data: [],
        },
        lowStock: [],
      };
    }

    const cards = analyticsData.cards || {};
    const charts = analyticsData.charts || {};
    const tables = analyticsData.tables || {};

    // Генерируем цвета для категорий
    const colors = [
      "#f7d617",
      "#f59e0b",
      "#10b981",
      "#3b82f6",
      "#9ca3af",
      "#8b5cf6",
      "#ec4899",
      "#06b6d4",
    ];

    return {
      kpis: [
        {
          title: "Всего товаров",
          value: formatNumber(cards.total_products || 0),
          subtitle: `В ${cards.categories_count || cards.categories || 0} категориях`,
          icon: Package,
          color: "#f7d617",
        },
        {
          title: "Стоимость склада",
          value: formatNumber(cards.inventory_value || "0"),
          currency: "сом",
          icon: DollarSign,
          color: "#f7d617",
        },
        {
          title: "Заканчиваются",
          value: formatNumber(cards.low_stock_count || 0),
          subtitle: "Требуют заказа",
          icon: TrendingUp,
          color: "#f7d617",
        },
        {
          title: "Оборачиваемость",
          value: `${formatNumber(cards.turnover_days || 0)} дн.`,
          icon: BarChart3,
          color: "#f7d617",
        },
      ],
      categoryChart: {
        labels: charts.category_distribution?.map((item) => item.name) || [],
        data: charts.category_distribution?.map((item) => item.percent) || [],
        colors: colors.slice(0, charts.category_distribution?.length || 0),
      },
      movementChart: {
        labels:
          (charts.movement_units || charts.movement || []).map((item) =>
            formatDateForChart(item.date),
          ) || [],
        data:
          (charts.movement_units || charts.movement || []).map(
            (item) => item.units || 0,
          ) || [],
      },
      lowStock:
        tables.low_stock?.map((item) => ({
          name: item.name,
          stock: item.qty || 0,
          minimum: item.min || 0,
          status: translateLowStockStatus(item.status),
          statusType: normalizeLowStockStatusType(item.status),
        })) || [],
    };
  }, [analyticsData, activeTab]);

  // Данные для вкладки "Кассы"
  const cashierData = useMemo(() => {
    if (!analyticsData || activeTab !== "cashiers") {
      return {
        kpis: [
          {
            title: "Выручка за день",
            value: "0",
            currency: "сом",
            icon: DollarSign,
            color: "#f7d617",
          },
          {
            title: "Транзакций",
            value: "0",
            icon: ShoppingCart,
            color: "#f7d617",
          },
          {
            title: "Средний чек",
            value: "0",
            currency: "сом",
            icon: BarChart3,
            color: "#f7d617",
          },
          {
            title: "Наличных в кассе",
            value: "0",
            currency: "сом",
            subtitle: "0% от выручки",
            icon: DollarSign,
            color: "#f7d617",
          },
        ],
        hourlyChart: {
          labels: [],
          data: [],
        },
        paymentMethods: {
          labels: [],
          data: [],
          colors: [],
        },
        weeklyTransactions: {
          labels: [],
          data: [],
        },
        paymentDetails: [],
        peakHours: [],
      };
    }

    const cards = analyticsData.cards || {};
    const charts = analyticsData.charts || {};
    const tables = analyticsData.tables || {};

    // Маппинг способов оплаты
    const paymentMethodLabels = {
      cash: "Наличные",
      transfer: "Безналичные",
      card: "Карта",
      debt: "Долг",
      deferred: "Отсрочка",
    };

    // Маппинг дней недели
    const weekdayLabels = ["Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"];

    return {
      kpis: [
        {
          title: "Выручка за день",
          value: formatNumber(cards.revenue || "0"),
          currency: "сом",
          icon: DollarSign,
          color: "#f7d617",
        },
        {
          title: "Транзакций",
          value: formatNumber(cards.transactions || 0),
          icon: ShoppingCart,
          color: "#f7d617",
        },
        {
          title: "Средний чек",
          value: formatNumber(cards.avg_check || "0"),
          currency: "сом",
          icon: BarChart3,
          color: "#f7d617",
        },
        {
          title: "Наличных в кассе",
          value: formatNumber(cards.cash_in_box || "0"),
          currency: "сом",
          subtitle: `${cards.cash_share_percent || 0}% от выручки`,
          icon: DollarSign,
          color: "#f7d617",
        },
      ],
      hourlyChart: {
        labels:
          charts.sales_by_hours
            ?.sort((a, b) => (a.hour || 0) - (b.hour || 0))
            .map((item) => `${String(item.hour || 0).padStart(2, "0")}:00`) ||
          [],
        data:
          charts.sales_by_hours
            ?.sort((a, b) => (a.hour || 0) - (b.hour || 0))
            .map((item) => parseFloat(item.revenue || 0)) || [],
      },
      paymentMethods: {
        labels:
          charts.payment_methods?.map(
            (item) => paymentMethodLabels[item.name] || item.name,
          ) || [],
        data: charts.payment_methods?.map((item) => item.percent) || [],
        colors: ["#f7d617", "#f59e0b", "#10b981"],
      },
      weeklyTransactions: {
        labels: weekdayLabels,
        data: charts.transactions_by_weekday
          ? weekdayLabels.map((_, index) => {
              const weekday = charts.transactions_by_weekday.find(
                (item) => item.weekday === index,
              );
              return weekday?.transactions || 0;
            })
          : [],
      },
      paymentDetails:
        tables.payment_detail?.map((item) => ({
          method: paymentMethodLabels[item.method] || item.method,
          transactions: item.transactions || 0,
          amount: parseFloat(item.sum || 0),
          share: `${item.share || 0}%`,
        })) || [],
      peakHours:
        tables.peak_hours?.map((item) => ({
          time: `${item.hour}:00`,
          transactions: item.transactions || 0,
          revenue: parseFloat(item.revenue || 0),
          avgCheck: parseFloat(item.avg_check || 0),
        })) || [],
    };
  }, [analyticsData, activeTab]);

  // Данные для вкладки "Смены"
  const shiftsData = useMemo(() => {
    if (!analyticsData || activeTab !== "shifts") {
      return {
        kpis: [
          {
            title: "Активных смен",
            value: "0",
            subtitle: "В данный момент",
            icon: Calendar,
            color: "#f7d617",
          },
          {
            title: "Смен сегодня",
            value: "0",
            subtitle: "Всего открыто",
            icon: Calendar,
            color: "#f7d617",
          },
          {
            title: "Средняя длит.",
            value: "0 ч",
            subtitle: "На смену",
            icon: BarChart3,
            color: "#f7d617",
          },
          {
            title: "Средний доход",
            value: "0",
            currency: "сом",
            subtitle: "За смену",
            icon: DollarSign,
            color: "#f7d617",
          },
        ],
        shiftsChart: {
          labels: [],
          data: [],
        },
        activeShifts: [],
        bestCashiers: [],
      };
    }

    const cards = analyticsData.cards || {};
    const charts = analyticsData.charts || {};
    const tables = analyticsData.tables || {};

    // Форматирование времени
    const formatTime = (dateString) => {
      if (!dateString) return "-";
      try {
        const date = new Date(dateString);
        const hours = String(date.getHours()).padStart(2, "0");
        const minutes = String(date.getMinutes()).padStart(2, "0");
        return `${hours}:${minutes}`;
      } catch {
        return dateString;
      }
    };

    return {
      kpis: [
        {
          title: "Активных смен",
          value: formatNumber(cards.active_shifts || 0),
          subtitle: "В данный момент",
          icon: Calendar,
          color: "#f7d617",
        },
        {
          title: "Смен сегодня",
          value: formatNumber(cards.shifts_today || 0),
          subtitle: "Всего открыто",
          icon: Calendar,
          color: "#f7d617",
        },
        {
          title: "Средняя длит.",
          value: `${formatNumber(cards.avg_duration_hours || 0)} ч`,
          subtitle: "На смену",
          icon: BarChart3,
          color: "#f7d617",
        },
        {
          title: "Средний доход",
          value: formatNumber(cards.avg_revenue_per_shift || "0"),
          currency: "сом",
          subtitle: "За смену",
          icon: DollarSign,
          color: "#f7d617",
        },
      ],
      shiftsChart: {
        labels: charts.sales_by_shift_bucket?.map((item) => item.name) || [],
        data:
          charts.sales_by_shift_bucket?.map((item) =>
            parseFloat(item.revenue || 0),
          ) || [],
      },
      activeShifts:
        tables.active_shifts?.map((shift) => ({
          cashier: shift.cashier || "-",
          register: shift.cashbox || "-",
          start: formatTime(shift.opened_at),
          sales: parseFloat(shift.sales || 0),
          status: shift.status === "open" ? "Активна" : "Закрыта",
        })) || [],
      bestCashiers:
        tables.best_cashiers?.map((cashier) => ({
          place: cashier.place || 0,
          cashier: cashier.cashier || "-",
          shifts: cashier.shifts || 0,
          sales: parseFloat(cashier.sales || 0),
          avgCheck: parseFloat(cashier.avg_check || 0),
        })) || [],
    };
  }, [analyticsData, activeTab]);

  // Данные для вкладки "Товары"
  const productsData = useMemo(() => {
    if (!analyticsData || activeTab !== "products") {
      return {
        kpis: [
          {
            title: "Общее кол-во товаров",
            value: "0",
            icon: Package,
            color: "#f7d617",
            subtitle: "В каталоге",
          },
          {
            title: "Стоимость остатков",
            value: "0",
            currency: "сом",
            icon: DollarSign,
            color: "#f7d617",
          },
          {
            title: "Товаров с низким остатком",
            value: "0",
            icon: Package,
            color: "#f7d617",
            anchorKey: "lowStockProducts",
          },
          {
            title: "Отклоненные товары",
            value: "0",
            icon: X,
            color: "#f7d617",
            subtitle: "rejected_products_count",
          },
          {
            title: "Продажи без товара",
            value: "0",
            icon: HelpCircle,
            color: "#f7d617",
            subtitle: "sales_lines_missing_product_count",
          },
        ],
        topByRevenue: [],
        topByQuantity: [],
        categories: [],
        brands: [],
        lowStockProducts: [],
      };
    }

    const cards = analyticsData.cards || {};
    const tables = analyticsData.tables || {};

    return {
      kpis: [
        {
          title: "Общее кол-во товаров",
          value: formatNumber(cards.catalog_products_count || 0),
          icon: Package,
          color: "#f7d617",
          subtitle: "В каталоге",
        },
        {
          title: "Стоимость остатков",
          value: formatNumber(cards.stock_value || "0"),
          currency: "сом",
          icon: DollarSign,
          color: "#f7d617",
        },
        {
          title: "Товаров с низким остатком",
          value: formatNumber(cards.low_stock_count || 0),
          icon: Package,
          color: "#f7d617",
          anchorKey: "lowStockProducts",
        },
        {
          title: "Отклоненные товары",
          value: formatNumber(cards.rejected_products_count || 0),
          icon: X,
          color: "#f7d617",
          subtitle: "rejected_products_count",
        },
        {
          title: "Продажи без товара",
          value: formatNumber(cards.sales_lines_missing_product_count || 0),
          icon: HelpCircle,
          color: "#f7d617",
          subtitle: "sales_lines_missing_product_count",
        },
      ],
      topByRevenue: tables.top_by_revenue || [],
      topByQuantity: tables.top_by_quantity || [],
      categories: tables.categories || [],
      brands: tables.brands || [],
      lowStockProducts:
        (tables.low_stock_products || []).map((item) => ({
          ...item,
          status: translateLowStockStatus(item.status),
          statusType: normalizeLowStockStatusType(item.status),
        })) || [],
    };
  }, [analyticsData, activeTab]);

  const suppliersData = useMemo(() => {
    if (!analyticsData || activeTab !== "suppliers") {
      return {
        kpis: [
          {
            title: "Поставщиков",
            value: "0",
            icon: Users,
            color: "#f7d617",
          },
          {
            title: "Стоимость остатков",
            value: "0",
            currency: "сом",
            icon: DollarSign,
            color: "#f7d617",
          },
          {
            title: "Продано за период",
            value: "0",
            icon: ShoppingCart,
            color: "#f7d617",
          },
          {
            title: "Выручка за период",
            value: "0",
            currency: "сом",
            icon: TrendingUp,
            color: "#f7d617",
          },
        ],
        suppliers: [],
        suppliersByStock: [],
      };
    }

    const cards = analyticsData.cards || {};
    const tables = analyticsData.tables || {};

    const normalizeSupplierRow = (row) => ({
      supplier_id: row?.supplier_id || row?.id || "",
      name: row?.name || "—",
      phone: row?.phone || "—",
      products_count: row?.products_count || 0,
      stock_qty: row?.stock_qty || 0,
      stock_value: row?.stock_value || 0,
      period_qty_sold: row?.period_qty_sold || 0,
      period_revenue: row?.period_revenue || 0,
      period_transactions: row?.period_transactions || 0,
      rank_by_qty: row?.rank_by_qty || "—",
      rank_by_stock: row?.rank_by_stock || "—",
      rating: row?.rating || 0,
    });

    return {
      kpis: [
        {
          title: "Поставщиков",
          value: formatNumber(cards.suppliers_count || 0),
          icon: Users,
          color: "#f7d617",
        },
        {
          title: "Стоимость остатков",
          value: formatNumber(cards.total_stock_value || 0),
          currency: "сом",
          icon: DollarSign,
          color: "#f7d617",
        },
        {
          title: "Продано за период",
          value: formatAnalyticsQty(cards.total_period_qty_sold || 0),
          icon: ShoppingCart,
          color: "#f7d617",
        },
        {
          title: "Выручка за период",
          value: formatNumber(cards.total_period_revenue || 0),
          currency: "сом",
          icon: TrendingUp,
          color: "#f7d617",
        },
      ],
      suppliers: (tables.suppliers || []).map(normalizeSupplierRow),
      suppliersByStock: (tables.suppliers_by_stock || []).map(
        normalizeSupplierRow,
      ),
    };
  }, [analyticsData, activeTab]);

  // Данные для вкладки "Сотрудники"
  const usersData = useMemo(() => {
    if (!analyticsData || activeTab !== "users") {
      return {
        kpis: [
          {
            title: "Всего смен",
            value: "0",
            icon: Calendar,
            color: "#f7d617",
          },
          {
            title: "Закрытых смен",
            value: "0",
            icon: Calendar,
            color: "#f7d617",
          },
          {
            title: "Открытых смен",
            value: "0",
            icon: Calendar,
            color: "#f7d617",
          },
          {
            title: "Расхождений в кассах",
            value: "0",
            icon: HelpCircle,
            color: "#f7d617",
          },
        ],
        usersPerformance: [],
        shiftDiscrepancies: [],
      };
    }

    const cards = analyticsData.cards || {};
    const tables = analyticsData.tables || {};

    return {
      kpis: [
        {
          title: "Всего смен",
          value: formatNumber(cards.total || 0),
          icon: Calendar,
          color: "#f7d617",
        },
        {
          title: "Закрытых смен",
          value: formatNumber(cards.closed || 0),
          icon: Calendar,
          color: "#f7d617",
        },
        {
          title: "Открытых смен",
          value: formatNumber(cards.open || 0),
          icon: Calendar,
          color: "#f7d617",
        },
        {
          title: "Расхождений в кассах",
          value: formatNumber(cards.discrepancies_count || 0),
          icon: HelpCircle,
          color: "#f7d617",
        },
      ],
      usersPerformance: tables.users_performance || [],
      shiftDiscrepancies: tables.shift_discrepancies || [],
    };
  }, [analyticsData, activeTab]);

  // Данные для вкладки "Финансы"
  const financeData = useMemo(() => {
    if (!analyticsData || activeTab !== "finance") {
      return {
        kpis: [
          {
            title: "Доходы",
            value: "0",
            currency: "сом",
            icon: DollarSign,
            color: "#f7d617",
          },
          {
            title: "Расходы",
            value: "0",
            currency: "сом",
            icon: DollarSign,
            color: "#f7d617",
          },
          {
            title: "Чистый поток",
            value: "0",
            currency: "сом",
            icon: TrendingUp,
            color: "#f7d617",
          },
          {
            title: "Операций",
            value: "0",
            icon: BarChart3,
            color: "#f7d617",
          },
        ],
        expenseBreakdown: [],
        incomeBreakdown: [],
        expenseItems: [],
        incomeItems: [],
        salaryRows: [],
      };
    }

    const cards = analyticsData.cards || {};
    const tables = analyticsData.tables || {};

    return {
      kpis: [
        {
          title: "Доходы",
          value: formatNumber(cards.income_total || "0"),
          currency: "сом",
          icon: DollarSign,
          color: "#f7d617",
        },
        {
          title: "Расходы",
          value: formatNumber(cards.expense_total || "0"),
          currency: "сом",
          icon: DollarSign,
          color: "#f7d617",
        },
        {
          title: "Чистый поток",
          value: formatNumber(cards.net_flow || "0"),
          currency: "сом",
          icon: TrendingUp,
          color: "#f7d617",
        },
        {
          title: "Операций",
          value: formatNumber(
            (cards.income_count || 0) + (cards.expense_count || 0),
          ),
          icon: BarChart3,
          color: "#f7d617",
        },
      ],
      expenseBreakdown: tables.expense_breakdown || [],
      incomeBreakdown: tables.income_breakdown || [],
      expenseItems: tables.expense_items || [],
      incomeItems: tables.income_items || [],
      salaryRows: Array.isArray(salaryAnalyticsRows) ? salaryAnalyticsRows : [],
    };
  }, [analyticsData, activeTab, salaryAnalyticsRows]);

  const formatCurrency = (num, decimals = 2) => {
    if (typeof num === "string") {
      num = parseFloat(num);
    }
    return num.toLocaleString("ru-RU", {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
  };

  const renderProductsAccordion = (key, title, tableContent) => {
    const isOpen = openProductTable === key;
    return (
      <div
        id={`products-section-${key}`}
        className="analytics-page__table-card analytics-page__accordion"
      >
        <button
          type="button"
          className="analytics-page__accordion-header"
          onClick={() => toggleProductTable(key)}
        >
          <h3 className="analytics-page__table-title analytics-page__accordion-title">
            {title}
          </h3>
          <span
            className={`analytics-page__accordion-icon ${
              isOpen ? "analytics-page__accordion-icon--open" : ""
            }`}
          >
            ▾
          </span>
        </button>
        {isOpen && tableContent}
      </div>
    );
  };

  const renderFinanceAccordion = (key, title, tableContent) => {
    const isOpen = openFinanceTable === key;
    return (
      <div className="analytics-page__table-card analytics-page__accordion">
        <button
          type="button"
          className="analytics-page__accordion-header"
          onClick={() => toggleFinanceTable(key)}
        >
          <h3 className="analytics-page__table-title analytics-page__accordion-title">
            {title}
          </h3>
          <span
            className={`analytics-page__accordion-icon ${
              isOpen ? "analytics-page__accordion-icon--open" : ""
            }`}
          >
            ▾
          </span>
        </button>
        {isOpen && tableContent}
      </div>
    );
  };

  return (
    <div className="analytics-page">
      <div className="analytics-page__header">
        {/* <button className="analytics-page__back">
          <ArrowLeft size={20} />
        </button> */}
        <div>
          <h1 className="analytics-page__title">Аналитика</h1>
          <p className="analytics-page__subtitle">
            Статистика и отчеты за {monthName}
          </p>
        </div>
        <button
          className="analytics-page__filter-btn"
          onClick={() => setShowFilters(!showFilters)}
        >
          <Filter size={20} />
          Фильтры
        </button>
      </div>

      {/* Панель фильтров */}
      {showFilters && (
        <div className="analytics-page__filters">
          <div className="analytics-page__filters-header">
            <h3>Фильтры</h3>
            <button
              className="analytics-page__filters-close"
              onClick={() => setShowFilters(false)}
            >
              <X size={20} />
            </button>
          </div>

          <div className="analytics-page__filters-content">
            {/* Период */}
            <div className="analytics-page__filter-group">
              <label>Период</label>
              <div className="analytics-page__filter-row">
                <input
                  type="date"
                  value={formatDateForAPI(period.from, false)}
                  onChange={(e) => {
                    const date = new Date(e.target.value);
                    setPeriod((prev) => ({ ...prev, from: date }));
                  }}
                />
                <span>—</span>
                <input
                  type="date"
                  value={formatDateForAPI(period.to, false)}
                  onChange={(e) => {
                    const date = new Date(e.target.value);
                    date.setHours(23, 59, 59);
                    setPeriod((prev) => ({ ...prev, to: date }));
                  }}
                />
              </div>
            </div>

            {/* Фильтры для Sales и Cashiers */}
            {(activeTab === "sales" ||
              activeTab === "cashiers" ||
              activeTab === "suppliers") && (
              <>
                <div className="analytics-page__filter-group">
                  <label>Способ оплаты</label>
                  <select
                    value={filters.payment_method}
                    onChange={(e) =>
                      updateFilter("payment_method", e.target.value)
                    }
                  >
                    <option value="">Все способы</option>
                    <option value="cash">Наличные</option>
                    <option value="transfer">Безналичные</option>
                  </select>
                </div>

                <div className="analytics-page__filter-group">
                  <label>Сумма от</label>
                  <input
                    type="number"
                    value={filters.min_total}
                    onChange={(e) => updateFilter("min_total", e.target.value)}
                    placeholder="0"
                  />
                </div>

                <div className="analytics-page__filter-group">
                  <label>Сумма до</label>
                  <input
                    type="number"
                    value={filters.max_total}
                    onChange={(e) => updateFilter("max_total", e.target.value)}
                    placeholder="0"
                  />
                </div>

                {activeTab === "suppliers" && (
                  <>
                    <div className="analytics-page__filter-group">
                      <label>Дата закупки от</label>
                      <input
                        type="date"
                        value={filters.purchase_date_from}
                        onChange={(e) =>
                          updateFilter("purchase_date_from", e.target.value)
                        }
                      />
                    </div>

                    <div className="analytics-page__filter-group">
                      <label>Дата закупки до</label>
                      <input
                        type="date"
                        value={filters.purchase_date_to}
                        onChange={(e) =>
                          updateFilter("purchase_date_to", e.target.value)
                        }
                      />
                    </div>
                  </>
                )}
              </>
            )}

            {/* Филиал (только для owner/admin) - показываем после основных фильтров */}
            {(currentUser?.role === "owner" ||
              currentUser?.role === "admin") && (
              <div className="analytics-page__filter-group">
                <label>Филиал</label>
                <select
                  value={filters.branch}
                  onChange={(e) => updateFilter("branch", e.target.value)}
                >
                  <option value="">Все филиалы</option>
                  {branches.map((branch) => (
                    <option key={branch.id} value={branch.id}>
                      {branch.name}
                    </option>
                  ))}
                </select>
                {filters.branch && (
                  <label className="analytics-page__filter-checkbox">
                    <input
                      type="checkbox"
                      checked={filters.include_global}
                      onChange={(e) =>
                        updateFilter("include_global", e.target.checked)
                      }
                    />
                    Включить глобальные записи
                  </label>
                )}
              </div>
            )}

            {/* Фильтры для Warehouse */}
            {activeTab === "warehouse" && (
              <>
                <div className="analytics-page__filter-group">
                  <label>Тип товара</label>
                  <select
                    value={filters.kind}
                    onChange={(e) => updateFilter("kind", e.target.value)}
                  >
                    <option value="">Все типы</option>
                    <option value="product">Товар</option>
                    <option value="service">Услуга</option>
                    <option value="bundle">Комплект</option>
                  </select>
                </div>

                <div className="analytics-page__filter-group">
                  <label className="analytics-page__filter-checkbox">
                    <input
                      type="checkbox"
                      checked={filters.low_only}
                      onChange={(e) =>
                        updateFilter("low_only", e.target.checked)
                      }
                    />
                    Только товары с низким остатком
                  </label>
                </div>
              </>
            )}

            {/* Лимит записей для детальных вкладок */}
            {(activeTab === "products" ||
              activeTab === "suppliers" ||
              activeTab === "users" ||
              activeTab === "finance") && (
              <div className="analytics-page__filter-group">
                <label>Лимит записей</label>
                <input
                  type="number"
                  min="1"
                  value={filters.limit}
                  onChange={(e) => updateFilter("limit", e.target.value)}
                  placeholder="Без лимита"
                />
              </div>
            )}

            {/* Фильтры для Shifts */}
            {activeTab === "shifts" && (
              <>
                <div className="analytics-page__filter-group">
                  <label>Статус</label>
                  <select
                    value={filters.status}
                    onChange={(e) => updateFilter("status", e.target.value)}
                  >
                    <option value="">Все статусы</option>
                    <option value="open">Открыта</option>
                    <option value="closed">Закрыта</option>
                  </select>
                </div>

                <div className="analytics-page__filter-group">
                  <label>Касса</label>
                  <input value={mainCashboxTitle} disabled readOnly />
                </div>
              </>
            )}

            <div className="analytics-page__filters-actions">
              <button
                className="analytics-page__filter-reset"
                onClick={resetFilters}
              >
                Сбросить
              </button>
              <button
                className="analytics-page__filter-apply"
                onClick={() => {
                  fetchAnalytics(activeTab);
                  setShowFilters(false);
                }}
              >
                Применить
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="analytics-page__tabs">
        <button
          className={`analytics-page__tab ${
            activeTab === "sales" ? "analytics-page__tab--active" : ""
          }`}
          onClick={() => setActiveTab("sales")}
        >
          Продажи
        </button>
        <button
          className={`analytics-page__tab ${
            activeTab === "warehouse" ? "analytics-page__tab--active" : ""
          }`}
          onClick={() => setActiveTab("warehouse")}
        >
          Склад
        </button>
        <button
          className={`analytics-page__tab ${
            activeTab === "cashiers" ? "analytics-page__tab--active" : ""
          }`}
          onClick={() => setActiveTab("cashiers")}
        >
          Кассы
        </button>
        <button
          className={`analytics-page__tab ${
            activeTab === "shifts" ? "analytics-page__tab--active" : ""
          }`}
          onClick={() => setActiveTab("shifts")}
        >
          Смены
        </button>
        <button
          className={`analytics-page__tab ${
            activeTab === "products" ? "analytics-page__tab--active" : ""
          }`}
          onClick={() => setActiveTab("products")}
        >
          Товары
        </button>
        <button
          className={`analytics-page__tab ${
            activeTab === "suppliers" ? "analytics-page__tab--active" : ""
          }`}
          onClick={() => setActiveTab("suppliers")}
        >
          Поставщики
        </button>
        <button
          className={`analytics-page__tab ${
            activeTab === "users" ? "analytics-page__tab--active" : ""
          }`}
          onClick={() => setActiveTab("users")}
        >
          Сотрудники
        </button>
        <button
          className={`analytics-page__tab ${
            activeTab === "finance" ? "analytics-page__tab--active" : ""
          }`}
          onClick={() => setActiveTab("finance")}
        >
          Финансы
        </button>
      </div>

      {/* Индикатор загрузки */}
      {loading && (
        <div className="analytics-page__loading">
          <p>Загрузка данных...</p>
        </div>
      )}

      {/* Ошибка */}
      {error && (
        <div className="analytics-page__error">
          <p>Ошибка: {error}</p>
          <button onClick={() => fetchAnalytics(activeTab)}>Повторить</button>
        </div>
      )}

      {/* Вкладка Продажи */}
      {activeTab === "sales" && !loading && !error && (
        <div className="analytics-page__content">
          <div className="analytics-page__kpis">
            {salesData.kpis.map((kpi, index) => {
              const Icon = kpi.icon;
              return (
                <div key={index} className="analytics-page__kpi-card">
                  <div className="analytics-page__kpi-header">
                    <span className="analytics-page__kpi-title">
                      {kpi.title}
                    </span>
                    <Icon size={24} style={{ color: kpi.color }} />
                  </div>
                  <div className="analytics-page__kpi-value">
                    {kpi.currency && (
                      <span className="analytics-page__kpi-currency">
                        {kpi.currency}
                      </span>
                    )}
                    {kpi.value}
                  </div>
                  {kpi.change && (
                    <div className="analytics-page__kpi-change analytics-page__kpi-change--positive">
                      <TrendingUp size={14} />
                      {kpi.change}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="analytics-page__chart-card">
            <h3 className="analytics-page__chart-title">Динамика продаж</h3>
            <Line
              data={{
                labels: salesData.salesChart.labels,
                datasets: [
                  {
                    label: "Выручка (сом)",
                    data: salesData.salesChart.data,
                    borderColor: "#f7d617",
                    backgroundColor: "rgba(247, 214, 23, 0.1)",
                    fill: true,
                    tension: 0.4,
                  },
                ],
              }}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                  legend: {
                    display: true,
                    position: "bottom",
                  },
                },
                scales: {
                  y: {
                    beginAtZero: true,
                    ticks: {
                      callback: function (value) {
                        return value.toLocaleString("ru-RU");
                      },
                    },
                  },
                },
              }}
            />
          </div>

          {salesData.paymentMethods.labels.length > 0 && (
            <div className="analytics-page__chart-card">
              <h3 className="analytics-page__chart-title">
                Продажи по способам оплаты
              </h3>
              <Doughnut
                data={{
                  labels: salesData.paymentMethods.labels,
                  datasets: [
                    {
                      data: salesData.paymentMethods.data,
                      backgroundColor: ["#f7d617", "#f59e0b", "#10b981"],
                    },
                  ],
                }}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: {
                    legend: {
                      position: "bottom",
                    },
                  },
                }}
              />
            </div>
          )}

          <div className="analytics-page__grid">
            <div className="analytics-page__table-card">
              <h3 className="analytics-page__table-title">Топ-5 товаров</h3>
              <table className="analytics-page__table">
                <thead>
                  <tr>
                    <th>Товар</th>
                    <th>Продано</th>
                    <th>Выручка</th>
                  </tr>
                </thead>
                <tbody>
                  {salesData.topProducts.length > 0 ? (
                    salesData.topProducts.map((product, index) => (
                      <tr key={index}>
                        <td>{product.name}</td>
                        <td>{product.sold} шт</td>
                        <td>{formatNumber(product.revenue)} сом</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td
                        colSpan={3}
                        style={{ textAlign: "center", color: "#6b7280" }}
                      >
                        Нет данных
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="analytics-page__table-card">
              <div className="analytics-page__table-header">
                <h3 className="analytics-page__table-title">Документы</h3>
                {/* <button className="analytics-page__date-filter">
                  <Calendar size={16} />
                  неделю
                </button> */}
              </div>
              <table className="analytics-page__table">
                <thead>
                  <tr>
                    <th>Наименование</th>
                    <th>Кол-во</th>
                    <th>Сумма</th>
                    <th>Склад</th>
                  </tr>
                </thead>
                <tbody>
                  {salesData.documents.length > 0 ? (
                    salesData.documents.map((doc, index) => (
                      <tr key={index}>
                        <td>{doc.name}</td>
                        <td>{doc.quantity}</td>
                        <td>{formatCurrency(doc.amount, 0)}</td>
                        <td>
                          {doc.warehouse
                            ? formatCurrency(doc.warehouse, 0)
                            : "-"}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td
                        colSpan={4}
                        style={{ textAlign: "center", color: "#6b7280" }}
                      >
                        Нет данных
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Вкладка Склад */}
      {activeTab === "warehouse" && !loading && !error && (
        <div className="analytics-page__content">
          <div className="analytics-page__kpis">
            {warehouseData.kpis.map((kpi, index) => {
              const Icon = kpi.icon;
              return (
                <div key={index} className="analytics-page__kpi-card">
                  <div className="analytics-page__kpi-header">
                    <span className="analytics-page__kpi-title">
                      {kpi.title}
                    </span>
                    <Icon size={24} style={{ color: kpi.color }} />
                  </div>
                  <div className="analytics-page__kpi-value">
                    {kpi.currency && (
                      <span className="analytics-page__kpi-currency">
                        {kpi.currency}
                      </span>
                    )}
                    {kpi.value}
                  </div>
                  {kpi.subtitle && (
                    <div className="analytics-page__kpi-subtitle">
                      {kpi.subtitle}
                    </div>
                  )}
                  {kpi.change && (
                    <div className="analytics-page__kpi-change analytics-page__kpi-change--positive">
                      <TrendingUp size={14} />
                      {kpi.change}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="analytics-page__grid">
            <div className="analytics-page__chart-card">
              <h3 className="analytics-page__chart-title">
                Распределение по категориям
              </h3>
              <Doughnut
                data={{
                  labels: warehouseData.categoryChart.labels,
                  datasets: [
                    {
                      data: warehouseData.categoryChart.data,
                      backgroundColor: warehouseData.categoryChart.colors,
                    },
                  ],
                }}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: {
                    legend: {
                      position: "bottom",
                    },
                  },
                }}
              />
            </div>

            <div className="analytics-page__chart-card">
              <h3 className="analytics-page__chart-title">Движение товаров</h3>
              <Bar
                data={{
                  labels: warehouseData.movementChart.labels,
                  datasets: [
                    {
                      label: "Продано единиц",
                      data: warehouseData.movementChart.data,
                      backgroundColor: "#f7d617",
                    },
                  ],
                }}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: {
                    legend: {
                      display: true,
                      position: "bottom",
                    },
                  },
                  scales: {
                    y: {
                      beginAtZero: true,
                      ticks: {
                        stepSize: 15,
                      },
                    },
                  },
                }}
              />
            </div>
          </div>

          <div className="analytics-page__table-card">
            <h3 className="analytics-page__table-title">
              Товары с низким остатком
            </h3>
            <table className="analytics-page__table">
              <thead>
                <tr>
                  <th>Товар</th>
                  <th>Остаток</th>
                  <th>Минимум</th>
                  <th>Статус</th>
                </tr>
              </thead>
              <tbody>
                {warehouseData.lowStock.map((item, index) => (
                  <tr key={index}>
                    <td>{item.name}</td>
                    <td>{item.stock} шт</td>
                    <td>{item.minimum} шт</td>
                    <td>
                      <span
                        className={`analytics-page__status analytics-page__status--${item.statusType}`}
                      >
                        {item.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Вкладка Кассы */}
      {activeTab === "cashiers" && !loading && !error && (
        <div className="analytics-page__content">
          <div className="analytics-page__kpis">
            {cashierData.kpis.map((kpi, index) => {
              const Icon = kpi.icon;
              return (
                <div key={index} className="analytics-page__kpi-card">
                  <div className="analytics-page__kpi-header">
                    <span className="analytics-page__kpi-title">
                      {kpi.title}
                    </span>
                    <Icon size={24} style={{ color: kpi.color }} />
                  </div>
                  <div className="analytics-page__kpi-value">
                    {kpi.currency && (
                      <span className="analytics-page__kpi-currency">
                        {kpi.currency}
                      </span>
                    )}
                    {kpi.value}
                  </div>
                  {kpi.subtitle && (
                    <div className="analytics-page__kpi-subtitle">
                      {kpi.subtitle}
                    </div>
                  )}
                  {kpi.change && (
                    <div className="analytics-page__kpi-change analytics-page__kpi-change--positive">
                      <TrendingUp size={14} />
                      {kpi.change}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="analytics-page__chart-card analytics-page__chart-card--large">
            <h3 className="analytics-page__chart-title">Продажи по часам</h3>
            <Line
              data={{
                labels: cashierData.hourlyChart.labels,
                datasets: [
                  {
                    label: "Выручка (сом)",
                    data: cashierData.hourlyChart.data,
                    borderColor: "#f7d617",
                    backgroundColor: "rgba(247, 214, 23, 0.1)",
                    fill: true,
                    tension: 0.4,
                  },
                ],
              }}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                  legend: {
                    display: true,
                    position: "bottom",
                  },
                },
                scales: {
                  y: {
                    beginAtZero: true,
                    ticks: {
                      stepSize: 30000,
                      callback: function (value) {
                        return value.toLocaleString("ru-RU");
                      },
                    },
                  },
                },
              }}
            />
          </div>

          <div className="analytics-page__grid">
            <div className="analytics-page__chart-card">
              <h3 className="analytics-page__chart-title">Способы оплаты</h3>
              <Doughnut
                data={{
                  labels: cashierData.paymentMethods.labels,
                  datasets: [
                    {
                      data: cashierData.paymentMethods.data,
                      backgroundColor: cashierData.paymentMethods.colors,
                    },
                  ],
                }}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: {
                    legend: {
                      position: "bottom",
                    },
                  },
                }}
              />
            </div>

            <div className="analytics-page__chart-card">
              <h3 className="analytics-page__chart-title">
                Транзакции за неделю
              </h3>
              <Bar
                data={{
                  labels: cashierData.weeklyTransactions.labels,
                  datasets: [
                    {
                      label: "Транзакции",
                      data: cashierData.weeklyTransactions.data,
                      backgroundColor: "#f7d617",
                    },
                  ],
                }}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: {
                    legend: {
                      display: false,
                    },
                  },
                  scales: {
                    y: {
                      beginAtZero: true,
                      ticks: {
                        stepSize: 35,
                      },
                    },
                  },
                }}
              />
            </div>
          </div>

          <div className="analytics-page__grid">
            <div className="analytics-page__table-card">
              <h3 className="analytics-page__table-title">
                Детализация по способам оплаты
              </h3>
              <table className="analytics-page__table">
                <thead>
                  <tr>
                    <th>Способ оплаты</th>
                    <th>Транзакций</th>
                    <th>Сумма</th>
                    <th>Доля</th>
                  </tr>
                </thead>
                <tbody>
                  {cashierData.paymentDetails.map((detail, index) => (
                    <tr key={index}>
                      <td>{detail.method}</td>
                      <td>{detail.transactions}</td>
                      <td>{formatNumber(detail.amount)} сом</td>
                      <td>{detail.share}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="analytics-page__table-card">
              <h3 className="analytics-page__table-title">
                Пиковые часы работы
              </h3>
              <table className="analytics-page__table">
                <thead>
                  <tr>
                    <th>Время</th>
                    <th>Транзакций</th>
                    <th>Выручка</th>
                    <th>Средний чек</th>
                  </tr>
                </thead>
                <tbody>
                  {cashierData.peakHours.map((hour, index) => (
                    <tr key={index}>
                      <td>{hour.time}</td>
                      <td>{hour.transactions}</td>
                      <td>{formatNumber(hour.revenue)} сом</td>
                      <td>{formatNumber(hour.avgCheck)} сом</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Вкладка Смены */}
      {activeTab === "shifts" && !loading && !error && (
        <div className="analytics-page__content">
          <div className="analytics-page__kpis">
            {shiftsData.kpis.map((kpi, index) => {
              const Icon = kpi.icon;
              return (
                <div key={index} className="analytics-page__kpi-card">
                  <div className="analytics-page__kpi-header">
                    <span className="analytics-page__kpi-title">
                      {kpi.title}
                    </span>
                    <Icon size={24} style={{ color: kpi.color }} />
                  </div>
                  <div className="analytics-page__kpi-value">
                    {kpi.currency && (
                      <span className="analytics-page__kpi-currency">
                        {kpi.currency}
                      </span>
                    )}
                    {kpi.value}
                  </div>
                  {kpi.subtitle && (
                    <div className="analytics-page__kpi-subtitle">
                      {kpi.subtitle}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="analytics-page__chart-card">
            <h3 className="analytics-page__chart-title">Продажи по сменам</h3>
            <Bar
              data={{
                labels: shiftsData.shiftsChart.labels,
                datasets: [
                  {
                    label: "Выручка (сом)",
                    data: shiftsData.shiftsChart.data,
                    backgroundColor: "#f7d617",
                  },
                ],
              }}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                  legend: {
                    display: true,
                    position: "bottom",
                  },
                },
                scales: {
                  y: {
                    beginAtZero: true,
                    ticks: {
                      stepSize: 60000,
                      callback: function (value) {
                        return value.toLocaleString("ru-RU");
                      },
                    },
                  },
                },
              }}
            />
          </div>

          <div className="analytics-page__grid">
            <div className="analytics-page__table-card">
              <h3 className="analytics-page__table-title">Активные смены</h3>
              <table className="analytics-page__table">
                <thead>
                  <tr>
                    <th>Кассир</th>
                    <th>Касса</th>
                    <th>Начало смены</th>
                    <th>Продажи</th>
                    <th>Статус</th>
                  </tr>
                </thead>
                <tbody>
                  {shiftsData.activeShifts.map((shift, index) => (
                    <tr key={index}>
                      <td>{shift.cashier}</td>
                      <td>{shift.register}</td>
                      <td>{shift.start}</td>
                      <td>{formatNumber(shift.sales)} сом</td>
                      <td>
                        <span className="analytics-page__status analytics-page__status--active">
                          {shift.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="analytics-page__table-card">
              <h3 className="analytics-page__table-title">
                Лучшие кассиры за месяц
              </h3>
              <table className="analytics-page__table">
                <thead>
                  <tr>
                    <th>Место</th>
                    <th>Кассир</th>
                    <th>Смен</th>
                    <th>Продажи</th>
                    <th>Средний чек</th>
                  </tr>
                </thead>
                <tbody>
                  {shiftsData.bestCashiers.map((cashier, index) => (
                    <tr key={index}>
                      <td>
                        <span
                          className={`analytics-page__place analytics-page__place--${
                            cashier.place === 1 ? "first" : "other"
                          }`}
                        >
                          {cashier.place}
                        </span>
                      </td>
                      <td>{cashier.cashier}</td>
                      <td>{cashier.shifts}</td>
                      <td>{formatNumber(cashier.sales)} сом</td>
                      <td>{formatNumber(cashier.avgCheck)} сом</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Вкладка Товары */}
      {activeTab === "products" && !loading && !error && (
        <div className="analytics-page__content">
          <div className="analytics-page__kpis">
            {productsData.kpis.map((kpi, index) => {
              const Icon = kpi.icon;
              const isInteractive = Boolean(kpi.anchorKey);
              return (
                <div
                  key={index}
                  className={`analytics-page__kpi-card ${
                    isInteractive ? "analytics-page__kpi-card--interactive" : ""
                  }`}
                  role={isInteractive ? "button" : undefined}
                  tabIndex={isInteractive ? 0 : undefined}
                  onClick={
                    isInteractive
                      ? () => openProductAnchorSection(kpi.anchorKey)
                      : undefined
                  }
                  onKeyDown={
                    isInteractive
                      ? (e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            openProductAnchorSection(kpi.anchorKey);
                          }
                        }
                      : undefined
                  }
                >
                  <div className="analytics-page__kpi-header">
                    <span className="analytics-page__kpi-title">
                      {kpi.title}
                    </span>
                    <Icon size={24} style={{ color: kpi.color }} />
                  </div>
                  <div className="analytics-page__kpi-value">
                    {kpi.currency && (
                      <span className="analytics-page__kpi-currency">
                        {kpi.currency}
                      </span>
                    )}
                    {kpi.value}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="analytics-page__grid">
            {renderProductsAccordion(
              "topByRevenue",
              "Топ по выручке",
              <table className="analytics-page__table">
                <thead>
                  <tr>
                    <th>Товар</th>
                    <th>Категория</th>
                    <th>Бренд</th>
                    <th>Продано</th>
                    <th>Выручка</th>
                    <th>Транзакций</th>
                  </tr>
                </thead>
                <tbody>
                  {productsData.topByRevenue.length > 0 ? (
                    productsData.topByRevenue.map((row) => (
                      <tr key={row.product_id}>
                        <td>{row.name}</td>
                        <td>{row.category}</td>
                        <td>{row.brand}</td>
                        <td>{row.qty_sold}</td>
                        <td>{formatCurrency(row.revenue, 0)}</td>
                        <td>{row.transactions}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td
                        colSpan={6}
                        style={{ textAlign: "center", color: "#6b7280" }}
                      >
                        Нет данных
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>,
            )}

            {renderProductsAccordion(
              "topByQuantity",
              "Топ по количеству",
              <table className="analytics-page__table">
                <thead>
                  <tr>
                    <th>Товар</th>
                    <th>Продано</th>
                  </tr>
                </thead>
                <tbody>
                  {productsData.topByQuantity.length > 0 ? (
                    productsData.topByQuantity.map((row) => (
                      <tr key={row.product_id}>
                        <td>{row.name}</td>
                        <td>{row.qty_sold}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td
                        colSpan={2}
                        style={{ textAlign: "center", color: "#6b7280" }}
                      >
                        Нет данных
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>,
            )}
          </div>

          <div className="analytics-page__grid">
            {renderProductsAccordion(
              "categories",
              "Категории",
              <table className="analytics-page__table">
                <thead>
                  <tr>
                    <th>Категория</th>
                    <th>Выручка</th>
                    <th>Количество</th>
                    <th>Товаров</th>
                    <th>Транзакций</th>
                  </tr>
                </thead>
                <tbody>
                  {productsData.categories.length > 0 ? (
                    productsData.categories.map((row) => (
                      <tr key={row.category_id}>
                        <td>{row.category}</td>
                        <td>{formatCurrency(row.revenue, 0)}</td>
                        <td>{row.qty_sold}</td>
                        <td>{row.products_count}</td>
                        <td>{row.transactions}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td
                        colSpan={5}
                        style={{ textAlign: "center", color: "#6b7280" }}
                      >
                        Нет данных
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>,
            )}

            {renderProductsAccordion(
              "brands",
              "Бренды",
              <table className="analytics-page__table">
                <thead>
                  <tr>
                    <th>Бренд</th>
                    <th>Товаров</th>
                    <th>Выручка</th>
                  </tr>
                </thead>
                <tbody>
                  {productsData.brands.length > 0 ? (
                    productsData.brands.map((row) => (
                      <tr key={row.brand_id}>
                        <td>{row.brand}</td>
                        <td>{row.products_count}</td>
                        <td>{formatCurrency(row.revenue, 0)}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td
                        colSpan={3}
                        style={{ textAlign: "center", color: "#6b7280" }}
                      >
                        Нет данных
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>,
            )}
          </div>

          {renderProductsAccordion(
            "lowStockProducts",
            "Товары с низким остатком",
            <table className="analytics-page__table">
              <thead>
                <tr>
                  <th>Код</th>
                  <th>Товар</th>
                  <th>Количество</th>
                  <th>Цена</th>
                  <th>Закупочная</th>
                  <th>Статус</th>
                </tr>
              </thead>
              <tbody>
                {productsData.lowStockProducts.length > 0 ? (
                  productsData.lowStockProducts.map((row) => (
                    <tr key={row.id}>
                      <td>{row.code}</td>
                      <td>{row.name}</td>
                      <td>{row.quantity}</td>
                      <td>{formatCurrency(row.price, 0)}</td>
                      <td>{formatCurrency(row.purchase_price, 0)}</td>
                      <td>
                        <span
                          className={`analytics-page__status analytics-page__status--${row.statusType}`}
                        >
                          {row.status}
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td
                      colSpan={6}
                      style={{ textAlign: "center", color: "#6b7280" }}
                    >
                      Нет данных
                    </td>
                  </tr>
                )}
              </tbody>
            </table>,
          )}
        </div>
      )}

      {activeTab === "suppliers" && !loading && !error && (
        <div className="analytics-page__content">
          <div className="analytics-page__kpis">
            {suppliersData.kpis.map((kpi, index) => {
              const Icon = kpi.icon;
              return (
                <div key={index} className="analytics-page__kpi-card">
                  <div className="analytics-page__kpi-header">
                    <span className="analytics-page__kpi-title">
                      {kpi.title}
                    </span>
                    <Icon size={24} style={{ color: kpi.color }} />
                  </div>
                  <div className="analytics-page__kpi-value">
                    {kpi.currency && (
                      <span className="analytics-page__kpi-currency">
                        {kpi.currency}
                      </span>
                    )}
                    {kpi.value}
                  </div>
                  {kpi.subtitle && (
                    <div className="analytics-page__kpi-subtitle">
                      {kpi.subtitle}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="analytics-page__grid">
            <div className="analytics-page__table-card analytics-page__table-card--scrollable">
              <h3 className="analytics-page__table-title">
                Поставщики по продажам
              </h3>
              <div className="analytics-page__table-scroll analytics-page__table-scroll--suppliers">
                <table className="analytics-page__table analytics-page__table--suppliers">
                  <thead>
                    <tr>
                      <th>Поставщик</th>
                      <th>Телефон</th>
                      <th>SKU</th>
                      <th>Остаток</th>
                      <th>Стоимость остатков</th>
                      <th>Продано</th>
                      <th>Выручка</th>
                      <th>Чеков</th>
                      <th>Место по продажам</th>
                      <th>Место по складу</th>
                      <th>Рейтинг</th>
                    </tr>
                  </thead>
                  <tbody>
                    {suppliersData.suppliers.length > 0 ? (
                      suppliersData.suppliers.map((row) => (
                        <tr key={row.supplier_id || row.name}>
                          <td>{row.name}</td>
                          <td>{row.phone}</td>
                          <td>{row.products_count}</td>
                          <td>{formatAnalyticsQty(row.stock_qty)}</td>
                          <td>{formatCurrency(row.stock_value, 0)}</td>
                          <td>{formatAnalyticsQty(row.period_qty_sold)}</td>
                          <td>{formatCurrency(row.period_revenue, 0)}</td>
                          <td>{row.period_transactions}</td>
                          <td>{row.rank_by_qty}</td>
                          <td>{row.rank_by_stock}</td>
                          <td>{Number(row.rating || 0).toFixed(1)}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td
                          colSpan={11}
                          style={{ textAlign: "center", color: "#6b7280" }}
                        >
                          Нет данных
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="analytics-page__table-card analytics-page__table-card--scrollable">
              <h3 className="analytics-page__table-title">
                Поставщики по складу
              </h3>
              <div className="analytics-page__table-scroll analytics-page__table-scroll--suppliers">
                <table className="analytics-page__table analytics-page__table--suppliers">
                  <thead>
                    <tr>
                      <th>Поставщик</th>
                      <th>Телефон</th>
                      <th>SKU</th>
                      <th>Остаток</th>
                      <th>Стоимость остатков</th>
                      <th>Продано</th>
                      <th>Выручка</th>
                      <th>Чеков</th>
                      <th>Место по продажам</th>
                      <th>Место по складу</th>
                      <th>Рейтинг</th>
                    </tr>
                  </thead>
                  <tbody>
                    {suppliersData.suppliersByStock.length > 0 ? (
                      suppliersData.suppliersByStock.map((row) => (
                        <tr key={`stock-${row.supplier_id || row.name}`}>
                          <td>{row.name}</td>
                          <td>{row.phone}</td>
                          <td>{row.products_count}</td>
                          <td>{formatAnalyticsQty(row.stock_qty)}</td>
                          <td>{formatCurrency(row.stock_value, 0)}</td>
                          <td>{formatAnalyticsQty(row.period_qty_sold)}</td>
                          <td>{formatCurrency(row.period_revenue, 0)}</td>
                          <td>{row.period_transactions}</td>
                          <td>{row.rank_by_qty}</td>
                          <td>{row.rank_by_stock}</td>
                          <td>{Number(row.rating || 0).toFixed(1)}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td
                          colSpan={11}
                          style={{ textAlign: "center", color: "#6b7280" }}
                        >
                          Нет данных
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Вкладка Сотрудники */}
      {activeTab === "users" && !loading && !error && (
        <div className="analytics-page__content">
          <div className="analytics-page__kpis">
            {usersData.kpis.map((kpi, index) => {
              const Icon = kpi.icon;
              return (
                <div key={index} className="analytics-page__kpi-card">
                  <div className="analytics-page__kpi-header">
                    <span className="analytics-page__kpi-title">
                      {kpi.title}
                    </span>
                    <Icon size={24} style={{ color: kpi.color }} />
                  </div>
                  <div className="analytics-page__kpi-value">
                    {kpi.currency && (
                      <span className="analytics-page__kpi-currency">
                        {kpi.currency}
                      </span>
                    )}
                    {kpi.value}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="analytics-page__grid">
            <div className="analytics-page__table-card">
              <h3 className="analytics-page__table-title">
                Эффективность сотрудников
              </h3>
              <table className="analytics-page__table">
                <thead>
                  <tr>
                    <th>Сотрудник</th>
                    <th>Email</th>
                    <th>Телефон</th>
                    <th>Выручка</th>
                    <th>Транзакций</th>
                    <th>Средний чек</th>
                    <th>Ед. продано</th>
                    <th>Уник. позиций</th>
                    <th className="analytics-page__users-products-col">
                      Товары
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {usersData.usersPerformance.length > 0 ? (
                    usersData.usersPerformance.map((row, rowIndex) => {
                      const soldProducts = Array.isArray(row.sold_products)
                        ? row.sold_products
                        : [];
                      const namesFallback = Array.isArray(row.product_names)
                        ? row.product_names
                        : [];
                      const hasProducts =
                        soldProducts.length > 0 || namesFallback.length > 0;
                      const rowKey = String(
                        row.user_id != null && row.user_id !== ""
                          ? row.user_id
                          : `idx-${rowIndex}`,
                      );
                      const isOpen =
                        hasProducts && expandedUserPerformanceId === rowKey;
                      return (
                        <React.Fragment key={rowKey}>
                          <tr
                            className={
                              hasProducts
                                ? "analytics-page__table-row--expandable"
                                : undefined
                            }
                            onClick={() => {
                              if (!hasProducts) return;
                              setExpandedUserPerformanceId((prev) =>
                                prev === rowKey ? null : rowKey,
                              );
                            }}
                            onKeyDown={(e) => {
                              if (!hasProducts) return;
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                setExpandedUserPerformanceId((prev) =>
                                  prev === rowKey ? null : rowKey,
                                );
                              }
                            }}
                            tabIndex={hasProducts ? 0 : undefined}
                            aria-expanded={hasProducts ? isOpen : undefined}
                          >
                            <td>{row.user}</td>
                            <td>{row.email}</td>
                            <td>{row.phone}</td>
                            <td>{formatCurrency(row.revenue, 0)}</td>
                            <td>{row.transactions}</td>
                            <td>{formatCurrency(row.avg_check, 0)}</td>
                            <td className="analytics-page__users-sold-qty">
                              {formatAnalyticsQty(row.units_sold)}
                            </td>
                            <td>
                              {row.products_sold_count != null
                                ? row.products_sold_count
                                : "—"}
                            </td>
                            <td className="analytics-page__users-products-toggle">
                              {hasProducts ? (
                                <span className="analytics-page__users-products-toggle-inner">
                                  <ChevronDown
                                    size={18}
                                    className={
                                      isOpen
                                        ? "analytics-page__users-chevron analytics-page__users-chevron--open"
                                        : "analytics-page__users-chevron"
                                    }
                                    aria-hidden
                                  />
                                </span>
                              ) : (
                                "—"
                              )}
                            </td>
                          </tr>
                          {isOpen && (
                            <tr className="analytics-page__users-products-dropdown">
                              <td colSpan={9}>
                                <div
                                  className="analytics-page__users-products-dropdown-panel"
                                  role="region"
                                  aria-label={String(row.user ?? "Товары")}
                                >
                                  {soldProducts.length > 0 ? (
                                    <ul className="analytics-page__users-sold-products">
                                      {soldProducts.map((p, i) => (
                                        <li key={`${rowKey}-sp-${i}`}>
                                          {p.name ?? "—"} —{" "}
                                          {formatAnalyticsQty(p.quantity)}
                                        </li>
                                      ))}
                                    </ul>
                                  ) : (
                                    <div className="analytics-page__users-product-names-line">
                                      {namesFallback.join(", ")}
                                    </div>
                                  )}
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })
                  ) : (
                    <tr>
                      <td
                        colSpan={9}
                        style={{ textAlign: "center", color: "#6b7280" }}
                      >
                        Нет данных
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="analytics-page__table-card">
              <h3 className="analytics-page__table-title">
                Расхождения по сменам
              </h3>
              <table className="analytics-page__table">
                <thead>
                  <tr>
                    <th>Кассир</th>
                    <th>Касса</th>
                    <th>Открыта</th>
                    <th>Закрыта</th>
                    <th>Ожидалось</th>
                    <th>Фактически</th>
                    <th>Разница</th>
                    <th>Тип</th>
                  </tr>
                </thead>
                <tbody>
                  {usersData.shiftDiscrepancies.length > 0 ? (
                    usersData.shiftDiscrepancies.map((row) => (
                      <tr key={row.shift_id}>
                        <td>{row.cashier}</td>
                        <td>{row.cashbox}</td>
                        <td>{row.opened_at}</td>
                        <td>{row.closed_at}</td>
                        <td>{formatCurrency(row.expected_cash, 0)}</td>
                        <td>{formatCurrency(row.closing_cash, 0)}</td>
                        <td>{formatCurrency(row.diff, 0)}</td>
                        <td>{row.type}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td
                        colSpan={8}
                        style={{ textAlign: "center", color: "#6b7280" }}
                      >
                        Нет данных
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Вкладка Финансы */}
      {activeTab === "finance" && !loading && !error && (
        <div className="analytics-page__content">
          <div className="analytics-page__kpis">
            {financeData.kpis.map((kpi, index) => {
              const Icon = kpi.icon;
              return (
                <div key={index} className="analytics-page__kpi-card">
                  <div className="analytics-page__kpi-header">
                    <span className="analytics-page__kpi-title">
                      {kpi.title}
                    </span>
                    <Icon size={24} style={{ color: kpi.color }} />
                  </div>
                  <div className="analytics-page__kpi-value">
                    {kpi.currency && (
                      <span className="analytics-page__kpi-currency">
                        {kpi.currency}
                      </span>
                    )}
                    {kpi.value}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="analytics-page__grid">
            {renderFinanceAccordion(
              "expenseBreakdown",
              "Статьи расходов",
              <table className="analytics-page__table">
                <thead>
                  <tr>
                    <th>Статья</th>
                    <th>Сумма</th>
                    <th>Операций</th>
                  </tr>
                </thead>
                <tbody>
                  {financeData.expenseBreakdown.length > 0 ? (
                    financeData.expenseBreakdown.map((row, idx) => (
                      <tr key={`${row.name}-${idx}`}>
                        <td>{row.name}</td>
                        <td>{formatCurrency(row.total, 0)}</td>
                        <td>{row.count}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td
                        colSpan={3}
                        style={{ textAlign: "center", color: "#6b7280" }}
                      >
                        Нет данных
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>,
            )}

            {renderFinanceAccordion(
              "incomeBreakdown",
              "Источники дохода",
              <table className="analytics-page__table">
                <thead>
                  <tr>
                    <th>Статья</th>
                    <th>Сумма</th>
                    <th>Операций</th>
                  </tr>
                </thead>
                <tbody>
                  {financeData.incomeBreakdown.length > 0 ? (
                    financeData.incomeBreakdown.map((row, idx) => (
                      <tr key={`${row.name}-${idx}`}>
                        <td>{row.name}</td>
                        <td>{formatCurrency(row.total, 0)}</td>
                        <td>{row.count}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td
                        colSpan={3}
                        style={{ textAlign: "center", color: "#6b7280" }}
                      >
                        Нет данных
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>,
            )}
          </div>

          <div className="analytics-page__grid">
            {renderFinanceAccordion(
              "salaryRows",
              "Зарплата сотрудников (маркет)",
              <table className="analytics-page__table">
                <thead>
                  <tr>
                    <th>Сотрудник</th>
                    <th>Схема</th>
                    <th>Оклад/мес</th>
                    <th>%</th>
                    <th>Дней</th>
                    <th>Оклад за период</th>
                    <th>Продажи сотрудника</th>
                    <th>Бонус %</th>
                    <th>Итого</th>
                  </tr>
                </thead>
                <tbody>
                  {financeData.salaryRows.length > 0 ? (
                    financeData.salaryRows.map((row, idx) => (
                      <tr key={`${row.user_id || "user"}-${idx}`}>
                        <td>{row.employee_label || "-"}</td>
                        <td>{row.pay_scheme_label || row.pay_scheme || "-"}</td>
                        <td>
                          {formatCurrency(row.monthly_base_salary || 0, 2)}
                        </td>
                        <td>{formatCurrency(row.sales_percent || 0, 2)}</td>
                        <td>{formatNumber(row.period_days || 0)}</td>
                        <td>{formatCurrency(row.base_prorated || 0, 2)}</td>
                        <td>
                          {formatCurrency(row.employee_sales_period || 0, 2)}
                        </td>
                        <td>{formatCurrency(row.percent_bonus || 0, 2)}</td>
                        <td>{formatCurrency(row.total || 0, 2)}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td
                        colSpan={9}
                        style={{ textAlign: "center", color: "#6b7280" }}
                      >
                        Нет данных
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>,
            )}

            {renderFinanceAccordion(
              "expenseItems",
              "Расходы",
              <table className="analytics-page__table">
                <thead>
                  <tr>
                    <th>Название</th>
                    <th>Сумма</th>
                    <th>Касса</th>
                    <th>Дата</th>
                    <th>Создал</th>
                    <th>Комментарий</th>
                  </tr>
                </thead>
                <tbody>
                  {financeData.expenseItems.length > 0 ? (
                    financeData.expenseItems.map((row) => (
                      <tr key={row.id}>
                        <td>{row.name}</td>
                        <td>{formatCurrency(row.amount, 0)}</td>
                        <td>{row.cashbox}</td>
                        <td>{row.created_at}</td>
                        <td>{row.created_by}</td>
                        <td>{row.description}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td
                        colSpan={6}
                        style={{ textAlign: "center", color: "#6b7280" }}
                      >
                        Нет данных
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>,
            )}

            {renderFinanceAccordion(
              "incomeItems",
              "Доходы",
              <table className="analytics-page__table">
                <thead>
                  <tr>
                    <th>Название</th>
                    <th>Сумма</th>
                    <th>Дата</th>
                  </tr>
                </thead>
                <tbody>
                  {financeData.incomeItems.length > 0 ? (
                    financeData.incomeItems.map((row) => (
                      <tr key={row.id}>
                        <td>{row.name}</td>
                        <td>{formatCurrency(row.amount, 0)}</td>
                        <td>{row.created_at}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td
                        colSpan={3}
                        style={{ textAlign: "center", color: "#6b7280" }}
                      >
                        Нет данных
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>,
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Analytics;
