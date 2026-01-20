// MastersHistory.jsx
import React, { useCallback, useEffect, useMemo, useState } from "react";
import "./MastersHistory.scss";
import api from "../../../../../api";
import { MastersHistoryHeader, MastersHistoryList, Pager } from "./components";
import {
  asArray,
  fullNameEmp,
  PAGE_SIZE,
  pad,
  getYMD,
  monthNames,
  clientNameOf,
  serviceNamesFromRecord,
  barberNameOf,
  dateISO,
} from "./MastersHistoryUtils";

const MastersHistory = () => {
  const [employees, setEmployees] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [services, setServices] = useState([]);
  const [clients, setClients] = useState([]);

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  /* Filters */
  const [search, setSearch] = useState("");
  const [employeeFilter, setEmployeeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [yearFilter, setYearFilter] = useState("");
  const [monthFilter, setMonthFilter] = useState("");
  const [dayFilter, setDayFilter] = useState("");
  const [viewMode, setViewMode] = useState("table");
  const [page, setPage] = useState(1);

  /* Fetch functions */
  const fetchEmployees = useCallback(
    async () => asArray((await api.get("/users/employees/")).data),
    []
  );
  const fetchAppointments = useCallback(
    async () => asArray((await api.get("/barbershop/appointments/")).data),
    []
  );
  const fetchServices = useCallback(
    async () => asArray((await api.get("/barbershop/services/")).data),
    []
  );
  const fetchClients = useCallback(
    async () => asArray((await api.get("/barbershop/clients/")).data),
    []
  );

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoading(true);
        setErr("");
        const [emps, appts, svcs, cls] = await Promise.all([
          fetchEmployees(),
          fetchAppointments(),
          fetchServices(),
          fetchClients(),
        ]);
        if (!alive) return;
        setEmployees(emps);
        setAppointments(appts);
        setServices(svcs);
        setClients(cls);
      } catch {
        if (!alive) return;
        setErr("Не удалось загрузить историю.");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [fetchEmployees, fetchAppointments, fetchServices, fetchClients]);

  /* Options for filters */
  const employeeOptions = useMemo(
    () => [
      { value: "", label: "Все сотрудники" },
      ...employees.map((e) => ({ value: String(e.id), label: fullNameEmp(e) })),
    ],
    [employees]
  );

  const yearOptions = useMemo(
    () => [
      { value: "", label: "Все годы" },
      { value: "2025", label: "2025" },
      { value: "2026", label: "2026" },
      { value: "2027", label: "2027" },
    ],
    []
  );

  const monthOptions = useMemo(
    () => [
      { value: "", label: "Все месяцы" },
      ...monthNames.map((label, idx) => ({ value: String(idx + 1), label })),
    ],
    []
  );

  const daysInMonth = useMemo(() => {
    if (!yearFilter || !monthFilter) return 31;
    const y = Number(yearFilter);
    const m = Number(monthFilter);
    if (!Number.isFinite(y) || !Number.isFinite(m)) return 31;
    return new Date(y, m, 0).getDate();
  }, [yearFilter, monthFilter]);

  const dayOptions = useMemo(
    () => [
      { value: "", label: "Все дни" },
      ...Array.from({ length: daysInMonth }).map((_, i) => ({
        value: String(i + 1),
        label: pad(i + 1),
      })),
    ],
    [daysInMonth]
  );

  /* Filtering */
  const filtered = useMemo(() => {
    let arr = appointments.slice();

    // Employee filter
    if (employeeFilter) {
      const idStr = String(employeeFilter);
      arr = arr.filter((a) => String(a.barber) === idStr);
    }

    // Status filter
    if (statusFilter !== "all") {
      arr = arr.filter(
        (a) => String(a?.status || "").toLowerCase() === statusFilter
      );
    }

    // Date filter (year/month/day)
    if (yearFilter) {
      const yStr = String(yearFilter);
      const mStr = monthFilter ? pad(Number(monthFilter)) : "";
      const dStr = dayFilter ? pad(Number(dayFilter)) : "";

      arr = arr.filter((a) => {
        const ymd = getYMD(a.start_at);
        if (!ymd) return false;
        if (String(ymd.year) !== yStr) return false;
        if (mStr && pad(ymd.month) !== mStr) return false;
        if (dStr && pad(ymd.day) !== dStr) return false;
        return true;
      });
    }

    // Search filter
    const q = search.trim().toLowerCase();
    if (q) {
      arr = arr.filter((a) => {
        const client = clientNameOf(a, clients).toLowerCase();
        const service = serviceNamesFromRecord(a, services).toLowerCase();
        const barber = barberNameOf(a, employees).toLowerCase();
        const date = dateISO(a?.start_at).toLowerCase();
        return (
          client.includes(q) ||
          service.includes(q) ||
          barber.includes(q) ||
          date.includes(q)
        );
      });
    }

    // Sort by newest first
    return arr.sort(
      (a, b) => (Date.parse(b?.start_at) || 0) - (Date.parse(a?.start_at) || 0)
    );
  }, [
    appointments,
    employeeFilter,
    statusFilter,
    yearFilter,
    monthFilter,
    dayFilter,
    search,
    clients,
    services,
    employees,
  ]);

  /* Pagination */
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));

  useEffect(() => {
    setPage(1);
  }, [search, employeeFilter, statusFilter, yearFilter, monthFilter, dayFilter]);

  useEffect(() => {
    setPage((p) => Math.min(Math.max(1, p), totalPages));
  }, [totalPages]);

  const safePage = Math.min(page, totalPages);
  const rows = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  /* Check if filters are active */
  const hasFilters =
    search || employeeFilter || statusFilter !== "all" || yearFilter;

  /* Reset all filters */
  const handleReset = () => {
    setSearch("");
    setEmployeeFilter("");
    setStatusFilter("all");
    setYearFilter("");
    setMonthFilter("");
    setDayFilter("");
    setPage(1);
  };

  /* Handlers with cascade reset */
  const handleYearChange = (val) => {
    setYearFilter(val);
    setMonthFilter("");
    setDayFilter("");
  };

  const handleMonthChange = (val) => {
    setMonthFilter(val);
    setDayFilter("");
  };

  return (
    <section className="barbermastershistory">
      <MastersHistoryHeader
        totalCount={filtered.length}
        search={search}
        statusFilter={statusFilter}
        viewMode={viewMode}
        employeeFilter={employeeFilter}
        employeeOptions={employeeOptions}
        yearFilter={yearFilter}
        monthFilter={monthFilter}
        dayFilter={dayFilter}
        yearOptions={yearOptions}
        monthOptions={monthOptions}
        dayOptions={dayOptions}
        onSearchChange={setSearch}
        onStatusChange={setStatusFilter}
        onViewModeChange={setViewMode}
        onEmployeeChange={setEmployeeFilter}
        onYearChange={handleYearChange}
        onMonthChange={handleMonthChange}
        onDayChange={setDayFilter}
        onReset={handleReset}
        hasFilters={hasFilters}
        loading={loading}
      />

      {!!err && <div className="barbermastershistory__alert">{err}</div>}

      <MastersHistoryList
        records={rows}
        employees={employees}
        services={services}
        clients={clients}
        loading={loading}
        viewMode={viewMode}
      />

      <Pager page={safePage} totalPages={totalPages} onChange={setPage} />
    </section>
  );
};

export default MastersHistory;
