import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import {
  Bell,
  Menu,
  ShoppingCart,
  Building2,
  Check,
  X,
} from "lucide-react";
import { useUser } from "../../store/slices/userSlice";
import { fetchBuildingProjects } from "../../store/creators/building/projectsCreators";
import {
  setSelectedBuildingProjectId,
  useBuildingProjects,
} from "../../store/slices/building/projectsSlice";
import NotificationModal from "../NotificationModal/NotificationModal";
import "./Header.scss";

const pageTitles = {
  "/": "Вход",
  "/register": "Регистрация",
  "/crm/registration": "Регистрация",
  "/crm/obzor": "Обзор",
  "/crm/vitrina": "Витрины",
  "/crm/employ": "Сотрудники",
  "/crm/zakaz": "Закупки",
  "/crm/sklad": "Склад",
  "/crm/raspisanie": "Расписание",
  "/crm/sklad-accounting": "Складской учет",
  "/crm/analytics": "Аналитика",
  "/crm/set": "Настройки",
  "/crm/debts": "Долги",

  // --- добавлено ---
  // Базовые
  "/crm/sell": "Продажа",
  "/crm/sell/start": "Продажа",
  "/crm/kassa": "Касса",
  "/crm/clients": "Клиенты",
  "/crm/departments": "Отделы",
  "/crm/brand-category": "Бренд и Категория",

  // Строительная сфера
  "/crm/building/work": "Процесс работы",
  "/crm/building/objects": "Квартиры",

  // Барбершоп
  "/crm/barber/clients": "Клиенты",
  "/crm/barber/services": "Услуги",
  "/crm/barber/masters": "Сотрудники",
  "/crm/barber/history": "История",
  "/crm/barber/records": "Записи",
  "/crm/barber/requests": "Заявки",
  "/crm/barber/cash-reports": "Аналитика",

  // Гостиница
  "/crm/hostel/rooms": "Комнаты",
  "/crm/hostel/bookings": "Бронирования",
  "/crm/hostel/bar": "Бар",
  "/crm/hostel/clients": "Клиенты",
  "/crm/hostel/analytics": "Аналитика",
  "/crm/hostel/kassa": "Касса",

  // Школа
  "/crm/school/students": "Ученики",
  "/crm/school/groups": "Направления",
  "/crm/school/lessons": "Уроки",
  "/crm/school/teachers": "Сотрудники",
  "/crm/school/leads": "Заявки",
  "/crm/school/invoices": "Аналитика",

  // Магазин
  "/crm/market/bar": "Бар",
  "/crm/market/history": "История",
  "/crm/market/analytics": "Аналитика",

  // Кафе
  "/crm/cafe/analytics": "Аналитика выплат",
  "/crm/cafe/menu": "Меню",
  "/crm/cafe/orders": "Заказы",
  "/crm/cafe/orders/history": "Заказы",
  "/crm/cafe/payroll": "Зарплата",
  "/crm/cafe/purchasing": "Закупки",
  "/crm/cafe/reports": "Отчёты",
  "/crm/cafe/reservations": "Бронь",
  "/crm/cafe/clients": "Гости",
  "/crm/cafe/stock": "Склад",
  "/crm/cafe/tables": "Столы",
  "/crm/cafe/kassa": "Касса",

  "/crm/production/warehouse": "Склад",
  "/crm/production/analytics": "Аналитика",

  // Доп. услуги
  "/crm/instagram": "Instagram",
  "/crm/documents": "Документы",
  // ВНИМАНИЕ: один и тот же путь для WhatsApp и Telegram
  "/crm/": "Каналы",
};

