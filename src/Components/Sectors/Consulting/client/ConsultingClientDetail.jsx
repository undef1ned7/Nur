import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useDispatch } from "react-redux";
import { Link, useParams } from "react-router-dom";
import {
  getItemClient,
  getClientDeals,
  getClientSubscriptionSchedule,
  payDebtDeal,
  createDeals,
} from "../../../../store/creators/clientCreators";
import {
  paySubscriptionPayment,
  isPayableSubscriptionStatus,
  normalizeSubscriptionPaymentStatus,
} from "../../../../api/consultingSubscriptions";
import {
  getClientTenantAccount,
  provisionClientTenant,
} from "../../../../api/consultingTenant";
import { createConsultingSaleApi } from "../../../../api/consultingSales";
import { isNotReadyError } from "../common/useConsultingList";
import { getIndustries } from "../../../../api/auth";
import {
  isConsultingCashV2,
  TENANT_PROVISION_LABELS,
} from "../../../../utils/consultingMoney";
import { kindLabel, formatDateDDMMYYYY } from "../../../../tools/clientDeals";
import { useAlert } from "../../../../hooks/useDialog";
import ConsultingShell from "../common/ConsultingShell";
import "./ConsultingClientDetail.scss";

const money = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n.toLocaleString("ru-RU") + " с" : "—";
};

const RU_MONTHS = [
  "Янв", "Фев", "Мар", "Апр", "Май", "Июн",
  "Июл", "Авг", "Сен", "Окт", "Ноя", "Дек",
];

const parsePeriod = (label) => {
  if (!label) return { month: "—", year: "" };
  let m = /^(\d{4})-(\d{2})/.exec(label);
  if (m) return { month: RU_MONTHS[Number(m[2]) - 1] || label, year: m[1] };
  m = /^(\d{2})\.(\d{2})\.(\d{4})/.exec(label);
  if (m) return { month: RU_MONTHS[Number(m[2]) - 1] || label, year: m[3] };
  return { month: String(label), year: "" };
};

const tenantStatusLabel = (account) =>
  account?.provision_status_display ||
  TENANT_PROVISION_LABELS[account?.provision_status] ||
  account?.provision_status ||
  "—";

