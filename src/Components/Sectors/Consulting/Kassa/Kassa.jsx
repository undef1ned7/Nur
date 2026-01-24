// src/components/Kassa/Kassa.js
import React, { useEffect, useMemo, useState } from "react";
import api from "../../../../api";
import ConsultingReports from "./Reports/Reports";
import "./kassa.scss";

/* helpers */
const asArray = (d) =>
  Array.isArray(d?.results) ? d.results : Array.isArray(d) ? d : [];
const listFrom = (res) => res?.data?.results || res?.data || [];
const money = (v) =>
  (Number(v) || 0).toLocaleString("ru-RU", { minimumFractionDigits: 0 }) + " c";
const when = (iso) => (iso ? new Date(iso).toLocaleDateString() : "—");

/* =========================== ВЕРХНИЙ КОМПОНЕНТ =========================== */
export default function ConsultingCafeKassa() {
  const [tab, setTab] = useState("list"); // list | reports | detail
  const [selectedId, setSelectedId] = useState(null);

  const openDetail = (id) => {
    setSelectedId(id);
    setTab("detail");
  };
  const backToList = () => {
    setSelectedId(null);
    setTab("list");
  };

  return (
    <div className="kassa">
      <div className="kassa__header">
        <div className="kassa__tabs">
          {tab === "detail" ? (
            <>
              <button className="kassa__tab" onClick={backToList}>
                ← Назад
              </button>
              <span className="kassa__tab kassa__tab--active">Касса</span>
              <button className="kassa__tab" onClick={() => setTab("reports")}>
                Отчёты
              </button>
            </>
          ) : (
            <>
              <button
                className={`kassa__tab ${
                  tab === "list" ? "kassa__tab--active" : ""
                }`}
                onClick={() => setTab("list")}
              >
                Кассы
              </button>
              <button
                className={`kassa__tab ${
                  tab === "reports" ? "kassa__tab--active" : ""
                }`}
                onClick={() => setTab("reports")}
              >
                Отчёты
              </button>
            </>
          )}
        </div>
      </div>

      {tab === "list" && <CashboxList onOpenDetail={openDetail} />}

      {tab === "reports" && (
        <div style={{ marginTop: 8 }}>
          <ConsultingReports />
        </div>
      )}

      {tab === "detail" && selectedId && (
        <CashboxDetailView id={selectedId} onBack={backToList} />
      )}
    </div>
  );
}

