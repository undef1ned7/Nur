import React, { useMemo, useState } from "react";
import "./Analytics.scss";

/* ===== demo-данные (как у тебя) ===== */
const PRODUCTS = [
  { name: "Кофе зерновой 1 кг",   category: "Чай/Кофе", brand: "Acme",   unit: "шт", cost: 700, price: 950, initQty: 30 },
  { name: "Чай зелёный 100 пак.", category: "Чай/Кофе", brand: "Sakura", unit: "уп", cost: 200, price: 320, initQty: 80 },
  { name: "Какао 250 г",          category: "Чай/Кофе", brand: "Nordik", unit: "шт", cost: 120, price: 210, initQty: 40 },
  { name: "Молоко UHT 1 л",       category: "Напитки",  brand: "Bosco",  unit: "шт", cost: 55,  price: 90,  initQty: 120 },
  { name: "Сок яблочный 1 л",     category: "Напитки",  brand: "Acme",   unit: "шт", cost: 70,  price: 110, initQty: 60 },
  { name: "Вода негаз. 0.5 л",    category: "Напитки",  brand: "Khan",   unit: "шт", cost: 12,  price: 25,  initQty: 300 },
  { name: "Сироп ваниль 0.7 л",   category: "Сиропы",   brand: "Acme",   unit: "шт", cost: 180, price: 290, initQty: 25 },
  { name: "Орехи миндаль 200 г",  category: "Снэки",    brand: "Nordik", unit: "уп", cost: 260, price: 420, initQty: 35 },
];
const priceOf = (n) => PRODUCTS.find(p => p.name === n)?.price ?? 0;
const costOf  = (n) => PRODUCTS.find(p => p.name === n)?.cost ?? 0;
const unitOf  = (n) => PRODUCTS.find(p => p.name === n)?.unit ?? "";

const RECEIPTS = [
  { date: "2025-09-01", supplier: "ООО «Альфа»", items: [
    { product: "Кофе зерновой 1 кг", qty: 20, cost: costOf("Кофе зерновой 1 кг") },
    { product: "Чай зелёный 100 пак.", qty: 40, cost: costOf("Чай зелёный 100 пак.") },
  ]},
  { date: "2025-09-05", supplier: "ИП Бета", items: [
    { product: "Молоко UHT 1 л", qty: 100, cost: costOf("Молоко UHT 1 л") },
    { product: "Вода негаз. 0.5 л", qty: 150, cost: costOf("Вода негаз. 0.5 л") },
  ]},
  { date: "2025-09-10", supplier: "ТОО «Гамма»", items: [
    { product: "Орехи миндаль 200 г", qty: 20, cost: costOf("Орехи миндаль 200 г") },
    { product: "Сироп ваниль 0.7 л",  qty: 10, cost: costOf("Сироп ваниль 0.7 л") },
  ]},
];
const ISSUES = [
  { date: "2025-09-02", customer: "Розница", items: [
    { product: "Кофе зерновой 1 кг", qty: 6,  price: priceOf("Кофе зерновой 1 кг") },
    { product: "Молоко UHT 1 л",    qty: 20, price: priceOf("Молоко UHT 1 л") },
  ]},
  { date: "2025-09-06", customer: "Компания «Дельта»", items: [
    { product: "Чай зелёный 100 пак.", qty: 30, price: priceOf("Чай зелёный 100 пак.") },
    { product: "Вода негаз. 0.5 л",   qty: 80, price: priceOf("Вода негаз. 0.5 л") },
  ]},
  { date: "2025-09-11", customer: "Розница", items: [
    { product: "Орехи миндаль 200 г", qty: 10, price: priceOf("Орехи миндаль 200 г") },
    { product: "Сироп ваниль 0.7 л",  qty: 6,  price: priceOf("Сироп ваниль 0.7 л") },
  ]},
];
const RETURNS_TO_SUP = [
  { date: "2025-09-07", supplier: "ООО «Альфа»", items: [
    { product: "Чай зелёный 100 пак.", qty: 5, cost: costOf("Чай зелёный 100 пак.") },
  ]},
];
const WRITEOFFS = [
  { date: "2025-09-09", items: [
    { product: "Молоко UHT 1 л", qty: -6 },
  ]},
];

