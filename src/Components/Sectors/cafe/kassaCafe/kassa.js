// // src/components/Kassa/Kassa.jsx
// import React, { useEffect, useMemo, useState } from "react";
// import { Routes, Route, useNavigate, useParams, Link, useLocation } from "react-router-dom";
// import api from "../../../../api";
// import Reports from "../Reports/Reports";
// import "./kassa.scss";

// /* helpers */
// const asArray = (d) => (Array.isArray(d?.results) ? d.results : Array.isArray(d) ? d : []);
// const listFrom = (res) => res?.data?.results || res?.data || [];
// const money = (v) => (Number(v) || 0).toLocaleString("ru-RU", { minimumFractionDigits: 0 }) + " c";
// const when = (iso) => (iso ? new Date(iso).toLocaleDateString() : "—");
// const whenDT = (iso) => (iso ? new Date(iso).toLocaleString() : "—");
// const toNum = (x) => Number(String(x).replace(",", ".")) || 0;
// const numStr = (n) => String(Number(n) || 0).replace(",", ".");

// // НЕОПЛАЧЕН = любой, КРОМЕ paid / отменён / закрыт
// const isUnpaidStatus = (s) => {
//   const v = (s || "").toString().trim().toLowerCase();
//   return ![
//     "paid",
//     "оплачен",
//     "оплачено",
//     "canceled",
//     "cancelled",
//     "отменён",
//     "отменен",
//     "closed",
//     "done",
//     "completed",
//   ].includes(v);
// };

// /* ───────────────────────────────────────────────── */
// const CafeKassa = () => (
//   <Routes>
//     <Route index element={<CashboxList />} />
//     {/* <Route path="pay" element={<CashboxPayment />} /> */}
//     <Route path="reports" element={<CashboxReports />} />
//     <Route path=":id" element={<CashboxDetail />} />
//   </Routes>
// );

// /* Верхние вкладки */
// const HeaderTabs = () => {
//   const { pathname } = useLocation();
//   const isList = /\/kassa\/?$/.test(pathname);
//   const isReports = /\/kassa\/reports\/?$/.test(pathname);
//   const isPay = /\/kassa\/pay\/?$/.test(pathname);

//   return (
//     <div className="kassa__header">
//       <div className="kassa__tabs">
//         <Link className={`kassa__tab ${isList ? "kassa__tab--active" : ""}`} to="/crm/cafe/kassa">
//           Кассы
//         </Link>
//         {/* <Link className={`kassa__tab ${isPay ? "kassa__tab--active" : ""}`} to="/crm/cafe/kassa/pay">
//           Оплата
//         </Link> */}
//         <Link
//           className={`kassa__tab ${isReports ? "kassa__tab--active" : ""}`}
//           to="/crm/cafe/kassa/reports"
//         >
//           Отчёты
//         </Link>
//       </div>
//     </div>
//   );
// };

// // /* ──────────────────────────────── Список касс */
// // const CashboxList = () => {
// //   const [rows, setRows] = useState([]);
// //   const [q, setQ] = useState("");
// //   const [loading, setLoading] = useState(true);
// //   const [err, setErr] = useState("");
// //   const [createOpen, setCreateOpen] = useState(false);
// //   const [name, setName] = useState("");
// //   const navigate = useNavigate();

// //   const load = async () => {
// //     try {
// //       setErr("");
// //       setLoading(true);
// //       const { data } = await api.get("/construction/cashboxes/");
// //       setRows(asArray(data));
// //     } catch (e) {
// //       console.error(e);
// //       setErr("Не удалось загрузить кассы");
// //     } finally {
// //       setLoading(false);
// //     }
// //   };

// //   useEffect(() => {
// //     load();
// //   }, []);

// //   const filtered = useMemo(() => {
// //     const t = q.trim().toLowerCase();
// //     if (!t) return rows;
// //     return rows.filter((r) =>
// //       [r.department_name, r.name].some((x) => String(x || "").toLowerCase().includes(t))
// //     );
// //   }, [rows, q]);

// //   const onCreate = async () => {
// //     const title = (name || "").trim();
// //     if (!title) return alert("Введите название кассы");
// //     try {
// //       await api.post("/construction/cashboxes/", { name: title });
// //       setCreateOpen(false);
// //       setName("");
// //       load();
// //     } catch (e) {
// //       console.error(e);
// //       alert("Не удалось создать кассу");
// //     }
// //   };

// //   return (
// //     <div className="kassa">
// //       <HeaderTabs />

// //       <div className="kassa__toolbar">
// //         <div className="kassa__toolbarGroup">
// //           <span className="kassa__total">Всего: {filtered.length}</span>
// //         </div>

// //         <div className="kassa__controls">
// //           <div className="kassa__searchWrap">
// //             <input
// //               className="kassa__input"
// //               type="text"
// //               placeholder="Поиск…"
// //               value={q}
// //               onChange={(e) => setQ(e.target.value)}
// //             />
// //           </div>
// //           <button className="kassa__btn kassa__btn--primary" onClick={() => setCreateOpen(true)} type="button">
// //             Создать кассу
// //           </button>
// //         </div>
// //       </div>

// //       {err && <div className="kassa__alert kassa__alert--error">{err}</div>}

// //       <div className="kassa__tableWrap">
// //         <table className="kassa__table">
// //           <thead>
// //             <tr>
// //               <th>Касса</th>
// //               <th>Приход</th>
// //               <th>Расход</th>
// //               <th>Действия</th>
// //             </tr>
// //           </thead>
// //           <tbody>
// //             {loading ? (
// //               <tr>
// //                 <td colSpan={4}>Загрузка…</td>
// //               </tr>
// //             ) : filtered.length ? (
// //               filtered.map((r) => (
// //                 <tr
// //                   key={r.id || r.uuid}
// //                   className="kassa__rowClickable"
// //                   onClick={() => navigate(`/crm/cafe/kassa/${r.id || r.uuid}`)}
// //                 >
// //                   <td>
// //                     <b>{r.department_name || r.name || "—"}</b>
// //                   </td>
// //                   <td>{money(r.analytics?.income?.total || 0)}</td>
// //                   <td>{money(r.analytics?.expense?.total || 0)}</td>
// //                   <td>
// //                     <button
// //                       className="kassa__btn kassa__btn--secondary"
// //                       onClick={(e) => {
// //                         e.stopPropagation();
// //                         navigate(`/crm/cafe/kassa/${r.id || r.uuid}`);
// //                       }}
// //                       type="button"
// //                     >
// //                       Открыть
// //                     </button>
// //                   </td>
// //                 </tr>
// //               ))
// //             ) : (
// //               <tr>
// //                 <td colSpan={4} className="kassa__center">
// //                   Нет данных
// //                 </td>
// //               </tr>
// //             )}
// //           </tbody>
// //         </table>
// //       </div>

// //       {createOpen && (
// //         <div className="kassa-modal">
// //           <div className="kassa-modal__overlay" onClick={() => setCreateOpen(false)} />
// //           <div className="kassa-modal__card" onClick={(e) => e.stopPropagation()}>
// //             <div className="kassa-modal__header">
// //               <h3 className="kassa-modal__title">Создать кассу</h3>
// //               <button
// //                 className="kassa-modal__close"
// //                 onClick={() => setCreateOpen(false)}
// //                 aria-label="Закрыть"
// //                 type="button"
// //               >
// //                 ×
// //               </button>
// //             </div>
// //             <div className="kassa-modal__section">
// //               <label className="kassa-modal__label">Название кассы *</label>
// //               <input
// //                 className="kassa-modal__input"
// //                 type="text"
// //                 placeholder="Например: касса №1"
// //                 value={name}
// //                 onChange={(e) => setName(e.target.value)}
// //                 required
// //               />
// //             </div>
// //             <div className="kassa-modal__footer">
// //               <button className="kassa__btn kassa__btn--primary" onClick={onCreate} type="button">
// //                 Сохранить
// //               </button>
// //             </div>
// //           </div>
// //         </div>
// //       )}
// //     </div>
// //   );
// // };

