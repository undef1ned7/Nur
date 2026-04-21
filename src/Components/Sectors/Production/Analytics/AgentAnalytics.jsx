import React, { useState, useEffect, useMemo } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate, useParams } from "react-router-dom";
import api from "../../../../api";
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
  Title,
} from "chart.js";
import { Line, Bar, Doughnut } from "react-chartjs-2";
import {
  ArrowLeft,
  TrendingUp,
  ShoppingCart,
  DollarSign,
  Package,
  Wallet,
  RefreshCw,
  BarChart3,
  ArrowLeftRight,
  Clock,
  Percent,
  AlertTriangle,
} from "lucide-react";
import { fetchAgentAnalytics } from "../../../../store/creators/analyticsCreators";
import { useUser } from "../../../../store/slices/userSlice";
import { isStartPlan } from "../../../../utils/subscriptionPlan";
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
  Title
);

const AgentAnalytics = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { tariff, company } = useUser();
  const startPlan = isStartPlan(tariff || company?.subscription_plan?.name);
  const { agentId } = useParams();
  const [period, setPeriod] = useState("month"); // day, week, month, custom (API)
  const [dateForDay, setDateForDay] = useState(() =>
    new Date().toISOString().slice(0, 10),
  );
  const [dateFromCustom, setDateFromCustom] = useState("");
  const [dateToCustom, setDateToCustom] = useState("");
  const [cardDetailsModal, setCardDetailsModal] = useState({
    open: false,
    cardKey: "",
    title: "",
    loading: false,
    error: "",
    rows: [],
    meta: { ...INITIAL_CARD_DETAILS_META },
  });

  // Получаем данные из Redux store
  const {
    data: analyticsData,
    loading,
    error: analyticsError,
  } = useSelector((state) => state.analytics.agentAnalytics);

  const analyticsQueryParams = useMemo(() => {
    const base = { agentId, period };
    if (period === "day") {
      return { ...base, date: dateForDay || undefined };
    }
    if (period === "custom") {
      return {
        ...base,
        date_from: dateFromCustom || undefined,
        date_to: dateToCustom || undefined,
      };
    }
    return base;
  }, [
    agentId,
    period,
    dateForDay,
    dateFromCustom,
    dateToCustom,
  ]);

  // Загрузка данных
  useEffect(() => {
    dispatch(fetchAgentAnalytics(analyticsQueryParams));
  }, [analyticsQueryParams, dispatch]);

  const fetchData = () => {
    dispatch(fetchAgentAnalytics(analyticsQueryParams));
  };

  const buildCardDetailsParams = (cardKey, offset = 0) => {
    const params = {
      card: cardKey,
      limit: CARD_DETAILS_PAGE_SIZE,
      offset,
      ...(agentId ? { agent_id: agentId } : {}),
    };
    if (CARD_DETAILS_USES_PERIOD.has(cardKey)) {
      params.period = period;
      if (period === "day") {
        params.date = dateForDay || new Date().toISOString().slice(0, 10);
      } else if (period === "custom") {
        if (dateFromCustom) params.date_from = dateFromCustom;
        if (dateToCustom) params.date_to = dateToCustom;
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

  // Получаем информацию об агенте из данных аналитики
  const selectedAgent = useMemo(() => {
    if (!analyticsData?.agent) return null;
    return {
      id: analyticsData.agent.id,
      first_name: analyticsData.agent.first_name,
      last_name: analyticsData.agent.last_name,
      email: analyticsData.agent.email || "",
      track_number: analyticsData.agent.track_number || "",
    };
  }, [analyticsData]);

  const error = analyticsError
    ? typeof analyticsError === "string"
      ? analyticsError
      : analyticsError.message || "Не удалось загрузить данные аналитики"
    : "";

  // Получаем историю передач из аналитики
  const transfersHistory = useMemo(() => {
    if (!analyticsData?.transfers_history) return [];
    return analyticsData.transfers_history || [];
  }, [analyticsData]);

  // Метрики для выбранного агента из summary
  const metrics = useMemo(() => {
    if (!analyticsData?.summary) {
      return {
        totalTransfers: 0,
        totalAcceptances: 0,
        totalQuantityTransferred: 0,
        defectiveItems: 0,
        totalSalesAmount: 0,
        totalSalesCount: 0,
        totalDiscounts: 0,
        totalProductsOnHand: 0,
        totalProductsValue: 0,
        totalClientsDebt: 0,
      };
    }

    const summary = analyticsData.summary;
    const discountsRaw = summary.discounts_total;
    const totalDiscounts =
      typeof discountsRaw === "string"
        ? parseFloat(discountsRaw) || 0
        : Number(discountsRaw) || 0;

    return {
      totalTransfers: summary.transfers_count || 0,
      totalAcceptances: summary.acceptances_count || 0,
      totalQuantityTransferred: summary.items_transferred || 0,
      defectiveItems: Number(summary.defective_items) || 0,
      totalSalesAmount: summary.sales_amount || 0,
      totalSalesCount: summary.sales_count || 0,
      totalDiscounts,
      totalProductsOnHand: summary.items_on_hand_qty || 0,
      totalProductsValue: summary.items_on_hand_amount || 0,
      totalClientsDebt: Number(summary.clients_debt_total) || 0,
    };
  }, [analyticsData]);

  // Данные для графика долга по клиентам из charts.clients_debt
  const clientsDebtChartData = useMemo(() => {
    const clientsDebt = Array.isArray(analyticsData?.charts?.clients_debt)
      ? analyticsData.charts.clients_debt
      : [];

    if (clientsDebt.length === 0) {
      return {
        labels: ["Нет данных"],
        datasets: [
          {
            label: "Долг (сом)",
            data: [0],
            backgroundColor: "#f7d74f",
            borderColor: "#f7d74f",
            borderWidth: 1,
            borderRadius: 4,
          },
        ],
      };
    }

    const sorted = Array.from(clientsDebt)
      .map((item) => ({
        name:
          item.client_name ||
          item.name ||
          item.full_name ||
          `Клиент #${item.client_id || "?"}`,
        debt: Number(item.debt || item.amount || item.total || 0),
      }))
      .sort((a, b) => b.debt - a.debt)
      .slice(0, 15);

    return {
      labels: sorted.map((item) => item.name),
      datasets: [
        {
          label: "Долг (сом)",
          data: sorted.map((item) => item.debt),
          backgroundColor: "#f7d74f",
          borderColor: "#f7d74f",
          borderWidth: 1,
          borderRadius: 4,
        },
      ],
    };
  }, [analyticsData]);

  // Данные для графика передач по товарам из charts.top_products_by_transfers
  const transfersByProductData = useMemo(() => {
    if (!analyticsData?.charts?.top_products_by_transfers) {
      return {
        labels: ["Нет данных"],
        datasets: [
          {
            label: "Количество передач",
            data: [0],
            backgroundColor: "#f7d74f",
            borderColor: "#f7d74f",
            borderWidth: 1,
            borderRadius: 4,
          },
        ],
      };
    }

    const products = analyticsData.charts.top_products_by_transfers;
    const sorted = Array.from(products)
      .sort((a, b) => (b.transfers_count || 0) - (a.transfers_count || 0))
      .slice(0, 10);

    return {
      labels: sorted.map((item) => item.product_name || "Без названия"),
      datasets: [
        {
          label: "Количество передач",
          data: sorted.map((item) => item.transfers_count || 0),
          backgroundColor: "#f7d74f",
          borderColor: "#f7d74f",
          borderWidth: 1,
          borderRadius: 4,
        },
      ],
    };
  }, [analyticsData]);

  // Данные для графика передач по дням из charts.transfers_by_date
  const transfersByDateData = useMemo(() => {
    if (!analyticsData?.charts?.transfers_by_date) {
      return {
        labels: ["Нет данных"],
        datasets: [
          {
            label: "Количество передач",
            data: [0],
            borderColor: "#f7d74f",
            backgroundColor: "rgba(247, 215, 79, 0.2)",
            tension: 0.4,
            yAxisID: "y",
            pointRadius: 4,
            pointBackgroundColor: "#f7d74f",
            pointBorderColor: "#fff",
            pointBorderWidth: 2,
          },
          {
            label: "Количество товаров",
            data: [0],
            borderColor: "rgba(107, 114, 128, 1)",
            backgroundColor: "rgba(107, 114, 128, 0.2)",
            tension: 0.4,
            yAxisID: "y1",
            pointRadius: 4,
            pointBackgroundColor: "rgba(107, 114, 128, 1)",
            pointBorderColor: "#fff",
            pointBorderWidth: 2,
          },
        ],
      };
    }

    const transfers = analyticsData.charts.transfers_by_date;

    return {
      labels:
        transfers.length > 0
          ? transfers.map((item) => {
              try {
                return new Date(item.date).toLocaleDateString("ru-RU", {
                  day: "2-digit",
                  month: "2-digit",
                });
              } catch {
                return String(item.date || "?");
              }
            })
          : ["Нет данных"],
      datasets: [
        {
          label: "Количество передач",
          data:
            transfers.length > 0
              ? transfers.map((item) => item.transfers_count || 0)
              : [0],
          borderColor: "#f7d74f",
          backgroundColor: "rgba(247, 215, 79, 0.2)",
          tension: 0.4,
          yAxisID: "y",
          pointRadius: 4,
          pointBackgroundColor: "#f7d74f",
          pointBorderColor: "#fff",
          pointBorderWidth: 2,
        },
        {
          label: "Количество товаров",
          data:
            transfers.length > 0
              ? transfers.map((item) => item.items_transferred || 0)
              : [0],
          borderColor: "rgba(107, 114, 128, 1)",
          backgroundColor: "rgba(107, 114, 128, 0.2)",
          tension: 0.4,
          yAxisID: "y1",
          pointRadius: 4,
          pointBackgroundColor: "rgba(107, 114, 128, 1)",
          pointBorderColor: "#fff",
          pointBorderWidth: 2,
        },
      ],
    };
  }, [analyticsData]);

  // Данные для круговой диаграммы приёмок по товарам (если будет в API)
  const acceptancesByProductData = useMemo(() => {
    // Пока используем пустые данные, так как в API нет данных о приёмках по товарам
    return {
      labels: ["Нет данных"],
      datasets: [
        {
          label: "Приёмки",
          data: [0],
          backgroundColor: ["rgba(199, 199, 199, 0.6)"],
          borderColor: ["rgba(199, 199, 199, 1)"],
          borderWidth: 1,
        },
      ],
    };
  }, []);

  // Данные для графиков продаж из charts
  const salesChartData = useMemo(() => {
    if (!analyticsData?.charts) {
      return {
        byDate: {
          labels: ["Нет данных"],
          datasets: [
            {
              label: "Сумма продаж (сом)",
              data: [0],
              borderColor: "#f7d74f",
              backgroundColor: "rgba(247, 215, 79, 0.2)",
              tension: 0.4,
              yAxisID: "y",
              pointRadius: 4,
              pointBackgroundColor: "#f7d74f",
              pointBorderColor: "#fff",
              pointBorderWidth: 2,
            },
            {
              label: "Количество продаж",
              data: [0],
              borderColor: "rgba(107, 114, 128, 1)",
              backgroundColor: "rgba(107, 114, 128, 0.2)",
              tension: 0.4,
              yAxisID: "y1",
              pointRadius: 4,
              pointBackgroundColor: "rgba(107, 114, 128, 1)",
              pointBorderColor: "#fff",
              pointBorderWidth: 2,
            },
          ],
        },
        byProduct: {
          labels: ["Нет данных"],
          datasets: [
            {
              label: "Сумма продаж (сом)",
              data: [0],
              backgroundColor: "#f7d74f",
              borderColor: "#f7d74f",
              borderWidth: 1,
              borderRadius: 4,
            },
          ],
        },
        byProductDoughnut: {
          labels: ["Нет данных"],
          datasets: [
            {
              label: "Распределение продаж",
              data: [0],
              backgroundColor: ["#f7d74f"],
              borderColor: ["#f7d74f"],
              borderWidth: 1,
            },
          ],
        },
      };
    }

    const charts = analyticsData.charts;
    const salesByDate = Array.isArray(charts.sales_by_date)
      ? charts.sales_by_date
      : [];
    const salesByProductAmount = Array.isArray(charts.sales_by_product_amount)
      ? charts.sales_by_product_amount
      : [];
    const salesDistribution = Array.isArray(
      charts.sales_distribution_by_product
    )
      ? charts.sales_distribution_by_product
      : [];

    const dataToUse = {
      by_date: salesByDate,
      by_product: salesByProductAmount,
      distribution: salesDistribution,
    };

    const byDate = dataToUse.by_date || [];
    const byProduct = dataToUse.by_product || [];
    const distribution = dataToUse.distribution || [];

    return {
      byDate: {
        labels:
          byDate.length > 0
            ? byDate.map((item) => {
                try {
                  return new Date(item.date).toLocaleDateString("ru-RU", {
                    day: "2-digit",
                    month: "2-digit",
                  });
                } catch {
                  return String(item.date || "?");
                }
              })
            : ["Нет данных"],
        datasets: [
          {
            label: "Сумма продаж (сом)",
            data:
              byDate.length > 0
                ? byDate.map((item) =>
                    Number(item.amount || item.sales_amount || 0)
                  )
                : [0],
            borderColor: "#f7d74f",
            backgroundColor: "rgba(247, 215, 79, 0.2)",
            tension: 0.4,
            yAxisID: "y",
            pointRadius: 4,
            pointBackgroundColor: "#f7d74f",
            pointBorderColor: "#fff",
            pointBorderWidth: 2,
          },
          {
            label: "Количество продаж",
            data:
              byDate.length > 0
                ? byDate.map((item) =>
                    Number(item.count || item.sales_count || 0)
                  )
                : [0],
            borderColor: "rgba(107, 114, 128, 1)",
            backgroundColor: "rgba(107, 114, 128, 0.2)",
            tension: 0.4,
            yAxisID: "y1",
            pointRadius: 4,
            pointBackgroundColor: "rgba(107, 114, 128, 1)",
            pointBorderColor: "#fff",
            pointBorderWidth: 2,
          },
        ],
      },
      byProduct: {
        labels:
          byProduct.length > 0
            ? byProduct.map(
                (item) => item.product_name || item.name || "Без названия"
              )
            : ["Нет данных"],
        datasets: [
          {
            label: "Сумма продаж (сом)",
            data:
              byProduct.length > 0
                ? byProduct.map((item) =>
                    Number(item.amount || item.sales_amount || 0)
                  )
                : [0],
            backgroundColor: "#f7d74f",
            borderColor: "#f7d74f",
            borderWidth: 1,
            borderRadius: 4,
          },
        ],
      },
      byProductDoughnut: (() => {
        if (distribution.length === 0) {
          return {
            labels: ["Нет данных"],
            datasets: [
              {
                label: "Распределение продаж",
                data: [0],
                backgroundColor: ["#f7d74f"],
                borderColor: ["#f7d74f"],
                borderWidth: 1,
              },
            ],
          };
        }

        const sortedDistribution = Array.from(distribution).sort(
          (a, b) =>
            Number(b.amount || b.sales_amount || 0) -
            Number(a.amount || a.sales_amount || 0)
        );

        const top8 = sortedDistribution.slice(0, 8);

        return {
          labels: top8.map(
            (item) => item.product_name || item.name || "Без названия"
          ),
          datasets: [
            {
              label: "Распределение продаж",
              data: top8.map((item) =>
                Number(item.amount || item.sales_amount || 0)
              ),
              backgroundColor: [
                "#f7d74f",
                "#f5c842",
                "#f3b935",
                "#f1aa28",
                "#ef9b1b",
                "#ed8c0e",
                "#eb7d01",
                "#d4b800",
              ],
              borderColor: [
                "#f7d74f",
                "#f5c842",
                "#f3b935",
                "#f1aa28",
                "#ef9b1b",
                "#ed8c0e",
                "#eb7d01",
                "#d4b800",
              ],
              borderWidth: 1,
            },
          ],
        };
      })(),
    };
  }, [analyticsData]);

  // Данные для графиков товаров на руках из charts
  const productsOnHandChartData = useMemo(() => {
    if (!analyticsData?.charts) {
      return {
        byProduct: {
          labels: ["Нет данных"],
          datasets: [
            {
              label: "Количество",
              data: [0],
              backgroundColor: "#f7d74f",
              borderColor: "#f7d74f",
              borderWidth: 1,
              borderRadius: 4,
            },
          ],
        },
        byValue: {
          labels: ["Нет данных"],
          datasets: [
            {
              label: "Стоимость (сом)",
              data: [0],
              backgroundColor: "#f7d74f",
              borderColor: "#f7d74f",
              borderWidth: 1,
              borderRadius: 4,
            },
          ],
        },
      };
    }

    const charts = analyticsData.charts;
    const onHandQty = Array.isArray(charts.on_hand_by_product_qty)
      ? charts.on_hand_by_product_qty
      : [];
    const onHandAmount = Array.isArray(charts.on_hand_by_product_amount)
      ? charts.on_hand_by_product_amount
      : [];

    const dataToUse = {
      by_product_qty: onHandQty,
      by_product_amount: onHandAmount,
    };

    const byProductQty = dataToUse.by_product_qty || [];
    const byProductAmount = dataToUse.by_product_amount || [];

    return {
      byProduct: {
        labels:
          byProductQty.length > 0
            ? byProductQty.map(
                (item) => item.product_name || item.name || "Без названия"
              )
            : ["Нет данных"],
        datasets: [
          {
            label: "Количество",
            data:
              byProductQty.length > 0
                ? byProductQty.map((item) =>
                    Number(item.qty_on_hand || item.quantity || item.qty || 0)
                  )
                : [0],
            backgroundColor: "#f7d74f",
            borderColor: "#f7d74f",
            borderWidth: 1,
            borderRadius: 4,
          },
        ],
      },
      byValue: {
        labels:
          byProductAmount.length > 0
            ? byProductAmount.map(
                (item) => item.product_name || item.name || "Без названия"
              )
            : ["Нет данных"],
        datasets: [
          {
            label: "Стоимость (сом)",
            data:
              byProductAmount.length > 0
                ? byProductAmount.map((item) =>
                    Number(item.amount || item.value || 0)
                  )
                : [0],
            backgroundColor: "#f7d74f",
            borderColor: "#f7d74f",
            borderWidth: 1,
            borderRadius: 4,
          },
        ],
      },
    };
  }, [analyticsData]);

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: "index",
      intersect: false,
    },
    plugins: {
      legend: {
        position: "top",
        labels: {
          boxWidth: 12,
          padding: 10,
          font: {
            size: 12,
          },
          usePointStyle: true,
        },
      },
      tooltip: {
        callbacks: {
          label: function (context) {
            const label = context.dataset.label || "";
            const value = context.parsed.y || context.parsed || 0;
            // Форматируем числа с разделителями
            const formattedValue =
              typeof value === "number" ? value.toLocaleString("ru-RU") : value;
            return `${label}: ${formattedValue}`;
          },
        },
        titleFont: {
          size: 13,
        },
        bodyFont: {
          size: 12,
        },
        padding: 10,
        boxPadding: 6,
      },
    },
  };

  const barChartOptions = {
    ...chartOptions,
    scales: {
      y: {
        beginAtZero: true,
        type: "linear",
        position: "left",
        ticks: {
          callback: function (value) {
            return value.toLocaleString("ru-RU");
          },
          font: {
            size: 11,
          },
        },
        title: {
          font: {
            size: 12,
          },
        },
      },
      y1: {
        beginAtZero: true,
        type: "linear",
        position: "right",
        grid: {
          drawOnChartArea: false,
        },
        ticks: {
          callback: function (value) {
            return value.toLocaleString("ru-RU");
          },
          font: {
            size: 11,
          },
        },
        title: {
          font: {
            size: 12,
          },
        },
      },
      x: {
        ticks: {
          maxRotation: 45,
          minRotation: 0,
          font: {
            size: 11,
          },
        },
        title: {
          font: {
            size: 12,
          },
        },
      },
    },
  };

  const horizontalBarChartOptions = {
    ...chartOptions,
    indexAxis: "y",
    scales: {
      x: {
        beginAtZero: true,
        ticks: {
          callback: function (value) {
            return value.toLocaleString("ru-RU");
          },
          font: {
            size: 11,
          },
        },
        title: {
          font: {
            size: 12,
          },
        },
      },
      y: {
        ticks: {
          maxRotation: 0,
          minRotation: 0,
          font: {
            size: 11,
          },
        },
        title: {
          font: {
            size: 12,
          },
        },
      },
    },
  };

  // Если agentId не указан, показываем аналитику для текущего пользователя
  // Не показываем ошибку, так как это нормальный случай для сотрудника

  if (loading) {
    return (
      <div className="agent-analytics">
        <div className="agent-analytics__loading">
          <div className="agent-analytics__spinner"></div>
          <p>Загрузка данных...</p>
        </div>
      </div>
    );
  }

  if (error && !loading) {
    return (
      <div className="agent-analytics">
        <div className="agent-analytics__error">
          <p>{error}</p>
          <button onClick={fetchData}>Попробовать снова</button>
          <button onClick={() => navigate(-1)} style={{ marginLeft: "12px" }}>
            Назад
          </button>
        </div>
      </div>
    );
  }

  if (!loading && !selectedAgent && analyticsData) {
    return (
      <div className="agent-analytics">
        <div className="agent-analytics__error">
          <p>Агент не найден</p>
          <button onClick={() => navigate(-1)}>Назад</button>
        </div>
      </div>
    );
  }

  const detailColumns = getDisplayDetailColumns(
    cardDetailsModal.cardKey,
    cardDetailsModal.rows,
  );

  return (
    <div className="agent-analytics">
      <div className="agent-analytics__header">
        {agentId && (
          <button
            className="agent-analytics__back-btn"
            onClick={() => navigate(-1)}
          >
            <ArrowLeft size={20} />
            Назад
          </button>
        )}
        <h1 className="agent-analytics__title">
          {agentId ? (
            <>
              Аналитика агента:{" "}
              {selectedAgent
                ? `${selectedAgent.first_name || ""} ${
                    selectedAgent.last_name || ""
                  }`.trim() || selectedAgent.email
                : "Загрузка..."}
            </>
          ) : (
            "Моя аналитика"
          )}
        </h1>
        <div className="agent-analytics__controls">
          <select
            className="agent-analytics__period-select"
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
          >
            <option value="day">День</option>
            <option value="week">Неделя</option>
            <option value="month">Месяц</option>
            <option value="custom">Произвольный период</option>
          </select>
          {period === "day" && (
            <input
              type="date"
              className="agent-analytics__period-select"
              value={dateForDay}
              onChange={(e) => setDateForDay(e.target.value)}
              title="Дата для периода «день»"
            />
          )}
          {period === "custom" && (
            <>
              <input
                type="date"
                className="agent-analytics__period-select"
                value={dateFromCustom}
                onChange={(e) => setDateFromCustom(e.target.value)}
                title="С даты"
              />
              <input
                type="date"
                className="agent-analytics__period-select"
                value={dateToCustom}
                onChange={(e) => setDateToCustom(e.target.value)}
                title="По дату"
              />
            </>
          )}
          <button
            className="agent-analytics__refresh-btn"
            onClick={fetchData}
            title="Обновить данные"
          >
            <RefreshCw size={18} />
          </button>
        </div>
      </div>

      {/* Метрики */}
      <div className="agent-analytics__metrics">
        {!startPlan && (
          <div
            className="agent-analytics__metric-card agent-analytics__metric-card--clickable"
            role="button"
            tabIndex={0}
            onClick={() => openCardDetails("transfers_count", "Передач")}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                openCardDetails("transfers_count", "Передач");
              }
            }}
          >
            <div className="agent-analytics__metric-icon agent-analytics__metric-icon--blue">
              <Package size={24} />
            </div>
            <div>
              <h3>Передач</h3>
              <p>{metrics.totalTransfers}</p>
            </div>
          </div>
        )}
        {!startPlan && (
          <div
            className="agent-analytics__metric-card agent-analytics__metric-card--clickable"
            role="button"
            tabIndex={0}
            onClick={() => openCardDetails("acceptances_count", "Приёмок")}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                openCardDetails("acceptances_count", "Приёмок");
              }
            }}
          >
            <div className="agent-analytics__metric-icon agent-analytics__metric-icon--purple">
              <ShoppingCart size={24} />
            </div>
            <div>
              <h3>Приёмок</h3>
              <p>{metrics.totalAcceptances}</p>
            </div>
          </div>
        )}
        {!startPlan && (
          <div
            className="agent-analytics__metric-card agent-analytics__metric-card--clickable"
            role="button"
            tabIndex={0}
            onClick={() =>
              openCardDetails("items_transferred", "Товаров передано")
            }
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                openCardDetails("items_transferred", "Товаров передано");
              }
            }}
          >
            <div className="agent-analytics__metric-icon agent-analytics__metric-icon--green">
              <TrendingUp size={24} />
            </div>
            <div>
              <h3>Товаров передано</h3>
              <p>{metrics.totalQuantityTransferred.toLocaleString()}</p>
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
          <div className="agent-analytics__metric-icon agent-analytics__metric-icon--green">
            <AlertTriangle size={24} />
          </div>
          <div>
            <h3>Брак за период</h3>
            <p>{metrics.defectiveItems.toLocaleString()}</p>
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
          <div className="agent-analytics__metric-icon agent-analytics__metric-icon--light-blue">
            <DollarSign size={24} />
          </div>
          <div>
            <h3>Продаж</h3>
            <p>{metrics.totalSalesCount}</p>
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
          <div className="agent-analytics__metric-icon agent-analytics__metric-icon--purple">
            <DollarSign size={24} />
          </div>
          <div>
            <h3>Сумма продаж</h3>
            <p>{metrics.totalSalesAmount.toLocaleString()} сом</p>
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
          <div className="agent-analytics__metric-icon agent-analytics__metric-icon--orange">
            <Percent size={24} />
          </div>
          <div>
            <h3>Сумма скидок</h3>
            <p>
              {metrics.totalDiscounts.toLocaleString("ru-RU", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}{" "}
              сом
            </p>
          </div>
        </div>
        <div
          className="agent-analytics__metric-card agent-analytics__metric-card--clickable"
          role="button"
          tabIndex={0}
          onClick={() => openCardDetails("items_on_hand_qty", "Товаров на руках")}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              openCardDetails("items_on_hand_qty", "Товаров на руках");
            }
          }}
        >
          <div className="agent-analytics__metric-icon agent-analytics__metric-icon--orange">
            <Package size={24} />
          </div>
          <div>
            <h3>Товаров на руках</h3>
            <p>{metrics.totalProductsOnHand.toLocaleString()}</p>
          </div>
        </div>
        <div
          className="agent-analytics__metric-card agent-analytics__metric-card--clickable"
          role="button"
          tabIndex={0}
          onClick={() =>
            openCardDetails("items_on_hand_amount", "Стоимость товаров")
          }
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              openCardDetails("items_on_hand_amount", "Стоимость товаров");
            }
          }}
        >
          <div className="agent-analytics__metric-icon agent-analytics__metric-icon--green">
            <DollarSign size={24} />
          </div>
          <div>
            <h3>Стоимость товаров</h3>
            <p>{metrics.totalProductsValue.toLocaleString()} сом</p>
          </div>
        </div>
        <div className="agent-analytics__metric-card">
          <div className="agent-analytics__metric-icon agent-analytics__metric-icon--purple">
            <Wallet size={24} />
          </div>
          <div>
            <h3>Долг по клиентам</h3>
            <p>{metrics.totalClientsDebt.toLocaleString()} сом</p>
          </div>
        </div>
      </div>

      {/* Графики продаж */}
      <div className="agent-analytics__section">
        <h2 className="agent-analytics__section-title">
          <span className="agent-analytics__section-icon chart-container">
            <BarChart3 className="chart-icon" />
          </span>
          Аналитика продаж
        </h2>
        <div className="agent-analytics__charts">
          {salesChartData?.byDate && (
            <div className="agent-analytics__chart-card">
              <h3>Продажи по датам</h3>
              <div className="agent-analytics__chart-container">
                <Line data={salesChartData.byDate} options={barChartOptions} />
              </div>
            </div>
          )}

          {salesChartData?.byProduct && (
            <div className="agent-analytics__chart-card">
              <h3>Продажи по товарам (сумма)</h3>
              <div className="agent-analytics__chart-container">
                <Bar
                  data={salesChartData.byProduct}
                  options={barChartOptions}
                />
              </div>
            </div>
          )}
        </div>
        {salesChartData?.byProductDoughnut && (
          <div className="agent-analytics__chart-card agent-analytics__chart-card--full">
            <h3>Распределение продаж по товарам</h3>
            <div className="agent-analytics__chart-container agent-analytics__chart-container--doughnut">
              <Doughnut
                data={salesChartData.byProductDoughnut}
                options={chartOptions}
              />
            </div>
          </div>
        )}
      </div>

      {/* Графики товаров на руках */}
      <div className="agent-analytics__section">
        <h2 className="agent-analytics__section-title">
          <span className="agent-analytics__section-icon chart-container">
            <Package className="chart-icon" />
          </span>
          Товары на руках
        </h2>
        <div className="agent-analytics__charts">
          {productsOnHandChartData?.byProduct && (
            <div className="agent-analytics__chart-card">
              <h3>Товары на руках (количество)</h3>
              <div className="agent-analytics__chart-container">
                <Bar
                  data={productsOnHandChartData.byProduct}
                  options={barChartOptions}
                />
              </div>
            </div>
          )}

          {productsOnHandChartData?.byValue && (
            <div className="agent-analytics__chart-card">
              <h3>Товары на руках (стоимость)</h3>
              <div className="agent-analytics__chart-container">
                <Bar
                  data={productsOnHandChartData.byValue}
                  options={barChartOptions}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="agent-analytics__section">
        <h2 className="agent-analytics__section-title">
          <span className="agent-analytics__section-icon chart-container">
            <Wallet className="chart-icon" />
          </span>
          Долг по клиентам
        </h2>
        <div className="agent-analytics__charts">
          <div className="agent-analytics__chart-card agent-analytics__chart-card--full">
            <h3>Клиенты с долгом (сделки + POS)</h3>
            <div className="agent-analytics__chart-container">
              <Bar
                data={clientsDebtChartData}
                options={horizontalBarChartOptions}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Графики передач и приёмок */}
      {!startPlan && (
        <div className="agent-analytics__section">
          <h2 className="agent-analytics__section-title ">
            <span className="agent-analytics__section-icon chart-container">
              <ArrowLeftRight className="chart-icon" />
            </span>
            Передачи и приёмки
          </h2>
          <div className="agent-analytics__charts">
            <div className="agent-analytics__chart-card">
              <h3>Передачи по датам</h3>
              <div className="agent-analytics__chart-container">
                <Line data={transfersByDateData} options={barChartOptions} />
              </div>
            </div>

            <div className="agent-analytics__chart-card">
              <h3>Топ товаров по передачам</h3>
              <div className="agent-analytics__chart-container">
                <Bar
                  data={transfersByProductData}
                  options={horizontalBarChartOptions}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Таблица передач */}
      {!startPlan && transfersHistory.length > 0 && (
        <>
          <h2 className="agent-analytics__section-title">
            <span className="agent-analytics__section-icon chart-container">
              <Clock className="chart-icon" />
            </span>
            История передач
          </h2>
          <div className="agent-analytics__table-card noPadding">
            <div className="agent-analytics__table">
              <table>
                <thead>
                  <tr>
                    <th>Дата</th>
                    <th>Товар</th>
                    <th>Количество</th>
                    <th>Статус</th>
                  </tr>
                </thead>
                <tbody>
                  {transfersHistory.slice(0, 20).map((transfer) => {
                    const status =
                      transfer.status_label || transfer.status || "Открыта";
                    const isCompleted =
                      status.toLowerCase().includes("завершена") ||
                      status.toLowerCase().includes("completed") ||
                      transfer.status === "completed";
                    return (
                      <tr key={transfer.id}>
                        <td>
                          {new Date(transfer.date).toLocaleDateString("ru-RU")}
                        </td>
                        <td>
                          {transfer.product_name ||
                            `Товар #${transfer.product_id || "?"}`}
                        </td>
                        <td>{Number(transfer.qty || 0).toLocaleString()}</td>
                        <td>
                          <span
                            className={`agent-analytics__status ${
                              isCompleted
                                ? "agent-analytics__status--completed"
                                : "agent-analytics__status--open"
                            }`}
                          >
                            {status}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {cardDetailsModal.open && (
        <div className="agent-analytics__modal-backdrop" onClick={closeCardDetails}>
          <div
            className="agent-analytics__modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="agent-analytics__modal-header">
              <h3>Детализация: {cardDetailsModal.title}</h3>
              <button type="button" onClick={closeCardDetails}>
                ×
              </button>
            </div>
            <div className="agent-analytics__modal-body">
              {cardDetailsModal.meta.period && (
                <p
                  style={{
                    fontSize: 13,
                    color: "#6b7280",
                    marginTop: 0,
                    marginBottom: 12,
                  }}
                >
                  Период: {cardDetailsModal.meta.period.date_from} —{" "}
                  {cardDetailsModal.meta.period.date_to}
                  {cardDetailsModal.meta.period.type
                    ? ` (${cardDetailsModal.meta.period.type})`
                    : ""}
                </p>
              )}
              {cardDetailsModal.loading &&
                cardDetailsModal.rows.length === 0 && <p>Загрузка...</p>}
              {cardDetailsModal.loading &&
                cardDetailsModal.rows.length > 0 && (
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
                  {cardDetailsModal.meta.totals &&
                    Object.keys(cardDetailsModal.meta.totals).length > 0 && (
                      <div
                        style={{
                          marginBottom: 12,
                          fontSize: 13,
                          display: "flex",
                          flexWrap: "wrap",
                          gap: "12px 20px",
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
    </div>
  );
};

export default AgentAnalytics;
