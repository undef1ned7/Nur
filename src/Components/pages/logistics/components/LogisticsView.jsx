import { StatCard } from "./StatCard";
import { CarCard } from "./CarCard";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { Input } from "./ui/input";
import { Button } from "./ui/button";

import {
  Car as CarIcon,
  Package,
  TruckIcon,
  CheckCircle2,
  Search,
} from "lucide-react";
import { AddCarDialog } from "./AddCarDialog";

export function LogisticsView({
  currentUser,
  stats,
  filteredCars,
  searchQuery,
  statusFilter,
  onSearchChange,
  onStatusFilterChange,
  onAddCar,
  onViewDetails,
  onOpenAcceptDialog,
  onUpdateStatus,
  onOpenSetForSaleDialog,
}) {
  const nonShopCars = filteredCars.filter(
    (c) => c.status !== "for_sale" && c.status !== "sold"
  );

  return (
    <>
      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
        <StatCard title="Всего автомобилей" value={stats.total} icon={CarIcon} />
        <StatCard title="Ожидают отправки" value={stats.pending} icon={Package} />
        <StatCard title="В пути" value={stats.inTransit} icon={TruckIcon} />
        <StatCard title="Прибыли" value={stats.arrived} icon={CarIcon} />
        <StatCard title="Приняты" value={stats.accepted} icon={CheckCircle2} />
      </div>

      {/* Actions and Filters */}
      <div className="flex flex-col md:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Поиск по марке, модели или VIN..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-10"
          />
        </div>

        <Select value={statusFilter} onValueChange={onStatusFilterChange}>
          <SelectTrigger className="w-full md:w-[200px]">
            <SelectValue placeholder="Все статусы" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Все статусы</SelectItem>
            <SelectItem value="pending">Ожидание отправки</SelectItem>
            <SelectItem value="in_transit">В пути</SelectItem>
            <SelectItem value="arrived">Прибыл</SelectItem>
            <SelectItem value="accepted">Принят</SelectItem>
          </SelectContent>
        </Select>

        {currentUser.role === "agent" && (
          <AddCarDialog
            onAddCar={onAddCar}
            agentName={currentUser.name}
            agentId={currentUser.id}
          />
        )}
      </div>

      {/* Tabs */}
      <Tabs defaultValue="all" className="space-y-6">
        <TabsList>
          <TabsTrigger value="all">
            Все ({nonShopCars.length})
          </TabsTrigger>
          {currentUser.role === "agent" && (
            <>
              <TabsTrigger value="pending">
                Ожидают (
                {filteredCars.filter((c) => c.status === "pending").length}
                )
              </TabsTrigger>
              <TabsTrigger value="in_transit">
                В пути (
                {filteredCars.filter((c) => c.status === "in_transit").length}
                )
              </TabsTrigger>
            </>
          )}
          {currentUser.role === "manager" && (
            <>
              <TabsTrigger value="arrived">
                Прибыли (
                {filteredCars.filter((c) => c.status === "arrived").length}
                )
              </TabsTrigger>
              <TabsTrigger value="accepted">
                Приняты (
                {filteredCars.filter((c) => c.status === "accepted").length}
                )
              </TabsTrigger>
            </>
          )}
        </TabsList>

        <TabsContent value="all" className="space-y-4">
          {nonShopCars.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <CarIcon className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Автомобили не найдены</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {nonShopCars.map((car) => (
                <CarCard
                  key={car.id}
                  car={car}
                  userRole={currentUser.role}
                  onViewDetails={onViewDetails}
                  onAccept={onOpenAcceptDialog}
                  onUpdateStatus={onUpdateStatus}
                  onSetForSale={onOpenSetForSaleDialog}
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="pending" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredCars
              .filter((c) => c.status === "pending")
              .map((car) => (
                <CarCard
                  key={car.id}
                  car={car}
                  userRole={currentUser.role}
                  onViewDetails={onViewDetails}
                  onAccept={onOpenAcceptDialog}
                  onUpdateStatus={onUpdateStatus}
                  onSetForSale={onOpenSetForSaleDialog}
                />
              ))}
          </div>
        </TabsContent>

        <TabsContent value="in_transit" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredCars
              .filter((c) => c.status === "in_transit")
              .map((car) => (
                <CarCard
                  key={car.id}
                  car={car}
                  userRole={currentUser.role}
                  onViewDetails={onViewDetails}
                  onAccept={onOpenAcceptDialog}
                  onUpdateStatus={onUpdateStatus}
                  onSetForSale={onOpenSetForSaleDialog}
                />
              ))}
          </div>
        </TabsContent>

        <TabsContent value="arrived" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredCars
              .filter((c) => c.status === "arrived")
              .map((car) => (
                <CarCard
                  key={car.id}
                  car={car}
                  userRole={currentUser.role}
                  onViewDetails={onViewDetails}
                  onAccept={onOpenAcceptDialog}
                  onUpdateStatus={onUpdateStatus}
                  onSetForSale={onOpenSetForSaleDialog}
                />
              ))}
          </div>
        </TabsContent>

        <TabsContent value="accepted" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredCars
              .filter((c) => c.status === "accepted")
              .map((car) => (
                <CarCard
                  key={car.id}
                  car={car}
                  userRole={currentUser.role}
                  onViewDetails={onViewDetails}
                  onAccept={onOpenAcceptDialog}
                  onUpdateStatus={onUpdateStatus}
                  onSetForSale={onOpenSetForSaleDialog}
                />
              ))}
          </div>
        </TabsContent>
      </Tabs>
    </>
  );
}
