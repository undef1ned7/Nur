import React, { useEffect, useMemo, useState } from "react";
import { useDispatch } from "react-redux";
import { useNavigate, useParams } from "react-router-dom";
import Modal from "@/Components/common/Modal/Modal";
import { useAlert, useConfirm } from "@/hooks/useDialog";
import { validateResErrors } from "../../../../../tools/validateResErrors";
import { useBuildingProjects } from "@/store/slices/building/projectsSlice";
import {
  createBuildingTransferFromProcurement,
  fetchBuildingProcurementById,
  submitBuildingProcurementToCash,
} from "@/store/creators/building/procurementsCreators";
import {
  createBuildingProcurementItem,
  deleteBuildingProcurementItem,
  fetchBuildingProcurementItems,
  updateBuildingProcurementItem,
} from "@/store/creators/building/procurementItemsCreators";
import { fetchBuildingWorkflowEvents } from "@/store/creators/building/workflowCreators";
import { useBuildingProcurements } from "@/store/slices/building/procurementsSlice";
import { useBuildingProcurementItems } from "@/store/slices/building/procurementItemsSlice";
import { useBuildingWorkflowEvents } from "@/store/slices/building/workflowEventsSlice";
import {
  PROCUREMENT_STATUS_LABELS,
  TRANSFER_STATUS_LABELS,
  asCurrency,
  asDateTime,
  statusLabel,
} from "../shared/constants";
import DataContainer from "@/Components/common/DataContainer/DataContainer";

