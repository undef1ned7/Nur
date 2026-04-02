// src/Components/Sectors/cafe/Stock/Stock.jsx
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { FaSearch, FaPlus, FaBoxes, FaEdit, FaTrash } from "react-icons/fa";
import { useSearchParams } from "react-router-dom";
import api from "../../../../api";
import "./stock.scss";
import { StockItemModal, StockMoveModal, StockDeleteModal } from "./components/StockModals";
import DataContainer from "../../../common/DataContainer/DataContainer";
import { useAlert } from "../../../../hooks/useDialog";
import { validateResErrors } from "../../../../../tools/validateResErrors";
import Suppliers from "../../../Contact/Suppliers/Suppliers";

/* helpers */
const listFrom = (res) => res?.data?.results || res?.data || [];

const toNum = (x) => {
  if (x === null || x === undefined) return 0;
  const n = Number(String(x).replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};

const numStr = (n) => {
  const v = Number(n);
  return String(Number.isFinite(v) ? v : 0).replace(",", ".");
};

const sanitizeDecimalInput = (value) => {
  const raw = String(value ?? "").replace(",", ".");
  const cleaned = raw.replace(/[^\d.]/g, "");
  const parts = cleaned.split(".");
  if (parts.length <= 1) return cleaned;
  return `${parts[0]}.${parts.slice(1).join("")}`; // одна точка
};

const pickSupplierLabel = (c) =>
  String(c?.full_name || c?.name || c?.title || c?.company_name || "").trim();

/** UUID / id из поля склада (строка или вложенный объект клиента) */
const normalizeSupplierId = (row) => {
  const v = row?.supplier_id ?? row?.supplier;
  if (v == null || v === "") return "";
  if (typeof v === "object") return String(v.id ?? v.uuid ?? "").trim();
  return String(v).trim();
};

const Stock = () => {
  const alert = useAlert();
  const [searchParams, setSearchParams] = useSearchParams();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [cashboxes, setCashboxes] = useState([]);
  const [cashboxId, setCashboxId] = useState("");

  // модалка товара
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({
    title: "",
    unit: "",
    remainder: "",
    minimum: "",
    unit_price: "",
    supplier: "",
  });

  const [supplierSuggestions, setSupplierSuggestions] = useState([]);
  /** Поставщик с id, которого нет в загруженном списке — показать в select при редактировании */
  const [supplierOptionFallback, setSupplierOptionFallback] = useState(null);
  const activeTab = searchParams.get("tab") === "suppliers" ? "suppliers" : "stock";

  // модалка движения (приход)
  const [moveOpen, setMoveOpen] = useState(false);
  const [moveItem, setMoveItem] = useState(null);
  const [moveQty, setMoveQty] = useState("");
  const [moveUnitPrice, setMoveUnitPrice] = useState("");

  // модалка подтверждения удаления
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteItem, setDeleteItem] = useState(null);

  useEffect(() => {
    const fetchAll = async () => {
      try {
        const rStock = await api.get("/cafe/warehouse/");
        setItems(listFrom(rStock));
      } catch (err) {
        const errorMessage = validateResErrors(err, "Ошибка загрузки склада");
        alert(errorMessage, true);
      } finally {
        setLoading(false);
      }
    };
    fetchAll();
  }, []);

  useEffect(() => {
    const loadSuppliersFromMain = async () => {
      const byId = new Map();
      try {
        let url = "/main/clients/";
        let requestConfig = { params: { type: "suppliers" } };
        let guard = 0;

        while (url && guard < 80) {
          // eslint-disable-next-line no-await-in-loop
          const { data } = await api.get(url, requestConfig);
          requestConfig = {};
          const batch = listFrom({ data });
          (Array.isArray(batch) ? batch : []).forEach((c) => {
            const id = c?.id != null ? String(c.id).trim() : "";
            const label = pickSupplierLabel(c);
            if (id && label) byId.set(id, { id, label });
          });
          url = data?.next || null;
          guard += 1;
        }
      } catch {
        /* ignore */
      }
      setSupplierSuggestions(
        [...byId.values()].sort((a, b) => a.label.localeCompare(b.label, "ru"))
      );
    };
    loadSuppliersFromMain();
  }, []);

  const supplierLabelById = useMemo(() => {
    const m = new Map();
    supplierSuggestions.forEach(({ id, label }) => {
      if (id) m.set(String(id), label);
    });
    return m;
  }, [supplierSuggestions]);

  const rowSupplierCaption = useCallback(
    (s) => {
      const nested = s?.supplier;
      if (nested && typeof nested === "object") {
        const t = pickSupplierLabel(nested);
        if (t) return t;
      }
      if (s?.supplier_name) return String(s.supplier_name).trim();
      const sid = normalizeSupplierId(s);
      if (sid && supplierLabelById.has(sid)) return supplierLabelById.get(sid);
      return "";
    },
    [supplierLabelById]
  );

  useEffect(() => {
    const fetchCashboxes = async () => {
      try {
        const r = await api.get("/construction/cashboxes/");
        const arr = listFrom(r) || [];
        const list = Array.isArray(arr) ? arr : [];
        setCashboxes(list);
        const firstKey = String(list?.[0]?.id || list?.[0]?.uuid || "");
        if (firstKey) setCashboxId(firstKey);
      } catch (err) {
        const errorMessage = validateResErrors(err, "Ошибка загрузки касс");
        alert(errorMessage, true);
        setCashboxes([]);
      }
    };
    fetchCashboxes();
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((s) => {
      const supCap = rowSupplierCaption(s).toLowerCase();
      return (
        String(s.title || "").toLowerCase().includes(q) ||
        String(s.unit || "").toLowerCase().includes(q) ||
        (supCap && supCap.includes(q))
      );
    });
  }, [items, query, rowSupplierCaption]);

  const isLow = (s) => toNum(s.remainder) <= toNum(s.minimum);

  const openCreate = () => {
    setEditingId(null);
    setSupplierOptionFallback(null);
    setForm({
      title: "",
      unit: "",
      remainder: "",
      minimum: "",
      unit_price: "",
      supplier: "",
    });
    setModalOpen(true);
  };

  const openEdit = (row) => {
    setEditingId(row.id);
    const sid = normalizeSupplierId(row);
    const sidStr = sid ? String(sid) : "";
    if (sidStr && !supplierLabelById.has(sidStr)) {
      const cap = rowSupplierCaption(row);
      setSupplierOptionFallback({
        id: sidStr,
        label: cap || sidStr,
      });
    } else {
      setSupplierOptionFallback(null);
    }
    setForm({
      title: row.title || "",
      unit: row.unit || "",
      remainder: String(row.remainder ?? ""),
      minimum: String(row.minimum ?? ""),
      unit_price: String(row.unit_price ?? ""),
      supplier: sidStr,
    });
    setModalOpen(true);
  };

  const postCashflowDelta = async ({ title, deltaAmount }) => {
    const boxId =
      cashboxId ||
      String(cashboxes?.[0]?.id ?? cashboxes?.[0]?.uuid ?? "");
    if (!boxId) return;

    const amt = toNum(deltaAmount);
    if (!Number.isFinite(amt) || Math.abs(amt) < 1e-9) return;

    const type = amt > 0 ? "expense" : "income";
    const amount = Math.abs(amt);
    const signLabel = amt > 0 ? "Расход" : "Приход";

    api
      .post("/construction/cashflows/", {
        cashbox: boxId,
        type,
        name: `${signLabel} (корректировка склада): ${title}`,
        amount,
      })
      .catch(() => {});
  };

  const saveItem = async (e) => {
    e.preventDefault();

    const title = String(form.title || "").trim();
    const unit = String(form.unit || "").trim();

    const remainderNum = toNum(form.remainder);
    const minimumNum = toNum(form.minimum);
    const unitPriceNum = toNum(form.unit_price);

    if (!title || !unit) return;

    const payload = {
      title,
      unit,
      remainder: numStr(Math.max(0, remainderNum)),
      minimum: numStr(Math.max(0, minimumNum)),
      unit_price: numStr(Math.max(0, unitPriceNum)),
    };

    const supplierIdTrim = String(form.supplier || "").trim();
    if (editingId == null) {
      if (supplierIdTrim) payload.supplier = supplierIdTrim;
    } else {
      payload.supplier = supplierIdTrim || null;
    }

    try {
      if (editingId == null) {
        // Создание товара
        const res = await api.post("/cafe/warehouse/", payload);
        setItems((prev) => [...prev, res.data]);
        setModalOpen(false);
        // Запись в кассу (расход — закупка нового товара): количество × цена
        const boxId = cashboxId || String(cashboxes?.[0]?.id ?? cashboxes?.[0]?.uuid ?? "");
        if (boxId) {
          const amount = remainderNum * unitPriceNum;
          api.post("/construction/cashflows/", {
            cashbox: boxId,
            type: "expense",
            name: `Новый товар на склад: ${title}`,
            amount,
          }).catch(() => { });
        }
      } else {
        // Редактирование товара
        const prevItem = items.find((s) => s.id === editingId);
        const prevQty = toNum(prevItem?.remainder);
        const prevPrice = toNum(prevItem?.unit_price);
        const prevTotal = prevQty * prevPrice;
        const nextTotal = Math.max(0, remainderNum) * Math.max(0, unitPriceNum);
        const deltaTotal = nextTotal - prevTotal;

        const res = await api.put(`/cafe/warehouse/${editingId}/`, payload);
        setItems((prev) => prev.map((s) => (s.id === editingId ? res.data : s)));
        setModalOpen(false);

        // Корректировка кассы только на разницу (в зависимости от знака суммы)
        await postCashflowDelta({ title, deltaAmount: deltaTotal });
      }
    } catch (err) {
      const errorMessage = validateResErrors(err, "Ошибка сохранения товара");
      alert(errorMessage, true);
    }
  };

  const openDelete = (row) => {
    setDeleteItem(row);
    setDeleteOpen(true);
  };

  const confirmDelete = async () => {
    if (!deleteItem?.id) return;
    try {
      await api.delete(`/cafe/warehouse/${deleteItem.id}/`);
      setItems((prev) => prev.filter((s) => s.id !== deleteItem.id));
      setDeleteOpen(false);

      // При удалении корректируем кассу на всю "стоимость" остатка (как разницу до нуля)
      const prevTotal =
        Math.max(0, toNum(deleteItem.remainder)) *
        Math.max(0, toNum(deleteItem.unit_price));
      await postCashflowDelta({
        title: deleteItem.title,
        deltaAmount: 0 - prevTotal,
      });

      setDeleteItem(null);
    } catch (err) {
      const errorMessage = validateResErrors(err, "Ошибка удаления товара");
      alert(errorMessage, true);
    }
  };

  const openMove = (item) => {
    setMoveItem(item);
    setMoveQty("");
    setMoveUnitPrice(String(item.unit_price ?? ""));
    setMoveOpen(true);
  };

  const applyMove = async (e) => {
    e.preventDefault();

    if (!moveItem) return;

    const qtyNum = toNum(moveQty);

    if (!(qtyNum > 0)) return;

    const current = toNum(moveItem.remainder);
    const nextQty = current + qtyNum;

    const unitPriceNum = toNum(moveUnitPrice);
    const payload = {
      title: moveItem.title,
      unit: moveItem.unit,
      remainder: numStr(nextQty),
      minimum: numStr(toNum(moveItem.minimum)),
      unit_price: numStr(unitPriceNum >= 0 ? unitPriceNum : toNum(moveItem.unit_price)),
    };
    const moveSupId = normalizeSupplierId(moveItem);
    if (moveSupId) payload.supplier = moveSupId;

    try {
      const res = await api.put(`/cafe/warehouse/${moveItem.id}/`, payload);
      setItems((prev) => prev.map((s) => (s.id === moveItem.id ? res.data : s)));
      setMoveOpen(false);
      // Запись в кассу (расход — приход товара на склад): количество × цена
      const boxId = cashboxId || String(cashboxes?.[0]?.id ?? cashboxes?.[0]?.uuid ?? "");
      if (boxId) {
        const price = unitPriceNum > 0 ? unitPriceNum : toNum(moveItem.unit_price);
        const amount = qtyNum * price;
        const moveName = `Приход на склад: ${moveItem.title}, ${numStr(qtyNum)} ${moveItem.unit}`;
        api.post("/construction/cashflows/", {
          cashbox: boxId,
          type: "expense",
          name: moveName,
          amount,
        }).catch(() => { });
      }
    } catch (err) {
      const errorMessage = validateResErrors(err, "Ошибка применения движения");
      alert(errorMessage, true);
    }
  };

  const handleTabChange = (nextTab) => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (nextTab === "stock") next.delete("tab");
        else next.set("tab", "suppliers");
        return next;
      },
      { replace: true }
    );
  };

  return (
    <section className="cafeStock">
      <div className="cafeStock__tabs">
        <button
          type="button"
          className={`cafeStock__tab ${activeTab === "stock" ? "cafeStock__tab--active" : ""}`}
          onClick={() => handleTabChange("stock")}
        >
          Склад
        </button>
        <button
          type="button"
          className={`cafeStock__tab ${activeTab === "suppliers" ? "cafeStock__tab--active" : ""}`}
          onClick={() => handleTabChange("suppliers")}
        >
          Поставщики
        </button>
      </div>

      {activeTab === "stock" ? (
        <>
          <div className="cafeStock__header">
            <div>
              <h2 className="cafeStock__title">Склад</h2>
            </div>

            <div className="cafeStock__actions">
              <div className="cafeStock__search">
                <FaSearch className="cafeStock__searchIcon" />
                <input
                  className="cafeStock__searchInput"
                  placeholder="Поиск ингредиента…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  type="text"
                  autoComplete="off"
                />
              </div>

              <button
                className="cafeStock__btn cafeStock__btn--primary"
                onClick={openCreate}
                type="button"
              >
                <FaPlus /> Новый товар
              </button>
            </div>
          </div>
          <DataContainer>
            <div className="cafeStock__list">
              {loading && <div className="cafeStock__alert">Загрузка…</div>}

              {!loading &&
                filtered.map((s) => {
                  const supplierCap = rowSupplierCaption(s);
                  return (
                    <article key={s.id} className="cafeStock__card">
                      <div className="cafeStock__cardLeft">
                        <div className="cafeStock__avatar">
                          <FaBoxes />
                        </div>
                        <div>
                          <h3 className="cafeStock__name">{s.title}</h3>
                          <div className="cafeStock__meta">
                            {supplierCap ? (
                              <span className="cafeStock__muted">Поставщик: {supplierCap}</span>
                            ) : null}
                            <span className="cafeStock__muted">
                              Остаток: {toNum(s.remainder)} {s.unit}
                            </span>
                            <span
                              className={`cafeStock__status ${isLow(s) ? "cafeStock__status--low" : "cafeStock__status--ok"
                                }`}
                            >
                              {isLow(s) ? "Мало" : "Ок"}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="cafeStock__rowActions">
                        <button
                          className="cafeStock__btn cafeStock__btn--success"
                          onClick={() => openMove(s)}
                          type="button"
                        >
                          Приход
                        </button>
                        <button
                          className="cafeStock__btn cafeStock__btn--secondary"
                          onClick={() => openEdit(s)}
                          type="button"
                        >
                          <FaEdit /> Изменить
                        </button>
                        <button
                          className="cafeStock__btn cafeStock__btn--danger"
                          onClick={() => openDelete(s)}
                          type="button"
                        >
                          <FaTrash /> Удалить
                        </button>
                      </div>
                    </article>
                  );
                })}

              {!loading && !filtered.length && (
                <div className="cafeStock__alert">Ничего не найдено по «{query}».</div>
              )}
            </div>
          </DataContainer>

          {/* Модалка товара */}
          {modalOpen && (
            <StockItemModal
              editingId={editingId}
              form={form}
              setForm={setForm}
              supplierSuggestions={supplierSuggestions}
              supplierOptionFallback={supplierOptionFallback}
              onClose={() => {
                setModalOpen(false);
                setSupplierOptionFallback(null);
              }}
              onSubmit={saveItem}
              sanitizeDecimalInput={sanitizeDecimalInput}
            />
          )}

          {/* Модалка приход */}
          {moveOpen && moveItem && (
            <StockMoveModal
              moveItem={moveItem}
              moveQty={moveQty}
              setMoveQty={setMoveQty}
              moveUnitPrice={moveUnitPrice}
              setMoveUnitPrice={setMoveUnitPrice}
              onClose={() => setMoveOpen(false)}
              onSubmit={applyMove}
              sanitizeDecimalInput={sanitizeDecimalInput}
            />
          )}

          {/* Модалка подтверждения удаления */}
          {deleteOpen && deleteItem && (
            <StockDeleteModal
              deleteItem={deleteItem}
              onClose={() => setDeleteOpen(false)}
              onConfirm={confirmDelete}
            />
          )}
        </>
      ) : (
        <DataContainer>
          <Suppliers hideStatus />
        </DataContainer>
      )}
    </section>
  );
};

export default Stock;
