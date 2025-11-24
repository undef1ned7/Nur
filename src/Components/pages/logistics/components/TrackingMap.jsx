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
          <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-gray-200" />

          {/* Progress line */}
          <div
            className="absolute left-6 top-0 w-0.5 bg-[#ffd600] transition-all duration-500"
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
                        ? "bg-[#ffd600] border-[#ffd600] text-gray-900"
                        : milestone.status === "active"
                        ? "bg-white border-[#ffd600] text-[#ffd600] animate-pulse"
                        : "bg-white border-gray-300 text-gray-400"
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
                        <h4 className="mb-1 text-gray-900 font-semibold">
                          {milestone.label}
                        </h4>
                        <p className="text-gray-600">{milestone.description}</p>
                      </div>
                      {milestone.status === "active" && (
                        <Badge className="bg-[#ffd600] text-gray-900 border border-[#ffd600]">
                          В процессе
                        </Badge>
                      )}
                    </div>
                    {milestone.date && (
                      <div className="flex items-center gap-2 text-gray-600 mt-2">
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
            <span className="text-gray-700 font-medium">Прогресс доставки</span>
            <span className="text-gray-900 font-semibold">{progress}%</span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>

        {/* Estimated Time */}
        {car.status !== "accepted" &&
          car.status !== "for_sale" &&
          car.status !== "sold" && (
            <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-gray-600">
                  <Clock className="h-4 w-4" />
                  <span>Ожидаемое прибытие:</span>
                </div>
                <span className="text-gray-900 font-semibold">
                  {new Date(car.estimatedArrival).toLocaleDateString("ru-RU", {
                    day: "numeric",
                    month: "long",
                  })}
                </span>
              </div>
            </div>
          )}

        {/* Current Location Indicator */}
        <div className="flex items-start gap-3 p-4 bg-[#ffd600]/10 rounded-lg border border-[#ffd600]/20">
          <TransportIcon className="h-5 w-5 text-[#ffd600] mt-0.5" />
          <div>
            <p className="text-gray-900 font-semibold">Текущий статус</p>
            <p className="text-gray-700">
              {car.status === "pending" &&
                "Ожидает отправки из порта отправления"}
              {car.status === "in_transit" &&
                "Автомобиль в пути, морская перевозка"}
              {car.status === "arrived" &&
                "Прибыл в порт назначения, ожидает приемки"}
              {car.status === "accepted" && "Принят в салоне, готов к продаже"}
              {car.status === "for_sale" && "Выставлен на продажу"}
              {car.status === "sold" && "Продан клиенту"}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
