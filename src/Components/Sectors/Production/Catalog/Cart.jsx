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

const CartItem = ({ item, onUpdateQuantity, onRemoveItem }) => {
  console.log(item);

  const [quantity, setQuantity] = useState(item.quantity);

  const handleQuantityChange = (newQuantity) => {
    if (newQuantity < 1) return;
    setQuantity(newQuantity);
    onUpdateQuantity(item.id, newQuantity);
  };

  const handleRemove = () => {
    onRemoveItem(item.id);
  };

  return (
    <div className="cart-item">
      <div className="item-image">
        <img src={item.product?.images[0]} alt={item.product.name} />
      </div>

      <div className="item-details">
        <h3 className="item-name">{item.product.name}</h3>
        <p className="item-category">{item.product.category}</p>
        <div className="item-price">
          {item.product.price.toLocaleString()} KGS
        </div>
        {/* <div className="item-rating">
          <Star size={14} fill="#FFD700" />
          <span>{item.product.rating}</span>
        </div> */}

        <div className="item-actions">
          <div className="quantity-controls">
            <button
              className="quantity-btn"
              onClick={() => handleQuantityChange(quantity - 1)}
              disabled={quantity <= 1}
            >
              <Minus size={16} />
            </button>
            <span className="quantity">{quantity}</span>
            <button
              className="quantity-btn"
              onClick={() => handleQuantityChange(quantity + 1)}
            >
              <Plus size={16} />
            </button>
          </div>

          <button className="remove-btn" onClick={handleRemove}>
            <X size={16} />
          </button>
        </div>

        <div className="item-info">
          <p className="total">Общий: {item.total.toLocaleString()}.00</p>
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
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  console.log(clients);

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
            <div className="search-box">
              <Search size={16} />
              <input
                type="text"
                placeholder="Поиск по имени или телефону…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

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
          </div>
        )}
      </div>
    </div>
  );
};

const OrderSummary = ({ selectedClient }) => {
  const cartItems = useSelector(selectCartItems);
  const totalQuantity = useSelector(selectCartItemsCount);
  const subtotal = useSelector(selectCartTotal);
  const discount = 700; // Моковая скидка
  const total = subtotal - discount;

  return (
    <div className="order-summary">
      <h2>Сумма заказа</h2>

      <div className="summary-details">
        <div className="summary-row">
          <span>
            Общее количество: {totalQuantity} товара ({totalQuantity} шт)
          </span>
        </div>
        <div className="summary-row">
          <span>Стоимость: {subtotal.toLocaleString()}.00 KGS</span>
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
        disabled={!selectedClient || (cartItems || []).length === 0}
      >
        <ShoppingCart size={20} />
        Оформить ({totalQuantity})
      </button>
    </div>
  );
};

const Cart = () => {
  const dispatch = useDispatch();
  const { list: clients, loading: clientsLoading } = useClient();
  console.log(clients);

  // Redux селекторы
  const cartItems = useSelector(selectCartItems);
  const selectedClient = useSelector(selectSelectedClient);

  // Загружаем клиентов при монтировании
  useEffect(() => {
    dispatch(fetchClientsAsync());
  }, [dispatch]);

  const handleUpdateQuantity = (itemId, newQuantity) => {
    dispatch(updateQuantity({ itemId, quantity: newQuantity }));
  };

  const handleRemoveItem = (itemId) => {
    dispatch(removeFromCart(itemId));
  };

  const handleClientSelect = (client) => {
    dispatch(selectClient(client));
  };

  return (
    <div className="cart-page">
      <div className="cart-container">
        <div className="cart-header">
          <h1>Корзина</h1>
        </div>

        <div className="cart-content">
          <div className="cart-items-section">
            {(cartItems || []).length === 0 ? (
              <div className="empty-cart">
                <ShoppingCart size={64} />
                <h3>Корзина пуста</h3>
                <p>Добавьте товары в корзину</p>
              </div>
            ) : (
              (cartItems || []).map((item) => (
                <CartItem
                  key={item.id}
                  item={item}
                  onUpdateQuantity={handleUpdateQuantity}
                  onRemoveItem={handleRemoveItem}
                />
              ))
            )}
          </div>

          <div className="order-section">
            <ClientSelector
              selectedClient={selectedClient}
              onClientSelect={handleClientSelect}
              clients={clients || []}
              loading={clientsLoading}
            />

            <OrderSummary selectedClient={selectedClient} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Cart;
