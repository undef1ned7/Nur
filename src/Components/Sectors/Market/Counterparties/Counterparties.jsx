import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useDispatch } from "react-redux";
import { useNavigate, useSearchParams } from "react-router-dom";
import { UserCircle, Package, Users, Filter } from "lucide-react";
import "./Counterparties.scss";
import AlertModal from "../../../common/AlertModal/AlertModal";
import CounterpartyHeader from "./components/CounterpartyHeader";
import CounterpartySearchSection from "./components/CounterpartySearchSection";
import BulkActionsBar from "./components/BulkActionsBar";
import CounterpartyTable from "./components/CounterpartyTable";
import CounterpartyCards from "./components/CounterpartyCards";
import Pagination from "./components/Pagination";
import CreateCounterpartyModal from "./components/CreateCounterpartyModal";
import {
  bulkDeleteWarehouseCounterparties,
  fetchWarehouseCounterparties,
} from "../../../../store/creators/warehouseThunk";
import { useUser } from "../../../../store/slices/userSlice";
import { useSearch } from "./hooks/useSearch";
import { usePagination } from "./hooks/usePagination";
import { useCounterpartySelection } from "./hooks/useCounterpartySelection";
import { useCounterpartyData } from "./hooks/useCounterpartyData";
import {
  STORAGE_KEY,
  VIEW_MODES,
  TYPE_TABS,
  TYPE_TAB_LABELS,
  COUNTERPARTY_TYPES,
} from "./constants";
import { formatDeleteMessage, getAgentDisplay } from "./utils";
import ReactPortal from "../../../common/Portal/ReactPortal";

/** Показывать колонку «Агент» для владельца и админа */
const showAgentColumn = (profile) =>
  profile?.role === "owner" || profile?.role === "admin";

const Counterparties = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { profile } = useUser() || {};
  const showAgent = showAgentColumn(profile);

  // Вкладка типа: клиент / поставщик
  const [typeTab, setTypeTab] = useState(TYPE_TABS.CLIENT);
  // Фильтр по агенту: "" = все, "__no_agent__" = без агента, иначе uuid агента
  const [agentFilter, setAgentFilter] = useState("");

  // Состояние фильтров и модальных окон
  const [filters, setFilters] = useState({});
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState(false);
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
    return params;
  }, [currentPageFromUrl, filters, debouncedSearchTerm]);

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
    if (debouncedSearchTerm) {
      resetToFirstPage();
    }
  }, [debouncedSearchTerm, resetToFirstPage]);

  useEffect(() => {
    resetToFirstPage();
  }, [typeTab]);

  useEffect(() => {
    setAgentFilter("");
  }, [typeTab]);

  // Хук для выбора контрагентов
  const {
    selectedRows,
    isAllSelected,
    selectedCount,
    handleRowSelect,
    handleSelectAll,
    clearSelection,
    setSelectedRows,
  } = useCounterpartySelection(filteredCounterparties);

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
      handlePageChangeBase(newPage, () => setSelectedRows(new Set()));
    },
    [handlePageChangeBase, setSelectedRows]
  );

  const handleBulkDelete = useCallback(() => {
    if (selectedCount === 0) return;
    setShowDeleteConfirmModal(true);
  }, [selectedCount]);

  const confirmBulkDelete = useCallback(async () => {
    setShowDeleteConfirmModal(false);
    setBulkDeleting(true);
    try {
      await dispatch(
        bulkDeleteWarehouseCounterparties(Array.from(selectedRows))
      ).unwrap();

      setSelectedRows(new Set());
      dispatch(fetchWarehouseCounterparties(requestParams));
    } catch (e) {
      console.error("Ошибка при удалении контрагентов:", e);
      alert(
        "Не удалось удалить контрагентов: " +
          (e?.message || e?.detail || "Неизвестная ошибка")
      );
    } finally {
      setBulkDeleting(false);
    }
  }, [dispatch, selectedRows, requestParams]);

  const handleResetFilters = useCallback(() => {
    setFilters({});
  }, []);

  const handleCreateCounterparty = useCallback(() => {
    setShowCreateModal(true);
  }, []);

  const handleViewModeChange = useCallback((mode) => {
    setViewMode(mode);
  }, []);

  // Мемоизация сообщения для модального окна удаления
  const deleteModalMessage = useMemo(
    () => formatDeleteMessage(selectedCount),
    [selectedCount]
  );

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

      <CounterpartySearchSection
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        viewMode={viewMode}
        onViewModeChange={handleViewModeChange}
        count={count}
        foundCount={filteredCounterparties.length}
      />

      <BulkActionsBar
        selectedCount={selectedCount}
        onClearSelection={clearSelection}
        onBulkDelete={handleBulkDelete}
        isDeleting={bulkDeleting}
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
              selectedRows={selectedRows}
              isAllSelected={isAllSelected}
              onRowSelect={handleRowSelect}
              onSelectAll={handleSelectAll}
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
              selectedRows={selectedRows}
              isAllSelected={isAllSelected}
              onRowSelect={handleRowSelect}
              onSelectAll={handleSelectAll}
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

      <AlertModal
        open={showDeleteConfirmModal}
        type="warning"
        title="Подтверждение удаления"
        message={deleteModalMessage}
        okText="Удалить"
        onClose={() => setShowDeleteConfirmModal(false)}
        onConfirm={confirmBulkDelete}
      />

      {showCreateModal && (
        <ReactPortal wrapperId="create_counter_modal">
          <CreateCounterpartyModal onClose={() => setShowCreateModal(false)} />
        </ReactPortal>
      )}
    </div>
  );
};

export default Counterparties;
