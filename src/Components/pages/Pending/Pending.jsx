import { useDispatch } from "react-redux";
import { useEffect, useMemo, useState, useRef } from "react";
import {
  Search,
  LayoutGrid,
  Table2,
  X,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Loader2,
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
import { useAlert, useConfirm } from "../../../hooks/useDialog";
import Loading from "../../common/Loading/Loading";

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
  const alert = useAlert();
  const confirm = useConfirm();
  const { cashFlows, loading: cashFlowsLoading } = useCash();

  // --- selection state ---
  const [selected, setSelected] = useState(() => new Set());
  const [processing, setProcessing] = useState(false);
  const [actingId, setActingId] = useState(null);
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

  const applyRejectSideEffects = (item) => {
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
  };

  const performAccept = async (item) => {
    setActingId(item.id);
    try {
      await dispatch(
        updateCashFlows({
          productId: item.id,
          updatedData: { status: "approved" },
        }),
      ).unwrap();
      await refresh();
      setSelected((prev) => {
        const next = new Set(prev);
        next.delete(item.id);
        return next;
      });
      alert("Запрос одобрен");
    } catch (e) {
      alert("Не удалось одобрить запрос", true);
    } finally {
      setActingId(null);
    }
  };

  const performReject = async (item) => {
    setActingId(item.id);
    try {
      await dispatch(
        updateCashFlows({
          productId: item.id,
          updatedData: { status: "rejected" },
        }),
      ).unwrap();

      applyRejectSideEffects(item);

      await refresh();
      setSelected((prev) => {
        const next = new Set(prev);
        next.delete(item.id);
        return next;
      });
      alert("Запрос отклонён");
    } catch (e) {
      alert("Не удалось отклонить запрос", true);
    } finally {
      setActingId(null);
    }
  };

  const handleAccept = (item) => {
    confirm(`Одобрить запрос «${item.name || "без названия"}»?`, (ok) => {
      if (!ok) return;
      void performAccept(item);
    });
  };

  const handleReject = (item) => {
    confirm(`Отклонить запрос «${item.name || "без названия"}»?`, (ok) => {
      if (!ok) return;
      void performReject(item);
    });
  };

  const isActionLocked = Boolean(actingId) || processing;

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
      setSelected(new Set());
      alert("Выбранные запросы одобрены");
    } catch (e) {
      alert(
        "Не все операции прошли успешно. Проверьте список и повторите.",
        true,
      );
    } finally {
      setProcessing(false);
    }
  };

  const handleBulkAccept = () => {
    if (!selected.size) return;
    const count = selected.size;
    confirm(
      `Одобрить ${count} ${count === 1 ? "запрос" : count < 5 ? "запроса" : "запросов"}?`,
      (ok) => {
        if (!ok) return;
        void bulkUpdate(Array.from(selected), "approved");
      },
    );
  };

  const performBulkReject = async () => {
    if (!selected.size) return;
    setProcessing(true);
    try {
      const selectedIds = Array.from(selected);
      const selectedItems = pending.filter((item) =>
        selectedIds.includes(item.id),
      );

      const items = selectedIds.map((id) => ({
        id,
        status: "rejected",
      }));
      await dispatch(bulkUpdateCashFlowsStatus(items)).unwrap();

      for (const item of selectedItems) {
        applyRejectSideEffects(item);
      }

      await refresh();
      setSelected(new Set());
      alert("Выбранные запросы отклонены");
    } catch (e) {
      alert(
        "Не все операции прошли успешно. Проверьте список и повторите.",
        true,
      );
    } finally {
      setProcessing(false);
    }
  };

  const handleBulkReject = () => {
    if (!selected.size) return;
    const count = selected.size;
    confirm(
      `Отклонить ${count} ${count === 1 ? "запрос" : count < 5 ? "запроса" : "запросов"}?`,
      (ok) => {
        if (!ok) return;
        void performBulkReject();
      },
    );
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
                disabled={isActionLocked}
                title="Снять выбор"
              >
                <X size={16} />
                Сбросить
              </button>
              <button
                className="pending-bulk-actions__reject-btn"
                onClick={handleBulkReject}
                disabled={isActionLocked}
                title="Отказать выбранным"
              >
                {processing ? (
                  <Loader2 size={16} className="pending-action-spinner" />
                ) : (
                  <XCircle size={16} />
                )}
                {processing ? "Обработка..." : "Отказать выбранным"}
              </button>
              <button
                className="pending-bulk-actions__accept-btn"
                onClick={handleBulkAccept}
                disabled={isActionLocked}
                title="Одобрить выбранные"
              >
                {processing ? (
                  <Loader2 size={16} className="pending-action-spinner" />
                ) : (
                  <CheckCircle2 size={16} />
                )}
                {processing ? "Обработка..." : "Одобрить выбранные"}
              </button>
            </div>
          </div>
        </div>
      )}
      {filteredPending.length > 0 && (
        <div className="pending-footer">
          <button
            className="pending-footer__refresh-btn"
            onClick={() => dispatch(getCashFlows(apiParams))}
            disabled={isActionLocked}
          >
            <RefreshCw
              size={16}
              className={cashFlowsLoading ? "pending-action-spinner" : ""}
            />
            Обновить список
          </button>
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
                {cashFlowsLoading ? (
                  <tr>
                    <td colSpan={8} className="pending-table__loading">
                      <Loading message="Загрузка запросов..." />
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
                  filteredPending.map((item, idx) => {
                    const rowBusy = actingId === item.id;
                    const rowDisabled =
                      isActionLocked && actingId !== item.id;
                    return (
                      <tr
                        key={item.id}
                        className={`pending-table__row${rowBusy ? " pending-table__row--busy" : ""}`}
                      >
                        <td onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={selected.has(item.id)}
                            onChange={() => toggleRow(item.id)}
                            disabled={isActionLocked}
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
                              disabled={rowDisabled || rowBusy}
                            >
                              {rowBusy ? (
                                <Loader2
                                  size={16}
                                  className="pending-action-spinner"
                                />
                              ) : (
                                <CheckCircle2 size={16} />
                              )}
                              {rowBusy ? "Обработка..." : "Одобрить"}
                            </button>
                            <button
                              className="pending-table__action-btn pending-table__action-btn--reject"
                              title="Отказать"
                              onClick={() => handleReject(item)}
                              disabled={rowDisabled || rowBusy}
                            >
                              {rowBusy ? (
                                <Loader2
                                  size={16}
                                  className="pending-action-spinner"
                                />
                              ) : (
                                <XCircle size={16} />
                              )}
                              {rowBusy ? "Обработка..." : "Отказать"}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
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

            {cashFlowsLoading ? (
              <div className="pending-table__loading rounded-2xl border border-slate-200 bg-white p-6">
                <Loading message="Загрузка запросов..." />
              </div>
            ) : filteredPending.length === 0 ? (
              <div className="pending-table__empty rounded-2xl border border-slate-200 bg-white p-6 text-center text-slate-600">
                {searchTerm ? "Запросы не найдены" : "Нет запросов в ожидании"}
              </div>
            ) : (
              <div className="pending-cards grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                {filteredPending.map((item, idx) => {
                  const rowBusy = actingId === item.id;
                  const rowDisabled =
                    isActionLocked && actingId !== item.id;
                  return (
                  <div
                    key={item.id}
                    className={`pending-card cursor-pointer rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-[1px] hover:shadow-md${rowBusy ? " pending-card--busy" : ""}`}
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
                          disabled={isActionLocked}
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
                        disabled={rowDisabled || rowBusy}
                      >
                        {rowBusy ? (
                          <Loader2
                            size={14}
                            className="pending-action-spinner"
                          />
                        ) : (
                          <CheckCircle2 size={14} />
                        )}
                        {rowBusy ? "Обработка..." : "Одобрить"}
                      </button>
                      <button
                        className="pending-card__action-btn pending-card__action-btn--reject flex-1"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleReject(item);
                        }}
                        disabled={rowDisabled || rowBusy}
                      >
                        {rowBusy ? (
                          <Loader2
                            size={14}
                            className="pending-action-spinner"
                          />
                        ) : (
                          <XCircle size={14} />
                        )}
                        {rowBusy ? "Обработка..." : "Отказать"}
                      </button>
                    </div>
                  </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer Actions */}
    </div>
  );
};

export default Pending;
