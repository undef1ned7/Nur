import { useDispatch, useSelector } from "react-redux";
import { useEffect, useMemo, useState } from "react";
import {
  deleteItemsMake,
  deleteProductAsync,
  fetchProductsAsync,
} from "../../../store/creators/productCreators";
import {
  getCashFlows,
  updateCashFlows,
  bulkUpdateCashFlowsStatus,
  useCash,
} from "../../../store/slices/cashSlice";
import "./Pending.scss";
import { useLocation } from "react-router-dom";
import { HeaderTabs } from "../../Sectors/Hostel/kassa/kassa";
import { deleteSale } from "../../../store/creators/saleThunk";
import { onPayDebtDeal } from "../../../store/creators/clientCreators";

const Pending = () => {
  const location = useLocation();
  const dispatch = useDispatch();
  const { cashFlows } = useCash();
  const { loading } = useSelector((s) => s.product);

  // --- selection state ---
  const [selected, setSelected] = useState(() => new Set());
  const [processing, setProcessing] = useState(false);

  // pending-база (только со статусом false)
  const basePending = useMemo(
    () =>
      (cashFlows || []).filter(
        (p) => p.status === "pending" || p.status === "false"
      ),
    [cashFlows]
  );

  const norm = (s) =>
    String(s ?? "")
      .trim()
      .toLowerCase();

  // фильтр по названию кассы (если передан cashName)
  const pending = useMemo(() => {
    return basePending;
  }, [basePending]);

  // чистим выбранные, если список изменился
  useEffect(() => {
    const ids = new Set(pending.map((p) => p.id));
    setSelected((prev) => {
      const next = new Set();
      prev.forEach((id) => {
        if (ids.has(id)) next.add(id);
      });
      return next;
    });
  }, [pending]);

  // гарантированное обновление стора + колбэк родителя
  const refresh = () => {
    dispatch(getCashFlows());
  };

  const mapType = (t) =>
    t === "income" ? "Приход" : t === "expense" ? "Расход" : "—";

  const handleAccept = async (item) => {
    try {
      await dispatch(
        updateCashFlows({
          productId: item.id,
          updatedData: { status: "approved" },
        })
      ).unwrap();
      await refresh();
      // убирать из selected, если был выбран
      setSelected((prev) => {
        const next = new Set(prev);
        next.delete(item.id);
        return next;
      });
    } catch (e) {
      alert("Не удалось отправить товар");
    }
  };

  const handleReject = async (item) => {
    try {
      await dispatch(
        updateCashFlows({
          productId: item.id,
          updatedData: { status: "rejected" },
        })
      ).unwrap();

      if (item.source_business_operation_id === "Склад") {
        dispatch(deleteProductAsync(item?.source_cashbox_flow_id));
      }

      if (item.source_business_operation_id === "Продажа") {
        dispatch(deleteSale(item?.source_cashbox_flow_id));
      }

      if (item.source_business_operation_id === "Оплата долга") {
        dispatch(onPayDebtDeal(item?.source_cashbox_flow_id));
      }

      if (item.source_business_operation_id === "Сырье") {
        dispatch(deleteItemsMake(item.source_cashbox_flow_id));
      }

      if (item.source_business_operation_id === "Продажа производство") {
        dispatch(deleteSale(item?.source_cashbox_flow_id));
      }

      await refresh();
      setSelected((prev) => {
        const next = new Set(prev);
        next.delete(item.id);
        return next;
      });
    } catch (e) {
      alert("Не удалось отклонить товар");
    }
  };

  // --- массовые действия ---
  const bulkUpdate = async (ids, statusValue) => {
    if (!ids.length) return;
    setProcessing(true);
    try {
      const items = ids.map((id) => ({
        id,
        status: statusValue,
      }));
      await dispatch(bulkUpdateCashFlowsStatus(items)).unwrap();
      await refresh();
      // очищаем выбранные
      setSelected(new Set());
    } catch (e) {
      alert("Не все операции прошли успешно. Проверьте список и повторите.");
    } finally {
      setProcessing(false);
    }
  };

  const handleBulkAccept = () => bulkUpdate(Array.from(selected), "approved");

  const handleBulkReject = async () => {
    if (!selected.size) return;
    setProcessing(true);
    try {
      const selectedIds = Array.from(selected);
      const selectedItems = pending.filter((item) =>
        selectedIds.includes(item.id)
      );

      // Обновляем статус всех выбранных элементов через bulk API
      const items = selectedIds.map((id) => ({
        id,
        status: "rejected",
      }));
      await dispatch(bulkUpdateCashFlowsStatus(items)).unwrap();

      // Применяем логику удаления связанных записей для каждого элемента
      for (const item of selectedItems) {
        if (item.source_business_operation_id === "Склад") {
          dispatch(deleteProductAsync(item?.source_cashbox_flow_id));
        }

        if (item.source_business_operation_id === "Продажа") {
          dispatch(deleteSale(item?.source_cashbox_flow_id));
        }

        if (item.source_business_operation_id === "Оплата долга") {
          dispatch(onPayDebtDeal(item?.source_cashbox_flow_id));
        }

        if (item.source_business_operation_id === "Сырье") {
          dispatch(deleteItemsMake(item.source_cashbox_flow_id));
        }

        if (item.source_business_operation_id === "Продажа производство") {
          dispatch(deleteSale(item?.source_cashbox_flow_id));
        }
      }

      await refresh();
      // очищаем выбранные
      setSelected(new Set());
    } catch (e) {
      alert("Не все операции прошли успешно. Проверьте список и повторите.");
    } finally {
      setProcessing(false);
    }
  };

  // --- чекбоксы ---
  const allIds = useMemo(() => pending.map((p) => p.id), [pending]);
  const allSelected =
    allIds.length > 0 && allIds.every((id) => selected.has(id));
  const someSelected =
    allIds.length > 0 && !allSelected && allIds.some((id) => selected.has(id));

  const toggleRow = (id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    setSelected((prev) => {
      if (allSelected) return new Set(); // снять все
      return new Set(allIds); // выбрать все видимые
    });
  };

  useEffect(() => {
    dispatch(getCashFlows());
  }, [dispatch]);

  return (
    <div className="pending-page">
      {location.pathname === "/crm/hostel/kassa/requests" && <HeaderTabs />}
      <div className="pending-page__header">
        <h1>
          В ожидании {selected.size > 0 ? `— выбрано: ${selected.size}` : ""}
        </h1>
      </div>

      {loading ? (
        <div className="pending-page__loading">Загрузка…</div>
      ) : pending.length === 0 ? (
        <div className="pending-page__empty">
          Нет товаров со статусом pending.
        </div>
      ) : (
        <div className="pending-page__content">
          <div
            className="table-wrapper"
            style={{ maxHeight: 400, overflow: "auto", marginBottom: "15px" }}
          >
            <table className="sklad__table">
              <thead>
                <tr>
                  <th style={{ width: 36, textAlign: "center" }}>
                    {/* выбрать всё */}
                    <input
                      type="checkbox"
                      aria-label="Выбрать всё"
                      checked={allSelected}
                      ref={(el) => {
                        if (el) el.indeterminate = someSelected;
                      }}
                      onChange={toggleAll}
                    />
                  </th>
                  <th>№</th>
                  <th>Название</th>
                  <th>Тип</th>
                  <th>Касса</th>
                  <th>Дата</th>
                  <th>Сумма</th>
                  <th>Действия</th>
                </tr>
              </thead>
              <tbody>
                {pending.map((item, idx) => (
                  <tr key={item.id}>
                    <td style={{ textAlign: "center" }}>
                      <input
                        type="checkbox"
                        aria-label={`Выбрать ${item.name || item.id}`}
                        checked={selected.has(item.id)}
                        onChange={() => toggleRow(item.id)}
                      />
                    </td>
                    <td>{idx + 1}</td>
                    <td>{item.name}</td>
                    <td>{mapType(item.type)}</td>
                    <td>{item.cashbox_name || "—"}</td>
                    <td>{new Date(item.created_at).toLocaleDateString()}</td>
                    <td>{item.amount ?? "—"}</td>
                    <td>
                      <button
                        className="pending-page__button pending-page__button--accept"
                        style={{ marginRight: 8 }}
                        title="Принять товар"
                        onClick={() => handleAccept(item)}
                        disabled={processing}
                      >
                        Одобрить
                      </button>
                      <button
                        className="pending-page__button pending-page__button--reject"
                        onClick={() => handleReject(item)}
                        disabled={processing}
                      >
                        Отказать
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="pending-page__footer">
        <div style={{ display: "flex", columnGap: 10 }}>
          {pending.length !== 0 && (
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <button
                className="pending-page__button pending-page__button--reject"
                onClick={handleBulkReject}
                disabled={selected.size === 0 || processing}
                title="Отказать всем выбранным"
              >
                Отказать выбранным
              </button>
              <button
                className="pending-page__button pending-page__button--accept"
                onClick={handleBulkAccept}
                disabled={selected.size === 0 || processing}
                title="Одобрить все выбранные"
              >
                Одобрить выбранные
              </button>
              {processing && (
                <span style={{ opacity: 0.8 }}>
                  Выполняю массовое действие…
                </span>
              )}
            </div>
          )}
          <button
            className="pending-page__button pending-page__button--refresh"
            onClick={() => dispatch(getCashFlows({}))}
            disabled={processing}
          >
            Обновить список
          </button>
        </div>
      </div>
    </div>
  );
};

export default Pending;
