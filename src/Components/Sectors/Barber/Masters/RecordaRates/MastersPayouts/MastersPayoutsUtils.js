// // MastersPayoutsUtils.js
// import api from "../../../../../../api";

// /* ===== helpers ===== */
// export const asArray = (d) =>
//   Array.isArray(d?.results) ? d.results : Array.isArray(d) ? d : [];

// export const pad2 = (n) => String(n).padStart(2, "0");

// const toNum = (v) => {
//   if (v === "" || v == null) return 0;
//   const n = Number(String(v).replace(/[^\d.-]/g, ""));
//   return Number.isFinite(n) ? n : 0;
// };

// /* ===== endpoints ===== */
// const RATES_EP = "/barbershop/payouts/";
// const CASHFLOWS_EP = "/construction/cashflows/";
// const CASHBOXES_EP = "/construction/cashboxes/";

// /* ===== общее: пагинация ===== */
// export const fetchPaged = async (url) => {
//   const acc = [];
//   let next = url;
//   const seen = new Set();
//   while (next && !seen.has(next)) {
//     seen.add(next);
//     const { data } = await api.get(next);
//     acc.push(...asArray(data));
//     next = data?.next;
//   }
//   return acc;
// };

// /* ===== загрузка барбершоп-данных для аналитики ===== */
// export const loadBarbershopData = async () => {
//   const [apps, emps, svcs] = await Promise.all([
//     fetchPaged("/barbershop/appointments/"),
//     fetchPaged("/users/employees/"),
//     fetchPaged("/barbershop/services/"),
//   ]);

//   const normEmp = emps
//     .map((e) => {
//       const first = e.first_name ?? "";
//       const last = e.last_name ?? "";
//       const disp =
//         [last, first].filter(Boolean).join(" ").trim() || e.email || "—";
//       return { id: e.id, name: disp };
//     })
//     .sort((a, b) => a.name.localeCompare(b.name, "ru"));

//   const normSvc = svcs.map((s) => ({
//     id: s.id,
//     name: s.service_name || s.name || "—",
//     price: s.price,
//   }));

//   return {
//     appointments: apps,
//     employees: normEmp,
//     services: normSvc,
//   };
// };

// /* ===== ставки за период ===== */
// export const loadRatesForPeriod = async (periodLabel) => {
//   const { data } = await api.get(RATES_EP, {
//     params: { period: periodLabel, page_size: 1000 },
//   });

//   const items = asArray(data);
//   const map = {};

//   items.forEach((r) => {
//     const barberId = r.barber || r.barber_id;
//     if (!barberId) return;

//     const mode = String(r.mode || "").toLowerCase();
//     const rateVal = r.rate ?? r.amount ?? null;
//     const id = r.id;

//     const rec = (map[barberId] = map[barberId] || {});

//     if (rec.completed == null) rec.completed = toNum(r.appointments_count);
//     if (rec.revenue == null) rec.revenue = toNum(r.total_revenue);
//     if (rec.payout == null) rec.payout = toNum(r.payout_amount);

//     if (mode === "record") {
//       rec.id_record = id;
//       rec.perRecord = toNum(rateVal);
//     } else if (mode === "fixed") {
//       rec.id_fixed = id;
//       rec.fixed = toNum(rateVal);
//     } else if (mode === "percent") {
//       rec.id_percent = id;
//       rec.percent = toNum(rateVal);
//     }
//   });

//   return map;
// };

// const calcPayoutTotalForPeriod = (ratesMap) =>
//   Object.values(ratesMap || {}).reduce(
//     (sum, r) => sum + toNum(r.payout ?? r.payout_amount),
//     0
//   );

// /* ===== запись расхода в кассу ===== */
// const upsertPayoutExpense = async (periodLabel, amountSom) => {
//   if (!amountSom || amountSom <= 0) return;

//   let cashboxId = null;
//   try {
//     const { data } = await api.get(CASHBOXES_EP, {
//       params: { page_size: 200 },
//     });
//     const boxes = asArray(data);
//     if (boxes.length) cashboxId = boxes[0]?.id || boxes[0]?.uuid || null;
//   } catch (e) {
//     console.error(e);
//   }

//   let existing = null;
//   try {
//     const { data } = await api.get(CASHFLOWS_EP, {
//       params: { page_size: 200 },
//     });
//     const flows = asArray(data);
//     const label = `Выплаты мастерам ${periodLabel}`;
//     existing = flows.find((cf) => {
//       const type = String(
//         cf?.type ?? cf?.kind ?? cf?.direction ?? ""
//       ).toLowerCase();
//       const desc = String(cf?.description ?? cf?.note ?? cf?.comment ?? "");
//       const amt = toNum(cf?.amount ?? cf?.value ?? cf?.sum);
//       return desc.includes(label) && (type === "expense" || amt < 0);
//     });
//   } catch (e) {
//     console.error(e);
//   }

//   const payload = {
//     type: "expense",
//     amount: String(amountSom),
//     description: `Выплаты мастерам ${periodLabel}`,
//     date: `${periodLabel}-01`,
//     ...(cashboxId ? { cashbox: cashboxId } : {}),
//   };

//   try {
//     if (existing?.id) {
//       await api.put(`${CASHFLOWS_EP}${existing.id}/`, payload);
//     } else {
//       await api.post(CASHFLOWS_EP, payload);
//     }
//   } catch (e) {
//     try {
//       const alt = {
//         kind: "expense",
//         value: String(amountSom),
//         comment: `Выплаты мастерам ${periodLabel}`,
//         datetime: `${periodLabel}-01T00:00:00`,
//         ...(cashboxId ? { cashbox: cashboxId } : {}),
//       };
//       if (existing?.id) await api.put(`${CASHFLOWS_EP}${existing.id}/`, alt);
//       else await api.post(CASHFLOWS_EP, alt);
//     } catch (e2) {
//       console.error(e2);
//     }
//   }
// };

