import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { UserCircle, Package, Users, Filter } from "lucide-react";
import "./Counterparties.scss";
import CounterpartyHeader from "./components/CounterpartyHeader";
import CounterpartySearchSection from "./components/CounterpartySearchSection";
import CounterpartyTable from "./components/CounterpartyTable";
import CounterpartyCards from "./components/CounterpartyCards";
import Pagination from "./components/Pagination";
import CreateCounterpartyModal from "./components/CreateCounterpartyModal";
import { useUser } from "../../../../store/slices/userSlice";
import { useSearch } from "./hooks/useSearch";
import { usePagination } from "./hooks/usePagination";
import { useCounterpartyData } from "./hooks/useCounterpartyData";
import {
  STORAGE_KEY,
  VIEW_MODES,
  TYPE_TABS,
  TYPE_TAB_LABELS,
  PAGE_SIZE,
  getCounterpartyTypesForTab,
  filterCounterpartiesByTypeTab,
} from "./constants";
import { getAgentDisplay } from "./utils";
import ReactPortal from "../../../common/Portal/ReactPortal";
import CounterpartyBalanceBar from "./components/CounterpartyBalanceBar";
import warehouseAPI from "../../../../api/warehouse";

/** Показывать колонку «Агент» для владельца и админа */
const showAgentColumn = (profile) =>
  profile?.role === "owner" || profile?.role === "admin";

// --- Период: месяц / год / кастом ---
const pad2 = (n) => String(n).padStart(2, "0");
const currentYM = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
};
/** Диапазон месяца "YYYY-MM" → { from: 1-е число, to: последнее число }. */
const monthRange = (ym) => {
  const [y, m] = (ym || currentYM()).split("-").map(Number);
  const last = new Date(y, m, 0).getDate();
  return { from: `${y}-${pad2(m)}-01`, to: `${y}-${pad2(m)}-${pad2(last)}` };
};
const yearRange = (y) => ({ from: `${y}-01-01`, to: `${y}-12-31` });
const normalizeBalanceSummary = (data) => {
  const g = (x) => ({
    debit: Number(x?.debit) || 0,
    credit: Number(x?.credit) || 0,
  });
  return {
    opening: g(data?.opening),
    turnover: g(data?.turnover),
    closing: g(data?.closing),
  };
};

