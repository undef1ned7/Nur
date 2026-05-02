import { useEffect, useMemo, useState } from "react";
import { Plus, RefreshCw, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import api from "../../../../api";
import DataContainer from "../../../common/DataContainer/DataContainer";
import SearchableCombobox from "../../../common/SearchableCombobox/SearchableCombobox";
import { useAlert } from "../../../../hooks/useDialog";
import { validateResErrors } from "../../../../../tools/validateResErrors";
import "./SupplierReceiptPage.scss";

const listFrom = (res) => res?.data?.results || res?.data || [];

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

export default function SupplierReceiptsListPage() {
  const navigate = useNavigate();
  const alert = useAlert();

  const [loading, setLoading] = useState(false);
  const [suppliersLoading, setSuppliersLoading] = useState(false);
  const [createSupplierOpen, setCreateSupplierOpen] = useState(false);
  const [createSupplierName, setCreateSupplierName] = useState("");
  const [createSupplierPhone, setCreateSupplierPhone] = useState("");
  const [createSupplierSaving, setCreateSupplierSaving] = useState(false);
  const [receipts, setReceipts] = useState([]);
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
  const [filtersDraft, setFiltersDraft] = useState(emptyFilters);
  const [appliedFilters, setAppliedFilters] = useState(emptyFilters);
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

  const loadReceipts = async () => {
    try {
      setLoading(true);
      const params = {};
      if (appliedFilters.supplier_id) params.supplier_id = appliedFilters.supplier_id;
      if (appliedFilters.date_from) params.date_from = appliedFilters.date_from;
      if (appliedFilters.date_to) params.date_to = appliedFilters.date_to;

      const res = await api.get("/main/suppliers/receipts/", { params });
      const rows = listFrom(res);
      setReceipts(Array.isArray(rows) ? rows : []);
    } catch (error) {
      setReceipts([]);
      const errorMessage = validateResErrors(error, "Ошибка загрузки списка закупок");
      alert(errorMessage, true);
    } finally {
      setLoading(false);
    }
  };

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appliedFilters.supplier_id, appliedFilters.date_from, appliedFilters.date_to]);

  const handleApplyFilters = () => {
    if (dateRangeInvalid) {
      alert("Дата 'до' не может быть раньше даты 'от'.", true);
      return;
    }
    setAppliedFilters(filtersDraft);
  };

  const handleResetFilters = () => {
    setFiltersDraft(emptyFilters);
    setAppliedFilters(emptyFilters);
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
                    const total = items.reduce(
                      (sum, it) => sum + Number(it.qty || 0) * Number(it.purchase_price || 0),
                      0,
                    );
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