// /* ===== сохранение ставок + касса ===== */
// export const persistRatesForPeriod = async (periodLabel, rates) => {
//   const tasks = [];

//   Object.entries(rates).forEach(([barberId, rec]) => {
//     const send = async (mode, amount, idKey) => {
//       if (amount === "" || amount == null) return;
//       const n = toNum(amount);
//       if (!Number.isFinite(n) || n < 0) return;

//       const payload = {
//         barber: barberId,
//         period: periodLabel,
//         mode,
//         rate: String(n),
//       };

//       const id = rec[idKey];
//       if (id) await api.put(`${RATES_EP}${id}/`, payload);
//       else await api.post(RATES_EP, payload);
//     };

//     tasks.push(send("record", rec.perRecord, "id_record"));
//     tasks.push(send("fixed", rec.fixed, "id_fixed"));
//     tasks.push(send("percent", rec.percent, "id_percent"));
//   });

//   await Promise.allSettled(tasks);

//   const newRates = await loadRatesForPeriod(periodLabel);
//   const payoutTotalSom = calcPayoutTotalForPeriod(newRates);
//   await upsertPayoutExpense(periodLabel, payoutTotalSom);

//   return newRates;
// };





// // MastersPayoutsUtils.js
// import api from "../../../../../../api";

// /* ===== helpers ===== */
// export const asArray = (d) =>
//   Array.isArray(d?.results) ? d.results : Array.isArray(d) ? d : [];

// export const pad2 = (n) => String(n).padStart(2, "0");

// const toNum = (v) => {
//   if (v === "" || v == null) return 0;
//   const n = Number(String(v).replace(/[^\d.-]/g, ""));
//   return Number.isFinite(n) ? n : 0;
// };

// /* ===== endpoints ===== */
// const RATES_EP = "/barbershop/payouts/";
// const CASHFLOWS_EP = "/construction/cashflows/";
// const CASHBOXES_EP = "/construction/cashboxes/";
// const SALE_PAYOUTS_EP = "/barbershop/sale-payouts/"; // <== новый эндпоинт для аналитики

// /* ===== общее: пагинация ===== */
// export const fetchPaged = async (url) => {
//   const acc = [];
//   let next = url;
//   const seen = new Set();
//   while (next && !seen.has(next)) {
//     seen.add(next);
//     const { data } = await api.get(next);
//     acc.push(...asArray(data));
//     next = data?.next;
//   }
//   return acc;
// };

// /* ===== загрузка барбершоп-данных для аналитики ===== */
// export const loadBarbershopData = async () => {
//   const [apps, emps, svcs] = await Promise.all([
//     fetchPaged("/barbershop/appointments/"),
//     fetchPaged("/users/employees/"),
//     fetchPaged("/barbershop/services/"),
//   ]);

//   const normEmp = emps
//     .map((e) => {
//       const first = e.first_name ?? "";
//       const last = e.last_name ?? "";
//       const disp =
//         [last, first].filter(Boolean).join(" ").trim() || e.email || "—";
//       return { id: e.id, name: disp };
//     })
//     .sort((a, b) => a.name.localeCompare(b.name, "ru"));

//   const normSvc = svcs.map((s) => ({
//     id: s.id,
//     name: s.service_name || s.name || "—",
//     price: s.price,
//   }));

//   return {
//     appointments: apps,
//     employees: normEmp,
//     services: normSvc,
//   };
// };

// /* ===== ставки за период ===== */
// export const loadRatesForPeriod = async (periodLabel) => {
//   const { data } = await api.get(RATES_EP, {
//     params: { period: periodLabel, page_size: 1000 },
//   });

//   const items = asArray(data);
//   const map = {};

//   items.forEach((r) => {
//     const barberId = r.barber || r.barber_id;
//     if (!barberId) return;

//     const mode = String(r.mode || "").toLowerCase();
//     const rateVal = r.rate ?? r.amount ?? null;
//     const id = r.id;

//     const rec = (map[barberId] = map[barberId] || {});

//     // агрегаты от бэка (как и раньше)
//     if (rec.completed == null) rec.completed = toNum(r.appointments_count);
//     if (rec.revenue == null) rec.revenue = toNum(r.total_revenue);
//     if (rec.payout == null) rec.payout = toNum(r.payout_amount);

//     if (mode === "record") {
//       rec.id_record = id;
//       rec.perRecord = toNum(rateVal);
//     } else if (mode === "fixed") {
//       rec.id_fixed = id;
//       rec.fixed = toNum(rateVal);
//     } else if (mode === "percent") {
//       rec.id_percent = id;
//       rec.percent = toNum(rateVal);
//     }
//   });

//   return map;
// };

// const calcPayoutTotalForPeriod = (ratesMap) =>
//   Object.values(ratesMap || {}).reduce(
//     (sum, r) => sum + toNum(r.payout ?? r.payout_amount),
//     0
//   );

// /* ===== запись расхода в кассу (как было, без дельты) ===== */
// const upsertPayoutExpense = async (periodLabel, amountSom) => {
//   if (!amountSom || amountSom <= 0) return;

