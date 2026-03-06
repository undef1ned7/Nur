import { NavLink, useLocation, useNavigate, useSearchParams } from "react-router-dom";

// Маппинг path (из URL сайдбара) в doc_type для подсветки при создании документа
const DOC_TYPE_PATH_TO_API = {
  sale: "SALE",
  purchase: "PURCHASE",
  sale_return: "SALE_RETURN",
  purchase_return: "PURCHASE_RETURN",
  inventory: "INVENTORY",
  receipt: "RECEIPT",
  write_off: "WRITE_OFF",
  transfer: "TRANSFER",
};

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
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const IconComponent = typeof icon === "function" ? icon() : icon;
  const isDocumentsSection =
    to?.includes("warehouse/documents") && children?.length > 0;
  const createPageDocType = searchParams.get("doc_type");
  const isOnCreatePage = location.pathname.includes("warehouse/documents/create");

  // Проверяем настройку автоматического закрытия сайдбара
  const shouldCloseOnClick = () => {
    const isMobile = window.innerWidth < 769;
    const sidebarAutoClose =
      localStorage.getItem("sidebarAutoClose") === "true";

    // На мобильных всегда закрываем при клике
    if (isMobile) {
      return true;
    }

    // На десктопе закрываем только если настройка включена
    return sidebarAutoClose;
  };

  const handleClick = (e) => {
    if (children) {
      if (!isDropdownOpen) {
        e.preventDefault();
        onToggleDropdown();
        navigate(to);
      } else {
        e.preventDefault();
        onToggleDropdown();
        if (shouldCloseOnClick()) {
          toggleSidebar();
        }
      }
    } else {
      if (shouldCloseOnClick()) {
        toggleSidebar();
      }
    }
  };

  // «Бренды и категории» в складе: одна страница с вкладками (brands/categories/payment_categories) — пункт сайдбара должен оставаться активным на любой вкладке
  const brandCategoryPaths = [
    "/crm/warehouse/brands",
    "/crm/warehouse/categories",
    "/crm/warehouse/payment_categories",
  ];
  const isBrandCategorySection =
    to === "/crm/warehouse/brands" &&
    brandCategoryPaths.some(
      (path) =>
        location.pathname === path || location.pathname.startsWith(path + "/")
    );

  return (
    <li
      className={`sidebar__menu-item-wrapper ${children ? "has-children" : ""}`}
    >
      <NavLink
        to={to}
        className={({ isActive }) => {
          const active = isActive || isBrandCategorySection;
          return `sidebar__menu-item ${active ? "sidebar__menu-item--active" : ""}`;
        }}
        onClick={handleClick}
      >
        {IconComponent}
        <span>{label}</span>
      </NavLink>
      {children && (
        <ul className={`sidebar__submenu ${isDropdownOpen ? "open" : ""}`}>
          {children.map((child) => {
            const ChildIcon =
              typeof child.icon === "function" ? child.icon() : child.icon;
            const isMoneyDocument = child.to?.includes("/money/");
            const childPathSegment = child.to?.split("/").filter(Boolean).pop();
            const childDocType = DOC_TYPE_PATH_TO_API[childPathSegment];
            const isActiveOnCreatePage =
              isDocumentsSection &&
              isOnCreatePage &&
              !isMoneyDocument &&
              childDocType &&
              createPageDocType === childDocType;
            return (
              <li key={child.label}>
                <NavLink
                  to={child.to}
                  className={({ isActive }) =>
                    `sidebar__submenu-item ${
                      isActive || isActiveOnCreatePage
                        ? "sidebar__submenu-item--active"
                        : ""
                    }`
                  }
                  onClick={() => {
                    if (shouldCloseOnClick()) {
                      toggleSidebar();
                    }
                  }}
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
