import { useEffect, useState, useMemo } from "react";
import { useDispatch } from "react-redux";
import { X } from "lucide-react";
import { useClient } from "../../../../../store/slices/ClientSlice";
import { useProducts } from "../../../../../store/slices/productSlice";
import { useUser } from "../../../../../store/slices/userSlice";
// import {
//   createProductAsync,
//   fetchClientsAsync,
// } from "../../../../../store/creators/productCreators";
import {
  createClientAsync,
  fetchClientsAsync,
} from "../../../../../store/creators/clientCreators";
import {
  addCashFlows,
  getCashBoxes,
  useCash,
} from "../../../../../store/slices/cashSlice";
import { createDeal } from "../../../../../store/creators/saleThunk";
import AddProductBarcode from "../../AddProductBarcode";
import { createProductAsync } from "../../../../../store/creators/productCreators";
import api from "../../../../../api";

// Функция для создания долга
async function createDebt(payload) {
  const res = await api.post("/main/debts/", payload);
  return res.data;
}

const AddModal = ({
  onClose,
  onSaveSuccess,
  cashBoxes: externalCashBoxes,
  selectCashBox: externalSelectCashBox,
  onShowSuccessAlert,
  onShowErrorAlert,
}) => {
  const { list } = useClient();
  const dispatch = useDispatch();
  const { creating, createError, brands, categories, barcodeError } =
    useProducts();
  const { company } = useUser();
  const { list: internalCashBoxes } = useCash();

  // Используем внешние кассы, если переданы, иначе внутренние
  const cashBoxes = externalCashBoxes || internalCashBoxes;
  const [selectCashBox, setSelectCashBox] = useState(
    externalSelectCashBox || ""
  );
  const [activeTab, setActiveTab] = useState(0);
  const [isTabSelected, setIsTabSelected] = useState(true); // Автоматически открываем первую вкладку (сканирование)

  const [newItemData, setNewItemData] = useState({
    name: "",
    barcode: "",
    brand_name: "",
    category_name: "",
    price: "",
    quantity: "",
    client: "",
    purchase_price: "",
    plu: "",
    scale_type: "",
  });

  const [state, setState] = useState({
    full_name: "",
    phone: "",
    email: "",
    date: new Date().toISOString().split("T")[0],
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
    source_business_operation_id: "Склад",
    status:
      company?.subscription_plan?.name === "Старт" ? "approved" : "pending",
  });
  const [showInputs, setShowInputs] = useState(false);

  // Состояния для долга
  const [debt, setDebt] = useState("");
  const [amount, setAmount] = useState("");
  const [debtMonths, setDebtMonths] = useState("");
  const [showDebtForm, setShowDebtForm] = useState(false);
  const [debtState, setDebtState] = useState({
    phone: "",
    dueDate: "",
  });

  const onChange = (e) => {
    const { name, value } = e.target;
    setState((prev) => ({ ...prev, [name]: value }));
  };

  const handleChange = (e) => {
    const { name, value, type } = e.target;
    setNewItemData((prevData) => ({
      ...prevData,
      [name]: type === "number" ? (value === "" ? "" : parseInt(value)) : value,
    }));
  };

  const onChangeDebt = (e) => {
    const { name, value } = e.target;
    setDebtState((prev) => ({ ...prev, [name]: value }));
  };

  // Получаем выбранного поставщика для долга
  const pickSupplier = useMemo(() => {
    if (!newItemData.client) return null;
    return list.find((x) => String(x.id) === String(newItemData.client));
  }, [list, newItemData.client]);

  const handleSubmit = async () => {
    const {
      name,
      barcode,
      brand_name,
      category_name,
      price,
      quantity,
      client,
      purchase_price,
    } = newItemData;

    if (
      !name ||
      !barcode ||
      price === "" ||
      quantity === "" ||
      purchase_price === ""
    ) {
      alert("Пожалуйста, заполните все обязательные поля.");
      return;
    }

    // Валидация для долговых операций
    if (debt && !client) {
      alert("Выберите поставщика для долговой операции");
      return;
    }

    if (debt === "Долги") {
      if (!debtMonths || Number(debtMonths) <= 0) {
        alert("Введите корректный срок долга (в месяцах)");
        return;
      }
      if (company?.subscription_plan?.name === "Старт") {
        if (!debtState.dueDate) {
          alert("Выберите дату оплаты");
          return;
        }
        if (!debtState.phone) {
          alert("Введите номер телефона поставщика");
          return;
        }
      }
    }

    if (debt === "Предоплата") {
      if (!amount || Number(amount) <= 0) {
        alert("Введите корректную сумму предоплаты");
        return;
      }
      const totalAmount = Number(purchase_price) * Number(quantity);
      if (Number(amount) > totalAmount) {
        alert("Сумма предоплаты не может превышать общую сумму");
        return;
      }
      if (!debtMonths || Number(debtMonths) <= 0) {
        alert("Введите корректный срок долга (в месяцах)");
        return;
      }
    }

    const payload = {
      name,
      barcode,
      brand_name,
      category_name,
      price: price.toString(),
      quantity: Number(quantity),
      client,
      purchase_price,
      plu: newItemData.plu ? Number(newItemData.plu) : null,
      scale_type: newItemData.scale_type || null,
    };

    try {
      const product = await dispatch(createProductAsync(payload)).unwrap();
      const totalAmount = Number(product?.purchase_price * product?.quantity);

      // Создание долга, если выбран
      if (debt === "Долги" && client) {
        if (company?.subscription_plan?.name === "Старт") {
          await createDebt({
            name: pickSupplier?.full_name,
            phone: debtState.phone,
            due_date: debtState.dueDate,
            amount: totalAmount,
          });
        }

        // Создание сделки
        await dispatch(
          createDeal({
            clientId: client,
            title: `Долг ${pickSupplier?.full_name}`,
            statusRu: debt,
            amount: totalAmount,
            debtMonths: Number(debtMonths),
          })
        ).unwrap();
      }

      if (debt === "Предоплата" && client) {
        await dispatch(
          createDeal({
            clientId: client,
            title: `Предоплата ${pickSupplier?.full_name}`,
            statusRu: debt,
            amount: totalAmount,
            prepayment: Number(amount),
            debtMonths: Number(debtMonths),
          })
        ).unwrap();
      }

      // Добавление денежного потока только если не долг
      if (debt !== "Долги") {
        const amountForCash = debt === "Предоплата" ? amount : totalAmount;
        await dispatch(
          addCashFlows({
            ...cashData,
            amount: amountForCash,
            source_cashbox_flow_id: product.id,
          })
        ).unwrap();
      }

      if (client !== "" && !debt) {
        await dispatch(
          createDeal({
            clientId: newItemData?.client,
            title: newItemData?.name,
            statusRu: "Продажа",
            amount: totalAmount,
          })
        ).unwrap();
      }

      // Очищаем данные долга
      setDebt("");
      setAmount("");
      setDebtMonths("");
      setShowDebtForm(false);
      setDebtState({
        phone: "",
        dueDate: "",
      });

      onClose();
      onSaveSuccess();
    } catch (err) {
      console.error("Failed to create product:", err);
      alert(
        `Ошибка при добавлении товара: ${err.message || JSON.stringify(err)}`
      );
    }
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    try {
      await dispatch(createClientAsync(state)).unwrap();
      dispatch(fetchClientsAsync());
      setShowInputs(false);
    } catch (e) {
      console.log(e);
    }
  };
  const filterClient = list.filter((item) => item.type === "suppliers");

  const tabs = [
    {
      label: "Сканировать",
      content: (
        <AddProductBarcode
          onClose={onClose}
          onShowSuccessAlert={onShowSuccessAlert}
          onShowErrorAlert={onShowErrorAlert}
          selectCashBox={selectCashBox || externalSelectCashBox}
        />
      ),
      option: "scan",
    },
    {
      label: "Вручную",
      content: (
        <>
          <div className="add-modal__section">
            <label>Название *</label>
            <input
              type="text"
              name="name"
              placeholder="Например, Монитор Dell"
              className="add-modal__input"
              value={newItemData.name}
              onChange={handleChange}
              required
            />
          </div>

          <div className="add-modal__section">
            <label>Штрих код *</label>
            <input
              type="text"
              name="barcode"
              placeholder="Штрих код"
              className="add-modal__input"
              value={newItemData.barcode}
              onChange={handleChange}
              required
            />
          </div>

          {company?.sector?.name !== "Барбершоп" && (
            <>
              <div className="add-modal__section">
                <label>Бренд *</label>
                <select
                  name="brand_name"
                  className="add-modal__input"
                  value={newItemData.brand_name}
                  onChange={handleChange}
                  required
                >
                  <option value="">-- Выберите бренд --</option>
                  {brands.map((brand, idx) => (
                    <option key={brand.id ?? idx} value={brand.name}>
                      {brand.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="add-modal__section">
                <label>Категория *</label>
                <select
                  name="category_name"
                  className="add-modal__input"
                  value={newItemData.category_name}
                  onChange={handleChange}
                  required
                >
                  <option value="">-- Выберите категорию --</option>
                  {categories.map((category, idx) => (
                    <option key={category.id ?? idx} value={category.name}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </div>
            </>
          )}

          <div className="add-modal__section">
            <label>Поставщик *</label>
            <select
              name="client"
              className="add-modal__input"
              value={newItemData.client}
              onChange={handleChange}
              required
            >
              <option value="">-- Выберите поставщика --</option>
              {filterClient.map((client, idx) => (
                <option key={client.id ?? idx} value={client.id}>
                  {client.full_name}
                </option>
              ))}
            </select>

            <button
              className="create-client"
              onClick={() => setShowInputs(!showInputs)}
            >
              {showInputs ? "Отменить" : "Создать поставщика"}
            </button>
            {showInputs && (
              <form
                style={{
                  display: "flex",
                  flexDirection: "column",
                  rowGap: "10px",
                }}
                onSubmit={onSubmit}
              >
                <input
                  className="add-modal__input"
                  onChange={onChange}
                  type="text"
                  placeholder="ФИО"
                  name="full_name"
                />
                <input
                  className="add-modal__input"
                  onChange={onChange}
                  type="text"
                  name="llc"
                  placeholder="ОсОО"
                />
                <input
                  className="add-modal__input"
                  onChange={onChange}
                  type="text"
                  name="inn"
                  placeholder="ИНН"
                />
                <input
                  className="add-modal__input"
                  onChange={onChange}
                  type="text"
                  name="okpo"
                  placeholder="ОКПО"
                />
                <input
                  className="add-modal__input"
                  onChange={onChange}
                  type="text"
                  name="score"
                  placeholder="Р/СЧЁТ"
                />
                <input
                  className="add-modal__input"
                  onChange={onChange}
                  type="text"
                  name="bik"
                  placeholder="БИК"
                />
                <input
                  className="add-modal__input"
                  onChange={onChange}
                  type="text"
                  name="address"
                  placeholder="Адрес"
                />
                <input
                  className="add-modal__input"
                  onChange={onChange}
                  type="text"
                  name="phone"
                  placeholder="Телефон"
                />
                <input
                  className="add-modal__input"
                  onChange={onChange}
                  type="email"
                  name="email"
                  placeholder="Почта"
                />
                <div style={{ display: "flex", columnGap: "10px" }}>
                  <button
                    className="create-client"
                    type="button"
                    onClick={() => setShowInputs(false)}
                  >
                    Отмена
                  </button>
                  <button className="create-client">Создать</button>
                </div>
              </form>
            )}
          </div>
          <div className="add-modal__section">
            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                cursor: "pointer",
                marginBottom: showDebtForm ? "15px" : "0",
              }}
            >
              <input
                type="checkbox"
                checked={showDebtForm}
                onChange={(e) => setShowDebtForm(e.target.checked)}
                style={{ width: "18px", height: "18px", cursor: "pointer" }}
              />
              <strong style={{ fontSize: "14px" }}>Добавить долг</strong>
            </label>

            {/* Форма долга */}
            {showDebtForm && (
              <div style={{ marginTop: "15px" }}>
                {!newItemData.client && (
                  <p
                    style={{
                      margin: "5px 0",
                      color: "#ff0000",
                      fontSize: "13px",
                    }}
                  >
                    Выберите поставщика в форме выше!
                  </p>
                )}
                {company?.subscription_plan?.name === "Старт" &&
                  newItemData.client && (
                    <>
                      <label
                        style={{
                          display: "block",
                          marginBottom: "5px",
                          fontSize: "13px",
                          fontWeight: "600",
                        }}
                      >
                        Телефон поставщика
                      </label>
                      <input
                        type="text"
                        onChange={onChangeDebt}
                        name="phone"
                        value={debtState.phone}
                        className="add-modal__input"
                        style={{
                          width: "100%",
                          padding: "8px",
                          border: "1px solid #ccc",
                          borderRadius: "4px",
                          marginBottom: "10px",
                        }}
                      />
                      <label
                        style={{
                          display: "block",
                          marginBottom: "5px",
                          fontSize: "13px",
                          fontWeight: "600",
                        }}
                      >
                        Дата оплаты
                      </label>
                      <input
                        type="date"
                        onChange={onChangeDebt}
                        name="dueDate"
                        value={debtState.dueDate}
                        className="add-modal__input"
                        style={{
                          width: "100%",
                          padding: "8px",
                          border: "1px solid #ccc",
                          borderRadius: "4px",
                          marginBottom: "10px",
                        }}
                      />
                    </>
                  )}
                <label
                  style={{
                    display: "block",
                    marginBottom: "5px",
                    fontSize: "13px",
                    fontWeight: "600",
                  }}
                >
                  Тип оплаты
                </label>
                <select
                  value={debt}
                  onChange={(e) => setDebt(e.target.value)}
                  className="add-modal__input"
                  style={{
                    width: "100%",
                    padding: "8px",
                    border: "1px solid #ccc",
                    borderRadius: "4px",
                    marginBottom: "10px",
                  }}
                >
                  <option value="">Тип оплаты</option>
                  <option value="Предоплата">Предоплата</option>
                  <option value="Долги">Долг</option>
                </select>
                {debt === "Предоплата" && (
                  <>
                    <label
                      style={{
                        display: "block",
                        marginBottom: "5px",
                        fontSize: "13px",
                        fontWeight: "600",
                      }}
                    >
                      Сумма предоплаты
                    </label>
                    <input
                      type="text"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      className="add-modal__input"
                      style={{
                        width: "100%",
                        padding: "8px",
                        border: "1px solid #ccc",
                        borderRadius: "4px",
                        marginBottom: "10px",
                      }}
                    />
                    <label
                      style={{
                        display: "block",
                        marginBottom: "5px",
                        fontSize: "13px",
                        fontWeight: "600",
                      }}
                    >
                      Срок долга (мес.)
                    </label>
                    <input
                      type="text"
                      value={debtMonths}
                      onChange={(e) => setDebtMonths(e.target.value)}
                      className="add-modal__input"
                      style={{
                        width: "100%",
                        padding: "8px",
                        border: "1px solid #ccc",
                        borderRadius: "4px",
                        marginBottom: "10px",
                      }}
                    />
                  </>
                )}
                {debt === "Долги" && (
                  <>
                    <label
                      style={{
                        display: "block",
                        marginBottom: "5px",
                        fontSize: "13px",
                        fontWeight: "600",
                      }}
                    >
                      Срок долга (мес.)
                    </label>
                    <input
                      type="text"
                      value={debtMonths}
                      onChange={(e) => setDebtMonths(e.target.value)}
                      className="add-modal__input"
                      style={{
                        width: "100%",
                        padding: "8px",
                        border: "1px solid #ccc",
                        borderRadius: "4px",
                        marginBottom: "10px",
                      }}
                    />
                  </>
                )}
                {debt && newItemData.client && (
                  <div
                    style={{
                      marginTop: "10px",
                      padding: "10px",
                      backgroundColor: "#e8f5e9",
                      borderRadius: "4px",
                      fontSize: "13px",
                    }}
                  >
                    <strong>Сумма долга:</strong>{" "}
                    {(
                      Number(newItemData.purchase_price) *
                      Number(newItemData.quantity)
                    ).toFixed(2)}{" "}
                    сом
                    <br />
                    <strong>Поставщик:</strong> {pickSupplier?.full_name}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="add-modal__section">
            <label>Розничная цена *</label>
            <input
              type="number"
              name="price"
              placeholder="999.99"
              className="add-modal__input"
              value={newItemData.price}
              onChange={handleChange}
              min="0"
              step="0.01"
              required
            />
          </div>

          <div className="add-modal__section">
            <label>Закупочная цена *</label>
            <input
              type="number"
              name="purchase_price"
              placeholder="999.99"
              className="add-modal__input"
              value={newItemData.purchase_price}
              onChange={handleChange}
              min="0"
              step="0.01"
              required
            />
          </div>

          <div className="add-modal__section">
            <label>Количество *</label>
            <input
              type="number"
              name="quantity"
              placeholder="100"
              className="add-modal__input"
              value={newItemData.quantity}
              onChange={handleChange}
              min="0"
              required
            />
          </div>
          {company?.sector?.name == "Магазин" && (
            <>
              <div className="add-modal__section">
                <label>ПЛУ</label>
                <input
                  type="number"
                  name="plu"
                  placeholder="Номер ПЛУ для весов (можно не заполнять)"
                  className="add-modal__input"
                  value={newItemData.plu}
                  onChange={handleChange}
                  min="0"
                  max="2147483647"
                />
              </div>

              <div className="add-modal__section">
                <label>Тип товара для весов</label>
                <select
                  name="scale_type"
                  className="add-modal__input"
                  value={newItemData.scale_type}
                  onChange={handleChange}
                >
                  <option value="">-- Выберите тип --</option>
                  <option value="piece">Штучный</option>
                  <option value="weight">Весовой</option>
                </select>
              </div>
            </>
          )}

          {/* Чекбокс для включения формы долга */}

          <div className="add-modal__footer">
            <button
              className="add-modal__cancel"
              onClick={onClose}
              disabled={creating}
            >
              Отмена
            </button>
            <button
              className="add-modal__save"
              onClick={handleSubmit}
              disabled={creating}
            >
              {creating ? "Добавление..." : "Добавить"}
            </button>
          </div>
        </>
      ),
      option: "manually",
    },
  ];

  const handleTabClick = (index) => {
    setActiveTab(index);
    setIsTabSelected(true);
  };

  useEffect(() => {
    dispatch(fetchClientsAsync());
    if (!externalCashBoxes) {
      dispatch(getCashBoxes());
    }
  }, [dispatch, externalCashBoxes]);

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

  useEffect(() => {
    if (barcodeError) {
      setActiveTab(1);
      setIsTabSelected(true);
    }
  }, [barcodeError]);

  useEffect(() => {
    setCashData((prev) => ({
      ...prev,
      cashbox: selectCashBox,
      name: newItemData.name,
      amount: newItemData.price,
    }));
  }, [newItemData, selectCashBox]);

  // Автоматическое заполнение телефона при выборе поставщика в тарифе "Старт"
  useEffect(() => {
    if (company?.subscription_plan?.name === "Старт" && pickSupplier?.phone) {
      setDebtState((prev) => ({ ...prev, phone: pickSupplier.phone }));
    }
  }, [newItemData.client, pickSupplier, company?.subscription_plan?.name]);

  return (
    <div className="add-modal wareSklad">
      <div className="add-modal__overlay" onClick={onClose} />
      <div className="add-modal__content">
        <div className="add-modal__header">
          <h3>Добавление товара</h3>
          <X className="add-modal__close-icon" size={20} onClick={onClose} />
        </div>

        {createError && (
          <p className="add-modal__error-message">
            Ошибка добавления:{" "}
            {createError.message || JSON.stringify(createError)}
          </p>
        )}
        {company?.sector?.name === "Магазин" ||
        company?.subscription_plan?.name === "Старт" ? (
          <>
            {tabs.map((tab, index) => (
              <button
                key={index}
                className={`add-modal__button ${
                  activeTab === index && isTabSelected
                    ? "add-modal__button-active"
                    : ""
                }`}
                onClick={() => handleTabClick(index)}
              >
                {tab.label}
              </button>
            ))}

            {isTabSelected && activeTab !== null && (
              <div className="vitrina__content">{tabs[activeTab].content}</div>
            )}
          </>
        ) : (
          <>{tabs[1].content}</>
        )}
      </div>
    </div>
  );
};

export default AddModal;
