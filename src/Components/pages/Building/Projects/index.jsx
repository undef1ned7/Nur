import React, { useEffect, useMemo, useState } from "react";
import { useDispatch } from "react-redux";
import { useLocation, useNavigate } from "react-router-dom";
import { Building2, MapPin, FileText, CheckCircle2, XCircle, LayoutGrid, Table2 } from "lucide-react";
import { fetchBuildingProjects } from "../../../../store/creators/building/projectsCreators";
import { useBuildingProjects } from "../../../../store/slices/building/projectsSlice";
import DataContainer from "@/Components/common/DataContainer/DataContainer";
import Create from "./components/Create";
import Edit from "./components/Edit";
import "./projects.scss";

const VIEW_MODES = {
  TABLE: "table",
  CARDS: "cards",
};

const STORAGE_KEY = "building_projects_view_mode";

export default function BuildingProjects() {
  const [openCreate, setOpenCreate] = useState(false);
  const [openEdit, setOpenEdit] = useState(false);
  const [activeProject, setActiveProject] = useState(null);
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState(() => {
    if (typeof window === "undefined") return VIEW_MODES.TABLE;
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved === VIEW_MODES.TABLE || saved === VIEW_MODES.CARDS) return saved;
    return VIEW_MODES.TABLE;
  });

  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const { items, raw, loading, error } = useBuildingProjects();

  const list = useMemo(() => {
    return Array.isArray(items) ? items : [];
  }, [items]);

  const effectiveList = useMemo(() => {
    if (!search.trim()) return list;
    const q = search.toLowerCase().trim();
    return list.filter((p) => {
      const name = (p?.name || "").toLowerCase();
      const address = (p?.address || "").toLowerCase();
      const description = (p?.description || "").toLowerCase();
      return name.includes(q) || address.includes(q) || description.includes(q);
    });
  }, [list, search]);

  const totalCount = list.length;
  const filteredCount = effectiveList.length;

  useEffect(() => {
    dispatch(fetchBuildingProjects());
  }, [dispatch]);

  useEffect(() => {
    if (location?.state?.openCreate) setOpenCreate(true);
  }, [location?.state]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(STORAGE_KEY, viewMode);
  }, [viewMode]);

  const handleCreated = () => {
    dispatch(fetchBuildingProjects());
  };

  const openProject = (p) => {
    const pid = p?.id ?? p?.uuid;
    if (pid) navigate(`/crm/building/projects/${pid}`);
  };

  const handleEdit = (e, p) => {
    e.stopPropagation();
    setActiveProject(p);
    setOpenEdit(true);
  };

  return (
    <div className="warehouse-page building-projects">
      <div className="warehouse-header">
        <div className="warehouse-header__left">
          <div className="warehouse-header__icon-box">
            <Building2 size={24} />
          </div>
          <div className="warehouse-header__title-section">
            <h1 className="warehouse-header__title">Жилые комплексы</h1>
            <p className="warehouse-header__subtitle">
              Список проектов строительства с поиском и фильтрами.
            </p>
          </div>
        </div>
        <button
          type="button"
          className="warehouse-header__create-btn"
          onClick={() => setOpenCreate(true)}
        >
          Добавить
        </button>
      </div>

      <div className="warehouse-search-section">
        <div className="warehouse-search">
          <input
            className="warehouse-search__input"
            value={search}
            placeholder="Поиск по названию, адресу, описанию"
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="warehouse-search__info flex flex-wrap items-center gap-2">
          <span>
            {filteredCount === totalCount
              ? `Найдено ${totalCount} проектов`
              : `Найдено ${filteredCount} из ${totalCount} проектов`}
          </span>
          <div className="ml-auto flex items-center gap-2 warehouse-view-buttons">
            <button
              type="button"
              onClick={() => setViewMode(VIEW_MODES.TABLE)}
              className={`warehouse-view-btn inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm transition
                ${
                  viewMode === VIEW_MODES.TABLE
                    ? "bg-slate-900 text-white border-slate-900"
                    : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                }`}
            >
              <Table2 size={16} />
              Таблица
            </button>
            <button
              type="button"
              onClick={() => setViewMode(VIEW_MODES.CARDS)}
              className={`warehouse-view-btn inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm transition
                ${
                  viewMode === VIEW_MODES.CARDS
                    ? "bg-slate-900 text-white border-slate-900"
                    : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                }`}
            >
              <LayoutGrid size={16} />
              Карточки
            </button>
          </div>
        </div>
      </div>

      {loading && (
        <div className="mt-2 text-sm text-slate-500">Загрузка...</div>
      )}
      {!loading && error && (
        <div className="mt-2 text-sm text-red-500">
          {typeof error === "string" ? error : JSON.stringify(error)}
        </div>
      )}

      <DataContainer>
        <div className="warehouse-table-container w-full">
          {viewMode === VIEW_MODES.TABLE ? (
            <table className="warehouse-table w-full">
              <thead>
                <tr>
                  <th>Название</th>
                  <th>Адрес</th>
                  <th>Статус</th>
                  <th style={{ width: 140 }}>Действия</th>
                </tr>
              </thead>
              <tbody>
                {loading && list.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="warehouse-table__loading">
                      Загрузка...
                    </td>
                  </tr>
                ) : !loading && effectiveList.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="warehouse-table__empty">
                      Пока нет проектов
                    </td>
                  </tr>
                ) : (
                  effectiveList.map((p, idx) => (
                    <tr
                      key={p?.id || p?.uuid || idx}
                      onClick={() => openProject(p)}
                    >
                      <td className="warehouse-table__name">
                        <div className="warehouse-table__name-cell">
                          <span>{p?.name || "—"}</span>
                        </div>
                      </td>
                      <td className="text-sm text-slate-600">
                        {p?.address || "—"}
                      </td>
                      <td>
                        <span
                          className={
                            "building-projects__badge " +
                            (p?.is_active ? "is-active" : "is-inactive")
                          }
                        >
                          {p?.is_active ? (
                            <>
                              <CheckCircle2 size={12} className="mr-1 inline" />
                              Активный
                            </>
                          ) : (
                            <>
                              <XCircle size={12} className="mr-1 inline" />
                              Неактивный
                            </>
                          )}
                        </span>
                      </td>
                      <td onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          className="px-3 py-1 rounded-lg bg-slate-100 text-xs font-semibold text-slate-700 hover:bg-slate-200"
                          onClick={(e) => handleEdit(e, p)}
                        >
                          Редактировать
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          ) : (
            <div className="warehouse-cards grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3 p-4">
              {loading && list.length === 0 ? (
                <div className="warehouse-table__loading">Загрузка...</div>
              ) : !loading && effectiveList.length === 0 ? (
                <div className="warehouse-table__empty">Пока нет проектов</div>
              ) : (
                effectiveList.map((p, idx) => (
                  <div
                    key={p?.id || p?.uuid || idx}
                    role="button"
                    tabIndex={0}
                    className="warehouse-table__row warehouse-card cursor-pointer rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-px hover:shadow-md"
                    onClick={() => openProject(p)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        openProject(p);
                      }
                    }}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <Building2 className="text-slate-500 shrink-0" size={18} />
                          <span className="text-sm font-semibold text-slate-900 truncate">
                            {p?.name || "—"}
                          </span>
                        </div>
                        <div
                          className={
                            "building-projects__badge mt-2 " +
                            (p?.is_active ? "is-active" : "is-inactive")
                          }
                        >
                          {p?.is_active ? (
                            <>
                              <CheckCircle2 size={12} className="mr-1 inline" />
                              Активный
                            </>
                          ) : (
                            <>
                              <XCircle size={12} className="mr-1 inline" />
                              Неактивный
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                    {p?.address && (
                      <div className="mt-3 flex items-start gap-2 rounded-xl bg-slate-50 p-2 text-xs text-slate-600">
                        <MapPin className="text-slate-400 shrink-0 mt-0.5" size={14} />
                        <span className="line-clamp-2">{p.address}</span>
                      </div>
                    )}
                    {p?.description && (
                      <div className="mt-2 flex items-start gap-2 rounded-xl bg-slate-50 p-2 text-xs text-slate-600">
                        <FileText className="text-slate-400 shrink-0 mt-0.5" size={14} />
                        <span className="line-clamp-3">{p.description}</span>
                      </div>
                    )}
                    <div className="mt-3" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        className="px-3 py-1.5 rounded-lg bg-slate-100 text-xs font-semibold text-slate-700 hover:bg-slate-200 w-full"
                        onClick={(e) => handleEdit(e, p)}
                      >
                        Редактировать
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
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
