import { Check, Plus, RefreshCw, Search, Send, Trash2, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useUser } from "../../../../store/slices/userSlice";
import {
  approveAgentCart,
  createAgentCart,
  createAgentCartItem,
  deleteAgentCart,
  deleteAgentCartItem,
  getAgentCartById,
  getProductById,
  listAgentCartItems,
  listAgentCarts,
  listMyAgentProducts,
  listOwnerAgentsProducts,
  listProducts,
  listWarehouses,
  patchAgentCart,
  patchAgentCartItem,
  rejectAgentCart,
  submitAgentCart,
} from "../../../../api/warehouse";
import { VIEW_MODES } from "../../Market/Warehouse/constants";

import "../../Market/Warehouse/Warehouse.scss";
import "./Agents.scss";

const normalizeList = (data) => {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.results)) return data.results;
  return [];
};

const shortId = (id) => {
  const s = String(id || "");
  if (!s) return "—";
  return s.length > 8 ? `${s.slice(0, 8)}…` : s;
};

const fmtDateTime = (iso) => {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("ru-RU");
  } catch {
    return String(iso);
  }
};

const statusLabel = (status) => {
  switch (status) {
    case "draft":
      return "Черновик";
    case "submitted":
      return "Отправлено";
    case "approved":
      return "Одобрено";
    case "rejected":
      return "Отклонено";
    default:
      return status || "—";
  }
};

const statusClass = (status) => {
  switch (status) {
    case "draft":
      return "badge--draft";
    case "submitted":
      return "badge--submitted";
    case "approved":
      return "badge--approved";
    case "rejected":
      return "badge--rejected";
    default:
      return "badge--draft";
  }
};

