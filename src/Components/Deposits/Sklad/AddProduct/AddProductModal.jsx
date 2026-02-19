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
import "./AddProductModal.scss";
import { validateResErrors } from "../../../../../tools/validateResErrors";

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

  // const q = toNum(qty);
  // const pp = toNum(purchasePrice);
  // const rp = toNum(retailPrice);
  const { q, pp, rp } = useMemo(() => ({
    q: toNum(qty),
    pp: toNum(purchasePrice),
    rp: toNum(retailPrice)
  }),
    [qty, purchasePrice, retailPrice]);

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
      const errorMessage = validateResErrors(e, "Не удалось сохранить. Попробуйте ещё раз.");
      alert(errorMessage, true)
    }
  };

  const disabled = !!validate();

  return (
    <div className="add-modal z-50! sklad-add-product-modal">
      <div className="add-modal__overlay z-50!" onClick={onClose} />
      <div className="add-modal__content z-50!">
        <div className="add-modal__header ">
          <h3 className="text-xl!">Добавление товара</h3>
          <X className="add-modal__close-icon" size={20} onClick={onClose} />
        </div>

        <form className="sklad-add-product-modal__form" onSubmit={onFormSubmit}>
          <div className="sklad-add-product-modal__card">
            <div className="sklad-add-product-modal__title">
              Товар: <span className="sklad-add-product-modal__titleName">{itemName}</span>
            </div>
          {!!itemId && (
              <div className="sklad-add-product-modal__meta">
              В наличии сейчас: <b>{stockQty}</b> шт.
            </div>
          )}
          </div>

          <div className="add-modal__section">
            <label htmlFor="add-product-qty">Количество</label>
            <input
              id="add-product-qty"
              type="number"
              name="qty"
              placeholder="Количество"
              className="add-modal__input"
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              min={1}
              step={1}
              inputMode="numeric"
              disabled={!itemId}
            />
          </div>

          <div className="sklad-add-product-modal__grid">
            <div className="add-modal__section">
              <label htmlFor="add-product-purchasePrice">Закупочная цена</label>
              <input
                id="add-product-purchasePrice"
                type="number"
                name="purchasePrice"
                placeholder="Закупочная (за 1 шт.)"
                className="add-modal__input"
                value={purchasePrice}
                onChange={(e) => setPurchasePrice(e.target.value)}
                min={0}
                step="0.01"
                inputMode="decimal"
                disabled={!itemId}
              />
            </div>

            <div className="add-modal__section">
              <label htmlFor="add-product-retailPrice">Розничная цена</label>
              <input
                id="add-product-retailPrice"
                type="number"
                name="retailPrice"
                placeholder="Розничная (за 1 шт.)"
                className="add-modal__input"
                value={retailPrice}
                onChange={(e) => setRetailPrice(e.target.value)}
                min={0}
                step="0.01"
                inputMode="decimal"
                disabled={!itemId}
              />
            </div>
          </div>

          <div className="add-modal__section">
            <label htmlFor="add-product-supplier">Поставщик</label>
            <select
              id="add-product-supplier"
              className="add-modal__input"
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
          </div>

          {/* касса автоматически выбирается - скрыто от пользователя */}

          <div className="sklad-add-product-modal__summary">
            Итог к списанию: <b>{Number.isFinite(expense) ? expense : 0}</b>
          </div>

          {error && (
            <div className="sklad-add-product-modal__error" role="alert">
              {error}
            </div>
          )}

          <button
            className="btn sklad-add-product-modal__save"
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
