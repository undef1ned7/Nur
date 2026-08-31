import React, { useMemo, useState } from "react";
import { useDispatch } from "react-redux";
import { X, Search, User, Plus } from "lucide-react";
import {
  createClientAsync,
  fetchClientsAsync,
} from "../../../../../store/creators/clientCreators";
import "./CustomerModal.scss";

const CustomerModal = ({
  onClose,
  onSelect,
  customers = [],
  title,
  defaultTab = "client",
}) => {
  const dispatch = useDispatch();
  const [searchTerm, setSearchTerm] = useState("");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");
  const [activeTab, setActiveTab] = useState(
    defaultTab === "suppliers" ? "suppliers" : "client",
  );
  const [newClient, setNewClient] = useState({
    full_name: "",
    phone: "",
    email: "",
    date: new Date().toISOString().split("T")[0],
    type: defaultTab === "suppliers" ? "suppliers" : "client",
  });

  const normalizeCustomerType = (c) => {
    const t = String(c?.type || "client").toLowerCase();
    return t === "supplier" || t === "suppliers" ? "suppliers" : "client";
  };

  const searchTermNormalized = searchTerm.trim().toLowerCase();

  const { filteredClients, filteredSuppliers } = useMemo(() => {
    const applySearchFilter = (list) =>
      list.filter((customer) => {
        const fullName = String(customer?.full_name || customer?.name || "");
        const phone = String(customer?.phone || "");

        if (!searchTermNormalized) return true;

        return (
          fullName.toLowerCase().includes(searchTermNormalized) ||
          phone.includes(searchTermNormalized) ||
          phone.includes(searchTerm)
        );
      });

    const clients = customers.filter(
      (c) => normalizeCustomerType(c) === "client",
    );
    const suppliers = customers.filter(
      (c) => normalizeCustomerType(c) === "suppliers",
    );

    return {
      filteredClients: applySearchFilter(clients),
      filteredSuppliers: applySearchFilter(suppliers),
    };
  }, [customers, searchTerm, searchTermNormalized]);

  const filteredCustomers =
    activeTab === "suppliers" ? filteredSuppliers : filteredClients;

  const getInitials = (name) => {
    if (!name) return "?";
    const parts = name.split(" ");
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  const getDebtAmount = (customer) => {
    // Предполагаем, что долг хранится в customer.debt или customer.total_debt
    return customer.debt || customer.total_debt || 0;
  };

  const handleCreateClient = async () => {
    setCreateError("");

    // Валидация
    if (!newClient.full_name?.trim()) {
      setCreateError(
        activeTab === "suppliers"
          ? "Введите имя поставщика"
          : "Введите имя клиента",
      );
      return;
    }

    setCreating(true);
    try {
      const result = await dispatch(createClientAsync(newClient)).unwrap();

      if (result?.id) {
        // Обновляем список клиентов
        await dispatch(fetchClientsAsync());

        // Автоматически выбираем созданного клиента и закрываем модальное окно
        if (onSelect) {
          onSelect(result);
        }

        // Сбрасываем форму
        setNewClient({
          full_name: "",
          phone: "",
          email: "",
          date: new Date().toISOString().split("T")[0],
          type: activeTab,
        });
        setShowCreateForm(false);
        setCreateError("");

        // Закрываем модальное окно после создания клиента
        onClose();
      }
    } catch (error) {
      console.error("Error creating client:", error);
      setCreateError(
        error?.detail ||
          error?.message ||
          error?.full_name?.[0] ||
            (activeTab === "suppliers"
              ? "Не удалось создать поставщика"
              : "Не удалось создать клиента")
      );
    } finally {
      setCreating(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setNewClient((prev) => ({ ...prev, [name]: value }));
    if (createError) setCreateError("");
  };

  return (
    <div className="customer-modal-overlay" onClick={onClose}>
      <div className="customer-modal" onClick={(e) => e.stopPropagation()}>
        <div className="customer-modal__header">
          <h2 className="customer-modal__title">
            {title || "Список должников"}
          </h2>
          <button className="customer-modal__close" onClick={onClose}>
            <X size={24} />
          </button>
        </div>

        <div className="customer-modal__search">
          <Search size={18} />
          <input
            type="text"
            placeholder="Введите текст для поиска"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="customer-modal__search-input"
          />
        </div>

        {!showCreateForm ? (
          <>
            <div className="customer-modal__summary">
              <span>Найдено {filteredCustomers.length}</span>
              <span>
                Общий долг:{" "}
                {filteredCustomers
                  .reduce((sum, c) => sum + getDebtAmount(c), 0)
                  .toLocaleString("ru-RU", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}{" "}
                сом
              </span>
            </div>

            {/* Кнопка создания клиента */}
            <div className="customer-modal__create-section">
              <button
                className="customer-modal__create-btn"
                onClick={() => {
                  setNewClient((prev) => ({ ...prev, type: activeTab }));
                  setShowCreateForm(true);
                }}
              >
                <Plus size={18} />
                {activeTab === "suppliers"
                  ? "Создать поставщика"
                  : "Создать клиента"}
              </button>
            </div>

            <div className="customer-modal__list">
              <div
                className="customer-modal__tabs customer-modal__tabs--in-list"
                role="tablist"
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeTab === "client"}
                  className={`customer-modal__tab${
                    activeTab === "client"
                      ? " customer-modal__tab--active"
                      : ""
                  }`}
                  onClick={() => setActiveTab("client")}
                >
                  Клиенты
                  <span className="customer-modal__tab-count">
                    ({filteredClients.length})
                  </span>
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeTab === "suppliers"}
                  className={`customer-modal__tab${
                    activeTab === "suppliers"
                      ? " customer-modal__tab--active"
                      : ""
                  }`}
                  onClick={() => setActiveTab("suppliers")}
                >
                  Поставщики
                  <span className="customer-modal__tab-count">
                    ({filteredSuppliers.length})
                  </span>
                </button>
              </div>

              {filteredCustomers.length === 0 ? (
                <div className="customer-modal__empty">
                  {activeTab === "suppliers"
                    ? "Поставщики не найдены"
                    : "Покупатели не найдены"}
                </div>
              ) : (
                filteredCustomers.map((customer) => {
                  const debt = getDebtAmount(customer);
                  const hasDebt = debt > 0;
                  return (
                    <div
                      key={customer.id}
                      className="customer-modal__item"
                      onClick={() => {
                        onSelect(customer);
                        onClose();
                      }}
                    >
                      <div className="customer-modal__item-avatar">
                        {getInitials(customer.full_name || customer.name)}
                      </div>
                      <div className="customer-modal__item-info">
                        <div className="customer-modal__item-name">
                          {customer.full_name || customer.name || "Без имени"}
                        </div>
                        {hasDebt && (
                          <div className="customer-modal__item-debt">
                            {debt.toLocaleString("ru-RU", {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}{" "}
                            сом
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </>
        ) : (
          <div className="customer-modal__create-form-wrapper">
            <div className="customer-modal__create-form">
              <div className="customer-modal__create-form-header">
                <h3>
                  {activeTab === "suppliers"
                    ? "Новый поставщик"
                    : "Новый клиент"}
                </h3>
                <button
                  className="customer-modal__create-form-close"
                  onClick={() => {
                    setShowCreateForm(false);
                    setCreateError("");
                    setNewClient({
                      full_name: "",
                      phone: "",
                      email: "",
                      date: new Date().toISOString().split("T")[0],
                      type: activeTab,
                    });
                  }}
                  type="button"
                >
                  <X size={18} />
                </button>
              </div>

              {createError && (
                <div className="customer-modal__create-error">
                  {createError}
                </div>
              )}

              <div className="customer-modal__create-form-fields">
                <div className="customer-modal__create-form-field">
                  <label>ФИО *</label>
                  <input
                    type="text"
                    name="full_name"
                    value={newClient.full_name}
                    onChange={handleInputChange}
                    placeholder="Введите ФИО"
                    required
                  />
                </div>

                <div className="customer-modal__create-form-field">
                  <label>Телефон</label>
                  <input
                    type="text"
                    name="phone"
                    value={newClient.phone}
                    onChange={handleInputChange}
                    placeholder="Введите телефон"
                  />
                </div>

                <div className="customer-modal__create-form-field">
                  <label>Email</label>
                  <input
                    type="email"
                    name="email"
                    value={newClient.email}
                    onChange={handleInputChange}
                    placeholder="Введите email"
                  />
                </div>

                <div className="customer-modal__create-form-field">
                  <label>Дата</label>
                  <input
                    type="date"
                    name="date"
                    value={newClient.date}
                    onChange={handleInputChange}
                  />
                </div>
              </div>

              <div className="customer-modal__create-form-actions">
                <button
                  className="customer-modal__create-form-cancel"
                  onClick={() => {
                    setShowCreateForm(false);
                    setCreateError("");
                    setNewClient({
                      full_name: "",
                      phone: "",
                      email: "",
                      date: new Date().toISOString().split("T")[0],
                      type: activeTab,
                    });
                  }}
                  disabled={creating}
                >
                  Отмена
                </button>
                <button
                  className="customer-modal__create-form-submit"
                  onClick={handleCreateClient}
                  disabled={creating || !newClient.full_name?.trim()}
                >
                  {creating ? "Создание..." : "Создать"}
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="customer-modal__footer">
          <button className="customer-modal__close-btn" onClick={onClose}>
            ЗАКРЫТЬ [ESC]
          </button>
        </div>
      </div>
    </div>
  );
};

export default CustomerModal;
