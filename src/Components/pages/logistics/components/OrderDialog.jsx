import { useState } from "react";
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
import { Checkbox } from "./ui/checkbox";
import { Separator } from "./ui/separator";
import { ShoppingCart, DollarSign, Phone, Mail, User } from "lucide-react";
import { Badge } from "./ui/badge";

export function OrderDialog({
  car,
  open,
  onOpenChange,
  onPlaceOrder,
  availableServices,
}) {
  const [customerData, setCustomerData] = useState({
    name: "",
    email: "",
    phone: "",
  });
  const [selectedServices, setSelectedServices] = useState([]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (car) {
      const servicesTotal = selectedServices.reduce((sum, id) => {
        const service = availableServices.find((s) => s.id === id);
        return sum + (service?.price || 0);
      }, 0);

      onPlaceOrder({
        carId: car.id,
        customerName: customerData.name,
        customerEmail: customerData.email,
        customerPhone: customerData.phone,
        selectedServices,
        totalPrice: (car.salePrice || 0) + servicesTotal,
      });

      setCustomerData({ name: "", email: "", phone: "" });
      setSelectedServices([]);
      onOpenChange(false);
    }
  };

  const toggleService = (serviceId) => {
    setSelectedServices((prev) =>
      prev.includes(serviceId)
        ? prev.filter((id) => id !== serviceId)
        : [...prev, serviceId]
    );
  };

  if (!car) return null;

  const includedServicesList = car.includedServices || [];
  const additionalServices = availableServices.filter(
    (s) => !includedServicesList.includes(s.id)
  );

  const servicesTotal = selectedServices.reduce((sum, id) => {
    const service = availableServices.find((s) => s.id === id);
    return sum + (service?.price || 0);
  }, 0);

  const totalPrice = (car.salePrice || 0) + servicesTotal;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5" />
            Оформление заказа
          </DialogTitle>
          <DialogDescription>
            Заполните контактные данные для оформления покупки автомобиля
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Car Info */}
          <div className="p-4 bg-muted rounded-lg">
            <div className="flex items-start justify-between">
              <div>
                <h3>
                  {car.make} {car.model} ({car.year})
                </h3>
                <p className="text-muted-foreground">VIN: {car.vin}</p>
              </div>
              <div className="text-right">
                <p className="text-muted-foreground">Цена автомобиля</p>
                <div className="flex items-center gap-1 text-primary">
                  <DollarSign className="h-5 w-5" />
                  <span className="text-xl">
                    {car.salePrice?.toLocaleString()}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <Separator />

          {/* Customer Info */}
          <div className="space-y-4">
            <h4 className="flex items-center gap-2">
              <User className="h-4 w-4" />
              Контактная информация
            </h4>

            <div className="space-y-2">
              <Label htmlFor="customer-name">Имя и фамилия</Label>
              <Input
                id="customer-name"
                value={customerData.name}
                onChange={(e) =>
                  setCustomerData({ ...customerData, name: e.target.value })
                }
                placeholder="Иван Петров"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="customer-email">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="customer-email"
                    type="email"
                    value={customerData.email}
                    onChange={(e) =>
                      setCustomerData({
                        ...customerData,
                        email: e.target.value,
                      })
                    }
                    placeholder="ivan@example.com"
                    className="pl-10"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="customer-phone">Телефон</Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="customer-phone"
                    type="tel"
                    value={customerData.phone}
                    onChange={(e) =>
                      setCustomerData({
                        ...customerData,
                        phone: e.target.value,
                      })
                    }
                    placeholder="+7 (999) 123-45-67"
                    className="pl-10"
                    required
                  />
                </div>
              </div>
            </div>
          </div>

          <Separator />

          {/* Included Services */}
          {includedServicesList.length > 0 && (
            <div className="space-y-3">
              <h4>Включенные услуги</h4>
              <div className="space-y-2">
                {includedServicesList.map((serviceId) => {
                  const service = availableServices.find(
                    (s) => s.id === serviceId
                  );
                  if (!service) return null;
                  return (
                    <div
                      key={service.id}
                      className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-lg"
                    >
                      <div>
                        <p>{service.name}</p>
                        <p className="text-muted-foreground">
                          {service.description}
                        </p>
                      </div>
                      <Badge className="bg-green-500 text-white">
                        Включено
                      </Badge>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Additional Services */}
          {additionalServices.length > 0 && (
            <div className="space-y-3">
              <h4>Дополнительные услуги</h4>
              <div className="space-y-2">
                {additionalServices.map((service) => (
                  <div
                    key={service.id}
                    className="flex items-start space-x-3 p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <Checkbox
                      id={`service-${service.id}`}
                      checked={selectedServices.includes(service.id)}
                      onCheckedChange={() => toggleService(service.id)}
                    />
                    <div className="flex-1">
                      <label
                        htmlFor={`service-${service.id}`}
                        className="cursor-pointer"
                      >
                        <p>{service.name}</p>
                        <p className="text-muted-foreground">
                          {service.description}
                        </p>
                      </label>
                    </div>
                    <div className="flex items-center gap-1 text-primary">
                      <DollarSign className="h-4 w-4" />
                      <span>{service.price.toLocaleString()}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <Separator />

          {/* Total */}
          <div className="p-4 bg-primary/10 rounded-lg space-y-2">
            <div className="flex items-center justify-between text-muted-foreground">
              <span>Автомобиль:</span>
              <span>${car.salePrice?.toLocaleString()}</span>
            </div>
            {servicesTotal > 0 && (
              <div className="flex items-center justify-between text-muted-foreground">
                <span>Дополнительные услуги:</span>
                <span>${servicesTotal.toLocaleString()}</span>
              </div>
            )}
            <Separator />
            <div className="flex items-center justify-between">
              <span>Итого к оплате:</span>
              <div className="flex items-center gap-1 text-primary">
                <DollarSign className="h-6 w-6" />
                <span className="text-2xl">
                  {totalPrice.toLocaleString()}
                </span>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Отмена
            </Button>
            <Button type="submit">Оформить заказ</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
