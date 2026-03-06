import React, { useEffect, useMemo, useState } from "react";
import Modal from "@/Components/common/Modal/Modal";
import DataContainer from "@/Components/common/DataContainer/DataContainer";
import { useAlert, useConfirm } from "@/hooks/useDialog";
import { useBuildingProjects } from "@/store/slices/building/projectsSlice";
import { validateResErrors } from "../../../../../tools/validateResErrors";
import {
  approveBuildingCashProcurement,
  fetchBuildingCashPendingProcurements,
  rejectBuildingCashProcurement,
} from "@/store/creators/building/cashRegisterCreators";
import { useDispatch } from "react-redux";
import { getPageCount, DEFAULT_PAGE_SIZE } from "../shared/api";
import {
  PROCUREMENT_STATUS_LABELS,
  asCurrency,
  asDateTime,
  statusLabel,
} from "../shared/constants";
import { useBuildingCashRegister } from "@/store/slices/building/cashRegisterSlice";
import { fetchBuildingWarehouses } from "@/store/creators/building/warehousesCreators";
import { useBuildingWarehouses } from "@/store/slices/building/warehousesSlice";
import { createBuildingTransferFromProcurement } from "@/store/creators/building/procurementsCreators";
import "./CashRegister.scss";

const DECISION_INITIAL = {
  mode: "approve",
  procurement: null,
  reason: "",
  warehouseId: "",
};

function CashRegisterPagination({ page, totalPages, count, loading, onChange }) {
  if (!totalPages || totalPages <= 1) return null;

  const hasPrevPage = page > 1;
  const hasNextPage = totalPages && page < totalPages;

  return (
    <div className="warehouse-pagination">
      <button
        type="button"
        className="warehouse-pagination__btn"
        onClick={() => onChange(page - 1)}
        disabled={!hasPrevPage || loading}
      >
        Назад
      </button>
      <span className="warehouse-pagination__info">
        Страница {page} из {totalPages ?? 1}
        {typeof count === "number" ? ` (${count} закупок)` : ""}
      </span>
      <button
        type="button"
        className="warehouse-pagination__btn"
        onClick={() => onChange(page + 1)}
        disabled={!hasNextPage || loading}
      >
        Вперед
      </button>
    </div>
  );
}

