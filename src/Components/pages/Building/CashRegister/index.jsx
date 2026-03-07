import React, { useState } from "react";
import { useBuildingProjects } from "@/store/slices/building/projectsSlice";
import ProcurementsTab from "./ProcurementsTab";
import InstallmentsTab from "./InstallmentsTab";
import "./CashRegister.scss";

const TAB_PROCUREMENTS = "procurements";
const TAB_INSTALLMENTS = "installments";

export default function BuildingCashRegister() {
  const { selectedProjectId } = useBuildingProjects();
  const [activeTab, setActiveTab] = useState(TAB_PROCUREMENTS);

  return (
    <div className="warehouse-page">
      <div className="warehouse-header">
        <div className="warehouse-header__left">
          <div className="warehouse-header__icon-box">₽</div>
          <div className="warehouse-header__title-section">
            <h1 className="warehouse-header__title">Касса</h1>
            <p className="warehouse-header__subtitle">
              {activeTab === TAB_PROCUREMENTS
                ? "Закупки со статусом «На согласовании кассы» для выбранного ЖК."
                : "Подписанные договора на рассрочку для приёма платежей."}
            </p>
          </div>
        </div>
      </div>

      <div
        className="cash-register-tabs"
        style={{ display: "flex", gap: 8, marginBottom: 16 }}
      >
        <button
          type="button"
          onClick={() => setActiveTab(TAB_PROCUREMENTS)}
          className={
            activeTab === TAB_PROCUREMENTS
              ? "warehouse-view-btn bg-slate-900 text-white border-slate-900"
              : "warehouse-view-btn bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
          }
          style={{
            padding: "8px 16px",
            borderRadius: 8,
            border: "1px solid",
            fontWeight: 500,
          }}
        >
          Заявки на согласование
        </button>
        <button
          type="button"
          onClick={() => setActiveTab(TAB_INSTALLMENTS)}
          className={
            activeTab === TAB_INSTALLMENTS
              ? "warehouse-view-btn bg-slate-900 text-white border-slate-900"
              : "warehouse-view-btn bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
          }
          style={{
            padding: "8px 16px",
            borderRadius: 8,
            border: "1px solid",
            fontWeight: 500,
          }}
        >
          Выплаты по рассрочкам
        </button>
      </div>

      {activeTab === TAB_PROCUREMENTS && (
        <ProcurementsTab selectedProjectId={selectedProjectId} />
      )}
      {activeTab === TAB_INSTALLMENTS && (
        <InstallmentsTab selectedProjectId={selectedProjectId} />
      )}
    </div>
  );
}
