import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Area,
  AreaChart,
} from "recharts";
import {
  TrendingUp,
  DollarSign,
  ShoppingCart,
  Target,
  Calendar,
  Award,
  Activity,
  Package,
} from "lucide-react";
import { AnalyticsHeader } from "./AnalyticsHeader";

export function SalesAnalyticsView({ cars }) {
  const [period, setPeriod] = useState("all");

  // Проданные авто
  const soldCars = cars.filter((car) => car.status === "sold" && car.soldDate);

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

  // Метрики
  const totalRevenue = soldCars.reduce(
    (sum, car) => sum + (car.salePrice || car.price || 0),
    0
  );
  const totalCost = soldCars.reduce(
    (sum, car) => sum + (car.price || 0),
    0
  );
  const totalProfit = totalRevenue - totalCost;
  const avgProfit = soldCars.length > 0 ? totalProfit / soldCars.length : 0;
  const avgMargin = totalCost > 0 ? (totalProfit / totalCost) * 100 : 0;

  // Продажи по маркам
  const salesByMake = soldCars.reduce((acc, car) => {
    const make = car.make;
    if (!acc[make]) {
      acc[make] = { count: 0, revenue: 0, profit: 0 };
    }
    acc[make].count += 1;
    acc[make].revenue += car.salePrice || car.price || 0;
    acc[make].profit +=
      (car.salePrice || car.price || 0) - (car.price || 0);
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

  // Продажи по месяцам
  const salesByMonth = soldCars.reduce((acc, car) => {
    if (!car.soldDate) return acc;

    const date = new Date(car.soldDate);
    const monthKey = `${date.getFullYear()}-${String(
      date.getMonth() + 1
    ).padStart(2, "0")}`;

    if (!acc[monthKey]) {
      acc[monthKey] = { count: 0, revenue: 0, profit: 0 };
    }
    acc[monthKey].count += 1;
    acc[monthKey].revenue += car.salePrice || car.price || 0;
    acc[monthKey].profit +=
      (car.salePrice || car.price || 0) - (car.price || 0);
    return acc;
  }, {});

  const monthData = Object.entries(salesByMonth)
    .map(([month, data]) => {
      const [year, monthNum] = month.split("-");
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
      const idx = parseInt(monthNum, 10) - 1;
      return {
        month: monthNames[idx],
        fullMonth: `${monthNames[idx]} ${year}`,
        count: data.count,
        revenue: data.revenue,
        profit: data.profit,
      };
    })
    // сортировка по времени (по ключу `monthKey`, но мы уже потеряли год,
    // так что оставляем как есть или при желании можно пересортировать
    // по исходному объекту)
    .sort((a, b) => a.fullMonth.localeCompare(b.fullMonth));

  // Топ авто по прибыли
  const topCars = [...soldCars]
    .map((car) => {
      const profit =
        (car.salePrice || car.price || 0) - (car.price || 0);
      const margin = car.price
        ? (profit / car.price) * 100
        : 0;
      return {
        ...car,
        profit,
        margin,
      };
    })
    .sort((a, b) => b.profit - a.profit)
    .slice(0, 5);

  // Цвета
  const COLORS = [
    "#2563eb",
    "#10b981",
    "#f59e0b",
    "#8b5cf6",
    "#ec4899",
    "#6366f1",
  ];

  // Статус склада
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

  // Примерные значения
  const growthRate = 12.5;
  const conversionRate =
    soldCars.length > 0 ? (soldCars.length / cars.length) * 100 : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <AnalyticsHeader
        onRefresh={handleRefresh}
        onExport={handleExport}
        period={period}
        onPeriodChange={setPeriod}
      />

      {/* Основные метрики */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Total Revenue */}
        <Card className="border-2 border-blue-100 bg-gradient-to-br from-blue-50 to-white">
          <CardContent className="pt-6">
            <div className="flex items-start justify-between mb-4">
              <div className="h-12 w-12 rounded-xl bg-blue-500 flex items-center justify-center">
                <DollarSign className="h-6 w-6 text-white" />
              </div>
              <Badge
                variant="secondary"
                className="bg-green-100 text-green-700 hover:bg-green-100"
              >
                <TrendingUp className="h-3 w-3 mr-1" />
                +{growthRate}%
              </Badge>
            </div>
            <div>
              <p className="text-sm text-muted-foreground mb-1">
                Общая выручка
              </p>
              <div className="flex items-baseline gap-2">
                <h2 className="text-blue-600">
                  ${totalRevenue.toLocaleString()}
                </h2>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                За {monthData.length} месяц
                {monthData.length > 1 ? "а" : ""}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Net Profit */}
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
            <div>
              <p className="text-sm text-muted-foreground mb-1">
                Чистая прибыль
              </p>
              <div className="flex items-baseline gap-2">
                <h2 className="text-green-600">
                  ${totalProfit.toLocaleString()}
                </h2>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Средняя маржа {avgMargin.toFixed(1)}%
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Cars Sold */}
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
            <div>
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
            </div>
          </CardContent>
        </Card>

        {/* Average Profit */}
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
            <div>
              <p className="text-sm text-muted-foreground mb-1">
                Средняя прибыль
              </p>
              <div className="flex items-baseline gap-2">
                <h2 className="text-orange-600">
                  ${avgProfit > 0 ? avgProfit.toFixed(0) : "0"}
                </h2>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                На одну продажу
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Основные графики */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Динамика продаж */}
        <Card className="shadow-sm">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-blue-100 flex items-center justify-center">
                  <Activity className="h-4 w-4 text-blue-600" />
                </div>
                Динамика продаж
              </CardTitle>
              <Badge variant="outline">За период</Badge>
            </div>
          </CardHeader>
          <CardContent>
            {monthData.length > 0 ? (
              <ResponsiveContainer width="100%" height={320}>
                <AreaChart data={monthData}>
                  <defs>
                    <linearGradient
                      id="colorRevenue"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop
                        offset="5%"
                        stopColor="#2563eb"
                        stopOpacity={0.3}
                      />
                      <stop
                        offset="95%"
                        stopColor="#2563eb"
                        stopOpacity={0}
                      />
                    </linearGradient>
                    <linearGradient
                      id="colorProfit"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop
                        offset="5%"
                        stopColor="#10b981"
                        stopOpacity={0.3}
                      />
                      <stop
                        offset="95%"
                        stopColor="#10b981"
                        stopOpacity={0}
                      />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="#e5e7eb"
                  />
                  <XAxis
                    dataKey="month"
                    tick={{ fill: "#6b7280", fontSize: 12 }}
                    tickLine={{ stroke: "#e5e7eb" }}
                  />
                  <YAxis
                    tick={{ fill: "#6b7280", fontSize: 12 }}
                    tickLine={{ stroke: "#e5e7eb" }}
                    tickFormatter={(value) => `$${value / 1000}k`}
                  />
                  <Tooltip
                    formatter={(value) => [
                      `$${value.toLocaleString()}`,
                      "",
                    ]}
                    contentStyle={{
                      backgroundColor: "white",
                      border: "1px solid #e5e7eb",
                      borderRadius: "8px",
                      boxShadow:
                        "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                    }}
                    labelStyle={{ color: "#1f2937" }}
                  />
                  <Legend />
                  <Area
                    type="monotone"
                    dataKey="revenue"
                    stroke="#2563eb"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#colorRevenue)"
                    name="Выручка"
                  />
                  <Area
                    type="monotone"
                    dataKey="profit"
                    stroke="#10b981"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#colorProfit)"
                    name="Прибыль"
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[320px] flex items-center justify-center text-muted-foreground">
                <div className="text-center">
                  <Calendar className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>Нет данных для отображения</p>
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
              <Badge variant="outline">
                {makeData.length} марок
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            {makeData.length > 0 ? (
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={makeData}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="#e5e7eb"
                  />
                  <XAxis
                    dataKey="make"
                    tick={{ fill: "#6b7280", fontSize: 12 }}
                    tickLine={{ stroke: "#e5e7eb" }}
                  />
                  <YAxis
                    tick={{ fill: "#6b7280", fontSize: 12 }}
                    tickLine={{ stroke: "#e5e7eb" }}
                    tickFormatter={(value) => `$${value / 1000}k`}
                  />
                  <Tooltip
                    formatter={(value) => [
                      `$${value.toLocaleString()}`,
                      "",
                    ]}
                    contentStyle={{
                      backgroundColor: "white",
                      border: "1px solid #e5e7eb",
                      borderRadius: "8px",
                      boxShadow:
                        "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                    }}
                  />
                  <Legend />
                  <Bar
                    dataKey="revenue"
                    fill="#2563eb"
                    radius={[8, 8, 0, 0]}
                    name="Выручка"
                  />
                  <Bar
                    dataKey="profit"
                    fill="#10b981"
                    radius={[8, 8, 0, 0]}
                    name="Прибыль"
                  />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[320px] flex items-center justify-center text-muted-foreground">
                <div className="text-center">
                  <Package className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>Нет данных для отображения</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Вторичные графики */}
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
          <CardContent>
            {inventoryStatus.length > 0 ? (
              <div className="space-y-4">
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie
                      data={inventoryStatus}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={90}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {inventoryStatus.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={entry.color}
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "white",
                        border: "1px solid #e5e7eb",
                        borderRadius: "8px",
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
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
                      <Badge
                        variant="secondary"
                        className="tabular-nums"
                      >
                        {item.value}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="h-[250px] flex items-center justify-center text-muted-foreground">
                <div className="text-center">
                  <Activity className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>Нет данных</p>
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
                    <div className="flex items-center justify-center w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-md">
                      <span className="font-semibold">
                        #{index + 1}
                      </span>
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
              <div className="h-[250px] flex items-center justify-center text-muted-foreground">
                <div className="text-center">
                  <Award className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>Нет проданных автомобилей</p>
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
              <BarChart className="h-4 w-4 text-gray-600" />
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
                    <th className="text-right p-4 font-medium">
                      Продано
                    </th>
                    <th className="text-right p-4 font-medium">
                      Выручка
                    </th>
                    <th className="text-right p-4 font-medium">
                      Прибыль
                    </th>
                    <th className="text-right p-4 font-medium">
                      Средний чек
                    </th>
                    <th className="text-right p-4 font-medium">
                      Маржа
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {makeData.map((item, index) => {
                    const avgPrice = item.revenue / item.count;
                    const margin =
                      item.revenue > 0
                        ? (item.profit /
                            (item.revenue - item.profit)) *
                          100
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
                            <span className="font-medium">
                              {item.make}
                            </span>
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
                            variant={
                              margin > 15 ? "default" : "secondary"
                            }
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
            <div className="py-12 text-center text-muted-foreground">
              <BarChart className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>Нет данных для отображения</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