//   let cashboxId = null;
//   try {
//     const { data } = await api.get(CASHBOXES_EP, {
//       params: { page_size: 200 },
//     });
//     const boxes = asArray(data);
//     if (boxes.length) cashboxId = boxes[0]?.id || boxes[0]?.uuid || null;
//   } catch (e) {
//     console.error(e);
//   }

//   let existing = null;
//   try {
//     const { data } = await api.get(CASHFLOWS_EP, {
//       params: { page_size: 200 },
//     });
//     const flows = asArray(data);
//     const label = `Выплаты мастерам ${periodLabel}`;
//     existing = flows.find((cf) => {
//       const type = String(
//         cf?.type ?? cf?.kind ?? cf?.direction ?? ""
//       ).toLowerCase();
//       const desc = String(cf?.description ?? cf?.note ?? cf?.comment ?? "");
//       const amt = toNum(cf?.amount ?? cf?.value ?? cf?.sum);
//       return desc.includes(label) && (type === "expense" || amt < 0);
//     });
//   } catch (e) {
//     console.error(e);
//   }

//   const payload = {
//     type: "expense",
//     amount: String(amountSom),
//     description: `Выплаты мастерам ${periodLabel}`,
//     date: `${periodLabel}-01`,
//     ...(cashboxId ? { cashbox: cashboxId } : {}),
//   };

//   try {
//     if (existing?.id) {
//       await api.put(`${CASHFLOWS_EP}${existing.id}/`, payload);
//     } else {
//       await api.post(CASHFLOWS_EP, payload);
//     }
//   } catch (e) {
//     try {
//       const alt = {
//         kind: "expense",
//         value: String(amountSom),
//         comment: `Выплаты мастерам ${periodLabel}`,
//         datetime: `${periodLabel}-01T00:00:00`,
//         ...(cashboxId ? { cashbox: cashboxId } : {}),
//       };
//       if (existing?.id) await api.put(`${CASHFLOWS_EP}${existing.id}/`, alt);
//       else await api.post(CASHFLOWS_EP, alt);
//     } catch (e2) {
//       console.error(e2);
//     }
//   }
// };

// /* ===== читаем последнюю запись sale-payouts для периода ===== */
// const getLastSalePayoutForPeriod = async (periodLabel) => {
//   try {
//     const { data } = await api.get(SALE_PAYOUTS_EP, {
//       params: { period: periodLabel, page_size: 100 },
//     });
//     const items = asArray(data);
//     if (!items.length) return null;

//     // сортируем по полю period, берём последнюю
//     items.sort((a, b) =>
//       String(a.period || "").localeCompare(String(b.period || ""))
//     );
//     return items[items.length - 1];
//   } catch (e) {
//     console.error(e);
//     return null;
//   }
// };

// /* ===== сохранение ставок + аналитика по дельте ===== */
// export const persistRatesForPeriod = async (periodLabel, rates) => {
//   const tasks = [];

//   Object.entries(rates).forEach(([barberId, rec]) => {
//     const send = async (mode, amount, idKey) => {
//       if (amount === "" || amount == null) return;
//       const n = toNum(amount);
//       if (!Number.isFinite(n) || n < 0) return;

//       const payload = {
//         barber: barberId,
//         period: periodLabel,
//         mode,
//         rate: String(n),
//       };

//       const id = rec[idKey];
//       if (id) await api.put(`${RATES_EP}${id}/`, payload);
//       else await api.post(RATES_EP, payload);
//     };

//     tasks.push(send("record", rec.perRecord, "id_record"));
//     tasks.push(send("fixed", rec.fixed, "id_fixed"));
//     tasks.push(send("percent", rec.percent, "id_percent"));
//   });

//   await Promise.allSettled(tasks);

//   // после сохранения ставок — заново читаем агрегаты
//   const newRates = await loadRatesForPeriod(periodLabel);
//   const newTotalFund = calcPayoutTotalForPeriod(newRates); // новый фонд за месяц

//   // читаем старый фонд из /barbershop/sale-payouts/
//   const lastSale = await getLastSalePayoutForPeriod(periodLabel);
//   const oldTotalFund = lastSale
//     ? toNum(
//         lastSale.new_total_fund ??
//           lastSale.total ??
//           lastSale.old_total_fund ??
//           0
//       )
//     : 0;

//   // дельта (может быть + или -)
//   const deltaRaw = newTotalFund - oldTotalFund;
//   const delta = Math.round(deltaRaw);

//   // если фонд уменьшился — спрашиваем подтверждение
//   if (delta < 0) {
//     const absDelta = Math.abs(delta);
//     // eslint-disable-next-line no-alert
//     const ok = window.confirm(
//       `Фонд выплат за ${periodLabel} уменьшился на ${absDelta}с (было ${oldTotalFund}с, стало ${newTotalFund}с).\nПровести корректировку?`
//     );
//     if (!ok) {
//       // ставки сохранили, деньги и аналитику не трогаем
//       return newRates;
//     }
//   }

//   // пишем запись в /barbershop/sale-payouts/ только если есть изменение
//   if (delta !== 0) {
//     try {
//       await api.post(SALE_PAYOUTS_EP, {
//         period: periodLabel, // как и в payouts
//         old_total_fund: String(oldTotalFund),
//         new_total_fund: String(newTotalFund),
//         total: String(delta), // разница, может быть отрицательной
//       });
//     } catch (e) {
//       console.error(e);
//     }
//   }

//   // в кассу по-прежнему пишем ИТОГОВЫЙ фонд за период
//   await upsertPayoutExpense(periodLabel, newTotalFund);

