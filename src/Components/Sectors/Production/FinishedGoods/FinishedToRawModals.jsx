import { useEffect, useMemo, useState, useCallback } from "react";
import { X, ArrowRightLeft, Undo2 } from "lucide-react";
import api from "../../../../api";
import { useAlert, useConfirm } from "../../../../hooks/useDialog";
import { validateResErrors } from "../../../../../tools/validateResErrors";

/**
 * Задача №3 — Частичное перемещение готовой продукции в сырьё.
 *
 * Сценарий: Готовая продукция 100 шт → отправить 20 шт →
 *   готовая = 80, сырьё += 20. Товар НЕ исчезает полностью.
 *
 * Компоненты изолированы. Бэкенд-эндпоинты (см. 03-transfer-to-raw-materials.md):
 *   POST /main/products/{id}/move-to-raw/         { quantity, reason }
 *   GET  /main/finished-to-raw-transfers/
 *   POST /main/finished-to-raw-transfers/{id}/cancel/
 *
 * При отсутствии эндпоинтов — безопасная ошибка через validateResErrors,
 * существующий функционал склада не затрагивается.
 */

const fmtDateTime = (s) => {
  if (!s) return "—";
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? String(s) : d.toLocaleString("ru-RU");
};

const fmtNum = (n) =>
  Number(n || 0).toLocaleString("ru-RU", { maximumFractionDigits: 3 });

/* ====================================================================
   Экран перемещения: выбор товара, количество, причина
   ==================================================================== */
export const FinishedToRawModal = ({ products = [], onClose, onChanged }) => {
  const alert = useAlert();
  const [productId, setProductId] = useState("");
  const [qty, setQty] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const available = useMemo(
    () => (Array.isArray(products) ? products : []).filter((p) => Number(p?.quantity) > 0),
    [products],
  );

  const selected = useMemo(
    () => products.find((p) => String(p?.id) === String(productId)),
    [products, productId],
  );
  const maxQty = Number(selected?.quantity || 0);
  const qtyNum = Number(qty);
  const remaining =
    Number.isFinite(qtyNum) && qtyNum > 0 ? Math.max(0, maxQty - qtyNum) : maxQty;

  const submit = async (e) => {
    e?.preventDefault?.();
    setError("");
    if (!productId) {
      setError("Выберите товар");
      return;
    }
    if (!Number.isFinite(qtyNum) || qtyNum <= 0) {
      setError("Введите корректное количество");
      return;
    }
    if (qtyNum > maxQty) {
      setError(`Нельзя переместить больше, чем есть. Доступно: ${maxQty}`);
      return;
    }
    try {
      setSaving(true);
      await api.post(`/main/products/${productId}/move-to-raw/`, {
        quantity: qtyNum,
        reason: String(reason || "").trim(),
      });
      alert(
        `Перемещено в сырьё: ${fmtNum(qtyNum)} шт.\nОстаток в готовой: ${fmtNum(
          maxQty - qtyNum,
        )}`,
        () => {
          onChanged?.();
          onClose?.();
        },
      );
    } catch (err) {
      setError(validateResErrors(err, "Не удалось переместить в сырьё"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="add-modal raw-form">
      <div className="add-modal__overlay" onClick={onClose} />
      <form
        className="add-modal__content"
        style={{ height: "auto" }}
        onSubmit={submit}
      >
        <div className="add-modal__header">
          <h3>
            <span
              style={{ display: "inline-flex", alignItems: "center", gap: 8 }}
            >
              <ArrowRightLeft size={18} /> Перемещение в сырьё
            </span>
          </h3>
          <X className="add-modal__close-icon" size={20} onClick={onClose} />
        </div>

        <div className="add-modal__section">
          <label>Товар (готовая продукция) *</label>
          <select
            className="add-modal__input"
            value={productId}
            onChange={(e) => {
              setProductId(e.target.value);
              setQty("");
              setError("");
            }}
            required
          >
            <option value="">— Выберите товар —</option>
            {available.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} · в наличии: {fmtNum(p.quantity)}
              </option>
            ))}
          </select>
        </div>

        <div className="add-modal__section">
          <label>Количество к перемещению *</label>
          <input
            type="number"
            className="add-modal__input"
            value={qty}
            onChange={(e) => {
              setQty(e.target.value);
              setError("");
            }}
            placeholder="0"
            min={1}
            step="0.001"
            max={maxQty > 0 ? maxQty : undefined}
            disabled={!productId}
          />
        </div>

        <div className="add-modal__section">
          <label>Причина перемещения</label>
          <textarea
            className="add-modal__input"
            rows={2}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Например: переработка, исправление, разборка"
            style={{ resize: "vertical" }}
          />
        </div>

        {selected && (
          <div className="raw-form__summary">
            <span>Останется в готовой продукции</span>
            <b>{fmtNum(remaining)} шт.</b>
          </div>
        )}

        {error && <div className="raw-form__error">{error}</div>}

        <div className="add-modal__footer">
          <button
            type="button"
            className="add-modal__cancel"
            onClick={onClose}
            disabled={saving}
          >
            Отмена
          </button>
          <button
            type="submit"
            className="add-modal__save"
            disabled={saving || !productId}
          >
            {saving ? "Перемещение…" : "Переместить в сырьё"}
          </button>
        </div>
      </form>
    </div>
  );
};

