import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
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
  COUNTERPARTY_TYPES,
} from "./constants";
import { getAgentDisplay } from "./utils";
import ReactPortal from "../../../common/Portal/ReactPortal";

/** Показывать колонку «Агент» для владельца и админа */
const showAgentColumn = (profile) =>
  profile?.role === "owner" || profile?.role === "admin";

const toDateInputValue = (date) => {
  if (!date) return "";
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return "";
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
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
  const [period, setPeriod] = useState(() => {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    return {
      from: toDateInputValue(monthStart),
      to: toDateInputValue(now),
    };
  });
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [viewMode, setViewMode] = useState(() => {
    if (typeof window === "undefined") return VIEW_MODES.TABLE;
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === VIEW_MODES.TABLE || saved === VIEW_MODES.CARDS) return saved;
    const isSmall = window.matchMedia("(max-width: 1199px)").matches;
    return isSmall ? VIEW_MODES.CARDS : VIEW_MODES.TABLE;
  });

  // Хуки для управления данными
  const { searchTerm, debouncedSearchTerm, setSearchTerm } = useSearch();
  const [searchParams] = useSearchParams();

  // Получаем текущую страницу из URL
  const currentPageFromUrl = useMemo(
    () => parseInt(searchParams.get("page") || "1", 10),
    [searchParams]
  );

  // Параметры запроса (type не передаём — фильтруем на фронте, чтобы BOTH был в обеих вкладках)
  const requestParams = useMemo(() => {
    const params = {
      page: currentPageFromUrl,
      ...filters,
    };
    if (debouncedSearchTerm?.trim()) {
      params.search = debouncedSearchTerm.trim();
    }
    if (period.from) {
      params.period_start = period.from;
      params.date_from = period.from;
    }
    if (period.to) {
      params.period_end = period.to;
      params.date_to = period.to;
    }
    return params;
  }, [currentPageFromUrl, filters, debouncedSearchTerm, period.from, period.to]);

  // Загрузка контрагентов
  const {
    counterparties: rawCounterparties,
    loading,
    count,
    next,
    previous,
  } = useCounterpartyData(requestParams);

  // Фильтр по вкладке: Клиент — CLIENT и BOTH, Поставщик — SUPPLIER и BOTH
  const counterparties = useMemo(() => {
    if (!Array.isArray(rawCounterparties)) return [];
    const allowedTypes =
      typeTab === TYPE_TABS.CLIENT
        ? [COUNTERPARTY_TYPES.CLIENT, COUNTERPARTY_TYPES.BOTH]
        : [COUNTERPARTY_TYPES.SUPPLIER, COUNTERPARTY_TYPES.BOTH];
    return rawCounterparties.filter((c) => allowedTypes.includes(c?.type));
  }, [rawCounterparties, typeTab]);

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

  // Хук для пагинации с реальными данными
  const {
    currentPage,
    totalPages,
    hasNextPage,
    hasPrevPage,
    getRowNumber,
    handlePageChange: handlePageChangeBase,
    resetToFirstPage,
  } = usePagination(count, next, previous);

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
        <div className="counterparties-period-filter">
          <label
            htmlFor="counterparties-period-from"
            className="counterparties-period-filter__label"
          >
            Период:
          </label>
          <input
            id="counterparties-period-from"
            type="date"
            className="counterparties-period-filter__input"
            value={period.from}
            onChange={(e) =>
              setPeriod((prev) => ({ ...prev, from: e.target.value }))
            }
            max={period.to || undefined}
          />
          <span className="counterparties-period-filter__dash">-</span>
          <input
            id="counterparties-period-to"
            type="date"
            className="counterparties-period-filter__input"
            value={period.to}
            onChange={(e) => setPeriod((prev) => ({ ...prev, to: e.target.value }))}
            min={period.from || undefined}
          />
        </div>
      </section>

      <CounterpartySearchSection
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        viewMode={viewMode}
        onViewModeChange={handleViewModeChange}
        count={count}
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
              counterparties={filteredCounterparties}
              loading={loading}
              onCounterpartyClick={handleCounterpartyClick}
              getRowNumber={getRowNumber}
              showAgentColumn={showAgent}
            />
          </div>
        ) : (
          <div className="counterparties-cards-wrap">
            <CounterpartyCards
              counterparties={filteredCounterparties}
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
            count={count}
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
