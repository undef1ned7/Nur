import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import {
  Store,
  Search,
  SlidersHorizontal,
  DollarSign,
  Gauge,
  Calendar,
} from "lucide-react";
import { ShopCarCard } from "./ShopCarCard";

export function ShowroomView({
  cars,
  onViewDetails,
  onOrder,
  onSell,
  isManager,
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [makeFilter, setMakeFilter] = useState("all");
  const [sortBy, setSortBy] = useState("newest");
  const [priceRange, setPriceRange] = useState("all");

  const showroomCars = cars.filter((car) => car.status === "for_sale");

  // уникальные марки
  const makes = Array.from(new Set(showroomCars.map((car) => car.make))).sort();

  // фильтрация
  let filteredCars = showroomCars.filter((car) => {
    const matchesSearch =
      car.make.toLowerCase().includes(searchQuery.toLowerCase()) ||
      car.model.toLowerCase().includes(searchQuery.toLowerCase()) ||
      car.year.toString().includes(searchQuery);

    const matchesMake = makeFilter === "all" || car.make === makeFilter;

    const price = car.salePrice || 0;
    let matchesPrice = true;
    if (priceRange === "under30k") matchesPrice = price < 30000;
    else if (priceRange === "30-40k")
      matchesPrice = price >= 30000 && price < 40000;
    else if (priceRange === "40-50k")
      matchesPrice = price >= 40000 && price < 50000;
    else if (priceRange === "over50k") matchesPrice = price >= 50000;

    return matchesSearch && matchesMake && matchesPrice;
  });

  // сортировка
  if (sortBy === "price-low") {
    filteredCars.sort((a, b) => (a.salePrice || 0) - (b.salePrice || 0));
  } else if (sortBy === "price-high") {
    filteredCars.sort((a, b) => (b.salePrice || 0) - (a.salePrice || 0));
  } else if (sortBy === "year-new") {
    filteredCars.sort((a, b) => b.year - a.year);
  } else if (sortBy === "year-old") {
    filteredCars.sort((a, b) => a.year - b.year);
  } else if (sortBy === "newest") {
    filteredCars.sort((a, b) => {
      const dateA = new Date(a.listedDate || 0).getTime();
      const dateB = new Date(b.listedDate || 0).getTime();
      return dateB - dateA;
    });
  }

  const stats = {
    total: showroomCars.length,
    avgPrice:
      showroomCars.length > 0
        ? Math.round(
            showroomCars.reduce((sum, car) => sum + (car.salePrice || 0), 0) /
              showroomCars.length
          )
        : 0,
    avgYear:
      showroomCars.length > 0
        ? Math.round(
            showroomCars.reduce((sum, car) => sum + car.year, 0) /
              showroomCars.length
          )
        : 0,
    avgMileage:
      showroomCars.length > 0
        ? Math.round(
            showroomCars.reduce((sum, car) => sum + (car.mileage || 0), 0) /
              showroomCars.length
          )
        : 0,
  };

  return (
    <div className="space-y-6">
      {/* Шапка витрины */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-lg bg-gradient-to-br from-[#ffd600] to-purple-600 flex items-center justify-center">
                <Store className="h-6 w-6 text-white" />
              </div>
              <div>
                <CardTitle>Витрина автомобилей</CardTitle>
                <p className="text-muted-foreground">
                  Наш ассортимент премиальных автомобилей из Кореи
                </p>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
              <div className="flex items-center gap-2 text-gray-600 mb-1">
                <Store className="h-4 w-4" />
                <span>Всего в продаже</span>
              </div>
              <p className="text-2xl font-semibold text-gray-900">
                {stats.total}
              </p>
            </div>
            <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
              <div className="flex items-center gap-2 text-gray-600 mb-1">
                <DollarSign className="h-4 w-4" />
                <span>Средняя цена</span>
              </div>
              <p className="text-2xl font-semibold text-gray-900">
                ${stats.avgPrice.toLocaleString()}
              </p>
            </div>
            <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
              <div className="flex items-center gap-2 text-gray-600 mb-1">
                <Calendar className="h-4 w-4" />
                <span>Средний год</span>
              </div>
              <p className="text-2xl font-semibold text-gray-900">
                {stats.avgYear}
              </p>
            </div>
            <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
              <div className="flex items-center gap-2 text-gray-600 mb-1">
                <Gauge className="h-4 w-4" />
                <span>Средний пробег</span>
              </div>
              <p className="text-2xl font-semibold text-gray-900">
                {stats.avgMileage.toLocaleString()} км
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Фильтры */}
      <Card>
        <CardContent className="pt-6">
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-4">
              <SlidersHorizontal className="h-5 w-5 text-muted-foreground" />
              <h4>Фильтры и поиск</h4>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Поиск..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>

              <Select
                value={makeFilter}
                onValueChange={(value) => setMakeFilter(value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Марка" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Все марки</SelectItem>
                  {makes.map((make) => (
                    <SelectItem key={make} value={make}>
                      {make}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                value={priceRange}
                onValueChange={(value) => setPriceRange(value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Цена" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Любая цена</SelectItem>
                  <SelectItem value="under30k">До $30,000</SelectItem>
                  <SelectItem value="30-40k">$30,000 - $40,000</SelectItem>
                  <SelectItem value="40-50k">$40,000 - $50,000</SelectItem>
                  <SelectItem value="over50k">Более $50,000</SelectItem>
                </SelectContent>
              </Select>

              <Select
                value={sortBy}
                onValueChange={(value) => setSortBy(value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Сортировка" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="newest">Новые объявления</SelectItem>
                  <SelectItem value="price-low">
                    Цена: по возрастанию
                  </SelectItem>
                  <SelectItem value="price-high">Цена: по убыванию</SelectItem>
                  <SelectItem value="year-new">Год: новые</SelectItem>
                  <SelectItem value="year-old">Год: старые</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {(searchQuery || makeFilter !== "all" || priceRange !== "all") && (
              <div className="flex items-center gap-2">
                <span className="text-gray-600">
                  Найдено: {filteredCars.length}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSearchQuery("");
                    setMakeFilter("all");
                    setPriceRange("all");
                  }}
                >
                  Сбросить фильтры
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Сетка авто */}
      {filteredCars.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12">
            <Store className="h-16 w-16 mx-auto mb-4 text-gray-400 opacity-50" />
            <h3 className="mb-2 text-gray-900">Автомобили не найдены</h3>
            <p className="text-gray-600">
              Попробуйте изменить параметры фильтрации
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredCars.map((car) => (
            <ShopCarCard
              key={car.id}
              car={car}
              onViewDetails={onViewDetails}
              onOrder={onOrder}
              onSell={onSell}
              isManager={isManager}
            />
          ))}
        </div>
      )}

      {/* Марки */}
      {makes.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Доступные марки</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {makes.map((make) => {
                const count = showroomCars.filter(
                  (car) => car.make === make
                ).length;
                return (
                  <Badge
                    key={make}
                    variant="outline"
                    className="px-4 py-2 cursor-pointer hover:bg-primary hover:text-primary-foreground transition-colors"
                    onClick={() => setMakeFilter(make)}
                  >
                    {make} ({count})
                  </Badge>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
