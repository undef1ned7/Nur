import React, { useEffect, useMemo, useState } from "react";
import { useDispatch } from "react-redux";
import { Table2, LayoutGrid } from "lucide-react";
import api from "../../../../api";
import "./LogisticsPage.scss";

import { useClient } from "../../../../store/slices/ClientSlice";
import { fetchClientsAsync } from "../../../../store/creators/clientCreators";
import { useUser } from "../../../../store/slices/userSlice";

import { useCash, getCashBoxes } from "../../../../store/slices/cashSlice";
import {
  fetchLogisticsAsync,
  createLogisticAsync,
  updateLogisticAsync,
  fetchLogisticsAnalyticsAsync,
} from "../../../../store/creators/logisticsCreators";
import { useLogistics } from "../../../../store/slices/logisticsSlice";

import LogisticsOrderFormModal from "./LogisticsOrderFormModal";
import LogisticsOrderViewModal from "./LogisticsOrderViewModal";
import AlertModal from "../../../common/AlertModal/AlertModal";
import useResize from "../../../../hooks/useResize";

const statusOptions = [
  { value: "decorated", label: "Оформлен" },
  { value: "transit", label: "В пути" },
  { value: "completed", label: "Завершен" },
];

const emptyForm = {
  clientId: "",
  carName: "",
  description: "",
  carPrice: "",
  servicePrice: "",
  salePrice: "",
  status: "decorated",
  time: "",
  arrivalDate: "",
};

const STORAGE_KEY = "logistics_view_mode";

const getInitialViewMode = () => {
  if (typeof window === "undefined") return "table";
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved === "table" || saved === "cards") return saved;

  const isSmall = window.matchMedia("(max-width: 1199px)").matches;
  return isSmall ? "cards" : "table";
};

const safeNum = (v) => {
  const n =
    typeof v === "string"
      ? parseFloat(v.replace(/\s/g, "").replace(",", "."))
      : parseFloat(v);
  return Number.isFinite(n) ? n : 0;
};

