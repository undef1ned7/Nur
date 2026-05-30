import { lazy } from "react";
import { Route } from "react-router-dom";
import ProtectedRoute from "../ProtectedRoute";
import {
  NewLanding,
  VideoLessons,
  VideoLessonView,
  VideoLessonsAdmin,
} from "../Components/pages/Landing/NewLanding/lazyRoutes";

const Login = lazy(() => import("../Components/Auth/Login/Login"));
const RegisterGate = lazy(() => import("../Components/Auth/Register/RegisterGate"));
const RegisterAccessSettings = lazy(
  () => import("../Components/Auth/Register/RegisterAccessSettings"),
);
const Landing = lazy(() => import("../Components/pages/Landing/Landing"));
const SubmitApplication = lazy(
  () => import("../Components/pages/SubmitApplication/SubmitApplication"),
);
const ApplicationList = lazy(
  () => import("../Components/pages/SubmitApplication/ApplicationList"),
);
const OnlineCatalog = lazy(
  () => import("../Components/Sectors/Market/Catalog/Catalog"),
);
const CafeMenuOnline = lazy(
  () => import("../Components/Sectors/cafe/CafeMenuOnline/CafeMenuOnline"),
);
const OnlineBooking = lazy(
  () => import("../Components/Sectors/Barber/OnlineBooking/OnlineBooking"),
);

/**
 * Конфигурация публичных роутов
 */
export const publicRoutes = [
  <Route key="/login" path="/login" element={<Login />} />,
  <Route key="/old-landing" path="/old-landing" element={<Landing />} />,
  <Route key="/" path="/" element={<NewLanding />} />,
  <Route key="/register" path="/register" element={<RegisterGate />} />,
  <Route
    key="/register-access/settings"
    path="/register-access/settings"
    element={<RegisterAccessSettings />}
  />,
  <Route
    key="/video-lessons"
    path="/video-lessons"
    element={<VideoLessons />}
  />,
  <Route
    key="/video-lessons-admin"
    path="/video-lessons/admin"
    element={<VideoLessonsAdmin />}
  />,
  <Route
    key="/video-lessons-lesson"
    path="/video-lessons/:lessonId"
    element={<VideoLessonView />}
  />,

  <Route
    key="/catalog/:slug"
    path="/catalog/:slug"
    element={<OnlineCatalog />}
  />,
  <Route
    key="/cafe/:company_slug/menu"
    path="/cafe/:company_slug/menu"
    element={<CafeMenuOnline />}
  />,
  <Route
    key="/barber/:company_slug/booking"
    path="/barber/:company_slug/booking"
    element={<OnlineBooking />}
  />,
  <Route
    key="/services/:company_slug/booking"
    path="/services/:company_slug/booking"
    element={<OnlineBooking />}
  />,
  <Route
    key="/dentistry/:company_slug/booking"
    path="/dentistry/:company_slug/booking"
    element={<OnlineBooking />}
  />,

  <Route
    key="/submit-application"
    path="/submit-application"
    element={<SubmitApplication />}
  />,
  <Route
    key="/get-application-list"
    path="/get-application-list"
    element={
      <ProtectedRoute>
        <ApplicationList />
      </ProtectedRoute>
    }
  />,
];
