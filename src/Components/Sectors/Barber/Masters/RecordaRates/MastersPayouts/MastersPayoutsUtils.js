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

  const normEmp = emps.map((e) => {
    const first = e.first_name ?? "";
    const last = e.last_name ?? "";
    const disp =
      [last, first].filter(Boolean).join(" ").trim() || e.email || "—";
    return { id: e.id, name: disp };
  });

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

/* ===== сохранение ставок + фонда (ТОЛЬКО через sale-payouts) ===== */
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
        await api.post(RATES_EP, payload);
      }
    };

    tasks.push(send("record", rec.perRecord, "id_record"));
    tasks.push(send("fixed", rec.fixed, "id_fixed"));
    tasks.push(send("percent", rec.percent, "id_percent"));
  });

  await Promise.allSettled(tasks);

  // 2) обновляем ставки из бэка
  const newRates = await loadRatesForPeriod(periodLabel);

  // 3) фонд выплат только в /barbershop/sale-payouts/
  const totalFund = Math.round(toNum(uiTotalFund || 0));

  try {
    await api.post(SALE_PAYOUTS_EP, {
      period: periodLabel,
      new_total_fund: totalFund.toFixed(2),
    });
    // Никаких операций с /construction/cashflows/ здесь больше нет
  } catch (e) {
    console.error(e);
  }

  return newRates;
};