// /* ──────────────────────────────── Список касс */
// const CashboxList = () => {
//   const [rows, setRows] = useState([]);
//   const [totals, setTotals] = useState({}); // { [boxKey]: { income: number, expense: number } }

//   const [q, setQ] = useState("");
//   const [loading, setLoading] = useState(true);
//   const [err, setErr] = useState("");
//   const [createOpen, setCreateOpen] = useState(false);
//   const [name, setName] = useState("");
//   const navigate = useNavigate();

//   const boxKey = (r) => String(r?.id || r?.uuid || "");
//   const flowAmount = (x) => {
//     const amt = Number(x?.amount ?? x?.sum ?? x?.value ?? x?.total ?? 0) || 0;
//     return amt;
//   };
//   const flowType = (x) => {
//     const t = String(x?.type ?? x?.kind ?? x?.direction ?? "").toLowerCase().trim();
//     if (t === "income" || t === "expense") return t;
//     // fallback по знаку, если тип не пришёл
//     const amt = flowAmount(x);
//     return amt >= 0 ? "income" : "expense";
//   };

//   const fetchBoxTotals = async (cashboxId) => {
//     try {
//       const r = await api.get("/construction/cashflows/", { params: { cashbox: cashboxId } });
//       const flows = asArray(r?.data) || [];
//       let income = 0;
//       let expense = 0;

//       for (const f of flows) {
//         const t = flowType(f);
//         const amt = Math.abs(flowAmount(f));
//         if (t === "income") income += amt;
//         else expense += amt;
//       }

//       return { income, expense };
//     } catch (e) {
//       // если эндпоинт недоступен — просто вернём нули
//       return { income: 0, expense: 0 };
//     }
//   };

//   const load = async () => {
//     try {
//       setErr("");
//       setLoading(true);

//       const { data } = await api.get("/construction/cashboxes/");
//       const list = asArray(data);

//       setRows(list);

//       // считаем итоги по каждой кассе (параллельно)
//       const pairs = await Promise.all(
//         list.map(async (r) => {
//           const key = boxKey(r);
//           if (!key) return [key, { income: 0, expense: 0 }];

//           // если вдруг analytics есть — используем его (быстро),
//           // иначе считаем по cashflows
//           const aIncome = Number(r?.analytics?.income?.total);
//           const aExpense = Number(r?.analytics?.expense?.total);
//           const hasAnalytics =
//             Number.isFinite(aIncome) || Number.isFinite(aExpense);

//           if (hasAnalytics) {
//             return [
//               key,
//               {
//                 income: Number.isFinite(aIncome) ? aIncome : 0,
//                 expense: Number.isFinite(aExpense) ? aExpense : 0,
//               },
//             ];
//           }

//           const t = await fetchBoxTotals(key);
//           return [key, t];
//         })
//       );

//       const map = {};
//       for (const [k, v] of pairs) {
//         if (!k) continue;
//         map[k] = v;
//       }
//       setTotals(map);
//     } catch (e) {
//       console.error(e);
//       setErr("Не удалось загрузить кассы");
//       setRows([]);
//       setTotals({});
//     } finally {
//       setLoading(false);
//     }
//   };

//   useEffect(() => {
//     load();
//   }, []);

//   const filtered = useMemo(() => {
//     const t = q.trim().toLowerCase();
//     if (!t) return rows;
//     return rows.filter((r) =>
//       [r.department_name, r.name].some((x) =>
//         String(x || "").toLowerCase().includes(t)
//       )
//     );
//   }, [rows, q]);

//   // общий приход/расход по фильтру
//   const summary = useMemo(() => {
//     let income = 0;
//     let expense = 0;
//     for (const r of filtered) {
//       const key = boxKey(r);
//       const t = totals[key] || { income: 0, expense: 0 };
//       income += Number(t.income) || 0;
//       expense += Number(t.expense) || 0;
//     }
//     return { income, expense };
//   }, [filtered, totals]);

//   const onCreate = async () => {
//     const title = (name || "").trim();
//     if (!title) return alert("Введите название кассы");
//     try {
//       await api.post("/construction/cashboxes/", { name: title });
//       setCreateOpen(false);
//       setName("");
//       load();
//     } catch (e) {
//       console.error(e);
//       alert("Не удалось создать кассу");
//     }
//   };

//   return (
//     <div className="kassa">
//       <HeaderTabs />

//       <div className="kassa__toolbar">
//         <div className="kassa__toolbarGroup">
//           <span className="kassa__total">Всего: {filtered.length}</span>
//           <span className="kassa__total" style={{ marginLeft: 14 }}>
//             Приход: <b>{money(summary.income)}</b>
//           </span>
//           <span className="kassa__total" style={{ marginLeft: 10 }}>
//             Расход: <b>{money(summary.expense)}</b>
//           </span>
//         </div>

//         <div className="kassa__controls">
//           <div className="kassa__searchWrap">
//             <input
//               className="kassa__input"
//               type="text"
//               placeholder="Поиск…"
//               value={q}
//               onChange={(e) => setQ(e.target.value)}
//             />
//           </div>
//           <button
//             className="kassa__btn kassa__btn--primary"
//             onClick={() => setCreateOpen(true)}
//             type="button"
//           >
//             Создать кассу
//           </button>
//         </div>
//       </div>

//       {err && <div className="kassa__alert kassa__alert--error">{err}</div>}

//       <div className="kassa__tableWrap">
//         <table className="kassa__table">
//           <thead>
//             <tr>
//               <th>Касса</th>
//               <th>Приход</th>
//               <th>Расход</th>
//               <th>Действия</th>
//             </tr>
//           </thead>
//           <tbody>
//             {loading ? (
//               <tr>
//                 <td colSpan={4}>Загрузка…</td>
//               </tr>
//             ) : filtered.length ? (
//               filtered.map((r) => {
//                 const key = boxKey(r);
//                 const t = totals[key] || { income: 0, expense: 0 };

//                 return (
//                   <tr
//                     key={key}
//                     className="kassa__rowClickable"
//                     onClick={() => navigate(`/crm/cafe/kassa/${key}`)}
//                   >
//                     <td>
//                       <b>{r.department_name || r.name || "—"}</b>
//                     </td>
//                     <td>{money(t.income)}</td>
//                     <td>{money(t.expense)}</td>
//                     <td>
//                       <button
//                         className="kassa__btn kassa__btn--secondary"
//                         onClick={(e) => {
//                           e.stopPropagation();
//                           navigate(`/crm/cafe/kassa/${key}`);
//                         }}
//                         type="button"
//                       >
//                         Открыть
//                       </button>
//                     </td>
//                   </tr>
//                 );
//               })
//             ) : (
//               <tr>
//                 <td colSpan={4} className="kassa__center">
//                   Нет данных
//                 </td>
//               </tr>
//             )}
//           </tbody>
//         </table>
//       </div>

//       {createOpen && (
//         <div className="kassa-modal">
//           <div className="kassa-modal__overlay" onClick={() => setCreateOpen(false)} />
//           <div className="kassa-modal__card" onClick={(e) => e.stopPropagation()}>
//             <div className="kassa-modal__header">
//               <h3 className="kassa-modal__title">Создать кассу</h3>
//               <button
//                 className="kassa-modal__close"
//                 onClick={() => setCreateOpen(false)}
//                 aria-label="Закрыть"
//                 type="button"
//               >
//                 ×
//               </button>
//             </div>
//             <div className="kassa-modal__section">
//               <label className="kassa-modal__label">Название кассы *</label>
//               <input
//                 className="kassa-modal__input"
//                 type="text"
//                 placeholder="Например: касса №1"
//                 value={name}
//                 onChange={(e) => setName(e.target.value)}
//                 required
//               />
//             </div>
//             <div className="kassa-modal__footer">
//               <button className="kassa__btn kassa__btn--primary" onClick={onCreate} type="button">
//                 Сохранить
//               </button>
//             </div>
//           </div>
//         </div>
//       )}
//     </div>
//   );
// };


