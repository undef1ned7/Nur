import { createProtectedRoute } from "./helpers";
import { lazy } from "react";
const PiloramaWarehouse = lazy(() => import("../../Components/Sectors/Pilorama/PiloramaWarehouse/PiloramaWarehouse"));

export const piloramaRoutes = () => [
  createProtectedRoute("pilorama/warehouse", PiloramaWarehouse),
];
