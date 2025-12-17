import React, { useState } from "react";
import { useDispatch } from "react-redux";
import { X, Search, User, Plus } from "lucide-react";
import {
  createClientAsync,
  fetchClientsAsync,
} from "../../../../../store/creators/clientCreators";
import "./CustomerModal.scss";

const CustomerModal = ({ onClose, onSelect, customers = [] }) => {
  const dispatch = useDispatch();
  const [searchTerm, setSearchTerm] = useState("");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");
  const [newClient, setNewClient] = useState({
    full_name: "",
    phone: "",
    email: "",
    date: new Date().toISOString().split("T")[0],
    type: "client",
  });

  const filteredCustomers = customers.filter(
    (customer) =>
      customer.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      customer.phone?.includes(searchTerm)
  );

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
      setCreateError("Введите имя клиента");
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
          type: "client",
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
          "Не удалось создать клиента"
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
          <h2 className="customer-modal__title">Список должников</h2>
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
                onClick={() => setShowCreateForm(true)}
              >
                <Plus size={18} />
                Создать клиента
              </button>
            </div>

            <div className="customer-modal__list">
              {filteredCustomers.length === 0 ? (
                <div className="customer-modal__empty">
                  Покупатели не найдены
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
                <h3>Новый клиент</h3>
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
                      type: "client",
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
                      type: "client",
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
