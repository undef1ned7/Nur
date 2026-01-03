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
  ChevronUp,
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
import { createDeal } from "../../../../store/creators/saleThunk";
import { useUser } from "../../../../store/slices/userSlice";
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

const RequestSummary = ({
  items,
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
  selectedClient,
}) => {
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

      {/* Выбор типа оплаты */}
      {selectedClient && (
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
        type="button"
        className="buy-btn"
        onClick={onSubmit}
        disabled={submitting || !items || items.length === 0}
        style={{ marginTop: "16px" }}
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
  isOpen = false,
  onOpenChange,
  totalItemsCount = 0,
}) => {
  const dispatch = useDispatch();
  const {
    list: clients,
    loading: clientsLoading,
    creating,
    error: clientError,
  } = useClient();
  const { company } = useUser();
  
  const [submitting, setSubmitting] = useState(false);
  const [selectedClient, setSelectedClient] = useState(null);
  const [isClientSelectorOpen, setIsClientSelectorOpen] = useState(false);
  const [isCreateMode, setIsCreateMode] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [formError, setFormError] = useState("");
  
  // Состояние для долга
  const [paymentType, setPaymentType] = useState(""); // "", "Долги", "Предоплата"
  const [debtMonths, setDebtMonths] = useState("");
  const [firstDueDate, setFirstDueDate] = useState("");
  const [prepaymentAmount, setPrepaymentAmount] = useState("");

  // Состояние для секции заказа внизу (мобильная/планшетная версия)
  const [isOrderSectionOpen, setIsOrderSectionOpen] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [touchStart, setTouchStart] = useState(null);
  const [swipeProgress, setSwipeProgress] = useState(0);
  const [orderTouchStart, setOrderTouchStart] = useState(null); // number | null
  const [orderSwipeProgress, setOrderSwipeProgress] = useState(0);

  const minSwipeDistance = 50;

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
    
    // Если секция открыта и контент в начале - предотвращаем pull-to-refresh
    if (isOrderSectionOpen) {
      const contentElement = e.target.closest(".mobile-order-section-content");
      const isAtTop = !contentElement || contentElement.scrollTop <= 0;
      if (isAtTop && window.scrollY <= 0) {
        // Предотвращаем pull-to-refresh при начале касания в начале страницы
        e.preventDefault();
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
    if (isInsideContent) {
      const scrollTop = contentElement.scrollTop;
      const scrollHeight = contentElement.scrollHeight;
      const clientHeight = contentElement.clientHeight;
      const isAtTop = scrollTop <= 0;
      const isAtBottom = scrollTop + clientHeight >= scrollHeight - 1; // Небольшой допуск для округления
      
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
      
      // Если свайп вниз и контент в начале - это может быть закрытие секции
      // Но только если свайп достаточно большой и явно направлен вниз
      if (distance > 0 && isAtTop) {
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
      // Если секция открыта - закрываем при свайпе вниз
      if (distance > minSwipeDistance) {
        handleCloseOrderSection();
      }
    }

    setOrderTouchStart(null);
    setOrderSwipeProgress(0);
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

  // Проверяем, мобильное ли это устройство
  const [isMobile, setIsMobile] = useState(false);

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

  // Выбор существующего клиента
  const handleSelectClient = (client) => {
    setSelectedClient(client);
    setIsClientSelectorOpen(false);
    setSearchQuery("");
  };

  // Создание нового клиента
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
      // Вычисляем общую сумму заказа
      let totalAmount = 0;
      for (const it of items) {
        const price = Number(it?.price_snapshot || it?.unit_price || 0);
        const baseQty = Number(it?.quantity_requested || it?.quantity || 0);
        totalAmount += price * baseQty;
      }

      // Если выбран долг или предоплата, создаем сделку
      if (paymentType === "Долги" || paymentType === "Предоплата") {
        if (!selectedClient?.id) {
          onNotify && onNotify("error", "Выберите клиента для создания долга");
          setSubmitting(false);
          return;
        }

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
          title: `${paymentType} ${
            selectedClient.full_name || selectedClient.phone || "Клиент"
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

      // Очищаем поля долга
      setPaymentType("");
      setDebtMonths("");
      setFirstDueDate("");
      setPrepaymentAmount("");

      onNotify &&
        onNotify(
          "success",
          paymentType
            ? `Долг успешно создан и запрос на ${items.length} товар(ов) отправлен!`
            : `Запрос на ${items.length} товар(ов) успешно отправлен!`
        );

      // Закрываем мобильную секцию заказа после успешной отправки
      if (isMobile && isOrderSectionOpen) {
        setIsOrderSectionOpen(false);
      }
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

  // Компонент ClientSelector
  const ClientSelector = () => (
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
                  <span className="client-phone">{selectedClient.address}</span>
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
                              selectedClient?.address === client?.address
                            ? "selected"
                            : ""
                        }`}
                        onClick={() => handleSelectClient(client)}
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

  // Секция заказа (выбор клиента + итог) - всегда рендерится для мобильных/планшетов
  const orderSectionContent = (
    <div className="cart-column cart-order-column">
      <ClientSelector />

      <RequestSummary
        items={items}
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
        selectedClient={selectedClient}
      />
    </div>
  );

  // Проверяем, можно ли редактировать корзину (только если статус draft)
  // Для этого нужно проверить статус корзины, но пока что предполагаем, что это всегда draft
  const isEditable = true; // TODO: проверять статус корзины

  // Список товаров в корзине (переиспользуемый компонент)
  const cartItemsList = (
    <div className="cart-column cart-items-column">
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
    </div>
  );

  return (
    <>
      {/* Модалка корзины - открывается при нажатии на кнопку корзины в ProductionRequest */}
      {isOpen && (
        <div 
          className="cart-modal-overlay" 
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
                  <h1>Запрос товаров</h1>
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
          className="mobile-order-overlay"
          onClick={handleCloseOrderSection}
        />
      )}

      {/* Секция заказа внизу экрана - для мобильных/планшетов */}
      {isMobile && (
        <div
          className={`mobile-order-section ${
            isOrderSectionOpen ? "open" : ""
          } ${isClosing ? "closing" : ""}`}
          onTouchStart={handleOrderTouchStart}
          onTouchMove={handleOrderTouchMove}
          onTouchEnd={handleOrderTouchEnd}
          style={{
            transform: (() => {
              // Если секция закрыта и нет прогресса свайпа - полностью скрыта
              if (!isOrderSectionOpen && !isClosing && orderSwipeProgress === 0) {
                return "translateY(100%)";
              }
              
              // Если секция закрыта и свайп вверх - показываем прогресс открытия
              if (!isOrderSectionOpen && !isClosing && orderSwipeProgress > 0) {
                const progress = orderSwipeProgress / 100;
                const maxHeight = window.innerHeight * 0.85 - 70; // 85vh - 70px для кнопки
                return `translateY(${maxHeight * (1 - progress)}px)`;
              }
              
              // Если секция открыта и нет прогресса свайпа - полностью видна
              if (isOrderSectionOpen && !isClosing && orderSwipeProgress === 0) {
                return "translateY(0)";
              }
              
              // Если секция открыта и свайп вниз - показываем прогресс закрытия
              if (isOrderSectionOpen && !isClosing && orderSwipeProgress > 0) {
                return `translateY(${Math.min(orderSwipeProgress * 0.5, 50)}px)`;
              }
              
              // По умолчанию
              return isOrderSectionOpen ? "translateY(0)" : "translateY(100%)";
            })(),
            transition:
              orderSwipeProgress === 0 && !isClosing ? "transform 0.3s ease-out" : "none",
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
                  Запрос товаров
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
      {isMobile && (() => {
        // Вычисляем итог запроса по той же логике, что и в RequestSummary
        let total = 0;
        
        if (Array.isArray(items) && items.length > 0) {
          for (const it of items) {
            const price = Number(it?.price_snapshot || it?.unit_price || 0);
            const baseQty = Number(it?.quantity_requested || it?.quantity || 0);
            total += price * baseQty;
          }
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
              onTouchStart={!isOrderSectionOpen ? handleTouchStart : undefined}
              onTouchMove={!isOrderSectionOpen ? handleTouchMove : undefined}
              onTouchEnd={!isOrderSectionOpen ? handleTouchEnd : undefined}
              type="button"
              style={{
                transform:
                  !isOrderSectionOpen && swipeProgress > 0
                    ? `translateY(-${Math.min(swipeProgress * 0.5, 20)}px)`
                    : "translateY(0)",
                transition: swipeProgress === 0 ? "transform 0.2s ease" : "none",
              }}
            >
              <div className="cart-trigger-left">
                <ShoppingCart size={20} />
                <div className="cart-trigger-info">
                  <span className="cart-trigger-label">Запрос</span>
                  {total > 0 && (
                    <span className="cart-trigger-total">
                      К оплате: {total.toLocaleString()}.00 сом
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
                      opacity: swipeProgress > 0 ? Math.min(swipeProgress / 50, 1) : 0.6,
                      transform: swipeProgress > 0 ? `translateY(-${swipeProgress * 0.2}px)` : "translateY(0)",
                      transition: swipeProgress === 0 ? "opacity 0.2s ease, transform 0.2s ease" : "none",
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

export default RequestCart;