// // /* ──────────────────────────────── Вкладка ОПЛАТА */
// // const CashboxPayment = () => {
// //   const [tables, setTables] = useState([]);
// //   const [zones, setZones] = useState([]);
// //   const [ordersUnpaid, setOrdersUnpaid] = useState([]);
// //   const [boxes, setBoxes] = useState([]);
// //   const [boxId, setBoxId] = useState("");
// //   const [loading, setLoading] = useState(true);
// //   const [payingId, setPayingId] = useState("");

// //   // чек-модалка перед оплатой (вместо window.confirm)
// //   const [receiptOpen, setReceiptOpen] = useState(false);
// //   const [receiptGrp, setReceiptGrp] = useState(null);

// //   const hydrateOrdersDetails = async (list) => {
// //     const needIds = list
// //       .filter((o) => !Array.isArray(o.items) || o.items.length === 0)
// //       .map((o) => o.id);
// //     if (!needIds.length) return list;
// //     const details = await Promise.all(
// //       needIds.map((id) =>
// //         api
// //           .get(`/cafe/orders/${id}/`)
// //           .then((r) => ({ id, data: r.data }))
// //           .catch(() => null)
// //       )
// //     );
// //     return list.map((o) => {
// //       const d = details.find((x) => x && x.id === o.id)?.data;
// //       return d ? { ...o, ...d } : o;
// //     });
// //   };

// //   const loadAll = async () => {
// //     setLoading(true);
// //     try {
// //       const [tRes, zRes, oRes, bRes] = await Promise.all([
// //         api.get("/cafe/tables/"),
// //         api.get("/cafe/zones/"),
// //         api.get("/cafe/orders/"),
// //         api.get("/construction/cashboxes/").catch(() => ({ data: [] })),
// //       ]);

// //       const tablesArr = listFrom(tRes) || [];
// //       const zonesArr = listFrom(zRes) || [];
// //       setTables(tablesArr);
// //       setZones(zonesArr);

// //       const allOrders = listFrom(oRes) || [];
// //       const unpaid = allOrders.filter((o) => o.table && isUnpaidStatus(o.status));
// //       const full = await hydrateOrdersDetails(unpaid);
// //       setOrdersUnpaid(full);

// //       const allBoxes = listFrom(bRes) || [];
// //       const boxesArr = asArray(allBoxes);
// //       setBoxes(boxesArr);
// //       setBoxId(boxesArr[0]?.id || boxesArr[0]?.uuid || "");
// //     } finally {
// //       setLoading(false);
// //     }
// //   };

// //   useEffect(() => {
// //     loadAll();
// //   }, []);

// //   const tablesMap = useMemo(() => new Map(tables.map((t) => [t.id, t])), [tables]);
// //   const zonesMap = useMemo(() => new Map(zones.map((z) => [z.id, z.title])), [zones]);

// //   const zoneTitleByAny = (zoneField) => {
// //     if (!zoneField) return "—";
// //     if (typeof zoneField === "string") return zonesMap.get(zoneField) || zoneField;
// //     return zoneField.title || zonesMap.get(zoneField.id) || "—";
// //   };

// //   const orderSum = (o) => {
// //     const totalField = Number(o.total ?? o.total_amount ?? o.sum ?? o.amount);
// //     if (Number.isFinite(totalField) && totalField > 0) return totalField;

// //     const items = Array.isArray(o.items) ? o.items : [];
// //     const linePrice = (it) => {
// //       if (it?.menu_item_price != null) return toNum(it.menu_item_price);
// //       if (it?.price != null) return toNum(it.price);
// //       return 0;
// //     };
// //     return items.reduce((s, it) => s + linePrice(it) * (Number(it.quantity) || 0), 0);
// //   };

// //   const linePrice = (it) => {
// //     if (it?.menu_item_price != null) return toNum(it.menu_item_price);
// //     if (it?.price != null) return toNum(it.price);
// //     return 0;
// //   };

// //   const groups = useMemo(() => {
// //     const byTable = new Map();
// //     for (const o of ordersUnpaid) {
// //       const sum = orderSum(o);
// //       const acc = byTable.get(o.table) || { total: 0, orders: [] };
// //       acc.total += sum;
// //       acc.orders.push(o);
// //       byTable.set(o.table, acc);
// //     }
// //     return [...byTable.entries()].map(([tableId, v]) => ({
// //       table: tablesMap.get(tableId),
// //       tableId,
// //       total: v.total,
// //       orders: v.orders,
// //     }));
// //   }, [ordersUnpaid, tablesMap]);

// //   const markOrderPaid = async (id) => {
// //     try {
// //       await api.post(`/cafe/orders/${id}/pay/`);
// //       return true;
// //     } catch {}
// //     try {
// //       await api.patch(`/cafe/orders/${id}/`, { status: "paid" });
// //       return true;
// //     } catch {}
// //     try {
// //       await api.patch(`/cafe/orders/${id}/`, { status: "оплачен" });
// //       return true;
// //     } catch {}
// //     try {
// //       await api.put(`/cafe/orders/${id}/`, { status: "paid" });
// //       return true;
// //     } catch {}
// //     return false;
// //   };

// //   const openReceipt = (grp) => {
// //     // вместо confirm — открываем чек
// //     if (!boxId) {
// //       alert("Создайте кассу в разделе «Кассы», чтобы принимать оплату.");
// //       return;
// //     }
// //     setReceiptGrp(grp);
// //     setReceiptOpen(true);
// //   };

// //   const closeReceipt = () => {
// //     if (payingId) return;
// //     setReceiptOpen(false);
// //     setReceiptGrp(null);
// //   };

// //   const confirmPayTable = async () => {
// //     const grp = receiptGrp;
// //     if (!grp) return;

// //     const t = grp.table;
// //     setPayingId(grp.tableId);

// //     try {
// //       // приход в кассу
// //       await api.post("/construction/cashflows/", {
// //         cashbox: boxId,
// //         type: "income",
// //         name: `Оплата стол ${t?.number ?? ""}`,
// //         amount: numStr(grp.total),
// //       });

// //       // отметить заказы paid
// //       const okIds = [];
// //       await Promise.all(
// //         grp.orders.map(async (o) => {
// //           if (await markOrderPaid(o.id)) okIds.push(o.id);
// //         })
// //       );

// //       // удалить оплаченные заказы (как у тебя было)
// //       await Promise.all(
// //         okIds.map(async (id) => {
// //           try {
// //             await api.delete(`/cafe/orders/${id}/`);
// //           } catch {}
// //         })
// //       );

// //       setOrdersUnpaid((prev) => prev.filter((o) => !okIds.includes(o.id)));

// //       // освободить стол
// //       if (grp.tableId) {
// //         try {
// //           await api.patch(`/cafe/tables/${grp.tableId}/`, { status: "free" });
// //         } catch {
// //           try {
// //             await api.put(`/cafe/tables/${grp.tableId}/`, {
// //               number: grp.table?.number,
// //               zone: grp.table?.zone?.id || grp.table?.zone,
// //               places: grp.table?.places,
// //               status: "free",
// //             });
// //           } catch {}
// //         }
// //       }

// //       try {
// //         window.dispatchEvent(
// //           new CustomEvent("orders:refresh", { detail: { tableId: grp.tableId, orderIds: okIds } })
// //         );
// //       } catch {}

