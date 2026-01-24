import { useState, useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import { Bell, Menu, ShoppingCart } from "lucide-react";
import { useUser } from "../../store/slices/userSlice";
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

  const { list: notifications } = useSelector((state) => state.notification);
  const unreadCount = notifications?.filter((n) => !n.is_read).length || 0;
  const { company, profile: userProfile } = useUser();

  const [showNotifications, setShowNotifications] = useState(false);
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

  return (
    <div className="header">
      <div className="header__left">
        <div className="header__burger" onClick={toggleSidebar}>
          <Menu size={24} />
        </div>
        <h2 className="header__title">{title}</h2>
      </div>
      <div className="header__right">
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
        <div className="header__profile">
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
    </div>
  );
};

export default Header;
