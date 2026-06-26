import { useEffect, useMemo, useState, useCallback } from "react";
import { Search, Eye, X, RefreshCw } from "lucide-react";
import api from "../../../../api";
import { useDebouncedValue } from "../../../../hooks/useDebounce";
import { validateResErrors } from "../../../../../tools/validateResErrors";

/**
 * Вкладка «Перемещение» на /crm/production/warehouse.
 * Полный журнал движения склада (все операции) с фильтрами и пагинацией.
 * Read-only поверх нового эндпоинта журнала (см. 07-stock-movement-journal.md).
 * При отсутствии API — безопасная ошибка/пустое состояние, склад не ломается.
 */

const PAGE_SIZE = 25;

const TYPE_LABELS = {
  income: "Приход",
  expense: "Расход",
  transfer: "Перемещение",
  return: "Возврат",
  writeoff: "Списание",
  inventory: "Инвентаризация",
  adjustment: "Корректировка остатков",
  agent_transfer: "Передача агенту",
  agent_return: "Возврат от агента",
  staff_transfer: "Передача между сотрудниками",
  staff_return: "Возврат между сотрудниками",
};

const TYPE_BADGE = {
  income: "pa-badge",
  return: "pa-badge",
  agent_return: "pa-badge",
  staff_return: "pa-badge",
  expense: "pa-badge pa-badge--danger",
  writeoff: "pa-badge pa-badge--danger",
  transfer: "pa-badge pa-badge--warning",
  agent_transfer: "pa-badge pa-badge--warning",
  staff_transfer: "pa-badge pa-badge--warning",
  inventory: "pa-badge pa-badge--warning",
  adjustment: "pa-badge pa-badge--warning",
};

const fmtDateTime = (s) => {
  if (!s) return "—";
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? String(s) : d.toLocaleString("ru-RU");
};
const fmtNum = (n) =>
  Number(n || 0).toLocaleString("ru-RU", { maximumFractionDigits: 3 });
const typeLabel = (t) => TYPE_LABELS[String(t || "").toLowerCase()] || t || "—";
const typeBadge = (t) =>
  TYPE_BADGE[String(t || "").toLowerCase()] || "pa-badge";

const fmtChange = (n) => {
  const v = Number(n || 0);
  if (v > 0) return `+${fmtNum(v)}`;
  return fmtNum(v);
};

/* ---- Детали движения ---- */
const MovementDetailModal = ({ row, onClose }) => {
  if (!row) return null;
  const change = Number(row.change ?? row.delta ?? 0);
  return (
    <div className="add-modal raw-form">
      <div className="add-modal__overlay" onClick={onClose} />
      <div
        className="add-modal__content"
        role="dialog"
        aria-modal="true"
        style={{ width: "min(560px, 96vw)", maxWidth: "96vw", height: "auto" }}
      >
        <div className="add-modal__header">
          <h3>Движение склада</h3>
          <X className="add-modal__close-icon" size={20} onClick={onClose} />
        </div>
        <div className="add-modal__section" style={{ gap: 10 }}>
          <div>
            <span className={typeBadge(row.type)}>{typeLabel(row.type)}</span>
          </div>
          <div>
            <strong>Товар:</strong> {row.product_name || row.product || "—"}
          </div>
          <div style={{ display: "flex", gap: 18, flexWrap: "wrap" }}>
            <span>До: <b>{fmtNum(row.qty_before)}</b></span>
            <span
              style={{ color: change > 0 ? "#047857" : change < 0 ? "#b91c1c" : "inherit" }}
            >
              Изменение: <b>{fmtChange(change)}</b>
            </span>
            <span>После: <b>{fmtNum(row.qty_after)}</b></span>
          </div>
          <div>
            <strong>Откуда:</strong> {row.source_name || row.source || "—"}
          </div>
          <div>
            <strong>Куда:</strong> {row.target_name || row.target || "—"}
          </div>
          <div>
            <strong>Отправитель:</strong> {row.sender_name || row.sender || "—"}
          </div>
          <div>
            <strong>Получатель:</strong>{" "}
            {row.receiver_name || row.receiver || "—"}
          </div>
          <div>
            <strong>Автор:</strong>{" "}
            {row.created_by_name || row.user_name || row.user || "—"}
          </div>
          <div>
            <strong>Дата:</strong> {fmtDateTime(row.created_at)}
          </div>
          {row.comment && (
            <div>
              <strong>Комментарий:</strong> {row.comment}
            </div>
          )}
        </div>
        <div className="add-modal__footer">
          <button type="button" className="add-modal__cancel" onClick={onClose}>
            Закрыть
          </button>
        </div>
      </div>
    </div>
  );
};

