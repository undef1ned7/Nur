import React, { useState, useEffect, useMemo } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  Users,
  ArrowLeftRight,
  Package,
  DollarSign,
  ShoppingCart,
  BarChart3,
  RefreshCw,
  Filter,
  TrendingUp,
  Warehouse,
  Wallet,
  Receipt,
  Percent,
  AlertTriangle,
  PiggyBank,
  PieChart,
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
} from "chart.js";
import { Line, Bar, Doughnut } from "react-chartjs-2";
import api from "../../../../api";
import { fetchProductionAnalytics } from "../../../../store/creators/analyticsCreators";
import { setProductionAnalyticsFilters } from "../../../../store/slices/analyticsSlice";
import { useUser } from "../../../../store/slices/userSlice";
import { isStartPlan } from "../../../../utils/subscriptionPlan";
import AgentAnalytics from "./AgentAnalytics";
import "./AgentAnalytics.scss";
import {
  CARD_DETAILS_PAGE_SIZE,
  INITIAL_CARD_DETAILS_META,
  CARD_DETAILS_USES_PERIOD,
  parseCardDetailsRows,
  getDisplayDetailColumns,
  formatTotalsValue,
  formatDetailsCell,
  CARD_DETAILS_COLUMN_LABELS,
  TOTALS_VALUE_LABELS,
} from "./analyticsCardDetailsShared";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Tooltip,
  Legend,
);

