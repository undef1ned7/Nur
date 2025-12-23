import React, { useState, useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  X,
  Plus,
  Minus,
  ShoppingCart,
  User,
  Search,
  ChevronDown,
  Heart,
  Star,
} from "lucide-react";
import { fetchClientsAsync } from "../../../../store/creators/clientCreators";
import { createClientAsync } from "../../../../store/creators/clientCreators";
import { useClient } from "../../../../store/slices/ClientSlice";
import {
  selectCartItems,
  selectCartTotal,
  selectCartItemsCount,
  selectSelectedClient,
  updateQuantity,
  removeFromCart,
  selectClient,
} from "../../../../store/slices/cartSlice";
import {
  startAgentCart,
  getAgentCart,
  removeItemFromAgentCart,
  updateAgentCartItemQuantity,
  checkoutAgentCart,
  addProductToAgentCart,
} from "../../../../store/creators/agentCartCreators";
// Alert is handled by parent (ProductionCatalog) via onNotify
import "./Cart.scss";

// Моковые данные для корзины
const mockCartItems = [
  {
    id: 1,
    product: {
      id: 1,
      name: "Bitrix24 CRM Базовый тариф",
      category: "Цифровые книги",
      price: 2600,
      image: "https://via.placeholder.com/100x100/4ECDC4/FFFFFF?text=Bitrix24",
      rating: 4.5,
      inStock: true,
    },
    quantity: 1,
    store: "MyCloud.kg",
    total: 2600,
  },
  {
    id: 2,
    product: {
      id: 2,
      name: "Товар 2",
      category: "Электроника",
      price: 15000,
      image: "https://via.placeholder.com/100x100/96CEB4/FFFFFF?text=Product+2",
      rating: 4.2,
      inStock: true,
    },
    quantity: 1,
    store: "TechStore.kg",
    total: 15000,
  },
];

