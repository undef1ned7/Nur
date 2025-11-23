import { Card, CardContent, CardFooter, CardHeader } from "./ui/card";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Calendar, MapPin, User, DollarSign, FileText } from "lucide-react";
import { ImageWithFallback } from "./figma/ImageWithFallback";

const statusColors = {
  pending: "bg-yellow-100 text-yellow-800 border-yellow-200",
  in_transit: "bg-blue-100 text-blue-800 border-blue-200",
  arrived: "bg-purple-100 text-purple-800 border-purple-200",
  accepted: "bg-green-100 text-green-800 border-green-200",
  for_sale: "bg-cyan-100 text-cyan-800 border-cyan-200",
  sold: "bg-gray-100 text-gray-800 border-gray-200",
};

const statusLabels = {
  pending: "Ожидание отправки",
  in_transit: "В пути",
  arrived: "Прибыл",
  accepted: "Принят",
  for_sale: "В продаже",
  sold: "Продан",
};

export function CarCard({
  car,
  userRole,
  onViewDetails,
  onAccept,
  onUpdateStatus,
  onSetForSale,
}) {
  return (
    <Card className="overflow-hidden hover:shadow-lg transition-shadow">
      <div className="aspect-video bg-muted relative">
        {car.photos && car.photos.length > 0 ? (
          <img
            src={car.photos[0]}
            alt={`${car.make} ${car.model}`}
            className="w-full h-full object-cover"
          />
        ) : (
          <ImageWithFallback
            src="https://images.unsplash.com/photo-1744751578602-d5799c4a3686?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxsdXh1cnklMjBjYXIlMjB0cmFuc3BvcnR8ZW58MXx8fHwxNzYyNTI1MDA2fDA&ixlib=rb-4.1.0&q=80&w=1080"
            alt={`${car.make} ${car.model}`}
            className="w-full h-full object-cover"
          />
        )}
        <div className="absolute top-2 right-2">
          <Badge className={statusColors[car.status]}>
            {statusLabels[car.status]}
          </Badge>
        </div>
      </div>

      <CardHeader>
        <div className="flex justify-between items-start">
          <div>
            <h3 className="mb-1">
              {car.make} {car.model}
            </h3>
            <p className="text-muted-foreground">
              {car.year} • VIN: {car.vin}
            </p>
          </div>
          {car.price && (
            <div className="flex items-center gap-1 text-primary">
              <DollarSign className="h-4 w-4" />
              <span>{car.price.toLocaleString()}</span>
            </div>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        <div className="flex items-center gap-2 text-muted-foreground">
          <MapPin className="h-4 w-4" />
          <span>
            {car.origin} → {car.destination}
          </span>
        </div>

        <div className="flex items-center gap-2 text-muted-foreground">
          <Calendar className="h-4 w-4" />
          <span>
            Прибытие:{" "}
            {new Date(car.estimatedArrival).toLocaleDateString("ru-RU")}
          </span>
        </div>

        <div className="flex items-center gap-2 text-muted-foreground">
          <User className="h-4 w-4" />
          <span>Агент: {car.agentName}</span>
        </div>

        {car.notes && (
          <div className="flex items-start gap-2 text-muted-foreground">
            <FileText className="h-4 w-4 mt-0.5" />
            <span className="line-clamp-2">{car.notes}</span>
          </div>
        )}
      </CardContent>

      <CardFooter className="gap-2">
        <Button
          variant="outline"
          className="flex-1"
          onClick={() => onViewDetails(car)}
        >
          Подробнее
        </Button>

        {userRole === "agent" &&
          car.status === "pending" &&
          onUpdateStatus && (
            <Button
              className="flex-1"
              onClick={() => onUpdateStatus(car.id, "in_transit")}
            >
              Отправить
            </Button>
          )}

        {userRole === "manager" &&
          car.status === "arrived" &&
          onAccept && (
            <Button className="flex-1" onClick={() => onAccept(car)}>
              Принять
            </Button>
          )}

        {userRole === "manager" &&
          car.status === "accepted" &&
          onSetForSale && (
            <Button className="flex-1" onClick={() => onSetForSale(car)}>
              Продать
            </Button>
          )}
      </CardFooter>
    </Card>
  );
}