const ProductionMovementsTab = () => {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [count, setCount] = useState(0);
  const [offset, setOffset] = useState(0);
  const [detailRow, setDetailRow] = useState(null);

  // Фильтры
  const [type, setType] = useState("");
  const [warehouse, setWarehouse] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 400);

  const params = useMemo(() => {
    const p = { limit: PAGE_SIZE, offset };
    if (type) p.type = type;
    if (warehouse) p.warehouse = warehouse;
    if (dateFrom) p.date_from = dateFrom;
    if (dateTo) p.date_to = dateTo;
    if (debouncedSearch) p.search = debouncedSearch;
    return p;
  }, [type, warehouse, dateFrom, dateTo, debouncedSearch, offset]);

  // При смене фильтров — сбрасываем на первую страницу
  useEffect(() => {
    setOffset(0);
  }, [type, warehouse, dateFrom, dateTo, debouncedSearch]);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const { data } = await api.get("/main/stock-movements/", { params });
      const list = Array.isArray(data) ? data : data?.results || [];
      setRows(list);
      setCount(
        typeof data?.count === "number" ? data.count : list.length + offset,
      );
    } catch (e) {
      setError(validateResErrors(e, "Не удалось загрузить журнал движений"));
      setRows([]);
      setCount(0);
    } finally {
      setLoading(false);
    }
  }, [params, offset]);

  useEffect(() => {
    load();
  }, [load]);

  const resetFilters = () => {
    setType("");
    setWarehouse("");
    setDateFrom("");
    setDateTo("");
    setSearch("");
  };

  const page = Math.floor(offset / PAGE_SIZE) + 1;
  const totalPages = Math.max(1, Math.ceil(count / PAGE_SIZE));

  return (
    <div className="warehouse-page">
      <div className="warehouse-header">
        <div className="warehouse-header__left align-middle">
          <div className="warehouse-header__icon">
            <div className="warehouse-header__icon-box">🔁</div>
          </div>
          <div className="warehouse-header__title-section">
            <h1 className="warehouse-header__title">Перемещение</h1>
            <p className="warehouse-header__subtitle">
              Журнал движения склада: все операции
            </p>
          </div>
        </div>
      </div>

      {/* Фильтры */}
      <div
        className="warehouse-search-section"
        style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}
      >
        <div className="warehouse-search" style={{ flex: "1 1 240px" }}>
          <Search className="warehouse-search__icon" size={18} />
          <input
            type="text"
            className="warehouse-search__input"
            placeholder="Поиск: товар, сотрудник, агент…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          className="add-modal__input"
          style={{ height: 42, width: "auto", minWidth: 180 }}
          value={type}
          onChange={(e) => setType(e.target.value)}
        >
          <option value="">Все типы</option>
          {Object.entries(TYPE_LABELS).map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
        <select
          className="add-modal__input"
          style={{ height: 42, width: "auto", minWidth: 170 }}
          value={warehouse}
          onChange={(e) => setWarehouse(e.target.value)}
        >
          <option value="">Все склады</option>
          <option value="finished_goods">Готовая продукция</option>
          <option value="raw_materials">Сырьё</option>
          <option value="agent">Агент</option>
        </select>
        <input
          type="date"
          className="add-modal__input"
          style={{ height: 42, width: "auto" }}
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
          title="Дата с"
        />
        <input
          type="date"
          className="add-modal__input"
          style={{ height: 42, width: "auto" }}
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
          title="Дата по"
        />
        <button
          type="button"
          className="add-modal__cancel"
          onClick={resetFilters}
        >
          Сбросить
        </button>
      </div>

      {error && (
        <div className="add-modal__section" style={{ marginTop: 12 }}>
          <div className="raw-form__error">{error}</div>
        </div>
      )}

      <div className="table-wrapper" style={{ overflow: "auto", marginTop: 12 }}>
        <table className="sklad__table">
          <thead>
            <tr>
              <th>Дата и время</th>
              <th>Тип операции</th>
              <th>Товар</th>
              <th style={{ textAlign: "right" }}>Изменение</th>
              <th>Откуда</th>
              <th>Куда</th>
              <th>Отправитель</th>
              <th>Получатель</th>
              <th>Автор</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={10} style={{ textAlign: "center" }}>
                  Загрузка…
                </td>
              </tr>
            ) : rows.length > 0 ? (
              rows.map((r, idx) => {
                const change = Number(r.change ?? r.delta ?? 0);
                return (
                  <tr key={r.id || idx}>
                    <td data-label="Дата и время">
                      {fmtDateTime(r.created_at)}
                    </td>
                    <td data-label="Тип">
                      <span className={typeBadge(r.type)}>
                        {typeLabel(r.type)}
                      </span>
                    </td>
                    <td data-label="Товар">
                      {r.product_name || r.product || "—"}
                    </td>
                    <td
                      data-label="Изменение"
                      style={{
                        textAlign: "right",
                        color:
                          change > 0 ? "#047857" : change < 0 ? "#b91c1c" : "inherit",
                        fontWeight: 600,
                      }}
                    >
                      {fmtChange(change)}
                    </td>
                    <td data-label="Откуда">{r.source_name || r.source || "—"}</td>
                    <td data-label="Куда">{r.target_name || r.target || "—"}</td>
                    <td data-label="Отправитель">
                      {r.sender_name || r.sender || "—"}
                    </td>
                    <td data-label="Получатель">
                      {r.receiver_name || r.receiver || "—"}
                    </td>
                    <td data-label="Автор">
                      {r.created_by_name || r.user_name || r.user || "—"}
                    </td>
                    <td data-label="">
                      <button
                        type="button"
                        className="add-modal__cancel"
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 6,
                        }}
                        onClick={() => setDetailRow(r)}
                      >
                        <Eye size={14} /> Детали
                      </button>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={10} style={{ textAlign: "center" }}>
                  {error ? "Ошибка загрузки" : "Движений не найдено"}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Пагинация */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          marginTop: 12,
          flexWrap: "wrap",
        }}
      >
        <button
          type="button"
          className="add-modal__cancel"
          onClick={load}
          disabled={loading}
          style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
        >
          <RefreshCw size={14} /> Обновить
        </button>
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
          <button
            type="button"
            className="add-modal__cancel"
            onClick={() => setOffset((o) => Math.max(0, o - PAGE_SIZE))}
            disabled={loading || offset === 0}
          >
            Назад
          </button>
          <span style={{ fontSize: 13, color: "#6b7280" }}>
            Стр. {page} из {totalPages}
          </span>
          <button
            type="button"
            className="add-modal__cancel"
            onClick={() => setOffset((o) => o + PAGE_SIZE)}
            disabled={loading || page >= totalPages}
          >
            Вперёд
          </button>
        </div>
      </div>

      {detailRow && (
        <MovementDetailModal row={detailRow} onClose={() => setDetailRow(null)} />
      )}
    </div>
  );
};

export default ProductionMovementsTab;
