import { Route } from "react-router-dom";
import ProtectedRoute from "../../ProtectedRoute";
import { createProtectedRoute } from "./helpers";
import { lazy } from "react";

const MarketBar = lazy(() => import("../../Components/Sectors/Market/Bar/Bar"));
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
const MarketSupplierReceiptsListPage = lazy(
  () =>
    import("../../Components/Sectors/Market/Warehouse/SupplierReceiptsListPage"),
);
const MarketCashierPage = lazy(
  () => import("../../Components/Sectors/Market/CashierPage/CashierPage"),
);
const MarketCategories = lazy(
  () => import("../../Components/Sectors/Market/Categories/Categories"),
);
const MarketClients = lazy(
  () => import("../../Components/Sectors/Market/Clients/Clients"),
);
const MarketClientDetails = lazy(
  () => import("../../Components/Sectors/Market/ClientDetails/ClientDetails"),
);
const MarketHistory = lazy(
  () => import("../../Components/Sectors/Market/History/History"),
);
const MarketDocuments = lazy(
  () => import("../../Components/Sectors/Market/Documents/Documents"),
);
const CreateSaleDocument = lazy(
  () => import("../../Components/Sectors/Market/Documents/CreateSaleDocument"),
);
const MarketAnalytics = lazy(
  () => import("../../Components/Sectors/Market/Analytics/Analytics"),
);

export const marketRoutes = () => [
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
];
