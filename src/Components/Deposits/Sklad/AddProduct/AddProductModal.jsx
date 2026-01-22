import { useEffect, useMemo, useState } from "react";
import { useDispatch } from "react-redux";
import { X } from "lucide-react";
import {
  addCashFlows,
  getCashBoxes,
  useCash,
} from "../../../../store/slices/cashSlice";
import { useUser } from "../../../../store/slices/userSlice";
import { useClient } from "../../../../store/slices/ClientSlice";
import { fetchClientsAsync } from "../../../../store/creators/clientCreators";
import { updateProductAsync } from "../../../../store/creators/productCreators";
import { useAlert, useConfirm } from "../../../../hooks/useDialog";

const toNum = (v) => {
  const n = Number(String(v ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};

const AddProductModal = ({ onClose, onChanged, item }) => {
  const alert = useAlert();
  const confirm = useConfirm()
  const dispatch = useDispatch();
  const { list: cashBoxes } = useCash();
  const { company } = useUser();
  const { list: clients } = useClient();

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
  const [selectedSupplier, setSelectedSupplier] = useState(
    item?.client || ""
  );
  const [error, setError] = useState("");

  // Фильтруем поставщиков из списка клиентов
  const suppliers = useMemo(
    () => clients.filter((client) => client.type === "suppliers"),
    [clients]
  );

  const stockQty = useMemo(() => toNum(item?.quantity), [item]);

  const q = toNum(qty);
  const pp = toNum(purchasePrice);
  const rp = toNum(retailPrice);

  const expense = useMemo(() => +(q * pp).toFixed(2), [q, pp]);

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

  const validate = () => {
    if (!itemId) return "Нет выбранного товара.";
    if (!q) return "Введите количество";
    if (q <= 0) return "Количество должно быть больше 0";
    if (!Number.isInteger(q)) return "Количество должно быть целым числом";
    if (!pp || pp <= 0) return "Введите корректную закупочную цену";
    if (!rp || rp <= 0) return "Введите корректную розничную цену";
    // Проверяем кассу только если кассы уже загружены (не undefined) и есть, но касса не выбрана
    // Если кассы еще загружаются (cashBoxes undefined), не блокируем кнопку
    if (Array.isArray(cashBoxes) && cashBoxes.length > 0 && !selectCashBox) {
      return "Касса не выбрана. Создайте кассу в разделе «Кассы».";
    }
    if (Array.isArray(cashBoxes) && cashBoxes.length === 0) {
      return "Нет доступных касс. Создайте кассу в разделе «Кассы».";
    }
    return "";
  };

  const onFormSubmit = async (e) => {
    e.preventDefault();
    const err = validate();
    if (err) {
      setError(err);
      return;
    }

    // Дополнительная проверка кассы перед выполнением операции
    if (!selectCashBox) {
      alert("Касса не выбрана. Создайте кассу в разделе «Кассы».", true)
      setError("Касса не выбрана. Создайте кассу в разделе «Кассы».");
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
            client: selectedSupplier || null,
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
      alert('Товар добавлен', () => {
        onChanged?.();
        onClose?.();
      })
    } catch (e) {
      console.log(e);
      alert("Не удалось сохранить. Попробуйте ещё раз.", true)
    }
  };

  const disabled = !!validate();

  return (
    <div className="add-modal z-50!">
      <div className="add-modal__overlay z-50!" onClick={onClose} />
      <div className="add-modal__content z-50!" style={{ height: "auto" }}>
        <div className="add-modal__header ">
          <h3 className="text-xl!">Добавление товара</h3>
          <X className="add-modal__close-icon" size={20} onClick={onClose} />
        </div>

        <form onSubmit={onFormSubmit}>
          <h4 className="">Товар: <span className="font-medium">{itemName}</span> </h4>
          {!!itemId && (
            <div className=" border rounded-lg p-2 w-full" style={{ marginTop: 8, opacity: 0.8 }}>
              В наличии сейчас: <b>{stockQty}</b> шт.
            </div>
          )}

          <label htmlFor="" style={{ margin: "10px 0 5px", display: "block" }}>
            Количество
          </label>

          <input
            type="number"
            name="qty"
            placeholder="Количество"
            className=" border rounded-lg p-2 w-full"
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

            type="number"
            name="purchasePrice"
            placeholder="Закупочная цена (за 1 шт.)"
            className="border rounded-lg p-2 w-full"
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

            type="number"
            name="retailPrice"
            placeholder="Розничная цена (за 1 шт.)"
            className="border rounded-lg p-2 w-full"
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

            className="border rounded-lg p-2 w-full"
            value={selectedSupplier}
            onChange={(e) => setSelectedSupplier(e.target.value)}
            disabled={!itemId}
          >
            <option value="">Выберите поставщика</option>
            {suppliers.map((supplier) => (
              <option key={supplier.id} value={supplier.id}>
                {supplier.full_name || supplier.name}
              </option>
            ))}
          </select>

          {/* касса автоматически выбирается - скрыто от пользователя */}

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
            className="btn edit-btn w-full py-2! text-lg! justify-center mt-2"
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
