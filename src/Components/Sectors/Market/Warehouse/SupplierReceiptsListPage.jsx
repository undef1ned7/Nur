import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, RefreshCw, X } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import api from "../../../../api";
import DataContainer from "../../../common/DataContainer/DataContainer";
import SearchableCombobox from "../../../common/SearchableCombobox/SearchableCombobox";
import Pagination from "./components/Pagination";
import { useAlert } from "../../../../hooks/useDialog";
import { validateResErrors } from "../../../../../tools/validateResErrors";
import "./SupplierReceiptPage.scss";

const DEFAULT_LIMIT = 20;

const listFrom = (res) => res?.data?.results || res?.data || [];

const parseFiltersFromSearchParams = (searchParams) => ({
  supplier_id: searchParams.get("supplier_id") || "",
  date_from: searchParams.get("date_from") || "",
  date_to: searchParams.get("date_to") || "",
});

const parsePageFromSearchParams = (searchParams) => {
  const page = parseInt(searchParams.get("page") || "1", 10);
  return Number.isFinite(page) && page > 0 ? page : 1;
};

const parseLimitFromSearchParams = (searchParams) => {
  const limit = parseInt(searchParams.get("limit") || String(DEFAULT_LIMIT), 10);
  return Number.isFinite(limit) && limit > 0 ? limit : DEFAULT_LIMIT;
};

const buildProcurementSearchParams = ({
  page = 1,
  limit = DEFAULT_LIMIT,
  supplier_id = "",
  date_from = "",
  date_to = "",
}) => {
  const params = new URLSearchParams();
  params.set("page", String(page));
  params.set("limit", String(limit));
  if (supplier_id) params.set("supplier_id", supplier_id);
  if (date_from) params.set("date_from", date_from);
  if (date_to) params.set("date_to", date_to);
  return params;
};

const parseReceiptsListResponse = (res) => {
  const data = res?.data;
  const rows = listFrom(res);
  const list = Array.isArray(rows) ? rows : [];
  const meta = data?.meta && typeof data.meta === "object" ? data.meta : {};
  const rawTotal =
    meta.total_amount ?? data?.total_amount ?? meta.procurements_total_amount ?? null;
  const totalAmount =
    rawTotal != null && rawTotal !== "" && Number.isFinite(Number(rawTotal))
      ? Number(rawTotal)
      : null;

  return {
    list,
    count: Number(data?.count) || list.length,
    next: data?.next ?? null,
    previous: data?.previous ?? null,
    totalAmount,
  };
};

const fmtDateTime = (value) => {
  if (!value) return "—";
  try {
    const d = new Date(value);
    return d.toLocaleString("ru-RU");
  } catch {
    return String(value);
  }
};

const fmtNum = (value) =>
  Number(value || 0).toLocaleString("ru-RU", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });

const receiptItemLabel = (it) => {
  if (!it || typeof it !== "object") return "—";
  const p = it.product;
  if (p && typeof p === "object") {
    return (
      p.product_name ||
      p.name ||
      p.title ||
      p.article ||
      p.barcode ||
      "—"
    );
  }
  return (
    it.product_name ||
    it.name ||
    it.title ||
    it.product_title ||
    (it.product != null ? `Товар #${it.product}` : "—")
  );
};

const calcReceiptTotal = (items) =>
  (Array.isArray(items) ? items : []).reduce(
    (sum, it) => sum + Number(it.qty || 0) * Number(it.purchase_price || 0),
    0,
  );

const receiptRowTotal = (row) => {
  if (!row || typeof row !== "object") return 0;
  const preset = row.total_amount ?? row.amount ?? row.sum;
  if (preset != null && preset !== "" && Number.isFinite(Number(preset))) {
    return Number(preset);
  }
  return calcReceiptTotal(row.items);
};