/* =========================== СПИСОК КАСС =========================== */
function CashboxList({ onOpenDetail }) {
  const [rows, setRows] = useState([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState("");

  const load = async () => {
    try {
      setErr("");
      setLoading(true);
      const { data } = await api.get("/construction/cashboxes/");
      setRows(asArray(data));
    } catch (e) {
      console.error(e);
      setErr("Не удалось загрузить кассы");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return rows;
    return rows.filter((r) =>
      [r.department_name, r.name].some((x) =>
        String(x || "")
          .toLowerCase()
          .includes(t)
      )
    );
  }, [rows, q]);

  const onCreate = async () => {
    const title = (name || "").trim();
    if (!title) return alert("Введите название кассы");
    try {
      await api.post("/construction/cashboxes/", { name: title });
      setCreateOpen(false);
      setName("");
      load();
    } catch (e) {
      console.error(e);
      alert("Не удалось создать кассу");
    }
  };

  return (
    <>
      <div className="kassa__toolbar">
        <div className="kassa__toolbarGroup">
          <span className="kassa__total">Всего: {filtered.length}</span>
        </div>

        <div className="kassa__controls">
          <div className="kassa__searchWrap">
            <input
              className="kassa__input"
              type="text"
              placeholder="Поиск…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <button
            className="kassa__btn kassa__btn--primary"
            onClick={() => setCreateOpen(true)}
          >
            Создать кассу
          </button>
        </div>
      </div>

      {err && <div className="kassa__alert kassa__alert--error">{err}</div>}

      <div className="table-wrapper">
        <table className="vitrina__table">
          <thead>
            <tr>
              <th>#</th>
              <th>Название отдела</th>
              <th>Приход</th>
              <th>Расход</th>
              <th>Действия</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5}>Загрузка…</td>
              </tr>
            ) : filtered.length ? (
              filtered.map((r, i) => (
                <tr
                  key={r.id}
                  className="kassa__rowClickable"
                  onClick={() => onOpenDetail(r.id)}
                >
                  <td>{i + 1}</td>
                  <td>
                    <b>{r.department_name || r.name || "—"}</b>
                  </td>
                  <td>{money(r.analytics?.income?.total || 0)}</td>
                  <td>{money(r.analytics?.expense?.total || 0)}</td>
                  <td>
                    <button
                      className="kassa__btn kassa__btn--secondary"
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenDetail(r.id);
                      }}
                    >
                      Открыть
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={5} className="kassa__center">
                  Нет данных
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {createOpen && (
        <div
          className="edit-modal"
          role="dialog"
          aria-modal="true"
          onClick={() => setCreateOpen(false)}
        >
          <div className="edit-modal__overlay" />
          <div
            className="edit-modal__content"
            onClick={(e) => e.stopPropagation()}
            aria-labelledby="create-cashbox-title"
          >
            <div className="edit-modal__header">
              <h3 id="create-cashbox-title">Создать кассу</h3>
              <button
                className="edit-modal__close-icon"
                onClick={() => setCreateOpen(false)}
                aria-label="Закрыть"
              >
                ×
              </button>
            </div>
            <div className="edit-modal__section">
              <label>Название кассы *</label>
              <input
                type="text"
                placeholder="Например: касса №1"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            <div className="edit-modal__footer">
              <button
                className="edit-modal__cancel"
                onClick={() => setCreateOpen(false)}
              >
                Отмена
              </button>
              <button className="edit-modal__save" onClick={onCreate}>
                Сохранить
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/* =========================== ДЕТАЛИ КАССЫ =========================== */
function CashboxDetailView({ id, onBack }) {
  const [box, setBox] = useState(null);
  const [ops, setOps] = useState([]);
  const [tab, setTab] = useState("all");
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const fromAny = (res) => {
    const d = res?.data ?? res ?? [];
    if (Array.isArray(d?.results)) return d.results;
    if (Array.isArray(d)) return d;
    return [];
  };

  const load = async () => {
    setErr("");
    setLoading(true);
    try {
      let detail = null;
      try {
        detail = (await api.get(`/construction/cashboxes/${id}/detail/owner/`))
          .data;
      } catch {}
      if (!detail) {
        try {
          detail = (await api.get(`/construction/cashboxes/${id}/detail/`))
            .data;
        } catch {}
      }
      if (!detail) {
        detail = (await api.get(`/construction/cashboxes/${id}/`)).data;
      }

      setBox(detail);

      let flows =
        fromAny({ data: detail?.operations }) ||
        fromAny({ data: detail?.flows }) ||
        fromAny({ data: detail?.transactions });

      if (!flows.length) {
        try {
          const r1 = await api.get(`/construction/cashflows/`, {
            params: { cashbox: id },
          });
          flows = fromAny(r1);
        } catch {}
      }
      if (!flows.length && detail?.uuid) {
        try {
          const r2 = await api.get(`/construction/cashflows/`, {
            params: { cashbox: detail.uuid },
          });
          flows = fromAny(r2);
        } catch {}
      }

      const mapped = (flows || []).map((x, i) => {
        const amt = Number(x.amount ?? x.sum ?? x.value ?? x.total ?? 0) || 0;
        let type = String(x.type ?? x.kind ?? x.direction ?? "").toLowerCase();
        if (type !== "income" && type !== "expense")
          type = amt >= 0 ? "income" : "expense";
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
          created_at:
            x.created_at ||
            x.created ||
            x.date ||
            x.timestamp ||
            x.createdAt ||
            null,
        };
      });

      setOps(mapped);
    } catch (e) {
      console.error(e);
      setErr("Не удалось загрузить детали кассы");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const shown = useMemo(() => {
    if (tab === "income") return ops.filter((o) => o.type === "income");
    if (tab === "expense") return ops.filter((o) => o.type === "expense");
    return ops;
  }, [ops, tab]);

  return (
    <>
      <div className="kassa__switch">
        <button className="kassa__chip" onClick={onBack}>
          ← Назад
        </button>
        <button
          className={`kassa__chip ${
            tab === "expense" ? "kassa__chip--active" : ""
          }`}
          onClick={() => setTab("expense")}
        >
          Расход
        </button>
        <button
          className={`kassa__chip ${
            tab === "income" ? "kassa__chip--active" : ""
          }`}
          onClick={() => setTab("income")}
        >
          Приход
        </button>
        <button
          className={`kassa__chip ${
            tab === "all" ? "kassa__chip--active" : ""
          }`}
          onClick={() => setTab("all")}
        >
          Все
        </button>
        <div className="kassa__grow" />
        <button
          className="kassa__btn kassa__btn--primary"
          onClick={() =>
            alert(
              "Добавление операции делается через API. Здесь доступен только просмотр."
            )
          }
        >
          Добавить операцию
        </button>
      </div>

      <div className="table-wrapper">
        <table className="vitrina__table">
          <thead>
            <tr>
              <th>Тип</th>
              <th>Наименование</th>
              <th>Сумма</th>
              <th>Дата создания</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={4}>Загрузка…</td>
              </tr>
            ) : err ? (
              <tr>
                <td colSpan={4} className="kassa__alert kassa__alert--error">
                  {err}
                </td>
              </tr>
            ) : shown.length ? (
              shown.map((o) => (
                <tr key={o.id}>
                  <td>{o.type === "income" ? "Приход" : "Расход"}</td>
                  <td>{o.title}</td>
                  <td>{money(o.amount)}</td>
                  <td>{when(o.created_at)}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={4}>Нет операций</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
