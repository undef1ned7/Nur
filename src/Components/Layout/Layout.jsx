import React, { useEffect, useState } from "react";
import Sidebar from "../Sidebar/Sidebar";
import Header from "../Header/Header";
import { Outlet, useLocation } from "react-router-dom";
import arnament from "../Photo/Group 1216.png";
import arnament2 from "../Photo/Group 1204.png";
import arnament3 from "../Photo/Group 1215.png";
import arnament4 from "../Photo/gory.jpg";
import "./Layout.scss";
import { X } from "lucide-react";
import { useUser } from "../../store/slices/userSlice";
import { getCompany } from "../../store/creators/userCreators";
import { useDispatch } from "react-redux";

const useAnnouncement = (company, setHideAnnouncement) => {
  const [daysLeft, setDaysLeft] = useState(null);

  useEffect(() => {
    if (!company?.end_date) return;

    const endDate = new Date(company.end_date);
    const now = new Date();

    const diff = endDate - now;
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));

    if (days <= 3 && days >= 0) {
      setDaysLeft(days);

      const timer = setTimeout(() => {
        setHideAnnouncement(true);
      }, 10000);

      return () => clearTimeout(timer);
    } else {
      setDaysLeft(null);
    }
  }, [company, setHideAnnouncement]);

  return daysLeft;
};

