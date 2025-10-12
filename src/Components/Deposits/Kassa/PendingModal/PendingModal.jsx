import { X } from "lucide-react";
import { useDispatch, useSelector } from "react-redux";
import { useEffect, useMemo, useState } from "react";
import { fetchProductsAsync } from "../../../../store/creators/productCreators";
import {
  getCashFlows,
  updateCashFlows,
  useCash,
} from "../../../../store/slices/cashSlice";

const PendingModal = ({ onClose, onChanged, cashName }) => {
  const dispatch = useDispatch();
  const { cashFlows } = useCash();
  const { loading } = useSelector((s) => s.product);

  // --- selection state ---
  const [selected, setSelected] = useState(() => new Set());
  const [processing, setProcessing] = useState(false);

  // pending-база (только со статусом false)
  const basePending = useMemo(
    () => (cashFlows || []).filter((p) => p.status === false),
    [cashFlows]
  );

  const norm = (s) =>
    String(s ?? "")
      .trim()
      .toLowerCase();

  // фильтр по названию кассы (если передан cashName)
  const pending = useMemo(() => {
    if (!cashName) return basePending;
    const target = norm(cashName);
    return basePending.filter((p) => norm(p.cashbox_name) === target);
  }, [basePending, cashName]);

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
    onChanged?.();
  };

  const mapType = (t) =>
    t === "income" ? "Приход" : t === "expense" ? "Расход" : "—";

  const handleAccept = async (item) => {
    try {
      await dispatch(
        updateCashFlows({
          productId: item.id,
          updatedData: { status: true },
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
          updatedData: { status: false },
        })
      ).unwrap();
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
      await Promise.all(
        ids.map((id) =>
          dispatch(
            updateCashFlows({
              productId: id,
              updatedData: { status: statusValue },
            })
          ).unwrap()
        )
      );
      await refresh();
      // очищаем выбранные
      setSelected(new Set());
    } catch (e) {
      alert("Не все операции прошли успешно. Проверьте список и повторите.");
    } finally {
      setProcessing(false);
    }
  };

  const handleBulkAccept = () => bulkUpdate(Array.from(selected), true);

  const handleBulkReject = () => bulkUpdate(Array.from(selected), false);

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
    <div className="add-modal accept">
      <div className="add-modal__overlay" onClick={onClose} />
      <div className="add-modal__content" role="dialog" aria-modal="true">
        <div className="add-modal__header">
          <h3>
            В ожидании{cashName ? ` • ${cashName}` : ""}{" "}
            {selected.size > 0 ? `— выбрано: ${selected.size}` : ""}
          </h3>
          <X className="add-modal__close-icon" size={20} onClick={onClose} />
        </div>

        {loading ? (
          <div className="add-modal__section">Загрузка…</div>
        ) : pending.length === 0 ? (
          <div className="add-modal__section">
            Нет товаров со статусом pending.
          </div>
        ) : (
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
                        className="add-modal__save"
                        style={{ marginRight: 8 }}
                        title="Принять товар"
                        onClick={() => handleAccept(item)}
                        disabled={processing}
                      >
                        Одобрить
                      </button>
                      <button
                        className="add-modal__cancel"
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
        )}

        <div className="add-modal__footer">
          <button className="add-modal__cancel" onClick={onClose}>
            Закрыть
          </button>
          <div style={{ display: "flex", columnGap: 10 }}>
            {pending.length !== 0 && (
              <div
                // className="add-modal__section"
                style={{ display: "flex", gap: 10, alignItems: "center" }}
              >
                <button
                  className="add-modal__cancel"
                  onClick={handleBulkReject}
                  disabled={selected.size === 0 || processing}
                  title="Отказать всем выбранным"
                >
                  Отказать выбранным
                </button>
                <button
                  className="add-modal__save"
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
              className="add-modal__save"
              onClick={() => dispatch(getCashFlows({}))}
              disabled={processing}
            >
              Обновить список
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PendingModal;
