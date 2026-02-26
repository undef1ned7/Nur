import React, { useEffect, useMemo, useState } from "react";
import Modal from "@/Components/common/Modal/Modal";
import { useAlert, useConfirm } from "@/hooks/useDialog";
import { useBuildingProjects } from "@/store/slices/building/projectsSlice";
import { validateResErrors } from "../../../../../tools/validateResErrors";
import {
  createBuildingProcurement,
  createBuildingTransferFromProcurement,
  fetchBuildingProcurements,
  submitBuildingProcurementToCash,
} from "@/store/creators/building/procurementsCreators";
import { useDispatch } from "react-redux";
import { getPageCount, DEFAULT_PAGE_SIZE } from "../shared/api";
import {
  PROCUREMENT_STATUS_LABELS,
  asCurrency,
  asDateTime,
  statusLabel,
} from "../shared/constants";
import BuildingPagination from "../shared/Pagination";
import { useBuildingProcurements } from "@/store/slices/building/procurementsSlice";
import { useNavigate } from "react-router-dom";

const CREATE_INITIAL = {
  title: "",
  comment: "",
};

const statusClass = (status) => {
  if (status === "cash_rejected" || status === "partially_transferred") {
    return "building-page__status is-danger";
  }
  if (status === "cash_approved" || status === "transferred") {
    return "building-page__status is-success";
  }
  if (status === "submitted_to_cash" || status === "transfer_created") {
    return "building-page__status is-warning";
  }
  return "building-page__status";
};