const Header = ({ toggleSidebar, isSidebarOpen }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const title = pageTitles[location.pathname] || "NurCRM";
  const dispatch = useDispatch();

  const { list: notifications } = useSelector((state) => state.notification);
  const unreadCount = notifications?.filter((n) => !n.is_read).length || 0;
  const { company, profile: userProfile } = useUser();
  const {
    items: buildingProjects,
    selectedProjectId,
    loading: buildingProjectsLoading,
  } = useBuildingProjects();

  const [showNotifications, setShowNotifications] = useState(false);
  const [showProjectDrawer, setShowProjectDrawer] = useState(false);
  // const [profile, setProfile] = useState(null);

  // Проверяем, является ли сектор маркетом
  const isMarketSector = useMemo(() => {
    if (!company?.sector?.name) return false;
    const sectorName = company.sector.name.toLowerCase().trim();
    return (
      sectorName === "магазин" ||
      sectorName === "цветочный магазин" ||
      sectorName.includes("магазин")
    );
  }, [company?.sector?.name]);

  // Проверяем разрешение на просмотр интерфейса кассира (can_view_cashier)
  const showCashierButton = useMemo(() => {
    if (!userProfile) return false;
    if (company?.subscription_plan?.name == "Старт") return false;
    return userProfile.can_view_cashier === true;
  }, [userProfile, company]);

  // const fetchProfile = async () => {
  //   try {
  //     const token = localStorage.getItem("accessToken");
  //     if (!token) return;

  //     const response = await fetch("https://app.nurcrm.kg/api/users/profile/", {
  //       headers: {
  //         "Content-Type": "application/json",
  //         Authorization: `Bearer ${token}`,
  //       },
  //     });

  //     if (response.ok) {
  //       const data = await response.json();
  //       setProfile(data);
  //     } else {
  //       console.error("Ошибка загрузки профиля");
  //     }
  //   } catch (err) {
  //     console.error("Ошибка запроса профиля:", err);
  //   }
  // };

  // useEffect(() => {
  //   fetchProfile();
  // }, []);

  const usernameToDisplay = userProfile
    ? `${userProfile.first_name || ""} ${userProfile.last_name || ""}`.trim() ||
    userProfile.email
    : "Гость";

  const isBuildingRoute = useMemo(() => {
    return location.pathname.startsWith("/crm/building");
  }, [location.pathname]);

  useEffect(() => {
    if (!isBuildingRoute) return;
    if (buildingProjectsLoading) return;
    if (Array.isArray(buildingProjects) && buildingProjects.length > 0) return;
    dispatch(fetchBuildingProjects());
  }, [dispatch, isBuildingRoute, buildingProjects, buildingProjectsLoading]);

  const handleProjectChange = (e) => {
    const v = e.target.value;
    dispatch(setSelectedBuildingProjectId(v || null));
  };

  const projectsList = Array.isArray(buildingProjects) ? buildingProjects : [];

  return (
    <div className="header">
      <div className="header__left">
        <div className="header__burger" onClick={toggleSidebar}>
          <Menu size={24} />
        </div>
        <h2 className="header__title">{title}</h2>
      </div>
      <div className="header__right">
        {isBuildingRoute && (
          <div className="header__project">
            <div className="header__project-label">Проект</div>
            <select
              className="header__project-select"
              value={selectedProjectId ?? ""}
              onChange={handleProjectChange}
            >
              <option value="" disabled>
                {buildingProjectsLoading ? "Загрузка..." : "Выберите проект"}
              </option>
              {projectsList.map((p, idx) => {
                const id = p?.id ?? p?.uuid ?? String(idx);
                return (
                  <option key={id} value={id}>
                    {p?.name || "—"}
                  </option>
                );
              })}
            </select>
          </div>
        )}

        {isBuildingRoute && (
          <button
            type="button"
            className="header__project-iconBtn"
            onClick={() => setShowProjectDrawer(true)}
            title="Выбрать проект"
            aria-label="Выбрать проект"
          >
            <Building2 size={20} />
          </button>
        )}

        {showCashierButton && (
          <button
            className="header__cashier-btn"
            onClick={() => navigate("/crm/market/cashier")}
            title="Интерфейс кассира"
          >
            <ShoppingCart size={20} />
            <span>Интерфейс кассира</span>
          </button>
        )}
        <div
          className="header__notification"
          onClick={() => setShowNotifications(true)}
          style={{ cursor: "pointer" }}
        >
          <span className="material-icons">
            <Bell />
          </span>
          {unreadCount > 0 && (
            <span className="header__notification-count">{unreadCount}</span>
          )}
        </div>
        <div
          onClick={() => {
            if (!userProfile) return;
            navigate("/crm/set");
          }}
          aria-disabled={!userProfile}
          className={`header__profile ${userProfile ? "cursor-pointer" : ""}`}
        >
          <div className="header__avatar">
            {usernameToDisplay
              ? usernameToDisplay.charAt(0).toUpperCase()
              : "?"}
          </div>
          <span className="header__username">{usernameToDisplay}</span>
        </div>
      </div>

      {showNotifications && (
        <NotificationModal onClose={() => setShowNotifications(false)} />
      )}

      {showProjectDrawer && isBuildingRoute && (
        <div
          className="header__projectDrawerOverlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowProjectDrawer(false);
          }}
          role="dialog"
          aria-modal="true"
        >
          <div className="header__projectDrawer" onClick={(e) => e.stopPropagation()}>
            <div className="header__projectDrawerHeader">
              <div className="header__projectDrawerTitle">Проекты</div>
              <button
                type="button"
                className="header__projectDrawerClose"
                onClick={() => setShowProjectDrawer(false)}
                aria-label="Закрыть"
              >
                <X size={18} />
              </button>
            </div>

            <div className="header__projectDrawerBody">
              {buildingProjectsLoading && (
                <div className="header__projectDrawerState">Загрузка...</div>
              )}

              {!buildingProjectsLoading && projectsList.length === 0 && (
                <div className="header__projectDrawerState">Нет проектов</div>
              )}

              {!buildingProjectsLoading &&
                projectsList.map((p, idx) => {
                  const id = p?.id ?? p?.uuid ?? String(idx);
                  const active = String(selectedProjectId ?? "") === String(id);
                  return (
                    <button
                      key={id}
                      type="button"
                      className={
                        "header__projectDrawerItem " +
                        (active ? "is-active" : "")
                      }
                      onClick={() => {
                        dispatch(setSelectedBuildingProjectId(id));
                        setShowProjectDrawer(false);
                      }}
                    >
                      <span className="header__projectDrawerItemName">
                        {p?.name || "—"}
                      </span>
                      {active && <Check size={16} />}
                    </button>
                  );
                })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Header;
