// MastersHistory.jsx
import React, { useCallback, useEffect, useMemo, useState, useRef } from "react";
import "./MastersHistory.scss";
import api from "../../../../../api";
import { MastersHistoryHeader, MastersHistoryList, Pager } from "./components";
import {
  asArray,
  pad,
  monthNames,
} from "./MastersHistoryUtils";

const MastersHistory = () => {
  // Server-side query state
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [ordering, setOrdering] = useState("newest");
  const [statusFilter, setStatusFilter] = useState("all");
  const [employeeFilter, setEmployeeFilter] = useState("");
  const [yearFilter, setYearFilter] = useState("");
  const [monthFilter, setMonthFilter] = useState("");
  const [dayFilter, setDayFilter] = useState("");
  const [page, setPage] = useState(1);

  // Server-side data state
  const [appointments, setAppointments] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [appointmentsNext, setAppointmentsNext] = useState(null);
  const [appointmentsPrevious, setAppointmentsPrevious] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  // UI state
  const [viewMode, setViewMode] = useState("table");

  // Refs for request cancellation and race condition protection
  const abortControllerRef = useRef(null);
  const requestIdRef = useRef(0);
  const debounceTimerRef = useRef(null);

  // Mapping ordering UI -> API
  const getOrderingForAPI = (orderKey) => {
    switch (orderKey) {
      case "oldest":
        return "date";
      case "price_asc":
        return "total";
      case "price_desc":
        return "-total";
      case "newest":
      default:
        return "-date";
    }
  };

  // Build date range from filters
  const getDateRange = useCallback(() => {
    if (!yearFilter) return { date_start: null, date_end: null };

    const year = Number(yearFilter);
    if (!Number.isFinite(year)) return { date_start: null, date_end: null };

    let dateStart = `${year}-01-01`;
    let dateEnd = `${year}-12-31`;

    if (monthFilter) {
      const month = Number(monthFilter);
      if (Number.isFinite(month) && month >= 1 && month <= 12) {
        const daysInMonth = new Date(year, month, 0).getDate();
        dateStart = `${year}-${pad(month)}-01`;
        dateEnd = `${year}-${pad(month)}-${pad(daysInMonth)}`;

        if (dayFilter) {
          const day = Number(dayFilter);
          if (Number.isFinite(day) && day >= 1 && day <= daysInMonth) {
            dateStart = `${year}-${pad(month)}-${pad(day)}`;
            dateEnd = dateStart;
          }
        }
      }
    }

    return { date_start: dateStart, date_end: dateEnd };
  }, [yearFilter, monthFilter, dayFilter]);

  // Debounce search (400ms)
  useEffect(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      setDebouncedSearch(search);
    }, 400);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [search]);

  // Reset page to 1 when search/ordering/filters change
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, ordering, statusFilter, employeeFilter, yearFilter, monthFilter, dayFilter]);

  // Main effect for fetching appointments (server-side)
  useEffect(() => {
    // Cancel previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Create new AbortController
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    // Increment requestId for race condition protection
    const currentRequestId = ++requestIdRef.current;

    // Build query params
    const params = {};
    if (debouncedSearch.trim()) {
      params.search = debouncedSearch.trim();
    }
    const orderingAPI = getOrderingForAPI(ordering);
    if (orderingAPI) {
      params.ordering = orderingAPI;
    }
    if (page > 1) {
      params.page = page;
    }
    if (statusFilter !== "all") {
      params.status = statusFilter;
    }
    if (employeeFilter) {
      params.employee = employeeFilter;
    }

    // Add date filters
    const { date_start, date_end } = getDateRange();
    if (date_start) {
      params.date_start = date_start;
    }
    if (date_end) {
      params.date_end = date_end;
    }

    // Execute request
    setLoading(true);
    setErr("");

    api.get("/barbershop/visits/history/", {
      params,
      signal: abortController.signal,
    })
      .then((response) => {
        // Check if this is the current request
        if (currentRequestId !== requestIdRef.current) {
          return;
        }

        // Check if request was not aborted
        if (abortController.signal.aborted) {
          return;
        }

        const data = response.data;
        setAppointments(asArray(data));
        setTotalCount(data.count || 0);
        setAppointmentsNext(data.next || null);
        setAppointmentsPrevious(data.previous || null);
        setLoading(false);
      })
      .catch((error) => {
        // Check if this is the current request
        if (currentRequestId !== requestIdRef.current) {
          return;
        }

        // Ignore abort errors
        if (error.name === "CanceledError" || error.name === "AbortError") {
          return;
        }

        setErr("Не удалось загрузить историю.");
        setLoading(false);
      });

    // Cleanup function
    return () => {
      abortController.abort();
    };
  }, [debouncedSearch, ordering, page, statusFilter, employeeFilter, yearFilter, monthFilter, dayFilter, getDateRange]);

  // Options for filters
  const employeeOptions = useMemo(
    () => [
      { value: "", label: "Все сотрудники" },
      // Employee options will be populated from the appointments data
      ...Array.from(new Set(appointments.map(a => a.employee).filter(Boolean)))
        .map(name => ({ value: name, label: name }))
    ],
    [appointments]
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

  // Calculate total pages based on server data (не используем фронтовый PAGE_SIZE!)
  const totalPages = useMemo(() => {
    if (totalCount === 0) return 1;
    const pageSize = appointments.length || 1;
    if (pageSize === 0) return 1;
    // Если есть next, значит есть еще страницы
    if (appointmentsNext) {
      return Math.ceil(totalCount / pageSize);
    }
    // Если next нет, то текущая страница - последняя
    return page;
  }, [totalCount, appointments.length, appointmentsNext, page]);

  // Check if filters are active
  const hasFilters =
    search || employeeFilter || statusFilter !== "all" || yearFilter;

  // Reset all filters
  const handleReset = () => {
    setSearch("");
    setEmployeeFilter("");
    setStatusFilter("all");
    setYearFilter("");
    setMonthFilter("");
    setDayFilter("");
    setOrdering("newest");
    setPage(1);
  };

  // Handlers with cascade reset
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
        totalCount={totalCount}
        search={search}
        ordering={ordering}
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
        onOrderingChange={setOrdering}
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
        records={appointments}
        loading={loading}
        viewMode={viewMode}
      />

      <Pager page={page} totalPages={totalPages} onChange={setPage} />
    </section>
  );
};

export default MastersHistory;