const fmtMoney = (v) =>
  safeNum(v).toLocaleString("ru-RU", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const normalizeStatus = (raw) => {
  const s = String(raw || "").toLowerCase().trim();
  if (!s) return "decorated";

  if (
    ["completed", "complete", "done", "finished", "finish", "завершен", "завершено"].includes(s)
  ) {
    return "completed";
  }

  if (["transit", "in_transit", "on_way", "moving", "в пути", "пути"].includes(s)) {
    return "transit";
  }

  if (["decorated", "created", "new", "оформлен", "оформлено"].includes(s)) {
    return "decorated";
  }

  return s;
};

const getServiceValue = (order) => {
  return safeNum(
    order?.price_service ??
    order?.service_price ??
    order?.servicePrice ??
    order?.service ??
    order?.service_cost ??
    0
  );
};

const getRevenueValue = (order) => {
  if (order?.revenue !== undefined && order?.revenue !== null && order?.revenue !== "") {
    const r = safeNum(order.revenue);
    return r > 0 ? r : 0;
  }

  const sale = safeNum(order?.sale_price ?? order?.price_sale ?? order?.salePrice ?? 0);
  const car = safeNum(order?.price_car ?? order?.carPrice ?? 0);
  if (!(sale > 0 && car > 0)) return 0;

  const r = sale - car;
  return r > 0 ? r : 0;
};

const ExpenseModal = ({ open, onClose, onSubmit, loading }) => {
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName("");
    setAmount("");
    setTouched(false);
  }, [open]);

  if (!open) return null;

  const parsed = safeNum(amount);
  const isValid = parsed > 0;

  const handleSubmit = (e) => {
    e.preventDefault();
    setTouched(true);
    if (!isValid) return;

    onSubmit({
      name: name.trim() || "Расход",
      amount: parsed,
    });
  };

  return (
    <div className="logistics-page__modal-overlay" onClick={loading ? undefined : onClose}>
      <div
        className="logistics-page__modal logistics-page__modal--expense"
        onClick={(e) => e.stopPropagation()}
      >
        <form className="logistics-page__form logistics-page__expense" onSubmit={handleSubmit}>
          <div className="logistics-page__expense-head">
            <h2 className="logistics-page__form-title">Расход</h2>
            <button
              type="button"
              className="logistics-page__expense-close"
              onClick={onClose}
              disabled={loading}
              aria-label="Закрыть"
              title="Закрыть"
            >
              ✕
            </button>
          </div>

          <div className="logistics-page__form-grid">
            <div className="logistics-page__field logistics-page__field--full">
              <label className="logistics-page__label">Комментарий</label>
              <input
                className="logistics-page__input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Например: комиссия, транспорт, штраф…"
                disabled={loading}
              />
            </div>

            <div className="logistics-page__field logistics-page__field--full">
              <label className="logistics-page__label">Сумма ($)</label>
              <input
                className={`logistics-page__input${touched && !isValid ? " logistics-page__input--error" : ""
                  }`}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="Например: 150"
                inputMode="decimal"
                disabled={loading}
              />
              {touched && !isValid && (
                <div className="logistics-page__field-hint logistics-page__field-hint--error">
                  Введите сумму больше 0
                </div>
              )}
            </div>
          </div>

          <div className="logistics-page__form-actions">
            <button
              type="button"
              className="logistics-page__btn logistics-page__btn--ghost"
              onClick={onClose}
              disabled={loading}
            >
              Отменить
            </button>
            <button
              type="submit"
              className="logistics-page__btn logistics-page__btn--primary"
              disabled={loading || !isValid}
            >
              {loading ? "Списание..." : "Списать"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// API расходов логистики: GET/POST /logistics/expenses/ (Swagger)
const EXPENSE_PATH = "/logistics/expenses/";

const LogisticsPage = () => {
  const dispatch = useDispatch();
  const { list: clients, loading: clientsLoading } = useClient();
  const { company } = useUser();
  const { list: logistics, loading } = useLogistics();
  const { list: cashBoxes } = useCash(); // оставил как есть, не трогаю остальной код
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [viewOrder, setViewOrder] = useState(null);
  const [filterStatus, setFilterStatus] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [viewMode, setViewMode] = useState(getInitialViewMode);
  const { isMobile } = useResize(({ isMobile }) => {
    if (isMobile) {
      setViewMode('cards')
    } else {
      setViewMode(getInitialViewMode())
    }
  });
  // ✅ расход теперь с сервера (SUM /logistics/expenses/)
  const [sentToCashAmount, setSentToCashAmount] = useState(0);

  const [expenseOpen, setExpenseOpen] = useState(false);
  const [expenseLoading, setExpenseLoading] = useState(false);

  const [alert, setAlert] = useState({
    open: false,
    type: "success",
    title: "",
    message: "",
  });

  useEffect(() => {
    dispatch(fetchClientsAsync());
  }, [dispatch]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY, viewMode);
    }
  }, [viewMode]);

  useEffect(() => {
    if (!company?.id) return;
    const params = { company: company.id, branch: company.branch };
    dispatch(fetchLogisticsAsync(params));
    dispatch(fetchLogisticsAnalyticsAsync(params));
    dispatch(getCashBoxes());
  }, [dispatch, company]);

  const fetchExpensesTotal = async () => {
    if (!company?.id) {
      setSentToCashAmount(0);
      return;
    }

    try {
      const { data } = await api.get(EXPENSE_PATH, {
        params: { company: company.id, branch: company.branch || undefined },
      });

      const results = Array.isArray(data?.results) ? data.results : Array.isArray(data) ? data : [];
      const total = results.reduce((sum, it) => sum + safeNum(it?.amount), 0);
      setSentToCashAmount(total);
    } catch (e) {
      console.error("Не удалось загрузить расходы логистики:", e);
      setSentToCashAmount(0);
    }
  };

  useEffect(() => {
    fetchExpensesTotal();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [company?.id, company?.branch]);

  const handleSubmit = async () => {
    const salePrice = safeNum(form.salePrice);
    const carPrice = safeNum(form.carPrice);
    const revenue = salePrice > 0 && carPrice > 0 ? Math.max(0, salePrice - carPrice) : 0;

    const payload = {
      company: company?.id,
      branch: company?.branch || null,
      client: form.clientId || null,
      title: form.carName,
      description: form.description,
      price_car: form.carPrice || "0",
      price_service: form.servicePrice || "0",
      sale_price: form.salePrice || "0",
      revenue: String(revenue),
      status: "decorated",
      arrival_date: form.arrivalDate || null,
    };

    try {
      if (editingId) {
        await dispatch(updateLogisticAsync({ id: editingId, data: payload })).unwrap();
      } else {
        await dispatch(createLogisticAsync(payload)).unwrap();
      }

      if (company?.id) {
        const params = { company: company.id, branch: company.branch };
        dispatch(fetchLogisticsAsync(params));
        dispatch(fetchLogisticsAnalyticsAsync(params));
      }

      setForm(emptyForm);
      setEditingId(null);
      setShowForm(false);

      setAlert({
        open: true,
        type: "success",
        title: editingId ? "Заказ обновлен" : "Заказ создан",
        message: editingId ? "Заказ успешно обновлен" : "Заказ успешно создан",
      });
    } catch (error) {
      console.error("Ошибка при сохранении заказа:", error);
      setAlert({
        open: true,
        type: "error",
        title: "Ошибка",
        message: error?.response?.data?.detail || error?.message || "Не удалось сохранить заказ",
      });
    }
  };

  const openCreate = () => {
    setForm(emptyForm);
    setEditingId(null);
    setShowForm(true);
  };

  const openEdit = (order) => {
    setEditingId(order.id);
    setForm({
      clientId: order.clientId || "",
      carName: order.carName || "",
      description: order.description || "",
      carPrice: order.carPrice || "",
      servicePrice: order.servicePrice || "",
      salePrice: order.sale_price || "",
      status: order.status || "decorated",
      time: order.time || "",
      arrivalDate: order.arrivalDate || "",
    });
    setShowForm(true);
  };

  const getClientName = (id) => {
    const c = clients.find((cl) => String(cl.id) === String(id));
    return c?.full_name || c?.phone || "Клиент";
  };

  const openView = (order) => setViewOrder(order);
  const closeView = () => setViewOrder(null);

  const filteredOrdersRaw = useMemo(() => {
    const arr = Array.isArray(logistics) ? logistics : [];
    const f = filterStatus ? normalizeStatus(filterStatus) : null;

    if (!f) return arr;
    return arr.filter((o) => normalizeStatus(o?.status) === f);
  }, [logistics, filterStatus]);

  const filteredOrders = useMemo(() => {
    return filteredOrdersRaw.map((item) => {
      const salePrice = item.price_sale ?? item.sale_price ?? item.salePrice ?? "";
      const carPrice = item.price_car ?? item.carPrice ?? "";
      const revenue = item.revenue !== undefined && item.revenue !== null ? safeNum(item.revenue) : null;

      return {
        id: item.id,
        clientId: item.client || item.clientId || "",
        carName: item.title || item.carName || "",
        description: item.description || "",
        carPrice: carPrice,
        servicePrice: item.price_service ?? item.servicePrice ?? item.service_price ?? "",
        sale_price: salePrice,
        revenue: revenue,
        status: normalizeStatus(item.status) || "decorated",
        time: item.created_at || item.time || "",
        arrivalDate: item.arrival_date || item.arrivalDate || "",
        updated_at: item.updated_at || item.updatedAt || item.created_at || "",
      };
    });
  }, [filteredOrdersRaw]);

  const analyticsLocal = useMemo(() => {
    const all = Array.isArray(logistics) ? logistics : [];

    const byStatus = {
      decorated: { orders: 0, revenue: 0, service: 0 },
      transit: { orders: 0, revenue: 0, service: 0 },
      completed: { orders: 0, revenue: 0, service: 0 },
    };

    let totalOrders = 0;
    let completedServiceTotal = 0;

    for (const o of all) {
      const st = normalizeStatus(o?.status);
      const revenue = getRevenueValue(o);
      const service = getServiceValue(o);

      totalOrders += 1;

      if (st === "decorated" || st === "transit" || st === "completed") {
        byStatus[st].orders += 1;
        byStatus[st].revenue += revenue;
        byStatus[st].service += service;
      }

      if (st === "completed") {
        completedServiceTotal += service;
      }
    }

    return { totalOrders, byStatus, completedServiceTotal };
  }, [logistics]);

  // ✅ “Услуга (завершенные)” = completed service - SUM(expenses from server)
  const completedServiceShown = useMemo(() => {
    const v = safeNum(analyticsLocal.completedServiceTotal) - safeNum(sentToCashAmount);
    return v > 0 ? v : 0;
  }, [analyticsLocal.completedServiceTotal, sentToCashAmount]);

  const statusSummary = useMemo(() => {
    return statusOptions.map((s) => {
      const row = analyticsLocal.byStatus[s.value] || { orders: 0, revenue: 0, service: 0 };
      return {
        key: s.value,
        label: s.label,
        color: s.value === "decorated" ? "blue" : s.value === "transit" ? "orange" : "green",
        count: row.orders,
        totalAmount: row.revenue,
        totalServiceAmount: row.service,
      };
    });
  }, [analyticsLocal.byStatus]);

  const handleExpenseSubmit = async ({ name, amount }) => {
    if (!company?.id) return;

    const a = safeNum(amount);
    if (a <= 0) return;

    setExpenseLoading(true);
    try {
      await api.post(EXPENSE_PATH, {
        name: (name?.trim() || "Расход").slice(0, 255),
        amount: String(a),
      });

      await fetchExpensesTotal();

      setExpenseOpen(false);

      setAlert({
        open: true,
        type: "success",
        title: "Успешно",
        message: `Расход: ${fmtMoney(a)} $`,
      });
    } catch (err) {
      console.error("Не удалось создать расход логистики:", err);
      setAlert({
        open: true,
        type: "error",
        title: "Ошибка",
        message: err?.response?.data?.detail || err?.message || "Не удалось списать расход",
      });
    } finally {
      setExpenseLoading(false);
    }
  };

  const handleStatusChangeFromTimeline = async (order, newStatus) => {
    if (!company?.id) return;

    try {
      const payload = {
        company: company.id,
        branch: company.branch || null,
        client: order.clientId || order.client || null,
        title: order.carName || order.title || "",
        description: order.description || "",
        price_car: order.carPrice ?? order.price_car ?? "0",
        price_service: order.servicePrice ?? order.price_service ?? "0",
        status: newStatus,
        arrival_date: order.arrivalDate || order.arrival_date || null,
      };

      const saved = await dispatch(updateLogisticAsync({ id: order.id, data: payload })).unwrap();

      setViewOrder((prev) =>
        prev ? { ...prev, status: normalizeStatus(newStatus), updated_at: saved.updated_at } : prev
      );

      const params = { company: company.id, branch: company.branch };
      dispatch(fetchLogisticsAsync(params));
      dispatch(fetchLogisticsAnalyticsAsync(params));

      const statusLabel =
        statusOptions.find((s) => s.value === normalizeStatus(newStatus))?.label || newStatus;

      setAlert({
        open: true,
        type: "success",
        title: "Статус обновлен",
        message: `Статус заказа изменен на "${statusLabel}"`,
      });
    } catch (e) {
      console.error("Не удалось обновить статус логистики:", e);
      setAlert({
        open: true,
        type: "error",
        title: "Ошибка",
        message: e?.response?.data?.detail || e?.message || "Не удалось обновить статус заказа",
      });
    }
  };

  return (
    <div className="logistics-page">
      {/* Аналитика */}
      <div className="logistics-page__analytics">
        <div
          className={
            "logistics-page__analytics-card logistics-page__analytics-card--all" +
            (filterStatus === null ? " logistics-page__analytics-card--active" : "")
          }
          onClick={() => setFilterStatus(null)}
        >
          <div className="logistics-page__analytics-label">Все заказы</div>
          <div className="logistics-page__analytics-value">{analyticsLocal.totalOrders} заказов</div>
          <div className="logistics-page__analytics-subvalue">
            Услуга (завершенные): {fmtMoney(completedServiceShown)} $
          </div>
        </div>

        {statusSummary.map((s) => (
          <div
            key={s.key}
            className={`logistics-page__analytics-card logistics-page__analytics-card--${s.color}${normalizeStatus(filterStatus) === s.key ? " logistics-page__analytics-card--active" : ""
              }`}
            onClick={() => setFilterStatus((prev) => (normalizeStatus(prev) === s.key ? null : s.key))}
          >
            <div className="logistics-page__analytics-label">{s.label}</div>
            <div className="logistics-page__analytics-value">{s.count} заказов</div>
            <div className="logistics-page__analytics-subvalue">
              Сумма: {safeNum(s.totalAmount).toLocaleString("ru-RU")} $
            </div>
            <div className="logistics-page__analytics-subvalue">
              Услуга: {fmtMoney(s.totalServiceAmount)} $
            </div>
          </div>
        ))}
      </div>

      {/* Кнопки */}
      <div className="logistics-page__actions">
        <button type="button" className="logistics-page__btn logistics-page__btn--primary" onClick={openCreate}>
          + Добавить заказ
        </button>

        <button
          type="button"
          className="logistics-page__btn logistics-page__btn--ghost"
          onClick={() => setExpenseOpen(true)}
          disabled={expenseLoading}
        >
          Расход
        </button>
      </div>

      {/* Список заказов */}
      <div className="logistics-page__orders">
        <div className="logistics-page__orders-header">
          <h2 className="logistics-page__orders-title">Заказы по логистике</h2>

          {!isMobile && (<div className="logistics-page__view-toggle">
            <button
              type="button"
              onClick={() => setViewMode("table")}
              className={`logistics-page__view-btn ${viewMode === "table" ? "logistics-page__view-btn--active" : ""}`}
            >
              <Table2 size={16} />
              Таблица
            </button>
            <button
              type="button"
              onClick={() => setViewMode("cards")}
              className={`logistics-page__view-btn ${viewMode === "cards" ? "logistics-page__view-btn--active" : ""}`}
            >
              <LayoutGrid size={16} />
              Карточки
            </button>
          </div>)}
        </div>

        <div className="logistics-page__table-container w-full">
          {/* ===== TABLE ===== */}
          {viewMode === "table" && (
            <>
              {loading ? (
                <div className="logistics-page__table-loading rounded-2xl border border-slate-200 bg-white p-6 text-center text-slate-600">
                  Загрузка...
                </div>
              ) : filteredOrders.length === 0 ? (
                <div className="logistics-page__table-empty rounded-2xl border border-slate-200 bg-white p-6 text-center text-slate-600">
                  Заказы не найдены
                </div>
              ) : (
                <div className="logistics-page__table-scroll overflow-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
                  <table className="logistics-page__table w-full min-w-[1200px]">
                    <thead>
                      <tr>
                        <th>Клиент</th>
                        <th>Машина</th>
                        <th>Цена машины</th>
                        <th>Стоимость услуги</th>
                        <th>Цена продажи</th>
                        <th>Выручка с продажи</th>
                        <th>Статус</th>
                        <th>Примерная дата прибытия</th>
                        <th style={{ width: "200px" }}>Действия</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredOrders.map((order) => (
                        <tr
                          key={order.id}
                          className="logistics-page__table-row cursor-pointer transition hover:bg-slate-50"
                        >
                          <td>{getClientName(order.clientId)}</td>
                          <td>{order.carName || "—"}</td>
                          <td>{order.carPrice || "—"}</td>
                          <td>{order.servicePrice || "—"}</td>
                          <td>{order.sale_price || "—"}</td>
                          <td>{order.revenue !== null && order.revenue !== undefined ? fmtMoney(order.revenue) : "—"}</td>
                          <td>{statusOptions.find((s) => s.value === normalizeStatus(order.status))?.label || order.status}</td>
                          <td>{order.arrivalDate ? order.arrivalDate : "—"}</td>
                          <td>
                            <div className="logistics-page__order-actions">
                              <button
                                type="button"
                                className="logistics-page__btn logistics-page__btn--secondary"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openView(order);
                                }}
                              >
                                Смотреть
                              </button>
                              <button
                                type="button"
                                className="logistics-page__btn logistics-page__btn--primary"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openEdit(order);
                                }}
                              >
                                Редактировать
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}

          {/* ===== CARDS ===== */}
          {viewMode === "cards" && (
            <>
              {loading ? (
                <div className="logistics-page__table-loading rounded-2xl border border-slate-200 bg-white p-6 text-center text-slate-600">
                  Загрузка...
                </div>
              ) : filteredOrders.length === 0 ? (
                <div className="logistics-page__table-empty rounded-2xl border border-slate-200 bg-white p-6 text-center text-slate-600">
                  Заказы не найдены
                </div>
              ) : (
                <div className="logistics-page__cards grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {filteredOrders.map((order, index) => {
                    const statusKey = normalizeStatus(order.status);
                    const statusLabel = statusOptions.find((s) => s.value === statusKey)?.label || order.status;

                    const statusColor =
                      statusKey === "decorated" ? "blue" : statusKey === "transit" ? "orange" : "green";

                    return (
                      <div
                        key={order.id}
                        className="logistics-page__card cursor-pointer rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-[1px] hover:shadow-md"
                        onClick={() => openView(order)}
                      >
                        <div className="mb-3 flex items-center justify-between">
                          <div className="text-xs font-semibold text-slate-500">#{index + 1}</div>
                          <div
                            className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${statusColor === "blue"
                              ? "bg-blue-100 text-blue-700"
                              : statusColor === "orange"
                                ? "bg-orange-100 text-orange-700"
                                : "bg-green-100 text-green-700"
                              }`}
                          >
                            {statusLabel}
                          </div>
                        </div>

                        <div className="mb-3">
                          <div className="text-xs text-slate-500">Клиент</div>
                          <div className="mt-0.5 text-sm font-semibold text-slate-900">
                            {getClientName(order.clientId)}
                          </div>
                        </div>

                        <div className="mb-3">
                          <div className="text-xs text-slate-500">Машина</div>
                          <div className="mt-0.5 text-sm font-semibold text-slate-900">{order.carName || "—"}</div>
                        </div>

                        <div className="mb-4 grid grid-cols-2 gap-2 text-xs">
                          <div className="rounded-xl bg-slate-50 p-2">
                            <div className="text-slate-500">Цена машины</div>
                            <div className="mt-0.5 font-semibold text-slate-900">{order.carPrice || "—"}</div>
                          </div>

                          <div className="rounded-xl bg-slate-50 p-2">
                            <div className="text-slate-500">Стоимость услуги</div>
                            <div className="mt-0.5 font-semibold text-slate-900">{order.servicePrice || "—"}</div>
                          </div>

                          <div className="rounded-xl bg-slate-50 p-2">
                            <div className="text-slate-500">Цена продажи</div>
                            <div className="mt-0.5 font-semibold text-slate-900">{order.sale_price || "—"}</div>
                          </div>

                          <div className="rounded-xl bg-slate-50 p-2">
                            <div className="text-slate-500">Выручка с продажи</div>
                            <div className="mt-0.5 font-semibold text-slate-900">
                              {order.revenue !== null && order.revenue !== undefined ? fmtMoney(order.revenue) : "—"}
                            </div>
                          </div>
                        </div>

                        {order.arrivalDate && (
                          <div className="mb-3 text-xs">
                            <div className="text-slate-500">Примерная дата прибытия</div>
                            <div className="mt-0.5 font-medium text-slate-700">{order.arrivalDate}</div>
                          </div>
                        )}

                        <div className="mt-4 flex gap-2">
                          <button
                            type="button"
                            className="logistics-page__btn logistics-page__btn--secondary flex-1"
                            onClick={(e) => {
                              e.stopPropagation();
                              openView(order);
                            }}
                          >
                            Смотреть
                          </button>
                          <button
                            type="button"
                            className="logistics-page__btn logistics-page__btn--primary flex-1"
                            onClick={(e) => {
                              e.stopPropagation();
                              openEdit(order);
                            }}
                          >
                            Редактировать
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <LogisticsOrderFormModal
        visible={showForm}
        onClose={() => setShowForm(false)}
        form={form}
        setForm={setForm}
        clients={clients}
        clientsLoading={clientsLoading}
        onSubmit={handleSubmit}
        editingId={editingId}
      />

      {viewOrder && (
        <LogisticsOrderViewModal
          order={viewOrder}
          onClose={closeView}
          getClientName={getClientName}
          onStatusChange={(newStatus) => handleStatusChangeFromTimeline(viewOrder, newStatus)}
        />
      )}

      <ExpenseModal
        open={expenseOpen}
        onClose={() => (expenseLoading ? null : setExpenseOpen(false))}
        onSubmit={handleExpenseSubmit}
        loading={expenseLoading}
      />

      <AlertModal
        open={alert.open}
        type={alert.type}
        title={alert.title}
        message={alert.message}
        onClose={() => setAlert({ ...alert, open: false })}
      />
    </div>
  );
};

export default LogisticsPage;