// //       setReceiptOpen(false);
// //       setReceiptGrp(null);

// //       await loadAll();
// //     } catch (e) {
// //       console.error(e);
// //       alert("Не удалось провести оплату.");
// //     } finally {
// //       setPayingId("");
// //     }
// //   };

// //   const boxLabel = useMemo(() => {
// //     const b = boxes.find((x) => String(x.id || x.uuid) === String(boxId));
// //     return b?.department_name || b?.name || "—";
// //   }, [boxes, boxId]);

// //   return (
// //     <div className="kassa">
// //       <HeaderTabs />

// //       <div className="kassa__toolbar">
// //         <div className="kassa__toolbarGroup">
// //           <span className="kassa__total">К оплате столов: {groups.length}</span>
// //         </div>
// //         <div className="kassa__controls">
// //           <select
// //             className="kassa__input"
// //             value={boxId}
// //             onChange={(e) => setBoxId(e.target.value)}
// //             title="Касса для приёма оплаты"
// //           >
// //             {boxes.map((b) => (
// //               <option key={b.id || b.uuid} value={b.id || b.uuid}>
// //                 {b.department_name || b.name || "Касса"}
// //               </option>
// //             ))}
// //           </select>
// //         </div>
// //       </div>

// //       <div className="kassa__tableWrap">
// //         <table className="kassa__table">
// //           <thead>
// //             <tr>
// //               <th>Стол</th>
// //               <th>Зона</th>
// //               <th>Сумма к оплате</th>
// //               <th>Заказы</th>
// //               <th>Действие</th>
// //             </tr>
// //           </thead>
// //           <tbody>
// //             {loading ? (
// //               <tr>
// //                 <td colSpan={5}>Загрузка…</td>
// //               </tr>
// //             ) : groups.length ? (
// //               groups.map((g) => (
// //                 <tr key={g.tableId} className="kassa__rowPay">
// //                   <td>
// //                     <b>{g.table ? `Стол ${g.table.number}` : "—"}</b>
// //                   </td>
// //                   <td>{g.table ? zoneTitleByAny(g.table.zone) : "—"}</td>
// //                   <td>{money(g.total)}</td>
// //                   <td>{g.orders.length}</td>
// //                   <td>
// //                     <button
// //                       className="kassa__btn kassa__btn--primary"
// //                       onClick={() => openReceipt(g)}
// //                       disabled={payingId === g.tableId}
// //                       type="button"
// //                     >
// //                       {payingId === g.tableId ? "Оплата…" : "Оплатить"}
// //                     </button>
// //                   </td>
// //                 </tr>
// //               ))
// //             ) : (
// //               <tr>
// //                 <td colSpan={5} className="kassa__center">
// //                   Нет столов, ожидающих оплаты
// //                 </td>
// //               </tr>
// //             )}
// //           </tbody>
// //         </table>
// //       </div>

// //       {/* ЧЕК ПЕРЕД ОПЛАТОЙ (без window.confirm) */}
// //       {receiptOpen && receiptGrp && (
// //         <div className="kassa-modal" onClick={closeReceipt}>
// //           <div className="kassa-modal__overlay" />
// //           <div className="kassa-modal__card" onClick={(e) => e.stopPropagation()}>
// //             <div className="kassa-modal__header">
// //               <h3 className="kassa-modal__title">Чек перед оплатой</h3>
// //               <button className="kassa-modal__close" onClick={closeReceipt} aria-label="Закрыть" type="button">
// //                 ×
// //               </button>
// //             </div>

// //             <div
// //               className="kassa-modal__section"
// //               style={{
// //                 display: "grid",
// //                 gap: 12,
// //                 maxHeight: "65vh",
// //                 overflow: "auto",
// //               }}
// //             >
// //               <div
// //                 style={{
// //                   border: "1px solid var(--border)",
// //                   borderRadius: 12,
// //                   padding: 12,
// //                   background: "#fff",
// //                   display: "grid",
// //                   gap: 8,
// //                 }}
// //               >
// //                 <div style={{ fontWeight: 800 }}>
// //                   {receiptGrp.table ? `Стол ${receiptGrp.table.number}` : "Стол —"}
// //                 </div>
// //                 <Row label="Зона" value={receiptGrp.table ? zoneTitleByAny(receiptGrp.table.zone) : "—"} />
// //                 <Row label="Касса" value={boxLabel} />
// //                 <Row label="Заказов" value={String(receiptGrp.orders.length)} />
// //                 <Row label="Итого" value={money(receiptGrp.total)} />
// //               </div>

// //               {receiptGrp.orders.map((o) => {
// //                 const items = Array.isArray(o.items) ? o.items : [];
// //                 const oTotal = orderSum(o);

// //                 return (
// //                   <div
// //                     key={o.id}
// //                     style={{
// //                       border: "1px solid var(--border)",
// //                       borderRadius: 12,
// //                       padding: 12,
// //                       background: "#fff",
// //                       display: "grid",
// //                       gap: 10,
// //                     }}
// //                   >
// //                     <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
// //                       <div style={{ fontWeight: 800 }}>Заказ</div>
// //                       <div style={{ opacity: 0.8 }}>{whenDT(o.created_at || o.created || o.date)}</div>
// //                     </div>

// //                     {items.length ? (
// //                       <div style={{ display: "grid", gap: 6 }}>
// //                         {items.map((it, idx) => {
// //                           const title = it.menu_item_title || it.title || "Позиция";
// //                           const qty = Number(it.quantity) || 0;
// //                           const price = linePrice(it);
// //                           const sum = price * qty;

// //                           return (
// //                             <div
// //                               key={it.id || it.menu_item || idx}
// //                               style={{
// //                                 display: "grid",
// //                                 gridTemplateColumns: "1fr auto auto",
// //                                 gap: 10,
// //                                 alignItems: "center",
// //                                 borderBottom: "1px dashed var(--border)",
// //                                 paddingBottom: 6,
// //                               }}
// //                             >
// //                               <div style={{ fontWeight: 600 }}>{title}</div>
// //                               <div style={{ opacity: 0.85 }}>x{qty}</div>
// //                               <div style={{ fontWeight: 800 }}>{money(sum)}</div>
// //                             </div>
// //                           );
// //                         })}
// //                       </div>
// //                     ) : (
// //                       <div style={{ opacity: 0.8 }}>Нет позиций</div>
// //                     )}

// //                     <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
// //                       <div style={{ fontWeight: 700 }}>Итого по заказу</div>
// //                       <div style={{ fontWeight: 900 }}>{money(oTotal)}</div>
// //                     </div>
// //                   </div>
// //                 );
// //               })}
// //             </div>

// //             <div className="kassa-modal__footer" style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
// //               <button className="kassa__btn" onClick={closeReceipt} disabled={!!payingId} type="button">
// //                 Отмена
// //               </button>
// //               <button
// //                 className="kassa__btn kassa__btn--primary"
// //                 onClick={confirmPayTable}
// //                 disabled={!!payingId}
// //                 type="button"
// //                 title={payingId ? "Оплата…" : "Подтвердить оплату"}
// //               >
// //                 {payingId ? "Оплата…" : "Оплатить"}
// //               </button>
// //             </div>
// //           </div>
// //         </div>
// //       )}
// //     </div>
// //   );
// // };

// /* ──────────────────────────────── Обёртка с отчётом */
// const CashboxReports = () => (
//   <div className="kassa">
//     <HeaderTabs />
//     <Reports />
//   </div>
// );

// /* ──────────────────────────────── Детали кассы + фильтр дат + модалка */
// const CashboxDetail = () => {
//   const { id } = useParams();
//   const [box, setBox] = useState(null);
//   const [ops, setOps] = useState([]);
//   const [tab, setTab] = useState("all");
//   const [loading, setLoading] = useState(true);
//   const [err, setErr] = useState("");

