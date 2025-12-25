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
  Calendar,
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
import { fetchProductionAnalytics } from "../../../../store/creators/analyticsCreators";
import { setProductionAnalyticsFilters } from "../../../../store/slices/analyticsSlice";
import { useUser } from "../../../../store/slices/userSlice";
import AgentAnalytics from "./AgentAnalytics";
import "./AgentAnalytics.scss";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Tooltip,
  Legend
);

const ProductionAnalytics = () => {
  const dispatch = useDispatch();
  const { profile } = useUser();

  const {
    data: analyticsData,
    loading,
    error,
  } = useSelector((state) => state.analytics.productionAnalytics);
  const filters = useSelector(
    (state) => state.analytics.productionAnalytics.filters
  );

  const [showFilters, setShowFilters] = useState(false);

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

  // Загрузка данных через Redux
  const fetchData = () => {
    const params = {
      period,
      group_by: groupBy,
    };

    if (dateFrom) params.date_from = dateFrom;
    if (dateTo) params.date_to = dateTo;

    // Обновляем фильтры в Redux
    dispatch(
      setProductionAnalyticsFilters({
        period,
        date: "",
        date_from: dateFrom,
        date_to: dateTo,
        group_by: groupBy,
      })
    );

    // Загружаем данные через Redux
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
        formatDateForDisplay(item.date, groupByType)
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
        (item) => `${item.product_name} ${item.percent?.toFixed(1) || 0}%`
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
              context.parsed.y
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
              context.parsed
            )} сом (${percent}%)`;
          },
        },
      },
    },
  };

  // Применение фильтров при изменении периода
  const handlePeriodChange = (newPeriod) => {
    setPeriod(newPeriod);

    // Применяем фильтры сразу
    const params = {
      period: newPeriod,
      group_by: groupBy,
    };
    if (dateFrom) params.date_from = dateFrom;
    if (dateTo) params.date_to = dateTo;

    dispatch(
      setProductionAnalyticsFilters({
        period: newPeriod,
        date: "",
        date_from: dateFrom,
        date_to: dateTo,
        group_by: groupBy,
      })
    );

    // Применяем фильтры только если обе даты заполнены
    if (dateFrom && dateTo) {
      dispatch(fetchProductionAnalytics(params));
    }
  };

  // Применение фильтров при изменении группировки
  const handleGroupByChange = (newGroupBy) => {
    setGroupBy(newGroupBy);

    // Применяем фильтры сразу
    const params = {
      period,
      group_by: newGroupBy,
    };
    if (dateFrom) params.date_from = dateFrom;
    if (dateTo) params.date_to = dateTo;

    dispatch(
      setProductionAnalyticsFilters({
        period,
        date: "",
        date_from: dateFrom,
        date_to: dateTo,
        group_by: newGroupBy,
      })
    );

    // Применяем фильтры только если обе даты заполнены
    if (dateFrom && dateTo) {
      dispatch(fetchProductionAnalytics(params));
    }
  };

  const handleResetFilters = () => {
    setPeriod("month");
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
      })
    );
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

            {/* Дата от */}
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
                  setDateFrom(e.target.value);
                  // Применяем фильтры при изменении даты
                  const params = {
                    period,
                    group_by: groupBy,
                    date_from: e.target.value,
                    date_to: dateTo,
                  };
                  dispatch(
                    setProductionAnalyticsFilters({
                      period,
                      date: "",
                      date_from: e.target.value,
                      date_to: dateTo,
                      group_by: groupBy,
                    })
                  );
                  if (e.target.value && dateTo) {
                    dispatch(fetchProductionAnalytics(params));
                  }
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

            {/* Дата до */}
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
                  setDateTo(e.target.value);
                  // Применяем фильтры при изменении даты
                  const params = {
                    period,
                    group_by: groupBy,
                    date_from: dateFrom,
                    date_to: e.target.value,
                  };
                  dispatch(
                    setProductionAnalyticsFilters({
                      period,
                      date: "",
                      date_from: dateFrom,
                      date_to: e.target.value,
                      group_by: groupBy,
                    })
                  );
                  if (dateFrom && e.target.value) {
                    dispatch(fetchProductionAnalytics(params));
                  }
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
        <div className="agent-analytics__metric-card">
          <div className="agent-analytics__metric-icon agent-analytics__metric-icon--blue">
            <Users size={24} />
          </div>
          <div>
            <h3>Пользователей</h3>
            <p>{formatNumber(summary.users_count || 0)}</p>
            <span style={{ fontSize: 12, color: "#6b7280" }}>Участвующих</span>
          </div>
        </div>

        <div className="agent-analytics__metric-card">
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

        <div className="agent-analytics__metric-card">
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

        <div className="agent-analytics__metric-card">
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

        <div className="agent-analytics__metric-card">
          <div className="agent-analytics__metric-icon agent-analytics__metric-icon--purple">
            <ShoppingCart size={24} />
          </div>
          <div>
            <h3>Продаж</h3>
            <p>{formatNumber(summary.sales_count || 0)}</p>
            <span style={{ fontSize: 12, color: "#6b7280" }}>За период</span>
          </div>
        </div>

        <div className="agent-analytics__metric-card">
          <div className="agent-analytics__metric-icon agent-analytics__metric-icon--green">
            <DollarSign size={24} />
          </div>
          <div>
            <h3>Сумма продаж</h3>
            <p>{formatMoney(summary.sales_amount || 0)} сом</p>
            <span style={{ fontSize: 12, color: "#6b7280" }}>
              Общая выручка
            </span>
          </div>
        </div>
      </div>

      {/* Блок с перемещениями и распределением продаж */}
      <div className="agent-analytics__section">
        <div className="agent-analytics__charts">
          <div className="agent-analytics__chart-card">
            <h3>Перемещения по датам</h3>
            <div className="agent-analytics__chart-container">
              <Bar data={transfersByDateData} options={barOptions} />
            </div>
          </div>

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
                      0
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
    </div>
  );
};

export default ProductionAnalytics;
