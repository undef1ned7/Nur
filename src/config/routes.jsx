import { Route, Navigate, useSearchParams, Outlet } from "react-router-dom";
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
import PosPrintSettings from "../Components/pages/Info/Settings/PosPrintSettings";

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
import CafeEmployEmployeeDetail from "../Components/Sectors/Barber/Masters/CafeEmployEmployeeDetail";
import MarketEmployEmployeeDetail from "../Components/Sectors/Barber/Masters/MarketEmployEmployeeDetail";

// Barber
import BarberServices from "../Components/Sectors/Barber/Services/Services";
import BarberHistory from "../Components/Sectors/Barber/History/History";
import BarberDocuments from "../Components/Sectors/Barber/Documents/Documents";
import BarberClientDocuments from "../Components/Sectors/Barber/ClientDocuments/BarberClientDocuments";
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
import MarketSupplierReceiptPage from "../Components/Sectors/Market/Warehouse/SupplierReceiptPage";
import MarketSupplierReceiptsListPage from "../Components/Sectors/Market/Warehouse/SupplierReceiptsListPage";
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
import CafeCookRoute from "../Components/Sectors/cafe/Cook/CafeCookRoute";
import CafeInventory from "../Components/Sectors/cafe/Inventory/CafeInventory";
import CafeMenu from "../Components/Sectors/cafe/Menu/Menu";
import CafeMenuItemPage from "../Components/Sectors/cafe/Menu/CafeMenuItemPage";
import CafeOrders from "../Components/Sectors/cafe/Orders/Orders";
import CafePayroll from "../Components/Sectors/cafe/Payroll/Payroll";
import CafePurchasing from "../Components/Sectors/cafe/Purchasing/Purchasing";
import CafeReports from "../Components/Sectors/cafe/Reports/Reports";
import CafeReservations from "../Components/Sectors/cafe/Reservations/Reservations";
import CafeStock from "../Components/Sectors/cafe/Stock/Stock";
import CafeKassa from "../Components/Sectors/cafe/kassaCafe/kassa";
import CafeClients from "../Components/Sectors/cafe/Clients/Clients";
import CafeTables from "../Components/Sectors/cafe/Tables/Tables";
import CafeCosting from "../Components/Sectors/cafe/Costing/Costing";

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
import WarehouseMovements from "../Components/Sectors/Warehouse/Movements/Movements";
import WarehouseProducts from "../Components/Sectors/Warehouse/Products/Products";
import WarehouseProductDetail from "../Components/Sectors/Warehouse/Products/WarehouseProductDetail";
import WarehouseStocks from "../Components/Sectors/Warehouse/Stocks/Stocks";
import AgentStocks from "../Components/Sectors/Warehouse/AgentStocks/AgentStocks";
import AddWarehouseProductPage from "../Components/Sectors/Warehouse/Stocks/AddWarehouseProductPage";
import WarehouseSupply from "../Components/Sectors/Warehouse/Supply/Supply";
import WarehouseWriteOffs from "../Components/Sectors/Warehouse/WriteOffs/WriteOffs";
import Warehouses from "../Components/Sectors/Warehouse/Warehouses/Warehouses";
import WarehouseBrandCategory from "../Components/Sectors/Warehouse/BrandCategory/BrandCategoryPage";
import WarehouseDocumentsLayout from "../Components/Sectors/Warehouse/Documents/DocumentsLayout";
import WarehouseDocuments from "../Components/Sectors/Warehouse/Documents/Documents";
import CreateWarehouseDocument from "../Components/Sectors/Warehouse/Documents/CreateSaleDocument";
import MoneyDocumentsPage from "../Components/Sectors/Warehouse/Money/MoneyDocumentsPage";
import WarehouseKassa from "../Components/Sectors/Warehouse/Kassa/WarehouseKassa";
import WarehouseAgents from "../Components/Sectors/Warehouse/Agents/Agents";
import WarehouseStartAgentGate from "../Components/Sectors/Warehouse/WarehouseStartAgentGate";
// Production
import ProductionWarehouse from "../Components/Sectors/Production/Warehouse/ProductionWarehouse";
import ProductionWarehouseProductDetail from "../Components/Sectors/Production/Warehouse/ProductionWarehouseProductDetail";
import ProductionAgents from "../Components/Sectors/Production/ProductionAgents/ProductionAgents";
import ProductionCatalog from "../Components/Sectors/Production/Catalog/ProductionCatalog";
import ProductionRequest from "../Components/Sectors/Production/Request/ProductionRequest";
import AgentAnalytics from "../Components/Sectors/Production/Analytics/AgentAnalytics";
import ProductionAnalytics from "../Components/Sectors/Production/Analytics/ProductionAnalytics";
import ProductionSell from "../Components/Sectors/Production/Sell/ProductionSell";
import ProductionSellStartPage from "../Components/Sectors/Production/Sell/ProductionSellStartPage";
import ProductionFinishedGoodsAddPage from "../Components/Sectors/Production/FinishedGoods/ProductionFinishedGoodsAddPage";
import ProductionStartAgentGate from "../Components/Sectors/Production/ProductionStartAgentGate";

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

