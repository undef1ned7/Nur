import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useDispatch } from "react-redux";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  getItemClient,
  getClientDeals,
  getClientSubscriptionSchedule,
  payDebtDeal,
} from "../../../../store/creators/clientCreators";
import { kindLabel, formatDateDDMMYYYY } from "../../../../tools/clientDeals";
import { useAlert } from "../../../../hooks/useDialog";
import "./ConsultingClientDetail.scss";

const money = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n.toLocaleString("ru-RU") + " с" : "—";
};

const RU_MONTHS = [
  "Янв", "Фев", "Мар", "Апр", "Май", "Июн",
  "Июл", "Авг", "Сен", "Окт", "Ноя", "Дек",
];

// Разбираем период абонентки в {месяц, год} для календарной плитки.
// Поддерживаем "YYYY-MM[-DD]" и "DD.MM.YYYY", иначе показываем как есть.
const parsePeriod = (label) => {
  if (!label) return { month: "—", year: "" };
  let m = /^(\d{4})-(\d{2})/.exec(label);
  if (m) return { month: RU_MONTHS[Number(m[2]) - 1] || label, year: m[1] };
  m = /^(\d{2})\.(\d{2})\.(\d{4})/.exec(label);
  if (m) return { month: RU_MONTHS[Number(m[2]) - 1] || label, year: m[3] };
  return { month: String(label), year: "" };
};

