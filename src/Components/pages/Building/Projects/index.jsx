import React, { useEffect, useMemo, useState } from "react";
import { useDispatch } from "react-redux";
import { Building2, MapPin, FileText, CheckCircle2, XCircle } from "lucide-react";
import { fetchBuildingProjects } from "../../../../store/creators/building/projectsCreators";
import { useBuildingProjects } from "../../../../store/slices/building/projectsSlice";
import Create from "./components/Create";
import Edit from "./components/Edit";
import "./projects.scss"; // styles
import DataContainer from "../../../common/DataContainer/DataContainer";

export default function BuildingProjects() {
  const [openCreate, setOpenCreate] = useState(false);
  const [openEdit, setOpenEdit] = useState(false);
  const [activeProject, setActiveProject] = useState(null);
  const dispatch = useDispatch();
  const { items, raw, loading, error } = useBuildingProjects();

  const list = useMemo(() => {
    // ВАЖНО: UI всегда рендерим из items, чтобы update/delete сразу отражались
    return Array.isArray(items) ? items : [];
  }, [items]);

  useEffect(() => {
    dispatch(fetchBuildingProjects());
  }, [dispatch]);

  const handleCreated = () => {
    // после успешного создания — обновим список
    dispatch(fetchBuildingProjects());
  };

  return (
    <div className="building-projects">
      <div className="building-projects__header">
        <div className="building-projects__title">Проекты</div>
        <button
          type="button"
          className="building-btn building-btn--primary"
          onClick={() => setOpenCreate(true)}
        >
          Добавить
        </button>
      </div>

      {loading && <div className="building-projects__state">Загрузка...</div>}
      {!loading && error && (
        <div className="building-projects__error">
          {typeof error === "string" ? error : JSON.stringify(error)}
        </div>
      )}

      {!loading && !error && list.length === 0 && (
        <div className="building-projects__state">Пока нет проектов</div>
      )}
      <DataContainer>
        <div className="building-projects__grid">
          {list.map((p, idx) => (
            <div
              className="building-projects__card building-projects__card--clickable"
              key={p?.id || p?.uuid || idx}
              role="button"
              tabIndex={0}
              onClick={() => {
                setActiveProject(p);
                setOpenEdit(true);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  setActiveProject(p);
                  setOpenEdit(true);
                }
              }}
            >
              <div className="building-projects__cardTop">
                <div className="building-projects__name">
                  <Building2 className="building-projects__icon" size={16} />
                  <span>{p?.name || "—"}</span>
                </div>
                <div
                  className={
                    "building-projects__badge " +
                    (p?.is_active ? "is-active" : "is-inactive")
                  }
                >
                  {p?.is_active ? (
                    <>
                      <CheckCircle2 className="building-projects__badgeIcon" size={14} />
                      Активный
                    </>
                  ) : (
                    <>
                      <XCircle className="building-projects__badgeIcon" size={14} />
                      Неактивный
                    </>
                  )}
                </div>
              </div>
              {p?.address && (
                <div className="building-projects__row">
                  <MapPin className="building-projects__icon building-projects__icon--muted" size={16} />
                  <div className="building-projects__meta">
                    <span className="building-projects__metaLabel">Адрес:</span>{" "}
                    {p.address}
                  </div>
                </div>
              )}
              {p?.description && (
                <div className="building-projects__row">
                  <FileText className="building-projects__icon building-projects__icon--muted" size={16} />
                  <div className="building-projects__desc">{p.description}</div>
                </div>
              )}
            </div>
          ))}
        </div>
      </DataContainer>

      <Create
        open={openCreate}
        onClose={() => setOpenCreate(false)}
        onCreated={handleCreated}
      />

      <Edit
        open={openEdit}
        onClose={() => setOpenEdit(false)}
        project={activeProject}
      />
    </div>
  );
}