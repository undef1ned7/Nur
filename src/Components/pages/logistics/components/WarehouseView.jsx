import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "./ui/table";
import {
  Warehouse,
  Calendar,
  MapPin,
  Eye,
  Tag,
  DollarSign,
  CheckCircle2,
} from "lucide-react";
import { ImageWithFallback } from "./figma/ImageWithFallback";

export function WarehouseView({ cars, onViewDetails, onSetForSale, onSell }) {
  const warehouseCars = cars.filter(
    (car) => car.status === "arrived" || car.status === "accepted"
  );

  const arrivedCars = warehouseCars.filter((car) => car.status === "arrived");
  const acceptedCars = warehouseCars.filter((car) => car.status === "accepted");

  return (
    <div className="space-y-6">
      {/* Warehouse Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                <Warehouse className="h-6 w-6 text-primary" />
              </div>
              <div>
                <CardTitle>Склад автомобилей</CardTitle>
                <p className="text-muted-foreground">
                  Управление прибывшими и принятыми автомобилями
                </p>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="text-center">
                <div className="flex items-center gap-1 text-orange-600">
                  <span className="text-2xl">{arrivedCars.length}</span>
                </div>
                <p className="text-muted-foreground">Ожидают приемки</p>
              </div>
              <div className="text-center">
                <div className="flex items-center gap-1 text-green-600">
                  <span className="text-2xl">{acceptedCars.length}</span>
                </div>
                <p className="text-muted-foreground">Приняты</p>
              </div>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Pending Acceptance */}
      {arrivedCars.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-orange-600" />
              Ожидают приемки ({arrivedCars.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {arrivedCars.map((car) => (
                <Card key={car.id} className="overflow-hidden">
                  <div className="flex items-start gap-4 p-4">
                    <div className="w-32 h-24 bg-muted rounded-lg overflow-hidden flex-shrink-0">
                      {car.photos && car.photos.length > 0 ? (
                        <img
                          src={car.photos[0]}
                          alt={`${car.make} ${car.model}`}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <ImageWithFallback
                          src="https://images.unsplash.com/photo-1706943384941-19c3507c08ee?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHx3YXJlaG91c2UlMjBwYXJraW5nJTIwbG90fGVufDF8fHx8MTc2MjU4OTk1M3ww&ixlib=rb-4.1.0&q=80&w=1080"
                          alt={`${car.make} ${car.model}`}
                          className="w-full h-full object-cover"
                        />
                      )}
                    </div>

                    <div className="flex-1 space-y-2">
                      <div className="flex items-start justify-between">
                        <div>
                          <h4>
                            {car.make} {car.model} ({car.year})
                          </h4>
                          <p className="text-muted-foreground">
                            VIN: {car.vin}
                          </p>
                        </div>
                        <Badge className="bg-orange-100 text-orange-800 border-orange-200">
                          Требует приемки
                        </Badge>
                      </div>

                      <div className="grid grid-cols-3 gap-4 text-muted-foreground">
                        <div className="flex items-center gap-2">
                          <MapPin className="h-4 w-4" />
                          <span>{car.origin}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4" />
                          <span>
                            Прибыл:{" "}
                            {car.actualArrival
                              ? new Date(
                                  car.actualArrival
                                ).toLocaleDateString("ru-RU")
                              : "Сегодня"}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <DollarSign className="h-4 w-4" />
                          <span>${car.price?.toLocaleString()}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onViewDetails(car)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      {onSell && (
                        <Button
                          size="sm"
                          className="bg-green-600 hover:bg-green-700"
                          onClick={() => onSell(car)}
                        >
                          <DollarSign className="h-4 w-4 mr-1" />
                          Продать
                        </Button>
                      )}
                      {onSetForSale && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => onSetForSale(car)}
                        >
                          <Tag className="h-4 w-4 mr-1" />
                          На витрину
                        </Button>
                      )}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Accepted Cars */}
      {acceptedCars.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              Принятые автомобили ({acceptedCars.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Фото</TableHead>
                  <TableHead>Автомобиль</TableHead>
                  <TableHead>VIN</TableHead>
                  <TableHead>Откуда</TableHead>
                  <TableHead>Дата приемки</TableHead>
                  <TableHead>Принял</TableHead>
                  <TableHead>Стоимость</TableHead>
                  <TableHead>Действия</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {acceptedCars.map((car) => (
                  <TableRow key={car.id}>
                    <TableCell>
                      <div className="w-16 h-12 bg-muted rounded overflow-hidden">
                        {car.photos && car.photos.length > 0 ? (
                          <img
                            src={car.photos[0]}
                            alt={`${car.make} ${car.model}`}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <ImageWithFallback
                            src="https://images.unsplash.com/photo-1706943384941-19c3507c08ee?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHx3YXJlaG91c2UlMjBwYXJraW5nJTIwbG90fGVufDF8fHx8MTc2MjU4OTk1M3ww&ixlib=rb-4.1.0&q=80&w=1080"
                            alt={`${car.make} ${car.model}`}
                            className="w-full h-full object-cover"
                          />
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>
                        <p>
                          {car.make} {car.model}
                        </p>
                        <p className="text-muted-foreground">{car.year}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <code className="text-xs">{car.vin}</code>
                    </TableCell>
                    <TableCell>{car.origin}</TableCell>
                    <TableCell>
                      {car.acceptedDate
                        ? new Date(car.acceptedDate).toLocaleDateString(
                            "ru-RU"
                          )
                        : "-"}
                    </TableCell>
                    <TableCell>{car.acceptedBy || "-"}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <DollarSign className="h-4 w-4 text-primary" />
                        <span>{car.price?.toLocaleString()}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => onViewDetails(car)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        {onSell && (
                          <Button
                            size="sm"
                            className="bg-green-600 hover:bg-green-700"
                            onClick={() => onSell(car)}
                          >
                            <DollarSign className="h-4 w-4 mr-1" />
                            Продать
                          </Button>
                        )}
                        {onSetForSale && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => onSetForSale(car)}
                          >
                            <Tag className="h-4 w-4 mr-1" />
                            На витрину
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Empty State */}
      {warehouseCars.length === 0 && (
        <Card>
          <CardContent className="text-center py-12">
            <Warehouse className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
            <h3 className="mb-2">Склад пуст</h3>
            <p className="text-muted-foreground">
              На складе пока нет автомобилей
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
