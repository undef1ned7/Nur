import React, { useCallback, useEffect, useState } from "react";
import { useDispatch } from "react-redux";
import api from "../../../../api";
import {
  listAgentCartsAsync,
  createAgentCartAsync,
  deleteAgentCartAsync,
  submitAgentCartAsync,
  approveAgentCartAsync,
  rejectAgentCartAsync,
  listAgentCartItemsAsync,
  createAgentCartItemAsync,
  deleteAgentCartItemAsync,
} from "../../../../store/creators/agentCartCreators";
import { useUser } from "../../../../store/slices/userSlice";
import { useAlert } from "@/hooks/useDialog";
import { validateResErrors } from "../../../../../tools/validateResErrors";

const statusLabel = (s) => {
  const k = String(s || "").toLowerCase();
  const map = {
    draft: "Черновик",
    submitted: "Отправлена",
    approved: "Одобрена",
    rejected: "Отклонена",
  };
  return map[k] || s || "—";
};

export default function ProductionAgentRequestCartsTab() {
  const dispatch = useDispatch();
  const alert = useAlert();
  const { profile } = useUser();
  const isOwner = profile?.role === "owner";

  const [loading, setLoading] = useState(false);
  const [carts, setCarts] = useState([]);
  const [expandedId, setExpandedId] = useState(null);
  const [itemsByCart, setItemsByCart] = useState({});
  const [productSearch, setProductSearch] = useState("");
  const [searchHits, setSearchHits] = useState([]);
  const [addForm, setAddForm] = useState({
    cartId: "",
    product: "",
    qty: "1",
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await dispatch(listAgentCartsAsync({})).unwrap();
      const list = Array.isArray(data) ? data : data?.results || [];
      setCarts(list);
    } catch (e) {
      alert(validateResErrors(e, "Не удалось загрузить заявки"), true);
      setCarts([]);
    } finally {
      setLoading(false);
    }
  }, [dispatch, alert]);

  useEffect(() => {
    load();
  }, [load]);

  const loadItems = async (cartId) => {
    try {
      const data = await dispatch(
        listAgentCartItemsAsync({ cart: cartId }),
      ).unwrap();
      const list = Array.isArray(data) ? data : data?.results || [];
      setItemsByCart((prev) => ({ ...prev, [cartId]: list }));
    } catch {
      setItemsByCart((prev) => ({ ...prev, [cartId]: [] }));
    }
  };

  const toggleExpand = (cartId) => {
    if (expandedId === cartId) {
      setExpandedId(null);
      return;
    }
    setExpandedId(cartId);
    loadItems(cartId);
  };

  const onCreateDraft = async () => {
    try {
      await dispatch(createAgentCartAsync({})).unwrap();
      alert("Черновик заявки создан");
      await load();
    } catch (e) {
      alert(validateResErrors(e, "Не удалось создать заявку"), true);
    }
  };

  const onDelete = async (id) => {
    try {
      await dispatch(deleteAgentCartAsync(id)).unwrap();
      await load();
    } catch (e) {
      alert(validateResErrors(e, "Не удалось удалить"), true);
    }
  };

  const onSubmit = async (id) => {
    try {
      await dispatch(submitAgentCartAsync(id)).unwrap();
      alert("Заявка отправлена владельцу");
      await load();
    } catch (e) {
      alert(validateResErrors(e, "Не удалось отправить"), true);
    }
  };

  const onApprove = async (id) => {
    try {
      await dispatch(approveAgentCartAsync(id)).unwrap();
      alert("Заявка одобрена, товар выдан агенту");
      await load();
    } catch (e) {
      alert(validateResErrors(e, "Не удалось одобрить"), true);
    }
  };

  const onReject = async (id) => {
    const reason = window.prompt("Причина отклонения (необязательно)") || "";
    try {
      await dispatch(rejectAgentCartAsync({ id, reason })).unwrap();
      await load();
    } catch (e) {
      alert(validateResErrors(e, "Не удалось отклонить"), true);
    }
  };

  useEffect(() => {
    const q = String(productSearch || "").trim();
    if (!q || q.length < 2) {
      setSearchHits([]);
      return;
    }
    const t = setTimeout(async () => {
      try {
        const { data } = await api.get("/main/products/list/", {
          params: { search: q, page_size: 20 },
        });
        const list = Array.isArray(data) ? data : data?.results || [];
        setSearchHits(list);
      } catch {
        setSearchHits([]);
      }
    }, 400);
    return () => clearTimeout(t);
  }, [productSearch]);

  const addLine = async () => {
    const { cartId, product, qty } = addForm;
    if (!cartId || !product) {
      alert("Выберите заявку и товар", true);
      return;
    }
    try {
      await dispatch(
        createAgentCartItemAsync({
          cart: cartId,
          product,
          quantity_requested: Number(qty) || 1,
        }),
      ).unwrap();
      alert("Позиция добавлена");
      setAddForm((p) => ({ ...p, product: "", qty: "1" }));
      if (expandedId === cartId) loadItems(cartId);
      await load();
    } catch (e) {
      alert(validateResErrors(e, "Не удалось добавить позицию"), true);
    }
  };

  const removeLine = async (itemId, cartId) => {
    try {
      await dispatch(deleteAgentCartItemAsync(itemId)).unwrap();
      loadItems(cartId);
      await load();
    } catch (e) {
      alert(validateResErrors(e, "Не удалось удалить строку"), true);
    }
  };

  const drafts = carts.filter(
    (c) => String(c.status).toLowerCase() === "draft",
  );
  const submitted = carts.filter(
    (c) => String(c.status).toLowerCase() === "submitted",
  );

  return (
    <div className="warehouse-page" style={{ paddingBottom: 24 }}>
      <div className="warehouse-header">
        <div className="warehouse-header__left">
          <div className="warehouse-header__icon">
            <div className="warehouse-header__icon-box">📦</div>
          </div>
          <div className="warehouse-header__title-section">
            <h1 className="warehouse-header__title">
              Заявки на получение товара
            </h1>
            <p className="warehouse-header__subtitle">
              {isOwner
                ? "Рассмотрение заявок агентов (отправлена → одобрить / отклонить)"
                : "Черновик → позиции → отправка владельцу"}
            </p>
          </div>
        </div>
        <button
          type="button"
          className="warehouse-header__create-btn"
          onClick={load}
          disabled={loading}
        >
          {loading ? "…" : "Обновить"}
        </button>
        {!isOwner && (
          <button
            type="button"
            className="warehouse-header__create-btn"
            onClick={onCreateDraft}
            style={{ marginLeft: 8 }}
          >
            Новая заявка
          </button>
        )}
      </div>

      {!isOwner && (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm mb-4">
          <h3 className="text-sm font-semibold text-slate-800 mb-2">
            Добавить позицию в черновик
          </h3>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 8,
              alignItems: "flex-end",
            }}
          >
            <label>
              <span className="text-xs text-slate-500">Заявка</span>
              <select
                className="debt__input"
                value={addForm.cartId}
                onChange={(e) =>
                  setAddForm((p) => ({ ...p, cartId: e.target.value }))
                }
              >
                <option value="">—</option>
                {drafts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {(c.id && String(c.id).slice(0, 8)) || "—"}… (
                    {statusLabel(c.status)})
                  </option>
                ))}
              </select>
            </label>
            <label style={{ flex: 1, minWidth: 200 }}>
              <span className="text-xs text-slate-500">Поиск товара</span>
              <input
                className="debt__input"
                style={{ width: "100%" }}
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
                placeholder="Минимум 2 символа"
              />
            </label>
            <label style={{ minWidth: 140 }}>
              <span className="text-xs text-slate-500">Товар</span>
              <select
                className="debt__input"
                style={{ width: "100%" }}
                value={addForm.product}
                onChange={(e) =>
                  setAddForm((p) => ({ ...p, product: e.target.value }))
                }
              >
                <option value="">—</option>
                {searchHits.map((p) => (
                  <option key={p.id || p.product} value={p.id || p.product}>
                    {p.name || p.product_name || p.title}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span className="text-xs text-slate-500">Кол-во</span>
              <input
                className="debt__input"
                type="number"
                min={1}
                value={addForm.qty}
                onChange={(e) =>
                  setAddForm((p) => ({ ...p, qty: e.target.value }))
                }
              />
            </label>
            <button
              type="button"
              className="warehouse-header__create-btn"
              onClick={addLine}
            >
              Добавить
            </button>
          </div>
        </div>
      )}

      <div className="warehouse-table-container w-full">
        <div className="overflow-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="warehouse-table w-full min-w-[720px]">
            <thead>
              <tr>
                <th>№</th>
                <th>Статус</th>
                <th>Создана</th>
                <th>Примечание</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {loading && carts.length === 0 ? (
                <tr>
                  <td colSpan={5} className="warehouse-table__loading">
                    Загрузка…
                  </td>
                </tr>
              ) : carts.length === 0 ? (
                <tr>
                  <td colSpan={5} className="warehouse-table__empty">
                    Нет заявок
                  </td>
                </tr>
              ) : (
                carts.map((c, idx) => {
                  const st = String(c.status || "").toLowerCase();
                  return (
                    <React.Fragment key={c.id || idx}>
                      <tr className="warehouse-table__row">
                        <td>{idx + 1}</td>
                        <td>{statusLabel(c.status)}</td>
                        <td>
                          {c.created_at
                            ? new Date(c.created_at).toLocaleString()
                            : "—"}
                        </td>
                        <td>{c.note || "—"}</td>
                        <td
                          onClick={(e) => e.stopPropagation()}
                          style={{ whiteSpace: "nowrap" }}
                        >
                          <button
                            type="button"
                            className="warehouse-header__create-btn"
                            style={{ padding: "4px 8px", fontSize: 12 }}
                            onClick={() => toggleExpand(c.id)}
                          >
                            {expandedId === c.id ? "Скрыть" : "Позиции"}
                          </button>
                          {st === "draft" && !isOwner && (
                            <>
                              <button
                                type="button"
                                className="warehouse-header__create-btn"
                                style={{
                                  padding: "4px 8px",
                                  fontSize: 12,
                                  marginLeft: 4,
                                }}
                                onClick={() => onSubmit(c.id)}
                              >
                                Отправить
                              </button>
                              <button
                                type="button"
                                className="warehouse-header__create-btn"
                                style={{
                                  padding: "4px 8px",
                                  fontSize: 12,
                                  marginLeft: 4,
                                  background: "#64748b",
                                }}
                                onClick={() => onDelete(c.id)}
                              >
                                Удалить
                              </button>
                            </>
                          )}
                          {st === "submitted" && isOwner && (
                            <>
                              <button
                                type="button"
                                className="warehouse-header__create-btn"
                                style={{
                                  padding: "4px 8px",
                                  fontSize: 12,
                                  marginLeft: 4,
                                }}
                                onClick={() => onApprove(c.id)}
                              >
                                Одобрить
                              </button>
                              <button
                                type="button"
                                className="warehouse-header__create-btn"
                                style={{
                                  padding: "4px 8px",
                                  fontSize: 12,
                                  marginLeft: 4,
                                  background: "#b91c1c",
                                }}
                                onClick={() => onReject(c.id)}
                              >
                                Отклонить
                              </button>
                            </>
                          )}
                        </td>
                      </tr>
                      {expandedId === c.id && (
                        <tr>
                          <td colSpan={5}>
                            <div className="p-3 bg-slate-50 text-sm">
                              {(itemsByCart[c.id] || []).length === 0 ? (
                                <span className="text-slate-500">
                                  Нет позиций
                                </span>
                              ) : (
                                <ul className="list-disc pl-5">
                                  {(itemsByCart[c.id] || []).map((it) => (
                                    <li key={it.id} className="mb-1">
                                      {it.product_name || it.product || "—"} —
                                      запрошено:{" "}
                                      {it.quantity_requested ??
                                        it.qty ??
                                        "—"}
                                      {st === "draft" && !isOwner && (
                                        <button
                                          type="button"
                                          style={{
                                            marginLeft: 8,
                                            color: "#b91c1c",
                                            background: "none",
                                            border: "none",
                                            cursor: "pointer",
                                          }}
                                          onClick={() =>
                                            removeLine(it.id, c.id)
                                          }
                                        >
                                          удалить
                                        </button>
                                      )}
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isOwner && submitted.length > 0 && (
        <p className="text-sm text-slate-600 mt-2">
          Ожидают решения: <b>{submitted.length}</b>
        </p>
      )}
    </div>
  );
}
