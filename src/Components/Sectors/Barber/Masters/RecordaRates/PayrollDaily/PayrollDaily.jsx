// PayrollDaily.jsx
import React, { useEffect, useMemo, useState } from "react";
import "./PayrollDaily.scss";
import api from "../../../../../../api/index.js";

import { PayrollDailyHeader, PayrollDailyTable } from "./components";
import PayrollDailyDetailsModal from "./PayrollDailyDetailsModal.jsx";
import {
  todayStr,
  toDate,
  monthLabelOf,
  asArray,
  toNum,
  fmtMoney,
  isCompleted,
} from "./PayrollDailyUtils.js";

const PayrollDaily = () => {
  const [date, setDate] = useState(todayStr());
  const [employees, setEmployees] = useState([]);
  const [services, setServices] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [rates, setRates] = useState({});
  const [fltEmployee, setFltEmployee] = useState("");
  const [loading, setLoading] = useState(true);
  const [errMsg, setErrMsg] = useState("");
  const [modal, setModal] = useState({ open: false, title: "", rows: [] });

  const fetchPaged = async (url) => {
    const acc = [];
    let next = url;
    const seen = new Set();
    while (next && !seen.has(next)) {
      try {
        seen.add(next);
        const { data } = await api.get(next);
        acc.push(...asArray(data));
        next = data?.next;
      } catch {
        break;
      }
    }
    return acc;
  };

  const loadAll = async (curDate) => {
    setLoading(true);
    setErrMsg("");
    try {
      const [emps, svcs, apps] = await Promise.all([
        fetchPaged("/users/employees/"),
        fetchPaged("/barbershop/services/"),
        fetchPaged("/barbershop/appointments/"),
      ]);

      const normEmp = emps
        .map((e) => {
          const first = e.first_name ?? "";
          const last = e.last_name ?? "";
          const name =
            [last, first].filter(Boolean).join(" ").trim() || e.email || "—";
          return { id: e.id, label: name, search: name };
        })
        .sort((a, b) => a.label.localeCompare(b.label, "ru"));

      const normSvc = svcs.map((s) => ({
        id: s.id,
        name: s.service_name || s.name || "",
        price: toNum(s.price),
      }));

      setEmployees(normEmp);
      setServices(normSvc);

      const dStr = curDate || date;
      setAppointments(asArray(apps).filter((a) => toDate(a.start_at) === dStr));
    } catch {
      setErrMsg("Не удалось загрузить данные.");
      setEmployees([]);
      setServices([]);
      setAppointments([]);
    } finally {
      setLoading(false);
    }
  };

  const loadRates = async (period) => {
    try {
      const RATES_EP = "/barbershop/payouts/";

      const safeGet = async (mode) => {
        try {
          return await api.get(RATES_EP, {
            params: { period, mode, page_size: 1000 },
          });
        } catch {
          return null;
        }
      };

      const resRecord = await safeGet("record");
      let resPercent = await safeGet("percent");
      if (!resPercent) resPercent = await safeGet("fixed");

      const map = {};

      const put = (resp, kind) =>
        (asArray(resp?.data) || []).forEach((r) => {
          const id = r.barber || r.employee || r.master;
          if (!id) return;
          map[id] = map[id] || {};
          if (kind === "record") map[id].perRecord = toNum(r.rate);
          else map[id].percent = Math.min(100, Math.max(0, toNum(r.rate)));
        });

      if (resRecord) put(resRecord, "record");
      if (resPercent) put(resPercent, "percent");

      setRates(map);
    } catch {
      setRates({});
    }
  };

  useEffect(() => {
    const period = monthLabelOf(date);
    loadAll(date);
    loadRates(period);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date]);

  const serviceById = (id) => services.find((s) => String(s.id) === String(id));

  const priceOfAppointment = (a) => toNum(a.price);

  const clientName = (a) =>
    a.client_name || a.client || a.customer || a.client_id || "—";

  const serviceNames = (a) =>
    Array.isArray(a.services) && a.services.length
      ? a.services
          .map((s) =>
            typeof s === "object"
              ? s.name || s.service_name
              : serviceById(s)?.name
          )
          .filter(Boolean)
          .join(", ")
      : a.service_name || serviceById(a.service)?.name || "—";

  const timeRange = (a) => {
    const t = (iso) => {
      const d = new Date(iso);
      if (Number.isNaN(d.getTime())) return "—";
      return `${String(d.getHours()).padStart(2, "0")}:${String(
        d.getMinutes()
      ).padStart(2, "0")}`;
    };
    return `${t(a.start_at)}–${t(a.end_at)}`;
  };

  const completedByEmp = useMemo(() => {
    const map = new Map();

    appointments
      .filter((a) => isCompleted(a?.status))
      .forEach((a) => {
        const key = String(a.barber || a.employee || a.master || "");
        if (!key) return;

        const row = map.get(key) || {
          id: key,
          name:
            employees.find((e) => String(e.id) === key)?.label || `ID ${key}`,
          records: 0,
          revenue: 0,
          details: [],
        };

        row.records += 1;
        const amount = priceOfAppointment(a);
        row.revenue += amount;
        row.details.push({
          id: a.id,
          time: timeRange(a),
          client: clientName(a),
          services: serviceNames(a),
          amount,
        });
        map.set(key, row);
      });

    return [...map.values()];
  }, [appointments, employees, services]);

  const withPayout = useMemo(
    () =>
      completedByEmp
        .map((row) => {
          const r = rates[row.id] || {};
          const percent = Math.min(100, Math.max(0, toNum(r.percent)));
          const perRecord = toNum(r.perRecord);
          const mode = percent > 0 ? "percent" : "record";
          const rateLabel =
            percent > 0 ? `${percent}%` : `${fmtMoney(perRecord)}`;
          const payout =
            percent > 0
              ? Math.round((row.revenue * percent) / 100)
              : perRecord * row.records;
          return { ...row, mode, rateLabel, payout };
        })
        .filter((r) =>
          fltEmployee ? String(r.id) === String(fltEmployee) : true
        )
        .sort((a, b) => b.payout - a.payout || b.revenue - a.revenue),
    [completedByEmp, rates, fltEmployee]
  );

  const totals = useMemo(
    () => ({
      records: withPayout.reduce((s, r) => s + r.records, 0),
      revenue: withPayout.reduce((s, r) => s + r.revenue, 0),
      payout: withPayout.reduce((s, r) => s + r.payout, 0),
    }),
    [withPayout]
  );

  const openDetails = (row) =>
    setModal({
      open: true,
      title: `${row.name} — ${date}`,
      rows: row.details.sort((a, b) => (a.time > b.time ? 1 : -1)),
    });

  const closeDetails = () => setModal((m) => ({ ...m, open: false }));

  const exportCsv = () => {
    try {
      const header = [
        "Дата",
        "Мастер",
        "Записей",
        "Выручка",
        "Режим",
        "Ставка/Процент",
        "К выплате",
      ];
      const lines = [header.join(",")];

      withPayout.forEach((r) =>
        lines.push(
          [
            date,
            `"${r.name.replace(/"/g, '""')}"`,
            r.records,
            r.revenue,
            r.mode === "percent" ? "Процент" : "Ставка",
            `"${r.rateLabel}"`,
            r.payout,
          ].join(",")
        )
      );

      lines.push(
        [
          "ИТОГО",
          "",
          totals.records,
          totals.revenue,
          "",
          "",
          totals.payout,
        ].join(",")
      );

      const csv = "\uFEFF" + lines.join("\n");
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `payroll_${date}.csv`;
      document.body.appendChild(a);
      a.click();
      URL.revokeObjectURL(url);
      a.remove();
    } catch {
      // ignore
    }
  };

  const employeeOptions = useMemo(
    () => [
      { value: "", label: "Все сотрудники" },
      ...employees.map((e) => ({ value: String(e.id), label: e.label })),
    ],
    [employees]
  );

  const handleRefresh = () => {
    loadAll(date);
    loadRates(monthLabelOf(date));
  };

  return (
    <div className="barberpayrolldaily">
      <PayrollDailyHeader
        date={date}
        onChangeDate={setDate}
        employeeOptions={employeeOptions}
        selectedEmployee={fltEmployee}
        onChangeEmployee={(val) => setFltEmployee(String(val))}
        onRefresh={handleRefresh}
        onExport={exportCsv}
        loading={loading}
        totals={totals}
        masterCount={withPayout.length}
      />

      {errMsg && <div className="barberpayrolldaily__alert">{errMsg}</div>}

      <PayrollDailyTable
        rows={withPayout}
        totals={totals}
        loading={loading}
        onOpenDetails={openDetails}
      />

      <PayrollDailyDetailsModal
        open={modal.open}
        title={modal.title}
        rows={modal.rows}
        onClose={closeDetails}
      />
    </div>
  );
};

export default PayrollDaily;