const CartItem = ({
  item,
  onUpdateQuantity,
  onUpdateGift,
  onRemoveItem,
  editable,
}) => {
  const [quantity, setQuantity] = useState(
    Number(item.quantity ?? item.quantity_requested ?? 0)
  );
  const [giftQty, setGiftQty] = useState(
    typeof item.gift_quantity === "number" ? Number(item.gift_quantity) : 0
  );

  // Синхронизируем состояние с props при изменении item
  useEffect(() => {
    const newQuantity = Number(item.quantity ?? item.quantity_requested ?? 0);
    const newGiftQty =
      typeof item.gift_quantity === "number" ? Number(item.gift_quantity) : 0;

    // Обновляем только если значения действительно изменились
    setQuantity((prev) => {
      if (prev !== newQuantity) {
        console.log("CartItem: syncing quantity", {
          old: prev,
          new: newQuantity,
          itemId: item.id,
        });
        return newQuantity;
      }
      return prev;
    });
    setGiftQty((prev) => {
      if (prev !== newGiftQty) {
        console.log("CartItem: syncing giftQty", {
          old: prev,
          new: newGiftQty,
          itemId: item.id,
        });
        return newGiftQty;
      }
      return prev;
    });
  }, [item.quantity, item.quantity_requested, item.gift_quantity, item.id]);

  const handleIncrement = (e) => {
    e.stopPropagation();
    if (!editable) {
      console.log("CartItem: increment disabled, editable:", editable);
      return;
    }
    const newQuantity = quantity + 1;
    setQuantity(newQuantity);
    console.log("CartItem: incrementing", item.id, "to", newQuantity);
    onUpdateQuantity(item.id, newQuantity);
  };

  const handleDecrement = (e) => {
    e.stopPropagation();
    if (!editable || quantity <= 1) {
      console.log(
        "CartItem: decrement disabled, editable:",
        editable,
        "quantity:",
        quantity
      );
      return;
    }
    const newQuantity = quantity - 1;
    setQuantity(newQuantity);
    console.log("CartItem: decrementing", item.id, "to", newQuantity);
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

  const handleQuantityInputKeyDown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      e.target.blur();
    }
  };

  const handleRemove = (e) => {
    e.stopPropagation();
    if (window.confirm("Удалить товар из корзины?")) {
      onRemoveItem(item.id);
    }
  };

  const handleGiftIncrement = (e) => {
    e.stopPropagation();
    if (!editable) return;
    const newGift = giftQty + 1;
    setGiftQty(newGift);
    onUpdateGift && onUpdateGift(item.id, newGift);
  };

  const handleGiftDecrement = (e) => {
    e.stopPropagation();
    if (!editable || giftQty <= 0) return;
    const newGift = giftQty - 1;
    setGiftQty(newGift);
    onUpdateGift && onUpdateGift(item.id, newGift);
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
        {/* <p className="item-category">
          {item.product?.category || "Без категории"}
        </p> */}
        <div className="item-price">
          {Number(item.unit_price || item.price_snapshot || 0) *
            Number(item.quantity || 0) || 0}{" "}
          KGS
        </div>
        {/* <div className="item-rating">
          <Star size={14} fill="#FFD700" />
          <span>{item.product.rating}</span>
        </div> */}

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
              onKeyDown={handleQuantityInputKeyDown}
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

          <div className="quantity-controls" style={{ marginLeft: 12 }}>
            <button
              className="quantity-btn"
              onClick={handleGiftDecrement}
              disabled={!editable || giftQty <= 0}
              type="button"
              title="Уменьшить подарок"
            >
              <Minus size={16} />
            </button>
            <span className="quantity">{giftQty}</span>
            <button
              className="quantity-btn"
              onClick={handleGiftIncrement}
              disabled={!editable}
              type="button"
              title="Добавить в подарок"
            >
              <Plus size={16} />
            </button>
          </div>

          <button
            className="remove-btn"
            onClick={handleRemove}
            disabled={!editable}
            type="button"
            title="Удалить товар из корзины"
          >
            <X size={16} />
          </button>
        </div>

        <div className="item-info">
          <p className="gift">Подарок: {Number(giftQty).toLocaleString()}</p>
          <p className="total-qty">
            Итого шт: {Number(item.quantity || 0).toLocaleString()}
          </p>
          <p className="total">
            Общий:{" "}
            {Number(
              Number(item.unit_price || item.price_snapshot || 0) *
                (Number(item.quantity || 0) + Number(giftQty || 0))
            ).toLocaleString()}
            .00
          </p>
        </div>
      </div>
    </div>
  );
};

