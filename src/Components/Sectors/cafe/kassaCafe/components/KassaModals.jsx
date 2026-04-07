import React, { useEffect, useMemo, useState } from "react";
import { FaCheck, FaPlus, FaTimes, FaTrash } from "react-icons/fa";
import api from "../../../../../api";
import SearchableCombobox from "../../../../common/SearchableCombobox/SearchableCombobox";

/* helpers */
const money = (v) =>
  (Number(v) || 0).toLocaleString("ru-RU", { minimumFractionDigits: 0 }) + " c";
const whenDT = (iso) => (iso ? new Date(iso).toLocaleString() : "—");

const sanitizeDecimalInput = (value) => {
  const raw = String(value ?? "").replace(",", ".");
  const cleaned = raw.replace(/[^\d.]/g, "");
  const parts = cleaned.split(".");
  if (parts.length <= 1) return cleaned;
  return `${parts[0]}.${parts.slice(1).join("")}`;
};

const asArray = (d) =>
  Array.isArray(d?.results) ? d.results : Array.isArray(d) ? d : [];

/* ───────────────────────────────────────────────── */
/* Row: используй внутри модалок (чтобы не плодить инлайны) */
const Row = ({ label, value }) => (
  <div className="cafeKassa__row">
    <div className="cafeKassa__rowLabel">{label}</div>
    <div className="cafeKassa__rowValue">{value || "—"}</div>
  </div>
);

/* ───────────────────────────────────────────────── */
/* Модалка: детали операции */
export const OperationDetailsModal = ({
  open,
  op,
  opDetail,
  opLoading,
  cashboxTitle,
  onClose,
}) => {
  if (!open || !op) return null;

  const pillClass =
    op.type === "income"
      ? "cafeKassa__pill cafeKassa__pill--income"
      : "cafeKassa__pill cafeKassa__pill--expense";

  return (
    <div className="cafeKassa__modalOverlay" onClick={onClose}>
      <div className="cafeKassa__modal" onClick={(e) => e.stopPropagation()}>
        <div className="cafeKassa__modalHeader">
          <h3 className="cafeKassa__modalTitle cafeKassa__modalTitle--row">
            <span className={pillClass}>
              {op.type === "income" ? "ПРИХОД" : "РАСХОД"}
            </span>
            <span className="cafeKassa__amount">{money(op.amount)}</span>
          </h3>

          <button
            className="cafeKassa__iconBtn"
            onClick={onClose}
            aria-label="Закрыть"
            type="button"
          >
            ×
          </button>
        </div>

        <div className="cafeKassa__form cafeKassa__form--grid">
          <div className="cafeKassa__box">
            <div className="cafeKassa__boxTitle">Общее</div>
            <Row label="Наименование" value={op.title || "—"} />
            <Row label="Дата/время" value={whenDT(op.created_at)} />
            <Row label="Касса" value={cashboxTitle || "—"} />
            {opDetail?.category && <Row label="Категория" value={opDetail.category} />}
            {opDetail?.method && <Row label="Способ оплаты" value={opDetail.method} />}
            {opDetail?.userName && <Row label="Кассир" value={opDetail.userName} />}
          </div>

          {(opDetail?.orderId || opDetail?.tableLabel || opDetail?.zoneTitle) && (
            <div className="cafeKassa__box">
              <div className="cafeKassa__boxTitle">Источник</div>
              {opDetail.orderId && <Row label="Заказ" value={`#${opDetail.orderId}`} />}
              {opDetail.tableLabel && <Row label="Стол" value={opDetail.tableLabel} />}
              {opDetail.zoneTitle && <Row label="Зона" value={opDetail.zoneTitle} />}
            </div>
          )}

          {(opLoading || opDetail?.clientName || opDetail?.clientPhone) && (
            <div className="cafeKassa__box">
              <div className="cafeKassa__boxTitle">Клиент</div>
              {opLoading ? (
                <div>Загрузка данных…</div>
              ) : (
                <>
                  {opDetail?.clientName && <Row label="Имя" value={opDetail.clientName} />}
                  {opDetail?.clientPhone && <Row label="Телефон" value={opDetail.clientPhone} />}
                </>
              )}
            </div>
          )}

          {opDetail?.comment && (
            <div className="cafeKassa__box">
              <div className="cafeKassa__boxTitle">Примечание</div>
              <div>{opDetail.comment}</div>
            </div>
          )}
        </div>

        <div className="cafeKassa__formActions">
          <button className="cafeKassa__btn" onClick={onClose} type="button">
            Закрыть
          </button>
        </div>
      </div>
    </div>
  );
};

