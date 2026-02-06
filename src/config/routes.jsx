import { Route, Navigate, useSearchParams } from "react-router-dom";
import ProtectedRoute from "../ProtectedRoute";
import { useUser } from "../store/slices/userSlice";

// Public routes
import Login from "../Components/Auth/Login/Login";
import Register from "../Components/Auth/Register/Register";
import Landing from "../Components/pages/Landing/Landing";
import SubmitApplication from "../Components/pages/SubmitApplication/SubmitApplication";
import ApplicationList from "../Components/pages/SubmitApplication/ApplicationList";

// Layout

// Common pages
import Set from "../Components/pages/Info/Settings/Settings";
import Analytics from "../Components/pages/Analytics/Analytics";
import Contact from "../Components/Contact/Contact";
import AdditionalServices from "../Components/pages/AdditionalServices/AdditionalServices";
import Registration from "../Components/pages/Registration/Registration";
import Sell from "../Components/pages/Sell/Sell";
import SellDetail from "../Components/pages/Sell/SellDetail";
import Debts from "../Components/Debts/Debts";
import Instagram from "../Components/Instagram/Instagram";
import Pending from "../Components/pages/Pending/Pending";
import Branch from "../Components/pages/Branch/Branch";
import BranchDetails from "../Components/pages/Branch/BranchDetails";
import LogisticsPage from "../Components/Sectors/logistics/LogisticsPage/LogisticsPage";
import LogisticsAnalytics from "../Components/pages/LogisticsAnalytics/LogisticsAnalytics";
import Shifts from "../Components/pages/Shifts/Shifts";
import ShiftDetail from "../Components/pages/Shifts/ShiftDetail";

// Deposits
import Obzor from "../Components/Deposits/Obzor/Obzor";
import Zakaz from "../Components/Deposits/Zakaz/Zakaz";
import Raspisanie from "../Components/Deposits/Raspisanie/Raspisanie";
import Sklad from "../Components/Deposits/Sklad/Sklad";
import BarcodePrintPage from "../Components/Deposits/Sklad/BarcodePrintPage";
import ScalesPage from "../Components/Deposits/Sklad/ScalesPage";
import AddProductPage from "../Components/Deposits/Sklad/AddProductPage";
import BrandCategoryPage from "../Components/Deposits/BrandCategoryPage/BrandCategoryPage";
import WarehouseAccounting from "../Components/Deposits/Warehouse/WarehouseAccounting";
import Kassa from "../Components/Deposits/Kassa/Kassa";
import KassWorker from "../Components/Deposits/KassaWorker/Kassa";
import KassaDet from "../Components/Deposits/KassaWorkerDet/Kassa";

// Departments
import Department from "../Components/Department/Department";
import DepartmentDetails from "../Components/DepartmentDetails/DepartmentDetails";
import DepartmentAnalyticsChart from "../Components/DepartmentAnalyticsChart/DepartmentAnalyticsChart";

// Sectors
import SectorSelect from "../Components/Sectors/SectorSelect";
import Masters from "../Components/Sectors/Barber/Masters/Masters";

// Barber
import BarberServices from "../Components/Sectors/Barber/Services/Services";
import BarberHistory from "../Components/Sectors/Barber/History/History";
import BarberDocuments from "../Components/Sectors/Barber/Documents/Documents";
import Recorda from "../Components/Sectors/Barber/Recorda/Recorda";
import BarberClients from "../Components/Sectors/Barber/Clients/Clients";
import BarberAnalitika from "../Components/Sectors/Barber/BarberAnalitika/BarberAnalitika";
import MastersTabs from "../Components/Sectors/Barber/Masters/MastersTabs/MastersTabs";
import BarberRequests from "../Components/Sectors/Barber/Requests/Requests";

// Hostel
import RoomsHalls from "../Components/Sectors/Hostel/RoomsHalls/RoomsHalls";
import HostelBookings from "../Components/Sectors/Hostel/Bookings/Bookings";
import HostelBar from "../Components/Sectors/Hostel/Bar/Bar";
import HostelClients from "../Components/Sectors/Hostel/Clients/Clients";
import HostelDocuments from "../Components/Sectors/Hostel/Documents/Documents";
import HostelWarehouse from "../Components/Sectors/Hostel/Warehouse/Warehouse";
import { AnalyticsPage } from "../Components/Sectors/Hostel/Analytics/AnalyticsPage";
import HostelKassa from "../Components/Sectors/Hostel/kassa/kassa";

