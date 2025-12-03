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
  BarChart3,
  ArrowLeftRight,
  Clock,
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
  const [analyticsData, setAnalyticsData] = useState(null); // Полные данные аналитики с бэкенда
  const [period, setPeriod] = useState("month"); // day, week, month, year

  // Загрузка данных
  useEffect(() => {
    fetchData();
  }, [agentId, period]);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError("");

      // Если agentId не указан, используем эндпоинт для текущего пользователя
      const endpoint = agentId
        ? `/main/owners/agents/${agentId}/analytics/`
        : `/main/agents/me/analytics/`;

      // Загружаем аналитику агента
      const analyticsRes = await api.get(endpoint, {
        params: { period },
      });

      if (!analyticsRes.data) {
        setError("Данные аналитики не найдены");
        setLoading(false);
        return;
      }

      const data = analyticsRes.data;

      // Устанавливаем информацию об агенте из ответа
      if (data.agent) {
        setSelectedAgent({
          id: data.agent.id,
          first_name: data.agent.first_name,
          last_name: data.agent.last_name,
          email: data.agent.email || "",
          track_number: data.agent.track_number || "",
        });
      }

      // Сохраняем полные данные аналитики
      setAnalyticsData(data);
    } catch (err) {
      console.error("Ошибка загрузки данных:", err);
      setError("Не удалось загрузить данные аналитики");
    } finally {
      setLoading(false);
    }
  };

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
        totalSalesAmount: 0,
        totalSalesCount: 0,
        totalProductsOnHand: 0,
        totalProductsValue: 0,
      };
    }

    const summary = analyticsData.summary;

    return {
      totalTransfers: summary.transfers_count || 0,
      totalAcceptances: summary.acceptances_count || 0,
      totalQuantityTransferred: summary.items_transferred || 0,
      totalSalesAmount: summary.sales_amount || 0,
      totalSalesCount: summary.sales_count || 0,
      totalProductsOnHand: summary.items_on_hand_qty || 0,
      totalProductsValue: summary.items_on_hand_amount || 0,
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
    const sorted = [...products]
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
      byProductDoughnut: {
        labels:
          distribution.length > 0
            ? distribution
                .sort(
                  (a, b) =>
                    Number(b.amount || b.sales_amount || 0) -
                    Number(a.amount || a.sales_amount || 0)
                )
                .slice(0, 8)
                .map((item) => item.product_name || item.name || "Без названия")
            : ["Нет данных"],
        datasets: [
          {
            label: "Распределение продаж",
            data:
              distribution.length > 0
                ? distribution
                    .sort(
                      (a, b) =>
                        Number(b.amount || b.sales_amount || 0) -
                        Number(a.amount || a.sales_amount || 0)
                    )
                    .slice(0, 8)
                    .map((item) =>
                      Number(item.amount || item.sales_amount || 0)
                    )
                : [0],
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
      },
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
        ticks: {
          callback: function (value) {
            return value.toLocaleString("ru-RU");
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
        },
      },
      x: {
        ticks: {
          maxRotation: 45,
          minRotation: 0,
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
        },
      },
      y: {
        ticks: {
          maxRotation: 0,
          minRotation: 0,
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
          <div className="agent-analytics__metric-icon agent-analytics__metric-icon--blue">
            <Package size={24} />
          </div>
          <div>
            <h3>Передач</h3>
            <p>{metrics.totalTransfers}</p>
          </div>
        </div>
        <div className="agent-analytics__metric-card">
          <div className="agent-analytics__metric-icon agent-analytics__metric-icon--purple">
            <ShoppingCart size={24} />
          </div>
          <div>
            <h3>Приёмок</h3>
            <p>{metrics.totalAcceptances}</p>
          </div>
        </div>
        <div className="agent-analytics__metric-card">
          <div className="agent-analytics__metric-icon agent-analytics__metric-icon--green">
            <TrendingUp size={24} />
          </div>
          <div>
            <h3>Товаров передано</h3>
            <p>{metrics.totalQuantityTransferred.toLocaleString()}</p>
          </div>
        </div>
        <div className="agent-analytics__metric-card">
          <div className="agent-analytics__metric-icon agent-analytics__metric-icon--light-blue">
            <DollarSign size={24} />
          </div>
          <div>
            <h3>Продаж</h3>
            <p>{metrics.totalSalesCount}</p>
          </div>
        </div>
        <div className="agent-analytics__metric-card">
          <div className="agent-analytics__metric-icon agent-analytics__metric-icon--purple">
            <DollarSign size={24} />
          </div>
          <div>
            <h3>Сумма продаж</h3>
            <p>{metrics.totalSalesAmount.toLocaleString()} сом</p>
          </div>
        </div>
        <div className="agent-analytics__metric-card">
          <div className="agent-analytics__metric-icon agent-analytics__metric-icon--orange">
            <Package size={24} />
          </div>
          <div>
            <h3>Товаров на руках</h3>
            <p>{metrics.totalProductsOnHand.toLocaleString()}</p>
          </div>
        </div>
        <div className="agent-analytics__metric-card">
          <div className="agent-analytics__metric-icon agent-analytics__metric-icon--orange">
            <Package size={24} />
          </div>
          <div>
            <h3>Товаров на руках</h3>
            <p>{metrics.totalProductsOnHand.toLocaleString()}</p>
          </div>
        </div>
        <div className="agent-analytics__metric-card">
          <div className="agent-analytics__metric-icon agent-analytics__metric-icon--green">
            <DollarSign size={24} />
          </div>
          <div>
            <h3>Стоимость товаров</h3>
            <p>{metrics.totalProductsValue.toLocaleString()} сом</p>
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

      {/* Графики передач и приёмок */}
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

      {/* Таблица передач */}
      {transfersHistory.length > 0 && (
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
    </div>
  );
};

export default AgentAnalytics;
