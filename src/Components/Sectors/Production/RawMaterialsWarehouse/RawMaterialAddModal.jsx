import { useEffect, useMemo, useState } from "react";
import { useDispatch } from "react-redux";
import {
  ArrowRight,
  Package,
  Scissors,
  Sparkles,
  X,
} from "lucide-react";
import { createItemMake } from "../../../../store/creators/productCreators";
import {
  createClientAsync,
  fetchClientsAsync,
} from "../../../../store/creators/clientCreators";
import { createDeal } from "../../../../store/creators/saleThunk";
import { addCashFlows } from "../../../../store/slices/cashSlice";
import { useUser } from "../../../../store/slices/userSlice";
import { useClient } from "../../../../store/slices/ClientSlice";
import api from "../../../../api";
import { toDecimal2 } from "../itemMakeHelpers";
import {
  useAlert,
  useErrorModal,
} from "../../../../hooks/useDialog";
import { validateResErrors } from "../../../../../tools/validateResErrors";
import "./RawMaterialAddModal.scss";

const UNIT_PRESETS = ["кг", "г", "л", "шт."];

const getTodayIsoDate = () => new Date().toISOString().split("T")[0];

const RawMaterialAddModal = ({ onClose, selectCashBox, onSaved }) => {
  const alert = useAlert();
  const error = useErrorModal();
  const dispatch = useDispatch();
  const { company } = useUser();
  const { list: clients = [] } = useClient();

  const [state, setState] = useState({
    name: "",
    price: "",
    quantity: "",
    unit: "кг",
    client: "",
    needs_processing: false,
  });
  const [paymentType, setPaymentType] = useState("full");
  const [debtMonths, setDebtMonths] = useState("1");
  const [prepayment, setPrepayment] = useState("");
  const [firstPaymentDate, setFirstPaymentDate] = useState(getTodayIsoDate());
  const [showSupplierForm, setShowSupplierForm] = useState(false);
  const [creatingSupplier, setCreatingSupplier] = useState(false);
  const [showPayment, setShowPayment] = useState(false);
  const [saving, setSaving] = useState(false);
  const [supplierForm, setSupplierForm] = useState({
    full_name: "",
    phone: "",
    email: "",
    date: getTodayIsoDate(),
    type: "suppliers",
    llc: "",
    inn: "",
    okpo: "",
    score: "",
    bik: "",
    address: "",
  });
  const [cashData, setCashData] = useState({
    cashbox: "",
    type: "expense",
    name: "",
    amount: "",
    source_cashbox_flow_id: "",
    source_business_operation_id: "Сырье",
    status:
      company?.subscription_plan?.name === "Старт" ? "approved" : "pending",
  });

  const suppliers = useMemo(
    () =>
      (Array.isArray(clients) ? clients : []).filter(
        (c) => c.type === "suppliers",
      ),
    [clients],
  );
  const selectedSupplier = useMemo(
    () => suppliers.find((s) => String(s.id) === String(state.client)),
    [suppliers, state.client],
  );

  const totalAmount = useMemo(
    () => (Number(state.price) || 0) * (Number(state.quantity) || 0),
    [state.price, state.quantity],
  );

  const nextStepLabel = useMemo(() => {
    if (state.needs_processing) {
      return "Попадёт в очередь «Обработать», затем — в рецепт";
    }
    return "Можно сразу добавить в рецепт готовой продукции";
  }, [state.needs_processing]);

  const onChange = (e) => {
    const { name, value, type, checked } = e.target;
    setState((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const setProcessingMode = (needsProcessing) => {
    setState((prev) => ({ ...prev, needs_processing: needsProcessing }));
  };

  const onSupplierFormChange = (e) => {
    const { name, value } = e.target;
    setSupplierForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleCreateSupplier = async () => {
    if (!supplierForm.full_name?.trim()) {
      error("Укажите ФИО или название поставщика");
      return;
    }
    setCreatingSupplier(true);
    try {
      const created = await dispatch(createClientAsync(supplierForm)).unwrap();
      const newId = created?.id ?? created?.uuid;
      await dispatch(fetchClientsAsync()).unwrap();
      if (newId != null) {
        setState((prev) => ({ ...prev, client: String(newId) }));
      }
      setSupplierForm({
        full_name: "",
        phone: "",
        email: "",
        date: getTodayIsoDate(),
        type: "suppliers",
        llc: "",
        inn: "",
        okpo: "",
        score: "",
        bik: "",
        address: "",
      });
      setShowSupplierForm(false);
      setShowPayment(true);
      alert("Поставщик создан", () => {});
    } catch (err) {
      error(validateResErrors(err, "Не удалось создать поставщика"));
    } finally {
      setCreatingSupplier(false);
    }
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (paymentType === "debt" || paymentType === "prepayment") {
        if (!state.client) {
          error("Выберите поставщика для этой операции");
          setSaving(false);
          return;
        }
        if (!debtMonths || Number(debtMonths) <= 0) {
          error("Введите корректный срок долга");
          setSaving(false);
          return;
        }
        if (!firstPaymentDate) {
          error("Укажите дату первой оплаты");
          setSaving(false);
          return;
        }
      }
      if (paymentType === "prepayment") {
        const prepaymentValue = Number(prepayment || 0);
        if (!prepaymentValue || prepaymentValue <= 0) {
          error("Введите корректную сумму предоплаты");
          setSaving(false);
          return;
        }
        if (prepaymentValue > totalAmount) {
          error("Сумма предоплаты не может превышать общую сумму");
          setSaving(false);
          return;
        }
      }

      const result = await dispatch(
        createItemMake({ ...state, payment_type: paymentType }),
      ).unwrap();

      if (
        (paymentType === "debt" || paymentType === "prepayment") &&
        state.client
      ) {
        const prepaymentValue = Number(prepayment || 0);
        const remainingDebt =
          paymentType === "prepayment"
            ? Math.max(0, totalAmount - prepaymentValue)
            : totalAmount;

        if (company?.subscription_plan?.name === "Старт" && remainingDebt > 0) {
          await api.post("/main/debts/", {
            name:
              selectedSupplier?.full_name ||
              selectedSupplier?.name ||
              "Поставщик",
            phone: selectedSupplier?.phone || "",
            due_date: firstPaymentDate,
            amount: remainingDebt,
          });
        }

        await dispatch(
          createDeal({
            clientId: state.client,
            title: `${paymentType === "prepayment" ? "Предоплата" : "Долг"} ${selectedSupplier?.full_name || state.name || "Поставщик"}`,
            statusRu: paymentType === "prepayment" ? "Предоплата" : "Долги",
            amount: totalAmount,
            debtMonths: Number(debtMonths || 1),
            prepayment:
              paymentType === "prepayment" ? prepaymentValue : undefined,
            first_due_date: firstPaymentDate,
          }),
        ).unwrap();
      }

      if (paymentType !== "debt") {
        await dispatch(
          addCashFlows({
            ...cashData,
            amount:
              paymentType === "prepayment"
                ? Number(prepayment || 0)
                : totalAmount,
            source_cashbox_flow_id: result.id,
          }),
        ).unwrap();
      }

      alert("Сырьё добавлено на склад!", () => {
        onSaved?.();
        onClose();
      });
    } catch (err) {
      error(validateResErrors(err, "Ошибка при добавлении сырья"));
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    setCashData((prev) => ({
      ...prev,
      cashbox: selectCashBox,
      name: state.name,
      amount: state.price,
    }));
  }, [state, selectCashBox]);

  useEffect(() => {
    dispatch(fetchClientsAsync());
  }, [dispatch]);

  useEffect(() => {
    if (state.client) setShowPayment(true);
  }, [state.client]);

  return (
    <div className="raw-add-modal">
      <div className="raw-add-modal__overlay" onClick={onClose} />
      <form className="raw-add-modal__dialog" onSubmit={onSubmit}>
        <header className="raw-add-modal__header">
          <div className="raw-add-modal__title-row">
            <div className="raw-add-modal__icon">
              <Package size={22} />
            </div>
            <div>
              <h2 className="raw-add-modal__title">Оприходование сырья</h2>
              <p className="raw-add-modal__subtitle">
                Закупка на склад производства
              </p>
            </div>
          </div>
          <button
            type="button"
            className="raw-add-modal__close"
            onClick={onClose}
            aria-label="Закрыть"
          >
            <X size={20} />
          </button>
        </header>

        <div className="raw-add-modal__flow">
          <div className="raw-add-modal__flow-step raw-add-modal__flow-step--active">
            <span>1. Склад</span>
            <strong>{state.name || "Новая позиция"}</strong>
          </div>
          <div className="raw-add-modal__flow-arrow">
            <ArrowRight size={18} />
          </div>
          <div
            className={`raw-add-modal__flow-step ${
              state.needs_processing ? "raw-add-modal__flow-step--warn" : ""
            }`}
          >
            <span>2. Дальше</span>
            <strong>
              {state.needs_processing ? "Обработка" : "В рецепт"}
            </strong>
          </div>
          <div className="raw-add-modal__flow-arrow">
            <ArrowRight size={18} />
          </div>
          <div className="raw-add-modal__flow-step raw-add-modal__flow-step--done">
            <span>3. Использование</span>
            <strong>Готовая продукция</strong>
          </div>
        </div>

        <div className="raw-add-modal__body">
          <div className="raw-add-modal__main">
            <section className="raw-add-card">
              <div className="raw-add-card__head">
                <span className="raw-add-step">1</span>
                <h3>Что оприходуем</h3>
              </div>
              <label className="raw-add-field">
                <span>Название *</span>
                <input
                  name="name"
                  value={state.name}
                  onChange={onChange}
                  required
                  placeholder="Например, картошка или соль"
                  autoFocus
                />
              </label>
              <label className="raw-add-field">
                <span>Единица измерения *</span>
                <div className="raw-add-units">
                  {UNIT_PRESETS.map((u) => (
                    <button
                      key={u}
                      type="button"
                      className={`raw-add-units__btn ${
                        state.unit === u ? "is-active" : ""
                      }`}
                      onClick={() =>
                        setState((prev) => ({ ...prev, unit: u }))
                      }
                    >
                      {u}
                    </button>
                  ))}
                </div>
                <input
                  name="unit"
                  value={state.unit}
                  onChange={onChange}
                  required
                  placeholder="или своя единица"
                />
              </label>
            </section>

            <section className="raw-add-card raw-add-card--accent">
              <div className="raw-add-card__head">
                <span className="raw-add-step">2</span>
                <h3>Количество и цена закупки</h3>
              </div>
              <p className="raw-add-hint">
                Укажите, сколько закупили и по какой цене за{" "}
                {state.unit || "ед."}.
              </p>
              <div className="raw-add-grid-2">
                <label className="raw-add-field">
                  <span>Количество *</span>
                  <input
                    name="quantity"
                    type="number"
                    min="0"
                    step="0.001"
                    value={state.quantity}
                    onChange={onChange}
                    required
                    placeholder="100"
                  />
                </label>
                <label className="raw-add-field">
                  <span>Цена за {state.unit || "ед."} *</span>
                  <input
                    name="price"
                    type="number"
                    min="0"
                    step="0.01"
                    value={state.price}
                    onChange={onChange}
                    required
                    placeholder="45.00"
                  />
                </label>
              </div>
            </section>

            <section className="raw-add-card">
              <div className="raw-add-card__head">
                <span className="raw-add-step">3</span>
                <h3>Как будете использовать</h3>
              </div>
              <p className="raw-add-hint">
                Выберите путь сырья после оприходования — это важно для рецепта
                и обработки.
              </p>
              <div className="raw-add-path">
                <button
                  type="button"
                  className={`raw-add-path__option ${
                    state.needs_processing ? "is-active" : ""
                  }`}
                  onClick={() => setProcessingMode(true)}
                >
                  <Scissors size={20} />
                  <div>
                    <strong>Нужна обработка</strong>
                    <p>Картошка, мясо — сначала «Обработать», потом рецепт</p>
                  </div>
                </button>
                <button
                  type="button"
                  className={`raw-add-path__option ${
                    !state.needs_processing ? "is-active" : ""
                  }`}
                  onClick={() => setProcessingMode(false)}
                >
                  <Sparkles size={20} />
                  <div>
                    <strong>Сразу в рецепт</strong>
                    <p>Соль, мука, специи — без этапа обработки</p>
                  </div>
                </button>
              </div>
              <p className="raw-add-path__result">{nextStepLabel}</p>
            </section>

            <section className="raw-add-card raw-add-card--collapsible">
              <button
                type="button"
                className="raw-add-card__toggle"
                onClick={() => setShowPayment((v) => !v)}
              >
                <span className="raw-add-step">4</span>
                <span>
                  Поставщик и оплата
                  <small>необязательно</small>
                </span>
                <span className="raw-add-card__toggle-icon">
                  {showPayment ? "−" : "+"}
                </span>
              </button>

              {showPayment && (
                <div className="raw-add-card__collapse">
                  <label className="raw-add-field">
                    <span>Поставщик</span>
                    <select
                      name="client"
                      value={state.client}
                      onChange={onChange}
                    >
                      <option value="">— Без поставщика —</option>
                      {suppliers.map((supplier) => (
                        <option key={supplier.id} value={supplier.id}>
                          {supplier.full_name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button
                    type="button"
                    className="raw-add-link-btn"
                    onClick={() => setShowSupplierForm((v) => !v)}
                  >
                    {showSupplierForm ? "Скрыть форму" : "+ Новый поставщик"}
                  </button>

                  {showSupplierForm && (
                    <div className="raw-add-supplier-form">
                      <input
                        onChange={onSupplierFormChange}
                        type="text"
                        placeholder="ФИО или название *"
                        name="full_name"
                        value={supplierForm.full_name}
                      />
                      <input
                        onChange={onSupplierFormChange}
                        type="text"
                        name="phone"
                        placeholder="Телефон"
                        value={supplierForm.phone}
                      />
                      <input
                        onChange={onSupplierFormChange}
                        type="email"
                        name="email"
                        placeholder="Почта"
                        value={supplierForm.email}
                      />
                      <div className="raw-add-supplier-form__actions">
                        <button
                          type="button"
                          className="raw-add-btn raw-add-btn--ghost"
                          onClick={() => setShowSupplierForm(false)}
                          disabled={creatingSupplier}
                        >
                          Отмена
                        </button>
                        <button
                          type="button"
                          className="raw-add-btn raw-add-btn--primary"
                          onClick={handleCreateSupplier}
                          disabled={creatingSupplier}
                        >
                          {creatingSupplier ? "Создание…" : "Создать"}
                        </button>
                      </div>
                    </div>
                  )}

                  {!!state.client && (
                    <>
                      <label className="raw-add-field">
                        <span>Тип оплаты</span>
                        <select
                          value={paymentType}
                          onChange={(e) => setPaymentType(e.target.value)}
                        >
                          <option value="full">Полная оплата</option>
                          <option value="prepayment">Предоплата</option>
                          <option value="debt">В долг</option>
                        </select>
                      </label>

                      {(paymentType === "debt" ||
                        paymentType === "prepayment") && (
                        <>
                          {paymentType === "prepayment" && (
                            <label className="raw-add-field">
                              <span>Сумма предоплаты *</span>
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={prepayment}
                                onChange={(e) => setPrepayment(e.target.value)}
                              />
                            </label>
                          )}
                          <label className="raw-add-field">
                            <span>Срок долга (мес.) *</span>
                            <input
                              type="number"
                              min="1"
                              step="1"
                              value={debtMonths}
                              onChange={(e) => setDebtMonths(e.target.value)}
                            />
                          </label>
                          <label className="raw-add-field">
                            <span>Дата первой оплаты *</span>
                            <input
                              type="date"
                              value={firstPaymentDate}
                              onChange={(e) =>
                                setFirstPaymentDate(e.target.value)
                              }
                            />
                          </label>
                        </>
                      )}
                    </>
                  )}
                </div>
              )}
            </section>
          </div>

          <aside className="raw-add-summary">
            <h3>Итог оприходования</h3>
            <ul>
              <li>
                <span>Позиция</span>
                <strong>{state.name || "—"}</strong>
              </li>
              <li>
                <span>Количество</span>
                <strong>
                  {state.quantity || "—"} {state.unit || ""}
                </strong>
              </li>
              <li>
                <span>Цена</span>
                <strong>
                  {state.price ? `${toDecimal2(state.price)} сом` : "—"}
                </strong>
              </li>
              <li className="raw-add-summary__total">
                <span>Сумма закупки</span>
                <strong>{toDecimal2(totalAmount)} сом</strong>
              </li>
            </ul>
            <p className="raw-add-summary__note">{nextStepLabel}</p>
            <div className="raw-add-summary__actions">
              <button
                type="button"
                className="raw-add-btn raw-add-btn--ghost-dark"
                onClick={onClose}
                disabled={saving}
              >
                Отмена
              </button>
              <button
                type="submit"
                className="raw-add-btn raw-add-btn--primary"
                disabled={saving}
              >
                {saving ? "Сохранение…" : "Оприходовать на склад"}
              </button>
            </div>
          </aside>
        </div>
      </form>
    </div>
  );
};

export default RawMaterialAddModal;