/* ====================================================================
   История перемещений + отмена операции
   ==================================================================== */
export const FinishedToRawHistoryModal = ({ onClose, onChanged }) => {
  const alert = useAlert();
  const confirm = useConfirm();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [cancelingId, setCancelingId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const { data } = await api.get("/main/finished-to-raw-transfers/");
      setRows(Array.isArray(data) ? data : data?.results || []);
    } catch (e) {
      setError(validateResErrors(e, "Не удалось загрузить историю перемещений"));
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const cancel = (row) => {
    confirm(
      "Отменить перемещение? Количество вернётся в готовую продукцию, из сырья будет списано.",
      async (ok) => {
        if (!ok) return;
        try {
          setCancelingId(row.id);
          await api.post(`/main/finished-to-raw-transfers/${row.id}/cancel/`);
          alert("Перемещение отменено");
          onChanged?.();
          await load();
        } catch (e) {
          alert(validateResErrors(e, "Не удалось отменить перемещение"), true);
        } finally {
          setCancelingId(null);
        }
      },
    );
  };

  const statusLabel = (s) => {
    const v = String(s || "").toLowerCase();
    if (v === "canceled" || v === "cancelled") return "Отменено";
    if (v === "done" || v === "completed" || v === "active") return "Выполнено";
    return s || "Выполнено";
  };
  const isCanceled = (s) =>
    ["canceled", "cancelled"].includes(String(s || "").toLowerCase());

  return (
    <div className="add-modal raw-form">
      <div className="add-modal__overlay" onClick={onClose} />
      <div
        className="add-modal__content"
        role="dialog"
        aria-modal="true"
        style={{ width: "min(820px, 96vw)", maxWidth: "96vw" }}
      >
        <div className="add-modal__header">
          <h3>
            <span
              style={{ display: "inline-flex", alignItems: "center", gap: 8 }}
            >
              <Undo2 size={18} /> История перемещений в сырьё
            </span>
          </h3>
          <X className="add-modal__close-icon" size={20} onClick={onClose} />
        </div>

        {error && <div className="raw-form__error">{error}</div>}

        <div className="table-wrapper" style={{ maxHeight: 440, overflow: "auto" }}>
          <table className="sklad__table">
            <thead>
              <tr>
                <th>Товар</th>
                <th style={{ textAlign: "right" }}>Кол-во</th>
                <th>Причина</th>
                <th>Пользователь</th>
                <th>Дата и время</th>
                <th>Статус</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: "center" }}>
                    Загрузка…
                  </td>
                </tr>
              ) : rows.length > 0 ? (
                rows.map((r, idx) => (
                  <tr key={r.id || idx}>
                    <td data-label="Товар">
                      {r.product_name || r.product || "—"}
                    </td>
                    <td data-label="Кол-во" style={{ textAlign: "right" }}>
                      {fmtNum(r.quantity ?? r.qty ?? 0)}
                    </td>
                    <td data-label="Причина">{r.reason || "—"}</td>
                    <td data-label="Пользователь">
                      {r.user_name || r.created_by_name || r.user || "—"}
                    </td>
                    <td data-label="Дата и время">
                      {fmtDateTime(r.created_at || r.moved_at)}
                    </td>
                    <td data-label="Статус">
                      <span
                        className={
                          isCanceled(r.status)
                            ? "pa-badge pa-badge--warning"
                            : "pa-badge"
                        }
                      >
                        {statusLabel(r.status)}
                      </span>
                    </td>
                    <td data-label="">
                      {!isCanceled(r.status) && (
                        <button
                          type="button"
                          className="add-modal__cancel"
                          onClick={() => cancel(r)}
                          disabled={cancelingId === r.id}
                        >
                          {cancelingId === r.id ? "Отмена…" : "Отменить"}
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} style={{ textAlign: "center" }}>
                    Перемещений пока нет
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="add-modal__footer">
          <button type="button" className="add-modal__cancel" onClick={onClose}>
            Закрыть
          </button>
          <button
            type="button"
            className="add-modal__save"
            onClick={load}
            disabled={loading}
          >
            Обновить
          </button>
        </div>
      </div>
    </div>
  );
};
