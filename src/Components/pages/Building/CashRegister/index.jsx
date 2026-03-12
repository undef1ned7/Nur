import React, { useState, useEffect } from "react";
import { useLocation, useSearchParams } from "react-router-dom";
import { useBuildingProjects } from "@/store/slices/building/projectsSlice";
import ProcurementsTab from "./ProcurementsTab";
import InstallmentsTab from "./InstallmentsTab";
import SalaryPaymentsTab from "./SalaryPaymentsTab";
import AdvanceRequestsTab from "./AdvanceRequestsTab";
import "./CashRegister.scss";

const TAB_PROCUREMENTS = "procurements";
const TAB_INSTALLMENTS = "installments";
const TAB_ADVANCES = "advances";
const TAB_SALARY = "salary";

const SUBTITLES = {
  [TAB_PROCUREMENTS]:
    "Закупки со статусом «На согласовании кассы» для выбранного ЖК.",
  [TAB_INSTALLMENTS]:
    "Подписанные договора на рассрочку для приёма платежей.",
  [TAB_ADVANCES]:
    "Заявки на аванс сотрудникам. Одобрение или отклонение.",
  [TAB_SALARY]:
    "Утверждённые периоды зарплаты по выбранному ЖК — переход к выплатам сотрудникам.",
};

export default function BuildingCashRegister() {
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const { selectedProjectId } = useBuildingProjects();
  const initialTabFromUrl = searchParams.get("tab");
  const [activeTab, setActiveTab] = useState(
    [TAB_PROCUREMENTS, TAB_INSTALLMENTS, TAB_ADVANCES, TAB_SALARY].includes(
      initialTabFromUrl,
    )
      ? initialTabFromUrl
      : TAB_PROCUREMENTS,
  );

  const handleTabChange = (nextTab) => {
    setActiveTab(nextTab);
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (nextTab === TAB_PROCUREMENTS) {
          next.delete("tab");
        } else {
          next.set("tab", nextTab);
        }
        return next;
      },
      { replace: true },
    );
  };

  useEffect(() => {
    if (location.state?.tab === "salary") {
      handleTabChange(TAB_SALARY);
    }
  }, [location.state?.tab]);

  return (
    <div className="warehouse-page">
      <div className="warehouse-header">
        <div className="warehouse-header__left">
          <div className="warehouse-header__icon-box">₽</div>
          <div className="warehouse-header__title-section">
            <h1 className="warehouse-header__title">Касса</h1>
            <p className="warehouse-header__subtitle">
              {SUBTITLES[activeTab] ?? ""}
            </p>
          </div>
        </div>
      </div>

      <div
        className="cash-register-tabs"
        style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 }}
      >
        <button
          type="button"
          onClick={() => handleTabChange(TAB_PROCUREMENTS)}
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
          onClick={() => handleTabChange(TAB_INSTALLMENTS)}
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
        <button
          type="button"
          onClick={() => handleTabChange(TAB_ADVANCES)}
          className={
            activeTab === TAB_ADVANCES
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
          Заявки на аванс
        </button>
        <button
          type="button"
          onClick={() => handleTabChange(TAB_SALARY)}
          className={
            activeTab === TAB_SALARY
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
          Выплаты зарплат
        </button>
      </div>

      {activeTab === TAB_PROCUREMENTS && (
        <ProcurementsTab selectedProjectId={selectedProjectId} />
      )}
      {activeTab === TAB_INSTALLMENTS && (
        <InstallmentsTab selectedProjectId={selectedProjectId} />
      )}
      {activeTab === TAB_ADVANCES && (
        <AdvanceRequestsTab selectedProjectId={selectedProjectId} />
      )}
      {activeTab === TAB_SALARY && (
        <SalaryPaymentsTab selectedProjectId={selectedProjectId} />
      )}
    </div>
  );
}