// School
import SchoolStudents from "../Components/Sectors/School/Students/Students";
import SchoolCoursesGroups from "../Components/Sectors/School/CoursesGroups/CoursesGroups";
import SchoolLessonsRooms from "../Components/Sectors/School/LessonsRooms/LessonsRooms";
import SchoolTeachers from "../Components/Sectors/School/Teachers/Teachers";
import SchoolLeads from "../Components/Sectors/School/Leads/Leads";
import SchoolInvoices from "../Components/Sectors/School/Invoices/Invoices";
import SchoolDocuments from "../Components/Sectors/School/Documents/Documents";

// Market
import MarketBar from "../Components/Sectors/Market/Bar/Bar";
import MarketWarehouse from "../Components/Sectors/Market/Warehouse/Warehouse";
import MarketProductDetail from "../Components/Sectors/Market/Warehouse/components/ProductDetail";
import MarketCashierPage from "../Components/Sectors/Market/CashierPage/CashierPage";
import MarketCategories from "../Components/Sectors/Market/Categories/Categories";
import MarketClients from "../Components/Sectors/Market/Clients/Clients";
import MarketClientDetails from "../Components/Sectors/Market/ClientDetails/ClientDetails";
import MarketHistory from "../Components/Sectors/Market/History/History";
import MarketDocuments from "../Components/Sectors/Market/Documents/Documents";
import CreateSaleDocument from "../Components/Sectors/Market/Documents/CreateSaleDocument";
import Counterparties from "../Components/Sectors/Market/Counterparties/Counterparties";
import CounterpartyDetail from "../Components/Sectors/Market/Counterparties/CounterpartyDetail";
import MarketAnalytics from "../Components/Sectors/Market/Analytics/Analytics";

// Cafe
import CafeAnalytics from "../Components/Sectors/cafe/CafeAnalytics/CafeAnalytics";
import CafeDocuments from "../Components/Sectors/cafe/Documents/Documents";
import Cook from "../Components/Sectors/cafe/Cook/Cook";
import CafeInventory from "../Components/Sectors/cafe/Inventory/CafeInventory";
import CafeMenu from "../Components/Sectors/cafe/Menu/Menu";
import CafeOrders from "../Components/Sectors/cafe/Orders/Orders";
import CafePayroll from "../Components/Sectors/cafe/Payroll/Payroll";
import CafePurchasing from "../Components/Sectors/cafe/Purchasing/Purchasing";
import CafeReports from "../Components/Sectors/cafe/Reports/Reports";
import CafeReservations from "../Components/Sectors/cafe/Reservations/Reservations";
import CafeStock from "../Components/Sectors/cafe/Stock/Stock";
import CafeKassa from "../Components/Sectors/cafe/kassaCafe/kassa";
import CafeClients from "../Components/Sectors/cafe/Clients/Clients";
import CafeTables from "../Components/Sectors/cafe/Tables/Tables";

// Building
import BuildingWork from "../Components/Sectors/Building/BuildingWork/BuildingWork";
import Objects from "../Components/Sectors/Building/Objects/Objects";

// Consulting
import ConsultingClients from "../Components/Sectors/Consulting/client/client";
import ConsultingClientRequests from "../Components/Sectors/Consulting/client-requests/client-requests";
import ConsultingCafeKassa from "../Components/Sectors/Consulting/Kassa/Kassa";
import ConsultingSchoolTeachers from "../Components/Sectors/Consulting/Teachers/Teachers";
import ConsultingAnalytics from "../Components/Sectors/Consulting/Analytics/Analytics";
import ConsultingBookings from "../Components/Sectors/Consulting/Bookings/Bookings";
import ConsultingSalary from "../Components/Sectors/Consulting/salary/salary";
import ConsultingSale from "../Components/Sectors/Consulting/sale/sale";
import ConsultingServices from "../Components/Sectors/Consulting/services/services";
import ConsultingReports from "../Components/Sectors/Consulting/Kassa/Reports/Reports";