//   const [dateFrom, setDateFrom] = useState("");
//   const [dateTo, setDateTo] = useState("");

//   const [openOp, setOpenOp] = useState(null);
//   const [opLoading, setOpLoading] = useState(false);
//   const [opDetail, setOpDetail] = useState(null);

//   const fromAny = (res) => {
//     const d = res?.data ?? res ?? [];
//     if (Array.isArray(d?.results)) return d.results;
//     if (Array.isArray(d)) return d;
//     return [];
//   };

//   const load = async () => {
//     setErr("");
//     setLoading(true);
//     try {
//       let detail = null;
//       try {
//         detail = (await api.get(`/construction/cashboxes/${id}/detail/owner/`)).data;
//       } catch {}
//       if (!detail) {
//         try {
//           detail = (await api.get(`/construction/cashboxes/${id}/detail/`)).data;
//         } catch {}
//       }
//       if (!detail) {
//         detail = (await api.get(`/construction/cashboxes/${id}/`)).data;
//       }

//       setBox(detail);

//       let flows =
//         fromAny({ data: detail?.operations }) ||
//         fromAny({ data: detail?.flows }) ||
//         fromAny({ data: detail?.transactions });

//       if (!flows.length) {
//         try {
//           const r1 = await api.get(`/construction/cashflows/`, { params: { cashbox: id } });
//           flows = fromAny(r1);
//         } catch {}
//       }
//       if (!flows.length && detail?.uuid) {
//         try {
//           const r2 = await api.get(`/construction/cashflows/`, { params: { cashbox: detail.uuid } });
//           flows = fromAny(r2);
//         } catch {}
//       }

//       const mapped = (flows || []).map((x, i) => {
//         const amt = Number(x.amount ?? x.sum ?? x.value ?? x.total ?? 0) || 0;
//         let type = String(x.type ?? x.kind ?? x.direction ?? "").toLowerCase();
//         if (type !== "income" && type !== "expense") type = amt >= 0 ? "income" : "expense";
//         return {
//           id: x.id || x.uuid || `${i}`,
//           type,
//           title:
//             x.title ||
//             x.name ||
//             x.description ||
//             x.note ||
//             (type === "income" ? "Приход" : "Расход"),
//           amount: Math.abs(amt),
//           created_at: x.created_at || x.created || x.date || x.timestamp || x.createdAt || null,
//           raw: x,
//         };
//       });

//       setOps(mapped);
//     } catch (e) {
//       console.error(e);
//       setErr("Не удалось загрузить детали кассы");
//     } finally {
//       setLoading(false);
//     }
//   };

//   useEffect(() => {
//     load();
//   }, [id]);

//   const inDateRange = (iso) => {
//     if (!iso) return true;
//     const d = new Date(iso);
//     if (dateFrom) {
//       const f = new Date(dateFrom + "T00:00:00");
//       if (d < f) return false;
//     }
//     if (dateTo) {
//       const t = new Date(dateTo + "T23:59:59.999");
//       if (d > t) return false;
//     }
//     return true;
//   };

//   const shown = useMemo(() => {
//     let arr = ops;
//     if (tab === "income") arr = arr.filter((o) => o.type === "income");
//     if (tab === "expense") arr = arr.filter((o) => o.type === "expense");
//     if (dateFrom || dateTo) arr = arr.filter((o) => inDateRange(o.created_at));
//     return arr;
//   }, [ops, tab, dateFrom, dateTo]);

//   const openDetails = async (op) => {
//     setOpenOp(op);
//     setOpLoading(true);
//     setOpDetail(null);

//     try {
//       const raw = op.raw || {};
//       const orderId =
//         raw.order ||
//         raw.order_id ||
//         raw.orderId ||
//         (typeof raw.source_id === "number" && (raw.source_type === "order" || raw.source === "order")
//           ? raw.source_id
//           : null) ||
//         null;

//       let order = null;
//       if (orderId) {
//         try {
//           order = (await api.get(`/cafe/orders/${orderId}/`)).data;
//         } catch {}
//       }

//       const clientId = order?.client || raw.client || raw.client_id || raw.clientId || null;
//       let client = null;
//       if (clientId) {
//         try {
//           client = (await api.get(`/cafe/clients/${clientId}/`)).data;
//         } catch {}
//       }
//       const clientName = client?.name || client?.full_name || order?.client_name || raw.client_name || null;
//       const clientPhone = client?.phone || order?.client_phone || raw.client_phone || null;

//       let tableLabel = null;
//       let zoneTitle = null;
//       const tableId = order?.table || raw.table || raw.table_id || null;
//       if (tableId) {
//         try {
//           const t = (await api.get(`/cafe/tables/${tableId}/`)).data;
//           if (t) {
//             tableLabel = t.number != null ? `Стол ${t.number}` : "Стол";
//             const z = t.zone;
//             if (z && typeof z === "object" && z.title) zoneTitle = z.title;
//             else if (z) {
//               try {
//                 const zres = (await api.get(`/cafe/zones/${z}/`)).data;
//                 zoneTitle = zres?.title || null;
//               } catch {}
//             }
//           }
//         } catch {}
//       }

//       const category = raw.category_name || raw.category || null;
//       const method = raw.method || raw.payment_method || raw.payment_type || null;
//       const userName = raw.user_name || raw.created_by_name || raw.owner_name || null;
//       const comment = raw.note || raw.description || raw.comment || null;

//       setOpDetail({
//         orderId: order?.id || orderId || null,
//         clientName,
//         clientPhone,
//         tableLabel,
//         zoneTitle,
//         category,
//         method,
//         userName,
//         comment,
//       });
//     } catch {
//       setOpDetail(null);
//     } finally {
//       setOpLoading(false);
//     }
//   };

//   const closeDetails = () => {
//     setOpenOp(null);
//     setOpDetail(null);
//     setOpLoading(false);
//   };

//   return (
//     <div className="kassa">
//       <div className="kassa__header">
//         <div className="kassa__tabs">
//           <Link className="kassa__tab" to="/crm/cafe/kassa">
//             ← Назад
//           </Link>
//           <span className="kassa__tab kassa__tab--active">{box?.department_name || box?.name || "Касса"}</span>
//           {/* <Link className="kassa__tab" to="/crm/cafe/kassa/pay">
//             Оплата
//           </Link> */}
//           <Link className="kassa__tab" to="/crm/cafe/kassa/reports">
//             Отчёты
//           </Link>
//         </div>
//       </div>

//       <div className="kassa__switch" style={{ gap: 8, flexWrap: "wrap" }}>
//         <button className={`kassa__chip ${tab === "expense" ? "kassa__chip--active" : ""}`} onClick={() => setTab("expense")} type="button">
//           Расход
//         </button>
//         <button className={`kassa__chip ${tab === "income" ? "kassa__chip--active" : ""}`} onClick={() => setTab("income")} type="button">
//           Приход
//         </button>
//         <button className={`kassa__chip ${tab === "all" ? "kassa__chip--active" : ""}`} onClick={() => setTab("all")} type="button">
//           Все
//         </button>

//         <div className="kassa__grow" />

//         <div className="kassa__field" style={{ minWidth: 140 }}>
//           <label className="kassa__label" style={{ display: "block", fontSize: 12, opacity: 0.8 }}>
//             С
//           </label>
//           <input className="kassa__input" type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
//         </div>
//         <div className="kassa__field" style={{ minWidth: 140 }}>
//           <label className="kassa__label" style={{ display: "block", fontSize: 12, opacity: 0.8 }}>
//             По
//           </label>
//           <input className="kassa__input" type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
//         </div>
//         {(dateFrom || dateTo) && (
//           <button
//             className="kassa__btn"
//             onClick={() => {
//               setDateFrom("");
//               setDateTo("");
//             }}
//             type="button"
//           >
//             Сбросить
//           </button>
//         )}

