

// import React, { useEffect, useMemo, useState } from "react";
// import { useDispatch, useSelector } from "react-redux";

// import { historySellProduct } from "../../../store/creators/saleThunk";
// import {
//   fetchProductsAsync,
//   fetchBrandsAsync,
//   fetchCategoriesAsync,
// } from "../../../store/creators/productCreators";
// import { useSale } from "../../../store/slices/saleSlice";

// import "./Analytics.scss";

// /* -------------------- helpers -------------------- */
// const parseISO = (s) => {
//   const d = new Date(s);
//   return isNaN(d.getTime()) ? null : d;
// };
// const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
// const sortKeysAsc = (arr) => [...arr].sort((a, b) => (a > b ? 1 : -1));
// const num = (v) => {
//   const n = Number(v);
//   return Number.isFinite(n) ? n : 0;
// };
// const keyByGranularity = (date, g) => {
//   const y = date.getFullYear();
//   const m = String(date.getMonth() + 1).padStart(2, "0");
//   const d = String(date.getDate()).padStart(2, "0");
//   if (g === "day") return `${y}-${m}-${d}`;
//   if (g === "year") return `${y}`;
//   return `${y}-${m}`; // month
// };

// /* -------------------- tiny SVG sparkline -------------------- */
// const Sparkline = ({ values = [], width = 520, height = 140 }) => {
//   if (!values.length) {
//     return <div className="analytics-sales__sparkline-empty">Нет данных</div>;
//   }
//   const pad = 8;
//   const W = width - pad * 2;
//   const H = height - pad * 2;

//   const min = Math.min(...values);
//   const max = Math.max(...values);
//   const pts = values.map((v, i) => {
//     const x = pad + (i * W) / Math.max(1, values.length - 1);
//     const ratio = max === min ? 0.5 : (v - min) / (max - min);
//     const y = pad + (1 - ratio) * H;
//     return [x, y];
//   });
//   const d = pts.map(([x, y], i) => (i === 0 ? `M${x},${y}` : `L${x},${y}`)).join(" ");

//   return (
//     <svg className="analytics-sales__sparkline" viewBox={`0 0 ${width} ${height}`} role="img">
//       {/* baseline */}
//       <polyline
//         fill="none"
//         stroke="var(--c-border)"
//         strokeWidth="1"
//         points={`${pad},${height - pad} ${width - pad},${height - pad}`}
//       />
//       <path d={d} fill="none" stroke="var(--c-primary)" strokeWidth="2" />
//       {pts.map(([x, y], i) => (
//         <circle key={i} cx={x} cy={y} r="2.2" fill="var(--c-primary)" />
//       ))}
//     </svg>
//   );
// };

// /* ============================================================= */

// const Analytics = () => {
//   const dispatch = useDispatch();

//   // из saleSlice
//   const { history = [], loading: salesLoading, error: salesError } = useSale();

//   // из productSlice
//   const {
//     list: products = [],
//     brands = [],
//     categories = [],
//     loading: productsLoading,
//   } = useSelector((s) => s.product);

//   /* ---------- controls ---------- */
//   const [startDate, setStartDate] = useState(() => {
//     const n = new Date();
//     return `${n.getFullYear()}-01-01`;
//   });
//   const [endDate, setEndDate] = useState(() => new Date().toISOString().slice(0, 10));
//   const [granularity, setGranularity] = useState("month"); // day | month | year
//   const [activeTab, setActiveTab] = useState("sales"); // sales | inventory | taxonomy

//   /* ---------- fetch once ---------- */
//   useEffect(() => {
//     dispatch(historySellProduct({ search: "" }));
//     dispatch(fetchProductsAsync({ page: 1, page_size: 1000 })); // подгоните под ваш API
//     dispatch(fetchBrandsAsync());
//     dispatch(fetchCategoriesAsync());
//   }, [dispatch]);

//   /* ---------- formatters ---------- */
//   const lan = (typeof localStorage !== "undefined" && localStorage.getItem("i18nextLng")) || "ru";
//   const nfMoney = useMemo(() => {
//     try {
//       return new Intl.NumberFormat(lan === "en" ? "en-US" : "ru-RU", {
//         style: "currency",
//         currency: "KGS",
//         maximumFractionDigits: 0,
//       });
//     } catch {
//       return { format: (n) => `${Number(n).toLocaleString("ru-RU")} сом` };
//     }
//   }, [lan]);
//   const nfInt = useMemo(() => new Intl.NumberFormat(lan === "en" ? "en-US" : "ru-RU"), [lan]);

//   /* ---------- date range ---------- */
//   const inRange = (d) => {
//     const sd = parseISO(startDate);
//     const ed = parseISO(endDate);
//     if (!d || !sd || !ed) return false;
//     const from = new Date(sd.getFullYear(), sd.getMonth(), sd.getDate(), 0, 0, 0);
//     const to = new Date(ed.getFullYear(), ed.getMonth(), ed.getDate(), 23, 59, 59);
//     return d >= from && d <= to;
//   };

//   const quickPreset = (preset) => {
//     const now = new Date();
//     if (preset === "thisMonth") {
//       const sd = new Date(now.getFullYear(), now.getMonth(), 1);
//       const ed = new Date(now.getFullYear(), now.getMonth() + 1, 0);
//       setStartDate(sd.toISOString().slice(0, 10));
//       setEndDate(ed.toISOString().slice(0, 10));
//       setGranularity("day");
//     }
//     if (preset === "lastMonth") {
//       const sd = new Date(now.getFullYear(), now.getMonth() - 1, 1);
//       const ed = new Date(now.getFullYear(), now.getMonth(), 0);
//       setStartDate(sd.toISOString().slice(0, 10));
//       setEndDate(ed.toISOString().slice(0, 10));
//       setGranularity("day");
//     }
//     if (preset === "ytd") {
//       const sd = new Date(now.getFullYear(), 0, 1);
//       setStartDate(sd.toISOString().slice(0, 10));
//       setEndDate(now.toISOString().slice(0, 10));
//       setGranularity("month");
//     }
//     if (preset === "thisYear") {
//       const sd = new Date(now.getFullYear(), 0, 1);
//       const ed = new Date(now.getFullYear(), 11, 31);
//       setStartDate(sd.toISOString().slice(0, 10));
//       setEndDate(ed.toISOString().slice(0, 10));
//       setGranularity("month");
//     }
//   };

//   /* ====================== SALES ====================== */
//   const salesFiltered = useMemo(
//     () => (history || []).filter((r) => inRange(parseISO(r?.created_at))),
//     [history, startDate, endDate]
//   );

//   const salesTotals = useMemo(() => {
//     const count = salesFiltered.length;
//     const revenue = salesFiltered.reduce((acc, r) => acc + num(r?.total), 0);
//     // если бы была себестоимость по строкам продажи — считали бы валовую маржу
//     return { count, revenue, avg: count ? revenue / count : 0 };
//   }, [salesFiltered]);

