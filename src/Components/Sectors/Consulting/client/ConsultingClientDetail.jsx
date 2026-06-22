import React, { useEffect, useMemo, useState } from "react";
import { useDispatch } from "react-redux";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  getItemClient,
  getClientDeals,
  getClientSubscriptionSchedule,
} from "../../../../store/creators/clientCreators";
import { kindLabel, formatDateDDMMYYYY } from "../../../../tools/clientDeals";
import "./ConsultingClientDetail.scss";

const money = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n.toLocaleString("ru-RU") + " с" : "—";
};

export default function ConsultingClientDetail() {
  const { id } = useParams();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [client, setClient] = useState(null);
  const [deals, setDeals] = useState([]);
  const [subscriptions, setSubscriptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setLoading(true);
    setErr("");
    Promise.all([
      dispatch(getItemClient(id)).unwrap(),
      dispatch(getClientDeals({ clientId: id })).unwrap(),
      dispatch(getClientSubscriptionSchedule(id)).unwrap(),
    ])
      .then(([c, d, subs]) => {
        if (cancelled) return;
        setClient(c);
        setDeals(Array.isArray(d) ? d : []);
        setSubscriptions(Array.isArray(subs) ? subs : subs?.items || []);
      })
      .catch((e) => {
        if (!cancelled) {
          setErr(
            (typeof e === "string" ? e : e?.detail) ||
              "Не удалось загрузить карточку клиента.",
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [dispatch, id]);

  const chartData = useMemo(() => {
    if (subscriptions.length) {
      return subscriptions.map((row) => ({
        label: row.period_label || row.period || row.date?.slice(0, 7) || "—",
        amount: Number(row.amount || row.subscription_amount || 0),
        status: row.status || (row.paid ? "paid" : "planned"),
      }));
    }
    const subDeals = deals.filter(
      (d) =>
        d.kind === "subscription" ||
        d.subscription_amount ||
        String(d.title || "").toLowerCase().includes("абон"),
    );
    return subDeals.map((d, i) => ({
      label: formatDateDDMMYYYY(d.first_due_date || d.created_at) || `#${i + 1}`,
      amount: Number(d.subscription_amount || d.amount || 0),
      status: d.remaining_debt > 0 ? "planned" : "paid",
    }));
  }, [subscriptions, deals]);

  const activeSubscription = useMemo(() => {
    const fromClient = client?.subscription;
    if (fromClient?.amount) return fromClient;
    const last = subscriptions.find((s) => s.active) || subscriptions[0];
    return last || null;
  }, [client, subscriptions]);

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
            <div className="clientDetail__chart">
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} width={56} />
                  <Tooltip
                    formatter={(v) => [money(v), "Сумма"]}
                    labelFormatter={(l) => `Период: ${l}`}
                  />
                  <Bar
                    dataKey="amount"
                    fill="#f7d74f"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="clientDetail__muted">
              Нет данных по абонентской плате. Они появятся после завершения лида с
              тарифом, где указана абонентка.
            </p>
          )}
          {chartData.length > 0 && (
            <ul className="clientDetail__subList">
              {chartData.map((row, i) => (
                <li key={i} className="clientDetail__subRow">
                  <span>{row.label}</span>
                  <span>{money(row.amount)}</span>
                  <span
                    className={`clientDetail__status clientDetail__status--${row.status}`}
                  >
                    {row.status === "paid" ? "Оплачено" : "Запланировано"}
                  </span>
                </li>
              ))}
            </ul>
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
    </section>
  );
}
