import { createProtectedRoute } from "./helpers";
import { lazy } from "react";
const LogisticsPage = lazy(() => import("../../Components/Sectors/logistics/LogisticsPage/LogisticsPage"));
const LogisticsAnalytics = lazy(() => import("../../Components/pages/LogisticsAnalytics/LogisticsAnalytics"));

export const logisticsRoutes = () => [
  createProtectedRoute("logistics", LogisticsPage),
  createProtectedRoute("logistics-analytics", LogisticsAnalytics),
];
