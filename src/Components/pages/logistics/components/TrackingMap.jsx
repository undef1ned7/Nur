import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import {
  MapPin,
  Ship,
  Plane,
  TruckIcon,
  Building2,
  CheckCircle2,
  Clock,
} from "lucide-react";
import { Progress } from "./ui/progress";

const statusSteps = {
  pending: 0,
  in_transit: 50,
  arrived: 75,
  accepted: 100,
  for_sale: 100,
  sold: 100,
};

const getTransportIcon = (status) => {
  if (status === "pending") return Ship;
  if (status === "in_transit") return Ship;
  if (status === "arrived" || status === "accepted") return Building2;
  return Building2;
};

export function TrackingMap({ car }) {
  const progress = statusSteps[car.status];
  const TransportIcon = getTransportIcon(car.status);

  const milestones = [
    {
      id: "origin",
      label: car.origin,
      icon: MapPin,
      status: "completed",
      date: car.shippingDate,
      description: "Отправка автомобиля",
    },
    {
      id: "in_transit",
      label: "В пути",
      icon: Ship,
      status:
        car.status === "pending"
          ? "pending"
          : car.status === "in_transit"
          ? "active"
          : "completed",
      date: car.status !== "pending" ? car.shippingDate : undefined,
      description: "Морская перевозка",
    },
    {
      id: "arrived",
      label: "Прибытие",
      icon: TruckIcon,
      status:
        car.status === "arrived" ||
        car.status === "accepted" ||
        car.status === "for_sale" ||
        car.status === "sold"
          ? "active"
          : car.status === "in_transit"
          ? "pending"
          : "pending",
      date: car.actualArrival || car.estimatedArrival,
      description: car.actualArrival ? "Прибыл в порт" : "Ожидается",
    },
    {
      id: "destination",
      label: car.destination,
      icon: Building2,
      status:
        car.status === "accepted" ||
        car.status === "for_sale" ||
        car.status === "sold"
          ? "completed"
          : "pending",
      date: car.acceptedDate,
      description: car.acceptedDate ? "Принят в салоне" : "Ожидание приемки",
    },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MapPin className="h-5 w-5" />
          Отслеживание маршрута
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Route Visualization */}
        <div className="relative">
          {/* Background route line */}
          <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-muted" />

          {/* Progress line */}
          <div
            className="absolute left-6 top-0 w-0.5 bg-primary transition-all duration-500"
            style={{ height: `${progress}%` }}
          />

          {/* Milestones */}
          <div className="space-y-8 relative">
            {milestones.map((milestone) => {
              const Icon = milestone.icon;
              return (
                <div
                  key={milestone.id}
                  className="flex items-start gap-4 relative"
                >
                  {/* Icon */}
                  <div
                    className={`
                    relative z-10 flex items-center justify-center w-12 h-12 rounded-full border-2
                    ${
                      milestone.status === "completed"
                        ? "bg-primary border-primary text-primary-foreground"
                        : milestone.status === "active"
                        ? "bg-background border-primary text-primary animate-pulse"
                        : "bg-background border-muted text-muted-foreground"
                    }
                  `}
                  >
                    {milestone.status === "completed" ? (
                      <CheckCircle2 className="h-6 w-6" />
                    ) : (
                      <Icon className="h-6 w-6" />
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 pt-1">
                    <div className="flex items-start justify-between mb-1">
                      <div>
                        <h4 className="mb-1">{milestone.label}</h4>
                        <p className="text-muted-foreground">
                          {milestone.description}
                        </p>
                      </div>
                      {milestone.status === "active" && (
                        <Badge className="bg-blue-500">В процессе</Badge>
                      )}
                    </div>
                    {milestone.date && (
                      <div className="flex items-center gap-2 text-muted-foreground mt-2">
                        <Clock className="h-4 w-4" />
                        <span>
                          {new Date(milestone.date).toLocaleDateString(
                            "ru-RU",
                            {
                              day: "numeric",
                              month: "long",
                              year: "numeric",
                            }
                          )}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Progress Bar */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Прогресс доставки</span>
            <span>{progress}%</span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>

        {/* Estimated Time */}
        {car.status !== "accepted" &&
          car.status !== "for_sale" &&
          car.status !== "sold" && (
            <div className="p-4 bg-muted rounded-lg">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Clock className="h-4 w-4" />
                  <span>Ожидаемое прибытие:</span>
                </div>
                <span>
                  {new Date(car.estimatedArrival).toLocaleDateString("ru-RU", {
                    day: "numeric",
                    month: "long",
                  })}
                </span>
              </div>
            </div>
          )}

        {/* Current Location Indicator */}
        <div className="flex items-start gap-3 p-4 bg-primary/10 rounded-lg border border-primary/20">
          <TransportIcon className="h-5 w-5 text-primary mt-0.5" />
          <div>
            <p>Текущий статус</p>
            <p className="text-muted-foreground">
              {car.status === "pending" &&
                "Ожидает отправки из порта отправления"}
              {car.status === "in_transit" &&
                "Автомобиль в пути, морская перевозка"}
              {car.status === "arrived" &&
                "Прибыл в порт назначения, ожидает приемки"}
              {car.status === "accepted" &&
                "Принят в салоне, готов к продаже"}
              {car.status === "for_sale" && "Выставлен на продажу"}
              {car.status === "sold" && "Продан клиенту"}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
