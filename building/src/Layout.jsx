import { NavLink, Outlet } from "react-router-dom";
import { useMemo } from "react";
import { useUser } from "@/store/slices/userSlice";
import { buildingMenu } from "@/Components/Sidebar/config/sectors/buildingMenu";
import "./Layout.scss";

const hasPermission = (profile, permission) => {
  if (!permission) return true;
  if (profile?.role === "owner") return true;
  return Boolean(profile?.[permission]);
};

export default function Layout() {
  const { profile } = useUser();

  const menuItems = useMemo(
    () =>
      buildingMenu
        .filter((item) => item.implemented !== false)
        .filter((item) => hasPermission(profile, item.permission)),
    [profile],
  );

  return (
    <div className="building-app">
      <aside className="building-app__sidebar">
        <div className="building-app__brand">Nur Строй</div>
        <nav className="building-app__nav">
          {menuItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `building-app__nav-link${isActive ? " building-app__nav-link--active" : ""}`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>
      <main className="building-app__content">
        <Outlet />
      </main>
    </div>
  );
}
