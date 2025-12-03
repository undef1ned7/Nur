import React, { useState, useEffect } from "react";
import { useDispatch } from "react-redux";
import { X, Plus, Minus, ShoppingCart, User } from "lucide-react";
import {
  submitAgentCartById,
  updateAgentCartItemById,
  deleteAgentCartItemById,
  updateAgentCart,
  getAgentCartById,
} from "../../../../api/agentCarts";
import {
  fetchClientsAsync,
  createClientAsync,
} from "../../../../store/creators/clientCreators";
import { useClient } from "../../../../store/slices/ClientSlice";
import "./RequestCart.scss";

const CartItem = ({ item, onUpdateQuantity, onRemoveItem, editable }) => {
  const [quantity, setQuantity] = useState(
    Number(item.quantity ?? item.quantity_requested ?? 0)
  );

  useEffect(() => {
    const newQuantity = Number(item.quantity ?? item.quantity_requested ?? 0);
    setQuantity((prev) => {
      if (prev !== newQuantity) {
        return newQuantity;
      }
      return prev;
    });
  }, [item.quantity, item.quantity_requested, item.id]);

  const handleIncrement = (e) => {
    e.stopPropagation();
    if (!editable) return;
    const newQuantity = quantity + 1;
    setQuantity(newQuantity);
    onUpdateQuantity(item.id, newQuantity);
  };

  const handleDecrement = (e) => {
    e.stopPropagation();
    if (!editable || quantity <= 1) return;
    const newQuantity = quantity - 1;
    setQuantity(newQuantity);
    onUpdateQuantity(item.id, newQuantity);
  };

  const handleQuantityInputChange = (e) => {
    e.stopPropagation();
    const value = Number(e.target.value);
    if (!isNaN(value) && value >= 1) {
      setQuantity(value);
    }
  };

  const handleQuantityInputBlur = (e) => {
    e.stopPropagation();
    const value = Number(e.target.value);
    if (isNaN(value) || value < 1) {
      setQuantity(1);
      onUpdateQuantity(item.id, 1);
    } else {
      onUpdateQuantity(item.id, value);
    }
  };

  const handleRemove = (e) => {
    e.stopPropagation();
    if (window.confirm("Удалить товар из запроса?")) {
      onRemoveItem(item.id);
    }
  };

  return (
    <div className="cart-item">
      <div className="item-image">
        <img
          src={
            item?.images?.[0]?.image_url
              ? `https://app.nurcrm.kg/${item.images[0].image_url}`
              : item?.product_image_url || "https://via.placeholder.com/100x100"
          }
          alt={item.product_name || "Товар"}
        />
      </div>

      <div className="item-details">
        <h3 className="item-name">{item.product_name || "Без названия"}</h3>
        <div className="item-price">
          {Number(item.unit_price || item.price_snapshot || 0).toLocaleString()}{" "}
          сом
        </div>

        <div className="item-actions">
          <div className="quantity-controls">
            <button
              className="quantity-btn"
              onClick={handleDecrement}
              disabled={quantity <= 1 || !editable}
              type="button"
              title="Уменьшить количество"
            >
              <Minus size={16} />
            </button>
            <input
              type="number"
              min="1"
              value={quantity}
              onChange={handleQuantityInputChange}
              onBlur={handleQuantityInputBlur}
              onClick={(e) => e.stopPropagation()}
              className="quantity-input"
              disabled={!editable}
            />
            <button
              className="quantity-btn"
              onClick={handleIncrement}
              disabled={!editable}
              type="button"
              title="Увеличить количество"
            >
              <Plus size={16} />
            </button>
          </div>

          <button
            className="remove-btn"
            onClick={handleRemove}
            disabled={!editable}
            type="button"
            title="Удалить товар из запроса"
          >
            <X size={16} />
          </button>
        </div>

        <div className="item-info">
          <p className="total-qty">
            Количество:{" "}
            {Number(
              item.quantity_requested || item.quantity || 0
            ).toLocaleString()}{" "}
            шт.
          </p>
          <p className="total">
            Сумма:{" "}
            {Number(
              Number(item.price_snapshot || item.unit_price || 0) *
                Number(
                  item.quantity_requested ||
                    item.total_quantity ||
                    item.quantity ||
                    0
                )
            ).toLocaleString()}{" "}
            сом
          </p>
        </div>
      </div>
    </div>
  );
};