//   const salesSeries = useMemo(() => {
//     const bucket = new Map();
//     for (const r of salesFiltered) {
//       const d = parseISO(r?.created_at);
//       if (!d) continue;
//       const key = keyByGranularity(d, granularity);
//       bucket.set(key, num(bucket.get(key)) + num(r?.total));
//     }
//     const keys = sortKeysAsc(Array.from(bucket.keys()));
//     return { labels: keys, values: keys.map((k) => Math.round(num(bucket.get(k)))) };
//   }, [salesFiltered, granularity]);

//   /* ====================== INVENTORY ====================== */
//   const LOW_STOCK_THRESHOLD = 5;

//   const inventoryKPIs = useMemo(() => {
//     const totalSkus = products.length;
//     const lowStock = products.filter((p) => num(p?.quantity) <= LOW_STOCK_THRESHOLD).length;

//     const stockValueByPrice = products.reduce(
//       (acc, p) => acc + num(p?.price) * num(p?.quantity),
//       0
//     );

//     const stockValueByCost =
//       products.some((p) => "cost_price" in p)
//         ? products.reduce((acc, p) => acc + num(p?.cost_price) * num(p?.quantity), 0)
//         : null;

//     return { totalSkus, lowStock, stockValueByPrice, stockValueByCost };
//   }, [products]);

//   const topCategories = useMemo(() => {
//     const m = new Map();
//     products.forEach((p) => {
//       const key = p?.category || p?.category_name || "Без категории";
//       m.set(key, num(m.get(key)) + 1);
//     });
//     return Array.from(m.entries()).sort((a, b) => b[1] - a[1]).slice(0, 10);
//   }, [products]);

//   const lowStockList = useMemo(
//     () => [...products].sort((a, b) => num(a?.quantity) - num(b?.quantity)).slice(0, 10),
//     [products]
//   );

//   // ABC по **стоимости запаса** (если есть cost_price, используем его; иначе price)
//   const abcStats = useMemo(() => {
//     if (!products.length) return { A: 0, B: 0, C: 0, list: [] };
//     const items = products.map((p) => {
//       const value =
//         "cost_price" in p ? num(p.cost_price) * num(p.quantity) : num(p.price) * num(p.quantity);
//       return { id: p.id, name: p.name, value };
//     });
//     items.sort((a, b) => b.value - a.value);
//     const total = items.reduce((s, x) => s + x.value, 0) || 1;
//     let acc = 0;
//     let A = 0,
//       B = 0,
//       C = 0;
//     const tagged = items.map((it) => {
//       acc += it.value;
//       const share = acc / total;
//       let tag = "C";
//       if (share <= 0.8) tag = "A";
//       else if (share <= 0.95) tag = "B";
//       if (tag === "A") A += 1;
//       else if (tag === "B") B += 1;
//       else C += 1;
//       return { ...it, tag };
//     });
//     return { A, B, C, list: tagged.slice(0, 10) };
//   }, [products]);

//   /* ====================== TAXONOMY ====================== */
//   const brandStats = useMemo(() => {
//     const m = new Map();
//     products.forEach((p) => {
//       const key = p?.brand || p?.brand_name || "Без бренда";
//       m.set(key, num(m.get(key)) + 1);
//     });
//     const pairs = Array.from(m.entries()).sort((a, b) => b[1] - a[1]);
//     return { total: brands.length || pairs.length, top: pairs.slice(0, 10) };
//   }, [products, brands]);

//   const categoryStats = useMemo(() => {
//     const m = new Map();
//     products.forEach((p) => {
//       const key = p?.category || p?.category_name || "Без категории";
//       m.set(key, num(m.get(key)) + 1);
//     });
//     const pairs = Array.from(m.entries()).sort((a, b) => b[1] - a[1]);
//     return { total: categories.length || pairs.length, top: pairs.slice(0, 10) };
//   }, [products, categories]);

//   /* ====================== UI ====================== */
//   const TABS = [
//     { key: "sales", label: "Продажи" },
//     { key: "inventory", label: "Склад" },
//     { key: "taxonomy", label: "Бренды/Категории" },
//   ];

//   return (
//     <div className="analytics">
//       <div className="analytics__tabs">
//         {TABS.map((t) => (
//           <button
//             key={t.key}
//             onClick={() => setActiveTab(t.key)}
//             className={`analytics__tab ${activeTab === t.key ? "analytics__tab--active" : ""}`}
//           >
//             {t.label}
//           </button>
//         ))}
//       </div>

//       {/* ---------------- SALES ---------------- */}
//       {activeTab === "sales" && (
//         <section className="analytics-sales">
//           <div className="analytics-sales__controls">
//             <div className="analytics-sales__presets">
//               <button onClick={() => quickPreset("thisMonth")}>Этот месяц</button>
//               <button onClick={() => quickPreset("lastMonth")}>Прошлый месяц</button>
//               <button onClick={() => quickPreset("ytd")}>Год-к-дате</button>
//               <button onClick={() => quickPreset("thisYear")}>Весь год</button>
//             </div>
//             <div className="analytics-sales__range">
//               <label className="analytics-sales__label">
//                 С
//                 <input
//                   type="date"
//                   className="analytics-sales__input"
//                   value={startDate}
//                   onChange={(e) => setStartDate(e.target.value)}
//                 />
//               </label>
//               <label className="analytics-sales__label">
//                 До
//                 <input
//                   type="date"
//                   className="analytics-sales__input"
//                   value={endDate}
//                   onChange={(e) => setEndDate(e.target.value)}
//                 />
//               </label>

//               <div className="analytics-sales__segmented">
//                 <button
//                   className={granularity === "day" ? "is-active" : ""}
//                   onClick={() => setGranularity("day")}
//                 >
//                   Дни
//                 </button>
//                 <button
//                   className={granularity === "month" ? "is-active" : ""}
//                   onClick={() => setGranularity("month")}
//                 >
//                   Месяцы
//                 </button>
//                 <button
//                   className={granularity === "year" ? "is-active" : ""}
//                   onClick={() => setGranularity("year")}
//                 >
//                   Годы
//                 </button>
//               </div>
//             </div>
//           </div>

//           <div className="analytics-sales__kpis">
//             <div className="analytics-sales__kpi">
//               <div className="analytics-sales__kpi-label">Число продаж</div>
//               <div className="analytics-sales__kpi-value">
//                 {nfInt.format(salesTotals.count)}
//               </div>
//             </div>
//             <div className="analytics-sales__kpi">
//               <div className="analytics-sales__kpi-label">Выручка</div>
//               <div className="analytics-sales__kpi-value">
//                 {nfMoney.format(salesTotals.revenue)}
//               </div>
//             </div>
//             <div className="analytics-sales__kpi">
//               <div className="analytics-sales__kpi-label">Средний чек</div>
//               <div className="analytics-sales__kpi-value">
//                 {nfMoney.format(salesTotals.avg)}
//               </div>
//             </div>
//           </div>

