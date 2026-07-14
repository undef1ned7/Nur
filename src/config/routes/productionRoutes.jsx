import { lazy } from "react";
import { Route } from "react-router-dom";
import ProtectedRoute from "../../ProtectedRoute";
const ProductionSuppliers = lazy(() => import("../../Components/Sectors/Market/Clients/Clients"));
const ProductionWarehouse = lazy(() => import("../../Components/Sectors/Production/Warehouse/ProductionWarehouse"));
const ProductionWarehouseProductDetail = lazy(() => import("../../Components/Sectors/Production/Warehouse/ProductionWarehouseProductDetail"));
const ProductionAgents = lazy(() => import("../../Components/Sectors/Production/ProductionAgents/ProductionAgents"));
const ProductionCatalog = lazy(() => import("../../Components/Sectors/Production/Catalog/ProductionCatalog"));
const ProductionRequest = lazy(() => import("../../Components/Sectors/Production/Request/ProductionRequest"));
const AgentAnalytics = lazy(() => import("../../Components/Sectors/Production/Analytics/AgentAnalytics"));
const ProductionAnalytics = lazy(() => import("../../Components/Sectors/Production/Analytics/ProductionAnalytics"));
const ProductionSell = lazy(() => import("../../Components/Sectors/Production/Sell/ProductionSell"));
const ProductionSellStartPage = lazy(() => import("../../Components/Sectors/Production/Sell/ProductionSellStartPage"));
const ProductionFinishedGoodsAddPage = lazy(() => import("../../Components/Sectors/Production/FinishedGoods/ProductionFinishedGoodsAddPage"));
const RawMaterialProcessPage = lazy(() => import("../../Components/Sectors/Production/RawMaterialsWarehouse/RawMaterialProcessPage"));
const ProductionSalary = lazy(() => import("../../Components/Sectors/Production/Salary/ProductionSalary"));
import {
  createProtectedRoute,
  createProductionAgentProtectedRoute,
} from "./helpers";

export const productionRoutes = () => [
  createProtectedRoute("production/warehouse", ProductionWarehouse),
  createProtectedRoute(
    "production/warehouse/add-product",
    ProductionFinishedGoodsAddPage,
  ),
  createProtectedRoute(
    "production/warehouse/raw-materials/process/:id",
    RawMaterialProcessPage,
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
  createProtectedRoute("production/salary", ProductionSalary),
  <Route
    key="production/suppliers"
    path="production/suppliers"
    element={
      <ProtectedRoute>
        <ProductionSuppliers forcedTab="suppliers" hideTabs />
      </ProtectedRoute>
    }
  />,
];