/* ───────────────────────────────────────────────── */
/* Модалка: добавление расхода/прихода */
export const AddOperationModal = ({
  open,
  cashboxId,
  onClose,
  onSuccess,
}) => {
  const [form, setForm] = useState({
    name: "",
    amount: "",
    type: "expense",
    category: "",
  });
  const [categories, setCategories] = useState([]);
  const [newCategoryTitle, setNewCategoryTitle] = useState("");
  const [newCategoryCompanyWide, setNewCategoryCompanyWide] = useState(false);
  const [creatingCategory, setCreatingCategory] = useState(false);
  const [newCategoryModalOpen, setNewCategoryModalOpen] = useState(false);
  const [categoryModalError, setCategoryModalError] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      try {
        const { data } = await api.get("/construction/cashflow-categories/", {
          params: { page_size: 500 },
        });
        if (!cancelled) setCategories(asArray(data));
      } catch {
        if (!cancelled) setCategories([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open]);

  if (!open) return null;

  const categoryOptions = [
    { value: "", label: "Без категории" },
    ...categories
      .map((c) => ({
        value: String(c.id ?? c.uuid ?? ""),
        label: String(c.title ?? c.name ?? "—"),
      }))
      .filter((o) => o.value),
  ];

  const handleSubmit = async (e) => {
    e.preventDefault();
    const title = (form.name || "").trim();
    const amt = Number(form.amount?.replace(",", ".")) || 0;

    if (!title) {
      setError("Введите наименование операции");
      return;
    }

    if (amt <= 0) {
      setError("Введите сумму больше нуля");
      return;
    }

    if (!cashboxId) {
      setError("Не указана касса");
      return;
    }

    try {
      setError("");
      setLoading(true);

      const payload = {
        cashbox: cashboxId,
        type: form.type,
        name: title,
        amount: amt,
      };
      const cat = String(form.category || "").trim();
      if (cat) payload.category = cat;

      await api.post("/construction/cashflows/", payload);

      setForm({ name: "", amount: "", type: "expense", category: "" });
      onSuccess?.();
      onClose();
    } catch (e) {
      console.error(e);
      setError("Не удалось добавить операцию. Попробуйте еще раз.");
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading && !creatingCategory) {
      setForm({ name: "", amount: "", type: "expense", category: "" });
      setNewCategoryTitle("");
      setNewCategoryCompanyWide(false);
      setNewCategoryModalOpen(false);
      setCategoryModalError("");
      setError("");
      onClose();
    }
  };

  const closeNewCategoryModal = () => {
    if (!creatingCategory) {
      setNewCategoryModalOpen(false);
      setNewCategoryTitle("");
      setNewCategoryCompanyWide(false);
      setCategoryModalError("");
    }
  };

  const handleCreateCategory = async () => {
    const t = String(newCategoryTitle || "").trim();
    if (!t) {
      setCategoryModalError("Введите название категории");
      return;
    }
    try {
      setCategoryModalError("");
      setCreatingCategory(true);
      const body = { title: t };
      if (newCategoryCompanyWide) body.branch = null;
      const { data } = await api.post("/construction/cashflow-categories/", body);
      const newId = data?.id ?? data?.uuid;
      if (data) setCategories((prev) => [...prev, data]);
      if (newId) setForm((f) => ({ ...f, category: String(newId) }));
      setNewCategoryTitle("");
      setNewCategoryCompanyWide(false);
      setNewCategoryModalOpen(false);
    } catch (e) {
      console.error(e);
      setCategoryModalError("Не удалось создать категорию.");
    } finally {
      setCreatingCategory(false);
    }
  };

  return (
    <div className="cafeKassa__modalOverlay" onClick={handleClose}>
      <div className="cafeKassa__modal" onClick={(e) => e.stopPropagation()}>
        <div className="cafeKassa__modalHeader">
          <h3 className="cafeKassa__modalTitle">Добавить операцию</h3>
          <button
            className="cafeKassa__iconBtn"
            onClick={handleClose}
            aria-label="Закрыть"
            type="button"
            disabled={loading}
          >
            <FaTimes />
          </button>
        </div>

        <form className="cafeKassa__form" onSubmit={handleSubmit}>
          {error && (
            <div className="cafeKassa__alert cafeKassa__alert--error">
              {error}
            </div>
          )}

          <div className="cafeKassa__field">
            <label className="cafeKassa__label">Тип операции *</label>
            <div className="cafeKassa__switch" style={{ margin: 0 }}>
              <button
                type="button"
                className={`cafeKassa__chip ${form.type === "expense" ? "cafeKassa__chip--active" : ""}`}
                onClick={() => setForm((f) => ({ ...f, type: "expense" }))}
                disabled={loading}
              >
                Расход
              </button>
              <button
                type="button"
                className={`cafeKassa__chip ${form.type === "income" ? "cafeKassa__chip--active" : ""}`}
                onClick={() => setForm((f) => ({ ...f, type: "income" }))}
                disabled={loading}
              >
                Приход
              </button>
            </div>
          </div>

          <div className="cafeKassa__field">
            <label className="cafeKassa__label">Наименование *</label>
            <input
              className="cafeKassa__input"
              type="text"
              placeholder="Введите наименование операции"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              required
              disabled={loading}
            />
          </div>

          <div className="cafeKassa__field">
            <label className="cafeKassa__label">Сумма (сом) *</label>
            <input
              className="cafeKassa__input"
              type="text"
              inputMode="decimal"
              placeholder="Введите сумму"
              value={form.amount}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  amount: sanitizeDecimalInput(e.target.value),
                }))
              }
              required
              disabled={loading}
            />
          </div>

          <div className="cafeKassa__field">
            <label className="cafeKassa__label">Категория</label>
            <div className="cafeKassa__categorySelectRow">
              <div className="cafeKassa__categorySelectWrap">
                <SearchableCombobox
                  value={form.category}
                  onChange={(v) => setForm((f) => ({ ...f, category: v || "" }))}
                  options={categoryOptions}
                  placeholder="Без категории"
                  disabled={loading}
                  menuPortal
                />
              </div>
              <button
                type="button"
                className="cafeKassa__iconBtn cafeKassa__addCategoryPlus"
                onClick={() => {
                  setCategoryModalError("");
                  setNewCategoryModalOpen(true);
                }}
                disabled={loading}
                title="Новая категория"
                aria-label="Новая категория"
              >
                <FaPlus />
              </button>
            </div>
            <p className="cafeKassa__hint">Необязательно. Для расходов и приходов.</p>
          </div>

          <div className="cafeKassa__formActions">
            <button
              type="button"
              className="cafeKassa__btn"
              onClick={handleClose}
              disabled={loading}
            >
              Отмена
            </button>
            <button
              type="submit"
              className="cafeKassa__btn cafeKassa__btn--primary"
              disabled={loading}
            >
              {loading ? "Добавление..." : "Добавить"}
            </button>
          </div>
        </form>
      </div>

      {newCategoryModalOpen ? (
        <div
          className="cafeKassa__modalOverlay cafeKassa__modalOverlay--nested"
          onClick={(e) => {
            e.stopPropagation();
            closeNewCategoryModal();
          }}
          role="presentation"
        >
          <div
            className="cafeKassa__modal cafeKassa__modal--nested"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="cafeKassaNewCategoryTitle"
          >
            <div className="cafeKassa__modalHeader">
              <h3 className="cafeKassa__modalTitle" id="cafeKassaNewCategoryTitle">
                Новая категория
              </h3>
              <button
                className="cafeKassa__iconBtn"
                onClick={closeNewCategoryModal}
                aria-label="Закрыть"
                type="button"
                disabled={creatingCategory}
              >
                <FaTimes />
              </button>
            </div>

            <div className="cafeKassa__form">
              {categoryModalError ? (
                <div className="cafeKassa__alert cafeKassa__alert--error">{categoryModalError}</div>
              ) : null}

              <div className="cafeKassa__field">
                <label className="cafeKassa__label">Название *</label>
                <input
                  className="cafeKassa__input"
                  type="text"
                  placeholder="Например, продукты"
                  value={newCategoryTitle}
                  onChange={(e) => setNewCategoryTitle(e.target.value)}
                  disabled={creatingCategory}
                  autoFocus
                />
              </div>
              <label className="cafeKassa__check">
                <input
                  type="checkbox"
                  checked={newCategoryCompanyWide}
                  onChange={(e) => setNewCategoryCompanyWide(e.target.checked)}
                  disabled={creatingCategory}
                />
                <span>На всю компанию (без привязки к филиалу)</span>
              </label>

              <div className="cafeKassa__formActions">
                <button
                  type="button"
                  className="cafeKassa__btn"
                  onClick={closeNewCategoryModal}
                  disabled={creatingCategory}
                >
                  Отмена
                </button>
                <button
                  type="button"
                  className="cafeKassa__btn cafeKassa__btn--primary"
                  onClick={handleCreateCategory}
                  disabled={creatingCategory}
                >
                  {creatingCategory ? "Создание…" : "Создать"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

/* ───────────────────────────────────────────────── */
/* Модалка: категории движений (список, переименование, удаление) */
export const CashflowCategoriesManageModal = ({ open, onClose, onChanged }) => {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [q, setQ] = useState("");
  const [savingId, setSavingId] = useState(null);

  const load = async () => {
    try {
      setError("");
      setLoading(true);
      const { data } = await api.get("/construction/cashflow-categories/", {
        params: { page_size: 500 },
      });
      setRows(asArray(data));
    } catch (e) {
      console.error(e);
      setError("Не удалось загрузить категории");
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!open) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return rows;
    return rows.filter((r) =>
      String(r.title ?? r.name ?? "").toLowerCase().includes(t)
    );
  }, [rows, q]);

  if (!open) return null;

  const rowId = (r) => String(r.id ?? r.uuid ?? "");

  const handleRename = async (r) => {
    const id = rowId(r);
    const title = String(r._editTitle ?? r.title ?? r.name ?? "").trim();
    if (!id || !title) return;
    try {
      setSavingId(id);
      setError("");
      await api.patch(`/construction/cashflow-categories/${id}/`, { title });
      await load();
      onChanged?.();
    } catch (e) {
      console.error(e);
      setError("Не удалось сохранить название");
    } finally {
      setSavingId(null);
    }
  };

  const handleDelete = async (r) => {
    const id = rowId(r);
    if (!id) return;
    if (!window.confirm("Удалить категорию? Движения останутся без категории.")) return;
    try {
      setSavingId(id);
      setError("");
      await api.delete(`/construction/cashflow-categories/${id}/`);
      await load();
      onChanged?.();
    } catch (e) {
      console.error(e);
      setError("Не удалось удалить категорию");
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="cafeKassa__modalOverlay" onClick={onClose}>
      <div
        className="cafeKassa__modal cafeKassa__modal--wide"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="cafeKassa__modalHeader">
          <h3 className="cafeKassa__modalTitle">Категории движений</h3>
          <button
            className="cafeKassa__iconBtn"
            onClick={onClose}
            aria-label="Закрыть"
            type="button"
          >
            <FaTimes />
          </button>
        </div>

        <div className="cafeKassa__form">
          {error && <div className="cafeKassa__alert cafeKassa__alert--error">{error}</div>}

          <div className="cafeKassa__field">
            <label className="cafeKassa__label">Поиск</label>
            <input
              className="cafeKassa__input"
              type="text"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="По названию…"
            />
          </div>

          <div className="cafeKassa__catList">
            {loading ? (
              <div className="cafeKassa__muted">Загрузка…</div>
            ) : filtered.length ? (
              filtered.map((r, idx) => {
                const id = rowId(r);
                const editVal =
                  r._editTitle !== undefined ? r._editTitle : String(r.title ?? r.name ?? "");
                return (
                  <div key={id || `cat-${idx}`} className="cafeKassa__catRow">
                    <input
                      className="cafeKassa__input cafeKassa__input--compact"
                      type="text"
                      value={editVal}
                      onChange={(e) => {
                        const v = e.target.value;
                        setRows((prev) =>
                          prev.map((x) =>
                            rowId(x) === id ? { ...x, _editTitle: v } : x
                          )
                        );
                      }}
                      disabled={savingId === id}
                    />
                    <button
                      type="button"
                      className="cafeKassa__iconBtn cafeKassa__iconBtn--compact"
                      onClick={() => handleRename({ ...r, _editTitle: editVal })}
                      disabled={savingId === id}
                      title="Сохранить"
                      aria-label="Сохранить"
                    >
                      <FaCheck />
                    </button>
                    <button
                      type="button"
                      className="cafeKassa__iconBtn cafeKassa__iconBtn--compact"
                      onClick={() => handleDelete(r)}
                      disabled={savingId === id}
                      title="Удалить"
                      aria-label="Удалить"
                    >
                      <FaTrash />
                    </button>
                  </div>
                );
              })
            ) : (
              <div className="cafeKassa__muted">Нет категорий</div>
            )}
          </div>

          <div className="cafeKassa__formActions">
            <button type="button" className="cafeKassa__btn" onClick={onClose}>
              Закрыть
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

/* ───────────────────────────────────────────────── */
/* Модалка: название кассы */
export const EditCashboxNameModal = ({ open, cashboxId, initialName, onClose, onSaved }) => {
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setName(String(initialName ?? "").trim());
      setError("");
    }
  }, [open, initialName]);

  if (!open) return null;

  const handleClose = () => {
    if (!loading) {
      setError("");
      onClose();
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const trimmed = String(name || "").trim();
    if (!trimmed) {
      setError("Введите название");
      return;
    }
    if (!cashboxId) {
      setError("Не указана касса");
      return;
    }

    try {
      setError("");
      setLoading(true);
      const { data } = await api.patch(`/construction/cashboxes/${cashboxId}/`, { name: trimmed });
      onSaved?.(data, trimmed);
      handleClose();
    } catch (err) {
      console.error(err);
      const d = err?.response?.data;
      const msg =
        (typeof d?.detail === "string" && d.detail) ||
        (Array.isArray(d?.name) && d.name[0]) ||
        (Array.isArray(d?.non_field_errors) && d.non_field_errors[0]) ||
        "Не удалось сохранить. Попробуйте ещё раз.";
      setError(String(msg));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="cafeKassa__modalOverlay" onClick={handleClose}>
      <div className="cafeKassa__modal" onClick={(e) => e.stopPropagation()}>
        <div className="cafeKassa__modalHeader">
          <h3 className="cafeKassa__modalTitle">Редактировать кассу</h3>
          <button
            className="cafeKassa__iconBtn"
            onClick={handleClose}
            aria-label="Закрыть"
            type="button"
            disabled={loading}
          >
            <FaTimes />
          </button>
        </div>

        <form className="cafeKassa__form" onSubmit={handleSubmit}>
          {error && <div className="cafeKassa__alert cafeKassa__alert--error">{error}</div>}

          <div className="cafeKassa__field">
            <label className="cafeKassa__label" htmlFor="cafeKassaEditCashboxName">
              Название *
            </label>
            <input
              id="cafeKassaEditCashboxName"
              className="cafeKassa__input"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={loading}
              autoComplete="off"
            />
          </div>

          <div className="cafeKassa__formActions">
            <button type="button" className="cafeKassa__btn" onClick={handleClose} disabled={loading}>
              Отмена
            </button>
            <button type="submit" className="cafeKassa__btn cafeKassa__btn--primary" disabled={loading}>
              {loading ? "Сохранение..." : "Сохранить"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
