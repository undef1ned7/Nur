import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, LayoutGrid, List } from "lucide-react";
import { pdf } from "@react-pdf/renderer";
import warehouseAPI from "../../../../api/warehouse";
import { useDispatch, useSelector } from "react-redux";
import { getWarehouseCounterpartyById } from "../../../../store/creators/warehouseThunk";
import { clearCurrentCounterparty } from "../../../../store/slices/counterpartySlice";
import { useUser } from "../../../../store/slices/userSlice";
import { getAgentDisplay } from "./utils";
import ReconciliationPdfDocument from "../../Warehouse/Documents/components/ReconciliationPdfDocument";
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

  /** Операции: при include_debts=1 API возвращает { money, debt_operations, operations } (API 5.3). */
  const [operations, setOperations] = useState({
    results: [],
    debt_operations: [],
    money: [],
  });
  const [loadingOperations, setLoadingOperations] = useState(true);
  const [errorOperations, setErrorOperations] = useState("");
  const [reconciliationPdfLoading, setReconciliationPdfLoading] =
    useState(false);
  const [reconciliationStart, setReconciliationStart] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), 0, 1).toISOString().slice(0, 10);
  });
  const [reconciliationEnd, setReconciliationEnd] = useState(() =>
    new Date().toISOString().slice(0, 10)
  );
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
      const params = { ...getBranchParams(), include_debts: 1 };
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
      if (data?.operations != null && Array.isArray(data.operations)) {
        setOperations({
          results: data.operations,
          debt_operations: data.debt_operations ?? [],
          money: data.money ?? [],
        });
      } else {
        const list = data?.results ?? (Array.isArray(data) ? data : []);
        setOperations({ results: list, debt_operations: [], money: list });
      }
    } catch (e) {
      setErrorOperations("Не удалось загрузить приход/расход");
      setOperations({ results: [], debt_operations: [], money: [] });
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

  /** Скачать акт сверки (PDF через ReconciliationPdfDocument). Использует выбранные даты. */
  const downloadReconciliationPdf = useCallback(async () => {
    if (!id) return;
    const startStr =
      reconciliationStart || new Date().toISOString().slice(0, 10);
    const endStr = reconciliationEnd || new Date().toISOString().slice(0, 10);
    setReconciliationPdfLoading(true);
    const params = {
      start: startStr,
      end: endStr,
      currency: "KGS",
      ...getBranchParams(),
    };
    try {
      const data = await warehouseAPI.getReconciliationJson(id, params);
      const blob = await pdf(
        <ReconciliationPdfDocument
          data={data}
          meta={{
            start: startStr,
            end: endStr,
            currency: "KGS",
            counterpartyName: name,
          }}
        />
      ).toBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `akt-sverki-${name || id}-${startStr}-${endStr}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error("Акт сверки:", e);
    } finally {
      setReconciliationPdfLoading(false);
    }
  }, [id, name, getBranchParams, reconciliationStart, reconciliationEnd]);

  const operationRows = operations.results || [];
  const debtOperationsList = operations.debt_operations || [];
  const hasUnifiedOperations = operationRows.some(
    (r) => r.source != null || r.debt_delta != null
  );

  // Сводка по операциям: сальдо (приходы − расходы), переводы (оборот), долговые операции (API 5.3)
  // В Сальдо и Переводы включаем только реальные денежные приходы/расходы (source === "money"),
  // чтобы покупки в долг (складские документы) не дублировались в сальдо.
  // Общие долги = остаток: сумма по debt_operations + сумма debt_delta по operations (оплаты дают отрицательный debt_delta).
  const summary = useMemo(() => {
    const list = operationRows;
    let sumReceipt = 0;
    let sumExpense = 0;
    list.forEach((row) => {
      if (row.source != null && row.source !== "money") return;
      const amount = Number(row.amount) || 0;
      if (row.doc_type === "MONEY_RECEIPT") sumReceipt += amount;
      else if (row.doc_type === "MONEY_EXPENSE") sumExpense += amount;
    });
    // Остаток долга = сумма debt_delta по всем operations (продажи в долг дают +, оплаты −).
    const debtDeltaSum = list.reduce(
      (acc, row) => acc + (Number(row.debt_delta) || 0),
      0
    );
    const totalDebtAmount = Math.max(0, debtDeltaSum);
    return {
      balance: sumReceipt - sumExpense,
      transfers: sumReceipt + sumExpense,
      debtOperationsCount: debtOperationsList.length,
      totalDebtAmount,
    };
  }, [operationRows, debtOperationsList]);

  const docTypeLabel = (docType) =>
    docType === "MONEY_RECEIPT"
      ? "Приход"
      : docType === "MONEY_EXPENSE"
      ? "Расход"
      : docType ?? "—";
  const sourceLabel = (row) => {
    if (row.source != null)
      return row.source === "money"
        ? "Денежный документ"
        : "Складской документ (долг)";
    if (row.doc_type) return docTypeLabel(row.doc_type);
    return "—";
  };
  const debtDeltaLabel = (row) => {
    const d = row.debt_delta;
    if (d == null || (typeof d === "string" && d.trim() === "")) return "—";
    const n = Number(d);
    if (Number.isNaN(n) || n === 0) return "—";
    const formatted = Math.abs(n).toLocaleString("ru-RU", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    return n > 0 ? `+${formatted}` : `−${formatted}`;
  };
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
        {showAgentBlock(profile) &&
          (current?.agent || current?.agent_display) && (
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
              <div className="counterparty-detail-page__summary-card counterparty-detail-page__summary-card--sales">
                <span className="counterparty-detail-page__summary-label">
                  Сальдо
                </span>
                <span className="counterparty-detail-page__summary-value">
                  {summary.balance.toLocaleString("ru-RU", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}{" "}
                  COM
                </span>
                <span className="counterparty-detail-page__summary-hint">
                  приходы − расходы по контрагенту
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
              <div className="counterparty-detail-page__summary-card counterparty-detail-page__summary-card--debt-ops">
                <span className="counterparty-detail-page__summary-label">
                  Общие долги
                </span>
                <span className="counterparty-detail-page__summary-value counterparty-detail-page__summary-value--debt-total">
                  {summary.totalDebtAmount.toLocaleString("ru-RU", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}{" "}
                  с
                </span>
                <span className="counterparty-detail-page__summary-hint">
                  {summary.debtOperationsCount} кредитных документов
                </span>
              </div>
            </div>

            <div className="counterparty-detail-page__reconciliation-block">
              <label className="counterparty-detail-page__reconciliation-label">
                <span className="counterparty-detail-page__reconciliation-label-text">
                  Дата с
                </span>
                <input
                  type="date"
                  value={reconciliationStart}
                  onChange={(e) => setReconciliationStart(e.target.value)}
                  className="counterparty-detail-page__reconciliation-date"
                  aria-label="Начало периода акта сверки"
                />
              </label>
              <label className="counterparty-detail-page__reconciliation-label">
                <span className="counterparty-detail-page__reconciliation-label-text">
                  Дата по
                </span>
                <input
                  type="date"
                  value={reconciliationEnd}
                  onChange={(e) => setReconciliationEnd(e.target.value)}
                  className="counterparty-detail-page__reconciliation-date"
                  aria-label="Конец периода акта сверки"
                />
              </label>
              <button
                type="button"
                className="counterparty-detail-page__reconciliation-pdf"
                onClick={downloadReconciliationPdf}
                disabled={reconciliationPdfLoading}
              >
                {reconciliationPdfLoading
                  ? "Формирование…"
                  : "Скачать акт сверки (PDF)"}
              </button>
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
                onClick={() => loadOperations()}
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
                      <th>{hasUnifiedOperations ? "Источник" : "Тип"}</th>
                      <th>Номер</th>
                      <th>Дата</th>
                      <th>Сумма</th>
                      {hasUnifiedOperations && <th>Изменение долга</th>}
                      <th>Категория</th>
                      <th>Статус</th>
                      <th>Комментарий</th>
                    </tr>
                  </thead>
                  <tbody>
                    {operationRows.map((row) => (
                      <tr key={row.id || Math.random()}>
                        <td>{sourceLabel(row)}</td>
                        <td>{row.number ?? row.document?.number ?? "—"}</td>
                        <td>
                          {fmtDate(
                            row.date ?? row.created_at ?? row.document?.date
                          )}
                        </td>
                        <td>{fmtMoney(row.amount)}</td>
                        {hasUnifiedOperations && (
                          <td className="counterparty-detail-page__debt-delta">
                            {debtDeltaLabel(row)}
                          </td>
                        )}
                        <td>
                          {row.payment_category_title ??
                            row.document?.payment_category_title ??
                            "—"}
                        </td>
                        <td>
                          {statusLabel(row.status ?? row.document?.status)}
                        </td>
                        <td>{row.comment ?? row.document?.comment ?? "—"}</td>
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
                          {hasUnifiedOperations ? "Источник" : "Тип"}
                        </span>
                        <span className="counterparty-detail-page__card-value">
                          {sourceLabel(row)}
                        </span>
                      </div>
                      {hasUnifiedOperations && debtDeltaLabel(row) !== "—" && (
                        <div className="counterparty-detail-page__card-row">
                          <span className="counterparty-detail-page__card-label">
                            Изменение долга
                          </span>
                          <span className="counterparty-detail-page__card-value counterparty-detail-page__card-value--debt-delta">
                            {debtDeltaLabel(row)}
                          </span>
                        </div>
                      )}
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
