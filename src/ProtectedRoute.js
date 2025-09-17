import { Navigate } from "react-router-dom";
import { useUser } from "./store/slices/userSlice";

const ProtectedRoute = ({ children }) => {
  const { company, companyLoading } = useUser();

  // Пока грузим компанию — ждём
  if (companyLoading) {
    return <div>Загрузка...</div>;
  }

  // Если компания не пришла → редирект
  if (!company?.end_date) {
    return <Navigate to="/" replace />;
  }

  // Сравниваем только по датам (исключаем баг с часовыми поясами)
  const endDate = new Date(company.end_date);
  const now = new Date();

  endDate.setHours(0, 0, 0, 0);
  now.setHours(0, 0, 0, 0);

  if (endDate < now) {
    return <Navigate to="/" replace />;
  }

  return children;
};

export default ProtectedRoute;