//   return newRates;
// };




// // MastersPayoutsUtils.js
// import api from "../../../../../../api";

// /* ===== helpers ===== */
// export const asArray = (d) =>
//   Array.isArray(d?.results) ? d.results : Array.isArray(d) ? d : [];

// export const pad2 = (n) => String(n).padStart(2, "0");

// const toNum = (v) => {
//   if (v === "" || v == null) return 0;
//   const n = Number(String(v).replace(/[^\d.-]/g, ""));
//   return Number.isFinite(n) ? n : 0;
// };

// /* ===== endpoints ===== */
// const RATES_EP = "/barbershop/payouts/";
// const CASHFLOWS_EP = "/construction/cashflows/";
// const CASHBOXES_EP = "/construction/cashboxes/";
// const SALE_PAYOUTS_EP = "/barbershop/sale-payouts/";

// /* ===== общее: пагинация ===== */
// export const fetchPaged = async (url) => {
//   const acc = [];
//   let next = url;
//   const seen = new Set();
//   while (next && !seen.has(next)) {
//     seen.add(next);
//     const { data } = await api.get(next);
//     acc.push(...asArray(data));
//     next = data?.next;
//   }
//   return acc;
// };

// /* ===== загрузка барбершоп-данных ===== */
// export const loadBarbershopData = async () => {
//   const [apps, emps, svcs] = await Promise.all([
//     fetchPaged("/barbershop/appointments/"),
//     fetchPaged("/users/employees/"),
//     fetchPaged("/barbershop/services/"),
//   ]);

//   const normEmp = emps
//     .map((e) => {
//       const first = e.first_name ?? "";
//       const last = e.last_name ?? "";
//       const disp =
//         [last, first].filter(Boolean).join(" ").trim() || e.email || "—";
//       return { id: e.id, name: disp };
//     })
//     .sort((a, b) => a.name.localeCompare(b.name, "ru"));

//   const normSvc = svcs.map((s) => ({
//     id: s.id,
//     name: s.service_name || s.name || "—",
//     price: s.price,
//   }));

//   return {
//     appointments: apps,
//     employees: normEmp,
//     services: normSvc,
//   };
// };

// /* ===== ставки за период ===== */
// export const loadRatesForPeriod = async (periodLabel) => {
//   const { data } = await api.get(RATES_EP, {
//     params: { period: periodLabel, page_size: 1000 },
//   });

//   const items = asArray(data);
//   const map = {};

//   items.forEach((r) => {
//     const barberId = r.barber || r.barber_id;
//     if (!barberId) return;

//     const mode = String(r.mode || "").toLowerCase();
//     const rateVal = r.rate ?? r.amount ?? null;
//     const id = r.id;

//     const rec = (map[barberId] = map[barberId] || {});

//     if (rec.completed == null) rec.completed = toNum(r.appointments_count);
//     if (rec.revenue == null) rec.revenue = toNum(r.total_revenue);
//     if (rec.payout == null) rec.payout = toNum(r.payout_amount);

//     if (mode === "record") {
//       rec.id_record = id;
//       rec.perRecord = toNum(rateVal);
//     } else if (mode === "fixed") {
//       rec.id_fixed = id;
//       rec.fixed = toNum(rateVal);
//     } else if (mode === "percent") {
//       rec.id_percent = id;
//       rec.percent = toNum(rateVal);
//     }
//   });

//   return map;
// };

// const calcPayoutTotalForPeriod = (ratesMap) =>
//   Object.values(ratesMap || {}).reduce(
//     (sum, r) => sum + toNum(r.payout ?? r.payout_amount),
//     0
//   );

// /* ===== запись расхода в кассу ===== */
// const upsertPayoutExpense = async (periodLabel, amountSom) => {
//   if (!amountSom || amountSom <= 0) return;

//   let cashboxId = null;
//   try {
//     const { data } = await api.get(CASHBOXES_EP, {
//       params: { page_size: 200 },
//     });
//     const boxes = asArray(data);
//     if (boxes.length) cashboxId = boxes[0]?.id || boxes[0]?.uuid || null;
//   } catch (e) {
//     console.error(e);
//   }

//   let existing = null;
//   try {
//     const { data } = await api.get(CASHFLOWS_EP, {
//       params: { page_size: 200 },
//     });
//     const flows = asArray(data);
//     const label = `Выплаты мастерам ${periodLabel}`;
//     existing = flows.find((cf) => {
//       const type = String(
//         cf?.type ?? cf?.kind ?? cf?.direction ?? ""
//       ).toLowerCase();
//       const desc = String(cf?.description ?? cf?.note ?? cf?.comment ?? "");
//       const amt = toNum(cf?.amount ?? cf?.value ?? cf?.sum);
//       return desc.includes(label) && (type === "expense" || amt < 0);
//     });
//   } catch (e) {
//     console.error(e);
//   }

//   const payload = {
//     type: "expense",
//     amount: String(amountSom),
//     description: `Выплаты мастерам ${periodLabel}`,
//     date: `${periodLabel}-01`,
//     ...(cashboxId ? { cashbox: cashboxId } : {}),
//   };

//   try {
//     if (existing?.id) {
//       await api.put(`${CASHFLOWS_EP}${existing.id}/`, payload);
//     } else {
//       await api.post(CASHFLOWS_EP, payload);
//     }
//   } catch (e) {
//     try {
//       const alt = {
//         kind: "expense",
//         value: String(amountSom),
//         comment: `Выплаты мастерам ${periodLabel}`,
//         datetime: `${periodLabel}-01T00:00:00`,
//         ...(cashboxId ? { cashbox: cashboxId } : {}),
//       };
//       if (existing?.id) await api.put(`${CASHFLOWS_EP}${existing.id}/`, alt);
//       else await api.post(CASHFLOWS_EP, alt);
//     } catch (e2) {
//       console.error(e2);
//     }
//   }
// };

