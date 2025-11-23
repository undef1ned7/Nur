import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "./ui/dialog";
import { Textarea } from "./ui/textarea";
import {
  Search,
  DollarSign,
  Calendar,
  User,
  CheckCircle2,
  Package,
} from "lucide-react";
import { toast } from "sonner";

export function SalesView({ cars, onSellCar, onViewDetails }) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCar, setSelectedCar] = useState(null);
  const [saleDialogOpen, setSaleDialogOpen] = useState(false);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [salePrice, setSalePrice] = useState("");
  const [saleNotes, setSaleNotes] = useState("");

  // Автомобили доступные для продажи (на складе и выставленные на продажу)
  const availableForSale = cars.filter(
    (car) =>
      car.status === "accepted" ||
      car.status === "for_sale" ||
      car.status === "arrived"
  );

  // Проданные автомобили
  const soldCars = cars.filter((car) => car.status === "sold");

  // Фильтрация
  const filteredAvailable = availableForSale.filter(
    (car) =>
      car.make.toLowerCase().includes(searchQuery.toLowerCase()) ||
      car.model.toLowerCase().includes(searchQuery.toLowerCase()) ||
      car.vin.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredSold = soldCars.filter(
    (car) =>
      car.make.toLowerCase().includes(searchQuery.toLowerCase()) ||
      car.model.toLowerCase().includes(searchQuery.toLowerCase()) ||
      car.vin.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (car.soldTo &&
        car.soldTo.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const handleOpenSaleDialog = (car) => {
    setSelectedCar(car);
    setSalePrice(
      car.salePrice?.toString() || car.price?.toString() || ""
    );
    setCustomerName("");
    setCustomerPhone("");
    setCustomerEmail("");
    setSaleNotes("");
    setSaleDialogOpen(true);
  };

  const handleSellCar = () => {
    if (!selectedCar) return;

    if (!customerName || !customerPhone || !salePrice) {
      toast.error("Заполните все обязательные поля");
      return;
    }

    const price = parseFloat(salePrice);
    if (isNaN(price) || price <= 0) {
      toast.error("Введите корректную цену");
      return;
    }

    onSellCar(selectedCar.id, {
      soldTo: customerName,
      soldPrice: price,
      customerPhone,
      customerEmail,
      notes: saleNotes,
    });

    setSaleDialogOpen(false);
    setSelectedCar(null);
  };

  // Статистика продаж
  const totalSales = soldCars.reduce(
    (sum, car) => sum + (car.salePrice || car.price || 0),
    0
  );
  const avgSalePrice =
    soldCars.length > 0 ? totalSales / soldCars.length : 0;

  return (
    <div className="space-y-6">
      {/* Статистика */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle>Доступно для продажи</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl">{availableForSale.length}</div>
            <p className="text-xs text-muted-foreground">
              автомобилей на складе
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle>Продано</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl">{soldCars.length}</div>
            <p className="text-xs text-muted-foreground">
              автомобилей всего
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle>Общая сумма продаж</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl">
              ${totalSales.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">выручка</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle>Средняя цена</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl">
              ${Math.round(avgSalePrice).toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">
              за автомобиль
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Поиск */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Поиск по марке, модели, VIN или покупателю..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Доступные для продажи */}
      <div className="space-y-4">
        <h2>Доступно для продажи ({filteredAvailable.length})</h2>

        {filteredAvailable.length === 0 ? (
          <Card>
            <CardContent className="text-center py-12">
              <Package className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
              <p className="text-muted-foreground">
                Нет автомобилей доступных для продажи
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {filteredAvailable.map((car) => (
              <Card key={car.id} className="overflow-hidden">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-3">
                        <h3>
                          {car.make} {car.model}
                        </h3>
                        <Badge
                          variant={
                            car.status === "for_sale"
                              ? "default"
                              : "secondary"
                          }
                        >
                          {car.status === "for_sale"
                            ? "На витрине"
                            : car.status === "accepted"
                            ? "Принят"
                            : "Прибыл"}
                        </Badge>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <p className="text-muted-foreground">Год</p>
                          <p>{car.year}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">VIN</p>
                          <p className="truncate">{car.vin}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Цвет</p>
                          <p>{car.color || "Не указан"}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">
                            Цена закупки
                          </p>
                          <p className="text-primary">
                            ${car.price?.toLocaleString()}
                          </p>
                        </div>
                      </div>

                      {car.status === "for_sale" && car.salePrice && (
                        <div className="mt-3 p-3 bg-primary/5 rounded-lg">
                          <p className="text-muted-foreground">
                            Цена продажи на витрине
                          </p>
                          <p className="text-lg text-primary">
                            ${car.salePrice.toLocaleString()}
                          </p>
                        </div>
                      )}
                    </div>

                    <div className="flex flex-col gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onViewDetails(car)}
                      >
                        Детали
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => handleOpenSaleDialog(car)}
                      >
                        Продать
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Проданные автомобили */}
      <div className="space-y-4">
        <h2>Проданные автомобили ({filteredSold.length})</h2>

        {filteredSold.length === 0 ? (
          <Card>
            <CardContent className="text-center py-12">
              <CheckCircle2 className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
              <p className="text-muted-foreground">
                Пока нет проданных автомобилей
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {filteredSold.map((car) => (
              <Card
                key={car.id}
                className="overflow-hidden border-primary/20"
              >
                <CardContent className="p-6">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-3">
                        <h3>
                          {car.make} {car.model}
                        </h3>
                        <Badge variant="default">
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                          Продан
                        </Badge>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                        <div>
                          <p className="text-muted-foreground">
                            Покупатель
                          </p>
                          <p className="flex items-center gap-1">
                            <User className="h-3 w-3" />
                            {car.soldTo || "Не указан"}
                          </p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">
                            Дата продажи
                          </p>
                          <p className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {car.soldDate
                              ? new Date(
                                  car.soldDate
                                ).toLocaleDateString("ru-RU")
                              : "-"}
                          </p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">
                            Цена продажи
                          </p>
                          <p className="flex items-center gap-1 text-primary">
                            <DollarSign className="h-3 w-3" />
                            $
                            {(
                              car.salePrice ||
                              car.price ||
                              0
                            ).toLocaleString()}
                          </p>
                        </div>
                      </div>

                      <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm bg-muted/30 p-3 rounded-lg">
                        <div>
                          <p className="text-muted-foreground">Год</p>
                          <p>{car.year}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">VIN</p>
                          <p className="truncate">{car.vin}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">
                            Цена закупки
                          </p>
                          <p>${car.price?.toLocaleString()}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Прибыль</p>
                          <p className="text-green-600">
                            $
                            {(
                              (car.salePrice || car.price || 0) -
                              (car.price || 0)
                            ).toLocaleString()}
                          </p>
                        </div>
                      </div>
                    </div>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onViewDetails(car)}
                    >
                      Детали
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Диалог продажи */}
      <Dialog open={saleDialogOpen} onOpenChange={setSaleDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Продать автомобиль</DialogTitle>
            <DialogDescription>
              Введите данные покупателя для завершения продажи
            </DialogDescription>
          </DialogHeader>

          {selectedCar && (
            <div className="space-y-4">
              <div className="p-4 bg-muted rounded-lg">
                <h4>
                  {selectedCar.make} {selectedCar.model} (
                  {selectedCar.year})
                </h4>
                <p className="text-sm text-muted-foreground">
                  VIN: {selectedCar.vin}
                </p>
                {selectedCar.price && (
                  <p className="text-sm text-muted-foreground">
                    Цена закупки: $
                    {selectedCar.price.toLocaleString()}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="customerName">Имя покупателя *</Label>
                <Input
                  id="customerName"
                  placeholder="Иван Иванов"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="customerPhone">
                  Телефон покупателя *
                </Label>
                <Input
                  id="customerPhone"
                  type="tel"
                  placeholder="+7 999 123-45-67"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="customerEmail">Email покупателя</Label>
                <Input
                  id="customerEmail"
                  type="email"
                  placeholder="customer@example.com"
                  value={customerEmail}
                  onChange={(e) => setCustomerEmail(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="salePrice">Цена продажи ($) *</Label>
                <Input
                  id="salePrice"
                  type="number"
                  placeholder="45000"
                  value={salePrice}
                  onChange={(e) => setSalePrice(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="saleNotes">Примечания</Label>
                <Textarea
                  id="saleNotes"
                  placeholder="Дополнительная информация о продаже..."
                  value={saleNotes}
                  onChange={(e) => setSaleNotes(e.target.value)}
                  rows={3}
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setSaleDialogOpen(false)}
            >
              Отмена
            </Button>
            <Button onClick={handleSellCar}>Подтвердить продажу</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
