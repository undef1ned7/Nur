import { useEffect, useState } from "react";
import { useDispatch } from "react-redux";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import "./App.scss";
import Login from "./Components/Auth/Login/Login";
import Register from "./Components/Auth/Register/Register";
import Department from "./Components/Department/Department";
import DepartmentAnalyticsChart from "./Components/DepartmentAnalyticsChart/DepartmentAnalyticsChart";
import DepartmentDetails from "./Components/DepartmentDetails/DepartmentDetails";
import BrandCategoryPage from "./Components/Deposits/BrandCategoryPage/BrandCategoryPage";
import Kassa from "./Components/Deposits/Kassa/Kassa";
import KassWorker from "./Components/Deposits/KassaWorker/Kassa";
import KassaDet from "./Components/Deposits/KassaWorkerDet/Kassa";
import Obzor from "./Components/Deposits/Obzor/Obzor";
import Raspisanie from "./Components/Deposits/Raspisanie/Raspisanie";
import Sklad from "./Components/Deposits/Sklad/Sklad";
import WarehouseAccounting from "./Components/Deposits/Warehouse/WarehouseAccounting";
import Zakaz from "./Components/Deposits/Zakaz/Zakaz";
import Layout from "./Components/Layout/Layout";
import Analytics from "./Components/pages/Analytics/Analytics";
// import History from "./Components/pages/History/History";
import Contact from "./Components/Contact/Contact";
import Debts from "./Components/Debts/Debts";
import Instagram from "./Components/Instagram/Instagram";
import AdditionalServices from "./Components/pages/AdditionalServices/AdditionalServices";
import Set from "./Components/pages/Info/Settings/Settings";
import Landing from "./Components/pages/Landing/Landing";
import Registration from "./Components/pages/Registration/Registration";
import Sell from "./Components/pages/Sell/Sell";
import SellDetail from "./Components/pages/Sell/SellDetail";
import ApplicationList from "./Components/pages/SubmitApplication/ApplicationList";
import SubmitApplication from "./Components/pages/SubmitApplication/SubmitApplication";
import CashReports from "./Components/Sectors/Barber/CashReports/CashReports";
import BarberClients from "./Components/Sectors/Barber/Clients/Clients";
import BarberDocuments from "./Components/Sectors/Barber/Documents/Documents";
import BarberHistory from "./Components/Sectors/Barber/History/History";
import Masters from "./Components/Sectors/Barber/Masters/Masters";
import MastersTabs from "./Components/Sectors/Barber/Masters/MastersTabs";
import Recorda from "./Components/Sectors/Barber/Recorda/Recorda";
import BarberServices from "./Components/Sectors/Barber/Services/Services";
import BuildingWork from "./Components/Sectors/Building/BuildingWork/BuildingWork";
import Objects from "./Components/Sectors/Building/Objects/Objects";
import CafeAnalytics from "./Components/Sectors/cafe/Analytics/Analytics";
import CafeClients from "./Components/Sectors/cafe/Clients/Clients";
import CafeDocuments from "./Components/Sectors/cafe/Documents/Documents";
import CafeKassa from "./Components/Sectors/cafe/kassaCafe/kassa";
import CafeMenu from "./Components/Sectors/cafe/Menu/Menu";
import CafeOrders from "./Components/Sectors/cafe/Orders/Orders";
import CafePayroll from "./Components/Sectors/cafe/Payroll/Payroll";
import CafePurchasing from "./Components/Sectors/cafe/Purchasing/Purchasing";
import CafeReports from "./Components/Sectors/cafe/Reports/Reports";
import CafeReservations from "./Components/Sectors/cafe/Reservations/Reservations";
import CafeStaff from "./Components/Sectors/cafe/Staff/Staff";
import CafeStock from "./Components/Sectors/cafe/Stock/Stock";
import CafeTables from "./Components/Sectors/cafe/Tables/Tables";
import ConsultingClientRequests from "./Components/Sectors/Consulting/client-requests/client-requests";
import ConsultingClients from "./Components/Sectors/Consulting/client/client";
import ConsultingCafeKassa from "./Components/Sectors/Consulting/Kassa/Kassa";
import ConsultingSalary from "./Components/Sectors/Consulting/salary/salary";
import ConsultingSale from "./Components/Sectors/Consulting/sale/sale";
import ConsultingServices from "./Components/Sectors/Consulting/services/services";
import ConsultingSchoolTeachers from "./Components/Sectors/Consulting/Teachers/Teachers";
import { AnalyticsPage } from "./Components/Sectors/Hostel/Analytics/AnalyticsPage";
import HostelBar from "./Components/Sectors/Hostel/Bar/Bar";
import HostelBookings from "./Components/Sectors/Hostel/Bookings/Bookings";
import HostelClients from "./Components/Sectors/Hostel/Clients/Clients";
import HostelDocuments from "./Components/Sectors/Hostel/Documents/Documents";
import HostelKassa from "./Components/Sectors/Hostel/kassa/kassa";
import RoomsHalls from "./Components/Sectors/Hostel/RoomsHalls/RoomsHalls";
import HostelWarehouse from "./Components/Sectors/Hostel/Warehouse/Warehouse";
import MarketAnalytics from "./Components/Sectors/Market/Analytics/Analytics";
import MarketBar from "./Components/Sectors/Market/Bar/Bar";
import MarketCategories from "./Components/Sectors/Market/Categories/Categories";
import MarketClientDetails from "./Components/Sectors/Market/ClientDetails/ClientDetails";
import MarketClients from "./Components/Sectors/Market/Clients/Clients";
import MarketDocuments from "./Components/Sectors/Market/Documents/Documents";
import MarketHistory from "./Components/Sectors/Market/History/History";
import MarketWarehouse from "./Components/Sectors/Market/Warehouse/Warehouse";
// import ProductionOrders from "./Components/Sectors/Production/Orders/Orders";
import ProductionWarehouse from "./Components/Sectors/Production/Warehouse/ProductionWarehouse";
import SchoolCoursesGroups from "./Components/Sectors/School/CoursesGroups/CoursesGroups";
import SchoolDocuments from "./Components/Sectors/School/Documents/Documents";
import SchoolInvoices from "./Components/Sectors/School/Invoices/Invoices";
import SchoolLeads from "./Components/Sectors/School/Leads/Leads";
import SchoolLessonsRooms from "./Components/Sectors/School/LessonsRooms/LessonsRooms";
import SchoolStudents from "./Components/Sectors/School/Students/Students";
import SchoolTeachers from "./Components/Sectors/School/Teachers/Teachers";
import SectorSelect from "./Components/Sectors/SectorSelect";
import WarehouseAnalytics from "./Components/Sectors/Warehouse/Analytics/Analytics";
import WarehouseClients from "./Components/Sectors/Warehouse/Clients/Clients";
import WarehouseDirectories from "./Components/Sectors/Warehouse/Directories/Directories";
import WarehouseMovements from "./Components/Sectors/Warehouse/Movements/Movements";
import WarehouseProducts from "./Components/Sectors/Warehouse/Products/Products";
import WarehouseStocks from "./Components/Sectors/Warehouse/Stocks/Stocks";
import WarehouseSupply from "./Components/Sectors/Warehouse/Supply/Supply";
import WarehouseWriteOffs from "./Components/Sectors/Warehouse/WriteOffs/WriteOffs";
import ProtectedRoute from "./ProtectedRoute";
import { getCompany } from "./store/creators/userCreators";
import { useUser } from "./store/slices/userSlice";
import ConsultingReports from "./Components/Sectors/Consulting/Kassa/Reports/Reports";
import ConsultingBookings from "./Components/Sectors/Consulting/Bookings/Bookings";
import ConsultingAnalytics from "./Components/Sectors/Consulting/Analytics/Analytics";
import ProductionAgents from "./Components/Sectors/Production/ProductionAgents/ProductionAgents";
import Pending from "./Components/pages/Pending/Pending";
import PiloramaWarehouse from "./Components/Sectors/Pilorama/PiloramaWarehouse/PiloramaWarehouse";
import ProductionCatalog from "./Components/Sectors/Production/Catalog/ProductionCatalog";
import Cook from "./Components/Sectors/cafe/Cook/Cook";
import CafeInventory from "./Components/Sectors/cafe/Inventory/CafeInventory";
import Branch from "./Components/pages/Branch/Branch";
import BranchDetails from "./Components/pages/Branch/BranchDetails";
import Logistics from "./Components/pages/logistics/Logistics";
import LogisticsPage from "./Components/Sectors/logistics/LogisticsPage/LogisticsPage";
// import ClientDebtDetail from "./Components/Sectors/Building/ClientDebtDetail";

