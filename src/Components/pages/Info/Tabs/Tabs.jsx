import React, { useMemo } from "react";
import "./Tabs.scss";

const allTabs = ["Моя компания", "Безопасность", "Токен для весов"];

const Tabs = ({ activeTab, setActiveTab, company, profile }) => {
  // Определяем, является ли сфера "магазин" (market)
  const isMarketSector = useMemo(() => {
    if (!company?.sector?.name) return false;
    const sectorName = company.sector.name.toLowerCase().trim();
    return (
      sectorName === "магазин" ||
      sectorName === "цветочный магазин" ||
      sectorName.includes("магазин")
    );
  }, [company?.sector?.name]);

  // Определяем, является ли пользователь владельцем
  const isOwner = useMemo(() => {
    return profile?.role === "owner";
  }, [profile?.role]);

  // Фильтруем табы в зависимости от роли и сферы
  const visibleTabs = useMemo(() => {
    return allTabs.filter((tab) => {
      if (tab === "Моя компания") {
        return isOwner;
      }
      if (tab === "Токен для весов") {
        return isMarketSector;
      }
      // "Безопасность" всегда видна
      return true;
    });
  }, [isOwner, isMarketSector]);

  return (
    <div className="settings-tabs">
      {visibleTabs.map((tab) => (
        <button
          key={tab}
          className={`settings-tabs__item ${
            activeTab === tab ? "settings-tabs__item--active" : ""
          }`}
          onClick={() => setActiveTab(tab)}
        >
          {tab}
        </button>
      ))}
    </div>
  );
};

export default Tabs;
