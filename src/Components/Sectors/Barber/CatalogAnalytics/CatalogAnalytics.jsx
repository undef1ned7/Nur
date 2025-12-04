// CatalogAnalytics.jsx
import React, { useEffect, useMemo, useState } from "react";
import {
  RefreshCcw,
  Users2,
  PackageSearch,
  Wallet,
  Trophy,
  Boxes,
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

import CatalogAnalyticsDetailsModal from "./CatalogAnalyticsDetailsModal.jsx";
import CatalogAnalyticsCard from "./CatalogAnalyticsCard.jsx";
import {
  toNum,
  fmt,
  take,
  asArray,
  clean,
  keyOf,
  months,
  monthRange,
  tsOf,
  fetchAllConstructionCashflows,
} from "./CatalogAnalyticsUtils";

/* ─── основной компонент ─── */
const CatalogAnalytics = () => {
  const dispatch = useDispatch();
  const { history, historyObjects } = useSale();
  const { list: products } = useSelector((s) => s.product);

  /* фильтр: год/месяц */
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [monthIdx, setMonthIdx] = useState(now.getMonth());
  const { startTs, endTs } = useMemo(
    () => monthRange(year, monthIdx),
    [year, monthIdx]
  );

  /* модалка */
  const [modal, setModal] = useState({
    open: false,
    title: "",
    columns: [],
    rows: [],
  });
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

  /* KPI склада (снимок) */
  const stockKpis = useMemo(() => {
    const list = products || [];
    const positions = list.length;
    const totalQty = list.reduce((a, p) => a + toNum(p.quantity), 0);
    const stockValueRetail = list.reduce(
      (a, p) => a + toNum(p.price) * toNum(p.quantity),
      0
    );
    return { positions, totalQty, stockValueRetail };
  }, [products]);

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
      const unit =
        p.purchase_price != null ? toNum(p.purchase_price) : toNum(p.price);
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
        p?.brand_name ||
          (typeof p?.brand === "string" ? p.brand : p?.brand?.name),
        "—"
      );
      const cDisp = clean(
        p?.category_name ||
          (typeof p?.category === "string" ? p.category : p?.category?.name),
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
          const raw = String(
            cf.type ?? cf.kind ?? cf.direction ?? ""
          ).trim().toLowerCase();
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

    return () => {
      cancelled = true;
    };
  }, [startTs, endTs]);

  const cashTotals = useMemo(
    () => ({
      income: cashRows.reduce((a, r) => a + toNum(r.income), 0),
      expense: cashRows.reduce((a, r) => a + toNum(r.expense), 0),
    }),
    [cashRows]
  );

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

    return () => {
      cancelled = true;
    };
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
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
          <select
            className="ca-select"
            value={monthIdx}
            onChange={(e) => setMonthIdx(Number(e.target.value))}
            aria-label="Фильтр по месяцу"
          >
            {months.map((m, i) => (
              <option key={m} value={i}>
                {m}
              </option>
            ))}
          </select>
          <button
            className="catalog-analytics__refresh"
            onClick={() => setYear((y) => y)} // мягкий "refresh" для пересчёта
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
          <div className="kpi__icon">
            <Boxes size={18} />
          </div>
          <div className="kpi__name">Позиции</div>
          <div className="kpi__val">{stockKpis.positions}</div>
        </div>
        <div className="kpi">
          <div className="kpi__icon">
            <PackageSearch size={18} />
          </div>
          <div className="kpi__name">Штук на складе</div>
          <div className="kpi__val">{fmt(stockKpis.totalQty)}</div>
        </div>
        <div className="kpi">
          <div className="kpi__icon">
            <Wallet size={18} />
          </div>
          <div className="kpi__name">Оценка запасов</div>
          <div className="kpi__val">{fmt(stockKpis.stockValueRetail)} c</div>
        </div>
        <div className="kpi">
          <div className="kpi__icon">
            <Wallet size={18} />
          </div>
          <div className="kpi__name">Приход (месяц)</div>
          <div className="kpi__val">{fmt(cashTotals.income)} c</div>
        </div>
        <div className="kpi">
          <div className="kpi__icon">
            <Wallet size={18} />
          </div>
          <div className="kpi__name">Расход (месяц)</div>
          <div className="kpi__val">{fmt(cashTotals.expense)} c</div>
        </div>
      </div>

      {/* сетка карточек */}
      <div className="catalog-analytics__grid">
        <CatalogAnalyticsCard
          icon={<Users2 size={16} />}
          title="Поставщики"
          columns={[
            { key: "name", title: "Поставщик", className: "ca-ellipsis" },
            { key: "items", title: "Позиции" },
            {
              key: "amount",
              title: "Сумма",
              className: "ca-money",
              render: (r) => `${fmt(r.amount)} c`,
            },
          ]}
          rows={suppliersRows}
          onMore={openModal}
        />

        <CatalogAnalyticsCard
          icon={<Trophy size={16} />}
          title="Бренды"
          columns={[
            { key: "name", title: "Бренд", className: "ca-ellipsis" },
            { key: "qty", title: "Штук" },
            {
              key: "value",
              title: "Стоимость",
              className: "ca-money",
              render: (r) => `${fmt(r.value)} c`,
            },
          ]}
          rows={brandsRows}
          onMore={openModal}
        />

        <CatalogAnalyticsCard
          icon={<PackageSearch size={16} />}
          title="Категории"
          columns={[
            { key: "name", title: "Категория", className: "ca-ellipsis" },
            { key: "qty", title: "Штук" },
            {
              key: "value",
              title: "Стоимость",
              className: "ca-money",
              render: (r) => `${fmt(r.value)} c`,
            },
          ]}
          rows={categoriesRows}
          onMore={openModal}
        />

        <CatalogAnalyticsCard
          icon={<Wallet size={16} />}
          title="Кассы"
          columns={[
            { key: "name", title: "Касса", className: "ca-ellipsis" },
            { key: "ops", title: "Операции" },
            {
              key: "income",
              title: "Приход",
              className: "ca-money",
              render: (r) => `${fmt(r.income)} c`,
            },
            {
              key: "expense",
              title: "Расход",
              className: "ca-money",
              render: (r) => `${fmt(r.expense)} c`,
            },
          ]}
          rows={loadingCash ? [] : cashRows}
          onMore={openModal}
        />

        <CatalogAnalyticsCard
          icon={<PackageSearch size={16} />}
          title="Товары"
          columns={[
            { key: "name", title: "Товар", className: "ca-ellipsis" },
            { key: "qty", title: "Кол-во" },
            {
              key: "revenue",
              title: "Выручка",
              className: "ca-money",
              render: (r) => `${fmt(r.revenue)} c`,
            },
          ]}
          rows={loadingProducts ? [] : productsRowsAgg}
          onMore={openModal}
        />

        <CatalogAnalyticsCard
          icon={<Users2 size={16} />}
          title="Клиенты"
          columns={[
            { key: "name", title: "Клиент", className: "ca-ellipsis" },
            { key: "orders", title: "Заказы" },
            {
              key: "revenue",
              title: "Выручка",
              className: "ca-money",
              render: (r) => `${fmt(r.revenue)} c`,
            },
          ]}
          rows={clientsRows}
          onMore={openModal}
        />
      </div>

      {modal.open && (
        <CatalogAnalyticsDetailsModal
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