const RequestSummary = ({ items, onSubmit, submitting }) => {
  const { qty, amount } = (() => {
    if (!Array.isArray(items) || items.length === 0) {
      return { qty: 0, amount: 0 };
    }
    let q = 0;
    let a = 0;
    for (const it of items) {
      const price = Number(it?.price_snapshot || it?.unit_price || 0);
      const baseQty = Number(it?.quantity_requested || it?.quantity || 0);
      q += baseQty;
      a += price * baseQty;
    }
    return { qty: q, amount: a };
  })();

  const total = amount;

  return (
    <div className="order-summary">
      <h2>Сумма запроса</h2>

      <div className="summary-details">
        <div className="summary-row">
          <span>
            Общее количество: {qty} товара ({qty} шт)
          </span>
        </div>
        <div className="summary-row">
          <span>Общая стоимость: {total.toLocaleString()}.00 сом</span>
        </div>
      </div>

      <div className="summary-divider"></div>

      <div className="total-amount">
        <span>Итого: {total.toLocaleString()}.00 сом</span>
      </div>

      <button
        className="buy-btn"
        onClick={onSubmit}
        disabled={submitting || !items || items.length === 0}
      >
        <ShoppingCart size={20} />
        {submitting ? "Отправка..." : "Отправить запрос"} ({qty})
      </button>
    </div>
  );
};

