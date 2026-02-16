import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useDispatch } from "react-redux";
import {
  X,
  Edit3,
  Save,
  XCircle,
  Package,
  Factory,
  Search,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import api from "../../../../api";
import "../../Market/Warehouse/Warehouse.scss";
import "./ProductionWarehouseProductDetail.scss";

import {
  fetchBrandsAsync,
  fetchCategoriesAsync,
  getItemsMake,
  updateProductAsync,
} from "../../../../store/creators/productCreators";
import { fetchClientsAsync } from "../../../../store/creators/clientCreators";
import { useProducts } from "../../../../store/slices/productSlice";
import { useClient } from "../../../../store/slices/ClientSlice";

const toIdArray = (value) => {
  if (!Array.isArray(value)) return [];
  return value
    .map((x) => (x && typeof x === "object" ? x.id ?? x.uuid ?? x.pk : x))
    .filter((x) => x != null && x !== "")
    .map((x) => String(x));
};

const numOrNull = (v) => {
  if (v === "" || v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

const ProductionWarehouseProductDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const dispatch = useDispatch();

  const { brands, categories, itemsMake, itemsMakeLoading } = useProducts();
  const { list: clients } = useClient();
  const suppliers = useMemo(
    () => (clients || []).filter((c) => c.type === "suppliers"),
    [clients]
  );

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [product, setProduct] = useState(null);

  const [editMode, setEditMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  const [form, setForm] = useState({
    name: "",
    barcode: "",
    brand_name: "",
    category_name: "",
    unit: "",
    price: "",
    purchase_price: "",
    quantity: "",
    client: "",
    stock: false,
  });

  const [materialsQuery, setMaterialsQuery] = useState("");
  const [selectedMaterials, setSelectedMaterials] = useState(() => new Set());
  const [materialsOpen, setMaterialsOpen] = useState(true);
  // Рецепт: расход сырья на 1 единицу товара (qty_per_unit)
  // [{ materialId, qty_per_unit }]
  const [recipeItems, setRecipeItems] = useState([]);

  const recipeMap = useMemo(() => {
    const m = new Map();
    (Array.isArray(recipeItems) ? recipeItems : []).forEach((it) => {
      if (it?.materialId == null) return;
      m.set(String(it.materialId), String(it.qty_per_unit ?? ""));
    });
    return m;
  }, [recipeItems]);

  useEffect(() => {
    // На мобильных по умолчанию сворачиваем сырьё, чтобы экран не был перегружен
    if (typeof window !== "undefined" && window.innerWidth <= 768) {
      setMaterialsOpen(false);
    }
  }, []);

  const fetchProduct = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setLoadError("");
    try {
      const { data } = await api.get(`/main/products/${id}/`);
      setProduct(data);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error(e);
      setProduct(null);
      setLoadError(e?.response?.data?.detail || e?.message || "Товар не найден");
    } finally {
      setLoading(false);
    }
  }, [id]);

  // preload dictionaries needed for edits
  useEffect(() => {
    dispatch(fetchBrandsAsync());
    dispatch(fetchCategoriesAsync());
    dispatch(fetchClientsAsync());
    dispatch(getItemsMake());
  }, [dispatch]);

  useEffect(() => {
    fetchProduct();
  }, [fetchProduct]);

  // Sync form from product
  useEffect(() => {
    if (!product) return;
    setForm({
      name: product?.name ?? "",
      barcode: product?.barcode ?? "",
      brand_name: product?.brand_name ?? product?.brand ?? "",
      category_name: product?.category_name ?? product?.category ?? "",
      unit: product?.unit ?? "",
      price: product?.price ?? "",
      purchase_price: product?.purchase_price ?? "",
      quantity: product?.quantity ?? "",
      client: product?.client ?? product?.client_id ?? "",
      stock: Boolean(product?.stock),
    });

    // Пробуем взять рецепт из API (новый формат), иначе падаем обратно на item_make.
    const apiRecipe = Array.isArray(product?.recipe) ? product.recipe : null;
    if (apiRecipe && apiRecipe.length) {
      const normalized = apiRecipe
        .map((r) => {
          const rid =
            r?.id ?? r?.item_make_id ?? r?.item_make ?? r?.material_id ?? null;
          const qty = r?.qty_per_unit ?? r?.quantity ?? r?.qty ?? "";
          if (rid == null || rid === "") return null;
          return { materialId: String(rid), qty_per_unit: String(qty ?? "") };
        })
        .filter(Boolean);
      setRecipeItems(normalized);
      setSelectedMaterials(new Set(normalized.map((x) => String(x.materialId))));
    } else {
      const ids =
        toIdArray(product?.item_make) ||
        toIdArray(product?.items_make) ||
        toIdArray(product?.materials);
      setSelectedMaterials(new Set(ids));
      setRecipeItems(ids.map((mid) => ({ materialId: String(mid), qty_per_unit: "1" })));
    }
  }, [product]);

  const filteredMaterials = useMemo(() => {
    const q = String(materialsQuery || "").toLowerCase().trim();
    const list = Array.isArray(itemsMake) ? itemsMake : [];
    if (!q) return list;
    return list.filter((m) =>
      String(m?.name || "")
        .toLowerCase()
        .includes(q)
    );
  }, [itemsMake, materialsQuery]);

  const onChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((p) => ({ ...p, [name]: type === "checkbox" ? checked : value }));
  };

  const toggleMaterial = (materialId) => {
    const key = String(materialId);
    setSelectedMaterials((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

    setRecipeItems((prev) => {
      const arr = Array.isArray(prev) ? prev : [];
      const exists = arr.some((it) => String(it.materialId) === key);
      if (exists) {
        return arr.filter((it) => String(it.materialId) !== key);
      }
      return [...arr, { materialId: key, qty_per_unit: "1" }];
    });
  };

  const changeMaterialQtyPerUnit = (materialId, value) => {
    const key = String(materialId);
    setRecipeItems((prev) => {
      const arr = Array.isArray(prev) ? prev : [];
      const exists = arr.some((it) => String(it.materialId) === key);
      if (!exists) return [...arr, { materialId: key, qty_per_unit: String(value ?? "") }];
      return arr.map((it) =>
        String(it.materialId) === key ? { ...it, qty_per_unit: String(value ?? "") } : it
      );
    });
  };

  const onCancelEdit = () => {
    setEditMode(false);
    setSaveError("");
    // restore from product snapshot
    if (product) {
      setForm({
        name: product?.name ?? "",
        barcode: product?.barcode ?? "",
        brand_name: product?.brand_name ?? product?.brand ?? "",
        category_name: product?.category_name ?? product?.category ?? "",
        unit: product?.unit ?? "",
        price: product?.price ?? "",
        purchase_price: product?.purchase_price ?? "",
        quantity: product?.quantity ?? "",
        client: product?.client ?? product?.client_id ?? "",
        stock: Boolean(product?.stock),
      });
      const apiRecipe = Array.isArray(product?.recipe) ? product.recipe : null;
      if (apiRecipe && apiRecipe.length) {
        const normalized = apiRecipe
          .map((r) => {
            const rid =
              r?.id ?? r?.item_make_id ?? r?.item_make ?? r?.material_id ?? null;
            const qty = r?.qty_per_unit ?? r?.quantity ?? r?.qty ?? "";
            if (rid == null || rid === "") return null;
            return { materialId: String(rid), qty_per_unit: String(qty ?? "") };
          })
          .filter(Boolean);
        setRecipeItems(normalized);
        setSelectedMaterials(new Set(normalized.map((x) => String(x.materialId))));
      } else {
        const ids =
          toIdArray(product?.item_make) ||
          toIdArray(product?.items_make) ||
          toIdArray(product?.materials);
        setSelectedMaterials(new Set(ids));
        setRecipeItems(ids.map((mid) => ({ materialId: String(mid), qty_per_unit: "1" })));
      }
    }
  };

  const onSave = async () => {
    if (!id) return;
    setSaving(true);
    setSaveError("");
    try {
      // API рецепта допускает до 3 знаков после запятой
      const roundTo3 = (v) => Math.round(Number(v) * 1000) / 1000;

      const recipe = Array.from(selectedMaterials.values())
        .map((mid) => {
          const qty = recipeMap.get(String(mid));
          const qtyNum = roundTo3(qty ?? 0);
          return { id: String(mid), qty_per_unit: qtyNum };
        })
        .filter((r) => r.qty_per_unit > 0);

      const updatedData = {
        name: String(form.name || "").trim(),
        barcode: String(form.barcode || "").trim(),
        brand_name: form.brand_name || "",
        category_name: form.category_name || "",
        unit: String(form.unit || "").trim(),
        stock: Boolean(form.stock),
        // numbers
        price: numOrNull(form.price),
        purchase_price: numOrNull(form.purchase_price),
        quantity: numOrNull(form.quantity),
        // supplier id
        client: form.client || "",
        // Новый формат (см. docs/PRODUCTION_FINISHED_GOODS_RECIPE_AND_AUTO_CONSUMPTION_API.md)
        // Backend сам корректирует сырьё (минус/плюс) при изменении quantity и/или recipe.
        recipe,
        // Оставляем item_make для совместимости (можно удалить после полной миграции бэка)
        item_make: recipe.map((r) => r.id),
      };

      await dispatch(updateProductAsync({ productId: id, updatedData })).unwrap();
      await fetchProduct();
      setEditMode(false);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error(e);
      setSaveError(
        e?.detail ||
          e?.message ||
          e?.response?.data?.detail ||
          "Не удалось сохранить изменения"
      );
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="product-detail-loading">Загрузка...</div>;
  if (!product)
    return (
      <div className="product-detail-error">
        {loadError || "Товар не найден"}
      </div>
    );

  const selectedMaterialsList = Array.from(selectedMaterials.values())
    .map((mid) =>
      (Array.isArray(itemsMake) ? itemsMake : []).find(
        (m) => String(m.id) === String(mid)
      )
    )
    .filter(Boolean);

  return (
    <div className="product-detail production-product-detail">
      <div className="product-detail__header flex-wrap">
        <button
          className="product-detail__close-btn"
          onClick={() => navigate(-1)}
          type="button"
          title="Назад"
        >
          <X size={20} />
        </button>

        {!editMode ? (
          <button
            className="product-detail__edit-btn"
            onClick={() => setEditMode(true)}
            type="button"
          >
            <Edit3 size={16} />
            Редактировать
          </button>
        ) : (
          <>
            <button
              className="product-detail__edit-btn"
              onClick={onSave}
              type="button"
              disabled={saving}
            >
              <Save size={16} />
              {saving ? "Сохранение..." : "Сохранить"}
            </button>
            <button
              className="product-detail__duplicate-btn"
              onClick={onCancelEdit}
              type="button"
              disabled={saving}
            >
              <XCircle size={16} />
              Отмена
            </button>
          </>
        )}
      </div>

      <div className="product-detail__content">
        <div className="production-product-detail__top">
          <div className="production-product-detail__title">
            <div className="production-product-detail__badge">
              <Package size={16} />
              Готовая продукция
            </div>
            <h2 className="product-detail__name">{product?.name || "—"}</h2>
          </div>
        </div>

        {(saveError || loadError) && (
          <div className="production-product-detail__error">
            {saveError || loadError}
          </div>
        )}

        <div className="production-product-detail__grid">
          <div className="production-product-detail__card">
            <div className="production-product-detail__cardTitle">
              Основная информация
            </div>

            <div className="production-product-detail__formGrid">
              <div className="production-product-detail__field">
                <label>Название</label>
                {editMode ? (
                  <input
                    name="name"
                    value={form.name}
                    onChange={onChange}
                    className="production-product-detail__input"
                  />
                ) : (
                  <div className="production-product-detail__value">
                    {product?.name || "—"}
                  </div>
                )}
              </div>

              <div className="production-product-detail__field">
                <label>Штрихкод</label>
                {editMode ? (
                  <input
                    name="barcode"
                    value={form.barcode}
                    onChange={onChange}
                    className="production-product-detail__input"
                  />
                ) : (
                  <div className="production-product-detail__value">
                    {product?.barcode || "—"}
                  </div>
                )}
              </div>

              <div className="production-product-detail__field">
                <label>Бренд</label>
                {editMode ? (
                  <select
                    name="brand_name"
                    value={form.brand_name}
                    onChange={onChange}
                    className="production-product-detail__input"
                  >
                    <option value="">-- Выберите бренд --</option>
                    {(brands || []).map((b) => (
                      <option key={b.id} value={b.name}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="production-product-detail__value">
                    {product?.brand_name || product?.brand || "—"}
                  </div>
                )}
              </div>

              <div className="production-product-detail__field">
                <label>Категория</label>
                {editMode ? (
                  <select
                    name="category_name"
                    value={form.category_name}
                    onChange={onChange}
                    className="production-product-detail__input"
                  >
                    <option value="">-- Выберите категорию --</option>
                    {(categories || []).map((c) => (
                      <option key={c.id} value={c.name}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="production-product-detail__value">
                    {product?.category_name || product?.category || "—"}
                  </div>
                )}
              </div>

              <div className="production-product-detail__field">
                <label>Поставщик</label>
                {editMode ? (
                  <select
                    name="client"
                    value={form.client || ""}
                    onChange={onChange}
                    className="production-product-detail__input"
                  >
                    <option value="">-- Выберите поставщика --</option>
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.full_name}
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="production-product-detail__value">
                    {product?.client_name || "—"}
                  </div>
                )}
              </div>

              <div className="production-product-detail__field">
                <label>Ед. изм.</label>
                {editMode ? (
                  <input
                    name="unit"
                    value={form.unit}
                    onChange={onChange}
                    className="production-product-detail__input"
                    placeholder="шт / кг / л ..."
                  />
                ) : (
                  <div className="production-product-detail__value">
                    {product?.unit || "—"}
                  </div>
                )}
              </div>

              <div className="production-product-detail__field">
                <label>Цена (розница)</label>
                {editMode ? (
                  <input
                    name="price"
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.price}
                    onChange={onChange}
                    className="production-product-detail__input"
                  />
                ) : (
                  <div className="production-product-detail__value">
                    {product?.price ?? "—"}
                  </div>
                )}
              </div>

              <div className="production-product-detail__field">
                <label>Цена (закуп)</label>
                {editMode ? (
                  <input
                    name="purchase_price"
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.purchase_price}
                    onChange={onChange}
                    className="production-product-detail__input"
                  />
                ) : (
                  <div className="production-product-detail__value">
                    {product?.purchase_price ?? "—"}
                  </div>
                )}
              </div>

              <div className="production-product-detail__field">
                <label>Количество</label>
                {editMode ? (
                  <input
                    name="quantity"
                    type="number"
                    min="0"
                    step="0.0001"
                    value={form.quantity}
                    onChange={onChange}
                    className="production-product-detail__input"
                  />
                ) : (
                  <div className="production-product-detail__value">
                    {product?.quantity ?? "—"}
                  </div>
                )}
              </div>

              <div className="production-product-detail__field production-product-detail__field--checkbox">
                <label>Акционный</label>
                {editMode ? (
                  <label className="production-product-detail__check">
                    <input
                      type="checkbox"
                      name="stock"
                      checked={!!form.stock}
                      onChange={onChange}
                    />
                    <span>Да</span>
                  </label>
                ) : (
                  <div className="production-product-detail__value">
                    {product?.stock ? "Да" : "Нет"}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="production-product-detail__card">
            <div className="production-product-detail__cardTitleRow">
              <div className="production-product-detail__cardTitle">
                <span className="inline-flex items-center gap-2">
                  <Factory size={18} /> Сырьё (состав)
                </span>
              </div>
              <button
                type="button"
                className="production-product-detail__collapseBtn"
                onClick={() => setMaterialsOpen((v) => !v)}
                aria-expanded={materialsOpen}
                aria-label={materialsOpen ? "Свернуть сырьё" : "Раскрыть сырьё"}
              >
                {materialsOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
              </button>
            </div>

            <div className="production-product-detail__hint">
              Тут задаётся список сырья, которое используется в производстве
              этого товара.
            </div>

            {materialsOpen && (
              <>
                <div className="production-product-detail__materialsHeader">
                  <div className="production-product-detail__search">
                    <Search size={16} />
                    <input
                      value={materialsQuery}
                      onChange={(e) => setMaterialsQuery(e.target.value)}
                      className="production-product-detail__input"
                      placeholder="Поиск сырья..."
                    />
                  </div>
                  <div className="production-product-detail__selectedCount">
                    Выбрано: {selectedMaterials.size}
                  </div>
                </div>

                {!editMode && selectedMaterials.size === 0 && (
                  <div className="production-product-detail__empty">
                    Сырьё не указано.
                  </div>
                )}

                <div className="production-product-detail__materialsGrid">
                  <div className="production-product-detail__materialsList">
                    {itemsMakeLoading ? (
                      <div className="production-product-detail__empty">
                        Загрузка сырья...
                      </div>
                    ) : filteredMaterials.length ? (
                      filteredMaterials.map((m) => {
                        const checked = selectedMaterials.has(String(m.id));
                        return (
                          <button
                            key={m.id}
                            type="button"
                            className={`production-product-detail__materialRow ${
                              checked ? "is-checked" : ""
                            }`}
                            onClick={() => {
                              if (!editMode) return;
                              toggleMaterial(m.id);
                            }}
                            disabled={!editMode}
                            title={!editMode ? "Включите редактирование" : ""}
                          >
                            <span className="production-product-detail__materialLeft">
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => toggleMaterial(m.id)}
                                onClick={(e) => e.stopPropagation()}
                                disabled={!editMode}
                              />
                              <span className="production-product-detail__materialName">
                                {m.name || `#${m.id}`}
                              </span>
                            </span>
                            <span className="production-product-detail__materialMeta">
                              {m.quantity != null
                                ? `${m.quantity} ${m.unit || ""}`
                                : ""}
                            </span>
                          </button>
                        );
                      })
                    ) : (
                      <div className="production-product-detail__empty">
                        Ничего не найдено.
                      </div>
                    )}
                  </div>

                  <div className="production-product-detail__selectedBox">
                    <div className="production-product-detail__selectedTitle">
                      Выбранное сырьё
                    </div>
                    {selectedMaterialsList.length ? (
                      <ul className="production-product-detail__selectedList">
                        {selectedMaterialsList.map((m) => (
                          <li
                            key={m.id}
                            className="production-product-detail__selectedItem"
                          >
                            <span className="production-product-detail__selectedName">
                              {m.name}
                            </span>
                            <span className="production-product-detail__selectedMeta">
                              {editMode ? (
                                <span className="inline-flex items-center gap-2">
                                  <span style={{ opacity: 0.8 }}>на 1 товар:</span>
                                  <input
                                    type="number"
                                    min="0"
                                    step="0.001"
                                    value={recipeMap.get(String(m.id)) ?? ""}
                                    onChange={(e) =>
                                      changeMaterialQtyPerUnit(m.id, e.target.value)
                                    }
                                    className="production-product-detail__input"
                                    style={{ width: 120 }}
                                  />
                                </span>
                              ) : (
                                <span style={{ opacity: 0.8 }}>
                                  на 1 товар: {recipeMap.get(String(m.id)) ?? "—"}
                                </span>
                              )}
                            </span>
                            {editMode && (
                              <button
                                type="button"
                                className="production-product-detail__remove"
                                onClick={() => toggleMaterial(m.id)}
                              >
                                убрать
                              </button>
                            )}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <div className="production-product-detail__empty">
                        Пока ничего не выбрано.
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        <div className="production-product-detail__footer">
          <button
            type="button"
            className="production-product-detail__back"
            onClick={() => navigate("/crm/production/warehouse")}
          >
            Назад в склад
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProductionWarehouseProductDetail;

