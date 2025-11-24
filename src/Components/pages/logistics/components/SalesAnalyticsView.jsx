// "use client"; // если вдруг в Next.js

import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import {
  TrendingUp,
  DollarSign,
  ShoppingCart,
  Target,
  Calendar,
  Award,
  Activity,
  Package,
  BarChart3,
} from "lucide-react";
import { AnalyticsHeader } from "./AnalyticsHeader";

// Chart.js + react-chartjs-2
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Tooltip as ChartTooltip,
  Legend as ChartLegend,
} from "chart.js";
import { Line, Bar, Doughnut } from "react-chartjs-2";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  ChartTooltip,
  ChartLegend
);

export function SalesAnalyticsView({ cars = [] }) {
  const [period, setPeriod] = useState("all");

  // === БАЗОВЫЕ ДАННЫЕ ===
  const soldCars = cars.filter((car) => car.status === "sold" && car.soldDate);

  useEffect(() => {
    console.log("cars:", cars.length, cars);
    console.log("soldCars:", soldCars.length, soldCars);
  }, [cars, soldCars]);

  const handleRefresh = () => {
    console.log("Refreshing analytics data...");
  };

  const handleExport = () => {
    const csvData = soldCars.map((car) => ({
      Make: car.make,
      Model: car.model,
      Year: car.year,
      Price: car.price,
      SalePrice: car.salePrice || car.price,
      Profit: (car.salePrice || car.price || 0) - (car.price || 0),
      SoldTo: car.soldTo || "",
      SoldDate: car.soldDate || "",
    }));
    console.log("Exporting data:", csvData);
  };

  // === МЕТРИКИ ===
  const totalRevenue = soldCars.reduce(
    (sum, car) => sum + (car.salePrice || car.price || 0),
    0
  );
  const totalCost = soldCars.reduce((sum, car) => sum + (car.price || 0), 0);
  const totalProfit = totalRevenue - totalCost;
  const avgProfit = soldCars.length > 0 ? totalProfit / soldCars.length : 0;
  const avgMargin = totalCost > 0 ? (totalProfit / totalCost) * 100 : 0;

  // === ПРОДАЖИ ПО МАРКАМ ===
  const salesByMake = soldCars.reduce((acc, car) => {
    const make = car.make || "Не указано";
    if (!acc[make]) {
      acc[make] = { count: 0, revenue: 0, profit: 0 };
    }
    const revenue = car.salePrice || car.price || 0;
    const profit = revenue - (car.price || 0);
    acc[make].count += 1;
    acc[make].revenue += revenue;
    acc[make].profit += profit;
    return acc;
  }, {});

  const makeData = Object.entries(salesByMake)
    .map(([make, data]) => ({
      make,
      count: data.count,
      revenue: data.revenue,
      profit: data.profit,
    }))
    .sort((a, b) => b.revenue - a.revenue);

  // === ПРОДАЖИ ПО МЕСЯЦАМ ===
  const salesByMonth = soldCars.reduce((acc, car) => {
    if (!car.soldDate) return acc;

    const date = new Date(car.soldDate);
    if (isNaN(date.getTime())) return acc;

    const monthKey = `${date.getFullYear()}-${String(
      date.getMonth() + 1
    ).padStart(2, "0")}`;

    const revenue = car.salePrice || car.price || 0;
    const profit = revenue - (car.price || 0);

    if (!acc[monthKey]) {
      acc[monthKey] = { count: 0, revenue: 0, profit: 0 };
    }
    acc[monthKey].count += 1;
    acc[monthKey].revenue += revenue;
    acc[monthKey].profit += profit;
    return acc;
  }, {});

  const monthNames = [
    "Янв",
    "Фев",
    "Мар",
    "Апр",
    "Май",
    "Июн",
    "Июл",
    "Авг",
    "Сен",
    "Окт",
    "Ноя",
    "Дек",
  ];

  const monthData = Object.entries(salesByMonth)
    .map(([month, data]) => {
      const [year, monthNum] = month.split("-");
      const idx = parseInt(monthNum, 10) - 1;
      return {
        monthKey: month,
        month: `${monthNames[idx]} ${year}`,
        revenue: data.revenue,
        profit: data.profit,
      };
    })
    .sort((a, b) => a.monthKey.localeCompare(b.monthKey));

  // === ТОП-5 ПРОДАЖ ===
  const topCars = [...soldCars]
    .map((car) => {
      const revenue = car.salePrice || car.price || 0;
      const profit = revenue - (car.price || 0);
      const margin = car.price ? (profit / car.price) * 100 : 0;
      return {
        ...car,
        profit,
        margin,
      };
    })
    .sort((a, b) => b.profit - a.profit)
    .slice(0, 5);

  const COLORS = [
    "#2563eb",
    "#10b981",
    "#f59e0b",
    "#8b5cf6",
    "#ec4899",
    "#6366f1",
  ];

  // === СТАТУСЫ СКЛАДА ===
  const inventoryStatus = [
    {
      name: "На витрине",
      value: cars.filter((c) => c.status === "for_sale").length,
      color: "#2563eb",
    },
    {
      name: "Продано",
      value: soldCars.length,
      color: "#10b981",
    },
    {
      name: "На складе",
      value: cars.filter(
        (c) => c.status === "arrived" || c.status === "accepted"
      ).length,
      color: "#f59e0b",
    },
    {
      name: "В пути",
      value: cars.filter((c) => c.status === "in_transit").length,
      color: "#8b5cf6",
    },
  ].filter((item) => item.value > 0);

  const growthRate = 12.5;
  const conversionRate =
    cars.length > 0 ? (soldCars.length / cars.length) * 100 : 0;

  // === ДАННЫЕ ДЛЯ ГРАФИКОВ CHART.JS ===

  // 1) Линейный график по месяцам
  const lineChartData = {
  labels: monthData.map((m) => m.month),
  datasets: [
    {
      label: "Выручка",
      data: monthData.map((m) => m.revenue),
      borderWidth: 2,
      tension: 0.3,
      borderColor: "#2563eb", // синий
      backgroundColor: "rgba(37, 99, 235, 0.15)",
      pointBackgroundColor: "#2563eb",
      pointBorderColor: "#ffffff",
      fill: true,
    },
    {
      label: "Прибыль",
      data: monthData.map((m) => m.profit),
      borderWidth: 2,
      tension: 0.3,
      borderColor: "#10b981", // зеленый
      backgroundColor: "rgba(16, 185, 129, 0.15)",
      pointBackgroundColor: "#10b981",
      pointBorderColor: "#ffffff",
      fill: true,
    },
  ],
};

  // 2) Бар-чарт по маркам
  const barChartData = {
  labels: makeData.map((m) => m.make),
  datasets: [
    {
      label: "Выручка",
      data: makeData.map((m) => m.revenue),
      backgroundColor: "#2563eb",
      borderColor: "#2563eb",
      borderWidth: 1,
      borderRadius: 6,
    },
    {
      label: "Прибыль",
      data: makeData.map((m) => m.profit),
      backgroundColor: "#10b981",
      borderColor: "#10b981",
      borderWidth: 1,
      borderRadius: 6,
    },
  ],
};

  // 3) Круговая диаграмма по статусам
  const doughnutData = {
    labels: inventoryStatus.map((i) => i.name),
    datasets: [
      {
        data: inventoryStatus.map((i) => i.value),
        backgroundColor: inventoryStatus.map((i) => i.color),
      },
    ],
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <AnalyticsHeader
        onRefresh={handleRefresh}
        onExport={handleExport}
        period={period}
        onPeriodChange={setPeriod}
      />

      {/* Метрики */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Общая выручка */}
        <Card className="border-2 border-[#ffd600]/20 bg-gradient-to-br from-[#ffd600]/10 to-white">
          <CardContent className="pt-6">
            <div className="flex items-start justify-between mb-4">
              <div className="h-12 w-12 rounded-xl bg-[#ffd600] flex items-center justify-center">
                <DollarSign className="h-6 w-6 text-gray-900" />
              </div>
              <Badge
                variant="secondary"
                className="bg-green-100 text-green-700 hover:bg-green-100"
              >
                <TrendingUp className="h-3 w-3 mr-1" />+{growthRate}%
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground mb-1">Общая выручка</p>
            <h2 className="text-[#ffd600]">
              ${totalRevenue.toLocaleString()}
            </h2>
            <p className="text-xs text-muted-foreground mt-1">
              За {monthData.length} месяц
              {monthData.length > 1 ? "а" : ""}
            </p>
          </CardContent>
        </Card>

        {/* Чистая прибыль */}
        <Card className="border-2 border-green-100 bg-gradient-to-br from-green-50 to-white">
          <CardContent className="pt-6">
            <div className="flex items-start justify-between mb-4">
              <div className="h-12 w-12 rounded-xl bg-green-500 flex items-center justify-center">
                <TrendingUp className="h-6 w-6 text-white" />
              </div>
              <Badge
                variant="secondary"
                className="bg-green-100 text-green-700 hover:bg-green-100"
              >
                {avgMargin.toFixed(1)}%
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground mb-1">
              Чистая прибыль
            </p>
            <h2 className="text-green-600">
              ${totalProfit.toLocaleString()}
            </h2>
            <p className="text-xs text-muted-foreground mt-1">
              Средняя маржа {avgMargin.toFixed(1)}%
            </p>
          </CardContent>
        </Card>

        {/* Количество продаж */}
        <Card className="border-2 border-purple-100 bg-gradient-to-br from-purple-50 to-white">
          <CardContent className="pt-6">
            <div className="flex items-start justify-between mb-4">
              <div className="h-12 w-12 rounded-xl bg-purple-500 flex items-center justify-center">
                <ShoppingCart className="h-6 w-6 text-white" />
              </div>
              <Badge
                variant="secondary"
                className="bg-purple-100 text-purple-700 hover:bg-purple-100"
              >
                {conversionRate.toFixed(0)}%
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground mb-1">
              Продано автомобилей
            </p>
            <div className="flex items-baseline gap-2">
              <h2 className="text-purple-600">{soldCars.length}</h2>
              <span className="text-sm text-muted-foreground">
                из {cars.length}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Средний чек $
              {soldCars.length > 0
                ? (totalRevenue / soldCars.length).toFixed(0)
                : "0"}
            </p>
          </CardContent>
        </Card>

        {/* Средняя прибыль */}
        <Card className="border-2 border-orange-100 bg-gradient-to-br from-orange-50 to-white">
          <CardContent className="pt-6">
            <div className="flex items-start justify-between mb-4">
              <div className="h-12 w-12 rounded-xl bg-orange-500 flex items-center justify-center">
                <Target className="h-6 w-6 text-white" />
              </div>
              <Badge
                variant="secondary"
                className="bg-orange-100 text-orange-700 hover:bg-orange-100"
              >
                <Activity className="h-3 w-3 mr-1" />
                Активно
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground mb-1">
              Средняя прибыль
            </p>
            <h2 className="text-orange-600">
              ${avgProfit > 0 ? avgProfit.toFixed(0) : "0"}
            </h2>
            <p className="text-xs text-muted-foreground mt-1">
              На одну продажу
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Графики */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Динамика продаж по месяцам */}
        <Card className="shadow-sm">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-[#ffd600]/20 flex items-center justify-center">
                  <Activity className="h-4 w-4 text-[#ffd600]" />
                </div>
                Динамика продаж
              </CardTitle>
              <Badge variant="outline">За период</Badge>
            </div>
          </CardHeader>
          <CardContent className="p-6">
            {monthData.length > 0 ? (
              <div style={{ height: 320 }}>
                <Line
                  data={lineChartData}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                      legend: { position: "bottom" },
                    },
                    scales: {
                      y: {
                        ticks: {
                          callback: (val) => `$${val / 1000}k`,
                        },
                      },
                    },
                  }}
                />
              </div>
            ) : (
              <div className="h-[320px] flex items-center justify-center text-gray-600">
                <div className="text-center">
                  <Calendar className="h-12 w-12 mx-auto mb-2 opacity-50 text-gray-400" />
                  <p className="text-gray-600">Нет данных для отображения</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Продажи по маркам */}
        <Card className="shadow-sm">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-green-100 flex items-center justify-center">
                  <Package className="h-4 w-4 text-green-600" />
                </div>
                Продажи по маркам
              </CardTitle>
              <Badge variant="outline">{makeData.length} марок</Badge>
            </div>
          </CardHeader>
          <CardContent className="p-6">
            {makeData.length > 0 ? (
              <div style={{ height: 320 }}>
                <Bar
                  data={barChartData}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                      legend: { position: "bottom" },
                    },
                    scales: {
                      y: {
                        ticks: {
                          callback: (val) => `$${val / 1000}k`,
                        },
                      },
                    },
                  }}
                />
              </div>
            ) : (
              <div className="h-[320px] flex items-center justify-center text-gray-600">
                <div className="text-center">
                  <Package className="h-12 w-12 mx-auto mb-2 opacity-50 text-gray-400" />
                  <p className="text-gray-600">Нет данных для отображения</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Распределение + Топ-5 + таблица — можешь оставить свои, только круг заменим на Doughnut */}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Распределение склада */}
        <Card className="shadow-sm lg:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-purple-100 flex items-center justify-center">
                <Activity className="h-4 w-4 text-purple-600" />
              </div>
              Распределение
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            {inventoryStatus.length > 0 ? (
              <div className="space-y-4">
                <div style={{ height: 200 }}>
                  <Doughnut
                    data={doughnutData}
                    options={{
                      responsive: true,
                      maintainAspectRatio: false,
                      plugins: {
                        legend: { display: false },
                      },
                    }}
                  />
                </div>
                <div className="space-y-2">
                  {inventoryStatus.map((item, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: item.color }}
                        />
                        <span className="text-sm">{item.name}</span>
                      </div>
                      <Badge variant="secondary" className="tabular-nums">
                        {item.value}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="h-[250px] flex items-center justify-center text-gray-600">
                <div className="text-center">
                  <Activity className="h-12 w-12 mx-auto mb-2 opacity-50 text-gray-400" />
                  <p className="text-gray-600">Нет данных</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Топ-5 продаж */}
        <Card className="shadow-sm lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-yellow-100 flex items-center justify-center">
                  <Award className="h-4 w-4 text-yellow-600" />
                </div>
                Топ-5 продаж по прибыли
              </CardTitle>
              <Badge variant="outline">Лучшие сделки</Badge>
            </div>
          </CardHeader>
          <CardContent>
            {topCars.length > 0 ? (
              <div className="space-y-3">
                {topCars.map((car, index) => (
                  <div
                    key={car.id}
                    className="flex items-center gap-4 p-3 rounded-xl hover:bg-muted/50 transition-all border border-transparent hover:border-border"
                  >
                    <div className="flex items-center justify-center w-10 h-10 rounded-full bg-gradient-to-br from-[#ffd600] to-[#ffd600] text-gray-900 shadow-md">
                      <span className="font-semibold">#{index + 1}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">
                        {car.make} {car.model}
                      </p>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <span>{car.year}</span>
                        <span>•</span>
                        <span className="truncate">
                          {car.soldTo || "Клиент"}
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="flex items-center gap-1 font-semibold">
                        <span
                          className={
                            car.profit > 0
                              ? "text-green-600"
                              : "text-red-600"
                          }
                        >
                          ${Math.abs(car.profit).toLocaleString()}
                        </span>
                      </div>
                      <Badge
                        variant="secondary"
                        className="mt-1 text-xs"
                      >
                        {car.margin.toFixed(1)}% маржа
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="h-[250px] flex items-center justify-center text-gray-600">
                <div className="text-center">
                  <Award className="h-12 w-12 mx-auto mb-2 opacity-50 text-gray-400" />
                  <p className="text-gray-600">Нет проданных автомобилей</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Таблица по маркам */}
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-gray-100 flex items-center justify-center">
              <BarChart3 className="h-4 w-4 text-gray-600" />
            </div>
            Детальная статистика по маркам
          </CardTitle>
        </CardHeader>
        <CardContent>
          {makeData.length > 0 ? (
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left p-4 font-medium">Марка</th>
                    <th className="text-right p-4 font-medium">Продано</th>
                    <th className="text-right p-4 font-medium">Выручка</th>
                    <th className="text-right p-4 font-medium">Прибыль</th>
                    <th className="text-right p-4 font-medium">Средний чек</th>
                    <th className="text-right p-4 font-medium">Маржа</th>
                  </tr>
                </thead>
                <tbody>
                  {makeData.map((item, index) => {
                    const avgPrice = item.revenue / item.count;
                    const margin =
                      item.revenue > 0
                        ? (item.profit / (item.revenue - item.profit)) * 100
                        : 0;
                    return (
                      <tr
                        key={item.make}
                        className="border-t hover:bg-muted/30 transition-colors"
                      >
                        <td className="p-4">
                          <div className="flex items-center gap-2">
                            <div
                              className="h-2 w-2 rounded-full"
                              style={{
                                backgroundColor:
                                  COLORS[index % COLORS.length],
                              }}
                            />
                            <span className="font-medium">{item.make}</span>
                          </div>
                        </td>
                        <td className="text-right p-4 tabular-nums">
                          {item.count}
                        </td>
                        <td className="text-right p-4 tabular-nums font-medium">
                          ${item.revenue.toLocaleString()}
                        </td>
                        <td className="text-right p-4 tabular-nums">
                          <span
                            className={
                              item.profit > 0
                                ? "text-green-600 font-medium"
                                : "text-red-600"
                            }
                          >
                            ${item.profit.toLocaleString()}
                          </span>
                        </td>
                        <td className="text-right p-4 tabular-nums">
                          ${avgPrice.toFixed(0)}
                        </td>
                        <td className="text-right p-4">
                          <Badge
                            variant={margin > 15 ? "default" : "secondary"}
                            className="tabular-nums"
                          >
                            {margin.toFixed(1)}%
                          </Badge>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="py-12 text-center text-gray-600">
              <BarChart3 className="h-12 w-12 mx-auto mb-2 opacity-50 text-gray-400" />
              <p className="text-gray-600">Нет данных для отображения</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