import BuildingLayout, {
  BuildingAnalytics,
  BuildingCashRegister,
  BuildingCashRegisterTreatyDetail,
  BuildingCashRegisterSalaryPayrollPaymentsPage,
  BuildingClients,
  SupplierCreatePage,
  SupplierDetailPage,
  ContractorCreatePage,
  ContractorDetailPage,
  BuildingClientDetail,
  BuildingNotification,
  BuildingTaskDetail,
  BuildingProcurement,
  BuildingProjects,
  BuildingProjectDetail,
  BuildingSalary,
  BuildingSalaryEmployeeDetail,
  BuildingSalaryPayrollDetail,
  BuildingSalaryLineDetail,
  BuildingSell,
  BuildingStock,
  BuildingTreaty,
  BuildingTreatyDetail,
  BuildingProcurementDetail,
  BuildingStockDetail,
  BuildingStockTransferDetail,
  BuildingWorkProcess,
  BuildingWorkProcessDetail,
  BuildingDrawings,
  BuildingEmployees,
} from "../Components/pages/Building";

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

const createPermissionProtectedRoute = (
  path,
  Component,
  permissionKey,
  profile,
  props,
) => (
  <Route
    key={path}
    path={path}
    element={
      <ProtectedRoute>
        {profile?.[permissionKey] ? <Component /> : <Navigate to="/crm/cafe/menu" replace />}
      </ProtectedRoute>
    }
    {...props}
  />
);

/** Производство: маршруты с агентом недоступны на тарифе «Старт». */
const createProductionAgentProtectedRoute = (path, Component, props) => (
  <Route
    key={path}
    path={path}
    element={
      <ProtectedRoute>
        <ProductionStartAgentGate>
          <Component />
        </ProductionStartAgentGate>
      </ProtectedRoute>
    }
    {...props}
  />
);

/** Склад: маршруты агента недоступны на тарифе «Старт». */
const createWarehouseAgentProtectedRoute = (path, Component, props) => (
  <Route
    key={path}
    path={path}
    element={
      <ProtectedRoute>
        <WarehouseStartAgentGate>
          <Component />
        </WarehouseStartAgentGate>
      </ProtectedRoute>
    }
    {...props}
  />
);

