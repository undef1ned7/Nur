import { useState } from "react";
import { Toaster, toast } from "sonner";
import { Routes, Route, useLocation, useNavigate } from "react-router-dom";

import { CarDetailsDialog } from "./components/CarDetailsDialog";
import { AcceptCarDialog } from "./components/AcceptCarDialog";
import { SetForSaleDialog } from "./components/SetForSaleDialog";
import { OrderDialog } from "./components/OrderDialog";
import { QuickSellDialog } from "./components/QuickSellDialog";

import { AppHeader } from "./components/AppHeader";
import { LogisticsView } from "./components/LogisticsView";
import { ShopView } from "./components/ShopView";

const mockUsers = [
  {
    id: "1",
    name: "Алексей Иванов",
    role: "agent",
    email: "agent@example.com",
    phone: "+7 999 111-22-33",
  },
  {
    id: "2",
    name: "Мария Петрова",
    role: "manager",
    email: "manager@example.com",
    phone: "+7 999 222-33-44",
  },
  {
    id: "3",
    name: "Дмитрий Смирнов",
    role: "customer",
    email: "customer@example.com",
    phone: "+7 999 333-44-55",
  },
];

// Available services
const availableServices = [
  {
    id: "warranty",
    name: "Расширенная гарантия",
    description: "Дополнительная гарантия на 2 года или 100,000 км",
    price: 2500,
  },
  {
    id: "insurance",
    name: "КАСКО на год",
    description: "Полное страхование автомобиля на 12 месяцев",
    price: 3000,
  },
  {
    id: "tinting",
    name: "Тонировка стекол",
    description: "Профессиональная тонировка всех стекол",
    price: 500,
  },
  {
    id: "detailing",
    name: "Детейлинг",
    description: "Полная химчистка и защитное покрытие кузова",
    price: 800,
  },
  {
    id: "winterTires",
    name: "Комплект зимней резины",
    description: "Зимние шины премиум класса с установкой",
    price: 1200,
  },
  {
    id: "signaling",
    name: "Сигнализация",
    description: "Установка охранной системы с автозапуском",
    price: 1500,
  },
];

