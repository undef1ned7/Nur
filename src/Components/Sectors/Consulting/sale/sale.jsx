import React, { useEffect, useMemo, useRef, useState } from "react";
import "./sale.scss";
import { FaPlus, FaTimes, FaTrash } from "react-icons/fa";
import { DEAL_STATUS_RU } from "../../../pages/Sell/Sell";
import { useDispatch } from "react-redux";
import {
  createConsultingSale,
  getConsultingRows,
  getConsultingServices,
  deleteConsultingSale,
} from "../../../../store/creators/consultingThunk";
import { useConsulting } from "../../../../store/slices/consultingSlice";
import {
  createClientAsync,
  fetchClientsAsync,
} from "../../../../store/creators/clientCreators";
import { useClient } from "../../../../store/slices/ClientSlice";
import { createDeal } from "../../../../store/creators/saleThunk";
import {
  addCashFlows,
  getCashBoxes,
  useCash,
} from "../../../../store/slices/cashSlice";
import { useUser } from "../../../../store/slices/userSlice";
import {
  calcConsultingSaleTotal,
  normalizeSaleItemsForApi,
} from "../../../../utils/consultingSalePricing";
import {
  usePersistedViewMode,
  VIEW_MODES,
} from "../../../../utils/consultingViewMode";
import ViewModeToggle from "../common/ViewModeToggle";
import { useAlert, useConfirm } from "../../../../hooks/useDialog";

const SALES_VIEW_STORAGE_KEY = "consulting_sales_view_mode";

/* ===== helpers ===== */
const clean = (s) =>
  String(s || "")
    .replace(/\s+/g, " ")
    .trim();
const num = (v) => {
  const n = typeof v === "string" ? Number(String(v).replace(",", ".")) : Number(v);
  return Number.isFinite(n) ? n : 0;
};
const money = (v) => (Number(v) || 0).toLocaleString() + " с";

function ExtraItemsEditor({ items, onChange, disabled }) {
  const rows = items?.length ? items : [{ name: "", price: "" }];

  const setRow = (idx, patch) => {
    const next = rows.map((r, i) => (i === idx ? { ...r, ...patch } : r));
    onChange(next);
  };

  const addRow = () => onChange([...rows, { name: "", price: "" }]);

  const removeRow = (idx) => {
    const next = rows.filter((_, i) => i !== idx);
    onChange(next.length ? next : [{ name: "", price: "" }]);
  };

  return (
    <div className="sale__items">
      <div className="sale__itemsHead">
        <span className="sale__label">Доп. товары</span>
        <button
          type="button"
          className="sale__btn sale__btn--secondary"
          onClick={addRow}
          disabled={disabled}
        >
          <FaPlus /> Товар
        </button>
      </div>
      {rows.map((row, idx) => (
        <div key={idx} className="sale__itemRow">
          <input
            className="sale__input"
            placeholder="Название"
            value={row.name}
            onChange={(e) => setRow(idx, { name: e.target.value })}
            disabled={disabled}
          />
          <input
            className="sale__input"
            type="number"
            min="0"
            step="0.01"
            placeholder="Цена"
            value={row.price}
            onChange={(e) => setRow(idx, { price: e.target.value })}
            disabled={disabled}
          />
          <button
            type="button"
            className="sale__iconBtn"
            onClick={() => removeRow(idx)}
            disabled={disabled || rows.length <= 1}
            aria-label="Удалить товар"
          >
            <FaTrash />
          </button>
        </div>
      ))}
    </div>
  );
}