// Warehouse
import WarehouseAnalytics from "../Components/Sectors/Warehouse/Analytics/Analytics";
import WarehouseAgentAnalytics from "../Components/Sectors/Warehouse/Analytics/AgentAnalytics";
import WarehouseClients from "../Components/Sectors/Warehouse/Clients/Clients";
import WarehouseDirectories from "../Components/Sectors/Warehouse/Directories/Directories";
import WarehouseMovements from "../Components/Sectors/Warehouse/Movements/Movements";
import WarehouseProducts from "../Components/Sectors/Warehouse/Products/Products";
import WarehouseProductDetail from "../Components/Sectors/Warehouse/Products/WarehouseProductDetail";
import WarehouseStocks from "../Components/Sectors/Warehouse/Stocks/Stocks";
import AddWarehouseProductPage from "../Components/Sectors/Warehouse/Stocks/AddWarehouseProductPage";
import WarehouseSupply from "../Components/Sectors/Warehouse/Supply/Supply";
import WarehouseWriteOffs from "../Components/Sectors/Warehouse/WriteOffs/WriteOffs";
import Warehouses from "../Components/Sectors/Warehouse/Warehouses/Warehouses";
import WarehouseBrandCategory from "../Components/Sectors/Warehouse/BrandCategory/BrandCategoryPage";
import WarehouseDocumentsLayout from "../Components/Sectors/Warehouse/Documents/DocumentsLayout";
import WarehouseDocuments from "../Components/Sectors/Warehouse/Documents/Documents";
import CreateWarehouseDocument from "../Components/Sectors/Warehouse/Documents/CreateSaleDocument";
import MoneyDocumentsPage from "../Components/Sectors/Warehouse/Money/MoneyDocumentsPage";
import WarehouseAgents from "../Components/Sectors/Warehouse/Agents/Agents";
// Production
import ProductionWarehouse from "../Components/Sectors/Production/Warehouse/ProductionWarehouse";
import ProductionAgents from "../Components/Sectors/Production/ProductionAgents/ProductionAgents";
import ProductionCatalog from "../Components/Sectors/Production/Catalog/ProductionCatalog";
import ProductionRequest from "../Components/Sectors/Production/Request/ProductionRequest";
import AgentAnalytics from "../Components/Sectors/Production/Analytics/AgentAnalytics";
import ProductionAnalytics from "../Components/Sectors/Production/Analytics/ProductionAnalytics";

// Pilorama
import PiloramaWarehouse from "../Components/Sectors/Pilorama/PiloramaWarehouse/PiloramaWarehouse";

// Public pages
import CafeMenuOnline from "../Components/Sectors/cafe/CafeMenuOnline/CafeMenuOnline";
import OnlineCatalog from "../Components/Sectors/Market/Catalog/Catalog";
import OnlineBooking from "../Components/Sectors/Barber/OnlineBooking/OnlineBooking";
import CafeOrdersLayout from "../Components/Sectors/cafe/Orders";
import Orders from "../Components/Sectors/cafe/Orders/Orders";
import CafeOrderHistory from "../Components/Sectors/cafe/Orders/CafeOrdersHistory";
import SellLayout from "../Components/pages/Sell/SellLayout";
import SellMainStart from "../Components/pages/Sell/SellMainStart";
import CafeLayout from "../Components/Sectors/cafe/CafeLayout";
import SellCashierPage from "../Components/pages/Sell/Cashier/SellCashierPage";

/**
 * Создает защищенный роут
 */
const createProtectedRoute = (path, Component, props) => (
  <Route
    key={path}
    path={path}
    element={
      <ProtectedRoute>
        <Component />
      </ProtectedRoute>
    }
    {...props}
  />
);

/** Аналитика склада: новая аналитика агента (AgentAnalytics) — для агента без agent_id или при agent_id в URL; иначе владелец/админ (WarehouseAnalytics) */
const WarehouseAnalyticsRoute = () => {
  const { profile } = useUser();
  const [searchParams] = useSearchParams();
  const agentId = searchParams.get("agent_id");
  const isAgent = profile?.role !== "owner" && profile?.role !== "admin";
  if (isAgent && !agentId) return <WarehouseAgentAnalytics />;
  if (agentId) return <WarehouseAgentAnalytics />;
  return <WarehouseAnalytics />;
};

/**
 * Конфигурация публичных роутов
 */
export const publicRoutes = [
  <Route key="/login" path="/login" element={<Login />} />,
  <Route key="/" path="/" element={<Landing />} />,
  <Route key="/register" path="/register" element={<Register />} />,

  // Public routes
  <Route
    key="/catalog/:slug"
    path="/catalog/:slug"
    element={<OnlineCatalog />}
  />,
  <Route
    key="/cafe/:company_slug/menu"
    path="/cafe/:company_slug/menu"
    element={<CafeMenuOnline />}
  />,
  <Route
    key="/barber/:company_slug/booking"
    path="/barber/:company_slug/booking"
    element={<OnlineBooking />}
  />,

  <Route
    key="/submit-application"
    path="/submit-application"
    element={<SubmitApplication />}
  />,
  <Route
    key="/get-application-list"
    path="/get-application-list"
    element={
      <ProtectedRoute>
        <ApplicationList />
      </ProtectedRoute>
    }
  />,
];

