// CashReports.jsx
import React, { useEffect, useState, lazy, Suspense } from "react";
import "./CashReports.scss";
import api from "../../../../api";

const BarberAnalitikaLazy = lazy(() =>
  import("../BarberAnalitika/BarberAnalitika")
);

/* ===== helpers ===== */
const asArray = (d) =>
  Array.isArray(d?.results) ? d.results : Array.isArray(d) ? d : [];

/* ===== component ===== */
const CashReports = () => {
  const now = new Date();

  const [appointments, setAppointments] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [services, setServices] = useState([]);

  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());

  /* ===== данные барбершопа для аналитики ===== */
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
            [last, first].filter(Boolean).join(" ").trim() ||
            e.email ||
            "—";
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
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="barbercashreports">
      <div className="barbercashreports__kassaWrap">
        <Suspense
          fallback={<div className="barbercashreports__muted">Загрузка…</div>}
        >
          <BarberAnalitikaLazy
            year={year}
            month={month}
            onChangeYear={setYear}
            onChangeMonth={setMonth}
            appointments={appointments}
            employees={employees}
            services={services}
          />
        </Suspense>
      </div>
    </div>
  );
};

export default CashReports;