export default function BuildingCashRegister() {
  const alert = useAlert();
  const confirm = useConfirm();
  const dispatch = useDispatch();
  const { selectedProjectId } = useBuildingProjects();

  const { list, count, loading, error, decidingIds, decisionError } =
    useBuildingCashRegister();
  const {
    list: warehouses,
    loading: warehousesLoading,
    error: warehousesError,
  } = useBuildingWarehouses();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [decisionModal, setDecisionModal] = useState(DECISION_INITIAL);

  const totalPages = useMemo(
    () => getPageCount(count, DEFAULT_PAGE_SIZE),
    [count]
  );

  useEffect(() => {
    if (!selectedProjectId) return;
    dispatch(
      fetchBuildingCashPendingProcurements({
        residential_complex: selectedProjectId,
        search: search || undefined,
        page,
        page_size: DEFAULT_PAGE_SIZE,
      })
    );
  }, [dispatch, page, search, selectedProjectId]);

  const openDecision = (mode, procurement) => {
    setDecisionModal({
      mode,
      procurement,
      reason: "",
      warehouseId: "",
    });

    const residentialComplexId =
      procurement?.residential_complex ?? selectedProjectId;
    if (mode === "approve" && residentialComplexId) {
      dispatch(
        fetchBuildingWarehouses({
          residential_complex: residentialComplexId,
          is_active: true,
          page_size: 100,
        })
      );
    }
  };

  const closeDecision = () => {
    setDecisionModal(DECISION_INITIAL);
  };

  const isSubmitting = useMemo(() => {
    const procurementId =
      decisionModal.procurement?.id ?? decisionModal.procurement?.uuid;
    if (!procurementId) return false;
    return decidingIds?.[procurementId] === true;
  }, [decisionModal.procurement, decidingIds]);

  const submitDecision = async (e) => {
    e.preventDefault();
    const procurementId =
      decisionModal.procurement?.id ?? decisionModal.procurement?.uuid;
    if (!procurementId) return;
    if (
      decisionModal.mode === "approve" &&
      !String(decisionModal.warehouseId || "").trim()
    ) {
      alert("Выберите склад для передачи", true);
      return;
    }
    if (
      decisionModal.mode === "reject" &&
      String(decisionModal.reason || "").trim().length === 0
    ) {
      alert("Причина отклонения обязательна", true);
      return;
    }

    confirm("Подтвердить решение кассы?", async (ok) => {
      if (!ok) return;
      try {
        if (decisionModal.mode === "approve") {
          const res = await dispatch(
            approveBuildingCashProcurement({
              procurementId,
              payload: { reason: String(decisionModal.reason || "").trim() },
            })
          );
          if (res.meta.requestStatus === "fulfilled") {
            const transferRes = await dispatch(
              createBuildingTransferFromProcurement({
                procurementId,
                payload: {
                  note: String(decisionModal.reason || "").trim(),
                  warehouse: decisionModal.warehouseId,
                },
              })
            );
            if (transferRes.meta.requestStatus === "fulfilled") {
              alert("Закупка одобрена и передача на склад создана");
            } else {
              alert(
                validateResErrors(
                  transferRes.payload || transferRes.error,
                  "Закупка одобрена, но не удалось создать передачу на склад"
                ),
                true
              );
            }
          } else {
            alert(
              validateResErrors(res.payload || res.error, "Не удалось одобрить"),
              true
            );
          }
        } else {
          const res = await dispatch(
            rejectBuildingCashProcurement({
              procurementId,
              payload: { reason: String(decisionModal.reason || "").trim() },
            })
          );
          if (res.meta.requestStatus === "fulfilled") alert("Закупка отклонена");
          else
            alert(
              validateResErrors(res.payload || res.error, "Не удалось отклонить"),
              true
            );
        }
        closeDecision();
      } catch (err) {
        alert(validateResErrors(err, "Не удалось сохранить решение кассы"), true);
      }
    });
  };

  return (
    <div className="warehouse-page">
      <div className="warehouse-header">
        <div className="warehouse-header__left">
          <div className="warehouse-header__icon-box">₽</div>
          <div className="warehouse-header__title-section">
            <h1 className="warehouse-header__title">
              Касса: согласование закупок
            </h1>
            <p className="warehouse-header__subtitle">
              Отображаются закупки со статусом{" "}
              <b>
                {statusLabel("submitted_to_cash", PROCUREMENT_STATUS_LABELS)}
              </b>{" "}
              для выбранного проекта.
            </p>
          </div>
        </div>
      </div>

      <div className="warehouse-search-section">
        <div className="warehouse-search">
          <input
            className="warehouse-search__input"
            value={search}
            placeholder="Поиск по названию или комментарию закупки"
            onChange={(e) => {
              setPage(1);
              setSearch(e.target.value);
            }}
          />
        </div>
        <div className="warehouse-search__info">
          <span>
            {typeof count === "number"
              ? `Найдено ${count} закупок`
              : "Найдено 0 закупок"}
          </span>
          {!selectedProjectId && (
            <span>Выберите жилой комплекс в шапке раздела.</span>
          )}
        </div>
      </div>

      {error && (
        <div className="mt-2 text-sm text-red-500">{String(error)}</div>
      )}

      <DataContainer>
        <div className="warehouse-table-container w-full">
          <table className="warehouse-table w-full">
            <thead>
              <tr>
                <th>Закупка</th>
                <th>Статус / дата</th>
                <th>Сумма</th>
                <th style={{ width: 260 }}>Действия</th>
              </tr>
            </thead>
            <tbody>
              {!selectedProjectId ? (
                <tr>
                  <td colSpan={4} className="warehouse-table__empty">
                    Выберите жилой комплекс в шапке раздела.
                  </td>
                </tr>
              ) : loading && list.length === 0 ? (
                <tr>
                  <td colSpan={4} className="warehouse-table__loading">
                    Загрузка...
                  </td>
                </tr>
              ) : !loading && list.length === 0 ? (
                <tr>
                  <td colSpan={4} className="warehouse-table__empty">
                    Заявок на согласование нет.
                  </td>
                </tr>
              ) : (
                list.map((procurement) => {
                  const procurementId = procurement?.id ?? procurement?.uuid;
                  const deciding =
                    procurementId != null &&
                    decidingIds?.[procurementId] === true;

                  return (
                    <tr key={procurementId}>
                      <td className="warehouse-table__name">
                        <div className="warehouse-table__name-cell">
                          <span>{procurement?.title || "Без названия"}</span>
                        </div>
                      </td>
                      <td>
                        <div className="text-sm text-slate-700">
                          {statusLabel(
                            procurement?.status,
                            PROCUREMENT_STATUS_LABELS
                          )}
                        </div>
                        <div className="mt-1 text-xs text-slate-400">
                          {asDateTime(
                            procurement?.submitted_to_cash_at ||
                              procurement?.created_at
                          )}
                        </div>
                      </td>
                      <td>
                        <div className="font-semibold">
                          {asCurrency(procurement?.total_amount)}
                        </div>
                      </td>
                      <td>
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            className="px-4 py-2 rounded-lg bg-emerald-500 text-white text-sm font-semibold shadow-sm hover:bg-emerald-600 disabled:opacity-60 disabled:cursor-not-allowed"
                            onClick={() => openDecision("approve", procurement)}
                            disabled={deciding}
                          >
                            Одобрить
                          </button>
                          <button
                            type="button"
                            className="px-4 py-2 rounded-lg bg-red-500 text-white text-sm font-semibold shadow-sm hover:bg-red-600 disabled:opacity-60 disabled:cursor-not-allowed"
                            onClick={() => openDecision("reject", procurement)}
                            disabled={deciding}
                          >
                            Отклонить
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>

          <CashRegisterPagination
            page={page}
            totalPages={totalPages}
            count={count}
            loading={loading}
            onChange={setPage}
          />
        </div>
      </DataContainer>

      <Modal
        open={Boolean(decisionModal.procurement)}
        onClose={closeDecision}
        title={
          decisionModal.mode === "approve"
            ? "Подтвердить закупку"
            : "Отклонить закупку"
        }
      >
        <form className="building-page" onSubmit={submitDecision}>
          <div className="building-page__muted">
            {decisionModal.procurement?.title || "Закупка"}
          </div>
          <label>
            <div className="building-page__label">
              {decisionModal.mode === "approve"
                ? "Комментарий (необязательно)"
                : "Причина отклонения"}
            </div>
            <textarea
              rows={4}
              className="building-page__textarea"
              value={decisionModal.reason}
              onChange={(e) =>
                setDecisionModal((prev) => ({ ...prev, reason: e.target.value }))
              }
              required={decisionModal.mode === "reject"}
            />
          </label>

          {decisionModal.mode === "approve" && (
            <label>
              <div className="building-page__label">Отправить на склад</div>
              <select
                className="building-page__select"
                value={decisionModal.warehouseId}
                onChange={(e) =>
                  setDecisionModal((prev) => ({
                    ...prev,
                    warehouseId: e.target.value,
                  }))
                }
                disabled={warehousesLoading}
                required
              >
                <option value="">
                  {warehousesLoading
                    ? "Загрузка складов..."
                    : "Выберите склад"}
                </option>
                {warehousesError && (
                  <option value="" disabled>
                    {String(warehousesError)}
                  </option>
                )}
                {warehouses.map((w) => (
                  <option key={w.id ?? w.uuid} value={w.id ?? w.uuid}>
                    {w.name || "Без названия"}
                  </option>
                ))}
              </select>
            </label>
          )}
          <div className="building-page__actions">
            <button
              type="button"
              className="building-btn"
              onClick={closeDecision}
              disabled={isSubmitting}
            >
              Отмена
            </button>
            <button
              type="submit"
              className={`building-btn ${
                decisionModal.mode === "approve"
                  ? "building-btn--primary"
                  : "building-btn--danger"
              }`}
              disabled={isSubmitting}
            >
              {isSubmitting ? "Сохранение..." : "Подтвердить"}
            </button>
          </div>
          {decisionError && (
            <div className="building-page__error">
              {String(validateResErrors(decisionError, "Ошибка"))}
            </div>
          )}
        </form>
      </Modal>
    </div>
  );
}