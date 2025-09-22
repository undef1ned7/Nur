import React, { useEffect, useState } from "react";
import { useProducts } from "../../../../store/slices/productSlice";
import { useDispatch } from "react-redux";
import {
  createItemMake,
  fetchCategoriesAsync,
  fetchProductsAsync,
  getItemsMake,
} from "../../../../store/creators/productCreators";
import {
  addCashFlows,
  getCashBoxes,
  useCash,
} from "../../../../store/slices/cashSlice";
import { MoreVertical, Plus } from "lucide-react";

const AddModal = ({ onClose, selectCashBox }) => {
  const [state, setState] = useState({
    name: "",
    price: "",
    count: "",
    unit: "",
  });
  const dispatch = useDispatch();
  const onChange = (e) => {
    const { name, value } = e.target;
    setState((prev) => ({ ...prev, [name]: value }));
  };
  const [cashData, setCashData] = useState({
    cashbox: "",
    type: "expense",
    name: "",
    amount: "",
  });

  const onSubmit = async (e) => {
    e.preventDefault();

    try {
      await dispatch(
        addCashFlows({
          ...cashData,
          amount: state?.price * state?.count,
        })
      ).unwrap();
      await dispatch(createItemMake(state)).unwrap();
      onClose();
    } catch (e) {
      console.log(e);
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
  return (
    <div className="add-modal raw-modal">
      <div className="add-modal__overlay" onClick={onClose} />
      <form className="add-modal__content" onSubmit={onSubmit}>
        <div className="add-modal__header">
          <h3>Добавление сырья</h3>
          <button className="add-modal__close-icon" onClick={onClose}>
            ✕
          </button>
        </div>
        <div className="add-modal__section">
          <label>Название *</label>
          <input
            type="text"
            name="name"
            placeholder="Название *"
            className="add-modal__input"
            value={state.name}
            onChange={onChange}
            required
          />
        </div>
        <div className="add-modal__section">
          <label>Ед. Измерения *</label>
          <input
            type="text"
            name="unit"
            placeholder="Ед. Измерения *"
            className="add-modal__input"
            value={state.unit}
            onChange={onChange}
            required
          />
        </div>
        <div className="add-modal__section">
          <label>Цена *</label>
          <input
            type="text"
            name="price"
            placeholder="Цена *"
            className="add-modal__input"
            value={state.price}
            onChange={onChange}
            required
          />
        </div>
        <div className="add-modal__section">
          <label>Количество *</label>
          <input
            type="text"
            name="count"
            placeholder="Количество *"
            className="add-modal__input"
            value={state.count}
            onChange={onChange}
            required
          />
        </div>
        <div className="add-modal__footer">
          <button
            className="add-modal__cancel"
            onClick={onClose}
            // disabled={creating}
          >
            Отмена
          </button>
          <button
            className="add-modal__save"
            // onClick={handleSubmit}
            // disabled={creating}
          >
            Добавить
          </button>
        </div>
      </form>
    </div>
  );
};

const RawMaterialsWarehouse = () => {
  const {
    // list: products,
    categories,
    loading,
    error,
    itemsMake: products,
  } = useProducts();
  const { list: cashBoxes } = useCash();
  const [selectCashBox, setSelectCashBox] = useState("");
  const dispatch = useDispatch();
  const [showAddModal, setShowAddModal] = useState(false);

  useEffect(() => {
    dispatch(fetchProductsAsync());
    dispatch(fetchCategoriesAsync());
    dispatch(getCashBoxes());
    dispatch(getItemsMake());
  }, []);
  return (
    <div className="sklad__warehouse">
      <div className="sklad__header">
        <div className="sklad__left">
          <input
            type="text"
            placeholder="Поиск по названию товара"
            className="sklad__search"
          />
          <select className="employee__search-wrapper">
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
          <select
            value={selectCashBox}
            onChange={(e) => setSelectCashBox(e.target.value)}
            className="employee__search-wrapper"
          >
            <option value="" disabled>
              Выберите кассу
            </option>
            {cashBoxes?.map((cash) => (
              <option key={cash.id} value={cash.id}>
                {cash.name ?? cash.department_name}
              </option>
            ))}
          </select>
          <button
            className="sklad__add"
            onClick={() => setShowAddModal(true)}
            disabled={!selectCashBox}
            title={!selectCashBox ? "Сначала выберите кассу" : undefined}
          >
            <Plus size={16} style={{ marginRight: "4px" }} /> Добавить товар
          </button>
        </div>
      </div>
      {loading ? (
        <p className="sklad__loading-message">Загрузка товаров...</p>
      ) : error ? (
        <p className="sklad__error-message">Ошибка загрузки:</p>
      ) : products?.length === 0 ? (
        <p className="sklad__no-products-message">Нет доступных товаров.</p>
      ) : (
        <div className="table-wrapper">
          <table className="sklad__table">
            <thead>
              <tr>
                <th>
                  <input
                    type="checkbox"
                    // checked={
                    //   products.length > 0 &&
                    //   products.every((i) => selectedIds.has(i.id))
                    // }
                    // onChange={() => toggleSelectAllOnPage(products)}
                  />
                </th>
                {/* <th></th> */}
                <th>№</th>
                <th>Название</th>
                {/* <th>Поставщик</th> */}
                <th>Цена</th>
                <th>Количество</th>
                {/* <th>Категория</th> */}
              </tr>
            </thead>
            <tbody>
              {products?.map((item, index) => (
                <tr key={item.id}>
                  <td>
                    {/* ★ чекбокс строки */}
                    <input
                      type="checkbox"
                      // checked={isSelected(item.id)}
                      // onChange={() => toggleRow(item.id)}
                    />
                  </td>
                  {/* <td>
                    <MoreVertical
                      size={16}
                      // onClick={() => handleEdit(item)}
                      style={{ cursor: "pointer" }}
                    />
                  </td> */}
                  <td>{index + 1}</td>
                  <td>
                    <strong>{item.name}</strong>
                  </td>
                  {/* <td>{item.client_name ? item.client_name : "-"}</td> */}
                  <td>{item.price}</td>
                  <td>{item.quantity}</td>
                  {/* <td>{item.category}</td> */}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {showAddModal && (
        <AddModal
          onClose={() => setShowAddModal(false)}
          selectCashBox={selectCashBox}
        />
      )}
    </div>
  );
};

export default RawMaterialsWarehouse;
