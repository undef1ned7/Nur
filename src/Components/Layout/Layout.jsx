import React, { useEffect, useState } from "react";
import Sidebar from "../Sidebar";
import Header from "../Header/Header";
import { Outlet } from "react-router-dom";
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
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [hideAnnouncement, setHideAnnouncement] = useState(false);

  useEffect(() => {
    dispatch(getCompany());
  }, [dispatch]);

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
      <div className={`App ${isSidebarOpen ? "App--sidebar-open" : ""}`}>
        <Sidebar isOpen={isSidebarOpen} toggleSidebar={toggleSidebar} />

        <div
          className={`content ${languageFunc()}`}
          onClick={isSidebarOpen ? closeSidebar : undefined}
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

          <Header toggleSidebar={toggleSidebar} isSidebarOpen={isSidebarOpen} />
          <hr />
          <div className="content_content">
            <Outlet />
            {lan === "ru" && (
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