const Counterparties = () => {
  const navigate = useNavigate();
  const { profile } = useUser() || {};
  const showAgent = showAgentColumn(profile);

  // Вкладка типа: клиент / поставщик
  const [typeTab, setTypeTab] = useState(TYPE_TABS.CLIENT);
  // Фильтр по агенту: "" = все, "__no_agent__" = без агента, иначе uuid агента
  const [agentFilter, setAgentFilter] = useState("");

  // Состояние фильтров и модальных окон
  const [filters, setFilters] = useState({});
  // Период: по умолчанию текущий месяц (от начала до конца месяца)
  const [periodMode, setPeriodMode] = useState("month"); // month | year | custom
  const [monthValue, setMonthValue] = useState(currentYM);
  const [yearValue, setYearValue] = useState(() =>
    String(new Date().getFullYear()),
  );
  const [customRange, setCustomRange] = useState(() => monthRange(currentYM()));
  const [summary, setSummary] = useState(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [viewMode, setViewMode] = useState(() => {
    if (typeof window === "undefined") return VIEW_MODES.TABLE;
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === VIEW_MODES.TABLE || saved === VIEW_MODES.CARDS) return saved;
    const isSmall = window.matchMedia("(max-width: 1199px)").matches;
    return isSmall ? VIEW_MODES.CARDS : VIEW_MODES.TABLE;
  });

  // Итоговый диапазон дат из выбранного режима периода
  const period = useMemo(() => {
    if (periodMode === "month") return monthRange(monthValue);
    if (periodMode === "year") return yearRange(yearValue);
    return customRange;
  }, [periodMode, monthValue, yearValue, customRange]);

  // Хуки для управления данными
  const { searchTerm, debouncedSearchTerm, setSearchTerm } = useSearch();
  const requestParams = useMemo(() => {
    const params = {
      ...filters,
      _counterpartyTypes: getCounterpartyTypesForTab(typeTab),
    };
    if (debouncedSearchTerm?.trim()) {
      params.search = debouncedSearchTerm.trim();
    }
    if (period.from && period.to) {
      params._periodRange = { from: period.from, to: period.to };
    }
    return params;
  }, [typeTab, filters, debouncedSearchTerm, period.from, period.to]);

  // Загрузка контрагентов
  const { counterparties: rawCounterparties, loading } =
    useCounterpartyData(requestParams);

  const counterparties = useMemo(
    () => filterCounterpartiesByTypeTab(rawCounterparties, typeTab),
    [rawCounterparties, typeTab]
  );

  // Список уникальных агентов с текущей страницы (для выбора в фильтре)
  const agentOptions = useMemo(() => {
    if (!showAgent || !Array.isArray(counterparties)) return [];
    const seen = new Set();
    const options = [
      { value: "", label: "Все агенты" },
      { value: "__no_agent__", label: "Без агента" },
    ];
    counterparties.forEach((c) => {
      const key = c?.agent ?? "__no_agent__";
      if (key !== "__no_agent__" && !seen.has(key)) {
        seen.add(key);
        options.push({ value: key, label: getAgentDisplay(c) });
      }
    });
    return options;
  }, [showAgent, counterparties]);

  // Фильтрация по выбранному агенту (плоский список)
  const filteredCounterparties = useMemo(() => {
    if (!agentFilter) return counterparties;
    if (agentFilter === "__no_agent__") {
      return counterparties.filter((c) => !c?.agent);
    }
    return counterparties.filter((c) => c?.agent === agentFilter);
  }, [counterparties, agentFilter]);

  const {
    currentPage,
    totalPages,
    getRowNumber,
    handlePageChange: handlePageChangeBase,
    resetToFirstPage,
  } = usePagination(filteredCounterparties.length, null, null);

  const hasNextPage = currentPage < totalPages;
  const hasPrevPage = currentPage > 1;

  const pageCounterparties = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredCounterparties.slice(start, start + PAGE_SIZE);
  }, [filteredCounterparties, currentPage]);

  // Сброс на первую страницу при изменении поиска или вкладки типа
  useEffect(() => {
    resetToFirstPage();
  }, [debouncedSearchTerm, resetToFirstPage]);

  useEffect(() => {
    resetToFirstPage();
  }, [typeTab]);

  useEffect(() => {
    setAgentFilter("");
  }, [typeTab]);

  useEffect(() => {
    resetToFirstPage();
  }, [period.from, period.to, resetToFirstPage]);

  // Загрузка сводных показателей (Сальдо/Оборот) за период по типу контрагента
  useEffect(() => {
    if (!period.from || !period.to) return undefined;
    let cancelled = false;
    setSummaryLoading(true);
    warehouseAPI
      .getCounterpartiesBalanceSummary({
        type: typeTab,
        date_from: period.from,
        date_to: period.to,
      })
      .then((data) => {
        if (!cancelled) setSummary(data ? normalizeBalanceSummary(data) : null);
      })
      .catch(() => {
        if (!cancelled) setSummary(null);
      })
      .finally(() => {
        if (!cancelled) setSummaryLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [typeTab, period.from, period.to]);

  // Сохранение режима просмотра
  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY, viewMode);
    }
  }, [viewMode]);

  // Обработчики событий
  const handleCounterpartyClick = useCallback(
    (counterparty) => {
      navigate(`/crm/warehouse/counterparties/${counterparty.id}`);
    },
    [navigate]
  );

  const handlePageChange = useCallback(
    (newPage) => {
      handlePageChangeBase(newPage);
    },
    [handlePageChangeBase]
  );

  const handleCreateCounterparty = useCallback(() => {
    setShowCreateModal(true);
  }, []);

  const handleViewModeChange = useCallback((mode) => {
    setViewMode(mode);
  }, []);

  const typeTabConfig = [
    {
      key: TYPE_TABS.CLIENT,
      label: TYPE_TAB_LABELS[TYPE_TABS.CLIENT],
      icon: UserCircle,
    },
    {
      key: TYPE_TABS.SUPPLIER,
      label: TYPE_TAB_LABELS[TYPE_TABS.SUPPLIER],
      icon: Package,
    },
  ];

  return (
    <div className="warehouse-page counterparties-page">
      <CounterpartyHeader onCreateCounterparty={handleCreateCounterparty} />

      <section className="counterparties-toolbar">
        <div
          className="counterparties-type-tabs"
          role="tablist"
          aria-label="Тип контрагента"
        >
          {typeTabConfig.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={typeTab === key}
              className={`counterparties-type-tabs__btn ${
                typeTab === key ? "counterparties-type-tabs__btn--active" : ""
              }`}
              onClick={() => setTypeTab(key)}
            >
              <Icon size={18} aria-hidden />
              <span>{label}</span>
            </button>
          ))}
        </div>
        {showAgent && (
          <div className="counterparties-agent-filter">
            <Filter
              size={16}
              className="counterparties-agent-filter__icon"
              aria-hidden
            />
            <label
              htmlFor="counterparties-agent-select"
              className="counterparties-agent-filter__label"
            >
              Агент
            </label>
            <select
              id="counterparties-agent-select"
              className="counterparties-agent-filter__select"
              value={agentFilter}
              onChange={(e) => setAgentFilter(e.target.value)}
              aria-label="Фильтр по агенту"
            >
              {agentOptions.map((opt) => (
                <option key={opt.value || "all"} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        )}
      </section>

      <CounterpartyBalanceBar
        mode={periodMode}
        onModeChange={setPeriodMode}
        monthValue={monthValue}
        onMonthChange={setMonthValue}
        yearValue={yearValue}
        onYearChange={setYearValue}
        customRange={customRange}
        onCustomChange={setCustomRange}
        period={period}
        summary={summary}
        loading={summaryLoading}
      />

      <CounterpartySearchSection
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        viewMode={viewMode}
        onViewModeChange={handleViewModeChange}
        count={filteredCounterparties.length}
        foundCount={filteredCounterparties.length}
      />

      <div className="counterparties-content">
        {loading && counterparties.length === 0 ? (
          <div className="counterparties-loading">
            <div className="counterparties-loading__spinner" aria-hidden />
            <p className="counterparties-loading__text">
              Загрузка контрагентов...
            </p>
          </div>
        ) : filteredCounterparties.length === 0 ? (
          <div className="counterparties-empty">
            <Users
              size={48}
              className="counterparties-empty__icon"
              aria-hidden
            />
            <p className="counterparties-empty__title">
              Контрагенты не найдены
            </p>
            <p className="counterparties-empty__hint">
              {agentFilter
                ? "По выбранному агенту никого нет. Выберите «Все агенты» или другого агента."
                : searchTerm.trim()
                ? "Попробуйте изменить запрос или вкладку (Клиент / Поставщик)"
                : "Добавьте контрагента кнопкой «Создать контрагента»"}
            </p>
          </div>
        ) : viewMode === VIEW_MODES.TABLE ? (
          <div className="counterparties-table-wrap">
            <CounterpartyTable
              counterparties={pageCounterparties}
              loading={loading}
              onCounterpartyClick={handleCounterpartyClick}
              getRowNumber={getRowNumber}
              showAgentColumn={showAgent}
            />
          </div>
        ) : (
          <div className="counterparties-cards-wrap">
            <CounterpartyCards
              counterparties={pageCounterparties}
              loading={loading}
              onCounterpartyClick={handleCounterpartyClick}
              getRowNumber={getRowNumber}
              showAgentColumn={showAgent}
            />
          </div>
        )}

        {filteredCounterparties.length > 0 && (
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            count={filteredCounterparties.length}
            loading={loading}
            hasNextPage={hasNextPage}
            hasPrevPage={hasPrevPage}
            onPageChange={handlePageChange}
          />
        )}
      </div>

      {showCreateModal && (
        <ReactPortal wrapperId="create_counter_modal">
          <CreateCounterpartyModal onClose={() => setShowCreateModal(false)} />
        </ReactPortal>
      )}
    </div>
  );
};

export default Counterparties;
