import { Minus, MoreVertical, Plus, Trash, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
// import "./Sklad.scss";

import {
  fetchBrandsAsync,
  fetchCategoriesAsync,
  fetchProductsAsync,
} from "../../../store/creators/productCreators";

import { useNavigate } from "react-router-dom";
import { useDebounce } from "../../../hooks/useDebounce";
import {
  createClientAsync,
  fetchClientsAsync,
} from "../../../store/creators/clientCreators";
import {
  createDeal,
  deleteProductInCart,
  doSearch,
  getObjects,
  getProductCheckout,
  getProductInvoice,
  historySellObjectDetail,
  historySellObjects,
  historySellProduct,
  historySellProductDetail,
  manualFilling,
  objectCartAddItem,
  productCheckout,
  startSale,
  startSellObjects,
  updateProductInCart,
} from "../../../store/creators/saleThunk";
import {
  addCashFlows,
  getCashBoxes,
  useCash,
} from "../../../store/slices/cashSlice";
import { useClient } from "../../../store/slices/ClientSlice";
import { clearProducts, useProducts } from "../../../store/slices/productSlice";
import { useSale } from "../../../store/slices/saleSlice";
import { useUser } from "../../../store/slices/userSlice";
import BarcodeScanner from "./BarcodeScanner";
import { useMemo } from "react";

const SellModal = ({ onClose, id, selectCashBox }) => {
  const { list: cashBoxes } = useCash();

  const [cashData, setCashData] = useState({
    cashbox: "",
    type: "income",
    name: "",
    amount: "",
  });
  const [discount, setDiscount] = useState("");

  const { list } = useClient();
  const [clientId, setClientId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [activeProductId, setActiveProductId] = useState(null);
  const dispatch = useDispatch();
  const { creating, createError, brands, categories, barcodeError } =
    useProducts();
  const { 0: state, 1: setState } = useState({
    full_name: "",
    phone: "",
    email: "",
    date: new Date().toISOString().split("T")[0],
    type: "client",
  });
  const [showInputs, setShowInputs] = useState(false);
  const handleChange = (e) => {
    const { name, value } = e.target;
    setState((prev) => ({ ...prev, [name]: value }));
  };

  const { cart, loading, barcode, error, start, foundProduct } = useSale();
  const [activeTab, setActiveTab] = useState(0);
  const [isTabSelected, setIsTabSelected] = useState(true);
  const { company } = useUser();
  // const [state, setState] = useState({ barcode: "" });
  const debouncedSearch = useDebounce((value) => {
    dispatch(doSearch({ search: value }));
  }, 1000);

  const onChange = (e) => {
    debouncedSearch(e.target.value);
  };
  const onSubmit = async (e) => {
    e.preventDefault();
    try {
      await dispatch(createClientAsync(state)).unwrap();
      dispatch(fetchClientsAsync());
      setShowInputs(false);
    } catch (e) {
      console.log(e);
    }
  };

  const tabs = [
    {
      label: "Сканировать",
      content: <BarcodeScanner id={id} />,
      option: "scan",
    },
    {
      label: "Вручную",
      content: (
        <>
          <div className="sell__manual">
            <input
              type="text"
              placeholder="Введите название товара"
              className="add-modal__input"
              name="search"
              // onChange={onChange} // твой хендлер поиска
            />

            <ul className="sell__list">
              {foundProduct?.results?.map((product) => (
                <li key={product.id}>
                  {product.name}{" "}
                  <div className="sell__list-row">
                    {activeProductId === product.id ? (
                      <>
                        <input
                          type="number"
                          value={quantity}
                          onChange={(e) => setQuantity(e.target.value)}
                          placeholder="Введите количество"
                        />
                        <input
                          type="number"
                          value={discount}
                          onChange={(e) => setDiscount(e.target.value)}
                          placeholder="Скидка (%)"
                        />
                        <button
                          onClick={async () => {
                            try {
                              await dispatch(
                                manualFilling({
                                  id,
                                  productId: product.id,
                                  quantity: Number(quantity),
                                  discount_total: discount, // передаём скидку
                                })
                              ).unwrap();
                              await dispatch(startSale()).unwrap();
                              setActiveProductId(null); // сбрасываем активный товар
                              setQuantity(""); // очищаем количество
                              setDiscount(""); // очищаем скидку
                            } catch (err) {
                              console.error(
                                "manualFilling/startSale error:",
                                err
                              );
                            }
                          }}
                        >
                          Сохранить
                        </button>
                      </>
                    ) : (
                      <>
                        <button onClick={() => setActiveProductId(product.id)}>
                          Указать
                        </button>
                        <button
                          onClick={async () => {
                            try {
                              await dispatch(
                                manualFilling({ id, productId: product.id })
                              ).unwrap();
                              await dispatch(startSale()).unwrap();
                            } catch (err) {
                              console.error(
                                "manualFilling/startSale error:",
                                err
                              );
                            }
                          }}
                        >
                          <Plus size={16} />{" "}
                        </button>
                      </>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </>
      ),
      option: "manually",
    },
  ];
  const products = [
    { id: 1, name: "Товар1", amount: 2, price: 75 },
    { id: 2, name: "Товар2", amount: 2, price: 75 },
    { id: 3, name: "Товар3", amount: 2, price: 75 },
  ];

  const handleTabClick = (index) => {
    setActiveTab(index);
    setIsTabSelected(true); // включаем отображение контента
  };

  useEffect(() => {
    dispatch(doSearch({ search: "" }));
  }, [activeTab, dispatch]);
  const filterClient = list.filter((item) => item.type === "client");

  useEffect(() => {
    dispatch(fetchClientsAsync());
  }, []);
  const navigate = useNavigate();

  // console.log(clientId);

  const handlePrintReceipt = async () => {
    try {
      const result = await dispatch(
        productCheckout({ id: start?.id, bool: true, clientId: clientId })
      ).unwrap();
      await dispatch(addCashFlows(cashData)).unwrap();
      if (result?.sale_id) {
        const pdfBlob = await dispatch(
          getProductCheckout(result.sale_id)
        ).unwrap();
        const pdfInvoiceBlob = await dispatch(
          getProductInvoice(result.sale_id)
        ).unwrap();

        dispatch(historySellProduct());

        // navigate(`/crm/clients/${clientId}`);

        // Создаём ссылку и скачиваем файл
        const url = window.URL.createObjectURL(pdfBlob);
        const link = document.createElement("a");
        link.href = url;
        link.download = "receipt.pdf";
        link.click();
        const url1 = window.URL.createObjectURL(pdfInvoiceBlob);
        const link1 = document.createElement("a");
        link1.href = url1;
        link1.download = "invoice.pdf";
        link1.click();

        window.URL.revokeObjectURL(url);
        window.URL.revokeObjectURL(url1);
      } else {
        console.error("Не удалось получить sale_id", result);
      }

      onClose();
    } catch (err) {
      alert(err.detail);
    }
  };

  const handlePrintInvoice = async () => {
    try {
      const result = await dispatch(
        productCheckout({ id: start?.id, bool: false, clientId: clientId })
      ).unwrap();
      await dispatch(addCashFlows(cashData)).unwrap();
      onClose();
    } catch (err) {
      alert(err.detail);
    }
  };

  useEffect(() => {
    const client = list.find((item) => item.id === clientId);

    setCashData((prev) => ({
      ...prev,
      cashbox: selectCashBox,
      name: client ? client.full_name : clientId, // если нашли — берём full_name, иначе показываем clientId
      amount: start?.total,
    }));
  }, [start, clientId, list, selectCashBox]);

  useEffect(() => {
    dispatch(getCashBoxes());
  }, []);

  return (
    <div className="add-modal">
      <div className="add-modal__overlay" onClick={onClose} />
      <div className="add-modal__content">
        <div className="add-modal__header">
          <h3>Продажа товара</h3>
          <X className="add-modal__close-icon" size={20} onClick={onClose} />
        </div>

        {company?.sector?.name !== "Магазин" ? (
          <>{tabs[1].content}</>
        ) : (
          <>
            {tabs.map((tab, index) => {
              return (
                <button
                  className={`add-modal__button  ${
                    activeTab === index && isTabSelected
                      ? "add-modal__button-active"
                      : ""
                  }`}
                  key={index}
                  onClick={() => handleTabClick(index)}
                >
                  {tab.label}
                </button>
              );
            })}
            {isTabSelected && activeTab !== null && (
              <div className="add-modal__container">
                {tabs[activeTab].content}
              </div>
            )}
          </>
        )}

        {start?.items.length !== 0 && (
          <div className="receipt">
            <h2 className="receipt__title">Приход</h2>

            <div className="add-modal__section">
              <label>Клиенты *</label>
              <select
                name="clientId"
                className="add-modal__input"
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                required
              >
                <option>-- Выберите клиента --</option>
                {filterClient.map((client, idx) => (
                  <option key={idx} value={String(client.id)}>
                    {client.full_name}
                  </option>
                ))}
              </select>

              <button
                className="create-client"
                onClick={() => setShowInputs(!showInputs)}
              >
                {showInputs ? "Отменить" : "Создать клиента"}
              </button>
              {showInputs && (
                <form
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    rowGap: "10px",
                  }}
                  onSubmit={onSubmit}
                >
                  <input
                    className="add-modal__input"
                    onChange={handleChange}
                    type="text"
                    placeholder="ФИО"
                    name="full_name"
                  />
                  <input
                    className="add-modal__input"
                    onChange={handleChange}
                    type="text"
                    name="phone"
                    placeholder="Телефон"
                  />
                  <input
                    className="add-modal__input"
                    onChange={handleChange}
                    type="email"
                    name="email"
                    placeholder="Почта"
                  />
                  <button className="create-client">Создать</button>
                </form>
              )}
              {company.sector?.name === "Строительная компания" && (
                <select
                  name="clientId"
                  className="add-modal__input"
                  // value={clientId}
                  // onChange={(e) => setClientId(e.target.value)}
                  required
                >
                  <option>-- Выберите тип платежа --</option>
                  {/* {filterClient.map((client, idx) => ( */}
                  <option value={""}>Аванс</option>
                  <option value={""}>Кредит</option>
                  <option value={""}>Полная оплата</option>
                  {/* ))} */}
                </select>
              )}
            </div>
            {start?.items.map((product, idx) => (
              <div className="receipt__item" key={idx}>
                <p className="receipt__item-name">
                  {idx + 1}. {product.product_name}
                </p>
                <div>
                  <p>{product.tax_total}</p>
                  <p className="receipt__item-price">
                    {product.quantity} x {product.unit_price} ≡{" "}
                    {product.quantity * product.unit_price}
                  </p>
                  <button
                    onClick={async () => {
                      try {
                        if ((product?.quantity ?? 0) > 1) {
                          await dispatch(
                            updateProductInCart({
                              id,
                              productId: product.id,
                              data: { quantity: product.quantity - 1 },
                            })
                          ).unwrap();
                        } else {
                          await dispatch(
                            deleteProductInCart({
                              id,
                              productId: product.id,
                            })
                          ).unwrap();
                        }

                        await dispatch(startSale()).unwrap();
                      } catch (err) {
                        console.error(
                          "updateProductInCart/deleteProductInCart error:",
                          err
                        );
                      }
                    }}
                  >
                    <Minus size={16} />
                  </button>
                </div>
              </div>
            ))}
            <div className="receipt__total">
              <b>ИТОГО</b>
              <div
                style={{ gap: "10px", display: "flex", alignItems: "center" }}
              >
                <p>Общая скидка {start?.discount_total} </p>
                <p>Налог {start?.tax_total}</p>
                <b>≡ {start?.total}</b>
              </div>
            </div>
            <div className="receipt__row">
              <button className="receipt__row-btn" onClick={handlePrintReceipt}>
                Печать чека
              </button>

              <button className="receipt__row-btn" onClick={handlePrintInvoice}>
                Без чека
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// Если в проекте уже есть эти стили — оставляем ваши классы: add-modal, add-modal__input и т.д.

// Для select сделки

const STATUSES = [
  { value: "new", label: "Новая" },
  { value: "paid", label: "Оплачена" },
  { value: "canceled", label: "Отменена" },
];

// Для select сделки
const DEAL_STATUS_RU = ["Продажа", "Долги", "Аванс", "Предоплата"];

const SellBuildingModal = ({ onClose }) => {
  const dispatch = useDispatch();

  // 1) Создание корзины
  const [cartSeed, setCartSeed] = useState({
    client: "",
    status: "new",
    sold_at: new Date().toISOString().split("T")[0],
    note: "",
  });
  const [creatingCart, setCreatingCart] = useState(false);

  // 2) Касса
  const { list: cashBoxes } = useCash();
  const [cashboxId, setCashboxId] = useState("");

  // 3) Добавление товара
  const [objectItemId, setObjectItemId] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [unitPrice, setUnitPrice] = useState("");

  // Тип сделки + срок долга (месяцев) для «Долги»
  const [dealStatus, setDealStatus] = useState("Продажа");
  const [debtMonths, setDebtMonths] = useState("");

  // Данные из слайсов
  const { list: clientsRaw } = useClient();
  const filterClient = useMemo(
    () => clientsRaw.filter((c) => c.type === "client"),
    [clientsRaw]
  );
  const { company } = useUser();

  // Берём startObject и objects из saleSlice
  const {
    startObject: start,
    loading: saleLoading,
    error: saleError,
    objects: objectsList,
  } = useSale();

  // Имя клиента (для кассы)
  const clientFullName = useMemo(() => {
    const c = filterClient.find(
      (x) => String(x.id) === String(cartSeed.client)
    );
    return c?.full_name || "";
  }, [filterClient, cartSeed.client]);

  // Создание клиента (опционально)
  const [showCreateClient, setShowCreateClient] = useState(false);
  const [newClient, setNewClient] = useState({
    full_name: "",
    phone: "",
    email: "",
    date: new Date().toISOString().split("T")[0],
    type: "client",
  });

  const handleCreateClient = async (e) => {
    e.preventDefault();
    try {
      await dispatch(createClientAsync(newClient)).unwrap();
      await dispatch(fetchClientsAsync());
      setShowCreateClient(false);
    } catch (err) {
      console.error(err);
      alert("Не удалось создать клиента");
    }
  };

  // Первичная загрузка клиентов и касс
  useEffect(() => {
    dispatch(fetchClientsAsync());
    dispatch(getCashBoxes());
  }, [dispatch]);

  // Подгрузка объектов, когда корзина создана
  useEffect(() => {
    if (start?.id) {
      dispatch(getObjects());
    }
  }, [dispatch, start?.id]);

  // Шаги
  const step = useMemo(() => {
    if (!start?.id) return 1;
    if (!cashboxId) return 2;
    return 3;
  }, [start?.id, cashboxId]);

  const canCreateCart =
    Boolean(cartSeed.client) &&
    Boolean(cartSeed.status) &&
    Boolean(cartSeed.sold_at);

  const handleCreateCart = async () => {
    if (!canCreateCart) return;
    setCreatingCart(true);
    try {
      const payload = {
        client: cartSeed.client,
        status: cartSeed.status,
        sold_at: cartSeed.sold_at,
        note: cartSeed.note || "",
      };
      await dispatch(startSellObjects(payload)).unwrap();
    } catch (err) {
      console.error("startSellObjects error:", err);
      const msg =
        err?.data?.detail || err?.message || "Не удалось создать корзину";
      alert(msg);
    } finally {
      setCreatingCart(false);
    }
  };

  const addObjectToCart = async () => {
    if (!start?.id) {
      alert("Сначала создайте корзину");
      return;
    }
    if (!cashboxId) {
      alert("Выберите кассу перед добавлением товара");
      return;
    }
    if (!objectItemId || !quantity || !unitPrice) {
      alert("Заполните все поля товара");
      return;
    }
    // если выбран «Долги», требуем срок в месяцах (целое число >=1)
    if (dealStatus === "Долги") {
      const months = Number(debtMonths);
      if (!months || months < 1 || !Number.isFinite(months)) {
        alert("Укажите срок долга в месяцах (целое число ≥ 1)");
        return;
      }
    }

    try {
      // 1) Добавляем товар в корзину
      await dispatch(
        objectCartAddItem({
          id: start.id,
          product: {
            object_item: objectItemId,
            quantity: Number(quantity),
            unit_price: String(unitPrice),
          },
        })
      ).unwrap();

      // Рассчитываем сумму для сделки и кассы
      const amountNum = Number(quantity) * Number(unitPrice || 0);
      const amountStr = amountNum.toFixed(2);

      // 2) Создаём сделку «под капотом»
      await dispatch(
        createDeal({
          clientId: cartSeed.client,
          title: dealStatus, // заголовок
          statusRu: dealStatus, // маппинг в kind внутри thunk
          amount: amountNum,
          debtMonths: dealStatus === "Долги" ? Number(debtMonths) : undefined,
        })
      ).unwrap();

      // 3) Создаём движение по кассе с выбранной кассой
      await dispatch(
        addCashFlows({
          cashbox: cashboxId, // выбранная касса
          type: "income",
          name: clientFullName || String(cartSeed.client),
          amount: amountStr, // строка с 2 знаками после запятой
        })
      ).unwrap();

      // Сбросим поля добавления
      setObjectItemId("");
      setQuantity(1);
      setUnitPrice("");
      if (dealStatus === "Долги") setDebtMonths("");
    } catch (err) {
      console.error("addObjectToCart/createDeal/addCashFlows error:", err);
      const msg =
        err?.data?.detail ||
        err?.message ||
        "Не удалось добавить товар/создать сделку/проводку";
      alert(msg);
    }
  };

  const cartTotals = useMemo(() => {
    const items = start?.items || [];
    const subtotal = items.reduce(
      (acc, it) => acc + Number(it.quantity) * Number(it.unit_price || 0),
      0
    );
    return {
      count: items.length,
      subtotal,
      discount: Number(start?.discount_total || 0),
      tax: Number(start?.tax_total || 0),
      total: Number(start?.total || subtotal),
    };
  }, [start]);

  return (
    <div className="add-modal">
      <div className="add-modal__overlay" onClick={onClose} />
      <div className="add-modal__content">
        <div className="add-modal__header">
          <h3>Продажа объекта</h3>
          <X className="add-modal__close-icon" size={20} onClick={onClose} />
        </div>

        {/* Шаги */}
        <div
          className="steps"
          style={{ display: "flex", gap: 8, marginBottom: 16 }}
        >
          <span className={`badge ${step >= 1 ? "badge--active" : ""}`}>
            1. Корзина
          </span>
          <span className={`badge ${step >= 2 ? "badge--active" : ""}`}>
            2. Касса
          </span>
          <span className={`badge ${step >= 3 ? "badge--active" : ""}`}>
            3. Товары
          </span>
        </div>

        {/* Шаг 1 — создание корзины */}
        {!start?.id && (
          <div
            className="add-modal__section"
            style={{ display: "grid", gap: 12 }}
          >
            <label>Клиент *</label>
            <select
              className="add-modal__input"
              value={cartSeed.client}
              onChange={(e) =>
                setCartSeed((p) => ({ ...p, client: e.target.value }))
              }
              required
            >
              <option value="">-- Выберите клиента --</option>
              {filterClient.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.full_name}
                </option>
              ))}
            </select>

            <button
              className="create-client"
              onClick={() => setShowCreateClient((v) => !v)}
            >
              {showCreateClient ? "Отменить" : "Создать клиента"}
            </button>

            {showCreateClient && (
              <form
                style={{ display: "grid", gap: 10 }}
                onSubmit={handleCreateClient}
              >
                <input
                  className="add-modal__input"
                  onChange={(e) =>
                    setNewClient((p) => ({ ...p, full_name: e.target.value }))
                  }
                  type="text"
                  placeholder="ФИО"
                  name="full_name"
                  required
                />
                <input
                  className="add-modal__input"
                  onChange={(e) =>
                    setNewClient((p) => ({ ...p, phone: e.target.value }))
                  }
                  type="text"
                  name="phone"
                  placeholder="Телефон"
                />
                <input
                  className="add-modal__input"
                  onChange={(e) =>
                    setNewClient((p) => ({ ...p, email: e.target.value }))
                  }
                  type="email"
                  name="email"
                  placeholder="Почта"
                />
                <button className="create-client">Создать</button>
              </form>
            )}

            <label>Статус *</label>
            <select
              className="add-modal__input"
              value={cartSeed.status}
              onChange={(e) =>
                setCartSeed((p) => ({ ...p, status: e.target.value }))
              }
              required
            >
              {STATUSES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>

            <label>Дата продажи *</label>
            <input
              type="date"
              className="add-modal__input"
              value={cartSeed.sold_at}
              onChange={(e) =>
                setCartSeed((p) => ({ ...p, sold_at: e.target.value }))
              }
              required
            />

            <label>Заметка</label>
            <textarea
              className="add-modal__input"
              rows={3}
              placeholder="Комментарий"
              value={cartSeed.note}
              onChange={(e) =>
                setCartSeed((p) => ({ ...p, note: e.target.value }))
              }
            />

            <button
              className="receipt__row-btn"
              disabled={!canCreateCart || creatingCart}
              onClick={handleCreateCart}
            >
              {creatingCart ? "Создание..." : "Создать корзину"}
            </button>
          </div>
        )}

        {/* Шаг 2 — выбор кассы */}
        {start?.id && !cashboxId && (
          <div
            className="add-modal__section"
            style={{ display: "grid", gap: 12 }}
          >
            <h4>Шаг 2. Выберите кассу</h4>
            <select
              className="add-modal__input"
              value={cashboxId}
              onChange={(e) => setCashboxId(e.target.value)}
              required
            >
              <option value="">-- Выберите кассу --</option>
              {cashBoxes.map((box) => (
                <option key={box.id} value={String(box.id)}>
                  {box.name ?? box.department_name}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Шаг 3 — выбор товара и добавление в корзину */}
        {start?.id && cashboxId && (
          <div
            className="add-modal__section"
            style={{ display: "grid", gap: 12 }}
          >
            <h4>Шаг 3. Добавьте товары</h4>

            {/* Выбор типа сделки */}
            <div style={{ display: "grid", gap: 8 }}>
              <label>Тип сделки</label>
              <select
                className="add-modal__input"
                value={dealStatus}
                onChange={(e) => setDealStatus(e.target.value)}
              >
                {DEAL_STATUS_RU.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>

            {/* Если «Долги» — спрашиваем срок в месяцах */}
            {dealStatus === "Долги" && (
              <div style={{ display: "grid", gap: 8 }}>
                <label>Срок долга (месяцев)</label>
                <input
                  className="add-modal__input"
                  type="number"
                  min={1}
                  step={1}
                  value={debtMonths}
                  onChange={(e) => setDebtMonths(e.target.value)}
                  placeholder="Например, 6"
                />
              </div>
            )}

            <div style={{ display: "grid", gap: 8 }}>
              <label>Товар (объект)</label>
              <select
                className="add-modal__input"
                value={objectItemId}
                onChange={(e) => {
                  const id = e.target.value;
                  setObjectItemId(id);
                  const obj =
                    objectsList?.find(
                      (o) => String(o.id) === id || String(o.object_item) === id
                    ) || null;
                  if (obj && (obj.price || obj.unit_price)) {
                    setUnitPrice(String(obj.price || obj.unit_price));
                  }
                }}
              >
                <option value="">-- Выберите объект --</option>
                {saleLoading && <option disabled>Загрузка...</option>}
                {!saleLoading &&
                  (objectsList || []).map((o) => (
                    <option
                      key={o.id || o.object_item}
                      value={String(o.id || o.object_item)}
                    >
                      {o.name ||
                        o.title ||
                        o.product_name ||
                        `ID ${o.id || o.object_item}`}
                    </option>
                  ))}
              </select>

              <label>Количество</label>
              <input
                className="add-modal__input"
                type="number"
                min={1}
                value={quantity}
                onChange={(e) => setQuantity(Number(e.target.value))}
              />

              <label>Цена за единицу</label>
              <input
                className="add-modal__input"
                type="number"
                step="0.01"
                value={unitPrice}
                onChange={(e) => setUnitPrice(e.target.value)}
                placeholder="999.9"
              />

              <button className="receipt__row-btn" onClick={addObjectToCart}>
                <Plus size={16} style={{ marginRight: 6 }} /> Добавить в корзину
                (и создать сделку)
              </button>
            </div>

            {/* Корзина */}
            {start?.items?.length > 0 && (
              <div className="receipt" style={{ marginTop: 12 }}>
                <h2 className="receipt__title">Корзина</h2>
                {start.items.map((it, idx) => (
                  <div className="receipt__item" key={idx}>
                    <p className="receipt__item-name">
                      {idx + 1}.{" "}
                      {it.product_name ||
                        it.name ||
                        it.object_name ||
                        `Позиция ${idx + 1}`}
                    </p>
                    <div>
                      <p className="receipt__item-price">
                        {it.quantity} x {it.unit_price} ≡{" "}
                        {Number(it.quantity) * Number(it.unit_price || 0)}
                      </p>
                    </div>
                  </div>
                ))}
                <div className="receipt__total">
                  <b>ИТОГО</b>
                  <div
                    style={{ gap: 10, display: "flex", alignItems: "center" }}
                  >
                    <p>Общая скидка {cartTotals.discount}</p>
                    <p>Налог {cartTotals.tax}</p>
                    <b>≡ {cartTotals.total}</b>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Ошибки */}
        {saleError && (
          <div className="error" style={{ color: "#f00", marginTop: 8 }}>
            {saleError?.data?.detail ||
              saleError?.message ||
              JSON.stringify(saleError)}
          </div>
        )}
      </div>
    </div>
  );
};

const SellDetail = ({ onClose, id }) => {
  const dispatch = useDispatch();
  const { historyDetail: item, historyObjectDetail } = useSale();
  const { company } = useUser();

  const sectorName = company?.sector?.name?.trim().toLowerCase() ?? "";
  const planName = company?.subscription_plan?.name?.trim().toLowerCase() ?? "";

  const isBuildingCompany = sectorName === "строительная компания";
  const isStartPlan = planName === "старт";
  // console.log(1, item);

  const kindTranslate = {
    new: "Новый",
    paid: "Оплаченный",
    canceled: "Отмененный",
  };

  const filterField = isStartPlan
    ? item
    : isBuildingCompany
    ? historyObjectDetail
    : item;

  useEffect(() => {
    dispatch(historySellProductDetail(id));
    dispatch(historySellObjectDetail(id));
  }, [id, dispatch]);

  const handlePrintReceipt = async () => {
    try {
      const pdfBlob = await dispatch(getProductCheckout(item?.id)).unwrap();
      const url = window.URL.createObjectURL(pdfBlob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "receipt.pdf";
      link.click();

      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert(err.detail);
    }
  };
  const handlePrintInvoice = async () => {
    try {
      const pdfInvoiceBlob = await dispatch(
        getProductInvoice(item?.id)
      ).unwrap();
      const url1 = window.URL.createObjectURL(pdfInvoiceBlob);
      const link1 = document.createElement("a");
      link1.href = url1;
      link1.download = "invoice.pdf";
      link1.click();

      window.URL.revokeObjectURL(url1);
    } catch (err) {
      alert(err.detail);
    }
  };

  console.log(filterField);
  return (
    <div className="sellDetail add-modal">
      <div className="add-modal__overlay" onClick={onClose} />
      <div className="add-modal__content">
        <div className="add-modal__header">
          <h3>Детали продажи</h3>
          <X className="add-modal__close-icon" size={20} onClick={onClose} />
        </div>
        <div className="sellDetail__content">
          <div className="sell__box">
            <p className="receipt__title">Клиент: {filterField?.client_name}</p>
            <p className="receipt__title">
              Статус:{" "}
              {kindTranslate[filterField?.status] || filterField?.status}
            </p>
            <p className="receipt__title">
              Дата: {new Date(filterField?.created_at).toLocaleString()}
            </p>
          </div>
          <div className="receipt">
            {filterField?.items?.map((product, idx) => (
              <div className="receipt__item" key={idx}>
                <p className="receipt__item-name">
                  {idx + 1}. {product.product_name ?? product.object_name}
                </p>
                <div>
                  <p>{product.tax_total}</p>
                  <p className="receipt__item-price">
                    {product.quantity} x {product.unit_price} ≡{" "}
                    {product.quantity * product.unit_price}
                  </p>
                </div>
              </div>
            ))}
            <div className="receipt__total">
              <b>ИТОГО</b>
              <div
                style={{ gap: "10px", display: "flex", alignItems: "center" }}
              >
                <p>Общая скидка {filterField?.discount_total} </p>
                <p>Налог {filterField?.tax_total}</p>
                <b>≡ {filterField?.total}</b>
              </div>
            </div>
            <div className="receipt__row">
              <button className="receipt__row-btn" onClick={handlePrintReceipt}>
                Чек
              </button>

              <button className="receipt__row-btn" onClick={handlePrintInvoice}>
                Накладной
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const Sell = () => {
  const dispatch = useDispatch();
  const { company } = useUser();

  const {
    list: products,
    loading,
    brands,
    categories,
    error,
    count,
    next,
    previous,
    creating,
    updating,
    deleting,
  } = useSelector((state) => state.product);

  const navigate = useNavigate();
  const { history, start, historyObjects, historyObjectDetail } = useSale();
  const { list: cashBoxes } = useCash();

  const [showEditModal, setShowEditModal] = useState(false);
  const [showDetailSell, setShowDetailSell] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [showSellModal, setShowSellModal] = useState(false);
  const [selectCashBox, setSelectCashBox] = useState("");
  const [showBuilding, setShowBuilding] = useState(false);

  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [currentFilters, setCurrentFilters] = useState({});

  const [showBrandModal, setShowBrandModal] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [selectedBrand, setSelectedBrand] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [barcode, setBarcode] = useState("");
  const [scannerVisible, setScannerVisible] = useState(false);
  const [selectValue, setSelectValue] = useState("all");
  const [activeTab, setActiveTab] = useState(1);
  const [sellId, setSellId] = useState("");
  const [clearing, setClearing] = useState(false);

  const sectorName = company?.sector?.name?.trim().toLowerCase() ?? "";
  const planName = company?.subscription_plan?.name?.trim().toLowerCase() ?? "";

  const isBuildingCompany = sectorName === "строительная компания";
  const isStartPlan = planName === "старт";

  // ★ выбор строк
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);

  useEffect(() => {
    const params = { page: currentPage, search: searchTerm, ...currentFilters };
    dispatch(fetchProductsAsync(params));
    dispatch(fetchBrandsAsync());
    dispatch(fetchCategoriesAsync());
    return () => {
      dispatch(clearProducts());
    };
  }, [
    dispatch,
    currentPage,
    searchTerm,
    creating,
    updating,
    deleting,
    currentFilters,
  ]);

  const filterField = isStartPlan
    ? history
    : isBuildingCompany
    ? historyObjects
    : history;

  const handleEdit = (item) => {
    setSelectedItem(item);
    setShowEditModal(true);
  };
  const handleAdd = () => {
    setShowAddModal(true);
  };

  const handleSaveSuccess = () => {
    setShowEditModal(false);
    setShowAddModal(false);
    alert("Операция с товаром успешно завершена!");
  };

  const handleDeleteConfirm = () => {
    setShowEditModal(false);
    // если удаляли из модалки — снимем выделение
    if (selectedItem?.id) {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(selectedItem.id);
        return next;
      });
    }
    alert("Товар успешно удален!");
  };

  const handleSearchChange = (e) => {
    setSearchTerm(e.target.value);
    setCurrentPage(1);
  };
  const handleResetAllFilters = () => {
    setSearchTerm("");
    setCurrentFilters({});
    setCurrentPage(1);
  };
  const handleNextPage = () => {
    if (next) setCurrentPage((prev) => prev + 1);
  };
  const handlePreviousPage = () => {
    if (previous) setCurrentPage((prev) => prev - 1);
  };
  const handleApplyFilters = (filters) => {
    setCurrentFilters(filters);
    setCurrentPage(1);
  };

  const debouncedSearch = useDebounce((value) => {
    dispatch(historySellProduct({ search: value }));
    dispatch(historySellObjects({ search: value }));
  }, 1000);
  const onChange = (e) => {
    debouncedSearch(e.target.value);
  };

  const isFiltered = searchTerm || Object.keys(currentFilters).length > 0;
  const totalPages =
    count && products.length > 0 ? Math.ceil(count / products.length) : 1;

  useEffect(() => {
    dispatch(historySellProduct({ search: "" }));
    dispatch(historySellObjects({ search: "" }));
  }, [dispatch, showSellModal]);

  useEffect(() => {
    if (showSellModal) dispatch(startSale());
  }, [showSellModal, dispatch]);

  useEffect(() => {
    const handleEsc = (event) => {
      if (event.keyCode === 27) {
        setShowAddModal(false);
        setShowSellModal(false);
        setShowEditModal(false);
        setShowDetailSell(false);
      }
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, []);

  const handleSellModal = (id) => {
    setSellId(id);
    setShowDetailSell(true);
  };

  const kindTranslate = {
    new: "Новый",
    paid: "Оплаченный",
    canceled: "Отмененный",
  };

  useEffect(() => {
    dispatch(getCashBoxes());
  }, []);

  // ★ helpers выбора
  const isSelected = (id) => selectedIds.has(id);
  const toggleRow = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };
  const toggleSelectAllOnPage = (items) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      const allSelected =
        items.length > 0 && items.every((i) => next.has(i.id));
      items.forEach((i) => {
        allSelected ? next.delete(i.id) : next.add(i.id);
      });
      return next;
    });
  };

  const clearSelection = () => setSelectedIds(new Set());

  // ★ массовое удаление
  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    if (!window.confirm(`Удалить выбранные ${selectedIds.size} запись(и)?`))
      return;

    try {
      setBulkDeleting(true);
      // ⚠️ тут используем тот же endpoint, что и в первом экране
      const res = await fetch(
        "https://app.nurcrm.kg/api/main/sales/bulk-delete/",
        {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
            Authorization: `Bearer ${localStorage.getItem("accessToken")}`,
          },
          body: JSON.stringify({
            ids: Array.from(selectedIds),
            allow_paid: false,
          }),
          credentials: "include",
        }
      );

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `HTTP ${res.status}`);
      }

      clearSelection();
      alert("Выбранные записи удалены");
      // при необходимости — обновите историю продаж, если есть соответствующий thunk
      dispatch(historySellProduct({ search: "" }));
      dispatch(historySellObjects({ search: "" }));
    } catch (e) {
      alert("Не удалось удалить: " + e.message);
    } finally {
      setBulkDeleting(false);
    }
  };

  // где у тебя helpers / handlers
  const handleClearAllHistory = async () => {
    if (!window.confirm("Удалить ВСЮ историю? Действие необратимо.")) return;

    try {
      setClearing(true);

      // const text = await res.text();
      // console.warn("require_all fallback:", res.status, text);

      const list = Array.isArray(filterField) ? filterField : [];
      const ids = list.map((i) => i.id);

      if (ids.length === 0) throw new Error("Нечего удалять");

      const res = await fetch(
        "https://app.nurcrm.kg/api/main/sales/bulk-delete/",
        {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
            authorization: `Bearer ${localStorage.getItem("accessToken")}`,
          },
          credentials: "include",
          body: JSON.stringify({
            ids,
            allow_paid: false,
          }),
        }
      );

      if (!res.ok) {
        const t2 = await res.text();
        throw new Error(t2 || `HTTP ${res.status}`);
      }

      // очистим локальный выбор и обновим списки
      setSelectedIds(new Set());
      alert("История удалена");

      // обнови нужные данные истории
      dispatch(historySellProduct({ search: "" }));
      dispatch(historySellObjects({ search: "" }));
    } catch (e) {
      alert("Не удалось очистить историю: " + e.message);
    } finally {
      setClearing(false);
    }
  };

  // ★ общий блок действий для выбора
  const SelectionActions = ({ pageItems }) => {
    const allOnPageChecked =
      pageItems.length > 0 && pageItems.every((i) => selectedIds.has(i.id));
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          marginBottom: "10px",
          marginLeft: "4px",
        }}
      >
        <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <input
            type="checkbox"
            checked={allOnPageChecked}
            onChange={() => toggleSelectAllOnPage(pageItems)}
          />
          <span>Все на странице</span>
        </label>

        {selectedIds.size > 0 && (
          <>
            <span style={{ opacity: 0.75 }}>Выбрано: {selectedIds.size}</span>
            <button
              className="sklad__add"
              style={{ background: "#e53935" }}
              onClick={handleBulkDelete}
              disabled={bulkDeleting}
              title="Массовое удаление выбранных"
            >
              {bulkDeleting ? "Удаляем..." : "Удалить выбранные"}
            </button>
            <button
              className="sklad__reset"
              onClick={clearSelection}
              style={{ cursor: "pointer" }}
              title="Снять весь выбор"
            >
              Сбросить выбор
            </button>
          </>
        )}
      </div>
    );
  };

  return (
    <div>
      <div className="sklad__header">
        <div className="sklad__left">
          <input
            type="text"
            placeholder="Поиск по названию товара"
            className="sklad__search"
            onChange={onChange}
          />
          <div className="sklad__center">
            <span>Всего: {count !== null ? count : "-"}</span>
            <span>Найдено: {history?.length}</span>
            {isFiltered && (
              <span
                className="sklad__reset"
                onClick={handleResetAllFilters}
                style={{ cursor: "pointer" }}
              >
                Сбросить
              </span>
            )}
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
          {/* ★ заменили "Очистить историю" на управление выбором */}

          {filterField?.length !== 0 && (
            <button
              className="barbermasters__btn barbermasters__btn--secondary"
              onClick={handleClearAllHistory}
              disabled={clearing}
              title="Удалить всю историю"
            >
              <Trash /> {clearing ? "Очищаем..." : "Очистить историю"}
            </button>
          )}

          {isStartPlan ? (
            <>
              <select
                value={selectCashBox}
                onChange={(e) => setSelectCashBox(e.target.value)}
                className="employee__search-wrapper"
              >
                <option value="" disabled>
                  Выберите кассу
                </option>
                {cashBoxes?.map((cash) => (
                  <option key={cash.id} value={cash.id}>
                    {cash.name ?? cash.department_name}
                  </option>
                ))}
              </select>
              <button
                className="sklad__add"
                onClick={() => setShowSellModal(true)}
                disabled={!selectCashBox}
                title={!selectCashBox ? "Сначала выберите кассу" : undefined}
              >
                <Plus size={16} style={{ marginRight: "4px" }} /> Продать товар
              </button>
            </>
          ) : isBuildingCompany ? (
            <>
              <button
                className="sklad__add"
                onClick={() => setShowBuilding(true)}
              >
                <Plus size={16} style={{ marginRight: "4px" }} /> Продать товар
              </button>
            </>
          ) : (
            <>
              <select
                value={selectCashBox}
                onChange={(e) => setSelectCashBox(e.target.value)}
                className="employee__search-wrapper"
              >
                <option value="" disabled>
                  Выберите кассу
                </option>
                {cashBoxes?.map((cash) => (
                  <option key={cash.id} value={cash.id}>
                    {cash.name ?? cash.department_name}
                  </option>
                ))}
              </select>
              <button
                className="sklad__add"
                onClick={() => setShowSellModal(true)}
                disabled={!selectCashBox}
                title={!selectCashBox ? "Сначала выберите кассу" : undefined}
              >
                <Plus size={16} style={{ marginRight: "4px" }} /> Продать товар
              </button>
            </>
          )}
        </div>
      </div>

      {filterField?.length !== 0 && (
        <SelectionActions pageItems={filterField ?? []} />
      )}

      {loading ? (
        <p className="sklad__loading-message">Загрузка товаров...</p>
      ) : error ? (
        <p className="sklad__error-message">Ошибка загрузки:</p>
      ) : (filterField?.length ?? 0) === 0 ? (
        <p className="sklad__no-products-message">Нет доступных товаров.</p>
      ) : (
        <div className="table-wrapper" style={{ marginBottom: "20px" }}>
          <table className="sklad__table">
            <thead>
              <tr>
                <th>
                  {/* ★ выбрать всё на текущей странице */}
                  <input
                    type="checkbox"
                    checked={
                      (filterField?.length ?? 0) > 0 &&
                      filterField.every((i) => selectedIds.has(i.id))
                    }
                    onChange={() => toggleSelectAllOnPage(filterField)}
                  />
                </th>
                <th></th>
                <th>№</th>
                <th>Клиент</th>
                <th>Цена</th>
                <th>Статус</th>
                <th>Дата</th>
              </tr>
            </thead>
            <tbody>
              {filterField?.map((item, index) => (
                <tr
                  onClick={() => handleSellModal(item.id)}
                  key={item.id}
                  style={{ cursor: "pointer" }}
                >
                  <td onClick={(e) => e.stopPropagation()}>
                    {/* ★ чекбокс строки */}
                    <input
                      type="checkbox"
                      checked={isSelected(item.id)}
                      onChange={() => toggleRow(item.id)}
                    />
                  </td>
                  <td onClick={(e) => e.stopPropagation()}>
                    <MoreVertical
                      size={16}
                      onClick={() => handleEdit(item)}
                      style={{ cursor: "pointer" }}
                    />
                  </td>
                  <td>{index + 1}</td>
                  <td>{item.client_name ? item.client_name : "Нет имени"}</td>
                  <td>{item.total}</td>
                  <td>{kindTranslate[item.status] || item.status}</td>
                  <td>{new Date(item.created_at).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="sklad__pagination">
        <span>
          {currentPage} из {totalPages}
        </span>
        <button
          onClick={handlePreviousPage}
          disabled={!previous || loading || creating || updating || deleting}
        >
          ←
        </button>
        <button
          onClick={handleNextPage}
          disabled={!next || loading || creating || updating || deleting}
        >
          →
        </button>
      </div>

      {showSellModal && (
        <SellModal
          id={start?.id}
          selectCashBox={selectCashBox}
          onClose={() => setShowSellModal(false)}
        />
      )}
      {showBuilding && (
        <SellBuildingModal onClose={() => setShowBuilding(false)} />
      )}
      {showDetailSell && (
        <SellDetail onClose={() => setShowDetailSell(false)} id={sellId} />
      )}
    </div>
  );
};

export default Sell;
