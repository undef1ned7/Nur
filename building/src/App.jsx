import { useEffect } from "react";
import { useDispatch } from "react-redux";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { ModalProvider } from "@/context/modal";
import Layout from "@/Layout";
import LoginPage from "@/pages/LoginPage";
import RegisterPage from "@/pages/auth/RegisterPage";
import { buildingRoutes } from "@/config/routes/buildingRoutes";
import { getProfile } from "@/store/slices/userSlice";
import { getCompany } from "@/store/creators/userCreators";

export default function App() {
  const dispatch = useDispatch();

  useEffect(() => {
    const token = localStorage.getItem("accessToken");
    if (token) {
      dispatch(getProfile());
      dispatch(getCompany());
    }
  }, [dispatch]);

  return (
    <ModalProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/" element={<Layout />}>
            <Route index element={<Navigate to="/building/projects" replace />} />
            {buildingRoutes()}
          </Route>
          <Route path="*" element={<Navigate to="/building/projects" replace />} />
        </Routes>
      </BrowserRouter>
    </ModalProvider>
  );
}