const Layout = () => {
  const dispatch = useDispatch();
  const { company } = useUser();
  // На десктопе по умолчанию сайдбар открыт, на мобильных - закрыт
  // Но учитываем настройку автоматического закрытия
  const [isSidebarOpen, setIsSidebarOpen] = useState(() => {
    if (typeof window !== "undefined") {
      const isDesktop = window.innerWidth >= 769;
      const sidebarAutoClose =
        localStorage.getItem("sidebarAutoClose") === "true";

      // На десктопе: открыт по умолчанию, если настройка не требует закрытия
      if (isDesktop) {
        return !sidebarAutoClose;
      }
      // На мобильных: закрыт по умолчанию
      return false;
    }
    return true; // По умолчанию открыт для SSR
  });
  const [hideAnnouncement, setHideAnnouncement] = useState(false);
  const location = useLocation();

  // Проверяем, является ли текущий путь страницей кассы (должно быть объявлено до использования)
  const isCashierPage = location.pathname.startsWith("/crm/market/cashier");

  useEffect(() => {
    dispatch(getCompany());
  }, [dispatch]);

  // Проверяем настройку автоматического закрытия сайдбара при переходах
  useEffect(() => {
    const savedSetting = localStorage.getItem("sidebarAutoClose");
    const sidebarAutoClose = savedSetting === "true";

    // Только если настройка явно включена (true) - закрываем сайдбар
    if (sidebarAutoClose) {
      setIsSidebarOpen(false);
    }
    // Если настройка выключена (false) или не установлена (null) - НЕ меняем состояние сайдбара
    // Это предотвращает "прыгание" сайдбара при переходах
  }, [location.pathname]);

  // Обновляем состояние при изменении размера окна
  useEffect(() => {
    const handleResize = () => {
      const savedSetting = localStorage.getItem("sidebarAutoClose");
      const sidebarAutoClose = savedSetting === "true";

      if (window.innerWidth >= 769) {
        // На десктопе открываем сайдбар, если настройка не требует автоматического закрытия
        if (!sidebarAutoClose) {
          setIsSidebarOpen(true);
        }
        // Если настройка включена - не меняем состояние (остается как было)
      } else {
        // На мобильных устройствах НЕ меняем состояние сайдбара при изменении размера
        // Состояние должно управляться только через настройку автоматического закрытия при переходах
        // или пользователем вручную
      }
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // 🔹 каждый переход на новый роут — скроллим страницу наверх
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [location.pathname]);

  // 🔒 Блокировка скролла body когда сайдбар открыт на мобильных
  useEffect(() => {
    const isMobile = window.innerWidth < 769;
    
    if (isMobile && isSidebarOpen && !isCashierPage) {
      // Сохраняем текущую позицию скролла
      const scrollY = window.scrollY;
      
      // Блокируем скролл
      document.body.style.position = "fixed";
      document.body.style.top = `-${scrollY}px`;
      document.body.style.width = "100%";
      document.body.style.overflow = "hidden";
      document.body.style.touchAction = "none";
      
      // Также блокируем скролл на html элементе для дополнительной защиты
      document.documentElement.style.overflow = "hidden";
      
      // Обработчик изменения размера окна (например, поворот экрана)
      const handleResize = () => {
        const stillMobile = window.innerWidth < 769;
        if (!stillMobile) {
          // Если перешли на десктоп, восстанавливаем скролл
          document.body.style.position = "";
          document.body.style.top = "";
          document.body.style.width = "";
          document.body.style.overflow = "";
          document.body.style.touchAction = "";
          document.documentElement.style.overflow = "";
          window.scrollTo(0, scrollY);
        }
      };
      
      window.addEventListener("resize", handleResize);
      
      // Восстанавливаем скролл при закрытии
      return () => {
        window.removeEventListener("resize", handleResize);
        document.body.style.position = "";
        document.body.style.top = "";
        document.body.style.width = "";
        document.body.style.overflow = "";
        document.body.style.touchAction = "";
        document.documentElement.style.overflow = "";
        // Восстанавливаем позицию скролла
        window.scrollTo(0, scrollY);
      };
    }
  }, [isSidebarOpen, isCashierPage]);

  const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);
  const closeSidebar = () => setIsSidebarOpen(false);

  const lan = localStorage.getItem("i18nextLng") || "ru";
  const languageFunc = () => {
    if (lan === "ru") return "app-ru";
    if (lan === "ky") return "app-ky";
    if (lan === "en") return "app-en";
  };

  const daysLeft = useAnnouncement(company, setHideAnnouncement);

  return (
    <div className="layout-wrapper">
      <div
        style={{
          backgroundImage: lan === "ky" ? `url(${arnament4})` : "none",
        }}
        className="content_background"
      ></div>

      <div className={`App ${!isSidebarOpen ? "sidebar-collapsed" : ""}`}>
        {!isCashierPage && (
          <Sidebar isOpen={isSidebarOpen} toggleSidebar={toggleSidebar} />
        )}

        {/* Overlay для мобильных устройств */}
        {isSidebarOpen && !isCashierPage && (
          <div
            className="sidebar-overlay"
            onClick={closeSidebar}
            aria-hidden="true"
          />
        )}

        <div
          className={`content ${languageFunc()} ${
            isSidebarOpen && !isCashierPage ? "content--sidebar-open" : ""
          } ${isCashierPage ? "content--full-width" : ""}`}
        >
          {daysLeft !== null && !hideAnnouncement && (
            <div className="announcement">
              <span></span>
              <div className="announcement__content">
                <p>
                  ⚠️ Уведомляем, что срок вашей <br />
                  подписки истекает через <b>{daysLeft}</b>{" "}
                  {daysLeft === 1 ? "день" : "дня(ей)"}. <br />
                  Рекомендуем продлить её заранее, <br />
                  чтобы сохранить доступ ко всем функциям.
                </p>
              </div>
              <button
                className="announcement__close"
                onClick={() => setHideAnnouncement(true)}
              >
                <X />
              </button>
            </div>
          )}

          {!isCashierPage && (
            <>
              <Header
                toggleSidebar={toggleSidebar}
                isSidebarOpen={isSidebarOpen}
              />
              <hr />
            </>
          )}
          <div className="content_content">
            <Outlet />
            {lan === "ru" && !isCashierPage && (
              <>
                <img src={arnament} className="content_image1" alt="" />
                <img src={arnament2} className="content_image2" alt="" />
                <img src={arnament3} className="content_image3" alt="" />
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Layout;
