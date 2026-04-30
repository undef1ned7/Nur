import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { Bell, Menu, ShoppingCart, Building2, Check, X } from "lucide-react";
import { useUser } from "../../store/slices/userSlice";
import { fetchBuildingProjects } from "../../store/creators/building/projectsCreators";
import {
  setSelectedBuildingProjectId,
  useBuildingProjects,
} from "../../store/slices/building/projectsSlice";
import NotificationModal from "../NotificationModal/NotificationModal";
import "./Header.scss";

const pageTitles = {
  "/": "Главная",
  "/login": "Вход",
  "/register": "Регистрация",
  "/submit-application": "Заявка",
  "/get-application-list": "Заявки",

  "/crm/registration": "Регистрация",
  "/crm/obzor": "Обзор",
  "/crm/vitrina": "Витрины",
  "/crm/employ": "Сотрудники",
  "/crm/employ/market": "Сотрудник",
  "/crm/zakaz": "Закупки",
  "/crm/sklad": "Склад",
  "/crm/sklad/add-product": "Товар",
  "/crm/raspisanie": "Расписание",
  "/crm/sklad-accounting": "Складской учёт",
  "/crm/analytics": "Аналитика",
  "/crm/set": "Настройки",
  "/crm/pos-print-settings": "Печать чеков",
  "/crm/debts": "Долги",
  "/crm/pending": "Ожидание",
  "/crm/logistics": "Логистика",
  "/crm/logistics-analytics": "Аналитика логистики",
  "/crm/sector": "Сфера",
  "/crm/contact": "Контакты",
  "/crm/additional-services": "Доп. услуги",
  "/crm/shifts": "Смены",
  "/crm/branch": "Филиалы",
  "/crm/barcodes": "Штрихкоды",
  "/crm/scales": "Весы",
  "/crm/departament/analytics": "Аналитика отдела",

  "/crm/sell": "Продажа",
  "/crm/sell/start": "Продажа",
  "/crm/kassa": "Касса",
  "/crm/clients": "Клиенты",
  "/crm/departments": "Отделы",
  "/crm/brand-category": "Бренд и категория",

  "/crm/barber/clients": "Клиенты",
  "/crm/barber/services": "Услуги",
  "/crm/barber/masters": "Сотрудники",
  "/crm/barber/history": "История",
  "/crm/barber/records": "Записи",
  "/crm/barber/requests": "Заявки",
  "/crm/barber/cash-reports": "Аналитика",
  "/crm/barber/warehouse": "Склад",
  "/crm/barber/client-documents": "Документы клиентов",

  "/crm/services/clients": "Клиенты",
  "/crm/services/services": "Услуги",
  "/crm/services/masters": "Сотрудники",
  "/crm/services/history": "История",
  "/crm/services/records": "Записи",
  "/crm/services/requests": "Заявки",
  "/crm/services/cash-reports": "Аналитика",
  "/crm/services/warehouse": "Склад",
  "/crm/services/documents": "Документы",
  "/crm/services/client-documents": "Документы клиентов",

  "/crm/dentistry/clients": "Клиенты",
  "/crm/dentistry/services": "Услуги",
  "/crm/dentistry/masters": "Сотрудники",
  "/crm/dentistry/history": "История",
  "/crm/dentistry/records": "Записи",
  "/crm/dentistry/requests": "Заявки",
  "/crm/dentistry/cash-reports": "Аналитика",
  "/crm/dentistry/warehouse": "Склад",
  "/crm/dentistry/documents": "Документы",
  "/crm/dentistry/client-documents": "Документы клиентов",

  "/crm/hostel/rooms": "Комнаты",
  "/crm/hostel/bookings": "Бронирования",
  "/crm/hostel/bar": "Бар",
  "/crm/hostel/clients": "Клиенты",
  "/crm/hostel/analytics": "Аналитика",
  "/crm/hostel/kassa": "Касса",
  "/crm/hostel/documents": "Документы",
  "/crm/hostel/warehouse": "Склад",

  "/crm/school/students": "Ученики",
  "/crm/school/groups": "Направления",
  "/crm/school/lessons": "Уроки",
  "/crm/school/teachers": "Сотрудники",
  "/crm/school/leads": "Заявки",
  "/crm/school/invoices": "Аналитика",
  "/crm/school/documents": "Документы",

  "/crm/market/bar": "Бар",
  "/crm/market/history": "История",
  "/crm/market/analytics": "Аналитика",
  "/crm/market/cashier": "Касса",
  "/crm/market/categories": "Категории",
  "/crm/market/procurement": "Закупки",
  "/crm/market/procurement/receipt": "Приёмка",
  "/crm/market/suppliers": "Поставщики",
  "/crm/market/documents": "Документы",
  "/crm/market/documents/create": "Новый документ",

  "/crm/building/analytics": "Аналитика",
  "/crm/building/cash-register": "Касса",
  "/crm/building/cash-register/treaty": "Договор",
  "/crm/building/cash-register/salary-payroll": "Ведомость",
  "/crm/building/clients": "Клиенты",
  "/crm/building/clients/suppliers": "Поставщик",
  "/crm/building/clients/contractors": "Подрядчик",
  "/crm/building/employees": "Сотрудники",
  "/crm/building/notification": "Уведомления",
  "/crm/building/work": "Работы",
  "/crm/building/procurement": "Закупки",
  "/crm/building/projects": "Жилые комплексы",
  "/crm/building/drawings": "Чертежи",
  "/crm/building/salary": "Зарплата",
  "/crm/building/salary/employee": "Сотрудник",
  "/crm/building/salary/payroll": "Ведомость",
  "/crm/building/sell": "Продажа",
  "/crm/building/stock": "Склад",
  "/crm/building/stock/transfer": "Перемещение",
  "/crm/building/treaty": "Договоры",

  "/crm/cafe/analytics": "Аналитика выплат",
  "/crm/cafe/menu": "Меню",
  "/crm/cafe/menu/item": "Позиция меню",
  "/crm/cafe/orders": "Заказы",
  "/crm/cafe/orders/history": "История заказов",
  "/crm/cafe/payroll": "Зарплата",
  "/crm/cafe/purchasing": "Закупки",
  "/crm/cafe/reports": "Отчёты",
  "/crm/cafe/reservations": "Бронь",
  "/crm/cafe/clients": "Гости",
  "/crm/cafe/stock": "Склад",
  "/crm/cafe/tables": "Столы",
  "/crm/cafe/kassa": "Касса",
  "/crm/cafe/documents": "Документы",
  "/crm/cafe/cook": "Кухня",
  "/crm/cafe/inventory": "Инвентаризация",
  "/crm/cafe/costing": "Калькуляция",
  "/crm/cafe/costing/preparations": "Заготовка",

  "/crm/consulting/client": "Клиенты",
  "/crm/consulting/client-requests": "Заявки",
  "/crm/consulting/kassa": "Касса",
  "/crm/consulting/teachers": "Сотрудники",
  "/crm/consulting/analytics": "Аналитика",
  "/crm/consulting/bookings": "Бронирования",
  "/crm/consulting/salary": "Зарплата",
  "/crm/consulting/sale": "Продажа",
  "/crm/consulting/services": "Услуги",

  "/crm/warehouse/warehouses": "Склады",
  "/crm/warehouse/analytics": "Аналитика",
  "/crm/warehouse/clients": "Клиенты",
  "/crm/warehouse/documents": "Документы",
  "/crm/warehouse/documents/create": "Новый документ",
  "/crm/warehouse/documents/edit": "Редактирование документа",
  "/crm/warehouse/documents/money": "Денежные документы",
  "/crm/warehouse/agents": "Агенты",
  "/crm/warehouse/movements": "Движения",
  "/crm/warehouse/products": "Товары",
  "/crm/warehouse/stocks": "Остатки",
  "/crm/warehouse/agent-stocks": "Остатки агента",
  "/crm/warehouse/stocks/add-product": "Товар",
  "/crm/warehouse/kassa": "Касса",
  "/crm/warehouse/supply": "Поставки",
  "/crm/warehouse/write_offs": "Списания",
  "/crm/warehouse/brands": "Бренды",
  "/crm/warehouse/categories": "Категории",
  "/crm/warehouse/payment_categories": "Статьи оплат",
  "/crm/warehouse/counterparties": "Контрагенты",

  "/crm/production/warehouse": "Склад",
  "/crm/production/warehouse/add-product": "Готовая продукция",
  "/crm/production/analytics": "Аналитика",
  "/crm/production/agents": "Агенты",
  "/crm/production/catalog": "Каталог",
  "/crm/production/request": "Заявки",
  "/crm/production/sell": "Продажа",
  "/crm/production/sell/start": "Продажа",

  "/crm/pilorama/warehouse": "Склад",

  "/crm/instagram": "Instagram",
  "/crm/documents": "Документы",
  "/crm/": "Каналы",
};