export default function ConsultingClientDetail() {
  const { id } = useParams();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const alert = useAlert();
  const [client, setClient] = useState(null);
  const [deals, setDeals] = useState([]);
  const [subscriptions, setSubscriptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  // плитка абонентки, по которой кликнули для оплаты
  const [payTarget, setPayTarget] = useState(null);

  // Загрузка карточки. Запросы независимы: allSettled, чтобы падение одного
  // (напр. расписание абонентки) не скрывало успешно загруженную историю сделок.
  const reload = useCallback(
    async ({ withSpinner = true } = {}) => {
      if (!id) return;
      if (withSpinner) setLoading(true);
      setErr("");
      const [clientRes, dealsRes, subsRes] = await Promise.allSettled([
        dispatch(getItemClient(id)).unwrap(),
        dispatch(getClientDeals({ clientId: id })).unwrap(),
        dispatch(getClientSubscriptionSchedule(id)).unwrap(),
      ]);
      if (clientRes.status === "fulfilled") setClient(clientRes.value);
      if (dealsRes.status === "fulfilled") {
        setDeals(Array.isArray(dealsRes.value) ? dealsRes.value : []);
      }
      if (subsRes.status === "fulfilled") {
        const subs = subsRes.value;
        setSubscriptions(Array.isArray(subs) ? subs : subs?.items || []);
      }
      if (clientRes.status === "rejected") {
        const e = clientRes.reason;
        setErr(
          (typeof e === "string" ? e : e?.detail) ||
            "Не удалось загрузить карточку клиента.",
        );
      }
      if (withSpinner) setLoading(false);
    },
    [dispatch, id],
  );

  useEffect(() => {
    reload().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Каждая плитка абонентки несёт идентификаторы для оплаты: dealId (сделка) и
  // installmentId (конкретный период). Бэкенд должен отдавать их в расписании —
  // см. docs/message_dnd_reorder.txt.
  const chartData = useMemo(() => {
    if (subscriptions.length) {
      return subscriptions.map((row, i) => {
        const paid = row.status === "paid" || row.paid === true;
        // dealId — только из явных полей сделки. row.id здесь — id строки
        // расписания (installment), а НЕ сделки, поэтому в dealId его не берём,
        // иначе оплата уйдёт на несуществующую сделку. Бэкенд должен отдавать
        // deal в каждом периоде (см. docs/message_dnd_reorder.txt).
        return {
          key: row.installment_id ?? row.id ?? `sub-${i}`,
          // period ("2026-06") парсится в месяц+год; period_label — для подсказки
          label: row.period || row.period_label || row.date?.slice(0, 7) || "—",
          tooltip: row.period_label || row.period || "",
          amount: Number(row.amount || row.subscription_amount || 0),
          status: row.status || (paid ? "paid" : "planned"),
          paid,
          dealId: row.deal ?? row.deal_id ?? null,
          installmentId: row.installment_id ?? row.id ?? null,
        };
      });
    }
    const subDeals = deals.filter(
      (d) =>
        d.kind === "subscription" ||
        d.subscription_amount ||
        String(d.title || "").toLowerCase().includes("абон"),
    );
    return subDeals.map((d, i) => {
      const paid = !(Number(d.remaining_debt || 0) > 0);
      const label =
        formatDateDDMMYYYY(d.first_due_date || d.created_at) || `#${i + 1}`;
      return {
        key: d.id ?? `deal-${i}`,
        label,
        tooltip: label,
        amount: Number(d.subscription_amount || d.amount || 0),
        status: paid ? "paid" : "planned",
        paid,
        dealId: d.id ?? null,
        installmentId: null,
      };
    });
  }, [subscriptions, deals]);

  const activeSubscription = useMemo(() => {
    const fromClient = client?.subscription;
    if (fromClient?.amount) return fromClient;
    const last = subscriptions.find((s) => s.active) || subscriptions[0];
    return last || null;
  }, [client, subscriptions]);

  // Оплата периода абонентки. Закрываем модалку и перезагружаем расписание.
  const handlePaySubmit = useCallback(
    async ({ amount, payment_mode, note }) => {
      const target = payTarget;
      if (!target?.dealId) return;
      const data = {
        amount: Number(amount),
        payment_mode,
        note: note?.trim() || "",
        idempotency_key:
          (globalThis.crypto?.randomUUID?.() ?? `pay-${Date.now()}`),
      };
      if (target.installmentId) data.installment_id = target.installmentId;
      await dispatch(
        payDebtDeal({ id: target.dealId, clientId: id, data }),
      ).unwrap();
      setPayTarget(null);
      await reload({ withSpinner: false });
    },
    [payTarget, dispatch, id, reload],
  );

  if (loading) {
    return (
      <section className="clientDetail">
        <p className="clientDetail__muted">Загрузка…</p>
      </section>
    );
  }

  if (err && !client) {
    return (
      <section className="clientDetail">
        <div className="clientDetail__error">{err}</div>
        <button
          type="button"
          className="clientDetail__btn"
          onClick={() => navigate("/crm/consulting/client")}
        >
          ← К списку
        </button>
      </section>
    );
  }

  return (
    <section className="clientDetail">
      <header className="clientDetail__header">
        <div>
          <Link to="/crm/consulting/client" className="clientDetail__back">
            ← Клиенты
          </Link>
          <h1 className="clientDetail__title">{client?.full_name || "Клиент"}</h1>
          <p className="clientDetail__subtitle">
            {[client?.phone, client?.email].filter(Boolean).join(" · ") || "—"}
          </p>
        </div>
        {activeSubscription && (
          <div className="clientDetail__subBadge">
            Абон. {money(activeSubscription.amount || activeSubscription.subscription_amount)}
            {activeSubscription.period === "year" || activeSubscription.subscription_period === "year"
              ? " / год"
              : " / мес."}
          </div>
        )}
      </header>

      {!!err && <div className="clientDetail__error">{err}</div>}

      <div className="clientDetail__grid">
        <div className="clientDetail__card">
          <h2 className="clientDetail__cardTitle">Абонентские платежи</h2>
          {chartData.length ? (
            <div className="clientDetail__calendar">
              {chartData.map((row) => {
                const { month, year } = parsePeriod(row.label);
                const payable = !row.paid && row.dealId && row.amount > 0;
                const cls = [
                  "clientDetail__calCell",
                  `clientDetail__calCell--${row.status}`,
                  payable ? "clientDetail__calCell--payable" : "",
                ]
                  .filter(Boolean)
                  .join(" ");
                return (
                  <button
                    key={row.key}
                    type="button"
                    className={cls}
                    disabled={!payable}
                    onClick={() => payable && setPayTarget(row)}
                    title={
                      payable
                        ? `Оплатить ${money(row.amount)} за ${row.tooltip || row.label}`
                        : `${row.tooltip || row.label}: ${money(row.amount)} — ${
                            row.paid ? "Оплачено" : "Запланировано"
                          }`
                    }
                  >
                    <span className="clientDetail__calMonth">{month}</span>
                    {year && <span className="clientDetail__calYear">{year}</span>}
                    <span className="clientDetail__calAmount">{money(row.amount)}</span>
                    <span className="clientDetail__calStatus">
                      {row.paid ? "Оплачено" : payable ? "Оплатить" : "Запланировано"}
                    </span>
                  </button>
                );
              })}
            </div>
          ) : (
            <p className="clientDetail__muted">
              Нет данных по абонентской плате. Они появятся после завершения лида с
              тарифом, где указана абонентка.
            </p>
          )}
        </div>

        <div className="clientDetail__card">
          <h2 className="clientDetail__cardTitle">История сделок</h2>
          {deals.length ? (
            <div className="clientDetail__tableWrap">
              <table className="clientDetail__table">
                <thead>
                  <tr>
                    <th>Дата</th>
                    <th>Название</th>
                    <th>Тип</th>
                    <th>Сумма</th>
                  </tr>
                </thead>
                <tbody>
                  {deals.map((d) => (
                    <tr key={d.id}>
                      <td>{formatDateDDMMYYYY(d.created_at)}</td>
                      <td>{d.title || "—"}</td>
                      <td>{kindLabel(d.kind)}</td>
                      <td>{money(d.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="clientDetail__muted">Сделок пока нет.</p>
          )}
        </div>
      </div>

      {(client?.lead_id || client?.source_lead) && (
        <p className="clientDetail__hint">
          Клиент создан из лида воронки. При завершении лида сделки и абонентка
          автоматически попадают в эту карточку и в аналитику.
        </p>
      )}

      {payTarget && (
        <SubPaymentModal
          target={payTarget}
          onClose={() => setPayTarget(null)}
          onSubmit={handlePaySubmit}
          onError={(msg) => alert(msg, true)}
        />
      )}
    </section>
  );
}

const PAYMENT_MODES = [
  { value: "cash", label: "Наличными" },
  { value: "transfer", label: "Переводом" },
  { value: "card", label: "Картой" },
];

// Модалка оплаты периода абонентки (сумма / способ / комментарий).
function SubPaymentModal({ target, onClose, onSubmit, onError }) {
  const [amount, setAmount] = useState(String(target.amount || ""));
  const [paymentMode, setPaymentMode] = useState("cash");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    const n = Number(amount);
    if (!Number.isFinite(n) || n <= 0) {
      onError?.("Укажите сумму больше нуля.");
      return;
    }
    setSaving(true);
    try {
      await onSubmit({ amount: n, payment_mode: paymentMode, note });
    } catch (err) {
      onError?.(
        (typeof err === "string" ? err : err?.detail) ||
          "Не удалось провести оплату.",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="clientDetail__overlay" onClick={onClose}>
      <div
        className="clientDetail__modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Оплата абонентской платы"
      >
        <div className="clientDetail__modalHead">
          <h3 className="clientDetail__modalTitle">
            Оплата за {target.tooltip || target.label}
          </h3>
          <button
            type="button"
            className="clientDetail__modalClose"
            onClick={onClose}
            aria-label="Закрыть"
          >
            ×
          </button>
        </div>
        <form className="clientDetail__modalForm" onSubmit={submit}>
          <label className="clientDetail__modalField">
            <span>Сумма, с *</span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              disabled={saving}
              autoFocus
            />
          </label>
          <label className="clientDetail__modalField">
            <span>Способ оплаты</span>
            <select
              value={paymentMode}
              onChange={(e) => setPaymentMode(e.target.value)}
              disabled={saving}
            >
              {PAYMENT_MODES.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </label>
          <label className="clientDetail__modalField">
            <span>Комментарий</span>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              disabled={saving}
              placeholder="Необязательно"
            />
          </label>
          <div className="clientDetail__modalActions">
            <button
              type="button"
              className="clientDetail__btn"
              onClick={onClose}
              disabled={saving}
            >
              Отмена
            </button>
            <button
              type="submit"
              className="clientDetail__btn clientDetail__btn--primary"
              disabled={saving}
            >
              {saving ? "…" : "Оплатить"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
