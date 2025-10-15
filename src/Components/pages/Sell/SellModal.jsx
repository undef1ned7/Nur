// src/pages/.../SellModal.jsx
import { Check, ListOrdered, Minus, Plus, Tags, X } from "lucide-react";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useDispatch } from "react-redux";
import { useLocation } from "react-router-dom";

import { useDebounce } from "../../../hooks/useDebounce";
import {
  createClientAsync,
  fetchClientsAsync,
} from "../../../store/creators/clientCreators";
import {
  addCustomItem,
  createDeal,
  deleteProductInCart,
  doSearch,
  getProductCheckout,
  getProductInvoice,
  historySellProduct,
  manualFilling,
  productCheckout,
  startSale,
  updateProductInCart,
} from "../../../store/creators/saleThunk";
import {
  addCashFlows,
  getCashBoxes,
  useCash,
} from "../../../store/slices/cashSlice";
import { useClient } from "../../../store/slices/ClientSlice";
import { useSale } from "../../../store/slices/saleSlice";
import { getProfile, useUser } from "../../../store/slices/userSlice";
import BarcodeScanner from "./BarcodeScanner";
import { createDebt, DEAL_STATUS_RU } from "./Sell";
import { fetchTransfersAsync } from "../../../store/creators/transferCreators";
import { useProducts } from "../../../store/slices/productSlice";
import { fetchAgentProductsAsync } from "../../../store/creators/productCreators";

/* =========================
   0) Простая фильтрация (товары, у которых есть остаток у агента)
   ========================= */
export function filterProducts(products = [], transfers = []) {
  const onAgent = new Map();
  for (const t of transfers || []) {
    const pid = String(t.product);
    const qty = Number(t.qty_on_agent) || 0;
    onAgent.set(pid, (onAgent.get(pid) || 0) + qty);
  }

  if (transfers.length === 0) {
    return (products || []).map((p) => ({
      ...p,
      on_agent: p.qty_on_hand || p.qty_on_agent || 0,
    }));
  }

  return (products || [])
    .filter((p) => (onAgent.get(String(p.id)) || 0) > 0)
    .map((p) => ({ ...p, on_agent: onAgent.get(String(p.id)) || 0 }));
}

/* =========================
   0.1) Хелперы для валидации склада
   ========================= */
const STOCK_DETAIL_RE =
  /Недостаточно на складе:\s*«(.+?)»\.\s*Нужно\s*([\d\s.,]+),\s*доступно\s*([\d\s.,]+)/i;

