import React, {
  useState,
  useEffect,
  useMemo,
  useCallback,
  useRef,
} from "react";
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
  filterCounterpartiesByTypeTab,
} from "./constants";
import {
  counterpartyHasDebt,
  getAgentDisplay,
  getCounterpartiesLedgerTotals,
} from "./utils";
import ReactPortal from "../../../common/Portal/ReactPortal";
import CounterpartyBalanceBar from "./components/CounterpartyBalanceBar";
import { usePersistedState } from "../../../../hooks/usePersistedState";

/**
 * Ключ агента контрагента: API отдаёт agent то uuid-строкой, то объектом
 * ({ id, name }). Объекты раньше попадали в Set по ссылке — один агент
 * повторялся в фильтре столько раз, сколько у него контрагентов (QA B17).
 */
const getAgentKey = (counterparty) => {
  const agent = counterparty?.agent;
  if (!agent) return "";
  if (typeof agent === "object") return String(agent.id ?? agent.uuid ?? "");
  return String(agent);
};

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
const Counterparties = () => {
  const navigate = useNavigate();
  const { profile } = useUser() || {};
  const showAgent = showAgentColumn(profile);

  // Вкладка типа: клиент / поставщик
  const [typeTab, setTypeTab] = usePersistedState(
    "warehouse:counterparties:typeTab",
    TYPE_TABS.CLIENT,
  );
  // Фильтр по агенту: "" = все, "__no_agent__" = без агента, иначе uuid агента
  const [agentFilter, setAgentFilter] = usePersistedState(
    "warehouse:counterparties:agentFilter",
    "",
  );
  // Подпись выбранного агента — нужна, чтобы <select> мог показать восстановленное
  // значение, даже пока список контрагентов (и опций) ещё не загрузился заново
  const [agentFilterLabel, setAgentFilterLabel] = usePersistedState(
    "warehouse:counterparties:agentFilterLabel",
    "",
  );

  // Состояние фильтров и модальных окон
  const [filters, setFilters] = usePersistedState(
    "warehouse:counterparties:filters",
    {},
  );
  // Период: по умолчанию текущий месяц (от начала до конца месяца)
  const [periodMode, setPeriodMode] = usePersistedState(
    "warehouse:counterparties:periodMode",
    "month",
  ); // month | year | custom
  const [monthValue, setMonthValue] = usePersistedState(
    "warehouse:counterparties:monthValue",
    currentYM(),
  );
  const [yearValue, setYearValue] = usePersistedState(
    "warehouse:counterparties:yearValue",
    String(new Date().getFullYear()),
  );
  const [customRange, setCustomRange] = usePersistedState(
    "warehouse:counterparties:customRange",
    monthRange(currentYM()),
  );
  // «Только с долгом» (only_unpaid) — по умолчанию включён
  const [onlyUnpaid, setOnlyUnpaid] = usePersistedState(
    "warehouse:counterparties:onlyUnpaid",
    true,
  );
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
  const { searchTerm, debouncedSearchTerm, setSearchTerm } = useSearch(
    "warehouse:counterparties:search",
  );
  // Один запрос на всех контрагентов: без type и agent — вкладка (клиент/поставщик)
  // и агент фильтруются на фронте, поэтому их смена не дёргает API, а опции
  // «Агент» строятся из этого же списка вместо отдельного запроса.
  const requestParams = useMemo(() => {
    const params = {
      ...filters,
      page_size: 1000,
    };
    if (debouncedSearchTerm?.trim()) {
      params.search = debouncedSearchTerm.trim();
    }
    // date_from/date_to шлются всегда (не только для одного дня) — без них бэк не
    // возвращает opening_*/turnover_*/closing_* и урезает список только движениями
    // внутри периода вместо всех контрагентов с сальдо на начало
    if (period.from && period.to) {
      params.date_from = period.from;
      params.date_to = period.to;
    }
    if (onlyUnpaid) {
      params.only_unpaid = 1;
    }
    return params;
  }, [
    filters,
    debouncedSearchTerm,
    period.from,
    period.to,
    onlyUnpaid,
  ]);

  // Загрузка контрагентов
  const { counterparties: rawCounterparties, loading } =
    useCounterpartyData(requestParams);

  // «Только с долгом» (QA B18): бэк не поддерживает only_unpaid и отдаёт всех,
  // поэтому дофильтровываем на клиенте — сальдо на конец периода ≠ 0.
  const counterparties = useMemo(() => {
    const byTab = filterCounterpartiesByTypeTab(rawCounterparties, typeTab);
    return onlyUnpaid ? byTab.filter(counterpartyHasDebt) : byTab;
  }, [rawCounterparties, typeTab, onlyUnpaid]);

  // Список уникальных агентов вкладки (агент фильтруется на фронте, поэтому выбор
  // агента не сужает список опций)
  const agentOptions = useMemo(() => {
    if (!showAgent) return [];
    const seen = new Set();
    const options = [
      { value: "", label: "Все агенты" },
      { value: "__no_agent__", label: "Без агента" },
    ];
    counterparties.forEach((c) => {
      const key = getAgentKey(c);
      if (key && !seen.has(key)) {
        seen.add(key);
        options.push({ value: key, label: getAgentDisplay(c) });
      }
    });
    // Восстановленный из sessionStorage выбор может отсутствовать среди только что
    // загруженных контрагентов (данные ещё грузятся) — добавляем его отдельно,
    // иначе <select> не найдёт совпадающий <option> и молча покажет «Все агенты»,
    // хотя agentFilter на самом деле не сброшен.
    if (
      agentFilter &&
      agentFilter !== "__no_agent__" &&
      !options.some((o) => o.value === agentFilter)
    ) {
      options.push({ value: agentFilter, label: agentFilterLabel || "…" });
    }
    return options;
  }, [showAgent, counterparties, agentFilter, agentFilterLabel]);

  // Фильтрация по выбранному агенту (плоский список)
  const filteredCounterparties = useMemo(() => {
    if (!agentFilter) return counterparties;
    if (agentFilter === "__no_agent__") {
      return counterparties.filter((c) => !getAgentKey(c));
    }
    return counterparties.filter((c) => getAgentKey(c) === agentFilter);
  }, [counterparties, agentFilter]);

  // Итоги ведомости по всем контрагентам вкладки/агента (не только по странице).
  // Этими же числами заполняются карточки сверху — они всегда совпадают с «Итого».
  const ledgerTotals = useMemo(
    () => getCounterpartiesLedgerTotals(filteredCounterparties),
    [filteredCounterparties],
  );
  const balanceSummary = useMemo(
    () => ({
      opening: {
        debit: ledgerTotals.openingDebit,
        credit: ledgerTotals.openingCredit,
      },
      turnover: {
        debit: ledgerTotals.turnoverDebit,
        credit: ledgerTotals.turnoverCredit,
      },
      closing: {
        debit: ledgerTotals.closingDebit,
        credit: ledgerTotals.closingCredit,
      },
    }),
    [ledgerTotals],
  );

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

  // Сброс на первую страницу — только при РЕАЛЬНОЙ смене поиска, вкладки типа, периода или
  // «Только с долгом»: сравниваем с предыдущими значениями, иначе эффект при монтировании
  // стирает страницу из ссылки (?page=2).
  const prevFiltersRef = useRef({
    debouncedSearchTerm,
    typeTab,
    from: period.from,
    to: period.to,
    onlyUnpaid,
  });
  useEffect(() => {
    const prev = prevFiltersRef.current;
    const changed =
      prev.debouncedSearchTerm !== debouncedSearchTerm ||
      prev.typeTab !== typeTab ||
      prev.from !== period.from ||
      prev.to !== period.to ||
      prev.onlyUnpaid !== onlyUnpaid;
    prevFiltersRef.current = {
      debouncedSearchTerm,
      typeTab,
      from: period.from,
      to: period.to,
      onlyUnpaid,
    };
    if (changed) resetToFirstPage();
  }, [
    debouncedSearchTerm,
    typeTab,
    period.from,
    period.to,
    onlyUnpaid,
    resetToFirstPage,
  ]);

  // Сброс фильтра по агенту при реальной смене вкладки типа — сравниваем с предыдущим
  // значением (а не флагом «уже монтировались»), иначе под React.StrictMode двойной
  // прогон эффекта при монтировании затирает восстановленное из sessionStorage значение
  const prevTypeTabRef = useRef(typeTab);
  useEffect(() => {
    if (prevTypeTabRef.current !== typeTab) {
      setAgentFilter("");
      setAgentFilterLabel("");
    }
    prevTypeTabRef.current = typeTab;
  }, [typeTab, setAgentFilter, setAgentFilterLabel]);

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
    [navigate],
  );

  // Новый контрагент ещё без долга, и «Только с долгом» (включён по умолчанию) скрыл бы его —
  // пользователю казалось бы, что сохранение не сработало. Снимаем фильтр и открываем
  // вкладку его типа, чтобы запись сразу была видна.
  const handleCounterpartyCreated = useCallback(
    (created) => {
      if (onlyUnpaid) setOnlyUnpaid(false);
      if (created?.type === "SUPPLIER" && typeTab !== "supplier") {
        setTypeTab("supplier");
      } else if (created?.type === "CLIENT" && typeTab !== "client") {
        setTypeTab("client");
      }
    },
    [onlyUnpaid, setOnlyUnpaid, typeTab, setTypeTab],
  );

  const handlePageChange = useCallback(
    (newPage) => {
      handlePageChangeBase(newPage);
    },
    [handlePageChangeBase],
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
              onChange={(e) => {
                const value = e.target.value;
                const opt = agentOptions.find((o) => o.value === value);
                setAgentFilter(value);
                setAgentFilterLabel(opt?.label || "");
              }}
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
        summary={balanceSummary}
        loading={loading}
      />

      <CounterpartySearchSection
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        viewMode={viewMode}
        onViewModeChange={handleViewModeChange}
        count={filteredCounterparties.length}
        foundCount={filteredCounterparties.length}
        onlyUnpaid={onlyUnpaid}
        onOnlyUnpaidChange={setOnlyUnpaid}
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
                : onlyUnpaid
                  ? "Должников за период нет. Отключите «Только с долгом», чтобы увидеть всех."
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
              totals={ledgerTotals}
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
          <CreateCounterpartyModal
            onClose={() => setShowCreateModal(false)}
            onCreated={handleCounterpartyCreated}
          />
        </ReactPortal>
      )}
    </div>
  );
};

export default Counterparties;
