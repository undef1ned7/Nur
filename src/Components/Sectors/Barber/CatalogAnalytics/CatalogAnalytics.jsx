import React, { useEffect, useMemo, useState } from "react";
import {
  RefreshCcw,
  Users2,
  PackageSearch,
  Wallet,
  Trophy,
  Boxes,
  Info,
  X,
} from "lucide-react";
import "./CatalogAnalytics.scss";
import { useDispatch, useSelector } from "react-redux";
import { useSale } from "../../../../store/slices/saleSlice";
import {
  historySellProduct,
  historySellObjects,
  historySellProductDetail,
  historySellObjectDetail,
} from "../../../../store/creators/saleThunk";
import { fetchProductsAsync } from "../../../../store/creators/productCreators";
import api from "../../../../api";

/* ─── helpers ─── */
const toNum = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const fmt = (x) =>
  new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 2 }).format(toNum(x));
const take = (arr, n) => arr.slice(0, n);
const asArray = (d) =>
  Array.isArray(d?.results) ? d.results : Array.isArray(d) ? d : [];
const clean = (s, fallback = "—") => (s ?? "").toString().trim() || fallback;
const keyOf = (s, fallback = "—") =>
  clean(s, fallback).replace(/\s+/g, " ").toLowerCase();

const months = [
  "Январь","Февраль","Март","Апрель","Май","Июнь",
  "Июль","Август","Сентябрь","Октябрь","Ноябрь","Декабрь",
];

const monthRange = (year, monthIdx) => {
  const start = new Date(year, monthIdx, 1, 0, 0, 0, 0);
  const end = new Date(year, monthIdx + 1, 1, 0, 0, 0, 0);
  return { startTs: start.getTime(), endTs: end.getTime() - 1 };
};

const tsOf = (x) => {
  const v =
    x?.created_at || x?.sold_at || x?.date || x?.datetime || x?.accepted_at || x?.updated_at;
  const t = v ? new Date(v).getTime() : 0;
  return Number.isFinite(t) ? t : 0;
};

async function fetchAllConstructionCashflows(params = {}) {
  const acc = [];
  let page = 1;
  for (;;) {
    try {
      const res = await api.get("/construction/cashflows/", {
        params: { page, page_size: 200, ...params },
      });
      const rows = asArray(res?.data);
      acc.push(...rows);
      if (!res?.data?.next) break;
      page += 1;
    } catch (e) {
      console.error(e);
      break;
    }
  }
  return acc;
}

/* ─── tiny pager ─── */
const usePaged = (rows, pageSize) => {
  const [page, setPage] = useState(1);
  const pages = Math.max(1, Math.ceil(rows.length / pageSize));
  useEffect(() => setPage(1), [rows, pageSize]);
  const slice = useMemo(
    () => rows.slice((page - 1) * pageSize, page * pageSize),
    [rows, page, pageSize]
  );
  return { page, pages, setPage, slice };
};