//         <button
//           className="kassa__btn kassa__btn--primary"
//           onClick={() => alert("Добавление операции делается через API. Здесь доступен только просмотр.")}
//           type="button"
//         >
//           Добавить операцию
//         </button>
//       </div>

//       <div className="kassa__tableWrap">
//         <table className="kassa__table">
//           <thead>
//             <tr>
//               <th>Тип</th>
//               <th>Наименование</th>
//               <th>Сумма</th>
//               <th>Дата создания</th>
//             </tr>
//           </thead>
//           <tbody>
//             {loading ? (
//               <tr>
//                 <td colSpan={4}>Загрузка…</td>
//               </tr>
//             ) : err ? (
//               <tr>
//                 <td colSpan={4} className="kassa__alert kassa__alert--error">
//                   {err}
//                 </td>
//               </tr>
//             ) : shown.length ? (
//               shown.map((o) => (
//                 <tr key={o.id} className="kassa__rowClickable" onClick={() => openDetails(o)}>
//                   <td>{o.type === "income" ? "Приход" : "Расход"}</td>
//                   <td>{o.title}</td>
//                   <td>{money(o.amount)}</td>
//                   <td>{when(o.created_at)}</td>
//                 </tr>
//               ))
//             ) : (
//               <tr>
//                 <td colSpan={4}>Нет операций</td>
//               </tr>
//             )}
//           </tbody>
//         </table>
//       </div>

//       {openOp && (
//         <div className="kassa-modal" onClick={closeDetails}>
//           <div className="kassa-modal__overlay" />
//           <div className="kassa-modal__card" onClick={(e) => e.stopPropagation()}>
//             <div className="kassa-modal__header">
//               <h3 className="kassa-modal__title" style={{ display: "flex", alignItems: "center", gap: 10 }}>
//                 <span
//                   style={{
//                     padding: "4px 10px",
//                     borderRadius: 999,
//                     fontSize: 12,
//                     fontWeight: 700,
//                     background: openOp.type === "income" ? "#ecfdf5" : "#fef2f2",
//                     border: `1px solid ${openOp.type === "income" ? "#a7f3d0" : "#fecaca"}`,
//                     color: openOp.type === "income" ? "#065f46" : "#7f1d1d",
//                   }}
//                 >
//                   {openOp.type === "income" ? "ПРИХОД" : "РАСХОД"}
//                 </span>
//                 <span style={{ fontWeight: 800 }}>{money(openOp.amount)}</span>
//               </h3>
//               <button className="kassa-modal__close" onClick={closeDetails} aria-label="Закрыть" type="button">
//                 ×
//               </button>
//             </div>

//             <div className="kassa-modal__section" style={{ display: "grid", gap: 12 }}>
//               <div
//                 style={{
//                   border: "1px solid var(--border)",
//                   borderRadius: 12,
//                   padding: 12,
//                   background: "#fff",
//                   display: "grid",
//                   gap: 8,
//                 }}
//               >
//                 <div style={{ fontWeight: 700, marginBottom: 2 }}>Общее</div>
//                 <Row label="Наименование" value={openOp.title || "—"} />
//                 <Row label="Дата/время" value={whenDT(openOp.created_at)} />
//                 <Row label="Касса" value={box?.department_name || box?.name || "—"} />
//                 {opDetail?.category && <Row label="Категория" value={opDetail.category} />}
//                 {opDetail?.method && <Row label="Способ оплаты" value={opDetail.method} />}
//                 {opDetail?.userName && <Row label="Кассир" value={opDetail.userName} />}
//               </div>

//               {(opDetail?.orderId || opDetail?.tableLabel || opDetail?.zoneTitle) && (
//                 <div
//                   style={{
//                     border: "1px solid var(--border)",
//                     borderRadius: 12,
//                     padding: 12,
//                     background: "#fff",
//                     display: "grid",
//                     gap: 8,
//                   }}
//                 >
//                   <div style={{ fontWeight: 700, marginBottom: 2 }}>Источник</div>
//                   {opDetail.orderId && <Row label="Заказ" value={`#${opDetail.orderId}`} />}
//                   {opDetail.tableLabel && <Row label="Стол" value={opDetail.tableLabel} />}
//                   {opDetail.zoneTitle && <Row label="Зона" value={opDetail.zoneTitle} />}
//                 </div>
//               )}

//               {(opLoading || opDetail?.clientName || opDetail?.clientPhone) && (
//                 <div
//                   style={{
//                     border: "1px solid var(--border)",
//                     borderRadius: 12,
//                     padding: 12,
//                     background: "#fff",
//                     display: "grid",
//                     gap: 8,
//                   }}
//                 >
//                   <div style={{ fontWeight: 700, marginBottom: 2 }}>Клиент</div>
//                   {opLoading ? (
//                     <div>Загрузка данных…</div>
//                   ) : (
//                     <>
//                       {opDetail?.clientName && <Row label="Имя" value={opDetail.clientName} />}
//                       {opDetail?.clientPhone && <Row label="Телефон" value={opDetail.clientPhone} />}
//                     </>
//                   )}
//                 </div>
//               )}

//               {opDetail?.comment && (
//                 <div
//                   style={{
//                     border: "1px solid var(--border)",
//                     borderRadius: 12,
//                     padding: 12,
//                     background: "#fff",
//                     display: "grid",
//                     gap: 6,
//                   }}
//                 >
//                   <div style={{ fontWeight: 700 }}>Примечание</div>
//                   <div>{opDetail.comment}</div>
//                 </div>
//               )}
//             </div>

//             <div className="kassa-modal__footer">
//               <button className="kassa__btn" onClick={closeDetails} type="button">
//                 Закрыть
//               </button>
//             </div>
//           </div>
//         </div>
//       )}
//     </div>
//   );
// };

// // помощник для строк в карточках
// const Row = ({ label, value }) => (
//   <div
//     style={{
//       display: "grid",
//       gridTemplateColumns: "160px 1fr",
//       gap: 10,
//       alignItems: "start",
//     }}
//   >
//     <div style={{ color: "#6b7280" }}>{label}</div>
//     <div style={{ fontWeight: 600 }}>{value || "—"}</div>
//   </div>
// );

// export default CafeKassa;













import React, { useEffect, useMemo, useState } from "react";
import {
  Routes,
  Route,
  useNavigate,
  useParams,
  Link,
  useLocation,
} from "react-router-dom";
import api from "../../../../api";
import Reports from "../Reports/Reports";
import { CreateCashboxModal, OperationDetailsModal } from "./KassaModals";
import "./kassa.scss";

/* helpers */
const asArray = (d) =>
  Array.isArray(d?.results) ? d.results : Array.isArray(d) ? d : [];
const money = (v) =>
  (Number(v) || 0).toLocaleString("ru-RU", { minimumFractionDigits: 0 }) + " c";
const when = (iso) => (iso ? new Date(iso).toLocaleDateString() : "—");
const toNum = (x) => Number(String(x).replace(",", ".")) || 0;

// НЕОПЛАЧЕН = любой, КРОМЕ paid / отменён / закрыт
const isUnpaidStatus = (s) => {
  const v = (s || "").toString().trim().toLowerCase();
  return ![
    "paid",
    "оплачен",
    "оплачено",
    "canceled",
    "cancelled",
    "отменён",
    "отменен",
    "closed",
    "done",
    "completed",
  ].includes(v);
};

