import { createProtectedRoute } from "./helpers";
import { lazy } from "react";
const RoomsHalls = lazy(() => import("../../Components/Sectors/Hostel/RoomsHalls/RoomsHalls"));
const HostelBookings = lazy(() => import("../../Components/Sectors/Hostel/Bookings/Bookings"));
const HostelBar = lazy(() => import("../../Components/Sectors/Hostel/Bar/Bar"));
const HostelClients = lazy(() => import("../../Components/Sectors/Hostel/Clients/Clients"));
const HostelDocuments = lazy(() => import("../../Components/Sectors/Hostel/Documents/Documents"));
const HostelWarehouse = lazy(() => import("../../Components/Sectors/Hostel/Warehouse/Warehouse"));
const AnalyticsPage = lazy(() => import("../../Components/Sectors/Hostel/Analytics/AnalyticsPage").then((m) => ({ default: m.AnalyticsPage })));
const HostelKassa = lazy(() => import("../../Components/Sectors/Hostel/kassa/kassa"));

export const hostelRoutes = () => [
  createProtectedRoute("hostel/rooms", RoomsHalls),
  createProtectedRoute("hostel/bookings", HostelBookings),
  createProtectedRoute("hostel/bar", HostelBar),
  createProtectedRoute("hostel/clients", HostelClients),
  createProtectedRoute("hostel/documents", HostelDocuments),
  createProtectedRoute("hostel/warehouse", HostelWarehouse),
  createProtectedRoute("hostel/analytics", AnalyticsPage),
  createProtectedRoute("hostel/kassa/*", HostelKassa),
];