export default function ConsultingSale({
  employees = [],
  onCreateSale, // оставил поддержку, но теперь используем thunk
  onDeleteSale, // оставил поддержку, но теперь используем thunk
  disabled = false,
}) {
  const dispatch = useDispatch();
  const confirm = useConfirm();
  const alert = useAlert();
  const { services = [], rows = [] } = useConsulting();
  const { list: clients = [] } = useClient();
  const { company } = useUser();
  /* модалка создания продажи */
  const [open, setOpen] = useState(false);
  const [viewMode, setViewMode] = usePersistedViewMode(SALES_VIEW_STORAGE_KEY);

  /* форма */
  const [dealStatus, setDealStatus] = useState(""); // Тип оплаты — НЕ трогаем
  const [serviceId, setServiceId] = useState("");
  const [tariffId, setTariffId] = useState("");
  const [extraItems, setExtraItems] = useState([]);
  const [discount, setDiscount] = useState("0");
  const [markup, setMarkup] = useState("0");
  const [note, setNote] = useState("");
  const [debtMonths, setDebtMonths] = useState("");
  const [prepayment, setPrepayment] = useState("");
  const [cashboxId, setCashboxId] = useState("");
  const { list: cashBoxes } = useCash();

  // Храним клиента и прочее здесь
  const [saleData, setSaleData] = useState({
    client: "",
    description: "",
    services: "",
  });

  const [formErr, setFormErr] = useState("");
  const didInitRef = useRef(true);

  const onChange = (e) => {
    const { name, value } = e.target;
    setSaleData((prev) => ({ ...prev, [name]: value }));
  };

  const resetForm = () => {
    setSaleData({ client: "", description: "" });
    setServiceId("");
    setTariffId("");
    setExtraItems([]);
    setDiscount("0");
    setMarkup("0");
    setDealStatus("");
    setNote("");
    setFormErr("");
  };

  const selectedService = useMemo(() => {
    return services.find((x) => String(x.id) === String(serviceId)) || null;
  }, [services, serviceId]);

  const serviceTariffs = useMemo(
    () => (Array.isArray(selectedService?.tariffs) ? selectedService.tariffs : []),
    [selectedService]
  );

  useEffect(() => {
    if (!serviceId) {
      setTariffId("");
      return;
    }
    if (!serviceTariffs.length) {
      setTariffId("");
      return;
    }
    const stillValid = serviceTariffs.some(
      (t) => String(t.id) === String(tariffId)
    );
    if (!stillValid) {
      setTariffId(String(serviceTariffs[0].id));
    }
  }, [serviceId, serviceTariffs, tariffId]);

  const previewTotal = useMemo(
    () =>
      calcConsultingSaleTotal({
        service: selectedService,
        tariffId: tariffId || null,
        items: normalizeSaleItemsForApi(extraItems),
        discount,
        markup,
      }),
    [selectedService, tariffId, extraItems, discount, markup]
  );

  const needsTariff = serviceTariffs.length > 0;
  const canCreate =
    Boolean(saleData.client) &&
    Boolean(serviceId) &&
    (!needsTariff || Boolean(tariffId));
  const clientFullName = useMemo(() => {
    const c = clients.find((x) => String(x.id) === String(saleData.client));
    return c?.full_name || "";
  }, [clients, saleData.client]);

  /* создать продажу — через thunk */
  const submitSale = async (e) => {
    e.preventDefault();
    if (!canCreate) {
      setFormErr(
        needsTariff
          ? "Выберите клиента, услугу и тариф."
          : "Выберите клиента и услугу."
      );
      return;
    }

    if (!selectedService) {
      setFormErr("Не удалось определить выбранную услугу.");
      return;
    }
    setFormErr("");

    const payload = {
      client: saleData.client,
      services: serviceId,
      tariff: tariffId || null,
      discount: num(discount),
      markup: num(markup),
      items: normalizeSaleItemsForApi(extraItems),
      description: clean(note || saleData.description),
      status: dealStatus, // Тип оплаты (как просил — не менял)
    };

    try {
      // Если извне передан onCreateSale — дадим ему шанс, но основной путь — thunk
      if (onCreateSale) {
        await onCreateSale(payload);
      } else {
        const sale = await dispatch(createConsultingSale(payload)).unwrap();
        const saleTotal = Number(sale.total) || previewTotal;
        const result = await dispatch(
          createDeal({
            clientId: saleData.client,
            title: selectedService.name ?? selectedService.title ?? "Услуга",
            statusRu: dealStatus,
            amount: saleTotal,
            // prepayment только при "Предоплата"
            prepayment:
              dealStatus === "Предоплата" ? Number(prepayment) : undefined,
            // debtMonths и для "Долги", и для "Предоплата"
            debtMonths:
              dealStatus === "Долги" || dealStatus === "Предоплата"
                ? Number(debtMonths)
                : undefined,
          })
        ).unwrap();

        await dispatch(
          addCashFlows({
            cashbox: cashboxId,
            type: "income",
            name: clientFullName,
            status:
              company?.subscription_plan?.name === "Старт"
                ? "approved"
                : "pending",
            amount:
              dealStatus === "Предоплата"
                ? result.prepayment
                : saleTotal,
            source_cashbox_flow_id: sale.id,
            source_business_operation_id: "Продажа консалтинг",
          })
        ).unwrap();
      }

      // после успешного создания: закрываем модалку, чистим форму, можно рефетчить
      setOpen(false);
      resetForm();
      dispatch(getConsultingRows());
    } catch (err) {
      setFormErr(
        (typeof err === "string" ? err : err?.detail) ||
          "Не удалось создать продажу. Попробуйте ещё раз."
      );
    }
  };

  /* создать клиента инлайн — через thunk */
  const [createClientOpen, setCreateClientOpen] = useState(false);
  const [newClient, setNewClient] = useState({
    full_name: "",
    phone: "",
    email: "",
    type: "client",
  });

  const submitCreateClient = async (e) => {
    e.preventDefault();
    const full_name = clean(newClient.full_name);
    if (!full_name || full_name.length < 2) {
      setFormErr("Введите имя клиента (минимум 2 символа).");
      return;
    }

    try {
      const created = await dispatch(createClientAsync(newClient)).unwrap();
      if (created?.id) {
        setSaleData((p) => ({ ...p, client: String(created.id) }));
      }
      setCreateClientOpen(false);
      setNewClient({ full_name: "", phone: "", email: "", type: "client" });
      setFormErr("");
      dispatch(fetchClientsAsync());
    } catch (err) {
      setFormErr(
        (typeof err === "string" ? err : err?.detail) ||
          "Не удалось создать клиента. Попробуйте ещё раз."
      );
    }
  };

  /* удалить продажу — через thunk */
  const removeSale = (row) => {
    if (!row?.id) return;
    confirm("Удалить эту продажу?", async (result) => {
      if (!result) return;
      try {
        if (onDeleteSale) {
          await onDeleteSale(row);
        } else {
          await dispatch(deleteConsultingSale(row.id)).unwrap();
        }
        dispatch(getConsultingRows());
      } catch (err) {
        alert(
          (typeof err === "string" ? err : err?.detail) ||
            "Не удалось удалить продажу.",
          true
        );
      }
    });
  };

  /* начальные загрузки */
  useEffect(() => {
    dispatch(fetchClientsAsync());
    dispatch(getConsultingServices());
    dispatch(getConsultingRows());
    dispatch(getCashBoxes());
  }, [dispatch]);

  // Автоматически выбираем первую кассу по индексу
  useEffect(() => {
    if (cashBoxes && cashBoxes.length > 0 && !cashboxId) {
      const firstCashBox = cashBoxes[0];
      const firstCashBoxId = firstCashBox?.id || firstCashBox?.uuid || "";
      if (firstCashBoxId) {
        setCashboxId(String(firstCashBoxId));
      }
    }
  }, [cashBoxes, cashboxId]);

  return (
    <section className="sale">
      <header className="sale__header">
        <div>
          <h2 className="sale__title">Продажи</h2>
          <p className="sale__subtitle">
            Выбор продавца, клиента и услуги (сервер)
          </p>
        </div>
        <div className="sale__toolbar">
          <ViewModeToggle viewMode={viewMode} onChange={setViewMode} disabled={disabled} />

          <button
            className="sale__btn sale__btn--primary"
            onClick={() => setOpen(true)}
            disabled={disabled}
          >
            <FaPlus />
            Продажа
          </button>
        </div>
      </header>

      <div className="sale__meta">
        <span>Всего продаж: {rows?.length || 0}</span>
      </div>

      {/* подсказки, если пустые справочники */}
      {services.length === 0 && (
        <div className="sale__alert">
          Справочник услуг пуст. Создайте услуги в разделе «Услуги».
        </div>
      )}

      {viewMode === VIEW_MODES.TABLE && (
        <div className="sale__tableWrap">
          <table className="sale__table">
            <thead>
              <tr>
                <th>Дата</th>
                <th>Продавец</th>
                <th>Клиент</th>
                <th>Услуга</th>
                <th>Тариф</th>
                <th>Итого</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows?.length ? (
                rows.map((r) => (
                  <tr key={r.id}>
                    <td>
                      {r.created_at
                        ? new Date(r.created_at).toLocaleString()
                        : ""}
                    </td>
                    <td>{r.user_display}</td>
                    <td>{r.client_display}</td>
                    <td className="sale__ellipsis" title={r.service_display}>
                      {r.service_display}
                    </td>
                    <td>{r.tariff_display || "—"}</td>
                    <td>{money(r.total ?? r.service_price)}</td>
                    <td className="sale__rowActions">
                      <button
                        className="sale__btn sale__btn--danger"
                        onClick={() => removeSale(r)}
                        title="Удалить продажу"
                        disabled={disabled}
                      >
                        <FaTrash /> Удалить
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td className="sale__empty" colSpan={7}>
                    Пока нет продаж
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {viewMode === VIEW_MODES.CARDS && (
        <div className="sale__cards">
          {rows?.length ? (
            rows.map((r) => (
              <article key={r.id} className="sale__card">
                <div className="sale__cardHead">
                  <time className="sale__cardDate">
                    {r.created_at
                      ? new Date(r.created_at).toLocaleString()
                      : "—"}
                  </time>
                  <strong className="sale__cardTotal">
                    {money(r.total ?? r.service_price)}
                  </strong>
                </div>
                <dl className="sale__cardMeta">
                  <div>
                    <dt>Продавец</dt>
                    <dd>{r.user_display || "—"}</dd>
                  </div>
                  <div>
                    <dt>Клиент</dt>
                    <dd>{r.client_display || "—"}</dd>
                  </div>
                  <div className="sale__cardMetaRow--full">
                    <dt>Услуга</dt>
                    <dd>{r.service_display || "—"}</dd>
                  </div>
                  <div>
                    <dt>Тариф</dt>
                    <dd>{r.tariff_display || "—"}</dd>
                  </div>
                  {r.description ? (
                    <div className="sale__cardMetaRow--full">
                      <dt>Заметка</dt>
                      <dd>{r.description}</dd>
                    </div>
                  ) : null}
                </dl>
                <div className="sale__cardActions">
                  <button
                    className="sale__btn sale__btn--danger"
                    onClick={() => removeSale(r)}
                    title="Удалить продажу"
                    disabled={disabled}
                  >
                    <FaTrash /> Удалить
                  </button>
                </div>
              </article>
            ))
          ) : (
            <div className="sale__cardsEmpty">Пока нет продаж</div>
          )}
        </div>
      )}

      {/* ====== Модалка «Новая продажа» ====== */}
      {open && (
        <div
          className="sale__overlay"
          role="dialog"
          aria-modal="true"
          onClick={() => setOpen(false)}
        >
          <div className="sale__modal" onClick={(e) => e.stopPropagation()}>
            <div className="sale__modalHeader">
              <h3 className="sale__modalTitle">Новая продажа</h3>
              <button
                className="sale__iconBtn"
                onClick={() => setOpen(false)}
                aria-label="Закрыть"
              >
                <FaTimes />
              </button>
            </div>

            {!!formErr && (
              <div className="sale__alert sale__alert--error">{formErr}</div>
            )}

            <form className="sale__form" onSubmit={submitSale} noValidate>
              <div className="sale__grid">
                {/* Тип оплаты — НЕ менял */}
                <div className="sale__field">
                  <label className="sale__label">Тип оплаты *</label>
                  <select
                    className="sale__input"
                    value={dealStatus}
                    onChange={(e) => setDealStatus(e.target.value)}
                    required
                    disabled={disabled}
                  >
                    <option value="">Тип оплаты</option>
                    {DEAL_STATUS_RU?.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Клиент + Быстро создать */}
                <div className="sale__field">
                  <label className="sale__label">Клиент *</label>
                  <div className="sale__row">
                    <select
                      className="sale__input"
                      value={saleData.client}
                      name="client"
                      onChange={onChange}
                      required
                      disabled={disabled}
                    >
                      <option value="">Выберите клиента</option>
                      {clients.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.full_name || c.phone || `ID ${c.id}`}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      className="sale__btn sale__btn--secondary"
                      onClick={() => setCreateClientOpen((v) => !v)}
                      disabled={disabled}
                    >
                      <FaPlus /> Клиент
                    </button>
                  </div>
                </div>

                {dealStatus === "Долги" && (
                  <div className="sale__field sale__field--full">
                    <label className="sale__label">Срок долга</label>
                    <input
                      className="sale__input"
                      type="number"
                      min={1}
                      step={1}
                      value={debtMonths}
                      onChange={(e) => setDebtMonths(e.target.value)}
                      placeholder="Например, 6"
                    />
                  </div>
                )}
                {dealStatus === "Предоплата" && (
                  <>
                    <div className="sale__field sale__field--full">
                      <label className="sale__label">Предоплата</label>
                      <input
                        className="sale__input"
                        type="number"
                        min={1}
                        step={1}
                        value={prepayment}
                        onChange={(e) => setPrepayment(e.target.value)}
                        placeholder="Сумма предоплаты"
                      />
                    </div>
                    <div className="sale__field sale__field--full">
                      <label className="sale__label">
                        Срок долга
                      </label>
                      <input
                        className="sale__input"
                        type="number"
                        min={1}
                        step={1}
                        value={debtMonths}
                        onChange={(e) => setDebtMonths(e.target.value)}
                        placeholder="Например, 6"
                      />
                    </div>
                  </>
                )}

                <div className="sale__field sale__field--full">
                  <label className="sale__label">Касса *</label>
                </div>

                {/* Инлайн форма клиента */}
                {createClientOpen && (
                  <div className="sale__field sale__field--full">
                    <div className="sale__inlineCard">
                      <div className="sale__inlineGrid">
                        <div className="sale__field">
                          <label className="sale__label">Имя клиента *</label>
                          <input
                            className="sale__input"
                            value={newClient.full_name}
                            onChange={(e) =>
                              setNewClient((p) => ({
                                ...p,
                                full_name: e.target.value,
                              }))
                            }
                            maxLength={120}
                            required
                            disabled={disabled}
                          />
                        </div>
                        <div className="sale__field">
                          <label className="sale__label">Телефон</label>
                          <input
                            className="sale__input"
                            value={newClient.phone}
                            onChange={(e) =>
                              setNewClient((p) => ({
                                ...p,
                                phone: e.target.value,
                              }))
                            }
                            maxLength={40}
                            placeholder="+996700000000"
                            disabled={disabled}
                          />
                        </div>
                        <div className="sale__field">
                          <label className="sale__label">Почта</label>
                          <input
                            className="sale__input"
                            value={newClient.email}
                            onChange={(e) =>
                              setNewClient((p) => ({
                                ...p,
                                email: e.target.value,
                              }))
                            }
                            placeholder="example@gmail.com"
                            disabled={disabled}
                          />
                        </div>
                      </div>
                      <div className="sale__inlineActions">
                        <button
                          type="button"
                          className="sale__btn"
                          onClick={() => setCreateClientOpen(false)}
                          disabled={disabled}
                        >
                          Отмена
                        </button>
                        <button
                          type="button"
                          className="sale__btn sale__btn--primary"
                          onClick={submitCreateClient}
                          disabled={disabled}
                        >
                          Создать клиента
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                <div className="sale__field sale__field--full">
                  <label className="sale__label">Услуга *</label>
                  <select
                    className="sale__input"
                    value={serviceId}
                    onChange={(e) => setServiceId(e.target.value)}
                    required
                    disabled={disabled}
                  >
                    <option value="">Выберите услугу</option>
                    {services.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name ?? s.title}
                        {(s.tariffs || []).length
                          ? ` (${(s.tariffs || []).length} тариф.)`
                          : ` — ${money(s.price)}`}
                      </option>
                    ))}
                  </select>
                </div>

                {needsTariff && (
                  <div className="sale__field sale__field--full">
                    <label className="sale__label">Тариф *</label>
                    <select
                      className="sale__input"
                      value={tariffId}
                      onChange={(e) => setTariffId(e.target.value)}
                      required
                      disabled={disabled}
                    >
                      <option value="">Выберите тариф</option>
                      {serviceTariffs.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name} — {money(t.price)}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="sale__field sale__field--full">
                  <ExtraItemsEditor
                    items={extraItems}
                    onChange={setExtraItems}
                    disabled={disabled}
                  />
                </div>

                <div className="sale__field">
                  <label className="sale__label">Скидка, с</label>
                  <input
                    className="sale__input"
                    type="number"
                    min="0"
                    step="0.01"
                    value={discount}
                    onChange={(e) => setDiscount(e.target.value)}
                    disabled={disabled}
                  />
                </div>

                <div className="sale__field">
                  <label className="sale__label">Наценка, с</label>
                  <input
                    className="sale__input"
                    type="number"
                    min="0"
                    step="0.01"
                    value={markup}
                    onChange={(e) => setMarkup(e.target.value)}
                    disabled={disabled}
                  />
                </div>

                {selectedService && (
                  <div className="sale__field sale__field--full">
                    <div className="sale__totalPreview">
                      <span>Итого (превью):</span>
                      <strong>{money(previewTotal)}</strong>
                    </div>
                    {Number(selectedService.installation_price) > 0 && (
                      <p className="sale__hint">
                        Включая установку: {money(selectedService.installation_price)}
                      </p>
                    )}
                  </div>
                )}

                {/* Заметка (опционально) */}
                <div className="sale__field sale__field--full">
                  <label className="sale__label">Заметка</label>
                  <textarea
                    className="sale__input"
                    rows={3}
                    placeholder="Комментарий к продаже (необязательно)"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    disabled={disabled}
                  />
                </div>
              </div>

              <div className="sale__actions">
                <button
                  type="button"
                  className="sale__btn"
                  onClick={() => setOpen(false)}
                  disabled={disabled}
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  className="sale__btn sale__btn--primary"
                  disabled={!canCreate || disabled}
                >
                  Продать
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}