/* ─── modal ─── */
const DetailsModal = ({ title, columns, rows, getKey, onClose, pageSize = 12 }) => {
  const { page, pages, setPage, slice } = usePaged(rows, pageSize);

  useEffect(() => {
    const onEsc = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onEsc);
    return () => window.removeEventListener("keydown", onEsc);
  }, [onClose]);

  return (
    <div className="ca-modal" role="dialog" aria-modal="true">
      <div className="ca-modal__overlay" onClick={onClose} />
      <div className="ca-modal__card" aria-label={title}>
        <div className="ca-modal__head">
          <h3 className="ca-modal__title">{title}</h3>
          <button className="ca-modal__icon" onClick={onClose} aria-label="Закрыть" type="button">
            <X size={18} />
          </button>
        </div>

        <div className="ca-modal__body">
          <div className="ca-tableWrap ca-tableWrap--modal">
            <table className="ca-table">
              <thead>
                <tr>
                  {columns.map((c) => (
                    <th key={c.key} scope="col">{c.title}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {slice.length === 0 ? (
                  <tr>
                    <td colSpan={columns.length} className="ca-empty">Нет данных</td>
                  </tr>
                ) : (
                  slice.map((r, i) => (
                    <tr key={getKey(r, i)}>
                      {columns.map((c) => (
                        <td key={c.key} className={c.className || ""}>
                          {c.render ? c.render(r) : r[c.key]}
                        </td>
                      ))}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="ca-modal__footer">
          <div className="ca-pager" aria-label="Пагинация">
            <button
              className="ca-pager__btn"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              aria-label="Назад"
              type="button"
            >
              ←
            </button>
            <span className="ca-pager__info">Страница {page} из {pages}</span>
            <button
              className="ca-pager__btn"
              onClick={() => setPage((p) => Math.min(pages, p + 1))}
              disabled={page >= pages}
              aria-label="Вперёд"
              type="button"
            >
              →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

/* ─── основной компонент ─── */
const CatalogAnalytics = () => {
  const dispatch = useDispatch();
  const { history, historyObjects } = useSale();
  const { list: products } = useSelector((s) => s.product);

  /* фильтр: год/месяц */
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [monthIdx, setMonthIdx] = useState(now.getMonth());
  const { startTs, endTs } = useMemo(() => monthRange(year, monthIdx), [year, monthIdx]);

  /* модалка */
  const [modal, setModal] = useState({ open: false, title: "", columns: [], rows: [] });
  const openModal = (payload) => setModal({ open: true, ...payload });
  const closeModal = () => setModal((p) => ({ ...p, open: false }));

  /* загрузка исходников */
  useEffect(() => {
    dispatch(historySellProduct({ search: "" }));
    dispatch(historySellObjects({ search: "" }));
    dispatch(fetchProductsAsync({}));
  }, [dispatch]);

  /* продажи выбранного периода */
  const periodSales = useMemo(() => {
    const all = [...(history || []), ...(historyObjects || [])];
    return all.filter((s) => {
      const t = tsOf(s);
      return t >= startTs && t <= endTs;
    });
  }, [history, historyObjects, startTs, endTs]);

  /* индексы товаров */
  const productById = useMemo(() => {
    const map = new Map();
    (products || []).forEach((p) => {
      if (p?.id != null) map.set(String(p.id), p);
    });
    return map;
  }, [products]);

  const productByName = useMemo(() => {
    const map = new Map();
    (products || []).forEach((p) => {
      if (!p) return;
      const key = keyOf(p.name || "", "");
      map.set(key, p);
    });
    return map;
  }, [products]);

  const findProductForItem = (it) => {
    const pid = it?.product || it?.product_id || it?.object_item || it?.object_id || it?.id;
    if (pid != null && productById.has(String(pid))) return productById.get(String(pid));
    const name = it?.product_name || it?.object_name || it?.name || it?.title || "";
    return productByName.get(keyOf(name, "")) || null;
  };

  /* Поставщики: закупки за выбранный период */
  const suppliersRows = useMemo(() => {
    const inPeriod = (products || []).filter((p) => {
      const t = tsOf(p);
      return t >= startTs && t <= endTs;
    });
    const m = new Map();
    const names = new Map();
    for (const p of inPeriod) {
      const display = clean(p.client_name || p.client, "—");
      const k = keyOf(display, "—");
      names.set(k, display);
      const unit = p.purchase_price != null ? toNum(p.purchase_price) : toNum(p.price);
      const sum = unit * toNum(p.quantity);
      const prev = m.get(k) || { sum: 0, items: 0 };
      m.set(k, { sum: prev.sum + sum, items: prev.items + 1 });
    }
    return Array.from(m, ([k, v]) => ({
      name: names.get(k) || "—",
      items: v.items,
      amount: v.sum,
    })).sort((a, b) => b.amount - a.amount);
  }, [products, startTs, endTs]);

  /* Бренды и Категории — остатки */
  const { brandsRows, categoriesRows } = useMemo(() => {
    const brandMap = new Map();
    const brandNames = new Map();
    const catMap = new Map();
    const catNames = new Map();

    const add = (map, key, qty, value) => {
      const prev = map.get(key) || { qty: 0, value: 0 };
      map.set(key, { qty: prev.qty + qty, value: prev.value + value });
    };

    for (const p of products || []) {
      const qty = toNum(p.quantity);
      const value = qty * toNum(p.price);
      const bDisp = clean(
        p?.brand_name || (typeof p?.brand === "string" ? p.brand : p?.brand?.name),
        "—"
      );
      const cDisp = clean(
        p?.category_name || (typeof p?.category === "string" ? p.category : p?.category?.name),
        "—"
      );
      const bKey = keyOf(bDisp, "—");
      const cKey = keyOf(cDisp, "—");

      brandNames.set(bKey, bDisp);
      catNames.set(cKey, cDisp);

      add(brandMap, bKey, qty, value);
      add(catMap, cKey, qty, value);
    }

    const brands = Array.from(brandMap, ([k, v]) => ({
      name: brandNames.get(k) || "—",
      qty: v.qty,
      value: v.value,
    })).sort((a, b) => b.value - a.value);

    const cats = Array.from(catMap, ([k, v]) => ({
      name: catNames.get(k) || "—",
      qty: v.qty,
      value: v.value,
    })).sort((a, b) => b.value - a.value);

    return { brandsRows: brands, categoriesRows: cats };
  }, [products]);

  /* Кассы — приход/расход за период */
  const [cashRows, setCashRows] = useState([]);
  const [loadingCash, setLoadingCash] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingCash(true);
      try {
        const flows = await fetchAllConstructionCashflows();

        const dirOf = (cf) => {
          const raw = String(cf.type ?? cf.kind ?? cf.direction ?? "").trim().toLowerCase();
          if (["income", "приход"].includes(raw)) return "income";
          if (["expense", "расход"].includes(raw)) return "expense";
          const amt = toNum(cf.amount ?? cf.value ?? cf.sum ?? 0);
          return amt >= 0 ? "income" : "expense";
        };

        const periodFlows = flows.filter((cf) => {
          const t = tsOf(cf);
          return t >= startTs && t <= endTs;
        });

        let boxes = [];
        try {
          const { data } = await api.get("/construction/cashboxes/");
          boxes = asArray(data);
        } catch (e) {
          console.error(e);
        }

        const m = new Map();
        for (const cf of periodFlows) {
          const id = String(cf.cashbox ?? cf.cashbox_id ?? "");
          const dir = dirOf(cf);
          const amt = Math.abs(toNum(cf.amount ?? cf.value ?? cf.sum ?? 0));
          const prev = m.get(id) || { income: 0, expense: 0, ops: 0 };
          m.set(id, {
            income: prev.income + (dir === "income" ? amt : 0),
            expense: prev.expense + (dir === "expense" ? amt : 0),
            ops: prev.ops + 1,
          });
        }

        const rows = Array.from(m, ([id, v]) => {
          const meta = boxes.find((b) => String(b.id || b.uuid) === id);
          const name = clean(
            meta?.department_name || meta?.name || (id ? `Касса #${id}` : "—"),
            "—"
          );
          return { name, ops: v.ops, income: v.income, expense: v.expense };
        }).sort((a, b) => b.income - a.income);

        if (!cancelled) setCashRows(rows);
      } catch (e) {
        console.error(e);
        if (!cancelled) setCashRows([]);
      } finally {
        if (!cancelled) setLoadingCash(false);
      }
    })();
    return () => { cancelled = true; };
  }, [startTs, endTs]);

  const cashTotals = useMemo(() => {
    const income = cashRows.reduce((a, r) => a + toNum(r.income), 0);
    const expense = cashRows.reduce((a, r) => a + toNum(r.expense), 0);
    return { income, expense, net: income - expense };
  }, [cashRows]);

  /* Товары (продажи за период) — агрегация */
  const [productsRowsAgg, setProductsRowsAgg] = useState([]);
  const [loadingProducts, setLoadingProducts] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingProducts(true);
      const m = new Map();
      const names = new Map();
      let hadItems = false;

      const addItem = (it) => {
        const disp = clean(it.product_name || it.object_name || it.name, "—");
        const k = keyOf(disp, "—");
        names.set(k, disp);
        const qty = toNum(it.quantity);
        const revenue = qty * toNum(it.unit_price);
        const prev = m.get(k) || { qty: 0, revenue: 0 };
        m.set(k, { qty: prev.qty + qty, revenue: prev.revenue + revenue });
      };

      for (const s of periodSales) {
        const items = Array.isArray(s.items) ? s.items : [];
        if (items.length) hadItems = true;
        items.forEach(addItem);
      }

      if (!hadItems) {
        const ids = take(periodSales.map((s) => s.id), 60);
        for (const id of ids) {
          try {
            const d1 = await dispatch(historySellProductDetail(id)).unwrap();
            (Array.isArray(d1?.items) ? d1.items : []).forEach(addItem);
          } catch (e) {
            console.error(e);
          }
          try {
            const d2 = await dispatch(historySellObjectDetail(id)).unwrap();
            (Array.isArray(d2?.items) ? d2.items : []).forEach(addItem);
          } catch (e) {
            console.error(e);
          }
        }
      }

      if (!cancelled) {
        const rows = Array.from(m, ([k, v]) => ({
          name: names.get(k) || "—",
          qty: v.qty,
          revenue: v.revenue,
        })).sort((a, b) => b.revenue - a.revenue);
        setProductsRowsAgg(rows);
        setLoadingProducts(false);
      }
    })();
    return () => { cancelled = true; };
  }, [periodSales, dispatch]);

  /* Клиенты (продажи за период) */
  const clientsRows = useMemo(() => {
    const m = new Map();
    const names = new Map();
    for (const s of periodSales) {
      const disp = clean(s.client_name || s.client, "Без имени");
      const k = keyOf(disp, "без имени");
      names.set(k, disp);
      const prev = m.get(k) || { sum: 0, cnt: 0 };
      m.set(k, { sum: prev.sum + toNum(s.total), cnt: prev.cnt + 1 });
    }
    return Array.from(m, ([k, v]) => ({
      name: names.get(k) || "—",
      orders: v.cnt,
      revenue: v.sum,
    })).sort((a, b) => b.revenue - a.revenue);
  }, [periodSales]);

  /* KPI склада (снимок) */
  const stockKpis = useMemo(() => {
    const positions = (products || []).length;
    const totalQty = (products || []).reduce((a, p) => a + toNum(p.quantity), 0);
    const stockValueRetail = (products || []).reduce(
      (a, p) => a + toNum(p.price) * toNum(p.quantity),
      0
    );
    return { positions, totalQty, stockValueRetail };
  }, [products]);

  /* карточка (12 строк на страницу) */
  const renderCard = ({ icon, title, columns, rows, moreTitle }) => {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const { page, pages, setPage, slice } = usePaged(rows, 12);
    return (
      <div className="ca-card">
        <div className="ca-card__head">
          <div className="ca-card__title">
            {icon}
            <span>{title}</span>
          </div>
          <button
            className="ca-card__more"
            aria-label="Подробнее"
            title="Подробнее"
            type="button"
            onClick={() => openModal({ title: moreTitle || title, columns, rows })}
          >
            <Info size={16} />
          </button>
        </div>

        <div className="ca-tableWrap">
          <table className="ca-table">
            <thead>
              <tr>
                {columns.map((c) => (
                  <th key={c.key} scope="col">{c.title}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {slice.length === 0 ? (
                <tr>
                  <td colSpan={columns.length} className="ca-empty">Нет данных</td>
                </tr>
              ) : (
                slice.map((r, i) => (
                  <tr key={`${title}-${i}`}>
                    {columns.map((c) => (
                      <td key={c.key} className={c.className || ""}>
                        {c.render ? c.render(r) : r[c.key]}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="ca-card__pager">
          <button
            className="ca-pager__btn"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            aria-label="Назад"
            type="button"
          >
            ←
          </button>
          <span className="ca-pager__info">{page} / {pages}</span>
          <button
            className="ca-pager__btn"
            onClick={() => setPage((p) => Math.min(pages, p + 1))}
            disabled={page >= pages}
            aria-label="Вперёд"
            type="button"
          >
            →
          </button>
        </div>
      </div>
    );
  };

  const years = useMemo(() => {
    const cur = new Date().getFullYear();
    return [cur, cur - 1, cur - 2, cur - 3, cur - 4];
  }, []);

  return (
    <div className="catalog-analytics">
      <div className="catalog-analytics__head">
        <h2 className="catalog-analytics__title">
          <Trophy size={18} /> Аналитика каталога
        </h2>

        <div className="catalog-analytics__filters">
          <select
            className="ca-select"
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            aria-label="Фильтр по году"
          >
            {years.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
          <select
            className="ca-select"
            value={monthIdx}
            onChange={(e) => setMonthIdx(Number(e.target.value))}
            aria-label="Фильтр по месяцу"
          >
            {months.map((m, i) => (
              <option key={m} value={i}>{m}</option>
            ))}
          </select>
          <button
            className="catalog-analytics__refresh"
            onClick={() => setYear((y) => y)} // триггер для перерасчёта (без запроса)
            aria-label="Обновить"
            title="Обновить"
            type="button"
          >
            <RefreshCcw size={16} />
          </button>
        </div>
      </div>

      {/* KPI */}
      <div className="catalog-analytics__kpis">
        <div className="kpi">
          <div className="kpi__icon"><Boxes size={18} /></div>
          <div className="kpi__name">Позиции</div>
          <div className="kpi__val">{stockKpis.positions}</div>
        </div>
        <div className="kpi">
          <div className="kpi__icon"><PackageSearch size={18} /></div>
          <div className="kpi__name">Штук на складе</div>
          <div className="kpi__val">{fmt(stockKpis.totalQty)}</div>
        </div>
        <div className="kpi">
          <div className="kpi__icon"><Wallet size={18} /></div>
          <div className="kpi__name">Оценка запасов</div>
          <div className="kpi__val">{fmt(stockKpis.stockValueRetail)} c</div>
        </div>
        <div className="kpi">
          <div className="kpi__icon"><Wallet size={18} /></div>
          <div className="kpi__name">Приход (месяц)</div>
          <div className="kpi__val">{fmt(cashTotals.income)} c</div>
        </div>
        <div className="kpi">
          <div className="kpi__icon"><Wallet size={18} /></div>
          <div className="kpi__name">Расход (месяц)</div>
          <div className="kpi__val">{fmt(cashTotals.expense)} c</div>
        </div>
      </div>

      {/* сетка карточек */}
      <div className="catalog-analytics__grid">
        {renderCard({
          icon: <Users2 size={16} />,
          title: "Поставщики",
          columns: [
            { key: "name", title: "Поставщик", className: "ca-ellipsis" },
            { key: "items", title: "Позиции" },
            { key: "amount", title: "Сумма", className: "ca-money", render: (r) => `${fmt(r.amount)} c` },
          ],
          rows: suppliersRows,
        })}

        {renderCard({
          icon: <Trophy size={16} />,
          title: "Бренды",
          columns: [
            { key: "name", title: "Бренд", className: "ca-ellipsis" },
            { key: "qty", title: "Штук" },
            { key: "value", title: "Стоимость", className: "ca-money", render: (r) => `${fmt(r.value)} c` },
          ],
          rows: brandsRows,
        })}

        {renderCard({
          icon: <PackageSearch size={16} />,
          title: "Категории",
          columns: [
            { key: "name", title: "Категория", className: "ca-ellipsis" },
            { key: "qty", title: "Штук" },
            { key: "value", title: "Стоимость", className: "ca-money", render: (r) => `${fmt(r.value)} c` },
          ],
          rows: categoriesRows,
        })}

        {renderCard({
          icon: <Wallet size={16} />,
          title: "Кассы",
          columns: [
            { key: "name", title: "Касса", className: "ca-ellipsis" },
            { key: "ops", title: "Операции" },
            { key: "income", title: "Приход", className: "ca-money", render: (r) => `${fmt(r.income)} c` },
            { key: "expense", title: "Расход", className: "ca-money", render: (r) => `${fmt(r.expense)} c` },
          ],
          rows: loadingCash ? [] : cashRows,
        })}

        {renderCard({
          icon: <PackageSearch size={16} />,
          title: "Товары",
          columns: [
            { key: "name", title: "Товар", className: "ca-ellipsis" },
            { key: "qty", title: "Кол-во" },
            { key: "revenue", title: "Выручка", className: "ca-money", render: (r) => `${fmt(r.revenue)} c` },
          ],
          rows: loadingProducts ? [] : productsRowsAgg,
        })}

        {renderCard({
          icon: <Users2 size={16} />,
          title: "Клиенты",
          columns: [
            { key: "name", title: "Клиент", className: "ca-ellipsis" },
            { key: "orders", title: "Заказы" },
            { key: "revenue", title: "Выручка", className: "ca-money", render: (r) => `${fmt(r.revenue)} c` },
          ],
          rows: clientsRows,
        })}
      </div>

      {modal.open && (
        <DetailsModal
          title={modal.title}
          columns={modal.columns}
          rows={modal.rows}
          getKey={(r, i) => `${modal.title}-${i}`}
          onClose={closeModal}
          pageSize={12}
        />
      )}
    </div>
  );
};

export default CatalogAnalytics;
