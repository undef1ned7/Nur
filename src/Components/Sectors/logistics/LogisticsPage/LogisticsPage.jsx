import React, { useEffect, useState } from "react";
import { useDispatch } from "react-redux";
import "./LogisticsPage.scss";
import { useClient } from "../../../../store/slices/ClientSlice";
import {
  fetchClientsAsync,
  createClientAsync,
} from "../../../../store/creators/clientCreators";
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
import { FaMapMarkerAlt, FaClock, FaCheck } from "react-icons/fa";

const statusOptions = [
  { value: "decorated", label: "Оформлен" },
  { value: "transit", label: "В пути" },
  { value: "completed", label: "Завершен" },
];

const LogisticsPage = () => {
  const dispatch = useDispatch();
  const { list: clients, loading: clientsLoading } = useClient();
  const [showNewClient, setShowNewClient] = useState(false);
  const [newClientName, setNewClientName] = useState("");
  const [newClientPhone, setNewClientPhone] = useState("");
  const [newClientEmail, setNewClientEmail] = useState("");
  const [newClientDate, setNewClientDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [newClientType, setNewClientType] = useState("client");
  const [newClientLlc, setNewClientLlc] = useState("");
  const [newClientInn, setNewClientInn] = useState("");
  const [newClientOkpo, setNewClientOkpo] = useState("");
  const [newClientScore, setNewClientScore] = useState("");
  const [newClientBik, setNewClientBik] = useState("");
  const [newClientAddress, setNewClientAddress] = useState("");

  const [showForm, setShowForm] = useState(false); // модалка создания/редактирования
  const [editingId, setEditingId] = useState(null);
  const [viewOrder, setViewOrder] = useState(null); // модалка просмотра
  const [filterStatus, setFilterStatus] = useState(null);
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

  const handleAddClient = async (e) => {
    e.preventDefault();
    if (!newClientName.trim()) return;
    try {
      const action = await dispatch(
        createClientAsync({
          full_name: newClientName.trim(),
          phone: newClientPhone.trim(),
          email: newClientEmail.trim(),
          date: newClientDate,
          type: newClientType,
          llc: newClientLlc.trim(),
          inn: newClientInn.trim(),
          okpo: newClientOkpo.trim(),
          score: newClientScore.trim(),
          bik: newClientBik.trim(),
          address: newClientAddress.trim(),
        })
      );
      if (createClientAsync.fulfilled.match(action)) {
        const client = action.payload;
        setForm((f) => ({ ...f, clientId: client.id }));
        setNewClientName("");
        setNewClientPhone("");
        setNewClientEmail("");
        setNewClientDate(new Date().toISOString().split("T")[0]);
        setNewClientType("client");
        setNewClientLlc("");
        setNewClientInn("");
        setNewClientOkpo("");
        setNewClientScore("");
        setNewClientBik("");
        setNewClientAddress("");
        setShowNewClient(false);
      }
    } catch (err) {
      // можно добавить уведомление об ошибке, если нужно
      console.error(err);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const payload = {
      company: company?.id,
      branch: company?.branch || null,
      client: form.clientId || null,
      title: form.carName,
      description: form.description,
      price_car: form.carPrice || "0",
      price_service: form.servicePrice || "0",
      status: form.status || "decorated",
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

  const getStatusLabel = (value) =>
    statusOptions.find((s) => s.value === value)?.label || value;

  const openView = (order) => {
    setViewOrder(order);
  };

  const closeView = () => {
    setViewOrder(null);
  };

  const getStatusStep = (status) => {
    if (status === "completed") return 3;
    if (status === "transit") return 2;
    return 1; // decorated
  };

  const getProgressPercent = (status) => {
    const step = getStatusStep(status);
    if (step <= 1) return 33;
    if (step === 2) return 66;
    return 100;
  };

  const formatDate = (iso) => {
    if (!iso) return "—";
    try {
      const d = new Date(iso);
      return d.toLocaleDateString("ru-RU", {
        day: "numeric",
        month: "long",
        year: "numeric",
      });
    } catch {
      return iso;
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
      {/* <div className="logistics-page__header">
        <h1 className="logistics-page__title">Логистика</h1>
        <p className="logistics-page__subtitle">
          Управление перевозками: статусы, заявки и товары в одном месте.
        </p>
      </div> */}

      {/* Аналитика по статусам */}
      <div className="logistics-page__analytics">
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
                    <td>{getStatusLabel(order.status)}</td>
                    <td>{new Date(order.time).toLocaleString() || "—"}</td>
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
      {showForm && (
        <div
          className="logistics-page__modal-overlay"
          onClick={() => setShowForm(false)}
        >
          <div
            className="logistics-page__modal"
            onClick={(e) => e.stopPropagation()}
          >
            <form className="logistics-page__form" onSubmit={handleSubmit}>
              <h2 className="logistics-page__form-title">
                {editingId ? "Редактировать заявку" : "Новая заявка"}
              </h2>

              <div className="logistics-page__form-grid">
                {/* Клиент */}
                <div className="logistics-page__field">
                  <label className="logistics-page__label">Клиент</label>
                  <select
                    className="logistics-page__input"
                    value={form.clientId}
                    disabled={clientsLoading}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, clientId: e.target.value }))
                    }
                  >
                    <option value="">
                      {clientsLoading
                        ? "Загрузка клиентов..."
                        : "Выберите клиента"}
                    </option>
                    {clients.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.full_name || c.phone || `ID ${c.id}`}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className="logistics-page__link-btn"
                    onClick={() => setShowNewClient((v) => !v)}
                  >
                    {showNewClient
                      ? "Скрыть создание клиента"
                      : "Создать нового клиента"}
                  </button>
                </div>

                {showNewClient && (
                  <div className="logistics-page__field logistics-page__field--full">
                    <div className="logistics-page__new-client">
                      <input
                        className="logistics-page__input"
                        placeholder="Имя клиента *"
                        value={newClientName}
                        onChange={(e) => setNewClientName(e.target.value)}
                      />
                      <input
                        className="logistics-page__input"
                        placeholder="Телефон"
                        value={newClientPhone}
                        onChange={(e) => setNewClientPhone(e.target.value)}
                      />
                      <input
                        className="logistics-page__input"
                        placeholder="E-mail"
                        value={newClientEmail}
                        onChange={(e) => setNewClientEmail(e.target.value)}
                      />
                      {/* <input
                        type="date"
                        className="logistics-page__input"
                        value={newClientDate}
                        onChange={(e) => setNewClientDate(e.target.value)}
                      />
                      <select
                        className="logistics-page__input"
                        value={newClientType}
                        onChange={(e) => setNewClientType(e.target.value)}
                      >
                        <option value="client">Клиент</option>
                        <option value="suppliers">Поставщик</option>
                      </select>
                      <input
                        className="logistics-page__input"
                        placeholder="Наименование юр. лица (ООО, ИП)"
                        value={newClientLlc}
                        onChange={(e) => setNewClientLlc(e.target.value)}
                      />
                      <input
                        className="logistics-page__input"
                        placeholder="ИНН"
                        value={newClientInn}
                        onChange={(e) => setNewClientInn(e.target.value)}
                      />
                      <input
                        className="logistics-page__input"
                        placeholder="ОКПО"
                        value={newClientOkpo}
                        onChange={(e) => setNewClientOkpo(e.target.value)}
                      />
                      <input
                        className="logistics-page__input"
                        placeholder="Расчётный счёт"
                        value={newClientScore}
                        onChange={(e) => setNewClientScore(e.target.value)}
                      />
                      <input
                        className="logistics-page__input"
                        placeholder="БИК"
                        value={newClientBik}
                        onChange={(e) => setNewClientBik(e.target.value)}
                      />
                      <input
                        className="logistics-page__input"
                        placeholder="Адрес"
                        value={newClientAddress}
                        onChange={(e) => setNewClientAddress(e.target.value)}
                      /> */}
                      <button
                        type="button"
                        className="logistics-page__btn logistics-page__btn--secondary"
                        onClick={handleAddClient}
                      >
                        Сохранить клиента
                      </button>
                    </div>
                  </div>
                )}

                {/* Название машины */}
                <div className="logistics-page__field">
                  <label className="logistics-page__label">
                    Название машины
                  </label>
                  <input
                    className="logistics-page__input"
                    placeholder="Например: MAN TGX, гос. номер…"
                    value={form.carName}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, carName: e.target.value }))
                    }
                  />
                </div>

                {/* Время */}
                {/* <div className="logistics-page__field">
                  <label className="logistics-page__label">Время</label>
                  <input
                    type="datetime-local"
                    className="logistics-page__input"
                    value={form.time}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, time: e.target.value }))
                    }
                  />
                </div> */}

                {/* Дата прибытия */}
                <div className="logistics-page__field">
                  <label className="logistics-page__label">Дата прибытия</label>
                  <input
                    type="date"
                    className="logistics-page__input"
                    value={form.arrivalDate}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, arrivalDate: e.target.value }))
                    }
                  />
                </div>

                {/* Цена машины */}
                <div className="logistics-page__field">
                  <label className="logistics-page__label">Цена машины</label>
                  <input
                    className="logistics-page__input"
                    placeholder="Сумма за машину"
                    value={form.carPrice}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, carPrice: e.target.value }))
                    }
                  />
                </div>

                {/* Стоимость услуги */}
                <div className="logistics-page__field">
                  <label className="logistics-page__label">
                    Стоимость услуги
                  </label>
                  <input
                    className="logistics-page__input"
                    placeholder="Логистическая услуга"
                    value={form.servicePrice}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, servicePrice: e.target.value }))
                    }
                  />
                </div>

                {/* Статус */}
                <div className="logistics-page__field">
                  <label className="logistics-page__label">Статус</label>
                  <select
                    className="logistics-page__input"
                    value={form.status}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, status: e.target.value }))
                    }
                  >
                    {statusOptions.map((s) => (
                      <option key={s.value} value={s.value}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Описание */}
                <div className="logistics-page__field logistics-page__field--full">
                  <label className="logistics-page__label">Описание</label>
                  <textarea
                    className="logistics-page__input logistics-page__input--textarea"
                    rows={3}
                    placeholder="Дополнительная информация по рейсу, условия, контакты…"
                    value={form.description}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, description: e.target.value }))
                    }
                  />
                </div>
              </div>

              <div className="logistics-page__form-actions">
                <button
                  type="button"
                  className="logistics-page__btn logistics-page__btn--ghost"
                  onClick={() => setShowForm(false)}
                >
                  Отменить
                </button>
                <button
                  type="submit"
                  className="logistics-page__btn logistics-page__btn--primary"
                >
                  Сохранить заявку
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Модалка подробного просмотра */}
      {viewOrder && (
        <div className="logistics-page__modal-overlay" onClick={closeView}>
          <div
            className="logistics-page__modal logistics-page__modal--view"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="logistics-page__form logistics-page__timeline-card">
              <div className="logistics-page__timeline-header">
                <div className="logistics-page__timeline-icon">
                  <FaMapMarkerAlt />
                </div>
                <div>
                  <div className="logistics-page__timeline-title">
                    Отслеживание маршрута
                  </div>
                  <div className="logistics-page__timeline-subtitle">
                    {getClientName(viewOrder.clientId)}
                  </div>
                </div>
              </div>

              <div className="logistics-page__timeline">
                {[
                  {
                    key: "decorated",
                    title: "Отправка автомобиля",
                    subtitle:
                      viewOrder.carName || "Машина подготовлена к отправке",
                    date: formatDate(viewOrder.updated_at),
                  },
                  {
                    key: "transit",
                    title: "В пути",
                    subtitle: "Транспортировка груза",
                    date: formatDate(viewOrder.updated_at),
                  },
                  {
                    key: "completed",
                    title: "Прибытие",
                    subtitle: "Прибытие в пункт назначения",
                    date: formatDate(viewOrder.updated_at),
                  },
                ].map((step, index, arr) => {
                  const statusStep = getStatusStep(viewOrder.status);
                  const isDone = index + 1 < statusStep;
                  const isCurrent = index + 1 === statusStep;
                  const isLast = index === arr.length - 1;
                  return (
                    <div
                      key={step.key}
                      className={`logistics-page__timeline-step${
                        isCurrent
                          ? " logistics-page__timeline-step--current"
                          : ""
                      }${isDone ? " logistics-page__timeline-step--done" : ""}`}
                    >
                      <div className="logistics-page__timeline-axis">
                        <div className="logistics-page__timeline-dot">
                          {(isDone || isCurrent) && <FaCheck />}
                        </div>
                        {!isLast && (
                          <div className="logistics-page__timeline-line" />
                        )}
                      </div>
                      <div className="logistics-page__timeline-content">
                        <div className="logistics-page__timeline-row">
                          <div className="logistics-page__timeline-step-title">
                            {step.title}
                          </div>
                          {isCurrent && (
                            <span className="logistics-page__timeline-badge">
                              В процессе
                            </span>
                          )}
                        </div>
                        <div className="logistics-page__timeline-step-subtitle">
                          {step.subtitle}
                        </div>
                        <div className="logistics-page__timeline-date">
                          <FaClock />
                          <span>{step.date}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="logistics-page__timeline-progress">
                <div className="logistics-page__timeline-progress-header">
                  <span>Прогресс доставки</span>
                  <span>{getProgressPercent(viewOrder.status)}%</span>
                </div>
                <div className="logistics-page__timeline-progress-bar">
                  <div
                    className="logistics-page__timeline-progress-bar-fill"
                    style={{
                      width: `${getProgressPercent(viewOrder.status)}%`,
                    }}
                  />
                </div>
              </div>

              <div className="logistics-page__timeline-eta">
                <div className="logistics-page__timeline-eta-label">
                  <FaClock />
                  <span>Ожидаемое прибытие:</span>
                </div>
                <div className="logistics-page__timeline-eta-date">
                  {formatDate(viewOrder.arrivalDate || viewOrder.time)}
                </div>
              </div>

              {viewOrder.description && (
                <div className="logistics-page__timeline-description">
                  {viewOrder.description}
                </div>
              )}

              <div className="logistics-page__form-actions">
                <button
                  type="button"
                  className="logistics-page__btn logistics-page__btn--ghost"
                  onClick={closeView}
                >
                  Закрыть
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LogisticsPage;
