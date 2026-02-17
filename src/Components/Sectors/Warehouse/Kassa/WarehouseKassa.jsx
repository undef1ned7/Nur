import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Search, Plus, X, Inbox, Check } from "lucide-react";
import warehouseAPI from "../../../../api/warehouse";
import { useAlert, useConfirm } from "../../../../hooks/useDialog";
import "../../../Deposits/Kassa/kassa.scss";
import "./WarehouseKassa.scss";

const BASE = "/crm/warehouse/kassa";

const asArray = (d) =>
  Array.isArray(d?.results) ? d.results : Array.isArray(d) ? d : [];
const money = (v) =>
  (Number(v) || 0).toLocaleString("ru-RU", { minimumFractionDigits: 0 }) + " с";
const fmtDate = (v) => (v ? new Date(v).toLocaleDateString("ru-RU") : "—");
const statusLabel = (s) =>
  s === "POSTED" ? "Проведён" : s === "DRAFT" ? "Черновик" : s ?? "—";

/* ──────────────────────────────── Запросы кассы (inbox) ──────────────────────────────── */
const CashRequestsInbox = () => {
  const alert = useAlert();
  const confirm = useConfirm();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [actingId, setActingId] = useState(null);

  const load = useCallback(async () => {
    setErr("");
    setLoading(true);
    try {
      const data = await warehouseAPI.listCashRequests({ status: "PENDING" });
      setRequests(asArray(data));
    } catch (e) {
      console.error(e);
      setErr("Не удалось загрузить запросы");
      setRequests([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleApprove = (requestId) => {
    confirm("Подтвердить запрос кассы?", async (ok) => {
      if (!ok) return;
      setActingId(requestId);
      try {
        await warehouseAPI.approveCashRequest(requestId);
        alert("Запрос подтверждён");
        load();
      } catch (e) {
        alert(e?.detail || e?.message || "Ошибка при подтверждении", true);
      } finally {
        setActingId(null);
      }
    });
  };

  const handleReject = (requestId) => {
    confirm("Отклонить запрос кассы?", async (ok) => {
      if (!ok) return;
      setActingId(requestId);
      try {
        await warehouseAPI.rejectCashRequest(requestId);
        alert("Запрос отклонён");
        load();
      } catch (e) {
        alert(e?.detail || e?.message || "Ошибка при отклонении", true);
      } finally {
        setActingId(null);
      }
    });
  };

  return (
    <div className="warehouse-kassa__inbox">
      <h3 className="warehouse-kassa__inbox-title">
        <Inbox size={20} />
        Запросы кассы (ожидают решения)
      </h3>
      {err && <div className="kassa__alert kassa__alert--error">{err}</div>}
      {loading ? (
        <div className="kassa-table__loading" style={{ padding: 24 }}>
          Загрузка…
        </div>
      ) : !requests.length ? (
        <div className="kassa-table__empty" style={{ padding: 24 }}>
          Нет запросов
        </div>
      ) : (
        <div className="kassa-table-scroll">
          <table className="kassa-table">
            <thead>
              <tr>
                <th>Документ</th>
                <th>Тип</th>
                <th>Дата</th>
                <th>Контрагент</th>
                <th>Сумма</th>
                <th>Действия</th>
              </tr>
            </thead>
            <tbody>
              {requests.map((r) => {
                const doc = r.document || {};
                const busy = actingId === r.id;
                return (
                  <tr key={r.id}>
                    <td>{doc.number ?? "—"}</td>
                    <td>{doc.doc_type ?? "—"}</td>
                    <td>{fmtDate(doc.date)}</td>
                    <td>{doc.counterparty_display_name ?? "—"}</td>
                    <td>{money(r.amount)}</td>
                    <td>
                      <button
                        className="kassa__btn kassa__btn--primary"
                        disabled={busy}
                        onClick={() => handleApprove(r.id)}
                        title="Подтвердить"
                      >
                        <Check size={14} /> Подтвердить
                      </button>{" "}
                      <button
                        className="kassa__btn kassa__btn--secondary"
                        disabled={busy}
                        onClick={() => handleReject(r.id)}
                        title="Отклонить"
                      >
                        <X size={14} /> Отклонить
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

/* ──────────────────────────────── Список касс ──────────────────────────────── */
const CashRegisterList = () => {
  const navigate = useNavigate();
  const alert = useAlert();
  const [tab, setTab] = useState("registers"); // "registers" | "requests"
  const [rows, setRows] = useState([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const [location, setLocation] = useState("");

  const load = useCallback(async () => {
    try {
      setErr("");
      setLoading(true);
      const data = await warehouseAPI.listCashRegisters({ page_size: 200 });
      setRows(asArray(data));
    } catch (e) {
      console.error(e);
      setErr("Не удалось загрузить кассы");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return rows;
    return rows.filter((r) =>
      [r.name, r.location].some((x) =>
        String(x || "")
          .toLowerCase()
          .includes(t)
      )
    );
  }, [rows, q]);

  const onCreate = async () => {
    if (rows.length >= 1) {
      alert("Разрешена только одна касса.", true);
      setCreateOpen(false);
      load();
      return;
    }
    const title = (name || "").trim();
    if (!title) {
      alert("Введите название кассы");
      return;
    }
    try {
      await warehouseAPI.createCashRegister({
        name: title,
        location: (location || "").trim() || undefined,
      });
      setCreateOpen(false);
      setName("");
      setLocation("");
      load();
    } catch (e) {
      console.error(e);
      alert(e?.detail || e?.message || "Не удалось создать кассу", true);
    }
  };

  return (
    <div className="kassa-page warehouse-kassa">
      <div className="kassa-header">
        <div className="kassa-header__left">
          <div className="kassa-header__icon-box">💰</div>
          <div className="kassa-header__title-section">
            <h1 className="kassa-header__title">Касса</h1>
            <p className="kassa-header__subtitle">
              Кассы склада — приход и расход денег
            </p>
          </div>
        </div>
        <div className="flex gap-2 items-center">
          <nav className="kassa-header__nav-tabs kassa-header__nav-tabs--top">
            <button
              type="button"
              className={`kassa-header__nav-tab ${
                tab === "registers" ? "kassa-header__nav-tab--active" : ""
              }`}
              onClick={() => setTab("registers")}
            >
              Кассы
            </button>
            <button
              type="button"
              className={`kassa-header__nav-tab flex gap-2 items-center ${
                tab === "requests" ? "kassa-header__nav-tab--active" : ""
              }`}
              onClick={() => setTab("requests")}
            >
              <Inbox size={16} />
              Запросы
            </button>
          </nav>
          <div className="kassa-header__right">
            {tab === "registers" && rows.length === 0 && (
              <button
                className="kassa-header__create-btn"
                onClick={() => setCreateOpen(true)}
              >
                <Plus size={16} />
                Создать кассу
              </button>
            )}
          </div>
        </div>
      </div>

      {tab === "requests" ? (
        <CashRequestsInbox />
      ) : (
        <>
          <div className="kassa-search-section">
            <div className="kassa-search">
              <Search className="kassa-search__icon" size={18} />
              <input
                type="text"
                className="kassa-search__input"
                placeholder="Поиск по названию или расположению…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </div>
            <div className="kassa-search__meta">
              <span className="kassa-search__info">
                Всего: {filtered.length}
              </span>
            </div>
          </div>

          {err && <div className="kassa__alert kassa__alert--error">{err}</div>}

          <div className="kassa-table-container">
            <div className="kassa-table-scroll">
              <table className="kassa-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Название</th>
                    <th>Расположение</th>
                    <th>Приход</th>
                    <th>Расход</th>
                    <th>Действия</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={6} className="kassa-table__loading">
                        Загрузка…
                      </td>
                    </tr>
                  ) : filtered.length ? (
                    filtered.map((r, i) => (
                      <tr
                        key={r.id}
                        className="kassa__rowClickable"
                        onClick={() => navigate(`${BASE}/${r.id}`)}
                      >
                        <td>{i + 1}</td>
                        <td>
                          <b>{r.name || "—"}</b>
                        </td>
                        <td>{r.location || "—"}</td>
                        <td>—</td>
                        <td>—</td>
                        <td>
                          <button
                            className="kassa__btn kassa__btn--secondary"
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`${BASE}/${r.id}`);
                            }}
                          >
                            Открыть
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="kassa-table__empty">
                        Нет касс
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {createOpen && (
        <div className="kassa-modal" style={{ display: "block" }}>
          <div
            className="kassa-modal__overlay"
            onClick={() => setCreateOpen(false)}
          />
          <div
            className="kassa-modal__card"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="kassa-modal__header">
              <h3 className="kassa-modal__title">Создать кассу</h3>
              <button
                className="kassa-modal__close"
                onClick={() => setCreateOpen(false)}
                aria-label="Закрыть"
              >
                <X size={20} />
              </button>
            </div>
            <div className="kassa-modal__section">
              <label className="kassa-modal__label">Название кассы *</label>
              <input
                className="kassa-modal__input"
                type="text"
                placeholder="Например: Основная касса"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="kassa-modal__section">
              <label className="kassa-modal__label">Расположение</label>
              <input
                className="kassa-modal__input"
                type="text"
                placeholder="Например: Точка продаж №1"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
              />
            </div>
            <div className="kassa-modal__footer">
              <button
                className="kassa__btn"
                onClick={() => setCreateOpen(false)}
              >
                Отмена
              </button>
              <button
                className="kassa__btn kassa__btn--primary"
                onClick={onCreate}
              >
                Сохранить
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

/* ──────────────────────────────── Детали кассы (операции) ──────────────────────────────── */
const CashRegisterDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [operations, setOperations] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState("all"); // all | receipt | expense
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [counterparties, setCounterparties] = useState([]);
  const [categories, setCategories] = useState([]);
  const [form, setForm] = useState({
    counterparty: "",
    payment_category: "",
    amount: "",
    comment: "",
  });
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");
  const [createAsPosted, setCreateAsPosted] = useState(true);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError("");
    try {
      const data = await warehouseAPI.getCashRegisterOperations(id);
      setOperations(data);
    } catch (e) {
      console.error(e);
      setError("Не удалось загрузить данные кассы");
      setOperations(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    (async () => {
      try {
        const [cp, cat] = await Promise.all([
          warehouseAPI.listCounterparties({ page_size: 500 }),
          warehouseAPI.listMoneyCategories({ page_size: 200 }),
        ]);
        setCounterparties(asArray(cp));
        setCategories(asArray(cat));
      } catch {}
    })();
  }, []);

  const receipts = operations?.receipts ?? [];
  const expenses = operations?.expenses ?? [];
  const allDocs = useMemo(
    () =>
      [...receipts, ...expenses].sort(
        (a, b) =>
          new Date(b.date || b.created_at) - new Date(a.date || a.created_at)
      ),
    [receipts, expenses]
  );

  const filtered = useMemo(() => {
    if (activeTab === "all") return allDocs;
    if (activeTab === "receipt") return receipts;
    return expenses;
  }, [activeTab, allDocs, receipts, expenses]);

  const openReceiptModal = () => {
    setForm({
      counterparty: "",
      payment_category: "",
      amount: "",
      comment: "",
    });
    setCreateError("");
    setShowReceiptModal(true);
  };
  const openExpenseModal = () => {
    setForm({
      counterparty: "",
      payment_category: "",
      amount: "",
      comment: "",
    });
    setCreateError("");
    setShowExpenseModal(true);
  };

  const submitMoneyDoc = async (docType) => {
    const amountNum = Number(String(form.amount || "").replace(",", "."));
    if (!form.counterparty?.trim() || !form.payment_category?.trim()) {
      setCreateError("Выберите контрагента и категорию");
      return;
    }
    if (!Number.isFinite(amountNum) || amountNum <= 0) {
      setCreateError("Укажите сумму");
      return;
    }
    setCreating(true);
    setCreateError("");
    try {
      const payload = {
        doc_type: docType,
        cash_register: id,
        counterparty: form.counterparty.trim(),
        payment_category: form.payment_category.trim(),
        amount: amountNum,
        comment: (form.comment || "").trim(),
      };
      const created = await warehouseAPI.createMoneyDocument(payload);
      if (createAsPosted && created?.id) {
        await warehouseAPI.postMoneyDocument(created.id);
      }
      setShowReceiptModal(false);
      setShowExpenseModal(false);
      load();
    } catch (err) {
      setCreateError(
        err?.detail ||
          err?.message ||
          (typeof err === "string" ? err : "Ошибка создания")
      );
    } finally {
      setCreating(false);
    }
  };

  if (!id) {
    return (
      <div className="kassa-page">
        <div className="kassa__alert kassa__alert--error">
          ID кассы не указан
        </div>
      </div>
    );
  }

  return (
    <div className="kassa-page warehouse-kassa warehouse-kassa--detail">
      <div className="kassa-header">
        <div className="kassa-header__left">
          <div className="kassa-header__icon-box">💰</div>
          <div className="kassa-header__title-section">
            <h2 className="kassa-header__title">
              {operations?.name ?? "Касса"}
            </h2>
            <p className="kassa-header__subtitle">
              Баланс: {money(operations?.balance)} · Приход:{" "}
              {money(operations?.receipts_total)} · Расход:{" "}
              {money(operations?.expenses_total)}
            </p>
          </div>
        </div>
        <nav className="kassa-header__nav-tabs">
          <button
            type="button"
            className="kassa-header__nav-tab"
            onClick={() => navigate(BASE)}
          >
            ← Назад
          </button>
          <button
            type="button"
            className={`kassa-header__nav-tab ${
              activeTab === "all" ? "kassa-header__nav-tab--active" : ""
            }`}
            onClick={() => setActiveTab("all")}
          >
            Все
          </button>
          <button
            type="button"
            className={`kassa-header__nav-tab ${
              activeTab === "expense" ? "kassa-header__nav-tab--active" : ""
            }`}
            onClick={() => setActiveTab("expense")}
          >
            Расход
          </button>
          <button
            type="button"
            className={`kassa-header__nav-tab ${
              activeTab === "receipt" ? "kassa-header__nav-tab--active" : ""
            }`}
            onClick={() => setActiveTab("receipt")}
          >
            Приход
          </button>
        </nav>
        <div className="kassa-header__right">
          <button
            className="kassa-header__create-btn warehouse-kassa__btn--receipt"
            onClick={openReceiptModal}
          >
            <Plus size={16} />
            Приход в кассу
          </button>
          <button
            className="kassa-header__create-btn warehouse-kassa__btn--expense"
            onClick={openExpenseModal}
          >
            <Plus size={16} />
            Расход из кассы
          </button>
        </div>
      </div>

      {error && <div className="kassa__alert kassa__alert--error">{error}</div>}

      <div className="kassa-search-section">
        <div className="kassa-search__meta">
          <span className="kassa-search__info">Записей: {filtered.length}</span>
        </div>
      </div>

      <div className="kassa-table-container">
        {loading ? (
          <div className="kassa-table__loading" style={{ padding: 40 }}>
            Загрузка…
          </div>
        ) : !filtered.length ? (
          <div className="kassa-table__empty" style={{ padding: 40 }}>
            Нет операций
          </div>
        ) : (
          <div className="kassa-table-scroll">
            <table className="kassa-table">
              <thead>
                <tr>
                  <th>Тип</th>
                  <th>Номер</th>
                  <th>Дата</th>
                  <th>Контрагент</th>
                  <th>Категория</th>
                  <th>Сумма</th>
                  <th>Статус</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((row) => (
                  <tr key={row.id}>
                    <td>
                      {row.doc_type === "MONEY_RECEIPT" ? "Приход" : "Расход"}
                    </td>
                    <td>{row.number ?? "—"}</td>
                    <td>{fmtDate(row.date || row.created_at)}</td>
                    <td>{row.counterparty_display_name ?? "—"}</td>
                    <td>{row.payment_category_title ?? "—"}</td>
                    <td>{money(row.amount)}</td>
                    <td>{statusLabel(row.status)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Модалка приход */}
      {showReceiptModal && (
        <div className="kassa-modal" style={{ display: "block" }}>
          <div
            className="kassa-modal__overlay"
            onClick={() => setShowReceiptModal(false)}
          />
          <div
            className="kassa-modal__card"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="kassa-modal__header">
              <h3 className="kassa-modal__title">Приход в кассу</h3>
              <button
                className="kassa-modal__close"
                onClick={() => setShowReceiptModal(false)}
                aria-label="Закрыть"
              >
                <X size={20} />
              </button>
            </div>
            {createError && (
              <div className="kassa__alert kassa__alert--error">
                {createError}
              </div>
            )}
            <div className="kassa-modal__section">
              <label className="kassa-modal__label">Контрагент *</label>
              <select
                className="kassa-modal__input"
                value={form.counterparty}
                onChange={(e) =>
                  setForm((p) => ({ ...p, counterparty: e.target.value }))
                }
              >
                <option value="">— выбрать —</option>
                {counterparties.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name ?? c.id}
                  </option>
                ))}
              </select>
            </div>
            <div className="kassa-modal__section">
              <label className="kassa-modal__label">Категория платежа *</label>
              <select
                className="kassa-modal__input"
                value={form.payment_category}
                onChange={(e) =>
                  setForm((p) => ({ ...p, payment_category: e.target.value }))
                }
              >
                <option value="">— выбрать —</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title ?? c.id}
                  </option>
                ))}
              </select>
            </div>
            <div className="kassa-modal__section">
              <label className="kassa-modal__label">Сумма *</label>
              <input
                className="kassa-modal__input"
                type="number"
                min="0"
                step="0.01"
                placeholder="0"
                value={form.amount}
                onChange={(e) =>
                  setForm((p) => ({ ...p, amount: e.target.value }))
                }
              />
            </div>
            <div className="kassa-modal__section">
              <label className="kassa-modal__label">Комментарий</label>
              <input
                className="kassa-modal__input"
                type="text"
                value={form.comment}
                onChange={(e) =>
                  setForm((p) => ({ ...p, comment: e.target.value }))
                }
              />
            </div>
            <div className="kassa-modal__section">
              <label className="kassa-modal__label">
                <input
                  type="checkbox"
                  checked={createAsPosted}
                  onChange={(e) => setCreateAsPosted(e.target.checked)}
                />{" "}
                Провести сразу
              </label>
            </div>
            <div className="kassa-modal__footer">
              <button
                className="kassa__btn"
                onClick={() => setShowReceiptModal(false)}
              >
                Отмена
              </button>
              <button
                className="kassa__btn kassa__btn--primary"
                disabled={creating}
                onClick={() => submitMoneyDoc("MONEY_RECEIPT")}
              >
                {creating ? "Сохранение…" : "Создать приход"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Модалка расход */}
      {showExpenseModal && (
        <div className="kassa-modal" style={{ display: "block" }}>
          <div
            className="kassa-modal__overlay"
            onClick={() => setShowExpenseModal(false)}
          />
          <div
            className="kassa-modal__card"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="kassa-modal__header">
              <h3 className="kassa-modal__title">Расход из кассы</h3>
              <button
                className="kassa-modal__close"
                onClick={() => setShowExpenseModal(false)}
                aria-label="Закрыть"
              >
                <X size={20} />
              </button>
            </div>
            {createError && (
              <div className="kassa__alert kassa__alert--error">
                {createError}
              </div>
            )}
            <div className="kassa-modal__section">
              <label className="kassa-modal__label">Контрагент *</label>
              <select
                className="kassa-modal__input"
                value={form.counterparty}
                onChange={(e) =>
                  setForm((p) => ({ ...p, counterparty: e.target.value }))
                }
              >
                <option value="">— выбрать —</option>
                {counterparties.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name ?? c.id}
                  </option>
                ))}
              </select>
            </div>
            <div className="kassa-modal__section">
              <label className="kassa-modal__label">Категория платежа *</label>
              <select
                className="kassa-modal__input"
                value={form.payment_category}
                onChange={(e) =>
                  setForm((p) => ({ ...p, payment_category: e.target.value }))
                }
              >
                <option value="">— выбрать —</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title ?? c.id}
                  </option>
                ))}
              </select>
            </div>
            <div className="kassa-modal__section">
              <label className="kassa-modal__label">Сумма *</label>
              <input
                className="kassa-modal__input"
                type="number"
                min="0"
                step="0.01"
                placeholder="0"
                value={form.amount}
                onChange={(e) =>
                  setForm((p) => ({ ...p, amount: e.target.value }))
                }
              />
            </div>
            <div className="kassa-modal__section">
              <label className="kassa-modal__label">Комментарий</label>
              <input
                className="kassa-modal__input"
                type="text"
                value={form.comment}
                onChange={(e) =>
                  setForm((p) => ({ ...p, comment: e.target.value }))
                }
              />
            </div>
            <div className="kassa-modal__section">
              <label className="kassa-modal__label">
                <input
                  type="checkbox"
                  checked={createAsPosted}
                  onChange={(e) => setCreateAsPosted(e.target.checked)}
                />{" "}
                Провести сразу
              </label>
            </div>
            <div className="kassa-modal__footer">
              <button
                className="kassa__btn"
                onClick={() => setShowExpenseModal(false)}
              >
                Отмена
              </button>
              <button
                className="kassa__btn kassa__btn--primary"
                disabled={creating}
                onClick={() => submitMoneyDoc("MONEY_EXPENSE")}
              >
                {creating ? "Сохранение…" : "Создать расход"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

/* ──────────────────────────────── Роутинг по pathname ──────────────────────────────── */
const WarehouseKassa = () => {
  const { id } = useParams();
  if (id) return <CashRegisterDetail />;
  return <CashRegisterList />;
};

export default WarehouseKassa;
