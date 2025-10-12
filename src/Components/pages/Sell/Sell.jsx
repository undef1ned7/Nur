import {
  Hash,
  ListOrdered,
  Minus,
  MoreVertical,
  Plus,
  Tag,
  Tags,
  Trash,
  X,
} from "lucide-react";
import React, { useEffect, useState } from "react";
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
import api from "../../../api";
import SellModal from "./SellModal";
import { t } from "i18next";
import RefundPurchase from "./RefundPurchase";

export async function createDebt(payload) {
  const res = await api.post("/main/debts/", payload);
  return res.data;
}

// Если в проекте уже есть эти стили — оставляем ваши классы: add-modal, add-modal__input и т.д.

// Для select сделки

const STATUSES = [
  { value: "new", label: "Новая" },
  { value: "paid", label: "Оплачена" },
  { value: "canceled", label: "Отменена" },
];

// Для select сделки
export const DEAL_STATUS_RU = ["Продажа", "Долги", "Предоплата"];

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
  const [prepayment, setPrepayment] = useState("");

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
  console.log(1000000000, company?.subscription_plan?.name);

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
      // await dispatch(
      //   createDeal({
      //     clientId: cartSeed.client,
      //     title: dealStatus, // заголовок
      //     statusRu: dealStatus, // маппинг в kind внутри thunk
      //     amount: amountNum,
      //     debtMonths: dealStatus === "Долги" ? Number(debtMonths) : undefined,
      //   })
      // ).unwrap();
      const result = await dispatch(
        createDeal({
          clientId: cartSeed.client,
          title: dealStatus, // заголовок
          statusRu: dealStatus, // маппинг в kind внутри thunk
          amount: amountNum,
          // prepayment только при "Предоплата"
          prepayment:
            dealStatus === "Предоплата" ? Number(prepayment) : undefined,
          // debtMonths и для "Долги", и для "Предоплата"
          debtMonths:
            dealStatus === "Долги" || dealStatus === "Предоплата"
              ? Number(debtMonths)
              : undefined,
        })
      ).unwrap();

      // 3) Создаём движение по кассе с выбранной кассой
      await dispatch(
        addCashFlows({
          cashbox: cashboxId, // выбранная касса
          type: "income",
          name: clientFullName || String(cartSeed.client),
          amount: dealStatus === "Предоплата" ? result.prepayment : amountStr,
          status: company?.subscription_plan?.name === "Старт" ? true : false,
        })
      ).unwrap();
      onClose();

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
    <div className="add-modal sellObject">
      <div className="add-modal__overlay" onClick={onClose} />
      <div className="add-modal__content">
        <div className="add-modal__header">
          <h3>Продажа квартиры</h3>
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

            {dealStatus === "Предоплата" && (
              <>
                <div className="sale__field sale__field--full">
                  <label className="sale__label">Предоплата</label>
                  <input
                    className="sale__input"
                    type="number"
                    min={1}
                    step={1}
                    value={prepayment}
                    onChange={(e) => setPrepayment(e.target.value)}
                    placeholder="Сумма предоплаты"
                  />
                </div>
                <div className="sale__field sale__field--full">
                  <label className="sale__label">Срок долга (месяцев)</label>
                  <input
                    className="sale__input"
                    type="number"
                    min={1}
                    step={1}
                    value={debtMonths}
                    onChange={(e) => setDebtMonths(e.target.value)}
                    placeholder="Например, 6"
                  />
                </div>
              </>
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
      <div className="add-modal__content" style={{ width: "500px" }}>
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
  const { list: cashBoxes } = useCash();
  const { history, start, historyObjects } = useSale();

  const [showDetailSell, setShowDetailSell] = useState(false);
  const [showSellModal, setShowSellModal] = useState(false);
  const [showAddCashboxModal, setShowAddCashboxModal] = useState(false);
  const [showBuilding, setShowBuilding] = useState(false);
  const [sellId, setSellId] = useState("");
  const [selectCashBox, setSelectCashBox] = useState("");
  const [selectCashBox1, setSelectCashBox1] = useState("");
  const [clearing, setClearing] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [itemId, setItemId] = useState({});
  const [showRefundModal, setShowRefundModal] = useState(false);
  const [error, setError] = useState(null);

  const [newCashbox, setNewCashbox] = useState({
    name: "",
    amount: 0,
    cashbox: selectCashBox1,
    type: "expense", // Дефолтный тип для новой операции
  });

  // выбор строк
  const [selectedIds, setSelectedIds] = useState(new Set());
  const isSelected = (id) => selectedIds.has(id);
  const toggleRow = (id) =>
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  const toggleSelectAllOnPage = (items) =>
    setSelectedIds((prev) => {
      const next = new Set(prev);
      const all = items.length > 0 && items.every((i) => next.has(i.id));
      items.forEach((i) => (all ? next.delete(i.id) : next.add(i.id)));
      return next;
    });
  const clearSelection = () => setSelectedIds(new Set());

  const sectorName = company?.sector?.name?.trim().toLowerCase() ?? "";
  const planName = company?.subscription_plan?.name?.trim().toLowerCase() ?? "";
  const isBuildingCompany = sectorName === "строительная компания";
  const isStartPlan = planName === "старт";

  const filterSell = history.filter((item) => item.status !== "canceled");

  const filterField = isBuildingCompany ? historyObjects : filterSell;

  // поиск по истории (дебаунс)
  const debouncedSearch = useDebounce((v) => {
    dispatch(historySellProduct({ search: v }));
    dispatch(historySellObjects({ search: v }));
  }, 600);
  const onChange = (e) => debouncedSearch(e.target.value);

  useEffect(() => {
    dispatch(historySellProduct({ search: "" }));
    dispatch(historySellObjects({ search: "" }));
  }, [dispatch]);

  useEffect(() => {
    if (showSellModal) dispatch(startSale());
  }, [showSellModal, dispatch]);

  useEffect(() => {
    const onEsc = (e) => {
      if (e.key === "Escape") {
        setShowSellModal(false);
        setShowDetailSell(false);
        setShowBuilding(false);
      }
    };
    window.addEventListener("keydown", onEsc);
    return () => window.removeEventListener("keydown", onEsc);
  }, []);

  useEffect(() => {
    dispatch(getCashBoxes());
  }, [dispatch]);

  const handleSellModal = (id) => {
    setSellId(id);
    setShowDetailSell(true);
  };
  const handleOpen = (id) => {
    setItemId(id);
    setShowRefundModal(true);
  };

  const kindTranslate = {
    new: "Новый",
    paid: "Оплаченный",
    canceled: "Отмененный",
  };

  const handleAddCashbox = async () => {
    try {
      dispatch(addCashFlows({ ...newCashbox, cashbox: selectCashBox1 }));

      setShowAddCashboxModal(false);
      setNewCashbox({ name: "", amount: 0, type: "expense" }); // Сброс формы
    } catch (err) {
      console.error("Failed to add cashflow:", err);
      setError(
        "Не удалось добавить операцию по кассе. Пожалуйста, проверьте данные и попробуйте еще раз."
      );
    }
  };

  // массовое удаление выбранных
  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    if (!window.confirm(`Удалить выбранные ${selectedIds.size} запись(и)?`))
      return;
    try {
      setBulkDeleting(true);
      const res = await fetch(
        "https://app.nurcrm.kg/api/main/sales/bulk-delete/",
        {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
            Authorization: `Bearer ${localStorage.getItem("accessToken")}`,
          },
          credentials: "include",
          body: JSON.stringify({
            ids: Array.from(selectedIds),
            allow_paid: false,
          }),
        }
      );
      if (!res.ok) throw new Error((await res.text()) || `HTTP ${res.status}`);
      clearSelection();
      alert("Выбранные записи удалены");
      dispatch(historySellProduct({ search: "" }));
      dispatch(historySellObjects({ search: "" }));
    } catch (e) {
      alert("Не удалось удалить: " + e.message);
    } finally {
      setBulkDeleting(false);
    }
  };

  // очистить ВСЮ историю
  const handleClearAllHistory = async () => {
    if (!window.confirm("Удалить ВСЮ историю? Действие необратимо.")) return;
    try {
      setClearing(true);
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
            Authorization: `Bearer ${localStorage.getItem("accessToken")}`,
          },
          credentials: "include",
          body: JSON.stringify({ ids, allow_paid: false }),
        }
      );
      if (!res.ok) throw new Error((await res.text()) || `HTTP ${res.status}`);
      clearSelection();
      alert("История удалена");
      dispatch(historySellProduct({ search: "" }));
      dispatch(historySellObjects({ search: "" }));
    } catch (e) {
      alert("Не удалось очистить историю: " + e.message);
    } finally {
      setClearing(false);
    }
  };

  const SelectionActions = ({ pageItems }) => {
    const allOnPageChecked =
      pageItems.length > 0 && pageItems.every((i) => selectedIds.has(i.id));
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          margin: "0 0 10px 4px",
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
              title="Снять выбор"
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
            placeholder="Поиск по истории"
            className="sklad__search"
            onChange={onChange}
          />
          <div className="sklad__center">
            <span>Найдено: {filterField?.length ?? 0}</span>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 20,
            flexWrap: "wrap",
          }}
        >
          {!isBuildingCompany && filterField?.length > 0 && (
            <button
              className="barbermasters__btn barbermasters__btn--secondary"
              onClick={handleClearAllHistory}
              disabled={clearing}
              title="Удалить всю историю"
            >
              <Trash /> {clearing ? "Очищаем..." : "Очистить историю"}
            </button>
          )}

          {isBuildingCompany ? (
            <button
              className="sklad__add"
              onClick={() => setShowBuilding(true)}
            >
              <Plus size={16} style={{ marginRight: 4 }} /> Продать квартиру
            </button>
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
                {cashBoxes?.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name ?? c.department_name}
                  </option>
                ))}
              </select>
              <button
                className="sklad__add"
                onClick={() => setShowSellModal(true)}
                disabled={!selectCashBox}
                title={!selectCashBox ? "Сначала выберите кассу" : undefined}
              >
                <Plus size={16} style={{ marginRight: 4 }} /> Продать товар
              </button>
              {company.sector.name === "Магазин" && (
                <button
                  className="sklad__add"
                  onClick={() => setShowAddCashboxModal(true)}
                >
                  Прочие расходы
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {!!filterField?.length && <SelectionActions pageItems={filterField} />}

      {(filterField?.length ?? 0) === 0 ? (
        <p className="sklad__no-products-message">Нет записей.</p>
      ) : (
        <div className="table-wrapper" style={{ marginBottom: 20 }}>
          <table className="sklad__table">
            <thead>
              <tr>
                <th>
                  <input
                    type="checkbox"
                    checked={
                      filterField.length > 0 &&
                      filterField.every((i) => selectedIds.has(i.id))
                    }
                    onChange={() => toggleSelectAllOnPage(filterField)}
                  />
                </th>
                <th>№</th>
                <th>Клиент</th>
                <th>Цена</th>
                <th>Статус</th>
                <th>Дата</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filterField.map((item, index) => (
                <tr
                  key={item.id}
                  style={{ cursor: "pointer" }}
                  onClick={() => {
                    setSellId(item.id);
                    setShowDetailSell(true);
                  }}
                >
                  <td onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={isSelected(item.id)}
                      onChange={() => toggleRow(item.id)}
                    />
                  </td>
                  <td>{index + 1}</td>
                  <td>{item.client_name || "Нет имени"}</td>
                  <td>{item.total ?? item.subtotal}</td>
                  <td>{kindTranslate[item.status] || item.status}</td>
                  <td>{new Date(item.created_at).toLocaleString()}</td>
                  <td onClick={(e) => e.stopPropagation()}>
                    {company.sector.name === "Магазин" && (
                      <button
                        className="btn edit-btn"
                        onClick={() => handleOpen(item)}
                      >
                        Возврат
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showAddCashboxModal && (
        <div className="vitrina__overlay">
          <div className="vitrina__modal vitrina__modal--add">
            <div className="vitrina__modal-header">
              <h3>Добавление расхода</h3>
              <X
                className="vitrina__close-icon"
                size={20}
                onClick={() => setShowAddCashboxModal(false)}
              />
            </div>
            <div className="vitrina__modal-section">
              <label>Наименование</label>
              <input
                type="text"
                placeholder="Например, Закупка материалов"
                className="vitrina__modal-input"
                value={newCashbox.name}
                onChange={(e) =>
                  setNewCashbox({ ...newCashbox, name: e.target.value })
                }
              />
            </div>
            <div className="vitrina__modal-section">
              <label>Сумма</label>
              <input
                type="number"
                placeholder="Например, 10000"
                className="vitrina__modal-input"
                value={newCashbox.amount}
                onChange={(e) =>
                  setNewCashbox({
                    ...newCashbox,
                    amount: parseFloat(e.target.value) || 0,
                  })
                }
              />
            </div>
            <div className="vitrina__modal-section">
              <label>Касса</label>
              <select
                style={{ marginTop: 14, width: "100%" }}
                className="debt__input"
                value={selectCashBox1}
                onChange={(e) => setSelectCashBox1(e.target.value)}
              >
                <option value="" disabled>
                  Выберите кассу
                </option>
                {cashBoxes?.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name ?? c.department_name}
                  </option>
                ))}
              </select>
            </div>

            <div className="vitrina__modal-footer">
              <button
                className="vitrina__button vitrina__button--cancel"
                onClick={() => setShowAddCashboxModal(false)}
              >
                Отмена
              </button>
              <button
                className="vitrina__button vitrina__button--save"
                onClick={handleAddCashbox}
              >
                Добавить
              </button>
            </div>
          </div>
        </div>
      )}

      {showSellModal && (
        <SellModal
          id={start?.id}
          selectCashBox={selectCashBox}
          onClose={() => setShowSellModal(false)}
        />
      )}
      {showRefundModal && (
        <RefundPurchase
          item={itemId}
          onClose={() => setShowRefundModal(false)}
          onChanged={() => dispatch(historySellProduct())}
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
