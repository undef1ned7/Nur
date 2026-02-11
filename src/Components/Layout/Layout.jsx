import { useCallback, useEffect, useMemo, useState } from "react";
import Sidebar from "../Sidebar/Sidebar";
import Header from "../Header/Header";
import { Outlet, useLocation } from "react-router-dom";
import arnament from "../Photo/Group 1216.png";
import arnament2 from "../Photo/Group 1204.png";
import arnament3 from "../Photo/Group 1215.png";
import "./Layout.scss";
import { X } from "lucide-react";
import { useUser } from "../../store/slices/userSlice";
import { useDispatch } from "react-redux";
import { useTranslation } from "react-i18next";
import { FaArrowUp } from "react-icons/fa";
import { useDebounce } from "../../hooks/useDebounce";
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
  const { company } = useUser();
  const rootBlock = useMemo(() => {
    return document.getElementById('root')
  }, [])
  const [isArrowView, setIsArrowView] = useState(false);

  const [isSidebarOpen, setIsSidebarOpen] = useState(() => {
    if (typeof window !== "undefined") {
      const isDesktop = window.innerWidth >= 769;
      const sidebarAutoClose =
        localStorage.getItem("sidebarAutoClose") === "true";
      if (isDesktop) return !sidebarAutoClose;
      return false;
    }
    return true;
  });

  const [hideAnnouncement, setHideAnnouncement] = useState(false);
  const location = useLocation();

  const isHidden = useMemo(() => {
    return location.pathname.startsWith("/crm/market/cashier") || location.pathname.startsWith("/crm/sell/start");
  }, [location.pathname]);

  useEffect(() => {
    const savedSetting = localStorage.getItem("sidebarAutoClose");
    const sidebarAutoClose = savedSetting === "true";

    if (sidebarAutoClose) setIsSidebarOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const handleResize = () => {
      if (rootBlock.scrollTop > 800) {
        setIsArrowView(true)
      } else if (isArrowView) {
        setIsArrowView(false)
      }
      const savedSetting = localStorage.getItem("sidebarAutoClose");
      const sidebarAutoClose = savedSetting === "true";

      if (window.innerWidth >= 769 && !sidebarAutoClose) {
        setIsSidebarOpen(true);
      }
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const scrollHandle = useCallback(useDebounce(() => {
    if (rootBlock.scrollTop > 800) {
      setIsArrowView(true)
    } else {
      setIsArrowView(false)
    }
  }), [rootBlock])
  useEffect(() => {
    rootBlock.addEventListener("scroll", scrollHandle);
    return () => rootBlock.removeEventListener("scroll", scrollHandle);
  }, [scrollHandle])

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [location.pathname]);

  useEffect(() => {
    const isMobile = window.innerWidth < 769;

    if (isMobile && isSidebarOpen && isHidden) {
      const scrollY = window.scrollY;

      document.body.style.position = "fixed";
      document.body.style.top = `-${scrollY}px`;
      document.body.style.width = "100%";
      document.body.style.overflow = "hidden";
      document.body.style.touchAction = "none";
      document.documentElement.style.overflow = "hidden";

      const handleResize = () => {
        if (window.innerWidth >= 769) {
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

      return () => {
        window.removeEventListener("resize", handleResize);
        document.body.style.position = "";
        document.body.style.top = "";
        document.body.style.width = "";
        document.body.style.overflow = "";
        document.body.style.touchAction = "";
        document.documentElement.style.overflow = "";
        window.scrollTo(0, scrollY);
      };
    }
  }, [isSidebarOpen, isHidden]);

  const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);
  const closeSidebar = () => setIsSidebarOpen(false);

  const lan = localStorage.getItem("i18nextLng") || "ru";
  const languageFunc = () => {
    if (lan === "ru") return "app-ru";
    if (lan === "ky") return "app-ky";
    if (lan === "en") return "app-en";
  };
  const { t, i18n } = useTranslation();

  const changeLanguage = (lng) => {
    i18n.changeLanguage(lng);
    localStorage.setItem("i18nextLng", lng);
  };

  const daysLeft = useAnnouncement(company, setHideAnnouncement);
  return (
    <div className="layout-wrapper">
      {/* насилное поставка вона  */}
      <div
        className="content_background"

      ></div>

      <div className={`App ${!isSidebarOpen ? "sidebar-collapsed" : ""}`}>
        {!isHidden && (
          <Sidebar isOpen={isSidebarOpen} toggleSidebar={toggleSidebar} />
        )}

        {isSidebarOpen && !isHidden && (
          <div
            className="sidebar-overlay"
            onClick={closeSidebar}
            aria-hidden="true"
          />
        )}

        <div
          className={`content ${languageFunc()} ${isSidebarOpen && !isHidden ? "content--sidebar-open" : ""
            } ${isHidden ? "content--full-width" : ""}`}
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

          {!isHidden && (
            <>
              <Header
                toggleSidebar={toggleSidebar}
                isSidebarOpen={isSidebarOpen}
              />
            </>
          )}
          <div className="content_content">
            <Outlet />
            {lan === "ru" && !isHidden && (
              <>
                <img src={arnament} className="content_image1" alt="" />
                <img src={arnament2} className="content_image2" alt="" />
                <img src={arnament3} className="content_image3" alt="" />
              </>
            )}{
              isArrowView && (
                <button onClick={() => {
                  rootBlock?.scrollTo?.({
                    top: 0,
                    behavior: 'smooth'
                  })
                }
                } className="bg-amber-400 fixed text-white p-2 rounded-full cursor-pointer z-50 bottom-10 right-10">
                  <FaArrowUp />
                </button>)}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Layout;