/* ───────────────────────────────────────────────── */
const CafeKassa = () => (
  <Routes>
    <Route index element={<CashboxList />} />
    {/* <Route path="pay" element={<CashboxPayment />} /> */}
    <Route path="reports" element={<CashboxReports />} />
    <Route path=":id" element={<CashboxDetail />} />
  </Routes>
);

/* Верхние вкладки */
const HeaderTabs = () => {
  const { pathname } = useLocation();
  const isList = /\/kassa\/?$/.test(pathname);
  const isReports = /\/kassa\/reports\/?$/.test(pathname);
  const isPay = /\/kassa\/pay\/?$/.test(pathname);

  return (
    <div className="kassa__header">
      <div className="kassa__tabs">
        <Link
          className={`kassa__tab ${isList ? "kassa__tab--active" : ""}`}
          to="/crm/cafe/kassa"
        >
          Кассы
        </Link>

        {/* <Link className={`kassa__tab ${isPay ? "kassa__tab--active" : ""}`} to="/crm/cafe/kassa/pay">
          Оплата
        </Link> */}

        <Link
          className={`kassa__tab ${isReports ? "kassa__tab--active" : ""}`}
          to="/crm/cafe/kassa/reports"
        >
          Отчёты
        </Link>
      </div>
    </div>
  );
};

