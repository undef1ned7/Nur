import { useCallback, useEffect, useMemo, useState } from "react";
import { useDispatch } from "react-redux";
import { X } from "lucide-react";
import {
  addCashFlows,
  getCashBoxes,
  useCash,
} from "../../../../store/slices/cashSlice";
import { useUser } from "../../../../store/slices/userSlice";
import { fetchClientsAsync } from "../../../../store/creators/clientCreators";
import { createDeal } from "../../../../store/creators/saleThunk";
import { useClient } from "../../../../store/slices/ClientSlice";
import api from "../../../../api";
import {
  updateItemsMake,
  updateProductAsync,
} from "../../../../store/creators/productCreators";
import { useAlert } from "../../../../hooks/useDialog";
import { validateResErrors } from "../../../../../tools/validateResErrors";

const toNum = (v) => {
  const n = Number(String(v ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};
const getTodayIsoDate = () => new Date().toISOString().split("T")[0];

const AddRawMaterials = ({ onClose, onChanged, item }) => {
  const alert = useAlert();
  const dispatch = useDispatch();
  const { list: cashBoxes } = useCash();
  const { company } = useUser();
  const { list: clients = [] } = useClient();

  // если item не передан — блокируем форму
  const { itemId, itemName } = useMemo(() => ({ itemId: item.id, itemName: item.name }), [item]);
  const [qty, setQty] = useState("");
  // const [purchasePrice, setPurchasePrice] = useState(
  //   item?.purchase_price != null ? String(item.purchase_price) : ""
  // );
  const [retailPrice, setRetailPrice] = useState(
    item?.price != null ? String(item.price) : ""
  );
  const [selectCashBox, setSelectCashBox] = useState("");
  const [error, setError] = useState("");
  const [supplierId, setSupplierId] = useState("");
  const [paymentType, setPaymentType] = useState("full");
  const [debtMonths, setDebtMonths] = useState("1");
  const [prepayment, setPrepayment] = useState("");
  const [firstPaymentDate, setFirstPaymentDate] = useState(getTodayIsoDate());

  const stockQty = useMemo(() => toNum(item?.quantity), [item]);
  const { q, rp } = useMemo(() => ({ q: toNum(qty), rp: toNum(retailPrice) }), [qty, retailPrice]);
  const expense = useMemo(() => +(q * rp).toFixed(2), [q, rp]);
  const suppliers = useMemo(
    () => (Array.isArray(clients) ? clients : []).filter((c) => c.type === "suppliers"),
    [clients],
  );
  const selectedSupplier = useMemo(
    () => suppliers.find((s) => String(s.id) === String(supplierId)),
    [suppliers, supplierId],
  );

  useEffect(() => {
    dispatch(getCashBoxes());
    dispatch(fetchClientsAsync());
  }, [dispatch]);

  // Автоматически выбираем первую кассу по индексу
  useEffect(() => {
    if (cashBoxes && cashBoxes.length > 0 && !selectCashBox) {
      const firstCashBox = cashBoxes[0];
      const firstCashBoxId = firstCashBox?.id || firstCashBox?.uuid || "";
      if (firstCashBoxId) {
        setSelectCashBox(firstCashBoxId);
      }
    }
  }, [cashBoxes, selectCashBox]);

  const validate = useCallback(() => {
    if (!itemId) return "Нет выбранного товара.";
    if (!q) return "Введите количество";
    if (q <= 0) return "Количество должно быть больше 0";
    if (!Number.isInteger(q)) return "Количество должно быть целым числом";
    // if (!pp || pp <= 0) return "Введите корректную закупочную цену";
    if (!rp || rp <= 0) return "Введите корректную цену";
    if ((paymentType === "debt" || paymentType === "prepayment") && !supplierId) {
      return "Выберите поставщика";
    }
    if ((paymentType === "debt" || paymentType === "prepayment") && (!debtMonths || Number(debtMonths) <= 0)) {
      return "Укажите срок долга";
    }
    if ((paymentType === "debt" || paymentType === "prepayment") && !firstPaymentDate) {
      return "Укажите дату первой оплаты";
    }
    if (paymentType === "prepayment") {
      const prepaymentValue = toNum(prepayment);
      if (prepaymentValue <= 0) return "Укажите сумму предоплаты";
      if (prepaymentValue > expense) return "Предоплата не может быть больше общей суммы";
    }
    // Проверяем кассу только если кассы уже загружены (не undefined) и есть, но касса не выбрана
    // Если кассы еще загружаются (cashBoxes undefined), не блокируем кнопку
    if (paymentType !== "debt" && Array.isArray(cashBoxes) && cashBoxes.length > 0 && !selectCashBox) {
      return "Касса не выбрана. Создайте кассу в разделе «Кассы».";
    }
    if (paymentType !== "debt" && Array.isArray(cashBoxes) && cashBoxes.length === 0) {
      return "Нет доступных касс. Создайте кассу в разделе «Кассы».";
    }
    return "";
  }, [itemId, q, rp, cashBoxes, selectCashBox, paymentType, supplierId, debtMonths, prepayment, expense, firstPaymentDate]);

  const onFormSubmit = async (e) => {
    e.preventDefault();
    const err = validate();
    if (err) {
      setError(err);
      return;
    }

    // Дополнительная проверка кассы перед выполнением операции
    if (paymentType !== "debt" && !selectCashBox) {
      setError("Касса не выбрана. Создайте кассу в разделе «Кассы».");
      return;
    }
    setError("");

    try {
      // обновляем существующий товар: увеличиваем остаток и цены
      await dispatch(
        updateItemsMake({
          id: itemId,
          updatedData: {
            quantity: stockQty + q,
            // purchase_price: pp,
            price: rp,
          },
        })
      ).unwrap();

      if ((paymentType === "debt" || paymentType === "prepayment") && supplierId) {
        const prepaymentValue = toNum(prepayment);
        const remainingDebt =
          paymentType === "prepayment" ? Math.max(0, expense - prepaymentValue) : expense;

        if (company?.subscription_plan?.name === "Старт" && remainingDebt > 0) {
          await api.post("/main/debts/", {
            name: selectedSupplier?.full_name || selectedSupplier?.name || "Поставщик",
            phone: selectedSupplier?.phone || "",
            due_date: firstPaymentDate,
            amount: remainingDebt,
          });
        }

        await dispatch(
          createDeal({
            clientId: supplierId,
            title: `${paymentType === "prepayment" ? "Предоплата" : "Долги"} ${selectedSupplier?.full_name || itemName}`,
            statusRu: paymentType === "prepayment" ? "Предоплата" : "Долги",
            amount: expense,
            prepayment: paymentType === "prepayment" ? prepaymentValue : undefined,
            debtMonths: Number(debtMonths || 1),
            first_due_date: firstPaymentDate,
          }),
        ).unwrap();
      }

      if (paymentType !== "debt") {
        await dispatch(
          addCashFlows({
            cashbox: selectCashBox,
            type: "expense",
            name: `Закупка товара: ${itemName}`,
            amount: paymentType === "prepayment" ? toNum(prepayment) : expense,
            status:
              company?.subscription_plan?.name === "Старт"
                ? "approved"
                : "pending",
          })
        ).unwrap();
      }
      alert('Товар добавлен!', () => {
        onChanged?.();
        onClose?.();
      })
    } catch (e) {
      const errorMessage = validateResErrors(e, "Ошибка при добавлении товара");
      alert(errorMessage, true)
    }
  };
  const disabled = !!validate();

  return (
    <div className="add-modal z-50!">
      <div className="add-modal__overlay z-50!" onClick={onClose} />
      <div className="add-modal__content z-50!" style={{ height: "auto" }}>
        <div className="add-modal__header">
          <h3>Добавление товара</h3>
          <X className="add-modal__close-icon" size={20} onClick={onClose} />
        </div>

        <form onSubmit={onFormSubmit}>
          <h4>Товар: <span className="font-medium">{itemName}</span></h4>
          {!!itemId && (
            <div className="border rounded-lg p-2" style={{ marginTop: 8, opacity: 0.8 }}>
              В наличии сейчас: <b>{stockQty}</b> шт.
            </div>
          )}

          <label htmlFor="" style={{ margin: "10px 0 5px", display: "block" }}>
            Количество
          </label>

          <input
            style={{ width: "100%" }}
            type="number"
            name="qty"
            placeholder="Количество"
            className=" border rounded-lg p-2"
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            min={1}
            step={1}
            disabled={!itemId}
          />

          <label htmlFor="" style={{ margin: "10px 0 5px", display: "block" }}>
            Цена
          </label>

          <input
            style={{ width: "100%" }}
            type="number"
            name="retailPrice"
            placeholder="Розничная цена (за 1 шт.)"
            className="border rounded-lg p-2"
            value={retailPrice}
            onChange={(e) => setRetailPrice(e.target.value)}
            min={0}
            step="0.01"
            disabled={!itemId}
          />

          <label htmlFor="" style={{ margin: "10px 0 5px", display: "block" }}>
            Поставщик
          </label>
          <select
            style={{ width: "100%" }}
            className="border rounded-lg p-2"
            value={supplierId}
            onChange={(e) => setSupplierId(e.target.value)}
          >
            <option value="">-- Выберите поставщика --</option>
            {suppliers.map((supplier) => (
              <option key={supplier.id} value={supplier.id}>
                {supplier.full_name}
              </option>
            ))}
          </select>

          {!!supplierId && (
            <>
              <label htmlFor="" style={{ margin: "10px 0 5px", display: "block" }}>
                Тип оплаты
              </label>
              <select
                style={{ width: "100%" }}
                className="border rounded-lg p-2"
                value={paymentType}
                onChange={(e) => setPaymentType(e.target.value)}
              >
                <option value="full">Полная оплата</option>
                <option value="prepayment">Предоплата</option>
                <option value="debt">В долг</option>
              </select>

              {(paymentType === "debt" || paymentType === "prepayment") && (
                <>
                  {paymentType === "prepayment" && (
                    <>
                      <label htmlFor="" style={{ margin: "10px 0 5px", display: "block" }}>
                        Предоплата
                      </label>
                      <input
                        style={{ width: "100%" }}
                        type="number"
                        className="border rounded-lg p-2"
                        value={prepayment}
                        onChange={(e) => setPrepayment(e.target.value)}
                        min={0}
                        step="0.01"
                      />
                    </>
                  )}

                  <label htmlFor="" style={{ margin: "10px 0 5px", display: "block" }}>
                    Срок долга (мес.)
                  </label>
                  <input
                    style={{ width: "100%" }}
                    type="number"
                    className="border rounded-lg p-2"
                    value={debtMonths}
                    onChange={(e) => setDebtMonths(e.target.value)}
                    min={1}
                    step={1}
                  />

                  <label htmlFor="" style={{ margin: "10px 0 5px", display: "block" }}>
                    Дата первой оплаты
                  </label>
                  <input
                    style={{ width: "100%" }}
                    type="date"
                    className="border rounded-lg p-2"
                    value={firstPaymentDate}
                    onChange={(e) => setFirstPaymentDate(e.target.value)}
                  />
                </>
              )}
            </>
          )}

          {/* касса автоматически выбирается - скрыто от пользователя */}

          <div style={{ marginTop: 12 }}>
            Итог к списанию: <b>{Number.isFinite(paymentType === "prepayment" ? toNum(prepayment) : expense) ? (paymentType === "prepayment" ? toNum(prepayment) : expense) : 0}</b>
          </div>

          {error && (
            <div
              style={{
                marginTop: 10,
                color: "#c0392b",
                fontSize: 14,
                lineHeight: 1.3,
              }}
            >
              {error}
            </div>
          )}

          <button
            style={{ marginTop: 15, width: "100%", justifyContent: "center" }}
            className="btn edit-btn py-2! text-lg!"
            type="submit"
            disabled={disabled}
          >
            Сохранить
          </button>
        </form>
      </div>
    </div>
  );
};

export default AddRawMaterials;