// /* ===== читаем последнюю запись sale-payouts для периода ===== */
// const getLastSalePayoutForPeriod = async (periodLabel) => {
//   try {
//     const { data } = await api.get(SALE_PAYOUTS_EP, {
//       params: { period: periodLabel, page_size: 100 },
//     });
//     const items = asArray(data);
//     if (!items.length) return null;

//     items.sort((a, b) =>
//       String(a.period || "").localeCompare(String(b.period || ""))
//     );
//     return items[items.length - 1];
//   } catch (e) {
//     console.error(e);
//     return null;
//   }
// };

// /* ===== сохранение ставок + аналитика по фонду из UI ===== */
// export const persistRatesForPeriod = async (
//   periodLabel,
//   rates,
//   uiTotalFund
// ) => {
//   const tasks = [];

//   Object.entries(rates).forEach(([barberId, rec]) => {
//     const send = async (mode, amount, idKey) => {
//       if (amount === "" || amount == null) return;
//       const n = toNum(amount);
//       if (!Number.isFinite(n) || n < 0) return;

//       const payload = {
//         barber: barberId,
//         period: periodLabel,
//         mode,
//         rate: String(n),
//       };

//       const id = rec[idKey];
//       if (id) await api.put(`${RATES_EP}${id}/`, payload);
//       else await api.post(RATES_EP, payload);
//     };

//     tasks.push(send("record", rec.perRecord, "id_record"));
//     tasks.push(send("fixed", rec.fixed, "id_fixed"));
//     tasks.push(send("percent", rec.percent, "id_percent"));
//   });

//   await Promise.allSettled(tasks);

//   // обновляем ставки из бэка (id, payout и т.п.)
//   const newRates = await loadRatesForPeriod(periodLabel);

//   // новый фонд — ИЗ UI (снизу таблицы), а не из бэка
//   const newTotalFund = Math.round(toNum(uiTotalFund || 0));

//   // старый фонд из последней записи sale-payouts
//   const lastSale = await getLastSalePayoutForPeriod(periodLabel);
//   const oldTotalFund = lastSale
//     ? toNum(
//         lastSale.new_total_fund ??
//           lastSale.total ??
//           lastSale.old_total_fund ??
//           0
//       )
//     : 0;

//   const deltaRaw = newTotalFund - oldTotalFund;
//   const delta = Math.round(deltaRaw);

//   if (delta < 0) {
//     const absDelta = Math.abs(delta);
//     // eslint-disable-next-line no-alert
//     const ok = window.confirm(
//       `Фонд выплат за ${periodLabel} уменьшился на ${absDelta}с (было ${oldTotalFund}с, стало ${newTotalFund}с).\nПровести корректировку?`
//     );
//     if (!ok) {
//       return newRates;
//     }
//   }

//   if (delta !== 0) {
//     try {
//       await api.post(SALE_PAYOUTS_EP, {
//         period: periodLabel,
//         old_total_fund: String(oldTotalFund),
//         new_total_fund: String(newTotalFund),
//         total: String(delta),
//       });
//     } catch (e) {
//       console.error(e);
//     }
//   }

//   await upsertPayoutExpense(periodLabel, newTotalFund);

//   return newRates;
// };




// // MastersPayoutsUtils.js
// import api from "../../../../../../api";

// /* ===== helpers ===== */
// export const asArray = (d) =>
//   Array.isArray(d?.results) ? d.results : Array.isArray(d) ? d : [];

// export const pad2 = (n) => String(n).padStart(2, "0");

// const toNum = (v) => {
//   if (v === "" || v == null) return 0;
//   const n = Number(String(v).replace(/[^\d.-]/g, ""));
//   return Number.isFinite(n) ? n : 0;
// };

// /* ===== endpoints ===== */
// const RATES_EP = "/barbershop/payouts/";
// const CASHFLOWS_EP = "/construction/cashflows/";
// const CASHBOXES_EP = "/construction/cashboxes/";
// const SALE_PAYOUTS_EP = "/barbershop/sale-payouts/";

// /* ===== общее: пагинация ===== */
// export const fetchPaged = async (url) => {
//   const acc = [];
//   let next = url;
//   const seen = new Set();
//   while (next && !seen.has(next)) {
//     seen.add(next);
//     const { data } = await api.get(next);
//     acc.push(...asArray(data));
//     next = data?.next;
//   }
//   return acc;
// };

// /* ===== загрузка барбершоп-данных ===== */
// export const loadBarbershopData = async () => {
//   const [apps, emps, svcs] = await Promise.all([
//     fetchPaged("/barbershop/appointments/"),
//     fetchPaged("/users/employees/"),
//     fetchPaged("/barbershop/services/"),
//   ]);

//   const normEmp = emps
//     .map((e) => {
//       const first = e.first_name ?? "";
//       const last = e.last_name ?? "";
//       const disp =
//         [last, first].filter(Boolean).join(" ").trim() || e.email || "—";
//       return { id: e.id, name: disp };
//     })
//     .sort((a, b) => a.name.localeCompare(b.name, "ru"));

//   const normSvc = svcs.map((s) => ({
//     id: s.id,
//     name: s.service_name || s.name || "—",
//     price: s.price,
//   }));

