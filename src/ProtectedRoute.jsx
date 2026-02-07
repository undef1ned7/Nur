import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { useUser } from "./store/slices/userSlice";
import { useEffect, useMemo } from "react";
import { MENU_CONFIG } from "./Components/Sidebar/config/menuConfig";
import { useMenuPermissions } from "./Components/Sidebar/hooks/useMenuPermissions";
import { useDebounce } from "./hooks/useDebounce";


const BASE_ROUTES = ['/srm/set']

const ProtectedRoute = ({ children }) => {
  const { company, companyLoading, profile, tariff, sector } = useUser();
  // const { hasPermission, isAllowed } = useMenuPermissions();
  // const { pathname } = useLocation()
  // const navigate = useNavigate()
  // const getSectorMenuItems = useMemo(() => {
  //   const currentSector = sector || company?.sector?.name;
  //   if (!currentSector) return [];
  //   const sectorName = currentSector.toLowerCase();
  //   const sectorKey = sectorName.replace(/\s+/g, "_");
  //   const sectorMapping = {
  //     строительная_компания: "building",
  //     ремонтные_и_отделочные_работы: "building",
  //     архитектура_и_дизайн: "building",
  //     барбершоп: "barber",
  //     гостиница: "hostel",
  //     школа: "school",
  //     магазин: "market",
  //     кафе: "cafe",
  //     "Цветочный магазин": "market",
  //     производство: "production",
  //     консалтинг: "consulting",
  //     склад: "warehouse",
  //     пилорама: "pilorama",
  //     логистика: "logistics",
  //   };

  //   const configKey = sectorMapping[sectorKey] || sectorKey;
  //   const sectorConfig = MENU_CONFIG.sector[configKey] || [];
  //   if (tariff === "Старт") {
  //     const filteredItems = sectorConfig.filter((item) => {
  //       // Показываем только аналитику маркета
  //       if (item.to === "/crm/market/analytics") {
  //         return hasPermission(item.permission);
  //       }
  //       return false;
  //     });
  //     return filteredItems;
  //   }
  //   const filteredItems = sectorConfig.filter((item) => {
  //     if ('production' === configKey && item.permission === 'can_view_catalog' && profile?.role === 'owner') return true;
  //     return hasPermission(item.permission)
  //   }
  //   );

  //   return filteredItems;
  // }, [sector, company, hasPermission, profile, tariff]);
  // useEffect(() => {
  //   if (pathname.split('/').length > 2) return;
  //   if (BASE_ROUTES.includes(pathname)) return;
  //   if (!getSectorMenuItems.some(el => el.to.includes(pathname))) {
  //     navigate(-1)
  //   }
  // }, [profile])
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