export default function BuildingProcurement() {
  const alert = useAlert();
  const confirm = useConfirm();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { selectedProjectId, items: projects } = useBuildingProjects();

  const {
    list,
    count,
    loading,
    error,
    creating,
    createError: createErrorFromSlice,
    submittingToCashIds,
    creatingTransferIds,
    actionError,
  } = useBuildingProcurements();
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({ search: "", status: "" });
  const [openCreate, setOpenCreate] = useState(false);
  const [createForm, setCreateForm] = useState(CREATE_INITIAL);

  const selectedProjectName = useMemo(() => {
    const listProjects = Array.isArray(projects) ? projects : [];
    const found = listProjects.find(
      (project) => String(project?.id ?? project?.uuid) === String(selectedProjectId)
    );
    return found?.name || "—";
  }, [projects, selectedProjectId]);

  const totalPages = useMemo(() => getPageCount(count, DEFAULT_PAGE_SIZE), [count]);

  useEffect(() => {
    if (!selectedProjectId) return;
    dispatch(
      fetchBuildingProcurements({
        residential_complex: selectedProjectId,
        status: filters.status || undefined,
        search: filters.search || undefined,
        page,
        page_size: DEFAULT_PAGE_SIZE,
      })
    );
  }, [dispatch, filters.search, filters.status, page, selectedProjectId]);

  const onCreate = async (e) => {
    e.preventDefault();
    if (!selectedProjectId) {
      alert("Сначала выберите жилой комплекс в шапке", true);
      return;
    }
    if (!String(createForm.title).trim()) return;

    try {
      const res = await dispatch(
        createBuildingProcurement({
          residential_complex: selectedProjectId,
          title: String(createForm.title || "").trim(),
          comment: String(createForm.comment || "").trim(),
        })
      );
      if (res.meta.requestStatus === "fulfilled") {
        setCreateForm(CREATE_INITIAL);
        setOpenCreate(false);
        alert("Закупка успешно создана");
        setPage(1);
      } else {
        alert(validateResErrors(res.payload || res.error, "Ошибка создания закупки"), true);
      }
    } catch (err) {
      alert(validateResErrors(err, "Ошибка создания закупки"), true);
    }
  };

  const onSubmitToCash = (procurement) => {
    const procurementId = procurement?.id ?? procurement?.uuid;
    if (!procurementId) return;
    confirm("Отправить закупку в кассу?", async (ok) => {
      if (!ok) return;
      try {
        const res = await dispatch(submitBuildingProcurementToCash(procurementId));
        if (res.meta.requestStatus === "fulfilled") {
          alert("Закупка отправлена в кассу");
        } else {
          alert(validateResErrors(res.payload || res.error, "Не удалось отправить в кассу"), true);
        }
      } catch (err) {
        alert(validateResErrors(err, "Не удалось отправить в кассу"), true);
      }
    });
  };

  const onCreateTransfer = (procurement) => {
    const procurementId = procurement?.id ?? procurement?.uuid;
    if (!procurementId) return;
    confirm("Создать передачу на склад по этой закупке?", async (ok) => {
      if (!ok) return;
      try {
        const res = await dispatch(
          createBuildingTransferFromProcurement({ procurementId, payload: { note: "" } })
        );
        if (res.meta.requestStatus === "fulfilled") {
          alert("Передача на склад создана");
        } else {
          alert(validateResErrors(res.payload || res.error, "Не удалось создать передачу"), true);
        }
      } catch (err) {
        alert(validateResErrors(err, "Не удалось создать передачу"), true);
      }
    });
  };

  const renderActions = (procurement) => {
    const status = procurement?.status;
    const pid = procurement?.id ?? procurement?.uuid;
    if (status === "draft") {
      const busy = pid != null && submittingToCashIds?.[pid] === true;
      return (
        <button
          type="button"
          className="building-btn building-btn--primary"
          onClick={() => onSubmitToCash(procurement)}
          disabled={busy}
        >
          {busy ? "Отправка..." : "Отправить в кассу"}
        </button>
      );
    }
    if (status === "cash_approved") {
      const busy = pid != null && creatingTransferIds?.[pid] === true;
      return (
        <button
          type="button"
          className="building-btn building-btn--primary"
          onClick={() => onCreateTransfer(procurement)}
          disabled={busy}
        >
          {busy ? "Создание..." : "Создать передачу"}
        </button>
      );
    }
    return null;
  };

  return (
    <div className="building-page">
      <div className="building-page__header">
        <div>
          <h1 className="building-page__title">Закупки строительства</h1>
          <p className="building-page__subtitle">
            ЖК: <b>{selectedProjectName}</b>. Управляйте заявками, отправкой в кассу и
            созданием передач на склад.
          </p>
        </div>
        <button
          type="button"
          className="building-btn building-btn--primary"
          onClick={() => setOpenCreate(true)}
          disabled={!selectedProjectId}
        >
          Новая закупка
        </button>
      </div>

      <div className="building-page__card">
        <div className="building-page__filters">
          <input
            className="building-page__input"
            value={filters.search}
            placeholder="Поиск по названию и комментарию"
            onChange={(e) => {
              setPage(1);
              setFilters((prev) => ({ ...prev, search: e.target.value }));
            }}
          />
          <select
            className="building-page__select"
            value={filters.status}
            onChange={(e) => {
              setPage(1);
              setFilters((prev) => ({ ...prev, status: e.target.value }));
            }}
          >
            <option value="">Все статусы</option>
            {Object.entries(PROCUREMENT_STATUS_LABELS).map(([key, value]) => (
              <option key={key} value={key}>
                {value}
              </option>
            ))}
          </select>
        </div>
        {error && <div className="building-page__error">{String(error)}</div>}
      </div>

      <div className="building-page__grid">
        <div className="building-page__card">
          <h3 className="building-page__cardTitle">Список закупок</h3>
          {!selectedProjectId && (
            <div className="building-page__muted">
              Выберите проект, чтобы увидеть закупки.
            </div>
          )}
          {selectedProjectId && loading && (
            <div className="building-page__muted">Загрузка...</div>
          )}
          {selectedProjectId && !loading && list.length === 0 && (
            <div className="building-page__muted">Закупки не найдены.</div>
          )}
          {selectedProjectId &&
            !loading &&
            list.map((procurement) => {
              const procurementId = procurement?.id ?? procurement?.uuid;
              return (
                <div key={procurementId} className="building-page__row">
                  <div>
                    <div>
                      <b>{procurement?.title || "Без названия"}</b>
                    </div>
                    <div className="building-page__label">
                      {asCurrency(procurement?.total_amount)} / {asDateTime(procurement?.created_at)}
                    </div>
                    <div className={statusClass(procurement?.status)}>
                      {statusLabel(procurement?.status, PROCUREMENT_STATUS_LABELS)}
                    </div>
                  </div>
                  <div className="building-page__actions">
                    <button
                      type="button"
                      className="building-btn"
                      onClick={() => navigate(`/crm/building/procurement/${procurementId}`)}
                    >
                      Открыть
                    </button>
                    {renderActions(procurement)}
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
      </div>

      <Modal
        open={openCreate}
        onClose={() => setOpenCreate(false)}
        title="Создать закупку"
      >
        <form className="building-page" onSubmit={onCreate}>
          <label>
            <div className="building-page__label">Название</div>
            <input
              className="building-page__input"
              value={createForm.title}
              onChange={(e) =>
                setCreateForm((prev) => ({ ...prev, title: e.target.value }))
              }
              required
            />
          </label>
          <label>
            <div className="building-page__label">Комментарий</div>
            <textarea
              className="building-page__textarea"
              rows={4}
              value={createForm.comment}
              onChange={(e) =>
                setCreateForm((prev) => ({ ...prev, comment: e.target.value }))
              }
            />
          </label>
          {(createErrorFromSlice || actionError) && (
            <div className="building-page__error">
              {String(validateResErrors(createErrorFromSlice || actionError, "Ошибка"))}
            </div>
          )}
          <div className="building-page__actions">
            <button
              type="button"
              className="building-btn"
              disabled={creating}
              onClick={() => setOpenCreate(false)}
            >
              Отмена
            </button>
            <button
              type="submit"
              className="building-btn building-btn--primary"
              disabled={creating || !String(createForm.title).trim()}
            >
              {creating ? "Сохранение..." : "Создать"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}