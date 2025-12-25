import { useDispatch, useSelector } from "react-redux";
import { useEffect, useMemo, useState, useRef } from "react";
import {
  Search,
  LayoutGrid,
  Table2,
  X,
  CheckCircle2,
  XCircle,
  RefreshCw,
} from "lucide-react";
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
import { useLocation, useParams } from "react-router-dom";
import { HeaderTabs } from "../../Sectors/Hostel/kassa/kassa";
import { deleteSale } from "../../../store/creators/saleThunk";
import { onPayDebtDeal } from "../../../store/creators/clientCreators";

const STORAGE_KEY = "pending_view_mode";

const getInitialViewMode = () => {
  if (typeof window === "undefined") return "table";
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved === "table" || saved === "cards") return saved;
  const isSmall = window.matchMedia("(max-width: 1199px)").matches;
  return isSmall ? "cards" : "table";
};

const Pending = () => {
  const location = useLocation();
  const { id: cashboxId } = useParams(); // UUID кассы из URL
  const dispatch = useDispatch();
  const { cashFlows } = useCash();
  const { loading } = useSelector((s) => s.product);

  // --- selection state ---
  const [selected, setSelected] = useState(() => new Set());
  const [processing, setProcessing] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
  const [viewMode, setViewMode] = useState(getInitialViewMode);
  const debounceTimerRef = useRef(null);

  // Формируем параметры для API запроса (только фильтрация по кассе через UUID из URL)
  const apiParams = useMemo(() => {
    const params = {};
    if (cashboxId) {
      params.cashbox = cashboxId;
    }
    return params;
  }, [cashboxId]);

  // Фильтрация по статусу на фронте
  const basePending = useMemo(
    () =>
      (cashFlows || []).filter(
        (p) => p.status === "pending" || p.status === "false"
      ),
    [cashFlows]
  );

  // pending - финальный список (уже отфильтрован по статусу на фронте)
  const pending = useMemo(() => {
    return basePending;
  }, [basePending]);

  // Вспомогательная функция для маппинга типа
  const mapType = (t) =>
    t === "income" ? "Приход" : t === "expense" ? "Расход" : "—";

  // Фильтрация по поисковому запросу
  const filteredPending = useMemo(() => {
    if (!debouncedSearchTerm.trim()) return pending;
    const searchLower = debouncedSearchTerm.toLowerCase();
    return pending.filter(
      (item) =>
        item.name?.toLowerCase().includes(searchLower) ||
        item.cashbox_name?.toLowerCase().includes(searchLower) ||
        item.amount?.toString().includes(searchLower) ||
        mapType(item.type)?.toLowerCase().includes(searchLower)
    );
  }, [pending, debouncedSearchTerm]);

  // чистим выбранные, если список изменился
  useEffect(() => {
    const ids = new Set(filteredPending.map((p) => p.id));
    setSelected((prev) => {
      const next = new Set();
      prev.forEach((id) => {
        if (ids.has(id)) next.add(id);
      });
      return next;
    });
  }, [filteredPending]);

  // гарантированное обновление стора + колбэк родителя
  const refresh = () => {
    dispatch(getCashFlows(apiParams));
  };

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
  const allIds = useMemo(
    () => filteredPending.map((p) => p.id),
    [filteredPending]
  );
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
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY, viewMode);
    }
  }, [viewMode]);

  // Debounce для поиска
  useEffect(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 300);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [searchTerm]);

  useEffect(() => {
    dispatch(getCashFlows(apiParams));
  }, [dispatch, apiParams]);

  return (
    <div className="pending-page">
      {location.pathname === "/crm/hostel/kassa/requests" && <HeaderTabs />}

      {/* Header */}
      <div className="pending-header">
        <div className="pending-header__left">
          <div className="pending-header__icon">
            <div className="pending-header__icon-box">⏳</div>
          </div>
          <div className="pending-header__title-section">
            <h1 className="pending-header__title">Запросы</h1>
            <p className="pending-header__subtitle">
              Управление запросами на утверждение
            </p>
          </div>
        </div>
      </div>

      {/* Search Section */}
      <div className="pending-search-section">
        <div className="pending-search">
          <Search className="pending-search__icon" size={18} />
          <input
            type="text"
            className="pending-search__input"
            placeholder="Поиск по названию, кассе, сумме..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="pending-search__info flex flex-wrap items-center gap-2">
          <span>
            Всего: {pending.length} • Найдено: {filteredPending.length}
            {selected.size > 0 && ` • Выбрано: ${selected.size}`}
          </span>

          {/* view toggle */}
          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              onClick={() => setViewMode("table")}
              className={`pending-view-btn inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm transition
                ${
                  viewMode === "table"
                    ? "bg-slate-900 text-white border-slate-900"
                    : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                }`}
            >
              <Table2 size={16} />
              Таблица
            </button>

            <button
              type="button"
              onClick={() => setViewMode("cards")}
              className={`pending-view-btn inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm transition
                ${
                  viewMode === "cards"
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

      {/* Bulk Actions Bar */}
      {selected.size > 0 && (
        <div className="pending-bulk-actions">
          <div className="pending-bulk-actions__content">
            <div className="pending-bulk-actions__info">
              <div className="pending-bulk-actions__badge">
                <span className="pending-bulk-actions__count">
                  {selected.size}
                </span>
                <span className="pending-bulk-actions__text">
                  {selected.size === 1
                    ? "запрос выбран"
                    : selected.size < 5
                    ? "запроса выбрано"
                    : "запросов выбрано"}
                </span>
              </div>
            </div>
            <div className="pending-bulk-actions__buttons">
              <button
                className="pending-bulk-actions__clear-btn"
                onClick={() => setSelected(new Set())}
                disabled={processing}
                title="Снять выбор"
              >
                <X size={16} />
                Сбросить
              </button>
              <button
                className="pending-bulk-actions__reject-btn"
                onClick={handleBulkReject}
                disabled={processing}
                title="Отказать выбранным"
              >
                <XCircle size={16} />
                {processing ? "Обработка..." : "Отказать выбранным"}
              </button>
              <button
                className="pending-bulk-actions__accept-btn"
                onClick={handleBulkAccept}
                disabled={processing}
                title="Одобрить выбранные"
              >
                <CheckCircle2 size={16} />
                {processing ? "Обработка..." : "Одобрить выбранные"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Content */}
      <div className="pending-table-container w-full">
        {/* ===== TABLE ===== */}
        {viewMode === "table" && (
          <div className="overflow-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
            <table className="pending-table w-full min-w-[1000px]">
              <thead>
                <tr>
                  <th>
                    <input
                      type="checkbox"
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
                {loading ? (
                  <tr>
                    <td colSpan={8} className="pending-table__loading">
                      Загрузка...
                    </td>
                  </tr>
                ) : filteredPending.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="pending-table__empty">
                      {searchTerm
                        ? "Запросы не найдены"
                        : "Нет запросов в ожидании"}
                    </td>
                  </tr>
                ) : (
                  filteredPending.map((item, idx) => (
                    <tr key={item.id} className="pending-table__row">
                      <td onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={selected.has(item.id)}
                          onChange={() => toggleRow(item.id)}
                        />
                      </td>
                      <td>{idx + 1}</td>
                      <td className="pending-table__name">{item.name}</td>
                      <td>{mapType(item.type)}</td>
                      <td>{item.cashbox_name || "—"}</td>
                      <td>
                        {new Date(item.created_at).toLocaleDateString("ru-RU")}
                      </td>
                      <td>{item.amount ? `${item.amount} сом` : "—"}</td>
                      <td onClick={(e) => e.stopPropagation()}>
                        <div className="pending-table__actions">
                          <button
                            className="pending-table__action-btn pending-table__action-btn--accept"
                            title="Одобрить"
                            onClick={() => handleAccept(item)}
                            disabled={processing}
                          >
                            <CheckCircle2 size={16} />
                            Одобрить
                          </button>
                          <button
                            className="pending-table__action-btn pending-table__action-btn--reject"
                            title="Отказать"
                            onClick={() => handleReject(item)}
                            disabled={processing}
                          >
                            <XCircle size={16} />
                            Отказать
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* ===== CARDS ===== */}
        {viewMode === "cards" && (
          <div className="block">
            <div className="mb-3 flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
              <label
                className="flex items-center gap-2 text-sm text-slate-700"
                onClick={(e) => e.stopPropagation()}
              >
                <input
                  type="checkbox"
                  checked={allSelected}
                  ref={(el) => {
                    if (el) el.indeterminate = someSelected;
                  }}
                  onChange={toggleAll}
                  className="h-4 w-4 rounded border-slate-300"
                />
                Выбрать все
              </label>

              <div className="text-sm text-slate-600">
                Выбрано: <span className="font-semibold">{selected.size}</span>
              </div>
            </div>

            {loading ? (
              <div className="pending-table__loading rounded-2xl border border-slate-200 bg-white p-6 text-center text-slate-600">
                Загрузка...
              </div>
            ) : filteredPending.length === 0 ? (
              <div className="pending-table__empty rounded-2xl border border-slate-200 bg-white p-6 text-center text-slate-600">
                {searchTerm ? "Запросы не найдены" : "Нет запросов в ожидании"}
              </div>
            ) : (
              <div className="pending-cards grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                {filteredPending.map((item, idx) => (
                  <div
                    key={item.id}
                    className="pending-card cursor-pointer rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-[1px] hover:shadow-md"
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className="pt-1"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleRow(item.id);
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={selected.has(item.id)}
                          onChange={() => toggleRow(item.id)}
                          onClick={(e) => e.stopPropagation()}
                          className="h-4 w-4 rounded border-slate-300"
                        />
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="text-xs text-slate-500">#{idx + 1}</div>
                        <div className="pending-card__name mt-0.5 truncate text-sm font-semibold text-slate-900">
                          {item.name}
                        </div>

                        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-600">
                          <span className="whitespace-nowrap">
                            Тип:{" "}
                            <span className="font-medium">
                              {mapType(item.type)}
                            </span>
                          </span>
                          <span className="whitespace-nowrap">
                            Касса:{" "}
                            <span className="font-medium">
                              {item.cashbox_name || "—"}
                            </span>
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                      <div className="rounded-xl bg-slate-50 p-2">
                        <div className="text-slate-500">Дата</div>
                        <div className="mt-0.5 font-semibold text-slate-900">
                          {new Date(item.created_at).toLocaleDateString(
                            "ru-RU"
                          )}
                        </div>
                      </div>

                      <div className="rounded-xl bg-slate-50 p-2">
                        <div className="text-slate-500">Сумма</div>
                        <div className="mt-0.5 font-semibold text-slate-900">
                          {item.amount ? `${item.amount} сом` : "—"}
                        </div>
                      </div>
                    </div>

                    <div className="mt-3 flex gap-2">
                      <button
                        className="pending-card__action-btn pending-card__action-btn--accept flex-1"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleAccept(item);
                        }}
                        disabled={processing}
                      >
                        <CheckCircle2 size={14} />
                        Одобрить
                      </button>
                      <button
                        className="pending-card__action-btn pending-card__action-btn--reject flex-1"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleReject(item);
                        }}
                        disabled={processing}
                      >
                        <XCircle size={14} />
                        Отказать
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer Actions */}
      {filteredPending.length > 0 && (
        <div className="pending-footer">
          <button
            className="pending-footer__refresh-btn"
            onClick={() => dispatch(getCashFlows(apiParams))}
            disabled={processing}
          >
            <RefreshCw size={16} />
            Обновить список
          </button>
        </div>
      )}
    </div>
  );
};

export default Pending;