const RequestCart = ({
  cartId,
  items = [],
  onUpdateQuantity,
  onRemoveItem,
  onNotify,
  onRefresh,
  onCreateNewCart,
}) => {
  const dispatch = useDispatch();
  const { list: clients, loading: clientsLoading } = useClient();
  const [submitting, setSubmitting] = useState(false);
  const [selectedClient, setSelectedClient] = useState(null);
  const [newClientName, setNewClientName] = useState("");
  const [newClientPhone, setNewClientPhone] = useState("");
  const [creatingClient, setCreatingClient] = useState(false);

  // Загрузка клиентов при монтировании
  useEffect(() => {
    dispatch(fetchClientsAsync());
  }, [dispatch]);

  // Загружаем текущего клиента корзины
  useEffect(() => {
    const loadCartClient = async () => {
      if (!cartId) return;
      try {
        const { data } = await getAgentCartById(cartId);
        if (data?.client) {
          setSelectedClient({
            id: data.client,
            full_name: data.client_name || "Клиент",
          });
        } else {
          setSelectedClient(null);
        }
      } catch (e) {
        console.error("Error loading cart client:", e);
      }
    };

    loadCartClient();
  }, [cartId]);

  const handleUpdateQuantityLocal = async (itemId, newQuantity) => {
    if (!newQuantity || newQuantity < 1) return;
    if (onUpdateQuantity) {
      await onUpdateQuantity(itemId, newQuantity);
    }
  };

  const handleRemoveItemLocal = async (itemId) => {
    if (onRemoveItem) {
      await onRemoveItem(itemId);
    }
  };

  // Выбор существующего клиента
  const handleSelectClient = async (event) => {
    if (!cartId) return;
    const value = event.target.value;

    if (!value) {
      // Убираем клиента
      try {
        await updateAgentCart(cartId, { client: null });
        setSelectedClient(null);
        onNotify && onNotify("success", "Клиент удалён из заявки");
      } catch (e) {
        console.error("Error clearing client from cart:", e);
        const errorMessage =
          e?.response?.data?.detail ||
          e?.response?.data?.message ||
          e?.message ||
          "Не удалось удалить клиента";
        onNotify &&
          onNotify("error", `Ошибка при удалении клиента: ${errorMessage}`);
      }
      return;
    }

    const clientId = value;
    const clientObj =
      (Array.isArray(clients) ? clients : clients?.results || []).find(
        (c) => String(c.id) === String(clientId)
      ) || null;

    try {
      await updateAgentCart(cartId, { client: clientId });
      setSelectedClient(clientObj);
      onNotify && onNotify("success", "Клиент привязан к заявке");
    } catch (e) {
      console.error("Error updating cart client:", e);
      const errorMessage =
        e?.response?.data?.detail ||
        e?.response?.data?.message ||
        e?.message ||
        "Не удалось обновить клиента";
      onNotify &&
        onNotify("error", `Ошибка при привязке клиента: ${errorMessage}`);
    }
  };

  // Создание нового клиента и привязка к корзине
  const handleCreateClient = async () => {
    if (!cartId) return;
    const name = newClientName.trim();
    const phone = newClientPhone.trim();

    if (!name) {
      onNotify && onNotify("error", "Введите имя клиента");
      return;
    }

    setCreatingClient(true);
    try {
      const action = await dispatch(
        createClientAsync({
          full_name: name,
          phone: phone || undefined,
          type: "client",
        })
      );
      const created = action?.payload;
      if (created?.id) {
        await updateAgentCart(cartId, { client: created.id });
        setSelectedClient(created);
        setNewClientName("");
        setNewClientPhone("");
        onNotify && onNotify("success", "Клиент создан и привязан к заявке");

        // Обновляем список клиентов
        dispatch(fetchClientsAsync());
      }
    } catch (e) {
      console.error("Error creating/selecting client:", e);
      const errorMessage =
        e?.response?.data?.detail ||
        e?.response?.data?.message ||
        e?.message ||
        "Не удалось создать клиента";
      onNotify &&
        onNotify("error", `Ошибка при создании клиента: ${errorMessage}`);
    } finally {
      setCreatingClient(false);
    }
  };

  const handleSubmit = async () => {
    if (!cartId) {
      onNotify && onNotify("error", "Корзина не загружена");
      return;
    }

    if (!items || items.length === 0) {
      onNotify && onNotify("error", "Корзина пуста. Добавьте товары в запрос");
      return;
    }

    setSubmitting(true);
    try {
      // Отправляем заявку через API
      await submitAgentCartById(cartId);

      // Создаем новую пустую корзину после успешной отправки
      if (onCreateNewCart) {
        await onCreateNewCart();
      } else if (onRefresh) {
        await onRefresh();
      }

      onNotify &&
        onNotify(
          "success",
          `Запрос на ${items.length} товар(ов) успешно отправлен!`
        );
    } catch (e) {
      console.error("Error submitting request:", e);
      const errorMessage =
        e?.response?.data?.detail ||
        e?.response?.data?.message ||
        e?.message ||
        e?.detail ||
        "неизвестная ошибка";
      onNotify &&
        onNotify("error", `Не удалось отправить запрос: ${errorMessage}`);
    } finally {
      setSubmitting(false);
    }
  };

  // Проверяем, можно ли редактировать корзину (только если статус draft)
  // Для этого нужно проверить статус корзины, но пока что предполагаем, что это всегда draft
  const isEditable = true; // TODO: проверять статус корзины

  return (
    <div className="cart-page">
      <div className="cart-container">
        <div className="cart-header">
          <h1>Запрос товаров</h1>
        </div>

        <div className="cart-content">
          <div className="cart-items-section">
            {(items || []).length === 0 ? (
              <div className="empty-cart">
                <ShoppingCart size={64} />
                <h3>Запрос пуст</h3>
                <p>Добавьте товары в запрос</p>
              </div>
            ) : (
              items.map((item) => (
                <CartItem
                  key={item.id}
                  item={item}
                  onUpdateQuantity={handleUpdateQuantityLocal}
                  onRemoveItem={handleRemoveItemLocal}
                  editable={isEditable}
                />
              ))
            )}
          </div>

          <div className="order-section">
            <div className="client-block">
              <h2 className="client-block__title">Клиент</h2>
              <div className="client-block__field">
                <label>Выберите клиента</label>
                <div className="client-block__select-wrapper">
                  <User size={18} className="client-block__icon" />
                  <select
                    value={selectedClient?.id || ""}
                    onChange={handleSelectClient}
                    disabled={clientsLoading || !cartId}
                  >
                    <option value="">Без клиента</option>
                    {(Array.isArray(clients)
                      ? clients
                      : clients?.results || []
                    ).map((client) => (
                      <option key={client.id} value={client.id}>
                        {client.full_name || client.name || client.username}{" "}
                        {client.phone ? `(${client.phone})` : ""}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="client-block__field">
                <label>Новый клиент</label>
                <input
                  type="text"
                  placeholder="Имя клиента"
                  value={newClientName}
                  onChange={(e) => setNewClientName(e.target.value)}
                  disabled={creatingClient}
                />
                <input
                  type="tel"
                  placeholder="Телефон (необязательно)"
                  value={newClientPhone}
                  onChange={(e) => setNewClientPhone(e.target.value)}
                  disabled={creatingClient}
                  style={{ marginTop: 8 }}
                />
                <button
                  type="button"
                  className="client-block__create-btn"
                  onClick={handleCreateClient}
                  disabled={creatingClient || !newClientName.trim()}
                  style={{ marginTop: 8 }}
                >
                  {creatingClient ? "Создание..." : "Создать и выбрать"}
                </button>
              </div>
            </div>

            <RequestSummary
              items={items}
              onSubmit={handleSubmit}
              submitting={submitting}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default RequestCart;
