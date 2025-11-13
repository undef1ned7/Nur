import React, { useEffect, useMemo, useState } from "react";
import {
  FaSearch,
  FaPlus,
  FaTimes,
  FaTools,
  FaEdit,
  FaTrash,
  FaClipboardList,
  FaCheckCircle,
  FaBoxes,
} from "react-icons/fa";
import api from "../../../../api";
import "./CafeInventory.scss";

/* helpers */
const listFrom = (res) => res?.data?.results || res?.data || [];
const toNum = (x) => {
  if (x === null || x === undefined) return 0;
  const n = Number(String(x).replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};
const numStr = (n) => String(Number(n) || 0).replace(",", ".");
const fmtMoney = (n) =>
  new Intl.NumberFormat("ru-RU", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(toNum(n));

const formatDate = (dateStr) => {
  if (!dateStr) return "";
  try {
    const d = new Date(dateStr);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  } catch {
    return dateStr;
  }
};

const CafeInventory = () => {
  const [activeTab, setActiveTab] = useState("equipment"); // "equipment", "sessions" или "stock-check"
  const [equipment, setEquipment] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [warehouseItems, setWarehouseItems] = useState([]);
  const [stockCheckSessions, setStockCheckSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");

  // модалка оборудования
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({
    title: "",
    serial_number: "",
    category: "",
    purchase_date: "",
    price: "",
    condition: "good",
    is_active: true,
    notes: "",
  });

  // модалка акта инвентаризации
  const [sessionModalOpen, setSessionModalOpen] = useState(false);
  const [sessionForm, setSessionForm] = useState({
    comment: "",
    items: [], // [{equipment: id, is_present: bool, condition: string, notes: string}]
  });
  const [selectedEquipment, setSelectedEquipment] = useState(null);

  // модалка просмотра акта
  const [viewSessionModalOpen, setViewSessionModalOpen] = useState(false);
  const [viewingSession, setViewingSession] = useState(null);

  // модалка сверки продуктов
  const [stockCheckModalOpen, setStockCheckModalOpen] = useState(false);
  const [stockCheckForm, setStockCheckForm] = useState({
    comment: "",
    items: [], // [{product: id, qty_counted: number}]
  });
  const [selectedProduct, setSelectedProduct] = useState(null);

  // модалка просмотра акта сверки продуктов
  const [viewStockCheckModalOpen, setViewStockCheckModalOpen] = useState(false);
  const [viewingStockCheck, setViewingStockCheck] = useState(null);

  useEffect(() => {
    fetchAll();
  }, []);

  const fetchAll = async () => {
    try {
      setLoading(true);
      const [equipmentRes, sessionsRes, warehouseRes, stockCheckRes] =
        await Promise.all([
          api.get("/cafe/equipment/"),
          api
            .get("/cafe/equipment/inventory/sessions/")
            .catch(() => ({ data: [] })),
          api.get("/cafe/warehouse/").catch(() => ({ data: [] })),
          api.get("/cafe/inventory/sessions/").catch(() => ({ data: [] })),
        ]);
      setEquipment(listFrom(equipmentRes));
      setSessions(listFrom(sessionsRes));
      setWarehouseItems(listFrom(warehouseRes));
      setStockCheckSessions(listFrom(stockCheckRes));
    } catch (err) {
      console.error("Ошибка загрузки:", err);
    } finally {
      setLoading(false);
    }
  };

  const filteredEquipment = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return equipment;
    return equipment.filter(
      (e) =>
        (e.title || "").toLowerCase().includes(q) ||
        (e.serial_number || "").toLowerCase().includes(q) ||
        (e.category || "").toLowerCase().includes(q) ||
        (e.condition || "").toLowerCase().includes(q)
    );
  }, [equipment, query]);

  const filteredSessions = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return sessions;
    return sessions.filter(
      (s) =>
        (s.comment || "").toLowerCase().includes(q) ||
        (s.id || "").toLowerCase().includes(q)
    );
  }, [sessions, query]);

  const filteredStockCheckSessions = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return stockCheckSessions;
    return stockCheckSessions.filter(
      (s) =>
        (s.comment || "").toLowerCase().includes(q) ||
        (s.id || "").toLowerCase().includes(q)
    );
  }, [stockCheckSessions, query]);

  const getConditionLabel = (condition) => {
    const labels = {
      good: "Исправно",
      repair: "На ремонте",
      broken: "Списано",
    };
    return labels[condition] || condition;
  };

  const getConditionColor = (condition) => {
    const colors = {
      good: "success",
      repair: "warning",
      broken: "danger",
    };
    return colors[condition] || "muted";
  };

  const openCreate = () => {
    setEditingId(null);
    setForm({
      title: "",
      serial_number: "",
      category: "",
      purchase_date: "",
      price: "",
      condition: "good",
      is_active: true,
      notes: "",
    });
    setModalOpen(true);
  };

  const openEdit = (item) => {
    setEditingId(item.id);
    setForm({
      title: item.title || "",
      serial_number: item.serial_number || "",
      category: item.category || "",
      purchase_date: formatDate(item.purchase_date) || "",
      price: item.price || "",
      condition: item.condition || "good",
      is_active: item.is_active !== false,
      notes: item.notes || "",
    });
    setModalOpen(true);
  };

  const saveEquipment = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) return;

    const payload = {
      title: form.title.trim(),
      serial_number: form.serial_number.trim() || null,
      category: form.category.trim() || null,
      purchase_date: form.purchase_date || null,
      price: form.price ? numStr(form.price) : null,
      condition: form.condition,
      is_active: form.is_active,
      notes: form.notes.trim() || "",
    };

    try {
      if (editingId == null) {
        const res = await api.post("/cafe/equipment/", payload);
        setEquipment((prev) => [...prev, res.data]);
      } else {
        const res = await api.patch(`/cafe/equipment/${editingId}/`, payload);
        setEquipment((prev) =>
          prev.map((e) => (e.id === editingId ? res.data : e))
        );
      }
      setModalOpen(false);
    } catch (err) {
      console.error("Ошибка сохранения оборудования:", err);
      const errorMsg =
        err?.response?.data?.detail ||
        err?.response?.data?.message ||
        "Ошибка при сохранении";
      alert(errorMsg);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Удалить оборудование?")) return;
    try {
      await api.delete(`/cafe/equipment/${id}/`);
      setEquipment((prev) => prev.filter((e) => e.id !== id));
    } catch (err) {
      console.error("Ошибка удаления:", err);
      alert("Не удалось удалить оборудование");
    }
  };

  const openCreateSession = () => {
    setSessionForm({
      comment: "",
      items: [],
    });
    setSelectedEquipment(null);
    setSessionModalOpen(true);
  };

  const addItemToSession = () => {
    if (!selectedEquipment) return;
    const exists = sessionForm.items.some(
      (i) => i.equipment === selectedEquipment.id
    );
    if (exists) {
      alert("Это оборудование уже добавлено в акт");
      return;
    }
    setSessionForm((prev) => ({
      ...prev,
      items: [
        ...prev.items,
        {
          equipment: selectedEquipment.id,
          is_present: true,
          condition: selectedEquipment.condition || "good",
          notes: "",
        },
      ],
    }));
    setSelectedEquipment(null);
  };

  const removeItemFromSession = (equipmentId) => {
    setSessionForm((prev) => ({
      ...prev,
      items: prev.items.filter((i) => i.equipment !== equipmentId),
    }));
  };

  const updateSessionItem = (equipmentId, field, value) => {
    setSessionForm((prev) => ({
      ...prev,
      items: prev.items.map((i) =>
        i.equipment === equipmentId ? { ...i, [field]: value } : i
      ),
    }));
  };

  const saveSession = async (e) => {
    e.preventDefault();

    if (sessionForm.items.length === 0) {
      alert("Добавьте хотя бы одно оборудование в акт");
      return;
    }

    try {
      const res = await api.post("/cafe/equipment/inventory/sessions/", {
        comment: sessionForm.comment.trim() || "",
        items: sessionForm.items,
      });
      setSessions((prev) => [res.data, ...prev]);
      setSessionModalOpen(false);
      fetchAll(); // Обновляем список оборудования
    } catch (err) {
      console.error("Ошибка создания акта:", err);
      const errorMsg =
        err?.response?.data?.detail ||
        err?.response?.data?.message ||
        "Ошибка при создании акта";
      alert(errorMsg);
    }
  };

  const viewSession = async (sessionId) => {
    try {
      const res = await api.get(
        `/cafe/equipment/inventory/sessions/${sessionId}/`
      );
      setViewingSession(res.data);
      setViewSessionModalOpen(true);
    } catch (err) {
      console.error("Ошибка загрузки акта:", err);
      alert("Не удалось загрузить акт");
    }
  };

  const confirmSession = async (sessionId) => {
    if (
      !window.confirm(
        "Подтвердить акт инвентаризации? Это обновит состояние оборудования."
      )
    )
      return;

    try {
      await api.post(
        `/cafe/equipment/inventory/sessions/${sessionId}/confirm/`
      );
      await fetchAll(); // Обновляем все данные
      setViewSessionModalOpen(false);
      alert("Акт подтвержден, состояние оборудования обновлено");
    } catch (err) {
      console.error("Ошибка подтверждения акта:", err);
      const errorMsg =
        err?.response?.data?.detail ||
        err?.response?.data?.message ||
        "Ошибка при подтверждении акта";
      alert(errorMsg);
    }
  };

  const getEquipmentById = (id) => {
    return equipment.find((e) => e.id === id);
  };

  // Функции для сверки продуктов
  const openCreateStockCheck = () => {
    setStockCheckForm({
      comment: "",
      items: [],
    });
    setSelectedProduct(null);
    setStockCheckModalOpen(true);
  };

  const addProductToStockCheck = () => {
    if (!selectedProduct) return;
    const exists = stockCheckForm.items.some(
      (i) => i.product === selectedProduct.id
    );
    if (exists) {
      alert("Этот продукт уже добавлен в акт");
      return;
    }
    setStockCheckForm((prev) => ({
      ...prev,
      items: [
        ...prev.items,
        {
          product: selectedProduct.id,
          qty_counted: toNum(selectedProduct.remainder), // По умолчанию берем текущий остаток
        },
      ],
    }));
    setSelectedProduct(null);
  };

  const removeProductFromStockCheck = (productId) => {
    setStockCheckForm((prev) => ({
      ...prev,
      items: prev.items.filter((i) => i.product !== productId),
    }));
  };

  const updateStockCheckItem = (productId, field, value) => {
    setStockCheckForm((prev) => ({
      ...prev,
      items: prev.items.map((i) =>
        i.product === productId ? { ...i, [field]: value } : i
      ),
    }));
  };

  const saveStockCheck = async (e) => {
    e.preventDefault();
    if (stockCheckForm.items.length === 0) {
      alert("Добавьте хотя бы один продукт в акт");
      return;
    }

    try {
      const res = await api.post("/cafe/inventory/sessions/", {
        comment: stockCheckForm.comment.trim() || "",
        items: stockCheckForm.items.map((item) => {
          const prod = getProductById(item.product);
          const expectedQty = toNum(prod?.remainder || 0);
          return {
            product: item.product,
            expected_qty: numStr(expectedQty),
            actual_qty: numStr(item.qty_counted),
          };
        }),
      });
      setStockCheckSessions((prev) => [res.data, ...prev]);
      setStockCheckModalOpen(false);
      await fetchAll(); // Обновляем список продуктов
    } catch (err) {
      console.error("Ошибка создания акта сверки:", err);
      const errorMsg =
        err?.response?.data?.detail ||
        err?.response?.data?.message ||
        "Ошибка при создании акта";
      alert(errorMsg);
    }
  };

  const viewStockCheck = async (sessionId) => {
    try {
      const res = await api.get(`/cafe/inventory/sessions/${sessionId}/`);
      setViewingStockCheck(res.data);
      setViewStockCheckModalOpen(true);
    } catch (err) {
      console.error("Ошибка загрузки акта:", err);
      alert("Не удалось загрузить акт");
    }
  };

  const confirmStockCheck = async (sessionId) => {
    if (
      !window.confirm(
        "Подтвердить акт сверки? Это обновит остатки продуктов на складе."
      )
    )
      return;

    try {
      await api.post(`/cafe/inventory/sessions/${sessionId}/confirm/`);
      await fetchAll(); // Обновляем все данные
      setViewStockCheckModalOpen(false);
      alert("Акт подтвержден, остатки продуктов обновлены");
    } catch (err) {
      console.error("Ошибка подтверждения акта:", err);
      const errorMsg =
        err?.response?.data?.detail ||
        err?.response?.data?.message ||
        "Ошибка при подтверждении акта";
      alert(errorMsg);
    }
  };

  const getProductById = (id) => {
    return warehouseItems.find((p) => p.id === id);
  };

  return (
    <section className="inventory">
      <div className="inventory__header">
        <div>
          <h2 className="inventory__title">Инвентаризация</h2>
        </div>

        <div className="inventory__actions">
          <div className="inventory__search">
            <FaSearch className="inventory__search-icon" />
            <input
              className="inventory__search-input"
              placeholder={
                activeTab === "equipment"
                  ? "Поиск оборудования…"
                  : activeTab === "sessions"
                  ? "Поиск актов инвентаризации…"
                  : "Поиск актов сверки продуктов…"
              }
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>

          {activeTab === "equipment" ? (
            <button
              className="inventory__btn inventory__btn--primary"
              onClick={openCreate}
            >
              <FaPlus /> Новое оборудование
            </button>
          ) : activeTab === "sessions" ? (
            <button
              className="inventory__btn inventory__btn--primary"
              onClick={openCreateSession}
            >
              <FaPlus /> Новый акт
            </button>
          ) : (
            <button
              className="inventory__btn inventory__btn--primary"
              onClick={openCreateStockCheck}
            >
              <FaPlus /> Новая сверка
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="inventory__tabs">
        <button
          className={`inventory__tab ${
            activeTab === "equipment" ? "inventory__tab--active" : ""
          }`}
          onClick={() => setActiveTab("equipment")}
        >
          <FaTools /> Оборудование
        </button>
        <button
          className={`inventory__tab ${
            activeTab === "sessions" ? "inventory__tab--active" : ""
          }`}
          onClick={() => setActiveTab("sessions")}
        >
          <FaClipboardList /> Акты инвентаризации
        </button>
        <button
          className={`inventory__tab ${
            activeTab === "stock-check" ? "inventory__tab--active" : ""
          }`}
          onClick={() => setActiveTab("stock-check")}
        >
          <FaBoxes /> Сверка продуктов
        </button>
      </div>

      {/* List */}
      <div className="inventory__list">
        {loading && <div className="inventory__alert">Загрузка…</div>}

        {activeTab === "equipment" && (
          <>
            {!loading &&
              filteredEquipment.map((item) => (
                <article key={item.id} className="inventory__card">
                  <div className="inventory__card-left">
                    <div className="inventory__avatar">
                      <FaTools />
                    </div>
                    <div>
                      <h3 className="inventory__name">{item.title}</h3>
                      <div className="inventory__meta">
                        {item.serial_number && (
                          <span className="inventory__muted">
                            Серийный: {item.serial_number}
                          </span>
                        )}
                        {item.category && (
                          <span className="inventory__muted">
                            Категория: {item.category}
                          </span>
                        )}
                        {item.purchase_date && (
                          <span className="inventory__muted">
                            Покупка: {formatDate(item.purchase_date)}
                          </span>
                        )}
                        {item.price && (
                          <span className="inventory__muted">
                            Цена: {fmtMoney(item.price)} сом
                          </span>
                        )}
                        <span
                          className={`inventory__status inventory__status--${getConditionColor(
                            item.condition
                          )}`}
                        >
                          {getConditionLabel(item.condition)}
                        </span>
                        <span
                          className={`inventory__status ${
                            item.is_active
                              ? "inventory__status--active"
                              : "inventory__status--inactive"
                          }`}
                        >
                          {item.is_active ? "Активно" : "Неактивно"}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="inventory__rowActions">
                    <button
                      className="inventory__btn inventory__btn--secondary"
                      onClick={() => openEdit(item)}
                    >
                      <FaEdit /> Изменить
                    </button>
                    <button
                      className="inventory__btn inventory__btn--danger"
                      onClick={() => handleDelete(item.id)}
                    >
                      <FaTrash /> Удалить
                    </button>
                  </div>
                </article>
              ))}
            {!loading && !filteredEquipment.length && (
              <div className="inventory__alert">
                {query ? `Ничего не найдено по «${query}»` : "Нет оборудования"}
              </div>
            )}
          </>
        )}

        {activeTab === "sessions" && (
          <>
            {!loading &&
              filteredSessions.map((session) => (
                <article key={session.id} className="inventory__card">
                  <div className="inventory__card-left">
                    <div className="inventory__avatar">
                      <FaClipboardList />
                    </div>
                    <div>
                      <h3 className="inventory__name">
                        {session.comment || "Акт инвентаризации"}
                      </h3>
                      <div className="inventory__meta">
                        <span className="inventory__muted">
                          Создан:{" "}
                          {new Date(session.created_at).toLocaleString("ru-RU")}
                        </span>
                        {session.confirmed_at && (
                          <span className="inventory__muted">
                            Подтвержден:{" "}
                            {new Date(session.confirmed_at).toLocaleString(
                              "ru-RU"
                            )}
                          </span>
                        )}
                        <span className="inventory__muted">
                          Позиций: {session.items?.length || 0}
                        </span>
                        <span
                          className={`inventory__status ${
                            session.is_confirmed
                              ? "inventory__status--confirmed"
                              : "inventory__status--pending"
                          }`}
                        >
                          {session.is_confirmed ? "Подтвержден" : "Ожидает"}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="inventory__rowActions">
                    <button
                      className="inventory__btn inventory__btn--secondary"
                      onClick={() => viewSession(session.id)}
                    >
                      Просмотр
                    </button>
                    {!session.is_confirmed && (
                      <button
                        className="inventory__btn inventory__btn--success"
                        onClick={() => confirmSession(session.id)}
                      >
                        <FaCheckCircle /> Подтвердить
                      </button>
                    )}
                  </div>
                </article>
              ))}
            {!loading && !filteredSessions.length && (
              <div className="inventory__alert">
                {query ? `Ничего не найдено по «${query}»` : "Нет актов"}
              </div>
            )}
          </>
        )}

        {activeTab === "stock-check" && (
          <>
            {!loading &&
              filteredStockCheckSessions.map((session) => (
                <article key={session.id} className="inventory__card">
                  <div className="inventory__card-left">
                    <div className="inventory__avatar">
                      <FaBoxes />
                    </div>
                    <div>
                      <h3 className="inventory__name">
                        {session.comment || "Акт сверки продуктов"}
                      </h3>
                      <div className="inventory__meta">
                        <span className="inventory__muted">
                          Создан:{" "}
                          {new Date(session.created_at).toLocaleString("ru-RU")}
                        </span>
                        {session.confirmed_at && (
                          <span className="inventory__muted">
                            Подтвержден:{" "}
                            {new Date(session.confirmed_at).toLocaleString(
                              "ru-RU"
                            )}
                          </span>
                        )}
                        <span className="inventory__muted">
                          Позиций: {session.items?.length || 0}
                        </span>
                        <span
                          className={`inventory__status ${
                            session.is_confirmed
                              ? "inventory__status--confirmed"
                              : "inventory__status--pending"
                          }`}
                        >
                          {session.is_confirmed ? "Подтвержден" : "Ожидает"}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="inventory__rowActions">
                    <button
                      className="inventory__btn inventory__btn--secondary"
                      onClick={() => viewStockCheck(session.id)}
                    >
                      Просмотр
                    </button>
                    {!session.is_confirmed && (
                      <button
                        className="inventory__btn inventory__btn--success"
                        onClick={() => confirmStockCheck(session.id)}
                      >
                        <FaCheckCircle /> Подтвердить
                      </button>
                    )}
                  </div>
                </article>
              ))}
            {!loading && !filteredStockCheckSessions.length && (
              <div className="inventory__alert">
                {query
                  ? `Ничего не найдено по «${query}»`
                  : "Нет актов сверки продуктов"}
              </div>
            )}
          </>
        )}
      </div>

      {/* Модалка оборудования */}
      {modalOpen && (
        <div
          className="inventory__modal-overlay"
          onClick={() => setModalOpen(false)}
        >
          <div
            className="inventory__modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="inventory__modal-header">
              <h3 className="inventory__modal-title">
                {editingId == null
                  ? "Новое оборудование"
                  : "Изменить оборудование"}
              </h3>
              <button
                className="inventory__icon-btn"
                onClick={() => setModalOpen(false)}
              >
                <FaTimes />
              </button>
            </div>
            <form className="inventory__form" onSubmit={saveEquipment}>
              <div className="inventory__form-grid">
                <div className="inventory__field inventory__field--full">
                  <label className="inventory__label">Название *</label>
                  <input
                    className="inventory__input"
                    value={form.title}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, title: e.target.value }))
                    }
                    required
                    maxLength={255}
                  />
                </div>

                <div className="inventory__field">
                  <label className="inventory__label">Серийный номер</label>
                  <input
                    className="inventory__input"
                    value={form.serial_number}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, serial_number: e.target.value }))
                    }
                    maxLength={255}
                  />
                </div>

                <div className="inventory__field">
                  <label className="inventory__label">Категория</label>
                  <input
                    className="inventory__input"
                    value={form.category}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, category: e.target.value }))
                    }
                    maxLength={255}
                  />
                </div>

                <div className="inventory__field">
                  <label className="inventory__label">Дата покупки</label>
                  <input
                    type="date"
                    className="inventory__input"
                    value={form.purchase_date}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, purchase_date: e.target.value }))
                    }
                  />
                </div>

                <div className="inventory__field">
                  <label className="inventory__label">Цена (сом)</label>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    className="inventory__input"
                    value={form.price}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, price: e.target.value }))
                    }
                  />
                </div>

                <div className="inventory__field">
                  <label className="inventory__label">Состояние</label>
                  <select
                    className="inventory__input"
                    value={form.condition}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, condition: e.target.value }))
                    }
                  >
                    <option value="good">Исправно</option>
                    <option value="repair">На ремонте</option>
                    <option value="broken">Списано</option>
                  </select>
                </div>

                <div className="inventory__field">
                  <label className="inventory__label">Активно</label>
                  <select
                    className="inventory__input"
                    value={form.is_active ? "true" : "false"}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        is_active: e.target.value === "true",
                      }))
                    }
                  >
                    <option value="true">Да</option>
                    <option value="false">Нет</option>
                  </select>
                </div>

                <div className="inventory__field inventory__field--full">
                  <label className="inventory__label">Примечания</label>
                  <textarea
                    className="inventory__textarea"
                    value={form.notes}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, notes: e.target.value }))
                    }
                    rows={3}
                  />
                </div>
              </div>

              <div className="inventory__form-actions">
                <button
                  type="button"
                  className="inventory__btn inventory__btn--secondary"
                  onClick={() => setModalOpen(false)}
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  className="inventory__btn inventory__btn--primary"
                >
                  Сохранить
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Модалка создания акта */}
      {sessionModalOpen && (
        <div
          className="inventory__modal-overlay"
          onClick={() => setSessionModalOpen(false)}
        >
          <div
            className="inventory__modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="inventory__modal-header">
              <h3 className="inventory__modal-title">
                Новый акт инвентаризации
              </h3>
              <button
                className="inventory__icon-btn"
                onClick={() => setSessionModalOpen(false)}
              >
                <FaTimes />
              </button>
            </div>
            <form className="inventory__form" onSubmit={saveSession}>
              <div className="inventory__form-grid">
                <div className="inventory__field inventory__field--full">
                  <label className="inventory__label">
                    Комментарий (необязательно)
                  </label>
                  <input
                    className="inventory__input"
                    value={sessionForm.comment}
                    onChange={(e) =>
                      setSessionForm((f) => ({
                        ...f,
                        comment: e.target.value,
                      }))
                    }
                    placeholder="Например: Плановая проверка кухни (необязательно)"
                  />
                </div>

                <div className="inventory__field inventory__field--full">
                  <label className="inventory__label">
                    Добавить оборудование
                  </label>
                  <div style={{ display: "flex", gap: "8px" }}>
                    <select
                      className="inventory__input"
                      value={selectedEquipment?.id || ""}
                      onChange={(e) => {
                        const eq = equipment.find(
                          (eq) => eq.id === e.target.value
                        );
                        setSelectedEquipment(eq || null);
                      }}
                    >
                      <option value="">— Выберите оборудование —</option>
                      {equipment
                        .filter(
                          (eq) =>
                            !sessionForm.items.some(
                              (i) => i.equipment === eq.id
                            )
                        )
                        .map((eq) => (
                          <option key={eq.id} value={eq.id}>
                            {eq.title}{" "}
                            {eq.serial_number ? `(${eq.serial_number})` : ""}
                          </option>
                        ))}
                    </select>
                    <button
                      type="button"
                      className="inventory__btn inventory__btn--secondary"
                      onClick={addItemToSession}
                      disabled={!selectedEquipment}
                    >
                      <FaPlus /> Добавить
                    </button>
                  </div>
                </div>

                {sessionForm.items.length > 0 && (
                  <div className="inventory__field inventory__field--full">
                    <label className="inventory__label">
                      Оборудование в акте ({sessionForm.items.length})
                    </label>
                    <div className="inventory__session-items">
                      {sessionForm.items.map((item, idx) => {
                        const eq = getEquipmentById(item.equipment);
                        return (
                          <div key={idx} className="inventory__session-item">
                            <div style={{ flex: 1 }}>
                              <strong>{eq?.title || "Неизвестно"}</strong>
                              {eq?.serial_number && (
                                <div style={{ fontSize: 12, color: "#6b7280" }}>
                                  {eq.serial_number}
                                </div>
                              )}
                            </div>
                            <div
                              style={{
                                display: "flex",
                                gap: "8px",
                                flexWrap: "wrap",
                                alignItems: "center",
                              }}
                            >
                              <label style={{ fontSize: 12 }}>
                                <input
                                  type="checkbox"
                                  checked={item.is_present}
                                  onChange={(e) =>
                                    updateSessionItem(
                                      item.equipment,
                                      "is_present",
                                      e.target.checked
                                    )
                                  }
                                />{" "}
                                На месте
                              </label>
                              <select
                                style={{ fontSize: 12, padding: "4px 8px" }}
                                value={item.condition}
                                onChange={(e) =>
                                  updateSessionItem(
                                    item.equipment,
                                    "condition",
                                    e.target.value
                                  )
                                }
                              >
                                <option value="good">Исправно</option>
                                <option value="repair">На ремонте</option>
                                <option value="broken">Списано</option>
                              </select>
                              <input
                                type="text"
                                placeholder="Примечания"
                                style={{
                                  fontSize: 12,
                                  padding: "4px 8px",
                                  minWidth: "120px",
                                }}
                                value={item.notes || ""}
                                onChange={(e) =>
                                  updateSessionItem(
                                    item.equipment,
                                    "notes",
                                    e.target.value
                                  )
                                }
                              />
                              <button
                                type="button"
                                className="inventory__icon-btn"
                                style={{ width: "24px", height: "24px" }}
                                onClick={() =>
                                  removeItemFromSession(item.equipment)
                                }
                              >
                                <FaTimes />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              <div className="inventory__form-actions">
                <button
                  type="button"
                  className="inventory__btn inventory__btn--secondary"
                  onClick={() => setSessionModalOpen(false)}
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  className="inventory__btn inventory__btn--primary"
                  disabled={sessionForm.items.length === 0}
                >
                  Создать акт
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Модалка просмотра акта */}
      {viewSessionModalOpen && viewingSession && (
        <div
          className="inventory__modal-overlay"
          onClick={() => setViewSessionModalOpen(false)}
        >
          <div
            className="inventory__modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="inventory__modal-header">
              <h3 className="inventory__modal-title">
                Акт: {viewingSession.comment || "Инвентаризация"}
              </h3>
              <button
                className="inventory__icon-btn"
                onClick={() => setViewSessionModalOpen(false)}
              >
                <FaTimes />
              </button>
            </div>
            <div className="inventory__form">
              <div className="inventory__session-details">
                <div className="inventory__session-info">
                  <div>
                    <strong>Создан:</strong>{" "}
                    {new Date(viewingSession.created_at).toLocaleString(
                      "ru-RU"
                    )}
                  </div>
                  {viewingSession.confirmed_at && (
                    <div>
                      <strong>Подтвержден:</strong>{" "}
                      {new Date(viewingSession.confirmed_at).toLocaleString(
                        "ru-RU"
                      )}
                    </div>
                  )}
                  <div>
                    <strong>Статус:</strong>{" "}
                    {viewingSession.is_confirmed ? "Подтвержден" : "Ожидает"}
                  </div>
                </div>

                <div className="inventory__session-items-list">
                  <h4>Оборудование ({viewingSession.items?.length || 0}):</h4>
                  {viewingSession.items?.map((item, idx) => (
                    <div key={idx} className="inventory__session-item-view">
                      <div>
                        <strong>{item.equipment_title || "Неизвестно"}</strong>
                        {item.serial_number && (
                          <div style={{ fontSize: 12, color: "#6b7280" }}>
                            {item.serial_number}
                          </div>
                        )}
                      </div>
                      <div
                        style={{
                          display: "flex",
                          gap: "12px",
                          flexWrap: "wrap",
                        }}
                      >
                        <span
                          className={`inventory__status inventory__status--${
                            item.is_present ? "success" : "danger"
                          }`}
                        >
                          {item.is_present ? "На месте" : "Отсутствует"}
                        </span>
                        <span
                          className={`inventory__status inventory__status--${getConditionColor(
                            item.condition
                          )}`}
                        >
                          {getConditionLabel(item.condition)}
                        </span>
                        {item.notes && (
                          <span style={{ fontSize: 12, color: "#6b7280" }}>
                            {item.notes}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {!viewingSession.is_confirmed && (
                  <div className="inventory__form-actions">
                    <button
                      type="button"
                      className="inventory__btn inventory__btn--secondary"
                      onClick={() => setViewSessionModalOpen(false)}
                    >
                      Закрыть
                    </button>
                    <button
                      type="button"
                      className="inventory__btn inventory__btn--success"
                      onClick={() => confirmSession(viewingSession.id)}
                    >
                      <FaCheckCircle /> Подтвердить акт
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Модалка создания акта сверки продуктов */}
      {stockCheckModalOpen && (
        <div
          className="inventory__modal-overlay"
          onClick={() => setStockCheckModalOpen(false)}
        >
          <div
            className="inventory__modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="inventory__modal-header">
              <h3 className="inventory__modal-title">
                Новый акт сверки продуктов
              </h3>
              <button
                className="inventory__icon-btn"
                onClick={() => setStockCheckModalOpen(false)}
              >
                <FaTimes />
              </button>
            </div>
            <form className="inventory__form" onSubmit={saveStockCheck}>
              <div className="inventory__form-grid">
                <div className="inventory__field inventory__field--full">
                  <label className="inventory__label">Комментарий</label>
                  <input
                    className="inventory__input"
                    value={stockCheckForm.comment}
                    onChange={(e) =>
                      setStockCheckForm((f) => ({
                        ...f,
                        comment: e.target.value,
                      }))
                    }
                    placeholder="Например: Ночная инвентаризация бара (необязательно)"
                  />
                </div>

                <div className="inventory__field inventory__field--full">
                  <label className="inventory__label">Добавить продукт</label>
                  <div style={{ display: "flex", gap: "8px" }}>
                    <select
                      className="inventory__input"
                      value={selectedProduct?.id || ""}
                      onChange={(e) => {
                        const prod = warehouseItems.find(
                          (p) => p.id === e.target.value
                        );
                        setSelectedProduct(prod || null);
                      }}
                    >
                      <option value="">— Выберите продукт —</option>
                      {warehouseItems
                        .filter(
                          (p) =>
                            !stockCheckForm.items.some(
                              (i) => i.product === p.id
                            )
                        )
                        .map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.title} ({toNum(p.remainder)} {p.unit || "шт"})
                          </option>
                        ))}
                    </select>
                    <button
                      type="button"
                      className="inventory__btn inventory__btn--secondary"
                      onClick={addProductToStockCheck}
                      disabled={!selectedProduct}
                    >
                      <FaPlus /> Добавить
                    </button>
                  </div>
                </div>

                {stockCheckForm.items.length > 0 && (
                  <div className="inventory__field inventory__field--full">
                    <label className="inventory__label">
                      Продукты в акте ({stockCheckForm.items.length})
                    </label>
                    <div className="inventory__session-items">
                      {stockCheckForm.items.map((item, idx) => {
                        const prod = getProductById(item.product);
                        const qtyExpected = toNum(prod?.remainder || 0);
                        const qtyCounted = toNum(item.qty_counted);
                        const difference = qtyCounted - qtyExpected;
                        return (
                          <div key={idx} className="inventory__session-item">
                            <div style={{ flex: 1 }}>
                              <strong>{prod?.title || "Неизвестно"}</strong>
                              <div style={{ fontSize: 12, color: "#6b7280" }}>
                                Ожидается: {qtyExpected} {prod?.unit || "шт"}
                              </div>
                            </div>
                            <div
                              style={{
                                display: "flex",
                                gap: "8px",
                                flexWrap: "wrap",
                                alignItems: "center",
                              }}
                            >
                              <label style={{ fontSize: 12 }}>
                                Фактически:
                                <input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  style={{
                                    fontSize: 12,
                                    padding: "4px 8px",
                                    marginLeft: "4px",
                                    width: "80px",
                                  }}
                                  value={item.qty_counted}
                                  onChange={(e) =>
                                    updateStockCheckItem(
                                      item.product,
                                      "qty_counted",
                                      e.target.value
                                    )
                                  }
                                />
                                {prod?.unit || "шт"}
                              </label>
                              <span
                                style={{
                                  fontSize: 12,
                                  color:
                                    difference > 0
                                      ? "#10b981"
                                      : difference < 0
                                      ? "#ef4444"
                                      : "#6b7280",
                                  fontWeight: "bold",
                                }}
                              >
                                {difference > 0 ? "+" : ""}
                                {difference.toFixed(2)} {prod?.unit || "шт"}
                              </span>
                              <button
                                type="button"
                                className="inventory__icon-btn"
                                style={{ width: "24px", height: "24px" }}
                                onClick={() =>
                                  removeProductFromStockCheck(item.product)
                                }
                              >
                                <FaTimes />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              <div className="inventory__form-actions">
                <button
                  type="button"
                  className="inventory__btn inventory__btn--secondary"
                  onClick={() => setStockCheckModalOpen(false)}
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  className="inventory__btn inventory__btn--primary"
                  disabled={stockCheckForm.items.length === 0}
                >
                  Создать акт
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Модалка просмотра акта сверки продуктов */}
      {viewStockCheckModalOpen && viewingStockCheck && (
        <div
          className="inventory__modal-overlay"
          onClick={() => setViewStockCheckModalOpen(false)}
        >
          <div
            className="inventory__modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="inventory__modal-header">
              <h3 className="inventory__modal-title">
                Акт: {viewingStockCheck.comment || "Сверка продуктов"}
              </h3>
              <button
                className="inventory__icon-btn"
                onClick={() => setViewStockCheckModalOpen(false)}
              >
                <FaTimes />
              </button>
            </div>
            <div className="inventory__form">
              <div className="inventory__session-details">
                <div className="inventory__session-info">
                  <div>
                    <strong>Создан:</strong>{" "}
                    {new Date(viewingStockCheck.created_at).toLocaleString(
                      "ru-RU"
                    )}
                  </div>
                  {viewingStockCheck.confirmed_at && (
                    <div>
                      <strong>Подтвержден:</strong>{" "}
                      {new Date(viewingStockCheck.confirmed_at).toLocaleString(
                        "ru-RU"
                      )}
                    </div>
                  )}
                  <div>
                    <strong>Статус:</strong>{" "}
                    {viewingStockCheck.is_confirmed ? "Подтвержден" : "Ожидает"}
                  </div>
                </div>

                <div className="inventory__session-items-list">
                  <h4>Продукты ({viewingStockCheck.items?.length || 0}):</h4>
                  {viewingStockCheck.items?.map((item, idx) => {
                    const qtyExpected = toNum(item.qty_expected || 0);
                    const qtyCounted = toNum(item.qty_counted || 0);
                    const difference = toNum(item.difference || 0);
                    return (
                      <div key={idx} className="inventory__session-item-view">
                        <div>
                          <strong>{item.product_title || "Неизвестно"}</strong>
                          <div style={{ fontSize: 12, color: "#6b7280" }}>
                            Ед. измерения: {item.product_unit || "шт"}
                          </div>
                        </div>
                        <div
                          style={{
                            display: "flex",
                            gap: "12px",
                            flexWrap: "wrap",
                            alignItems: "center",
                          }}
                        >
                          <span style={{ fontSize: 12, color: "#6b7280" }}>
                            <strong>Ожидается:</strong> {qtyExpected}{" "}
                            {item.product_unit || "шт"}
                          </span>
                          <span style={{ fontSize: 12, color: "#6b7280" }}>
                            <strong>Фактически:</strong> {qtyCounted}{" "}
                            {item.product_unit || "шт"}
                          </span>
                          <span
                            style={{
                              fontSize: 12,
                              color:
                                difference > 0
                                  ? "#10b981"
                                  : difference < 0
                                  ? "#ef4444"
                                  : "#6b7280",
                              fontWeight: "bold",
                            }}
                          >
                            <strong>Разница:</strong>{" "}
                            {difference > 0 ? "+" : ""}
                            {difference.toFixed(2)} {item.product_unit || "шт"}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {!viewingStockCheck.is_confirmed && (
                  <div className="inventory__form-actions">
                    <button
                      type="button"
                      className="inventory__btn inventory__btn--secondary"
                      onClick={() => setViewStockCheckModalOpen(false)}
                    >
                      Закрыть
                    </button>
                    <button
                      type="button"
                      className="inventory__btn inventory__btn--success"
                      onClick={() => confirmStockCheck(viewingStockCheck.id)}
                    >
                      <FaCheckCircle /> Подтвердить акт
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};

export default CafeInventory;
