import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  X,
  Plus,
  Minus,
  ShoppingCart,
  User,
  Search,
  ChevronDown,
  ChevronUp,
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
import { createDeal } from "../../../../store/creators/saleThunk";
import { useUser } from "../../../../store/slices/userSlice";
import {
  openShiftAsync,
  fetchShiftsAsync,
} from "../../../../store/creators/shiftThunk";
import { useShifts } from "../../../../store/slices/shiftSlice";
import { useCash, getCashBoxes } from "../../../../store/slices/cashSlice";
// Alert is handled by parent (ProductionCatalog) via onNotify
import "./Cart.scss";
import { useConfirm } from "../../../../hooks/useDialog";


const CartItem = ({
  item,
  onUpdateQuantity,
  onUpdateGift,
  onRemoveItem,
  editable,
}) => {
  const confirm = useConfirm();
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
        return newQuantity;
      }
      return prev;
    });
    setGiftQty((prev) => {
      if (prev !== newGiftQty) {
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
    const current = Number(quantity) || 0;
    const newQuantity = current + 1;
    setQuantity(newQuantity);
    console.log("CartItem: incrementing", item.id, "to", newQuantity);
    onUpdateQuantity(item.id, newQuantity);
  };

  const handleDecrement = (e, id) => {
    e.stopPropagation();
    if (!editable) {
      console.log("CartItem: decrement disabled, editable:", editable);
      return;
    }
    const current = Number(quantity) || 0;
    if (current <= 1) {
      handleRemove(e);
      return;
    }
    const newQuantity = current - 1;
    setQuantity(newQuantity);
    console.log("CartItem: decrementing", item.id, "to", newQuantity);
    onUpdateQuantity(item.id, newQuantity);
  };

  const handleQuantityInputChange = (e) => {
    e.stopPropagation();
    const raw = e.target.value;
    if (raw === "") {
      setQuantity("");
      return;
    }
    const value = Number(raw);
    if (!isNaN(value) && value >= 1) {
      setQuantity(value);
    }
  };

  const handleQuantityInputBlur = (e) => {
    e.stopPropagation();
    const raw = e.target.value;
    const value = Number(raw);
    if (raw === "" || isNaN(value) || value < 1) {
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

  const handleRemove = useCallback((e) => {
    e?.stopPropagation();
    confirm("Удалить товар из корзины?", (result) => {
      if (result) {
        onRemoveItem(item.id);
      }
    })
  }, []);
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
              : item?.product_image_url || "/images/placeholder.avif"
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
          {(Number(item.unit_price || item.price_snapshot || 0) *
            Number(item.quantity || 0) || 0).toFixed(2)}{" "}
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
              onClick={(e) => handleDecrement(e, item.id)}
              disabled={quantity <= 0 || !editable}
              type="button"
              title="Уменьшить количество"
            >
              <Minus size={16} />
            </button>
            <input
              type="text"
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

          {/* <div className="quantity-controls" style={{ marginLeft: 12 }}>
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
          </div> */}

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
  onClose,
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
      <div className="selector-label-container">
        <label className="selector-label">Выберите клиента</label>
      </div>
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
                {selectedClient?.address && (
                  <span className="client-phone">{selectedClient.address}</span>
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
                        key={client?.id ?? `${name}-${client?.address ?? ""}`}
                        className={`client-option ${selectedClient?.id && client?.id
                          ? selectedClient.id === client.id
                            ? "selected"
                            : ""
                          : getClientName(selectedClient) === name &&
                            selectedClient?.address === client?.address
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
                          {client?.address && (
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
  );
};

const OrderSummary = ({
  selectedClient,
  items,
  status,
  onSubmit,
  submitting,
  paymentType,
  onPaymentTypeChange,
  debtMonths,
  onDebtMonthsChange,
  firstDueDate,
  onFirstDueDateChange,
  prepaymentAmount,
  onPrepaymentAmountChange,
}) => {
  const cartItems = useSelector(selectCartItems);
  const totalQuantityLocal = useSelector(selectCartItemsCount);
  const subtotalLocal = useSelector(selectCartTotal);
  const { discount,
    usingServer,
    isEditable,
    isDraft,
    isApproved,
    isRejected,
    isSubmitted } = useMemo(() => {
      const discount = 0; // Моковая скидка
      const usingServer = Array.isArray(items) && items.length > 0;
      // Корзина редактируема, если статус "draft" или "active"
      const isEditable = status === "draft" || status === "active";
      const isDraft = status === "draft";
      const isSubmitted = status === "submitted";
      const isApproved = status === "approved";
      const isRejected = status === "rejected";

      return {
        discount,
        usingServer,
        isEditable,
        isDraft,
        isApproved,
        isRejected,
        isSubmitted
      }
    })


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

      {/* Выбор типа оплаты */}
      {isEditable && selectedClient && (
        <div className="payment-type-section" style={{ marginTop: "16px" }}>
          <label
            style={{ display: "block", marginBottom: "8px", fontWeight: 500 }}
          >
            Тип оплаты:
          </label>
          <select
            value={paymentType || ""}
            onChange={(e) => onPaymentTypeChange(e.target.value)}
            style={{
              width: "100%",
              padding: "8px",
              borderRadius: "8px",
              border: "1px solid #e5e7eb",
              fontSize: "14px",
            }}
          >
            <option value="">Наличные</option>
            <option value="Долги">Долг</option>
            <option value="Предоплата">Предоплата</option>
          </select>

          {/* Поля для долга */}
          {(paymentType === "Долги" || paymentType === "Предоплата") && (
            <div
              style={{
                marginTop: "12px",
                display: "flex",
                flexDirection: "column",
                gap: "8px",
              }}
            >
              <div>
                <label
                  style={{
                    display: "block",
                    marginBottom: "4px",
                    fontSize: "13px",
                  }}
                >
                  Количество месяцев:
                </label>
                <input
                  type="number"
                  min="0"
                  value={debtMonths || ""}
                  onChange={(e) => onDebtMonthsChange(e.target.value)}
                  placeholder="0"
                  style={{
                    width: "100%",
                    padding: "6px",
                    borderRadius: "6px",
                    border: "1px solid #e5e7eb",
                    fontSize: "13px",
                  }}
                />
              </div>
              <div>
                <label
                  style={{
                    display: "block",
                    marginBottom: "4px",
                    fontSize: "13px",
                  }}
                >
                  Дата первого платежа:
                </label>
                <input
                  type="date"
                  value={firstDueDate || ""}
                  onChange={(e) => onFirstDueDateChange(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "6px",
                    borderRadius: "6px",
                    border: "1px solid #e5e7eb",
                    fontSize: "13px",
                  }}
                />
              </div>
              {paymentType === "Предоплата" && (
                <div>
                  <label
                    style={{
                      display: "block",
                      marginBottom: "4px",
                      fontSize: "13px",
                    }}
                  >
                    Сумма предоплаты:
                  </label>
                  <input
                    type="number"
                    min="0"
                    max={total}
                    value={prepaymentAmount || ""}
                    onChange={(e) => onPrepaymentAmountChange(e.target.value)}
                    placeholder="0"
                    style={{
                      width: "100%",
                      padding: "6px",
                      borderRadius: "6px",
                      border: "1px solid #e5e7eb",
                      fontSize: "13px",
                    }}
                  />
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <button
        className="buy-btn"
        onClick={onSubmit}
        disabled={
          submitting ||
          !selectedClient ||
          // (!usingServer && (cartItems || []).length === 0) ||
          !isEditable
        }
        style={{ marginTop: "16px" }}
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

const Cart = ({
  agentCartId: agentCartIdProp = null,
  onNotify,
  onClose,
  isOpen = false,
  onOpenChange,
  setAgentCartItemsCount,
  totalItemsCount = 0,
  onMobileViewChange,
}) => {
  const confirm = useConfirm();
  const dispatch = useDispatch();
  const { list: clients, loading: clientsLoading } = useClient();
  const { shifts, currentShift } = useShifts();
  const { list: cashBoxes } = useCash();
  const { profile, currentUser, userId } = useUser();

  // Redux селекторы
  const cartItemsLocal = useSelector(selectCartItems);
  const selectedClient = useSelector(selectSelectedClient);
  const subtotalLocal = useSelector(selectCartTotal);

  // Server-backed agent cart state
  const [agentCartId, setAgentCartId] = useState(agentCartIdProp);
  const [agentCart, setAgentCart] = useState(null);
  const [agentItems, setAgentItems] = useState([]);

  const [loadingAgentItems, setLoadingAgentItems] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Состояние для долга
  const [paymentType, setPaymentType] = useState(""); // "", "Долги", "Предоплата"
  const [debtMonths, setDebtMonths] = useState("");
  const [firstDueDate, setFirstDueDate] = useState("");
  const [prepaymentAmount, setPrepaymentAmount] = useState("");

  // Проверяем, мобильное ли это устройство
  const [isMobile, setIsMobile] = useState(false);

  // Состояние для секции заказа внизу (мобильная/планшетная версия)
  const [isOrderSectionOpen, setIsOrderSectionOpen] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [touchStart, setTouchStart] = useState(null);
  const [swipeProgress, setSwipeProgress] = useState(0);
  const [orderTouchStart, setOrderTouchStart] = useState(null); // number | null
  const [orderSwipeProgress, setOrderSwipeProgress] = useState(0);

  const minSwipeDistance = 50;

  // Alerts delegated to parent

  // Загружаем клиентов при монтировании
  useEffect(() => {
    dispatch(fetchClientsAsync());
  }, [dispatch]);

  // Проверяем, мобильное ли это устройство
  useEffect(() => {
    const checkIsMobile = () => {
      setIsMobile(window.innerWidth < 1024);
    };

    checkIsMobile();
    window.addEventListener("resize", checkIsMobile);

    return () => {
      window.removeEventListener("resize", checkIsMobile);
    };
  }, []);

  useEffect(() => {
    onMobileViewChange?.(isMobile);
  }, [isMobile, onMobileViewChange]);

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
    if (newQuantity < 0) {
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
        setAgentCartItemsCount(updated?.items?.length || 0)
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
          setAgentCartItemsCount(updated.items.reduce((acc, item) => acc + item.quantity, 0))
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

  // Функция для обновления корзины
  const refreshCart = useCallback(async () => {
    try {
      setLoadingAgentItems(true);
      // Проверяем актуальный ID корзины из localStorage
      const storedCartId = localStorage.getItem("agentCartId");
      const cartIdToUse = storedCartId || agentCartId || agentCartIdProp;

      if (cartIdToUse) {
        const cart = await dispatch(
          getAgentCart({ agent: null, order_discount_total: "0.00" })
        ).unwrap();
        if (cart?.id) {
          setAgentCart(cart);
          setAgentItems(Array.isArray(cart.items) ? cart.items : []);
          // Обновляем ID корзины если он изменился
          if (cart.id !== agentCartId) {
            setAgentCartId(cart.id);
            localStorage.setItem("agentCartId", cart.id);
          }
        }
      }
    } catch (e) {
      console.error("Error refreshing cart:", e);
    } finally {
      setLoadingAgentItems(false);
    }
  }, [agentCartId, agentCartIdProp, dispatch]);

  // Обновляем корзину при открытии модалки, чтобы получить актуальные данные
  useEffect(() => {
    if (isOpen) {
      refreshCart();
    }
  }, [isOpen, refreshCart]);

  // Обновляем корзину при открытии мобильной секции заказа
  useEffect(() => {
    if (isMobile && isOrderSectionOpen) {
      refreshCart();
    }
  }, [isMobile, isOrderSectionOpen, refreshCart]);

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

  // Загружаем смены и кассы при монтировании
  useEffect(() => {
    dispatch(fetchShiftsAsync());
    dispatch(getCashBoxes());
  }, [dispatch]);

  // Функция для проверки и открытия смены
  const ensureShiftIsOpen = async () => {
    // Проверяем наличие открытой смены
    const openShift = shifts.find((s) => s.status === "open") || currentShift;

    if (openShift) {
      return; // Смена уже открыта
    }

    // Если смены нет, открываем её
    let availableCashBoxes = cashBoxes;
    if (!availableCashBoxes || availableCashBoxes.length === 0) {
      // Загружаем кассы, если их нет
      availableCashBoxes = await dispatch(getCashBoxes()).unwrap();
      if (!availableCashBoxes || availableCashBoxes.length === 0) {
        throw new Error(
          "Нет доступных касс. Пожалуйста, создайте кассу перед началом смены."
        );
      }
    }

    const firstCashBox = availableCashBoxes[0];
    const cashboxId = firstCashBox?.id;

    if (!cashboxId) {
      throw new Error("Не удалось определить кассу");
    }

    const cashierId = currentUser?.id || userId || profile?.id;

    if (!cashierId) {
      throw new Error("Не удалось определить кассира");
    }

    // Открываем смену с нулевой суммой
    await dispatch(
      openShiftAsync({
        cashbox: cashboxId,
        cashier: cashierId,
        opening_cash: "0",
      })
    ).unwrap();

    // Обновляем список смен
    await dispatch(fetchShiftsAsync());
  };

  const handleSubmit = async () => {
    if (!agentCartId || !selectedClient) return;
    setSubmitting(true);
    try {
      // Проверяем и открываем смену перед оформлением заказа
      await ensureShiftIsOpen();

      // Вычисляем общую сумму заказа
      let totalAmount = 0;
      for (const it of agentItems) {
        const price = Number(it?.unit_price || it?.price_snapshot || 0);
        const baseQty = Number(it?.quantity || it?.quantity_requested || 0);
        totalAmount += price * baseQty;
      }

      // Если выбран долг или предоплата, создаем сделку
      if (paymentType === "Долги" || paymentType === "Предоплата") {
        if (!debtMonths || Number(debtMonths) < 0) {
          onNotify &&
            onNotify("error", "Введите корректное количество месяцев");
          setSubmitting(false);
          return;
        }
        if (!firstDueDate) {
          onNotify && onNotify("error", "Выберите дату первого платежа");
          setSubmitting(false);
          return;
        }
        if (paymentType === "Предоплата") {
          if (!prepaymentAmount || Number(prepaymentAmount) <= 0) {
            onNotify &&
              onNotify("error", "Введите корректную сумму предоплаты");
            setSubmitting(false);
            return;
          }
          if (Number(prepaymentAmount) > totalAmount) {
            onNotify &&
              onNotify(
                "error",
                "Сумма предоплаты не может превышать общую сумму"
              );
            setSubmitting(false);
            return;
          }
        }

        // Создаем сделку
        const dealPayload = {
          clientId: selectedClient.id,
          title: `${paymentType} ${selectedClient.full_name || selectedClient.phone || "Клиент"
            }`,
          statusRu: paymentType,
          amount: totalAmount,
          debtMonths: Number(debtMonths || 0),
          first_due_date: firstDueDate,
        };

        if (paymentType === "Предоплата") {
          dealPayload.prepayment = Number(prepaymentAmount);
        }

        await dispatch(createDeal(dealPayload)).unwrap();
      }

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
      onNotify &&
        onNotify(
          "success",
          paymentType ? `Долг успешно создан` : "Заказ успешно оформлен"
        );
      // Clear local state so next open uses a new draft id from parent
      setAgentCartId(null);
      setAgentCart(null);
      setAgentItems([]);

      // Очищаем поля долга
      setPaymentType("");
      setDebtMonths("");
      setFirstDueDate("");
      setPrepaymentAmount("");

      // Закрываем мобильную секцию заказа после успешной продажи
      if (isMobile && isOrderSectionOpen) {
        setIsOrderSectionOpen(false);
      }
    } catch (e) {
      console.error("Error submitting cart:", e);
      const errorMessage =
        e?.response?.data?.shift_id?.[0] ||
        e?.message ||
        "Не удалось оформить заказ. Попробуйте ещё раз.";
      onNotify && onNotify("error", errorMessage);
    } finally {
      setSubmitting(false);
    }
  };

  // Обработка свайпа вверх для открытия секции заказа
  const handleTouchStart = (e) => {
    // Сохраняем начальную позицию касания
    const touch = e.targetTouches[0];
    setTouchStart(touch.clientY);
    setSwipeProgress(0);
  };

  const handleTouchMove = (e) => {
    if (!touchStart) return;

    // Проверяем, что касание все еще на кнопке или рядом с ней
    const button = e.target.closest(".cart-trigger-btn");
    if (!button) {
      // Если палец ушел с кнопки, сбрасываем состояние и разрешаем прокрутку
      setTouchStart(null);
      setSwipeProgress(0);
      return;
    }

    const currentY = e.targetTouches[0].clientY;
    const distance = touchStart - currentY; // Положительное значение = свайп вверх

    // Если свайп вниз (отрицательное расстояние), это прокрутка страницы - не блокируем
    if (distance < 0) {
      setTouchStart(null);
      setSwipeProgress(0);
      return; // Позволяем прокрутку страницы
    }

    // Если свайп вверх, но небольшой - показываем индикатор, но НЕ блокируем прокрутку
    // Это позволяет пользователю прокручивать страницу, если он случайно начал касание на кнопке
    if (distance > 0 && distance < minSwipeDistance) {
      const progress = Math.min((distance / minSwipeDistance) * 100, 100);
      setSwipeProgress(progress);
      // НЕ вызываем preventDefault() - позволяем прокрутку страницы
    } else if (distance >= minSwipeDistance) {
      // Если свайп достаточный вверх - это явное намерение открыть секцию
      // Только здесь блокируем прокрутку
      e.preventDefault();
      setSwipeProgress(100);
    } else {
      setSwipeProgress(0);
    }
  };

  const handleTouchEnd = (e) => {
    if (!touchStart) {
      setTouchStart(null);
      setSwipeProgress(0);
      return;
    }

    const currentY = e.changedTouches[0].clientY;
    const distance = touchStart - currentY;

    // Открываем секцию только если был достаточный свайп вверх
    if (distance > minSwipeDistance) {
      setIsOrderSectionOpen(true);
    }

    setTouchStart(null);
    setSwipeProgress(0);
  };

  // Обработка свайпа для открытия/закрытия секции заказа
  const handleOrderTouchStart = (e) => {
    // Сохраняем начальную позицию касания
    const touch = e.targetTouches[0];
    setOrderTouchStart(touch.clientY);
    setOrderSwipeProgress(0);

    // Сохраняем начальную X позицию для проверки горизонтального движения
    const section = e.target.closest(".mobile-order-section");
    if (section) {
      section.dataset.startX = touch.clientX.toString();
    }

    // Сохраняем информацию о том, где началось касание
    const contentElement = e.target.closest(".mobile-order-section-content");
    const isInsideContent = !!contentElement;

    // Если касание внутри контента, сохраняем начальную позицию скролла
    if (isInsideContent && contentElement && section) {
      const scrollTop = contentElement.scrollTop;
      const scrollHeight = contentElement.scrollHeight;
      const clientHeight = contentElement.clientHeight;
      const isScrollable = scrollHeight > clientHeight;
      const isAtTop = scrollTop <= 5; // Небольшой допуск

      // Сохраняем информацию о начальном состоянии скролла
      section.dataset.scrollStart = scrollTop.toString();
      section.dataset.isScrollable = isScrollable.toString();
      section.dataset.isAtTop = isAtTop.toString();
    }

    // Если секция открыта и контент в начале - предотвращаем pull-to-refresh
    if (isOrderSectionOpen) {
      const contentElement = e.target.closest(".mobile-order-section-content");
      const isAtTop = !contentElement || contentElement.scrollTop <= 0;
      if (isAtTop && window.scrollY <= 0) {
        // Предотвращаем pull-to-refresh при начале касания в начале страницы
        e?.preventDefault?.();
      }
    }
  };

  const handleOrderTouchMove = (e) => {
    if (!orderTouchStart) return;

    // Проверяем, что касание в области секции заказа или кнопки корзины
    const section = e.target.closest(".mobile-order-section");
    const button = e.target.closest(".cart-trigger-btn");
    const container = e.target.closest(".cart-trigger-container");

    // Если касание не в области секции или кнопки, сбрасываем
    if (!section && !button && !container) {
      setOrderTouchStart(null);
      setOrderSwipeProgress(0);
      return;
    }

    const currentY = e.targetTouches[0].clientY;
    const distance = currentY - orderTouchStart; // Положительное значение = свайп вниз, отрицательное = свайп вверх

    // Если секция закрыта - обрабатываем свайп вверх для открытия
    if (!isOrderSectionOpen) {
      const swipeUp = -distance; // Инвертируем для свайпа вверх

      // Если свайп вниз, это прокрутка страницы - не блокируем
      if (distance > 0) {
        setOrderTouchStart(null);
        setOrderSwipeProgress(0);
        return; // Позволяем прокрутку страницы
      }

      // Если свайп вверх, но небольшой - показываем индикатор, но НЕ блокируем прокрутку
      if (swipeUp > 0 && swipeUp < minSwipeDistance) {
        const progress = Math.min((swipeUp / minSwipeDistance) * 100, 100);
        setOrderSwipeProgress(progress);
        // НЕ вызываем preventDefault() - позволяем прокрутку страницы
      } else if (swipeUp >= minSwipeDistance) {
        // Если свайп достаточный вверх - это явное намерение открыть секцию
        // Только здесь блокируем прокрутку
        e.preventDefault();
        setOrderSwipeProgress(100);
      } else {
        setOrderSwipeProgress(0);
      }
      return;
    }

    // Если секция открыта - обрабатываем свайп вниз для закрытия
    // Сначала проверяем, где именно происходит касание
    const contentElement = e.target.closest(".mobile-order-section-content");
    const isInsideContent = !!contentElement;

    // Если касание внутри контента - проверяем, можно ли скроллить
    if (isInsideContent && contentElement) {
      const scrollTop = contentElement.scrollTop;
      const scrollHeight = contentElement.scrollHeight;
      const clientHeight = contentElement.clientHeight;
      const isScrollable = scrollHeight > clientHeight;
      const isAtTop = scrollTop <= 5; // Небольшой допуск

      // Получаем информацию о начальном состоянии скролла из элемента секции
      const section = e.target.closest(".mobile-order-section");
      const scrollStart = section
        ? parseFloat(section.dataset.scrollStart || "0")
        : 0;
      const wasAtTop = section ? section.dataset.isAtTop === "true" : true;
      const hasScrolled = Math.abs(scrollTop - scrollStart) > 3; // Если произошел скролл

      // Если произошел скролл контента - это не свайп для закрытия
      if (hasScrolled) {
        setOrderSwipeProgress(0);
        return; // Позволяем скролл контента
      }

      // Если свайп вверх (отрицательное расстояние) - это скролл контента вверх
      if (distance < 0) {
        setOrderSwipeProgress(0);
        return; // Позволяем скролл контента
      }

      // Если свайп вниз и контент НЕ в начале - это скролл контента вниз
      if (distance > 0 && !isAtTop) {
        setOrderSwipeProgress(0);
        return; // Позволяем скролл контента
      }

      // Если контент скроллируемый и не в начале - не закрываем
      if (isScrollable && !isAtTop) {
        setOrderSwipeProgress(0);
        return;
      }

      // Если свайп вниз и контент в начале - это может быть закрытие секции
      // Но только если свайп достаточно большой, вертикальный и явно направлен вниз
      if (distance > 0 && isAtTop && wasAtTop) {
        // Проверяем, что это действительно вертикальный свайп (не горизонтальный)
        const touch = e.targetTouches[0];
        const startX = section
          ? parseFloat(section.dataset.startX || "0")
          : touch.clientX;
        const deltaX = Math.abs(touch.clientX - startX);
        const deltaY = Math.abs(distance);

        // Если горизонтальное движение больше вертикального - это не свайп для закрытия
        if (deltaX > deltaY * 0.5) {
          setOrderSwipeProgress(0);
          return;
        }

        // Проверяем, что это действительно свайп для закрытия, а не случайное движение
        // Блокируем только если свайп достаточно большой
        if (distance >= minSwipeDistance) {
          e.preventDefault(); // Предотвращаем pull-to-refresh
          setOrderSwipeProgress(100);
        } else {
          // Небольшой свайп - показываем индикатор, но не блокируем скролл
          const progress = Math.min((distance / minSwipeDistance) * 100, 100);
          setOrderSwipeProgress(progress);
        }
        return;
      }
    } else {
      // Если касание не внутри контента (например, на границе секции)
      // Если свайп вверх (отрицательное расстояние), это прокрутка контента секции - не блокируем
      if (distance < 0) {
        setOrderSwipeProgress(0);
        return;
      }

      // Если свайп вниз - проверяем, прокручен ли контент
      const contentEl = section?.querySelector(".mobile-order-section-content");
      const isAtTop = !contentEl || contentEl.scrollTop <= 0;

      // Если контент прокручен вниз, разрешаем прокрутку
      if (!isAtTop) {
        setOrderSwipeProgress(0);
        return; // Позволяем прокрутку контента
      }

      // Если секция открыта и контент в начале - предотвращаем pull-to-refresh
      if (distance > 0) {
        e.preventDefault(); // Предотвращаем pull-to-refresh и прокрутку страницы

        // Если свайп небольшой - показываем индикатор
        if (distance < minSwipeDistance) {
          const progress = Math.min((distance / minSwipeDistance) * 100, 100);
          setOrderSwipeProgress(progress);
        } else {
          // Если свайп достаточный вниз - это явное намерение закрыть секцию
          setOrderSwipeProgress(100);
        }
      } else {
        setOrderSwipeProgress(0);
      }
    }
  };

  const handleOrderTouchEnd = (e) => {
    if (!orderTouchStart) {
      setOrderTouchStart(null);
      setOrderSwipeProgress(0);
      return;
    }

    const currentY = e.changedTouches[0].clientY;
    const distance = currentY - orderTouchStart;

    // Если секция закрыта - открываем при свайпе вверх
    if (!isOrderSectionOpen) {
      const swipeUp = -distance; // Инвертируем для свайпа вверх
      if (swipeUp > minSwipeDistance) {
        setIsOrderSectionOpen(true);
      }
    } else {
      // Если секция открыта - проверяем, можно ли закрывать
      const contentElement = e.target.closest(".mobile-order-section-content");
      const isInsideContent = !!contentElement;

      // Если касание было внутри контента, проверяем, был ли скролл
      if (isInsideContent && contentElement) {
        const section = e.target.closest(".mobile-order-section");
        const scrollStart = section
          ? parseFloat(section.dataset.scrollStart || "0")
          : 0;
        const scrollTop = contentElement.scrollTop;
        const hasScrolled = Math.abs(scrollTop - scrollStart) > 3;

        // Если был скролл контента - не закрываем секцию
        if (hasScrolled) {
          setOrderTouchStart(null);
          setOrderSwipeProgress(0);
          return;
        }

        // Проверяем, что контент в начале
        const isAtTop = scrollTop <= 5;
        if (!isAtTop) {
          setOrderTouchStart(null);
          setOrderSwipeProgress(0);
          return;
        }
      }

      // Закрываем только если свайп вниз достаточно большой
      if (distance > minSwipeDistance) {
        handleCloseOrderSection();
      }
    }

    setOrderTouchStart(null);
    setOrderSwipeProgress(0);

    // Очищаем временные данные
    const section = e.target.closest(".mobile-order-section");
    if (section) {
      delete section.dataset.scrollStart;
      delete section.dataset.isScrollable;
      delete section.dataset.isAtTop;
      delete section.dataset.startX;
    }
  };

  const handleCloseOrderSection = () => {
    if (!isOrderSectionOpen) return; // Если уже закрыта, ничего не делаем

    setIsClosing(true);
    setTimeout(() => {
      setIsOrderSectionOpen(false);
      setIsClosing(false);
      // Восстанавливаем прокрутку страницы после закрытия
      document.body.style.overflow = "";
      document.body.style.position = "";
      document.body.style.top = "";
      document.body.style.width = "";
    }, 300);
  };

  // Блокируем задний фон и прокрутку когда секция открыта
  useEffect(() => {
    if (!isMobile) return;

    if (isOrderSectionOpen) {
      // Сохраняем текущую позицию прокрутки
      const scrollY = window.scrollY;
      // Блокируем прокрутку страницы
      document.body.style.position = "fixed";
      document.body.style.top = `-${scrollY}px`;
      document.body.style.width = "100%";
      document.body.style.overflow = "hidden";
      // Блокируем pull-to-refresh
      document.body.style.overscrollBehaviorY = "contain";
    } else {
      // Восстанавливаем прокрутку
      const scrollY = document.body.style.top;
      document.body.style.position = "";
      document.body.style.top = "";
      document.body.style.width = "";
      document.body.style.overflow = "";
      document.body.style.overscrollBehaviorY = "";
      if (scrollY) {
        window.scrollTo(0, parseInt(scrollY || "0") * -1);
      }
    }

    return () => {
      // Очистка при размонтировании
      document.body.style.position = "";
      document.body.style.top = "";
      document.body.style.width = "";
      document.body.style.overflow = "";
      document.body.style.overscrollBehaviorY = "";
    };
  }, [isOrderSectionOpen, isMobile]);
  
  // Список товаров в корзине (переиспользуемый компонент)
  const cartItemsList = (
    <div className="cart-column cart-items-column">
      <div className="cart-items-section">
        {(agentItems || []).length === 0 &&
          (cartItemsLocal || []).length === 0 ? (
          <div className="empty-cart">
            <ShoppingCart className="mx-auto" size={64} />
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
              !agentCart || cartStatus === "draft" || cartStatus === "active";
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
    </div>
  );

  // Секция заказа (выбор клиента + итог) - всегда рендерится для мобильных/планшетов
  const orderSectionContent = (
    <div className="cart-column cart-order-column">
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
        paymentType={paymentType}
        onPaymentTypeChange={setPaymentType}
        debtMonths={debtMonths}
        onDebtMonthsChange={setDebtMonths}
        firstDueDate={firstDueDate}
        onFirstDueDateChange={setFirstDueDate}
        prepaymentAmount={prepaymentAmount}
        onPrepaymentAmountChange={setPrepaymentAmount}
      />
    </div>
  );

  return (
    <>
      {/* Модалка корзины - открывается при нажатии на кнопку корзины в ProductionCatalog */}
      {isOpen && (
        <div
          className="cart-modal-overlay z-100!"
          onClick={(e) => {
            // Закрываем модалку только при клике на overlay, а не на контент
            if (e.target === e.currentTarget) {
              if (onClose) {
                onClose();
              } else if (onOpenChange) {
                onOpenChange(false);
              }
            }
          }}
        >
          <div
            className="cart-modal-content"
            onClick={(e) => e.stopPropagation()}
          >
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

                <div className="cart-content">
                  {/* Левая колонка - товары в корзине */}
                  {cartItemsList}

                  {/* Правая колонка - выбор клиента и итог (только для десктопа) */}
                  {!isMobile && (
                    <div className="cart-column cart-order-column desktop-only">
                      {orderSectionContent}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Overlay для блокировки заднего фона - для мобильных/планшетов */}
      {isMobile && isOrderSectionOpen && !isClosing && (
        <div
          className="mobile-order-overlay z-50!"
          onClick={handleCloseOrderSection}
        />
      )}

      {/* Секция заказа внизу экрана - для мобильных/планшетов */}
      {isMobile && (
        <div
          className={`mobile-order-section ${isOrderSectionOpen ? "open" : ""
            } ${isClosing ? "closing" : ""} z-50!`}
          onTouchStart={handleOrderTouchStart}
          onTouchMove={handleOrderTouchMove}
          onTouchEnd={handleOrderTouchEnd}
          style={{
            transform: (() => {
              // Если секция закрыта и нет прогресса свайпа - полностью скрыта
              if (
                !isOrderSectionOpen &&
                !isClosing &&
                orderSwipeProgress === 0
              ) {
                return "translateY(100%)";
              }

              // Если секция закрыта и свайп вверх - показываем прогресс открытия
              if (!isOrderSectionOpen && !isClosing && orderSwipeProgress > 0) {
                const progress = orderSwipeProgress / 100;
                const maxHeight = window.innerHeight * 0.85 - 70; // 85vh - 70px для кнопки
                return `translateY(${maxHeight * (1 - progress)}px)`;
              }

              // Если секция открыта и нет прогресса свайпа - полностью видна
              if (
                isOrderSectionOpen &&
                !isClosing &&
                orderSwipeProgress === 0
              ) {
                return "translateY(0)";
              }

              // Если секция открыта и свайп вниз - показываем прогресс закрытия
              if (isOrderSectionOpen && !isClosing && orderSwipeProgress > 0) {
                return `translateY(${Math.min(
                  orderSwipeProgress * 0.5,
                  50
                )}px)`;
              }

              // По умолчанию
              return isOrderSectionOpen ? "translateY(0)" : "translateY(100%)";
            })(),
            transition:
              orderSwipeProgress === 0 && !isClosing
                ? "transform 0.3s ease-out"
                : "none",
          }}
        >
          {isOrderSectionOpen && !isClosing && (
            <div className="mobile-order-section-content">
              {/* Кнопка закрытия в самом верху */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignContent: "center",
                  marginBottom: "16px",
                }}
              >
                <h2
                  style={{
                    display: "flex",
                    alignItems: "center",
                    fontSize: "24px",
                    fontWeight: "bold",
                  }}
                >
                  Корзина
                </h2>
                <button
                  onClick={handleCloseOrderSection}
                  className="close-order-section-btn"
                  type="button"
                  title="Закрыть"
                  style={{
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    padding: "8px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    borderRadius: "4px",
                    transition: "background 0.2s ease",
                    color: "#666",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "#f0f0f0";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "none";
                  }}
                >
                  <X size={24} />
                </button>
              </div>

              {/* Товары в корзине */}
              {cartItemsList}

              {/* Выбор клиента и итог */}
              {orderSectionContent}
            </div>
          )}
        </div>
      )}

      {/* Кнопка корзины внизу экрана - для мобильных/планшетов */}
      {isMobile &&
        (() => {
          // Вычисляем итог корзины по той же логике, что и в OrderSummary
          const usingServer =
            Array.isArray(agentItems) && agentItems.length > 0;
          let total = 0;

          if (usingServer) {
            for (const it of agentItems) {
              const price = Number(it?.unit_price || it?.price_snapshot || 0);
              const baseQty = Number(
                it?.quantity || it?.quantity_requested || 0
              );
              total += price * baseQty;
            }
          } else {
            total = subtotalLocal || 0;
          }

          return (
            <div className="cart-trigger-container">
              <button
                className="cart-trigger-btn"
                onClick={() => {
                  if (!isOrderSectionOpen) {
                    setIsOrderSectionOpen(true);
                  }
                }}
                onTouchStart={
                  !isOrderSectionOpen ? handleTouchStart : undefined
                }
                onTouchMove={!isOrderSectionOpen ? handleTouchMove : undefined}
                onTouchEnd={!isOrderSectionOpen ? handleTouchEnd : undefined}
                type="button"
                style={{
                  transform:
                    !isOrderSectionOpen && swipeProgress > 0
                      ? `translateY(-${Math.min(swipeProgress * 0.5, 20)}px)`
                      : "translateY(0)",
                  transition:
                    swipeProgress === 0 ? "transform 0.2s ease" : "none",
                }}
              >
                <div className="cart-trigger-left">
                  <ShoppingCart size={20} />
                  <div className="cart-trigger-info">
                    <span className="cart-trigger-label">Корзина</span>
                    {total > 0 && (
                      <span className="cart-trigger-total">
                        К оплате: {total.toLocaleString()}.00 KGS
                      </span>
                    )}
                  </div>
                </div>
                <div className="cart-trigger-right">
                  {totalItemsCount > 0 && (
                    <span className="cart-badge">{totalItemsCount}</span>
                  )}
                  {!isOrderSectionOpen && (
                    <ChevronUp
                      size={20}
                      className="swipe-hint-icon"
                      style={{
                        opacity:
                          swipeProgress > 0
                            ? Math.min(swipeProgress / 50, 1)
                            : 0.6,
                        transform:
                          swipeProgress > 0
                            ? `translateY(-${swipeProgress * 0.2}px)`
                            : "translateY(0)",
                        transition:
                          swipeProgress === 0
                            ? "opacity 0.2s ease, transform 0.2s ease"
                            : "none",
                      }}
                    />
                  )}
                </div>
              </button>
            </div>
          );
        })()}
    </>
  );
};

export default Cart;