const ITEM_INITIAL = {
  name: "",
  unit: "",
  quantity: "",
  price: "",
  order: 1,
  note: "",
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

const historyActionLabel = (action) => {
  const map = {
    procurement_created: "Закупка создана",
    procurement_item_created: "Позиция добавлена",
    procurement_item_updated: "Позиция изменена",
    procurement_item_deleted: "Позиция удалена",
    procurement_submitted_to_cash: "Отправлено в кассу",
    cash_approved: "Кассой одобрено",
    cash_rejected: "Кассой отклонено",
    transfer_created: "Создана передача на склад",
    transfer_item_created: "Позиция в передаче создана",
    transfer_accepted: "Передача принята складом",
    transfer_rejected: "Передача отклонена складом",
    stock_incoming: "Поступление на склад",
    procurement_transferred: "Закупка передана на склад",
    procurement_partially_transferred: "Закупка частично передана",
  };
  return map[action] || action || "Событие";
};

const historyStatusLabel = (status) => {
  if (!status) return "";
  return (
    PROCUREMENT_STATUS_LABELS[status] ||
    TRANSFER_STATUS_LABELS[status] ||
    status
  );
};

export default function BuildingProcurementDetail() {
  const { id } = useParams();
  const procurementId = id ? String(id) : null;
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const alert = useAlert();
  const confirm = useConfirm();

  const { selectedProjectId } = useBuildingProjects();
  const {
    list,
    current,
    currentLoading,
    currentError,
    submittingToCashIds,
    creatingTransferIds,
  } = useBuildingProcurements();
  const procurementItemsState = useBuildingProcurementItems();
  const workflowEventsState = useBuildingWorkflowEvents();

  const procurement = useMemo(() => {
    const currentId = current?.id ?? current?.uuid;
    if (procurementId && String(currentId) === String(procurementId)) return current;
    const fromList = (Array.isArray(list) ? list : []).find(
      (p) => String(p?.id ?? p?.uuid) === String(procurementId)
    );
    return fromList || current || null;
  }, [current, list, procurementId]);

  const itemsBucket = useMemo(() => {
    if (!procurementId) return null;
    return procurementItemsState?.byProcurementId?.[String(procurementId)] ?? null;
  }, [procurementId, procurementItemsState]);

  const workflowBucket = useMemo(() => {
    if (!procurementId) return null;
    return workflowEventsState?.byProcurementId?.[String(procurementId)] ?? null;
  }, [procurementId, workflowEventsState]);

  const canEditItems = procurement?.status === "draft";

  const [openItemModal, setOpenItemModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [itemForm, setItemForm] = useState(ITEM_INITIAL);
  const [itemError, setItemError] = useState(null);
  const [openHistoryModal, setOpenHistoryModal] = useState(false);

  const busySubmitToCash =
    procurementId != null && submittingToCashIds?.[procurementId] === true;
  const busyCreateTransfer =
    procurementId != null && creatingTransferIds?.[procurementId] === true;

  useEffect(() => {
    if (!procurementId) return;
    dispatch(fetchBuildingProcurementById(procurementId));
  }, [dispatch, procurementId]);

  useEffect(() => {
    if (!procurementId) return;
    dispatch(fetchBuildingProcurementItems({ procurement: procurementId }));
  }, [dispatch, procurementId]);

  useEffect(() => {
    if (!openHistoryModal || !procurementId) return;
    dispatch(fetchBuildingWorkflowEvents({ procurement: procurementId, page_size: 20 }));
  }, [dispatch, openHistoryModal, procurementId]);

  const sanitizeDecimal = (value) => {
    if (!value) return "";
    let next = String(value).replace(/[^\d.,]/g, "");
    // только одна точка/запятая
    const parts = next.split(/[.,]/);
    if (parts.length > 2) {
      next = `${parts[0]},${parts.slice(1).join("")}`;
    }
    return next;
  };

  const parseDecimal = (value) => {
    const normalized = String(value || "").replace(",", ".").trim();
    if (!normalized) return null;
    const num = Number(normalized);
    if (!Number.isFinite(num)) return null;
    return normalized;
  };

  const onSubmitToCash = () => {
    if (!procurementId) return;
    confirm("Отправить закупку в кассу?", async (ok) => {
      if (!ok) return;
      const res = await dispatch(submitBuildingProcurementToCash(procurementId));
      if (res.meta.requestStatus === "fulfilled") {
        alert("Закупка отправлена в кассу");
        dispatch(fetchBuildingWorkflowEvents({ procurement: procurementId, page_size: 12 }));
        dispatch(fetchBuildingProcurementById(procurementId));
        return;
      }
      alert(validateResErrors(res.payload || res.error, "Не удалось отправить в кассу"), true);
    });
  };

  const onCreateTransfer = () => {
    if (!procurementId) return;
    confirm("Создать передачу на склад?", async (ok) => {
      if (!ok) return;
      const res = await dispatch(
        createBuildingTransferFromProcurement({ procurementId, payload: { note: "" } })
      );
      if (res.meta.requestStatus === "fulfilled") {
        alert("Передача создана");
        dispatch(fetchBuildingWorkflowEvents({ procurement: procurementId, page_size: 12 }));
        dispatch(fetchBuildingProcurementById(procurementId));
        return;
      }
      alert(validateResErrors(res.payload || res.error, "Не удалось создать передачу"), true);
    });
  };

  const openCreateItem = () => {
    setEditingItem(null);
    setItemForm({ ...ITEM_INITIAL, order: (itemsBucket?.list?.length || 0) + 1 });
    setItemError(null);
    setOpenItemModal(true);
  };

  const openEditItem = (item) => {
    setEditingItem(item);
    setItemForm({
      name: String(item?.name || ""),
      unit: String(item?.unit || ""),
      quantity: String(item?.quantity || ""),
      price: String(item?.price || ""),
      order: Number(item?.order || 1),
      note: String(item?.note || ""),
    });
    setItemError(null);
    setOpenItemModal(true);
  };

  const closeItemModal = () => {
    setOpenItemModal(false);
    setEditingItem(null);
    setItemError(null);
    setItemForm(ITEM_INITIAL);
  };

  const submitItem = async (e) => {
    e.preventDefault();
    if (!procurementId) return;
    if (!canEditItems) {
      alert("Позиции можно менять только пока закупка в черновике", true);
      return;
    }
    const quantity = parseDecimal(itemForm.quantity);
    const price = parseDecimal(itemForm.price);
    if (quantity == null || price == null) {
      setItemError("Количество и цена должны быть числом (можно с дробной частью)");
      return;
    }

    const payload = {
      procurement: procurementId,
      name: String(itemForm.name || "").trim(),
      unit: String(itemForm.unit || "").trim(),
      quantity,
      price,
      order: Number(itemForm.order || 1),
      note: String(itemForm.note || "").trim(),
    };
    if (!payload.name || !payload.unit || !payload.quantity || !payload.price) return;

    setItemError(null);
    try {
      const res = editingItem?.id
        ? await dispatch(
            updateBuildingProcurementItem({
              id: editingItem.id,
              procurementId,
              data: {
                name: payload.name,
                unit: payload.unit,
                quantity: payload.quantity,
                price: payload.price,
                order: payload.order,
                note: payload.note,
              },
            })
          )
        : await dispatch(createBuildingProcurementItem(payload));

      if (res.meta.requestStatus === "fulfilled") {
        closeItemModal();
        dispatch(fetchBuildingProcurementItems({ procurement: procurementId }));
        dispatch(fetchBuildingWorkflowEvents({ procurement: procurementId, page_size: 12 }));
        dispatch(fetchBuildingProcurementById(procurementId));
        return;
      }
      setItemError(validateResErrors(res.payload || res.error, "Ошибка сохранения позиции"));
    } catch (err) {
      setItemError(validateResErrors(err, "Ошибка сохранения позиции"));
    }
  };

  const onDeleteItem = (item) => {
    if (!procurementId) return;
    if (!canEditItems) {
      alert("Позиции можно менять только пока закупка в черновике", true);
      return;
    }
    const itemId = item?.id ?? item?.uuid;
    if (!itemId) return;
    confirm(`Удалить позицию «${item?.name || "позиция"}»?`, async (ok) => {
      if (!ok) return;
      const res = await dispatch(deleteBuildingProcurementItem({ id: itemId, procurementId }));
      if (res.meta.requestStatus === "fulfilled") {
        dispatch(fetchBuildingProcurementItems({ procurement: procurementId }));
        dispatch(fetchBuildingWorkflowEvents({ procurement: procurementId, page_size: 12 }));
        dispatch(fetchBuildingProcurementById(procurementId));
        return;
      }
      alert(validateResErrors(res.payload || res.error, "Ошибка удаления позиции"), true);
    });
  };

  return (
    <div className="building-page">
      <div className="building-page__header">
        <div>
          <h1 className="building-page__title">
            Закупка: {procurement?.title || "—"}
          </h1>
          <p className="building-page__subtitle">
            ЖК:{" "}
            {procurement?.residential_complex_name || selectedProjectId || "—"} •{" "}
            <span className={statusClass(procurement?.status)}>
              {statusLabel(procurement?.status, PROCUREMENT_STATUS_LABELS)}
            </span>
          </p>
          {currentLoading && (
            <div className="building-page__muted">Загрузка деталей...</div>
          )}
          {currentError && (
            <div className="building-page__error">
              {String(
                validateResErrors(currentError, "Не удалось загрузить закупку")
              )}
            </div>
          )}
        </div>
        <div className="building-page__actions">
          <button
            type="button"
            className="building-btn"
            onClick={() => navigate(-1)}
          >
            Назад
          </button>
          <button
            type="button"
            className="building-btn"
            onClick={() => setOpenHistoryModal(true)}
          >
            История действий
          </button>
          {procurement?.status === "draft" && (
            <button
              type="button"
              className="building-btn building-btn--primary"
              disabled={busySubmitToCash}
              onClick={onSubmitToCash}
            >
              {busySubmitToCash ? "Отправка..." : "Отправить в кассу"}
            </button>
          )}
          {procurement?.status === "cash_approved" && (
            <button
              type="button"
              className="building-btn building-btn--primary"
              disabled={busyCreateTransfer}
              onClick={onCreateTransfer}
            >
              {busyCreateTransfer ? "Создание..." : "Создать передачу"}
            </button>
          )}
        </div>
      </div>

      <DataContainer>
        <div className="building-page__card">
          <div className="building-page__actions" style={{ justifyContent: "space-between" }}>
            <h3 className="building-page__cardTitle" style={{ margin: 0 }}>
              Позиции закупки
            </h3>
            {canEditItems && (
              <button
                type="button"
                className="building-btn building-btn--primary"
                onClick={openCreateItem}
              >
                Добавить позицию
              </button>
            )}
          </div>
          {!canEditItems && (
            <div className="building-page__muted">
              Позиции можно редактировать только в статусе <b>draft</b>.
            </div>
          )}

          {itemsBucket?.loading && (
            <div className="building-page__muted">Загрузка позиций...</div>
          )}

          {!itemsBucket?.loading && (itemsBucket?.list || []).length === 0 && (
            <div className="building-page__muted">Позиции не добавлены.</div>
          )}

          {!itemsBucket?.loading && (itemsBucket?.list || []).length > 0 && (() => {
            const items = itemsBucket.list || [];
            const total = items.reduce((acc, item) => {
              const qty = Number(item?.quantity || 0);
              const price = Number(item?.price || 0);
              const sum = Number(item?.line_total || qty * price || 0);
              return acc + (Number.isFinite(sum) ? sum : 0);
            }, 0);

            return (
              <div className="building-table building-table--shadow">
                <table>
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Наименование</th>
                      <th>Кол-во</th>
                      <th>Ед.</th>
                      <th>Цена</th>
                      <th>Сумма</th>
                      <th>Примечание</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item, idx) => {
                      const qty = item?.quantity || "0";
                      const price = item?.price || "0";
                      const sum = item?.line_total || Number(qty) * Number(price) || 0;
                      return (
                        <tr key={item?.id ?? item?.uuid}>
                          <td>{idx + 1}</td>
                          <td>{item?.name || "—"}</td>
                          <td>{qty}</td>
                          <td>{item?.unit || ""}</td>
                          <td>{asCurrency(price)}</td>
                          <td>{asCurrency(sum)}</td>
                          <td>{item?.note || ""}</td>
                          <td>
                            {canEditItems && (
                              <div
                                className="building-page__actions"
                                style={{ justifyContent: "flex-end" }}
                              >
                                <button
                                  type="button"
                                  className="building-btn"
                                  onClick={() => openEditItem(item)}
                                >
                                  Изменить
                                </button>
                                <button
                                  type="button"
                                  className="building-btn building-btn--danger"
                                  onClick={() => onDeleteItem(item)}
                                >
                                  Удалить
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td colSpan={5}>Итого по позициям</td>
                      <td>{asCurrency(total)}</td>
                      <td colSpan={2} />
                    </tr>
                  </tfoot>
                </table>
              </div>
            );
          })()}
        </div>
      </DataContainer>

      <Modal
        open={openHistoryModal}
        onClose={() => setOpenHistoryModal(false)}
        title="История действий"
      >
        <div className="building-page">
          {workflowBucket?.loading && (
            <div className="building-page__muted">Загрузка истории...</div>
          )}
          {!workflowBucket?.loading && (workflowBucket?.list || []).length === 0 && (
            <div className="building-page__muted">Событий пока нет.</div>
          )}
          {(workflowBucket?.list || []).map((event) => (
            <div className="building-page__row" key={event?.id ?? event?.uuid}>
              <div>
                <div>{historyActionLabel(event?.action)}</div>
                <div className="building-page__label">
                  {event?.actor_display || "Система"}
                  {event?.message ? ` • ${event.message}` : ""}
                  {(event?.from_status || event?.to_status) && (
                    <>
                      {" • "}
                      Статус:{" "}
                      {historyStatusLabel(event?.from_status)}{" "}
                      {event?.to_status ? `→ ${historyStatusLabel(event.to_status)}` : ""}
                    </>
                  )}
                </div>
              </div>
              <div className="building-page__value">
                {asDateTime(event?.created_at)}
              </div>
            </div>
          ))}
        </div>
      </Modal>
      <Modal
        open={openItemModal}
        onClose={closeItemModal}
        title={editingItem ? "Изменить позицию" : "Добавить позицию"}
      >
        <form className="building-page" onSubmit={submitItem}>
          <label>
            <div className="building-page__label">Наименование</div>
            <input
              className="building-page__input"
              value={itemForm.name}
              onChange={(e) => setItemForm((p) => ({ ...p, name: e.target.value }))}
              required
            />
          </label>
          <label>
            <div className="building-page__label">Ед. измерения</div>
            <input
              className="building-page__input"
              value={itemForm.unit}
              onChange={(e) => setItemForm((p) => ({ ...p, unit: e.target.value }))}
              required
            />
          </label>
          <div className="building-page__filters">
            <label>
              <div className="building-page__label">Количество</div>
              <input
                className="building-page__input"
                inputMode="decimal"
                value={itemForm.quantity}
                onChange={(e) =>
                  setItemForm((p) => ({ ...p, quantity: sanitizeDecimal(e.target.value) }))
                }
                required
              />
            </label>
            <label>
              <div className="building-page__label">Цена</div>
              <input
                className="building-page__input"
                inputMode="decimal"
                value={itemForm.price}
                onChange={(e) =>
                  setItemForm((p) => ({ ...p, price: sanitizeDecimal(e.target.value) }))
                }
                required
              />
            </label>
          </div>
          <label>
            <div className="building-page__label">Порядок</div>
            <input
              type="number"
              className="building-page__input"
              value={itemForm.order}
              onChange={(e) => setItemForm((p) => ({ ...p, order: Number(e.target.value || 1) }))}
              min={1}
            />
          </label>
          <label>
            <div className="building-page__label">Примечание</div>
            <textarea
              className="building-page__textarea"
              rows={3}
              value={itemForm.note}
              onChange={(e) => setItemForm((p) => ({ ...p, note: e.target.value }))}
            />
          </label>
          {itemError && <div className="building-page__error">{String(itemError)}</div>}
          <div className="building-page__actions">
            <button type="button" className="building-btn" onClick={closeItemModal}>
              Отмена
            </button>
            <button type="submit" className="building-btn building-btn--primary">
              Сохранить
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