function App() {
  // const { company } = useUser();
  const [profile, setProfile] = useState(null);

  const fetchProfile = async () => {
    try {
      const token = localStorage.getItem("accessToken");
      if (!token) return;

      const response = await fetch("https://app.nurcrm.kg/api/users/profile/", {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setProfile(data);
      } else {
        console.error("Ошибка загрузки профиля");
      }
    } catch (err) {
      console.error("Ошибка запроса профиля:", err);
    }
  };

  const dispatch = useDispatch();
  const { accessToken } = useUser();

  useEffect(() => {
    if (accessToken) {
      dispatch(getCompany());
    }
  }, [accessToken, dispatch]);

  useEffect(() => {
    fetchProfile();
  }, []);

  // console.log(profile);

  // дата фио стоимость покупки статус (оплачено. ожидает. долг. отказ)

  return (
    <BrowserRouter>
      <Routes>
        <>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<Landing />} />
          <Route path="/register" element={<Register />} />
          <Route path="/submit-application" element={<SubmitApplication />} />
          <Route
            path="/get-application-list"
            element={
              <ProtectedRoute>
                <ApplicationList />
              </ProtectedRoute>
            }
          />

          <Route path="/crm" element={<Layout />}>
            <Route
              path="set"
              element={
                <ProtectedRoute>
                  <Set />
                </ProtectedRoute>
              }
            />
            <Route
              path="raspisanie"
              element={
                <ProtectedRoute>
                  <Raspisanie />
                </ProtectedRoute>
              }
            />
            <Route
              path="registration"
              element={
                <ProtectedRoute>
                  <Registration />
                </ProtectedRoute>
              }
            />
            <Route
              path="obzor"
              element={
                <ProtectedRoute>
                  <Obzor />
                </ProtectedRoute>
              }
            />
            <Route
              path="zakaz"
              element={
                <ProtectedRoute>
                  <Zakaz />
                </ProtectedRoute>
              }
            />
            <Route
              path="employ"
              element={
                <ProtectedRoute>
                  <Masters />
                </ProtectedRoute>
              }
            />
            <Route
              path="sklad"
              element={
                <ProtectedRoute>
                  <Sklad />
                </ProtectedRoute>
              }
            />
            <Route
              path="sell"
              element={
                <ProtectedRoute>
                  <Sell />
                </ProtectedRoute>
              }
            />
            <Route
              path="sell/:id"
              element={
                <ProtectedRoute>
                  <SellDetail />
                </ProtectedRoute>
              }
            />
            {/* <Route path="vitrina" element={<Vitrina />} /> */}
            <Route
              path="brand-category"
              element={
                <ProtectedRoute>
                  <BrandCategoryPage />
                </ProtectedRoute>
              }
            />
            {/* <Route
              path="clients"
              element={
                <ProtectedRoute>
                  <ClientsTable />
                </ProtectedRoute>
              }
            /> */}
            {/* <Route
              path="clients/:id"
              element={
                <ProtectedRoute>
                  <MarketClientDetails />
                </ProtectedRoute>
              }
            /> */}
            <Route
              path="sklad-accounting"
              element={
                <ProtectedRoute>
                  <WarehouseAccounting />
                </ProtectedRoute>
              }
            />
            <Route
              path="departament/analytics"
              element={
                <ProtectedRoute>
                  <DepartmentAnalyticsChart />
                </ProtectedRoute>
              }
            />
            <Route
              path="contact"
              element={
                <ProtectedRoute>
                  <Contact />
                </ProtectedRoute>
              }
            />
            <Route
              path="additional-services"
              element={
                <ProtectedRoute>
                  <AdditionalServices />
                </ProtectedRoute>
              }
            />
            {profile?.role === "owner" ? (
              <>
                <Route
                  path="kassa*"
                  element={
                    <ProtectedRoute>
                      <Kassa />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="kassa/:id"
                  element={
                    <ProtectedRoute>
                      <KassaDet />
                    </ProtectedRoute>
                  }
                />
              </>
            ) : (
              <Route
                path="kassa*"
                element={
                  <ProtectedRoute>
                    <KassWorker />
                  </ProtectedRoute>
                }
              />
            )}

            <Route
              path="analytics"
              element={
                <ProtectedRoute>
                  <Analytics />
                </ProtectedRoute>
              }
            />
            {/* <Route path="history" element={<History />} /> */}
            <Route
              path="departments"
              element={
                <ProtectedRoute>
                  <Department />
                </ProtectedRoute>
              }
            />
            <Route
              path="departments/:id"
              element={
                <ProtectedRoute>
                  <DepartmentDetails />
                </ProtectedRoute>
              }
            />

            <Route
              path="branch"
              element={
                <ProtectedRoute>
                  <Branch />
                </ProtectedRoute>
              }
            />
            {/* <Route
              path="building/objects"
              element={
                <ProtectedRoute>
                  <Branch />
                </ProtectedRoute>
              }
            /> */}
            <Route
              path="branch/:id"
              element={
                <ProtectedRoute>
                  <BranchDetails />
                </ProtectedRoute>
              }
            />

            <Route
              path="sector"
              element={
                <ProtectedRoute>
                  <SectorSelect />
                </ProtectedRoute>
              }
            />
            {/* Barber */}
            {/* <Route
                path="barber/appointments"
                element={<BarberAppointments />}
              /> */}
            <Route
              path="barber/services"
              element={
                <ProtectedRoute>
                  <BarberServices />
                </ProtectedRoute>
              }
            />
            <Route
              path="barber/warehouse"
              element={
                <ProtectedRoute>
                  <Sklad />
                </ProtectedRoute>
              }
            />
            {/* <Route
              path="barber/warehouse"
              element={
                <ProtectedRoute>
                  <Sklad />
                </ProtectedRoute>
              }
            /> */}
            <Route
              path="barber/masters"
              element={
                <ProtectedRoute>
                  <MastersTabs />
                </ProtectedRoute>
              }
            />
            <Route
              path="barber/history"
              element={
                <ProtectedRoute>
                  <BarberHistory />
                </ProtectedRoute>
              }
            />
            <Route
              path="documents"
              element={
                <ProtectedRoute>
                  <BarberDocuments />
                </ProtectedRoute>
              }
            />

            <Route
              path="barber/records"
              element={
                <ProtectedRoute>
                  <Recorda />
                </ProtectedRoute>
              }
            />
            <Route
              path="barber/clients"
              element={
                <ProtectedRoute>
                  <BarberClients />
                </ProtectedRoute>
              }
            />
            <Route
              path="barber/cash-reports"
              element={
                <ProtectedRoute>
                  <CashReports />
                </ProtectedRoute>
              }
            />
            {/* Hostel */}
            <Route
              path="hostel/rooms"
              element={
                <ProtectedRoute>
                  <RoomsHalls />
                </ProtectedRoute>
              }
            />
            <Route
              path="hostel/bookings"
              element={
                <ProtectedRoute>
                  <HostelBookings />
                </ProtectedRoute>
              }
            />
            <Route
              path="hostel/bar"
              element={
                <ProtectedRoute>
                  <HostelBar />
                </ProtectedRoute>
              }
            />
            <Route
              path="hostel/clients"
              element={
                <ProtectedRoute>
                  <HostelClients />
                </ProtectedRoute>
              }
            />
            <Route
              path="hostel/documents"
              element={
                <ProtectedRoute>
                  <HostelDocuments />
                </ProtectedRoute>
              }
            />
            <Route
              path="hostel/warehouse"
              element={
                <ProtectedRoute>
                  <HostelWarehouse />
                </ProtectedRoute>
              }
            />
            <Route
              path="hostel/analytics"
              element={
                <ProtectedRoute>
                  <AnalyticsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="hostel/kassa*"
              element={
                <ProtectedRoute>
                  <HostelKassa />
                </ProtectedRoute>
              }
            />
            {/* Сделать */}

            {/* School */}
            <Route
              path="school/students"
              element={
                <ProtectedRoute>
                  <SchoolStudents />
                </ProtectedRoute>
              }
            />
            <Route
              path="school/groups"
              element={
                <ProtectedRoute>
                  <SchoolCoursesGroups />
                </ProtectedRoute>
              }
            />
            <Route
              path="school/lessons"
              element={
                <ProtectedRoute>
                  <SchoolLessonsRooms />
                </ProtectedRoute>
              }
            />
            <Route
              path="school/teachers"
              element={
                <ProtectedRoute>
                  <SchoolTeachers />
                </ProtectedRoute>
              }
            />
            <Route
              path="school/leads"
              element={
                <ProtectedRoute>
                  <SchoolLeads />
                </ProtectedRoute>
              }
            />
            <Route
              path="school/invoices"
              element={
                <ProtectedRoute>
                  <SchoolInvoices />
                </ProtectedRoute>
              }
            />
            <Route
              path="school/documents"
              element={
                <ProtectedRoute>
                  <SchoolDocuments />
                </ProtectedRoute>
              }
            />
            {/* Market */}
            <Route
              path="market/bar"
              element={
                <ProtectedRoute>
                  <MarketBar />
                </ProtectedRoute>
              }
            />
            <Route
              path="market/warehouse"
              element={
                <ProtectedRoute>
                  <MarketWarehouse />
                </ProtectedRoute>
              }
            />
            <Route
              path="market/categories"
              element={
                <ProtectedRoute>
                  <MarketCategories />
                </ProtectedRoute>
              }
            />
            <Route
              path="clients"
              element={
                <ProtectedRoute>
                  <MarketClients />
                </ProtectedRoute>
              }
            />
            <Route
              path="clients/:id"
              element={
                <ProtectedRoute>
                  <MarketClientDetails />
                </ProtectedRoute>
              }
            />
            {/* <Route
              path="clients/:id/:id"
              element={
                <ProtectedRoute>
                  <ClientDebtDetail />
                </ProtectedRoute>
              }
            /> */}
            <Route
              path="market/history"
              element={
                <ProtectedRoute>
                  <MarketHistory />
                </ProtectedRoute>
              }
            />
            <Route
              path="market/documents"
              element={
                <ProtectedRoute>
                  <MarketDocuments />
                </ProtectedRoute>
              }
            />
            <Route
              path="market/analytics"
              element={
                <ProtectedRoute>
                  <MarketAnalytics />
                </ProtectedRoute>
              }
            />
            {/* Cafe */}
            <Route
              path="cafe/analytics"
              element={
                <ProtectedRoute>
                  <CafeAnalytics />
                </ProtectedRoute>
              }
            />
            <Route
              path="cafe/documents"
              element={
                <ProtectedRoute>
                  <CafeDocuments />
                </ProtectedRoute>
              }
            />
            <Route
              path="cafe/cook"
              element={
                <ProtectedRoute>
                  <Cook />
                </ProtectedRoute>
              }
            />
            <Route
              path="cafe/inventory"
              element={
                <ProtectedRoute>
                  <CafeInventory />
                </ProtectedRoute>
              }
            />
            <Route
              path="cafe/menu"
              element={
                <ProtectedRoute>
                  <CafeMenu />
                </ProtectedRoute>
              }
            />
            <Route
              path="cafe/orders"
              element={
                <ProtectedRoute>
                  <CafeOrders />
                </ProtectedRoute>
              }
            />
            <Route
              path="cafe/payroll"
              element={
                <ProtectedRoute>
                  <CafePayroll />
                </ProtectedRoute>
              }
            />
            <Route
              path="cafe/purchasing"
              element={
                <ProtectedRoute>
                  <CafePurchasing />
                </ProtectedRoute>
              }
            />
            <Route
              path="cafe/reports"
              element={
                <ProtectedRoute>
                  <CafeReports />
                </ProtectedRoute>
              }
            />
            <Route
              path="cafe/reservations"
              element={
                <ProtectedRoute>
                  <CafeReservations />
                </ProtectedRoute>
              }
            />
            <Route
              path="cafe/staff"
              element={
                <ProtectedRoute>
                  <CafeStaff />
                </ProtectedRoute>
              }
            />
            <Route
              path="cafe/stock"
              element={
                <ProtectedRoute>
                  <CafeStock />
                </ProtectedRoute>
              }
            />
            <Route
              path="cafe/kassa*"
              element={
                <ProtectedRoute>
                  <CafeKassa />
                </ProtectedRoute>
              }
            />
            <Route
              path="cafe/clients"
              element={
                <ProtectedRoute>
                  <CafeClients />
                </ProtectedRoute>
              }
            />
            <Route
              path="cafe/tables"
              element={
                <ProtectedRoute>
                  <CafeTables />
                </ProtectedRoute>
              }
            />
            {/* building */}
            <Route
              path="building/work"
              element={
                <ProtectedRoute>
                  <BuildingWork />
                </ProtectedRoute>
              }
            />
            <Route
              path="building/objects"
              element={
                <ProtectedRoute>
                  <Objects />
                </ProtectedRoute>
              }
            />
            {/* <Route
              path="production/orders"
              element={
                <ProtectedRoute>
                  <ProductionOrders />
                </ProtectedRoute>
              }
            />
            <Route
              path="pharmacy/orders"
              element={
                <ProtectedRoute>
                  <ProductionOrders />
                </ProtectedRoute>
              }
            /> */}
            <Route
              path="consulting/client"
              element={
                <ProtectedRoute>
                  <ConsultingClients />
                </ProtectedRoute>
              }
            />
            <Route
              path="consulting/client-requests"
              element={
                <ProtectedRoute>
                  <ConsultingClientRequests />
                </ProtectedRoute>
              }
            />
            <Route
              path="consulting/kassa*"
              element={
                <ProtectedRoute>
                  <ConsultingCafeKassa />
                </ProtectedRoute>
              }
            />
            <Route
              path="consulting/teachers"
              element={
                <ProtectedRoute>
                  <ConsultingSchoolTeachers />
                </ProtectedRoute>
              }
            />
            <Route
              path="consulting/analytics"
              element={
                <ProtectedRoute>
                  <ConsultingAnalytics />
                </ProtectedRoute>
              }
            />
            <Route
              path="consulting/bookings"
              element={
                <ProtectedRoute>
                  <ConsultingBookings />
                </ProtectedRoute>
              }
            />
            <Route
              path="consulting/salary"
              element={
                <ProtectedRoute>
                  <ConsultingSalary />
                </ProtectedRoute>
              }
            />
            <Route
              path="consulting/sale"
              element={
                <ProtectedRoute>
                  <ConsultingSale />
                </ProtectedRoute>
              }
            />
            <Route
              path="consulting/services"
              element={
                <ProtectedRoute>
                  <ConsultingServices />
                </ProtectedRoute>
              }
            />
            <Route
              path="warehouse/analytics"
              element={
                <ProtectedRoute>
                  <WarehouseAnalytics />
                </ProtectedRoute>
              }
            />
            <Route
              path="warehouse/clients"
              element={
                <ProtectedRoute>
                  <WarehouseClients />
                </ProtectedRoute>
              }
            />
            <Route
              path="warehouse/directories"
              element={
                <ProtectedRoute>
                  <WarehouseDirectories />
                </ProtectedRoute>
              }
            />
            <Route
              path="warehouse/movements"
              element={
                <ProtectedRoute>
                  <WarehouseMovements />
                </ProtectedRoute>
              }
            />
            <Route
              path="warehouse/products"
              element={
                <ProtectedRoute>
                  <WarehouseProducts />
                </ProtectedRoute>
              }
            />
            <Route
              path="warehouse/stocks"
              element={
                <ProtectedRoute>
                  <WarehouseStocks />
                </ProtectedRoute>
              }
            />
            <Route
              path="warehouse/supply"
              element={
                <ProtectedRoute>
                  <WarehouseSupply />
                </ProtectedRoute>
              }
            />
            <Route
              path="warehouse/write_offs"
              element={
                <ProtectedRoute>
                  <WarehouseWriteOffs />
                </ProtectedRoute>
              }
            />
            <Route
              path="production/warehouse"
              element={
                <ProtectedRoute>
                  <ProductionWarehouse />
                </ProtectedRoute>
              }
            />
            <Route
              path="production/agents"
              element={
                <ProtectedRoute>
                  <ProductionAgents />
                </ProtectedRoute>
              }
            />
            <Route
              path="production/catalog"
              element={
                <ProtectedRoute>
                  <ProductionCatalog />
                </ProtectedRoute>
              }
            />
            <Route
              path="pilorama/warehouse"
              element={
                <ProtectedRoute>
                  <PiloramaWarehouse />
                </ProtectedRoute>
              }
            />

            {/* instagram */}
            <Route
              path="instagram"
              element={
                <ProtectedRoute>
                  <Instagram />
                </ProtectedRoute>
              }
            />
            <Route
              path="debts"
              element={
                <ProtectedRoute>
                  <Debts />
                </ProtectedRoute>
              }
            />
            <Route
              path="pending"
              element={
                <ProtectedRoute>
                  <Pending />
                </ProtectedRoute>
              }
            />
            <Route
              path="logistics"
              element={
                <ProtectedRoute>
                  {/* <Logistics /> */}
                  <LogisticsPage />
                </ProtectedRoute>
              }
            />
            {/* <Route
              path="logistics-shop"
              element={
                <ProtectedRoute>
                  <Logistics />
                </ProtectedRoute>
              }
            /> */}
          </Route>
        </>
      </Routes>
    </BrowserRouter>
    // </Provider>
  );
}

export default App;
