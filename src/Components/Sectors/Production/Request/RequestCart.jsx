import React, { useState, useEffect } from "react";
import { useDispatch } from "react-redux";
import {
  X,
  Plus,
  Minus,
  ShoppingCart,
  User,
  Search,
  ChevronDown,
} from "lucide-react";
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
          {Number(item.unit_price || item.price_snapshot || 0) *
            Number(item.quantity || item.quantity_requested || 0) || 0}{" "}
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
            Итого шт:{" "}
            {Number(
              item.quantity || item.quantity_requested || 0
            ).toLocaleString()}
          </p>
          <p className="total">
            Общий:{" "}
            {Number(
              Number(item.unit_price || item.price_snapshot || 0) *
                Number(item.quantity || item.quantity_requested || 0)
            ).toLocaleString()}
            .00 сом
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
          <span>Стоимость: {total.toLocaleString()}.00 сом</span>
        </div>
      </div>

      <div className="summary-divider"></div>

      <div className="total-amount">
        <span>К оплате: {total.toLocaleString()}.00 сом</span>
      </div>

      <button
        type="button"
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
  onClose,
}) => {
  const dispatch = useDispatch();
  const {
    list: clients,
    loading: clientsLoading,
    creating,
    error: clientError,
  } = useClient();
  const [submitting, setSubmitting] = useState(false);
  const [selectedClient, setSelectedClient] = useState(null);
  const [isClientSelectorOpen, setIsClientSelectorOpen] = useState(false);
  const [isCreateMode, setIsCreateMode] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [formError, setFormError] = useState("");
  const [clientFormState, setClientFormState] = useState({
    full_name: "",
    phone: "",
    email: "",
    date: new Date().toISOString().split("T")[0],
    type: "client",
    llc: "",
    inn: "",
    okpo: "",
    score: "",
    bik: "",
    address: "",
  });

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

  // Универсальные хелперы под разные схемы клиента
  const getClientName = (c) =>
    (c?.name && String(c.name)) ||
    (c?.full_name && String(c.full_name)) ||
    [c?.first_name, c?.last_name].filter(Boolean).join(" ") ||
    c?.username ||
    "";

  const normalize = (s) =>
    String(s ?? "")
      .toLowerCase()
      .trim();
  const normalizePhone = (s) => String(s ?? "").replace(/\D/g, "");

  // Клиенты могут быть массивом или { results: [...] }
  const clientsList = Array.isArray(clients?.results)
    ? clients.results
    : clients || [];

  const filteredClients = (clientsList || []).filter((client) => {
    const q = normalize(searchQuery);
    const qPhone = normalizePhone(searchQuery);
    const name = normalize(getClientName(client));
    const phone = normalizePhone(client?.phone);

    // Ищем либо по имени/фамилии, либо по телефону
    return (
      (q && name.includes(q)) ||
      (qPhone && phone.includes(qPhone)) ||
      (!q && !qPhone)
    );
  });

  const handleClientFormChange = (e) => {
    const { name, value } = e.target;
    setClientFormState((prev) => ({ ...prev, [name]: value }));
  };

  // Выбор существующего клиента (только локальное состояние, без API запроса)
  const handleSelectClient = (client) => {
    setSelectedClient(client);
    setIsClientSelectorOpen(false);
    setSearchQuery("");
  };

  // Создание нового клиента (только локальное состояние, без API запроса к корзине)
  const handleCreateClient = async () => {
    setFormError("");
    if (!String(clientFormState.full_name || "").trim()) {
      setFormError("Укажите имя клиента");
      return;
    }

    try {
      const action = await dispatch(createClientAsync(clientFormState));
      const created = action?.payload;
      if (created?.id) {
        // Сохраняем только в локальное состояние, без обновления корзины через API
        setSelectedClient(created);
        setIsCreateMode(false);
        setSearchQuery("");
        setIsClientSelectorOpen(false);
        setClientFormState({
          full_name: "",
          phone: "",
          email: "",
          date: new Date().toISOString().split("T")[0],
          type: "client",
          llc: "",
          inn: "",
          okpo: "",
          score: "",
          bik: "",
          address: "",
        });

        // Обновляем список клиентов
        dispatch(fetchClientsAsync());
      }
    } catch (e) {
      console.error("Error creating client:", e);
      // error handled in slice
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
      // Сначала обновляем корзину с выбранным клиентом (если есть)
      if (selectedClient?.id) {
        await updateAgentCart(cartId, { client: selectedClient.id });
      } else {
        // Если клиент не выбран, убираем его из корзины
        await updateAgentCart(cartId, { client: null });
      }

      // Затем отправляем заявку через API
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
    <div className="cart-page overflow-auto h-full">
      <div className="cart-container">
        <div className="cart-header flex justify-between align-center">
          <h1>Запрос товаров</h1>
          {onClose && (
            <button className="close-cart-btn" onClick={onClose}>
              <X size={20} />
            </button>
          )}
        </div>

        <div className="cart-content overflow-auto">
          <div className="cart-items-section max-h-[50vh] overflow-auto">
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
            <div className="client-selector">
              <label className="selector-label">Выберите клиента</label>
              <div className="selector-dropdown">
                <button
                  className="selector-trigger"
                  onClick={() => setIsClientSelectorOpen((v) => !v)}
                  disabled={!cartId}
                >
                  <div className="selected-client">
                    <User size={20} />
                    {selectedClient ? (
                      <>
                        <span>{getClientName(selectedClient)}</span>
                        {selectedClient?.address && (
                          <span className="client-phone">
                            {selectedClient.address}
                          </span>
                        )}
                      </>
                    ) : (
                      <span>Выберите клиента</span>
                    )}
                  </div>
                  <ChevronDown
                    size={20}
                    className={`chevron ${isClientSelectorOpen ? "open" : ""}`}
                  />
                </button>

                {isClientSelectorOpen && (
                  <div className="selector-dropdown-content">
                    {!isCreateMode && (
                      <>
                        <div className="search-box">
                          <Search size={16} />
                          <input
                            type="text"
                            placeholder="Поиск по имени или телефону…"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                          />
                        </div>
                        <div
                          className="actions-row"
                          style={{
                            display: "flex",
                            gap: 8,
                            marginBottom: 8,
                            width: "100%",
                          }}
                        >
                          <button
                            className="create-client-btn"
                            onClick={() => {
                              setIsCreateMode(true);
                              setFormError("");
                            }}
                          >
                            + Новый клиент
                          </button>
                          <button
                            className="clear-client-btn"
                            onClick={() => handleSelectClient(null)}
                            style={{ marginLeft: "auto" }}
                          >
                            Убрать клиента
                          </button>
                        </div>
                      </>
                    )}
                    {isCreateMode && (
                      <div
                        className="create-client-form"
                        style={{ display: "grid", gap: 8, marginBottom: 12 }}
                      >
                        <input
                          type="text"
                          placeholder="Имя клиента"
                          name="full_name"
                          value={clientFormState.full_name}
                          onChange={handleClientFormChange}
                          disabled={creating}
                        />
                        <input
                          type="tel"
                          placeholder="Телефон"
                          name="phone"
                          value={clientFormState.phone}
                          onChange={handleClientFormChange}
                          disabled={creating}
                        />
                        <input
                          type="text"
                          placeholder="ОсОО"
                          name="llc"
                          value={clientFormState.llc}
                          onChange={handleClientFormChange}
                          disabled={creating}
                        />
                        <input
                          type="text"
                          placeholder="ОКПО"
                          name="okpo"
                          value={clientFormState.okpo}
                          onChange={handleClientFormChange}
                          disabled={creating}
                        />
                        <input
                          type="text"
                          placeholder="З/СЧЕТ"
                          name="score"
                          value={clientFormState.score}
                          onChange={handleClientFormChange}
                          disabled={creating}
                        />
                        <input
                          type="text"
                          placeholder="БИК"
                          name="bik"
                          value={clientFormState.bik}
                          onChange={handleClientFormChange}
                          disabled={creating}
                        />
                        <input
                          type="text"
                          placeholder="Адрес"
                          name="address"
                          value={clientFormState.address}
                          onChange={handleClientFormChange}
                          disabled={creating}
                        />
                        <input
                          type="email"
                          placeholder="Email"
                          name="email"
                          value={clientFormState.email}
                          onChange={handleClientFormChange}
                          disabled={creating}
                        />
                        {formError ? (
                          <div
                            className="error"
                            style={{ color: "#c00", fontSize: 12 }}
                          >
                            {formError}
                          </div>
                        ) : null}
                        {clientError ? (
                          <div
                            className="error"
                            style={{ color: "#c00", fontSize: 12 }}
                          >
                            {String(clientError)}
                          </div>
                        ) : null}
                        <div style={{ display: "flex", gap: 8 }}>
                          <button
                            className="save-client-btn"
                            onClick={handleCreateClient}
                            disabled={creating}
                          >
                            {creating ? "Сохранение..." : "Сохранить"}
                          </button>
                          <button
                            className="cancel-create-btn"
                            onClick={() => {
                              setIsCreateMode(false);
                              setFormError("");
                            }}
                            disabled={creating}
                          >
                            Отмена
                          </button>
                        </div>
                      </div>
                    )}

                    {!isCreateMode && (
                      <div className="clients-list">
                        {clientsLoading ? (
                          <div className="loading">Загрузка клиентов...</div>
                        ) : filteredClients.length === 0 ? (
                          <div className="no-clients">Клиенты не найдены</div>
                        ) : (
                          filteredClients.map((client) => {
                            const name = getClientName(client);
                            return (
                              <button
                                key={
                                  client?.id ?? `${name}-${client?.phone ?? ""}`
                                }
                                className={`client-option ${
                                  selectedClient?.id && client?.id
                                    ? selectedClient.id === client.id
                                      ? "selected"
                                      : ""
                                    : getClientName(selectedClient) === name &&
                                      selectedClient?.address ===
                                        client?.address
                                    ? "selected"
                                    : ""
                                }`}
                                onClick={() => handleSelectClient(client)}
                              >
                                <div className="client-info">
                                  <span className="client-name">
                                    {name || "Без имени"}
                                  </span>
                                  {client?.phone && (
                                    <span className="client-phone">
                                      {client.address}
                                    </span>
                                  )}
                                </div>
                              </button>
                            );
                          })
                        )}
                      </div>
                    )}
                  </div>
                )}
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