const ClientSelector = ({
  selectedClient,
  onClientSelect,
  clients,
  loading,
  onRefresh,
}) => {
  const dispatch = useDispatch();
  const { creating, error } = useClient();
  const [isOpen, setIsOpen] = useState(false);
  const [state, setState] = useState({
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
  const [searchQuery, setSearchQuery] = useState("");
  const [isCreateMode, setIsCreateMode] = useState(false);
  const [formError, setFormError] = useState("");

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
  const list = Array.isArray(clients?.results)
    ? clients.results
    : clients || [];

  const filteredClients = (list || []).filter((client) => {
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

  const onChange = (e) => {
    const { name, value } = e.target;
    setState((prev) => ({ ...prev, [name]: value }));
  };

  const handleCreateClient = async () => {
    setFormError("");
    if (!String(state.full_name || "").trim()) {
      setFormError("Укажите имя клиента");
      return;
    }

    try {
      const action = await dispatch(createClientAsync(state));
      const created = action?.payload;
      if (created) {
        onRefresh();
        onClientSelect(created);
        setIsCreateMode(false);
        setSearchQuery("");
        setIsOpen(false);
      }
    } catch (e) {
      console.log(e);
      // error handled in slice; keep form open
    }
  };

  return (
    <div className="client-selector">
      <label className="selector-label">Выберите клиента</label>
      <div className="selector-dropdown">
        <button
          className="selector-trigger"
          onClick={() => setIsOpen((v) => !v)}
        >
          <div className="selected-client">
            <User size={20} />
            {selectedClient ? (
              <>
                <span>{getClientName(selectedClient)}</span>
                {selectedClient?.phone && (
                  <span className="client-phone">{selectedClient.phone}</span>
                )}
              </>
            ) : (
              <span>Выберите клиента</span>
            )}
          </div>
          <ChevronDown
            size={20}
            className={`chevron ${isOpen ? "open" : ""}`}
          />
        </button>

        {isOpen && (
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
                  value={state.full_name}
                  onChange={onChange}
                  disabled={creating}
                />
                <input
                  type="tel"
                  placeholder="Телефон"
                  name="phone"
                  value={state.phone}
                  onChange={onChange}
                  disabled={creating}
                />
                <input
                  type="text"
                  placeholder="ОсОО"
                  name="llc"
                  value={state.llc}
                  onChange={onChange}
                  disabled={creating}
                />
                <input
                  type="text"
                  placeholder="ОКПО"
                  name="okpo"
                  value={state.okpo}
                  onChange={onChange}
                  disabled={creating}
                />
                <input
                  type="text"
                  placeholder="З/СЧЕТ"
                  name="score"
                  value={state.score}
                  onChange={onChange}
                  disabled={creating}
                />
                <input
                  type="text"
                  placeholder="БИК"
                  name="bik"
                  value={state.bik}
                  onChange={onChange}
                  disabled={creating}
                />
                <input
                  type="text"
                  placeholder="Адрес"
                  name="address"
                  value={state.address}
                  onChange={onChange}
                  disabled={creating}
                />
                <input
                  type="email"
                  placeholder="Email"
                  name="email"
                  value={state.email}
                  onChange={onChange}
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
                {error ? (
                  <div
                    className="error"
                    style={{ color: "#c00", fontSize: 12 }}
                  >
                    {String(error)}
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
                {loading ? (
                  <div className="loading">Загрузка клиентов...</div>
                ) : filteredClients.length === 0 ? (
                  <div className="no-clients">Клиенты не найдены</div>
                ) : (
                  filteredClients.map((client) => {
                    const name = getClientName(client);
                    return (
                      <button
                        key={client?.id ?? `${name}-${client?.phone ?? ""}`}
                        className={`client-option ${
                          selectedClient?.id && client?.id
                            ? selectedClient.id === client.id
                              ? "selected"
                              : ""
                            : getClientName(selectedClient) === name &&
                              selectedClient?.phone === client?.phone
                            ? "selected"
                            : ""
                        }`}
                        onClick={() => {
                          onClientSelect(client);
                          setIsOpen(false);
                          setSearchQuery("");
                        }}
                      >
                        <div className="client-info">
                          <span className="client-name">
                            {name || "Без имени"}
                          </span>
                          {client?.phone && (
                            <span className="client-phone">{client.phone}</span>
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
  );
};

const OrderSummary = ({
  selectedClient,
  items,
  status,
  onSubmit,
  submitting,
}) => {
  const cartItems = useSelector(selectCartItems);
  const totalQuantityLocal = useSelector(selectCartItemsCount);
  const subtotalLocal = useSelector(selectCartTotal);
  const discount = 0; // Моковая скидка
  console.log("item", items);

  const usingServer = Array.isArray(items) && items.length > 0;
  // Корзина редактируема, если статус "draft" или "active"
  const isEditable = status === "draft" || status === "active";
  const isDraft = status === "draft";
  const isSubmitted = status === "submitted";
  const isApproved = status === "approved";
  const isRejected = status === "rejected";

  const { qty, amount } = (() => {
    if (!usingServer) {
      return { qty: totalQuantityLocal, amount: subtotalLocal };
    }
    let q = 0;
    let a = 0;
    for (const it of items) {
      // Используем unit_price из ответа API или price_snapshot как fallback
      const price = Number(it?.unit_price || it?.price_snapshot || 0);
      // Используем quantity из ответа API
      const baseQty = Number(it?.quantity || it?.quantity_requested || 0);
      q += baseQty;
      a += price * baseQty;
    }
    return { qty: q, amount: a };
  })();

  const total = amount - discount;

  return (
    <div className="order-summary">
      <h2>Сумма заказа</h2>

      <div className="summary-details">
        <div className="summary-row">
          <span>
            Общее количество: {qty} товара ({qty} шт)
          </span>
        </div>
        <div className="summary-row">
          <span>Стоимость: {total.toLocaleString()}.00 KGS</span>
        </div>
        {/* <div className="summary-row discount">
          <span>Скидка: - {discount.toLocaleString()}.00 KGS</span>
        </div> */}
      </div>

      <div className="summary-divider"></div>

      <div className="total-amount">
        <span>К оплате: {total.toLocaleString()}.00 KGS</span>
      </div>

      <button
        className="buy-btn"
        onClick={onSubmit}
        disabled={
          submitting ||
          !selectedClient ||
          // (!usingServer && (cartItems || []).length === 0) ||
          !isEditable
        }
      >
        <ShoppingCart size={20} />
        {isSubmitted
          ? "Отправлено"
          : isApproved
          ? "Одобрено"
          : isRejected
          ? "Отклонено"
          : "Продать"}{" "}
        ({qty})
      </button>
    </div>
  );
};

const Cart = ({ agentCartId: agentCartIdProp = null, onNotify, onClose }) => {
  const dispatch = useDispatch();
  const { list: clients, loading: clientsLoading } = useClient();

  // Redux селекторы
  const cartItemsLocal = useSelector(selectCartItems);
  const selectedClient = useSelector(selectSelectedClient);

  // Server-backed agent cart state
  const [agentCartId, setAgentCartId] = useState(agentCartIdProp);
  const [agentCart, setAgentCart] = useState(null);
  const [agentItems, setAgentItems] = useState([]);

  const [loadingAgentItems, setLoadingAgentItems] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  // Alerts delegated to parent

  // Загружаем клиентов при монтировании
  useEffect(() => {
    dispatch(fetchClientsAsync());
  }, [dispatch]);

  // Load items for provided or discovered draft cart; do not create here
  useEffect(() => {
    (async () => {
      try {
        let cid = agentCartIdProp;
        if (!cid) {
          // Используем startAgentCart для получения/создания корзины
          const cart = await dispatch(
            startAgentCart({ agent: null, order_discount_total: "0.00" })
          ).unwrap();
          if (cart?.id) {
            cid = cart.id;
            setAgentCart(cart);
            localStorage.setItem("agentCartId", cid);
          }
        }
        setAgentCartId(cid || null);
        if (cid) {
          setLoadingAgentItems(true);
          try {
            // Используем getAgentCart для получения активной корзины
            const cart = await dispatch(
              getAgentCart({ agent: null, order_discount_total: "0.00" })
            ).unwrap();
            if (cart?.id) {
              setAgentCart(cart);
              setAgentItems(Array.isArray(cart.items) ? cart.items : []);
              // Обновляем ID корзины если он изменился
              if (cart.id !== cid) {
                setAgentCartId(cart.id);
                localStorage.setItem("agentCartId", cart.id);
              }
            } else {
              // Если корзина не найдена, создаем новую
              const newCart = await dispatch(
                startAgentCart({ agent: null, order_discount_total: "0.00" })
              ).unwrap();
              if (newCart?.id) {
                setAgentCartId(newCart.id);
                setAgentCart(newCart);
                setAgentItems(
                  Array.isArray(newCart.items) ? newCart.items : []
                );
                localStorage.setItem("agentCartId", newCart.id);
              }
            }
          } catch (e) {
            // Если корзина не найдена, создаем новую
            try {
              const newCart = await dispatch(
                startAgentCart({ agent: null, order_discount_total: "0.00" })
              ).unwrap();
              if (newCart?.id) {
                setAgentCartId(newCart.id);
                setAgentCart(newCart);
                setAgentItems(
                  Array.isArray(newCart.items) ? newCart.items : []
                );
                localStorage.setItem("agentCartId", newCart.id);
              }
            } catch (err) {
              console.error("Error creating cart:", err);
            }
          } finally {
            setLoadingAgentItems(false);
          }
        } else {
          setAgentItems([]);
          setAgentCart(null);
        }
      } catch (e) {
        console.error("Error loading cart:", e);
      }
    })();
  }, [dispatch, agentCartIdProp]);

  const handleUpdateQuantity = async (itemId, newQuantity) => {
    console.log("Cart: handleUpdateQuantity called", {
      itemId,
      newQuantity,
      agentCartId,
    });
    if (!newQuantity || newQuantity < 1) {
      console.log("Cart: invalid quantity", newQuantity);
      return;
    }

    if (agentCartId) {
      try {
        console.log("Cart: updating via API", {
          cartId: agentCartId,
          itemId,
          quantity: newQuantity,
        });
        // Используем updateAgentCartItemQuantity - возвращает обновленную корзину
        const updated = await dispatch(
          updateAgentCartItemQuantity({
            cartId: agentCartId,
            itemId: itemId,
            quantity: newQuantity,
          })
        ).unwrap();
        console.log("Cart: update response", updated);
        // Используем возвращенные данные корзины
        if (updated) {
          setAgentCart(updated);
          setAgentItems(Array.isArray(updated.items) ? updated.items : []);
        } else {
          // Если данных нет, обновляем через getAgentCart
          const refreshed = await dispatch(
            getAgentCart({ agent: null, order_discount_total: "0.00" })
          ).unwrap();
          setAgentCart(refreshed);
          setAgentItems(Array.isArray(refreshed.items) ? refreshed.items : []);
        }
      } catch (e) {
        console.error("Error updating quantity:", e);
        // Восстанавливаем предыдущее значение при ошибке
      }
    } else {
      console.log("Cart: updating via local cart");
      dispatch(updateQuantity({ itemId, quantity: newQuantity }));
    }
  };

  const handleUpdateGift = async (itemId, gift_quantity) => {
    if (!agentCartId) return; // gifts only meaningful on server cart
    try {
      // Находим текущий элемент, чтобы получить его quantity
      const currentItem = agentItems.find((item) => item.id === itemId);
      if (!currentItem) return;

      // Обновляем gift_quantity через updateAgentCartItemQuantity - возвращает обновленную корзину
      const updated = await dispatch(
        updateAgentCartItemQuantity({
          cartId: agentCartId,
          itemId: itemId,
          quantity: currentItem.quantity || 1,
          gift_quantity: gift_quantity,
        })
      ).unwrap();

      // Используем возвращенные данные корзины
      if (updated) {
        setAgentCart(updated);
        setAgentItems(Array.isArray(updated.items) ? updated.items : []);
      } else {
        // Если данных нет, обновляем через getAgentCart
        const refreshed = await dispatch(
          getAgentCart({ agent: null, order_discount_total: "0.00" })
        ).unwrap();
        setAgentCart(refreshed);
        setAgentItems(Array.isArray(refreshed.items) ? refreshed.items : []);
      }
    } catch (e) {
      console.error("Error updating gift quantity:", e);
    }
  };

  const handleRemoveItem = async (itemId) => {
    if (agentCartId) {
      try {
        // Используем removeItemFromAgentCart - возвращает обновленную корзину
        const updated = await dispatch(
          removeItemFromAgentCart({ cartId: agentCartId, itemId })
        ).unwrap();
        // Используем возвращенные данные корзины
        if (updated) {
          setAgentCart(updated);
          setAgentItems(Array.isArray(updated.items) ? updated.items : []);
        } else {
          // Если данных нет, обновляем через getAgentCart
          const refreshed = await dispatch(
            getAgentCart({ agent: null, order_discount_total: "0.00" })
          ).unwrap();
          setAgentCart(refreshed);
          setAgentItems(Array.isArray(refreshed.items) ? refreshed.items : []);
        }
      } catch (e) {
        console.error("Error removing item:", e);
      }
    } else {
      dispatch(removeFromCart(itemId));
    }
  };

  // Обновляем корзину при изменении agentCartId
  useEffect(() => {
    if (agentCartId && agentCartIdProp === agentCartId) {
      (async () => {
        try {
          const cart = await dispatch(
            getAgentCart({ agent: null, order_discount_total: "0.00" })
          ).unwrap();
          setAgentCart(cart);
          setAgentItems(Array.isArray(cart.items) ? cart.items : []);
        } catch (e) {
          console.error("Error refreshing cart:", e);
        }
      })();
    }
  }, [agentCartId, agentCartIdProp, dispatch]);

  const handleClientSelect = async (client) => {
    dispatch(selectClient(client));
    if (agentCartId && client?.id) {
      try {
        // Обновляем клиента (пока просто обновляем корзину)
        // Примечание: если API поддерживает обновление клиента через отдельный эндпойнт, можно добавить
        const updated = await dispatch(
          getAgentCart({ agent: null, order_discount_total: "0.00" })
        ).unwrap();
        setAgentCart((prev) => (prev ? { ...prev, client } : prev));
      } catch (e) {
        console.error("Error updating client:", e);
      }
    }
  };

  const handleSubmit = async () => {
    if (!agentCartId || !selectedClient) return;
    setSubmitting(true);
    try {
      // Используем checkoutAgentCart для чекаута корзины
      const res = await dispatch(
        checkoutAgentCart({
          cartId: agentCartId,
          client_id: selectedClient.id,
          print_receipt: false,
        })
      ).unwrap();

      // После успешного чекаута обновляем данные корзины
      const updated = await dispatch(
        getAgentCart({ agent: null, order_discount_total: "0.00" })
      ).unwrap();

      setAgentCart(updated || res || null);
      setAgentItems(Array.isArray(updated?.items) ? updated.items : []);

      // Clear persisted id so next session creates a new draft
      localStorage.removeItem("agentCartId");
      // Keep agentCartId in state to reflect submitted status; new draft will be created on next page load
      onNotify && onNotify("success", "Заказ успешно оформлен");
      // Clear local state so next open uses a new draft id from parent
      setAgentCartId(null);
      setAgentCart(null);
      setAgentItems([]);
    } catch (e) {
      console.error("Error submitting cart:", e);
      onNotify &&
        onNotify("error", "Не удалось оформить заказ. Попробуйте ещё раз.");
    } finally {
      setSubmitting(false);
    }
  };
  console.log(agentCart, "agent");

  return (
    <div className="cart-page overflow-auto h-full">
      <div className="cart-container">
        <div className="cart-header flex justify-between align-center">
          <h1>Корзина</h1>
          {onClose && (
            <button className="close-cart-btn" onClick={onClose}>
              <X size={20} />
            </button>
          )}
        </div>

        <div className="cart-content overflow-auto">
          <div className="cart-items-section max-h-[50vh] overflow-auto">
            {(agentItems || []).length === 0 &&
            (cartItemsLocal || []).length === 0 ? (
              <div className="empty-cart">
                <ShoppingCart size={64} />
                <h3>Корзина пуста</h3>
                <p>Добавьте товары в корзину</p>
              </div>
            ) : (
              (agentItems && agentItems.length > 0
                ? agentItems
                : cartItemsLocal || []
              ).map((item) => {
                // Корзина редактируема, если статус "draft" или "active" (не отправлена/одобрена/отклонена)
                const cartStatus = agentCart?.status;
                const isEditable =
                  !agentCart ||
                  cartStatus === "draft" ||
                  cartStatus === "active";
                console.log("Cart: rendering item", {
                  id: item.id,
                  name: item.product_name,
                  quantity: item.quantity,
                  editable: isEditable,
                  cartStatus: cartStatus,
                });
                return (
                  <CartItem
                    key={item.id}
                    item={item}
                    onUpdateQuantity={handleUpdateQuantity}
                    onUpdateGift={handleUpdateGift}
                    onRemoveItem={handleRemoveItem}
                    editable={isEditable}
                  />
                );
              })
            )}
          </div>

          <div className="order-section">
            <ClientSelector
              selectedClient={selectedClient}
              onClientSelect={handleClientSelect}
              clients={clients || []}
              loading={clientsLoading}
              onRefresh={() => dispatch(fetchClientsAsync())}
            />

            <OrderSummary
              selectedClient={selectedClient}
              items={agentItems}
              status={agentCart?.status || "draft"}
              onSubmit={handleSubmit}
              submitting={submitting}
            />
          </div>
        </div>
      </div>
      {/* Alert rendered by parent */}
    </div>
  );
};

export default Cart;
