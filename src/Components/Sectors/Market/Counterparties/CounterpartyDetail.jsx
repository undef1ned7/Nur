import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, LayoutGrid, List } from "lucide-react";
import warehouseAPI from "../../../../api/warehouse";
import { useDispatch, useSelector } from "react-redux";
import { getWarehouseCounterpartyById } from "../../../../store/creators/warehouseThunk";
import { clearCurrentCounterparty } from "../../../../store/slices/counterpartySlice";
import { useUser } from "../../../../store/slices/userSlice";
import { getAgentDisplay } from "./utils";
import "./CounterpartyDetail.scss";

const fmtMoney = (v) =>
  (Number(v) || 0).toLocaleString(undefined, { minimumFractionDigits: 0 }) +
  " с";

const fmtDate = (v) => {
  if (!v) return "—";
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? v : d.toLocaleDateString("ru-RU");
};

/**
 * Страница контрагента: только денежные операции по контрагенту (API 5.3).
 * GET /api/warehouse/money/counterparties/{counterparty_id}/operations/
 * Фильтры: doc_type, status, warehouse, payment_category. Поиск: search (по number, comment).
 */
const showAgentBlock = (profile) =>
  profile?.role === "owner" || profile?.role === "admin";

const CounterpartyDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { profile } = useUser() || {};
  const current = useSelector((state) => state.counterparty.current);
  const loadingCurrent = useSelector(
    (state) => state.counterparty.loadingCurrent
  );
  const company = useSelector((state) => state.user.company);

  const [operations, setOperations] = useState({ results: [] });
  const [loadingOperations, setLoadingOperations] = useState(true);
  const [errorOperations, setErrorOperations] = useState("");
  const [warehouses, setWarehouses] = useState([]);
  const [paymentCategories, setPaymentCategories] = useState([]);

  const [docTypeFilter, setDocTypeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [warehouseFilter, setWarehouseFilter] = useState("");
  const [paymentCategoryFilter, setPaymentCategoryFilter] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [searchDebounced, setSearchDebounced] = useState("");
  const [viewMode, setViewMode] = useState("table"); // "table" | "cards"

  const name = current?.name ?? "—";

  const getBranchParams = useCallback(() => {
    const params = {};
    if (company?.id) params.company = company.id;
    if (company?.branch) params.branch = company.branch;
    return params;
  }, [company]);

  useEffect(() => {
    if (!id) return;
    dispatch(getWarehouseCounterpartyById(id));
    return () => dispatch(clearCurrentCounterparty());
  }, [dispatch, id]);

  useEffect(() => {
    const t = setTimeout(() => setSearchDebounced(searchTerm.trim()), 300);
    return () => clearTimeout(t);
  }, [searchTerm]);

  useEffect(() => {
    const loadOptions = async () => {
      try {
        const branchParams = getBranchParams();
        const [whData, catData] = await Promise.all([
          warehouseAPI.listWarehouses(branchParams),
          warehouseAPI.listMoneyCategories(branchParams),
        ]);
        setWarehouses(whData?.results ?? (Array.isArray(whData) ? whData : []));
        setPaymentCategories(
          catData?.results ?? (Array.isArray(catData) ? catData : [])
        );
      } catch {
        setWarehouses([]);
        setPaymentCategories([]);
      }
    };
    loadOptions();
  }, [getBranchParams]);

  const loadOperations = useCallback(async () => {
    if (!id) return;
    setLoadingOperations(true);
    setErrorOperations("");
    try {
      const params = { ...getBranchParams() };
      if (docTypeFilter) params.doc_type = docTypeFilter;
      if (statusFilter) params.status = statusFilter;
      if (warehouseFilter) params.warehouse = warehouseFilter;
      if (paymentCategoryFilter)
        params.payment_category = paymentCategoryFilter;
      if (searchDebounced) params.search = searchDebounced;
      const data = await warehouseAPI.getCounterpartyMoneyOperations(
        id,
        params
      );
      const list = data?.results ?? (Array.isArray(data) ? data : []);
      setOperations({ results: list });
    } catch (e) {
      setErrorOperations("Не удалось загрузить приход/расход");
      setOperations({ results: [] });
    } finally {
      setLoadingOperations(false);
    }
  }, [
    id,
    docTypeFilter,
    statusFilter,
    warehouseFilter,
    paymentCategoryFilter,
    searchDebounced,
    getBranchParams,
  ]);

  useEffect(() => {
    loadOperations();
  }, [loadOperations]);

  const operationRows = operations.results || [];

  // Сводка по операциям (results): Общий долг, Переводы, Продажи
  const summary = useMemo(() => {
    const list = operationRows;
    let sumReceipt = 0;
    let sumExpense = 0;
    list.forEach((row) => {
      const amount = Number(row.amount) || 0;
      if (row.doc_type === "MONEY_RECEIPT") sumReceipt += amount;
      else if (row.doc_type === "MONEY_EXPENSE") sumExpense += amount;
    });
    return {
      // Приход = контрагент платит нам → уменьшает его долг перед нами
      // Расход = мы платим контрагенту → уменьшает наш долг перед ним
      totalDebt: -(sumReceipt + sumExpense),
      transfers: sumReceipt + sumExpense,
      sales: sumReceipt,
    };
  }, [operationRows]);

  const docTypeLabel = (docType) =>
    docType === "MONEY_RECEIPT"
      ? "Приход"
      : docType === "MONEY_EXPENSE"
      ? "Расход"
      : docType ?? "—";
  const statusLabel = (s) =>
    s === "POSTED" ? "Проведён" : s === "DRAFT" ? "Черновик" : s ?? "—";

  const goBack = () => navigate("/crm/warehouse/counterparties");

  if (!id) {
    return (
      <div className="counterparty-detail-page">
        <div className="counterparty-detail-page__error">
          Контрагент не найден
        </div>
        <button
          type="button"
          className="counterparty-detail-page__back"
          onClick={goBack}
        >
          <ArrowLeft size={20} /> Назад
        </button>
      </div>
    );
  }

  return (
    <div className="counterparty-detail-page">
      <header className="counterparty-detail-page__header">
        <button
          type="button"
          className="counterparty-detail-page__back"
          onClick={goBack}
          aria-label="Назад к списку"
        >
          <ArrowLeft size={20} /> Назад
        </button>
        <h1 className="counterparty-detail-page__title">Контрагент: {name}</h1>
        {showAgentBlock(profile) && (current?.agent || current?.agent_display) && (
          <p className="counterparty-detail-page__agent">
            Привязан к агенту: {getAgentDisplay(current)}
          </p>
        )}
      </header>

      <div className="counterparty-detail-page__body">
        {loadingCurrent ? (
          <div className="counterparty-detail-page__loading">
            Загрузка данных контрагента...
          </div>
        ) : (
          <>
            <div className="counterparty-detail-page__summary-cards">
              <div className="counterparty-detail-page__summary-card counterparty-detail-page__summary-card--debt">
                <span className="counterparty-detail-page__summary-label">
                  Общий долг
                </span>
                <span className="counterparty-detail-page__summary-value">
                  {summary.totalDebt.toLocaleString("ru-RU", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}{" "}
                  COM
                </span>
              </div>
              <div className="counterparty-detail-page__summary-card counterparty-detail-page__summary-card--transfers">
                <span className="counterparty-detail-page__summary-label">
                  Переводы
                </span>
                <span className="counterparty-detail-page__summary-value">
                  {summary.transfers.toLocaleString("ru-RU", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}{" "}
                  COM
                </span>
              </div>
              <div className="counterparty-detail-page__summary-card counterparty-detail-page__summary-card--sales">
                <span className="counterparty-detail-page__summary-label">
                  Продажи
                </span>
                <span className="counterparty-detail-page__summary-value">
                  {summary.sales.toLocaleString("ru-RU", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}{" "}
                  COM
                </span>
              </div>
            </div>

            <div className="counterparty-detail-page__operations-toolbar">
              <input
                type="search"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Поиск по номеру, комментарию..."
                className="counterparty-detail-page__search-input"
                aria-label="Поиск по номеру и комментарию"
              />
              <div className="counterparty-detail-page__view-toggle">
                <button
                  type="button"
                  className={`counterparty-detail-page__view-btn ${
                    viewMode === "table"
                      ? "counterparty-detail-page__view-btn--active"
                      : ""
                  }`}
                  onClick={() => setViewMode("table")}
                  title="Таблица"
                >
                  <List size={18} />
                </button>
                <button
                  type="button"
                  className={`counterparty-detail-page__view-btn ${
                    viewMode === "cards"
                      ? "counterparty-detail-page__view-btn--active"
                      : ""
                  }`}
                  onClick={() => setViewMode("cards")}
                  title="Карточки"
                >
                  <LayoutGrid size={18} />
                </button>
              </div>
              <select
                value={docTypeFilter}
                onChange={(e) => setDocTypeFilter(e.target.value)}
                className="counterparty-detail-page__filter-select"
                aria-label="Тип документа"
              >
                <option value="">Все типы</option>
                <option value="MONEY_RECEIPT">Приход</option>
                <option value="MONEY_EXPENSE">Расход</option>
              </select>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="counterparty-detail-page__filter-select"
                aria-label="Статус"
              >
                <option value="">Все статусы</option>
                <option value="DRAFT">Черновик</option>
                <option value="POSTED">Проведён</option>
              </select>
              <select
                value={warehouseFilter}
                onChange={(e) => setWarehouseFilter(e.target.value)}
                className="counterparty-detail-page__filter-select"
                aria-label="Склад"
              >
                <option value="">Все склады</option>
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name ?? w.title ?? w.id}
                  </option>
                ))}
              </select>
              <select
                value={paymentCategoryFilter}
                onChange={(e) => setPaymentCategoryFilter(e.target.value)}
                className="counterparty-detail-page__filter-select"
                aria-label="Категория платежа"
              >
                <option value="">Все категории</option>
                {paymentCategories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title ?? c.name ?? c.id}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="counterparty-detail-page__refresh-btn"
                onClick={loadOperations}
                disabled={loadingOperations}
              >
                {loadingOperations ? "Загрузка…" : "Обновить"}
              </button>
            </div>

            {loadingOperations ? (
              <div className="counterparty-detail-page__loading">
                Загрузка...
              </div>
            ) : errorOperations ? (
              <div className="counterparty-detail-page__error">
                {errorOperations}
              </div>
            ) : operationRows.length === 0 ? (
              <div className="counterparty-detail-page__empty">
                Нет приходов и расходов
              </div>
            ) : viewMode === "table" ? (
              <div className="counterparty-detail-page__table-wrap">
                <table className="counterparty-detail-page__table">
                  <thead>
                    <tr>
                      <th>Тип</th>
                      <th>Номер</th>
                      <th>Дата</th>
                      <th>Сумма</th>
                      <th>Категория</th>
                      <th>Статус</th>
                      <th>Комментарий</th>
                    </tr>
                  </thead>
                  <tbody>
                    {operationRows.map((row) => (
                      <tr key={row.id || Math.random()}>
                        <td>{docTypeLabel(row.doc_type)}</td>
                        <td>{row.number ?? "—"}</td>
                        <td>{fmtDate(row.date ?? row.created_at)}</td>
                        <td>{fmtMoney(row.amount)}</td>
                        <td>{row.payment_category_title ?? "—"}</td>
                        <td>{statusLabel(row.status)}</td>
                        <td>{row.comment ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="counterparty-detail-page__cards">
                {operationRows.map((row) => (
                  <div
                    key={row.id || Math.random()}
                    className="counterparty-detail-page__card"
                  >
                    <div className="counterparty-detail-page__card-header">
                      <span className="counterparty-detail-page__card-number">
                        {row.number ?? "—"}
                      </span>
                      <span
                        className={`counterparty-detail-page__card-status counterparty-detail-page__card-status--${
                          row.status === "POSTED" ? "posted" : "draft"
                        }`}
                      >
                        {statusLabel(row.status)}
                      </span>
                    </div>
                    <div className="counterparty-detail-page__card-body">
                      <div className="counterparty-detail-page__card-row">
                        <span className="counterparty-detail-page__card-label">
                          Тип
                        </span>
                        <span className="counterparty-detail-page__card-value">
                          {docTypeLabel(row.doc_type)}
                        </span>
                      </div>
                      <div className="counterparty-detail-page__card-row">
                        <span className="counterparty-detail-page__card-label">
                          Дата
                        </span>
                        <span className="counterparty-detail-page__card-value">
                          {fmtDate(row.date ?? row.created_at)}
                        </span>
                      </div>
                      <div className="counterparty-detail-page__card-row">
                        <span className="counterparty-detail-page__card-label">
                          Сумма
                        </span>
                        <span className="counterparty-detail-page__card-value counterparty-detail-page__card-value--amount">
                          {fmtMoney(row.amount)}
                        </span>
                      </div>
                      <div className="counterparty-detail-page__card-row">
                        <span className="counterparty-detail-page__card-label">
                          Категория
                        </span>
                        <span className="counterparty-detail-page__card-value">
                          {row.payment_category_title ?? "—"}
                        </span>
                      </div>
                      {(row.comment ?? "").trim() ? (
                        <div className="counterparty-detail-page__card-row">
                          <span className="counterparty-detail-page__card-label">
                            Комментарий
                          </span>
                          <span className="counterparty-detail-page__card-value">
                            {row.comment}
                          </span>
                        </div>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default CounterpartyDetail;
