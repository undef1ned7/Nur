import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Plus, Tags, Check, X, Save } from "lucide-react";
import warehouseAPI from "../../../../api/warehouse";
import { useConfirm } from "../../../../hooks/useDialog";
import SearchSection from "../../Market/Warehouse/components/SearchSection";
import Pagination from "../../Market/Warehouse/components/Pagination";
import MoneyDocumentCards from "./components/MoneyDocumentCards";
import { useSearch } from "../../Market/Warehouse/hooks/useSearch";
import { usePagination } from "../../Market/Warehouse/hooks/usePagination";
import {
  VIEW_MODES,
  PAGE_SIZE,
  STORAGE_KEY,
} from "../../Market/Warehouse/constants";
import "../../Market/Warehouse/Warehouse.scss";
import "./MoneyDocumentsPage.scss";

const DOC_TYPE_FROM_PARAM = {
  receipt: "MONEY_RECEIPT",
  expense: "MONEY_EXPENSE",
};

const fmtMoney = (v) =>
  (Number(v) || 0).toLocaleString(undefined, { minimumFractionDigits: 0 }) +
  " с";

const fmtDate = (v) => {
  if (!v) return "—";
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? v : d.toLocaleDateString("ru-RU");
};

const statusLabel = (s) =>
  s === "POSTED" ? "Проведён" : s === "DRAFT" ? "Черновик" : s ?? "—";

const initialForm = {
  warehouse: "",
  counterparty: "",
  payment_category: "",
  amount: "",
  comment: "",
};

