// src/Components/Sectors/Barber/Masters/MastersTabs.jsx
import React, { useState } from "react";
import { FaUsers, FaMoneyBillWave, FaHistory } from "react-icons/fa";
import Masters from "../Masters.jsx";
import MastersHistory from "../MastersHistory/MastersHistory.jsx";
import MastersPayouts from "../RecordaRates/MastersPayouts/MastersPayouts.jsx";
import "./MastersTabs.scss";

const TAB_EMPLOYEES = "employees";
const TAB_PAYOUTS = "payouts";
const TAB_HISTORY = "history";

const MastersTabs = () => {
  const [activeTab, setActiveTab] = useState(TAB_EMPLOYEES);

  const renderContent = () => {
    if (activeTab === TAB_EMPLOYEES) return <Masters />;
    if (activeTab === TAB_PAYOUTS) return <MastersPayouts />;
    return <MastersHistory />;
  };

  return (
    <div className="masters-tabs">
      <div className="masters-tabs__tabbar" role="tablist" aria-label="Разделы">
        {/* Сотрудники */}
        <button
          type="button"
          className={`masters-tabs__tab ${
            activeTab === TAB_EMPLOYEES ? "masters-tabs__tab--active" : ""
          }`}
          onClick={() => setActiveTab(TAB_EMPLOYEES)}
          role="tab"
          aria-selected={activeTab === TAB_EMPLOYEES}
        >
          <FaUsers className="masters-tabs__tab-icon" />
          <span className="masters-tabs__tab-label">Сотрудники</span>
        </button>

        {/* Выплаты */}
        <button
          type="button"
          className={`masters-tabs__tab ${
            activeTab === TAB_PAYOUTS ? "masters-tabs__tab--active" : ""
          }`}
          onClick={() => setActiveTab(TAB_PAYOUTS)}
          role="tab"
          aria-selected={activeTab === TAB_PAYOUTS}
        >
          <FaMoneyBillWave className="masters-tabs__tab-icon" />
          <span className="masters-tabs__tab-label">Выплаты</span>
        </button>

        {/* История */}
        <button
          type="button"
          className={`masters-tabs__tab ${
            activeTab === TAB_HISTORY ? "masters-tabs__tab--active" : ""
          }`}
          onClick={() => setActiveTab(TAB_HISTORY)}
          role="tab"
          aria-selected={activeTab === TAB_HISTORY}
        >
          <FaHistory className="masters-tabs__tab-icon" />
          <span className="masters-tabs__tab-label">История</span>
        </button>
      </div>

      <div className="masters-tabs__content">{renderContent()}</div>
    </div>
  );
};

export default MastersTabs;
