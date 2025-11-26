import React, { useEffect, useState } from "react";
import { useDispatch } from "react-redux";
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
  status: "decorated",
  time: "",
  arrivalDate: "",
};

const LogisticsPage = () => {
  const dispatch = useDispatch();
  const { list: clients, loading: clientsLoading } = useClient();

  const [showForm, setShowForm] = useState(false); // модалка создания/редактирования
  const [editingId, setEditingId] = useState(null);
  const [viewOrder, setViewOrder] = useState(null); // модалка просмотра
  const [filterStatus, setFilterStatus] = useState(null);
  const [form, setForm] = useState(emptyForm);

  const { company } = useUser();
  const { list: logistics, loading, analytics } = useLogistics();
  const { list: cashBoxes } = useCash();

  useEffect(() => {
    dispatch(fetchClientsAsync());
  }, [dispatch]);

  // Загрузка заказов и аналитики из API
  useEffect(() => {
    if (!company?.id) return;
    const params = { company: company.id, branch: company.branch };
    dispatch(fetchLogisticsAsync(params));
    dispatch(fetchLogisticsAnalyticsAsync(params));
    dispatch(getCashBoxes());
  }, [dispatch, company]);

  const handleSubmit = async () => {
    const payload = {
      company: company?.id,
      branch: company?.branch || null,
      client: form.clientId || null,
      title: form.carName,
      description: form.description,
      price_car: form.carPrice || "0",
      price_service: form.servicePrice || "0",
      status: "decorated", // новая заявка всегда с оформленным статусом
      arrival_date: form.arrivalDate || null,
    };

    try {
      const prevOrder =
        editingId &&
        filteredOrders.find((o) => String(o.id) === String(editingId));

      const isCompletedBefore = prevOrder?.status === "completed";
      const willBeCompleted = payload.status === "completed";

      let saved;
      if (editingId) {
        saved = await dispatch(
          updateLogisticAsync({ id: editingId, data: payload })
        ).unwrap();
      } else {
        saved = await dispatch(createLogisticAsync(payload)).unwrap();
      }

      // если статус стал "completed" сейчас, а раньше не был — создаём приход в кассу
      if (willBeCompleted && !isCompletedBefore) {
        const firstCashboxId =
          cashBoxes && cashBoxes.length ? cashBoxes[0].id : null;
        if (firstCashboxId && Number(payload.price_service) > 0) {
          try {
            await dispatch(
              addCashFlows({
                cashbox: firstCashboxId,
                type: "income",
                name: payload.title || "Логистика",
                amount: payload.price_service,
                source_cashbox_flow_id: saved.id,
              })
            ).unwrap();
          } catch (err) {
            console.error("Не удалось создать проводку по кассе:", err);
          }
        }
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

      const isCompletedBefore = order.status === "completed";
      const willBeCompleted = newStatus === "completed";

      const saved = await dispatch(
        updateLogisticAsync({ id: order.id, data: payload })
      ).unwrap();

      if (willBeCompleted && !isCompletedBefore) {
        const firstCashboxId =
          cashBoxes && cashBoxes.length ? cashBoxes[0].id : null;
        if (firstCashboxId && Number(payload.price_service) > 0) {
          try {
            await dispatch(
              addCashFlows({
                cashbox: firstCashboxId,
                type: "income",
                name: payload.title || "Логистика",
                amount: payload.price_service,
                source_cashbox_flow_id: saved.id,
              })
            ).unwrap();
          } catch (err) {
            console.error("Не удалось создать проводку по кассе:", err);
          }
        }
      }

      // обновим локальное состояние текущего заказа в модалке
      setViewOrder((prev) =>
        prev ? { ...prev, status: newStatus, updated_at: saved.updated_at } : prev
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
    };
  });

  // Общий итог по всем статусам
  const totalOrders = statusSummary.reduce((acc, s) => acc + s.count, 0);
  const totalAmount = statusSummary.reduce(
    (acc, s) => acc + s.totalAmount,
    0
  );

  const filteredOrdersRaw = filterStatus
    ? logistics.filter((o) => o.status === filterStatus)
    : logistics;

  const filteredOrders = filteredOrdersRaw.map((item) => ({
    id: item.id,
    clientId: item.client || item.clientId || "",
    carName: item.title || item.carName || "",
    description: item.description || "",
    carPrice: item.price_car ?? item.carPrice ?? "",
    servicePrice: item.price_service ?? item.servicePrice ?? "",
    status: item.status || "decorated",
    time: item.created_at || item.time || "",
    arrivalDate: item.arrival_date || item.arrivalDate || "",
    updated_at: item.updated_at || item.updatedAt || item.created_at || "",
  }));

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
          </div>
        ))}
      </div>

      {/* Кнопка добавления заказа/товара */}
      <div className="logistics-page__actions">
        <button
          type="button"
          className="logistics-page__btn logistics-page__btn--primary"
          onClick={openCreate}
        >
          + Добавить заказ
        </button>
      </div>

      {/* Список заказов (по строкам) */}
      {filteredOrders.length > 0 && (
        <div className="logistics-page__orders">
          <h2 className="logistics-page__orders-title">Заказы по логистике</h2>
          <div className="logistics-page__table-wrapper">
            <table className="logistics-page__table logistics-page__orders-table">
              <thead>
                <tr>
                  <th>Клиент</th>
                  <th>Машина</th>
                  <th>Цена машины</th>
                  <th>Стоимость услуги</th>
                  <th>Статус</th>
                  <th>Создан</th>
                  <th>Дата прибытия</th>
                  <th style={{ width: "170px" }}>Действия</th>
                </tr>
              </thead>
              <tbody>
                {filteredOrders.map((order) => (
                  <tr key={order.id}>
                    <td>{getClientName(order.clientId)}</td>
                    <td>{order.carName || "—"}</td>
                    <td>{order.carPrice || "—"}</td>
                    <td>{order.servicePrice || "—"}</td>
                    <td>
                      {
                        statusOptions.find(
                          (s) => s.value === order.status
                        )?.label || order.status
                      }
                    </td>
                    <td>
                      {order.time
                        ? new Date(order.time).toLocaleString()
                        : "—"}
                    </td>
                    <td>
                      {order.arrivalDate
                        ? new Date(order.arrivalDate).toLocaleDateString(
                            "ru-RU"
                          )
                        : "—"}
                    </td>
                    <td>
                      <div className="logistics-page__order-actions">
                        <button
                          type="button"
                          className="logistics-page__btn logistics-page__btn--secondary"
                          onClick={() => openView(order)}
                        >
                          Смотреть
                        </button>
                        <button
                          type="button"
                          className="logistics-page__btn logistics-page__btn--primary"
                          onClick={() => openEdit(order)}
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
        </div>
      )}

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
    </div>
  );
};

export default LogisticsPage;