const ProductAutocomplete = ({ onPick, disabled }) => {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [options, setOptions] = useState([]);
  const timerRef = useRef(null);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (!query.trim() || disabled) {
      setOptions([]);
      return;
    }
    timerRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const data = await listProducts({
          search: query.trim(),
          page_size: 10,
        });
        setOptions(normalizeList(data));
      } catch (e) {
        console.error(e);
        setOptions([]);
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [query, disabled]);

  return (
    <div className="agents-product-autocomplete">
      <div className="warehouse-search" style={{ marginBottom: 8 }}>
        <Search className="warehouse-search__icon" size={18} />
        <input
          type="text"
          className="warehouse-search__input"
          placeholder="Поиск товара по названию/артикулу/штрихкоду…"
          value={query}
          disabled={disabled}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      {loading ? (
        <div className="agents-hint">Поиск…</div>
      ) : options.length === 0 ? (
        <div className="agents-hint">Ничего не найдено</div>
      ) : (
        <div className="agents-options">
          {options.map((p) => (
            <button
              type="button"
              key={p.id}
              className="agents-option"
              onClick={() => {
                onPick?.(p);
                setQuery("");
                setOptions([]);
              }}
            >
              <div className="agents-option__name">{p.name || "—"}</div>
              <div className="agents-option__meta">
                {p.article ? `арт. ${p.article}` : ""}{" "}
                {p.unit ? `• ${p.unit}` : ""}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

const AgentCartModal = ({
  open,
  onClose,
  cartId,
  setCartId,
  onChanged,
  warehousesById,
  isOwnerOrAdmin,
  currentUserId,
}) => {
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [cart, setCart] = useState(null);
  const [items, setItems] = useState([]);
  const [form, setForm] = useState({ warehouse: "", note: "" });
  const [itemQtyDraft, setItemQtyDraft] = useState({});
  const productLabelCacheRef = useRef(new Map());
  const productMetaCacheRef = useRef(new Map());
  const [error, setError] = useState("");

  const isDraft = cart?.status === "draft" || !cart?.status;
  const canEditItems = Boolean(cartId) && isDraft;

  const load = useCallback(async () => {
    if (!cartId) return;
    setLoading(true);
    setError("");
    try {
      const c = await getAgentCartById(cartId);
      setCart(c);
      setForm({
        warehouse: c?.warehouse || "",
        note: c?.note || "",
      });

      const itData = await listAgentCartItems({ cart: cartId });
      const itList = normalizeList(itData);
      setItems(itList);
      setItemQtyDraft(
        itList.reduce((acc, it) => {
          acc[it.id] = it.quantity_requested ?? "";
          return acc;
        }, {})
      );
    } catch (e) {
      console.error(e);
      setError(e?.detail || "Не удалось загрузить заявку");
    } finally {
      setLoading(false);
    }
  }, [cartId]);

  useEffect(() => {
    if (!open) return;
    if (cartId) {
      load();
    } else {
      setCart(null);
      setItems([]);
      setError("");
      setForm({ warehouse: "", note: "" });
      setItemQtyDraft({});
    }
  }, [open, cartId, load]);

  const getProductMeta = useCallback(async (productValue) => {
    const productId =
      typeof productValue === "string"
        ? productValue
        : productValue?.id || productValue;
    if (!productId) return { id: "", name: "—", article: null, unit: "" };

    // если бэк уже отдал объект
    if (typeof productValue === "object" && productValue?.name) {
      return {
        id: productValue.id || productId,
        name: productValue.name,
        article: productValue.article ?? null,
        unit: productValue.unit || "",
      };
    }

    const cached = productMetaCacheRef.current.get(productId);
    if (cached) return cached;

    // placeholder, чтобы не спамить запросами
    const placeholder = {
      id: productId,
      name: "…",
      article: null,
      unit: "",
    };
    productMetaCacheRef.current.set(productId, placeholder);
    try {
      const p = await getProductById(productId);
      const meta = {
        id: productId,
        name: p?.name || shortId(productId),
        article: p?.article ?? null,
        unit: p?.unit || "",
      };
      productMetaCacheRef.current.set(productId, meta);
      productLabelCacheRef.current.set(productId, meta.name);
      return meta;
    } catch (e) {
      const meta = {
        id: productId,
        name: shortId(productId),
        article: null,
        unit: "",
      };
      productMetaCacheRef.current.set(productId, meta);
      productLabelCacheRef.current.set(productId, meta.name);
      return meta;
    }
  }, []);

  const [productMetaByItemId, setProductMetaByItemId] = useState({});
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      const next = {};
      for (const it of items) {
        const meta = await getProductMeta(it.product);
        next[it.id] = {
          name: it.product_name || meta.name,
          article: meta.article,
          unit: meta.unit,
          productId:
            typeof it.product === "string"
              ? it.product
              : it.product?.id || it.product,
        };
      }
      if (!cancelled) setProductMetaByItemId(next);
    })();
    return () => {
      cancelled = true;
    };
  }, [items, open, getProductMeta]);

  const [newItem, setNewItem] = useState({
    product: null,
    quantity_requested: "1.000",
  });

  useEffect(() => {
    if (!open) return;
    // сбрасываем форму добавления при открытии/смене заявки
    setNewItem({ product: null, quantity_requested: "1.000" });
  }, [open, cartId]);

  const saveCartHeader = async () => {
    if (!cartId) return;
    setBusy(true);
    setError("");
    try {
      const patched = await patchAgentCart(cartId, {
        warehouse: form.warehouse || null,
        note: form.note || "",
      });
      setCart(patched);
      onChanged?.();
    } catch (e) {
      console.error(e);
      setError(e?.detail || "Не удалось сохранить");
    } finally {
      setBusy(false);
    }
  };

  const createCart = async () => {
    if (!form.warehouse) {
      setError("Выберите склад");
      return;
    }
    if (!currentUserId) {
      setError("Не определен текущий пользователь (agent)");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const created = await createAgentCart({
        agent: currentUserId,
        warehouse: form.warehouse,
        note: form.note || "",
      });
      setCart(created);
      setCartId?.(created?.id);
      onChanged?.();
    } catch (e) {
      console.error(e);
      setError(e?.detail || "Не удалось создать заявку");
    } finally {
      setBusy(false);
    }
  };

  const removeCart = async () => {
    if (!cartId) return;
    if (!window.confirm("Удалить заявку?")) return;
    setBusy(true);
    setError("");
    try {
      await deleteAgentCart(cartId);
      onChanged?.();
      setCartId?.(null);
      onClose?.();
    } catch (e) {
      console.error(e);
      setError(e?.detail || "Не удалось удалить");
    } finally {
      setBusy(false);
    }
  };

  const doSubmit = async () => {
    if (!cartId) return;
    setBusy(true);
    setError("");
    try {
      const res = await submitAgentCart(cartId);
      setCart(res);
      onChanged?.();
      await load();
    } catch (e) {
      console.error(e);
      setError(e?.detail || "Не удалось отправить");
    } finally {
      setBusy(false);
    }
  };

  const doApprove = async () => {
    if (!cartId) return;
    if (!window.confirm("Одобрить заявку? Товар будет списан со склада."))
      return;
    setBusy(true);
    setError("");
    try {
      const res = await approveAgentCart(cartId);
      setCart(res);
      onChanged?.();
      await load();
    } catch (e) {
      console.error(e);
      setError(e?.detail || "Не удалось одобрить");
    } finally {
      setBusy(false);
    }
  };

  const doReject = async () => {
    if (!cartId) return;
    if (!window.confirm("Отклонить заявку?")) return;
    setBusy(true);
    setError("");
    try {
      const res = await rejectAgentCart(cartId);
      setCart(res);
      onChanged?.();
      await load();
    } catch (e) {
      console.error(e);
      setError(e?.detail || "Не удалось отклонить");
    } finally {
      setBusy(false);
    }
  };

  const addItem = async (product, qty) => {
    if (!cartId) return;
    const qtyNum = Number.parseFloat(String(qty).replace(",", "."));
    if (!Number.isFinite(qtyNum) || qtyNum <= 0) {
      setError("Введите корректное количество (> 0)");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await createAgentCartItem({
        cart: cartId,
        product: product?.id || product,
        quantity_requested: qtyNum.toFixed(3),
      });
      await load();
      onChanged?.();
      setNewItem({ product: null, quantity_requested: "1.000" });
    } catch (e) {
      console.error(e);
      setError(e?.detail || "Не удалось добавить позицию");
    } finally {
      setBusy(false);
    }
  };

  const saveItemQty = async (itemId) => {
    const value = itemQtyDraft?.[itemId];
    setBusy(true);
    setError("");
    try {
      await patchAgentCartItem(itemId, {
        quantity_requested: value === "" ? "0" : String(value),
      });
      await load();
      onChanged?.();
    } catch (e) {
      console.error(e);
      setError(e?.detail || "Не удалось сохранить количество");
    } finally {
      setBusy(false);
    }
  };

  const removeItem = async (itemId) => {
    if (!window.confirm("Удалить позицию?")) return;
    setBusy(true);
    setError("");
    try {
      await deleteAgentCartItem(itemId);
      await load();
      onChanged?.();
    } catch (e) {
      console.error(e);
      setError(e?.detail || "Не удалось удалить позицию");
    } finally {
      setBusy(false);
    }
  };

  if (!open) return null;

  const warehouseLabel =
    warehousesById?.[form.warehouse]?.name ||
    warehousesById?.[cart?.warehouse]?.name ||
    "";

  const agentLabel =
    cart?.agent_name ||
    cart?.agent_display ||
    (cart?.agent ? shortId(cart.agent) : "—");
  return (
    <div className="agent-cart-modal">
      <div className="agent-cart-modal__overlay" onClick={onClose} />
      <div
        className="agent-cart-modal__dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="agent-cart-modal-title"
      >
        {/* Header: заголовок, статус, ID, закрыть */}
        <header className="agent-cart-modal__header">
          <div className="agent-cart-modal__header-left">
            <h2 id="agent-cart-modal-title" className="agent-cart-modal__title">
              {cartId ? "Заявка на товар" : "Новая заявка"}
            </h2>
            {cartId && (
              <div className="agent-cart-modal__meta-inline">
                <span className={`agents-badge ${statusClass(cart?.status)}`}>
                  {statusLabel(cart?.status)}
                </span>
              </div>
            )}
          </div>
          <button
            type="button"
            className="agent-cart-modal__close"
            onClick={onClose}
            aria-label="Закрыть"
          >
            <X size={22} />
          </button>
        </header>

        {error && <div className="agent-cart-modal__error">{error}</div>}

        {loading ? (
          <div className="agent-cart-modal__body">
            <div className="agent-cart-modal__loading">Загрузка заявки…</div>
          </div>
        ) : (
          <>
            <div className="agent-cart-modal__body">
              {/* Блок данных заявки (6.1): все поля из API */}
              {cartId && cart && (
                <section className="agent-cart-modal__section agent-cart-modal__info">
                  <h3 className="agent-cart-modal__section-title">
                    Данные заявки
                  </h3>
                  <div className="agent-cart-modal__info-grid">
                    <div className="agent-cart-modal__field">
                      <span className="agent-cart-modal__field-label">
                        Агент
                      </span>
                      <span className="agent-cart-modal__field-value">
                        {agentLabel}
                      </span>
                    </div>
                    <div className="agent-cart-modal__field">
                      <span className="agent-cart-modal__field-label">
                        Склад
                      </span>
                      <span className="agent-cart-modal__field-value">
                        {warehouseLabel || shortId(cart.warehouse)}
                      </span>
                    </div>
                    <div className="agent-cart-modal__field">
                      <span className="agent-cart-modal__field-label">
                        Статус
                      </span>
                      <span
                        className={`agents-badge ${statusClass(cart.status)}`}
                      >
                        {statusLabel(cart.status)}
                      </span>
                    </div>
                    <div className="agent-cart-modal__field agent-cart-modal__field--full">
                      <span className="agent-cart-modal__field-label">
                        Примечание
                      </span>
                      <span className="agent-cart-modal__field-value">
                        {cart.note || "—"}
                      </span>
                    </div>
                    <div className="agent-cart-modal__field">
                      <span className="agent-cart-modal__field-label">
                        Дата создания
                      </span>
                      <span className="agent-cart-modal__field-value">
                        {fmtDateTime(cart.created_date)}
                      </span>
                    </div>
                    <div className="agent-cart-modal__field">
                      <span className="agent-cart-modal__field-label">
                        Дата одобрения
                      </span>
                      <span className="agent-cart-modal__field-value">
                        {fmtDateTime(cart.approved_at)}
                      </span>
                    </div>
                  </div>
                </section>
              )}

              {/* Редактируемые поля: склад, примечание */}
              <section className="agent-cart-modal__section">
                <h3 className="agent-cart-modal__section-title">
                  {cartId ? "Редактирование" : "Параметры заявки"}
                </h3>
                <div className="agent-cart-modal__form">
                  <label className="agent-cart-modal__label">
                    Склад *
                    <select
                      className="agent-cart-modal__input"
                      value={form.warehouse}
                      disabled={busy || (cartId && !isDraft)}
                      onChange={(e) =>
                        setForm((p) => ({ ...p, warehouse: e.target.value }))
                      }
                    >
                      <option value="">Выберите склад…</option>
                      {Object.values(warehousesById || {}).map((w) => (
                        <option value={w.id} key={w.id}>
                          {w.name || w.title || shortId(w.id)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="agent-cart-modal__label">
                    Примечание (note)
                    <textarea
                      className="agent-cart-modal__input agent-cart-modal__textarea"
                      rows={3}
                      value={form.note}
                      disabled={busy || (cartId && !isDraft)}
                      onChange={(e) =>
                        setForm((p) => ({ ...p, note: e.target.value }))
                      }
                      placeholder="Комментарий к заявке…"
                    />
                  </label>
                </div>
              </section>

              {/* Позиции заявки показываем только после создания заявки (есть cartId) */}
              {cartId && (
                <section className="agent-cart-modal__section agent-cart-modal__positions">
                  <h3 className="agent-cart-modal__section-title">
                    Позиции заявки
                  </h3>
                  <p className="agent-cart-modal__hint">
                    Редактировать можно только в статусе «Черновик».
                  </p>

                  <div
                    className={`agent-cart-modal__add-row ${
                      canEditItems ? "" : "agent-cart-modal__add-row--disabled"
                    }`}
                  >
                    <div className="agent-cart-modal__add-search">
                      <ProductAutocomplete
                        disabled={!canEditItems || busy}
                        onPick={(p) =>
                          setNewItem((s) => ({ ...s, product: p }))
                        }
                      />
                      {newItem.product && (
                        <div className="agent-cart-modal__picked">
                          <span className="agent-cart-modal__picked-name">
                            {newItem.product?.name || "—"}
                          </span>
                          <button
                            type="button"
                            className="agent-cart-modal__picked-clear"
                            onClick={() =>
                              setNewItem((s) => ({ ...s, product: null }))
                            }
                            disabled={busy || !canEditItems}
                          >
                            Сбросить
                          </button>
                        </div>
                      )}
                    </div>
                    <div className="agent-cart-modal__add-qty">
                      <label className="agent-cart-modal__label-inline">
                        Кол-во (quantity_requested)
                      </label>
                      <input
                        type="number"
                        step="0.001"
                        min="0"
                        className="agent-cart-modal__input agent-cart-modal__input--num"
                        value={newItem.quantity_requested}
                        disabled={busy || !canEditItems}
                        onChange={(e) =>
                          setNewItem((s) => ({
                            ...s,
                            quantity_requested: e.target.value,
                          }))
                        }
                      />
                    </div>
                    <button
                      type="button"
                      className="agent-cart-modal__btn agent-cart-modal__btn--primary"
                      disabled={busy || !canEditItems || !newItem.product?.id}
                      onClick={() =>
                        addItem(newItem.product, newItem.quantity_requested)
                      }
                      title={
                        !canEditItems
                          ? "Доступно только в черновике"
                          : "Добавить позицию"
                      }
                    >
                      <Plus size={18} />
                      Добавить
                    </button>
                  </div>

                  <div className="agent-cart-modal__table-wrap">
                    <table className="agent-cart-modal__table">
                      <thead>
                        <tr>
                          <th>№</th>
                          <th>Товар</th>
                          <th>Артикул</th>
                          <th>Ед.</th>
                          <th>Кол-во</th>
                          <th>Дата создания</th>
                          <th>Обновлено</th>
                          <th>Действия</th>
                        </tr>
                      </thead>
                      <tbody>
                        {items.length === 0 ? (
                          <tr>
                            <td colSpan={8} className="agent-cart-modal__empty">
                              Нет позиций
                            </td>
                          </tr>
                        ) : (
                          items.map((it, idx) => (
                            <tr key={it.id}>
                              <td>{idx + 1}</td>
                              <td className="agent-cart-modal__cell-name">
                                {productMetaByItemId?.[it.id]?.name ||
                                  shortId(it.product)}
                              </td>
                              <td>
                                {productMetaByItemId?.[it.id]?.article || "—"}
                              </td>
                              <td>
                                {productMetaByItemId?.[it.id]?.unit || "—"}
                              </td>
                              <td>
                                <input
                                  type="number"
                                  step="0.001"
                                  className="agent-cart-modal__input-inline"
                                  disabled={busy || !canEditItems}
                                  value={itemQtyDraft?.[it.id] ?? ""}
                                  onChange={(e) =>
                                    setItemQtyDraft((p) => ({
                                      ...p,
                                      [it.id]: e.target.value,
                                    }))
                                  }
                                />
                              </td>
                              <td className="agent-cart-modal__cell-date">
                                {fmtDateTime(it.created_date)}
                              </td>
                              <td className="agent-cart-modal__cell-date">
                                {fmtDateTime(it.updated_date)}
                              </td>
                              <td>
                                <div className="agent-cart-modal__row-actions">
                                  <button
                                    type="button"
                                    className="agent-cart-modal__btn-icon"
                                    disabled={busy || !canEditItems}
                                    onClick={() => saveItemQty(it.id)}
                                    title="Сохранить количество"
                                  >
                                    <Check size={16} />
                                  </button>
                                  <button
                                    type="button"
                                    className="agent-cart-modal__btn-icon agent-cart-modal__btn-icon--danger"
                                    disabled={busy || !canEditItems}
                                    onClick={() => removeItem(it.id)}
                                    title="Удалить позицию"
                                  >
                                    <Trash2 size={16} />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </section>
              )}
            </div>

            {/* Футер с действиями */}
            <footer className="agent-cart-modal__footer">
              {cartId ? (
                <div className="agent-cart-modal__actions">
                  {!isOwnerOrAdmin && (
                    <>
                      <button
                        type="button"
                        className="agent-cart-modal__btn agent-cart-modal__btn--secondary"
                        disabled={busy || !isDraft}
                        onClick={saveCartHeader}
                        title={
                          !isDraft
                            ? "Только в черновике"
                            : "Сохранить склад и примечание"
                        }
                      >
                        <Check size={18} />
                        Сохранить
                      </button>
                      {isDraft && (
                        <button
                          type="button"
                          className="agent-cart-modal__btn agent-cart-modal__btn--danger"
                          disabled={busy}
                          onClick={removeCart}
                        >
                          <Trash2 size={18} />
                          Удалить заявку
                        </button>
                      )}
                      {cart?.status === "draft" && (
                        <button
                          type="button"
                          className="agent-cart-modal__btn agent-cart-modal__btn--primary"
                          disabled={busy}
                          onClick={doSubmit}
                        >
                          <Send size={18} />
                          Отправить владельцу
                        </button>
                      )}
                    </>
                  )}
                  {cart?.status === "submitted" && isOwnerOrAdmin && (
                    <>
                      <button
                        type="button"
                        className="agent-cart-modal__btn agent-cart-modal__btn--primary"
                        disabled={busy}
                        onClick={doApprove}
                      >
                        <Check size={18} />
                        Одобрить
                      </button>
                      <button
                        type="button"
                        className="agent-cart-modal__btn agent-cart-modal__btn--danger"
                        disabled={busy}
                        onClick={doReject}
                      >
                        <X size={18} />
                        Отклонить
                      </button>
                    </>
                  )}
                </div>
              ) : (
                <div className="agent-cart-modal__actions">
                  <button
                    type="button"
                    className="agent-cart-modal__btn agent-cart-modal__btn--primary"
                    disabled={busy}
                    onClick={createCart}
                  >
                    <Plus size={18} />
                    Создать заявку
                  </button>
                </div>
              )}
            </footer>
          </>
        )}
      </div>
    </div>
  );
};

const Agents = () => {
  const { profile } = useUser();
  const isOwnerOrAdmin = profile?.role === "owner" || profile?.role === "admin";

  // Владелец: carts | history | stocks. Агент: carts | stocks
  const [activeTab, setActiveTab] = useState("carts");
  const [historySubTab, setHistorySubTab] = useState("approved");
  const [viewMode, setViewMode] = useState(VIEW_MODES.TABLE);

  const [warehouses, setWarehouses] = useState([]);
  const warehousesById = useMemo(
    () =>
      normalizeList(warehouses).reduce((acc, w) => {
        acc[w.id] = w;
        return acc;
      }, {}),
    [warehouses]
  );

  // carts list
  const [cartsLoading, setCartsLoading] = useState(false);
  const [cartsError, setCartsError] = useState("");
  const [carts, setCarts] = useState([]);
  const [statusFilter, setStatusFilter] = useState("");
  const [search, setSearch] = useState("");

  const loadWarehouses = useCallback(async () => {
    try {
      const data = await listWarehouses({ page_size: 1000 });
      setWarehouses(normalizeList(data));
    } catch (e) {
      console.error(e);
    }
  }, []);

  const loadCarts = useCallback(async () => {
    setCartsLoading(true);
    setCartsError("");
    try {
      const params = {};
      if (statusFilter) params.status = statusFilter;
      if (search.trim()) params.search = search.trim();
      const data = await listAgentCarts(params);
      setCarts(normalizeList(data));
    } catch (e) {
      console.error(e);
      setCartsError(e?.detail || "Не удалось загрузить заявки");
      setCarts([]);
    } finally {
      setCartsLoading(false);
    }
  }, [statusFilter, search]);

  // stocks
  const [stocksLoading, setStocksLoading] = useState(false);
  const [stocksError, setStocksError] = useState("");
  const [stocks, setStocks] = useState([]);

  const loadStocks = useCallback(async () => {
    setStocksLoading(true);
    setStocksError("");
    try {
      const data = isOwnerOrAdmin
        ? await listOwnerAgentsProducts()
        : await listMyAgentProducts();
      setStocks(normalizeList(data));
    } catch (e) {
      console.error(e);
      setStocksError(e?.detail || "Не удалось загрузить остатки");
      setStocks([]);
    } finally {
      setStocksLoading(false);
    }
  }, [isOwnerOrAdmin]);

  useEffect(() => {
    loadWarehouses();
  }, [loadWarehouses]);

  useEffect(() => {
    if (activeTab === "carts" || activeTab === "history") loadCarts();
    if (activeTab === "stocks") loadStocks();
  }, [activeTab, loadCarts, loadStocks]);

  // modal
  const [modalOpen, setModalOpen] = useState(false);
  const [modalCartId, setModalCartId] = useState(null);

  const openNew = () => {
    setModalCartId(null);
    setModalOpen(true);
  };
  const openExisting = (id) => {
    setModalCartId(id);
    setModalOpen(true);
  };

  const filteredCarts = useMemo(() => {
    let list = normalizeList(carts);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((c) =>
        String(c.note || "")
          .toLowerCase()
          .includes(q)
      );
    }
    if (statusFilter) {
      list = list.filter((c) => c.status === statusFilter);
    }
    return list.sort((a, b) => {
      const da = new Date(a.updated_date || a.created_date || 0).getTime();
      const db = new Date(b.updated_date || b.created_date || 0).getTime();
      return db - da;
    });
  }, [carts, search, statusFilter]);

  // Для владельца: история разделена на одобренные и отклонённые
  const historyCarts = useMemo(() => {
    let list = normalizeList(carts).filter(
      (c) => c.status === "approved" || c.status === "rejected"
    );
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((c) =>
        String(c.note || "")
          .toLowerCase()
          .includes(q)
      );
    }
    return list.sort((a, b) => {
      const da = new Date(a.updated_date || a.created_date || 0).getTime();
      const db = new Date(b.updated_date || b.created_date || 0).getTime();
      return db - da;
    });
  }, [carts, search]);

  const approvedCarts = useMemo(
    () => historyCarts.filter((c) => c.status === "approved"),
    [historyCarts]
  );
  const rejectedCarts = useMemo(
    () => historyCarts.filter((c) => c.status === "rejected"),
    [historyCarts]
  );

  const historyCartsToShow =
    historySubTab === "approved" ? approvedCarts : rejectedCarts;
  const cartsToShow = filteredCarts;

  return (
    <div className="warehouse-page agents-page">
      <div className="warehouse-header">
        <div className="warehouse-header__left">
          <div className="warehouse-header__icon">
            <div className="warehouse-header__icon-box">🧑‍💼</div>
          </div>
          <div className="warehouse-header__title-section">
            <h1 className="warehouse-header__title">
              {isOwnerOrAdmin ? "Заявки агентов" : "Агенты"}
            </h1>
            <p className="warehouse-header__subtitle">
              {isOwnerOrAdmin
                ? "Все заявки, история принятых и отказных, остатки у агентов"
                : "Заявки на товар и остатки"}
            </p>
          </div>
        </div>
        <div className="warehouse-header__actions">
          {!isOwnerOrAdmin && activeTab === "carts" && (
            <button
              className="warehouse-header__create-btn"
              onClick={openNew}
              title="Создать заявку"
            >
              <Plus size={16} />
              Создать заявку
            </button>
          )}
          {isOwnerOrAdmin &&
            (activeTab === "carts" || activeTab === "history") && (
              <button
                className="warehouse-header__create-btn"
                onClick={loadCarts}
                disabled={cartsLoading}
                title="Обновить заявки"
              >
                <RefreshCw size={16} />
                Обновить
              </button>
            )}
          {/* <button
            className="warehouse-header__create-btn"
            onClick={() => (activeTab === "carts" ? loadCarts() : loadStocks())}
            disabled={activeTab === "carts" ? cartsLoading : stocksLoading}
            title="Обновить"
          >
            <RefreshCw size={16} />
            Обновить
          </button> */}
        </div>
      </div>

      <div className="agents-tabs">
        <button
          type="button"
          className={`agents-tab ${activeTab === "carts" ? "active" : ""}`}
          onClick={() => setActiveTab("carts")}
        >
          {isOwnerOrAdmin ? "Все заявки" : "Заявки"}
        </button>
        {isOwnerOrAdmin && (
          <button
            type="button"
            className={`agents-tab ${activeTab === "history" ? "active" : ""}`}
            onClick={() => setActiveTab("history")}
          >
            История
          </button>
        )}
        <button
          type="button"
          className={`agents-tab ${activeTab === "stocks" ? "active" : ""}`}
          onClick={() => setActiveTab("stocks")}
        >
          Остатки
        </button>
      </div>

      {(activeTab === "carts" || activeTab === "history") && (
        <>
          <div className="warehouse-search-section">
            <div className="warehouse-search">
              <Search className="warehouse-search__icon" size={18} />
              <input
                type="text"
                className="warehouse-search__input"
                placeholder="Поиск по примечанию…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <div className="warehouse-search__info flex flex-wrap items-center gap-2">
              {activeTab !== "history" && (
                <select
                  className="warehouse-search__input"
                  style={{ width: 220, maxWidth: "100%" }}
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                >
                  <option value="">Все статусы</option>
                  <option value="draft">Черновик</option>
                  <option value="submitted">Отправлено</option>
                  <option value="approved">Одобрено</option>
                  <option value="rejected">Отклонено</option>
                </select>
              )}

              <span style={{ marginLeft: 12 }}>
                {activeTab === "history"
                  ? `${
                      historySubTab === "approved"
                        ? "Одобренные"
                        : "Отклонённые"
                    }: ${historyCartsToShow.length}`
                  : `Всего: ${cartsToShow.length}`}
              </span>

              <div className="ml-auto flex items-center gap-2 warehouse-view-buttons">
                <button
                  type="button"
                  onClick={() => setViewMode(VIEW_MODES.TABLE)}
                  className={`warehouse-view-btn inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm transition
                    ${
                      viewMode === VIEW_MODES.TABLE
                        ? "bg-slate-900 text-white border-slate-900"
                        : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                    }`}
                >
                  Таблица
                </button>

                <button
                  type="button"
                  onClick={() => setViewMode(VIEW_MODES.CARDS)}
                  className={`warehouse-view-btn inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm transition
                    ${
                      viewMode === VIEW_MODES.CARDS
                        ? "bg-slate-900 text-white border-slate-900"
                        : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                    }`}
                >
                  Карточки
                </button>
              </div>
            </div>
          </div>

          {activeTab === "history" && (
            <div className="agents-history-tabs">
              <button
                type="button"
                className={`agents-history-tab ${
                  historySubTab === "approved" ? "active" : ""
                }`}
                onClick={() => setHistorySubTab("approved")}
              >
                Одобренные
                <span className="agents-history-tab__count">
                  {approvedCarts.length}
                </span>
              </button>
              <button
                type="button"
                className={`agents-history-tab ${
                  historySubTab === "rejected" ? "active" : ""
                }`}
                onClick={() => setHistorySubTab("rejected")}
              >
                Отклонённые
                <span className="agents-history-tab__count">
                  {rejectedCarts.length}
                </span>
              </button>
            </div>
          )}

          {cartsError && (
            <div className="agents-error">{String(cartsError)}</div>
          )}

          {activeTab === "history" ? (
            <div className="warehouse-table-container w-full">
              {viewMode === VIEW_MODES.TABLE ? (
                <div className="overflow-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
                  <table className="warehouse-table w-full min-w-[900px]">
                    <thead>
                      <tr>
                        <th>№</th>
                        {isOwnerOrAdmin && <th>Агент</th>}
                        <th>Склад</th>
                        <th>Примечание</th>
                        <th>Обновлено</th>
                        <th>Отправлено</th>
                        <th>Одобрено</th>
                        {isOwnerOrAdmin && <th>Действия</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {cartsLoading ? (
                        <tr>
                          <td
                            colSpan={isOwnerOrAdmin ? 8 : 6}
                            className="warehouse-table__loading"
                          >
                            Загрузка…
                          </td>
                        </tr>
                      ) : historyCartsToShow.length === 0 ? (
                        <tr>
                          <td
                            colSpan={isOwnerOrAdmin ? 8 : 6}
                            className="warehouse-table__empty"
                          >
                            {historySubTab === "approved"
                              ? "Нет одобренных заявок"
                              : "Нет отклонённых заявок"}
                          </td>
                        </tr>
                      ) : (
                        historyCartsToShow.map((c, idx) => (
                          <tr
                            key={c.id}
                            className="warehouse-table__row agents-clickable-row"
                            onClick={() => openExisting(c.id)}
                          >
                            <td>{idx + 1}</td>
                            {isOwnerOrAdmin && (
                              <td>
                                {c.agent_name ||
                                  c.agent_display ||
                                  shortId(c.agent)}
                              </td>
                            )}
                            <td>
                              {warehousesById?.[c.warehouse]?.name ||
                                shortId(c.warehouse)}
                            </td>
                            <td className="agents-note">
                              {c.note ? String(c.note) : "—"}
                            </td>
                            <td>{fmtDateTime(c.updated_date)}</td>
                            <td>{fmtDateTime(c.submitted_at)}</td>
                            <td>{fmtDateTime(c.approved_at)}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="agents-cards-grid">
                  {cartsLoading ? (
                    <div className="agents-cards-empty">Загрузка…</div>
                  ) : historyCartsToShow.length === 0 ? (
                    <div className="agents-cards-empty">
                      {historySubTab === "approved"
                        ? "Нет одобренных заявок"
                        : "Нет отклонённых заявок"}
                    </div>
                  ) : (
                    historyCartsToShow.map((c, idx) => (
                      <button
                        type="button"
                        key={c.id}
                        className="agents-card"
                        onClick={() => openExisting(c.id)}
                      >
                        <div className="agents-card__header">
                          <div className="agents-card__title">
                            Заявка #{idx + 1}
                          </div>
                          <div className="agents-card__meta">
                            {fmtDateTime(c.updated_date)}
                          </div>
                        </div>
                        {isOwnerOrAdmin && (
                          <div className="agents-card__row">
                            <span className="agents-card__label">Агент</span>
                            <span className="agents-card__value">
                              {c.agent_name ||
                                c.agent_display ||
                                shortId(c.agent)}
                            </span>
                          </div>
                        )}
                        <div className="agents-card__row">
                          <span className="agents-card__label">Склад</span>
                          <span className="agents-card__value">
                            {warehousesById?.[c.warehouse]?.name ||
                              shortId(c.warehouse)}
                          </span>
                        </div>
                        <div className="agents-card__row">
                          <span className="agents-card__label">Примечание</span>
                          <span className="agents-card__value agents-card__note">
                            {c.note ? String(c.note) : "—"}
                          </span>
                        </div>
                        <div className="agents-card__footer">
                          <span className="agents-card__label">Отправлено</span>
                          <span className="agents-card__value">
                            {fmtDateTime(c.submitted_at)}
                          </span>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="warehouse-table-container w-full">
              {viewMode === VIEW_MODES.TABLE ? (
                <div className="overflow-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
                  <table className="warehouse-table w-full min-w-[900px]">
                    <thead>
                      <tr>
                        <th>№</th>
                        {isOwnerOrAdmin && <th>Агент</th>}
                        <th>Склад</th>
                        <th>Статус</th>
                        <th>Примечание</th>
                        <th>Обновлено</th>
                        <th>Отправлено</th>
                        <th>Одобрено</th>
                      </tr>
                    </thead>
                    <tbody>
                      {cartsLoading ? (
                        <tr>
                          <td
                            colSpan={isOwnerOrAdmin ? 8 : 7}
                            className="warehouse-table__loading"
                          >
                            Загрузка…
                          </td>
                        </tr>
                      ) : cartsToShow.length === 0 ? (
                        <tr>
                          <td
                            colSpan={isOwnerOrAdmin ? 8 : 7}
                            className="warehouse-table__empty"
                          >
                            Заявок нет
                          </td>
                        </tr>
                      ) : (
                        cartsToShow.map((c, idx) => {
                          const rowIndex = idx + 1;
                          return (
                            <tr
                              key={c.id}
                              className="warehouse-table__row agents-clickable-row"
                              onClick={() => openExisting(c.id)}
                            >
                              <td>{rowIndex}</td>
                              {isOwnerOrAdmin && (
                                <td>
                                  {c.agent_name ||
                                    c.agent_display ||
                                    shortId(c.agent)}
                                </td>
                              )}
                              <td>
                                {warehousesById?.[c.warehouse]?.name ||
                                  shortId(c.warehouse)}
                              </td>
                              <td>
                                <span
                                  className={`agents-badge ${statusClass(
                                    c.status
                                  )}`}
                                >
                                  {statusLabel(c.status)}
                                </span>
                              </td>
                              <td className="agents-note">
                                {c.note ? String(c.note) : "—"}
                              </td>
                              <td>{fmtDateTime(c.updated_date)}</td>
                              <td>{fmtDateTime(c.submitted_at)}</td>
                              <td>{fmtDateTime(c.approved_at)}</td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="agents-cards-grid">
                  {cartsLoading ? (
                    <div className="agents-cards-empty">Загрузка…</div>
                  ) : cartsToShow.length === 0 ? (
                    <div className="agents-cards-empty">Заявок нет</div>
                  ) : (
                    cartsToShow.map((c, idx) => (
                      <button
                        type="button"
                        key={c.id}
                        className="agents-card"
                        onClick={() => openExisting(c.id)}
                      >
                        <div className="agents-card__header">
                          <div className="agents-card__title">
                            Заявка #{idx + 1}
                          </div>
                          <span
                            className={`agents-badge ${statusClass(c.status)}`}
                          >
                            {statusLabel(c.status)}
                          </span>
                        </div>
                        {isOwnerOrAdmin && (
                          <div className="agents-card__row">
                            <span className="agents-card__label">Агент</span>
                            <span className="agents-card__value">
                              {c.agent_name ||
                                c.agent_display ||
                                shortId(c.agent)}
                            </span>
                          </div>
                        )}
                        <div className="agents-card__row">
                          <span className="agents-card__label">Склад</span>
                          <span className="agents-card__value">
                            {warehousesById?.[c.warehouse]?.name ||
                              shortId(c.warehouse)}
                          </span>
                        </div>
                        <div className="agents-card__row">
                          <span className="agents-card__label">Примечание</span>
                          <span className="agents-card__value agents-card__note">
                            {c.note ? String(c.note) : "—"}
                          </span>
                        </div>
                        <div className="agents-card__footer">
                          <span className="agents-card__label">Обновлено</span>
                          <span className="agents-card__value">
                            {fmtDateTime(c.updated_date)}
                          </span>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {activeTab === "stocks" && (
        <>
          {stocksError && (
            <div className="agents-error">{String(stocksError)}</div>
          )}

          <div className="warehouse-search-section">
            <div
              className="warehouse-search__info flex flex-wrap items-center gap-2"
              style={{ width: "100%" }}
            >
              <span>Всего: {normalizeList(stocks).length}</span>
              <div className="ml-auto flex items-center gap-2 warehouse-view-buttons">
                <button
                  type="button"
                  onClick={() => setViewMode(VIEW_MODES.TABLE)}
                  className={`warehouse-view-btn inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm transition
                    ${
                      viewMode === VIEW_MODES.TABLE
                        ? "bg-slate-900 text-white border-slate-900"
                        : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                    }`}
                >
                  Таблица
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode(VIEW_MODES.CARDS)}
                  className={`warehouse-view-btn inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm transition
                    ${
                      viewMode === VIEW_MODES.CARDS
                        ? "bg-slate-900 text-white border-slate-900"
                        : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                    }`}
                >
                  Карточки
                </button>
              </div>
            </div>
          </div>

          <div className="warehouse-table-container w-full">
            {viewMode === VIEW_MODES.TABLE ? (
              <div className="overflow-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
                <table className="warehouse-table w-full min-w-[900px]">
                  <thead>
                    <tr>
                      <th>№</th>
                      {isOwnerOrAdmin && <th>Агент</th>}
                      <th>Склад</th>
                      <th>Товар</th>
                      <th>Артикул</th>
                      <th>Ед.</th>
                      <th>Кол-во</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stocksLoading ? (
                      <tr>
                        <td
                          colSpan={isOwnerOrAdmin ? 7 : 6}
                          className="warehouse-table__loading"
                        >
                          Загрузка…
                        </td>
                      </tr>
                    ) : normalizeList(stocks).length === 0 ? (
                      <tr>
                        <td
                          colSpan={isOwnerOrAdmin ? 7 : 6}
                          className="warehouse-table__empty"
                        >
                          Остатков нет
                        </td>
                      </tr>
                    ) : (
                      normalizeList(stocks).map((r, idx) => {
                        const rowIndex = idx + 1;
                        return (
                          <tr
                            key={r.id || idx}
                            className="warehouse-table__row"
                          >
                            <td>{rowIndex}</td>
                            {isOwnerOrAdmin && (
                              <td>
                                {r.agent_name ||
                                  r.agent_display ||
                                  shortId(r.agent)}
                              </td>
                            )}
                            <td>
                              {warehousesById?.[r.warehouse]?.name ||
                                shortId(r.warehouse)}
                            </td>
                            <td className="warehouse-table__name">
                              {r.product_name || shortId(r.product)}
                            </td>
                            <td>{r.product_article || "—"}</td>
                            <td>{r.product_unit || "—"}</td>
                            <td>{r.qty ?? "—"}</td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="agents-cards-grid">
                {stocksLoading ? (
                  <div className="agents-cards-empty">Загрузка…</div>
                ) : normalizeList(stocks).length === 0 ? (
                  <div className="agents-cards-empty">Остатков нет</div>
                ) : (
                  normalizeList(stocks).map((r, idx) => (
                    <div key={r.id || idx} className="agents-card">
                      <div className="agents-card__header">
                        <div className="agents-card__title">
                          Остаток #{idx + 1}
                        </div>
                      </div>
                      {isOwnerOrAdmin && (
                        <div className="agents-card__row">
                          <span className="agents-card__label">Агент</span>
                          <span className="agents-card__value">
                            {r.agent_name ||
                              r.agent_display ||
                              shortId(r.agent)}
                          </span>
                        </div>
                      )}
                      <div className="agents-card__row">
                        <span className="agents-card__label">Склад</span>
                        <span className="agents-card__value">
                          {warehousesById?.[r.warehouse]?.name ||
                            shortId(r.warehouse)}
                        </span>
                      </div>
                      <div className="agents-card__row">
                        <span className="agents-card__label">Товар</span>
                        <span className="agents-card__value">
                          {r.product_name || shortId(r.product)}
                        </span>
                      </div>
                      <div className="agents-card__row">
                        <span className="agents-card__label">Артикул</span>
                        <span className="agents-card__value">
                          {r.product_article || "—"}
                        </span>
                      </div>
                      <div className="agents-card__footer">
                        <span className="agents-card__label">Кол-во</span>
                        <span className="agents-card__value">
                          {r.qty ?? "—"} {r.product_unit || ""}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </>
      )}

      <AgentCartModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        cartId={modalCartId}
        setCartId={setModalCartId}
        onChanged={() => {
          loadCarts();
          if (activeTab === "stocks") loadStocks();
        }}
        warehousesById={warehousesById}
        isOwnerOrAdmin={isOwnerOrAdmin}
        currentUserId={profile?.id}
      />
    </div>
  );
};

export default Agents;