/**
 * Аналитика склада:
 * - новая аналитика агента (WarehouseAgentAnalytics) — для агента без agent_id или при agent_id в URL;
 * - аналитика владельца/админа (WarehouseAnalytics) — во всех остальных случаях.
 *
 * Ожидаемые структуры ответов API:
 *
 * 1) Владелец/админ — общая аналитика склада
 *    GET /api/warehouse/owner/analytics/?period=month&date=2026-02-05
 *
 *    {
 *      "period": "month",
 *      "date_from": "2026-01-07",
 *      "date_to": "2026-02-05",
 *      "summary": {
 *        "requests_approved": 8,
 *        "items_approved": "20.000",
 *        "sales_count": 0,
 *        "sales_amount": "0.00",
 *        "on_hand_qty": "20.000",
 *        "on_hand_amount": "3709.08000"
 *      },
 *      "charts": {
 *        "sales_by_date": []
 *      },
 *      "top_agents": {
 *        "by_sales": [],
 *        "by_received": [
 *          {
 *            "agent_id": "4478407d-660b-4683-a0af-ceb15c25b507",
 *            "agent_name": "agentt agentt",
 *            "items_approved": "16.000"
 *          },
 *          {
 *            "agent_id": "062ca63c-0fe5-4070-ab01-a9ef554fce1e",
 *            "agent_name": "agent agent",
 *            "items_approved": "2.000"
 *          },
 *          {
 *            "agent_id": "fab742f8-66ca-48fa-b318-9ac8a48fceab",
 *            "agent_name": "warehouse warehouse",
 *            "items_approved": "2.000"
 *          }
 *        ]
 *      },
 *      "details": {
 *        "warehouses": [
 *          {
 *            "warehouse_id": "8f5d5f2c-6de6-4e2b-9747-273bc5aa3a19",
 *            "warehouse_name": "new склад",
 *            "carts_approved": 5,
 *            "items_approved": "8.000",
 *            "sales_count": 0,
 *            "sales_amount": "0.00",
 *            "on_hand_qty": "8.000",
 *            "on_hand_amount": "589.08000"
 *          },
 *          {
 *            "warehouse_id": "4cf95f0e-e72e-4621-8c4c-e5c88bafb09e",
 *            "warehouse_name": "JAY",
 *            "carts_approved": 3,
 *            "items_approved": "12.000",
 *            "sales_count": 0,
 *            "sales_amount": "0.00",
 *            "on_hand_qty": "12.000",
 *            "on_hand_amount": "3120.00000"
 *          }
 *        ],
 *        "sales_by_product": []
 *      }
 *    }
 *
 * 2) Владелец/админ — аналитика конкретного агента
 *    GET /api/warehouse/owner/agents/{agent_id}/analytics/?period=month&date=2026-02-05
 *
 *    {
 *      "period": "month",
 *      "date_from": "2026-01-07",
 *      "date_to": "2026-02-05",
 *      "summary": {
 *        "requests_submitted": 6,
 *        "requests_approved": 6,
 *        "requests_rejected": 0,
 *        "items_approved": "16.000",
 *        "sales_count": 0,
 *        "sales_qty": "0.000",
 *        "sales_amount": "0.00",
 *        "returns_count": 0,
 *        "returns_amount": "0.00",
 *        "write_off_count": 0,
 *        "write_off_qty": "0.000",
 *        "on_hand_qty": "16.000",
 *        "on_hand_amount": "3485.52000"
 *      },
 *      "charts": {
 *        "requests_by_date": [
 *          {
 *            "date": "2026-02-05",
 *            "carts_approved": 6,
 *            "items_approved": 16.0
 *          }
 *        ],
 *        "sales_by_date": []
 *      },
 *      "details": {
 *        "sales_by_product": [],
 *        "sales_by_warehouse": []
 *      }
 *    }
 */

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
    key="/services/:company_slug/booking"
    path="/services/:company_slug/booking"
    element={<OnlineBooking />}
  />,
  <Route
    key="/dentistry/:company_slug/booking"
    path="/dentistry/:company_slug/booking"
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
  // Скрытая страница тонкой настройки POS‑печати (ESC/POS)
  createProtectedRoute("pos-print-settings", PosPrintSettings),
  createProtectedRoute("raspisanie", Raspisanie),
  createProtectedRoute("registration", Registration),
  createProtectedRoute("obzor", Obzor),
  createProtectedRoute("zakaz", Zakaz),
  createProtectedRoute("employ/:employeeId", CafeEmployEmployeeDetail),
  createProtectedRoute("employ/market/:employeeId", MarketEmployEmployeeDetail),
  createProtectedRoute("employ", Masters),
  createProtectedRoute("sklad", MarketWarehouse),
  createProtectedRoute("sklad/:id", MarketProductDetail),
  createProtectedRoute("sklad/add-product", AddProductPage),
  createProtectedRoute("sklad/add-product/:id", AddProductPage),
  createProtectedRoute("market/procurement/receipt", MarketSupplierReceiptPage),
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
  createProtectedRoute("barber/client-documents", BarberClientDocuments),
  createProtectedRoute("barber/cash-reports", BarberAnalitika),
  createProtectedRoute("barber/requests", BarberRequests),
  createProtectedRoute("services/services", BarberServices),
  createProtectedRoute("services/warehouse", Sklad),
  createProtectedRoute("services/masters", MastersTabs),
  createProtectedRoute("services/history", BarberHistory),
  createProtectedRoute("services/documents", BarberDocuments),
  createProtectedRoute("services/records", Recorda),
  createProtectedRoute("services/clients", BarberClients),
  createProtectedRoute("services/client-documents", BarberClientDocuments),
  createProtectedRoute("services/cash-reports", BarberAnalitika),
  createProtectedRoute("services/requests", BarberRequests),
  createProtectedRoute("dentistry/services", BarberServices),
  createProtectedRoute("dentistry/warehouse", Sklad),
  createProtectedRoute("dentistry/masters", MastersTabs),
  createProtectedRoute("dentistry/history", BarberHistory),
  createProtectedRoute("dentistry/documents", BarberDocuments),
  createProtectedRoute("dentistry/records", Recorda),
  createProtectedRoute("dentistry/clients", BarberClients),
  createProtectedRoute("dentistry/client-documents", BarberClientDocuments),
  createProtectedRoute("dentistry/cash-reports", BarberAnalitika),
  createProtectedRoute("dentistry/requests", BarberRequests),

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
  createProtectedRoute("market/procurement", MarketSupplierReceiptsListPage),
  <Route
    key="market/suppliers"
    path="market/suppliers"
    element={
      <ProtectedRoute>
        <MarketClients forcedTab="suppliers" hideTabs />
      </ProtectedRoute>
    }
  />,
  createProtectedRoute("sklad", MarketWarehouse),
  createProtectedRoute("sklad/:id", MarketProductDetail),
  createProtectedRoute("market/procurement/receipt", MarketSupplierReceiptPage),
  createProtectedRoute("market/cashier", MarketCashierPage),
  createProtectedRoute("market/categories", MarketCategories),
  createProtectedRoute("clients", MarketClients),
  createProtectedRoute("clients/:id", MarketClientDetails),
  createProtectedRoute("market/history", MarketHistory),
  createProtectedRoute("market/documents", MarketDocuments),
  createProtectedRoute("market/documents/create", CreateSaleDocument),
  createProtectedRoute("market/analytics", MarketAnalytics),

  <Route element={<BuildingLayout />} path="building">
    {[
      createProtectedRoute("analytics", BuildingAnalytics),
      createProtectedRoute("cash-register", BuildingCashRegister),
      createProtectedRoute(
        "cash-register/treaty/:treatyId",
        BuildingCashRegisterTreatyDetail,
      ),
      createProtectedRoute(
        "cash-register/salary-payroll/:payrollId",
        BuildingCashRegisterSalaryPayrollPaymentsPage,
      ),
      createProtectedRoute("clients", BuildingClients),
      createProtectedRoute("clients/:id", BuildingClientDetail),
      createProtectedRoute("clients/suppliers/new", SupplierCreatePage),
      createProtectedRoute("clients/suppliers/:id", SupplierDetailPage),
      createProtectedRoute("clients/contractors/new", ContractorCreatePage),
      createProtectedRoute("clients/contractors/:id", ContractorDetailPage),
      createProtectedRoute("employees", BuildingEmployees),
      createProtectedRoute("notification", BuildingNotification),
      createProtectedRoute("notification/new", BuildingTaskDetail),
      createProtectedRoute("notification/:id", BuildingTaskDetail),
      createProtectedRoute("work", BuildingWorkProcess),
      createProtectedRoute("work/:id", BuildingWorkProcessDetail),
      createProtectedRoute("procurement", BuildingProcurement),
      createProtectedRoute("procurement/:id", BuildingProcurementDetail),
      createProtectedRoute("projects", BuildingProjects),
      createProtectedRoute("projects/:id", BuildingProjectDetail),
      createProtectedRoute("drawings", BuildingDrawings),
      createProtectedRoute("salary", BuildingSalary),
      createProtectedRoute("salary/employee/:id", BuildingSalaryEmployeeDetail),
      createProtectedRoute("salary/payroll/:id", BuildingSalaryPayrollDetail),
      createProtectedRoute(
        "salary/payroll/:payrollId/line/:lineId",
        BuildingSalaryLineDetail,
      ),
      createProtectedRoute("sell", BuildingSell),
      createProtectedRoute("stock", BuildingStock),
      createProtectedRoute("stock/:id", BuildingStockDetail),
      createProtectedRoute(
        "stock/:warehouseId/transfer/:id",
        BuildingStockTransferDetail,
      ),
      createProtectedRoute("treaty", BuildingTreaty),
      createProtectedRoute("treaty/new", BuildingTreatyDetail),
      createProtectedRoute("treaty/:id", BuildingTreatyDetail),
    ]}
  </Route>,
  // Cafe routes
  <Route key="cafe" element={<CafeLayout />} path="cafe">
    {[
      createProtectedRoute("analytics", CafeAnalytics),
      createProtectedRoute("documents", CafeDocuments),
      createProtectedRoute("cook", CafeCookRoute),
      createProtectedRoute("inventory", CafeInventory),
      createProtectedRoute("menu/item/new", CafeMenuItemPage),
      createProtectedRoute("menu/item/:id", CafeMenuItemPage),
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
      createPermissionProtectedRoute(
        "costing",
        CafeCosting,
        "can_view_cafe_calculation",
        profile,
      ),
      createPermissionProtectedRoute(
        "costing/preparations/:preparationId",
        CafeCosting,
        "can_view_cafe_calculation",
        profile,
      ),
      createProtectedRoute("kassa/*", CafeKassa),
      createProtectedRoute("clients", CafeClients),
      createProtectedRoute("tables", CafeTables),
    ]}
  </Route>,

  // Building routes
  // createProtectedRoute("building/work", BuildingWork),
  // createProtectedRoute("building/objects", Objects),

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
  createProtectedRoute(
    "warehouse/warehouses",
    profile?.role !== "owner" ? AgentStocks : Warehouses,
  ),
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
      key="warehouse/documents-edit"
      path="edit/:id"
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
  createWarehouseAgentProtectedRoute("warehouse/agents", WarehouseAgents),
  createProtectedRoute("warehouse/movements", WarehouseMovements),
  createProtectedRoute("warehouse/products", WarehouseProducts),
  createProtectedRoute("warehouse/products/:id", WarehouseProductDetail),
  createProtectedRoute("warehouse/stocks", WarehouseStocks),
  createProtectedRoute("warehouse/stocks/:warehouse_id", WarehouseStocks),
  ...(profile?.role === "agent"
    ? [
        createWarehouseAgentProtectedRoute(
          "warehouse/agent-stocks",
          AgentStocks,
        ),
      ]
    : []),
  createProtectedRoute("warehouse/stocks/add-product", AddWarehouseProductPage),
  createProtectedRoute(
    "warehouse/stocks/add-product/:id",
    AddWarehouseProductPage,
  ),
  <Route
    key="warehouse/kassa"
    path="warehouse/kassa"
    element={
      <ProtectedRoute>
        <Outlet />
      </ProtectedRoute>
    }
  >
    <Route key="warehouse/kassa-index" index element={<WarehouseKassa />} />
    <Route key="warehouse/kassa-id" path=":id" element={<WarehouseKassa />} />
  </Route>,
  createProtectedRoute("warehouse/supply", WarehouseSupply),
  createProtectedRoute("warehouse/write_offs", WarehouseWriteOffs),
  createProtectedRoute("warehouse/brands", WarehouseBrandCategory),
  createProtectedRoute("warehouse/categories", WarehouseBrandCategory),
  createProtectedRoute("warehouse/payment_categories", WarehouseBrandCategory),
  createProtectedRoute("warehouse/counterparties", Counterparties),
  createProtectedRoute("warehouse/counterparties/:id", CounterpartyDetail),

  // Production routes
  createProtectedRoute("production/warehouse", ProductionWarehouse),
  createProtectedRoute(
    "production/warehouse/add-product",
    ProductionFinishedGoodsAddPage,
  ),
  createProtectedRoute(
    "production/warehouse/:id",
    ProductionWarehouseProductDetail,
  ),
  createProtectedRoute("production/analytics", ProductionAnalytics),
  createProductionAgentProtectedRoute(
    "production/agents/:agentId/analytics",
    AgentAnalytics,
  ),
  createProductionAgentProtectedRoute("production/agents", ProductionAgents),
  createProductionAgentProtectedRoute("production/catalog", ProductionCatalog),
  createProductionAgentProtectedRoute("production/request", ProductionRequest),
  createProtectedRoute("production/sell", ProductionSell),
  createProtectedRoute("production/sell/start", ProductionSellStartPage),

  // Pilorama routes
  createProtectedRoute("pilorama/warehouse", PiloramaWarehouse),

  // Other routes
  createProtectedRoute("instagram", Instagram),
  createProtectedRoute("debts", Debts),
  createProtectedRoute("pending", Pending),
  createProtectedRoute("logistics", LogisticsPage),
  createProtectedRoute("logistics-analytics", LogisticsAnalytics),
];
