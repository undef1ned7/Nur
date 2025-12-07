import { useState, useCallback } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import "./App.scss";
import AuthGuard from "./Components/Auth/AuthGuard/AuthGuard";
import Layout from "./Components/Layout/Layout";
import { ScrollToTop } from "./hooks/ScrollToTop";
import { publicRoutes, crmRoutes } from "./config/routes";

function App() {
  const [profile, setProfile] = useState(null);

  // Используем useCallback чтобы функция не пересоздавалась при каждом рендере
  const handleProfileLoaded = useCallback((profileData) => {
    setProfile(profileData);
  }, []);

  return (
    <AuthGuard onProfileLoaded={handleProfileLoaded}>
      <BrowserRouter>
        <ScrollToTop />
        <Routes>
          {publicRoutes}
          <Route path="/crm" element={<Layout />}>
            {crmRoutes(profile)}
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthGuard>
  );
}

export default App;
