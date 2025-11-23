import { Card, CardContent, CardFooter, CardHeader } from "./ui/card";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Calendar, Gauge, Fuel, Settings, Palette, Star, DollarSign } from "lucide-react";
import { ImageWithFallback } from "./figma/ImageWithFallback";

export function ShopCarCard({ car, onViewDetails, onOrder, onSell, isManager }) {
  const totalPrice = car.salePrice || 0;
  const discount =
    car.originalPrice && car.salePrice
      ? Math.round(((car.originalPrice - car.salePrice) / car.originalPrice) * 100)
      : 0;

  return (
    <Card className="overflow-hidden hover:shadow-xl transition-all">
      <div className="aspect-video bg-muted relative">
        {car.photos && car.photos.length > 0 ? (
          <img
            src={car.photos[0]}
            alt={`${car.make} ${car.model}`}
            className="w-full h-full object-cover"
          />
        ) : (
          <ImageWithFallback
            src="https://images.unsplash.com/photo-1705747401901-28363172fe7e?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxsdXh1cnklMjBjYXIlMjBzaG93cm9vbXxlbnwxfHx8fDE3NjI1NDMzMzN8MA&ixlib=rb-4.1.0&q=80&w=1080"
            alt={`${car.make} ${car.model}`}
            className="w-full h-full object-cover"
          />
        )}

        {discount > 0 && (
          <div className="absolute top-2 left-2">
            <Badge className="bg-red-500 text-white">-{discount}%</Badge>
          </div>
        )}

        {car.includedServices && car.includedServices.length > 0 && (
          <div className="absolute top-2 right-2">
            <Badge className="bg-green-500 text-white flex items-center gap-1">
              <Star className="h-3 w-3" />
              Услуги включены
            </Badge>
          </div>
        )}
      </div>

      <CardHeader>
        <div>
          <h3 className="mb-1">
            {car.make} {car.model}
          </h3>
          <p className="text-muted-foreground">{car.year} год</p>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          {car.mileage !== undefined && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Gauge className="h-4 w-4" />
              <span>{car.mileage.toLocaleString()} км</span>
            </div>
          )}

          {car.fuelType && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Fuel className="h-4 w-4" />
              <span>{car.fuelType}</span>
            </div>
          )}

          {car.transmission && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Settings className="h-4 w-4" />
              <span>{car.transmission}</span>
            </div>
          )}

          {car.color && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Palette className="h-4 w-4" />
              <span>{car.color}</span>
            </div>
          )}
        </div>

        {car.features && car.features.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {car.features.slice(0, 3).map((feature, index) => (
              <Badge key={index} variant="outline" className="text-xs">
                {feature}
              </Badge>
            ))}
            {car.features.length > 3 && (
              <Badge variant="outline" className="text-xs">
                +{car.features.length - 3}
              </Badge>
            )}
          </div>
        )}

        <div className="pt-2 border-t">
          <div className="flex items-baseline justify-between">
            <div>
              {car.originalPrice && car.originalPrice > (car.salePrice || 0) && (
                <p className="text-muted-foreground line-through">
                  ${car.originalPrice.toLocaleString()}
                </p>
              )}
              <div className="flex items-center gap-1 text-primary">
                <DollarSign className="h-5 w-5" />
                <span className="text-2xl">{totalPrice.toLocaleString()}</span>
              </div>
            </div>
          </div>
        </div>
      </CardContent>

      <CardFooter className="gap-2">
        <Button variant="outline" className="flex-1" onClick={() => onViewDetails(car)}>
          Подробнее
        </Button>
        {isManager && onSell ? (
          <Button
            className="flex-1 bg-green-600 hover:bg-green-700"
            onClick={() => onSell(car)}
          >
            Продать
          </Button>
        ) : onOrder ? (
          <Button className="flex-1" onClick={() => onOrder(car)}>
            Заказать
          </Button>
        ) : null}
      </CardFooter>
    </Card>
  );
}