export default function ConsultingClientDetail() {
  const { id } = useParams();
  const dispatch = useDispatch();
  const alert = useAlert();
  const [client, setClient] = useState(null);
  const [deals, setDeals] = useState([]);
  const [subscriptions, setSubscriptions] = useState([]);
  const [tenantAccount, setTenantAccount] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [payTarget, setPayTarget] = useState(null);
  // Докупка услуги/товара действующим клиентом (апселл из карточки).
  const [addSaleOpen, setAddSaleOpen] = useState(false);
  // Массовая оплата абонентки: число периодов вперёд или false.
  const [bulkCount, setBulkCount] = useState(false);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkProgress, setBulkProgress] = useState(null);
  const [provisionBusy, setProvisionBusy] = useState(false);
  // Сектор создаваемого CRM-аккаунта. По умолчанию — «Маркет»
  // (см. docs/consulting/backend-money-tenant/11-provision-market-sector.md).
  const [sectors, setSectors] = useState([]);
  const [provisionSector, setProvisionSector] = useState("");

  const reload = useCallback(
    async ({ withSpinner = true } = {}) => {
      if (!id) return;
      if (withSpinner) setLoading(true);
      setErr("");
      const tasks = [
        dispatch(getItemClient(id)).unwrap(),
        dispatch(getClientDeals({ clientId: id })).unwrap(),
        dispatch(getClientSubscriptionSchedule(id)).unwrap(),
      ];
      if (isConsultingCashV2()) {
        tasks.push(
          getClientTenantAccount(id).catch(() => null),
        );
      }
      const results = await Promise.allSettled(tasks);
      const [clientRes, dealsRes, subsRes, tenantRes] = results;

      if (clientRes.status === "fulfilled") setClient(clientRes.value);
      if (dealsRes.status === "fulfilled") {
        setDeals(Array.isArray(dealsRes.value) ? dealsRes.value : []);
      }
      if (subsRes.status === "fulfilled") {
        const subs = subsRes.value;
        setSubscriptions(Array.isArray(subs) ? subs : subs?.items || []);
      }
      if (tenantRes?.status === "fulfilled" && tenantRes.value) {
        setTenantAccount(tenantRes.value);
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
  }, [id, reload]);

  // Справочник секторов для выбора при создании CRM-аккаунта; префилл — «Маркет».
  useEffect(() => {
    let cancelled = false;
    getIndustries()
      .then((industries) => {
        if (cancelled) return;
        const flat = [];
        const seen = new Set();
        (Array.isArray(industries) ? industries : []).forEach((ind) => {
          (ind?.sectors || []).forEach((s) => {
            if (s?.id == null || seen.has(s.id)) return;
            seen.add(s.id);
            flat.push({ id: s.id, name: s.name || "—", slug: s.slug || "" });
          });
        });
        setSectors(flat);
        const market = flat.find(
          (s) =>
            s.slug === "market" || /маркет|market/i.test(s.name),
        );
        if (market) setProvisionSector(String(market.id));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const chartData = useMemo(() => {
    if (subscriptions.length) {
      return subscriptions.map((row, i) => {
        const paid =
          row.status === "paid" || row.paid === true;
        const paymentId = row.payment_id ?? row.id;
        const status = normalizeSubscriptionPaymentStatus(row.status);
        const canPay = isPayableSubscriptionStatus(row.status);
        return {
          key: paymentId ?? `sub-${i}`,
          label: row.period || row.period_label || row.period_month || "—",
          tooltip: row.period_label || row.period || row.period_month || "",
          amount: Number(row.amount || row.subscription_amount || 0),
          status: paid ? "paid" : status,
          paid,
          canPay,
          paymentId: isConsultingCashV2() ? paymentId : null,
          dealId: row.deal ?? row.deal_id ?? null,
          installmentId: row.installment_id ?? null,
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
        paymentId: null,
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

  // Периоды, доступные к оплате (хронологически) — для массовой оплаты вперёд.
  const payableRows = useMemo(
    () =>
      chartData.filter(
        (r) =>
          !r.paid &&
          r.amount > 0 &&
          (isConsultingCashV2()
            ? Boolean(r.paymentId) && r.canPay !== false
            : Boolean(r.dealId)),
      ),
    [chartData],
  );

  const bulkPresets = useMemo(
    () => [2, 3, 6, 12].filter((n) => n <= payableRows.length),
    [payableRows.length],
  );

  const handleBulkPay = useCallback(
    async ({ count, payment_mode, note }) => {
      const targets = payableRows.slice(0, count);
      if (!targets.length) return;
      setBulkBusy(true);
      let failedAt = null;
      try {
        for (let i = 0; i < targets.length; i += 1) {
          setBulkProgress({ done: i, total: targets.length });
          const t = targets[i];
          try {
            if (isConsultingCashV2() && t.paymentId) {
              await paySubscriptionPayment(t.paymentId, {
                amount: Number(t.amount),
                payment_method:
                  payment_mode === "card" ? "transfer" : payment_mode,
                note: note?.trim() || "",
              });
            } else if (t.dealId) {
              await dispatch(
                payDebtDeal({
                  id: t.dealId,
                  clientId: id,
                  data: {
                    amount: Number(t.amount),
                    payment_mode,
                    note: note?.trim() || "",
                    idempotency_key:
                      globalThis.crypto?.randomUUID?.() ??
                      `bulk-${Date.now()}-${i}`,
                  },
                }),
              ).unwrap();
            }
          } catch (e) {
            failedAt = { index: i, label: t.tooltip || t.label, error: e };
            break;
          }
        }
      } finally {
        setBulkProgress(null);
        setBulkBusy(false);
        setBulkCount(false);
        await reload({ withSpinner: false });
      }
      if (failedAt) {
        alert(
          `Оплачено периодов: ${failedAt.index}. Сбой на «${failedAt.label}»: ${
            failedAt.error?.detail || "ошибка оплаты"
          }`,
          true,
        );
      } else {
        alert(`Отправлено на оплату периодов: ${targets.length}.`);
      }
    },
    [payableRows, dispatch, id, reload, alert],
  );

  const handlePaySubmit = useCallback(
    async ({ amount, payment_mode, note }) => {
      const target = payTarget;
      if (!target) return;

      if (isConsultingCashV2() && target.paymentId) {
        await paySubscriptionPayment(target.paymentId, {
          amount: Number(amount),
          payment_method:
            payment_mode === "card" ? "transfer" : payment_mode,
          note: note?.trim() || "",
        });
      } else if (target.dealId) {
        const data = {
          amount: Number(amount),
          payment_mode,
          note: note?.trim() || "",
          idempotency_key:
            globalThis.crypto?.randomUUID?.() ?? `pay-${Date.now()}`,
        };
        if (target.installmentId) data.installment_id = target.installmentId;
        await dispatch(
          payDebtDeal({ id: target.dealId, clientId: id, data }),
        ).unwrap();
      } else {
        throw new Error("Не удалось определить платёж для оплаты.");
      }
      setPayTarget(null);
      await reload({ withSpinner: false });
    },
    [payTarget, dispatch, id, reload],
  );

  // Доп. продажа: свободные позиции (товары/услуги вне тарифа), которые
  // продажник добавляет вручную. Создаёт консалтинговую продажу на
  // действующего клиента со всеми последствиями (касса, начисление, аналитика).
  // Контракт: docs/consulting/backend-money-tenant/14-client-upsell-sale.md.
  const handleAddSale = useCallback(
    async (payload) => {
      const isInstallment = payload.installmentMonths > 1;
      const dto = {
        client: id,
        // Свободные позиции: [{ name, price, quantity }]. Без services/tariff.
        items: payload.items,
        amount: payload.amount,
        payment_mode: isInstallment
          ? "installment"
          : payload.payment_mode || "cash",
        // RU-статус для совместимости со старым сериализатором sale.jsx.
        status: isInstallment ? "Предоплата" : "Продажа",
        debt_months: isInstallment ? payload.installmentMonths : undefined,
        description: payload.note?.trim() || payload.title,
        kind: "addon",
        source: "client_card",
        idempotency_key:
          globalThis.crypto?.randomUUID?.() ?? `addon-${Date.now()}`,
      };
      try {
        await createConsultingSaleApi(dto);
      } catch (e) {
        if (isNotReadyError(e)) {
          // Старый бэк без /consalting/sales/ — хотя бы фиксируем сделку клиента.
          await dispatch(
            createDeals({
              clientId: id,
              title: payload.title,
              statusRu: isInstallment ? "Предоплата" : "Продажа",
              amount: payload.amount,
              debtMonths: isInstallment ? payload.installmentMonths : undefined,
            }),
          ).unwrap();
        } else {
          throw e;
        }
      }
      setAddSaleOpen(false);
      await reload({ withSpinner: false });
    },
    [dispatch, id, reload],
  );

  const retryProvision = async () => {
    setProvisionBusy(true);
    try {
      const result = await provisionClientTenant(
        id,
        provisionSector ? { crm_sector: Number(provisionSector) } : {},
      );
      setTenantAccount(result);
      if (result?.generated_password) {
        alert(
          `Аккаунт создан. Временный пароль: ${result.generated_password}`,
        );
      } else {
        alert("Запрос на создание аккаунта отправлен.");
      }
      await reload({ withSpinner: false });
    } catch (e) {
      alert(e?.detail || "Не удалось создать аккаунт.", true);
    } finally {
      setProvisionBusy(false);
    }
  };

  const backLink = (
    <Link to="/crm/consulting/client" className="cShell__btn">
      ← Клиенты
    </Link>
  );

  if (loading) {
    return (
      <ConsultingShell
        eyebrow="Консалтинг · Клиент"
        title="Клиент"
        headerActions={backLink}
      >
        <div className="clientDetail clientDetail--embedded">
          <p className="clientDetail__muted">Загрузка…</p>
        </div>
      </ConsultingShell>
    );
  }

  if (err && !client) {
    return (
      <ConsultingShell
        eyebrow="Консалтинг · Клиент"
        title="Клиент"
        headerActions={backLink}
      >
        <div className="clientDetail clientDetail--embedded">
          <div className="clientDetail__error">{err}</div>
        </div>
      </ConsultingShell>
    );
  }

  const showTenantBlock =
    isConsultingCashV2() &&
    (tenantAccount || client?.provision_status);

  return (
    <ConsultingShell
      eyebrow="Консалтинг · Клиент"
      title={client?.full_name || "Клиент"}
      subtitle={
        [client?.phone, client?.email].filter(Boolean).join(" · ") || "—"
      }
      headerActions={
        <>
          {activeSubscription && (
            <span className="clientDetail__subBadge">
              Абон.{" "}
              {money(
                activeSubscription.amount ||
                  activeSubscription.subscription_amount,
              )}
              {activeSubscription.period === "year" ||
              activeSubscription.subscription_period === "year"
                ? " / год"
                : " / мес."}
            </span>
          )}
          {backLink}
        </>
      }
    >
      <div className="clientDetail clientDetail--embedded">
        {!!err && <div className="clientDetail__error">{err}</div>}

        {showTenantBlock && (
          <div className="clientDetail__card clientDetail__tenant">
            <h2 className="clientDetail__cardTitle">CRM-аккаунт NurCRM</h2>
            <dl className="clientDetail__tenantGrid">
              <div>
                <dt>Статус</dt>
                <dd>{tenantStatusLabel(tenantAccount)}</dd>
              </div>
              {tenantAccount?.owner_email && (
                <div>
                  <dt>Email владельца</dt>
                  <dd>{tenantAccount.owner_email}</dd>
                </div>
              )}
              {tenantAccount?.end_date && (
                <div>
                  <dt>Доступ до</dt>
                  <dd>{formatDateDDMMYYYY(tenantAccount.end_date)}</dd>
                </div>
              )}
              {tenantAccount?.subscription_plan?.name && (
                <div>
                  <dt>Тариф</dt>
                  <dd>{tenantAccount.subscription_plan.name}</dd>
                </div>
              )}
            </dl>
            {tenantAccount?.provision_error && (
              <p className="clientDetail__error clientDetail__error--inline">
                {tenantAccount.provision_error}
              </p>
            )}
            {["pending", "failed", "none"].includes(
              tenantAccount?.provision_status,
            ) && (
              <div className="clientDetail__tenantActions">
                {sectors.length > 0 && (
                  <label className="clientDetail__tenantField">
                    <span className="clientDetail__hint">Сектор аккаунта</span>
                    <select
                      className="clientDetail__input"
                      value={provisionSector}
                      onChange={(e) => setProvisionSector(e.target.value)}
                      disabled={provisionBusy}
                    >
                      <option value="">По тарифу / по умолчанию</option>
                      {sectors.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                <button
                  type="button"
                  className="clientDetail__btn clientDetail__btn--primary"
                  disabled={provisionBusy}
                  onClick={retryProvision}
                >
                  {provisionBusy ? "…" : "Создать / повторить аккаунт"}
                </button>
              </div>
            )}
            {tenantAccount?.nur_company_id && (
              <p className="clientDetail__hint">
                Компания #{tenantAccount.nur_company_id}
                {tenantAccount.company_name
                  ? ` · ${tenantAccount.company_name}`
                  : ""}
              </p>
            )}
          </div>
        )}

        <div className="clientDetail__grid">
          <div className="clientDetail__card">
            <h2 className="clientDetail__cardTitle">Абонентские платежи</h2>
            {isConsultingCashV2() && (
              <p className="clientDetail__muted clientDetail__muted--spaced">
                Оплата создаёт заявку в кассе; доступ CRM продлевается после
                подтверждения кассиром.
              </p>
            )}
            {payableRows.length >= 2 && (
              <div className="clientDetail__bulkPay">
                <span className="clientDetail__bulkPayLabel">
                  Оплатить вперёд:
                </span>
                {bulkPresets.map((n) => (
                  <button
                    key={n}
                    type="button"
                    className="clientDetail__btn"
                    disabled={bulkBusy}
                    onClick={() => setBulkCount(n)}
                  >
                    {n} мес.
                  </button>
                ))}
                {!bulkPresets.includes(payableRows.length) && (
                  <button
                    type="button"
                    className="clientDetail__btn"
                    disabled={bulkBusy}
                    onClick={() => setBulkCount(payableRows.length)}
                  >
                    все ({payableRows.length})
                  </button>
                )}
                {bulkProgress && (
                  <span className="clientDetail__bulkPayProgress">
                    {bulkProgress.done}/{bulkProgress.total}…
                  </span>
                )}
              </div>
            )}
            {chartData.length ? (
              <div className="clientDetail__calendar">
                {chartData.map((row) => {
                  const { month, year } = parsePeriod(row.label);
                  const payable =
                    !row.paid &&
                    row.amount > 0 &&
                    (isConsultingCashV2()
                      ? Boolean(row.paymentId) && row.canPay !== false
                      : Boolean(row.dealId));
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
                          ? `Оплатить ${money(row.amount)} за ${
                              row.tooltip || row.label
                            }`
                          : `${row.tooltip || row.label}: ${money(
                              row.amount,
                            )} — ${row.paid ? "Оплачено" : "Запланировано"}`
                      }
                    >
                      <span className="clientDetail__calMonth">{month}</span>
                      {year && (
                        <span className="clientDetail__calYear">{year}</span>
                      )}
                      <span className="clientDetail__calAmount">
                        {money(row.amount)}
                      </span>
                      <span className="clientDetail__calStatus">
                        {row.paid
                          ? "Оплачено"
                          : payable
                            ? "Оплатить"
                            : "Запланировано"}
                      </span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <p className="clientDetail__muted">
                Нет данных по абонентской плате. Они появятся после
                завершения лида с тарифом, где указана абонентка.
              </p>
            )}
          </div>

          <div className="clientDetail__card">
            <div className="clientDetail__cardHead">
              <h2 className="clientDetail__cardTitle">История сделок</h2>
              <button
                type="button"
                className="clientDetail__btn clientDetail__btn--primary"
                onClick={() => setAddSaleOpen(true)}
              >
                + Докупить услугу
              </button>
            </div>
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
            Клиент создан из лида воронки. При завершении лида сделки и
            абонентка автоматически попадают в эту карточку и в аналитику.
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

        {bulkCount && (
          <SubBulkPaymentModal
            count={bulkCount}
            rows={payableRows.slice(0, bulkCount)}
            busy={bulkBusy}
            onClose={() => !bulkBusy && setBulkCount(false)}
            onSubmit={handleBulkPay}
            onError={(msg) => alert(msg, true)}
          />
        )}

        {addSaleOpen && (
          <AddSaleModal
            clientName={client?.full_name || ""}
            onClose={() => setAddSaleOpen(false)}
            onSubmit={handleAddSale}
            onError={(msg) => alert(msg, true)}
          />
        )}
      </div>
    </ConsultingShell>
  );
}

const PAYMENT_MODES = [
  { value: "cash", label: "Наличными" },
  { value: "transfer", label: "Переводом" },
  { value: "card", label: "Картой" },
];

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

/** Массовая оплата нескольких абонентских периодов подряд. */
function SubBulkPaymentModal({ count, rows, busy, onClose, onSubmit, onError }) {
  const [paymentMode, setPaymentMode] = useState("cash");
  const [note, setNote] = useState("");

  const total = rows.reduce((s, r) => s + (Number(r.amount) || 0), 0);
  const first = rows[0]?.tooltip || rows[0]?.label || "";
  const last = rows[rows.length - 1]?.tooltip || rows[rows.length - 1]?.label || "";

  const submit = async (e) => {
    e.preventDefault();
    try {
      await onSubmit({ count, payment_mode: paymentMode, note });
    } catch (err) {
      onError?.(
        (typeof err === "string" ? err : err?.detail) ||
          "Не удалось провести оплату.",
      );
    }
  };

  return (
    <div className="clientDetail__overlay" onClick={onClose}>
      <div
        className="clientDetail__modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Оплата нескольких периодов абонентки"
      >
        <div className="clientDetail__modalHead">
          <h3 className="clientDetail__modalTitle">
            Оплата за {rows.length} мес. вперёд
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
          <p className="clientDetail__muted">
            {first}
            {last && last !== first ? ` — ${last}` : ""} ·{" "}
            <b>{money(total)}</b> ({rows.length} ×{" "}
            {money(rows[0]?.amount || 0)})
          </p>
          <p className="clientDetail__muted clientDetail__muted--spaced">
            Будет создано {rows.length} заявок в кассу — по одной на период.
            Доступ CRM продлевается по мере подтверждения кассиром.
          </p>
          <label className="clientDetail__modalField">
            <span>Способ оплаты</span>
            <select
              value={paymentMode}
              onChange={(e) => setPaymentMode(e.target.value)}
              disabled={busy}
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
              disabled={busy}
              placeholder="Необязательно"
            />
          </label>
          <div className="clientDetail__modalActions">
            <button
              type="button"
              className="clientDetail__btn"
              onClick={onClose}
              disabled={busy}
            >
              Отмена
            </button>
            <button
              type="submit"
              className="clientDetail__btn clientDetail__btn--primary"
              disabled={busy}
            >
              {busy ? "Оплата…" : `Оплатить ${money(total)}`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

const emptyLine = () => ({ name: "", price: "", qty: "1" });
const lineTotal = (r) =>
  round2((Number(r.price) || 0) * Math.max(1, Number(r.qty) || 1));

/**
 * Доп. продажа действующему клиенту — свободные позиции («Умные весы»,
 * доставка, настройка …), которые продажник добавляет вручную. Это НЕ услуги
 * из каталога /crm/consulting/services.
 * Контракт: docs/consulting/backend-money-tenant/14-client-upsell-sale.md.
 */
function AddSaleModal({ clientName, onClose, onSubmit, onError }) {
  const [rows, setRows] = useState([emptyLine()]);
  const [payMode, setPayMode] = useState("cash");
  const [installment, setInstallment] = useState(false);
  const [months, setMonths] = useState("3");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const setRow = (i, patch) =>
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  const addRow = () => setRows((prev) => [...prev, emptyLine()]);
  const removeRow = (i) =>
    setRows((prev) => (prev.length > 1 ? prev.filter((_, idx) => idx !== i) : prev));
  const bumpQty = (i, delta) =>
    setRow(i, {
      qty: String(Math.max(1, (Number(rows[i]?.qty) || 1) + delta)),
    });

  const total = round2(rows.reduce((s, r) => s + lineTotal(r), 0));
  const perMonth = installment
    ? round2(total / Math.max(1, Number(months) || 1))
    : 0;

  const submit = async (e) => {
    e.preventDefault();
    const items = rows
      .map((r) => ({
        name: String(r.name || "").trim(),
        price: round2(r.price),
        quantity: Math.max(1, Number(r.qty) || 1),
      }))
      .filter((it) => it.name);
    if (!items.length)
      return onError?.("Добавьте хотя бы одну позицию с названием.");
    if (items.some((it) => !(it.price > 0)))
      return onError?.("У каждой позиции укажите цену больше нуля.");
    if (!(total > 0)) return onError?.("Сумма должна быть больше нуля.");

    const m = installment ? Math.max(2, Math.min(24, Number(months) || 2)) : 0;
    const title =
      items[0].name + (items.length > 1 ? ` + ещё ${items.length - 1}` : "");

    setSaving(true);
    try {
      await onSubmit({
        items,
        amount: total,
        title,
        payment_mode: payMode === "card" ? "transfer" : payMode,
        installmentMonths: m,
        note,
      });
    } catch (err) {
      onError?.(
        (typeof err === "string" ? err : err?.detail) ||
          "Не удалось оформить продажу.",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="clientDetail__overlay" onClick={onClose}>
      <div
        className="clientDetail__modal addSale"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Доп. продажа клиенту"
      >
        <div className="addSale__head">
          <div>
            <h3 className="addSale__title">Доп. продажа</h3>
            <p className="addSale__sub">
              {clientName ? `${clientName} · ` : ""}товары и услуги вне тарифа
            </p>
          </div>
          <button
            type="button"
            className="clientDetail__modalClose"
            onClick={onClose}
            aria-label="Закрыть"
          >
            ×
          </button>
        </div>

        <form className="addSale__body" onSubmit={submit} id="addSaleForm">
          <div className="addSale__section">
            <span className="addSale__legend">Что продаём</span>
            <div className="addSale__lines">
              {rows.map((r, i) => (
                <div className="addSale__line" key={i}>
                  <input
                    className="addSale__lineName"
                    value={r.name}
                    onChange={(e) => setRow(i, { name: e.target.value })}
                    disabled={saving}
                    placeholder="Напр.: Умные весы"
                    autoFocus={i === 0}
                  />
                  <input
                    className="addSale__linePrice"
                    type="number"
                    min="0"
                    step="0.01"
                    value={r.price}
                    onChange={(e) => setRow(i, { price: e.target.value })}
                    disabled={saving}
                    placeholder="Цена"
                  />
                  <div className="addSale__lineQty">
                    <button
                      type="button"
                      onClick={() => bumpQty(i, -1)}
                      disabled={saving || (Number(r.qty) || 1) <= 1}
                      aria-label="Меньше"
                    >
                      −
                    </button>
                    <input
                      type="number"
                      min="1"
                      step="1"
                      value={r.qty}
                      onChange={(e) => setRow(i, { qty: e.target.value })}
                      disabled={saving}
                    />
                    <button
                      type="button"
                      onClick={() => bumpQty(i, 1)}
                      disabled={saving}
                      aria-label="Больше"
                    >
                      +
                    </button>
                  </div>
                  <button
                    type="button"
                    className="addSale__lineDel"
                    onClick={() => removeRow(i)}
                    disabled={saving || rows.length <= 1}
                    aria-label="Удалить позицию"
                    title="Удалить позицию"
                  >
                    ×
                  </button>
                  {lineTotal(r) > 0 && (
                    <span className="addSale__lineSum">{money(lineTotal(r))}</span>
                  )}
                </div>
              ))}
            </div>
            <button
              type="button"
              className="addSale__addLine"
              onClick={addRow}
              disabled={saving}
            >
              + Позиция
            </button>
          </div>

          <div className="addSale__section">
            <span className="addSale__legend">Оплата</span>
            <div className="addSale__segment">
              {PAYMENT_MODES.map((m) => (
                <button
                  type="button"
                  key={m.value}
                  className={
                    "addSale__segmentBtn" +
                    (!installment && payMode === m.value
                      ? " addSale__segmentBtn--active"
                      : "")
                  }
                  onClick={() => {
                    setPayMode(m.value);
                    setInstallment(false);
                  }}
                  disabled={saving}
                >
                  {m.label}
                </button>
              ))}
              <button
                type="button"
                className={
                  "addSale__segmentBtn" +
                  (installment ? " addSale__segmentBtn--active" : "")
                }
                onClick={() => setInstallment(true)}
                disabled={saving}
              >
                Рассрочка
              </button>
            </div>
            {installment && (
              <div className="addSale__chips addSale__chips--tight">
                {[2, 3, 4, 6, 9, 12, 18, 24].map((m) => (
                  <button
                    type="button"
                    key={m}
                    className={
                      "addSale__chip" +
                      (String(m) === String(months)
                        ? " addSale__chip--active"
                        : "")
                    }
                    onClick={() => setMonths(String(m))}
                    disabled={saving}
                  >
                    {m} мес.
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="addSale__section">
            <span className="addSale__legend">Комментарий</span>
            <input
              className="addSale__note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              disabled={saving}
              placeholder="Необязательно"
            />
          </div>
        </form>

        <div className="addSale__footer">
          <div className="addSale__totalBox">
            <span className="addSale__totalLabel">Итого к оформлению</span>
            <span className="addSale__totalValue">{money(total)}</span>
            <span className="addSale__totalHint">
              {installment
                ? `рассрочка ${months} мес. · ~${money(perMonth)}/мес · заявка в кассу`
                : "продажа + заявка в кассу, подтвердит кассир"}
            </span>
          </div>
          <div className="addSale__footerActions">
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
              form="addSaleForm"
              className="clientDetail__btn clientDetail__btn--primary"
              disabled={saving || !(total > 0)}
            >
              {saving ? "Оформляем…" : "Оформить"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
