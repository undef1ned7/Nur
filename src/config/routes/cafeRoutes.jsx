import { Route } from "react-router-dom";
import ProtectedRoute from "../../ProtectedRoute";
import { lazy } from "react";
const CafeAnalytics = lazy(
  () => import("../../Components/Sectors/cafe/CafeAnalytics/CafeAnalytics"),
);
const CafeDocuments = lazy(
  () => import("../../Components/Sectors/cafe/Documents/Documents"),
);
const CafeCookRoute = lazy(
  () => import("../../Components/Sectors/cafe/Cook/CafeCookRoute"),
);
const CafeInventory = lazy(
  () => import("../../Components/Sectors/cafe/Inventory/CafeInventory"),
);
const CafeMenu = lazy(() => import("../../Components/Sectors/cafe/Menu/Menu"));
const CafeMenuItemPage = lazy(
  () => import("../../Components/Sectors/cafe/Menu/CafeMenuItemPage"),
);
const CafeOrders = lazy(
  () => import("../../Components/Sectors/cafe/Orders/Orders"),
);
const CafePayroll = lazy(
  () => import("../../Components/Sectors/cafe/Payroll/Payroll"),
);
const CafePurchasing = lazy(
  () => import("../../Components/Sectors/cafe/Purchasing/Purchasing"),
);
const CafeReports = lazy(
  () => import("../../Components/Sectors/cafe/Reports/Reports"),
);
const CafeReservations = lazy(
  () => import("../../Components/Sectors/cafe/Reservations/Reservations"),
);
const CafeStock = lazy(
  () => import("../../Components/Sectors/cafe/Stock/Stock"),
);
const CafeKassa = lazy(
  () => import("../../Components/Sectors/cafe/kassaCafe/kassa"),
);
const CafeClients = lazy(
  () => import("../../Components/Sectors/cafe/Clients/Clients"),
);
const CafeTables = lazy(
  () => import("../../Components/Sectors/cafe/Tables/Tables"),
);
const CafeCosting = lazy(
  () => import("../../Components/Sectors/cafe/Costing/Costing"),
);
const CafeOrdersLayout = lazy(
  () => import("../../Components/Sectors/cafe/Orders"),
);
const CafeOrderHistory = lazy(
  () => import("../../Components/Sectors/cafe/Orders/CafeOrdersHistory"),
);
const CafeLayout = lazy(
  () => import("../../Components/Sectors/cafe/CafeLayout"),
);
import {
  createProtectedRoute,
  createPermissionProtectedRoute,
} from "./helpers";

export const cafeRoutes = (profile) => [
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
];
