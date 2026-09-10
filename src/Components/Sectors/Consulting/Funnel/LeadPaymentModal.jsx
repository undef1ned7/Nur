import React, { useEffect, useMemo, useState } from "react";
import { useDispatch } from "react-redux";
import { registerLeadPayment } from "../../../../store/creators/funnelThunk";
import { isConsultingCashV2 } from "../../../../utils/consultingMoney";
import api from "../../../../api";
import { toISODate } from "../common/listUtils";
// Модалка используется и на воронке, и на странице «Лиды» — тянем свои стили
// сами, чтобы не зависеть от того, загрузил ли их родитель.
import "./Funnel.scss";

const PAYMENT_MODES = [
  { value: "cash", label: "Наличными" },
  { value: "transfer", label: "Переводом" },
  { value: "debt", label: "В долг" },
  { value: "installment", label: "Рассрочка" },
];

function errToText(e, fallback) {
  if (typeof e === "string") return e;
  const d = e?.detail || e?.message;
  if (typeof d === "string") return d;
  if (typeof e === "object" && e) {
    const k = Object.keys(e)[0];
    const v = Array.isArray(e[k]) ? e[k][0] : e[k];
    if (v) return String(v);
  }
  return fallback;
}

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

/** Прибавить `count` периодов (мес./год) к дате-строке YYYY-MM-DD. */
function addPeriods(startISO, period, count) {
  const d = new Date(`${startISO}T00:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  if (period === "year") d.setFullYear(d.getFullYear() + count);
  else d.setMonth(d.getMonth() + count);
  return d;
}

export default function LeadPaymentModal({ lead: leadProp, onClose, onSuccess }) {
  const dispatch = useDispatch();

  // Со страницы «Лиды» приходит «тонкий» объект (без client, estimated_value,
  // service…). Добираем карточку лида с сервера и мерджим: непустые поля из
  // пропса важнее, остальное берём из ответа.
  // «Тонкий» лид со страницы «Лиды»: нет клиента и не пришла оценочная сумма
  // (в объекте с воронки это поле всегда есть). Только тогда идём за карточкой.
  const willFetchDetail = !!(
    leadProp?.id &&
    !leadProp?.client &&
    !leadProp?.client_id &&
    leadProp?.estimated_value == null
  );
  const [detail, setDetail] = useState(null);
  // Пока карточка догружается — не мигаем подсказками «нет клиента / услуги».
  const [detailLoading, setDetailLoading] = useState(willFetchDetail);
  const [servicesTried, setServicesTried] = useState(false);
  const lead = useMemo(() => {
    if (!detail) return leadProp || {};
    const merged = { ...detail };
    for (const [k, v] of Object.entries(leadProp || {})) {
      if (v !== undefined && v !== null && v !== "") merged[k] = v;
    }
    return merged;
  }, [detail, leadProp]);

  const defaultAmount = useMemo(() => {
    const v = Number(lead?.estimated_value);
    return Number.isFinite(v) && v > 0 ? String(v) : "";
  }, [lead?.estimated_value]);

  const [form, setForm] = useState({
    payment_mode: "cash",
    amount: defaultAmount,
    debt_months: "",
    prepayment: "",
    note: "",
  });
  const [err, setErr] = useState("");
  const [saving, setSaving] = useState(false);
  // Менеджер вручную поправил «Сумма» — перестаём её автопересчитывать.
  const [amountTouched, setAmountTouched] = useState(false);

  /* ---------------- оплата за несколько месяцев ---------------- */
  // `months` — за сколько месяцев вносят оплату сразу.
  //  • тариф с абонплатой → это число предоплаченных периодов графика;
  //  • обычная оплата → множитель суммы (5000 × 3 мес = 15000);
  //  • «вести как подписку» → создаём Subscription и предоплачиваем N периодов.
  const [months, setMonths] = useState("1");
  const [manualSub, setManualSub] = useState(false);

  /* ---------------- абонентская плата из тарифа (ТЗ №5) ---------------- */
  const [services, setServices] = useState([]);
  const [subEnabled, setSubEnabled] = useState(true);
  const [subStart, setSubStart] = useState(() => toISODate(new Date()));

  /* ---------------- доп. услуги (разовые позиции при оплате) ---------------- */
  // Напр. «умные весы». Их сумма прибавляется к «Сумма, с *».
  // Хранятся как [{ name, price, qty }].
  const [addons, setAddons] = useState([]);
  const addAddon = () =>
    setAddons((rows) => [...rows, { name: "", price: "", qty: "1" }]);
  const setAddon = (i, patch) =>
    setAddons((rows) =>
      rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)),
    );
  const removeAddon = (i) =>
    setAddons((rows) => rows.filter((_, idx) => idx !== i));
  const bumpAddonQty = (i, delta) =>
    setAddons((rows) =>
      rows.map((r, idx) =>
        idx === i
          ? { ...r, qty: String(Math.max(1, (Number(r.qty) || 1) + delta)) }
          : r,
      ),
    );
  const addonLineTotal = (r) =>
    round2((Number(r.price) || 0) * Math.max(1, Math.floor(Number(r.qty) || 1)));

  useEffect(() => {
    // «Тонкий» лид без клиента — тянем полную карточку с сервера.
    if (!willFetchDetail) return undefined;
    const id = leadProp?.id;
    const controller = new AbortController();
    api
      .get(`/consalting/leads/${id}/`, { signal: controller.signal })
      .then((res) => {
        const data = res?.data || null;
        setDetail(data);
        setDetailLoading(false);
        // Автоподстановка суммы из оценочной, если менеджер её ещё не трогал.
        const v = Number(data?.estimated_value);
        setForm((f) =>
          amountTouched || f.amount || !(v > 0)
            ? f
            : { ...f, amount: String(v) },
        );
      })
      .catch((e) => {
        if (e?.name !== "CanceledError" && e?.code !== "ERR_CANCELED") {
          setDetailLoading(false);
        }
      });
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [willFetchDetail, leadProp?.id]);

  useEffect(() => {
    // подгрузка справочника услуг (нужен, чтобы достать абонплату тарифа лида)
    if (!lead?.service) return undefined;
    const controller = new AbortController();
    api
      .get("/consalting/services/", { signal: controller.signal })
      .then((res) => {
        const data = res?.data;
        setServices(Array.isArray(data?.results) ? data.results : data || []);
        setServicesTried(true);
      })
      .catch((e) => {
        if (e?.name !== "CanceledError" && e?.code !== "ERR_CANCELED") {
          setServicesTried(true);
        }
      });
    return () => controller.abort();
  }, [lead?.service]);

  const subscription = useMemo(() => {
    // Сервер может прислать абонплату прямо в лиде — тогда справочник не нужен.
    const direct = Number(lead?.subscription_amount);
    if (Number.isFinite(direct) && direct > 0) {
      return {
        amount: direct,
        period: lead?.subscription_period === "year" ? "year" : "month",
        source: lead?.tariff_display || lead?.service_display || "",
      };
    }
    const service = services.find(
      (s) => String(s.id) === String(lead?.service),
    );
    const tariff = (service?.tariffs || []).find(
      (t) => String(t.id) === String(lead?.tariff),
    );
    const amount = Number(tariff?.subscription_amount);
    if (!Number.isFinite(amount) || amount <= 0) return null;
    return {
      amount,
      period: tariff?.subscription_period === "year" ? "year" : "month",
      source: [service?.name, tariff?.name].filter(Boolean).join(" · "),
    };
  }, [services, lead]);

  // Что именно продаём — показываем кассиру/продавцу, чтобы не перепутать лид.
  const saleService = useMemo(() => {
    const service = services.find((s) => String(s.id) === String(lead?.service));
    const tariff = (service?.tariffs || []).find(
      (t) => String(t.id) === String(lead?.tariff),
    );
    return {
      name: lead?.service_display || service?.name || "",
      tariff: lead?.tariff_display || tariff?.name || "",
    };
  }, [services, lead]);

  // Услуга ещё «резолвится», если ждём карточку лида либо справочник услуг
  // (у лида есть service, но имя пока не подтянулось).
  const summaryLoading =
    detailLoading ||
    (!!lead?.service && !saleService.name && !servicesTried);

  const hasTariffSub = !!subscription;
  const needsSchedule =
    form.payment_mode === "debt" || form.payment_mode === "installment";
  // Блок «за сколько месяцев» несовместим с долгом/рассрочкой (там свой график).
  const showMonths = !needsSchedule;

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const monthsNum = Math.max(1, Math.floor(Number(months) || 1));
  const activePeriod = hasTariffSub ? subscription.period : "month";
  const periodUnit = activePeriod === "year" ? "год" : "мес.";

  // Пересчитать «Сумма» при обычной оплате (не подписка), пока её не трогали.
  const recalcAmount = (nextMonths, nextManualSub) => {
    if (hasTariffSub || nextManualSub || amountTouched) return;
    const base = Number(defaultAmount) || 0;
    if (base > 0) {
      const n = Math.max(1, Math.floor(Number(nextMonths) || 1));
      setForm((f) => ({ ...f, amount: String(round2(base * n)) }));
    }
  };

  const onMonthsChange = (e) => {
    const v = e.target.value;
    setMonths(v);
    recalcAmount(v, manualSub);
  };

  const onManualSubToggle = (e) => {
    const on = e.target.checked;
    setManualSub(on);
    if (on) {
      // «Сумма» становится суммой в месяц — возвращаем базовую.
      if (!amountTouched && defaultAmount) {
        setForm((f) => ({ ...f, amount: defaultAmount }));
      }
    } else {
      recalcAmount(months, false);
    }
  };

  const onAmountChange = (e) => {
    setAmountTouched(true);
    set("amount")(e);
  };

  // Подписка активна: либо абонплата тарифа подтверждена, либо менеджер сам
  // включил помесячную оплату.
  const subscriptionActive =
    (hasTariffSub && subEnabled) || (!hasTariffSub && manualSub);

  const amountNum = round2(Number(form.amount) || 0);
  const addonsTotal = round2(
    addons.reduce((s, r) => s + addonLineTotal(r), 0),
  );

  // «Вести как абонентскую подписку»: доп. услуги входят в ЕЖЕМЕСЯЧНУЮ абонплату
  //  (умные весы 1200 + модуль 1250 + база 1300 → 3750 с/мес).
  //  Без подписки — доп. услуги разовые, прибавляются к оплате один раз.
  const manualSubActive = !hasTariffSub && manualSub;
  const monthlyFee = manualSubActive
    ? round2(amountNum + addonsTotal)
    : amountNum;

  // График платежей строится ВСЕГДА, когда оплата за > 1 мес. — даже без
  // галочки «Вести как подписку». Галочка добавляет автопродление, абонентскую
  // матрицу и CRM-аккаунт; без неё это фиксированный оплаченный график на N мес.
  const buildsSchedule =
    !needsSchedule &&
    (subscriptionActive || (!hasTariffSub && !manualSub && monthsNum > 1));

  // Ставка за период для графика.
  const perMonth = hasTariffSub
    ? subscription.amount
    : manualSubActive
      ? monthlyFee
      : monthsNum > 1
        ? round2(amountNum / monthsNum)
        : amountNum;
  const prepayTotal = round2(perMonth * monthsNum);

  // Сумма к приёму в кассу.
  const cashBase = manualSubActive ? round2(monthlyFee * monthsNum) : amountNum;
  const grandTotal = manualSubActive
    ? cashBase
    : round2(cashBase + addonsTotal);

  const paidThroughLabel = useMemo(() => {
    if (!buildsSchedule || !subStart) return "";
    const d = addPeriods(subStart, activePeriod, monthsNum - 1);
    return d
      ? d.toLocaleDateString("ru-RU", { month: "long", year: "numeric" })
      : "";
  }, [buildsSchedule, subStart, activePeriod, monthsNum]);

  const clientId = lead?.client || lead?.client_id;
  // В новом денежном контуре (V2) эндпоинт register-payment сам конвертирует
  // лид в клиента, поэтому заранее создавать карточку не обязательно. В легаси
  // (V1) продажа пишется в /main/clients/{id}/deals/ — там клиент обязателен.
  const clientRequired = !isConsultingCashV2();
  const blockNoClient = clientRequired && !clientId;
  const formDisabled = blockNoClient || saving;
  const needsEmailForTenant =
    subscriptionActive && !String(lead?.email || "").trim();

  const submit = async (e) => {
    e.preventDefault();
    const items = addons
      .map((r) => ({
        name: String(r.name || "").trim(),
        price: round2(r.price),
        quantity: Math.max(1, Math.floor(Number(r.qty) || 1)),
      }))
      .filter((r) => r.name);
    if (
      addons.some(
        (r) => String(r.name || "").trim() && !(Number(r.price) > 0),
      )
    ) {
      setErr("У доп. услуги укажите цену больше нуля.");
      return;
    }
    if (!(grandTotal > 0)) {
      setErr("Укажите сумму больше нуля.");
      return;
    }
    if (needsSchedule && !form.debt_months) {
      setErr("Укажите срок (месяцев).");
      return;
    }
    if (needsEmailForTenant) {
      setErr(
        "Укажите email клиента в карточке лида — он нужен для создания CRM-аккаунта после подтверждения оплаты в кассе.",
      );
      return;
    }
    setErr("");
    setSaving(true);

    // Сумма к приёму в кассу = базовая (с учётом множителя месяцев для ручной
    // подписки) + разовые доп. услуги.
    const cashAmount = grandTotal;

    let subFields = {};
    if (hasTariffSub) {
      subFields = {
        subscription_enabled: subEnabled,
        subscription_amount: subEnabled ? subscription.amount : 0,
        subscription_period: subscription.period,
        subscription_start: subEnabled ? subStart : undefined,
        subscription_prepaid_periods: subEnabled ? monthsNum : undefined,
      };
    } else if (manualSub) {
      subFields = {
        subscription_enabled: true,
        // Ежемесячная абонплата = база + доп. услуги (они уже здесь, отдельно
        // разовым платежом их не выставлять).
        subscription_amount: monthlyFee,
        subscription_period: "month",
        subscription_start: subStart,
        subscription_prepaid_periods: monthsNum,
        subscription_autorenew: true,
      };
    } else if (monthsNum > 1) {
      // Без галочки «Вести как подписку», но оплата за N мес. → создаём
      // фиксированный график на N месяцев: все N периодов оплачены, без
      // автопродления, без абонентской матрицы и CRM-аккаунта.
      subFields = {
        subscription_enabled: true,
        subscription_amount: perMonth, // amountNum / monthsNum
        subscription_period: "month",
        subscription_start: subStart,
        subscription_prepaid_periods: monthsNum,
        subscription_autorenew: false,
        paid_months: monthsNum,
      };
    }

    try {
      const result = await dispatch(
        registerLeadPayment({
          leadId: lead.id,
          payment_mode: form.payment_mode,
          amount: cashAmount,
          debt_months: needsSchedule ? Number(form.debt_months) : undefined,
          prepayment:
            form.payment_mode === "installment" && form.prepayment !== ""
              ? Number(form.prepayment)
              : undefined,
          note: form.note.trim(),
          items: items.length ? items : undefined,
          ...subFields,
        }),
      ).unwrap();
      onSuccess?.(result);
      onClose?.();
    } catch (e2) {
      setErr(errToText(e2, "Не удалось оформить оплату."));
    } finally {
      setSaving(false);
    }
  };

  const amountLabel =
    !hasTariffSub && manualSub ? "Сумма в месяц, с *" : "Сумма, с *";

  return (
    <div className="funnel__overlay" onClick={onClose}>
      <div
        className="funnel__modal funnel__modal--wide"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-labelledby="lead-pay-title"
      >
        <div className="funnel__modalHead">
          <div className="funnel__modalTitle" id="lead-pay-title">
            Оформить оплату по лиду
          </div>
          <button
            type="button"
            className="funnel__iconBtn"
            onClick={onClose}
            aria-label="Закрыть"
          >
            ×
          </button>
        </div>
        <form className="funnel__form" onSubmit={submit}>
          {blockNoClient && (
            <div className="funnel__error">
              Сначала создайте клиента из лида — оплата привязывается к карточке
              клиента и попадёт в аналитику.
            </div>
          )}
          {!clientId && !clientRequired && !detailLoading && (
            <div className="funnel__note">
              Клиент из этого лида будет создан автоматически при оформлении
              оплаты.
            </div>
          )}
          {!!err && <div className="funnel__error">{err}</div>}

          {/* Что продаём — чтобы кассир/продавец не перепутал лид */}
          <div className="funnel__saleSummary">
            <div className="funnel__saleSummaryTop">
              <span className="funnel__saleSummaryLabel">Продажа</span>
              <span className="funnel__saleSummaryTitle">
                {lead?.title || lead?.full_name || "Лид"}
              </span>
            </div>
            <div className="funnel__saleSummaryTags">
              {summaryLoading ? (
                <span className="funnel__saleSummaryTag funnel__saleSummaryTag--loading">
                  Загрузка…
                </span>
              ) : saleService.name ? (
                <span className="funnel__saleSummaryTag">
                  {saleService.name}
                  {saleService.tariff ? ` · ${saleService.tariff}` : ""}
                </span>
              ) : (
                <span className="funnel__saleSummaryTag funnel__saleSummaryTag--muted">
                  Услуга не указана
                </span>
              )}
              {addons
                .filter((r) => String(r.name || "").trim())
                .map((r, i) => {
                  const qn = Math.max(1, Math.floor(Number(r.qty) || 1));
                  return (
                    <span
                      className="funnel__saleSummaryTag funnel__saleSummaryTag--addon"
                      key={i}
                    >
                      {r.name.trim()}
                      {qn > 1 ? ` ×${qn}` : ""}
                    </span>
                  );
                })}
            </div>
          </div>

          <div className="funnel__grid2">
            <div className="funnel__field">
              <label className="funnel__label">Способ оплаты *</label>
              <select
                className="funnel__input"
                value={form.payment_mode}
                onChange={set("payment_mode")}
                disabled={formDisabled}
              >
                {PAYMENT_MODES.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="funnel__field">
              <label className="funnel__label">{amountLabel}</label>
              <input
                className="funnel__input"
                type="number"
                min="0"
                step="0.01"
                value={form.amount}
                onChange={onAmountChange}
                disabled={formDisabled}
              />
            </div>
          </div>

          {/* Доп. услуги — разовые позиции, их сумма идёт в «Итого» */}
          <div className="funnel__field">
            <div className="funnel__addonBox">
              <div className="funnel__addonHead">
                <span className="funnel__addonTitle">Доп. услуги</span>
                <button
                  type="button"
                  className="funnel__addonAdd"
                  onClick={addAddon}
                  disabled={formDisabled}
                >
                  <span aria-hidden>＋</span> Доп. услуга
                </button>
              </div>

              {addons.length === 0 ? (
                <p className="funnel__addonEmpty">
                  Разовые позиции к этой оплате (напр. «умные весы») —
                  их сумма добавится к оплате.
                </p>
              ) : (
                <div className="funnel__addonList">
                  {addons.map((r, i) => {
                    const sum = addonLineTotal(r);
                    const qn = Math.max(1, Math.floor(Number(r.qty) || 1));
                    return (
                      <div className="funnel__addonRow" key={i}>
                        <input
                          className="funnel__input funnel__addonName"
                          placeholder="Напр.: умные весы"
                          value={r.name}
                          onChange={(e) =>
                            setAddon(i, { name: e.target.value })
                          }
                          disabled={formDisabled}
                        />
                        <div className="funnel__addonPriceWrap">
                          <input
                            className="funnel__input funnel__addonPrice"
                            type="number"
                            min="0"
                            step="0.01"
                            placeholder="0"
                            value={r.price}
                            onChange={(e) =>
                              setAddon(i, { price: e.target.value })
                            }
                            disabled={formDisabled}
                          />
                          <span className="funnel__addonCur">с</span>
                        </div>
                        <div className="funnel__addonQty">
                          <button
                            type="button"
                            onClick={() => bumpAddonQty(i, -1)}
                            disabled={
                              formDisabled || (Number(r.qty) || 1) <= 1
                            }
                            aria-label="Меньше"
                          >
                            −
                          </button>
                          <input
                            type="number"
                            min="1"
                            step="1"
                            value={r.qty}
                            onChange={(e) =>
                              setAddon(i, { qty: e.target.value })
                            }
                            disabled={formDisabled}
                          />
                          <button
                            type="button"
                            onClick={() => bumpAddonQty(i, 1)}
                            disabled={formDisabled}
                            aria-label="Больше"
                          >
                            +
                          </button>
                        </div>
                        <button
                          type="button"
                          className="funnel__addonDel"
                          onClick={() => removeAddon(i)}
                          disabled={formDisabled}
                          aria-label="Удалить позицию"
                          title="Удалить"
                        >
                          ×
                        </button>
                        {sum > 0 && (
                          <span className="funnel__addonSum">
                            {qn > 1
                              ? `${(Number(r.price) || 0).toLocaleString(
                                  "ru-RU",
                                )} × ${qn} = `
                              : ""}
                            <b>{sum.toLocaleString("ru-RU")} с</b>
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {addonsTotal > 0 && manualSubActive && (
            <div className="funnel__totalLine">
              <span>
                Абонплата: база <b>{amountNum.toLocaleString("ru-RU")}</b> + доп.
                услуги <b>{addonsTotal.toLocaleString("ru-RU")}</b> ={" "}
                <b>{monthlyFee.toLocaleString("ru-RU")} с / мес.</b>
                {monthsNum > 1 ? ` · предоплата ${monthsNum} мес.` : ""}
              </span>
              <span className="funnel__totalLineSum">
                {monthsNum > 1
                  ? `К оплате ${grandTotal.toLocaleString("ru-RU")} с`
                  : `${monthlyFee.toLocaleString("ru-RU")} с`}
              </span>
            </div>
          )}

          {addonsTotal > 0 && !manualSubActive && (
            <div className="funnel__totalLine">
              <span>
                {amountLabel.replace(" *", "")}{" "}
                <b>{cashBase.toLocaleString("ru-RU")}</b> + доп. услуги{" "}
                <b>{addonsTotal.toLocaleString("ru-RU")}</b>
              </span>
              <span className="funnel__totalLineSum">
                Итого {grandTotal.toLocaleString("ru-RU")} с
              </span>
            </div>
          )}

          {/* За сколько месяцев вносят оплату */}
          {showMonths && (
            <div className="funnel__subBlock">
              <div className="funnel__grid2">
                <div className="funnel__field">
                  <label className="funnel__label">
                    {hasTariffSub
                      ? `Оплатить вперёд, периодов (${periodUnit})`
                      : "Оплата за, мес."}
                  </label>
                  <input
                    className="funnel__input"
                    type="number"
                    min="1"
                    step="1"
                    value={months}
                    onChange={onMonthsChange}
                    disabled={formDisabled}
                  />
                </div>
                {buildsSchedule && (
                  <div className="funnel__field">
                    <label className="funnel__label">
                      Дата первого списания
                    </label>
                    <input
                      className="funnel__input"
                      type="date"
                      value={subStart}
                      onChange={(e) => setSubStart(e.target.value)}
                      disabled={formDisabled}
                    />
                  </div>
                )}
              </div>

              {/* Тумблер «вести как подписку» — только когда абонплаты в тарифе нет */}
              {!hasTariffSub && (
                <label className="funnel__subToggle">
                  <input
                    type="checkbox"
                    checked={manualSub}
                    onChange={onManualSubToggle}
                    disabled={formDisabled}
                  />
                  <span>
                    <b>Вести как абонентскую подписку</b>
                    <small>
                      график платежей в карточке клиента и в абонентской матрице
                      {addonsTotal > 0
                        ? ". Доп. услуги входят в ежемесячную абонплату"
                        : ""}
                    </small>
                  </span>
                </label>
              )}

              {/* Галка подтверждения абонплаты тарифа */}
              {hasTariffSub && (
                <label className="funnel__subToggle">
                  <input
                    type="checkbox"
                    checked={subEnabled}
                    onChange={(e) => setSubEnabled(e.target.checked)}
                    disabled={formDisabled}
                  />
                  <span>
                    <b>Подключить абонентскую плату</b>
                    <small>
                      {subscription.source ? `${subscription.source}: ` : ""}
                      {subscription.amount.toLocaleString("ru-RU")} с /{" "}
                      {periodUnit}
                    </small>
                  </span>
                </label>
              )}

              {buildsSchedule && monthsNum > 1 && (
                <small className="funnel__hint">
                  {monthsNum} × {perMonth.toLocaleString("ru-RU")} ={" "}
                  <b>{prepayTotal.toLocaleString("ru-RU")} с</b>
                  {paidThroughLabel ? ` — оплачено по ${paidThroughLabel}` : ""}.{" "}
                  {subscriptionActive
                    ? `Первые ${monthsNum} платежей графика будут помечены оплаченными.`
                    : `Будет создан график на ${monthsNum} мес. — все оплачены, без автопродления.`}
                </small>
              )}
              {monthsNum <= 1 && !subscriptionActive && (
                <small className="funnel__hint">
                  Разовая оплата. График платежей не создаётся.
                </small>
              )}
              {subscriptionActive && (
                <small className="funnel__hint">
                  CRM-аккаунт клиента создаётся после подтверждения оплаты в
                  кассе.
                </small>
              )}
            </div>
          )}

          {needsSchedule && (
            <div className="funnel__grid2">
              <div className="funnel__field">
                <label className="funnel__label">Срок, мес.</label>
                <input
                  className="funnel__input"
                  type="number"
                  min="1"
                  step="1"
                  value={form.debt_months}
                  onChange={set("debt_months")}
                  placeholder="6"
                  disabled={formDisabled}
                />
              </div>
              {form.payment_mode === "installment" && (
                <div className="funnel__field">
                  <label className="funnel__label">Первый платёж, с</label>
                  <input
                    className="funnel__input"
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.prepayment}
                    onChange={set("prepayment")}
                    disabled={formDisabled}
                  />
                </div>
              )}
            </div>
          )}
          <div className="funnel__field">
            <label className="funnel__label">Комментарий</label>
            <input
              className="funnel__input"
              value={form.note}
              onChange={set("note")}
              disabled={formDisabled}
            />
          </div>
          <div className="funnel__formActions">
            <button
              type="button"
              className="funnel__btn"
              onClick={onClose}
              disabled={saving}
            >
              Отмена
            </button>
            <button
              type="submit"
              className="funnel__btn funnel__btn--primary"
              disabled={formDisabled}
            >
              {saving ? "…" : "Оформить"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
