// MastersPayouts.jsx
import React, { useEffect, useState } from "react";
import "./MastersPayouts.scss";
import api from "../../../../api";
import RecordaRates from "./RecordaRates/RecordaRates";

/* ===== helpers ===== */
const asArray = (d) =>
  Array.isArray(d?.results) ? d.results : Array.isArray(d) ? d : [];
const pad2 = (n) => String(n).padStart(2, "0");
const toNum = (v) => {
  if (v === "" || v == null) return 0;
  const n = Number(String(v).replace(/[^\d.-]/g, ""));
  return Number.isFinite(n) ? n : 0;
};

/* ===== endpoints ===== */
const RATES_EP = "/barbershop/payouts/";
const CASHFLOWS_EP = "/construction/cashflows/";
const CASHBOXES_EP = "/construction/cashboxes/";

const MastersPayouts = () => {
  const now = new Date();

  const [appointments, setAppointments] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [services, setServices] = useState([]);

  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());

  const periodLabel = `${year}-${pad2(month)}`;

  /* ===== ставки ===== */
  const [ratesLoading, setRatesLoading] = useState(false);
  const [ratesError, setRatesError] = useState("");
  // { [barberId]: { id_record?, id_fixed?, id_percent?, perRecord, fixed, percent, completed, revenue, payout } }
  const [rates, setRates] = useState({});

  const calcPayoutTotalForPeriod = (ratesMap) =>
    Object.values(ratesMap || {}).reduce(
      (sum, r) => sum + toNum(r.payout ?? r.payout_amount),
      0
    );

  const loadRates = async () => {
    setRatesLoading(true);
    setRatesError("");
    try {
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

        if (rec.completed == null)
          rec.completed = toNum(r.appointments_count);
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

      setRates(map);
      return map;
    } catch (e) {
      console.error(e);
      setRates({});
      setRatesError("Не удалось загрузить ставки мастеров.");
      return {};
    } finally {
      setRatesLoading(false);
    }
  };

  const setRateValue = (barberId, field, value) => {
    const raw = String(value).trim();
    if (raw === "") {
      setRates((prev) => ({
        ...prev,
        [barberId]: { ...(prev[barberId] || {}), [field]: "" },
      }));
      return;
    }
    const n = Number(raw);
    if (!Number.isFinite(n) || n < 0) return;
    setRates((prev) => ({
      ...prev,
      [barberId]: { ...(prev[barberId] || {}), [field]: n },
    }));
  };

  /* ==== запись расхода в кассу ==== */
  const upsertPayoutExpense = async (amountSom) => {
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
        const amt = toNum(cf?.amount ?? cf?.value ?? cf?.sum);
        return desc.includes(label) && (type === "expense" || amt < 0);
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

  const persistRates = async () => {
    setRatesLoading(true);
    setRatesError("");
    try {
      const tasks = [];

      Object.entries(rates).forEach(([barberId, rec]) => {
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
          if (id) await api.put(`${RATES_EP}${id}/`, payload);
          else await api.post(RATES_EP, payload);
        };

        tasks.push(send("record", rec.perRecord, "id_record"));
        tasks.push(send("fixed", rec.fixed, "id_fixed"));
        tasks.push(send("percent", rec.percent, "id_percent"));
      });

      await Promise.allSettled(tasks);

      const newRates = await loadRates();
      const payoutTotalSom = calcPayoutTotalForPeriod(newRates);

      await upsertPayoutExpense(payoutTotalSom);
    } catch (e) {
      console.error(e);
      setRatesError("Не удалось сохранить ставки мастеров.");
    } finally {
      setRatesLoading(false);
    }
  };

  /* ===== данные барбершопа для аналитики выплат ===== */
  const fetchPaged = async (url) => {
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

  const loadAll = async () => {
    try {
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

      setAppointments(apps);
      setEmployees(normEmp);
      setServices(normSvc);

      await loadRates();
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setRates({});
    setRatesError("");
    loadRates();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year, month]);

// MastersPayouts.jsx (кусок return)
return (
  <div className="masterspayouts">
    <div className="masterspayouts__inner">
      <RecordaRates
        year={year}
        month={month}
        onChangeYear={setYear}
        onChangeMonth={setMonth}
        employees={employees}
        appointments={appointments}
        services={services}
        rates={rates}
        ratesLoading={ratesLoading}
        ratesError={ratesError}
        onChangeRate={setRateValue}
        onSaveRates={persistRates}
      />
    </div>
  </div>
);

};

export default MastersPayouts;
