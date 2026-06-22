import { Suspense, useState, useCallback, useEffect } from "react";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import "./App.scss";
import AuthGuard from "./Components/Auth/AuthGuard/AuthGuard.jsx";
import Layout from "./Components/Layout/Layout.jsx";
import { ScrollToTop } from "./hooks/ScrollToTop.jsx";
import { publicRoutes } from "./config/routes.jsx";
import Logout from "./Components/Auth/Logout/Logout.jsx";
import RouteFallback from "./Components/common/RouteFallback/RouteFallback.jsx";
import { ThemeModeProvider } from "./theme/ThemeModeProvider.jsx";
import { Box } from "@mui/system";
import "./i18n.js";
import { ModalProvider } from "./context/modal";
import { useUser } from "./store/slices/userSlice";

function AppRoutes({ profile }) {
  const { pathname } = useLocation();
  const { sector, company } = useUser();
  const sectorName = sector || company?.sector?.name || "";
  const [crmRoutesElements, setCrmRoutesElements] = useState(null);

  useEffect(() => {
    if (!pathname.startsWith("/crm")) {
      return undefined;
    }

    let cancelled = false;

    const loadRoutes = () =>
      import("./config/routes/index.js")
        .then((mod) => {
          if (!cancelled) {
            setCrmRoutesElements(mod.crmRoutes(profile));
          }
        })
        .catch((err) => {
          console.error("Не удалось загрузить CRM-маршруты:", err);
          if (!cancelled) {
            setTimeout(() => {
              if (!cancelled) loadRoutes();
            }, 1500);
          }
        });

    loadRoutes();

    return () => {
      cancelled = true;
    };
  }, [pathname, profile, sectorName]);

  return (
    <Suspense fallback={<RouteFallback />}>
      <Routes>
        {publicRoutes}
        <Route key="/crm" path="/crm" element={<Layout />}>
          <Route path="logout" element={<Logout />} />
          {crmRoutesElements ?? (
            <Route key="crm-fallback" path="*" element={<RouteFallback />} />
          )}
        </Route>
      </Routes>
    </Suspense>
  );
}

function App() {
  const [profile, setProfile] = useState(null);

  const handleProfileLoaded = useCallback((profileData) => {
    setProfile(profileData);
  }, []);

  return (
    <AuthGuard onProfileLoaded={handleProfileLoaded}>
      <ThemeModeProvider>
        <ModalProvider>
          <Box sx={{ minHeight: "100vh", bgcolor: "transparent" }}>
            <BrowserRouter>
              <ScrollToTop />
              <AppRoutes profile={profile} />
            </BrowserRouter>
          </Box>
        </ModalProvider>
      </ThemeModeProvider>
    </AuthGuard>
  );
}

export default App;
