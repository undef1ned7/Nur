import { useEffect, useMemo, useState } from "react";
import { useDispatch } from "react-redux";
import { X } from "lucide-react";
import {
  addCashFlows,
  getCashBoxes,
  useCash,
} from "../../../../store/slices/cashSlice";
import { useUser } from "../../../../store/slices/userSlice";
import { updateProductAsync } from "../../../../store/creators/productCreators";

const toNum = (v) => {
  const n = Number(String(v ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};

const AddProductModal = ({ onClose, onChanged, item }) => {
  const dispatch = useDispatch();
  const { list: cashBoxes } = useCash();
  const { company } = useUser();

  // если item не передан — блокируем форму
  const itemId = item?.id;
  const itemName = item?.name ?? "—";

  const [qty, setQty] = useState("");
  const [purchasePrice, setPurchasePrice] = useState(
    item?.purchase_price != null ? String(item.purchase_price) : ""
  );
  const [retailPrice, setRetailPrice] = useState(
    item?.price != null ? String(item.price) : ""
  );
  const [selectCashBox, setSelectCashBox] = useState("");
  const [error, setError] = useState("");

  const stockQty = useMemo(() => toNum(item?.quantity), [item]);

  const q = toNum(qty);
  const pp = toNum(purchasePrice);
  const rp = toNum(retailPrice);

  const expense = useMemo(() => +(q * pp).toFixed(2), [q, pp]);

  useEffect(() => {
    dispatch(getCashBoxes());
  }, [dispatch]);

  const validate = () => {
    if (!itemId) return "Нет выбранного товара.";
    if (!q) return "Введите количество";
    if (q <= 0) return "Количество должно быть больше 0";
    if (!Number.isInteger(q)) return "Количество должно быть целым числом";
    if (!pp || pp <= 0) return "Введите корректную закупочную цену";
    if (!rp || rp <= 0) return "Введите корректную розничную цену";
    if (!selectCashBox) return "Выберите кассу для списания закупки";
    return "";
  };

  const onFormSubmit = async (e) => {
    e.preventDefault();
    const err = validate();
    if (err) {
      setError(err);
      return;
    }
    setError("");

    try {
      // обновляем существующий товар: увеличиваем остаток и цены
      await dispatch(
        updateProductAsync({
          productId: itemId,
          updatedData: {
            quantity: stockQty + q,
            purchase_price: pp,
            price: rp,
          },
        })
      ).unwrap();

      // списываем расход из кассы (закупка по себестоимости)
      await dispatch(
        addCashFlows({
          cashbox: selectCashBox,
          type: "expense",
          name: `Закупка товара: ${itemName}`,
          amount: expense,
          status:
            company?.subscription_plan?.name === "Старт"
              ? "approved"
              : "pending",
          // description: `Закупка ${q} шт. × ${pp} = ${expense}`,
        })
      ).unwrap();

      onChanged?.();
      onClose?.();
    } catch (e) {
      console.log(e);
      setError("Не удалось сохранить. Попробуйте ещё раз.");
    }
  };

  const disabled = !!validate();

  return (
    <div className="add-modal">
      <div className="add-modal__overlay" onClick={onClose} />
      <div className="add-modal__content" style={{ height: "auto" }}>
        <div className="add-modal__header">
          <h3>Добавление товара</h3>
          <X className="add-modal__close-icon" size={20} onClick={onClose} />
        </div>

        <form onSubmit={onFormSubmit}>
          <h4>Товар: {itemName}</h4>
          {!!itemId && (
            <div style={{ marginTop: 8, opacity: 0.8 }}>
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
            className="debt__input"
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            min={1}
            step={1}
            disabled={!itemId}
          />

          <label htmlFor="" style={{ margin: "10px 0 5px", display: "block" }}>
            Закупочная цена
          </label>

          <input
            style={{ width: "100%" }}
            type="number"
            name="purchasePrice"
            placeholder="Закупочная цена (за 1 шт.)"
            className="debt__input"
            value={purchasePrice}
            onChange={(e) => setPurchasePrice(e.target.value)}
            min={0}
            step="0.01"
            disabled={!itemId}
          />

          <label htmlFor="" style={{ margin: "10px 0 5px", display: "block" }}>
            Розничная цена
          </label>

          <input
            style={{ width: "100%" }}
            type="number"
            name="retailPrice"
            placeholder="Розничная цена (за 1 шт.)"
            className="debt__input"
            value={retailPrice}
            onChange={(e) => setRetailPrice(e.target.value)}
            min={0}
            step="0.01"
            disabled={!itemId}
          />

          <label htmlFor="" style={{ margin: "10px 0 5px", display: "block" }}>
            Касса
          </label>

          <select
            style={{ width: "100%" }}
            value={selectCashBox}
            onChange={(e) => setSelectCashBox(e.target.value)}
            className="debt__input"
            disabled={!itemId}
          >
            <option value="">Выберите кассу (для списания закупки)</option>
            {cashBoxes?.map((cash) => (
              <option key={cash.id} value={cash.id}>
                {cash.name ?? cash.department_name}
              </option>
            ))}
          </select>

          <div style={{ marginTop: 12 }}>
            Итог к списанию: <b>{Number.isFinite(expense) ? expense : 0}</b>
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
            className="btn edit-btn"
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

export default AddProductModal;
