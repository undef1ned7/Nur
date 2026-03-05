import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, LayoutGrid, List, X, Check, Save, Edit } from "lucide-react";
import { pdf } from "@react-pdf/renderer";
import warehouseAPI from "../../../../api/warehouse";
import { useDispatch, useSelector } from "react-redux";
import { getWarehouseCounterpartyById } from "../../../../store/creators/warehouseThunk";
import { clearCurrentCounterparty } from "../../../../store/slices/counterpartySlice";
import { useUser } from "../../../../store/slices/userSlice";
import { getAgentDisplay } from "./utils";
import ReconciliationPdfDocument from "../../Warehouse/Documents/components/ReconciliationPdfDocument";
import EditCounterpartyModal from "./components/EditCounterpartyModal";
import "./CounterpartyDetail.scss";
import "../../Warehouse/Money/MoneyDocumentsPage.scss";

const fmtMoney = (v) =>
  (Number(v) || 0).toLocaleString(undefined, { minimumFractionDigits: 0 }) +
  " с";

const fmtDate = (v) => {
  if (!v) return "—";
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? v : d.toLocaleDateString("ru-RU");
};

const fmtDateTime = (v) => {
  if (!v) return "—";
  const d = new Date(v);
  return Number.isNaN(d.getTime())
    ? v
    : d.toLocaleString("ru-RU", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      });
};

const emptyPage = { count: 0, next: null, previous: null, results: [] };

/**
 * Страница контрагента: только денежные операции по контрагенту (API 5.3).
 * GET /api/warehouse/money/counterparties/{counterparty_id}/operations/
 * Фильтры: doc_type, status, warehouse, payment_category. Поиск: search (по number, comment).
 */
const showAgentBlock = (profile) =>
  profile?.role === "owner" || profile?.role === "admin";

const getRowDateValue = (row) => {
  const raw = row?.date ?? row?.created_at ?? row?.document?.date ?? null;
  const d = raw ? new Date(raw) : null;
  const t = d && !Number.isNaN(d.getTime()) ? d.getTime() : 0;
  return t;
};

const getRowKey = (row, idx) =>
  row?.id ??
  `${row?.source ?? "row"}-${row?.number ?? row?.document?.number ?? "n"}-${
    row?.date ?? row?.created_at ?? row?.document?.date ?? "d"
  }-${idx}`;

const AccordionSection = ({
  title,
  subtitle,
  defaultOpen = false,
  children,
}) => (
  <details className="counterparty-detail-page__accordion" open={defaultOpen}>
    <summary className="counterparty-detail-page__accordion-summary">
      <div className="counterparty-detail-page__accordion-summary-main">
        <span className="counterparty-detail-page__accordion-title">
          {title}
        </span>
        {subtitle ? (
          <span className="counterparty-detail-page__accordion-subtitle">
            {subtitle}
          </span>
        ) : null}
      </div>
      <span className="counterparty-detail-page__accordion-chevron" />
    </summary>
    <div className="counterparty-detail-page__accordion-body">{children}</div>
  </details>
);

const CounterpartyDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { profile } = useUser() || {};
  const current = useSelector((state) => state.counterparty.current);
  const loadingCurrent = useSelector(
    (state) => state.counterparty.loadingCurrent,
  );
  const company = useSelector((state) => state.user.company);

  /** Операции: при include_debts=1 API возвращает { money, debt_operations, operations } (API 5.3). */
  const [operations, setOperations] = useState(() => ({
    results: [],
    debt_operations: [],
    money: emptyPage,
  }));
  const [loadingOperations, setLoadingOperations] = useState(true);
  const [errorOperations, setErrorOperations] = useState("");
  const [reconciliationPdfLoading, setReconciliationPdfLoading] =
    useState(false);
  const [reconciliationStart, setReconciliationStart] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), 0, 1).toISOString().slice(0, 10);
  });
  const [reconciliationEnd, setReconciliationEnd] = useState(() =>
    new Date().toISOString().slice(0, 10),
  );
  const [warehouses, setWarehouses] = useState([]);
  const [paymentCategories, setPaymentCategories] = useState([]);
  const [cashRegisters, setCashRegisters] = useState([]);
  const [payDebtLoading, setPayDebtLoading] = useState(false);
  const [payDebtError, setPayDebtError] = useState("");
  const [showPayDebtModal, setShowPayDebtModal] = useState(false);
  const [payDebtForm, setPayDebtForm] = useState({
    cash_register: "",
    payment_category: "",
    amount: "",
    comment: "",
  });
  const [payDebtCreateAsPosted, setPayDebtCreateAsPosted] = useState(false);
  const [payDebtSubmitting, setPayDebtSubmitting] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);

  const [docTypeFilter, setDocTypeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [warehouseFilter, setWarehouseFilter] = useState("");
  const [paymentCategoryFilter, setPaymentCategoryFilter] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [searchDebounced, setSearchDebounced] = useState("");
  const [viewMode, setViewMode] = useState("table"); // "table" | "cards"

  const name = current?.name ?? "—";
  const canEdit =
    profile?.role === "owner" || profile?.role === "admin";

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
        const [whData, catData, cashData] = await Promise.all([
          warehouseAPI.listWarehouses(branchParams),
          warehouseAPI.listMoneyCategories(branchParams),
          warehouseAPI.listCashRegisters(branchParams),
        ]);
        setWarehouses(whData?.results ?? (Array.isArray(whData) ? whData : []));
        setPaymentCategories(
          catData?.results ?? (Array.isArray(catData) ? catData : []),
        );
        setCashRegisters(
          cashData?.results ?? (Array.isArray(cashData) ? cashData : []),
        );
      } catch {
        setWarehouses([]);
        setPaymentCategories([]);
        setCashRegisters([]);
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
        params,
      );
      if (data?.operations != null && Array.isArray(data.operations)) {
        const moneyPage =
          data?.money && typeof data.money === "object"
            ? { ...emptyPage, ...data.money }
            : emptyPage;
        setOperations({
          results: data.operations,
          debt_operations: data.debt_operations ?? [],
          money: moneyPage,
        });
      } else {
        const list = data?.results ?? (Array.isArray(data) ? data : []);
        setOperations({
          results: list,
          debt_operations: [],
          money: { ...emptyPage, results: list, count: list.length },
        });
      }
    } catch (e) {
      setErrorOperations("Не удалось загрузить приход/расход");
      setOperations({ results: [], debt_operations: [], money: emptyPage });
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
        />,
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

  const operationRows = Array.isArray(operations.results)
    ? operations.results
    : [];
  const debtOperationsList = Array.isArray(operations.debt_operations)
    ? operations.debt_operations
    : [];
  const moneyPage =
    operations?.money && typeof operations.money === "object"
      ? { ...emptyPage, ...operations.money }
      : emptyPage;
  const moneyRows = Array.isArray(moneyPage.results) ? moneyPage.results : [];

  const sortedAllRows = useMemo(
    () =>
      [...operationRows].sort(
        (a, b) => getRowDateValue(b) - getRowDateValue(a),
      ),
    [operationRows],
  );
  const sortedMoneyRows = useMemo(
    () =>
      [...moneyRows].sort((a, b) => getRowDateValue(b) - getRowDateValue(a)),
    [moneyRows],
  );
  const sortedDebtRows = useMemo(
    () =>
      [...debtOperationsList].sort(
        (a, b) => getRowDateValue(b) - getRowDateValue(a),
      ),
    [debtOperationsList],
  );

  const hasUnifiedOperations = sortedAllRows.some(
    (r) => r.source != null || r.debt_delta != null,
  );

  // Сводка по операциям: сальдо (приходы − расходы), переводы (оборот), долговые операции (API 5.3)
  // В Сальдо и Переводы включаем только реальные денежные приходы/расходы (source === "money"),
  // чтобы покупки в долг (складские документы) не дублировались в сальдо.
  // Общие долги = остаток: сумма по debt_operations + сумма debt_delta по operations (оплаты дают отрицательный debt_delta).
  const summary = useMemo(() => {
    const list = sortedAllRows;
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
      0,
    );
    return {
      balance: sumReceipt - sumExpense,
      transfers: sumReceipt + sumExpense,
      debtOperationsCount: debtOperationsList.length,
      debtBalance: debtDeltaSum,
    };
  }, [sortedAllRows, debtOperationsList]);

  const openPayDebtModal = useCallback(() => {
    const debtBalance = summary.debtBalance;
    const amount = Math.abs(debtBalance);
    const firstCash = cashRegisters[0]?.id ?? cashRegisters[0]?.uuid ?? "";
    const firstCategory =
      paymentCategories[0]?.id ?? paymentCategories[0]?.uuid ?? "";
    setPayDebtForm({
      cash_register: firstCash,
      payment_category: firstCategory,
      amount: amount > 0 ? String(amount) : "",
      comment: "Погашение долга",
    });
    setPayDebtCreateAsPosted(false);
    setPayDebtError("");
    setShowPayDebtModal(true);
  }, [summary.debtBalance, cashRegisters, paymentCategories]);

  /** Оплатить весь долг одной кнопкой: приход или расход на полную сумму с подтверждением. */
  const payFullDebt = useCallback(async () => {
    if (!id) return;
    const debtBalance = summary.debtBalance;
    if (debtBalance === 0) return;
    const amount = Math.abs(debtBalance);
    const firstCash = cashRegisters[0]?.id ?? cashRegisters[0]?.uuid;
    const firstCategory =
      paymentCategories[0]?.id ?? paymentCategories[0]?.uuid;
    if (!firstCash || !firstCategory) {
      setPayDebtError(
        !firstCash
          ? "Нет доступных касс. Добавьте кассу в настройках."
          : "Нет категорий платежей. Добавьте категорию в настройках.",
      );
      return;
    }
    setPayDebtError("");
    const isReceipt = debtBalance > 0;
    const actionText = isReceipt
      ? `Создать приход на ${amount.toLocaleString("ru-RU", { minimumFractionDigits: 2 })} с (контрагент погашает долг)?`
      : `Создать расход на ${amount.toLocaleString("ru-RU", { minimumFractionDigits: 2 })} с (погашение долга контрагенту)?`;
    if (!window.confirm(actionText)) return;
    setPayDebtLoading(true);
    try {
      const created = await warehouseAPI.createMoneyDocument({
        doc_type: isReceipt ? "MONEY_RECEIPT" : "MONEY_EXPENSE",
        cash_register: firstCash,
        counterparty: id,
        payment_category: firstCategory,
        amount,
        comment: "Погашение долга",
      });
      if (created?.id) {
        await warehouseAPI.postMoneyDocument(created.id);
      }
      await loadOperations();
    } catch (e) {
      const msg =
        e?.message ||
        e?.detail ||
        (typeof e === "string" ? e : "Не удалось создать документ");
      setPayDebtError(msg);
    } finally {
      setPayDebtLoading(false);
    }
  }, [
    id,
    summary.debtBalance,
    cashRegisters,
    paymentCategories,
    loadOperations,
  ]);

  const closePayDebtModal = useCallback(() => {
    setShowPayDebtModal(false);
    setPayDebtForm({
      cash_register: "",
      payment_category: "",
      amount: "",
      comment: "",
    });
    setPayDebtError("");
  }, []);

  const handlePayDebtFormChange = useCallback((field, value) => {
    setPayDebtForm((prev) => ({ ...prev, [field]: value }));
  }, []);

  const handlePayDebtSubmit = useCallback(
    async (e) => {
      e.preventDefault();
      if (!id) return;
      setPayDebtError("");
      const cash_register = payDebtForm.cash_register?.trim();
      const payment_category = payDebtForm.payment_category?.trim();
      const amountStr = String(payDebtForm.amount ?? "").trim().replace(/\s/g, "").replace(",", ".");
      if (!cash_register || !payment_category || !amountStr) {
        setPayDebtError("Заполните кассу, категорию и сумму");
        return;
      }
      const amountNum = Number(amountStr);
      if (Number.isNaN(amountNum) || amountNum <= 0) {
        setPayDebtError("Укажите корректную сумму");
        return;
      }
      const debtBalance = summary.debtBalance;
      const isReceipt = debtBalance > 0;
      setPayDebtSubmitting(true);
      try {
        const created = await warehouseAPI.createMoneyDocument({
          doc_type: isReceipt ? "MONEY_RECEIPT" : "MONEY_EXPENSE",
          cash_register,
          counterparty: id,
          payment_category,
          amount: amountNum,
          comment: payDebtForm.comment?.trim() || "",
        });
        if (payDebtCreateAsPosted && created?.id) {
          await warehouseAPI.postMoneyDocument(created.id);
        }
        closePayDebtModal();
        await loadOperations();
      } catch (err) {
        const msg =
          err?.message ||
          err?.detail ||
          (typeof err === "string" ? err : "Не удалось создать документ");
        setPayDebtError(msg);
      } finally {
        setPayDebtSubmitting(false);
      }
    },
    [
      id,
      payDebtForm,
      payDebtCreateAsPosted,
      summary.debtBalance,
      loadOperations,
      closePayDebtModal,
    ],
  );

  const docTypeLabel = (docType) =>
    docType === "MONEY_RECEIPT"
      ? "Приход"
      : docType === "MONEY_EXPENSE"
        ? "Расход"
        : (docType ?? "—");
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
    s === "POSTED" ? "Проведён" : s === "DRAFT" ? "Черновик" : (s ?? "—");

  const renderRowsContent = (rows, { showSource, showDebtDelta }) => {
    if (!rows || rows.length === 0) {
      return (
        <div className="counterparty-detail-page__empty">Нет операций</div>
      );
    }

    if (viewMode === "table") {
      return (
        <div className="counterparty-detail-page__table-wrap">
          <table className="counterparty-detail-page__table">
            <thead>
              <tr>
                <th>{showSource ? "Источник" : "Тип"}</th>
                <th>Номер</th>
                <th>Дата</th>
                <th>Сумма</th>
                {showDebtDelta && <th>Изменение долга</th>}
                <th>Категория</th>
                <th>Статус</th>
                <th>Комментарий</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, idx) => (
                <tr key={getRowKey(row, idx)}>
                  <td>
                    {showSource ? sourceLabel(row) : docTypeLabel(row.doc_type)}
                  </td>
                  <td>{row.number ?? row.document?.number ?? "—"}</td>
                  <td>
                    {fmtDateTime(
                      row.date ?? row.created_at ?? row.document?.date,
                    )}
                  </td>
                  <td>{fmtMoney(row.amount)}</td>
                  {showDebtDelta && (
                    <td className="counterparty-detail-page__debt-delta">
                      {debtDeltaLabel(row)}
                    </td>
                  )}
                  <td>
                    {row.payment_category_title ??
                      row.document?.payment_category_title ??
                      "—"}
                  </td>
                  <td>{statusLabel(row.status ?? row.document?.status)}</td>
                  <td>{row.comment ?? row.document?.comment ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }

    return (
      <div className="counterparty-detail-page__cards">
        {rows.map((row, idx) => (
          <div
            key={getRowKey(row, idx)}
            className="counterparty-detail-page__card"
          >
            <div className="counterparty-detail-page__card-header">
              <span className="counterparty-detail-page__card-number">
                {row.number ?? "—"}
              </span>
              <span
                className={`counterparty-detail-page__card-status counterparty-detail-page__card-status--${
                  (row.status ?? row.document?.status) === "POSTED"
                    ? "posted"
                    : "draft"
                }`}
              >
                {statusLabel(row.status ?? row.document?.status)}
              </span>
            </div>
            <div className="counterparty-detail-page__card-body">
              <div className="counterparty-detail-page__card-row">
                <span className="counterparty-detail-page__card-label">
                  {showSource ? "Источник" : "Тип"}
                </span>
                <span className="counterparty-detail-page__card-value">
                  {showSource ? sourceLabel(row) : docTypeLabel(row.doc_type)}
                </span>
              </div>
              {showDebtDelta && debtDeltaLabel(row) !== "—" && (
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
                  {fmtDate(row.date ?? row.created_at ?? row.document?.date)}
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
                  {row.payment_category_title ??
                    row.document?.payment_category_title ??
                    "—"}
                </span>
              </div>
              {(row.comment ?? row.document?.comment ?? "").trim() ? (
                <div className="counterparty-detail-page__card-row">
                  <span className="counterparty-detail-page__card-label">
                    Комментарий
                  </span>
                  <span className="counterparty-detail-page__card-value">
                    {row.comment ?? row.document?.comment}
                  </span>
                </div>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    );
  };

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
        {canEdit && current && (
          <button
            type="button"
            className="counterparty-detail-page__edit-btn"
            onClick={() => setShowEditModal(true)}
          >
            <Edit size={18} />
            <span style={{ marginLeft: 6 }}>Редактировать</span>
          </button>
        )}
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
                  {Math.abs(summary.debtBalance).toLocaleString("ru-RU", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}{" "}
                  с
                </span>
                <span className="counterparty-detail-page__debt-who">
                  {summary.debtBalance > 0
                    ? "Контрагент должен вам"
                    : summary.debtBalance < 0
                      ? "Вы должны контрагенту"
                      : "Долг закрыт"}
                </span>
                <span className="counterparty-detail-page__summary-hint">
                  {summary.debtOperationsCount} кредитных документов
                </span>
              </div>
            </div>

            <div className="counterparty-detail-page__reconciliation-block flex justify-between">
              <div className="flex gap-2">
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
              {summary.debtBalance !== 0 && (
                <div className="counterparty-detail-page__pay-debt-wrap">
                  <button
                    type="button"
                    className="counterparty-detail-page__pay-debt-btn"
                    onClick={openPayDebtModal}
                  >
                    Оплатить долг
                  </button>
                  <button
                    type="button"
                    className="counterparty-detail-page__pay-debt-btn counterparty-detail-page__pay-debt-btn--full"
                    onClick={payFullDebt}
                    disabled={payDebtLoading}
                  >
                    {payDebtLoading ? "Создание…" : "Оплатить весь долг"}
                  </button>
                  {payDebtError && !showPayDebtModal && (
                    <span className="counterparty-detail-page__pay-debt-error">
                      {payDebtError}
                    </span>
                  )}
                </div>
              )}
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
            ) : sortedAllRows.length === 0 &&
              sortedMoneyRows.length === 0 &&
              sortedDebtRows.length === 0 ? (
              <div className="counterparty-detail-page__empty">
                Нет приходов и расходов
              </div>
            ) : (
              <div className="counterparty-detail-page__accordion-list">
                <AccordionSection
                  title="Все операции"
                  subtitle={`${sortedAllRows.length} шт.`}
                  defaultOpen
                >
                  {renderRowsContent(sortedAllRows, {
                    showSource: hasUnifiedOperations,
                    showDebtDelta: hasUnifiedOperations,
                  })}
                </AccordionSection>

                <AccordionSection
                  title="Денежные документы"
                  subtitle={`${moneyPage.count ?? sortedMoneyRows.length} шт.`}
                >
                  {renderRowsContent(sortedMoneyRows, {
                    showSource: true,
                    showDebtDelta: true,
                  })}
                </AccordionSection>

                <AccordionSection
                  title="Долговые операции (кредитные документы)"
                  subtitle={`${sortedDebtRows.length} шт.`}
                >
                  {renderRowsContent(sortedDebtRows, {
                    showSource: true,
                    showDebtDelta: true,
                  })}
                </AccordionSection>
              </div>
            )}

            {showPayDebtModal && (
              <div
                className="money-documents-page__modal-overlay"
                onClick={closePayDebtModal}
                role="presentation"
              >
                <div
                  className="money-documents-page__modal money-documents-page__modal--operation"
                  onClick={(e) => e.stopPropagation()}
                  role="dialog"
                  aria-modal="true"
                  aria-labelledby="pay-debt-modal-title"
                >
                  <div className="money-documents-page__modal-header money-documents-page__modal-header--operation">
                    <h2
                      id="pay-debt-modal-title"
                      className="money-documents-page__modal-title money-documents-page__modal-title--operation"
                    >
                      {summary.debtBalance > 0 ? "Приход (оплата долга)" : "Расход (оплата долга)"}
                    </h2>
                    <button
                      type="button"
                      className="money-documents-page__modal-close money-documents-page__modal-close--round"
                      onClick={closePayDebtModal}
                      aria-label="Закрыть"
                    >
                      <X size={20} strokeWidth={2} />
                    </button>
                  </div>
                  <div className="money-documents-page__modal-status">
                    <div className="money-documents-page__modal-status-left">
                      <button
                        type="button"
                        role="switch"
                        aria-checked={payDebtCreateAsPosted}
                        aria-label={payDebtCreateAsPosted ? "Документ проведён" : "Черновик"}
                        className={`money-documents-page__status-toggle ${
                          payDebtCreateAsPosted
                            ? "money-documents-page__status-toggle--on"
                            : ""
                        }`}
                        onClick={() => setPayDebtCreateAsPosted((v) => !v)}
                      >
                        <span className="money-documents-page__status-toggle-slider">
                          {payDebtCreateAsPosted && <Check size={14} strokeWidth={3} />}
                        </span>
                      </button>
                      <span className="money-documents-page__modal-status-text">
                        {payDebtCreateAsPosted ? "Документ проведён" : "Черновик"}
                      </span>
                    </div>
                    <span className="money-documents-page__modal-status-date">
                      {new Date().toLocaleDateString("ru-RU", {
                        day: "numeric",
                        month: "long",
                      })}
                      ,{" "}
                      {new Date().toLocaleTimeString("ru-RU", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                  <form
                    className="money-documents-page__form"
                    onSubmit={handlePayDebtSubmit}
                  >
                    {payDebtError && (
                      <div className="money-documents-page__form-error">
                        {payDebtError}
                      </div>
                    )}
                    <div className="money-documents-page__field">
                      <label htmlFor="pay-debt-cash-register">Касса *</label>
                      <select
                        id="pay-debt-cash-register"
                        value={payDebtForm.cash_register}
                        onChange={(e) =>
                          handlePayDebtFormChange("cash_register", e.target.value)
                        }
                        required
                      >
                        <option value="">выберите</option>
                        {cashRegisters.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name ?? c.id}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="money-documents-page__field">
                      <label>Контрагент</label>
                      <div className="counterparty-detail-page__modal-counterparty">
                        {name}
                      </div>
                    </div>
                    <div className="money-documents-page__field">
                      <label htmlFor="pay-debt-category">Категория платежа *</label>
                      <select
                        id="pay-debt-category"
                        value={payDebtForm.payment_category}
                        onChange={(e) =>
                          handlePayDebtFormChange("payment_category", e.target.value)
                        }
                        required
                      >
                        <option value="">введите</option>
                        {paymentCategories.map((cat) => (
                          <option key={cat.id} value={cat.id}>
                            {cat.title ?? cat.name ?? cat.id}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="money-documents-page__field">
                      <label htmlFor="pay-debt-amount">Сумма, сом *</label>
                      <div className="money-documents-page__amount-wrap">
                        <span className="money-documents-page__amount-prefix">
                          сом
                        </span>
                        <input
                          id="pay-debt-amount"
                          type="text"
                          inputMode="decimal"
                          placeholder="0"
                          value={payDebtForm.amount}
                          onChange={(e) =>
                            handlePayDebtFormChange("amount", e.target.value)
                          }
                          required
                          className="money-documents-page__amount-input"
                        />
                      </div>
                    </div>
                    <div className="money-documents-page__field">
                      <label htmlFor="pay-debt-comment">Комментарий</label>
                      <textarea
                        id="pay-debt-comment"
                        rows={3}
                        placeholder="Добавьте комментарий..."
                        value={payDebtForm.comment}
                        onChange={(e) =>
                          handlePayDebtFormChange("comment", e.target.value)
                        }
                      />
                    </div>
                    <div className="money-documents-page__modal-actions money-documents-page__modal-actions--operation">
                      <button
                        type="submit"
                        className="money-documents-page__btn-save"
                        disabled={payDebtSubmitting}
                      >
                        <Save size={20} />
                        {payDebtSubmitting ? "Сохранение…" : "Сохранить"}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {showEditModal && current && (
        <EditCounterpartyModal
          counterparty={current}
          onClose={() => setShowEditModal(false)}
        />
      )}
    </div>
  );
};

export default CounterpartyDetail;
