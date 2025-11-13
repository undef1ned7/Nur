import { NavLink } from "react-router-dom";

/**
 * Компонент для рендеринга пункта меню
 */
const MenuItem = ({
  item,
  isDropdownOpen,
  onToggleDropdown,
  toggleSidebar,
}) => {
  const { label, to, icon, children } = item;
  const IconComponent = typeof icon === "function" ? icon() : icon;

  return (
    <li
      className={`sidebar__menu-item-wrapper ${children ? "has-children" : ""}`}
    >
      <NavLink
        to={to}
        className={({ isActive }) =>
          `sidebar__menu-item ${isActive ? "sidebar__menu-item--active" : ""}`
        }
        onClick={(e) => {
          if (children) {
            if (!isDropdownOpen) {
              e.preventDefault();
              onToggleDropdown();
            } else {
              toggleSidebar();
            }
          } else {
            toggleSidebar();
          }
        }}
      >
        {IconComponent}
        <span>{label}</span>
      </NavLink>
      {children && (
        <ul className={`sidebar__submenu ${isDropdownOpen ? "open" : ""}`}>
          {children.map((child) => {
            const ChildIcon =
              typeof child.icon === "function" ? child.icon() : child.icon;
            return (
              <li key={child.label}>
                <NavLink
                  to={child.to}
                  className={({ isActive }) =>
                    `sidebar__submenu-item ${
                      isActive ? "sidebar__submenu-item--active" : ""
                    }`
                  }
                  onClick={toggleSidebar}
                >
                  {ChildIcon}
                  <span>{child.label}</span>
                </NavLink>
              </li>
            );
          })}
        </ul>
      )}
    </li>
  );
};

export default MenuItem;