// Mock data
const initialCars = [
  {
    id: "1",
    make: "Toyota",
    model: "Camry",
    year: 2023,
    vin: "4T1BF1FK5CU123456",
    origin: "Корея, Пусан",
    destination: "Салон Москва",
    status: "in_transit",
    photos: [],
    agentId: "1",
    agentName: "Алексей Иванов",
    shippingDate: "2025-10-15",
    estimatedArrival: "2025-11-20",
    price: 28000,
    notes: "Комплектация Premium, черный цвет",
  },
  {
    id: "2",
    make: "Hyundai",
    model: "Genesis G80",
    year: 2024,
    vin: "KMHGH4JH5EU123789",
    origin: "Корея, Сеул",
    destination: "Салон Москва",
    status: "arrived",
    photos: [],
    agentId: "1",
    agentName: "Алексей Иванов",
    shippingDate: "2025-10-01",
    estimatedArrival: "2025-11-08",
    actualArrival: "2025-11-08",
    price: 45000,
    notes: "Белый перламутр, полный фарш",
  },
  {
    id: "3",
    make: "Kia",
    model: "Sportage",
    year: 2024,
    vin: "5XYP3DHC8PG123456",
    origin: "Корея, Пусан",
    destination: "Салон Москва",
    status: "pending",
    photos: [],
    agentId: "1",
    agentName: "Алексей Иванов",
    shippingDate: "2025-11-10",
    estimatedArrival: "2025-12-15",
    price: 32000,
    notes: "GT-Line, серый металлик",
  },
  {
    id: "4",
    make: "Genesis",
    model: "GV70",
    year: 2023,
    vin: "KMUH84JH0PU987654",
    origin: "Корея, Сеул",
    destination: "Салон Москва",
    status: "accepted",
    photos: [],
    agentId: "1",
    agentName: "Алексей Иванов",
    shippingDate: "2025-09-20",
    estimatedArrival: "2025-10-25",
    actualArrival: "2025-10-24",
    acceptedBy: "Мария Петрова",
    acceptedDate: "2025-10-25",
    price: 52000,
    notes: "Sport Prestige, синий металлик. Принят без замечаний.",
  },
  {
    id: "5",
    make: "Hyundai",
    model: "Tucson",
    year: 2024,
    vin: "5NMS33AD7RH123456",
    origin: "Корея, Пусан",
    destination: "Салон Москва",
    status: "for_sale",
    photos: [],
    agentId: "1",
    agentName: "Алексей Иванов",
    shippingDate: "2025-09-01",
    estimatedArrival: "2025-10-05",
    actualArrival: "2025-10-04",
    acceptedBy: "Мария Петрова",
    acceptedDate: "2025-10-05",
    price: 35000,
    originalPrice: 35000,
    salePrice: 39900,
    mileage: 15,
    fuelType: "Бензин",
    transmission: "Автомат",
    color: "Серебристый металлик",
    features: [
      "Панорамная крыша",
      "Подогрев сидений",
      "Камера 360°",
      "Адаптивный круиз-контроль",
    ],
    includedServices: ["warranty", "tinting"],
    listedDate: "2025-10-06",
    notes: "Топовая комплектация, практически новый автомобиль",
  },
  {
    id: "6",
    make: "Kia",
    model: "Sorento",
    year: 2023,
    vin: "5XYP54HC5PG987123",
    origin: "Корея, Сеул",
    destination: "Салон Москва",
    status: "for_sale",
    photos: [],
    agentId: "1",
    agentName: "Алексей Иванов",
    shippingDate: "2025-08-15",
    estimatedArrival: "2025-09-20",
    actualArrival: "2025-09-19",
    acceptedBy: "Мария Петрова",
    acceptedDate: "2025-09-20",
    price: 48000,
    originalPrice: 48000,
    salePrice: 52900,
    mileage: 8,
    fuelType: "Дизель",
    transmission: "Автомат",
    color: "Черный перламутр",
    features: [
      "7 мест",
      "Кожаный салон",
      "Проекция на лобовое стекло",
      "Премиум аудиосистема",
    ],
    includedServices: ["warranty", "insurance", "detailing"],
    listedDate: "2025-09-21",
    notes: "Премиум комплектация, семиместный внедорожник",
  },
  {
    id: "7",
    make: "Toyota",
    model: "RAV4",
    year: 2023,
    vin: "JTMB1RFV8PD123456",
    origin: "Корея, Пусан",
    destination: "Салон Москва",
    status: "sold",
    photos: [],
    agentId: "1",
    agentName: "Алексей Иванов",
    shippingDate: "2025-08-01",
    estimatedArrival: "2025-09-05",
    actualArrival: "2025-09-04",
    acceptedBy: "Мария Петрова",
    acceptedDate: "2025-09-05",
    price: 33000,
    originalPrice: 33000,
    salePrice: 37500,
    mileage: 12,
    fuelType: "Гибрид",
    transmission: "Автомат",
    color: "Белый",
    features: [
      "Гибридная система",
      "Полный привод",
      "Система безопасности TSS",
    ],
    soldDate: "2025-10-15",
    soldTo: "Сергей Коваленко",
    notes: "Продан с дополнительной гарантией",
  },
  {
    id: "8",
    make: "Hyundai",
    model: "Sonata",
    year: 2024,
    vin: "5NPE34AF6RH234567",
    origin: "Корея, Сеул",
    destination: "Салон Москва",
    status: "arrived",
    photos: [],
    agentId: "1",
    agentName: "Алексей Иванов",
    shippingDate: "2025-10-20",
    estimatedArrival: "2025-11-07",
    actualArrival: "2025-11-07",
    price: 31000,
    notes: "Turbo, черный металлик, требует осмотра",
  },
  {
    id: "9",
    make: "Kia",
    model: "K5",
    year: 2024,
    vin: "5XXG84JC9RG345678",
    origin: "Корея, Пусан",
    destination: "Салон Москва",
    status: "arrived",
    photos: [],
    agentId: "1",
    agentName: "Алексей Иванов",
    shippingDate: "2025-10-25",
    estimatedArrival: "2025-11-08",
    actualArrival: "2025-11-08",
    price: 29500,
    notes: "GT-Line, красный цвет, без повреждений",
  },
  {
    id: "10",
    make: "Genesis",
    model: "G70",
    year: 2023,
    vin: "KMTG34LA9PU456789",
    origin: "Корея, Сеул",
    destination: "Салон Москва",
    status: "accepted",
    photos: [],
    agentId: "1",
    agentName: "Алексей Иванов",
    shippingDate: "2025-10-10",
    estimatedArrival: "2025-11-01",
    actualArrival: "2025-11-01",
    acceptedBy: "Мария Петрова",
    acceptedDate: "2025-11-02",
    price: 42000,
    notes: "Sport, белый цвет. Принят в отличном состоянии.",
  },
  {
    id: "11",
    make: "Hyundai",
    model: "Palisade",
    year: 2024,
    vin: "KM8R8DHE5RU567890",
    origin: "Корея, Пусан",
    destination: "Салон Москва",
    status: "accepted",
    photos: [],
    agentId: "1",
    agentName: "Алексей Иванов",
    shippingDate: "2025-10-05",
    estimatedArrival: "2025-10-28",
    actualArrival: "2025-10-27",
    acceptedBy: "Мария Петрова",
    acceptedDate: "2025-10-28",
    price: 55000,
    notes:
      "Calligraphy, черный перламутр. Полная комплектация, принят без замечаний.",
  },
  {
    id: "12",
    make: "Kia",
    model: "Carnival",
    year: 2023,
    vin: "5XYP8DHC5PG678901",
    origin: "Корея, Сеул",
    destination: "Салон Москва",
    status: "accepted",
    photos: [],
    agentId: "1",
    agentName: "Алексей Иванов",
    shippingDate: "2025-09-28",
    estimatedArrival: "2025-10-22",
    actualArrival: "2025-10-21",
    acceptedBy: "Мария Петрова",
    acceptedDate: "2025-10-22",
    price: 47000,
    notes:
      "Signature, серебристый. Минивэн премиум класса, состояние отличное.",
  },
  {
    id: "13",
    make: "Toyota",
    model: "Highlander",
    year: 2024,
    vin: "5TDJZRFH9RS789012",
    origin: "Корея, Пусан",
    destination: "Сал��н Москва",
    status: "arrived",
    photos: [],
    agentId: "1",
    agentName: "Алексей Иванов",
    shippingDate: "2025-10-28",
    estimatedArrival: "2025-11-08",
    actualArrival: "2025-11-08",
    price: 51000,
    notes: "Platinum, белый перламутр. Гибрид, требует приемки.",
  },
];

