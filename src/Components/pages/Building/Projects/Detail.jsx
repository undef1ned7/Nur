import React, { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useBuildingProjects } from "@/store/slices/building/projectsSlice";
import ProjectInfoTab from "./DetailTabs/ProjectInfoTab";
import ProjectEmployeesTab from "./DetailTabs/ProjectEmployeesTab";
import ProjectApartmentsTab from "./DetailTabs/ProjectApartmentsTab";
import ProjectCashTab from "./DetailTabs/ProjectCashTab";

const TABS = [
  { id: "info", label: "Информация о ЖК" },
  { id: "employees", label: "Сотрудники" },
  { id: "apartments", label: "Квартиры" },
  { id: "cash", label: "Касса" },
];

export default function BuildingProjectDetail() {
  const { id } = useParams();
  const residentialId = id ? String(id) : null;
  const navigate = useNavigate();
  const { items: projects } = useBuildingProjects();
  const [activeTab, setActiveTab] = useState("info");

  const project = useMemo(() => {
    if (!residentialId) return null;
    const list = Array.isArray(projects) ? projects : [];
    return (
      list.find(
        (p) => String(p?.id ?? p?.uuid) === String(residentialId),
      ) || null
    );
  }, [projects, residentialId]);

  const handleBack = () => {
    navigate("/crm/building/projects");
  };

  return (
    <div className="building-page">
      <div className="building-page__header">
        <div>
          <h1 className="building-page__title">
            {project?.name || "ЖК"}
          </h1>
          <p className="building-page__subtitle">
            Управление жилым комплексом: информация, сотрудники, квартиры, касса.
          </p>
        </div>
        <div className="building-page__actions">
          <button
            type="button"
            className="building-btn"
            onClick={handleBack}
          >
            Назад к списку
          </button>
        </div>
      </div>

      <div className="building-page__tabs" style={{ marginBottom: 16 }}>
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={`building-btn ${activeTab === tab.id ? "building-btn--primary" : ""}`}
            onClick={() => setActiveTab(tab.id)}
            style={{ marginRight: 8 }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="building-page__tab-content">
        {activeTab === "info" && <ProjectInfoTab project={project} />}
        {activeTab === "employees" && (
          <ProjectEmployeesTab residentialId={residentialId} />
        )}
        {activeTab === "apartments" && (
          <ProjectApartmentsTab residentialId={residentialId} />
        )}
        {activeTab === "cash" && (
          <ProjectCashTab project={project} residentialId={residentialId} />
        )}
      </div>
    </div>
  );
}
