import { useEffect, useState, useMemo } from "react";
import { useDispatch } from "react-redux";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Plus, Package, ShoppingBag, Scan } from "lucide-react";
import { useClient } from "../../../store/slices/ClientSlice";
import { useProducts } from "../../../store/slices/productSlice";
import { useUser } from "../../../store/slices/userSlice";
import {
  createClientAsync,
  fetchClientsAsync,
} from "../../../store/creators/clientCreators";
import {
  addCashFlows,
  getCashBoxes,
  useCash,
} from "../../../store/slices/cashSlice";
import { createDeal } from "../../../store/creators/saleThunk";
import AddProductBarcode from "./AddProductBarcode";
import { createProductAsync } from "../../../store/creators/productCreators";
import api from "../../../api";
import "./AddProductPage.scss";

// Функция для создания долга
async function createDebt(payload) {
  const res = await api.post("/main/debts/", payload);
  return res.data;
}

const AddProductPage = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { list } = useClient();
  const { creating, createError, brands, categories, scannedProduct } =
    useProducts();
  const { company } = useUser();
  const { list: cashBoxes } = useCash();

  const [activeTab, setActiveTab] = useState(0); // 0 - Ввод вручную, 1 - Сканирование
  const [productType, setProductType] = useState("piece"); // "piece" или "weight"
  const [selectCashBox, setSelectCashBox] = useState("");

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

  useEffect(() => {
    dispatch(fetchClientsAsync());
    dispatch(getCashBoxes());
  }, [dispatch]);

  // Автоматически выбираем первую кассу
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
    setCashData((prev) => ({
      ...prev,
      cashbox: selectCashBox,
      name: newItemData.name,
      amount: newItemData.price,
    }));
  }, [newItemData, selectCashBox]);

  const onChange = (e) => {
    const { name, value } = e.target;
    setState((prev) => ({ ...prev, [name]: value }));
  };

  const handleChange = (e) => {
    const { name, value, type } = e.target;
    setNewItemData((prevData) => ({
      ...prevData,
      [name]: type === "number" ? (value === "" ? "" : parseInt(value)) : value,
      scale_type:
        name === "scale_type"
          ? value
          : prevData.scale_type || productType === "piece"
          ? "piece"
          : "weight",
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

  // Автоматическое заполнение телефона при выборе поставщика в тарифе "Старт"
  useEffect(() => {
    if (company?.subscription_plan?.name === "Старт" && pickSupplier?.phone) {
      setDebtState((prev) => ({ ...prev, phone: pickSupplier.phone }));
    }
  }, [newItemData.client, pickSupplier, company?.subscription_plan?.name]);

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
        alert("Введите корректный срок долга");
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
        alert("Введите корректный срок долга");
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
      scale_type:
        newItemData.scale_type ||
        (productType === "piece" ? "piece" : "weight"),
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

      alert("Товар успешно добавлен!");
      navigate("/crm/sklad");
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

  // Генерируем штрих-код автоматически если пустой
  useEffect(() => {
    if (!newItemData.barcode) {
      const timestamp = Date.now();
      const random = Math.floor(Math.random() * 1000);
      setNewItemData((prev) => ({
        ...prev,
        barcode: `${timestamp}${random}`.slice(0, 13),
      }));
    }
  }, []);

  // Генерируем ПЛУ автоматически если пустой
  useEffect(() => {
    if (!newItemData.plu) {
      setNewItemData((prev) => ({
        ...prev,
        plu: "0001",
      }));
    }
  }, []);

  return (
    <div className="add-product-page">
      <div className="add-product-page__header">
        <button
          className="add-product-page__back"
          onClick={() => navigate("/crm/sklad")}
        >
          <ArrowLeft size={20} />
          Вернуться к складу
        </button>
        <div className="add-product-page__title-section">
          <div className="add-product-page__icon">
            <Plus size={24} />
          </div>
          <div>
            <h1 className="add-product-page__title">Добавление товара</h1>
            <p className="add-product-page__subtitle">
              Заполните информацию о новом товаре
            </p>
          </div>
        </div>
      </div>

      <div className="add-product-page__content">
        {/* Табы для выбора метода ввода */}
        <div className="add-product-page__tabs">
          <button
            className={`add-product-page__tab ${
              activeTab === 0 ? "add-product-page__tab--active" : ""
            }`}
            onClick={() => setActiveTab(0)}
          >
            <Package size={18} />
            Ввод вручную
          </button>
          <button
            className={`add-product-page__tab ${
              activeTab === 1 ? "add-product-page__tab--active" : ""
            }`}
            onClick={() => setActiveTab(1)}
          >
            <Scan size={18} />
            Сканирование
          </button>
        </div>

        {activeTab === 1 ? (
          // Вкладка сканирования
          <div className="add-product-page__scan-section">
            {!scannedProduct && (
              <div className="add-product-page__scan-box">
                <Scan size={48} />
                <h3>Сканирование товара</h3>
                <p>
                  Отсканируйте штрих-код товара для автоматического добавления в
                  склад
                </p>
              </div>
            )}
            <AddProductBarcode
              onClose={() => navigate("/crm/sklad")}
              onShowSuccessAlert={(productName) => {
                alert(`Товар "${productName}" успешно добавлен!`);
                navigate("/crm/sklad");
              }}
              onShowErrorAlert={(errorMsg) => {
                alert(errorMsg);
              }}
              selectCashBox={selectCashBox}
            />
          </div>
        ) : (
          // Вкладка ручного ввода
          <div className="add-product-page__form">
            {/* Выбор типа товара */}
            <div className="add-product-page__section">
              <label className="add-product-page__section-label">
                Тип товара *
              </label>
              <div className="add-product-page__type-selector">
                <button
                  className={`add-product-page__type-card ${
                    productType === "piece"
                      ? "add-product-page__type-card--active"
                      : ""
                  }`}
                  onClick={() => {
                    setProductType("piece");
                    setNewItemData((prev) => ({
                      ...prev,
                      scale_type: "piece",
                    }));
                  }}
                >
                  <Package size={32} />
                  <span>Штучный товар</span>
                </button>
                <button
                  className={`add-product-page__type-card ${
                    productType === "weight"
                      ? "add-product-page__type-card--active"
                      : ""
                  }`}
                  onClick={() => {
                    setProductType("weight");
                    setNewItemData((prev) => ({
                      ...prev,
                      scale_type: "weight",
                    }));
                  }}
                >
                  <ShoppingBag size={32} />
                  <span>Килограммовый товар</span>
                </button>
              </div>
            </div>

            {/* Основная информация */}
            <div className="add-product-page__section">
              <div className="add-product-page__section-header">
                <div className="add-product-page__section-number">1</div>
                <h3 className="add-product-page__section-title">
                  Основная информация
                </h3>
              </div>

              <div className="add-product-page__form-group">
                <label className="add-product-page__label">
                  Название товара *
                </label>
                <input
                  type="text"
                  name="name"
                  placeholder="Например, Монитор Dell 24 дюйма"
                  className="add-product-page__input"
                  value={newItemData.name}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className="add-product-page__form-group">
                <label className="add-product-page__label">Штрих-код *</label>
                <input
                  type="text"
                  name="barcode"
                  className="add-product-page__input"
                  value={newItemData.barcode}
                  onChange={handleChange}
                  required
                />
              </div>

              {company?.sector?.name !== "Барбершоп" && (
                <>
                  <div className="add-product-page__form-group">
                    <label className="add-product-page__label">
                      ПЛУ (номер для весов)
                    </label>
                    <input
                      type="text"
                      name="plu"
                      placeholder="0001"
                      className="add-product-page__input"
                      value={newItemData.plu}
                      onChange={handleChange}
                    />
                    <span className="add-product-page__hint">
                      4-значный код для весов
                    </span>
                  </div>

                  <div className="add-product-page__form-group">
                    <label className="add-product-page__label">Бренд *</label>
                    <select
                      name="brand_name"
                      className="add-product-page__input"
                      value={newItemData.brand_name}
                      onChange={handleChange}
                      required
                    >
                      <option value="">Выберите бренд</option>
                      {brands.map((brand, idx) => (
                        <option key={brand.id ?? idx} value={brand.name}>
                          {brand.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="add-product-page__form-group">
                    <label className="add-product-page__label">
                      Категория *
                    </label>
                    <select
                      name="category_name"
                      className="add-product-page__input"
                      value={newItemData.category_name}
                      onChange={handleChange}
                      required
                    >
                      <option value="">Выберите категорию</option>
                      {categories.map((category, idx) => (
                        <option key={category.id ?? idx} value={category.name}>
                          {category.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </>
              )}
            </div>

            {/* Информация о поставщике */}
            <div className="add-product-page__section">
              <div className="add-product-page__section-header">
                <div className="add-product-page__section-number">2</div>
                <h3 className="add-product-page__section-title">
                  Информация о поставщике
                </h3>
              </div>

              <div className="add-product-page__form-group">
                <label className="add-product-page__label">Поставщик *</label>
                <div className="add-product-page__supplier-row">
                  <select
                    name="client"
                    className="add-product-page__input"
                    value={newItemData.client}
                    onChange={handleChange}
                    required
                  >
                    <option value="">Выберите поставщика</option>
                    {filterClient.map((client, idx) => (
                      <option key={client.id ?? idx} value={client.id}>
                        {client.full_name}
                      </option>
                    ))}
                  </select>
                  <button
                    className="add-product-page__create-supplier"
                    onClick={() => setShowInputs(!showInputs)}
                  >
                    + Создать поставщика
                  </button>
                </div>
                {showInputs && (
                  <form
                    className="add-product-page__supplier-form"
                    onSubmit={onSubmit}
                  >
                    <input
                      className="add-product-page__input"
                      onChange={onChange}
                      type="text"
                      placeholder="ФИО"
                      name="full_name"
                    />
                    <input
                      className="add-product-page__input"
                      onChange={onChange}
                      type="text"
                      name="llc"
                      placeholder="ОсОО"
                    />
                    <input
                      className="add-product-page__input"
                      onChange={onChange}
                      type="text"
                      name="inn"
                      placeholder="ИНН"
                    />
                    <input
                      className="add-product-page__input"
                      onChange={onChange}
                      type="text"
                      name="okpo"
                      placeholder="ОКПО"
                    />
                    <input
                      className="add-product-page__input"
                      onChange={onChange}
                      type="text"
                      name="score"
                      placeholder="Р/СЧЁТ"
                    />
                    <input
                      className="add-product-page__input"
                      onChange={onChange}
                      type="text"
                      name="bik"
                      placeholder="БИК"
                    />
                    <input
                      className="add-product-page__input"
                      onChange={onChange}
                      type="text"
                      name="address"
                      placeholder="Адрес"
                    />
                    <input
                      className="add-product-page__input"
                      onChange={onChange}
                      type="text"
                      name="phone"
                      placeholder="Телефон"
                    />
                    <input
                      className="add-product-page__input"
                      onChange={onChange}
                      type="email"
                      name="email"
                      placeholder="Почта"
                    />
                    <div className="add-product-page__form-actions">
                      <button
                        type="button"
                        className="add-product-page__cancel-btn"
                        onClick={() => setShowInputs(false)}
                      >
                        Отмена
                      </button>
                      <button
                        type="submit"
                        className="add-product-page__save-btn"
                      >
                        Создать
                      </button>
                    </div>
                  </form>
                )}

                <label className="add-product-page__checkbox-label">
                  <input
                    type="checkbox"
                    checked={showDebtForm}
                    onChange={(e) => setShowDebtForm(e.target.checked)}
                  />
                  Добавить долг по этому товару
                </label>

                {showDebtForm && (
                  <div className="add-product-page__debt-form">
                    {!newItemData.client && (
                      <p className="add-product-page__error">
                        Выберите поставщика в форме выше!
                      </p>
                    )}
                    {company?.subscription_plan?.name === "Старт" &&
                      newItemData.client && (
                        <>
                          <div className="add-product-page__form-group">
                            <label className="add-product-page__label">
                              Телефон поставщика
                            </label>
                            <input
                              type="text"
                              onChange={onChangeDebt}
                              name="phone"
                              value={debtState.phone}
                              className="add-product-page__input"
                            />
                          </div>
                          <div className="add-product-page__form-group">
                            <label className="add-product-page__label">
                              Дата оплаты
                            </label>
                            <input
                              type="date"
                              onChange={onChangeDebt}
                              name="dueDate"
                              value={debtState.dueDate}
                              className="add-product-page__input"
                            />
                          </div>
                        </>
                      )}
                    <div className="add-product-page__form-group">
                      <label className="add-product-page__label">
                        Тип оплаты
                      </label>
                      <select
                        value={debt}
                        onChange={(e) => setDebt(e.target.value)}
                        className="add-product-page__input"
                      >
                        <option value="">Тип оплаты</option>
                        <option value="Предоплата">Предоплата</option>
                        <option value="Долги">Долг</option>
                      </select>
                    </div>
                    {debt === "Предоплата" && (
                      <>
                        <div className="add-product-page__form-group">
                          <label className="add-product-page__label">
                            Сумма предоплаты
                          </label>
                          <input
                            type="text"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            className="add-product-page__input"
                          />
                        </div>
                        <div className="add-product-page__form-group">
                          <label className="add-product-page__label">
                            Срок долга (мес.)
                          </label>
                          <input
                            type="text"
                            value={debtMonths}
                            onChange={(e) => setDebtMonths(e.target.value)}
                            className="add-product-page__input"
                          />
                        </div>
                      </>
                    )}
                    {debt === "Долги" && (
                      <div className="add-product-page__form-group">
                        <label className="add-product-page__label">
                          Срок долга (мес.)
                        </label>
                        <input
                          type="text"
                          value={debtMonths}
                          onChange={(e) => setDebtMonths(e.target.value)}
                          className="add-product-page__input"
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Цена и количество */}
            <div className="add-product-page__section">
              <div className="add-product-page__section-header">
                <div className="add-product-page__section-number">3</div>
                <h3 className="add-product-page__section-title">
                  Цена и количество
                </h3>
              </div>

              <div className="add-product-page__form-group">
                <label className="add-product-page__label">
                  Закупочная цена *
                </label>
                <div className="add-product-page__price-input">
                  <input
                    type="text"
                    name="purchase_price"
                    placeholder="0.00"
                    className="add-product-page__input"
                    value={newItemData.purchase_price}
                    onChange={handleChange}
                    required
                  />
                  <span className="add-product-page__currency">P</span>
                </div>
              </div>

              <div className="add-product-page__form-group">
                <label className="add-product-page__label">
                  Розничная цена *
                </label>
                <div className="add-product-page__price-input">
                  <input
                    type="text"
                    name="price"
                    placeholder="0.00"
                    className="add-product-page__input"
                    value={newItemData.price}
                    onChange={handleChange}
                    required
                  />
                  <span className="add-product-page__currency">P</span>
                </div>
              </div>

              <div className="add-product-page__form-group">
                <label className="add-product-page__label">Количество *</label>
                <div className="add-product-page__price-input">
                  <input
                    type="text"
                    name="quantity"
                    placeholder="0"
                    className="add-product-page__input"
                    value={newItemData.quantity}
                    onChange={handleChange}
                    required
                  />
                  <span className="add-product-page__currency">шт</span>
                </div>
              </div>
            </div>

            {/* Кнопки действий */}
            <div className="add-product-page__actions">
              <button
                className="add-product-page__cancel-btn"
                onClick={() => navigate("/crm/sklad")}
                disabled={creating}
              >
                Отмена
              </button>
              <button
                className="add-product-page__submit-btn"
                onClick={handleSubmit}
                disabled={creating}
              >
                {creating ? "Добавление..." : "Добавить товар"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AddProductPage;
