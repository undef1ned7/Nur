import { Plus, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useDispatch } from "react-redux";
// import "./Sklad.scss";

import { useMemo } from "react";
import {
  createClientAsync,
  fetchClientsAsync,
} from "../../../store/creators/clientCreators";
import {
  createDeal,
  getObjects,
  objectCartAddItem,
  startSellObjects,
} from "../../../store/creators/saleThunk";
import {
  addCashFlows,
  getCashBoxes,
  useCash,
} from "../../../store/slices/cashSlice";
import { useClient } from "../../../store/slices/ClientSlice";
import { useSale } from "../../../store/slices/saleSlice";
import { useUser } from "../../../store/slices/userSlice";

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

  // Автоматически выбираем первую кассу по индексу
  useEffect(() => {
    if (cashBoxes && cashBoxes.length > 0 && !cashboxId) {
      const firstCashBox = cashBoxes[0];
      const firstCashBoxId = firstCashBox?.id || firstCashBox?.uuid || "";
      if (firstCashBoxId) {
        setCashboxId(String(firstCashBoxId));
      }
    }
  }, [cashBoxes, cashboxId]);

  // Подгрузка объектов, когда корзина создана
  useEffect(() => {
    if (start?.id) {
      dispatch(getObjects());
    }
  }, [dispatch, start?.id]);

  // Шаги
  const step = useMemo(() => {
    if (!start?.id) return 1;
    // Не блокируем шаг 2, если кассы еще загружаются
    if (Array.isArray(cashBoxes) && cashBoxes.length > 0 && !cashboxId)
      return 2;
    if (!cashboxId && (!cashBoxes || cashBoxes.length === 0)) return 2;
    return 3;
  }, [start?.id, cashboxId, cashBoxes]);

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
    // Дополнительная проверка кассы перед выполнением операции
    if (!cashboxId) {
      alert("Касса не выбрана. Создайте кассу в разделе «Кассы».");
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
      if (dealStatus !== "Долги") {
        await dispatch(
          addCashFlows({
            cashbox: cashboxId, // выбранная касса
            type: "income",
            name: clientFullName || String(cartSeed.client),
            amount: dealStatus === "Предоплата" ? result.prepayment : amountStr,
            source_cashbox_flow_id: start.id,
            source_business_operation_id: "Строительство",
            status:
              company?.subscription_plan?.name === "Старт"
                ? "approved"
                : "pending",
          })
        ).unwrap();
      }
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

        {/* Шаг 2 — касса автоматически выбирается - скрыто от пользователя */}

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

export default SellBuildingModal;