const ProductionAnalytics = () => {
  const dispatch = useDispatch();
  const { profile, tariff, company } = useUser();
  const startPlan = isStartPlan(tariff || company?.subscription_plan?.name);

  const {
    data: analyticsData,
    loading,
    error,
  } = useSelector((state) => state.analytics.productionAnalytics);
  const filters = useSelector(
    (state) => state.analytics.productionAnalytics.filters,
  );

  const [showFilters, setShowFilters] = useState(false);
  const [cardDetailsModal, setCardDetailsModal] = useState({
    open: false,
    cardKey: "",
    title: "",
    loading: false,
    error: "",
    rows: [],
    meta: { ...INITIAL_CARD_DETAILS_META },
  });

  // Локальные состояния для фильтров (синхронизируются с Redux)
  const [period, setPeriod] = useState(filters.period || "month");
  const [dateFrom, setDateFrom] = useState(filters.date_from || "");
  const [dateTo, setDateTo] = useState(filters.date_to || "");
  const [date, setDate] = useState(filters.date || "");
  const [groupBy, setGroupBy] = useState(filters.group_by || "day");

  // Синхронизация локальных фильтров с Redux при изменении
  useEffect(() => {
    if (filters.period) setPeriod(filters.period);
    if (filters.date_from !== undefined) setDateFrom(filters.date_from);
    if (filters.date_to !== undefined) setDateTo(filters.date_to);
    if (filters.date !== undefined) setDate(filters.date);
    if (filters.group_by) setGroupBy(filters.group_by);
  }, [filters]);

  // Форматирование даты для отображения
  const formatDateForDisplay = (dateString, groupByType) => {
    if (!dateString) return "";
    try {
      const d = new Date(dateString + "T00:00:00");
      if (groupByType === "day") {
        return d.toLocaleDateString("ru-RU", {
          day: "2-digit",
          month: "2-digit",
        });
      } else if (groupByType === "week") {
        return `Неделя от ${d.toLocaleDateString("ru-RU", {
          day: "2-digit",
          month: "2-digit",
        })}`;
      } else if (groupByType === "month") {
        return d.toLocaleDateString("ru-RU", {
          month: "long",
          year: "numeric",
        });
      }
      return dateString;
    } catch {
      return dateString;
    }
  };

  // Форматирование числа
  const formatNumber = (num) => {
    if (typeof num === "string") {
      num = parseFloat(num);
    }
    return num.toLocaleString("ru-RU", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    });
  };

  // Форматирование денег
  const formatMoney = (amount) => {
    if (typeof amount === "string") {
      amount = parseFloat(amount);
    }
    return amount.toLocaleString("ru-RU", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  /** Доли и проценты из summary (например gross_margin_percent). */
  const formatPercent = (value) => {
    if (value === null || value === undefined || value === "") return "—";
    const n = typeof value === "string" ? parseFloat(value) : Number(value);
    if (Number.isNaN(n)) return "—";
    return `${n.toLocaleString("ru-RU", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}%`;
  };

  const buildCardDetailsParams = (cardKey, offset = 0) => {
    const params = {
      card: cardKey,
      limit: CARD_DETAILS_PAGE_SIZE,
      offset,
    };
    const branchUuid = profile?.branch ?? profile?.branch_id;
    if (branchUuid) params.branch = branchUuid;
    if (CARD_DETAILS_USES_PERIOD.has(cardKey)) {
      params.period = period;
      if (period === "day") {
        params.date = date || new Date().toISOString().slice(0, 10);
      } else {
        if (dateFrom) params.date_from = dateFrom;
        if (dateTo) params.date_to = dateTo;
      }
    }
    return params;
  };

  const loadCardDetailsPage = async (cardKey, title, offset) => {
    setCardDetailsModal((prev) => ({
      ...prev,
      open: true,
      cardKey,
      title,
      loading: true,
      error: "",
      ...(offset === 0
        ? { rows: [], meta: { ...INITIAL_CARD_DETAILS_META } }
        : {}),
    }));
    try {
      const { data } = await api.get("/main/analytics/cards/details/", {
        params: buildCardDetailsParams(cardKey, offset),
      });
      const rows = parseCardDetailsRows(data);
      setCardDetailsModal((prev) => ({
        ...prev,
        loading: false,
        rows,
        meta: {
          count: typeof data?.count === "number" ? data.count : rows.length,
          offset: typeof data?.offset === "number" ? data.offset : offset,
          limit:
            typeof data?.limit === "number"
              ? data.limit
              : CARD_DETAILS_PAGE_SIZE,
          branch_id: data?.branch_id ?? null,
          totals:
            data?.totals && typeof data.totals === "object" ? data.totals : {},
          period: data?.period ?? null,
        },
      }));
    } catch (err) {
      const message =
        err?.response?.data?.detail ||
        err?.response?.data?.message ||
        (typeof err?.response?.data?.card === "string"
          ? err.response.data.card
          : null) ||
        "Не удалось загрузить детализацию";
      setCardDetailsModal((prev) => ({
        ...prev,
        loading: false,
        error: message,
      }));
    }
  };

  const openCardDetails = (cardKey, title) => {
    void loadCardDetailsPage(cardKey, title, 0);
  };

  const goCardDetailsPrev = () => {
    const { cardKey, title, meta } = cardDetailsModal;
    const nextOffset = Math.max(0, meta.offset - meta.limit);
    if (nextOffset === meta.offset) return;
    void loadCardDetailsPage(cardKey, title, nextOffset);
  };

  const goCardDetailsNext = () => {
    const { cardKey, title, meta } = cardDetailsModal;
    const nextOffset = meta.offset + meta.limit;
    if (nextOffset >= meta.count) return;
    void loadCardDetailsPage(cardKey, title, nextOffset);
  };

  const closeCardDetails = () => {
    setCardDetailsModal({
      open: false,
      cardKey: "",
      title: "",
      loading: false,
      error: "",
      rows: [],
      meta: { ...INITIAL_CARD_DETAILS_META },
    });
  };

  const cardDetailsColumnLabel = (column) =>
    CARD_DETAILS_COLUMN_LABELS[cardDetailsModal.cardKey]?.[column] ?? column;

  // Загрузка данных через Redux (параметры по Owner Analytics API)
  const fetchData = () => {
    const params = {
      period,
      group_by: groupBy,
    };

    if (period === "day") {
      params.date = date || new Date().toISOString().slice(0, 10);
    } else {
      if (dateFrom) params.date_from = dateFrom;
      if (dateTo) params.date_to = dateTo;
    }

    dispatch(
      setProductionAnalyticsFilters({
        period,
        date: period === "day" ? date : "",
        date_from: dateFrom,
        date_to: dateTo,
        group_by: groupBy,
      }),
    );

    dispatch(fetchProductionAnalytics(params));
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Данные для графика перемещений
  const transfersByDateData = useMemo(() => {
    if (!analyticsData?.charts?.transfers_by_date) {
      return {
        labels: ["Нет данных"],
        datasets: [
          {
            label: "Перемещений",
            data: [0],
            backgroundColor: "#f7d74f",
            borderColor: "#f7d74f",
            borderWidth: 1,
            borderRadius: 4,
          },
          {
            label: "Товаров",
            data: [0],
            backgroundColor: "#10b981",
            borderColor: "#10b981",
            borderWidth: 1,
            borderRadius: 4,
          },
        ],
      };
    }

    const transfers = analyticsData.charts.transfers_by_date;
    const groupByType = analyticsData.period?.group_by || "day";

    return {
      labels: transfers.map((item) =>
        formatDateForDisplay(item.date, groupByType),
      ),
      datasets: [
        {
          label: "Перемещений",
          data: transfers.map((item) => item.transfers_count || 0),
          backgroundColor: "#f7d74f",
          borderColor: "#f7d74f",
          borderWidth: 1,
          borderRadius: 4,
        },
        {
          label: "Товаров",
          data: transfers.map((item) => item.items_transferred || 0),
          backgroundColor: "#10b981",
          borderColor: "#10b981",
          borderWidth: 1,
          borderRadius: 4,
        },
      ],
    };
  }, [analyticsData]);

  // Данные для графика продаж
  const salesByDateData = useMemo(() => {
    if (!analyticsData?.charts?.sales_by_date) {
      return {
        labels: ["Нет данных"],
        datasets: [
          {
            label: "Сумма (сом)",
            data: [0],
            borderColor: "#f7d74f",
            backgroundColor: "rgba(247, 215, 79, 0.2)",
            tension: 0.4,
          },
        ],
      };
    }

    const sales = analyticsData.charts.sales_by_date;
    const groupByType = analyticsData.period?.group_by || "day";

    return {
      labels: sales.map((item) => formatDateForDisplay(item.date, groupByType)),
      datasets: [
        {
          label: "Сумма (сом)",
          data: sales.map((item) => parseFloat(item.sales_amount || 0)),
          borderColor: "#f7d74f",
          backgroundColor: "rgba(247, 215, 79, 0.2)",
          tension: 0.4,
          fill: true,
        },
      ],
    };
  }, [analyticsData]);

  // Данные для круговой диаграммы распределения продаж
  const salesDistributionData = useMemo(() => {
    if (!analyticsData?.charts?.sales_distribution_by_product) {
      return {
        labels: ["Нет данных"],
        datasets: [
          {
            label: "Продажи",
            data: [0],
            backgroundColor: ["#f7d74f"],
            borderColor: ["#f7d74f"],
            borderWidth: 1,
          },
        ],
      };
    }

    const distribution = analyticsData.charts.sales_distribution_by_product;
    const colors = [
      "#f7d74f",
      "#f97316",
      "#10b981",
      "#3b82f6",
      "#8b5cf6",
      "#ec4899",
      "#06b6d4",
      "#f59e0b",
    ];

    return {
      labels: distribution.map(
        (item) => `${item.product_name} ${item.percent?.toFixed(1) || 0}%`,
      ),
      datasets: [
        {
          label: "Продажи",
          data: distribution.map((item) => parseFloat(item.amount || 0)),
          backgroundColor: colors.slice(0, distribution.length),
          borderColor: colors.slice(0, distribution.length),
          borderWidth: 1,
        },
      ],
    };
  }, [analyticsData]);

  const barOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: "top",
      },
      tooltip: {
        callbacks: {
          label: function (context) {
            return `${context.dataset.label}: ${formatNumber(
              context.parsed.y,
            )}`;
          },
        },
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          callback: function (value) {
            return formatNumber(value);
          },
        },
      },
    },
  };

  const lineOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: "top",
      },
      tooltip: {
        callbacks: {
          label: function (context) {
            return `Сумма: ${formatMoney(context.parsed.y)} сом`;
          },
        },
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          callback: function (value) {
            return `${formatNumber(value)} сом`;
          },
        },
      },
    },
  };

  const doughnutOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: "bottom",
      },
      tooltip: {
        callbacks: {
          label: function (context) {
            const total = context.dataset.data.reduce((a, b) => a + b, 0);
            const percent = ((context.parsed / total) * 100).toFixed(1);
            return `${context.label}: ${formatMoney(
              context.parsed,
            )} сом (${percent}%)`;
          },
        },
      },
    },
  };

  // Применение фильтров при изменении периода
  const handlePeriodChange = (newPeriod) => {
    const today = new Date().toISOString().slice(0, 10);
    if (newPeriod === "day" && !date) setDate(today);
    setPeriod(newPeriod);

    const params = { period: newPeriod, group_by: groupBy };
    if (newPeriod === "day") {
      params.date = date || today;
    } else {
      if (dateFrom) params.date_from = dateFrom;
      if (dateTo) params.date_to = dateTo;
    }

    dispatch(
      setProductionAnalyticsFilters({
        period: newPeriod,
        date: newPeriod === "day" ? date || today : "",
        date_from: dateFrom,
        date_to: dateTo,
        group_by: groupBy,
      }),
    );

    const canFetch = newPeriod === "day" || (dateFrom && dateTo);
    if (canFetch) dispatch(fetchProductionAnalytics(params));
  };

  // Применение фильтров при изменении группировки
  const handleGroupByChange = (newGroupBy) => {
    setGroupBy(newGroupBy);

    const params = { period, group_by: newGroupBy };
    if (period === "day") {
      if (date) params.date = date;
    } else {
      if (dateFrom) params.date_from = dateFrom;
      if (dateTo) params.date_to = dateTo;
    }

    dispatch(
      setProductionAnalyticsFilters({
        period,
        date: period === "day" ? date : "",
        date_from: dateFrom,
        date_to: dateTo,
        group_by: newGroupBy,
      }),
    );

    const canFetch = period === "day" ? true : dateFrom && dateTo;
    if (canFetch) {
      dispatch(fetchProductionAnalytics(params));
    }
  };

  const handleResetFilters = () => {
    const today = new Date().toISOString().slice(0, 10);
    setPeriod("month");
    setDate(today);
    setDateFrom("");
    setDateTo("");
    setGroupBy("day");
    dispatch(
      setProductionAnalyticsFilters({
        period: "month",
        date: "",
        date_from: "",
        date_to: "",
        group_by: "day",
      }),
    );
    dispatch(fetchProductionAnalytics({ period: "month", group_by: "day" }));
  };

  // Получаем сообщение об ошибке
  const errorMessage = useMemo(() => {
    if (!error) return null;
    if (typeof error === "string") return error;
    if (error.status === 403) {
      return "Доступ запрещен. Только для владельцев и администраторов.";
    } else if (error.status === 400) {
      return error.message || "Ошибка в параметрах запроса";
    } else if (error.status === 401) {
      return "Необходима авторизация";
    }
    return error.message || "Не удалось загрузить данные аналитики";
  }, [error]);

  if (loading && !analyticsData) {
    return (
      <div className="agent-analytics">
        <div className="agent-analytics__loading">
          <div className="agent-analytics__spinner"></div>
          <p>Загрузка данных...</p>
        </div>
      </div>
    );
  }

  // Проверяем роль пользователя
  const isOwner =
    profile?.role === "owner" || profile?.role_display === "Владелец";

  // Если пользователь не владелец, показываем аналитику сотрудника
  if (!isOwner) {
    return <AgentAnalytics />;
  }

  if (errorMessage && !loading && !analyticsData) {
    return (
      <div className="agent-analytics">
        <div className="agent-analytics__error">
          <p>{errorMessage}</p>
          <button onClick={fetchData}>Попробовать снова</button>
        </div>
      </div>
    );
  }

  const summary = analyticsData?.summary || {};
  const charts = analyticsData?.charts || {};
  const detailColumns = getDisplayDetailColumns(
    cardDetailsModal.cardKey,
    cardDetailsModal.rows,
  );

  return (
    <div className="agent-analytics">
      {/* Кнопка для открытия фильтров */}
      {!showFilters && (
        <div
          style={{
            marginBottom: "24px",
            display: "flex",
            justifyContent: "flex-end",
            gap: "8px",
          }}
        >
          <button
            onClick={() => setShowFilters(true)}
            style={{
              padding: "10px 20px",
              border: "1px solid #e0e0e0",
              borderRadius: "6px",
              background: "white",
              cursor: "pointer",
              fontSize: "14px",
              fontWeight: "600",
              color: "#333",
              display: "flex",
              alignItems: "center",
              gap: "8px",
              transition: "all 0.2s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = "#f7d74f";
              e.currentTarget.style.background = "#fffbf0";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = "#e0e0e0";
              e.currentTarget.style.background = "white";
            }}
          >
            <Filter size={18} />
            Фильтры
          </button>
          <button
            onClick={fetchData}
            disabled={loading}
            style={{
              padding: "10px 20px",
              border: "none",
              borderRadius: "6px",
              background: loading ? "#ccc" : "#f7d74f",
              cursor: loading ? "not-allowed" : "pointer",
              color: "#333",
              fontWeight: "600",
              fontSize: "14px",
              display: "flex",
              alignItems: "center",
              gap: "8px",
              transition: "all 0.2s",
              opacity: loading ? 0.6 : 1,
            }}
            onMouseEnter={(e) => {
              if (!loading) {
                e.currentTarget.style.background = "#f5c842";
              }
            }}
            onMouseLeave={(e) => {
              if (!loading) {
                e.currentTarget.style.background = "#f7d74f";
              }
            }}
          >
            <RefreshCw
              size={16}
              style={{
                animation: loading ? "spin 1s linear infinite" : "none",
              }}
            />
            Обновить
          </button>
        </div>
      )}
      {/* Панель фильтров с селектами */}
      {showFilters && (
        <div
          className="agent-analytics__table-card"
          style={{
            marginBottom: "24px",
            padding: "16px 20px",
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
              gap: "16px",
              alignItems: "end",
            }}
          >
            {/* Селект периода */}
            <div>
              <label
                style={{
                  display: "block",
                  marginBottom: "8px",
                  fontSize: "14px",
                  fontWeight: "600",
                  color: "#333",
                }}
              >
                Период
              </label>
              <select
                value={period}
                onChange={(e) => handlePeriodChange(e.target.value)}
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  border: "1px solid #e0e0e0",
                  borderRadius: "6px",
                  fontSize: "14px",
                  cursor: "pointer",
                  background: "white",
                  color: "#333",
                }}
              >
                <option value="day">День</option>
                <option value="week">Неделя</option>
                <option value="month">Месяц</option>
                <option value="custom">Произвольный</option>
              </select>
            </div>

            {/* Для period=day — одна дата */}
            {period === "day" && (
              <div>
                <label
                  style={{
                    display: "block",
                    marginBottom: "8px",
                    fontSize: "14px",
                    fontWeight: "600",
                    color: "#333",
                  }}
                >
                  Дата
                </label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => {
                    const v = e.target.value;
                    setDate(v);
                    dispatch(
                      setProductionAnalyticsFilters({
                        period,
                        date: v,
                        date_from: dateFrom,
                        date_to: dateTo,
                        group_by: groupBy,
                      }),
                    );
                    const params = { period, group_by: groupBy, date: v };
                    dispatch(fetchProductionAnalytics(params));
                  }}
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    border: "1px solid #e0e0e0",
                    borderRadius: "6px",
                    fontSize: "14px",
                    cursor: "pointer",
                  }}
                />
              </div>
            )}

            {/* Дата от (для week / month / custom) */}
            {period !== "day" && (
              <>
                <div>
                  <label
                    style={{
                      display: "block",
                      marginBottom: "8px",
                      fontSize: "14px",
                      fontWeight: "600",
                      color: "#333",
                    }}
                  >
                    Дата от
                  </label>
                  <input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => {
                      const v = e.target.value;
                      setDateFrom(v);
                      const params = {
                        period,
                        group_by: groupBy,
                        date_from: v,
                        date_to: dateTo,
                      };
                      dispatch(
                        setProductionAnalyticsFilters({
                          period,
                          date: "",
                          date_from: v,
                          date_to: dateTo,
                          group_by: groupBy,
                        }),
                      );
                      if (v && dateTo)
                        dispatch(fetchProductionAnalytics(params));
                    }}
                    style={{
                      width: "100%",
                      padding: "10px 12px",
                      border: "1px solid #e0e0e0",
                      borderRadius: "6px",
                      fontSize: "14px",
                      cursor: "pointer",
                    }}
                  />
                </div>

                <div>
                  <label
                    style={{
                      display: "block",
                      marginBottom: "8px",
                      fontSize: "14px",
                      fontWeight: "600",
                      color: "#333",
                    }}
                  >
                    Дата до
                  </label>
                  <input
                    type="date"
                    value={dateTo}
                    onChange={(e) => {
                      const v = e.target.value;
                      setDateTo(v);
                      const params = {
                        period,
                        group_by: groupBy,
                        date_from: dateFrom,
                        date_to: v,
                      };
                      dispatch(
                        setProductionAnalyticsFilters({
                          period,
                          date: "",
                          date_from: dateFrom,
                          date_to: v,
                          group_by: groupBy,
                        }),
                      );
                      if (dateFrom && v)
                        dispatch(fetchProductionAnalytics(params));
                    }}
                    style={{
                      width: "100%",
                      padding: "10px 12px",
                      border: "1px solid #e0e0e0",
                      borderRadius: "6px",
                      fontSize: "14px",
                      cursor: "pointer",
                    }}
                  />
                </div>
              </>
            )}

            {/* Селект группировки */}
            <div>
              <label
                style={{
                  display: "block",
                  marginBottom: "8px",
                  fontSize: "14px",
                  fontWeight: "600",
                  color: "#333",
                }}
              >
                Группировка
              </label>
              <select
                value={groupBy}
                onChange={(e) => handleGroupByChange(e.target.value)}
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  border: "1px solid #e0e0e0",
                  borderRadius: "6px",
                  fontSize: "14px",
                  cursor: "pointer",
                  background: "white",
                  color: "#333",
                }}
              >
                <option value="day">По дням</option>
                <option value="week">По неделям</option>
                <option value="month">По месяцам</option>
              </select>
            </div>
          </div>

          {/* Кнопки действий */}
          <div
            style={{
              display: "flex",
              gap: "8px",
              alignItems: "center",
              justifyContent: "flex-end",
              marginTop: "16px",
            }}
          >
            <button
              onClick={handleResetFilters}
              style={{
                padding: "8px 16px",
                border: "1px solid #e0e0e0",
                borderRadius: "6px",
                background: "white",
                cursor: "pointer",
                fontSize: "14px",
                display: "flex",
                alignItems: "center",
                gap: "6px",
                transition: "all 0.2s",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = "#ccc";
                e.currentTarget.style.background = "#f9f9f9";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = "#e0e0e0";
                e.currentTarget.style.background = "white";
              }}
            >
              Сбросить
            </button>
            <button
              onClick={fetchData}
              disabled={loading}
              style={{
                padding: "8px 16px",
                border: "none",
                borderRadius: "6px",
                background: loading ? "#ccc" : "#f7d74f",
                cursor: loading ? "not-allowed" : "pointer",
                color: "#333",
                fontWeight: "600",
                fontSize: "14px",
                display: "flex",
                alignItems: "center",
                gap: "6px",
                transition: "all 0.2s",
                opacity: loading ? 0.6 : 1,
              }}
              onMouseEnter={(e) => {
                if (!loading) {
                  e.currentTarget.style.background = "#f5c842";
                }
              }}
              onMouseLeave={(e) => {
                if (!loading) {
                  e.currentTarget.style.background = "#f7d74f";
                }
              }}
            >
              <RefreshCw
                size={16}
                style={{
                  animation: loading ? "spin 1s linear infinite" : "none",
                }}
              />
              Обновить
            </button>
            <button
              onClick={() => setShowFilters(false)}
              style={{
                padding: "8px 16px",
                border: "1px solid #e0e0e0",
                borderRadius: "6px",
                background: "white",
                cursor: "pointer",
                fontSize: "14px",
                display: "flex",
                alignItems: "center",
                gap: "6px",
                transition: "all 0.2s",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = "#999";
                e.currentTarget.style.background = "#f5f5f5";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = "#e0e0e0";
                e.currentTarget.style.background = "white";
              }}
              title="Закрыть фильтры"
            >
              <span style={{ fontSize: "18px" }}>×</span>
            </button>
          </div>
        </div>
      )}
      {/* Верхние карточки-метрики */}
      <div className="agent-analytics__metrics">
        <div
          className="agent-analytics__metric-card agent-analytics__metric-card--clickable"
          role="button"
          tabIndex={0}
          onClick={() => openCardDetails("users_count", "Пользователей")}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              openCardDetails("users_count", "Пользователей");
            }
          }}
        >
          <div className="agent-analytics__metric-icon agent-analytics__metric-icon--blue">
            <Users size={24} />
          </div>
          <div>
            <h3>Пользователей</h3>
            <p>{formatNumber(summary.users_count || 0)}</p>
            <span style={{ fontSize: 12, color: "#6b7280" }}>
              Компания, снимок (не от периода)
            </span>
          </div>
        </div>

        {!startPlan && (
          <div
            className="agent-analytics__metric-card agent-analytics__metric-card--clickable"
            role="button"
            tabIndex={0}
            onClick={() => openCardDetails("transfers_count", "Перемещений")}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                openCardDetails("transfers_count", "Перемещений");
              }
            }}
          >
            <div className="agent-analytics__metric-icon agent-analytics__metric-icon--light-blue">
              <ArrowLeftRight size={24} />
            </div>
            <div>
              <h3>Перемещений</h3>
              <p>{formatNumber(summary.transfers_count || 0)}</p>
              <span style={{ fontSize: 12, color: "#6b7280" }}>
                Всего за период
              </span>
            </div>
          </div>
        )}

        {!startPlan && (
          <div
            className="agent-analytics__metric-card agent-analytics__metric-card--clickable"
            role="button"
            tabIndex={0}
            onClick={() => openCardDetails("acceptances_count", "Приёмки")}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                openCardDetails("acceptances_count", "Приёмки");
              }
            }}
          >
            <div className="agent-analytics__metric-icon agent-analytics__metric-icon--green">
              <Package size={24} />
            </div>
            <div>
              <h3>Принято</h3>
              <p>{formatNumber(summary.acceptances_count || 0)}</p>
              <span style={{ fontSize: 12, color: "#6b7280" }}>
                Приёмок товаров
              </span>
            </div>
          </div>
        )}

        {!startPlan && (
          <div
            className="agent-analytics__metric-card agent-analytics__metric-card--clickable"
            role="button"
            tabIndex={0}
            onClick={() =>
              openCardDetails("items_transferred", "Товаров перемещено")
            }
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                openCardDetails("items_transferred", "Товаров перемещено");
              }
            }}
          >
            <div className="agent-analytics__metric-icon agent-analytics__metric-icon--orange">
              <Package size={24} />
            </div>
            <div>
              <h3>Товаров</h3>
              <p>{formatNumber(summary.items_transferred || 0)}</p>
              <span style={{ fontSize: 12, color: "#6b7280" }}>
                Перемещено единиц
              </span>
            </div>
          </div>
        )}

        <div
          className="agent-analytics__metric-card agent-analytics__metric-card--clickable"
          role="button"
          tabIndex={0}
          onClick={() =>
            openCardDetails("defective_items", "Брак (принятые возвраты)")
          }
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              openCardDetails("defective_items", "Брак (принятые возвраты)");
            }
          }}
        >
          <div className="agent-analytics__metric-icon agent-analytics__metric-icon--orange">
            <AlertTriangle size={24} />
          </div>
          <div>
            <h3>Брак (возвраты)</h3>
            <p>{formatNumber(summary.defective_items || 0)}</p>
            <span style={{ fontSize: 12, color: "#6b7280" }}>
              Принятые возвраты, qty за период
            </span>
          </div>
        </div>

        <div
          className="agent-analytics__metric-card agent-analytics__metric-card--clickable"
          role="button"
          tabIndex={0}
          onClick={() => openCardDetails("sales_count", "Продаж")}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              openCardDetails("sales_count", "Продаж");
            }
          }}
        >
          <div className="agent-analytics__metric-icon agent-analytics__metric-icon--purple">
            <ShoppingCart size={24} />
          </div>
          <div>
            <h3>Продаж</h3>
            <p>{formatNumber(summary.sales_count || 0)}</p>
            <span style={{ fontSize: 12, color: "#6b7280" }}>За период</span>
          </div>
        </div>

        <div
          className="agent-analytics__metric-card agent-analytics__metric-card--clickable"
          role="button"
          tabIndex={0}
          onClick={() => openCardDetails("sales_amount", "Сумма продаж")}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              openCardDetails("sales_amount", "Сумма продаж");
            }
          }}
        >
          <div className="agent-analytics__metric-icon agent-analytics__metric-icon--green">
            <DollarSign size={24} />
          </div>
          <div>
            <h3>Сумма продаж</h3>
            <p>{formatMoney(summary.sales_amount || 0)} сом</p>
            <span style={{ fontSize: 12, color: "#6b7280" }}>
              Σ total по оплаченным продажам за период
            </span>
          </div>
        </div>

        <div
          className="agent-analytics__metric-card agent-analytics__metric-card--clickable"
          role="button"
          tabIndex={0}
          onClick={() => openCardDetails("revenue", "Выручка по строкам")}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              openCardDetails("revenue", "Выручка по строкам");
            }
          }}
        >
          <div className="agent-analytics__metric-icon agent-analytics__metric-icon--green">
            <BarChart3 size={24} />
          </div>
          <div>
            <h3>Выручка (по строкам)</h3>
            <p>{formatMoney(summary.revenue || 0)} сом</p>
            <span style={{ fontSize: 12, color: "#6b7280" }}>
              Σ(q×цена − скидка строки), оплаченные продажи
            </span>
          </div>
        </div>

        <div
          className="agent-analytics__metric-card agent-analytics__metric-card--clickable"
          role="button"
          tabIndex={0}
          onClick={() =>
            openCardDetails("cost_of_goods_sold", "Себестоимость продаж")
          }
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              openCardDetails("cost_of_goods_sold", "Себестоимость продаж");
            }
          }}
        >
          <div className="agent-analytics__metric-icon agent-analytics__metric-icon--orange">
            <PiggyBank size={24} />
          </div>
          <div>
            <h3>Себестоимость продаж</h3>
            <p>{formatMoney(summary.cost_of_goods_sold || 0)} сом</p>
            <span style={{ fontSize: 12, color: "#6b7280" }}>
              Σ(q×закупка строки) за период
            </span>
          </div>
        </div>

        <div
          className="agent-analytics__metric-card agent-analytics__metric-card--clickable"
          role="button"
          tabIndex={0}
          onClick={() => openCardDetails("gross_profit", "Валовая прибыль")}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              openCardDetails("gross_profit", "Валовая прибыль");
            }
          }}
        >
          <div className="agent-analytics__metric-icon agent-analytics__metric-icon--green">
            <TrendingUp size={24} />
          </div>
          <div>
            <h3>Валовая прибыль</h3>
            <p>{formatMoney(summary.gross_profit || 0)} сом</p>
            <span style={{ fontSize: 12, color: "#6b7280" }}>
              Выручка (по строкам) − себестоимость
            </span>
          </div>
        </div>

        <div
          className="agent-analytics__metric-card agent-analytics__metric-card--clickable"
          role="button"
          tabIndex={0}
          onClick={() =>
            openCardDetails("gross_margin_percent", "Валовая маржа")
          }
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              openCardDetails("gross_margin_percent", "Валовая маржа");
            }
          }}
        >
          <div className="agent-analytics__metric-icon agent-analytics__metric-icon--purple">
            <PieChart size={24} />
          </div>
          <div>
            <h3>Валовая маржа</h3>
            <p>{formatPercent(summary.gross_margin_percent)}</p>
            <span style={{ fontSize: 12, color: "#6b7280" }}>
              При положительной выручке: прибыль / выручка × 100
            </span>
          </div>
        </div>

        <div
          className="agent-analytics__metric-card agent-analytics__metric-card--clickable"
          role="button"
          tabIndex={0}
          onClick={() => openCardDetails("discounts_total", "Сумма скидок")}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              openCardDetails("discounts_total", "Сумма скидок");
            }
          }}
        >
          <div className="agent-analytics__metric-icon agent-analytics__metric-icon--purple">
            <Percent size={24} />
          </div>
          <div>
            <h3>Сумма скидок</h3>
            <p>{formatMoney(summary.discounts_total || 0)} сом</p>
            <span style={{ fontSize: 12, color: "#6b7280" }}>
              По оплаченным продажам за период
            </span>
          </div>
        </div>

        <div
          className="agent-analytics__metric-card agent-analytics__metric-card--clickable"
          role="button"
          tabIndex={0}
          onClick={() =>
            openCardDetails("stock_purchase_value", "Склад (закуп)")
          }
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              openCardDetails("stock_purchase_value", "Склад (закуп)");
            }
          }}
        >
          <div className="agent-analytics__metric-icon agent-analytics__metric-icon--light-blue">
            <Warehouse size={24} />
          </div>
          <div>
            <h3>Склад (закуп)</h3>
            <p>{formatMoney(summary.stock_purchase_value || 0)} сом</p>
            <span style={{ fontSize: 12, color: "#6b7280" }}>
              Снимок: Σ(q×закуп), без услуг, компания + филиал
            </span>
          </div>
        </div>

        <div
          className="agent-analytics__metric-card agent-analytics__metric-card--clickable"
          role="button"
          tabIndex={0}
          onClick={() =>
            openCardDetails("stock_retail_value", "Склад (розница)")
          }
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              openCardDetails("stock_retail_value", "Склад (розница)");
            }
          }}
        >
          <div className="agent-analytics__metric-icon agent-analytics__metric-icon--green">
            <DollarSign size={24} />
          </div>
          <div>
            <h3>Склад (розница)</h3>
            <p>{formatMoney(summary.stock_retail_value || 0)} сом</p>
            <span style={{ fontSize: 12, color: "#6b7280" }}>
              Снимок: Σ(q×розница), без услуг
            </span>
          </div>
        </div>

        <div
          className="agent-analytics__metric-card agent-analytics__metric-card--clickable"
          role="button"
          tabIndex={0}
          onClick={() =>
            openCardDetails("raw_material_value", "Стоимость сырья")
          }
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              openCardDetails("raw_material_value", "Стоимость сырья");
            }
          }}
        >
          <div className="agent-analytics__metric-icon agent-analytics__metric-icon--orange">
            <Package size={24} />
          </div>
          <div>
            <h3>Стоимость сырья</h3>
            <p>{formatMoney(summary.raw_material_value || 0)} сом</p>
            <span style={{ fontSize: 12, color: "#6b7280" }}>
              Снимок: сырьё (ItemMake), компания + филиал
            </span>
          </div>
        </div>

        <div
          className="agent-analytics__metric-card agent-analytics__metric-card--clickable"
          role="button"
          tabIndex={0}
          onClick={() => openCardDetails("stock_value", "Стоимость склада")}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              openCardDetails("stock_value", "Стоимость склада");
            }
          }}
        >
          <div className="agent-analytics__metric-icon agent-analytics__metric-icon--light-blue">
            <Warehouse size={24} />
          </div>
          <div>
            <h3>Стоимость склада</h3>
            <p>{formatMoney(summary.stock_value || 0)} сом</p>
            <span style={{ fontSize: 12, color: "#6b7280" }}>
              Закупочная оценка (как «Склад закуп»), без услуг
            </span>
          </div>
        </div>

        <div
          className="agent-analytics__metric-card agent-analytics__metric-card--clickable"
          role="button"
          tabIndex={0}
          onClick={() => openCardDetails("accounts_receivable", "Дебиторская")}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              openCardDetails("accounts_receivable", "Дебиторская");
            }
          }}
        >
          <div className="agent-analytics__metric-icon agent-analytics__metric-icon--purple">
            <Receipt size={24} />
          </div>
          <div>
            <h3>Дебиторская</h3>
            <p>{formatMoney(summary.accounts_receivable || 0)} сом</p>
            <span style={{ fontSize: 12, color: "#6b7280" }}>
              Сделки в долг + продажи в долг (POS)
            </span>
            <span
              style={{
                fontSize: 11,
                color: "#9ca3af",
                display: "block",
                marginTop: 6,
                lineHeight: 1.35,
              }}
            >
              Сделки:{" "}
              {formatMoney(summary.accounts_receivable_client_deals || 0)} ·
              POS: {formatMoney(summary.accounts_receivable_pos_sales || 0)}
            </span>
          </div>
        </div>

        <div
          className="agent-analytics__metric-card agent-analytics__metric-card--clickable"
          role="button"
          tabIndex={0}
          onClick={() => openCardDetails("accounts_payable", "Кредиторская")}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              openCardDetails("accounts_payable", "Кредиторская");
            }
          }}
        >
          <div className="agent-analytics__metric-icon agent-analytics__metric-icon--light-blue">
            <Wallet size={24} />
          </div>
          <div>
            <h3>Кредиторская</h3>
            <p>{formatMoney(summary.accounts_payable || 0)} сом</p>
            <span style={{ fontSize: 12, color: "#6b7280" }}>
              Наши обязательства
            </span>
          </div>
        </div>

        <div
          className="agent-analytics__metric-card agent-analytics__metric-card--clickable"
          role="button"
          tabIndex={0}
          onClick={() => openCardDetails("total_debt", "Общий долг")}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              openCardDetails("total_debt", "Общий долг");
            }
          }}
        >
          <div className="agent-analytics__metric-icon agent-analytics__metric-icon--orange">
            <Wallet size={24} />
          </div>
          <div>
            <h3>Общий долг</h3>
            <p>{formatMoney(summary.total_debt || 0)} сом</p>
            <span style={{ fontSize: 12, color: "#6b7280" }}>
              Только рассрочка CRM (сделки), без POS-долга
            </span>
          </div>
        </div>
      </div>
      {/* Блок с перемещениями и распределением продаж */}
      <div className="agent-analytics__section">
        <div className="agent-analytics__charts">
          {!startPlan && (
            <div className="agent-analytics__chart-card">
              <h3>Перемещения по датам</h3>
              <div className="agent-analytics__chart-container">
                <Bar data={transfersByDateData} options={barOptions} />
              </div>
            </div>
          )}

          <div className="agent-analytics__chart-card">
            <h3>Распределение продаж по товарам</h3>
            <div className="agent-analytics__chart-container agent-analytics__chart-container--doughnut">
              <Doughnut
                data={salesDistributionData}
                options={doughnutOptions}
              />
            </div>
          </div>
        </div>
      </div>

      {cardDetailsModal.open && (
        <div
          className="agent-analytics__modal-backdrop"
          onClick={closeCardDetails}
        >
          <div
            className="agent-analytics__modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="agent-analytics__modal-header"
              style={{ alignItems: "flex-start" }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <h3>Детализация: {cardDetailsModal.title}</h3>
                {cardDetailsModal.meta.period && (
                  <p
                    style={{
                      fontSize: 13,
                      color: "#6b7280",
                      margin: "8px 0 0 0",
                    }}
                  >
                    Период: {cardDetailsModal.meta.period.date_from} —{" "}
                    {cardDetailsModal.meta.period.date_to}
                    {cardDetailsModal.meta.period.type
                      ? ` (${cardDetailsModal.meta.period.type})`
                      : ""}
                  </p>
                )}
                {cardDetailsModal.meta.totals &&
                  Object.keys(cardDetailsModal.meta.totals).length > 0 && (
                    <div
                      style={{
                        marginTop: 8,
                        fontSize: 13,
                        display: "flex",
                        flexWrap: "wrap",
                        gap: "8px 16px",
                        color: "#374151",
                      }}
                    >
                      {Object.entries(cardDetailsModal.meta.totals).map(
                        ([k, v]) => (
                          <span key={k}>
                            <strong>{TOTALS_VALUE_LABELS[k] ?? k}:</strong>{" "}
                            {formatTotalsValue(k, v)}
                          </span>
                        ),
                      )}
                    </div>
                  )}
              </div>
              <button type="button" onClick={closeCardDetails}>
                ×
              </button>
            </div>
            <div className="agent-analytics__modal-body">
              {cardDetailsModal.loading &&
                cardDetailsModal.rows.length === 0 && <p>Загрузка...</p>}
              {cardDetailsModal.loading && cardDetailsModal.rows.length > 0 && (
                <p
                  style={{
                    fontSize: 13,
                    color: "#6b7280",
                    marginTop: 0,
                    marginBottom: 8,
                  }}
                >
                  Обновление…
                </p>
              )}
              {!cardDetailsModal.loading && cardDetailsModal.error && (
                <p>{cardDetailsModal.error}</p>
              )}
              {!cardDetailsModal.loading &&
                !cardDetailsModal.error &&
                cardDetailsModal.rows.length === 0 && <p>Нет данных</p>}
              {cardDetailsModal.rows.length > 0 && (
                <>
                  <div className="agent-analytics__table">
                    <table>
                      <thead>
                        <tr>
                          <th key="__rowNum">№</th>
                          {detailColumns.map((column) => (
                            <th key={column}>
                              {cardDetailsColumnLabel(column)}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {cardDetailsModal.rows.map((row, idx) => (
                          <tr key={idx}>
                            <td key={`${idx}-__num`}>
                              {cardDetailsModal.meta.offset + idx + 1}
                            </td>
                            {detailColumns.map((column) => (
                              <td key={`${idx}-${column}`}>
                                {formatDetailsCell(row?.[column], column)}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {(cardDetailsModal.meta.offset > 0 ||
                    cardDetailsModal.meta.offset +
                      cardDetailsModal.rows.length <
                      cardDetailsModal.meta.count) && (
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        flexWrap: "wrap",
                        gap: 12,
                        marginTop: 12,
                        fontSize: 13,
                        color: "#374151",
                      }}
                    >
                      <span>
                        Всего записей: {cardDetailsModal.meta.count}. Показано{" "}
                        {cardDetailsModal.meta.offset + 1}—
                        {Math.min(
                          cardDetailsModal.meta.offset +
                            cardDetailsModal.rows.length,
                          cardDetailsModal.meta.count,
                        )}
                      </span>
                      <span style={{ display: "flex", gap: 8 }}>
                        <button
                          type="button"
                          disabled={
                            cardDetailsModal.loading ||
                            cardDetailsModal.meta.offset === 0
                          }
                          onClick={goCardDetailsPrev}
                          style={{
                            padding: "6px 12px",
                            borderRadius: 6,
                            border: "1px solid #d1d5db",
                            background: "#fff",
                            cursor:
                              cardDetailsModal.loading ||
                              cardDetailsModal.meta.offset === 0
                                ? "not-allowed"
                                : "pointer",
                          }}
                        >
                          Назад
                        </button>
                        <button
                          type="button"
                          disabled={
                            cardDetailsModal.loading ||
                            cardDetailsModal.meta.offset +
                              cardDetailsModal.meta.limit >=
                              cardDetailsModal.meta.count
                          }
                          onClick={goCardDetailsNext}
                          style={{
                            padding: "6px 12px",
                            borderRadius: 6,
                            border: "1px solid #d1d5db",
                            background: "#fff",
                            cursor:
                              cardDetailsModal.loading ||
                              cardDetailsModal.meta.offset +
                                cardDetailsModal.meta.limit >=
                                cardDetailsModal.meta.count
                                ? "not-allowed"
                                : "pointer",
                          }}
                        >
                          Вперёд
                        </button>
                      </span>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
      {/* Продажи по датам */}
      <div className="agent-analytics__section">
        <h2 className="agent-analytics__section-title">
          <span className="agent-analytics__section-icon chart-container">
            <BarChart3 className="chart-icon" />
          </span>
          Продажи по датам
        </h2>
        <div className="agent-analytics__chart-card">
          <div className="agent-analytics__chart-container">
            <Line data={salesByDateData} options={lineOptions} />
          </div>
        </div>
      </div>
      {/* Таблицы: топы по товарам и пользователям */}
      <div className="agent-analytics__section">
        {/* <div className="agent-analytics__charts"> */}
        <div className="agent-analytics__table-card">
          <h3 className="agent-analytics__table-title">
            Топ товаров по продажам
          </h3>
          <div className="agent-analytics__table">
            <table>
              <thead>
                <tr>
                  <th>Товар</th>
                  <th>Количество</th>
                  <th>Сумма (сом)</th>
                  <th>% от общего</th>
                </tr>
              </thead>
              <tbody>
                {charts.top_products_by_sales?.length > 0 ? (
                  charts.top_products_by_sales.map((product, index) => {
                    const totalAmount = charts.top_products_by_sales.reduce(
                      (sum, p) => sum + parseFloat(p.amount || 0),
                      0,
                    );
                    const percent =
                      totalAmount > 0
                        ? (
                            (parseFloat(product.amount || 0) / totalAmount) *
                            100
                          ).toFixed(1)
                        : 0;
                    return (
                      <tr key={index}>
                        <td>{product.product_name || "—"}</td>
                        <td>{formatNumber(product.qty || 0)} шт</td>
                        <td>{formatMoney(product.amount || 0)} сом</td>
                        <td>{percent}%</td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={4} style={{ textAlign: "center" }}>
                      Нет данных
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
        {/* </div> */}
      </div>
      {!startPlan && (
        <div className="agent-analytics__section">
          <div className="agent-analytics__table-card">
            <h3 className="agent-analytics__table-title">
              Топ пользователей по перемещениям
            </h3>
            <div className="agent-analytics__table">
              <table>
                <thead>
                  <tr>
                    <th>Пользователь</th>
                    <th>Роль</th>
                    <th>Перемещений</th>
                    <th>Товаров</th>
                  </tr>
                </thead>
                <tbody>
                  {charts.top_users_by_transfers?.length > 0 ? (
                    charts.top_users_by_transfers.map((user, index) => (
                      <tr key={index}>
                        <td>{user.user_name || "—"}</td>
                        <td>{user.role || "—"}</td>
                        <td>{formatNumber(user.transfers_count || 0)}</td>
                        <td>{formatNumber(user.items_transferred || 0)} шт</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4} style={{ textAlign: "center" }}>
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
      <div className="agent-analytics__section">
        <div className="agent-analytics__table-card">
          <h3 className="agent-analytics__table-title">
            Топ пользователей по продажам
          </h3>
          <div className="agent-analytics__table">
            <table>
              <thead>
                <tr>
                  <th>Пользователь</th>
                  <th>Продаж</th>
                  <th>Сумма (сом)</th>
                </tr>
              </thead>
              <tbody>
                {charts.top_users_by_sales?.length > 0 ? (
                  charts.top_users_by_sales.map((user, index) => (
                    <tr key={index}>
                      <td>{user.user_name || "—"}</td>
                      <td>{formatNumber(user.sales_count || 0)}</td>
                      <td>{formatMoney(user.sales_amount || 0)} сом</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={3} style={{ textAlign: "center" }}>
                      Нет данных
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Статьи расходов (expense_breakdown по API) */}
      <div className="agent-analytics__section">
        <div className="agent-analytics__table-card">
          <h3 className="agent-analytics__table-title">
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              <Receipt size={20} />
              Статьи расходов
            </span>
          </h3>
          <div className="agent-analytics__table">
            <table>
              <thead>
                <tr>
                  <th>Статья</th>
                  <th>Сумма (сом)</th>
                  <th>Операций</th>
                </tr>
              </thead>
              <tbody>
                {charts.expense_breakdown?.length > 0 ? (
                  charts.expense_breakdown.map((row, index) => (
                    <tr key={index}>
                      <td>{row.name || "Без названия"}</td>
                      <td>{formatMoney(row.total || 0)} сом</td>
                      <td>{formatNumber(row.count || 0)}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={3} style={{ textAlign: "center" }}>
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
  );
};

export default ProductionAnalytics;
