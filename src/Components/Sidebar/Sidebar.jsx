import { useEffect, useRef, useState } from "react";
import { useDispatch } from "react-redux";
import { useUser, getProfile } from "../../store/slices/userSlice";
import { useMenuItems } from "./hooks/useMenuItems";
import MenuItem from "./components/MenuItem";
import "./Sidebar.scss";
import { X } from "lucide-react";

import arnament1 from "../Photo/Group 1203.png";
import arnament2 from "../Photo/Group 1204 (1).png";
import Logo from "../Photo/logo2.png";
import { useLocation, useNavigate } from "react-router-dom";
import { getCompany } from "../../store/creators/userCreators";

const Sidebar = ({ isOpen, toggleSidebar }) => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { company, profile, tariff, sector } = useUser();
  const [openDropdown, setOpenDropdown] = useState(null);

  const location = useLocation();
  const menuRef = useRef(null); // 👈 ref теперь на меню
  const pathnameRef = useRef(location.pathname);
  const openDropdownRef = useRef(openDropdown);

  useEffect(() => {
    pathnameRef.current = location.pathname;
  }, [location.pathname]);

  useEffect(() => {
    openDropdownRef.current = openDropdown;
  }, [openDropdown]);

  // Раскрывать подменю «Документы» на странице документов, закрывать при уходе
  useEffect(() => {
    if (location.pathname.includes("warehouse/documents")) {
      setOpenDropdown((prev) => (prev === "Документы" ? prev : "Документы"));
    } else {
      setOpenDropdown(null);
    }
  }, [location.pathname]);

  const currentTariff = tariff || company?.subscription_plan?.name || "Старт";
  const currentSector = sector || company?.sector?.name;

  const menuItems = useMenuItems(
    company,
    currentSector,
    currentTariff,
    profile
  );

  // клик вне сайдбара
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        // На страницах документов склада фиксируем раскрытие «Документы»,
        // чтобы при кликах по контенту (например, кнопка «Создать») dropdown
        // не закрывался и не "открывался заново" после навигации.
        const pathname = pathnameRef.current || "";
        const currentOpen = openDropdownRef.current;
        const isWarehouseDocuments = pathname.includes("warehouse/documents");
        const isDocumentsDropdownOpen = currentOpen === "Документы";
        if (isWarehouseDocuments && isDocumentsDropdownOpen) return;

        setOpenDropdown(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // 🔥 сброс скролла меню при смене страницы
  useEffect(() => {
    if (menuRef.current) {
      menuRef.current.scrollTo({
        top: 0,
        left: 0,
        behavior: "auto",
      });
    }
  }, [location.pathname]);

  const handleToggleDropdown = (itemLabel) => {
    setOpenDropdown(openDropdown === itemLabel ? null : itemLabel);
  };

  useEffect(() => {
    dispatch(getCompany());
    dispatch(getProfile())
  }, [])

  const isLoading = !company || !profile;
  useEffect(() => {
    if (location.pathname.includes('crm') && location.pathname.split('/').map(el => el.trim()).filter(Boolean).length == 1 && menuItems.length && !isLoading) {
      navigate(menuItems.at(0).to);
    }
  }, [menuItems, isLoading])
  return (
    <div
      className={`sidebar ${isOpen ? "sidebar--visible" : "sidebar--collapsed"
        }`}
    >
      <img src={arnament1} className="sidebar__arnament1" alt="Декор" />
      <img src={arnament2} className="sidebar__arnament2" alt="Декор" />
      <div className="sidebar__header">
        <div className="sidebar__logo">
          <img src={Logo} alt="Логотип" />
        </div>
        <button
          className="sidebar__close-btn"
          onClick={toggleSidebar}
          aria-label="Закрыть сайдбар"
        >
          <X size={20} />
        </button>
      </div>

      <div className="sidebar__wrapper">
        {isLoading && (
          <div className="sidebar__loading">
            <div className="sidebar__loading-spinner"></div>
            <p className="sidebar__loading-text">Загрузка данных...</p>
          </div>
        )}

        <ul className="sidebar__menu" ref={menuRef}>
          {!isLoading &&
            menuItems.map((item) => (
              <MenuItem
                key={item.label}
                item={item}
                isDropdownOpen={openDropdown === item.label}
                onToggleDropdown={() => handleToggleDropdown(item.label)}
                toggleSidebar={toggleSidebar}
              />
            ))}
          {/* <Lang /> */}
        </ul>
      </div>
    </div>
  );
};

export default Sidebar;