import { Navigate, useLocation } from "react-router-dom";
import { useUser } from "./store/slices/userSlice";
import { useAlert } from "./hooks/useDialog";

const ProtectedRoute = ({ children }) => {
  const { company, companyLoading } = useUser();
  const alert = useAlert();
  const location = useLocation();
  const token = localStorage.getItem("accessToken");

  if (!token) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (companyLoading) {
    return <div className="app-loading">Загрузка...</div>;
  }

  if (!company?.end_date) {
    alert("Срок действия компании не установлен", true);
    return <Navigate to="/login" replace />;
  }

  const endDate = new Date(company.end_date);
  const now = new Date();
  endDate.setHours(0, 0, 0, 0);
  now.setHours(0, 0, 0, 0);

  if (endDate < now) {
    alert("Срок действия компании истек", true);
    return <Navigate to="/login" replace />;
  }

  return children;
};

export default ProtectedRoute;
