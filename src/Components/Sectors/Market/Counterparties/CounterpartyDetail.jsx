import React, { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import warehouseAPI from "../../../../api/warehouse";
import { useDispatch, useSelector } from "react-redux";
import { getWarehouseCounterpartyById } from "../../../../store/creators/warehouseThunk";
import { clearCurrentCounterparty } from "../../../../store/slices/counterpartySlice";
import "./CounterpartyDetail.scss";

const fmtMoney = (v) =>
  (Number(v) || 0).toLocaleString(undefined, { minimumFractionDigits: 0 }) + " с";

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
const CounterpartyDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const current = useSelector((state) => state.counterparty.current);
  const loadingCurrent = useSelector((state) => state.counterparty.loadingCurrent);

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

  const name = current?.name ?? "—";

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
        const [whData, catData] = await Promise.all([
          warehouseAPI.listWarehouses(),
          warehouseAPI.listMoneyCategories(),
        ]);
        setWarehouses(whData?.results ?? (Array.isArray(whData) ? whData : []));
        setPaymentCategories(catData?.results ?? (Array.isArray(catData) ? catData : []));
      } catch {
        setWarehouses([]);
        setPaymentCategories([]);
      }
    };
    loadOptions();
  }, []);

  const loadOperations = useCallback(async () => {
    if (!id) return;
    setLoadingOperations(true);
    setErrorOperations("");
    try {
      const params = {};
      if (docTypeFilter) params.doc_type = docTypeFilter;
      if (statusFilter) params.status = statusFilter;
      if (warehouseFilter) params.warehouse = warehouseFilter;
      if (paymentCategoryFilter) params.payment_category = paymentCategoryFilter;
      if (searchDebounced) params.search = searchDebounced;
      const data = await warehouseAPI.getCounterpartyMoneyOperations(id, params);
      const list = data?.results ?? (Array.isArray(data) ? data : []);
      setOperations({ results: list });
    } catch (e) {
      setErrorOperations("Не удалось загрузить приход/расход");
      setOperations({ results: [] });
    } finally {
      setLoadingOperations(false);
    }
  }, [id, docTypeFilter, statusFilter, warehouseFilter, paymentCategoryFilter, searchDebounced]);

  useEffect(() => {
    loadOperations();
  }, [loadOperations]);

  const operationRows = operations.results || [];

  const docTypeLabel = (docType) =>
    docType === "MONEY_RECEIPT" ? "Приход" : docType === "MONEY_EXPENSE" ? "Расход" : docType ?? "—";
  const statusLabel = (s) => (s === "POSTED" ? "Проведён" : s === "DRAFT" ? "Черновик" : s ?? "—");

  const goBack = () => navigate("/crm/warehouse/counterparties");

  if (!id) {
    return (
      <div className="counterparty-detail-page">
        <div className="counterparty-detail-page__error">Контрагент не найден</div>
        <button type="button" className="counterparty-detail-page__back" onClick={goBack}>
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
      </header>

      <div className="counterparty-detail-page__body">
        {loadingCurrent ? (
          <div className="counterparty-detail-page__loading">Загрузка данных контрагента...</div>
        ) : (
          <>
            <div className="counterparty-detail-page__operations-toolbar">
              <input
                type="search"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Поиск по номеру, комментарию..."
                className="counterparty-detail-page__search-input"
                aria-label="Поиск по номеру и комментарию"
              />
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
              <div className="counterparty-detail-page__loading">Загрузка...</div>
            ) : errorOperations ? (
              <div className="counterparty-detail-page__error">{errorOperations}</div>
            ) : operationRows.length === 0 ? (
              <div className="counterparty-detail-page__empty">Нет приходов и расходов</div>
            ) : (
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
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default CounterpartyDetail;