function numberify(s) {
  if (s == null) return 0;
  const n = Number(String(s).replaceAll(" ", "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

function parseStockError(err) {
  const raw =
    err?.detail ||
    err?.data?.detail ||
    err?.response?.data?.detail ||
    err?.message ||
    "";
  const m = String(raw).match(STOCK_DETAIL_RE);
  if (!m) return null;
  return {
    name: m[1],
    need: numberify(m[2]),
    available: numberify(m[3]),
    raw,
  };
}

function getAvailableFromObject(p) {
  return (
    Number(p?.qty_on_agent ?? p?.qty_on_hand ?? p?.quantity ?? p?.stock ?? 0) ||
    0
  );
}

/* =========================
   1) SellModal
   ========================= */
const SellModal = ({ onClose, id, selectCashBox }) => {
  const dispatch = useDispatch();
  const location = useLocation();

  const { list: cashBoxes } = useCash();
  const { list: clients } = useClient();
  const { company, profile } = useUser();
  const { cart, loading, barcode, error, start, foundProduct } = useSale();
  const { agentProducts: transfers } = useProducts();

  const filterClient = useMemo(
    () =>
      (Array.isArray(clients) ? clients : []).filter(
        (c) => c.type === "client"
      ),
    [clients]
  );

  const [activeTab, setActiveTab] = useState(
    company?.sector?.name !== "Магазин" ? 1 : 0
  );
  const [isTabSelected, setIsTabSelected] = useState(true);
  const [clientId, setClientId] = useState("");
  const [debt, setDebt] = useState("");
  const [phone, setPhone] = useState("");
  const [amount, setAmount] = useState("");
  const [debtMonths, setDebtMonths] = useState("");
  const [inline, setInline] = useState({ id: null, field: null });
  const [quantity, setQuantity] = useState("");
  const [discount, setDiscount] = useState("");
  const [editingQuantity, setEditingQuantity] = useState({
    id: null,
    value: "",
  });
  const [showServices, setShowServices] = useState(false);
  const [showCreateClient, setShowCreateClient] = useState(false);
  const [showDiscount, setShowDiscount] = useState(false);
  const [customService, setCustomService] = useState({
    name: "",
    price: "",
    quantity: 1,
  });
  const [newClient, setNewClient] = useState({
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
  const [cashData, setCashData] = useState({
    cashbox: "",
    type: "income",
    name: "",
    amount: "",
    status: company?.subscription_plan?.name === "Старт" ? true : false,
  });

  const run = (thunk) => dispatch(thunk).unwrap();

  const pickClient = useMemo(
    () => filterClient.find((x) => String(x.id) === String(clientId)),
    [filterClient, clientId]
  );

  const debouncedSearch = useDebounce((value) => {
    dispatch(doSearch({ search: value }));
  }, 600);

  const onSearch = useCallback(
    (e) => debouncedSearch(e.target.value),
    [debouncedSearch]
  );

  const onNewClientChange = useCallback(
    (e) => setNewClient((p) => ({ ...p, [e.target.name]: e.target.value })),
    []
  );

  const onCustomServiceChange = useCallback(
    (e) => setCustomService((p) => ({ ...p, [e.target.name]: e.target.value })),
    []
  );

  const sellData =
    location.pathname === "/crm/production/agents"
      ? Array.isArray(transfers)
        ? transfers
        : []
      : Array.isArray(foundProduct?.results)
      ? foundProduct.results
      : [];

  const filteredItems = useMemo(() => {
    const base = Array.isArray(foundProduct?.results)
      ? foundProduct.results
      : [];
    const trs = Array.isArray(transfers) ? transfers : [];
    const result = filterProducts(base, trs);
    return result;
  }, [foundProduct?.results, transfers]);

  const isShop = company?.sector?.name === "Магазин";

  const allCatalogItems = useMemo(() => {
    return isShop ? filteredItems : sellData;
  }, [isShop, filteredItems, sellData]);

  const xName = (p) =>
    p?.name ?? p?.product_name ?? p?.display_name ?? String(p?.id ?? "");

  const getItemAvailableById = useCallback(
    (productId) => {
      if (!allCatalogItems || allCatalogItems.length === 0) {
        return null; // каталог ещё не готов — пропустим клиентскую проверку
      }
      const pid = String(productId);
      const p =
        allCatalogItems.find((x) => {
          const id1 = x?.id != null ? String(x.id) : "";
          const id2 = x?.product != null ? String(x.product) : "";
          const id3 = x?.product_id != null ? String(x.product_id) : "";
          return id1 === pid || id2 === pid || id3 === pid;
        }) || null;

      return p
        ? { available: getAvailableFromObject(p), name: xName(p) }
        : { available: 0, name: "" };
    },
    [allCatalogItems]
  );

  const getCartQtyById = useCallback(
    (productId) => {
      const line =
        (start?.items || []).find((x) => String(x.id) === String(productId)) ||
        null;
      return Number(line?.quantity ?? 0);
    },
    [start?.items]
  );

  const guardQty = useCallback(
    (productId, wantQty) => {
      const info = getItemAvailableById(productId);
      if (info == null) return true; // нет каталога — дадим серверу решить

      const { available, name } = info;
      if (wantQty > available) {
        alert(
          `Недостаточно на складе: «${
            name || productId
          }».\nНужно ${wantQty}, доступно ${available}.`
        );
        return false;
      }
      return true;
    },
    [getItemAvailableById]
  );

  const saveInline = useCallback(
    async (productId) => {
      const wantQty = quantity ? Number(quantity) : 1;

      if (!guardQty(productId, wantQty)) return;

      try {
        const payload = {
          id,
          productId,
          quantity: wantQty,
          discount_total: discount || 0,
        };
        await run(manualFilling(payload));
        await run(startSale());
        setInline({ id: null, field: null });
        setQuantity("");
        setDiscount("");
      } catch (err) {
        const parsed = parseStockError(err);
        if (parsed) {
          alert(
            `Недостаточно на складе: «${parsed.name}».\nНужно ${parsed.need}, доступно ${parsed.available}.`
          );
          return;
        }
        console.error(err);
        alert("Не удалось применить изменения");
      }
    },
    [id, quantity, discount, run, guardQty]
  );

  const addOne = useCallback(
    async (productId) => {
      const current = getCartQtyById(productId);
      if (!guardQty(productId, current + 1)) return;

      try {
        await run(manualFilling({ id, productId }));
        await run(startSale());
      } catch (err) {
        const parsed = parseStockError(err);
        if (parsed) {
          alert(
            `Недостаточно на складе: «${parsed.name}».\nНужно ${parsed.need}, доступно ${parsed.available}.`
          );
          return;
        }
        console.error(err);
        alert("Не удалось добавить товар");
      }
    },
    [id, run, guardQty, getCartQtyById]
  );

  const changeQtyOrRemove = useCallback(
    async (item) => {
      const qty = Number(item?.quantity ?? 0);
      try {
        if (qty > 1) {
          await run(
            updateProductInCart({
              id,
              productId: item.id,
              data: { quantity: qty - 1 },
            })
          );
        } else {
          await run(deleteProductInCart({ id, productId: item.id }));
        }
        await run(startSale());
      } catch (err) {
        const parsed = parseStockError(err);
        if (parsed) {
          alert(
            `Недостаточно на складе: «${parsed.name}».\nНужно ${parsed.need}, доступно ${parsed.available}.`
          );
          return;
        }
        console.error(err);
        alert("Не удалось обновить корзину");
      }
    },
    [id, run]
  );

  // ⛳️ ВАЖНО: клиентскую валидацию здесь убрали по вашей просьбе.
  // Мы не вызываем guardQty при подтверждении редактирования — даём серверу валидировать.
  const updateItemQuantity = useCallback(
    async (item, newQuantity) => {
      const qty = Number(newQuantity);

      if (qty <= 0) {
        try {
          await run(deleteProductInCart({ id, productId: item.id }));
          await run(startSale());
          setEditingQuantity({ id: null, value: "" });
        } catch (err) {
          const parsed = parseStockError(err);
          if (parsed) {
            alert(
              `Недостаточно на складе: «${parsed.name}».\nНужно ${parsed.need}, доступно ${parsed.available}.`
            );
            return;
          }
          console.error(err);
          alert("Не удалось удалить позицию");
        }
        return;
      }

      try {
        await run(
          updateProductInCart({
            id,
            productId: item.id,
            data: { quantity: qty },
          })
        );
        await run(startSale());
        setEditingQuantity({ id: null, value: "" });
      } catch (err) {
        const parsed = parseStockError(err);
        if (parsed) {
          alert(
            `Недостаточно на складе: «${parsed.name}».\nНужно ${parsed.need}, доступно ${parsed.available}.`
          );
          return;
        }
        console.error(err);
        alert("Не удалось обновить количество");
      }
    },
    [id, run]
  );

  const createClient = useCallback(
    async (e) => {
      e.preventDefault();
      try {
        const created = await run(createClientAsync(newClient));
        await dispatch(fetchClientsAsync());
        if (created?.id != null) setClientId(String(created.id));
        setPhone(created?.phone || newClient.phone || "");
        setShowCreateClient(false);
      } catch (err) {
        console.error(err);
        alert("Не удалось создать клиента");
      }
    },
    [newClient, run, dispatch]
  );

  const addCustomService = useCallback(
    async (e) => {
      e.preventDefault();
      if (!customService.name.trim() || !customService.price) {
        alert("Заполните название и цену услуги");
        return;
      }
      try {
        await run(
          addCustomItem({
            id,
            name: customService.name,
            price: customService.price,
            quantity: customService.quantity,
          })
        );
        await run(startSale());
        setCustomService({ name: "", price: "", quantity: 1 });
        setShowServices(false);
      } catch (err) {
        const parsed = parseStockError(err);
        if (parsed) {
          alert(
            `Недостаточно на складе: «${parsed.name}».\nНужно ${parsed.need}, доступно ${parsed.available}.`
          );
          return;
        }
        console.error(err);
        alert("Не удалось добавить услугу");
      }
    },
    [customService, id, run]
  );

  const performCheckout = useCallback(
    async (withReceipt) => {
      try {
        if (debt === "debt") {
          if (!clientId) return alert("Выберите клиента");
          if (!phone) return alert("Введите номер телефона");
          await createDebt({
            name: pickClient?.full_name,
            phone,
            amount: start?.total,
          });
        }

        if (clientId) {
          // console.log(debt);

          await dispatch(
            createDeal({
              clientId: clientId,
              title: `${debt || "Продажа"} ${pickClient?.full_name}`,
              statusRu: debt,
              amount: start?.total,
              prepayment: debt === "Предоплата" ? Number(amount) : undefined,
              debtMonths:
                debt === "Долги" || debt === "Предоплата"
                  ? Number(debtMonths)
                  : undefined,
            })
          ).unwrap();
        }

        const result = await run(
          productCheckout({
            id: start?.id,
            bool: withReceipt,
            clientId: clientId,
          })
        );

        await run(
          addCashFlows({
            ...cashData,
            name: cashData.name === "" ? "Продажа" : cashData.name,
            amount: debt === "Предоплата" ? amount : start.total,
          })
        );

        if (withReceipt && result?.sale_id) {
          const pdfBlob = await run(getProductCheckout(result.sale_id));
          const pdfInvoiceBlob = await run(getProductInvoice(result.sale_id));
          const dl = (blob, name) => {
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = name;
            a.click();
            URL.revokeObjectURL(url);
          };
          dl(pdfBlob, "receipt.pdf");
          dl(pdfInvoiceBlob, "invoice.pdf");
        }

        dispatch(historySellProduct());
        onClose();
      } catch (err) {
        const parsed = parseStockError(err);
        if (parsed) {
          alert(
            `Недостаточно на складе: «${parsed.name}».\nНужно ${parsed.need}, доступно ${parsed.available}.`
          );
          return;
        }
        console.error(err);
        alert("Не удалось оформить продажу");
      }
    },
    [
      debt,
      clientId,
      phone,
      pickClient?.full_name,
      start?.total,
      start?.id,
      cashData,
      run,
      dispatch,
      onClose,
      amount,
      debtMonths,
    ]
  );

  const debouncedSearch1 = useDebounce((v) => {
    dispatch(startSale(v.length === 0 ? 0 : v));
  }, 800);
  const onChange = (e) => debouncedSearch1(e.target.value);

  useEffect(() => {
    dispatch(doSearch({ search: "" }));
  }, [activeTab, dispatch]);

  useEffect(() => {
    dispatch(getProfile());
  }, [dispatch]);

  useEffect(() => {
    dispatch(fetchClientsAsync());
    dispatch(getCashBoxes());
    dispatch(fetchAgentProductsAsync());
  }, [dispatch]);

  useEffect(() => {
    setCashData((prev) => ({
      ...prev,
      cashbox: selectCashBox,
      // name: newItemData.name,
      // amount: newItemData.price,
    }));
  }, [selectCashBox]);

  useEffect(() => {
    if (!profile) return;
    dispatch(
      fetchTransfersAsync(
        profile?.role === "owner" ? {} : { agent: profile?.id }
      )
    );
  }, [dispatch, profile]);

  const isOutOfStock = useCallback(
    (p) =>
      Number(
        p?.qty_on_hand ?? p?.qty_on_agent ?? p?.quantity ?? p?.stock ?? 0
      ) <= 0,
    []
  );

  const handleTabClick = useCallback((index) => {
    setActiveTab(index);
    setIsTabSelected(true);
  }, []);

  const tabs = useMemo(
    () => [
      {
        label: "Сканировать",
        content: <BarcodeScanner id={id} />,
        option: "scan",
      },
      {
        label: "Вручную",
        content: (
          <ManualList
            items={filteredItems}
            inline={inline}
            quantity={quantity}
            discount={discount}
            onSearch={onSearch}
            setQuantity={setQuantity}
            setDiscount={setDiscount}
            saveInline={saveInline}
            setInline={setInline}
            addOne={addOne}
            isOutOfStock={isOutOfStock}
          />
        ),
        option: "manually",
      },
    ],
    [
      id,
      filteredItems,
      inline,
      quantity,
      discount,
      onSearch,
      saveInline,
      addOne,
      isOutOfStock,
    ]
  );

  return (
    <div className="add-modal sell">
      <div className="add-modal__overlay" onClick={onClose} />
      <div className="add-modal__content">
        <div className="add-modal__header">
          <h3>Продажа товара</h3>
          <X className="add-modal__close-icon" size={20} onClick={onClose} />
        </div>

        {company?.sector?.name !== "Магазин" ? (
          <ManualList
            items={sellData}
            inline={inline}
            quantity={quantity}
            discount={discount}
            onSearch={onSearch}
            setQuantity={setQuantity}
            setDiscount={setDiscount}
            saveInline={saveInline}
            setInline={setInline}
            addOne={addOne}
            isOutOfStock={isOutOfStock}
          />
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

        {!!start?.items?.length && (
          <div className="receipt">
            {location.pathname !== "/crm/production/agents" && (
              <>
                <button
                  className="create-client receipt__add"
                  onClick={() => setShowServices(true)}
                  type="button"
                >
                  Доп. Услуги <Plus />
                </button>
                {showServices && (
                  <form
                    className="receipt__services"
                    onSubmit={addCustomService}
                  >
                    <input
                      type="text"
                      className="add-modal__input one"
                      placeholder="Название услуги"
                      name="name"
                      value={customService.name}
                      onChange={onCustomServiceChange}
                      required
                    />
                    <input
                      type="number"
                      className="add-modal__input two"
                      placeholder="Цена"
                      name="price"
                      value={customService.price}
                      onChange={onCustomServiceChange}
                      min="0"
                      step="0.01"
                      required
                    />
                    <input
                      type="number"
                      className="add-modal__input"
                      placeholder="Количество"
                      name="quantity"
                      value={customService.quantity}
                      onChange={onCustomServiceChange}
                      min="1"
                      style={{ width: "100px" }}
                    />
                    <button type="submit" className="add-modal__button reBtn">
                      <Plus />
                    </button>
                  </form>
                )}
              </>
            )}
            <h2 className="receipt__title">Приход</h2>

            <ClientBlock
              company={company}
              filterClient={filterClient}
              clientId={clientId}
              setClientId={setClientId}
              showCreateClient={showCreateClient}
              setShowCreateClient={setShowCreateClient}
              newClient={newClient}
              onNewClientChange={onNewClientChange}
              createClient={createClient}
            />
            {paymentBlockMemo(
              company?.sector?.name,
              debt,
              phone,
              setDebt,
              setPhone,
              amount,
              setAmount,
              debtMonths,
              setDebtMonths
            )}

            {start.items.map((p, idx) => (
              <div className="receipt__item" key={p.id ?? idx}>
                <p className="receipt__item-name">
                  {idx + 1}. {p.product_name ?? p.display_name}
                </p>
                <div>
                  <p>{p.tax_total}</p>
                  <p className="receipt__item-price">
                    {editingQuantity.id === p.id ? (
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "8px",
                        }}
                      >
                        <input
                          type="number"
                          value={editingQuantity.value}
                          onChange={(e) =>
                            setEditingQuantity({
                              id: p.id,
                              value: e.target.value,
                            })
                          }
                          min="0"
                          style={{
                            width: "60px",
                            padding: "4px 8px",
                            border: "1px solid #ccc",
                            borderRadius: "4px",
                          }}
                          autoFocus
                        />
                        <button
                          type="button"
                          onClick={() =>
                            updateItemQuantity(p, editingQuantity.value)
                          }
                          style={{
                            padding: "4px 8px",
                            background: "#28a745",
                            color: "white",
                            border: "none",
                            borderRadius: "4px",
                            cursor: "pointer",
                          }}
                        >
                          ✓
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setEditingQuantity({ id: null, value: "" })
                          }
                          style={{
                            padding: "4px 8px",
                            background: "#dc3545",
                            color: "white",
                            border: "none",
                            borderRadius: "4px",
                            cursor: "pointer",
                          }}
                        >
                          ✕
                        </button>
                      </div>
                    ) : (
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "8px",
                        }}
                      >
                        <span>
                          {p.quantity} x {p.unit_price} ≡{" "}
                          {p.quantity * p.unit_price}
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            setEditingQuantity({
                              id: p.id,
                              value: p.quantity.toString(),
                            })
                          }
                          style={{
                            padding: "4px 8px",
                            background: "#ffd600",
                            color: "white",
                            border: "none",
                            borderRadius: "4px",
                            cursor: "pointer",
                            fontSize: "12px",
                          }}
                        >
                          Изменить
                        </button>
                        <button
                          type="button"
                          onClick={() => changeQtyOrRemove(p)}
                        >
                          <Minus size={16} />
                        </button>
                      </div>
                    )}
                  </p>
                </div>
              </div>
            ))}

            <button
              className="create-client"
              style={{ width: "100%", marginBottom: 10 }}
              onClick={() => setShowDiscount(!showDiscount)}
            >
              {showDiscount ? "Отменить" : "Добавить общую скидку"}
            </button>
            {showDiscount && (
              <div className="receipt__discount">
                <input
                  type="text"
                  onChange={onChange}
                  className="add-modal__input"
                  placeholder="Сумма скидки"
                />
              </div>
            )}

            <div className="receipt__total">
              <b>ИТОГО</b>
              <div style={{ gap: 10, display: "flex", alignItems: "center" }}>
                <p>Общая скидка {start?.discount_total}</p>
                <p>Налог {start?.tax_total}</p>
                <b>≡ {start?.total}</b>
              </div>
            </div>

            <div className="receipt__row">
              <button
                className="receipt__row-btn"
                onClick={() => performCheckout(true)}
                type="button"
              >
                Печать чека
              </button>
              <button
                className="receipt__row-btn"
                onClick={() => performCheckout(false)}
                type="button"
              >
                Без чека
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SellModal;

/* =========================
   2) PaymentBlock
   ========================= */
function PaymentBlock({
  sectorName,
  debt,
  setDebt,
  phone,
  setPhone,
  amount,
  setAmount,
  debtMonths,
  setDebtMonths,
}) {
  return (
    <>
      <div className="add-modal__section">
        <label>Тип оплаты</label>
        <select
          className="add-modal__input"
          value={debt}
          onChange={(e) => setDebt(e.target.value)}
        >
          <option value="">-- Выберите тип оплаты --</option>
          {DEAL_STATUS_RU.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      </div>

      {debt === "Предоплата" && (
        <>
          <div className="add-modal__section">
            <label>Сумма предоплаты *</label>
            <input
              className="add-modal__input"
              placeholder="Введите сумму предоплаты"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
          <div className="add-modal__section">
            <label>Срок долга (месяцев) *</label>
            <input
              className="add-modal__input"
              placeholder="Например, 6"
              min={1}
              step={1}
              value={debtMonths}
              onChange={(e) => setDebtMonths(e.target.value)}
            />
          </div>
        </>
      )}

      {debt === "Долги" && (
        <>
          <div className="add-modal__section">
            <label>Срок долга (месяцев) *</label>
            <input
              className="add-modal__input"
              placeholder="Например, 6"
              min={1}
              step={1}
              value={debtMonths}
              onChange={(e) => setDebtMonths(e.target.value)}
            />
          </div>
        </>
      )}
    </>
  );
}

const paymentBlockMemo = (
  sectorName,
  debt,
  phone,
  setDebt,
  setPhone,
  amount,
  setAmount,
  debtMonths,
  setDebtMonths
) => {
  if (sectorName !== "Магазин" && !window.location.href.includes("agents"))
    return "";
  return (
    <PaymentBlock
      sectorName={sectorName}
      debt={debt}
      setDebt={setDebt}
      phone={phone}
      setPhone={setPhone}
      amount={amount}
      setAmount={setAmount}
      debtMonths={debtMonths}
      setDebtMonths={setDebtMonths}
    />
  );
};

/* =========================
   3) ManualList
   ========================= */
const ManualList = React.memo(function ManualList({
  items = [],
  inline,
  quantity,
  discount,
  onSearch,
  setQuantity,
  setDiscount,
  saveInline,
  setInline,
  addOne,
  isOutOfStock,
}) {
  const list = Array.isArray(items)
    ? items
    : Array.isArray(items?.results)
    ? items.results
    : [];

  const getItemId = (p) => p?.id ?? p?.product;
  const getItemName = (p) => p?.name ?? p?.product_name ?? "";
  const getItemQty = (p) =>
    p?.qty_on_agent ?? p?.qty_on_hand ?? p?.quantity ?? p?.stock ?? 0;

  return (
    <div className="sell__manual">
      <input
        type="text"
        placeholder="Введите название товара"
        className="add-modal__input"
        name="search"
        onChange={onSearch}
      />
      <ul className="sell__list">
        {list.map((p) => {
          const pid = getItemId(p);
          return (
            <li key={pid}>
              <div style={{ display: "flex", columnGap: "10px" }}>
                <p>
                  {getItemName(p).length > 10
                    ? `${getItemName(p).slice(0, 10)}...`
                    : getItemName(p)}
                </p>
                <p>{getItemQty(p)}</p>
              </div>
              <div className="sell__list-row">
                {isOutOfStock(p) ? (
                  <div className="sell__empty">
                    <span className="sell__badge--danger">Нет в наличии</span>
                  </div>
                ) : inline.id === pid && inline.field === "quantity" ? (
                  <>
                    <input
                      type="number"
                      value={quantity}
                      onChange={(e) => setQuantity(e.target.value)}
                      placeholder="Количество"
                    />
                    <button type="button" onClick={() => saveInline(pid)}>
                      <Check />
                    </button>
                    <button
                      type="button"
                      onClick={() => setInline({ id: null, field: null })}
                    >
                      <X />
                    </button>
                  </>
                ) : inline.id === pid && inline.field === "discount" ? (
                  <>
                    <input
                      type="number"
                      value={discount}
                      onChange={(e) => setDiscount(e.target.value)}
                      placeholder="Скидка (сом)"
                    />
                    <button type="button" onClick={() => saveInline(pid)}>
                      <Check />
                    </button>
                    <button
                      type="button"
                      onClick={() => setInline({ id: null, field: null })}
                    >
                      <X />
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => setInline({ id: pid, field: "discount" })}
                    >
                      <Tags />
                    </button>
                    <button
                      type="button"
                      onClick={() => setInline({ id: pid, field: "quantity" })}
                    >
                      <ListOrdered />
                    </button>
                    <button type="button" onClick={() => addOne(pid)}>
                      <Plus size={16} />
                    </button>
                  </>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
});

/* =========================
   4) ClientBlock
   ========================= */
const ClientBlock = React.memo(function ClientBlock({
  company,
  filterClient,
  clientId,
  setClientId,
  showCreateClient,
  setShowCreateClient,
  newClient,
  onNewClientChange,
  createClient,
}) {
  return (
    <div className="add-modal__section">
      <label>Клиенты *</label>
      <select
        className="add-modal__input"
        value={clientId}
        onChange={(e) => setClientId(e.target.value)}
        required
      >
        <option value="">-- Выберите клиента --</option>
        {filterClient.map((c) => (
          <option key={c.id} value={String(c.id)}>
            {c.full_name}
          </option>
        ))}
      </select>

      <button
        type="button"
        className="create-client"
        onClick={() => setShowCreateClient((s) => !s)}
      >
        {showCreateClient ? "Отменить" : "Создать клиента"}
      </button>

      {showCreateClient && (
        <form
          style={{
            display: "flex",
            flexDirection: "column",
            rowGap: "10px",
          }}
          onSubmit={createClient}
        >
          <input
            className="add-modal__input"
            onChange={onNewClientChange}
            type="text"
            placeholder="ФИО"
            name="full_name"
          />
          <input
            className="add-modal__input"
            onChange={onNewClientChange}
            type="text"
            name="llc"
            placeholder="ОсОО"
          />
          <input
            className="add-modal__input"
            onChange={onNewClientChange}
            type="text"
            name="inn"
            placeholder="ИНН"
          />
          <input
            className="add-modal__input"
            onChange={onNewClientChange}
            type="text"
            name="okpo"
            placeholder="ОКПО"
          />
          <input
            className="add-modal__input"
            onChange={onNewClientChange}
            type="text"
            name="score"
            placeholder="Р/СЧЁТ"
          />
          <input
            className="add-modal__input"
            onChange={onNewClientChange}
            type="text"
            name="bik"
            placeholder="БИК"
          />
          <input
            className="add-modal__input"
            onChange={onNewClientChange}
            type="text"
            name="address"
            placeholder="Адрес"
          />
          <input
            className="add-modal__input"
            onChange={onNewClientChange}
            type="text"
            name="phone"
            placeholder="Телефон"
          />
          <input
            className="add-modal__input"
            onChange={onNewClientChange}
            type="email"
            name="email"
            placeholder="Почта"
          />
          <div style={{ display: "flex", columnGap: "10px" }}>
            <button
              className="create-client"
              type="button"
              onClick={() => setShowCreateClient(false)}
            >
              Отмена
            </button>
            <button className="create-client">Создать</button>
          </div>
        </form>
      )}

      {company?.sector?.name === "Строительная компания" && (
        <select className="add-modal__input" defaultValue="">
          <option value="" disabled>
            -- Выберите тип платежа --
          </option>
          <option>Аванс</option>
          <option>Кредит</option>
          <option>Полная оплата</option>
        </select>
      )}
    </div>
  );
});