//   return {
//     appointments: apps,
//     employees: normEmp,
//     services: normSvc,
//   };
// };

// /* ===== ставки за период ===== */
// export const loadRatesForPeriod = async (periodLabel) => {
//   const { data } = await api.get(RATES_EP, {
//     params: { period: periodLabel, page_size: 1000 },
//   });

//   const items = asArray(data);
//   const map = {};

//   items.forEach((r) => {
//     const barberId = r.barber || r.barber_id;
//     if (!barberId) return;

//     const mode = String(r.mode || "").toLowerCase();
//     const rateVal = r.rate ?? r.amount ?? null;
//     const id = r.id;

//     const rec = (map[barberId] = map[barberId] || {});

//     if (rec.completed == null) rec.completed = toNum(r.appointments_count);
//     if (rec.revenue == null) rec.revenue = toNum(r.total_revenue);
//     if (rec.payout == null) rec.payout = toNum(r.payout_amount);

//     if (mode === "record") {
//       rec.id_record = id;
//       rec.perRecord = toNum(rateVal);
//     } else if (mode === "fixed") {
//       rec.id_fixed = id;
//       rec.fixed = toNum(rateVal);
//     } else if (mode === "percent") {
//       rec.id_percent = id;
//       rec.percent = toNum(rateVal);
//     }
//   });

//   return map;
// };

// const calcPayoutTotalForPeriod = (ratesMap) =>
//   Object.values(ratesMap || {}).reduce(
//     (sum, r) => sum + toNum(r.payout ?? r.payout_amount),
//     0
//   );

// /* ===== запись расхода в кассу (оставляем как было: сумма всего фонда) ===== */
// const upsertPayoutExpense = async (periodLabel, amountSom) => {
//   if (!amountSom || amountSom <= 0) return;

//   let cashboxId = null;
//   try {
//     const { data } = await api.get(CASHBOXES_EP, {
//       params: { page_size: 200 },
//     });
//     const boxes = asArray(data);
//     if (boxes.length) cashboxId = boxes[0]?.id || boxes[0]?.uuid || null;
//   } catch (e) {
//     console.error(e);
//   }

//   let existing = null;
//   try {
//     const { data } = await api.get(CASHFLOWS_EP, {
//       params: { page_size: 200 },
//     });
//     const flows = asArray(data);
//     const label = `Выплаты мастерам ${periodLabel}`;
//     existing = flows.find((cf) => {
//       const type = String(
//         cf?.type ?? cf?.kind ?? cf?.direction ?? ""
//       ).toLowerCase();
//       const desc = String(cf?.description ?? cf?.note ?? cf?.comment ?? "");
//       return desc.includes(label) && type === "expense";
//     });
//   } catch (e) {
//     console.error(e);
//   }

//   const payload = {
//     type: "expense",
//     amount: String(amountSom),
//     description: `Выплаты мастерам ${periodLabel}`,
//     date: `${periodLabel}-01`,
//     ...(cashboxId ? { cashbox: cashboxId } : {}),
//   };
//   try {
//     if (existing?.id) {
//       await api.put(`${CASHFLOWS_EP}${existing.id}/`, payload);
//     } else {
//       await api.post(CASHFLOWS_EP, payload);
//     }
//   } catch (e) {
//     try {
//       const alt = {
//         kind: "expense",
//         value: String(amountSom),
//         comment: `Выплаты мастерам ${periodLabel}`,
//         datetime: `${periodLabel}-01T00:00:00`,
//         ...(cashboxId ? { cashbox: cashboxId } : {}),
//       };
//       if (existing?.id) await api.put(`${CASHFLOWS_EP}${existing.id}/`, alt);
//       else await api.post(CASHFLOWS_EP, alt);
//     } catch (e2) {
//       console.error(e2);
//     }
//   }
// };

// /* ===== получить текущую (единственную) запись sale-payouts за период ===== */
// const getLastSalePayoutForPeriod = async (periodLabel) => {
//   try {
//     const { data } = await api.get(SALE_PAYOUTS_EP, {
//       params: { period: periodLabel, page_size: 200 },
//     });

//     const items = asArray(data).filter(
//       (it) => String(it.period || "") === String(periodLabel)
//     );

//     if (!items.length) return null;

//     // на всякий случай сортируем по created_at / updated_at / id
//     items.sort((a, b) => {
//       const ad = String(a.created_at || a.updated_at || "");
//       const bd = String(b.created_at || b.updated_at || "");
//       if (ad && bd && ad !== bd) return ad.localeCompare(bd);
//       return String(a.id || "").localeCompare(String(b.id || ""));
//     });

//     // последняя — самая свежая
//     return items[items.length - 1];
//   } catch (e) {
//     console.error(e);
//     return null;
//   }
// };

// /* ===== сохранение ставок + аналитика по фонду из UI ===== */
// export const persistRatesForPeriod = async (
//   periodLabel,
//   rates,
//   uiTotalFund
// ) => {
//   const tasks = [];

//   Object.entries(rates).forEach(([barberId, rec]) => {
//     const send = async (mode, amount, idKey) => {
//       if (amount === "" || amount == null) return;
//       const n = toNum(amount);
//       if (!Number.isFinite(n) || n < 0) return;

//       const payload = {
//         barber: barberId,
//         period: periodLabel,
//         mode,
//         rate: String(n),
//       };

//       const id = rec[idKey];
//       if (id) await api.put(`${RATES_EP}${id}/`, payload);
//       else await api.post(RATES_EP, payload);
//     };