function resolvePageTitle(pathname) {
  const exact = pageTitles[pathname];
  if (exact) return exact;

  let bestKey = "";
  let bestTitle = null;
  for (const key of Object.keys(pageTitles)) {
    if (key === "/") continue;
    if (pathname === key || pathname.startsWith(`${key}/`)) {
      if (key.length > bestKey.length) {
        bestKey = key;
        bestTitle = pageTitles[key];
      }
    }
  }
  return bestTitle ?? "NurCRM";
}

const Header = ({ toggleSidebar, isSidebarOpen }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const title = resolvePageTitle(location.pathname);
  const dispatch = useDispatch();

  const { list: notifications } = useSelector((state) => state.notification);
  const unreadCount = notifications?.filter((n) => !n.is_read).length || 0;
  const { company, profile: userProfile } = useUser();
  const {
    items: buildingProjects,
    selectedProjectId,
    loading: buildingProjectsLoading,
    loaded: buildingProjectsLoaded,
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

  const isWarehouseSector = useMemo(() => {
    if (!company?.sector?.name) return false;
    return company.sector.name.toLowerCase().trim() === "склад";
  }, [company?.sector?.name]);

  const cashierPath = useMemo(() => {
    if (isWarehouseSector) return "/crm/warehouse/kassa";
    return "/crm/market/cashier";
  }, [isWarehouseSector]);

  // Проверяем разрешение на просмотр интерфейса кассира (can_view_cashier)
  const showCashierButton = useMemo(() => {
    if (!userProfile) return false;
    return userProfile.can_view_cashier === true;
  }, [userProfile]);

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
    if (buildingProjectsLoaded) return;
    if (Array.isArray(buildingProjects) && buildingProjects.length > 0) return;
    dispatch(fetchBuildingProjects());
  }, [
    dispatch,
    isBuildingRoute,
    buildingProjects,
    buildingProjectsLoading,
    buildingProjectsLoaded,
  ]);

  const handleProjectChange = (e) => {
    const v = e.target.value;
    dispatch(setSelectedBuildingProjectId(v || null));
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (v) next.set("residential_complex", v);
        else next.delete("residential_complex");
        return next;
      },
      { replace: true },
    );
  };

  // Синхронизация URL ?residential_complex= с Redux при загрузке/переходе по ссылке
  useEffect(() => {
    if (!isBuildingRoute) return;
    const fromUrl = searchParams.get("residential_complex");
    if (fromUrl && String(selectedProjectId ?? "") !== fromUrl) {
      dispatch(setSelectedBuildingProjectId(fromUrl));
    }
  }, [isBuildingRoute, searchParams, dispatch]);

  // При первой загрузке списка проектов: если в Redux есть выбранный проект, но в URL нет — добавить в URL
  useEffect(() => {
    if (!isBuildingRoute || !buildingProjectsLoaded) return;
    const fromUrl = searchParams.get("residential_complex");
    if (selectedProjectId && !fromUrl) {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.set("residential_complex", selectedProjectId);
          return next;
        },
        { replace: true },
      );
    }
  }, [
    isBuildingRoute,
    buildingProjectsLoaded,
    selectedProjectId,
    searchParams,
    setSearchParams,
  ]);

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
            <div className="header__project-label">ЖК</div>
            <select
              className="header__project-select"
              value={selectedProjectId ?? ""}
              onChange={handleProjectChange}
            >
              <option value="" disabled>
                {buildingProjectsLoading ? "Загрузка..." : "Выберите ЖК"}
              </option>
              {projectsList.map((p, idx) => {
                const id = String(p?.id ?? p?.uuid ?? idx);
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
            onClick={() => navigate(cashierPath)}
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
          <div
            className="header__projectDrawer"
            onClick={(e) => e.stopPropagation()}
          >
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
                  const id = String(p?.id ?? p?.uuid ?? idx);
                  const active = String(selectedProjectId ?? "") === id;
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
                        setSearchParams(
                          (prev) => {
                            const next = new URLSearchParams(prev);
                            next.set("residential_complex", id);
                            return next;
                          },
                          { replace: true },
                        );
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
