// src/Components/Sectors/cafe/kassaCafe/kassa.js
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Routes, Route, useNavigate, useParams, Link } from "react-router-dom";
import api from "../../../../api";
import "./kassa.scss";
import {
  AddOperationModal,
  CashflowCategoriesManageModal,
  EditCashboxNameModal,
} from "./components/KassaModals";
import SearchableCombobox from "../../../common/SearchableCombobox/SearchableCombobox";
import DataContainer from "../../../common/DataContainer/DataContainer";
import { useUser } from "../../../../store/slices/userSlice";

/* helpers */
const asArray = (d) => (Array.isArray(d?.results) ? d.results : Array.isArray(d) ? d : []);
const money = (v) => (Number(v) || 0).toLocaleString("ru-RU", { minimumFractionDigits: 0 }) + " c";
const when = (iso) => (iso ? new Date(iso).toLocaleDateString() : "—");
const whenDT = (iso) => (iso ? new Date(iso).toLocaleString() : "—");

const catListFromApi = (data) =>
  Array.isArray(data?.results) ? data.results : Array.isArray(data) ? data : [];

const mapFlowsToOps = (flows) =>
  (flows || []).map((x, i) => {
    const amt = Number(x.amount ?? x.sum ?? x.value ?? x.total ?? 0) || 0;
    let type = String(x.type ?? x.kind ?? x.direction ?? "").toLowerCase();
    if (type !== "income" && type !== "expense") type = amt >= 0 ? "income" : "expense";
    const catTitle =
      x.category_title != null && String(x.category_title).trim() !== ""
        ? String(x.category_title).trim()
        : null;
    return {
      id: x.id || x.uuid || `${i}`,
      type,
      title:
        x.title ||
        x.name ||
        x.description ||
        x.note ||
        (type === "income" ? "Приход" : "Расход"),
      amount: Math.abs(amt),
      created_at: x.created_at || x.created || x.date || x.timestamp || x.createdAt || null,
      category_title: catTitle,
      raw: x,
    };
  });

/* ───────────────────────────────────────────────── */
const CafeKassa = () => {
  return (
    <Routes>
      <Route index element={<CashboxList />} />
      <Route path=":id" element={<CashboxDetail />} />
    </Routes>
  );
};