//     tasks.push(send("record", rec.perRecord, "id_record"));
//     tasks.push(send("fixed", rec.fixed, "id_fixed"));
//     tasks.push(send("percent", rec.percent, "id_percent"));
//   });

//   await Promise.allSettled(tasks);

//   // обновляем ставки из бэка (id, payout и т.п.)
//   const newRates = await loadRatesForPeriod(periodLabel);

//   // новый фонд — ИЗ UI (снизу таблицы)
//   const newTotalFund = Math.round(toNum(uiTotalFund || 0));

//   // текущая запись sale-payouts за период (если есть)
//   const lastSale = await getLastSalePayoutForPeriod(periodLabel);

//   const oldTotalFund = lastSale
//     ? toNum(
//         lastSale.new_total_fund ??
//           lastSale.total ??
//           lastSale.old_total_fund ??
//           0
//       )
//     : 0;

//   const deltaRaw = newTotalFund - oldTotalFund;
//   const delta = Math.round(deltaRaw);

//   // если фонд не изменился — просто обновим кассу и выйдем
//   if (delta === 0) {
//     await upsertPayoutExpense(periodLabel, newTotalFund);
//     return newRates;
//   }

//   // одна запись на период: либо создаём, либо ОБНОВЛЯЕМ существующую
//   const salePayload = {
//     period: periodLabel,
//     old_total_fund: String(oldTotalFund.toFixed(2)),
//     new_total_fund: String(newTotalFund.toFixed(2)),
//     // total — "разница" (может быть + или -)
//     total: String(delta.toFixed(2)),
//   };

//   try {
//     if (lastSale?.id) {
//       // обновляем существующую запись за этот период
//       await api.put(`${SALE_PAYOUTS_EP}${lastSale.id}/`, salePayload);
//     } else {
//       // первой записи ещё не было — создаём
//       await api.post(SALE_PAYOUTS_EP, salePayload);
//     }
//   } catch (e) {
//     console.error(e);
//   }

//   // в кассу по-прежнему пишем финальный фонд за период
//   await upsertPayoutExpense(periodLabel, newTotalFund);

//   return newRates;
// };



// MastersPayoutsUtils.js
import api from "../../../../../../api";

/* ===== helpers ===== */
export const asArray = (d) =>
  Array.isArray(d?.results) ? d.results : Array.isArray(d) ? d : [];

export const pad2 = (n) => String(n).padStart(2, "0");

const toNum = (v) => {
  if (v === "" || v == null) return 0;
  const n = Number(String(v).replace(/[^\d.-]/g, ""));
  return Number.isFinite(n) ? n : 0;
};

/* ===== endpoints ===== */
const RATES_EP = "/barbershop/payouts/";
const CASHFLOWS_EP = "/construction/cashflows/";
const CASHBOXES_EP = "/construction/cashboxes/";
const SALE_PAYOUTS_EP = "/barbershop/sale-payouts/";

/* ===== общее: пагинация ===== */
export const fetchPaged = async (url) => {
  const acc = [];
  let next = url;
  const seen = new Set();
  while (next && !seen.has(next)) {
    seen.add(next);
    const { data } = await api.get(next);
    acc.push(...asArray(data));
    next = data?.next;
  }
  return acc;
};

/* ===== загрузка барбершоп-данных ===== */
export const loadBarbershopData = async () => {
  const [apps, emps, svcs] = await Promise.all([
    fetchPaged("/barbershop/appointments/"),
    fetchPaged("/users/employees/"),
    fetchPaged("/barbershop/services/"),
  ]);

  const normEmp = emps
    .map((e) => {
      const first = e.first_name ?? "";
      const last = e.last_name ?? "";
      const disp =
        [last, first].filter(Boolean).join(" ").trim() || e.email || "—";
      return { id: e.id, name: disp };
    })
    .sort((a, b) => a.name.localeCompare(b.name, "ru"));

  const normSvc = svcs.map((s) => ({
    id: s.id,
    name: s.service_name || s.name || "—",
    price: s.price,
  }));

  return {
    appointments: apps,
    employees: normEmp,
    services: normSvc,
  };
};

/* ===== ставки за период ===== */
export const loadRatesForPeriod = async (periodLabel) => {
  const { data } = await api.get(RATES_EP, {
    params: { period: periodLabel, page_size: 1000 },
  });

  const items = asArray(data);
  const map = {};

  items.forEach((r) => {
    const barberId = r.barber || r.barber_id;
    if (!barberId) return;

    const mode = String(r.mode || "").toLowerCase();
    const rateVal = r.rate ?? r.amount ?? null;
    const id = r.id;

    const rec = (map[barberId] = map[barberId] || {});

    if (rec.completed == null) rec.completed = toNum(r.appointments_count);
    if (rec.revenue == null) rec.revenue = toNum(r.total_revenue);
    if (rec.payout == null) rec.payout = toNum(r.payout_amount);

    if (mode === "record") {
      rec.id_record = id;
      rec.perRecord = toNum(rateVal);
    } else if (mode === "fixed") {
      rec.id_fixed = id;
      rec.fixed = toNum(rateVal);
    } else if (mode === "percent") {
      rec.id_percent = id;
      rec.percent = toNum(rateVal);
    }
  });

  return map;
};

const calcPayoutTotalForPeriod = (ratesMap) =>
  Object.values(ratesMap || {}).reduce(
    (sum, r) => sum + toNum(r.payout ?? r.payout_amount),
    0
  );

