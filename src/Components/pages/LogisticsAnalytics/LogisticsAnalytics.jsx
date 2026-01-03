import React, { useState, useEffect, useMemo } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  Package,
  CheckCircle,
  Truck,
  FileText,
  DollarSign,
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
  Filler,
} from "chart.js";
import { Line, Bar, Doughnut } from "react-chartjs-2";
import { fetchLogisticsAnalyticsAsync } from "../../../store/creators/logisticsCreators";
import { useLogistics } from "../../../store/slices/logisticsSlice";
import { useUser } from "../../../store/slices/userSlice";
import "./LogisticsAnalytics.scss";

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

const LogisticsAnalytics = () => {
  const dispatch = useDispatch();
  const { company } = useUser();
  const { analytics, analyticsLoading } = useLogistics();

  // Загрузка аналитики
  useEffect(() => {
    if (!company?.id) return;
    const params = { company: company.id, branch: company.branch };
    dispatch(fetchLogisticsAnalyticsAsync(params));
  }, [dispatch, company]);

  // Форматирование чисел
  const formatNumber = (num) => {
    if (typeof num === "string") {
      num = parseFloat(num);
    }
    if (isNaN(num)) return "0";
    return num.toLocaleString("ru-RU", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    });
  };

  // Форматирование валюты
  const formatCurrency = (num) => {
    if (typeof num === "string") {
      num = parseFloat(num);
    }
    if (isNaN(num)) return "0";
    return num.toLocaleString("ru-RU", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    });
  };

  // Обработка данных аналитики
  const analyticsData = useMemo(() => {
    if (!analytics) {
      return {
        cards: {
          all: { count: 0, sum: 0, service_cost: 0 },
          placed: { count: 0, sum: 0, service_cost: 0 },
          in_transit: { count: 0, sum: 0, service_cost: 0 },
          completed: { count: 0, sum: 0, service_cost: 0 },
        },
        charts: {
          orders_by_status: [],
          orders_by_arrival_date: [],
          service_cost_by_status: [],
        },
      };
    }

    // Если данные приходят в другом формате, адаптируем их
    const cards = analytics.cards || analytics.summary || {};
    const charts = analytics.charts || {};

    return {
      cards: {
        all: cards.all ||
          cards.all_orders || { count: 0, sum: 0, service_cost: 0 },
        placed: cards.placed ||
          cards.processed || { count: 0, sum: 0, service_cost: 0 },
        in_transit: cards.in_transit ||
          cards.in_transit || { count: 0, sum: 0, service_cost: 0 },
        completed: cards.completed ||
          cards.finished || { count: 0, sum: 0, service_cost: 0 },
      },
      charts: {
        orders_by_status:
          charts.orders_by_status || charts.distribution_by_status || [],
        orders_by_arrival_date:
          charts.orders_by_arrival_date || charts.by_arrival_date || [],
        service_cost_by_status:
          charts.service_cost_by_status || charts.cost_by_status || [],
      },
    };
  }, [analytics]);

  // Данные для карточек
  const kpiCards = useMemo(() => {
    const { all, placed, in_transit, completed } = analyticsData.cards;

    return [
      {
        title: "Все заказы",
        count: all.count || 0,
        sum: all.sum || 0,
        serviceCost: all.service_cost || 0,
        icon: FileText,
        color: "#f7d617",
      },
      {
        title: "Оформлен",
        count: placed.count || 0,
        sum: placed.sum || 0,
        serviceCost: placed.service_cost || 0,
        icon: Package,
        color: "#3b82f6",
      },
      {
        title: "В пути",
        count: in_transit.count || 0,
        sum: in_transit.sum || 0,
        serviceCost: in_transit.service_cost || 0,
        icon: Truck,
        color: "#f59e0b",
      },
      {
        title: "Завершен",
        count: completed.count || 0,
        sum: completed.sum || 0,
        serviceCost: completed.service_cost || 0,
        icon: CheckCircle,
        color: "#10b981",
      },
    ];
  }, [analyticsData]);

  // Данные для графика "Распределение заказов по статусам"
  const ordersByStatusChart = useMemo(() => {
    const data = analyticsData.charts.orders_by_status;

    if (!data || data.length === 0) {
      // Используем данные из карточек как fallback
      return {
        labels: ["Все заказы", "Оформлен", "В пути", "Завершен"],
        data: [
          analyticsData.cards.all.count || 0,
          analyticsData.cards.placed.count || 0,
          analyticsData.cards.in_transit.count || 0,
          analyticsData.cards.completed.count || 0,
        ],
      };
    }

    return {
      labels: data.map((item) => item.status || item.name || "Неизвестно"),
      data: data.map((item) => item.count || item.orders || 0),
    };
  }, [analyticsData]);

  // Данные для графика "Заказы по датам прибытия"
  const ordersByArrivalDateChart = useMemo(() => {
    const data = analyticsData.charts.orders_by_arrival_date;

    if (!data || data.length === 0) {
      return {
        labels: [],
        data: [],
      };
    }

    return {
      labels: data.map((item) => {
        const date = new Date(item.date || item.arrival_date);
        return `${String(date.getDate()).padStart(2, "0")}.${String(
          date.getMonth() + 1
        ).padStart(2, "0")}`;
      }),
      data: data.map((item) => parseFloat(item.sum || item.total || 0)),
    };
  }, [analyticsData]);

  // Данные для графика "Стоимость услуг по статусам"
  const serviceCostByStatusChart = useMemo(() => {
    const data = analyticsData.charts.service_cost_by_status;

    if (!data || data.length === 0) {
      // Используем данные из карточек как fallback
      return {
        labels: ["Все заказы", "Оформлен", "В пути", "Завершен"],
        serviceCost: [
          analyticsData.cards.all.service_cost || 0,
          analyticsData.cards.placed.service_cost || 0,
          analyticsData.cards.in_transit.service_cost || 0,
          analyticsData.cards.completed.service_cost || 0,
        ],
        orderSum: [
          analyticsData.cards.all.sum || 0,
          analyticsData.cards.placed.sum || 0,
          analyticsData.cards.in_transit.sum || 0,
          analyticsData.cards.completed.sum || 0,
        ],
      };
    }

    return {
      labels: data.map((item) => item.status || item.name || "Неизвестно"),
      serviceCost: data.map((item) => parseFloat(item.service_cost || 0)),
      orderSum: data.map((item) => parseFloat(item.sum || item.total || 0)),
    };
  }, [analyticsData]);

  // Данные для кругового графика "Распределение заказов"
  const ordersDistributionChart = useMemo(() => {
    const { placed, in_transit, completed } = analyticsData.cards;

    return {
      labels: ["Оформлен", "В пути", "Завершен"],
      data: [placed.count || 0, in_transit.count || 0, completed.count || 0],
      colors: ["#f7d617", "#f59e0b", "#10b981"],
    };
  }, [analyticsData]);

  // Данные для кругового графика "Распределение выручки"
  const revenueDistributionChart = useMemo(() => {
    const { placed, in_transit, completed } = analyticsData.cards;

    return {
      labels: ["Оформлен", "В пути", "Завершен"],
      data: [placed.sum || 0, in_transit.sum || 0, completed.sum || 0],
      colors: ["#f7d617", "#f59e0b", "#10b981"],
    };
  }, [analyticsData]);

  if (analyticsLoading) {
    return (
      <div className="logistics-analytics">
        <div className="logistics-analytics__loading">
          <p>Загрузка данных...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="logistics-analytics">
      <div className="logistics-analytics__header">
        {/* <h1 className="logistics-analytics__title">Аналитика заказов</h1> */}
      </div>

      {/* Карточки с метриками */}
      <div className="logistics-analytics__kpis">
        {kpiCards.map((card, index) => {
          const Icon = card.icon;
          return (
            <div key={index} className="logistics-analytics__kpi-card">
              <div className="logistics-analytics__kpi-header">
                <Icon size={24} style={{ color: card.color }} />
                <span className="logistics-analytics__kpi-title">
                  {card.title}
                </span>
              </div>
              <div className="logistics-analytics__kpi-content">
                <div className="logistics-analytics__kpi-value">
                  {formatNumber(card.count)} заказов
                </div>
                <div className="logistics-analytics__kpi-sum">
                  {formatCurrency(card.sum)} сом
                </div>
                <div className="logistics-analytics__kpi-service">
                  Стоимость услуг: {formatCurrency(card.serviceCost)} сом
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Графики */}
      <div className="logistics-analytics__charts">
        <div className="logistics-analytics__charts-container">
          {/* Распределение заказов по статусам */}
          <div className="logistics-analytics__chart-card">
            <h3 className="logistics-analytics__chart-title">
              Распределение заказов по статусам
            </h3>
            <div className="logistics-analytics__chart-container">
              <Bar
                data={{
                  labels: ordersByStatusChart.labels,
                  datasets: [
                    {
                      label: "Заказов",
                      data: ordersByStatusChart.data,
                      backgroundColor: "#f7d617",
                      borderColor: "#f7d617",
                      borderWidth: 1,
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
                        stepSize: 1,
                      },
                    },
                  },
                }}
              />
            </div>
          </div>

          {/* Заказы по датам прибытия */}
          <div className="logistics-analytics__chart-card">
            <h3 className="logistics-analytics__chart-title">
              Заказы по датам прибытия
            </h3>
            <div className="logistics-analytics__chart-container">
              <Line
                data={{
                  labels: ordersByArrivalDateChart.labels,
                  datasets: [
                    {
                      label: "Сумма (сом)",
                      data: ordersByArrivalDateChart.data,
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
                          return formatCurrency(value);
                        },
                      },
                    },
                  },
                }}
              />
            </div>
          </div>
        </div>

        {/* Стоимость услуг по статусам */}
        <div className="logistics-analytics__chart-card logistics-analytics__chart-card--full-width">
          <h3 className="logistics-analytics__chart-title">
            Стоимость услуг по статусам
          </h3>
          <div className="logistics-analytics__chart-container">
            <Bar
              data={{
                labels: serviceCostByStatusChart.labels,
                datasets: [
                  {
                    label: "Стоимость услуг (сом)",
                    data: serviceCostByStatusChart.serviceCost,
                    backgroundColor: "#06b6d4",
                    borderColor: "#06b6d4",
                    borderWidth: 1,
                  },
                  {
                    label: "Сумма заказов (сом)",
                    data: serviceCostByStatusChart.orderSum,
                    backgroundColor: "#f7d617",
                    borderColor: "#f7d617",
                    borderWidth: 1,
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
                        return formatCurrency(value);
                      },
                    },
                  },
                },
              }}
            />
          </div>
        </div>

        {/* Распределение заказов (круговой) */}
        <div className="logistics-analytics__charts-container">
          <div className="logistics-analytics__chart-card">
            <h3 className="logistics-analytics__chart-title">
              Распределение заказов
            </h3>
            <div className="logistics-analytics__chart-container">
              <Doughnut
                data={{
                  labels: ordersDistributionChart.labels,
                  datasets: [
                    {
                      data: ordersDistributionChart.data,
                      backgroundColor: ordersDistributionChart.colors,
                      borderWidth: 0,
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
                    tooltip: {
                      callbacks: {
                        label: function (context) {
                          const label = context.label || "";
                          const value = context.parsed || 0;
                          return `${label}: ${value}`;
                        },
                      },
                    },
                  },
                }}
              />
            </div>
          </div>

          {/* Распределение выручки (круговой) */}
          <div className="logistics-analytics__chart-card">
            <h3 className="logistics-analytics__chart-title">
              Распределение выручки
            </h3>
            <div className="logistics-analytics__chart-container">
              <Doughnut
                data={{
                  labels: revenueDistributionChart.labels,
                  datasets: [
                    {
                      data: revenueDistributionChart.data,
                      backgroundColor: revenueDistributionChart.colors,
                      borderWidth: 0,
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
                    tooltip: {
                      callbacks: {
                        label: function (context) {
                          const label = context.label || "";
                          const value = context.parsed || 0;
                          return `${label}: ${formatCurrency(value)}`;
                        },
                      },
                    },
                  },
                }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LogisticsAnalytics;
