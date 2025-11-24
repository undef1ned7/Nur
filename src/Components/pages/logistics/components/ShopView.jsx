import { StatCard } from "./StatCard";
import { WarehouseView } from "./WarehouseView";
import { ShowroomView } from "./ShowroomView";
import { SalesView } from "./SalesView";
import { SalesAnalyticsView } from "./SalesAnalyticsView";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import { Store, Warehouse, ShoppingBag, Tag } from "lucide-react";

export function ShopView({
  currentUser,
  stats,
  cars,
  orders,
  onSellCar,
  onViewDetails,
  onOpenSetForSaleDialog,
  onOpenQuickSellDialog,
  onOpenOrderDialog,
}) {
  return (
    <>
      {/* Shop Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <StatCard
          title="Автомобили в продаже"
          value={stats.forSale}
          icon={Store}
        />
        <StatCard
          title="На складе"
          value={stats.arrived + stats.accepted}
          icon={Warehouse}
        />
        <StatCard title="Продано" value={stats.sold} icon={ShoppingBag} />
        <StatCard title="Заказы" value={orders.length} icon={Tag} />
      </div>

      {/* Shop Tabs */}
      <Tabs
        defaultValue={currentUser.role === "customer" ? "showroom" : "sales"}
      >
        <TabsList
          className={
            currentUser.role === "manager"
              ? "grid w-full grid-cols-5"
              : currentUser.role === "agent"
              ? "grid w-full grid-cols-4"
              : ""
          }
        >
          {currentUser.role === "manager" && (
            <>
              <TabsTrigger value="sales">Продажи ({stats.sold})</TabsTrigger>
              <TabsTrigger value="warehouse">
                Склад ({stats.arrived + stats.accepted})
              </TabsTrigger>
            </>
          )}
          <TabsTrigger value="showroom">Витрина ({stats.forSale})</TabsTrigger>
          {(currentUser.role === "manager" || currentUser.role === "agent") && (
            <>
              <TabsTrigger value="analytics">Аналитика</TabsTrigger>
              {currentUser.role === "manager" && (
                <TabsTrigger value="orders">
                  Заказы ({orders.length})
                </TabsTrigger>
              )}
            </>
          )}
        </TabsList>

        {currentUser.role === "manager" && (
          <>
            <TabsContent value="sales">
              <SalesView
                cars={cars}
                onSellCar={onSellCar}
                onViewDetails={onViewDetails}
              />
            </TabsContent>

            <TabsContent value="warehouse">
              <WarehouseView
                cars={cars}
                onViewDetails={onViewDetails}
                onSetForSale={onOpenSetForSaleDialog}
                onSell={onOpenQuickSellDialog}
              />
            </TabsContent>
          </>
        )}

        <TabsContent value="showroom">
          <ShowroomView
            cars={cars}
            onViewDetails={onViewDetails}
            onOrder={
              currentUser.role === "customer" ? onOpenOrderDialog : undefined
            }
            onSell={
              currentUser.role === "manager" ? onOpenQuickSellDialog : undefined
            }
            isManager={currentUser.role === "manager"}
          />
        </TabsContent>

        {(currentUser.role === "manager" || currentUser.role === "agent") && (
          <TabsContent value="analytics">
            <SalesAnalyticsView cars={cars} />
          </TabsContent>
        )}

        {currentUser.role === "manager" && (
          <TabsContent value="orders">
            {orders.length > 0 ? (
              <div className="space-y-6">
                <h2>Заказы клиентов</h2>
                <div className="grid gap-4">
                  {orders.map((order) => {
                    const car = cars.find((c) => c.id === order.carId);
                    if (!car) return null;
                    return (
                      <Card key={order.id}>
                        <CardHeader>
                          <div className="flex items-start justify-between">
                            <div>
                              <CardTitle>
                                {car.make} {car.model} ({car.year})
                              </CardTitle>
                              <p className="text-gray-600">
                                Заказ #{order.id.slice(-6)}
                              </p>
                            </div>
                            <Badge className="bg-[#ffd600]/20 text-[#ffd600] border border-[#ffd600]/30">
                              {order.status === "pending"
                                ? "В обработке"
                                : order.status === "confirmed"
                                ? "Подтвержден"
                                : order.status === "completed"
                                ? "Завершен"
                                : "Отменен"}
                            </Badge>
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-2">
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <p className="text-gray-600 text-sm">Клиент</p>
                              <p className="text-gray-900 font-medium">
                                {order.customerName}
                              </p>
                            </div>
                            <div>
                              <p className="text-gray-600 text-sm">
                                Дата заказа
                              </p>
                              <p className="text-gray-900 font-medium">
                                {new Date(order.orderDate).toLocaleDateString(
                                  "ru-RU"
                                )}
                              </p>
                            </div>
                            <div>
                              <p className="text-gray-600 text-sm">Услуги</p>
                              <p className="text-gray-900 font-medium">
                                {order.selectedServices.length} выбрано
                              </p>
                            </div>
                            <div>
                              <p className="text-gray-600 text-sm">Итого</p>
                              <div className="flex items-center gap-1 text-[#ffd600] font-semibold">
                                <span className="text-lg">
                                  ${order.totalPrice.toLocaleString()}
                                </span>
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>
            ) : (
              <Card>
                <CardContent className="text-center py-12">
                  <ShoppingBag className="h-16 w-16 mx-auto mb-4 text-gray-400 opacity-50" />
                  <h3 className="mb-2 text-gray-900">Нет заказов</h3>
                  <p className="text-gray-600">Пока нет заказов от клиентов</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        )}
      </Tabs>
    </>
  );
}
