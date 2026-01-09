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
          all: { orders: 0, revenue: 0, service: 0 },
          placed: { orders: 0, revenue: 0, service: 0 },
          in_transit: { orders: 0, revenue: 0, service: 0 },
          completed: { orders: 0, revenue: 0, service: 0 },
        },
        charts: {
          orders_by_status: [],
          orders_by_arrival_date: [],
          service_by_status: [],
          revenue_by_status: [],
        },
      };
    }

    const cards = analytics.cards || {};
    const charts = analytics.charts || {};
    const byStatus = cards.by_status || [];

    // Преобразуем by_status в объект с ключами по статусам
    const statusMap = {};
    byStatus.forEach((item) => {
      const title = item.title || "";
      if (title.includes("Оформлен") || title.includes("decorated")) {
        statusMap.placed = item;
      } else if (title.includes("В пути") || title.includes("transit")) {
        statusMap.in_transit = item;
      } else if (title.includes("Завершен") || title.includes("completed")) {
        statusMap.completed = item;
      }
    });

    return {
      cards: {
        all: cards.all || { orders: 0, revenue: 0, service: 0 },
        placed: statusMap.placed || { orders: 0, revenue: 0, service: 0 },
        in_transit: statusMap.in_transit || {
          orders: 0,
          revenue: 0,
          service: 0,
        },
        completed: statusMap.completed || { orders: 0, revenue: 0, service: 0 },
      },
      charts: {
        orders_by_status: charts.orders_by_status || [],
        orders_by_arrival_date: charts.orders_by_arrival_date || [],
        service_by_status: charts.service_by_status || [],
        revenue_by_status: charts.revenue_by_status || [],
      },
    };
  }, [analytics]);

  // Данные для карточек
  const kpiCards = useMemo(() => {
    const { all, placed, in_transit, completed } = analyticsData.cards;

    return [
      {
        title: "Все заказы",
        count: all.orders || 0,
        sum: all.revenue || 0,
        serviceCost: all.service || 0,
        icon: FileText,
        color: "#f7d617",
      },
      {
        title: "Оформлен",
        count: placed.orders || 0,
        sum: placed.revenue || 0,
        serviceCost: placed.service || 0,
        icon: Package,
        color: "#3b82f6",
      },
      {
        title: "В пути",
        count: in_transit.orders || 0,
        sum: in_transit.revenue || 0,
        serviceCost: in_transit.service || 0,
        icon: Truck,
        color: "#f59e0b",
      },
      {
        title: "Завершен",
        count: completed.orders || 0,
        sum: completed.revenue || 0,
        serviceCost: completed.service || 0,
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
        labels: ["Оформлен", "В пути", "Завершен"],
        data: [
          analyticsData.cards.placed.orders || 0,
          analyticsData.cards.in_transit.orders || 0,
          analyticsData.cards.completed.orders || 0,
        ],
      };
    }

    return {
      labels: data.map((item) => item.name || item.status || "Неизвестно"),
      data: data.map((item) => item.value || 0),
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
        const date = new Date(item.date || item.day);
        return `${String(date.getDate()).padStart(2, "0")}.${String(
          date.getMonth() + 1
        ).padStart(2, "0")}`;
      }),
      data: data.map((item) => parseFloat(item.value || item.orders || 0)),
    };
  }, [analyticsData]);

  // Данные для графика "Стоимость услуг по статусам"
  const serviceCostByStatusChart = useMemo(() => {
    const serviceData = analyticsData.charts.service_by_status || [];
    const revenueData = analyticsData.charts.revenue_by_status || [];

    if (serviceData.length === 0 && revenueData.length === 0) {
      // Используем данные из карточек как fallback
      return {
        labels: ["Оформлен", "В пути", "Завершен"],
        serviceCost: [
          analyticsData.cards.placed.service || 0,
          analyticsData.cards.in_transit.service || 0,
          analyticsData.cards.completed.service || 0,
        ],
        revenue: [
          analyticsData.cards.placed.revenue || 0,
          analyticsData.cards.in_transit.revenue || 0,
          analyticsData.cards.completed.revenue || 0,
        ],
      };
    }

    // Используем service_by_status для labels и serviceCost
    const labels =
      serviceData.length > 0
        ? serviceData.map((item) => item.name || item.status || "Неизвестно")
        : revenueData.map((item) => item.name || item.status || "Неизвестно");

    return {
      labels,
      serviceCost: serviceData.map((item) => parseFloat(item.value || 0)),
      revenue: revenueData.map((item) => parseFloat(item.value || 0)),
    };
  }, [analyticsData]);

  // Данные для кругового графика "Распределение заказов"
  const ordersDistributionChart = useMemo(() => {
    const { placed, in_transit, completed } = analyticsData.cards;

    return {
      labels: ["Оформлен", "В пути", "Завершен"],
      data: [placed.orders || 0, in_transit.orders || 0, completed.orders || 0],
      colors: ["#f7d617", "#f59e0b", "#10b981"],
    };
  }, [analyticsData]);

  // Данные для кругового графика "Распределение выручки"
  const revenueDistributionChart = useMemo(() => {
    const { placed, in_transit, completed } = analyticsData.cards;

    return {
      labels: ["Оформлен", "В пути", "Завершен"],
      data: [
        placed.revenue || 0,
        in_transit.revenue || 0,
        completed.revenue || 0,
      ],
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
                      label: "Количество заказов",
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
                        stepSize: 1,
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
                    label: "Выручка (сом)",
                    data: serviceCostByStatusChart.revenue,
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
