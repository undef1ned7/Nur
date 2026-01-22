// import React, { useMemo } from "react";
// import "./Tabs.scss";

// const allTabs = [
//   "Моя компания",
//   "Безопасность",
//   "Токен для весов",
//   "Интерфейс",
// ];

// const Tabs = ({ activeTab, setActiveTab, company, profile }) => {
//   // Определяем, является ли сфера "магазин" (market)
//   const isMarketSector = useMemo(() => {
//     if (!company?.sector?.name) return false;
//     const sectorName = company.sector.name.toLowerCase().trim();
//     return (
//       sectorName === "магазин" ||
//       sectorName === "цветочный магазин" ||
//       sectorName.includes("магазин")
//     );
//   }, [company?.sector?.name]);

//   // Определяем, является ли пользователь владельцем
//   const isOwner = useMemo(() => {
//     return profile?.role === "owner";
//   }, [profile?.role]);

//   // Фильтруем табы в зависимости от роли и сферы
//   const visibleTabs = useMemo(() => {
//     return allTabs.filter((tab) => {
//       if (tab === "Моя компания") {
//         return isOwner;
//       }
//       if (tab === "Токен для весов") {
//         return isMarketSector;
//       }
//       // "Безопасность" всегда видна
//       return true;
//     });
//   }, [isOwner, isMarketSector]);

//   return (
//     <div className="settings-tabs">
//       {visibleTabs.map((tab) => (
//         <button
//           key={tab}
//           className={`settings-tabs__item ${
//             activeTab === tab ? "settings-tabs__item--active" : ""
//           }`}
//           onClick={() => setActiveTab(tab)}
//         >
//           {tab}
//         </button>
//       ))}
//     </div>
//   );
// };

// export default Tabs;



// src/Components/pages/Info/Settings/Tabs/Tabs.jsx
import React, { useMemo } from "react";
import "./Tabs.scss";

const allTabs = ["Моя компания", "Безопасность", "Токен для весов", "Интерфейс", "Онлайн"];

const Tabs = ({ activeTab, setActiveTab, company, profile }) => {
  const sectorName = useMemo(() => String(company?.sector?.name || "").toLowerCase().trim(), [company?.sector?.name]);

  // Определяем, является ли сфера "магазин" (market)
  const isMarketSector = useMemo(() => {
    return sectorName === "магазин" || sectorName === "цветочный магазин" || sectorName.includes("магазин");
  }, [sectorName]);

  // Определяем, является ли сфера "барбершоп"
  const isBarberSector = useMemo(() => {
    return sectorName === "барбершоп" || sectorName === "салон красоты" || sectorName.includes("барбер") || sectorName.includes("парикмахер");
  }, [sectorName]);

  // Определяем, является ли сфера "кафе"
  const isCafeSector = useMemo(() => {
    return sectorName === "кафе" || sectorName.includes("кафе") || sectorName.includes("ресторан");
  }, [sectorName]);

  const isOwner = useMemo(() => profile?.role === "owner", [profile?.role]);

  const canViewOnline = useMemo(() => {
    const hasSlug = Boolean(company?.slug);
    const canViewShowcase = Boolean(profile?.can_view_showcase);
    // Показываем владельцу всегда, а сотрудникам — если есть доступ к витрине и slug
    // Для барбершопа, кафе и магазина показываем вкладку "Онлайн"
    const hasSectorWithOnline = isBarberSector || isCafeSector || isMarketSector;
    return hasSlug && hasSectorWithOnline && (isOwner || canViewShowcase);
  }, [company?.slug, profile?.can_view_showcase, isOwner, isBarberSector, isCafeSector, isMarketSector]);

  const visibleTabs = useMemo(() => {
    return allTabs.filter((tab) => {
      if (tab === "Моя компания") return isOwner;
      if (tab === "Токен для весов") return isMarketSector;
      if (tab === "Онлайн") return canViewOnline;
      // "Безопасность" и "Интерфейс" всегда видны
      return true;
    });
  }, [isOwner, isMarketSector, canViewOnline]);

  return (
    <div className="settings-tabs">
      {visibleTabs.map((tab) => (
        <button
          key={tab}
          type="button"
          className={`settings-tabs__item ${activeTab === tab ? "settings-tabs__item--active" : ""}`}
          onClick={() => setActiveTab(tab)}
        >
          {tab}
        </button>
      ))}
    </div>
  );
};

export default Tabs;
