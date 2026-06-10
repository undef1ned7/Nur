import { Route, Navigate, Outlet, useSearchParams } from "react-router-dom";
import { lazy } from "react";
import ProtectedRoute from "../../ProtectedRoute";
import { useUser } from "../../store/slices/userSlice";
const WarehouseAnalytics = lazy(
  () => import("../../Components/Sectors/Warehouse/Analytics/Analytics"),
);
const WarehouseAgentAnalytics = lazy(
  () => import("../../Components/Sectors/Warehouse/Analytics/AgentAnalytics"),
);
const PartnerAnalyticsList = lazy(
  () =>
    import("../../Components/Sectors/Warehouse/Analytics/PartnerAnalyticsList"),
);
const PartnerAnalyticsDetail = lazy(
  () =>
    import("../../Components/Sectors/Warehouse/Analytics/PartnerAnalyticsDetail"),
);
const PartnerAnalyticsOwnerGate = lazy(
  () =>
    import("../../Components/Sectors/Warehouse/Analytics/PartnerAnalyticsOwnerGate"),
);
const WarehouseClients = lazy(
  () => import("../../Components/Sectors/Warehouse/Clients/Clients"),
);
const WarehouseMovements = lazy(
  () => import("../../Components/Sectors/Warehouse/Movements/Movements"),
);
const WarehouseProducts = lazy(
  () => import("../../Components/Sectors/Warehouse/Products/Products"),
);
const WarehouseProductDetail = lazy(
  () =>
    import("../../Components/Sectors/Warehouse/Products/WarehouseProductDetail"),
);
const WarehouseStocks = lazy(
  () => import("../../Components/Sectors/Warehouse/Stocks/Stocks"),
);
const AgentStocks = lazy(
  () => import("../../Components/Sectors/Warehouse/AgentStocks/AgentStocks"),
);
const AddWarehouseProductPage = lazy(
  () =>
    import("../../Components/Sectors/Warehouse/Stocks/AddWarehouseProductPage"),
);
const WarehouseSupply = lazy(
  () => import("../../Components/Sectors/Warehouse/Supply/Supply"),
);
const WarehouseWriteOffs = lazy(
  () => import("../../Components/Sectors/Warehouse/WriteOffs/WriteOffs"),
);
const Warehouses = lazy(
  () => import("../../Components/Sectors/Warehouse/Warehouses/Warehouses"),
);
const PartnerCatalogPage = lazy(
  () =>
    import("../../Components/Sectors/Warehouse/Warehouses/PartnerCatalogPage"),
);
const WarehouseBrandCategory = lazy(
  () =>
    import("../../Components/Sectors/Warehouse/BrandCategory/BrandCategoryPage"),
);
const WarehouseDocumentsLayout = lazy(
  () => import("../../Components/Sectors/Warehouse/Documents/DocumentsLayout"),
);
const WarehouseDocuments = lazy(
  () => import("../../Components/Sectors/Warehouse/Documents/Documents"),
);
const CreateWarehouseDocument = lazy(
  () =>
    import("../../Components/Sectors/Warehouse/Documents/CreateSaleDocument"),
);
const MoneyDocumentsPage = lazy(
  () => import("../../Components/Sectors/Warehouse/Money/MoneyDocumentsPage"),
);
const WarehouseKassa = lazy(
  () => import("../../Components/Sectors/Warehouse/Kassa/WarehouseKassa"),
);
const WarehouseAgents = lazy(
  () => import("../../Components/Sectors/Warehouse/Agents/Agents"),
);
const Counterparties = lazy(
  () => import("../../Components/Sectors/Market/Counterparties/Counterparties"),
);
const CounterpartyDetail = lazy(
  () =>
    import("../../Components/Sectors/Market/Counterparties/CounterpartyDetail"),
);
import {
  createProtectedRoute,
  createWarehouseAgentProtectedRoute,
} from "./helpers";

const WarehouseAnalyticsRoute = () => {
  const { profile } = useUser();
  const [searchParams] = useSearchParams();
  const agentId = searchParams.get("agent_id");
  const isAgent = profile?.role !== "owner" && profile?.role !== "admin";
  if (isAgent && !agentId) return <WarehouseAgentAnalytics />;
  if (agentId) return <WarehouseAgentAnalytics />;
  return <WarehouseAnalytics />;
};

export const warehouseRoutes = (profile) => [
  createProtectedRoute(
    "warehouse/warehouses",
    profile?.role !== "owner" ? AgentStocks : Warehouses,
  ),
  createProtectedRoute("warehouse/partners/analytics", () => (
    <PartnerAnalyticsOwnerGate>
      <PartnerAnalyticsList />
    </PartnerAnalyticsOwnerGate>
  )),
  createProtectedRoute("warehouse/partners/:partnerId/analytics", () => (
    <PartnerAnalyticsOwnerGate>
      <PartnerAnalyticsDetail />
    </PartnerAnalyticsOwnerGate>
  )),
  createProtectedRoute("warehouse/partners/:partnerId", PartnerCatalogPage),
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
];