function Logistics() {
  const [currentUser, setCurrentUser] = useState(mockUsers[0]); // агент по умолчанию
  const [cars, setCars] = useState(initialCars);
  const [orders, setOrders] = useState([]);
  const [selectedCar, setSelectedCar] = useState(null);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [acceptDialogOpen, setAcceptDialogOpen] = useState(false);
  const [setForSaleDialogOpen, setSetForSaleDialogOpen] = useState(false);
  const [orderDialogOpen, setOrderDialogOpen] = useState(false);
  const [quickSellDialogOpen, setQuickSellDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const location = useLocation();
  const navigate = useNavigate();

  // Определяем активную страницу по URL
  const isShopPage =
    location.pathname.includes("logistics-shop") ||
    location.pathname.endsWith("/logistics-shop");
  const activeView = isShopPage ? "shop" : "logistics";

  const handleAddCar = (newCar) => {
    const car = {
      ...newCar,
      id: Date.now().toString(),
    };
    setCars([car, ...cars]);
    toast.success("Автомобиль успешно добавлен!");
  };

  const handleUpdateStatus = (carId, status) => {
    setCars(
      cars.map((car) => {
        if (car.id === carId) {
          const updatedCar = { ...car, status };
          if (status === "in_transit") {
            toast.success(`${car.make} ${car.model} отправлен в путь`);
          } else if (status === "arrived") {
            toast.info(`${car.make} ${car.model} прибыл в назначение`);
          }
          return updatedCar;
        }
        return car;
      })
    );
  };

  const handleAcceptCar = (carId, notes) => {
    setCars(
      cars.map((car) => {
        if (car.id === carId) {
          const updatedCar = {
            ...car,
            status: "accepted",
            acceptedBy: currentUser.name,
            acceptedDate: new Date().toISOString(),
            notes: notes || car.notes,
            actualArrival: new Date().toISOString(),
          };
          toast.success(`${car.make} ${car.model} успешно принят!`);
          return updatedCar;
        }
        return car;
      })
    );
  };

  const handleSetForSale = (carId, saleData) => {
    setCars(
      cars.map((car) => {
        if (car.id === carId) {
          const updatedCar = {
            ...car,
            ...saleData,
          };
          toast.success(`${car.make} ${car.model} выставлен на продажу!`);
          return updatedCar;
        }
        return car;
      })
    );
  };

  const handlePlaceOrder = (orderData) => {
    const order = {
      id: Date.now().toString(),
      customerId: currentUser.id,
      status: "pending",
      orderDate: new Date().toISOString(),
      ...orderData,
    };

    setOrders([order, ...orders]);

    setCars(
      cars.map((car) => {
        if (car.id === orderData.carId) {
          return {
            ...car,
            status: "sold",
            soldDate: new Date().toISOString(),
            soldTo: orderData.customerName,
          };
        }
        return car;
      })
    );

    toast.success(
      "Заказ успешно оформлен! Наш менеджер свяжется с вами в ближайшее время."
    );
  };

  const handleSellCar = (carId, saleData) => {
    setCars(
      cars.map((car) => {
        if (car.id === carId) {
          const updatedCar = {
            ...car,
            status: "sold",
            soldDate: new Date().toISOString(),
            soldTo: saleData.soldTo,
            salePrice: saleData.soldPrice,
            notes: saleData.notes || car.notes,
          };
          toast.success(
            `${car.make} ${car.model} успешно продан покупателю ${saleData.soldTo}!`
          );
          return updatedCar;
        }
        return car;
      })
    );
  };

  const handleViewDetails = (car) => {
    setSelectedCar(car);
    setDetailsDialogOpen(true);
  };

  const handleOpenAcceptDialog = (car) => {
    setSelectedCar(car);
    setAcceptDialogOpen(true);
  };

  const handleOpenSetForSaleDialog = (car) => {
    setSelectedCar(car);
    setSetForSaleDialogOpen(true);
  };

  const handleOpenOrderDialog = (car) => {
    setSelectedCar(car);
    setOrderDialogOpen(true);
  };

  const handleOpenQuickSellDialog = (car) => {
    setSelectedCar(car);
    setQuickSellDialogOpen(true);
  };

  const handleUserChange = (user) => {
    setCurrentUser(user);
    // Если заходим как клиент – сразу ведём на /crm/logistics-shop
    if (user.role === "customer") {
      navigate("/crm/logistics-shop");
    }
    toast.success(`Вы вошли как ${user.name}`);
  };

  const filteredCars = cars.filter((car) => {
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      car.make.toLowerCase().includes(q) ||
      car.model.toLowerCase().includes(q) ||
      car.vin.toLowerCase().includes(q);

    const matchesStatus = statusFilter === "all" || car.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const stats = {
    total: cars.length,
    pending: cars.filter((c) => c.status === "pending").length,
    inTransit: cars.filter((c) => c.status === "in_transit").length,
    arrived: cars.filter((c) => c.status === "arrived").length,
    accepted: cars.filter((c) => c.status === "accepted").length,
    forSale: cars.filter((c) => c.status === "for_sale").length,
    sold: cars.filter((c) => c.status === "sold").length,
  };

  return (
    <div className="bg-gray-50">
      {/* Header */}
      {/* <AppHeader
        currentUser={currentUser}
        users={mockUsers}
        stats={stats}
        activeView={activeView}
        onChangeView={(view) => {
          if (view === "shop") {
            navigate("/crm/logistics-shop");
          } else {
            navigate("/crm/logistics");
          }
        }}
        onUserChange={handleUserChange}
      /> */}

      {/* Role Switcher */}
      <div className="px-4 pt-2 pb-2">
        <div className="flex items-center justify-end gap-3">
          <span className="text-sm text-gray-600">Роль:</span>
          <select
            value={currentUser.role}
            onChange={(e) => {
              const role = e.target.value;
              const userWithRole = { ...currentUser, role };
              setCurrentUser(userWithRole);
              toast.success(
                `Роль изменена на: ${
                  role === "agent"
                    ? "Агент"
                    : role === "manager"
                    ? "Менеджер"
                    : "Покупатель"
                }`
              );
              if (role === "customer") {
                navigate("/crm/logistics-shop");
              } else {
                navigate("/crm/logistics");
              }
            }}
            className="px-3 py-1.5 rounded-md border border-gray-300 bg-white text-sm font-medium text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#ffd600] focus:border-[#ffd600]"
          >
            <option value="agent">Агент</option>
            <option value="manager">Менеджер</option>
            <option value="customer">Покупатель</option>
          </select>
          <div className="text-sm text-gray-600">({currentUser.name})</div>
        </div>
      </div>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-4">
        {activeView === "logistics" && (
          <LogisticsView
            currentUser={currentUser}
            stats={stats}
            filteredCars={filteredCars}
            searchQuery={searchQuery}
            statusFilter={statusFilter}
            onSearchChange={setSearchQuery}
            onStatusFilterChange={setStatusFilter}
            onAddCar={handleAddCar}
            onViewDetails={handleViewDetails}
            onOpenAcceptDialog={handleOpenAcceptDialog}
            onUpdateStatus={handleUpdateStatus}
            onOpenSetForSaleDialog={handleOpenSetForSaleDialog}
          />
        )}

        {activeView === "shop" && (
          <ShopView
            currentUser={currentUser}
            stats={stats}
            cars={cars}
            orders={orders}
            onSellCar={handleSellCar}
            onViewDetails={handleViewDetails}
            onOpenSetForSaleDialog={handleOpenSetForSaleDialog}
            onOpenQuickSellDialog={handleOpenQuickSellDialog}
            onOpenOrderDialog={handleOpenOrderDialog}
          />
        )}
      </main>

      {/* Dialogs (общие для обеих страниц) */}
      <CarDetailsDialog
        car={selectedCar}
        open={detailsDialogOpen}
        onOpenChange={setDetailsDialogOpen}
      />

      <AcceptCarDialog
        car={selectedCar}
        open={acceptDialogOpen}
        onOpenChange={setAcceptDialogOpen}
        onAccept={handleAcceptCar}
        managerName={currentUser.name}
      />

      <SetForSaleDialog
        car={selectedCar}
        open={setForSaleDialogOpen}
        onOpenChange={setSetForSaleDialogOpen}
        onSetForSale={handleSetForSale}
        availableServices={availableServices}
      />

      <OrderDialog
        car={selectedCar}
        open={orderDialogOpen}
        onOpenChange={setOrderDialogOpen}
        onPlaceOrder={handlePlaceOrder}
        availableServices={availableServices}
      />

      <QuickSellDialog
        car={selectedCar}
        open={quickSellDialogOpen}
        onOpenChange={setQuickSellDialogOpen}
        onSell={handleSellCar}
      />

      <Toaster />
    </div>
  );
}

export default Logistics;