/* ===== запись расхода в кассу (сумма всего фонда) ===== */
const upsertPayoutExpense = async (periodLabel, amountSom) => {
  if (!amountSom || amountSom <= 0) return;

  let cashboxId = null;
  try {
    const { data } = await api.get(CASHBOXES_EP, {
      params: { page_size: 200 },
    });
    const boxes = asArray(data);
    if (boxes.length) cashboxId = boxes[0]?.id || boxes[0]?.uuid || null;
  } catch (e) {
    console.error(e);
  }

  let existing = null;
  try {
    const { data } = await api.get(CASHFLOWS_EP, {
      params: { page_size: 200 },
    });
    const flows = asArray(data);
    const label = `Выплаты мастерам ${periodLabel}`;
    existing = flows.find((cf) => {
      const type = String(
        cf?.type ?? cf?.kind ?? cf?.direction ?? ""
      ).toLowerCase();
      const desc = String(cf?.description ?? cf?.note ?? cf?.comment ?? "");
      return desc.includes(label) && type === "expense";
    });
  } catch (e) {
    console.error(e);
  }

  const payload = {
    type: "expense",
    amount: String(amountSom),
    description: `Выплаты мастерам ${periodLabel}`,
    date: `${periodLabel}-01`,
    ...(cashboxId ? { cashbox: cashboxId } : {}),
  };

  try {
    if (existing?.id) {
      await api.put(`${CASHFLOWS_EP}${existing.id}/`, payload);
    } else {
      await api.post(CASHFLOWS_EP, payload);
    }
  } catch (e) {
    // fallback под другую схему полей
    try {
      const alt = {
        kind: "expense",
        value: String(amountSom),
        comment: `Выплаты мастерам ${periodLabel}`,
        datetime: `${periodLabel}-01T00:00:00`,
        ...(cashboxId ? { cashbox: cashboxId } : {}),
      };
      if (existing?.id) await api.put(`${CASHFLOWS_EP}${existing.id}/`, alt);
      else await api.post(CASHFLOWS_EP, alt);
    } catch (e2) {
      console.error(e2);
    }
  }
};

/* ===== получить текущую (последнюю) запись sale-payouts за период ===== */
const getLastSalePayoutForPeriod = async (periodLabel) => {
  try {
    const { data } = await api.get(SALE_PAYOUTS_EP, {
      params: { period: periodLabel, page_size: 200 },
    });

    const items = asArray(data).filter(
      (it) => String(it.period || "") === String(periodLabel)
    );

    if (!items.length) return null;

    // сортируем по created_at / updated_at / id
    items.sort((a, b) => {
      const ad = String(a.created_at || a.updated_at || "");
      const bd = String(b.created_at || b.updated_at || "");
      if (ad && bd && ad !== bd) return ad.localeCompare(bd);
      return String(a.id || "").localeCompare(String(b.id || ""));
    });

    // последняя — самая свежая
    return items[items.length - 1];
  } catch (e) {
    console.error(e);
    return null;
  }
};

/* ===== сохранение ставок + фонд из UI ===== */
export const persistRatesForPeriod = async (
  periodLabel,
  rates,
  uiTotalFund
) => {
  const tasks = [];

  // 1) сохраняем ставки мастеров
  Object.entries(rates || {}).forEach(([barberId, rec]) => {
    const send = async (mode, amount, idKey) => {
      if (amount === "" || amount == null) return;
      const n = toNum(amount);
      if (!Number.isFinite(n) || n < 0) return;

      const payload = {
        barber: barberId,
        period: periodLabel,
        mode,
        rate: String(n),
      };

      const id = rec[idKey];
      if (id) {
        await api.put(`${RATES_EP}${id}/`, payload);
      } else {
        await api.post(`${RATES_EP}`, payload);
      }
    };

    tasks.push(send("record", rec.perRecord, "id_record"));
    tasks.push(send("fixed", rec.fixed, "id_fixed"));
    tasks.push(send("percent", rec.percent, "id_percent"));
  });

  await Promise.allSettled(tasks);

  // 2) обновляем ставки из бэка
  const newRates = await loadRatesForPeriod(periodLabel);

  // 3) новый фонд из UI
  const newTotalFund = Math.round(toNum(uiTotalFund || 0));

  // 4) берём ПОСЛЕДНЮЮ запись за период
  const lastSale = await getLastSalePayoutForPeriod(periodLabel);

  // старый фонд = прошлый new_total_fund (если не было – 0)
  const oldTotalFund = lastSale
    ? Math.round(
        toNum(
          lastSale.new_total_fund ??
            lastSale.old_total_fund ??
            0
        )
      )
    : 0;

  // 5) Δ = НОВЫЙ - СТАРЫЙ (всегда так!)
  const delta = Math.round(newTotalFund - oldTotalFund);

  // 6) payload для одной записи за период
  const salePayload = {
    period: periodLabel,
    old_total_fund: oldTotalFund.toFixed(2),
    new_total_fund: newTotalFund.toFixed(2),
    total: delta.toFixed(2), // может быть + или -
  };

  try {
    if (lastSale?.id) {
      // если уже была запись за период → ОБНОВЛЯЕМ
      await api.put(`${SALE_PAYOUTS_EP}${lastSale.id}/`, salePayload);
    } else {
      // если не было → СОЗДАЁМ ПЕРВУЮ
      await api.post(SALE_PAYOUTS_EP, salePayload);
    }
  } catch (e) {
    console.error(e);
  }

  // 7) в кассу пишем итоговый фонд за период
  await upsertPayoutExpense(periodLabel, newTotalFund);

  return newRates;
};