/* ──────────────────────────────── Список касс */
const CashboxList = () => {
  const [rows, setRows] = useState([]);
  const [totals, setTotals] = useState({}); // { [boxKey]: { income: number, expense: number } }

  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [editRow, setEditRow] = useState(null);

  const navigate = useNavigate();
  const { profile } = useUser();
  const canEditCashboxes =
    profile?.role === "owner" || profile?.role === "admin";

  useEffect(() => {
    if (!canEditCashboxes) setEditRow(null);
  }, [canEditCashboxes]);

  const boxKey = (r) => String(r?.id || r?.uuid || "");

  const flowAmount = (x) => Number(x?.amount ?? x?.sum ?? x?.value ?? x?.total ?? 0) || 0;
  const flowType = (x) => {
    const t = String(x?.type ?? x?.kind ?? x?.direction ?? "").toLowerCase().trim();
    if (t === "income" || t === "expense") return t;
    const amt = flowAmount(x);
    return amt >= 0 ? "income" : "expense";
  };

  const fetchBoxTotals = async (cashboxId) => {
    try {
      const r = await api.get("/construction/cashflows/", { params: { cashbox: cashboxId } });
      const flows = asArray(r?.data) || [];
      let income = 0;
      let expense = 0;

      for (const f of flows) {
        const t = flowType(f);
        const amt = Math.abs(flowAmount(f));
        if (t === "income") income += amt;
        else expense += amt;
      }

      return { income, expense };
    } catch (e) {
      return { income: 0, expense: 0 };
    }
  };

  const load = async () => {
    try {
      setErr("");
      setLoading(true);

      const { data } = await api.get("/construction/cashboxes/");
      const list = asArray(data);

      setRows(list);

      const pairs = await Promise.all(
        list.map(async (r) => {
          const key = boxKey(r);
          if (!key) return [key, { income: 0, expense: 0 }];

          const aIncome = Number(r?.analytics?.income?.total);
          const aExpense = Number(r?.analytics?.expense?.total);
          const hasAnalytics = Number.isFinite(aIncome) || Number.isFinite(aExpense);

          if (hasAnalytics) {
            return [
              key,
              {
                income: Number.isFinite(aIncome) ? aIncome : 0,
                expense: Number.isFinite(aExpense) ? aExpense : 0,
              },
            ];
          }

          const t = await fetchBoxTotals(key);
          return [key, t];
        })
      );

      const map = {};
      for (const [k, v] of pairs) {
        if (!k) continue;
        map[k] = v;
      }
      setTotals(map);
    } catch (e) {
      console.error(e);
      setErr("Не удалось загрузить кассы");
      setRows([]);
      setTotals({});
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return rows;
    return rows.filter((r) =>
      [r.department_name, r.name].some((x) => String(x || "").toLowerCase().includes(t))
    );
  }, [rows, q]);

  const cashboxTitleForEdit = (r) => String(r?.department_name || r?.name || "").trim();

  const summary = useMemo(() => {
    let income = 0;
    let expense = 0;
    for (const r of filtered) {
      const key = boxKey(r);
      const t = totals[key] || { income: 0, expense: 0 };
      income += Number(t.income) || 0;
      expense += Number(t.expense) || 0;
    }
    return { income, expense };
  }, [filtered, totals]);

  return (
    <div className="cafeKassa">
      <div className="cafeKassa__toolbar">
        <div className="cafeKassa__toolbarGroup">
          <span className="cafeKassa__total">Всего: {filtered.length}</span>
          <span className="cafeKassa__total" style={{ marginLeft: 14 }}>
            Приход: <b>{money(summary.income)}</b>
          </span>
          <span className="cafeKassa__total" style={{ marginLeft: 10 }}>
            Расход: <b>{money(summary.expense)}</b>
          </span>
        </div>

        <div className="cafeKassa__controls">
          <div className="cafeKassa__searchWrap">
            <input
              className="cafeKassa__input"
              type="text"
              placeholder="Поиск…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
        </div>
      </div>

      {err && <div className="cafeKassa__alert cafeKassa__alert--error">{err}</div>}

      <DataContainer>
        <div className="cafeKassa__tableWrap">
          <table className="cafeKassa__table">
            <thead>
              <tr>
                <th>Касса</th>
                <th>Приход</th>
                <th>Расход</th>
                {canEditCashboxes ? <th>Действия</th> : null}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={canEditCashboxes ? 4 : 3}>Загрузка…</td>
                </tr>
              ) : filtered.length ? (
                filtered.map((r) => {
                  const key = boxKey(r);
                  const t = totals[key] || { income: 0, expense: 0 };

                  return (
                    <tr key={key} className="cafeKassa__rowClickable" onClick={() => navigate(`/crm/cafe/kassa/${key}`)}>
                      <td>
                        <b>{r.department_name || r.name || "—"}</b>
                      </td>
                      <td>{money(t.income)}</td>
                      <td>{money(t.expense)}</td>
                      {canEditCashboxes ? (
                        <td onClick={(e) => e.stopPropagation()}>
                          <button
                            className="cafeKassa__btn cafeKassa__btn--secondary"
                            onClick={() => setEditRow(r)}
                            type="button"
                          >
                            Редактировать
                          </button>
                        </td>
                      ) : null}
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={canEditCashboxes ? 4 : 3} className="cafeKassa__center">
                    Нет данных
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </DataContainer>

      {canEditCashboxes ? (
        <EditCashboxNameModal
          open={!!editRow}
          cashboxId={editRow ? boxKey(editRow) : ""}
          initialName={editRow ? cashboxTitleForEdit(editRow) : ""}
          onClose={() => setEditRow(null)}
          onSaved={(data, submittedName) => {
            const id = editRow ? boxKey(editRow) : "";
            if (!id) return;
            const label = String(submittedName || "").trim();
            setRows((prev) =>
              prev.map((r) => {
                if (boxKey(r) !== id) return r;
                const merged = { ...r, ...data };
                return {
                  ...merged,
                  name: merged.name ?? label,
                  department_name: merged.department_name ?? label,
                };
              })
            );
          }}
        />
      ) : null}
    </div>
  );
};

/* ──────────────────────────────── Детали кассы + фильтр дат + модалка */
const CashboxDetail = () => {
  const { id } = useParams();

  const [box, setBox] = useState(null);
  const [ops, setOps] = useState([]);
  const [tab, setTab] = useState("all");
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const [openOp, setOpenOp] = useState(null);
  const [opLoading, setOpLoading] = useState(false);
  const [opDetail, setOpDetail] = useState(null);

  const [addOpOpen, setAddOpOpen] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState("");
  const [categories, setCategories] = useState([]);
  const [categoriesModalOpen, setCategoriesModalOpen] = useState(false);
  const [flowsLoading, setFlowsLoading] = useState(false);

  const fromAny = (res) => {
    const d = res?.data ?? res ?? [];
    if (Array.isArray(d?.results)) return d.results;
    if (Array.isArray(d)) return d;
    return [];
  };

  const loadCategories = useCallback(async () => {
    try {
      const { data } = await api.get("/construction/cashflow-categories/", {
        params: { page_size: 500 },
      });
      setCategories(catListFromApi(data));
    } catch {
      setCategories([]);
    }
  }, []);

  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  const syncFlows = useCallback(
    async (detail, filterCat) => {
      const cat = filterCat !== undefined ? filterCat : categoryFilter;
      const key = detail?.uuid || detail?.id || id;
      if (!detail || !key) return;

      setFlowsLoading(true);
      try {
        let flows = [];
        if (!cat) {
          flows =
            fromAny({ data: detail?.operations }) ||
            fromAny({ data: detail?.flows }) ||
            fromAny({ data: detail?.transactions });
        }
        if (!flows.length || cat) {
          const params = { cashbox: key };
          if (cat) params.category = cat;
          const r1 = await api.get(`/construction/cashflows/`, { params });
          flows = fromAny(r1);
        }
        if (!flows.length && !cat && detail?.uuid && String(key) !== String(detail.uuid)) {
          const r2 = await api.get(`/construction/cashflows/`, { params: { cashbox: detail.uuid } });
          flows = fromAny(r2);
        }
        setOps(mapFlowsToOps(flows));
      } catch (e) {
        console.error(e);
        setOps([]);
      } finally {
        setFlowsLoading(false);
      }
    },
    [id, categoryFilter]
  );

  const load = async () => {
    setErr("");
    setLoading(true);

    try {
      let detail = null;

      try {
        detail = (await api.get(`/construction/cashboxes/${id}/detail/owner/`)).data;
      } catch { }

      if (!detail) {
        try {
          detail = (await api.get(`/construction/cashboxes/${id}/detail/`)).data;
        } catch { }
      }

      if (!detail) {
        detail = (await api.get(`/construction/cashboxes/${id}/`)).data;
      }

      setBox(detail);
      await syncFlows(detail);
    } catch (e) {
      console.error(e);
      setErr("Не удалось загрузить детали кассы");
      setOps([]);
      setBox(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const inDateRange = (iso) => {
    if (!iso) return true;
    const d = new Date(iso);

    if (dateFrom) {
      const f = new Date(dateFrom + "T00:00:00");
      if (d < f) return false;
    }
    if (dateTo) {
      const t = new Date(dateTo + "T23:59:59.999");
      if (d > t) return false;
    }
    return true;
  };

  const shown = useMemo(() => {
    let arr = ops;
    if (tab === "income") arr = arr.filter((o) => o.type === "income");
    if (tab === "expense") arr = arr.filter((o) => o.type === "expense");
    if (dateFrom || dateTo) arr = arr.filter((o) => inDateRange(o.created_at));
    return arr;
  }, [ops, tab, dateFrom, dateTo]);

  const categoryFilterOptions = useMemo(
    () => [
      { value: "", label: "Все категории" },
      ...categories
        .map((c) => ({
          value: String(c.id ?? c.uuid ?? ""),
          label: String(c.title ?? c.name ?? "—"),
        }))
        .filter((o) => o.value),
    ],
    [categories]
  );

  const onCategoryFilterChange = (v) => {
    const next = v || "";
    setCategoryFilter(next);
    if (box) syncFlows(box, next);
  };

  const openDetails = async (op) => {
    setOpenOp(op);
    setOpLoading(true);
    setOpDetail(null);

    try {
      const raw = op.raw || {};
      const orderId =
        raw.order ||
        raw.order_id ||
        raw.orderId ||
        (typeof raw.source_id === "number" && (raw.source_type === "order" || raw.source === "order")
          ? raw.source_id
          : null) ||
        null;

      let order = null;
      if (orderId) {
        try {
          order = (await api.get(`/cafe/orders/${orderId}/`)).data;
        } catch { }
      }

      const clientId = order?.client || raw.client || raw.client_id || raw.clientId || null;
      let client = null;
      if (clientId) {
        try {
          client = (await api.get(`/cafe/clients/${clientId}/`)).data;
        } catch { }
      }

      const clientName = client?.name || client?.full_name || order?.client_name || raw.client_name || null;
      const clientPhone = client?.phone || order?.client_phone || raw.client_phone || null;

      let tableLabel = null;
      let zoneTitle = null;

      const tableId = order?.table || raw.table || raw.table_id || null;
      if (tableId) {
        try {
          const t = (await api.get(`/cafe/tables/${tableId}/`)).data;
          if (t) {
            tableLabel = t.number != null ? `Стол ${t.number}` : "Стол";

            const z = t.zone;
            if (z && typeof z === "object" && z.title) zoneTitle = z.title;
            else if (z) {
              try {
                const zres = (await api.get(`/cafe/zones/${z}/`)).data;
                zoneTitle = zres?.title || null;
              } catch { }
            }
          }
        } catch { }
      }

      const category =
        (raw.category_title != null && String(raw.category_title).trim() !== ""
          ? String(raw.category_title).trim()
          : null) || raw.category_name || null;
      const method = raw.method || raw.payment_method || raw.payment_type || null;
      const userName = raw.user_name || raw.created_by_name || raw.owner_name || null;
      const comment = raw.note || raw.description || raw.comment || null;

      setOpDetail({
        orderId: order?.id || orderId || null,
        clientName,
        clientPhone,
        tableLabel,
        zoneTitle,
        category,
        method,
        userName,
        comment,
      });
    } catch {
      setOpDetail(null);
    } finally {
      setOpLoading(false);
    }
  };

  const closeDetails = () => {
    setOpenOp(null);
    setOpDetail(null);
    setOpLoading(false);
  };

  const cashboxTitle = box?.department_name || box?.name || "";

  return (
    <div className="cafeKassa">
      <div className="cafeKassa__header">
        <Link className="cafeKassa__backLink" to="/crm/cafe/kassa">
          ← Назад к списку касс
        </Link>
        <h2 className="cafeKassa__title">{cashboxTitle}</h2>
      </div>

      <div className="cafeKassa__switch">
        <button
          className={`cafeKassa__chip ${tab === "expense" ? "cafeKassa__chip--active" : ""}`}
          onClick={() => setTab("expense")}
          type="button"
        >
          Расход
        </button>
        <button
          className={`cafeKassa__chip ${tab === "income" ? "cafeKassa__chip--active" : ""}`}
          onClick={() => setTab("income")}
          type="button"
        >
          Приход
        </button>
        <button
          className={`cafeKassa__chip ${tab === "all" ? "cafeKassa__chip--active" : ""}`}
          onClick={() => setTab("all")}
          type="button"
        >
          Все
        </button>

        <div className="cafeKassa__field cafeKassa__categoryFilter">
          <span className="cafeKassa__label">Категория</span>
          <SearchableCombobox
            value={categoryFilter}
            onChange={onCategoryFilterChange}
            options={categoryFilterOptions}
            placeholder="Все категории"
            disabled={loading || flowsLoading}
          />
        </div>

        {flowsLoading ? (
          <span className="cafeKassa__muted" style={{ alignSelf: "center" }}>
            Обновление…
          </span>
        ) : null}

        <button
          type="button"
          className="cafeKassa__btn cafeKassa__btn--secondary cafeKassa__categoriesBtn"
          onClick={() => setCategoriesModalOpen(true)}
        >
          Категории
        </button>

        <div className="cafeKassa__grow" />

        <div className="cafeKassa__field">
          <label className="cafeKassa__label">С</label>
          <input className="cafeKassa__input" type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
        </div>

        <div className="cafeKassa__field">
          <label className="cafeKassa__label">По</label>
          <input className="cafeKassa__input" type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
        </div>

        {(dateFrom || dateTo) && (
          <button
            className="cafeKassa__btn"
            onClick={() => {
              setDateFrom("");
              setDateTo("");
            }}
            type="button"
          >
            Сбросить
          </button>
        )}

        <button
          className="cafeKassa__btn cafeKassa__btn--primary"
          onClick={() => setAddOpOpen(true)}
          type="button"
        >
          Добавить операцию
        </button>
      </div>

      <DataContainer>

        <div className="cafeKassa__tableWrap">
          <table className="cafeKassa__table">
            <thead>
              <tr>
                <th>Тип</th>
                <th>Наименование</th>
                <th>Категория</th>
                <th>Сумма {tab !== 'all' ? `(${shown.reduce((acc, o) => acc + o.amount, 0)} c)` : ''}</th>
                <th>Дата создания</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5}>Загрузка…</td>
                </tr>
              ) : err ? (
                <tr>
                  <td colSpan={5} className="cafeKassa__alert cafeKassa__alert--error">
                    {err}
                  </td>
                </tr>
              ) : shown.length ? (
                shown.map((o) => (
                  <tr key={o.id} className="cafeKassa__rowClickable" onClick={() => openDetails(o)}>
                    <td>{o.type === "income" ? "Приход" : "Расход"}</td>
                    <td>{o.title}</td>
                    <td>{o.category_title || "—"}</td>
                    <td>{money(o.amount)}</td>
                    <td>{when(o.created_at)}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5}>Нет операций</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </DataContainer>
      {addOpOpen && (
        <AddOperationModal
          open={addOpOpen}
          cashboxId={id}
          onClose={() => setAddOpOpen(false)}
          onSuccess={() => {
            load();
            loadCategories();
          }}
        />
      )}

      {categoriesModalOpen ? (
        <CashflowCategoriesManageModal
          open={categoriesModalOpen}
          onClose={() => setCategoriesModalOpen(false)}
          onChanged={() => {
            loadCategories();
            if (box) syncFlows(box, categoryFilter);
          }}
        />
      ) : null}

      {openOp && (
        <div className="cafeKassa__modalOverlay" onClick={closeDetails}>
          <div className="cafeKassa__modal" onClick={(e) => e.stopPropagation()}>
            <div className="cafeKassa__modalHeader">
              <h3 className="cafeKassa__modalTitle cafeKassa__modalTitle--row">
                <span
                  className={
                    openOp.type === "income"
                      ? "cafeKassa__pill cafeKassa__pill--income"
                      : "cafeKassa__pill cafeKassa__pill--expense"
                  }
                >
                  {openOp.type === "income" ? "ПРИХОД" : "РАСХОД"}
                </span>
                <span className="cafeKassa__amount">{money(openOp.amount)}</span>
              </h3>

              <button className="cafeKassa__iconBtn" onClick={closeDetails} aria-label="Закрыть" type="button">
                ×
              </button>
            </div>

            <div className="cafeKassa__form cafeKassa__form--grid">
              <div className="cafeKassa__box">
                <div className="cafeKassa__boxTitle">Общее</div>
                <Row label="Наименование" value={openOp.title || "—"} />
                <Row label="Дата/время" value={whenDT(openOp.created_at)} />
                <Row label="Касса" value={cashboxTitle} />
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
              <button className="cafeKassa__btn" onClick={closeDetails} type="button">
                Закрыть
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

/* Row для модалок (без инлайнов) */
const Row = ({ label, value }) => {
  return (
    <div className="cafeKassa__row">
      <div className="cafeKassa__rowLabel">{label}</div>
      <div className="cafeKassa__rowValue">{value || "—"}</div>
    </div>
  );
};

export default CafeKassa;