/* ──────────────────────────────── Список касс */
const CashboxList = () => {
  const [rows, setRows] = useState([]);
  const [totals, setTotals] = useState({}); // { [boxKey]: { income: number, expense: number } }

  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState("");

  const navigate = useNavigate();

  const boxKey = (r) => String(r?.id || r?.uuid || "");

  const flowAmount = (x) => Number(x?.amount ?? x?.sum ?? x?.value ?? x?.total ?? 0) || 0;

  const flowType = (x) => {
    const t = String(x?.type ?? x?.kind ?? x?.direction ?? "").toLowerCase().trim();
    if (t === "income" || t === "expense") return t;
    const amt = flowAmount(x);
    return amt >= 0 ? "income" : "expense";
  };

  const fetchBoxTotals = async (cashboxId) => {
    try {
      const r = await api.get("/construction/cashflows/", {
        params: { cashbox: cashboxId },
      });

      const flows = asArray(r?.data) || [];
      let income = 0;
      let expense = 0;

      for (const f of flows) {
        const t = flowType(f);
        const amt = Math.abs(flowAmount(f));
        if (t === "income") income += amt;
        else expense += amt;
      }

      return { income, expense };
    } catch {
      return { income: 0, expense: 0 };
    }
  };

  const load = async () => {
    try {
      setErr("");
      setLoading(true);

      const { data } = await api.get("/construction/cashboxes/");
      const list = asArray(data);

      setRows(list);

      const pairs = await Promise.all(
        list.map(async (r) => {
          const key = boxKey(r);
          if (!key) return [key, { income: 0, expense: 0 }];

          const aIncome = Number(r?.analytics?.income?.total);
          const aExpense = Number(r?.analytics?.expense?.total);
          const hasAnalytics = Number.isFinite(aIncome) || Number.isFinite(aExpense);

          if (hasAnalytics) {
            return [
              key,
              {
                income: Number.isFinite(aIncome) ? aIncome : 0,
                expense: Number.isFinite(aExpense) ? aExpense : 0,
              },
            ];
          }

          const t = await fetchBoxTotals(key);
          return [key, t];
        })
      );

      const map = {};
      for (const [k, v] of pairs) {
        if (!k) continue;
        map[k] = v;
      }
      setTotals(map);
    } catch (e) {
      console.error(e);
      setErr("Не удалось загрузить кассы");
      setRows([]);
      setTotals({});
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return rows;
    return rows.filter((r) =>
      [r.department_name, r.name].some((x) =>
        String(x || "").toLowerCase().includes(t)
      )
    );
  }, [rows, q]);

  const summary = useMemo(() => {
    let income = 0;
    let expense = 0;
    for (const r of filtered) {
      const key = boxKey(r);
      const t = totals[key] || { income: 0, expense: 0 };
      income += Number(t.income) || 0;
      expense += Number(t.expense) || 0;
    }
    return { income, expense };
  }, [filtered, totals]);

  const onCreate = async () => {
    const title = (name || "").trim();
    if (!title) return alert("Введите название кассы");
    try {
      await api.post("/construction/cashboxes/", { name: title });
      setCreateOpen(false);
      setName("");
      load();
    } catch (e) {
      console.error(e);
      alert("Не удалось создать кассу");
    }
  };

  return (
    <div className="kassa">
      <HeaderTabs />

      <div className="kassa__toolbar">
        <div className="kassa__toolbarGroup">
          <span className="kassa__total">Всего: {filtered.length}</span>
          <span className="kassa__total" style={{ marginLeft: 14 }}>
            Приход: <b>{money(summary.income)}</b>
          </span>
          <span className="kassa__total" style={{ marginLeft: 10 }}>
            Расход: <b>{money(summary.expense)}</b>
          </span>
        </div>

        <div className="kassa__controls">
          <div className="kassa__searchWrap">
            <input
              className="kassa__input"
              type="text"
              placeholder="Поиск…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <button
            className="kassa__btn kassa__btn--primary"
            onClick={() => setCreateOpen(true)}
            type="button"
          >
            Создать кассу
          </button>
        </div>
      </div>

      {err && <div className="kassa__alert kassa__alert--error">{err}</div>}

      <div className="kassa__tableWrap">
        <table className="kassa__table">
          <thead>
            <tr>
              <th>Касса</th>
              <th>Приход</th>
              <th>Расход</th>
              <th>Действия</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={4}>Загрузка…</td>
              </tr>
            ) : filtered.length ? (
              filtered.map((r) => {
                const key = boxKey(r);
                const t = totals[key] || { income: 0, expense: 0 };

                return (
                  <tr
                    key={key}
                    className="kassa__rowClickable"
                    onClick={() => navigate(`/crm/cafe/kassa/${key}`)}
                  >
                    <td>
                      <b>{r.department_name || r.name || "—"}</b>
                    </td>
                    <td>{money(t.income)}</td>
                    <td>{money(t.expense)}</td>
                    <td>
                      <button
                        className="kassa__btn kassa__btn--secondary"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/crm/cafe/kassa/${key}`);
                        }}
                        type="button"
                      >
                        Открыть
                      </button>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={4} className="kassa__center">
                  Нет данных
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <CreateCashboxModal
        open={createOpen}
        name={name}
        onNameChange={setName}
        onClose={() => setCreateOpen(false)}
        onSave={onCreate}
      />
    </div>
  );
};

/* ──────────────────────────────── Обёртка с отчётом */
const CashboxReports = () => (
  <div className="kassa">
    <HeaderTabs />
    <Reports />
  </div>
);

/* ──────────────────────────────── Детали кассы + фильтр дат + модалка */
const CashboxDetail = () => {
  const { id } = useParams();

  const [box, setBox] = useState(null);
  const [ops, setOps] = useState([]);
  const [tab, setTab] = useState("all");
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const [openOp, setOpenOp] = useState(null);
  const [opLoading, setOpLoading] = useState(false);
  const [opDetail, setOpDetail] = useState(null);

  const fromAny = (res) => {
    const d = res?.data ?? res ?? [];
    if (Array.isArray(d?.results)) return d.results;
    if (Array.isArray(d)) return d;
    return [];
  };

  const load = async () => {
    setErr("");
    setLoading(true);

    try {
      let detail = null;

      try {
        detail = (await api.get(`/construction/cashboxes/${id}/detail/owner/`)).data;
      } catch {}

      if (!detail) {
        try {
          detail = (await api.get(`/construction/cashboxes/${id}/detail/`)).data;
        } catch {}
      }

      if (!detail) {
        detail = (await api.get(`/construction/cashboxes/${id}/`)).data;
      }

      setBox(detail);

      let flows =
        fromAny({ data: detail?.operations }) ||
        fromAny({ data: detail?.flows }) ||
        fromAny({ data: detail?.transactions });

      if (!flows.length) {
        try {
          const r1 = await api.get(`/construction/cashflows/`, { params: { cashbox: id } });
          flows = fromAny(r1);
        } catch {}
      }

      if (!flows.length && detail?.uuid) {
        try {
          const r2 = await api.get(`/construction/cashflows/`, { params: { cashbox: detail.uuid } });
          flows = fromAny(r2);
        } catch {}
      }

      const mapped = (flows || []).map((x, i) => {
        const amt = Number(x.amount ?? x.sum ?? x.value ?? x.total ?? 0) || 0;
        let type = String(x.type ?? x.kind ?? x.direction ?? "").toLowerCase();
        if (type !== "income" && type !== "expense") type = amt >= 0 ? "income" : "expense";

        return {
          id: x.id || x.uuid || `${i}`,
          type,
          title:
            x.title ||
            x.name ||
            x.description ||
            x.note ||
            (type === "income" ? "Приход" : "Расход"),
          amount: Math.abs(amt),
          created_at: x.created_at || x.created || x.date || x.timestamp || x.createdAt || null,
          raw: x,
        };
      });

      setOps(mapped);
    } catch (e) {
      console.error(e);
      setErr("Не удалось загрузить детали кассы");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [id]);

  const inDateRange = (iso) => {
    if (!iso) return true;

    const d = new Date(iso);

    if (dateFrom) {
      const f = new Date(dateFrom + "T00:00:00");
      if (d < f) return false;
    }
    if (dateTo) {
      const t = new Date(dateTo + "T23:59:59.999");
      if (d > t) return false;
    }
    return true;
  };

  const shown = useMemo(() => {
    let arr = ops;
    if (tab === "income") arr = arr.filter((o) => o.type === "income");
    if (tab === "expense") arr = arr.filter((o) => o.type === "expense");
    if (dateFrom || dateTo) arr = arr.filter((o) => inDateRange(o.created_at));
    return arr;
  }, [ops, tab, dateFrom, dateTo]);

  const openDetails = async (op) => {
    setOpenOp(op);
    setOpLoading(true);
    setOpDetail(null);

    try {
      const raw = op.raw || {};
      const orderId =
        raw.order ||
        raw.order_id ||
        raw.orderId ||
        (typeof raw.source_id === "number" &&
        (raw.source_type === "order" || raw.source === "order")
          ? raw.source_id
          : null) ||
        null;

      let order = null;
      if (orderId) {
        try {
          order = (await api.get(`/cafe/orders/${orderId}/`)).data;
        } catch {}
      }

      const clientId = order?.client || raw.client || raw.client_id || raw.clientId || null;
      let client = null;

      if (clientId) {
        try {
          client = (await api.get(`/cafe/clients/${clientId}/`)).data;
        } catch {}
      }

      const clientName =
        client?.name ||
        client?.full_name ||
        order?.client_name ||
        raw.client_name ||
        null;

      const clientPhone =
        client?.phone || order?.client_phone || raw.client_phone || null;

      let tableLabel = null;
      let zoneTitle = null;

      const tableId = order?.table || raw.table || raw.table_id || null;

      if (tableId) {
        try {
          const t = (await api.get(`/cafe/tables/${tableId}/`)).data;
          if (t) {
            tableLabel = t.number != null ? `Стол ${t.number}` : "Стол";
            const z = t.zone;

            if (z && typeof z === "object" && z.title) zoneTitle = z.title;
            else if (z) {
              try {
                const zres = (await api.get(`/cafe/zones/${z}/`)).data;
                zoneTitle = zres?.title || null;
              } catch {}
            }
          }
        } catch {}
      }

      const category = raw.category_name || raw.category || null;
      const method = raw.method || raw.payment_method || raw.payment_type || null;
      const userName = raw.user_name || raw.created_by_name || raw.owner_name || null;
      const comment = raw.note || raw.description || raw.comment || null;

      setOpDetail({
        orderId: order?.id || orderId || null,
        clientName,
        clientPhone,
        tableLabel,
        zoneTitle,
        category,
        method,
        userName,
        comment,
      });
    } catch {
      setOpDetail(null);
    } finally {
      setOpLoading(false);
    }
  };

  const closeDetails = () => {
    setOpenOp(null);
    setOpDetail(null);
    setOpLoading(false);
  };

  const cashboxTitle = box?.department_name || box?.name || "Касса";

  return (
    <div className="kassa">
      <div className="kassa__header">
        <div className="kassa__tabs">
          <Link className="kassa__tab" to="/crm/cafe/kassa">
            ← Назад
          </Link>
          <span className="kassa__tab kassa__tab--active">{cashboxTitle}</span>

          {/* <Link className="kassa__tab" to="/crm/cafe/kassa/pay">
            Оплата
          </Link> */}

          <Link className="kassa__tab" to="/crm/cafe/kassa/reports">
            Отчёты
          </Link>
        </div>
      </div>

      <div className="kassa__switch" style={{ gap: 8, flexWrap: "wrap" }}>
        <button
          className={`kassa__chip ${tab === "expense" ? "kassa__chip--active" : ""}`}
          onClick={() => setTab("expense")}
          type="button"
        >
          Расход
        </button>

        <button
          className={`kassa__chip ${tab === "income" ? "kassa__chip--active" : ""}`}
          onClick={() => setTab("income")}
          type="button"
        >
          Приход
        </button>

        <button
          className={`kassa__chip ${tab === "all" ? "kassa__chip--active" : ""}`}
          onClick={() => setTab("all")}
          type="button"
        >
          Все
        </button>

        <div className="kassa__grow" />

        <div className="kassa__field" style={{ minWidth: 140 }}>
          <label className="kassa__label" style={{ display: "block", fontSize: 12, opacity: 0.8 }}>
            С
          </label>
          <input
            className="kassa__input"
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
          />
        </div>

        <div className="kassa__field" style={{ minWidth: 140 }}>
          <label className="kassa__label" style={{ display: "block", fontSize: 12, opacity: 0.8 }}>
            По
          </label>
          <input
            className="kassa__input"
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
          />
        </div>

        {(dateFrom || dateTo) && (
          <button
            className="kassa__btn"
            onClick={() => {
              setDateFrom("");
              setDateTo("");
            }}
            type="button"
          >
            Сбросить
          </button>
        )}

        <button
          className="kassa__btn kassa__btn--primary"
          onClick={() =>
            alert("Добавление операции делается через API. Здесь доступен только просмотр.")
          }
          type="button"
        >
          Добавить операцию
        </button>
      </div>

      <div className="kassa__tableWrap">
        <table className="kassa__table">
          <thead>
            <tr>
              <th>Тип</th>
              <th>Наименование</th>
              <th>Сумма</th>
              <th>Дата создания</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={4}>Загрузка…</td>
              </tr>
            ) : err ? (
              <tr>
                <td colSpan={4} className="kassa__alert kassa__alert--error">
                  {err}
                </td>
              </tr>
            ) : shown.length ? (
              shown.map((o) => (
                <tr
                  key={o.id}
                  className="kassa__rowClickable"
                  onClick={() => openDetails(o)}
                >
                  <td>{o.type === "income" ? "Приход" : "Расход"}</td>
                  <td>{o.title}</td>
                  <td>{money(o.amount)}</td>
                  <td>{when(o.created_at)}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={4}>Нет операций</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <OperationDetailsModal
        open={!!openOp}
        op={openOp}
        opDetail={opDetail}
        opLoading={opLoading}
        cashboxTitle={cashboxTitle}
        onClose={closeDetails}
      />
    </div>
  );
};

export default CafeKassa;