const MoneyDocumentsPage = () => {
  const { docType: docTypeParam } = useParams();
  const navigate = useNavigate();
  const apiDocType = DOC_TYPE_FROM_PARAM[docTypeParam];
  const isValidType = Boolean(apiDocType);

  const [list, setList] = useState({ results: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [warehouses, setWarehouses] = useState([]);
  const [counterparties, setCounterparties] = useState([]);
  const [categories, setCategories] = useState([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [form, setForm] = useState(initialForm);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");
  const [showCategoriesModal, setShowCategoriesModal] = useState(false);
  const [newCategoryTitle, setNewCategoryTitle] = useState("");
  const [creatingCategory, setCreatingCategory] = useState(false);
  const [categoryError, setCategoryError] = useState("");
  const [postingId, setPostingId] = useState(null); // id документа, для которого идёт проведение/отмена
  const [createAsPosted, setCreateAsPosted] = useState(false); // при создании: провести сразу или черновик
  const [viewMode, setViewMode] = useState(() => {
    if (typeof window === "undefined") return VIEW_MODES.TABLE;
    const saved = localStorage.getItem(`${STORAGE_KEY}_money_docs`);
    if (saved === VIEW_MODES.TABLE || saved === VIEW_MODES.CARDS) return saved;
    return VIEW_MODES.TABLE;
  });
  const confirm = useConfirm();

  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem(`${STORAGE_KEY}_money_docs`, viewMode);
    }
  }, [viewMode]);

  const { searchTerm, debouncedSearchTerm, setSearchTerm } = useSearch();
  const rows = list.results || [];
  const filteredRows = useMemo(() => {
    if (!debouncedSearchTerm?.trim()) return rows;
    const q = debouncedSearchTerm.toLowerCase().trim();
    return rows.filter(
      (r) =>
        (r.number ?? "").toLowerCase().includes(q) ||
        (r.comment ?? "").toLowerCase().includes(q) ||
        (r.counterparty_display_name ?? "").toLowerCase().includes(q)
    );
  }, [rows, debouncedSearchTerm]);

  const {
    currentPage,
    totalPages,
    hasNextPage,
    hasPrevPage,
    getRowNumber,
    handlePageChange: handlePageChangeBase,
    resetToFirstPage,
  } = usePagination(filteredRows.length, null, null);

  useEffect(() => {
    if (debouncedSearchTerm) resetToFirstPage();
  }, [debouncedSearchTerm, resetToFirstPage]);

  const handlePageChange = useCallback(
    (newPage) => {
      handlePageChangeBase(newPage);
    },
    [handlePageChangeBase]
  );

  const displayRows = useMemo(
    () =>
      filteredRows.slice(
        (currentPage - 1) * PAGE_SIZE,
        currentPage * PAGE_SIZE
      ),
    [filteredRows, currentPage]
  );
  const hasNextPageClient = currentPage < totalPages;
  const hasPrevPageClient = currentPage > 1;

  const handleViewModeChange = useCallback((mode) => {
    setViewMode(mode);
  }, []);

  const title =
    docTypeParam === "receipt"
      ? "Приход (деньги)"
      : docTypeParam === "expense"
      ? "Расход (деньги)"
      : "Денежные документы";
  const createLabel =
    docTypeParam === "receipt" ? "Создать приход" : "Создать расход";

  const load = useCallback(async () => {
    if (!apiDocType) return;
    setLoading(true);
    setError("");
    try {
      const data = await warehouseAPI.listMoneyDocuments({
        doc_type: apiDocType,
      });
      const results = data?.results ?? (Array.isArray(data) ? data : []);
      setList({ results });
    } catch (e) {
      setError("Не удалось загрузить список документов");
      setList({ results: [] });
    } finally {
      setLoading(false);
    }
  }, [apiDocType]);

  useEffect(() => {
    if (!isValidType) {
      navigate("/crm/warehouse/documents/money/receipt", { replace: true });
      return;
    }
    load();
  }, [isValidType, navigate, load]);

  const loadCategories = useCallback(async () => {
    try {
      const catData = await warehouseAPI.listMoneyCategories();
      setCategories(
        catData?.results ?? (Array.isArray(catData) ? catData : [])
      );
    } catch {
      setCategories([]);
    }
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const [whData, cpData, catData] = await Promise.all([
          warehouseAPI.listWarehouses(),
          warehouseAPI.listCounterparties(),
          warehouseAPI.listMoneyCategories(),
        ]);
        setWarehouses(whData?.results ?? (Array.isArray(whData) ? whData : []));
        setCounterparties(
          cpData?.results ?? (Array.isArray(cpData) ? cpData : [])
        );
        setCategories(
          catData?.results ?? (Array.isArray(catData) ? catData : [])
        );
      } catch {
        // справочники опциональны для отображения страницы
      }
    })();
  }, []);

  const openCategoriesModal = () => {
    setCategoryError("");
    setNewCategoryTitle("");
    setShowCategoriesModal(true);
  };

  const closeCategoriesModal = () => {
    setShowCategoriesModal(false);
    setNewCategoryTitle("");
    setCategoryError("");
  };

  const handleCreateCategory = async (e) => {
    e.preventDefault();
    setCategoryError("");
    const title = newCategoryTitle?.trim();
    if (!title) {
      setCategoryError("Введите название категории");
      return;
    }
    setCreatingCategory(true);
    try {
      await warehouseAPI.createMoneyCategory({ title });
      setNewCategoryTitle("");
      await loadCategories();
    } catch (err) {
      const msg =
        err?.message ||
        err?.detail ||
        (typeof err === "string" ? err : "Ошибка при создании категории");
      setCategoryError(msg);
    } finally {
      setCreatingCategory(false);
    }
  };

  const openCreateModal = () => {
    setForm(initialForm);
    setCreateError("");
    setCreateAsPosted(false);
    setShowCreateModal(true);
  };

  const closeCreateModal = () => {
    setShowCreateModal(false);
    setForm(initialForm);
    setCreateError("");
  };

  const handleFormChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    setCreateError("");
    const warehouse = form.warehouse?.trim();
    const counterparty = form.counterparty?.trim();
    const payment_category = form.payment_category?.trim();
    const amount = String(form.amount ?? "").trim();
    if (!warehouse || !counterparty || !payment_category || !amount) {
      setCreateError("Заполните склад, контрагента, категорию и сумму");
      return;
    }
    const amountNum = Number(amount.replace(/\s/g, "").replace(",", "."));
    if (Number.isNaN(amountNum) || amountNum <= 0) {
      setCreateError("Укажите корректную сумму");
      return;
    }
    setCreating(true);
    try {
      const created = await warehouseAPI.createMoneyDocument({
        doc_type: apiDocType,
        warehouse,
        counterparty,
        payment_category,
        amount: amountNum,
        comment: form.comment?.trim() || "",
      });
      if (createAsPosted && created?.id) {
        await warehouseAPI.postMoneyDocument(created.id);
      }
      closeCreateModal();
      load();
    } catch (err) {
      const msg =
        err?.message ||
        err?.detail ||
        (typeof err === "string" ? err : "Ошибка при создании документа");
      setCreateError(msg);
    } finally {
      setCreating(false);
    }
  };

  const goBack = () => navigate("/crm/warehouse/documents/all");

  const docDisplayLabel = (row) =>
    row?.number ? `№ ${row.number}` : "(черновик)";

  const handlePost = useCallback(
    (row) => {
      if (!row?.id) return;
      confirm(`Провести документ ${docDisplayLabel(row)}?`, async (result) => {
        if (!result) return;
        setPostingId(row.id);
        try {
          await warehouseAPI.postMoneyDocument(row.id);
          window.alert("Документ успешно проведён");
          load();
        } catch (err) {
          const msg =
            err?.message ||
            err?.detail ||
            (typeof err === "string" ? err : "Ошибка при проведении документа");
          window.alert("Ошибка: " + msg);
        } finally {
          setPostingId(null);
        }
      });
    },
    [confirm, load]
  );

  const handleUnpost = useCallback(
    (row) => {
      if (!row?.id) return;
      confirm(
        `Отменить проведение документа ${docDisplayLabel(row)}?`,
        async (result) => {
          if (!result) return;
          setPostingId(row.id);
          try {
            await warehouseAPI.unpostMoneyDocument(row.id);
            window.alert("Проведение документа отменено");
            load();
          } catch (err) {
            const msg =
              err?.message ||
              err?.detail ||
              (typeof err === "string" ? err : "Ошибка при отмене проведения");
            window.alert("Ошибка: " + msg);
          } finally {
            setPostingId(null);
          }
        }
      );
    },
    [confirm, load]
  );

  if (!isValidType) {
    return null;
  }

  return (
    <div className="warehouse-page">
      <div className="warehouse-header">
        <div className="warehouse-header__left">
          <div className="warehouse-header__icon">
            <div className="warehouse-header__icon-box">💰</div>
          </div>
          <div className="warehouse-header__title-section">
            <h1 className="warehouse-header__title">{title}</h1>
            <p className="warehouse-header__subtitle">Денежные документы</p>
          </div>
        </div>
        <div className="warehouse-header__buttons">
          {/* <button
            type="button"
            className="warehouse-header__secondary-btn"
            onClick={openCategoriesModal}
          >
            <Tags size={16} />
            Категории платежей
          </button> */}
          <button
            type="button"
            className="warehouse-header__create-btn"
            onClick={openCreateModal}
          >
            <Plus size={16} />
            {createLabel}
          </button>
        </div>
      </div>

      <SearchSection
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        viewMode={viewMode}
        onViewModeChange={handleViewModeChange}
        onOpenFilters={null}
        count={rows.length}
        foundCount={filteredRows.length}
        showViewModeToggle={true}
        searchPlaceholder="Поиск по номеру, комментарию, контрагенту..."
      />

      <div className="warehouse-table-container w-full">
        {loading ? (
          <div className="warehouse-table__loading">Загрузка...</div>
        ) : error ? (
          <div className="money-documents-page__error-block">{error}</div>
        ) : displayRows.length === 0 ? (
          <div className="warehouse-table__empty">
            {filteredRows.length === 0 && rows.length > 0
              ? "Ничего не найдено"
              : "Нет документов"}
          </div>
        ) : viewMode === VIEW_MODES.TABLE ? (
          <div className="money-documents-page__table-wrap">
            <table className="warehouse-table money-documents-page__table">
              <thead>
                <tr>
                  <th>№</th>
                  <th>Номер</th>
                  <th>Дата</th>
                  <th>Контрагент</th>
                  <th>Категория</th>
                  <th>Сумма</th>
                  <th>Статус</th>
                  <th>Комментарий</th>
                  <th className="money-documents-page__th-actions">Действия</th>
                </tr>
              </thead>
              <tbody>
                {displayRows.map((row, index) => {
                  const isDraft = row.status === "DRAFT";
                  const isBusy = postingId === row.id;
                  return (
                    <tr key={row.id || Math.random()}>
                      <td>{getRowNumber(index, displayRows.length)}</td>
                      <td>{row.number ?? "—"}</td>
                      <td>{fmtDate(row.date ?? row.created_at)}</td>
                      <td>{row.counterparty_display_name ?? "—"}</td>
                      <td>{row.payment_category_title ?? "—"}</td>
                      <td>{fmtMoney(row.amount)}</td>
                      <td>{statusLabel(row.status)}</td>
                      <td>{row.comment ?? "—"}</td>
                      <td
                        className="money-documents-page__td-actions"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {isDraft ? (
                          <button
                            type="button"
                            className="money-documents-page__action-btn money-documents-page__action-btn--post"
                            onClick={() => handlePost(row)}
                            disabled={isBusy}
                            title="Провести документ"
                          >
                            <Check size={18} />
                            {isBusy ? "…" : "Провести"}
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="money-documents-page__action-btn money-documents-page__action-btn--unpost"
                            onClick={() => handleUnpost(row)}
                            disabled={isBusy}
                            title="Отменить проведение"
                          >
                            <X size={18} />
                            {isBusy ? "…" : "Отменить"}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <MoneyDocumentCards
            documents={displayRows}
            loading={loading}
            getRowNumber={getRowNumber}
            onPost={handlePost}
            onUnpost={handleUnpost}
            postingId={postingId}
          />
        )}

        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          count={filteredRows.length}
          loading={loading}
          hasNextPage={hasNextPageClient}
          hasPrevPage={hasPrevPageClient}
          onPageChange={handlePageChange}
        />
      </div>

      {showCategoriesModal && (
        <div
          className="money-documents-page__modal-overlay"
          onClick={closeCategoriesModal}
          role="presentation"
        >
          <div
            className="money-documents-page__modal money-documents-page__modal--categories"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="categories-modal-title"
          >
            <div className="money-documents-page__modal-header">
              <h2
                id="categories-modal-title"
                className="money-documents-page__modal-title"
              >
                Категории платежей
              </h2>
              <button
                type="button"
                className="money-documents-page__modal-close"
                onClick={closeCategoriesModal}
                aria-label="Закрыть"
              >
                ×
              </button>
            </div>
            <div className="money-documents-page__categories-content">
              <form
                className="money-documents-page__category-form"
                onSubmit={handleCreateCategory}
              >
                {categoryError && (
                  <div className="money-documents-page__form-error">
                    {categoryError}
                  </div>
                )}
                <div className="money-documents-page__field">
                  <label htmlFor="money-category-title">Новая категория</label>
                  <div className="money-documents-page__category-form-row">
                    <input
                      id="money-category-title"
                      type="text"
                      placeholder="Название категории"
                      value={newCategoryTitle}
                      onChange={(e) => setNewCategoryTitle(e.target.value)}
                      autoComplete="off"
                    />
                    <button
                      type="submit"
                      className="money-documents-page__btn-submit money-documents-page__btn-submit--small"
                      disabled={creatingCategory}
                    >
                      {creatingCategory ? "Создание…" : "Создать"}
                    </button>
                  </div>
                </div>
              </form>
              <div className="money-documents-page__categories-list-wrap">
                <div className="money-documents-page__categories-list-title">
                  Список категорий
                </div>
                {categories.length === 0 ? (
                  <div className="money-documents-page__categories-empty">
                    Нет категорий
                  </div>
                ) : (
                  <ul className="money-documents-page__categories-list">
                    {categories.map((cat) => (
                      <li
                        key={cat.id}
                        className="money-documents-page__categories-item"
                      >
                        {cat.title ?? cat.name ?? "—"}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {showCreateModal && (
        <div
          className="money-documents-page__modal-overlay"
          onClick={closeCreateModal}
          role="presentation"
        >
          <div
            className="money-documents-page__modal money-documents-page__modal--operation"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="money-doc-modal-title"
          >
            <div className="money-documents-page__modal-header money-documents-page__modal-header--operation">
              <h2
                id="money-doc-modal-title"
                className="money-documents-page__modal-title money-documents-page__modal-title--operation"
              >
                {docTypeParam === "receipt" ? "Приход" : "Расход"}
              </h2>
              <button
                type="button"
                className="money-documents-page__modal-close money-documents-page__modal-close--round"
                onClick={closeCreateModal}
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
                  aria-checked={createAsPosted}
                  aria-label={createAsPosted ? "Документ проведён" : "Черновик"}
                  className={`money-documents-page__status-toggle ${
                    createAsPosted
                      ? "money-documents-page__status-toggle--on"
                      : ""
                  }`}
                  onClick={() => setCreateAsPosted((v) => !v)}
                >
                  <span className="money-documents-page__status-toggle-slider">
                    {createAsPosted && <Check size={14} strokeWidth={3} />}
                  </span>
                </button>
                <span className="money-documents-page__modal-status-text">
                  {createAsPosted ? "Документ проведён" : "Черновик"}
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
              onSubmit={handleCreateSubmit}
            >
              {createError && (
                <div className="money-documents-page__form-error">
                  {createError}
                </div>
              )}
              <div className="money-documents-page__field">
                <label htmlFor="money-doc-warehouse">Склад *</label>
                <select
                  id="money-doc-warehouse"
                  value={form.warehouse}
                  onChange={(e) =>
                    handleFormChange("warehouse", e.target.value)
                  }
                  required
                >
                  <option value="">выберите</option>
                  {warehouses.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name ?? w.title ?? w.id}
                    </option>
                  ))}
                </select>
              </div>
              <div className="money-documents-page__field">
                <label htmlFor="money-doc-counterparty">Контрагент *</label>
                <select
                  id="money-doc-counterparty"
                  value={form.counterparty}
                  onChange={(e) =>
                    handleFormChange("counterparty", e.target.value)
                  }
                  required
                >
                  <option value="">введите</option>
                  {counterparties.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name ?? c.full_name ?? c.title ?? c.id}
                    </option>
                  ))}
                </select>
              </div>
              <div className="money-documents-page__field">
                <label htmlFor="money-doc-category">Категория платежа *</label>
                <select
                  id="money-doc-category"
                  value={form.payment_category}
                  onChange={(e) =>
                    handleFormChange("payment_category", e.target.value)
                  }
                  required
                >
                  <option value="">введите</option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.title ?? cat.name ?? cat.id}
                    </option>
                  ))}
                </select>
              </div>
              <div className="money-documents-page__field">
                <label htmlFor="money-doc-amount">Сумма, сом *</label>
                <div className="money-documents-page__amount-wrap">
                  <span className="money-documents-page__amount-prefix">
                    сом
                  </span>
                  <input
                    id="money-doc-amount"
                    type="text"
                    inputMode="decimal"
                    placeholder="0"
                    value={form.amount}
                    onChange={(e) => handleFormChange("amount", e.target.value)}
                    required
                    className="money-documents-page__amount-input"
                  />
                </div>
              </div>
              <div className="money-documents-page__field">
                <label htmlFor="money-doc-comment">Комментарий</label>
                <textarea
                  id="money-doc-comment"
                  rows={3}
                  placeholder="Добавьте комментарий..."
                  value={form.comment}
                  onChange={(e) => handleFormChange("comment", e.target.value)}
                />
              </div>
              <div className="money-documents-page__modal-actions money-documents-page__modal-actions--operation">
                <button
                  type="submit"
                  className="money-documents-page__btn-save"
                  disabled={creating}
                >
                  <Save size={20} />
                  {creating ? "Сохранение…" : "Сохранить"}
                </button>
                {/* <button type="button" className="money-documents-page__btn-cancel-round" onClick={closeCreateModal} aria-label="Отмена">
                  <X size={20} strokeWidth={2} />
                </button> */}
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default MoneyDocumentsPage;
