import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { Badge } from "./ui/badge";
import {
  Calendar,
  MapPin,
  User,
  DollarSign,
  FileText,
  Package,
} from "lucide-react";
import { Separator } from "./ui/separator";
import { TrackingMap } from "./TrackingMap";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
// если ImageWithFallback не нужен – можешь удалить импорт
// import { ImageWithFallback } from "./figma/ImageWithFallback";

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

export function CarDetailsDialog({ car, open, onOpenChange }) {
  if (!car) return null;

  const showTracking = car.status !== "for_sale" && car.status !== "sold";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-start justify-between">
            <DialogTitle>
              {car.make} {car.model} ({car.year})
            </DialogTitle>
            <Badge className={statusColors[car.status]}>
              {statusLabels[car.status]}
            </Badge>
          </div>
          <DialogDescription>
            Полная информация об автомобиле и статусе доставки
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="details" className="space-y-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="details">Информация</TabsTrigger>
            {showTracking && (
              <TabsTrigger value="tracking">Отслеживание</TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="details" className="space-y-6">
            {car.photos && car.photos.length > 0 && (
              <div className="space-y-2">
                <h4>Фотографии</h4>
                <div className="grid grid-cols-2 gap-2">
                  {car.photos.map((photo, index) => (
                    <img
                      key={index}
                      src={photo}
                      alt={`${car.make} ${car.model} - фото ${index + 1}`}
                      className="w-full h-48 object-cover rounded-lg"
                    />
                  ))}
                </div>
              </div>
            )}

            <Separator />

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-3">
                <h4>Информация об автомобиле</h4>

                <div className="flex items-center gap-2 text-muted-foreground">
                  <Package className="h-4 w-4" />
                  <div>
                    <p className="text-foreground">VIN номер</p>
                    <p>{car.vin}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-muted-foreground">
                  <Calendar className="h-4 w-4" />
                  <div>
                    <p className="text-foreground">Год выпуска</p>
                    <p>{car.year}</p>
                  </div>
                </div>

                {car.price && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <DollarSign className="h-4 w-4" />
                    <div>
                      <p className="text-foreground">Стоимость</p>
                      <p>${car.price.toLocaleString()}</p>
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-3">
                <h4>Логистика</h4>

                <div className="flex items-center gap-2 text-muted-foreground">
                  <MapPin className="h-4 w-4" />
                  <div>
                    <p className="text-foreground">Маршрут</p>
                    <p>
                      {car.origin} → {car.destination}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-muted-foreground">
                  <Calendar className="h-4 w-4" />
                  <div>
                    <p className="text-foreground">Дата отправки</p>
                    <p>
                      {new Date(car.shippingDate).toLocaleDateString("ru-RU")}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-muted-foreground">
                  <Calendar className="h-4 w-4" />
                  <div>
                    <p className="text-foreground">Ожидаемое прибытие</p>
                    <p>
                      {new Date(
                        car.estimatedArrival
                      ).toLocaleDateString("ru-RU")}
                    </p>
                  </div>
                </div>

                {car.actualArrival && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Calendar className="h-4 w-4" />
                    <div>
                      <p className="text-foreground">Фактическое прибытие</p>
                      <p>
                        {new Date(
                          car.actualArrival
                        ).toLocaleDateString("ru-RU")}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <Separator />

            <div className="space-y-3">
              <h4>Дополнительная информация</h4>

              <div className="flex items-center gap-2 text-muted-foreground">
                <User className="h-4 w-4" />
                <div>
                  <p className="text-foreground">Агент</p>
                  <p>{car.agentName}</p>
                </div>
              </div>

              {car.acceptedBy && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <User className="h-4 w-4" />
                  <div>
                    <p className="text-foreground">Принял</p>
                    <p>
                      {car.acceptedBy}{" "}
                      {car.acceptedDate && (
                        <>
                          (
                          {new Date(
                            car.acceptedDate
                          ).toLocaleDateString("ru-RU")}
                          )
                        </>
                      )}
                    </p>
                  </div>
                </div>
              )}

              {car.notes && (
                <div className="flex items-start gap-2 text-muted-foreground">
                  <FileText className="h-4 w-4 mt-0.5" />
                  <div>
                    <p className="text-foreground">Примечания</p>
                    <p>{car.notes}</p>
                  </div>
                </div>
              )}
            </div>
          </TabsContent>

          {showTracking && (
            <TabsContent value="tracking">
              <TrackingMap car={car} />
            </TabsContent>
          )}
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
