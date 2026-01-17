import { useState, useCallback } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import "./App.scss";
import AuthGuard from "./Components/Auth/AuthGuard/AuthGuard.jsx";
import Layout from "./Components/Layout/Layout.jsx";
import { ScrollToTop } from "./hooks/ScrollToTop.jsx";
import { publicRoutes, crmRoutes } from "./config/routes.jsx";
import { ThemeModeProvider } from "./theme/ThemeModeProvider.jsx";
import { Box } from "@mui/system";
import "./i18n.js"

function App() {
  const [profile, setProfile] = useState(null);

  // Используем useCallback чтобы функция не пересоздавалась при каждом рендере
  const handleProfileLoaded = useCallback((profileData) => {
    setProfile(profileData);
  }, []);

  return (
    <AuthGuard onProfileLoaded={handleProfileLoaded}>
      <ThemeModeProvider>
         <Box sx={{ minHeight: "100vh", bgcolor: "transparent" }}>
          <BrowserRouter>
            <ScrollToTop />
            <Routes>
              {publicRoutes}
              <Route path="/crm" element={<Layout />}>
                {crmRoutes(profile)}
              </Route>
            </Routes>
          </BrowserRouter>
         </Box>
      </ThemeModeProvider>
    </AuthGuard>
  );
}

export default App;
