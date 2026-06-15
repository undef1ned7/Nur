import { createProtectedRoute } from "./helpers";
import { lazy } from "react";
const Sklad = lazy(() => import("../../Components/Deposits/Sklad/Sklad"));
const BarberServices = lazy(() => import("../../Components/Sectors/Barber/Services/Services"));
const BarberHistory = lazy(() => import("../../Components/Sectors/Barber/History/History"));
const BarberDocuments = lazy(() => import("../../Components/Sectors/Barber/Documents/Documents"));
const BarberClientDocuments = lazy(() => import("../../Components/Sectors/Barber/ClientDocuments/BarberClientDocuments"));
const Recorda = lazy(() => import("../../Components/Sectors/Barber/Recorda/Recorda"));
const BarberClients = lazy(() => import("../../Components/Sectors/Barber/Clients/Clients"));
const BarberAnalitika = lazy(() => import("../../Components/Sectors/Barber/BarberAnalitika/BarberAnalitika"));
const MastersTabs = lazy(() => import("../../Components/Sectors/Barber/Masters/MastersTabs/MastersTabs"));
const BarberRequests = lazy(() => import("../../Components/Sectors/Barber/Requests/Requests"));

const barberPrefixRoutes = (prefix) => [
  createProtectedRoute(`${prefix}/services`, BarberServices),
  createProtectedRoute(`${prefix}/warehouse`, Sklad),
  createProtectedRoute(`${prefix}/masters`, MastersTabs),
  createProtectedRoute(`${prefix}/history`, BarberHistory),
  createProtectedRoute(`${prefix}/documents`, BarberDocuments),
  createProtectedRoute(`${prefix}/records`, Recorda),
  createProtectedRoute(`${prefix}/clients`, BarberClients),
  createProtectedRoute(`${prefix}/client-documents`, BarberClientDocuments),
  createProtectedRoute(`${prefix}/cash-reports`, BarberAnalitika),
  createProtectedRoute(`${prefix}/requests`, BarberRequests),
];

export const barberRoutes = () => [
  ...barberPrefixRoutes("barber"),
  ...barberPrefixRoutes("services"),
  ...barberPrefixRoutes("dentistry"),
  createProtectedRoute("documents", BarberDocuments),
];
