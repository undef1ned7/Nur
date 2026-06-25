import { useEffect, useMemo, useState, useCallback } from "react";
import { X, ClipboardList, History as HistoryIcon } from "lucide-react";
import api from "../../../../api";
import { useAlert, useConfirm } from "../../../../hooks/useDialog";
import { validateResErrors } from "../../../../../tools/validateResErrors";

/**
 * Задача №5 — Инвентаризация (сверка остатков).
 *
 * Фактически больше → ИЗЛИШЕК, фактически меньше → НЕДОСТАЧА.
 *
 * Бэкенд-эндпоинты (см. 05-inventory.md):
 *   POST /main/inventories/                    { warehouse, comment, status, items[] }
 *   GET  /main/inventories/?warehouse=...
 *   GET  /main/inventories/{id}/
 *   POST /main/inventories/{id}/confirm/
 *
 * Универсально для готовой продукции (products) и сырья (items-make):
 * оба имеют { id, name, quantity, unit }. Тип склада передаётся в `warehouse`.
 * Изолировано; при отсутствии API — безопасная ошибка через validateResErrors.
 */

const toNum = (v) => {
  const n = Number(String(v ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};

const fmtNum = (n) =>
  Number(n || 0).toLocaleString("ru-RU", { maximumFractionDigits: 3 });

const fmtDateTime = (s) => {
  if (!s) return "—";
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? String(s) : d.toLocaleString("ru-RU");
};

const diffBadge = (diff) => {
  if (diff > 0)
    return <span className="pa-badge">Излишек +{fmtNum(diff)}</span>;
  if (diff < 0)
    return (
      <span className="pa-badge pa-badge--danger">
        Недостача {fmtNum(diff)}
      </span>
    );
  return <span className="pa-badge pa-badge--warning">Совпадает</span>;
};

/* ====================================================================
   Создание инвентаризации (сверка остатков)
   ==================================================================== */
export const InventoryModal = ({
  items = [],
  warehouse = "finished_goods",
  warehouseLabel = "Склад готовой продукции",
  onClose,
  onChanged,
}) => {
  const alert = useAlert();
  const [comment, setComment] = useState("");
  const [factById, setFactById] = useState({});
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const list = useMemo(() => {
    const q = search.trim().toLowerCase();
    const arr = Array.isArray(items) ? items : [];
    return q
      ? arr.filter((p) => String(p?.name || "").toLowerCase().includes(q))
      : arr;
  }, [items, search]);

  const setFact = (id, value) => {
    setFactById((prev) => ({ ...prev, [id]: value }));
    setError("");
  };

  // Сводка по введённым (посчитанным) позициям
  const summary = useMemo(() => {
    let counted = 0;
    let surplusQty = 0;
    let shortageQty = 0;
    let surplusCount = 0;
    let shortageCount = 0;
    for (const p of Array.isArray(items) ? items : []) {
      const raw = factById[p.id];
      if (raw === undefined || raw === "") continue;
      counted += 1;
      const diff = toNum(raw) - toNum(p.quantity);
      if (diff > 0) {
        surplusQty += diff;
        surplusCount += 1;
      } else if (diff < 0) {
        shortageQty += Math.abs(diff);
        shortageCount += 1;
      }
    }
    return {
      counted,
      surplusQty,
      shortageQty,
      surplusCount,
      shortageCount,
    };
  }, [items, factById]);

  const buildPayload = (status) => {
    const payloadItems = [];
    for (const p of Array.isArray(items) ? items : []) {
      const raw = factById[p.id];
      if (raw === undefined || raw === "") continue; // только посчитанные
      payloadItems.push({
        product: p.id,
        qty_system: toNum(p.quantity),
        qty_fact: toNum(raw),
      });
    }
    return {
      warehouse,
      comment: String(comment || "").trim(),
      status,
      items: payloadItems,
    };
  };

  const submit = async (status) => {
    setError("");
    const payload = buildPayload(status);
    if (payload.items.length === 0) {
      setError("Введите фактический остаток хотя бы по одной позиции");
      return;
    }
    try {
      setSaving(true);
      await api.post("/main/inventories/", payload);
      alert(
        status === "confirmed"
          ? "Инвентаризация подтверждена. Остатки скорректированы."
          : "Инвентаризация сохранена как черновик.",
        () => {
          onChanged?.();
          onClose?.();
        },
      );
    } catch (e) {
      setError(validateResErrors(e, "Не удалось сохранить инвентаризацию"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="add-modal raw-form">
      <div className="add-modal__overlay" onClick={onClose} />
      <div
        className="add-modal__content"
        role="dialog"
        aria-modal="true"
        style={{ width: "min(900px, 96vw)", maxWidth: "96vw" }}
      >
        <div className="add-modal__header">
          <h3>
            <span
              style={{ display: "inline-flex", alignItems: "center", gap: 8 }}
            >
              <ClipboardList size={18} /> Инвентаризация · {warehouseLabel}
            </span>
          </h3>
          <X className="add-modal__close-icon" size={20} onClick={onClose} />
        </div>

        <div className="add-modal__section">
          <label>Комментарий</label>
          <textarea
            className="add-modal__input"
            rows={2}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Например: плановая инвентаризация, причина расхождений"
            style={{ resize: "vertical" }}
          />
        </div>

        <div className="add-modal__section">
          <input
            type="text"
            className="add-modal__input"
            placeholder="Поиск по товару…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {error && <div className="raw-form__error">{error}</div>}

        <div
          className="table-wrapper"
          style={{ maxHeight: 380, overflow: "auto" }}
        >
          <table className="sklad__table">
            <thead>
              <tr>
                <th>Товар</th>
                <th style={{ textAlign: "right" }}>Учётный остаток</th>
                <th style={{ textAlign: "right" }}>Фактически</th>
                <th>Расхождение</th>
              </tr>
            </thead>
            <tbody>
              {list.length > 0 ? (
                list.map((p) => {
                  const raw = factById[p.id];
                  const counted = raw !== undefined && raw !== "";
                  const diff = counted ? toNum(raw) - toNum(p.quantity) : null;
                  return (
                    <tr key={p.id}>
                      <td data-label="Товар">{p.name || "—"}</td>
                      <td data-label="Учётный" style={{ textAlign: "right" }}>
                        {fmtNum(p.quantity)} {p.unit || ""}
                      </td>
                      <td data-label="Фактически" style={{ textAlign: "right" }}>
                        <input
                          type="number"
                          className="add-modal__input"
                          style={{
                            width: 120,
                            textAlign: "right",
                            display: "inline-block",
                          }}
                          value={raw ?? ""}
                          onChange={(e) => setFact(p.id, e.target.value)}
                          placeholder={fmtNum(p.quantity)}
                          min={0}
                          step="0.001"
                        />
                      </td>
                      <td data-label="Расхождение">
                        {counted ? diffBadge(diff) : "—"}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={4} style={{ textAlign: "center" }}>
                    Нет позиций
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div
          className="raw-form__summary"
          style={{ justifyContent: "flex-start", gap: 18, flexWrap: "wrap" }}
        >
          <span>
            Посчитано: <b>{summary.counted}</b>
          </span>
          <span>
            Излишки: <b>{summary.surplusCount}</b> (+{fmtNum(summary.surplusQty)})
          </span>
          <span>
            Недостачи: <b>{summary.shortageCount}</b> (−
            {fmtNum(summary.shortageQty)})
          </span>
        </div>

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
            type="button"
            className="add-modal__cancel"
            onClick={() => submit("draft")}
            disabled={saving}
          >
            {saving ? "Сохранение…" : "Сохранить черновик"}
          </button>
          <button
            type="button"
            className="add-modal__save"
            onClick={() => submit("confirmed")}
            disabled={saving}
          >
            {saving ? "Сохранение…" : "Подтвердить"}
          </button>
        </div>
      </div>
    </div>
  );
};

/* ====================================================================
   История инвентаризаций + подтверждение черновиков
   ==================================================================== */
export const InventoryHistoryModal = ({
  warehouse,
  warehouseLabel = "",
  onClose,
  onChanged,
}) => {
  const alert = useAlert();
  const confirm = useConfirm();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = {};
      if (warehouse) params.warehouse = warehouse;
      const { data } = await api.get("/main/inventories/", { params });
      setRows(Array.isArray(data) ? data : data?.results || []);
    } catch (e) {
      setError(validateResErrors(e, "Не удалось загрузить инвентаризации"));
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [warehouse]);

  useEffect(() => {
    load();
  }, [load]);

  const confirmInventory = (row) => {
    confirm(
      "Подтвердить инвентаризацию? Учётные остатки будут приведены к фактическим.",
      async (ok) => {
        if (!ok) return;
        try {
          setBusyId(row.id);
          await api.post(`/main/inventories/${row.id}/confirm/`);
          alert("Инвентаризация подтверждена");
          onChanged?.();
          await load();
        } catch (e) {
          alert(validateResErrors(e, "Не удалось подтвердить"), true);
        } finally {
          setBusyId(null);
        }
      },
    );
  };

  const statusLabel = (s) => {
    const v = String(s || "").toLowerCase();
    if (v === "confirmed" || v === "done") return "Подтверждено";
    if (v === "draft") return "Черновик";
    if (v === "canceled" || v === "cancelled") return "Отменено";
    return s || "—";
  };
  const isDraft = (s) => String(s || "").toLowerCase() === "draft";

  return (
    <div className="add-modal raw-form">
      <div className="add-modal__overlay" onClick={onClose} />
      <div
        className="add-modal__content"
        role="dialog"
        aria-modal="true"
        style={{ width: "min(900px, 96vw)", maxWidth: "96vw" }}
      >
        <div className="add-modal__header">
          <h3>
            <span
              style={{ display: "inline-flex", alignItems: "center", gap: 8 }}
            >
              <HistoryIcon size={18} /> История инвентаризаций
              {warehouseLabel ? ` · ${warehouseLabel}` : ""}
            </span>
          </h3>
          <X className="add-modal__close-icon" size={20} onClick={onClose} />
        </div>

        {error && <div className="raw-form__error">{error}</div>}

        <div
          className="table-wrapper"
          style={{ maxHeight: 440, overflow: "auto" }}
        >
          <table className="sklad__table">
            <thead>
              <tr>
                <th>Дата</th>
                <th>Ответственный</th>
                <th style={{ textAlign: "right" }}>Излишки</th>
                <th style={{ textAlign: "right" }}>Недостачи</th>
                <th>Комментарий</th>
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
                    <td data-label="Дата">
                      {fmtDateTime(r.created_at || r.date)}
                    </td>
                    <td data-label="Ответственный">
                      {r.user_name || r.created_by_name || r.user || "—"}
                    </td>
                    <td
                      data-label="Излишки"
                      style={{ textAlign: "right", color: "#047857" }}
                    >
                      +{fmtNum(r.surplus_qty ?? r.surplus_total ?? 0)}
                    </td>
                    <td
                      data-label="Недостачи"
                      style={{ textAlign: "right", color: "#b91c1c" }}
                    >
                      −{fmtNum(r.shortage_qty ?? r.shortage_total ?? 0)}
                    </td>
                    <td data-label="Комментарий">{r.comment || "—"}</td>
                    <td data-label="Статус">
                      <span
                        className={
                          isDraft(r.status)
                            ? "pa-badge pa-badge--warning"
                            : "pa-badge"
                        }
                      >
                        {statusLabel(r.status)}
                      </span>
                    </td>
                    <td data-label="">
                      {isDraft(r.status) && (
                        <button
                          type="button"
                          className="add-modal__save"
                          style={{ padding: "6px 12px" }}
                          onClick={() => confirmInventory(r)}
                          disabled={busyId === r.id}
                        >
                          {busyId === r.id ? "…" : "Подтвердить"}
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} style={{ textAlign: "center" }}>
                    Инвентаризаций пока нет
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
