import { useEffect, useState } from "react";
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

    const payload = {
      name,
      barcode,
      brand_name,
      category_name,
      price: price.toString(),
      quantity: Number(quantity),
      client,
      purchase_price,
    };

    try {
      const product = await dispatch(createProductAsync(payload)).unwrap();
      await dispatch(
        addCashFlows({
          ...cashData,
          amount: (product?.purchase_price * product?.quantity).toFixed(2),
          source_cashbox_flow_id: product.id,
        })
      ).unwrap();
      if (client !== "") {
        await dispatch(
          createDeal({
            clientId: newItemData?.client,
            title: newItemData?.name,
            statusRu: "Продажа",
            amount: (product?.purchase_price * product?.quantity).toFixed(2),
          })
        ).unwrap();
      }
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