//           <div className="analytics-sales__card">
//             {salesLoading ? (
//               <div className="analytics-sales__note">Загрузка истории продаж…</div>
//             ) : salesError ? (
//               <div className="analytics-sales__error">Ошибка: {String(salesError)}</div>
//             ) : (
//               <>
//                 <div className="analytics-sales__card-title">
//                   Динамика выручки ({granularity === "day" ? "дни" : granularity === "month" ? "месяцы" : "годы"})
//                 </div>
//                 <Sparkline values={salesSeries.values} />
//                 <div className="analytics-sales__legend">
//                   {salesSeries.labels.map((l, i) => (
//                     <span className="analytics-sales__legend-item" key={i}>
//                       {l}
//                     </span>
//                   ))}
//                 </div>
//               </>
//             )}
//           </div>

//           <div className="analytics-sales__card">
//             <div className="analytics-sales__card-title">Последние продажи</div>
//             {salesFiltered.length ? (
//               <div className="analytics-sales__table-wrap">
//                 <table className="analytics-sales__table">
//                   <thead>
//                     <tr>
//                       <th>#</th>
//                       <th>Пользователь</th>
//                       <th>Сумма</th>
//                       <th>Статус</th>
//                       <th>Дата</th>
//                     </tr>
//                   </thead>
//                   <tbody>
//                     {salesFiltered.slice(0, 10).map((r, i) => (
//                       <tr key={r?.id ?? i}>
//                         <td>{i + 1}</td>
//                         <td>{r?.user_display || "—"}</td>
//                         <td>{nfMoney.format(num(r?.total))}</td>
//                         <td>{r?.status || "—"}</td>
//                         <td>
//                           {r?.created_at ? new Date(r.created_at).toLocaleString() : "—"}
//                         </td>
//                       </tr>
//                     ))}
//                   </tbody>
//                 </table>
//               </div>
//             ) : (
//               <div className="analytics-sales__note">Нет продаж в выбранном периоде.</div>
//             )}
//           </div>
//         </section>
//       )}

//       {/* ---------------- INVENTORY ---------------- */}
//       {activeTab === "inventory" && (
//         <section className="analytics-inventory">
//           <div className="analytics-inventory__kpis">
//             <div className="analytics-inventory__kpi">
//               <div className="analytics-inventory__kpi-label">Всего SKU</div>
//               <div className="analytics-inventory__kpi-value">
//                 {nfInt.format(products.length)}
//               </div>
//             </div>
//             <div className="analytics-inventory__kpi">
//               <div className="analytics-inventory__kpi-label">Стоимость склада</div>
//               <div className="analytics-inventory__kpi-value">
//                 {inventoryKPIs.stockValueByCost != null
//                   ? nfMoney.format(inventoryKPIs.stockValueByCost)
//                   : nfMoney.format(inventoryKPIs.stockValueByPrice)}
//               </div>
//             </div>
//             <div className="analytics-inventory__kpi">
//               <div className="analytics-inventory__kpi-label">Низкие остатки (≤5)</div>
//               <div className="analytics-inventory__kpi-value">
//                 {nfInt.format(inventoryKPIs.lowStock)}
//               </div>
//             </div>
//           </div>

//           <div className="analytics-inventory__grid">
//             <div className="analytics-inventory__card">
//               <div className="analytics-inventory__card-title">
//                 Топ-10 категорий по кол-ву SKU
//               </div>
//               <ul className="analytics-inventory__bars">
//                 {topCategories.length ? (
//                   topCategories.map(([name, count], i) => {
//                     const max = topCategories[0][1] || 1;
//                     const width = clamp(Math.round((count / max) * 100), 5, 100);
//                     return (
//                       <li className="analytics-inventory__bar" key={i}>
//                         <span className="analytics-inventory__bar-name" title={name}>
//                           {name}
//                         </span>
//                         <span className="analytics-inventory__bar-track">
//                           <span
//                             className="analytics-inventory__bar-fill"
//                             style={{ width: `${width}%` }}
//                           />
//                         </span>
//                         <span className="analytics-inventory__bar-value">
//                           {nfInt.format(count)}
//                         </span>
//                       </li>
//                     );
//                   })
//                 ) : (
//                   <li className="analytics-inventory__empty">Нет данных</li>
//                 )}
//               </ul>
//             </div>

//             <div className="analytics-inventory__card">
//               <div className="analytics-inventory__card-title">
//                 Топ-10 с минимальными остатками
//               </div>
//               <ul className="analytics-inventory__list">
//                 {lowStockList.length ? (
//                   lowStockList.map((p, i) => (
//                     <li className="analytics-inventory__row" key={p?.id ?? i}>
//                       <span className="analytics-inventory__row-name" title={p?.name || "—"}>
//                         {p?.name || "—"}
//                       </span>
//                       <span className="analytics-inventory__row-qty">
//                         Остаток: {nfInt.format(num(p?.quantity))}
//                       </span>
//                     </li>
//                   ))
//                 ) : (
//                   <li className="analytics-inventory__empty">Нет данных</li>
//                 )}
//               </ul>
//             </div>
//           </div>

//           <div className="analytics-inventory__card">
//             <div className="analytics-inventory__card-title">ABC по стоимости запаса</div>
//             <div className="analytics-inventory__abc">
//               <div className="analytics-inventory__abc-badge analytics-inventory__abc-badge--a">
//                 A: {nfInt.format(abcStats.A)}
//               </div>
//               <div className="analytics-inventory__abc-badge analytics-inventory__abc-badge--b">
//                 B: {nfInt.format(abcStats.B)}
//               </div>
//               <div className="analytics-inventory__abc-badge analytics-inventory__abc-badge--c">
//                 C: {nfInt.format(abcStats.C)}
//               </div>
//             </div>
//             <ul className="analytics-inventory__list">
//               {abcStats.list.length ? (
//                 abcStats.list.map((it, i) => (
//                   <li className="analytics-inventory__row" key={it.id ?? i}>
//                     <span className="analytics-inventory__row-name" title={it.name}>
//                       {it.name}
//                     </span>
//                     <span className="analytics-inventory__row-qty">
//                       {it.tag} · {nfMoney.format(it.value)}
//                     </span>
//                   </li>
//                 ))
//               ) : (
//                 <li className="analytics-inventory__empty">Нет данных</li>
//               )}
//             </ul>
//             <p className="analytics-inventory__note">
//               * Если есть <code>cost_price</code>, используется он. Иначе считаем по <code>price</code>.
//             </p>
//           </div>
//         </section>
//       )}

