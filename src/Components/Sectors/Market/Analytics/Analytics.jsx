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
import { useDispatch, useSelector } from "react-redux";
import api from "../../../../api/index";
import { useUser } from "../../../../store/slices/userSlice";
import { useCash } from "../../../../store/slices/cashSlice";
import { fetchBranchesAsync } from "../../../../store/creators/branchCreators";
import { getCashBoxes } from "../../../../store/slices/cashSlice";
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
  Filler
);

const Analytics = () => {
  const dispatch = useDispatch();
  const { company, currentUser } = useUser();
  const { list: cashBoxes } = useCash();
  const { list: branches } = useSelector(
    (state) => state.branches || { list: [] }
  );
  const [activeTab, setActiveTab] = useState("sales");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [analyticsData, setAnalyticsData] = useState(null);
  const [showFilters, setShowFilters] = useState(false);
  const [period, setPeriod] = useState(() => {
    const now = new Date();
    const from = new Date(now.getFullYear(), now.getMonth(), 1);
    const to = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    return { from, to };
  });

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
    // Stock filters
    product: "",
    category: "",
    kind: "",
    low_only: false,
    // Cashboxes filters (используются те же что и sales)
    // Shifts filters
    status: "",
  });

  const currentDate = new Date();
  const monthName = currentDate.toLocaleDateString("ru-RU", {
    month: "long",
    year: "numeric",
  });

  // Загрузка данных для фильтров
  useEffect(() => {
    dispatch(fetchBranchesAsync());
    dispatch(getCashBoxes());
  }, [dispatch]);

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
  // API поддерживает: sales|stock|cashboxes|shifts
  const mapTabToAPI = (tab) => {
    const tabMap = {
      sales: "sales",
      warehouse: "stock", // "warehouse" -> "stock" для API
      cashiers: "cashboxes", // "cashiers" -> "cashboxes" для API
      shifts: "shifts",
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
          date_from: formatDateForAPI(period.from, false),
          date_to: formatDateForAPI(period.to, false),
        };

        // Добавляем branch и include_global если branch выбран
        if (filters.branch) {
          params.branch = filters.branch;
          if (filters.include_global) {
            params.include_global = "1";
          }
        }

        // Добавляем фильтры в зависимости от вкладки
        if (tab === "sales" || tab === "cashiers") {
          if (filters.cashbox) params.cashbox = filters.cashbox;
          if (filters.shift) params.shift = filters.shift;
          if (filters.cashier) params.cashier = filters.cashier;
          if (filters.payment_method)
            params.payment_method = filters.payment_method;
          if (filters.min_total) params.min_total = filters.min_total;
          if (filters.max_total) params.max_total = filters.max_total;
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

        const response = await api.get("/main/analytics/market/", { params });
        setAnalyticsData(response.data);
      } catch (err) {
        console.error("Ошибка при загрузке аналитики:", err);
        setError(err.response?.data?.detail || "Ошибка при загрузке данных");
      } finally {
        setLoading(false);
      }
    },
    [period.from, period.to, filters]
  );

  useEffect(() => {
    fetchAnalytics(activeTab);
  }, [activeTab, fetchAnalytics]);

  // Функция для сброса фильтров
  const resetFilters = () => {
    setFilters({
      branch: "",
      include_global: false,
      cashbox: "",
      shift: "",
      cashier: "",
      payment_method: "",
      min_total: "",
      max_total: "",
      product: "",
      category: "",
      kind: "",
      low_only: false,
      status: "",
    });
  };

  // Функция для обновления фильтра
  const updateFilter = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

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
      };
    }

    const cards = analyticsData.cards || {};
    const charts = analyticsData.charts || {};
    const tables = analyticsData.tables || {};

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
          subtitle: `В ${cards.categories || 0} категориях`,
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
          charts.movement_units?.map((item) => formatDateForChart(item.date)) ||
          [],
        data: charts.movement_units?.map((item) => item.units || 0) || [],
      },
      lowStock:
        tables.low_stock?.map((item) => ({
          name: item.name,
          stock: item.qty || 0,
          minimum: item.min || 0,
          status: item.status === "critical" ? "Критично" : "Низкий",
          statusType: item.status || "low",
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
            (item) => paymentMethodLabels[item.name] || item.name
          ) || [],
        data: charts.payment_methods?.map((item) => item.percent) || [],
        colors: ["#f7d617", "#f59e0b", "#10b981"],
      },
      weeklyTransactions: {
        labels: weekdayLabels,
        data: charts.transactions_by_weekday
          ? weekdayLabels.map((_, index) => {
              const weekday = charts.transactions_by_weekday.find(
                (item) => item.weekday === index
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
            parseFloat(item.revenue || 0)
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

  const formatCurrency = (num, decimals = 2) => {
    if (typeof num === "string") {
      num = parseFloat(num);
    }
    return num.toLocaleString("ru-RU", {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
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
            {(activeTab === "sales" || activeTab === "cashiers") && (
              <>
                <div className="analytics-page__filter-group">
                  <label>Касса</label>
                  <select
                    value={filters.cashbox}
                    onChange={(e) => updateFilter("cashbox", e.target.value)}
                  >
                    <option value="">Все кассы</option>
                    {cashBoxes.map((box) => (
                      <option key={box.id} value={box.id}>
                        {box.name || box.department_name || box.id}
                      </option>
                    ))}
                  </select>
                </div>

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
                  <select
                    value={filters.cashbox}
                    onChange={(e) => updateFilter("cashbox", e.target.value)}
                  >
                    <option value="">Все кассы</option>
                    {cashBoxes.map((box) => (
                      <option key={box.id} value={box.id}>
                        {box.name || box.department_name || box.id}
                      </option>
                    ))}
                  </select>
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
    </div>
  );
};

export default Analytics;