/**
 * Конфигурация CRM роутов
 */
export const crmRoutes = (profile) => [
  // Common routes
  createProtectedRoute("set", Set),
  createProtectedRoute("raspisanie", Raspisanie),
  createProtectedRoute("registration", Registration),
  createProtectedRoute("obzor", Obzor),
  createProtectedRoute("zakaz", Zakaz),
  createProtectedRoute("employ", Masters),
  createProtectedRoute("sklad", MarketWarehouse),
  createProtectedRoute("sklad/:id", MarketProductDetail),
  createProtectedRoute("sklad/add-product", AddProductPage),
  createProtectedRoute("sklad/add-product/:id", AddProductPage),
  createProtectedRoute("barcodes", BarcodePrintPage),
  createProtectedRoute("scales", ScalesPage),
  createProtectedRoute("sell", Sell),
  createProtectedRoute("sell/start", SellCashierPage),

  createProtectedRoute("sell/:id", SellDetail),
  createProtectedRoute("brand-category", BrandCategoryPage),
  createProtectedRoute("sklad-accounting", WarehouseAccounting),
  createProtectedRoute("departament/analytics", DepartmentAnalyticsChart),
  createProtectedRoute("contact", Contact),
  createProtectedRoute("additional-services", AdditionalServices),
  createProtectedRoute("analytics", Analytics),
  createProtectedRoute("shifts", Shifts),
  createProtectedRoute("shifts/:id", ShiftDetail),
  createProtectedRoute("departments", Department),
  createProtectedRoute("departments/:id", DepartmentDetails),
  createProtectedRoute("branch", Branch),
  createProtectedRoute("branch/:id", BranchDetails),
  createProtectedRoute("sector", SectorSelect),

  // Kassa routes (conditional based on role)
  ...(profile?.role === "owner"
    ? [
        createProtectedRoute("kassa/*", Kassa),
        createProtectedRoute("kassa/:id", KassaDet),
      ]
    : [createProtectedRoute("kassa/*", KassWorker)]),

  // Barber routes
  createProtectedRoute("barber/services", BarberServices),
  createProtectedRoute("barber/warehouse", Sklad),
  createProtectedRoute("barber/masters", MastersTabs),
  createProtectedRoute("barber/history", BarberHistory),
  createProtectedRoute("documents", BarberDocuments),
  createProtectedRoute("barber/records", Recorda),
  createProtectedRoute("barber/clients", BarberClients),
  createProtectedRoute("barber/cash-reports", BarberAnalitika),
  createProtectedRoute("barber/requests", BarberRequests),

  // Hostel routes
  createProtectedRoute("hostel/rooms", RoomsHalls),
  createProtectedRoute("hostel/bookings", HostelBookings),
  createProtectedRoute("hostel/bar", HostelBar),
  createProtectedRoute("hostel/clients", HostelClients),
  createProtectedRoute("hostel/documents", HostelDocuments),
  createProtectedRoute("hostel/warehouse", HostelWarehouse),
  createProtectedRoute("hostel/analytics", AnalyticsPage),
  createProtectedRoute("hostel/kassa/*", HostelKassa),

  // School routes
  createProtectedRoute("school/students", SchoolStudents),
  createProtectedRoute("school/groups", SchoolCoursesGroups),
  createProtectedRoute("school/lessons", SchoolLessonsRooms),
  createProtectedRoute("school/teachers", SchoolTeachers),
  createProtectedRoute("school/leads", SchoolLeads),
  createProtectedRoute("school/invoices", SchoolInvoices),
  createProtectedRoute("school/documents", SchoolDocuments),

  // Market routes
  createProtectedRoute("market/bar", MarketBar),
  createProtectedRoute("sklad", MarketWarehouse),
  createProtectedRoute("sklad/:id", MarketProductDetail),
  createProtectedRoute("market/cashier", MarketCashierPage),
  createProtectedRoute("market/categories", MarketCategories),
  createProtectedRoute("clients", MarketClients),
  createProtectedRoute("clients/:id", MarketClientDetails),
  createProtectedRoute("market/history", MarketHistory),
  createProtectedRoute("market/documents", MarketDocuments),
  createProtectedRoute("market/documents/create", CreateSaleDocument),
  createProtectedRoute("market/analytics", MarketAnalytics),

  // Cafe routes
  <Route element={<CafeLayout />} path="cafe">
    {[
      createProtectedRoute("analytics", CafeAnalytics),
      createProtectedRoute("documents", CafeDocuments),
      createProtectedRoute("cook", Cook),
      createProtectedRoute("inventory", CafeInventory),
      createProtectedRoute("menu", CafeMenu),
      <Route path="orders" key={"cafe/orders"} element={<CafeOrdersLayout />}>
        {[
          createProtectedRoute("*", CafeOrders, { index: true }),
          createProtectedRoute("history", CafeOrderHistory),
        ]}
      </Route>,
      createProtectedRoute("payroll", CafePayroll),
      createProtectedRoute("purchasing", CafePurchasing),
      createProtectedRoute("reports", CafeReports),
      createProtectedRoute("reservations", CafeReservations),
      createProtectedRoute("stock", CafeStock),
      createProtectedRoute("kassa/*", CafeKassa),
      createProtectedRoute("clients", CafeClients),
      createProtectedRoute("tables", CafeTables),
    ]}
  </Route>,

  // Building routes
  createProtectedRoute("building/work", BuildingWork),
  createProtectedRoute("building/objects", Objects),

  // Consulting routes
  createProtectedRoute("consulting/client", ConsultingClients),
  createProtectedRoute("consulting/client-requests", ConsultingClientRequests),
  createProtectedRoute("consulting/kassa/*", ConsultingCafeKassa),
  createProtectedRoute("consulting/teachers", ConsultingSchoolTeachers),
  createProtectedRoute("consulting/analytics", ConsultingAnalytics),
  createProtectedRoute("consulting/bookings", ConsultingBookings),
  createProtectedRoute("consulting/salary", ConsultingSalary),
  createProtectedRoute("consulting/sale", ConsultingSale),
  createProtectedRoute("consulting/services", ConsultingServices),

  // Warehouse routes
  createProtectedRoute("warehouse/warehouses", Warehouses),
  createProtectedRoute("warehouse/analytics", WarehouseAnalyticsRoute),
  createProtectedRoute("warehouse/clients", WarehouseClients),
  <Route
    path="warehouse/documents"
    key="warehouse/documents"
    element={
      <ProtectedRoute>
        <WarehouseDocumentsLayout />
      </ProtectedRoute>
    }
  >
    <Route
      key="warehouse/documents-index"
      index
      element={<Navigate to="all" replace />}
    />
    <Route
      key="warehouse/documents-create"
      path="create"
      element={<CreateWarehouseDocument />}
    />
    <Route
      key="warehouse/documents-type"
      path=":docType"
      element={<WarehouseDocuments />}
    />
    <Route
      key="warehouse/documents-money"
      path="money/:docType"
      element={<MoneyDocumentsPage />}
    />
  </Route>,
  createProtectedRoute("warehouse/agents", WarehouseAgents),
  createProtectedRoute("warehouse/movements", WarehouseMovements),
  createProtectedRoute("warehouse/products", WarehouseProducts),
  createProtectedRoute("warehouse/products/:id", WarehouseProductDetail),
  createProtectedRoute("warehouse/stocks", WarehouseStocks),
  createProtectedRoute("warehouse/stocks/:warehouse_id", WarehouseStocks),
  createProtectedRoute("warehouse/stocks/add-product", AddWarehouseProductPage),
  createProtectedRoute(
    "warehouse/stocks/add-product/:id",
    AddWarehouseProductPage
  ),
  createProtectedRoute("warehouse/supply", WarehouseSupply),
  createProtectedRoute("warehouse/write_offs", WarehouseWriteOffs),
  createProtectedRoute("warehouse/brands", WarehouseBrandCategory),
  createProtectedRoute("warehouse/categories", WarehouseBrandCategory),
  createProtectedRoute("warehouse/payment_categories", WarehouseBrandCategory),
  createProtectedRoute("warehouse/counterparties", Counterparties),
  createProtectedRoute("warehouse/counterparties/:id", CounterpartyDetail),

  // Production routes
  createProtectedRoute("production/warehouse", ProductionWarehouse),
  createProtectedRoute("production/analytics", ProductionAnalytics),
  createProtectedRoute("production/agents/:agentId/analytics", AgentAnalytics),
  createProtectedRoute("production/agents", ProductionAgents),
  createProtectedRoute("production/catalog", ProductionCatalog),
  createProtectedRoute("production/request", ProductionRequest),

  // Pilorama routes
  createProtectedRoute("pilorama/warehouse", PiloramaWarehouse),

  // Other routes
  createProtectedRoute("instagram", Instagram),
  createProtectedRoute("debts", Debts),
  createProtectedRoute("pending", Pending),
  createProtectedRoute("logistics", LogisticsPage),
  createProtectedRoute("logistics-analytics", LogisticsAnalytics),
];
