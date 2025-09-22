// src/pages/Warehouse/FinishedGoods/FinishedGoods.jsx
import { MoreVertical, Plus } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";

/* ---- Thunks / Creators ---- */
import {
  createProductAsync,
  fetchBrandsAsync,
  fetchCategoriesAsync,
  fetchProductsAsync,
  getItemsMake, // сырьё из бэка
  consumeItemsMake,
} from "../../../../store/creators/productCreators";

/* ---- Cash ---- */
import {
  addCashFlows,
  getCashBoxes,
  useCash,
} from "../../../../store/slices/cashSlice";

/* ---- Products slice selector ---- */
import { useProducts } from "../../../../store/slices/productSlice";

/* ---- Clients ---- */
import {
  fetchClientsAsync,
  createClientAsync,
} from "../../../../store/creators/clientCreators";
import { useClient } from "../../../../store/slices/ClientSlice";

/* ---- UI ---- */
import CheckBoxIcon from "@mui/icons-material/CheckBox";
import CheckBoxOutlineBlankIcon from "@mui/icons-material/CheckBoxOutlineBlank";
import { Checkbox, TextField } from "@mui/material";

/* ============================================================
   Модалка добавления товара (Redux, без localStorage)
   ============================================================ */
const AddModal = ({ onClose, onSaveSuccess, selectCashBox }) => {
  const dispatch = useDispatch();

  // Категории/бренды из product slice
  const { categories, brands } = useProducts();

  // Сырьё: product.itemsMake
  const materials = useSelector((s) => s.product?.itemsMake ?? []);
  const materialsLoading =
    useSelector(
      (s) => s.product?.itemsMakeLoading ?? s.product?.loadingItemsMake
    ) ?? false;

  // Поставщики
  const { list: clients } = useClient();
  const suppliers = useMemo(
    () => (clients || []).filter((c) => c.type === "suppliers"),
    [clients]
  );

  // Форма товара
  const [product, setProduct] = useState({
    name: "",
    barcode: "",
    brand_name: "",
    category_name: "",
    price: "",
    quantity: "",
    client: "",
    purchase_price: "",
  });

  // Движение по кассе
  const [cashData, setCashData] = useState({
    cashbox: "",
    type: "expense",
    name: "",
    amount: "",
  });

  // Быстрое создание поставщика
  const [showSupplierForm, setShowSupplierForm] = useState(false);
  const [supplier, setSupplier] = useState({
    full_name: "",
    phone: "",
    email: "",
    date: new Date().toISOString().split("T")[0],
    type: "suppliers",
  });

  // Рецепт: [{ materialId, quantity? }] — quantity только для UI
  const [recipeItems, setRecipeItems] = useState([]);
  const [materialsOpen, setMaterialsOpen] = useState(false);
  const [materialQuery, setMaterialQuery] = useState("");

  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState(null);

  // Карта выбранных материалов
  const recipeMap = useMemo(() => {
    const m = new Map();
    recipeItems.forEach((it) =>
      m.set(String(it.materialId), String(it.quantity ?? ""))
    );
    return m;
  }, [recipeItems]);

  // Фильтрация сырья
  const filteredMaterials = useMemo(() => {
    const list = Array.isArray(materials) ? materials : [];
    const q = materialQuery.trim().toLowerCase();
    if (!q) return list;
    return list.filter((m) =>
      (m.name || m.title || "").toLowerCase().includes(q)
    );
  }, [materials, materialQuery]);

  // Подгрузка в модалке
  useEffect(() => {
    dispatch(getItemsMake());
    dispatch(fetchClientsAsync());
    dispatch(fetchCategoriesAsync());
    dispatch(fetchBrandsAsync());
  }, [dispatch]);

  // Хэндлеры
  const onProductChange = (e) => {
    const { name, value, type } = e.target;
    setProduct((prev) => ({
      ...prev,
      [name]: type === "number" ? (value === "" ? "" : Number(value)) : value,
    }));
  };

  const onSupplierChange = (e) => {
    const { name, value } = e.target;
    setSupplier((prev) => ({ ...prev, [name]: value }));
  };

  const createSupplier = async (e) => {
    e.preventDefault();
    if (!supplier.full_name?.trim()) {
      alert("Укажите ФИО поставщика");
      return;
    }
    try {
      await dispatch(createClientAsync(supplier)).unwrap();
      setShowSupplierForm(false);
    } catch (err) {
      alert(`Не удалось создать поставщика: ${err?.message || "ошибка"}`);
    }
  };

  // Рецепт — выбор/изменение/удаление
  const toggleRecipeItem = (materialId) => {
    const key = String(materialId);
    const exists = recipeMap.has(key);
    if (exists) {
      setRecipeItems((prev) =>
        prev.filter((it) => String(it.materialId) !== key)
      );
    } else {
      setRecipeItems((prev) => [...prev, { materialId, quantity: "1" }]);
    }
  };

  const changeRecipeQty = (materialId, qty) => {
    const key = String(materialId);
    setRecipeItems((prev) =>
      prev.map((it) =>
        String(it.materialId) === key ? { ...it, quantity: qty } : it
      )
    );
  };

  const removeRecipeItem = (materialId) => {
    const key = String(materialId);
    setRecipeItems((prev) =>
      prev.filter((it) => String(it.materialId) !== key)
    );
  };

  // валидатор товара
  const validateProduct = () => {
    const required = [
      ["name", "Название"],
      ["barcode", "Штрихкод"],
      ["brand_name", "Бренд"],
      ["category_name", "Категория"],
      ["price", "Розничная цена"],
      ["purchase_price", "Закупочная цена"],
      ["quantity", "Количество"],
      ["client", "Поставщик"],
    ];
    const missed = required.filter(
      ([k]) => product[k] === "" || product[k] === null
    );
    if (missed.length) {
      alert("Пожалуйста, заполните все обязательные поля.");
      return false;
    }
    return true;
  };

  // submit
  const handleSubmit = async () => {
    setCreateError(null);
    if (!validateProduct()) return;

    // рецепт для списания: [{id, qty_per_unit}]
    const recipe = recipeItems
      .map((it) => ({
        id: String(it.materialId),
        qty_per_unit: Number(it.quantity || 0),
      }))
      .filter((r) => r.qty_per_unit > 0);

    // сколько ед. готового товара делаем
    const units = Number(product.quantity || 0);

    // item_make — только ID (если бэку нужно хранить связку)
    const item_make = recipeItems.map((it) => it.materialId);

    setCreating(true);
    try {
      // 1) списание сырья
      if (recipe.length && units > 0) {
        await dispatch(consumeItemsMake({ recipe, units })).unwrap();
      }

      // 2) движение по кассе
      await dispatch(
        addCashFlows({
          ...cashData,
          amount: (
            Number(product?.purchase_price || 0) *
            Number(product?.quantity || 0)
          ).toFixed(2),
        })
      ).unwrap();

      // 3) создание товара
      const payload = {
        name: product.name,
        barcode: product.barcode,
        brand_name: product.brand_name,
        category_name: product.category_name,
        price: Number(product.price),
        quantity: Number(product.quantity),
        client: product.client, // id поставщика
        purchase_price: Number(product.purchase_price),
        item_make,
      };

      await dispatch(createProductAsync(payload)).unwrap();

      setCreating(false);
      onClose?.();
      onSaveSuccess?.();
    } catch (err) {
      setCreating(false);
      setCreateError(err);
      alert(
        `Ошибка при добавлении товара: ${err?.message || "неизвестная ошибка"}`
      );
    }
  };

  // актуализируем данные по кассе при изменениях
  useEffect(() => {
    setCashData((prev) => ({
      ...prev,
      cashbox: selectCashBox,
      name: product.name,
      amount: product.price,
    }));
  }, [product, selectCashBox]);

  /* ------------------------ Верстка ------------------------ */
  return (
    <div className="add-modal">
      <div className="add-modal__overlay" onClick={onClose} />
      <div className="add-modal__content">
        <div className="add-modal__header">
          <h3>Добавление товара</h3>
          <button className="add-modal__close-icon" onClick={onClose}>
            ✕
          </button>
        </div>

        {createError && (
          <p className="add-modal__error-message">
            Ошибка добавления: {createError.message || "ошибка"}
          </p>
        )}

        {/* Основные поля */}
        <div className="add-modal__section">
          <label>Название *</label>
          <input
            name="name"
            className="add-modal__input"
            placeholder="Например, Буханка хлеба"
            value={product.name}
            onChange={onProductChange}
            required
          />
        </div>

        <div className="add-modal__section">
          <label>Штрих код *</label>
          <input
            name="barcode"
            className="add-modal__input"
            placeholder="Штрих код"
            value={product.barcode}
            onChange={onProductChange}
            required
          />
        </div>

        <div className="add-modal__section">
          <label>Бренд *</label>
          <select
            name="brand_name"
            className="add-modal__input"
            value={product.brand_name}
            onChange={onProductChange}
            required
          >
            <option value="">-- Выберите бренд --</option>
            {brands.map((b) => (
              <option key={b.id} value={b.name}>
                {b.name}
              </option>
            ))}
          </select>
        </div>

        <div className="add-modal__section">
          <label>Категория *</label>
          <select
            name="category_name"
            className="add-modal__input"
            value={product.category_name}
            onChange={onProductChange}
            required
          >
            <option value="">-- Выберите категорию --</option>
            {categories.map((c) => (
              <option key={c.id} value={c.name}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        {/* Поставщик + быстрое создание */}
        <div className="add-modal__section">
          <label>Поставщик *</label>
          <select
            name="client"
            className="add-modal__input"
            value={product.client}
            onChange={onProductChange}
            required
          >
            <option value="">-- Выберите поставщика --</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.full_name}
              </option>
            ))}
          </select>

          <button
            className="create-client"
            onClick={() => setShowSupplierForm((v) => !v)}
          >
            {showSupplierForm ? "Отменить" : "Создать поставщика"}
          </button>

          {showSupplierForm && (
            <form
              onSubmit={createSupplier}
              style={{ display: "flex", flexDirection: "column", rowGap: 10 }}
            >
              <input
                className="add-modal__input"
                name="full_name"
                placeholder="ФИО"
                value={supplier.full_name}
                onChange={onSupplierChange}
              />
              <input
                className="add-modal__input"
                name="phone"
                placeholder="Телефон"
                value={supplier.phone}
                onChange={onSupplierChange}
              />
              <input
                className="add-modal__input"
                type="email"
                name="email"
                placeholder="Почта"
                value={supplier.email}
                onChange={onSupplierChange}
              />
              <button className="create-client" type="submit">
                Создать
              </button>
            </form>
          )}
        </div>

        {/* Цена и количество */}
        <div className="add-modal__section">
          <label>Розничная цена *</label>
          <input
            type="number"
            name="price"
            className="add-modal__input"
            placeholder="120"
            value={product.price}
            onChange={onProductChange}
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
            className="add-modal__input"
            placeholder="80"
            value={product.purchase_price}
            onChange={onProductChange}
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
            className="add-modal__input"
            placeholder="100"
            value={product.quantity}
            onChange={onProductChange}
            min="0"
            required
          />
        </div>

        {/* Состав (сырьё) */}
        <div className="add-modal__section">
          <div
            className="select-materials__head"
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 12,
            }}
          >
            <label>Состав (сырьё) — на 1 ед. готового товара</label>
            <button
              type="button"
              className="create-client"
              onClick={() => setMaterialsOpen((prev) => !prev)}
              disabled={materialsLoading}
            >
              {materialsOpen
                ? "Скрыть список"
                : materialsLoading
                ? "Загрузка…"
                : "+ Добавить сырьё"}
            </button>
          </div>

          {materialsOpen && (
            <div
              className="select-materials__head-search"
              style={{ marginTop: 8 }}
            >
              <input
                className="add-modal__input"
                name="materialQuery"
                placeholder="Поиск сырья"
                value={materialQuery}
                onChange={(e) => setMaterialQuery(e.target.value)}
              />
            </div>
          )}

          {materialsOpen && (
            <div
              className="select-materials__check active"
              style={{
                marginTop: 8,
                position: "relative",
                maxHeight: 260,
                overflow: "auto",
                border: "1px solid var(--border,#333)",
                borderRadius: 8,
                padding: 8,
              }}
            >
              {filteredMaterials?.map((m) => {
                const checked = recipeMap.has(String(m.id));
                const qty = recipeMap.get(String(m.id)) ?? "";

                return (
                  <div
                    key={m.id}
                    className="select-materials__item"
                    style={{
                      display: "grid",
                      gridTemplateColumns: "auto 1fr 160px",
                      alignItems: "center",
                      gap: 8,
                      padding: "6px 4px",
                    }}
                  >
                    <Checkbox
                      icon={<CheckBoxOutlineBlankIcon sx={{ fontSize: 28 }} />}
                      checkedIcon={<CheckBoxIcon sx={{ fontSize: 28 }} />}
                      checked={checked}
                      onChange={() => toggleRecipeItem(m.id)}
                      sx={{
                        color: "#000",
                        "&.Mui-checked": { color: "#f9cf00" },
                      }}
                    />
                    <p
                      title={m.name ?? m.title ?? `#${m.id}`}
                      style={{
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {m.name ?? m.title ?? `#${m.id}`}
                    </p>
                    <TextField
                      size="small"
                      placeholder="Кол-во на 1 ед. (не обязательно)"
                      type="number"
                      inputProps={{ step: "0.0001", min: "0" }}
                      disabled={!checked}
                      value={qty}
                      onChange={(e) => changeRecipeQty(m.id, e.target.value)}
                    />
                  </div>
                );
              })}

              {(!filteredMaterials || filteredMaterials.length === 0) &&
                !materialsLoading && (
                  <div style={{ padding: 8, opacity: 0.7 }}>
                    Ничего не найдено…
                  </div>
                )}
            </div>
          )}

          {recipeItems.length > 0 && (
            <div
              className="select-materials__selected"
              style={{ marginTop: 10 }}
            >
              {recipeItems.map((it) => {
                const mat = (Array.isArray(materials) ? materials : []).find(
                  (m) => String(m.id) === String(it.materialId)
                );
                return (
                  <div
                    key={it.materialId}
                    className="select-materials__selected-item"
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 160px 40px",
                      alignItems: "center",
                      gap: 8,
                      padding: "6px 0",
                      borderBottom: "1px dashed var(--border,#444)",
                    }}
                  >
                    <div
                      style={{ display: "flex", alignItems: "center", gap: 8 }}
                    >
                      <Checkbox
                        checked
                        onChange={() => removeRecipeItem(it.materialId)}
                        sx={{
                          color: "#000",
                          "&.Mui-checked": { color: "#f9cf00" },
                        }}
                      />
                      <p>{mat?.name ?? mat?.title ?? `ID ${it.materialId}`}</p>
                    </div>
                    <TextField
                      size="small"
                      placeholder="Кол-во на 1 ед. (не обязательно)"
                      type="number"
                      inputProps={{ step: "0.0001", min: "0" }}
                      value={it.quantity}
                      onChange={(e) =>
                        changeRecipeQty(it.materialId, e.target.value)
                      }
                    />
                    <button
                      type="button"
                      className="select-materials__remove"
                      onClick={() => removeRecipeItem(it.materialId)}
                      aria-label="Удалить"
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 8,
                        border: "1px solid var(--border,#444)",
                        background: "transparent",
                        color: "inherit",
                        cursor: "pointer",
                      }}
                    >
                      ×
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Кнопки */}
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
            disabled={creating || materialsLoading}
          >
            {creating ? "Добавление..." : "Добавить"}
          </button>
        </div>
      </div>
    </div>
  );
};

/* ============================================================
   Основной экран «Склад готовой продукции»
   ============================================================ */
const FinishedGoods = () => {
  const dispatch = useDispatch();
  const { list: products, categories, loading, error } = useProducts();
  const { list: cashBoxes } = useCash();

  const [cashboxId, setCashboxId] = useState("");
  const [showAdd, setShowAdd] = useState(false);

  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");

  useEffect(() => {
    dispatch(fetchProductsAsync());
    dispatch(fetchCategoriesAsync());
    dispatch(getCashBoxes());
    dispatch(getItemsMake()); // сырьё для модалки
    dispatch(fetchBrandsAsync());
  }, [dispatch]);

  const onSaveSuccess = () => {
    setShowAdd(false);
    dispatch(fetchProductsAsync());
    dispatch(getItemsMake());
  };

  // простая фильтрация по названию и категории на клиенте
  const viewProducts = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter((p) => {
      const okName = !q || (p.name || "").toLowerCase().includes(q);
      const okCat =
        !categoryFilter ||
        String(p.category_id || p.category)?.toLowerCase() ===
          String(categoryFilter).toLowerCase();
      return okName && okCat;
    });
  }, [products, search, categoryFilter]);

  return (
    <div className="sklad__warehouse">
      <div className="sklad__header">
        <div className="sklad__left">
          <input
            type="text"
            placeholder="Поиск по названию товара"
            className="sklad__search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select
            className="employee__search-wrapper"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
          >
            <option value="">Все категории</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id ?? cat.name}>
                {cat.name}
              </option>
            ))}
          </select>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <select
            value={cashboxId}
            onChange={(e) => setCashboxId(e.target.value)}
            className="employee__search-wrapper"
          >
            <option value="">Выберите кассу</option>
            {cashBoxes?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name ?? c.department_name}
              </option>
            ))}
          </select>

          <button
            className="sklad__add"
            onClick={() => setShowAdd(true)}
            disabled={!cashboxId}
            title={!cashboxId ? "Сначала выберите кассу" : undefined}
          >
            <Plus size={16} style={{ marginRight: 4 }} />
            Добавить товар
          </button>
        </div>
      </div>

      {loading ? (
        <p className="sklad__loading-message">Загрузка товаров...</p>
      ) : error ? (
        <p className="sklad__error-message">Ошибка загрузки</p>
      ) : viewProducts.length === 0 ? (
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
              {viewProducts.map((item, idx) => (
                <tr key={item.id}>
                  <td>
                    <input type="checkbox" />
                  </td>
                  <td>
                    <MoreVertical size={16} style={{ cursor: "pointer" }} />
                  </td>
                  <td>{idx + 1}</td>
                  <td>
                    <strong>{item.name}</strong>
                  </td>
                  <td>{item.client_name || "-"}</td>
                  <td>{item.price}</td>
                  <td>{item.quantity}</td>
                  <td>{item.category || item.category_name || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showAdd && (
        <AddModal
          onClose={() => setShowAdd(false)}
          onSaveSuccess={onSaveSuccess}
          selectCashBox={cashboxId}
        />
      )}
    </div>
  );
};

export default FinishedGoods;
