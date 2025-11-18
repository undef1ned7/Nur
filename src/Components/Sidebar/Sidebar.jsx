import { useEffect, useRef, useState } from "react";
import { useDispatch } from "react-redux";
import { useUser, getProfile } from "../../store/slices/userSlice";
import { useMenuItems } from "./hooks/useMenuItems";
import MenuItem from "./components/MenuItem";
import Lang from "../Lang/Lang";
import "./Sidebar.scss";

import arnament1 from "../Photo/Group 1203.png";
import arnament2 from "../Photo/Group 1204 (1).png";
import Logo from "../Photo/logo2.png";

const Sidebar = ({ isOpen, toggleSidebar }) => {
  const dispatch = useDispatch();
  const { company, profile, tariff, sector } = useUser();
  const [openDropdown, setOpenDropdown] = useState(null);

  // Загружаем профиль при монтировании, если его нет
  useEffect(() => {
    if (!profile) {
      dispatch(getProfile());
    }
  }, [dispatch, profile]);

  // Получаем данные из Redux вместо локальных запросов
  const currentTariff = tariff || company?.subscription_plan?.name || "Старт";
  const currentSector = sector || company?.sector?.name;

  // Используем хук для сборки меню
  const menuItems = useMenuItems(
    company,
    currentSector,
    currentTariff,
    profile
  );

  // Обработка клика вне dropdown
  const dropdownRef = useRef(null);
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setOpenDropdown(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const handleToggleDropdown = (itemLabel) => {
    setOpenDropdown(openDropdown === itemLabel ? null : itemLabel);
  };

  const isLoading = !company || !profile;

  return (
    <div className={`sidebar ${isOpen ? "sidebar--visible" : ""}`}>
      <div className="sidebar__wrapper" ref={dropdownRef}>
        <img src={arnament1} className="sidebar__arnament1" alt="Декор" />
        <img src={arnament2} className="sidebar__arnament2" alt="Декор" />
        <div className="sidebar__logo">
          <img src={Logo} alt="Логотип" />
        </div>
        {isLoading && <p>Загрузка данных...</p>}
        <ul className="sidebar__menu">
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
          <Lang />
        </ul>
      </div>
    </div>
  );
};

export default Sidebar;
