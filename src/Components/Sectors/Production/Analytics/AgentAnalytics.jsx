import React, { useState, useEffect, useMemo } from "react";
import { useDispatch } from "react-redux";
import { useNavigate, useParams } from "react-router-dom";
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
  Users,
  ShoppingCart,
  DollarSign,
  Package,
  RefreshCw,
} from "lucide-react";
import api from "../../../../api";
import "./AgentAnalytics.scss";

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
  const { agentId } = useParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedAgent, setSelectedAgent] = useState(null);
  const [transfers, setTransfers] = useState([]);
  const [acceptances, setAcceptances] = useState([]);
  const [salesData, setSalesData] = useState(null); // Данные по продажам с бэкенда
  const [productsOnHand, setProductsOnHand] = useState(null); // Данные по товарам на руках с бэкенда
  const [period, setPeriod] = useState("month"); // day, week, month, year

  // Загрузка данных
  useEffect(() => {
    if (agentId) {
      fetchData();
    }
  }, [agentId, period]);

  const fetchData = async () => {
    if (!agentId) {
      setError("ID агента не указан");
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError("");

      // Загружаем данные конкретного агента, передачи, приёмки, аналитику продаж и товары на руках
      const [agentRes, transfersRes, acceptancesRes, analyticsRes] =
        await Promise.all([
          api.get(`/users/employees/${agentId}/`).catch(() => ({ data: null })),
          api
            .get("/main/subreals/", { params: { agent: agentId } })
            .catch(() => ({ data: { results: [] } })),
          api
            .get("/main/acceptances/", { params: { agent: agentId } })
            .catch(() => ({ data: { results: [] } })),
          api
            .get(`/main/agents/${agentId}/analytics/`, {
              params: { period },
            })
            .catch(() => ({
              data: {
                sales: null,
                products_on_hand: null,
              },
            })),
        ]);

      if (!agentRes.data) {
        setError("Агент не найден");
        setLoading(false);
        return;
      }

      setSelectedAgent(agentRes.data);

      const transfersList = Array.isArray(transfersRes.data?.results)
        ? transfersRes.data.results
        : Array.isArray(transfersRes.data)
        ? transfersRes.data
        : [];
      const acceptancesList = Array.isArray(acceptancesRes.data?.results)
        ? acceptancesRes.data.results
        : Array.isArray(acceptancesRes.data)
        ? acceptancesRes.data
        : [];

      setTransfers(transfersList);
      setAcceptances(acceptancesList);

      // Устанавливаем данные аналитики с бэкенда
      if (analyticsRes.data) {
        // Поддерживаем разные форматы ответа от бэкенда
        const sales =
          analyticsRes.data.sales || analyticsRes.data.sales_data || null;
        const products =
          analyticsRes.data.products_on_hand ||
          analyticsRes.data.products_on_hand_data ||
          null;

        setSalesData(sales);
        setProductsOnHand(products);
      }
    } catch (err) {
      console.error("Ошибка загрузки данных:", err);
      setError("Не удалось загрузить данные аналитики");
    } finally {
      setLoading(false);
    }
  };

  // Фильтрация данных по периоду
  const getDateRange = () => {
    const now = new Date();
    let start;

    switch (period) {
      case "day":
        start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        break;
      case "week":
        start = new Date(now);
        start.setDate(now.getDate() - 7);
        break;
      case "month":
        start = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case "year":
        start = new Date(now.getFullYear(), 0, 1);
        break;
      default:
        start = new Date(now.getFullYear(), now.getMonth(), 1);
    }

    return { start, end: now };
  };

  const filteredTransfers = useMemo(() => {
    const { start, end } = getDateRange();
    return transfers.filter((t) => {
      try {
        const date = new Date(t.created_at || t.createdAt);
        if (isNaN(date.getTime())) return false;
        return date >= start && date <= end;
      } catch {
        return false;
      }
    });
  }, [transfers, period]);

  const filteredAcceptances = useMemo(() => {
    const { start, end } = getDateRange();
    return acceptances.filter((a) => {
      try {
        const date = new Date(a.accepted_at || a.created_at || a.createdAt);
        if (isNaN(date.getTime())) return false;
        return date >= start && date <= end;
      } catch {
        return false;
      }
    });
  }, [acceptances, period]);

  // Метрики для выбранного агента
  const metrics = useMemo(() => {
    if (!selectedAgent) {
      return {
        totalTransfers: 0,
        totalAcceptances: 0,
        totalQuantityTransferred: 0,
        totalQuantityAccepted: 0,
        totalSalesAmount: 0,
        totalSalesCount: 0,
        totalProductsOnHand: 0,
        totalProductsValue: 0,
      };
    }

    const totalTransfers = filteredTransfers.length;
    const totalAcceptances = filteredAcceptances.length;
    const totalQuantityTransferred = filteredTransfers.reduce(
      (sum, t) => sum + Number(t.qty_transferred || 0),
      0
    );
    const totalQuantityAccepted = filteredAcceptances.reduce(
      (sum, a) => sum + Number(a.qty || 0),
      0
    );

    // Метрики по продажам (с бэкенда или временные данные)
    const salesDataToUse = salesData || {
      total_amount: 510000,
      total_count: 102,
    };
    const totalSalesAmount = salesDataToUse.total_amount || 0;
    const totalSalesCount = salesDataToUse.total_count || 0;

    // Метрики по товарам на руках (с бэкенда или временные данные)
    const productsDataToUse = productsOnHand || {
      total_quantity: 165,
      total_value: 825000,
    };
    const totalProductsOnHand = productsDataToUse.total_quantity || 0;
    const totalProductsValue = productsDataToUse.total_value || 0;

    return {
      totalTransfers,
      totalAcceptances,
      totalQuantityTransferred,
      totalQuantityAccepted,
      totalSalesAmount,
      totalSalesCount,
      totalProductsOnHand,
      totalProductsValue,
    };
  }, [
    selectedAgent,
    filteredTransfers,
    filteredAcceptances,
    salesData,
    productsOnHand,
  ]);

  // Данные для графика передач по товарам
  const transfersByProductData = useMemo(() => {
    const productMap = new Map();

    filteredTransfers.forEach((t) => {
      const productName =
        t.product_name || `Товар #${t.product || t.product_id || "?"}`;
      const quantity = Number(t.qty_transferred || 0);

      if (productMap.has(productName)) {
        productMap.set(productName, productMap.get(productName) + quantity);
      } else {
        productMap.set(productName, quantity);
      }
    });

    const sorted = Array.from(productMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10); // Топ 10 товаров

    return {
      labels: sorted.map(([name]) => name),
      datasets: [
        {
          label: "Количество передач",
          data: sorted.map(([, qty]) => qty),
          backgroundColor: "rgba(54, 162, 235, 0.6)",
          borderColor: "rgba(54, 162, 235, 1)",
          borderWidth: 1,
        },
      ],
    };
  }, [filteredTransfers]);

  // Данные для графика передач по дням
  const transfersByDateData = useMemo(() => {
    try {
      const { start, end } = getDateRange();
      const days = [];
      const counts = [];
      const quantities = [];

      const current = new Date(start);
      while (current <= end) {
        const dateStr = current.toISOString().slice(0, 10);
        const dayTransfers = filteredTransfers.filter((t) => {
          try {
            const date = new Date(t.created_at || t.createdAt);
            if (isNaN(date.getTime())) return false;
            return date.toISOString().slice(0, 10) === dateStr;
          } catch {
            return false;
          }
        });

        const count = dayTransfers.length;
        const quantity = dayTransfers.reduce(
          (sum, t) => sum + Number(t.qty_transferred || 0),
          0
        );

        days.push(
          new Date(dateStr).toLocaleDateString("ru-RU", {
            day: "2-digit",
            month: "2-digit",
          })
        );
        counts.push(count);
        quantities.push(quantity);
        current.setDate(current.getDate() + 1);
      }

      return {
        labels: days.length > 0 ? days : ["Нет данных"],
        datasets: [
          {
            label: "Количество передач",
            data: counts.length > 0 ? counts : [0],
            borderColor: "rgba(153, 102, 255, 1)",
            backgroundColor: "rgba(153, 102, 255, 0.2)",
            tension: 0.4,
            yAxisID: "y",
          },
          {
            label: "Количество товаров",
            data: quantities.length > 0 ? quantities : [0],
            borderColor: "rgba(75, 192, 192, 1)",
            backgroundColor: "rgba(75, 192, 192, 0.2)",
            tension: 0.4,
            yAxisID: "y1",
          },
        ],
      };
    } catch (err) {
      console.error("Ошибка создания графика передач по датам:", err);
      return {
        labels: ["Нет данных"],
        datasets: [
          {
            label: "Передачи",
            data: [0],
            borderColor: "rgba(153, 102, 255, 1)",
            backgroundColor: "rgba(153, 102, 255, 0.2)",
            tension: 0.4,
          },
        ],
      };
    }
  }, [filteredTransfers, period]);

  // Данные для круговой диаграммы приёмок по товарам
  const acceptancesByProductData = useMemo(() => {
    const productMap = new Map();

    filteredAcceptances.forEach((a) => {
      const productName =
        a.product_name || `Товар #${a.product || a.product_id || "?"}`;
      const quantity = Number(a.qty || 0);

      if (productMap.has(productName)) {
        productMap.set(productName, productMap.get(productName) + quantity);
      } else {
        productMap.set(productName, quantity);
      }
    });

    const sorted = Array.from(productMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8); // Топ 8 товаров

    const colors = [
      "rgba(255, 99, 132, 0.6)",
      "rgba(54, 162, 235, 0.6)",
      "rgba(255, 206, 86, 0.6)",
      "rgba(75, 192, 192, 0.6)",
      "rgba(153, 102, 255, 0.6)",
      "rgba(255, 159, 64, 0.6)",
      "rgba(199, 199, 199, 0.6)",
      "rgba(83, 102, 255, 0.6)",
    ];

    return {
      labels: sorted.length > 0 ? sorted.map(([name]) => name) : ["Нет данных"],
      datasets: [
        {
          label: "Приёмки",
          data: sorted.length > 0 ? sorted.map(([, qty]) => qty) : [0],
          backgroundColor: colors.slice(0, sorted.length || 1),
          borderColor: colors
            .slice(0, sorted.length || 1)
            .map((c) => c.replace("0.6", "1")),
          borderWidth: 1,
        },
      ],
    };
  }, [filteredAcceptances]);

  // Данные для графиков продаж (с бэкенда)
  const salesChartData = useMemo(() => {
    // Временные тестовые данные для демонстрации
    const mockSalesData = {
      by_date: [
        { date: "2024-01-01", amount: 50000, count: 10 },
        { date: "2024-01-02", amount: 75000, count: 15 },
        { date: "2024-01-03", amount: 60000, count: 12 },
        { date: "2024-01-04", amount: 80000, count: 18 },
        { date: "2024-01-05", amount: 90000, count: 20 },
      ],
      by_product: [
        { product_name: "Товар А", amount: 150000, count: 30 },
        { product_name: "Товар Б", amount: 120000, count: 25 },
        { product_name: "Товар В", amount: 100000, count: 20 },
        { product_name: "Товар Г", amount: 80000, count: 15 },
        { product_name: "Товар Д", amount: 60000, count: 12 },
      ],
      total_amount: 510000,
      total_count: 102,
    };

    const dataToUse = salesData || mockSalesData;

    if (!dataToUse) {
      return {
        byDate: {
          labels: ["Нет данных"],
          datasets: [
            {
              label: "Продажи",
              data: [0],
              borderColor: "rgba(75, 192, 192, 1)",
              backgroundColor: "rgba(75, 192, 192, 0.2)",
              tension: 0.4,
            },
          ],
        },
        byProduct: {
          labels: ["Нет данных"],
          datasets: [
            {
              label: "Продажи",
              data: [0],
              backgroundColor: "rgba(54, 162, 235, 0.6)",
              borderColor: "rgba(54, 162, 235, 1)",
              borderWidth: 1,
            },
          ],
        },
        byProductDoughnut: {
          labels: ["Нет данных"],
          datasets: [
            {
              label: "Распределение продаж",
              data: [0],
              backgroundColor: ["rgba(255, 99, 132, 0.6)"],
              borderColor: ["rgba(255, 99, 132, 1)"],
              borderWidth: 1,
            },
          ],
        },
      };
    }

    // Предполагаем, что бэкенд возвращает данные в формате:
    // { by_date: [{ date: "2024-01-01", amount: 1000, count: 5 }, ...],
    //   by_product: [{ product_name: "Товар", amount: 500, count: 2 }, ...],
    //   total_amount: 10000, total_count: 50 }

    const byDate = Array.isArray(dataToUse.by_date) ? dataToUse.by_date : [];
    const byProduct = Array.isArray(dataToUse.by_product)
      ? dataToUse.by_product
      : [];

    return {
      byDate: {
        labels:
          byDate.length > 0
            ? byDate.map((item) => {
                try {
                  return new Date(
                    item.date || item.created_at
                  ).toLocaleDateString("ru-RU", {
                    day: "2-digit",
                    month: "2-digit",
                  });
                } catch {
                  return String(item.date || item.created_at || "?");
                }
              })
            : ["Нет данных"],
        datasets: [
          {
            label: "Сумма продаж (сом)",
            data:
              byDate.length > 0
                ? byDate.map((item) => Number(item.amount || item.total || 0))
                : [0],
            borderColor: "rgba(75, 192, 192, 1)",
            backgroundColor: "rgba(75, 192, 192, 0.2)",
            tension: 0.4,
            yAxisID: "y",
          },
          {
            label: "Количество продаж",
            data:
              byDate.length > 0
                ? byDate.map((item) => Number(item.count || item.quantity || 0))
                : [0],
            borderColor: "rgba(255, 99, 132, 1)",
            backgroundColor: "rgba(255, 99, 132, 0.2)",
            tension: 0.4,
            yAxisID: "y1",
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
                    Number(item.amount || item.total || 0)
                  )
                : [0],
            backgroundColor: "rgba(54, 162, 235, 0.6)",
            borderColor: "rgba(54, 162, 235, 1)",
            borderWidth: 1,
          },
        ],
      },
      byProductDoughnut: {
        labels:
          byProduct.length > 0
            ? byProduct
                .sort(
                  (a, b) =>
                    Number(b.amount || b.total || 0) -
                    Number(a.amount || a.total || 0)
                )
                .slice(0, 8)
                .map((item) => item.product_name || item.name || "Без названия")
            : ["Нет данных"],
        datasets: [
          {
            label: "Распределение продаж",
            data:
              byProduct.length > 0
                ? byProduct
                    .sort(
                      (a, b) =>
                        Number(b.amount || b.total || 0) -
                        Number(a.amount || a.total || 0)
                    )
                    .slice(0, 8)
                    .map((item) => Number(item.amount || item.total || 0))
                : [0],
            backgroundColor: [
              "rgba(255, 99, 132, 0.6)",
              "rgba(54, 162, 235, 0.6)",
              "rgba(255, 206, 86, 0.6)",
              "rgba(75, 192, 192, 0.6)",
              "rgba(153, 102, 255, 0.6)",
              "rgba(255, 159, 64, 0.6)",
              "rgba(199, 199, 199, 0.6)",
              "rgba(83, 102, 255, 0.6)",
            ],
            borderColor: [
              "rgba(255, 99, 132, 1)",
              "rgba(54, 162, 235, 1)",
              "rgba(255, 206, 86, 1)",
              "rgba(75, 192, 192, 1)",
              "rgba(153, 102, 255, 1)",
              "rgba(255, 159, 64, 1)",
              "rgba(199, 199, 199, 1)",
              "rgba(83, 102, 255, 1)",
            ],
            borderWidth: 1,
          },
        ],
      },
    };
  }, [salesData]);

  // Данные для графиков товаров на руках (с бэкенда)
  const productsOnHandChartData = useMemo(() => {
    // Временные тестовые данные для демонстрации
    const mockProductsData = {
      by_product: [
        { product_name: "Товар А", quantity: 50, value: 250000 },
        { product_name: "Товар Б", quantity: 40, value: 200000 },
        { product_name: "Товар В", quantity: 30, value: 150000 },
        { product_name: "Товар Г", quantity: 25, value: 125000 },
        { product_name: "Товар Д", quantity: 20, value: 100000 },
      ],
      total_quantity: 165,
      total_value: 825000,
    };

    const dataToUse = productsOnHand || mockProductsData;

    if (!dataToUse) {
      return {
        byProduct: {
          labels: ["Нет данных"],
          datasets: [
            {
              label: "Товары на руках",
              data: [0],
              backgroundColor: "rgba(153, 102, 255, 0.6)",
              borderColor: "rgba(153, 102, 255, 1)",
              borderWidth: 1,
            },
          ],
        },
        byValue: {
          labels: ["Нет данных"],
          datasets: [
            {
              label: "Стоимость",
              data: [0],
              backgroundColor: "rgba(255, 159, 64, 0.6)",
              borderColor: "rgba(255, 159, 64, 1)",
              borderWidth: 1,
            },
          ],
        },
      };
    }

    // Предполагаем, что бэкенд возвращает данные в формате:
    // { by_product: [{ product_name: "Товар", quantity: 10, value: 5000 }, ...],
    //   total_quantity: 100, total_value: 50000 }

    const byProduct = Array.isArray(dataToUse.by_product)
      ? dataToUse.by_product
      : Array.isArray(dataToUse.products)
      ? dataToUse.products
      : [];

    return {
      byProduct: {
        labels:
          byProduct.length > 0
            ? byProduct.map(
                (item) => item.product_name || item.name || "Без названия"
              )
            : ["Нет данных"],
        datasets: [
          {
            label: "Количество",
            data:
              byProduct.length > 0
                ? byProduct.map((item) =>
                    Number(item.quantity || item.qty || 0)
                  )
                : [0],
            backgroundColor: "rgba(153, 102, 255, 0.6)",
            borderColor: "rgba(153, 102, 255, 1)",
            borderWidth: 1,
          },
        ],
      },
      byValue: {
        labels:
          byProduct.length > 0
            ? byProduct.map(
                (item) => item.product_name || item.name || "Без названия"
              )
            : ["Нет данных"],
        datasets: [
          {
            label: "Стоимость (сом)",
            data:
              byProduct.length > 0
                ? byProduct.map((item) =>
                    Number(item.value || item.total_value || 0)
                  )
                : [0],
            backgroundColor: "rgba(255, 159, 64, 0.6)",
            borderColor: "rgba(255, 159, 64, 1)",
            borderWidth: 1,
          },
        ],
      },
    };
  }, [productsOnHand]);

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: "top",
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
      },
      y1: {
        beginAtZero: true,
        type: "linear",
        position: "right",
        grid: {
          drawOnChartArea: false,
        },
      },
    },
  };

  if (!agentId) {
    return (
      <div className="agent-analytics">
        <div className="agent-analytics__error">
          <p>ID агента не указан</p>
          <button onClick={() => navigate(-1)}>Назад</button>
        </div>
      </div>
    );
  }

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

  if (error) {
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

  if (!selectedAgent) {
    return (
      <div className="agent-analytics">
        <div className="agent-analytics__error">
          <p>Агент не найден</p>
          <button onClick={() => navigate(-1)}>Назад</button>
        </div>
      </div>
    );
  }

  return (
    <div className="agent-analytics">
      <div className="agent-analytics__header">
        <button
          className="agent-analytics__back-btn"
          onClick={() => navigate(-1)}
        >
          <ArrowLeft size={20} />
          Назад
        </button>
        <h1 className="agent-analytics__title">
          Аналитика агента:{" "}
          {selectedAgent
            ? `${selectedAgent.first_name || ""} ${
                selectedAgent.last_name || ""
              }`.trim() || selectedAgent.email
            : "Загрузка..."}
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
            <option value="year">Год</option>
          </select>
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
        <div className="agent-analytics__metric-card">
          <Package size={24} />
          <div>
            <h3>Передач</h3>
            <p>{metrics.totalTransfers}</p>
          </div>
        </div>
        <div className="agent-analytics__metric-card">
          <ShoppingCart size={24} />
          <div>
            <h3>Приёмок</h3>
            <p>{metrics.totalAcceptances}</p>
          </div>
        </div>
        <div className="agent-analytics__metric-card">
          <TrendingUp size={24} />
          <div>
            <h3>Товаров передано</h3>
            <p>{metrics.totalQuantityTransferred.toLocaleString()}</p>
          </div>
        </div>
        <div className="agent-analytics__metric-card">
          <DollarSign size={24} />
          <div>
            <h3>Продаж</h3>
            <p>{metrics.totalSalesCount}</p>
          </div>
        </div>
        <div className="agent-analytics__metric-card">
          <DollarSign size={24} />
          <div>
            <h3>Сумма продаж</h3>
            <p>{metrics.totalSalesAmount.toLocaleString()} сом</p>
          </div>
        </div>
        <div className="agent-analytics__metric-card">
          <Package size={24} />
          <div>
            <h3>Товаров на руках</h3>
            <p>{metrics.totalProductsOnHand.toLocaleString()}</p>
          </div>
        </div>
        <div className="agent-analytics__metric-card">
          <DollarSign size={24} />
          <div>
            <h3>Стоимость товаров</h3>
            <p>{metrics.totalProductsValue.toLocaleString()} сом</p>
          </div>
        </div>
      </div>

      {/* Графики продаж */}
      <div className="agent-analytics__section">
        <h2 className="agent-analytics__section-title">📊 Аналитика продаж</h2>
        <div className="agent-analytics__charts">
          {salesChartData?.byDate && (
            <div className="agent-analytics__chart-card">
              <h2>Продажи по датам</h2>
              <div className="agent-analytics__chart-container">
                <Line data={salesChartData.byDate} options={barChartOptions} />
              </div>
            </div>
          )}

          {salesChartData?.byProduct && (
            <div className="agent-analytics__chart-card">
              <h2>Продажи по товарам (сумма)</h2>
              <div className="agent-analytics__chart-container">
                <Bar
                  data={salesChartData.byProduct}
                  options={barChartOptions}
                />
              </div>
            </div>
          )}

          {salesChartData?.byProductDoughnut && (
            <div className="agent-analytics__chart-card">
              <h2>Распределение продаж по товарам</h2>
              <div className="agent-analytics__chart-container">
                <Doughnut
                  data={salesChartData.byProductDoughnut}
                  options={chartOptions}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Графики товаров на руках */}
      <div className="agent-analytics__section">
        <h2 className="agent-analytics__section-title">📦 Товары на руках</h2>
        <div className="agent-analytics__charts">
          {productsOnHandChartData?.byProduct && (
            <div className="agent-analytics__chart-card">
              <h2>Товары на руках (количество)</h2>
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
              <h2>Товары на руках (стоимость)</h2>
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

      {/* Графики передач и приёмок */}
      <div className="agent-analytics__section">
        <h2 className="agent-analytics__section-title">
          🔄 Передачи и приёмки
        </h2>
        <div className="agent-analytics__charts">
          <div className="agent-analytics__chart-card">
            <h2>Передачи по датам</h2>
            <div className="agent-analytics__chart-container">
              <Line data={transfersByDateData} options={barChartOptions} />
            </div>
          </div>

          <div className="agent-analytics__chart-card">
            <h2>Топ товаров по передачам</h2>
            <div className="agent-analytics__chart-container">
              <Bar data={transfersByProductData} options={barChartOptions} />
            </div>
          </div>

          <div className="agent-analytics__chart-card">
            <h2>Распределение приёмок по товарам</h2>
            <div className="agent-analytics__chart-container">
              <Doughnut
                data={acceptancesByProductData}
                options={chartOptions}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Таблица передач */}
      {filteredTransfers.length > 0 && (
        <div className="agent-analytics__table-card">
          <h2>История передач</h2>
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
                {filteredTransfers.slice(0, 20).map((transfer) => (
                  <tr key={transfer.id}>
                    <td>
                      {new Date(
                        transfer.created_at || transfer.createdAt
                      ).toLocaleDateString("ru-RU")}
                    </td>
                    <td>
                      {transfer.product_name ||
                        `Товар #${
                          transfer.product || transfer.product_id || "?"
                        }`}
                    </td>
                    <td>
                      {Number(transfer.qty_transferred || 0).toLocaleString()}
                    </td>
                    <td>{transfer.status || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default AgentAnalytics;
