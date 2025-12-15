import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import {
  ArrowLeft,
  Menu,
  UserPlus,
  Search,
  Trash2,
  Plus,
  Minus,
  X,
} from "lucide-react";
import { useProducts } from "../../../../store/slices/productSlice";
import { fetchProductsAsync } from "../../../../store/creators/productCreators";
import { useClient } from "../../../../store/slices/ClientSlice";
import { fetchClientsAsync } from "../../../../store/creators/clientCreators";
import { useSale } from "../../../../store/slices/saleSlice";
import { useShifts } from "../../../../store/slices/shiftSlice";
import {
  fetchShiftsAsync,
  closeShiftAsync,
} from "../../../../store/creators/shiftThunk";
import {
  startSale,
  manualFilling,
  updateManualFilling,
  deleteProductInCart,
  addCustomItem,
} from "../../../../store/creators/saleThunk";
import useBarcodeToCart from "../../../pages/Sell/useBarcodeToCart";
import MenuModal from "./components/MenuModal";
import CustomerModal from "./components/CustomerModal";
import PaymentPage from "./PaymentPage";
import ShiftPage from "./ShiftPage";
import DebtPaymentModal from "./components/DebtPaymentModal";
import ReceiptsModal from "./components/ReceiptsModal";
import CustomServiceModal from "../../../pages/Sell/components/CustomServiceModal";
import DiscountModal from "../../../pages/Sell/components/DiscountModal";
import AlertModal from "../../../common/AlertModal/AlertModal";
import { useDebounce } from "../../../../hooks/useDebounce";
import "./CashierPage.scss";

