import React, { useState, useEffect } from "react";
import { X, ChevronDown, ChevronUp } from "lucide-react";
import { useDispatch } from "react-redux";
import warehouseAPI from "../../../../../api/warehouse";
import { createSaleFromAgentCartAsync } from "../../../../../store/creators/warehouseThunk";
import "./ReconciliationModal.scss";
import "./CreateSaleFromCartModal.scss";

const msgFromError = (e, fallback = "Произошла ошибка") => {
  if (e?.detail && typeof e.detail === "string") return e.detail;
  if (e?.detail && typeof e.detail === "object")
    return e.detail?.message || fallback;
  if (e?.response?.data) {
    const d = e.response.data;
    if (typeof d === "string") return d;
    if (d?.detail)
      return Array.isArray(d.detail) ? d.detail.join(", ") : d.detail;
    if (d?.message) return d.message;
    if (d?.status && typeof d.status === "string") return d.status;
  }
  if (e?.message) return e.message;
  return fallback;
};

export default function CreateSaleFromCartModal({
  open,
  onClose,
  cart,
  onSuccess,
}) {
  const dispatch = useDispatch();
  const [counterparties, setCounterparties] = useState([]);
  const [counterpartiesLoading, setCounterpartiesLoading] = useState(false);
  const [cartItems, setCartItems] = useState([]);
  const [cartItemsLoading, setCartItemsLoading] = useState(false);
  const [itemsDropdownOpen, setItemsDropdownOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    counterparty: "",
    payment_kind: "cash",
    prepayment_amount: "",
    discount_percent: "0",
    discount_amount: "0",
    comment: "",
    post: false,
  });

  useEffect(() => {
    if (open) {
      setError("");
      setItemsDropdownOpen(false);
      setForm({
        counterparty: "",
        payment_kind: "cash",
        prepayment_amount: "",
        discount_percent: "0",
        discount_amount: "0",
        comment: "",
        post: false,
      });
      loadCounterparties();
      // Позиции заявки: из cart.items или подгрузка по cart.id
      const itemsFromCart = Array.isArray(cart?.items) ? cart.items : [];
      if (itemsFromCart.length > 0) {
        setCartItems(itemsFromCart);
        setCartItemsLoading(false);
      } else if (cart?.id) {
        setCartItemsLoading(true);
        setCartItems([]);
        warehouseAPI
          .listAgentCartItems({ cart: cart.id })
          .then((data) => {
            const list = Array.isArray(data?.results)
              ? data.results
              : Array.isArray(data)
                ? data
                : [];
            setCartItems(list);
          })
          .catch(() => setCartItems([]))
          .finally(() => setCartItemsLoading(false));
      } else {
        setCartItems([]);
        setCartItemsLoading(false);
      }
    }
  }, [open, cart?.id, cart?.items]);

  // Автовыбор контрагента по агенту заявки (cart.agent === counterparty.agent)
  useEffect(() => {
    if (!open || !cart?.agent || counterparties.length === 0) return;
    const found = counterparties.find(
      (c) => c?.agent != null && String(c.agent) === String(cart.agent),
    );
    if (found) {
      setForm((prev) =>
        prev.counterparty === "" ? { ...prev, counterparty: found.id } : prev,
      );
    }
  }, [open, cart?.agent, counterparties]);

  const loadCounterparties = async () => {
    setCounterpartiesLoading(true);
    try {
      const data = await warehouseAPI.listCounterparties({
        page_size: 500,
        type: "CLIENT",
      });
      const list = Array.isArray(data?.results)
        ? data.results
        : Array.isArray(data)
          ? data
          : [];
      setCounterparties(list);
    } catch (e) {
      console.error("Ошибка загрузки контрагентов:", e);
      setCounterparties([]);
    } finally {
      setCounterpartiesLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!cart?.id) return;
    if (!form.counterparty) {
      setError("Выберите контрагента");
      return;
    }
    setSubmitting(true);
    setError("");
    const payload = {
      counterparty: form.counterparty,
      post: form.post,
      payment_kind: form.payment_kind,
      discount_percent: String(Number(form.discount_percent) || 0),
      discount_amount: String(Number(form.discount_amount) || 0),
      comment: form.comment || "",
    };
    if (form.payment_kind === "credit" && form.prepayment_amount) {
      payload.prepayment_amount = String(
        Number(String(form.prepayment_amount).replace(",", ".")) || 0,
      );
    }
    try {
      const result = await dispatch(
        createSaleFromAgentCartAsync({ cartId: cart.id, payload }),
      );
      if (createSaleFromAgentCartAsync.fulfilled.match(result)) {
        onSuccess?.(result.payload);
        onClose?.();
      } else {
        setError(
          msgFromError(
            result.payload || result.error,
            "Не удалось создать продажу",
          ),
        );
      }
    } catch (e) {
      setError(msgFromError(e, "Не удалось создать продажу"));
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) return null;

  // Контрагент зафиксирован по агенту заявки — поле не редактируется
  const counterpartyLockedByAgent =
    Boolean(cart?.agent) &&
    counterparties.some(
      (c) => c?.agent != null && String(c.agent) === String(cart.agent),
    );

  return (
    <div className="reconciliation-modal-overlay" onClick={onClose}>
      <div
        className="reconciliation-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="reconciliation-modal__header">
          <h2 className="reconciliation-modal__title">
            Создать продажу по заявке
          </h2>
          <button
            type="button"
            className="reconciliation-modal__close"
            onClick={onClose}
            aria-label="Закрыть"
          >
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="overflow-y-scroll">
          <div className="reconciliation-modal__content">
            {error && (
              <div className="reconciliation-modal__error">{error}</div>
            )}

            {/* Позиции заявки (дропдаун) */}
            <div className="create-sale-cart-modal__items">
              <button
                type="button"
                className="create-sale-cart-modal__items-trigger"
                onClick={() => setItemsDropdownOpen((v) => !v)}
                aria-expanded={itemsDropdownOpen}
              >
                <span className="create-sale-cart-modal__items-title">
                  Позиции заявки
                  {!cartItemsLoading && cartItems.length > 0 && (
                    <span className="create-sale-cart-modal__items-count">
                      {" "}
                      ({cartItems.length})
                    </span>
                  )}
                </span>
                {itemsDropdownOpen ? (
                  <ChevronUp
                    size={20}
                    className="create-sale-cart-modal__items-chevron"
                  />
                ) : (
                  <ChevronDown
                    size={20}
                    className="create-sale-cart-modal__items-chevron"
                  />
                )}
              </button>
              {itemsDropdownOpen && (
                <>
                  {cartItemsLoading ? (
                    <div className="create-sale-cart-modal__items-loading">
                      Загрузка…
                    </div>
                  ) : cartItems.length === 0 ? (
                    <div className="create-sale-cart-modal__items-empty">
                      Нет позиций
                    </div>
                  ) : (
                    <div className="create-sale-cart-modal__items-table-wrap">
                      <table className="create-sale-cart-modal__items-table">
                        <thead>
                          <tr>
                            <th>№</th>
                            <th>Товар</th>
                            <th>Кол-во</th>
                            <th>Цена</th>
                            <th>Сумма</th>
                          </tr>
                        </thead>
                        <tbody>
                          {cartItems.map((row, idx) => {
                            const name =
                              row.product_name ??
                              row.product?.name ??
                              row.name ??
                              (row.product
                                ? `ID ${typeof row.product === "object" ? (row.product?.id ?? "") : row.product}`
                                : "—");
                            const qty =
                              row.qty ??
                              row.quantity_requested ??
                              row.total_quantity ??
                              row.quantity ??
                              "—";
                            const price =
                              row.price ??
                              row.unit_price ??
                              row.unit_price_requested;
                            const sum = row.line_total ?? row.total ?? row.sum;
                            const formatNum = (v) =>
                              v != null && v !== ""
                                ? Number(v).toFixed(2)
                                : "—";
                            return (
                              <tr key={row.id || idx}>
                                <td>{idx + 1}</td>
                                <td>{name}</td>
                                <td>{formatNum(qty)}</td>
                                <td>{formatNum(price)}</td>
                                <td>{formatNum(sum)}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="reconciliation-modal__form-group">
              <label className="reconciliation-modal__label">
                Контрагент *
              </label>
              <select
                className="reconciliation-modal__input"
                value={form.counterparty}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, counterparty: e.target.value }))
                }
                disabled={counterpartiesLoading || counterpartyLockedByAgent}
              >
                <option value="">Выберите контрагента</option>
                {counterparties.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name || c.full_name || `Контрагент ${c.id}`}
                  </option>
                ))}
              </select>
            </div>

            <div className="reconciliation-modal__form-group">
              <span className="reconciliation-modal__label">Оплата</span>
              <div style={{ display: "flex", gap: 16, marginTop: 8 }}>
                <label
                  style={{ display: "flex", alignItems: "center", gap: 6 }}
                >
                  <input
                    type="radio"
                    name="payment_kind"
                    checked={form.payment_kind === "cash"}
                    onChange={() =>
                      setForm((prev) => ({ ...prev, payment_kind: "cash" }))
                    }
                  />
                  Сразу
                </label>
                <label
                  style={{ display: "flex", alignItems: "center", gap: 6 }}
                >
                  <input
                    type="radio"
                    name="payment_kind"
                    checked={form.payment_kind === "credit"}
                    onChange={() =>
                      setForm((prev) => ({ ...prev, payment_kind: "credit" }))
                    }
                  />
                  В долг
                </label>
              </div>
            </div>

            {form.payment_kind === "credit" && (
              <div className="reconciliation-modal__form-group">
                <label className="reconciliation-modal__label">
                  Предоплата (prepayment_amount), сом
                </label>
                <input
                  type="text"
                  inputMode="decimal"
                  className="reconciliation-modal__input"
                  value={form.prepayment_amount}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      prepayment_amount: e.target.value,
                    }))
                  }
                  placeholder="0"
                />
              </div>
            )}

            <div className="reconciliation-modal__form-row">
              <div className="reconciliation-modal__form-group">
                <label className="reconciliation-modal__label">Скидка, %</label>
                <input
                  type="text"
                  inputMode="decimal"
                  className="reconciliation-modal__input"
                  value={form.discount_percent}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      discount_percent: e.target.value,
                    }))
                  }
                />
              </div>
              <div className="reconciliation-modal__form-group">
                <label className="reconciliation-modal__label">
                  Скидка, сом
                </label>
                <input
                  type="text"
                  inputMode="decimal"
                  className="reconciliation-modal__input"
                  value={form.discount_amount}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      discount_amount: e.target.value,
                    }))
                  }
                />
              </div>
            </div>

            <div className="reconciliation-modal__form-group">
              <label className="reconciliation-modal__label">Комментарий</label>
              <textarea
                className="reconciliation-modal__input"
                rows={2}
                value={form.comment}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, comment: e.target.value }))
                }
                placeholder="Комментарий к документу"
              />
            </div>

            <div className="reconciliation-modal__form-group">
              <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <input
                  type="checkbox"
                  checked={form.post}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, post: e.target.checked }))
                  }
                />
                Сразу провести документ
              </label>
            </div>
          </div>

          <div className="reconciliation-modal__actions">
            <button
              type="button"
              className="reconciliation-modal__cancel-btn"
              onClick={onClose}
            >
              Отменить
            </button>
            <button
              type="submit"
              className="reconciliation-modal__download-btn"
              disabled={submitting || !form.counterparty}
            >
              {submitting ? "Создание…" : "Создать продажу"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
