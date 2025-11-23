import { useState } from "react";
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

  const handleOpenChange = (newOpen) => {
    if (newOpen && car) {
      // Подставляем цену по умолчанию
      setSalePrice(
        car.salePrice?.toString() || car.price?.toString() || ""
      );
    } else if (!newOpen) {
      // Сброс при закрытии
      resetForm();
    }
    onOpenChange(newOpen);
  };

  if (!car) return null;

  const profit =
    salePrice && car.price
      ? parseFloat(salePrice || "0") - (car.price || 0)
      : 0;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
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
          <div className="p-4 bg-muted rounded-lg">
            <h4>
              {car.make} {car.model} ({car.year})
            </h4>
            <p className="text-sm text-muted-foreground">VIN: {car.vin}</p>
            <div className="mt-2 flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Цена закупки:</span>
              <span className="text-primary">
                ${car.price?.toLocaleString()}
              </span>
            </div>
            {car.salePrice && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  Цена на витрине:
                </span>
                <span>${car.salePrice.toLocaleString()}</span>
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
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
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