//       {/* ---------------- TAXONOMY ---------------- */}
//       {activeTab === "taxonomy" && (
//         <section className="analytics-taxonomy">
//           <div className="analytics-taxonomy__grid">
//             <div className="analytics-taxonomy__card">
//               <div className="analytics-taxonomy__card-title">
//                 Бренды{" "}
//                 <span className="analytics-taxonomy__muted">
//                   (всего: {nfInt.format(brandStats.total)})
//                 </span>
//               </div>
//               <ul className="analytics-taxonomy__bars">
//                 {brandStats.top.length ? (
//                   brandStats.top.map(([name, count], i) => {
//                     const max = brandStats.top[0][1] || 1;
//                     const width = clamp(Math.round((count / max) * 100), 5, 100);
//                     return (
//                       <li className="analytics-taxonomy__bar" key={i}>
//                         <span className="analytics-taxonomy__bar-name" title={name}>
//                           {name}
//                         </span>
//                         <span className="analytics-taxonomy__bar-track">
//                           <span
//                             className="analytics-taxonomy__bar-fill"
//                             style={{ width: `${width}%` }}
//                           />
//                         </span>
//                         <span className="analytics-taxonomy__bar-value">
//                           {nfInt.format(count)}
//                         </span>
//                       </li>
//                     );
//                   })
//                 ) : (
//                   <li className="analytics-taxonomy__empty">Нет данных</li>
//                 )}
//               </ul>
//             </div>

//             <div className="analytics-taxonomy__card">
//               <div className="analytics-taxonomy__card-title">
//                 Категории{" "}
//                 <span className="analytics-taxonomy__muted">
//                   (всего: {nfInt.format(categoryStats.total)})
//                 </span>
//               </div>
//               <ul className="analytics-taxonomy__bars">
//                 {categoryStats.top.length ? (
//                   categoryStats.top.map(([name, count], i) => {
//                     const max = categoryStats.top[0][1] || 1;
//                     const width = clamp(Math.round((count / max) * 100), 5, 100);
//                     return (
//                       <li className="analytics-taxonomy__bar" key={i}>
//                         <span className="analytics-taxonomy__bar-name" title={name}>
//                           {name}
//                         </span>
//                         <span className="analytics-taxonomy__bar-track">
//                           <span
//                             className="analytics-taxonomy__bar-fill"
//                             style={{ width: `${width}%` }}
//                           />
//                         </span>
//                         <span className="analytics-taxonomy__bar-value">
//                           {nfInt.format(count)}
//                         </span>
//                       </li>
//                     );
//                   })
//                 ) : (
//                   <li className="analytics-taxonomy__empty">Нет данных</li>
//                 )}
//               </ul>
//             </div>
//           </div>
//         </section>
//       )}

//       {/* общие подсказки */}
//       {(productsLoading || salesLoading) && (
//         <div className="analytics__loading">Обновляем данные…</div>
//       )}
//     </div>
//   );
// };

// export default Analytics;



import React, { useEffect, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import api from "../../../api";

import { historySellProduct } from "../../../store/creators/saleThunk";
import {
  fetchProductsAsync,
  fetchBrandsAsync,
  fetchCategoriesAsync,
} from "../../../store/creators/productCreators";
import { useSale } from "../../../store/slices/saleSlice";

import "./Analytics.scss";

/* -------------------- helpers -------------------- */
const parseISO = (s) => {
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
};
const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
const sortKeysAsc = (arr) => [...arr].sort((a, b) => (a > b ? 1 : -1));
const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
const keyByGranularity = (date, g) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  if (g === "day") return `${y}-${m}-${d}`;
  if (g === "year") return `${y}`;
  return `${y}-${m}`; // month
};
const listFrom = (r) => r?.data?.results || r?.data || [];

/* -------------------- tiny SVG sparkline -------------------- */
const Sparkline = ({ values = [], width = 520, height = 140 }) => {
  if (!values.length) {
    return <div className="analytics-sales__sparkline-empty">Нет данных</div>;
  }
  const pad = 8;
  const W = width - pad * 2;
  const H = height - pad * 2;

  const min = Math.min(...values);
  const max = Math.max(...values);
  const pts = values.map((v, i) => {
    const x = pad + (i * W) / Math.max(1, values.length - 1);
    const ratio = max === min ? 0.5 : (v - min) / (max - min);
    const y = pad + (1 - ratio) * H;
    return [x, y];
  });
  const d = pts.map(([x, y], i) => (i === 0 ? `M${x},${y}` : `L${x},${y}`)).join(" ");

  return (
    <svg className="analytics-sales__sparkline" viewBox={`0 0 ${width} ${height}`} role="img">
      <polyline
        fill="none"
        stroke="var(--c-border)"
        strokeWidth="1"
        points={`${pad},${height - pad} ${width - pad},${height - pad}`}
      />
      <path d={d} fill="none" stroke="var(--c-primary)" strokeWidth="2" />
      {pts.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="2.2" fill="var(--c-primary)" />
      ))}
    </svg>
  );
};

/* ============================================================= */