export default function SupplierReceiptsListPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const alert = useAlert();

  const page = useMemo(() => parsePageFromSearchParams(searchParams), [searchParams]);
  const limit = useMemo(() => parseLimitFromSearchParams(searchParams), [searchParams]);
  const appliedFilters = useMemo(
    () => parseFiltersFromSearchParams(searchParams),
    [searchParams],
  );

  const [loading, setLoading] = useState(false);
  const [suppliersLoading, setSuppliersLoading] = useState(false);
  const [createSupplierOpen, setCreateSupplierOpen] = useState(false);
  const [createSupplierName, setCreateSupplierName] = useState("");
  const [createSupplierPhone, setCreateSupplierPhone] = useState("");
  const [createSupplierSaving, setCreateSupplierSaving] = useState(false);
  const [receipts, setReceipts] = useState([]);
  const [listCount, setListCount] = useState(0);
  const [listNext, setListNext] = useState(null);
  const [listPrevious, setListPrevious] = useState(null);
  const [totalAmount, setTotalAmount] = useState(null);
  const [suppliers, setSuppliers] = useState([]);
  const [detailReceipt, setDetailReceipt] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const openReceiptDetail = async (row) => {
    if (!row) return;
    const rowId = row.id ?? row.uuid;
    setDetailLoading(false);
    setDetailReceipt(row);
    const existing = Array.isArray(row.items) ? row.items : [];
    if (existing.length > 0 || rowId == null || rowId === "") return;
    try {
      setDetailLoading(true);
      const { data } = await api.get(
        `/main/suppliers/receipts/${encodeURIComponent(String(rowId))}/`,
      );
      const items = Array.isArray(data?.items)
        ? data.items
        : Array.isArray(data?.lines)
          ? data.lines
          : [];
      setDetailReceipt((prev) =>
        prev && String(prev.id ?? prev.uuid) === String(rowId)
          ? { ...prev, ...data, items }
          : prev,
      );
    } catch {
      /* оставляем строку из списка; в модалке будет текст про отсутствие позиций */
    } finally {
      setDetailLoading(false);
    }
  };

  const closeReceiptDetail = () => {
    setDetailReceipt(null);
    setDetailLoading(false);
  };
  const emptyFilters = useMemo(
    () => ({
      supplier_id: "",
      date_from: "",
      date_to: "",
    }),
    [],
  );
  const [filtersDraft, setFiltersDraft] = useState(() =>
    parseFiltersFromSearchParams(searchParams),
  );

  const replaceListSearchParams = useCallback(
    (patch) => {
      setSearchParams(
        (prev) => {
          const current = {
            page: parsePageFromSearchParams(prev),
            limit: parseLimitFromSearchParams(prev),
            ...parseFiltersFromSearchParams(prev),
            ...patch,
          };
          const next = buildProcurementSearchParams(current);
          if (prev.toString() === next.toString()) return prev;
          return next;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  useEffect(() => {
    setFiltersDraft(parseFiltersFromSearchParams(searchParams));
  }, [searchParams]);

  const hasPendingChanges = useMemo(
    () => JSON.stringify(filtersDraft) !== JSON.stringify(appliedFilters),
    [filtersDraft, appliedFilters],
  );
  const hasAnyFilter = useMemo(
    () =>
      Boolean(
        appliedFilters.supplier_id || appliedFilters.date_from || appliedFilters.date_to,
      ),
    [appliedFilters],
  );
  const dateRangeInvalid = useMemo(() => {
    if (!filtersDraft.date_from || !filtersDraft.date_to) return false;
    return filtersDraft.date_from > filtersDraft.date_to;
  }, [filtersDraft.date_from, filtersDraft.date_to]);

  const supplierOptions = useMemo(
    () =>
      (suppliers || []).map((s) => ({
        value: String(s.id || ""),
        label:
          String(s.full_name || s.name || s.company_name || s.phone || "Без названия").trim() ||
          "Без названия",
      })),
    [suppliers],
  );

  const loadSuppliers = async () => {
    try {
      setSuppliersLoading(true);
      const res = await api.get("/main/clients/", {
        params: { type: "suppliers", page_size: 500 },
      });
      const rows = listFrom(res);
      setSuppliers(Array.isArray(rows) ? rows : []);
    } catch (error) {
      setSuppliers([]);
      const errorMessage = validateResErrors(error, "Ошибка загрузки поставщиков");
      alert(errorMessage, true);
    } finally {
      setSuppliersLoading(false);
    }
  };

  const loadReceipts = useCallback(async () => {
    try {
      setLoading(true);
      const params = {
        page,
        limit,
      };
      if (appliedFilters.supplier_id) params.supplier_id = appliedFilters.supplier_id;
      if (appliedFilters.date_from) params.date_from = appliedFilters.date_from;
      if (appliedFilters.date_to) params.date_to = appliedFilters.date_to;

      const res = await api.get("/main/suppliers/receipts/", { params });
      const { list, count, next, previous, totalAmount: metaTotal } =
        parseReceiptsListResponse(res);
      setReceipts(list);
      setListCount(count);
      setListNext(next);
      setListPrevious(previous);
      setTotalAmount(metaTotal);
    } catch (error) {
      setReceipts([]);
      setListCount(0);
      setListNext(null);
      setListPrevious(null);
      setTotalAmount(null);
      const errorMessage = validateResErrors(error, "Ошибка загрузки списка закупок");
      alert(errorMessage, true);
    } finally {
      setLoading(false);
    }
  }, [appliedFilters.date_from, appliedFilters.date_to, appliedFilters.supplier_id, limit, page]);

  const handleCreateSupplier = async () => {
    const full_name = String(createSupplierName || "").trim();
    const phone = String(createSupplierPhone || "").trim();
    if (!full_name) {
      alert("Введите имя поставщика.", true);
      return;
    }
    if (!phone) {
      alert("Введите телефон поставщика.", true);
      return;
    }
    try {
      setCreateSupplierSaving(true);
      const { data } = await api.post("/main/clients/", {
        type: "suppliers",
        full_name,
        phone,
      });
      await loadSuppliers();
      const createdId = String(data?.id || "").trim();
      if (createdId) {
        setFiltersDraft((prev) => ({ ...prev, supplier_id: createdId }));
      }
      setCreateSupplierOpen(false);
      setCreateSupplierName("");
      setCreateSupplierPhone("");
    } catch (error) {
      const errorMessage = validateResErrors(error, "Ошибка создания поставщика");
      alert(errorMessage, true);
    } finally {
      setCreateSupplierSaving(false);
    }
  };

  useEffect(() => {
    void loadSuppliers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    void loadReceipts();
  }, [loadReceipts]);

  const totalPages = useMemo(
    () => (listCount && limit ? Math.max(1, Math.ceil(listCount / limit)) : 1),
    [listCount, limit],
  );

  const handlePageChange = (newPage) => {
    if (newPage < 1 || (totalPages && newPage > totalPages)) return;
    replaceListSearchParams({ page: newPage });
  };

  const handleApplyFilters = () => {
    if (dateRangeInvalid) {
      alert("Дата 'до' не может быть раньше даты 'от'.", true);
      return;
    }
    replaceListSearchParams({
      page: 1,
      supplier_id: filtersDraft.supplier_id,
      date_from: filtersDraft.date_from,
      date_to: filtersDraft.date_to,
    });
  };

  const handleResetFilters = () => {
    setFiltersDraft(emptyFilters);
    replaceListSearchParams({
      page: 1,
      supplier_id: "",
      date_from: "",
      date_to: "",
    });
  };

  return (
    <div className="warehouse-page market-receipt-page">
      <div className="warehouse-header">
        <div className="warehouse-header__left">
          <div className="warehouse-header__title-section">
            <h1 className="warehouse-header__title">Закупки</h1>
            <p className="warehouse-header__subtitle">Список оприходований поставщиков</p>
          </div>
        </div>
        {!dateRangeInvalid && (
          <div
            className={`market-receipt-page__summary market-receipt-page__summary--header${loading ? " market-receipt-page__summary--loading" : ""}`}
          >
            <div className="market-receipt-page__summary-item">
              <span className="market-receipt-page__summary-label">Всего закупок</span>
              <strong>{listCount}</strong>
            </div>
            <div className="market-receipt-page__summary-item">
              <span className="market-receipt-page__summary-label">Общая сумма</span>
              <strong>{totalAmount != null ? fmtNum(totalAmount) : "—"}</strong>
            </div>
          </div>
        )}
      </div>

      <DataContainer>
        <div className="market-receipt-page__card">
          <div className="market-receipt-page__toolbar">
            <div className="market-receipt-page__field">
              <label className="market-receipt-page__label">Поставщик</label>
              <div className="market-receipt-page__supplier-row">
                <SearchableCombobox
                  value={filtersDraft.supplier_id}
                  onChange={(v) =>
                    setFiltersDraft((prev) => ({ ...prev, supplier_id: String(v || "") }))
                  }
                  options={[{ value: "", label: "Все поставщики" }, ...supplierOptions]}
                  placeholder={suppliersLoading ? "Загрузка..." : "Все поставщики"}
                  classNamePrefix="searchableCombo"
                />
                <button
                  type="button"
                  className="market-receipt-page__supplier-add"
                  onClick={() => setCreateSupplierOpen(true)}
                  title="Добавить поставщика"
                >
                  <Plus size={16} />
                </button>
              </div>
            </div>
            <div className="market-receipt-page__field market-receipt-page__field--date">
              <label className="market-receipt-page__label">Дата от</label>
              <input
                className="market-receipt-page__qty-input"
                type="date"
                value={filtersDraft.date_from}
                onChange={(e) =>
                  setFiltersDraft((prev) => ({ ...prev, date_from: e.target.value }))
                }
              />
            </div>
            <div className="market-receipt-page__field market-receipt-page__field--date">
              <label className="market-receipt-page__label">Дата до</label>
              <input
                className="market-receipt-page__qty-input"
                type="date"
                value={filtersDraft.date_to}
                onChange={(e) =>
                  setFiltersDraft((prev) => ({ ...prev, date_to: e.target.value }))
                }
              />
            </div>
          </div>

          <div className="market-receipt-page__actions">
            <button
              type="button"
              className="market-receipt-page__secondary-button"
              onClick={handleApplyFilters}
              disabled={loading || !hasPendingChanges || dateRangeInvalid}
            >
              Применить
            </button>
            <button
              type="button"
              className="market-receipt-page__secondary-button"
              onClick={handleResetFilters}
              disabled={loading || (!hasAnyFilter && !hasPendingChanges)}
            >
              Сбросить
            </button>
            <button
              type="button"
              className="market-receipt-page__secondary-button"
              onClick={loadReceipts}
              disabled={loading}
            >
              <RefreshCw size={16} />
              Обновить
            </button>
            <button
              type="button"
              className="market-receipt-page__primary-button"
              onClick={() => navigate("/crm/market/procurement/receipt")}
            >
              <Plus size={16} />
              Прием товара
            </button>
          </div>
          {dateRangeInvalid && (
            <div className="market-receipt-page__empty">
              Проверьте диапазон дат: дата окончания раньше даты начала.
            </div>
          )}

          {loading ? (
            <div className="market-receipt-page__empty">Загрузка...</div>
          ) : receipts.length === 0 ? (
            <div className="market-receipt-page__empty">Закупки не найдены.</div>
          ) : (
            <div className="market-receipt-page__table-wrap">
              <table className="market-receipt-page__table">
                <thead>
                  <tr>
                    <th>Поставщик</th>
                    <th>Создал</th>
                    <th>Дата</th>
                    <th>Позиций</th>
                    <th>Сумма</th>
                  </tr>
                </thead>
                <tbody>
                  {receipts.map((row, rowIdx) => {
                    const rowKey = row.id ?? row.uuid ?? `receipt-row-${rowIdx}`;
                    const items = Array.isArray(row.items) ? row.items : [];
                    const total = receiptRowTotal(row);
                    return (
                      <tr
                        key={rowKey}
                        className="market-receipt-page__table-row--clickable"
                        role="button"
                        tabIndex={0}
                        onClick={() => void openReceiptDetail(row)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            void openReceiptDetail(row);
                          }
                        }}
                      >
                        <td>{row.supplier_name || "—"}</td>
                        <td>{row.created_by_name || "—"}</td>
                        <td>{fmtDateTime(row.created_at)}</td>
                        <td>{items.length}</td>
                        <td>{fmtNum(total)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {!loading && !dateRangeInvalid && totalPages > 1 && (
            <Pagination
              currentPage={page}
              totalPages={totalPages}
              count={listCount}
              countLabel="закупок"
              loading={loading}
              hasNextPage={Boolean(listNext)}
              hasPrevPage={Boolean(listPrevious)}
              onPageChange={handlePageChange}
            />
          )}
        </div>
      </DataContainer>
      {detailReceipt && (
        <div
          className="market-receipt-page__modal-overlay"
          onClick={closeReceiptDetail}
          role="presentation"
        >
          <div
            className="market-receipt-page__modal-card market-receipt-page__modal-card--detail"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="receipt-detail-title"
          >
            <div className="market-receipt-page__detail-head">
              <h3 id="receipt-detail-title" className="market-receipt-page__modal-title">
                Позиции прихода
              </h3>
              <button
                type="button"
                className="market-receipt-page__detail-close"
                onClick={closeReceiptDetail}
                aria-label="Закрыть"
              >
                <X size={20} />
              </button>
            </div>
            <div className="market-receipt-page__detail-meta">
              <span>
                <strong>Поставщик:</strong> {detailReceipt.supplier_name || "—"}
              </span>
              <span>
                <strong>Создал:</strong> {detailReceipt.created_by_name || "—"}
              </span>
              <span>
                <strong>Дата:</strong> {fmtDateTime(detailReceipt.created_at)}
              </span>
            </div>
            {detailLoading ? (
              <p className="market-receipt-page__detail-empty">Загрузка позиций…</p>
            ) : (() => {
              const items = Array.isArray(detailReceipt.items) ? detailReceipt.items : [];
              if (items.length === 0) {
                return (
                  <p className="market-receipt-page__detail-empty">Нет позиций для отображения.</p>
                );
              }
              return (
                <div className="market-receipt-page__detail-table-wrap">
                  <table className="market-receipt-page__detail-table">
                    <thead>
                      <tr>
                        <th>№</th>
                        <th>Наименование</th>
                        <th>Кол-во</th>
                        <th>Цена закупки</th>
                        <th>Сумма</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((it, idx) => {
                        const qty = Number(it.qty || 0);
                        const price = Number(it.purchase_price || 0);
                        const line = qty * price;
                        return (
                            <tr key={`${detailReceipt.id ?? detailReceipt.uuid}-${idx}`}>
                            <td>{idx + 1}</td>
                            <td>{receiptItemLabel(it)}</td>
                            <td>{fmtNum(qty)}</td>
                            <td>{fmtNum(price)}</td>
                            <td>{fmtNum(line)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              );
            })()}
            <div className="market-receipt-page__actions">
              <button
                type="button"
                className="market-receipt-page__secondary-button"
                onClick={closeReceiptDetail}
              >
                Закрыть
              </button>
            </div>
          </div>
        </div>
      )}
      {createSupplierOpen && (
        <div className="market-receipt-page__modal-overlay" onClick={() => setCreateSupplierOpen(false)}>
          <div className="market-receipt-page__modal-card" onClick={(e) => e.stopPropagation()}>
            <h3 className="market-receipt-page__modal-title">Новый поставщик</h3>
            <div className="market-receipt-page__field">
              <label className="market-receipt-page__label">Имя *</label>
              <input
                className="market-receipt-page__qty-input market-receipt-page__qty-input--mobile"
                value={createSupplierName}
                onChange={(e) => setCreateSupplierName(e.target.value)}
                placeholder="Название/ФИО"
              />
            </div>
            <div className="market-receipt-page__field">
              <label className="market-receipt-page__label">Телефон *</label>
              <input
                className="market-receipt-page__qty-input market-receipt-page__qty-input--mobile"
                value={createSupplierPhone}
                onChange={(e) => setCreateSupplierPhone(e.target.value)}
                placeholder="+996..."
              />
            </div>
            <div className="market-receipt-page__actions">
              <button
                type="button"
                className="market-receipt-page__secondary-button"
                onClick={() => setCreateSupplierOpen(false)}
                disabled={createSupplierSaving}
              >
                Отмена
              </button>
              <button
                type="button"
                className="market-receipt-page__primary-button"
                onClick={handleCreateSupplier}
                disabled={createSupplierSaving}
              >
                {createSupplierSaving ? "Сохранение..." : "Сохранить"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
