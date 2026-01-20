import React, { useEffect, useMemo, useState } from "react";
import { FaSearch, FaFilter } from "react-icons/fa";
import {
  RequestCard,
  RequestDetailModal,
  FiltersModal,
  Pager,
} from "./components";
import "./Requests.scss";

// TODO: Раскомментировать когда бек будет готов
// import api from "../../../../api";
// const REQUESTS_EP = "/barbershop/online-requests/";
// const EMPLOYEES_EP = "/users/employees/";

/* ===== Status tabs config ===== */
const STATUS_TABS = [
  { value: "all", label: "Все" },
  { value: "new", label: "Новые" },
  { value: "confirmed", label: "Подтверждены" },
  { value: "no_show", label: "Не пришли" },
  { value: "spam", label: "Спам" },
];

const PAGE_SIZE = 10;

const Requests = () => {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(false);

  /* Filters */
  const [search, setSearch] = useState("");
  const [statusTab, setStatusTab] = useState("all");
  const [statusFilter, setStatusFilter] = useState("");
  const [sortBy, setSortBy] = useState("newest");
  const [masterFilter, setMasterFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);

  /* Modals */
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState(null);

  /* Master options for filter - пустой пока нет бека */
  const masterOptions = useMemo(() => {
    return [{ value: "", label: "Все мастера" }];
  }, []);

  /* Handle status change - пока локально */
  const handleStatusChange = (requestId, newStatus) => {
    setRequests((prev) =>
      prev.map((r) => (r.id === requestId ? { ...r, status: newStatus } : r))
    );
  };

  /* Filter & sort */
  const filtered = useMemo(() => {
    let result = [...requests];

    if (statusTab !== "all") {
      result = result.filter((r) => r.status === statusTab);
    }

    if (statusFilter) {
      result = result.filter((r) => r.status === statusFilter);
    }

    if (masterFilter) {
      result = result.filter((r) => String(r.master_id) === masterFilter);
    }

    if (dateFrom) {
      result = result.filter((r) => r.date >= dateFrom);
    }
    if (dateTo) {
      result = result.filter((r) => r.date <= dateTo);
    }

    const q = search.trim().toLowerCase();
    if (q) {
      result = result.filter(
        (r) =>
          (r.client_name || "").toLowerCase().includes(q) ||
          (r.client_phone || "").toLowerCase().includes(q) ||
          (r.master_name || "").toLowerCase().includes(q)
      );
    }

    result.sort((a, b) => {
      switch (sortBy) {
        case "oldest":
          return new Date(a.created_at) - new Date(b.created_at);
        case "price_desc":
          return (b.total_price || 0) - (a.total_price || 0);
        case "price_asc":
          return (a.total_price || 0) - (b.total_price || 0);
        default:
          return new Date(b.created_at) - new Date(a.created_at);
      }
    });

    return result;
  }, [requests, statusTab, statusFilter, masterFilter, dateFrom, dateTo, search, sortBy]);

  /* Counts by status */
  const counts = useMemo(() => {
    const c = { all: requests.length, new: 0, confirmed: 0, no_show: 0, spam: 0 };
    requests.forEach((r) => {
      if (c[r.status] !== undefined) c[r.status]++;
    });
    return c;
  }, [requests]);

  /* Pagination */
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  useEffect(() => {
    setPage(1);
  }, [statusTab, statusFilter, masterFilter, dateFrom, dateTo, search, sortBy]);

  /* Active filters count */
  const activeFiltersCount = [
    statusFilter,
    masterFilter,
    dateFrom,
    dateTo,
    sortBy !== "newest" ? sortBy : null,
  ].filter(Boolean).length;

  /* Clear filters */
  const handleClearFilters = () => {
    setStatusFilter("");
    setSortBy("newest");
    setMasterFilter("");
    setDateFrom("");
    setDateTo("");
  };

  /* Reset all */
  const handleReset = () => {
    setSearch("");
    setStatusTab("all");
    handleClearFilters();
    setPage(1);
    setFiltersOpen(false);
  };

  const counterText = loading
    ? "Загрузка…"
    : `${filtered.length} заявок`;

  const hasFilters = search || activeFiltersCount > 0 || statusTab !== "all";

  return (
    <div className="barberrequests">
      <div className="barberrequests__topRow">
        <span className="barberrequests__counter">{counterText}</span>
        {hasFilters && (
          <button
            type="button"
            className="barberrequests__resetBtn"
            onClick={handleReset}
          >
            Сбросить
          </button>
        )}
      </div>

      <div className="barberrequests__tabs">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.value}
            type="button"
            className={`barberrequests__tab ${
              statusTab === tab.value ? "barberrequests__tab--active" : ""
            }`}
            onClick={() => setStatusTab(tab.value)}
          >
            {tab.label}
            <span className="barberrequests__tabCount">{counts[tab.value]}</span>
          </button>
        ))}
      </div>

      <div className="barberrequests__actions">
        <div className="barberrequests__searchWrap">
          <FaSearch className="barberrequests__searchIcon" />
          <input
            className="barberrequests__searchInput"
            placeholder="Поиск по имени клиента..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="barberrequests__filtersWrap">
          <button
            type="button"
            className={`barberrequests__filtersBtn ${filtersOpen ? "is-open" : ""} ${
              activeFiltersCount > 0 ? "has-active" : ""
            }`}
            onClick={() => setFiltersOpen(true)}
          >
            <FaFilter />
            <span>Фильтры</span>
            {activeFiltersCount > 0 && (
              <span className="barberrequests__filtersBadge">{activeFiltersCount}</span>
            )}
          </button>
        </div>
      </div>

      {loading && (
        <div className="barberrequests__skeletonList">
          {[1, 2, 3].map((i) => (
            <div key={i} className="barberrequests__skeletonCard" />
          ))}
        </div>
      )}

      {!loading && filtered.length === 0 && (
        <div className="barberrequests__empty">Заявок не найдено</div>
      )}

      {!loading && filtered.length > 0 && (
        <>
          <div className="barberrequests__list">
            {paginated.map((r) => (
              <RequestCard
                key={r.id}
                request={r}
                onStatusChange={handleStatusChange}
                onClick={setSelectedRequest}
              />
            ))}
          </div>

          <Pager page={page} totalPages={totalPages} onChange={setPage} />
        </>
      )}

      <FiltersModal
        isOpen={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        statusFilter={statusFilter}
        setStatusFilter={setStatusFilter}
        sortBy={sortBy}
        setSortBy={setSortBy}
        masterFilter={masterFilter}
        setMasterFilter={setMasterFilter}
        masterOptions={masterOptions}
        dateFrom={dateFrom}
        setDateFrom={setDateFrom}
        dateTo={dateTo}
        setDateTo={setDateTo}
        onClear={handleClearFilters}
      />

      <RequestDetailModal
        request={selectedRequest}
        onClose={() => setSelectedRequest(null)}
      />
    </div>
  );
};

export default Requests;