const Analytics = () => {
  const dispatch = useDispatch();

  // из saleSlice
  const { history = [], loading: salesLoading, error: salesError } = useSale();

  // из productSlice
  const {
    list: products = [],
    brands = [],
    categories = [],
    loading: productsLoading,
  } = useSelector((s) => s.product);

  /* ---------- controls ---------- */
  const [startDate, setStartDate] = useState(() => {
    const n = new Date();
    return `${n.getFullYear()}-01-01`;
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [granularity, setGranularity] = useState("month"); // day | month | year
  const [activeTab, setActiveTab] = useState("sales"); // sales | inventory | taxonomy | cashbox

  /* ---------- fetch once ---------- */
  useEffect(() => {
    dispatch(historySellProduct({ search: "" }));
    dispatch(fetchProductsAsync({ page: 1, page_size: 1000 }));
    dispatch(fetchBrandsAsync());
    dispatch(fetchCategoriesAsync());
  }, [dispatch]);

  /* ---------- formatters ---------- */
  const lan =
    (typeof localStorage !== "undefined" && localStorage.getItem("i18nextLng")) || "ru";
  const nfMoney = useMemo(() => {
    try {
      return new Intl.NumberFormat(lan === "en" ? "en-US" : "ru-RU", {
        style: "currency",
        currency: "KGS",
        maximumFractionDigits: 0,
      });
    } catch {
      return { format: (n) => `${Number(n).toLocaleString("ru-RU")} сом` };
    }
  }, [lan]);
  const nfInt = useMemo(
    () => new Intl.NumberFormat(lan === "en" ? "en-US" : "ru-RU"),
    [lan]
  );

  /* ---------- date range ---------- */
  const inRange = (d) => {
    const sd = parseISO(startDate);
    const ed = parseISO(endDate);
    if (!d || !sd || !ed) return false;
    const from = new Date(sd.getFullYear(), sd.getMonth(), sd.getDate(), 0, 0, 0);
    const to = new Date(ed.getFullYear(), ed.getMonth(), ed.getDate(), 23, 59, 59);
    return d >= from && d <= to;
  };

  const quickPreset = (preset) => {
    const now = new Date();
    if (preset === "thisMonth") {
      const sd = new Date(now.getFullYear(), now.getMonth(), 1);
      const ed = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      setStartDate(sd.toISOString().slice(0, 10));
      setEndDate(ed.toISOString().slice(0, 10));
      setGranularity("day");
    }
    if (preset === "lastMonth") {
      const sd = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const ed = new Date(now.getFullYear(), now.getMonth(), 0);
      setStartDate(sd.toISOString().slice(0, 10));
      setEndDate(ed.toISOString().slice(0, 10));
      setGranularity("day");
    }
    if (preset === "ytd") {
      const sd = new Date(now.getFullYear(), 0, 1);
      setStartDate(sd.toISOString().slice(0, 10));
      setEndDate(now.toISOString().slice(0, 10));
      setGranularity("month");
    }
    if (preset === "thisYear") {
      const sd = new Date(now.getFullYear(), 0, 1);
      const ed = new Date(now.getFullYear(), 11, 31);
      setStartDate(sd.toISOString().slice(0, 10));
      setEndDate(ed.toISOString().slice(0, 10));
      setGranularity("month");
    }
  };

  /* ====================== SALES ====================== */
  const salesFiltered = useMemo(
    () => (history || []).filter((r) => inRange(parseISO(r?.created_at))),
    [history, startDate, endDate]
  );

  const salesTotals = useMemo(() => {
    const count = salesFiltered.length;
    const revenue = salesFiltered.reduce((acc, r) => acc + num(r?.total), 0);
    return { count, revenue, avg: count ? revenue / count : 0 };
  }, [salesFiltered]);

  const salesSeries = useMemo(() => {
    const bucket = new Map();
    for (const r of salesFiltered) {
      const d = parseISO(r?.created_at);
      if (!d) continue;
      const key = keyByGranularity(d, granularity);
      bucket.set(key, num(bucket.get(key)) + num(r?.total));
    }
    const keys = sortKeysAsc(Array.from(bucket.keys()));
    return { labels: keys, values: keys.map((k) => Math.round(num(bucket.get(k)))) };
  }, [salesFiltered, granularity]);

  /* ====================== INVENTORY ====================== */
  const LOW_STOCK_THRESHOLD = 5;

  const inventoryKPIs = useMemo(() => {
    const totalSkus = products.length;
    const lowStock = products.filter((p) => num(p?.quantity) <= LOW_STOCK_THRESHOLD).length;

    const stockValueByPrice = products.reduce(
      (acc, p) => acc + num(p?.price) * num(p?.quantity),
      0
    );

    const stockValueByCost =
      products.some((p) => "cost_price" in p)
        ? products.reduce((acc, p) => acc + num(p?.cost_price) * num(p?.quantity), 0)
        : null;

    return { totalSkus, lowStock, stockValueByPrice, stockValueByCost };
  }, [products]);

  const topCategories = useMemo(() => {
    const m = new Map();
    products.forEach((p) => {
      const key = p?.category || p?.category_name || "Без категории";
      m.set(key, num(m.get(key)) + 1);
    });
    return Array.from(m.entries()).sort((a, b) => b[1] - a[1]).slice(0, 10);
  }, [products]);

  const lowStockList = useMemo(
    () => [...products].sort((a, b) => num(a?.quantity) - num(b?.quantity)).slice(0, 10),
    [products]
  );

  // ABC по стоимости запаса
  const abcStats = useMemo(() => {
    if (!products.length) return { A: 0, B: 0, C: 0, list: [] };
    const items = products.map((p) => {
      const value =
        "cost_price" in p ? num(p.cost_price) * num(p.quantity) : num(p.price) * num(p.quantity);
      return { id: p.id, name: p.name, value };
    });
    items.sort((a, b) => b.value - a.value);
    const total = items.reduce((s, x) => s + x.value, 0) || 1;
    let acc = 0;
    let A = 0,
      B = 0,
      C = 0;
    const tagged = items.map((it) => {
      acc += it.value;
      const share = acc / total;
      let tag = "C";
      if (share <= 0.8) tag = "A";
      else if (share <= 0.95) tag = "B";
      if (tag === "A") A += 1;
      else if (tag === "B") B += 1;
      else C += 1;
      return { ...it, tag };
    });
    return { A, B, C, list: tagged.slice(0, 10) };
  }, [products]);

  /* ====================== TAXONOMY ====================== */
  const brandStats = useMemo(() => {
    const m = new Map();
    products.forEach((p) => {
      const key = p?.brand || p?.brand_name || "Без бренда";
      m.set(key, num(m.get(key)) + 1);
    });
    const pairs = Array.from(m.entries()).sort((a, b) => b[1] - a[1]);
    return { total: brands.length || pairs.length, top: pairs.slice(0, 10) };
  }, [products, brands]);

  const categoryStats = useMemo(() => {
    const m = new Map();
    products.forEach((p) => {
      const key = p?.category || p?.category_name || "Без категории";
      m.set(key, num(m.get(key)) + 1);
    });
    const pairs = Array.from(m.entries()).sort((a, b) => b[1] - a[1]);
    return { total: categories.length || pairs.length, top: pairs.slice(0, 10) };
  }, [products, categories]);

  /* ====================== CASHBOX (бизнес-аналитика) ====================== */
  const [boxes, setBoxes] = useState([]);
  const [flows, setFlows] = useState([]);
  const [boxId, setBoxId] = useState("all");
  const [cashLoading, setCashLoading] = useState(false);
  const [cashError, setCashError] = useState("");

  // загрузка касс
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await api.get("/construction/cashboxes/", { params: { page_size: 1000 } });
        if (!cancelled) setBoxes(listFrom(res));
      } catch (e) {
        if (!cancelled) setBoxes([]);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // загрузка cashflows (всё сразу, фильтруем по периоду и кассе на клиенте)
  const loadFlows = async () => {
    setCashError("");
    setCashLoading(true);
    try {
      // Если на бекенде есть фильтры — можно передавать cashbox и даты.
      // Здесь берём побольше и режем на клиенте.
      const params = { page_size: 1000 };
      if (boxId !== "all") params.cashbox = boxId;
      const r = await api.get("/construction/cashflows/", { params });
      const raw = listFrom(r) || [];

      const normalized = raw.map((x, i) => {
        const amt = num(x.amount ?? x.sum ?? x.value ?? x.total ?? 0);
        let type = String(x.type ?? x.kind ?? x.direction ?? "").toLowerCase();
        if (type !== "income" && type !== "expense") type = amt >= 0 ? "income" : "expense";
        const cashboxId = x.cashbox?.id || x.cashbox || x.cashbox_uuid || null;
        const cashboxName =
          x.cashbox?.department_name || x.cashbox?.name || x.cashbox_name || null;
        return {
          id: x.id || x.uuid || `${i}`,
          type,
          amount: Math.abs(amt),
          title:
            x.title || x.name || x.description || x.note || (type === "income" ? "Приход" : "Расход"),
          created_at: x.created_at || x.created || x.date || x.timestamp || x.createdAt || null,
          cashboxId,
          cashboxName,
        };
      });

      setFlows(normalized);
    } catch (e) {
      console.error(e);
      setCashError("Не удалось загрузить операции кассы");
      setFlows([]);
    } finally {
      setCashLoading(false);
    }
  };

  useEffect(() => {
    loadFlows(); // при первом монтировании и смене кассы
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boxId]);

  // отфильтрованные по диапазону
  const flowsFiltered = useMemo(() => {
    return flows.filter((f) => inRange(parseISO(f.created_at)));
  }, [flows, startDate, endDate]);

  const cashTotals = useMemo(() => {
    let income = 0,
      expense = 0;
    for (const f of flowsFiltered) {
      if (f.type === "income") income += f.amount;
      else expense += f.amount;
    }
    return { income, expense, net: income - expense };
  }, [flowsFiltered]);

  const cashSeries = useMemo(() => {
    const inc = new Map();
    const exp = new Map();
    for (const f of flowsFiltered) {
      const d = parseISO(f.created_at);
      if (!d) continue;
      const k = keyByGranularity(d, granularity);
      if (f.type === "income") inc.set(k, num(inc.get(k)) + f.amount);
      else exp.set(k, num(exp.get(k)) + f.amount);
    }
    const keys = sortKeysAsc(Array.from(new Set([...inc.keys(), ...exp.keys()])));
    const incomeVals = keys.map((k) => Math.round(num(inc.get(k))));
    const expenseVals = keys.map((k) => Math.round(num(exp.get(k))));
    const netVals = keys.map((_, i) => Math.round(num(incomeVals[i]) - num(expenseVals[i])));
    return { labels: keys, incomeVals, expenseVals, netVals };
  }, [flowsFiltered, granularity]);

  const perBox = useMemo(() => {
    const map = new Map();
    for (const f of flowsFiltered) {
      const id = f.cashboxId || "—";
      const name =
        f.cashboxName ||
        boxes.find((b) => (b.id || b.uuid) === id)?.department_name ||
        boxes.find((b) => (b.id || b.uuid) === id)?.name ||
        "—";
      const cur = map.get(id) || { name, income: 0, expense: 0 };
      if (f.type === "income") cur.income += f.amount;
      else cur.expense += f.amount;
      map.set(id, cur);
    }
    const rows = Array.from(map.entries()).map(([id, v]) => ({
      id,
      name: v.name,
      income: v.income,
      expense: v.expense,
      net: v.income - v.expense,
    }));
    rows.sort((a, b) => b.net - a.net);
    return rows;
  }, [flowsFiltered, boxes]);

  const topExpenseByTitle = useMemo(() => {
    const m = new Map();
    for (const f of flowsFiltered) {
      if (f.type !== "expense") continue;
      const key = (f.title || "Расход").toString();
      m.set(key, num(m.get(key)) + f.amount);
    }
    return Array.from(m.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);
  }, [flowsFiltered]);

  /* ====================== UI ====================== */
  const TABS = [
    { key: "sales", label: "Продажи" },
    { key: "inventory", label: "Склад" },
    { key: "taxonomy", label: "Бренды/Категории" },
    { key: "cashbox", label: "Касса" }, // ✅ новая вкладка
  ];

  return (
    <div className="analytics">
      <div className="analytics__tabs">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className={`analytics__tab ${activeTab === t.key ? "analytics__tab--active" : ""}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ---------------- SALES ---------------- */}
      {activeTab === "sales" && (
        <section className="analytics-sales">
          <div className="analytics-sales__controls">
            <div className="analytics-sales__presets">
              <button onClick={() => quickPreset("thisMonth")}>Этот месяц</button>
              <button onClick={() => quickPreset("lastMonth")}>Прошлый месяц</button>
              <button onClick={() => quickPreset("ytd")}>Год-к-дате</button>
              <button onClick={() => quickPreset("thisYear")}>Весь год</button>
            </div>
            <div className="analytics-sales__range">
              <label className="analytics-sales__label">
                С
                <input
                  type="date"
                  className="analytics-sales__input"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </label>
              <label className="analytics-sales__label">
                До
                <input
                  type="date"
                  className="analytics-sales__input"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </label>

              <div className="analytics-sales__segmented">
                <button
                  className={granularity === "day" ? "is-active" : ""}
                  onClick={() => setGranularity("day")}
                >
                  Дни
                </button>
                <button
                  className={granularity === "month" ? "is-active" : ""}
                  onClick={() => setGranularity("month")}
                >
                  Месяцы
                </button>
                <button
                  className={granularity === "year" ? "is-active" : ""}
                  onClick={() => setGranularity("year")}
                >
                  Годы
                </button>
              </div>
            </div>
          </div>

          <div className="analytics-sales__kpis">
            <div className="analytics-sales__kpi">
              <div className="analytics-sales__kpi-label">Число продаж</div>
              <div className="analytics-sales__kpi-value">
                {nfInt.format(salesTotals.count)}
              </div>
            </div>
            <div className="analytics-sales__kpi">
              <div className="analytics-sales__kpi-label">Выручка</div>
              <div className="analytics-sales__kpi-value">
                {nfMoney.format(salesTotals.revenue)}
              </div>
            </div>
            <div className="analytics-sales__kpi">
              <div className="analytics-sales__kpi-label">Средний чек</div>
              <div className="analytics-sales__kpi-value">
                {nfMoney.format(salesTotals.avg)}
              </div>
            </div>
          </div>

          <div className="analytics-sales__card">
            {salesLoading ? (
              <div className="analytics-sales__note">Загрузка истории продаж…</div>
            ) : salesError ? (
              <div className="analytics-sales__error">Ошибка: {String(salesError)}</div>
            ) : (
              <>
                <div className="analytics-sales__card-title">
                  Динамика выручки ({granularity === "day" ? "дни" : granularity === "month" ? "месяцы" : "годы"})
                </div>
                <Sparkline values={salesSeries.values} />
                <div className="analytics-sales__legend">
                  {salesSeries.labels.map((l, i) => (
                    <span className="analytics-sales__legend-item" key={i}>
                      {l}
                    </span>
                  ))}
                </div>
              </>
            )}
          </div>

          <div className="analytics-sales__card">
            <div className="analytics-sales__card-title">Последние продажи</div>
            {salesFiltered.length ? (
              <div className="analytics-sales__table-wrap">
                <table className="analytics-sales__table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Пользователь</th>
                      <th>Сумма</th>
                      <th>Статус</th>
                      <th>Дата</th>
                    </tr>
                  </thead>
                  <tbody>
                    {salesFiltered.slice(0, 10).map((r, i) => (
                      <tr key={r?.id ?? i}>
                        <td>{i + 1}</td>
                        <td>{r?.user_display || "—"}</td>
                        <td>{nfMoney.format(num(r?.total))}</td>
                        <td>{r?.status || "—"}</td>
                        <td>
                          {r?.created_at ? new Date(r.created_at).toLocaleString() : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="analytics-sales__note">Нет продаж в выбранном периоде.</div>
            )}
          </div>
        </section>
      )}

      {/* ---------------- INVENTORY ---------------- */}
      {activeTab === "inventory" && (
        <section className="analytics-inventory">
          <div className="analytics-inventory__kpis">
            <div className="analytics-inventory__kpi">
              <div className="analytics-inventory__kpi-label">Всего SKU</div>
              <div className="analytics-inventory__kpi-value">
                {nfInt.format(products.length)}
              </div>
            </div>
            <div className="analytics-inventory__kpi">
              <div className="analytics-inventory__kpi-label">Стоимость склада</div>
              <div className="analytics-inventory__kpi-value">
                {inventoryKPIs.stockValueByCost != null
                  ? nfMoney.format(inventoryKPIs.stockValueByCost)
                  : nfMoney.format(inventoryKPIs.stockValueByPrice)}
              </div>
            </div>
            <div className="analytics-inventory__kpi">
              <div className="analytics-inventory__kpi-label">Низкие остатки (≤5)</div>
              <div className="analytics-inventory__kpi-value">
                {nfInt.format(inventoryKPIs.lowStock)}
              </div>
            </div>
          </div>

          <div className="analytics-inventory__grid">
            <div className="analytics-inventory__card">
              <div className="analytics-inventory__card-title">
                Топ-10 категорий по кол-ву SKU
              </div>
              <ul className="analytics-inventory__bars">
                {topCategories.length ? (
                  topCategories.map(([name, count], i) => {
                    const max = topCategories[0][1] || 1;
                    const width = clamp(Math.round((count / max) * 100), 5, 100);
                    return (
                      <li className="analytics-inventory__bar" key={i}>
                        <span className="analytics-inventory__bar-name" title={name}>
                          {name}
                        </span>
                        <span className="analytics-inventory__bar-track">
                          <span
                            className="analytics-inventory__bar-fill"
                            style={{ width: `${width}%` }}
                          />
                        </span>
                        <span className="analytics-inventory__bar-value">
                          {nfInt.format(count)}
                        </span>
                      </li>
                    );
                  })
                ) : (
                  <li className="analytics-inventory__empty">Нет данных</li>
                )}
              </ul>
            </div>

            <div className="analytics-inventory__card">
              <div className="analytics-inventory__card-title">
                Топ-10 с минимальными остатками
              </div>
              <ul className="analytics-inventory__list">
                {lowStockList.length ? (
                  lowStockList.map((p, i) => (
                    <li className="analytics-inventory__row" key={p?.id ?? i}>
                      <span className="analytics-inventory__row-name" title={p?.name || "—"}>
                        {p?.name || "—"}
                      </span>
                      <span className="analytics-inventory__row-qty">
                        Остаток: {nfInt.format(num(p?.quantity))}
                      </span>
                    </li>
                  ))
                ) : (
                  <li className="analytics-inventory__empty">Нет данных</li>
                )}
              </ul>
            </div>
          </div>

          <div className="analytics-inventory__card">
            <div className="analytics-inventory__card-title">ABC по стоимости запаса</div>
            <div className="analytics-inventory__abc">
              <div className="analytics-inventory__abc-badge analytics-inventory__abc-badge--a">
                A: {nfInt.format(abcStats.A)}
              </div>
              <div className="analytics-inventory__abc-badge analytics-inventory__abc-badge--b">
                B: {nfInt.format(abcStats.B)}
              </div>
              <div className="analytics-inventory__abc-badge analytics-inventory__abc-badge--c">
                C: {nfInt.format(abcStats.C)}
              </div>
            </div>
            <ul className="analytics-inventory__list">
              {abcStats.list.length ? (
                abcStats.list.map((it, i) => (
                  <li className="analytics-inventory__row" key={it.id ?? i}>
                    <span className="analytics-inventory__row-name" title={it.name}>
                      {it.name}
                    </span>
                    <span className="analytics-inventory__row-qty">
                      {it.tag} · {nfMoney.format(it.value)}
                    </span>
                  </li>
                ))
              ) : (
                <li className="analytics-inventory__empty">Нет данных</li>
              )}
            </ul>
            <p className="analytics-inventory__note">
              * Если есть <code>cost_price</code>, используется он. Иначе считаем по <code>price</code>.
            </p>
          </div>
        </section>
      )}

      {/* ---------------- TAXONOMY ---------------- */}
      {activeTab === "taxonomy" && (
        <section className="analytics-taxonomy">
          <div className="analytics-taxonomy__grid">
            <div className="analytics-taxonomy__card">
              <div className="analytics-taxonomy__card-title">
                Бренды{" "}
                <span className="analytics-taxonomy__muted">
                  (всего: {nfInt.format(brandStats.total)})
                </span>
              </div>
              <ul className="analytics-taxonomy__bars">
                {brandStats.top.length ? (
                  brandStats.top.map(([name, count], i) => {
                    const max = brandStats.top[0][1] || 1;
                    const width = clamp(Math.round((count / max) * 100), 5, 100);
                    return (
                      <li className="analytics-taxonomy__bar" key={i}>
                        <span className="analytics-taxonomy__bar-name" title={name}>
                          {name}
                        </span>
                        <span className="analytics-taxonomy__bar-track">
                          <span
                            className="analytics-taxonomy__bar-fill"
                            style={{ width: `${width}%` }}
                          />
                        </span>
                        <span className="analytics-taxonomy__bar-value">
                          {nfInt.format(count)}
                        </span>
                      </li>
                    );
                  })
                ) : (
                  <li className="analytics-taxonomy__empty">Нет данных</li>
                )}
              </ul>
            </div>

            <div className="analytics-taxonomy__card">
              <div className="analytics-taxonomy__card-title">
                Категории{" "}
                <span className="analytics-taxonomy__muted">
                  (всего: {nfInt.format(categoryStats.total)})
                </span>
              </div>
              <ul className="analytics-taxonomy__bars">
                {categoryStats.top.length ? (
                  categoryStats.top.map(([name, count], i) => {
                    const max = categoryStats.top[0][1] || 1;
                    const width = clamp(Math.round((count / max) * 100), 5, 100);
                    return (
                      <li className="analytics-taxonomy__bar" key={i}>
                        <span className="analytics-taxonomy__bar-name" title={name}>
                          {name}
                        </span>
                        <span className="analytics-taxonomy__bar-track">
                          <span
                            className="analytics-taxonomy__bar-fill"
                            style={{ width: `${width}%` }}
                          />
                        </span>
                        <span className="analytics-taxonomy__bar-value">
                          {nfInt.format(count)}
                        </span>
                      </li>
                    );
                  })
                ) : (
                  <li className="analytics-taxonomy__empty">Нет данных</li>
                )}
              </ul>
            </div>
          </div>
        </section>
      )}

      {/* ---------------- CASHBOX ---------------- */}
      {activeTab === "cashbox" && (
        <section className="analytics-cashbox">
          <div className="analytics-cashbox__controls">
            <div className="analytics-cashbox__presets">
              <button onClick={() => quickPreset("thisMonth")}>Этот месяц</button>
              <button onClick={() => quickPreset("lastMonth")}>Прошлый месяц</button>
              <button onClick={() => quickPreset("ytd")}>Год-к-дате</button>
              <button onClick={() => quickPreset("thisYear")}>Весь год</button>
            </div>
            <div className="analytics-cashbox__range">
              <label className="analytics-cashbox__label">
                С
                <input
                  type="date"
                  className="analytics-cashbox__input"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </label>
              <label className="analytics-cashbox__label">
                До
                <input
                  type="date"
                  className="analytics-cashbox__input"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </label>

              <div className="analytics-cashbox__segmented">
                <button
                  className={granularity === "day" ? "is-active" : ""}
                  onClick={() => setGranularity("day")}
                >
                  Дни
                </button>
                <button
                  className={granularity === "month" ? "is-active" : ""}
                  onClick={() => setGranularity("month")}
                >
                  Месяцы
                </button>
                <button
                  className={granularity === "year" ? "is-active" : ""}
                  onClick={() => setGranularity("year")}
                >
                  Годы
                </button>
              </div>

              <div className="analytics-cashbox__select">
                <label className="analytics-cashbox__label">
                  Касса
                  <select
                    className="analytics-cashbox__input"
                    value={boxId}
                    onChange={(e) => setBoxId(e.target.value)}
                  >
                    <option value="all">Все кассы</option>
                    {boxes.map((b) => (
                      <option key={b.id || b.uuid} value={b.id || b.uuid}>
                        {b.department_name || b.name || (b.id || b.uuid)}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </div>
          </div>

          <div className="analytics-cashbox__kpis">
            <div className="analytics-cashbox__kpi">
              <div className="analytics-cashbox__kpi-label">Приход</div>
              <div className="analytics-cashbox__kpi-value">
                {nfMoney.format(cashTotals.income)}
              </div>
            </div>
            <div className="analytics-cashbox__kpi">
              <div className="analytics-cashbox__kpi-label">Расход</div>
              <div className="analytics-cashbox__kpi-value">
                {nfMoney.format(cashTotals.expense)}
              </div>
            </div>
            <div className="analytics-cashbox__kpi">
              <div className="analytics-cashbox__kpi-label">Сальдо</div>
              <div className="analytics-cashbox__kpi-value">
                {nfMoney.format(cashTotals.net)}
              </div>
            </div>
          </div>

          <div className="analytics-cashbox__grid">
            <div className="analytics-cashbox__card">
              <div className="analytics-cashbox__card-title">
                Динамика чистого потока ({granularity === "day" ? "дни" : granularity === "month" ? "месяцы" : "годы"})
              </div>
              {cashLoading ? (
                <div className="analytics-cashbox__note">Загрузка операций…</div>
              ) : cashError ? (
                <div className="analytics-cashbox__error">{cashError}</div>
              ) : (
                <>
                  <Sparkline values={cashSeries.netVals} />
                  <div className="analytics-sales__legend">
                    {cashSeries.labels.map((l, i) => (
                      <span className="analytics-sales__legend-item" key={i}>{l}</span>
                    ))}
                  </div>
                </>
              )}
            </div>

            <div className="analytics-cashbox__card">
              <div className="analytics-cashbox__card-title">Срез по кассам</div>
              <div className="analytics-sales__table-wrap">
                <table className="analytics-sales__table">
                  <thead>
                    <tr>
                      <th>Касса</th>
                      <th>Приход</th>
                      <th>Расход</th>
                      <th>Сальдо</th>
                    </tr>
                  </thead>
                  <tbody>
                    {perBox.length ? (
                      perBox.map((r) => (
                        <tr key={r.id}>
                          <td>{r.name}</td>
                          <td>{nfMoney.format(r.income)}</td>
                          <td>{nfMoney.format(r.expense)}</td>
                          <td>{nfMoney.format(r.net)}</td>
                        </tr>
                      ))
                    ) : (
                      <tr><td colSpan={4}>Нет данных</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="analytics-cashbox__card">
              <div className="analytics-cashbox__card-title">Топ-10 статей расхода</div>
              <ul className="analytics-cashbox__bars">
                {topExpenseByTitle.length ? (
                  topExpenseByTitle.map(([title, sum], i) => {
                    const max = topExpenseByTitle[0][1] || 1;
                    const width = clamp(Math.round((sum / max) * 100), 5, 100);
                    return (
                      <li className="analytics-cashbox__bar" key={i}>
                        <span className="analytics-cashbox__bar-name" title={title}>{title}</span>
                        <span className="analytics-cashbox__bar-track">
                          <span className="analytics-cashbox__bar-fill" style={{ width: `${width}%` }} />
                        </span>
                        <span className="analytics-cashbox__bar-value">{nfMoney.format(sum)}</span>
                      </li>
                    );
                  })
                ) : (
                  <li className="analytics-cashbox__empty">Нет данных</li>
                )}
              </ul>
            </div>
          </div>

          <div className="analytics-cashbox__card analytics-sales__card--scroll">
            <div className="analytics-cashbox__card-title">Последние операции</div>
            <div className="analytics-sales__table-wrap">
              <table className="analytics-sales__table">
                <thead>
                  <tr>
                    <th>Тип</th>
                    <th>Статья</th>
                    <th>Сумма</th>
                    <th>Касса</th>
                    <th>Дата</th>
                  </tr>
                </thead>
                <tbody>
                  {cashLoading ? (
                    <tr><td colSpan={5}>Загрузка…</td></tr>
                  ) : flowsFiltered.length ? (
                    flowsFiltered
                      .slice() // копия
                      .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
                      .slice(0, 50)
                      .map((f, i) => (
                        <tr key={f.id ?? i}>
                          <td>{f.type === "income" ? "Приход" : "Расход"}</td>
                          <td>{f.title}</td>
                          <td>{nfMoney.format(f.amount)}</td>
                          <td>{f.cashboxName || "—"}</td>
                          <td>{f.created_at ? new Date(f.created_at).toLocaleString() : "—"}</td>
                        </tr>
                      ))
                  ) : (
                    <tr><td colSpan={5}>Нет операций</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {(cashLoading) && <div className="analytics__loading">Обновляем операции…</div>}
        </section>
      )}

      {(productsLoading || salesLoading) && (
        <div className="analytics__loading">Обновляем данные…</div>
      )}
    </div>
  );
};

export default Analytics;
