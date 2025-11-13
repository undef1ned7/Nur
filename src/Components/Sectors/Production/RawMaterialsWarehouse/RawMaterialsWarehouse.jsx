import React, { useEffect, useMemo, useState } from "react";
import { useProducts } from "../../../../store/slices/productSlice";
import { useDispatch } from "react-redux";
import {
  createItemMake,
  fetchCategoriesAsync,
  fetchProductsAsync,
  getItemsMake,
  // EDIT: добавлены санки редактирования/удаления сырья
  updateItemsMake,
  deleteItemsMake,
} from "../../../../store/creators/productCreators";
import {
  addCashFlows,
  getCashBoxes,
  useCash,
} from "../../../../store/slices/cashSlice";
import { Plus, X } from "lucide-react";
import { useUser } from "../../../../store/slices/userSlice";
import AddProductModal from "../../../Deposits/Sklad/AddProduct/AddProductModal";
import AddRawMaterials from "../AddRawMaterials/AddRawMaterials";

/* ---------- helpers ---------- */
const toStartOfDay = (d) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
};
const toEndOfDay = (d) => {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
};
const safeDate = (s) => {
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
};

/* =========================================
   AddModal — добавление сырья
   ========================================= */
const AddModal = ({ onClose, selectCashBox, onSaved }) => {
  const { company } = useUser();
  const [state, setState] = useState({
    name: "",
    price: "",
    quantity: "",
    unit: "",
  });
  const dispatch = useDispatch();
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

  const onChange = (e) => {
    const { name, value } = e.target;
    setState((prev) => ({ ...prev, [name]: value }));
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    try {
      // EDIT: count -> quantity
      const result = await dispatch(createItemMake(state)).unwrap();

      await dispatch(
        addCashFlows({
          ...cashData,
          amount: (Number(state?.price) || 0) * (Number(state?.quantity) || 0),
          source_cashbox_flow_id: result.id,
        })
      ).unwrap();

      onSaved?.();
      onClose();
    } catch (e) {
      console.log(e);
      alert(`Ошибка: ${e?.message || "не удалось добавить сырьё"}`);
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
          <button
            className="add-modal__close-icon"
            onClick={onClose}
            type="button"
          >
            ✕
          </button>
        </div>

        <div className="add-modal__section">
          <label>Название *</label>
          <input
            name="name"
            value={state.name}
            onChange={onChange}
            required
            placeholder="Название *"
            className="add-modal__input"
          />
        </div>

        <div className="add-modal__section">
          <label>Ед. измерения *</label>
          <input
            name="unit"
            value={state.unit}
            onChange={onChange}
            required
            placeholder="Ед. измерения *"
            className="add-modal__input"
          />
        </div>

        <div className="add-modal__section">
          <label>Цена *</label>
          <input
            name="price"
            type="number"
            min="0"
            step="0.01"
            value={state.price}
            onChange={onChange}
            required
            placeholder="Цена *"
            className="add-modal__input"
          />
        </div>

        <div className="add-modal__section">
          <label>Количество *</label>
          <input
            name="quantity"
            type="number"
            min="0"
            step="0.0001"
            value={state.quantity}
            onChange={onChange}
            required
            placeholder="Количество *"
            className="add-modal__input"
          />
        </div>

        <div className="add-modal__footer">
          <button className="add-modal__cancel" onClick={onClose} type="button">
            Отмена
          </button>
          <button className="add-modal__save">Добавить</button>
        </div>
      </form>
    </div>
  );
};

/* =========================================
   EditModal — редактирование/удаление сырья
   Поля: name, unit, price, quantity
   ========================================= */
const EditModal = ({ item, onClose, onSaved, onDeleted }) => {
  const dispatch = useDispatch();
  const [form, setForm] = useState({
    name: item?.name ?? "",
    unit: item?.unit ?? "",
    price: item?.price ?? "",
    quantity: item?.quantity ?? "",
  });

  const [saving, setSaving] = useState(false);

  const [deleting, setDeleting] = useState(false);

  const onChange = (e) => {
    const { name, value, type } = e.target;
    setForm((p) => ({
      ...p,
      [name]: type === "number" ? (value === "" ? "" : value) : value,
    }));
  };

  const onSave = async () => {
    try {
      setSaving(true);
      const payload = {
        ...form,
        price: Number(form.price),
        quantity: Number(form.quantity),
      };

      await dispatch(
        updateItemsMake({ id: item.id, updatedData: payload })
      ).unwrap();

      setSaving(false);
      onSaved?.();
      onClose();
    } catch (e) {
      setSaving(false);
      console.error(e);
      alert(`Не удалось обновить: ${e?.message || "ошибка"}`);
    }
  };

  const onDelete = async () => {
    if (!window.confirm(`Удалить сырьё «${item?.name}»?`)) return;
    try {
      setDeleting(true);
      await dispatch(deleteItemsMake(item.id)).unwrap();
      setDeleting(false);
      onDeleted?.();
      onClose();
    } catch (e) {
      setDeleting(false);
      console.error(e);
      alert(`Не удалось удалить: ${e?.message || "ошибка"}`);
    }
  };

  return (
    <div className="add-modal raw-modal">
      <div className="add-modal__overlay" onClick={onClose} />
      <div className="add-modal__content">
        <div className="add-modal__header">
          <h3>Редактирование сырья</h3>
          <X className="add-modal__close-icon" onClick={onClose} />
        </div>

        <div className="add-modal__section">
          <label>Название *</label>
          <input
            name="name"
            value={form.name}
            onChange={onChange}
            required
            className="add-modal__input"
          />
        </div>

        <div className="add-modal__section">
          <label>Ед. измерения *</label>
          <input
            name="unit"
            value={form.unit}
            onChange={onChange}
            required
            className="add-modal__input"
          />
        </div>

        <div className="add-modal__section">
          <label>Цена *</label>
          <input
            type="number"
            name="price"
            min="0"
            step="0.01"
            value={form.price}
            onChange={onChange}
            required
            className="add-modal__input"
          />
        </div>

        <div className="add-modal__section">
          <label>Количество *</label>
          <input
            type="number"
            name="quantity"
            min="0"
            step="0.0001"
            value={form.quantity}
            onChange={onChange}
            required
            className="add-modal__input"
          />
        </div>

        <div className="add-modal__footer">
          <button
            className="add-modal__cancel"
            onClick={onDelete}
            disabled={saving || deleting}
            style={{
              background: "transparent",
              border: "1px solid #e55",
              color: "#e55",
            }}
          >
            {deleting ? "Удаление..." : "Удалить"}
          </button>
          <button
            className="add-modal__save"
            onClick={onSave}
            disabled={saving || deleting}
          >
            {saving ? "Сохранение..." : "Сохранить"}
          </button>
        </div>
      </div>
    </div>
  );
};

/* =========================================
   Основной экран «Склад сырья»
   ========================================= */
const RawMaterialsWarehouse = () => {
  const { categories, loading, error, itemsMake: products } = useProducts();
  const { list: cashBoxes } = useCash();
  const dispatch = useDispatch();

  // --- UI state ---
  const [selectCashBox, setSelectCashBox] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);

  // EDIT: состояние для редактирования
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [itemId, setItemId] = useState(null);
  const [showAddProductModal, setShowAddProductModal] = useState(false);

  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  useEffect(() => {
    dispatch(fetchProductsAsync());
    dispatch(fetchCategoriesAsync());
    dispatch(getCashBoxes());
    dispatch(getItemsMake());
  }, [dispatch]);

  const refresh = () => {
    dispatch(getItemsMake());
  };

  // --- Filtering ---
  const filtered = useMemo(() => {
    const from = dateFrom ? toStartOfDay(dateFrom) : null;
    const to = dateTo ? toEndOfDay(dateTo) : null;
    const q = search.trim().toLowerCase();

    return (products || [])
      .filter((p) => {
        if (
          q &&
          !String(p.name || "")
            .toLowerCase()
            .includes(q)
        )
          return false;

        if (categoryId && String(p.category) !== String(categoryId))
          return false;

        const created = safeDate(p.created_at);
        if (!created) return false;
        if (from && created < from) return false;
        if (to && created > to) return false;

        return true;
      })
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  }, [products, search, categoryId, dateFrom, dateTo]);

  const handleOpen = (id) => {
    setShowAddProductModal(true);
    setItemId(id);
  };

  const resetFilters = () => {
    setSearch("");
    setCategoryId("");
    setDateFrom("");
    setDateTo("");
  };

  const openEdit = (item) => {
    setSelectedItem(item);
    setShowEditModal(true);
  };

  return (
    <div className="sklad__warehouse">
      <div className="sklad__header">
        <div
          className="sklad__left"
          style={{
            gap: 12,
            display: "flex",
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          <input
            type="text"
            placeholder="Поиск по названию товара"
            className="sklad__search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          <select
            className="employee__search-wrapper"
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
          >
            <option value="">Все категории</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>

          {/* Дата ОТ / ДО */}
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
            <Plus size={16} style={{ marginRight: 4 }} /> Добавить товар
          </button>
        </div>
      </div>

      <div
        className="date-filter"
        style={{
          display: "flex",
          gap: 8,
          alignItems: "center",
          marginTop: "15px",
        }}
      >
        <label style={{ opacity: 0.7 }}>От</label>
        <input
          type="date"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
          className="employee__search-wrapper"
        />
        <label style={{ opacity: 0.7 }}>До</label>
        <input
          type="date"
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
          className="employee__search-wrapper"
        />
        <button
          type="button"
          onClick={resetFilters}
          className="sklad__add"
          style={{ padding: "6px 10px" }}
        >
          Сбросить
        </button>
      </div>

      {/* Итоговая строка */}
      <div style={{ margin: "8px 0", opacity: 0.8 }}>
        Найдено: {filtered.length}
        {products?.length ? ` из ${products.length}` : ""}
      </div>

      {loading ? (
        <p className="sklad__loading-message">Загрузка товаров...</p>
      ) : error ? (
        <p className="sklad__error-message">Ошибка загрузки:</p>
      ) : filtered.length === 0 ? (
        <p className="sklad__no-products-message">
          Нет товаров по заданным фильтрам.
        </p>
      ) : (
        <div className="table-wrapper">
          <table className="sklad__table">
            <thead>
              <tr>
                <th>
                  <input type="checkbox" />
                </th>
                <th>№</th>
                <th>Название</th>
                <th>Ед.</th>
                <th>Дата</th>
                <th>Цена</th>
                <th>Количество</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((item, index) => (
                <tr key={item.id}>
                  <td>
                    <input type="checkbox" />
                  </td>
                  <td>{index + 1}</td>
                  <td>
                    <strong>{item.name}</strong>
                  </td>
                  <td>{item.unit || "-"}</td>
                  <td>{new Date(item.created_at).toLocaleString()}</td>
                  <td>{item.price}</td>
                  <td>
                    {item.quantity === 0 ? (
                      <span className="sell__badge--danger">Нет в наличии</span>
                    ) : (
                      item.quantity
                    )}
                  </td>
                  <td>
                    <button
                      className="btn edit-btn"
                      style={{ marginRight: 10 }}
                      onClick={() => handleOpen(item)}
                    >
                      Добавить
                    </button>
                    <button
                      type="button"
                      className="btn edit-btn"
                      // style={{ padding: "4px 8px" }}
                      onClick={() => openEdit(item)}
                    >
                      Редактировать
                    </button>
                  </td>
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
          onSaved={refresh}
        />
      )}

      {showEditModal && selectedItem && (
        <EditModal
          item={selectedItem}
          onClose={() => {
            setShowEditModal(false);
            setSelectedItem(null);
          }}
          onSaved={refresh}
          onDeleted={refresh}
        />
      )}
      {showAddProductModal && (
        <AddRawMaterials
          onClose={() => setShowAddProductModal(false)}
          onChanged={() => dispatch(getItemsMake()).unwrap()}
          item={itemId}
        />
      )}
    </div>
  );
};

export default RawMaterialsWarehouse;
