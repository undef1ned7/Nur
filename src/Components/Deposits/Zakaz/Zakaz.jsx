import React, { useState, useEffect } from "react";
import {
  MoreVertical,
  ListFilter,
  Search,
  X,
  ChevronDown,
  SlidersHorizontal,
  Plus,
  PlusCircle,
  MinusCircle,
} from "lucide-react";
import { useDispatch, useSelector } from "react-redux";
import {
  fetchOrdersAsync,
  createOrderAsync,
  deleteOrderAsync,
  updateOrderAsync,
} from "../../../store/creators/orderCreators";
import "./Zakaz.scss";

import {
  createProductAsync,
  fetchProductsAsync,
} from "../../../store/creators/productCreators";
import { clearOrders } from "../../../store/slices/orderSlice";
import {
  createClientAsync,
  fetchClientsAsync,
} from "../../../store/creators/clientCreators";
import { useClient } from "../../../store/slices/ClientSlice";
import { getDepartments } from "../../../store/creators/departmentCreators";
import { useDepartments } from "../../../store/slices/departmentSlice";
import { useProducts } from "../../../store/slices/productSlice";
import { useUser } from "../../../store/slices/userSlice";
import AddProductBarcode from "../Sklad/AddProductBarcode";

/* ======================= Edit Modal ======================= */
const EditModal = ({ order, onClose, onSaveSuccess, onDeleteConfirm }) => {
  const dispatch = useDispatch();
  const { updating, updateError } = useSelector((state) => state.order);

  const [editedOrder, setEditedOrder] = useState({
    order_number: order.order_number || "",
    customer_name: order.customer_name || "",
    date_ordered: order.date_ordered || new Date().toISOString().split("T")[0],
    status: order.status || "new",
    phone: order.phone || "",
    department: order.department || "",
    total: order.total !== undefined ? String(order.total) : "",
    quantity: order.quantity !== undefined ? String(order.quantity) : "",
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setEditedOrder((prevData) => ({
      ...prevData,
      [name]: value,
    }));
  };

  const handleSave = async () => {
    if (
      !editedOrder.order_number ||
      !editedOrder.customer_name ||
      !editedOrder.phone ||
      !editedOrder.department
    ) {
      alert("Пожалуйста, заполните все обязательные поля.");
      return;
    }

    const payload = {
      ...editedOrder,
      total: parseFloat(editedOrder.total),
      quantity: parseInt(editedOrder.quantity, 10),
    };

    try {
      await dispatch(
        updateOrderAsync({ orderId: order.id, updatedData: payload })
      ).unwrap();
      onClose();
      onSaveSuccess();
    } catch (err) {
      console.error("Failed to update order:", err);
      alert(
        `Ошибка при обновлении закупки: ${err.message || JSON.stringify(err)}`
      );
    }
  };

  const handleDelete = async () => {
    if (
      window.confirm(
        `Вы уверены, что хотите удалить закупки №${order?.order_number}?`
      )
    ) {
      try {
        await dispatch(deleteOrderAsync(order.id)).unwrap();
        onClose();
        onDeleteConfirm();
      } catch (err) {
        console.error("Failed to delete order:", err);
        alert(
          `Ошибка при удалении закупки: ${err.message || JSON.stringify(err)}`
        );
      }
    }
  };

  const availableStatuses = [
    "Новый",
    "Ожидает подтверждения",
    "Готов к выдаче",
    "Инициирован возврат",
    "Ожидает оформление доставки",
    "Ожидает передачу курьеру",
    "Передан в доставку",
    "Выполнен",
    "Отменен",
  ];

  return (
    <div className="edit-modal">
      <div className="edit-modal__overlay" onClick={onClose} />
      <div className="edit-modal__content">
        <div className="edit-modal__header">
          <h3>Редактирование закупки №{order?.order_number}</h3>
          <X className="edit-modal__close-icon" size={20} onClick={onClose} />
        </div>

        {updateError && (
          <p className="edit-modal__error-message">
            Ошибка: {updateError.message || JSON.stringify(updateError)}
          </p>
        )}

        <div className="edit-modal__section">
          <label>Номер закупки *</label>
          <input
            type="text"
            name="order_number"
            value={editedOrder.order_number}
            onChange={handleChange}
            maxLength="50"
            minLength="1"
            required
          />
        </div>

        <div className="edit-modal__section">
          <label>Имя клиента *</label>
          <input
            type="text"
            name="customer_name"
            value={editedOrder.customer_name}
            onChange={handleChange}
            maxLength="128"
            minLength="1"
            required
          />
        </div>

        <div className="edit-modal__section">
          <label>Телефон *</label>
          <input
            type="text"
            name="phone"
            value={editedOrder.phone}
            onChange={handleChange}
            maxLength="32"
            minLength="1"
            required
          />
        </div>

        <div className="edit-modal__section">
          <label>Отдел *</label>
          <input
            type="text"
            name="department"
            value={editedOrder.department}
            onChange={handleChange}
            maxLength="64"
            minLength="1"
            required
          />
        </div>

        <div className="edit-modal__section">
          <label>Дата закупки</label>
          <input
            type="date"
            name="date_ordered"
            value={editedOrder.date_ordered}
            onChange={handleChange}
          />
        </div>

        <div className="edit-modal__section">
          <label>Статус</label>
          <select
            name="status"
            value={editedOrder.status}
            onChange={handleChange}
          >
            {availableStatuses.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </div>

        <div className="edit-modal__section">
          <label>Количество, шт. *</label>
          <input
            type="number"
            name="quantity"
            value={editedOrder.quantity}
            onChange={handleChange}
            min="0"
            required
          />
        </div>

        <div className="edit-modal__section">
          <label>Сумма, сом *</label>
          <input
            type="number"
            name="total"
            value={editedOrder.total}
            onChange={handleChange}
            min="0"
            step="0.01"
            required
          />
        </div>

        <div className="edit-modal__footer">
          <button
            className="edit-modal__reset"
            onClick={handleDelete}
            disabled={updating}
          >
            Удалить
          </button>
          <button
            className="edit-modal__save"
            onClick={handleSave}
            disabled={updating}
          >
            {updating ? "Сохранение..." : "Сохранить"}
          </button>
        </div>
      </div>
    </div>
  );
};

/* ======================= Filter Modal ======================= */
const FilterModal = ({
  onClose,
  currentFilters,
  onApplyFilters,
  onResetFilters,
}) => {
  const [filters, setFilters] = useState(() => {
    const initial = { ...currentFilters };
    if (initial.min_quantity !== undefined)
      initial.min_quantity = String(initial.min_quantity);
    if (initial.max_quantity !== undefined)
      initial.max_quantity = String(initial.max_quantity);
    if (initial.min_total !== undefined)
      initial.min_total = String(initial.min_total);
    if (initial.max_total !== undefined)
      initial.max_total = String(initial.max_total);
    return initial;
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    const isNumericField = [
      "min_quantity",
      "max_quantity",
      "min_total",
      "max_total",
    ].includes(name);

    setFilters((prev) => {
      let newValue = value;
      if (isNumericField) {
        newValue = value === "" ? undefined : Number(value);
        if (typeof newValue === "number" && isNaN(newValue)) {
          newValue = undefined;
        }
      } else {
        newValue = value === "" ? undefined : value;
      }
      return { ...prev, [name]: newValue };
    });
  };

  const handleApply = () => {
    const cleanedFilters = {};
    for (const key in filters) {
      const value = filters[key];
      if (value !== undefined && value !== null && value !== "") {
        cleanedFilters[key] = value;
      }
    }
    onApplyFilters(cleanedFilters);
    onClose();
  };

  const handleReset = () => {
    setFilters({
      status: undefined,
      method: undefined,
      min_quantity: undefined,
      max_quantity: undefined,
      min_total: undefined,
      max_total: undefined,
    });
    onResetFilters();
    onClose();
  };

  const availableStatuses = [
    { value: "new", label: "Новый" },
    { value: "pending", label: "Ожидает подтверждения" },
    { value: "completed", label: "Выполнен" },
  ];
  const availableMethods = ["Самовывоз из магазина", "Доставка по городу"];

  return (
    <div className="filter-modal">
      <div className="filter-modal__overlay" onClick={onClose} />
      <div className="filter-modal__content">
        <div className="filter-modal__header">
          <h3>Фильтры</h3>
          <X className="filter-modal__close-icon" size={20} onClick={onClose} />
        </div>

        <div className="filter-modal__section">
          <label>Статус</label>
          <select
            name="status"
            className="filter-modal__select"
            value={filters.status || ""}
            onChange={handleChange}
          >
            <option value="">Все статусы</option>
            {availableStatuses.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </div>

        <div className="filter-modal__section">
          <label>Способ получения</label>
          <select
            name="method"
            className="filter-modal__select"
            value={filters.method || ""}
            onChange={handleChange}
          >
            <option value="">Все способы</option>
            {availableMethods.map((method) => (
              <option key={method} value={method}>
                {method}
              </option>
            ))}
          </select>
        </div>

        <div className="filter-modal__section">
          <label>Количество товаров, шт.</label>
          <div className="filter-modal__range">
            <input
              type="number"
              name="min_quantity"
              placeholder="от"
              value={filters.min_quantity || ""}
              onChange={handleChange}
              min="0"
            />
            <input
              type="number"
              name="max_quantity"
              placeholder="до"
              value={filters.max_quantity || ""}
              onChange={handleChange}
              min="0"
            />
          </div>
        </div>

        <div className="filter-modal__section">
          <label>Сумма, сом</label>
          <div className="filter-modal__range">
            <input
              type="number"
              name="min_total"
              placeholder="от"
              value={filters.min_total || ""}
              onChange={handleChange}
              min="0"
              step="0.01"
            />
            <input
              type="number"
              name="max_total"
              placeholder="до"
              value={filters.max_total || ""}
              onChange={handleChange}
              min="0"
              step="0.01"
            />
          </div>
        </div>

        <div className="filter-modal__footer">
          <button className="filter-modal__reset" onClick={handleReset}>
            Сбросить фильтры
          </button>
          <button className="filter-modal__apply" onClick={handleApply}>
            Применить фильтры
          </button>
        </div>
      </div>
    </div>
  );
};

/* ======================= Add Modal (без кассы) ======================= */
const AddModal = ({ onClose, onSaveSuccess }) => {
  const { list } = useClient();
  const dispatch = useDispatch();
  const { creating, createError, brands, categories, barcodeError } =
    useProducts();
  const { company } = useUser();

  const [activeTab, setActiveTab] = useState(null);
  const [isTabSelected, setIsTabSelected] = useState(false);

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

  // форма быстрого создания поставщика
  const { 0: state, 1: setState } = useState({
    full_name: "",
    phone: "",
    email: "",
    date: new Date().toISOString().split("T")[0],
    type: "suppliers",
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
      brand_name === "" ||
      category_name === "" ||
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
      status: "pending",
    };

    try {
      await dispatch(createProductAsync(payload)).unwrap();
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
      content: <AddProductBarcode />,
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
                <option key={idx} value={brand.name}>
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
                <option key={idx} value={category.name}>
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
                <option key={idx} value={client.id}>
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
                <button className="create-client">Создать</button>
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
  }, [dispatch]);

  useEffect(() => {
    if (barcodeError) {
      setActiveTab(1);
      setIsTabSelected(true);
    }
  }, [barcodeError]);

  return (
    <div className="add-modal">
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
          <>
            {/* Дублируем форму вручную (как в табе "Вручную") */}
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
                  <option key={idx} value={brand.name}>
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
                  <option key={idx} value={category.name}>
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
                  <option key={idx} value={client.id}>
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
                  <button className="create-client">Создать</button>
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
        )}
      </div>
    </div>
  );
};

/* ======================= Main: Zakaz (без кассы) ======================= */
export default function Zakaz() {
  const dispatch = useDispatch();

  const {
    list: products,
    loading,
    brands,
    categories,
    error,
    count,
    next,
    previous,
    creating,
    updating,
    deleting,
  } = useSelector((state) => state.product);

  const {
    list: productsList,
    loading: productsLoading,
    error: productsError,
  } = useSelector((state) => state.product);

  const [showEditModal, setShowEditModal] = useState(false);
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  const [currentFilters, setCurrentFilters] = useState({
    status: undefined,
    method: undefined,
    min_quantity: undefined,
    max_quantity: undefined,
    min_total: undefined,
    max_total: undefined,
  });

  useEffect(() => {
    const params = {
      page: currentPage,
      search: searchTerm,
      ...currentFilters,
    };
    dispatch(fetchOrdersAsync(params));
    dispatch(fetchProductsAsync());

    return () => {
      dispatch(clearOrders());
    };
  }, [dispatch, currentPage, searchTerm, deleting, currentFilters]);

  const handleSaveSuccess = () => {
    setShowEditModal(false);
    alert("успешно обновлен!");
    dispatch(
      fetchOrdersAsync({
        page: currentPage,
        search: searchTerm,
        ...currentFilters,
      })
    );
  };

  const handleEdit = (order) => {
    setSelectedOrder(order);
    setShowEditModal(true);
  };

  const handleSave = () => {
    setShowEditModal(false);
    dispatch(
      fetchOrdersAsync({
        page: currentPage,
        search: searchTerm,
        ...currentFilters,
      })
    );
  };

  const handleOrderDeleted = () => {
    alert("успешно удален!");
    dispatch(
      fetchOrdersAsync({
        page: currentPage,
        search: searchTerm,
        ...currentFilters,
      })
    );
  };

  const handleAdd = () => {
    setShowAddModal(true);
  };

  const handleSearchChange = (e) => {
    setSearchTerm(e.target.value);
    setCurrentPage(1);
  };

  const handleClearSearch = () => {
    setSearchTerm("");
    setCurrentPage(1);
  };

  const handleNextPage = () => {
    if (next) {
      setCurrentPage((prev) => prev + 1);
    }
  };

  const handlePreviousPage = () => {
    if (previous) {
      setCurrentPage((prev) => prev - 1);
    }
  };

  const handleApplyFilters = (filters) => {
    setCurrentFilters(filters);
    setCurrentPage(1);
  };

  const handleResetAllFilters = () => {
    setSearchTerm("");
    setCurrentFilters({
      status: undefined,
      method: undefined,
      min_quantity: undefined,
      max_quantity: undefined,
      min_total: undefined,
      max_total: undefined,
    });
    setCurrentPage(1);
  };

  const isFiltered = searchTerm || Object.keys(currentFilters).length > 0;
  const productsFilter = products.filter((item) => item.status === "pending");

  // const totalPages = ...
  // const currentPageDisplay = currentPage;

  const getProductNameById = (productId) => {
    const product = productsList.find((p) => p.id === productId);
    return product ? product.name : "Неизвестный продукт";
  };

  const kindTranslate = {
    new: "Новый",
    pending: "В процессе",
    completed: "Завершен",
  };

  return (
    <div className="zakaz">
      <div className="sklad__header">
        <div className="sklad__left">
          <input
            type="text"
            placeholder="Поиск по названию товара"
            className="sklad__search"
            value={searchTerm}
            onChange={handleSearchChange}
          />

          <select className="employee__search-wrapper">
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>

          <div className="sklad__center">
            <span>Всего: {count !== null ? count : "-"}</span>
            <span>Найдено: {products.length}</span>
            {isFiltered && (
              <span
                className="sklad__reset"
                onClick={handleResetAllFilters}
                style={{ cursor: "pointer" }}
              >
                Сбросить
              </span>
            )}
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
          <button className="sklad__add" onClick={handleAdd}>
            <Plus size={16} style={{ marginRight: "4px" }} /> Добавить товар
          </button>
        </div>
      </div>

      {loading ? (
        <p className="sklad__loading-message">Загрузка товаров...</p>
      ) : error ? (
        <p className="sklad__error-message">
          Ошибка загрузки:
          {/* {error.detail || error.message || JSON.stringify(error)} */}
        </p>
      ) : productsFilter.length === 0 ? (
        <p className="sklad__no-products-message">Нет доступных товаров.</p>
      ) : (
        <div className="table-wrapper">
          <table className="sklad__table">
            <thead>
              <tr>
                <th>
                  <input type="checkbox" />
                </th>
                <th></th>
                <th>№</th>
                <th>Название</th>
                <th>Поставщик</th>
                <th>Цена</th>
                <th>Количество</th>
                <th>Категория</th>
              </tr>
            </thead>
            <tbody>
              {productsFilter.map((item, index) => (
                <tr key={item.id}>
                  <td>
                    <input type="checkbox" />
                  </td>
                  <td>
                    <MoreVertical
                      size={16}
                      onClick={() => handleEdit(item)}
                      style={{ cursor: "pointer" }}
                    />
                  </td>
                  <td>{index + 1}</td>
                  <td>
                    <strong>{item.name}</strong>
                  </td>
                  <td>{item.client_name ? item.client_name : "-"}</td>
                  <td>{item.price}</td>
                  <td>{item.quantity}</td>
                  <td>{item.category}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Пагинацию при необходимости можно вернуть */}
      {/* <div className="zakaz__pagination"> ... </div> */}

      {showEditModal && (
        <EditModal
          order={selectedOrder}
          onClose={() => setShowEditModal(false)}
          onSaveSuccess={handleSaveSuccess}
          onDeleteConfirm={handleOrderDeleted}
          productsList={productsList}
        />
      )}

      {showFilterModal && (
        <FilterModal
          onClose={() => setShowFilterModal(false)}
          currentFilters={currentFilters}
          onApplyFilters={handleApplyFilters}
          onResetFilters={handleResetAllFilters}
        />
      )}

      {showAddModal && (
        <AddModal
          onClose={() => setShowAddModal(false)}
          onSaveSuccess={handleSaveSuccess}
        />
      )}
    </div>
  );
}
