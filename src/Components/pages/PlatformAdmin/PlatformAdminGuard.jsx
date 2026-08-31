import { Navigate } from "react-router-dom";
import { useUser } from "../../../store/slices/userSlice";
import { isPlatformAdmin } from "./platformAdminAccess";
import Loading from "../../common/Loading/Loading";

/**
 * Пускает только авторизованных пользователей с is_platform_admin.
 * Не проверяет подписку компании (в отличие от ProtectedRoute).
 */
const PlatformAdminGuard = ({ children }) => {
  const { profile, loading, accessToken } = useUser();

  if (!accessToken) {
    return <Navigate to="/login" replace />;
  }

  if (loading && !profile) {
    return <Loading />;
  }

  if (!isPlatformAdmin(profile)) {
    return <Navigate to="/crm" replace />;
  }

  return children;
};

export default PlatformAdminGuard;
