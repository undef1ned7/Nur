import { createProtectedRoute } from "./helpers";
import { lazy } from "react";
const ConsultingClients = lazy(() => import("../../Components/Sectors/Consulting/client/client"));
const ConsultingClientDetail = lazy(() => import("../../Components/Sectors/Consulting/client/ConsultingClientDetail"));
const ConsultingClientRequests = lazy(() => import("../../Components/Sectors/Consulting/client-requests/client-requests"));
const ConsultingCafeKassa = lazy(() => import("../../Components/Sectors/Consulting/Kassa/Kassa"));
const ConsultingSchoolTeachers = lazy(() => import("../../Components/Sectors/Consulting/Teachers/Teachers"));
const ConsultingAnalytics = lazy(() => import("../../Components/Sectors/Consulting/Analytics/Analytics"));
const ConsultingBookings = lazy(() => import("../../Components/Sectors/Consulting/Bookings/Bookings"));
const ConsultingSalary = lazy(() => import("../../Components/Sectors/Consulting/salary/salary"));
const ConsultingSale = lazy(() => import("../../Components/Sectors/Consulting/sale/sale"));
const ConsultingServices = lazy(() => import("../../Components/Sectors/Consulting/services/services"));
const ConsultingFunnel = lazy(() => import("../../Components/Sectors/Consulting/Funnel/Funnel"));

export const consultingRoutes = () => [
  createProtectedRoute("consulting/client", ConsultingClients),
  createProtectedRoute("consulting/client/:id", ConsultingClientDetail),
  createProtectedRoute("consulting/client-requests", ConsultingClientRequests),
  createProtectedRoute("consulting/kassa/*", ConsultingCafeKassa),
  createProtectedRoute("consulting/teachers", ConsultingSchoolTeachers),
  createProtectedRoute("consulting/analytics", ConsultingAnalytics),
  createProtectedRoute("consulting/bookings", ConsultingBookings),
  createProtectedRoute("consulting/salary", ConsultingSalary),
  createProtectedRoute("consulting/sale", ConsultingSale),
  createProtectedRoute("consulting/services", ConsultingServices),
  createProtectedRoute("consulting/funnel", ConsultingFunnel),
];