const CashierPage = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { list: products } = useProducts();
  const { list: clients } = useClient();
  const { start: currentSale, loading: saleLoading } = useSale();
  const { shifts } = useShifts();

  // Получаем текущую открытую смену (мемоизируем, чтобы избежать лишних пересчетов)
  const openShift = React.useMemo(
    () => shifts.find((s) => s.status === "open"),
    [shifts]
  );
  const openShiftId = openShift?.id;

  const [searchTerm, setSearchTerm] = useState("");
  const [cart, setCart] = useState([]);
  const cartOrderRef = React.useRef([]); // Сохраняем порядок элементов корзины
  const [cartQuantities, setCartQuantities] = useState({}); // Локальные значения количества для каждого товара
  const [showMenuModal, setShowMenuModal] = useState(false);
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [showPaymentPage, setShowPaymentPage] = useState(false);
  const [showShiftPage, setShowShiftPage] = useState(false);
  const [showDebtModal, setShowDebtModal] = useState(false);
  const [showReceiptsModal, setShowReceiptsModal] = useState(false);
  const [showCloseShiftModal, setShowCloseShiftModal] = useState(false);
  const [closingCash, setClosingCash] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [showCustomServiceModal, setShowCustomServiceModal] = useState(false);
  const [showDiscountModal, setShowDiscountModal] = useState(false);
  const [discountValue, setDiscountValue] = useState("");
  const [customService, setCustomService] = useState({
    name: "",
    price: "",
    quantity: "1",
  });
  const [alertModal, setAlertModal] = useState({
    open: false,
    type: "error",
    title: "",
    message: "",
  });

  // Функция для показа AlertModal
  const showAlert = (type, title, message) => {
    setAlertModal({
      open: true,
      type,
      title,
      message,
    });
  };

  const closeAlert = () => {
    setAlertModal((prev) => ({ ...prev, open: false }));
  };

  // Функция для обновления продажи после запросов
  const refreshSale = async () => {
    if (currentSale?.id) {
      try {
        const currentDiscount = currentSale?.order_discount_total || 0;
        await dispatch(
          startSale({
            discount_total: currentDiscount,
            shift: openShiftId || null,
          })
        );
      } catch (error) {
        console.error("Ошибка при обновлении продажи:", error);
      }
    }
  };

  // Debounced функция для обновления общей скидки
  const debouncedDiscount = useDebounce((discount) => {
    if (!currentSale?.id) return;
    dispatch(
      startSale({
        discount_total: parseFloat(discount) || 0,
        shift: openShiftId || null,
      })
    );
  }, 600);

  const handleDiscountChange = (discount) => {
    const discountNum = parseFloat(discount) || 0;
    debouncedDiscount(discountNum);
  };

  // Функция для добавления доп. услуги
  const handleAddCustomService = async () => {
    try {
      if (!customService.name.trim()) {
        showAlert("error", "Ошибка", "Введите название услуги");
        return;
      }
      if (!customService.price.trim() || Number(customService.price) <= 0) {
        showAlert("error", "Ошибка", "Введите корректную цену услуги");
        return;
      }
      if (!currentSale?.id) {
        showAlert(
          "error",
          "Ошибка",
          "Корзина не инициализирована. Пожалуйста, подождите..."
        );
        return;
      }
      await dispatch(
        addCustomItem({
          id: currentSale.id,
          name: customService.name.trim(),
          price: customService.price.trim(),
          quantity: Number(customService.quantity) || 1,
        })
      ).unwrap();
      await refreshSale();
      setCustomService({ name: "", price: "", quantity: "1" });
      setShowCustomServiceModal(false);
      showAlert("success", "Успех", "Дополнительная услуга успешно добавлена!");
    } catch (error) {
      console.error("Ошибка при добавлении дополнительной услуги:", error);
      showAlert(
        "error",
        "Ошибка",
        error?.data?.detail ||
          error?.message ||
          "Ошибка при добавлении дополнительной услуги"
      );
    }
  };

  // Автодобавление товара по сканеру штрих-кода
  const { error: barcodeScanError } = useBarcodeToCart(currentSale?.id, {
    onError: (msg) => {
      showAlert(
        "error",
        "Ошибка сканирования",
        msg || "Товар с таким штрих-кодом не найден"
      );
    },
    onAdded: () => {
      // Товар успешно добавлен, корзина обновится автоматически через useEffect
      // Можно добавить визуальную индикацию успешного добавления
    },
    discount_total: 0,
    shift: openShiftId || null,
  });

  // Инициализация данных при первой загрузке
  useEffect(() => {
    dispatch(fetchProductsAsync({ page: 1 }));
    dispatch(fetchClientsAsync());
    dispatch(fetchShiftsAsync());
  }, [dispatch]);

  // Начинаем новую продажу, если её еще нет
  useEffect(() => {
    if (!currentSale && openShiftId !== undefined) {
      dispatch(
        startSale({
          discount_total: 0,
          shift: openShiftId || null,
        })
      );
    }
  }, [dispatch, currentSale, openShiftId]);

  // Синхронизируем локальную корзину с данными из API, сохраняя порядок
  useEffect(() => {
    if (currentSale) {
      // startSale возвращает объект с полем items напрямую, а не cart.items
      const items = currentSale.items || currentSale.cart?.items || [];

      if (items.length > 0) {
        const apiCart = items.map((item) => ({
          id: item.product || item.product_id,
          itemId: item.id, // ID элемента в корзине (для идентификации)
          name: item.product_name || item.display_name || item.name || "—",
          price: parseFloat(item.unit_price || item.price || 0),
          quantity: item.quantity || 0,
          unit: item.unit || "шт",
          image:
            item.primary_image_url ||
            (item.images && item.images[0]?.image_url) ||
            null,
        }));

        // Сохраняем порядок элементов: используем сохраненный порядок
        // Убираем дубликаты по itemId (уникальный ID элемента в корзине)
        const seenItemIds = new Set();
        const uniqueApiCart = apiCart.filter((item) => {
          if (item.itemId && seenItemIds.has(item.itemId)) {
            return false; // Пропускаем дубликаты по itemId
          }
          if (item.itemId) {
            seenItemIds.add(item.itemId);
          }
          return true;
        });

        const orderedCart = [];
        const processedProductIds = new Set();

        // Если у нас есть сохраненный порядок, используем его
        if (cartOrderRef.current.length > 0) {
          // Сначала добавляем элементы в сохраненном порядке
          cartOrderRef.current.forEach((savedProductId) => {
            const item = uniqueApiCart.find(
              (cartItem) => cartItem.id === savedProductId
            );
            if (item && !processedProductIds.has(item.id)) {
              orderedCart.push(item);
              processedProductIds.add(item.id);
            }
          });
        }

        // Затем добавляем новые элементы, которых нет в сохраненном порядке
        uniqueApiCart.forEach((item) => {
          if (!processedProductIds.has(item.id)) {
            orderedCart.push(item);
            processedProductIds.add(item.id);
          }
        });

        // Обновляем сохраненный порядок
        cartOrderRef.current = orderedCart.map((item) => item.id);

        // Обновляем локальные значения количества
        const newQuantities = {};
        orderedCart.forEach((item) => {
          newQuantities[item.id] = String(item.quantity || 0);
        });
        setCartQuantities((prev) => ({ ...prev, ...newQuantities }));

        setCart(orderedCart);
      } else {
        // Если корзина пуста
        setCart([]);
        cartOrderRef.current = [];
      }
    }
  }, [currentSale]);

  // Объявляем filteredProducts до его использования
  const filteredProducts = products.filter((product) =>
    product.name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const addToCart = async (product) => {
    // Проверяем наличие товара
    // Для весовых товаров stock может быть false, но quantity > 0
    const availableQuantity = parseFloat(product.quantity || 0);
    const isInStock = availableQuantity > 0;

    if (!isInStock) {
      showAlert("warning", "Товар отсутствует", "Товар отсутствует в наличии");
      return;
    }

    try {
      let saleId = currentSale?.id;

      // Если продажа еще не создана, создаем её
      if (!saleId) {
        const result = await dispatch(
          startSale({ discount_total: 0, shift: openShiftId || null })
        );
        if (result.type === "sale/start/rejected") {
          showAlert(
            "error",
            "Ошибка",
            "Ошибка при создании продажи: " +
              (result.payload?.message || "Неизвестная ошибка")
          );
          return;
        }
        saleId = result.payload?.id;
      }

      if (!saleId) {
        showAlert("error", "Ошибка", "Не удалось получить ID продажи");
        return;
      }

      // Проверяем, есть ли товар уже в корзине
      // startSale возвращает items напрямую, а не cart.items
      const items = currentSale?.items || currentSale?.cart?.items || [];
      const existingItem = items.find(
        (item) => item.product === product.id || item.product_id === product.id
      );

      if (existingItem) {
        // Проверяем, не превышает ли новое количество доступное
        const newQuantity = existingItem.quantity + 1;
        if (availableQuantity > 0 && newQuantity > availableQuantity) {
          alert(`Доступно только ${availableQuantity} ${product.unit || "шт"}`);
          return;
        }

        // Обновляем количество
        await dispatch(
          updateManualFilling({
            id: saleId,
            productId: product.id,
            quantity: newQuantity,
            discount_total: 0,
          })
        );
        // Обновляем продажу после успешного обновления
        await refreshSale();
      } else {
        // Добавляем новый товар
        await dispatch(
          manualFilling({
            id: saleId,
            productId: product.id,
            quantity: 1,
            discount_total: 0,
          })
        );
        // Обновляем продажу после успешного добавления
        // cartOrderRef будет обновлен автоматически в useEffect при обновлении currentSale
        await refreshSale();
      }
    } catch (error) {
      console.error("Ошибка при добавлении товара в корзину:", error);
      showAlert(
        "error",
        "Ошибка",
        "Ошибка при добавлении товара: " +
          (error.message || "Неизвестная ошибка")
      );
    }
  };

  const updateQuantity = async (productId, delta) => {
    if (!currentSale?.id) return;

    try {
      // Находим товар в списке продуктов для проверки наличия
      const product = products.find((p) => p.id === productId);
      if (!product) return;

      // startSale возвращает items напрямую, а не cart.items
      const items = currentSale?.items || currentSale?.cart?.items || [];
      const existingItem = items.find(
        (item) => item.product === productId || item.product_id === productId
      );

      if (!existingItem) return;

      const newQuantity = Math.max(0, existingItem.quantity + delta);

      // Проверяем наличие при увеличении количества
      if (delta > 0) {
        // Для весовых товаров stock может быть false, но quantity > 0
        const availableQuantity = parseFloat(product.quantity || 0);
        const isInStock = availableQuantity > 0;

        if (!isInStock) {
          showAlert(
            "warning",
            "Товар отсутствует",
            "Товар отсутствует в наличии"
          );
          return;
        }

        if (availableQuantity > 0 && newQuantity > availableQuantity) {
          showAlert(
            "warning",
            "Недостаточно товара",
            `Доступно только ${availableQuantity} ${product.unit || "шт"}`
          );
          return;
        }
      }

      if (newQuantity === 0) {
        // Удаляем товар из корзины
        await dispatch(
          deleteProductInCart({
            id: currentSale.id,
            productId: productId,
          })
        );
        // Удаляем товар из сохраненного порядка
        cartOrderRef.current = cartOrderRef.current.filter(
          (id) => id !== productId
        );
        // Удаляем из локальных значений количества
        setCartQuantities((prev) => {
          const newQuantities = { ...prev };
          delete newQuantities[productId];
          return newQuantities;
        });
        // Обновляем продажу после успешного удаления
        await refreshSale();
      } else {
        // Обновляем количество
        await dispatch(
          updateManualFilling({
            id: currentSale.id,
            productId: productId,
            quantity: newQuantity,
            discount_total: 0,
          })
        );
        // Обновляем локальное значение количества
        setCartQuantities((prev) => ({
          ...prev,
          [productId]: String(newQuantity),
        }));
        // Обновляем продажу после успешного обновления
        await refreshSale();
      }
    } catch (error) {
      console.error("Ошибка при обновлении количества:", error);
      showAlert(
        "error",
        "Ошибка",
        "Ошибка при обновлении количества: " +
          (error.message || "Неизтвестная ошибка")
      );
    }
  };

  // Функция для обновления количества напрямую (без дельты)
  const updateQuantityDirect = async (productId, newQuantity) => {
    if (!currentSale?.id) return;

    try {
      // Находим товар в списке продуктов для проверки наличия
      const product = products.find((p) => p.id === productId);
      if (!product) return;

      const qtyNum = Math.max(0, Math.floor(newQuantity));

      // Проверяем наличие
      const availableQuantity = parseFloat(product.quantity || 0);
      if (availableQuantity > 0 && qtyNum > availableQuantity) {
        showAlert(
          "warning",
          "Недостаточно товара",
          `Доступно только ${availableQuantity} ${product.unit || "шт"}`
        );
        return;
      }

      if (qtyNum === 0) {
        await removeFromCart(productId);
      } else {
        // Обновляем количество
        await dispatch(
          updateManualFilling({
            id: currentSale.id,
            productId: productId,
            quantity: qtyNum,
            discount_total: 0,
          })
        );
        // Обновляем локальное значение количества
        setCartQuantities((prev) => ({
          ...prev,
          [productId]: String(qtyNum),
        }));
        // Обновляем продажу после успешного обновления
        await refreshSale();
      }
    } catch (error) {
      console.error("Ошибка при обновлении количества:", error);
      showAlert(
        "error",
        "Ошибка",
        "Ошибка при обновлении количества: " +
          (error.message || "Неизвестная ошибка")
      );
    }
  };

  const removeFromCart = async (productId) => {
    if (!currentSale?.id) return;

    try {
      // Удаляем товар из корзины
      await dispatch(
        deleteProductInCart({
          id: currentSale.id,
          productId: productId,
        })
      );
      // Удаляем товар из сохраненного порядка
      cartOrderRef.current = cartOrderRef.current.filter(
        (id) => id !== productId
      );
      // Удаляем из локальных значений количества
      setCartQuantities((prev) => {
        const newQuantities = { ...prev };
        delete newQuantities[productId];
        return newQuantities;
      });
      // Обновляем продажу после успешного удаления
      await refreshSale();
    } catch (error) {
      console.error("Ошибка при удалении товара:", error);
      showAlert(
        "error",
        "Ошибка",
        "Ошибка при удалении товара: " + (error.message || "Неизвестная ошибка")
      );
    }
  };

  const total =
    parseFloat(currentSale?.total || 0) ||
    cart.reduce((sum, item) => sum + (item.price || 0) * item.quantity, 0);

  const handleCheckout = () => {
    if (cart.length === 0 || !currentSale?.id) return;
    setShowPaymentPage(true);
  };

  const handleMenuAction = (action) => {
    setShowMenuModal(false);
    if (action === "shifts") {
      setShowShiftPage(true);
    } else if (action === "debt") {
      setShowDebtModal(true);
    } else if (action === "receipts") {
      setShowReceiptsModal(true);
    }
  };

  const handleCloseShift = () => {
    if (!openShift?.id) return;
    // Показываем модальное окно для ввода суммы
    setClosingCash("");
    setShowCloseShiftModal(true);
  };

  const confirmCloseShift = async () => {
    if (!openShift?.id) return;

    // Валидация суммы
    const cashAmount = parseFloat(closingCash);
    if (isNaN(cashAmount) || cashAmount < 0) {
      showAlert("error", "Ошибка", "Пожалуйста, введите корректную сумму");
      return;
    }

    setShowCloseShiftModal(false);

    try {
      await dispatch(
        closeShiftAsync({
          shiftId: openShift.id,
          closingCash: cashAmount,
        })
      ).unwrap();
      showAlert("success", "Успех", "Смена успешно закрыта");
      // Обновляем список смен
      dispatch(fetchShiftsAsync());
      // Обновляем продажу после закрытия смены
      await refreshSale();
      // Очищаем корзину и текущую продажу
      setCart([]);
      setSelectedCustomer(null);
    } catch (error) {
      showAlert(
        "error",
        "Ошибка",
        error?.data?.detail ||
          error?.data?.closing_cash?.[0] ||
          error?.message ||
          "Не удалось закрыть смену"
      );
    }
  };

  if (showShiftPage) {
    return <ShiftPage onBack={() => setShowShiftPage(false)} />;
  }

  if (showPaymentPage) {
    return (
      <PaymentPage
        cart={cart}
        total={total}
        customer={selectedCustomer}
        onBack={() => setShowPaymentPage(false)}
        onSelectCustomer={(customer) => {
          setSelectedCustomer(customer);
        }}
        onComplete={async () => {
          setShowPaymentPage(false);
          setCart([]);
          cartOrderRef.current = []; // Очищаем порядок при завершении продажи
          setSelectedCustomer(null);
          // Начинаем новую продажу после завершения
          await dispatch(
            startSale({ discount_total: 0, shift: openShiftId || null })
          );
          // Обновляем продажу после создания новой
          await refreshSale();
        }}
        saleId={currentSale?.id}
        customers={clients}
        sale={currentSale}
      />
    );
  }

  return (
    <div className="cashier-page">
      <div className="cashier-page__header">
        <div className="cashier-page__header-left">
          <button
            className="cashier-page__back-btn"
            onClick={() => navigate(-1)}
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="cashier-page__title">Касса</h1>
            <p className="cashier-page__subtitle">
              {openShiftId ? (
                <>
                  Смена #{openShift.id?.slice(0, 8) || "—"} •{" "}
                  {openShift.cashier_display || "—"}
                </>
              ) : (
                "Нет открытой смены"
              )}
            </p>
          </div>
        </div>
        <div className="cashier-page__header-right">
          {openShiftId && openShift?.status === "open" && (
            <button
              className="cashier-page__close-shift-btn"
              onClick={handleCloseShift}
            >
              Завершить смену
            </button>
          )}
          <button
            className="cashier-page__menu-btn"
            onClick={() => setShowMenuModal(true)}
          >
            <Menu size={24} />
          </button>
        </div>
      </div>

      <div className="cashier-page__content">
        <div className="cashier-page__products">
          <div className="cashier-page__search">
            <Search size={20} />
            <input
              type="text"
              placeholder="Поиск товаров..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  // Если есть найденные товары, добавляем первый в корзину
                  if (filteredProducts.length > 0) {
                    addToCart(filteredProducts[0]);
                  }
                }
              }}
              className="cashier-page__search-input"
            />
          </div>

          <div className="cashier-page__products-grid">
            {filteredProducts.map((product) => {
              const cartItem = cart.find((item) => item.id === product.id);
              return (
                <div
                  key={product.id}
                  className={`cashier-page__product-card ${
                    cartItem ? "cashier-page__product-card--selected" : ""
                  }`}
                  onClick={() => addToCart(product)}
                >
                  {cartItem && (
                    <div className="cashier-page__product-badge">
                      {cartItem.quantity}
                    </div>
                  )}
                  <div className="cashier-page__product-name">
                    {product.name || "—"}
                  </div>
                  <div className="cashier-page__product-price">
                    {product.price || 0} сом
                  </div>
                  <div className="cashier-page__product-stock">
                    {product.quantity || 0} {product.unit || "шт"}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="cashier-page__cart">
          <div className="cashier-page__cart-header">
            <h2 className="cashier-page__cart-title">Корзина</h2>
            <button
              className="cashier-page__cart-customer-btn"
              onClick={() => setShowCustomerModal(true)}
            >
              <UserPlus size={20} />
            </button>
          </div>

          {/* Кнопки для скидки и доп. услуг */}
          <div className="cashier-page__cart-actions">
            <button
              className="cashier-page__cart-action-btn"
              onClick={() => {
                setDiscountValue(currentSale?.order_discount_total || "");
                setShowDiscountModal(true);
              }}
              title="Добавить общую скидку"
            >
              Скидка
            </button>
            <button
              className="cashier-page__cart-action-btn"
              onClick={() => setShowCustomServiceModal(true)}
              title="Добавить дополнительную услугу"
            >
              Доп. услуга
            </button>
          </div>

          <div className="cashier-page__cart-items">
            {cart.length === 0 ? (
              <div className="cashier-page__cart-empty">Корзина пуста</div>
            ) : (
              cart.map((item) => (
                <div key={item.id} className="cashier-page__cart-item">
                  <div className="cashier-page__cart-item-info">
                    <div className="cashier-page__cart-item-name">
                      {item.name}
                    </div>
                    <div className="cashier-page__cart-item-controls">
                      <button
                        className="cashier-page__cart-item-btn"
                        onClick={() => updateQuantity(item.id, -1)}
                      >
                        <Minus size={16} />
                      </button>
                      <input
                        type="text"
                        className="cashier-page__cart-item-quantity-input"
                        value={cartQuantities[item.id] ?? item.quantity}
                        onChange={(e) => {
                          const value = e.target.value;

                          // Если поле пустое, разрешаем ввод (для очистки)
                          if (value === "" || value === "-") {
                            setCartQuantities((prev) => ({
                              ...prev,
                              [item.id]: value,
                            }));
                            return;
                          }

                          // Проверяем, что введено число
                          const numValue = parseFloat(value);
                          if (isNaN(numValue)) {
                            return; // Не обновляем, если не число
                          }

                          // Находим товар для проверки максимального количества
                          const product = products.find(
                            (p) => p.id === item.id
                          );
                          if (product) {
                            const availableQuantity = parseFloat(
                              product.quantity || 0
                            );

                            // Если есть ограничение по количеству, не позволяем ввести больше
                            if (
                              availableQuantity > 0 &&
                              numValue > availableQuantity
                            ) {
                              // Ограничиваем максимальным доступным количеством
                              setCartQuantities((prev) => ({
                                ...prev,
                                [item.id]: String(availableQuantity),
                              }));
                              showAlert(
                                "warning",
                                "Недостаточно товара",
                                `Доступно только ${availableQuantity} ${
                                  product.unit || "шт"
                                }`
                              );
                              return;
                            }
                          }

                          // Разрешаем ввод только положительных чисел
                          if (numValue < 0) {
                            setCartQuantities((prev) => ({
                              ...prev,
                              [item.id]: "0",
                            }));
                            return;
                          }

                          setCartQuantities((prev) => ({
                            ...prev,
                            [item.id]: value,
                          }));
                        }}
                        onBlur={async (e) => {
                          const value = e.target.value;
                          const qtyNum = Math.max(
                            0,
                            Math.floor(parseFloat(value) || 0)
                          );

                          // Находим товар для проверки наличия
                          const product = products.find(
                            (p) => p.id === item.id
                          );
                          if (product) {
                            const availableQuantity = parseFloat(
                              product.quantity || 0
                            );
                            if (
                              availableQuantity > 0 &&
                              qtyNum > availableQuantity
                            ) {
                              showAlert(
                                "warning",
                                "Недостаточно товара",
                                `Доступно только ${availableQuantity} ${
                                  product.unit || "шт"
                                }`
                              );
                              setCartQuantities((prev) => ({
                                ...prev,
                                [item.id]: String(item.quantity || 0),
                              }));
                              return;
                            }
                          }

                          if (qtyNum === 0) {
                            await removeFromCart(item.id);
                          } else if (qtyNum !== item.quantity) {
                            await updateQuantityDirect(item.id, qtyNum);
                          } else {
                            // Если количество не изменилось, просто обновляем локальное значение
                            setCartQuantities((prev) => ({
                              ...prev,
                              [item.id]: String(item.quantity || 0),
                            }));
                          }
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.target.blur();
                          }
                        }}
                        min="0"
                        step="1"
                      />
                      <button
                        className="cashier-page__cart-item-btn"
                        onClick={() => updateQuantity(item.id, 1)}
                      >
                        <Plus size={16} />
                      </button>
                    </div>
                  </div>
                  <div className="cashier-page__cart-item-actions">
                    <button
                      className="cashier-page__cart-item-remove"
                      onClick={() => removeFromCart(item.id)}
                    >
                      <Trash2 size={18} />
                    </button>
                    <div className="cashier-page__cart-item-price">
                      {(item.price || 0) * item.quantity} сом
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {cart.length > 0 && (
            <div className="cashier-page__cart-footer">
              {currentSale?.order_discount_total > 0 && (
                <div className="cashier-page__cart-discount">
                  <span>Скидка:</span>
                  <span>
                    -
                    {parseFloat(currentSale.order_discount_total || 0).toFixed(
                      2
                    )}{" "}
                    сом
                  </span>
                </div>
              )}
              <div className="cashier-page__cart-total">
                <span>Итого:</span>
                <span>{total.toFixed(2)} сом</span>
              </div>
              <button
                className="cashier-page__checkout-btn"
                onClick={handleCheckout}
                autoFocus
              >
                ОФОРМИТЬ{" "}
                <span style={{ fontSize: "12px", opacity: 0.7 }}>[ENTER]</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {showMenuModal && (
        <MenuModal
          onClose={() => setShowMenuModal(false)}
          onAction={handleMenuAction}
        />
      )}

      {showCustomerModal && (
        <CustomerModal
          onClose={() => setShowCustomerModal(false)}
          onSelect={(customer) => {
            setSelectedCustomer(customer);
            setShowCustomerModal(false);
          }}
          customers={clients}
        />
      )}

      {showDebtModal && (
        <DebtPaymentModal
          onClose={() => setShowDebtModal(false)}
          customers={clients}
        />
      )}

      {showReceiptsModal && (
        <ReceiptsModal onClose={() => setShowReceiptsModal(false)} />
      )}

      {showCustomServiceModal && (
        <CustomServiceModal
          show={showCustomServiceModal}
          onClose={() => {
            setShowCustomServiceModal(false);
            setCustomService({ name: "", price: "", quantity: "1" });
          }}
          customService={customService}
          setCustomService={setCustomService}
          onAdd={handleAddCustomService}
        />
      )}

      {showDiscountModal && (
        <DiscountModal
          show={showDiscountModal}
          onClose={() => {
            setShowDiscountModal(false);
            setDiscountValue("");
          }}
          discountValue={discountValue}
          setDiscountValue={setDiscountValue}
          currentSubtotal={currentSale?.subtotal || 0}
          onApply={(discount) => {
            handleDiscountChange(discount);
            setShowDiscountModal(false);
            setDiscountValue("");
          }}
        />
      )}

      {/* Модальное окно для ввода суммы закрытия смены */}
      {showCloseShiftModal && (
        <div
          className="cashier-page__close-modal-overlay"
          onClick={() => setShowCloseShiftModal(false)}
        >
          <div
            className="cashier-page__close-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="cashier-page__close-modal-header">
              <h2 className="cashier-page__close-modal-title">
                Завершить смену
              </h2>
              <button
                className="cashier-page__close-modal-close"
                onClick={() => setShowCloseShiftModal(false)}
              >
                <X size={24} />
              </button>
            </div>
            <div className="cashier-page__close-modal-content">
              <div className="cashier-page__close-modal-info">
                <div className="cashier-page__close-modal-info-item">
                  <span>Ожидаемая сумма:</span>
                  <span>
                    {openShift?.expected_cash
                      ? parseFloat(openShift.expected_cash).toFixed(2)
                      : "0.00"}{" "}
                    сом
                  </span>
                </div>
              </div>
              <div className="cashier-page__close-modal-input-wrapper">
                <label className="cashier-page__close-modal-label">
                  Фактическая сумма на кассе (сом)
                </label>
                <input
                  type="number"
                  className="cashier-page__close-modal-input"
                  value={closingCash}
                  onChange={(e) => setClosingCash(e.target.value)}
                  placeholder="0.00"
                  step="0.01"
                  min="0"
                  autoFocus
                />
              </div>
            </div>
            <div className="cashier-page__close-modal-actions">
              <button
                className="cashier-page__close-modal-cancel"
                onClick={() => setShowCloseShiftModal(false)}
              >
                Отмена
              </button>
              <button
                className="cashier-page__close-modal-confirm"
                onClick={confirmCloseShift}
              >
                Завершить смену
              </button>
            </div>
          </div>
        </div>
      )}

      <AlertModal
        open={alertModal.open}
        type={alertModal.type}
        title={alertModal.title}
        message={alertModal.message}
        okText="ОК"
        onClose={closeAlert}
        onConfirm={closeAlert}
      />
    </div>
  );
};

export default CashierPage;