/* ===== utils ===== */
const parseISO   = (s) => new Date(s + "T00:00:00");
const addDays    = (s, d) => new Date(parseISO(s).getTime() + d * 86400000).toISOString().slice(0,10);
const daysBetween= (a, b) => Math.round((parseISO(b) - parseISO(a)) / 86400000);
const sumBy      = (arr, f) => arr.reduce((acc, x) => acc + (f(x) || 0), 0);
const money      = (n) => new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 }).format(Math.round(n));
const clamp      = (x, a, b) => Math.max(a, Math.min(b, x));
const percentDelta = (cur, prev) => {
  if (!prev) return null;
  const raw = ((cur - prev) / prev) * 100;
  const v = Math.round(raw);
  return Number.isFinite(v) ? (v === 0 ? 0 : v) : null;
};

/* ===== универсальная таблица: динамические колонки, числовые выравниваем вправо ===== */
const PaginatedTable = ({ head, rows, pageSize = 15, colTemplate, numeric = [] }) => {
  const [page, setPage] = useState(1);
  const total = Math.max(1, Math.ceil(rows.length / pageSize));
  const cur = clamp(page, 1, total);
  const slice = rows.slice((cur - 1) * pageSize, cur * pageSize);

  const template = colTemplate || `repeat(${head.length}, minmax(120px, 1fr))`;

  return (
    <div className="analytics-table" role="table">
      <div className="analytics-table__head" role="row" style={{ gridTemplateColumns: template }}>
        {head.map((h, i) => <div key={i} className="analytics-table__col" role="columnheader">{h}</div>)}
      </div>

      {slice.map((r, i) => (
        <div key={i} className="analytics-table__row" role="row" style={{ gridTemplateColumns: template }}>
          {r.map((c, j) => (
            <div
              key={j}
              className={`analytics-table__col ${numeric.includes(j) ? "is-num" : ""}`}
              role="cell"
            >
              {c}
            </div>
          ))}
        </div>
      ))}

      {!slice.length && <div className="analytics-table__empty">Нет данных.</div>}

      {rows.length > pageSize && (
        <div className="analytics__pager" aria-label="Пагинация">
          <ul className="analytics__pageList">
            {Array.from({ length: total }).map((_, i) => {
              const p = i + 1;
              return (
                <li key={p}>
                  <button
                    type="button"
                    className={`analytics__pageBtn ${p === cur ? "is-active" : ""}`}
                    onClick={() => setPage(p)}
                    aria-current={p === cur ? "page" : undefined}
                  >
                    {p}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
};

const WarehouseAnalytics = () => {
  const [tab, setTab] = useState("overview");
  const [range, setRange] = useState("30");

  const allDates = [...RECEIPTS, ...ISSUES, ...RETURNS_TO_SUP, ...WRITEOFFS].map(d => d.date).sort();
  const maxDate = allDates[allDates.length - 1] || "2025-09-14";
  const minDate = allDates[0] || "2025-09-01";

  const end = maxDate;
  const start = (() => {
    const days = Number(range);
    const s = addDays(end, -(days - 1));
    return s < minDate ? minDate : s;
  })();

  const prevEnd = addDays(start, -1);
  const prevStart = addDays(prevEnd, -(Number(range) - 1));

  const rec = RECEIPTS.filter(d => d.date >= start && d.date <= end);
  const iss = ISSUES.filter(d => d.date >= start && d.date <= end);
  const ret = RETURNS_TO_SUP.filter(d => d.date >= start && d.date <= end);
  const wrt = WRITEOFFS.filter(d => d.date >= start && d.date <= end);

  const recPrev = RECEIPTS.filter(d => d.date >= prevStart && d.date <= prevEnd);
  const issPrev = ISSUES.filter(d => d.date >= prevStart && d.date <= prevEnd);
  const retPrev = RETURNS_TO_SUP.filter(d => d.date >= prevStart && d.date <= prevEnd);
  const wrtPrev = WRITEOFFS.filter(d => d.date >= prevStart && d.date <= prevEnd);

  const purchases    = useMemo(() => sumBy(rec, d => sumBy(d.items, i => i.qty * i.cost)), [rec]);
  const returnsSup   = useMemo(() => sumBy(ret, d => sumBy(d.items, i => i.qty * i.cost)), [ret]);
  const revenue      = useMemo(() => sumBy(iss, d => sumBy(d.items, i => i.qty * i.price)), [iss]);
  const cogs         = useMemo(() => sumBy(iss, d => sumBy(d.items, i => i.qty * costOf(i.product))), [iss]);
  const writeoffCost = useMemo(() => sumBy(wrt, d => sumBy(d.items, i => Math.abs(i.qty) * costOf(i.product))), [wrt]);
  const gross  = Math.max(0, revenue - cogs);
  const margin = revenue ? Math.round((gross / revenue) * 100) : 0;

  const purchasesPrev    = sumBy(recPrev, d => sumBy(d.items, i => i.qty * i.cost));
  const returnsSupPrev   = sumBy(retPrev, d => sumBy(d.items, i => i.qty * i.cost));
  const revenuePrev      = sumBy(issPrev, d => sumBy(d.items, i => i.qty * i.price));
  const cogsPrev         = sumBy(issPrev, d => sumBy(d.items, i => i.qty * costOf(i.product)));
  const writeoffCostPrev = sumBy(wrtPrev, d => sumBy(d.items, i => Math.abs(i.qty) * costOf(i.product)));
  const grossPrev        = Math.max(0, revenuePrev - cogsPrev);

  const days = daysBetween(start, end) + 1;
  const orders = iss.length;
  const soldQty = sumBy(iss, d => sumBy(d.items, i => i.qty));
  const uniqueCustomers = new Set(iss.map(o => o.customer)).size;
  const avgDailyRevenue = revenue / Math.max(1, days);
  const avgCheck = revenue / Math.max(1, orders);

  const revenueByCat = useMemo(() => {
    const map = new Map();
    iss.forEach(o => o.items.forEach(i => {
      const cat = PRODUCTS.find(p => p.name === i.product)?.category || "Прочее";
      map.set(cat, (map.get(cat) || 0) + i.qty * i.price);
    }));
    return Array.from(map, ([label, value]) => ({ label, value }));
  }, [iss]);
  const topCat = revenueByCat.slice().sort((a,b)=>b.value-a.value)[0]?.label || "—";

  const topProducts = useMemo(() => {
    const map = new Map();
    iss.forEach(o => o.items.forEach(i => {
      const row = map.get(i.product) || { qty: 0, sum: 0, unit: unitOf(i.product) };
      row.qty += i.qty;
      row.sum += i.qty * i.price;
      map.set(i.product, row);
    }));
    const rows = Array.from(map, ([name, v]) => [name, `${v.qty} ${v.unit || ""}`.trim(), money(v.sum)]);
    rows.sort((a, b) => Number(b[2].replace(/\s/g, "")) - Number(a[2].replace(/\s/g, "")));
    return rows;
  }, [iss]);

  const topCustomers = useMemo(() => {
    const map = new Map();
    iss.forEach(o => {
      const s = sumBy(o.items, i => i.qty * i.price);
      map.set(o.customer, (map.get(o.customer) || 0) + s);
    });
    const rows = Array.from(map, ([cust, s]) => [cust, money(s)]);
    rows.sort((a, b) => Number(b[1].replace(/\s/g, "")) - Number(a[1].replace(/\s/g, "")));
    return rows;
  }, [iss]);

  const topSuppliers = useMemo(() => {
    const map = new Map();
    rec.forEach(o => {
      const s = sumBy(o.items, i => i.qty * i.cost);
      map.set(o.supplier, (map.get(o.supplier) || 0) + s);
    });
    const rows = Array.from(map, ([sup, s]) => [sup, money(s)]);
    rows.sort((a, b) => Number(b[1].replace(/\s/g, "")) - Number(a[1].replace(/\s/g, "")));
    return rows;
  }, [rec]);

  const endStock = useMemo(() => {
    const map = new Map(PRODUCTS.map(p => [p.name, p.initQty]));
    RECEIPTS.forEach(r => r.items.forEach(i => map.set(i.product, (map.get(i.product) || 0) + i.qty)));
    RETURNS_TO_SUP.forEach(r => r.items.forEach(i => map.set(i.product, (map.get(i.product) || 0) - i.qty)));
    ISSUES.forEach(r => r.items.forEach(i => map.set(i.product, (map.get(i.product) || 0) - i.qty)));
    WRITEOFFS.forEach(r => r.items.forEach(i => map.set(i.product, (map.get(i.product) || 0) + i.qty)));
    return PRODUCTS.map(p => {
      const qty = Math.max(0, map.get(p.name) || 0);
      return { ...p, qty, value: qty * p.cost };
    });
  }, []);
  const stockValue = endStock.reduce((acc, x) => acc + x.value, 0);
  const stockRows = endStock
    .map(p => [p.name, p.category, p.brand, p.unit, p.qty, money(p.value)])
    .sort((a, b) => b[4] - a[4]);

  const journal = [
    ...rec.map(r => ({ date: r.date, type: "Закупка", who: r.supplier, sum: sumBy(r.items, i => i.qty * i.cost) })),
    ...iss.map(r => ({ date: r.date, type: "Продажа", who: r.customer, sum: sumBy(r.items, i => i.qty * i.price) })),
    ...ret.map(r => ({ date: r.date, type: "Возврат пост.", who: r.supplier, sum: sumBy(r.items, i => i.qty * i.cost) })),
    ...wrt.map(r => ({ date: r.date, type: "Списание", who: "Склад", sum: sumBy(r.items, i => Math.abs(i.qty) * costOf(i.product)) })),
  ].sort((a,b)=> (a.date < b.date ? 1 : -1));
  const journalRows = journal.map(j => [j.date, j.type, j.who, money(j.sum)]);

  const Kpi = ({ label, value, prev, mode = "pos", note }) => {
    const delta = percentDelta(value, prev);
    let cls = "none", txt = "—";
    if (delta === 0) { cls = "flat"; txt = "0%"; }
    else if (delta !== null) {
      const up = delta > 0;
      const good = mode === "pos" ? up : mode === "neg" ? !up : false;
      cls = up ? (good ? "up" : "down") : (!good ? "down" : "up");
      txt = `${delta > 0 ? "+" : ""}${delta}%`;
    }
    return (
      <div className="analytics__kpi">
        <div className="analytics__kpiTop">
          <div className="analytics__kpiLabel">{label}</div>
          <span className={`analytics__delta analytics__delta--${cls}`}>{txt}</span>
        </div>
        <div className="analytics__kpiValue">{money(value)}</div>
        {typeof note === "string" && <div className="analytics__kpiNote">{note}</div>}
      </div>
    );
  };

  return (
    <div className="analytics">
      {/* Header */}
      <div className="analytics__header">
        <h2 className="analytics__title">Аналитика</h2>
        <div className="analytics__seg" role="tablist" aria-label="Период">
          {["7","30","90"].map(r => (
            <button
              key={r}
              type="button"
              role="tab"
              aria-selected={range === r}
              className={`analytics__segBtn ${range === r ? "is-active" : ""}`}
              onClick={() => setRange(r)}
            >
              {r} дн.
            </button>
          ))}
        </div>
      </div>

      {/* Tabs – сверху */}
      <div className="analytics__tabs analytics__tabs--top" role="tablist" aria-label="Разделы">
        <button className={`analytics__tab ${tab==="overview"?"is-active":""}`} onClick={()=>setTab("overview")}>Обзор</button>
        <button className={`analytics__tab ${tab==="sales"?"is-active":""}`} onClick={()=>setTab("sales")}>Продажи</button>
        <button className={`analytics__tab ${tab==="purchases"?"is-active":""}`} onClick={()=>setTab("purchases")}>Закупки</button>
        <button className={`analytics__tab ${tab==="inventory"?"is-active":""}`} onClick={()=>setTab("inventory")}>Остатки</button>
      </div>

      {/* KPI */}
      <div className="analytics__kpis">
        <Kpi label="Выручка" value={revenue} prev={revenuePrev} mode="pos" />
        <Kpi label="Закупки" value={purchases} prev={purchasesPrev} mode="neutral" />
        <Kpi label="Валовая прибыль" value={gross} prev={grossPrev} mode="pos" note={`Маржа: ${margin}%`} />
        <Kpi label="Возвраты поставщику" value={returnsSup} prev={returnsSupPrev} mode="neg" />
        <Kpi label="Списание (себ-сть)" value={writeoffCost} prev={writeoffCostPrev} mode="neg" />
        <Kpi label="Стоимость остатков" value={stockValue} prev={stockValue} mode="neutral" />
      </div>

      {/* Сводка + таблицы (компактно, без лишних полей) */}
      <div className="analytics__grid">
        <div className="analytics__card">
          <div className="analytics__cardTitle">Сводка периода</div>
          <ul className="analytics__statList">
            <li><span>Дней в периоде</span><b>{days}</b></li>
            <li><span>Заказы</span><b>{orders}</b></li>
            <li><span>Товаров продано</span><b>{soldQty}</b></li>
            <li><span>Уник. покупателей</span><b>{uniqueCustomers}</b></li>
            <li><span>Средняя выручка/день</span><b>{money(avgDailyRevenue)}</b></li>
            <li><span>Средний чек</span><b>{money(avgCheck)}</b></li>
            <li><span>Топ-категория</span><b>{topCat}</b></li>
          </ul>
        </div>

        <div className="analytics__card">
          <div className="analytics__cardTitle">Журнал операций</div>
          <PaginatedTable
            head={["Дата", "Тип", "Контрагент", "Сумма"]}
            rows={journalRows}
            colTemplate={"120px 140px 1fr 120px"}
            numeric={[3]}
          />
        </div>

        {(tab === "sales" || tab === "overview") && (
          <>
            <div className="analytics__card">
              <div className="analytics__cardTitle">Топ товаров</div>
              <PaginatedTable
                head={["Товар", "Кол-во", "Сумма"]}
                rows={topProducts}
                colTemplate={"1fr 120px 120px"}
                numeric={[1,2]}
              />
            </div>
            <div className="analytics__card">
              <div className="analytics__cardTitle">Топ покупателей</div>
              <PaginatedTable
                head={["Покупатель", "Сумма"]}
                rows={topCustomers}
                colTemplate={"1fr 140px"}
                numeric={[1]}
              />
            </div>
          </>
        )}

        {(tab === "purchases" || tab === "overview") && (
          <div className="analytics__card">
            <div className="analytics__cardTitle">Топ поставщиков</div>
            <PaginatedTable
              head={["Поставщик", "Сумма"]}
              rows={topSuppliers}
              colTemplate={"1fr 140px"}
              numeric={[1]}
            />
          </div>
        )}

        {(tab === "inventory" || tab === "overview") && (
          <div className="analytics__card analytics__card--span2">
            <div className="analytics__cardTitle">Остатки (стоимость)</div>
            <PaginatedTable
              head={["Товар", "Категория", "Бренд", "Ед.", "Кол-во", "Стоимость"]}
              rows={stockRows}
              colTemplate={"1.6fr 1fr 1fr .7fr .8fr 1fr"}
              numeric={[4,5]}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default WarehouseAnalytics;
