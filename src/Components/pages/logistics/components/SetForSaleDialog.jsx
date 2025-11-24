import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Textarea } from "./ui/textarea";
import { Checkbox } from "./ui/checkbox";
import { DollarSign, Tag } from "lucide-react";

export function SetForSaleDialog({
  car,
  open,
  onOpenChange,
  onSetForSale,
  availableServices,
}) {
  const [saleData, setSaleData] = useState({
    salePrice: 0,
    mileage: 0,
    fuelType: "Бензин",
    transmission: "Автомат",
    color: "",
    features: "",
    includedServices: [],
  });

  // Инициализация и сброс формы при открытии/закрытии
  useEffect(() => {
    if (open && car) {
      // Инициализируем данные из существующего автомобиля, если они есть
      setSaleData({
        salePrice: car.salePrice || car.price || 0,
        mileage: car.mileage || 0,
        fuelType: car.fuelType || "Бензин",
        transmission: car.transmission || "Автомат",
        color: car.color || "",
        features: car.features ? car.features.join(", ") : "",
        includedServices: car.includedServices || [],
      });
    } else if (!open) {
      // Сброс при закрытии
      setSaleData({
        salePrice: 0,
        mileage: 0,
        fuelType: "Бензин",
        transmission: "Автомат",
        color: "",
        features: "",
        includedServices: [],
      });
    }
  }, [open, car]);

  const handleSubmit = () => {
    if (car) {
      onSetForSale(car.id, {
        ...saleData,
        originalPrice: car.price,
        features: saleData.features
          .split(",")
          .map((f) => f.trim())
          .filter(Boolean),
        listedDate: new Date().toISOString(),
        status: "for_sale",
      });
      onOpenChange(false);
    }
  };

  const toggleService = (serviceId) => {
    setSaleData((prev) => ({
      ...prev,
      includedServices: prev.includedServices.includes(serviceId)
        ? prev.includedServices.filter((id) => id !== serviceId)
        : [...prev.includedServices, serviceId],
    }));
  };

  if (!car) return null;

  const totalWithServices =
    (saleData.salePrice || 0) +
    saleData.includedServices.reduce((sum, id) => {
      const service = availableServices.find((s) => s.id === id);
      return sum + (service?.price || 0);
    }, 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Tag className="h-5 w-5" />
            Выставить на продажу: {car.make} {car.model}
          </DialogTitle>
          <DialogDescription>
            Укажите цену, характеристики и дополнительные услуги для продажи
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
            <p className="text-gray-600">
              Исходная стоимость:{" "}
              <span className="text-gray-900 font-semibold">
                ${car.price?.toLocaleString()}
              </span>
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="salePrice">Цена продажи ($)</Label>
              <Input
                id="salePrice"
                type="number"
                value={saleData.salePrice || ""}
                onChange={(e) =>
                  setSaleData((prev) => ({
                    ...prev,
                    salePrice: parseFloat(e.target.value) || 0,
                  }))
                }
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="mileage">Пробег (км)</Label>
              <Input
                id="mileage"
                type="number"
                value={saleData.mileage || ""}
                onChange={(e) =>
                  setSaleData((prev) => ({
                    ...prev,
                    mileage: parseInt(e.target.value, 10) || 0,
                  }))
                }
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="fuelType">Тип топлива</Label>
              <Input
                id="fuelType"
                value={saleData.fuelType}
                onChange={(e) =>
                  setSaleData((prev) => ({
                    ...prev,
                    fuelType: e.target.value,
                  }))
                }
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="transmission">Коробка передач</Label>
              <Input
                id="transmission"
                value={saleData.transmission}
                onChange={(e) =>
                  setSaleData((prev) => ({
                    ...prev,
                    transmission: e.target.value,
                  }))
                }
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="color">Цвет</Label>
            <Input
              id="color"
              value={saleData.color}
              onChange={(e) =>
                setSaleData((prev) => ({
                  ...prev,
                  color: e.target.value,
                }))
              }
              placeholder="Например: Черный металлик"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="features">Особенности и комплектация</Label>
            <Textarea
              id="features"
              value={saleData.features}
              onChange={(e) =>
                setSaleData((prev) => ({
                  ...prev,
                  features: e.target.value,
                }))
              }
              placeholder="Введите через запятую: Панорамная крыша, Кожаный салон, Камера 360°..."
              rows={3}
            />
          </div>

          <div className="space-y-3">
            <Label>Включенные услуги</Label>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {availableServices.map((service) => (
                <div
                  key={service.id}
                  className="flex items-start space-x-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <Checkbox
                    id={service.id}
                    checked={saleData.includedServices.includes(service.id)}
                    onCheckedChange={() => toggleService(service.id)}
                  />
                  <div className="flex-1">
                    <label htmlFor={service.id} className="cursor-pointer">
                      <p className="text-gray-900 font-medium">
                        {service.name}
                      </p>
                      <p className="text-gray-600 text-sm">
                        {service.description}
                      </p>
                    </label>
                  </div>
                  <div className="flex items-center gap-1 text-[#ffd600] font-semibold">
                    <DollarSign className="h-4 w-4" />
                    <span>${service.price.toLocaleString()}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="p-4 bg-[#ffd600]/10 rounded-lg border border-[#ffd600]/20">
            <div className="flex items-center justify-between">
              <span className="text-gray-700 font-medium">
                Итоговая цена с услугами:
              </span>
              <span className="flex items-center gap-1 text-[#ffd600] font-semibold text-lg">
                <DollarSign className="h-5 w-5" />
                <span>${totalWithServices.toLocaleString()}</span>
              </span>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Отмена
            </Button>
            <Button onClick={handleSubmit}>Выставить на продажу</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
