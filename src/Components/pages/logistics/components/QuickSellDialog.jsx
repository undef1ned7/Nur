import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "./ui/dialog";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Textarea } from "./ui/textarea";
import { DollarSign } from "lucide-react";
import { toast } from "sonner";

export function QuickSellDialog({ car, open, onOpenChange, onSell }) {
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [salePrice, setSalePrice] = useState("");
  const [notes, setNotes] = useState("");

  const resetForm = () => {
    setCustomerName("");
    setCustomerPhone("");
    setCustomerEmail("");
    setSalePrice("");
    setNotes("");
  };

  // Инициализация и сброс формы при открытии/закрытии
  useEffect(() => {
    if (open && car) {
      // Подставляем цену по умолчанию при открытии
      setSalePrice(car.salePrice?.toString() || car.price?.toString() || "");
    } else if (!open) {
      // Сброс при закрытии
      resetForm();
    }
  }, [open, car]);

  const handleSubmit = () => {
    if (!car) return;

    if (!customerName || !customerPhone || !salePrice) {
      toast.error("Заполните все обязательные поля");
      return;
    }

    const price = parseFloat(salePrice);
    if (isNaN(price) || price <= 0) {
      toast.error("Введите корректную цену");
      return;
    }

    onSell(car.id, {
      soldTo: customerName,
      soldPrice: price,
      customerPhone,
      customerEmail,
      notes,
    });

    resetForm();
    onOpenChange(false);
  };

  if (!car) return null;

  const profit =
    salePrice && car.price
      ? parseFloat(salePrice || "0") - (car.price || 0)
      : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Продать автомобиль
          </DialogTitle>
          <DialogDescription>
            Заполните информацию о покупателе и цене продажи
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Информация об авто */}
          <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
            <h4 className="text-gray-900 font-semibold">
              {car.make} {car.model} ({car.year})
            </h4>
            <p className="text-sm text-gray-600">VIN: {car.vin}</p>
            <div className="mt-2 flex items-center justify-between text-sm">
              <span className="text-gray-600">Цена закупки:</span>
              <span className="text-[#ffd600] font-semibold">
                ${car.price?.toLocaleString()}
              </span>
            </div>
            {car.salePrice && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Цена на витрине:</span>
                <span className="text-gray-900 font-medium">
                  ${car.salePrice.toLocaleString()}
                </span>
              </div>
            )}
          </div>

          {/* Информация о покупателе */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="customerName">
                Имя покупателя <span className="text-red-500">*</span>
              </Label>
              <Input
                id="customerName"
                placeholder="Иван Иванов"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="customerPhone">
                Телефон <span className="text-red-500">*</span>
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
              <Label htmlFor="customerEmail">Email</Label>
              <Input
                id="customerEmail"
                type="email"
                placeholder="customer@example.com"
                value={customerEmail}
                onChange={(e) => setCustomerEmail(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="salePrice">
                Цена продажи ($) <span className="text-red-500">*</span>
              </Label>
              <Input
                id="salePrice"
                type="number"
                placeholder="45000"
                value={salePrice}
                onChange={(e) => setSalePrice(e.target.value)}
              />
              {profit !== 0 && salePrice && (
                <p
                  className={`text-sm ${
                    profit > 0 ? "text-green-600" : "text-red-600"
                  }`}
                >
                  {profit > 0 ? "Прибыль" : "Убыток"}: $
                  {Math.abs(profit).toLocaleString()}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Примечания</Label>
              <Textarea
                id="notes"
                placeholder="Дополнительная информация о продаже..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Отмена
          </Button>
          <Button
            onClick={handleSubmit}
            className="bg-green-600 hover:bg-green-700"
          >
            Подтвердить продажу
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
