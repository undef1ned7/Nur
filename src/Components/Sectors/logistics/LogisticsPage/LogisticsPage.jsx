import React, { useEffect, useState } from "react";
import { useDispatch } from "react-redux";
import { Table2, LayoutGrid } from "lucide-react";
import "./LogisticsPage.scss";
import { useClient } from "../../../../store/slices/ClientSlice";
import { fetchClientsAsync } from "../../../../store/creators/clientCreators";
import { useUser } from "../../../../store/slices/userSlice";
import {
  addCashFlows,
  useCash,
  getCashBoxes,
} from "../../../../store/slices/cashSlice";
import {
  fetchLogisticsAsync,
  createLogisticAsync,
  updateLogisticAsync,
  fetchLogisticsAnalyticsAsync,
} from "../../../../store/creators/logisticsCreators";
import { useLogistics } from "../../../../store/slices/logisticsSlice";

import LogisticsOrderFormModal from "./LogisticsOrderFormModal";
import LogisticsOrderViewModal from "./LogisticsOrderViewModal";
import AddCashFlowsModal from "../../../Deposits/Kassa/AddCashFlowsModal/AddCashFlowsModal";

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

const LogisticsPage = () => {
  const dispatch = useDispatch();
  const { list: clients, loading: clientsLoading } = useClient();

  const [showForm, setShowForm] = useState(false); // модалка создания/редактирования
  const [editingId, setEditingId] = useState(null);
  const [viewOrder, setViewOrder] = useState(null); // модалка просмотра
  const [filterStatus, setFilterStatus] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [sentToCashAmount, setSentToCashAmount] = useState(0); // сумма, отправленная в кассу
  const [viewMode, setViewMode] = useState(getInitialViewMode); // "table" | "cards"
  const [showAddCashboxModal, setShowAddCashboxModal] = useState(false);

  const { company } = useUser();
  const { list: logistics, loading, analytics } = useLogistics();
  const { list: cashBoxes } = useCash();

  useEffect(() => {
    dispatch(fetchClientsAsync());
  }, [dispatch]);

  // Сохранение режима просмотра в localStorage
  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY, viewMode);
    }
  }, [viewMode]);

  // Загрузка заказов и аналитики из API
  useEffect(() => {
    if (!company?.id) return;
    const params = { company: company.id, branch: company.branch };
    dispatch(fetchLogisticsAsync(params));
    dispatch(fetchLogisticsAnalyticsAsync(params));
    dispatch(getCashBoxes());
  }, [dispatch, company]);

  // Загружаем сохраненную сумму из localStorage при смене компании
  useEffect(() => {
    if (company?.id) {
      const key = `logistics_sentToCash_${company.id}`;
      const stored = localStorage.getItem(key);
      const amount = stored ? parseFloat(stored) || 0 : 0;
      setSentToCashAmount(amount);
    } else {
      setSentToCashAmount(0);
    }
  }, [company?.id]);

  // Сохраняем сумму в localStorage при изменении
  useEffect(() => {
    if (company?.id) {
      const key = `logistics_sentToCash_${company.id}`;
      if (sentToCashAmount > 0) {
        localStorage.setItem(key, sentToCashAmount.toString());
      } else {
        // Очищаем localStorage если сумма равна 0
        localStorage.removeItem(key);
      }
    }
  }, [sentToCashAmount, company?.id]);

  const handleSubmit = async () => {
    // Вычисляем выручку: цена продажи - цена машины
    const salePrice = parseFloat(form.salePrice || 0);
    const carPrice = parseFloat(form.carPrice || 0);
    let revenue = null;
    if (
      !isNaN(salePrice) &&
      !isNaN(carPrice) &&
      salePrice > 0 &&
      carPrice > 0
    ) {
      revenue = salePrice - carPrice;
    }

    const payload = {
      company: company?.id,
      branch: company?.branch || null,
      client: form.clientId || null,
      title: form.carName,
      description: form.description,
      price_car: form.carPrice || "0",
      price_service: form.servicePrice || "0",
      price_sale: form.salePrice || "0",
      revenue: revenue !== null ? revenue.toString() : "0",
      status: "decorated", // новая заявка всегда с оформленным статусом
      arrival_date: form.arrivalDate || null,
    };

    try {
      let saved;
      if (editingId) {
        saved = await dispatch(
          updateLogisticAsync({ id: editingId, data: payload })
        ).unwrap();
      } else {
        saved = await dispatch(createLogisticAsync(payload)).unwrap();
      }

      // перезагрузим список и аналитику
      if (company?.id) {
        const params = { company: company.id, branch: company.branch };
        dispatch(fetchLogisticsAsync(params));
        dispatch(fetchLogisticsAnalyticsAsync(params));
      }

      setForm(emptyForm);
      setEditingId(null);
      setShowForm(false);
    } catch (error) {
      console.error("Ошибка при сохранении заказа:", error);
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
      salePrice: order.salePrice || "",
      status: order.status || "created",
      time: order.time || "",
      arrivalDate: order.arrivalDate || "",
    });
    setShowForm(true);
  };

  const getClientName = (id) => {
    const c = clients.find((cl) => String(cl.id) === String(id));
    return c?.full_name || c?.phone || `Клиент`;
  };

  const openView = (order) => {
    setViewOrder(order);
  };

  const closeView = () => {
    setViewOrder(null);
  };

  // Отправка общей суммы стоимости услуг в кассу
  const handleSendToCash = async () => {
    if (!company?.id) return;

    const firstCashboxId =
      cashBoxes && cashBoxes.length ? cashBoxes[0].id : null;

    if (!firstCashboxId) {
      console.error("Нет доступных касс");
      return;
    }

    // Считаем общую сумму стоимости услуг всех заказов
    const totalServiceAmount = filteredOrders.reduce((sum, order) => {
      const servicePrice = parseFloat(
        order.servicePrice ?? order.price_service ?? 0
      );
      return sum + servicePrice;
    }, 0);

    if (totalServiceAmount <= 0) {
      console.error("Общая сумма стоимости услуг должна быть больше 0");
      return;
    }

    try {
      await dispatch(
        addCashFlows({
          cashbox: firstCashboxId,
          type: "income",
          name: "Прочие расходы",
          amount: totalServiceAmount,
        })
      ).unwrap();

      // Вычитаем отправленную сумму из отображаемых значений
      setSentToCashAmount((prev) => prev + totalServiceAmount);

      // Перезагрузим список и аналитику
      if (company?.id) {
        const params = { company: company.id, branch: company.branch };
        dispatch(fetchLogisticsAsync(params));
        dispatch(fetchLogisticsAnalyticsAsync(params));
      }
    } catch (err) {
      console.error("Не удалось отправить сумму в кассу:", err);
    }
  };

  // смена статуса из модалки с таймлайном
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

      const saved = await dispatch(
        updateLogisticAsync({ id: order.id, data: payload })
      ).unwrap();

      // обновим локальное состояние текущего заказа в модалке
      setViewOrder((prev) =>
        prev
          ? { ...prev, status: newStatus, updated_at: saved.updated_at }
          : prev
      );

      // перезагрузим список и аналитику
      const params = { company: company.id, branch: company.branch };
      dispatch(fetchLogisticsAsync(params));
      dispatch(fetchLogisticsAnalyticsAsync(params));
    } catch (e) {
      console.error("Не удалось обновить статус логистики из таймлайна:", e);
    }
  };

  // Данные для аналитики по статусам (из /logistics/logistics/analytics/)
  const statusSummary = statusOptions.map((s) => {
    const item = analytics?.items?.find(
      (it) => String(it.status) === String(s.value)
    );
    // Вычисляем сумму стоимости услуг для заказов с этим статусом
    const ordersWithStatus = logistics.filter(
      (o) => String(o.status) === String(s.value)
    );
    const totalServiceAmount = ordersWithStatus.reduce((sum, order) => {
      const servicePrice =
        parseFloat(order.price_service ?? order.servicePrice ?? 0) || 0;
      return sum + servicePrice;
    }, 0);

    return {
      key: s.value,
      label: item?.status_display || s.label,
      color:
        s.value === "decorated"
          ? "blue"
          : s.value === "transit"
          ? "orange"
          : "green",
      count: item?.orders ?? 0,
      totalAmount: item?.amount ?? 0,
      totalServiceAmount: totalServiceAmount,
    };
  });

  // Общий итог по всем статусам
  const totalOrders = statusSummary.reduce((acc, s) => acc + s.count, 0);
  const totalAmount = statusSummary.reduce((acc, s) => acc + s.totalAmount, 0);
  // Общая сумма стоимости услуг
  const totalServiceAmount = statusSummary.reduce(
    (acc, s) => acc + s.totalServiceAmount,
    0
  );

  const filteredOrdersRaw = filterStatus
    ? logistics.filter((o) => o.status === filterStatus)
    : logistics;

  const filteredOrders = filteredOrdersRaw.map((item) => {
    const salePrice =
      item.price_sale ?? item.sale_price ?? item.salePrice ?? "";
    const carPrice = item.price_car ?? item.carPrice ?? "";

    // Берем выручку из данных, если нет - null
    const revenue =
      item.revenue !== undefined && item.revenue !== null
        ? parseFloat(item.revenue)
        : null;

    return {
      id: item.id,
      clientId: item.client || item.clientId || "",
      carName: item.title || item.carName || "",
      description: item.description || "",
      carPrice: carPrice,
      servicePrice: item.price_service ?? item.servicePrice ?? "",
      salePrice: salePrice,
      revenue: revenue,
      status: item.status || "decorated",
      time: item.created_at || item.time || "",
      arrivalDate: item.arrival_date || item.arrivalDate || "",
      updated_at: item.updated_at || item.updatedAt || item.created_at || "",
    };
  });

  return (
    <div className="logistics-page">
      {/* Аналитика по статусам */}
      <div className="logistics-page__analytics">
        {/* Карточка "Все заказы" */}
        <div
          className={
            "logistics-page__analytics-card logistics-page__analytics-card--all" +
            (filterStatus === null
              ? " logistics-page__analytics-card--active"
              : "")
          }
          onClick={() => setFilterStatus(null)}
        >
          <div className="logistics-page__analytics-label">Все заказы</div>
          <div className="logistics-page__analytics-value">
            {totalOrders} заказов
          </div>
          <div className="logistics-page__analytics-subvalue">
            Сумма: {totalAmount.toLocaleString("ru-RU")} сом
          </div>
          <div className="logistics-page__analytics-subvalue">
            Услуга:{" "}
            {totalServiceAmount.toLocaleString("ru-RU", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}{" "}
            сом
          </div>
        </div>

        {/* Карточки по каждому статусу */}
        {statusSummary.map((s) => (
          <div
            key={s.key}
            className={`logistics-page__analytics-card logistics-page__analytics-card--${
              s.color
            }${
              filterStatus === s.key
                ? " logistics-page__analytics-card--active"
                : ""
            }`}
            onClick={() =>
              setFilterStatus((prev) => (prev === s.key ? null : s.key))
            }
          >
            <div className="logistics-page__analytics-label">{s.label}</div>
            <div className="logistics-page__analytics-value">
              {s.count} заказов
            </div>
            <div className="logistics-page__analytics-subvalue">
              Сумма: {s.totalAmount.toLocaleString("ru-RU")} сом
            </div>
            <div className="logistics-page__analytics-subvalue">
              Услуга:{" "}
              {s.totalServiceAmount.toLocaleString("ru-RU", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}{" "}
              сом
            </div>
          </div>
        ))}
      </div>

      {/* Кнопки добавления заказа и отправки в кассу */}
      <div className="logistics-page__actions">
        <button
          type="button"
          className="logistics-page__btn logistics-page__btn--primary"
          onClick={openCreate}
        >
          + Добавить заказ
        </button>
        <button
          type="button"
          className="logistics-page__btn logistics-page__btn--ghost"
          onClick={() => setShowAddCashboxModal(true)}
          disabled={
            filteredOrders.length === 0 ||
            filteredOrders.reduce((sum, order) => {
              const servicePrice = parseFloat(
                order.servicePrice ?? order.price_service ?? 0
              );
              return sum + servicePrice;
            }, 0) <= 0
          }
        >
          Расход{" "}
          {/* {totalServiceAmount.toLocaleString("ru-RU", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}{" "}
          сом */}
        </button>
      </div>

      {/* Список заказов */}
      <div className="logistics-page__orders">
        <div className="logistics-page__orders-header">
          <h2 className="logistics-page__orders-title">Заказы по логистике</h2>
          {/* Кнопки переключения режима просмотра */}
          <div className="logistics-page__view-toggle">
            <button
              type="button"
              onClick={() => setViewMode("table")}
              className={`logistics-page__view-btn ${
                viewMode === "table" ? "logistics-page__view-btn--active" : ""
              }`}
            >
              <Table2 size={16} />
              Таблица
            </button>
            <button
              type="button"
              onClick={() => setViewMode("cards")}
              className={`logistics-page__view-btn ${
                viewMode === "cards" ? "logistics-page__view-btn--active" : ""
              }`}
            >
              <LayoutGrid size={16} />
              Карточки
            </button>
          </div>
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
                <div className="overflow-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
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
                        {/* <th>Создан</th> */}
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
                          <td>{order.salePrice || "—"}</td>
                          <td>
                            {order.revenue !== null &&
                            order.revenue !== undefined
                              ? order.revenue.toLocaleString("ru-RU", {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2,
                                })
                              : "—"}
                          </td>
                          <td>
                            {statusOptions.find((s) => s.value === order.status)
                              ?.label || order.status}
                          </td>
                          {/* <td>
                            {order.time
                              ? new Date(order.time).toLocaleString("ru-RU")
                              : "—"}
                          </td> */}
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
                    const statusLabel =
                      statusOptions.find((s) => s.value === order.status)
                        ?.label || order.status;
                    const statusColor =
                      order.status === "decorated"
                        ? "blue"
                        : order.status === "transit"
                        ? "orange"
                        : "green";

                    return (
                      <div
                        key={order.id}
                        className="logistics-page__card cursor-pointer rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-[1px] hover:shadow-md"
                        onClick={() => openView(order)}
                      >
                        <div className="mb-3 flex items-center justify-between">
                          <div className="text-xs font-semibold text-slate-500">
                            #{index + 1}
                          </div>
                          <div
                            className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${
                              statusColor === "blue"
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
                          <div className="mt-0.5 text-sm font-semibold text-slate-900">
                            {order.carName || "—"}
                          </div>
                        </div>

                        <div className="mb-4 grid grid-cols-2 gap-2 text-xs">
                          <div className="rounded-xl bg-slate-50 p-2">
                            <div className="text-slate-500">Цена машины</div>
                            <div className="mt-0.5 font-semibold text-slate-900">
                              {order.carPrice || "—"}
                            </div>
                          </div>

                          <div className="rounded-xl bg-slate-50 p-2">
                            <div className="text-slate-500">
                              Стоимость услуги
                            </div>
                            <div className="mt-0.5 font-semibold text-slate-900">
                              {order.servicePrice || "—"}
                            </div>
                          </div>

                          <div className="rounded-xl bg-slate-50 p-2">
                            <div className="text-slate-500">Цена продажи</div>
                            <div className="mt-0.5 font-semibold text-slate-900">
                              {order.salePrice || "—"}
                            </div>
                          </div>

                          <div className="rounded-xl bg-slate-50 p-2">
                            <div className="text-slate-500">
                              Выручка с продажи
                            </div>
                            <div className="mt-0.5 font-semibold text-slate-900">
                              {order.revenue !== null &&
                              order.revenue !== undefined
                                ? order.revenue.toLocaleString("ru-RU", {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 2,
                                  })
                                : "—"}
                            </div>
                          </div>
                        </div>
                        {/* 
                        <div className="mb-3 text-xs">
                          <div className="text-slate-500">Создан</div>
                          <div className="mt-0.5 font-medium text-slate-700">
                            {order.time
                              ? new Date(order.time).toLocaleString("ru-RU")
                              : "—"}
                          </div>
                        </div> */}

                        {order.arrivalDate && (
                          <div className="mb-3 text-xs">
                            <div className="text-slate-500">
                              Примерная дата прибытия
                            </div>
                            <div className="mt-0.5 font-medium text-slate-700">
                              {order.arrivalDate}
                            </div>
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

      {/* Модалка создания / редактирования заявки */}
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

      {/* Модалка подробного просмотра */}
      {viewOrder && (
        <LogisticsOrderViewModal
          order={viewOrder}
          onClose={closeView}
          getClientName={getClientName}
          onStatusChange={(newStatus) =>
            handleStatusChangeFromTimeline(viewOrder, newStatus)
          }
        />
      )}
      {showAddCashboxModal && (
        <AddCashFlowsModal onClose={() => setShowAddCashboxModal(false)} />
      )}
    </div>
  );
};

export default LogisticsPage;
