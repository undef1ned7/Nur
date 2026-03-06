import React, { useEffect, useMemo, useState } from "react";
import { useDispatch } from "react-redux";
import { useNavigate } from "react-router-dom";
import { useBuildingProjects } from "@/store/slices/building/projectsSlice";
import { validateResErrors } from "../../../../../tools/validateResErrors";
import { fetchBuildingWarehouses } from "@/store/creators/building/warehousesCreators";
import { useBuildingWarehouses } from "@/store/slices/building/warehousesSlice";
import { getPageCount, DEFAULT_PAGE_SIZE } from "../shared/api";
import BuildingPagination from "../shared/Pagination";
import Modal from "@/Components/common/Modal/Modal";
import { useAlert } from "@/hooks/useDialog";
import { createBuildingWarehouse } from "@/store/creators/building/warehousesCreators";

const CREATE_INITIAL = {
  name: "",
  is_active: true,
};

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

  const totalPages = useMemo(
    () => getPageCount(count, DEFAULT_PAGE_SIZE),
    [count]
  );

  useEffect(() => {
    if (!selectedProjectId) return;
    dispatch(
      fetchBuildingWarehouses({
        residential_complex: selectedProjectId,
        is_active: true,
        search: search || undefined,
        page,
        page_size: DEFAULT_PAGE_SIZE,
      })
    );
  }, [dispatch, page, search, selectedProjectId]);

  const selectedProjectName = useMemo(() => {
    if (!selectedProjectId) return "—";
    const list = Array.isArray(projects) ? projects : [];
    const found = list.find(
      (p) => String(p?.id ?? p?.uuid) === String(selectedProjectId)
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
        })
      );
      if (res.meta.requestStatus === "fulfilled") {
        alert("Склад успешно создан");
        setForm(CREATE_INITIAL);
        setOpenCreate(false);
        setPage(1);
      } else {
        alert(
          validateResErrors(res.payload || res.error, "Ошибка создания склада"),
          true
        );
      }
    } catch (err) {
      alert(
        validateResErrors(err, "Ошибка создания склада"),
        true
      );
    }
  };

  return (
    <div className="building-page">
      <div className="building-page__header">
        <div>
          <h1 className="building-page__title">Склады ЖК</h1>
          <p className="building-page__subtitle">
            ЖК: <b>{selectedProjectName}</b>. Выберите склад, чтобы работать с
            передачами и остатками.
          </p>
        </div>
        <button
          type="button"
          className="building-btn building-btn--primary"
          disabled={!selectedProjectId}
          onClick={() => setOpenCreate(true)}
        >
          Добавить склад
        </button>
      </div>

      <div className="building-page__card">
        <div className="building-page__filters">
          <input
            className="building-page__input"
            value={search}
            placeholder="Поиск по названию склада"
            onChange={(e) => {
              setPage(1);
              setSearch(e.target.value);
            }}
          />
        </div>
        {error && (
          <div className="building-page__error">
            {String(validateResErrors(error, "Не удалось загрузить склады"))}
          </div>
        )}
      </div>

      <div className="building-page__card">
        {loading && <div className="building-page__muted">Загрузка складов...</div>}
        {!loading && list.length === 0 && (
          <div className="building-page__muted">Складов пока нет.</div>
        )}

        {!loading &&
          list.map((wh) => {
            const id = wh?.id ?? wh?.uuid;
            const openDetail = () => navigate(`/crm/building/stock/${id}`);
            return (
              <div key={id} className="building-page__row">
                <div
                  role="button"
                  tabIndex={0}
                  onClick={openDetail}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") openDetail();
                  }}
                  style={{ cursor: "pointer" }}
                >
                  <div>
                    <b>{wh?.name || "Склад"}</b>
                  </div>
                  <div className="building-page__label">
                    {wh?.is_active ? "Активен" : "Неактивен"}
                  </div>
                </div>
                <div className="building-page__actions">
                  <button
                    type="button"
                    className="building-btn building-btn--primary"
                    onClick={openDetail}
                  >
                    Открыть
                  </button>
                </div>
              </div>
            );
          })}

        <BuildingPagination
          page={page}
          totalPages={totalPages}
          disabled={loading}
          onChange={setPage}
        />
      </div>

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

