import { createProtectedRoute } from "./helpers";
import { isMarketSectorName } from "../../utils/subscriptionPlan";
import { lazy } from "react";
const Set = lazy(() => import("../../Components/pages/Info/Settings/Settings"));
const Analytics = lazy(
  () => import("../../Components/pages/Analytics/Analytics"),
);
const Contact = lazy(() => import("../../Components/Contact/Contact"));
const AdditionalServices = lazy(
  () => import("../../Components/pages/AdditionalServices/AdditionalServices"),
);
const Registration = lazy(
  () => import("../../Components/pages/Registration/Registration"),
);
const Sell = lazy(() => import("../../Components/pages/Sell/Sell"));
const SellDetail = lazy(() => import("../../Components/pages/Sell/SellDetail"));
const Debts = lazy(() => import("../../Components/Debts/Debts"));
const Instagram = lazy(() => import("../../Components/Instagram/Instagram"));
const Pending = lazy(() => import("../../Components/pages/Pending/Pending"));
const Branch = lazy(() => import("../../Components/pages/Branch/Branch"));
const BranchDetails = lazy(
  () => import("../../Components/pages/Branch/BranchDetails"),
);
const Shifts = lazy(() => import("../../Components/pages/Shifts/Shifts"));
const ShiftDetail = lazy(
  () => import("../../Components/pages/Shifts/ShiftDetail"),
);
const PosPrintSettings = lazy(
  () => import("../../Components/pages/Info/Settings/PosPrintSettings"),
);
const Obzor = lazy(() => import("../../Components/Deposits/Obzor/Obzor"));
const Zakaz = lazy(() => import("../../Components/Deposits/Zakaz/Zakaz"));
const Raspisanie = lazy(
  () => import("../../Components/Deposits/Raspisanie/Raspisanie"),
);
const BarcodePrintPage = lazy(
  () => import("../../Components/Deposits/Sklad/BarcodePrintPage"),
);
const ScalesPage = lazy(
  () => import("../../Components/Deposits/Sklad/ScalesPage"),
);
const AddProductPage = lazy(
  () => import("../../Components/Deposits/Sklad/AddProductPage"),
);
const BrandCategoryPage = lazy(
  () => import("../../Components/Deposits/BrandCategoryPage/BrandCategoryPage"),
);
const WarehouseAccounting = lazy(
  () => import("../../Components/Deposits/Warehouse/WarehouseAccounting"),
);
const Kassa = lazy(() => import("../../Components/Deposits/Kassa/Kassa"));
const KassWorker = lazy(
  () => import("../../Components/Deposits/KassaWorker/Kassa"),
);
const KassaDet = lazy(
  () => import("../../Components/Deposits/KassaWorkerDet/Kassa"),
);
const Department = lazy(() => import("../../Components/Department/Department"));
const DepartmentDetails = lazy(
  () => import("../../Components/DepartmentDetails/DepartmentDetails"),
);
const DepartmentAnalyticsChart = lazy(
  () =>
    import("../../Components/DepartmentAnalyticsChart/DepartmentAnalyticsChart"),
);
const SectorSelect = lazy(
  () => import("../../Components/Sectors/SectorSelect"),
);
const Masters = lazy(
  () => import("../../Components/Sectors/Barber/Masters/Masters"),
);
const CafeEmployEmployeeDetail = lazy(
  () =>
    import("../../Components/Sectors/Barber/Masters/CafeEmployEmployeeDetail"),
);
const MarketEmployEmployeeDetail = lazy(
  () =>
    import("../../Components/Sectors/Barber/Masters/MarketEmployEmployeeDetail"),
);
const MarketWarehouse = lazy(
  () => import("../../Components/Sectors/Market/Warehouse/Warehouse"),
);
const MarketProductDetail = lazy(
  () =>
    import("../../Components/Sectors/Market/Warehouse/components/ProductDetail"),
);
const MarketSupplierReceiptPage = lazy(
  () => import("../../Components/Sectors/Market/Warehouse/SupplierReceiptPage"),
);
const SellCashierPage = lazy(
  () => import("../../Components/pages/Sell/Cashier/SellCashierPage"),
);

const kassaRoutes = (profile, sector) => {
  const useFullKassa = profile?.role === "owner" || isMarketSectorName(sector);

  return useFullKassa
    ? [
        createProtectedRoute("kassa/*", Kassa),
        createProtectedRoute("kassa/:id", KassaDet),
      ]
    : [createProtectedRoute("kassa/*", KassWorker)];
};

export const commonRoutes = (profile, sector = "") => [
  createProtectedRoute("set", Set),
  createProtectedRoute("pos-print-settings", PosPrintSettings),
  createProtectedRoute("raspisanie", Raspisanie),
  createProtectedRoute("registration", Registration),
  createProtectedRoute("obzor", Obzor),
  createProtectedRoute("zakaz", Zakaz),
  createProtectedRoute("employ/:employeeId", CafeEmployEmployeeDetail),
  createProtectedRoute("employ/market/:employeeId", MarketEmployEmployeeDetail),
  createProtectedRoute(
    "employ/production/:employeeId",
    MarketEmployEmployeeDetail,
  ),
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
  ...kassaRoutes(profile, sector),
  createProtectedRoute("instagram", Instagram),
  createProtectedRoute("debts", Debts),
  createProtectedRoute("pending", Pending),
];
