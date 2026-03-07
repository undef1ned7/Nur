import React, { useEffect, useMemo, useState } from "react";
import { useDispatch } from "react-redux";
import { useNavigate } from "react-router-dom";
import { LayoutGrid, Table2, Package } from "lucide-react";
import DataContainer from "@/Components/common/DataContainer/DataContainer";
import { useBuildingProjects } from "@/store/slices/building/projectsSlice";
import { validateResErrors } from "../../../../../tools/validateResErrors";
import { fetchBuildingWarehouses } from "@/store/creators/building/warehousesCreators";
import { useBuildingWarehouses } from "@/store/slices/building/warehousesSlice";
import { getPageCount, DEFAULT_PAGE_SIZE } from "../shared/api";
import BuildingPagination from "../shared/Pagination";
import Modal from "@/Components/common/Modal/Modal";
import { useAlert } from "@/hooks/useDialog";
import { createBuildingWarehouse } from "@/store/creators/building/warehousesCreators";
import "./Stock.scss";

const CREATE_INITIAL = {
  name: "",
  is_active: true,
};

const VIEW_MODES = {
  TABLE: "table",
  CARDS: "cards",
};

const STORAGE_KEY = "building_stock_view_mode";

export default function BuildingStock() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const alert = useAlert();
  const { selectedProjectId, items: projects } = useBuildingProjects();
  const { list, count, loading, error, creating, createError } =
    useBuildingWarehouses();

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [openCreate, setOpenCreate] = useState(false);
  const [form, setForm] = useState(CREATE_INITIAL);
  const [viewMode, setViewMode] = useState(() => {
    if (typeof window === "undefined") return VIEW_MODES.TABLE;
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved === VIEW_MODES.TABLE || saved === VIEW_MODES.CARDS) return saved;
    return VIEW_MODES.TABLE;
  });

  const totalPages = useMemo(
    () => getPageCount(count, DEFAULT_PAGE_SIZE),
    [count],
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(STORAGE_KEY, viewMode);
  }, [viewMode]);

  useEffect(() => {
    if (!selectedProjectId) return;
    dispatch(
      fetchBuildingWarehouses({
        residential_complex: selectedProjectId,
        is_active: true,
        search: search || undefined,
        page,
        page_size: DEFAULT_PAGE_SIZE,
      }),
    );
  }, [dispatch, page, search, selectedProjectId]);

  const selectedProjectName = useMemo(() => {
    if (!selectedProjectId) return "—";
    const list = Array.isArray(projects) ? projects : [];
    const found = list.find(
      (p) => String(p?.id ?? p?.uuid) === String(selectedProjectId),
    );
    return found?.name || "—";
  }, [selectedProjectId, projects]);

  const handleCreateChange = (key) => (e) => {
    const value =
      key === "is_active" ? Boolean(e.target.checked) : e.target.value;
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    if (!selectedProjectId) {
      alert("Сначала выберите жилой комплекс в шапке раздела", true);
      return;
    }
    if (!String(form.name || "").trim()) return;

    try {
      const res = await dispatch(
        createBuildingWarehouse({
          residential_complex: selectedProjectId,
          name: String(form.name || "").trim(),
          is_active: Boolean(form.is_active),
        }),
      );
      if (res.meta.requestStatus === "fulfilled") {
        alert("Склад успешно создан");
        setForm(CREATE_INITIAL);
        setOpenCreate(false);
        setPage(1);
      } else {
        alert(
          validateResErrors(res.payload || res.error, "Ошибка создания склада"),
          true,
        );
      }
    } catch (err) {
      alert(validateResErrors(err, "Ошибка создания склада"), true);
    }
  };

  return (
    <div className="warehouse-page building-page building-page--stock">
      <div className="warehouse-header">
        <div className="warehouse-header__left">
          <div className="warehouse-header__icon-box">
            <Package size={24} />
          </div>
          <div className="warehouse-header__title-section">
            <h1 className="warehouse-header__title">Склады ЖК</h1>
            <p className="warehouse-header__subtitle">
              {selectedProjectId ? (
                <>
                  ЖК: <b>{selectedProjectName}</b>. Выберите склад для работы с
                  передачами и остатками.
                </>
              ) : (
                "Выберите жилой комплекс в шапке раздела, чтобы увидеть склады."
              )}
            </p>
          </div>
        </div>
        <button
          type="button"
          className="warehouse-header__create-btn"
          disabled={!selectedProjectId}
          onClick={() => setOpenCreate(true)}
        >
          Добавить склад
        </button>
      </div>

      <div className="warehouse-search-section">
        <div className="warehouse-search">
          <input
            className="warehouse-search__input"
            value={search}
            placeholder="Поиск по названию склада"
            onChange={(e) => {
              setPage(1);
              setSearch(e.target.value);
            }}
          />
        </div>
        <div className="warehouse-search__info flex flex-wrap items-center gap-2">
          <span>
            {selectedProjectId
              ? `Показано ${list.length} из ${count ?? 0} складов`
              : "Выберите жилой комплекс в шапке раздела."}
          </span>
          <div className="ml-auto flex items-center gap-2 warehouse-view-buttons">
            <button
              type="button"
              onClick={() => setViewMode(VIEW_MODES.TABLE)}
              className={`warehouse-view-btn inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm transition ${
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
              className={`warehouse-view-btn inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm transition ${
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

      {error && (
        <div className="mt-2 text-sm text-red-500">
          {String(validateResErrors(error, "Не удалось загрузить склады"))}
        </div>
      )}

      <DataContainer>
        <div className="warehouse-table-container w-full">
          {viewMode === VIEW_MODES.TABLE ? (
            <table className="warehouse-table w-full">
              <thead>
                <tr>
                  <th>Название</th>
                  <th>Статус</th>
                  <th style={{ width: 100 }}>Действия</th>
                </tr>
              </thead>
              <tbody>
                {!selectedProjectId ? (
                  <tr>
                    <td colSpan={3} className="warehouse-table__empty">
                      Выберите жилой комплекс в шапке раздела, чтобы увидеть
                      склады.
                    </td>
                  </tr>
                ) : loading && list.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="warehouse-table__loading">
                      Загрузка складов...
                    </td>
                  </tr>
                ) : !loading && list.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="warehouse-table__empty">
                      Складов пока нет. Создайте первый.
                    </td>
                  </tr>
                ) : (
                  list.map((wh) => {
                    const id = wh?.id ?? wh?.uuid;
                    return (
                      <tr
                        key={id}
                        className="stock-card"
                        onClick={() => navigate(`/crm/building/stock/${id}`)}
                      >
                        <td>{wh?.name || "Склад"}</td>
                        <td>
                          <span className="building-page__status">
                            {wh?.is_active ? "Активен" : "Неактивен"}
                          </span>
                        </td>
                        <td
                          onClick={(e) => e.stopPropagation()}
                          style={{ textAlign: "right" }}
                        >
                          <button
                            type="button"
                            className="warehouse-search__filter-btn"
                            style={{ padding: "6px 12px", fontSize: 13 }}
                            onClick={() =>
                              navigate(`/crm/building/stock/${id}`)
                            }
                          >
                            Открыть
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          ) : (
            <div className="warehouse-cards grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3 p-4">
              {!selectedProjectId ? (
                <div className="warehouse-table__empty">
                  Выберите жилой комплекс в шапке раздела, чтобы увидеть склады.
                </div>
              ) : loading && list.length === 0 ? (
                <div className="warehouse-table__loading">
                  Загрузка складов...
                </div>
              ) : !loading && list.length === 0 ? (
                <div className="warehouse-table__empty">
                  Складов пока нет. Создайте первый.
                </div>
              ) : (
                list.map((wh) => {
                  const id = wh?.id ?? wh?.uuid;
                  return (
                    <div
                      key={id}
                      className="warehouse-table__row warehouse-card stock-card cursor-pointer rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-px hover:shadow-md"
                      onClick={() => navigate(`/crm/building/stock/${id}`)}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-semibold text-slate-900 truncate">
                            {wh?.name || "Склад"}
                          </div>
                        </div>
                        <span className="building-page__status">
                          {wh?.is_active ? "Активен" : "Неактивен"}
                        </span>
                      </div>
                      <div className="flex gap-2 mt-3">
                        <button
                          type="button"
                          className="px-3 py-2 w-full rounded-lg bg-[#f7d74f] text-xs font-semibold text-gray-900 hover:bg-[#d4b800] hover:text-gray-900"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/crm/building/stock/${id}`);
                          }}
                        >
                          Открыть
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}

          <div className="flex justify-center mt-4">
            <BuildingPagination
              page={page}
              totalPages={totalPages}
              disabled={loading}
              onChange={setPage}
            />
          </div>

          {createError && (
            <div className="building-page__error" style={{ marginTop: 12 }}>
              {String(validateResErrors(createError, "Ошибка создания склада"))}
            </div>
          )}
        </div>
      </DataContainer>

      <Modal
        open={openCreate}
        onClose={() => setOpenCreate(false)}
        title="Создать склад"
      >
        <form className="building-page" onSubmit={handleCreateSubmit}>
          <label>
            <div className="building-page__label">Название склада</div>
            <input
              className="building-page__input"
              value={form.name}
              onChange={handleCreateChange("name")}
              required
            />
          </label>
          <label className="building-project-create__checkbox">
            <input
              type="checkbox"
              checked={form.is_active}
              onChange={handleCreateChange("is_active")}
            />
            <span>Активный</span>
          </label>
          {createError && (
            <div className="building-page__error">
              {String(validateResErrors(createError, "Ошибка создания склада"))}
            </div>
          )}
          <div className="building-page__actions">
            <button
              type="button"
              className="building-btn"
              onClick={() => setOpenCreate(false)}
              disabled={creating}
            >
              Отмена
            </button>
            <button
              type="submit"
              className="building-btn building-btn--primary"
              disabled={creating || !String(form.name || "").trim()}
            >
              {creating ? "Сохранение..." : "Создать"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
