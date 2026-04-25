import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useNavigate, useParams } from "react-router-dom";
import { FaArrowLeft, FaPlus, FaSave, FaTrash } from "react-icons/fa";
import api from "../../../../api";
import SearchableCombobox from "../../../common/SearchableCombobox/SearchableCombobox";
import KitchenCreateModal from "../Cook/components/KitchenCreateModal";
import { useAlert } from "../../../../hooks/useDialog";
import { validateResErrors } from "../../../../../tools/validateResErrors";
import "./Menu.scss";

const getListFromResponse = (res) => res?.data?.results || res?.data || [];

const safeStr = (value) => String(value ?? "");

const formatDecimalInput = (value) => {
  const cleaned = String(value ?? "").replace(",", ".");
  if (cleaned === "") return "";
  const numbers = cleaned.replace(/[^\d.]/g, "");
  const parts = numbers.split(".");
  return parts.length <= 2
    ? numbers
    : `${parts[0]}.${parts.slice(1).join("")}`;
};

const numberToString = (value) =>
  String(Number(value) || 0).replace(",", ".");

const normalizeDecimalValue = (value) => {
  const cleaned = String(value ?? "").replace(",", ".");
  return /^\d*\.?\d*$/.test(cleaned) ? cleaned : null;
};

const formatMetricValue = (value, suffix = "") => {
  if (value === null || value === undefined || value === "") return "—";
  return suffix ? `${value} ${suffix}` : String(value);
};

const getIngredientUnitLabel = (row, warehouseMap) =>
  row?.unit ||
  row?.product_unit ||
  warehouseMap.get(String(row?.product || ""))?.unit ||
  "ед.";

const buildFormFromDetail = (detail, fallbackCategory = "") => ({
  title: detail?.title || "",
  category: detail?.category || String(fallbackCategory || ""),
  kitchen: detail?.kitchen ? String(detail.kitchen) : "",
  price: String(detail?.price ?? "0").replace(",", "."),
  is_active: !!detail?.is_active,
});

const EMPTY_FORM = {
  title: "",
  category: "",
  kitchen: "",
  price: "0",
  is_active: true,
};

export default function CafeMenuItemPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const alert = useAlert();
  const isEditing = Boolean(id);

  const [activeTab, setActiveTab] = useState("description");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [categories, setCategories] = useState([]);
  const [kitchens, setKitchens] = useState([]);
  const [warehouse, setWarehouse] = useState([]);
  const [preparations, setPreparations] = useState([]);
  const [processingTypes, setProcessingTypes] = useState([]);
  const [dishIngredients, setDishIngredients] = useState([]);
  const [dishCost, setDishCost] = useState(null);
  const [dishCostLoading, setDishCostLoading] = useState(false);
  const [ingredientSaving, setIngredientSaving] = useState(false);
  const [ingredientCreateOpen, setIngredientCreateOpen] = useState(false);
  const [newIngredient, setNewIngredient] = useState({
    ingredient_type: "product",
    product: "",
    preparation: "",
    quantity: "1",
    unit: "g",
  });
  const [form, setForm] = useState(EMPTY_FORM);
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState("");
  const [kitchenCreateOpen, setKitchenCreateOpen] = useState(false);

  const categoryOptions = useMemo(
    () =>
      (Array.isArray(categories) ? categories : [])
        .map((cat) => ({
          value: String(cat.id),
          label: safeStr(cat.title),
        }))
        .filter((opt) => opt.value && opt.label),
    [categories],
  );

  const kitchenOptions = useMemo(() => {
    const baseOptions = (Array.isArray(kitchens) ? kitchens : [])
      .map((kitchen) => {
        const title = safeStr(
          kitchen.title || kitchen.name || kitchen.kitchen_title,
        );
        const number = kitchen.number ?? kitchen.kitchen_number;
        const label = `${title || "Кухня"}${
          number !== undefined && number !== null && number !== ""
            ? ` №${number}`
            : ""
        }`;
        return { value: String(kitchen.id), label: safeStr(label) };
      })
      .filter((opt) => opt.value && opt.label);

    return [{ value: "", label: "Без кухни" }, ...baseOptions];
  }, [kitchens]);

  const productOptions = useMemo(
    () =>
      (Array.isArray(warehouse) ? warehouse : [])
        .map((product) => ({
          value: String(product.id),
          label: `${safeStr(product.title)}${
            safeStr(product.unit) ? ` (${safeStr(product.unit)})` : ""
          }`,
        }))
        .filter((opt) => opt.value && opt.label),
    [warehouse],
  );

  const warehouseMap = useMemo(() => {
    const map = new Map();
    (Array.isArray(warehouse) ? warehouse : []).forEach((item) => {
      map.set(String(item.id), item);
    });
    return map;
  }, [warehouse]);

  const preparationOptions = useMemo(
    () =>
      (Array.isArray(preparations) ? preparations : [])
        .map((item) => ({
          value: String(item.id),
          label: safeStr(item.name || "Заготовка"),
        }))
        .filter((opt) => opt.value && opt.label),
    [preparations],
  );

  const fetchCategories = useCallback(async () => {
    const res = await api.get("/cafe/categories/");
    return getListFromResponse(res);
  }, []);

  const fetchKitchens = useCallback(async () => {
    const res = await api.get("/cafe/kitchens/");
    return getListFromResponse(res);
  }, []);

  const fetchWarehouse = useCallback(async () => {
    const res = await api.get("/cafe/warehouse/");
    return getListFromResponse(res);
  }, []);

  const fetchPreparations = useCallback(async () => {
    const res = await api.get("/cafe/preparations/");
    return getListFromResponse(res);
  }, []);

  const fetchProcessingTypes = useCallback(async () => {
    const res = await api.get("/cafe/processing-types/");
    return getListFromResponse(res);
  }, []);

  const fetchDishIngredients = useCallback(async (dishId) => {
    if (!dishId) return [];
    const res = await api.get("/cafe/dish-ingredients/", {
      params: { dish: String(dishId) },
    });
    return getListFromResponse(res);
  }, []);

  const fetchDishCost = useCallback(async (dishId) => {
    if (!dishId) return null;
    const res = await api.get(`/cafe/dishes/${encodeURIComponent(String(dishId))}/cost/`);
    return res?.data || null;
  }, []);

  const fetchMenuItemDetail = useCallback(async (menuItemId) => {
    if (!menuItemId) return null;
    const res = await api.get(
      `/cafe/menu-items/${encodeURIComponent(String(menuItemId))}/`,
    );
    return res?.data || null;
  }, []);

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        setLoading(true);
        const [categoriesData, kitchensData, warehouseData, preparationsData, processingData, detail] =
          await Promise.all([
            fetchCategories(),
            fetchKitchens(),
            fetchWarehouse(),
            fetchPreparations(),
            fetchProcessingTypes(),
            isEditing ? fetchMenuItemDetail(id) : Promise.resolve(null),
          ]);

        if (!mounted) return;

        setCategories(Array.isArray(categoriesData) ? categoriesData : []);
        setKitchens(Array.isArray(kitchensData) ? kitchensData : []);
        setWarehouse(Array.isArray(warehouseData) ? warehouseData : []);
        setPreparations(Array.isArray(preparationsData) ? preparationsData : []);
        setProcessingTypes(Array.isArray(processingData) ? processingData : []);

        if (detail) {
          setForm(
            buildFormFromDetail(detail, String(categoriesData?.[0]?.id || "")),
          );
          setImagePreview(detail.image_url || "");
          try {
            setDishCostLoading(true);
            const [nextDishIngredients, nextDishCost] = await Promise.all([
              fetchDishIngredients(detail.id),
              fetchDishCost(detail.id),
            ]);
            if (mounted) {
              setDishIngredients(
                (Array.isArray(nextDishIngredients) ? nextDishIngredients : []).map((it) => ({
                  ...it,
                  processing_items: Array.isArray(it.processings)
                    ? it.processings
                    : Array.isArray(it.processing_items)
                      ? it.processing_items
                      : [],
                })),
              );
              setDishCost(nextDishCost || null);
            }
          } catch {}
          finally {
            if (mounted) setDishCostLoading(false);
          }
        } else {
          setDishCost(null);
          setForm((prev) => ({
            ...prev,
            category: String(categoriesData?.[0]?.id || ""),
          }));
        }
      } catch (err) {
        if (!mounted) return;
        alert(
          validateResErrors(err, "Ошибка при загрузке данных блюда"),
          true,
        );
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
    // reload only when editing target changes; avoid loops from unstable hook refs
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, isEditing]);

  useEffect(() => {
    return () => {
      if (imagePreview && imagePreview.startsWith("blob:")) {
        URL.revokeObjectURL(imagePreview);
      }
    };
  }, [imagePreview]);

  useEffect(() => {
    if (!isEditing || activeTab !== "ingredients" || !id) return;
    let mounted = true;
    (async () => {
      try {
        setDishCostLoading(true);
        const nextDishCost = await fetchDishCost(id);
        if (mounted) setDishCost(nextDishCost || null);
      } catch {
      } finally {
        if (mounted) setDishCostLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [activeTab, fetchDishCost, id, isEditing]);

  const updateField = useCallback(
    (patch) => setForm((prev) => ({ ...prev, ...patch })),
    [],
  );

  const handlePickImage = useCallback(
    (e) => {
      const file = e.target.files?.[0];
      if (!file) return;

      if (imagePreview && imagePreview.startsWith("blob:")) {
        URL.revokeObjectURL(imagePreview);
      }

      setImageFile(file);
      setImagePreview(URL.createObjectURL(file));
    },
    [imagePreview],
  );

  const reloadDishIngredients = useCallback(async () => {
    if (!id) return;
    try {
      setDishCostLoading(true);
      const [rows, nextDishCost] = await Promise.all([
        fetchDishIngredients(id),
        fetchDishCost(id),
      ]);
      setDishIngredients(
        (Array.isArray(rows) ? rows : []).map((it) => ({
          ...it,
          processing_items: Array.isArray(it.processings)
            ? it.processings
            : Array.isArray(it.processing_items)
              ? it.processing_items
              : [],
        })),
      );
      setDishCost(nextDishCost || null);
    } finally {
      setDishCostLoading(false);
    }
  }, [fetchDishIngredients, fetchDishCost, id]);

  const addIngredientRow = useCallback(async () => {
    if (!id) {
      alert("Сначала сохраните блюдо", true);
      return;
    }
    const payload = {
      ingredient_type: newIngredient.ingredient_type,
      quantity: numberToString(newIngredient.quantity || "0"),
      unit: newIngredient.unit || "g",
      ...(newIngredient.ingredient_type === "product"
        ? { product: newIngredient.product || null }
        : { preparation: newIngredient.preparation || null }),
    };
    try {
      setIngredientSaving(true);
      await api.post(`/cafe/dishes/${encodeURIComponent(String(id))}/ingredients/`, payload);
      setNewIngredient({
        ingredient_type: "product",
        product: "",
        preparation: "",
        quantity: "1",
        unit: "g",
      });
      setIngredientCreateOpen(false);
      await reloadDishIngredients();
    } catch (err) {
      alert(validateResErrors(err, "Ошибка добавления ингредиента"), true);
    } finally {
      setIngredientSaving(false);
    }
  }, [alert, id, newIngredient, reloadDishIngredients]);

  const updateIngredientRow = useCallback(
    async (row, patch) => {
      const ingredientId = row?.id;
      if (!ingredientId) return;
      try {
        setIngredientSaving(true);
        await api.patch(`/cafe/dish-ingredients/${encodeURIComponent(String(ingredientId))}/`, patch);
        await reloadDishIngredients();
      } catch (err) {
        alert(validateResErrors(err, "Ошибка обновления ингредиента"), true);
      } finally {
        setIngredientSaving(false);
      }
    },
    [alert, reloadDishIngredients],
  );

  const removeIngredientRow = useCallback(
    async (row) => {
      const ingredientId = row?.id;
      if (!ingredientId) return;
      try {
        setIngredientSaving(true);
        await api.delete(`/cafe/dish-ingredients/${encodeURIComponent(String(ingredientId))}/`);
        await reloadDishIngredients();
      } catch (err) {
        alert(validateResErrors(err, "Ошибка удаления ингредиента"), true);
      } finally {
        setIngredientSaving(false);
      }
    },
    [alert, reloadDishIngredients],
  );

  const addProcessingToIngredient = useCallback(
    async (ingredientId, processingTypeId) => {
      if (!ingredientId || !processingTypeId) return;
      try {
        await api.post("/cafe/dish-ingredient-processings/", {
          ingredient: ingredientId,
          processing_type: processingTypeId,
        });
        await reloadDishIngredients();
      } catch (err) {
        alert(validateResErrors(err, "Ошибка добавления обработки"), true);
      }
    },
    [alert, reloadDishIngredients],
  );

  const removeProcessingFromIngredient = useCallback(
    async (processingRowId) => {
      if (!processingRowId) return;
      try {
        await api.delete(`/cafe/dish-ingredient-processings/${encodeURIComponent(String(processingRowId))}/`);
        await reloadDishIngredients();
      } catch (err) {
        alert(validateResErrors(err, "Ошибка удаления обработки"), true);
      }
    },
    [alert, reloadDishIngredients],
  );

  const buildFormPayload = useCallback(() => {
    const payload = {
      title: (form.title || "").trim(),
      category: form.category,
      kitchen: form.kitchen ? form.kitchen : null,
      price: numberToString(
        Math.max(
          0,
          Number(String(form.price ?? "0").replace(",", ".")) || 0,
        ),
      ),
      is_active: !!form.is_active,
    };

    if (!payload.title || !payload.category) return null;
    return payload;
  }, [form]);

  const uploadImage = useCallback(
    async (menuItemId) => {
      if (!menuItemId || !imageFile) return true;

      const formData = new FormData();
      formData.append("image", imageFile);

      try {
        await api.patch(
          `/cafe/menu-items/${encodeURIComponent(String(menuItemId))}/`,
          formData,
          {
            headers: { "Content-Type": "multipart/form-data" },
          },
        );
        return true;
      } catch {
        const payload = buildFormPayload();
        if (!payload) return false;

        const formData2 = new FormData();
        formData2.append("title", payload.title);
        formData2.append("category", payload.category);
        if (payload.kitchen) formData2.append("kitchen", payload.kitchen);
        formData2.append("price", payload.price);
        formData2.append("is_active", payload.is_active ? "true" : "false");
        formData2.append("image", imageFile);

        await api.put(
          `/cafe/menu-items/${encodeURIComponent(String(menuItemId))}/`,
          formData2,
          {
            headers: { "Content-Type": "multipart/form-data" },
          },
        );

        return true;
      }
    },
    [buildFormPayload, imageFile],
  );

  const handleSave = useCallback(
    async (e) => {
      e.preventDefault();

      const payload = buildFormPayload();
      if (!payload) {
        alert("Заполните название и категорию", true);
        return;
      }

      try {
        setSaving(true);
        let saved = null;

        if (!isEditing) {
          const res = await api.post("/cafe/menu-items/", payload);
          saved = res?.data || null;
        } else {
          const res = await api.put(
            `/cafe/menu-items/${encodeURIComponent(String(id))}/`,
            payload,
          );
          saved = res?.data || null;
        }

        const savedId = saved?.id || id;
        if (imageFile && savedId) {
          await uploadImage(savedId);
        }

        setImageFile(null);

        if (!isEditing && savedId) {
          navigate(`/crm/cafe/menu/item/${encodeURIComponent(String(savedId))}`, {
            replace: true,
          });
        } else if (savedId) {
          try {
            const freshDetail = await fetchMenuItemDetail(savedId);
            if (freshDetail) {
              setForm(buildFormFromDetail(freshDetail, form.category));
              setImagePreview(freshDetail.image_url || "");
            }
          } catch {}
        }

        alert("Блюдо успешно сохранено");
      } catch (err) {
        alert(
          validateResErrors(err, "Произошла ошибка при сохранении блюда"),
          true,
        );
      } finally {
        setSaving(false);
      }
    },
    [
      alert,
      buildFormPayload,
      fetchMenuItemDetail,
      form.category,
      id,
      imageFile,
      isEditing,
      navigate,
      uploadImage,
    ],
  );

  const handleKitchenCreated = useCallback(
    async (created) => {
      try {
        const nextKitchens = await fetchKitchens();
        setKitchens(Array.isArray(nextKitchens) ? nextKitchens : []);
      } catch {}

      const newId = created?.id ?? created?.uuid;
      if (newId != null && newId !== "") {
        setForm((prev) => ({ ...prev, kitchen: String(newId) }));
      }
      setKitchenCreateOpen(false);
    },
    [fetchKitchens],
  );

  const titleValue = safeStr(form?.title);
  const priceValue = formatDecimalInput(form?.price);
  const categoryValue = String(form?.category ?? "");
  const kitchenValue = String(form?.kitchen ?? "");

  return (
    <section className="cafeMenu cafeMenuItemPage">
      <div className="cafeMenuItemPage__header">
        <div className="cafeMenuItemPage__headerLeft">
          <button
            type="button"
            className="cafeMenu__btn cafeMenu__btn--secondary"
            onClick={() => navigate("/crm/cafe/menu")}
          >
            <FaArrowLeft /> Назад
          </button>

          <div className="cafeMenuItemPage__titleBlock">
            <h2 className="cafeMenu__title">
              {isEditing ? "Редактирование блюда" : "Новое блюдо"}
            </h2>
            <div className="cafeMenu__subtitle">
              Отдельная страница для описания и ингредиентов
            </div>
          </div>
        </div>

        <button
          type="submit"
          form="cafe-menu-item-form"
          className="cafeMenu__btn cafeMenu__btn--primary"
          disabled={loading || saving}
        >
          <FaSave /> {saving ? "Сохраняем..." : "Сохранить"}
        </button>
      </div>

      <div className="cafeMenuItemPage__tabs" role="tablist" aria-label="Вкладки блюда">
        <button
          type="button"
          className={`cafeMenuItemPage__tab ${
            activeTab === "description" ? "cafeMenuItemPage__tab--active" : ""
          }`}
          onClick={() => setActiveTab("description")}
        >
          Описание
        </button>
        <button
          type="button"
          className={`cafeMenuItemPage__tab ${
            activeTab === "ingredients" ? "cafeMenuItemPage__tab--active" : ""
          }`}
          onClick={() => setActiveTab("ingredients")}
        >
          Ингредиенты
        </button>
      </div>

      {loading ? (
        <div className="cafeMenu__alert">Загрузка…</div>
      ) : (
        <form
          id="cafe-menu-item-form"
          className="cafeMenuItemPage__card"
          onSubmit={handleSave}
        >
          {activeTab === "description" ? (
            <div className="cafeMenuItemPage__description">
              <div className="cafeMenuModal__grid">
                <div className="cafeMenuModal__preview">
                  {imagePreview ? (
                    <img src={imagePreview} alt="Превью" />
                  ) : (
                    <div className="cafeMenuModal__previewEmpty">Фото</div>
                  )}
                </div>

                <div className="cafeMenuModal__fields">
                  <div className="cafeMenuModal__fieldsGrid">
                    <div className="cafeMenu__field">
                      <label className="cafeMenu__label">Название</label>
                      <input
                        className="cafeMenu__input"
                        value={titleValue}
                        onChange={(e) => updateField({ title: e.target.value })}
                        required
                        maxLength={255}
                        type="text"
                        autoComplete="off"
                        placeholder="Название блюда"
                      />
                    </div>

                    <div className="cafeMenu__field">
                      <label className="cafeMenu__label">Категория</label>
                      <SearchableCombobox
                        value={categoryValue}
                        onChange={(val) =>
                          updateField({ category: String(val) })
                        }
                        options={categoryOptions}
                        placeholder="Поиск категории…"
                        disabled={!categoryOptions.length}
                        classNamePrefix="cafeMenuCombo"
                      />
                    </div>

                    <div className="cafeMenu__field">
                      <label className="cafeMenu__label">Цена, сом</label>
                      <input
                        className="cafeMenu__input"
                        value={priceValue}
                        onChange={(e) =>
                          updateField({
                            price: formatDecimalInput(e.target.value),
                          })
                        }
                        placeholder="Например: 250"
                        type="text"
                        inputMode="decimal"
                        autoComplete="off"
                        required
                      />
                    </div>

                    <div className="cafeMenu__field">
                      <label className="cafeMenu__label">
                        Фото (jpg/png/webp)
                      </label>
                      <input
                        type="file"
                        accept="image/*"
                        className="cafeMenu__input"
                        onChange={handlePickImage}
                      />
                    </div>

                    <div className="cafeMenuModal__row2">
                      <div className="cafeMenu__field cafeMenuModal__kitchen">
                        <label className="cafeMenu__label">Кухня</label>
                        <SearchableCombobox
                          value={kitchenValue}
                          onChange={(val) =>
                            updateField({ kitchen: String(val) })
                          }
                          options={kitchenOptions}
                          placeholder="Выберите кухню…"
                          classNamePrefix="cafeMenuCombo"
                        />
                      </div>

                      <div className="cafeMenu__field cafeMenuModal__active">
                        <button
                          type="button"
                          className="cafeMenu__btn cafeMenu__btn--secondary cafeMenuModal__kitchenCreate ml-auto"
                          onClick={() => setKitchenCreateOpen(true)}
                        >
                          <FaPlus /> Новая кухня
                        </button>

                        <label className="cafeMenu__check">
                          <input
                            type="checkbox"
                            checked={!!form?.is_active}
                            onChange={(e) =>
                              updateField({ is_active: e.target.checked })
                            }
                          />
                          <span>Активно</span>
                        </label>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="cafeMenu__recipeBlock">
              <div className="cafeMenuItemPage__ingredientsHead">
                <div>
                  <h3 className="cafeMenuItemPage__sectionTitle">Ингредиенты</h3>
                  <div className="cafeMenu__hint">
                    Укажите товары со склада и параметры обработки. Расчетные
                    значения возвращаются и считаются на бэке.
                  </div>
                </div>

                <button
                  type="button"
                  className="cafeMenu__btn cafeMenu__btn--secondary"
                  onClick={() => setIngredientCreateOpen(true)}
                  disabled={!isEditing || ingredientSaving}
                >
                  <FaPlus /> Добавить ингредиент
                </button>
              </div>

              {isEditing && (
                <div className="cafeMenuItemPage__ingredientMetrics">
                  <div className="cafeMenuItemPage__ingredientMetric">
                    <span>Себестоимость</span>
                    <strong>
                      {dishCostLoading
                        ? "Обновляем..."
                        : formatMetricValue(dishCost?.cost_price)}
                    </strong>
                  </div>
                  <div className="cafeMenuItemPage__ingredientMetric">
                    <span>Цена продажи</span>
                    <strong>{formatMetricValue(dishCost?.sale_price)}</strong>
                  </div>
                  <div className="cafeMenuItemPage__ingredientMetric">
                    <span>Маржа (сумма)</span>
                    <strong>{formatMetricValue(dishCost?.margin_amount)}</strong>
                  </div>
                  <div className="cafeMenuItemPage__ingredientMetric">
                    <span>Маржа (%)</span>
                    <strong>{formatMetricValue(dishCost?.margin_percent, "%")}</strong>
                  </div>
                </div>
              )}

              {!isEditing && (
                <div className="cafeMenu__alert">
                  Сначала сохраните блюдо, затем добавляйте ингредиенты по новой схеме.
                </div>
              )}

              <div className="cafeMenu__ingList">
                {(dishIngredients || []).length > 0 ? (
                  (dishIngredients || []).map((row, idx) => {
                    const ingredientUnit = row?.unit || "—";
                    const processingItems = Array.isArray(row?.processing_items)
                      ? row.processing_items
                      : [];

                    return (
                    <div
                      key={`${row?.id || "new"}-${idx}`}
                      className="cafeMenu__ingRow"
                    >
                      <div className="cafeMenu__ingCol">
                        <label className="cafeMenu__label cafeMenu__label--sm">
                          Тип ингредиента
                        </label>
                        <input className="cafeMenu__input" value={row?.ingredient_type || "—"} disabled />
                      </div>

                      <div className="cafeMenu__ingCol cafeMenu__ingCol--amount">
                        <label className="cafeMenu__label cafeMenu__label--sm">
                          Ингредиент
                        </label>
                        <input
                          className="cafeMenu__input"
                          value={row?.product_name || row?.preparation_name || "—"}
                          disabled
                        />
                      </div>

                      <div className="cafeMenu__ingCol cafeMenuItemPage__ingCompactField">
                        <label className="cafeMenu__label cafeMenu__label--sm">
                          Количество
                        </label>
                        <input
                          className="cafeMenu__input"
                          value={formatDecimalInput(row?.quantity)}
                          onChange={(e) =>
                            updateIngredientRow(row, {
                              quantity: numberToString(formatDecimalInput(e.target.value)),
                            })
                          }
                          placeholder="1"
                          type="text"
                          inputMode="decimal"
                          autoComplete="off"
                        />
                      </div>

                      <div className="cafeMenu__ingCol cafeMenuItemPage__ingCompactField">
                        <label className="cafeMenu__label cafeMenu__label--sm">
                          Ед. изм.
                        </label>
                        <select
                          className="cafeMenu__input"
                          value={row?.unit || "g"}
                          onChange={(e) =>
                            updateIngredientRow(row, {
                              unit: e.target.value,
                            })
                          }
                        >
                          <option value="kg">кг</option>
                          <option value="g">г</option>
                          <option value="l">л</option>
                          <option value="ml">мл</option>
                          <option value="pcs">шт</option>
                        </select>
                      </div>

                      <div className="cafeMenuItemPage__ingredientMetrics">
                        <div className="cafeMenuItemPage__ingredientMetric cafeMenuItemPage__ingredientMetric--wide">
                          <span>Себестоимость ед.</span>
                          <strong>{formatMetricValue(row?.unit_cost)}</strong>
                        </div>
                        <div className="cafeMenuItemPage__ingredientMetric">
                          <span>Стоимость ингредиента</span>
                          <strong>{formatMetricValue(row?.ingredient_cost)}</strong>
                        </div>
                        <div className="cafeMenuItemPage__ingredientMetric">
                          <span>Стоимость обработок</span>
                          <strong>{formatMetricValue(row?.processing_cost)}</strong>
                        </div>
                        <div className="cafeMenuItemPage__ingredientMetric">
                          <span>Итог по ингредиенту</span>
                          <strong>{formatMetricValue(row?.total_cost)}</strong>
                        </div>
                      </div>

                      <div className="cafeMenu__ingCol">
                        <label className="cafeMenu__label cafeMenu__label--sm">Обработки</label>
                        <div className="cafeMenuItemPage__ingredientMetrics">
                          {processingItems.length > 0 ? (
                            processingItems.map((pr) => (
                              <div key={String(pr.id || pr.processing_id || pr.processing_type)} className="cafeMenuItemPage__ingredientMetric cafeMenuItemPage__ingredientMetric--wide">
                                <span>{pr.processing_type_name || pr.name || "Обработка"}</span>
                                <strong>{formatMetricValue(pr.cost)}</strong>
                                <button
                                  type="button"
                                  className="cafeMenu__iconBtn cafeMenu__iconBtn--danger"
                                  onClick={() => removeProcessingFromIngredient(pr.id)}
                                  title="Удалить обработку"
                                >
                                  <FaTrash />
                                </button>
                              </div>
                            ))
                          ) : (
                            <div className="cafeMenu__hint">Нет обработок</div>
                          )}
                        </div>
                        <div style={{ marginTop: 8 }}>
                          <SearchableCombobox
                            value=""
                            onChange={(val) =>
                              addProcessingToIngredient(row.id, String(val || ""))
                            }
                            options={(processingTypes || []).map((pt) => ({
                              value: String(pt.id),
                              label: `${pt.name} (${pt.charge_type})`,
                            }))}
                            placeholder="Добавить обработку..."
                            classNamePrefix="cafeMenuCombo"
                          />
                        </div>
                      </div>

                      <div className="cafeMenu__ingCol cafeMenu__ingCol--trash">
                        <label className="cafeMenu__label cafeMenu__label--sm">
                          &nbsp;
                        </label>
                        <button
                          type="button"
                          className="cafeMenu__iconBtn cafeMenu__iconBtn--danger"
                          onClick={() => removeIngredientRow(row)}
                          aria-label="Удалить"
                          title="Удалить ингредиент"
                          disabled={ingredientSaving}
                        >
                          <FaTrash />
                        </button>
                      </div>
                    </div>
                    );
                  })
                ) : (
                  <div className="cafeMenu__alert">
                    Ингредиенты пока не добавлены
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="cafeMenu__formActions">
            <button
              type="button"
              className="cafeMenu__btn cafeMenu__btn--secondary"
              onClick={() => navigate("/crm/cafe/menu")}
            >
              Отмена
            </button>
            <button
              type="submit"
              className="cafeMenu__btn cafeMenu__btn--primary"
              disabled={saving}
            >
              <FaSave /> {saving ? "Сохраняем..." : "Сохранить"}
            </button>
          </div>
        </form>
      )}

      <KitchenCreateModal
        open={kitchenCreateOpen}
        onClose={() => setKitchenCreateOpen(false)}
        onCreated={handleKitchenCreated}
      />
      {isEditing && ingredientCreateOpen && (
        <div
          className="cafeMenuModal__overlay"
          onClick={() => {
            if (!ingredientSaving) setIngredientCreateOpen(false);
          }}
        >
          <div
            className="cafeMenuModal__card cafeMenuItemPage__ingredientModal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="cafeMenuModal__header">
              <div className="cafeMenuModal__headLeft">
                <h3 className="cafeMenuModal__title">Новый ингредиент</h3>
                <div className="cafeMenuModal__sub">
                  Выберите тип, позицию, количество и единицу измерения
                </div>
              </div>
              <button
                type="button"
                className="cafeMenuModal__close"
                onClick={() => setIngredientCreateOpen(false)}
                disabled={ingredientSaving}
                aria-label="Закрыть"
              >
                ×
              </button>
            </div>

            <div className="cafeMenuItemPage__ingredientModalBody">
              <div className="cafeMenu__ingRow">
                <div className="cafeMenu__ingCol">
                  <label className="cafeMenu__label cafeMenu__label--sm">Тип ингредиента</label>
                  <select
                    className="cafeMenu__input"
                    value={newIngredient.ingredient_type}
                    onChange={(e) =>
                      setNewIngredient((prev) => ({
                        ...prev,
                        ingredient_type: e.target.value,
                        product: "",
                        preparation: "",
                      }))
                    }
                  >
                    <option value="product">Товар</option>
                    <option value="preparation">Заготовка</option>
                  </select>
                </div>
                <div className="cafeMenu__ingCol">
                  <label className="cafeMenu__label cafeMenu__label--sm">
                    {newIngredient.ingredient_type === "product" ? "Товар" : "Заготовка"}
                  </label>
                  <SearchableCombobox
                    value={
                      newIngredient.ingredient_type === "product"
                        ? String(newIngredient.product || "")
                        : String(newIngredient.preparation || "")
                    }
                    onChange={(val) =>
                      setNewIngredient((prev) =>
                        prev.ingredient_type === "product"
                          ? { ...prev, product: String(val || "") }
                          : { ...prev, preparation: String(val || "") },
                      )
                    }
                    options={
                      newIngredient.ingredient_type === "product"
                        ? productOptions
                        : preparationOptions
                    }
                    placeholder="Выберите..."
                    classNamePrefix="cafeMenuCombo"
                  />
                </div>
                <div className="cafeMenu__ingCol cafeMenuItemPage__ingCompactField">
                  <label className="cafeMenu__label cafeMenu__label--sm">Количество</label>
                  <input
                    className="cafeMenu__input"
                    value={formatDecimalInput(newIngredient.quantity)}
                    onChange={(e) =>
                      setNewIngredient((prev) => ({
                        ...prev,
                        quantity: formatDecimalInput(e.target.value),
                      }))
                    }
                  />
                </div>
                <div className="cafeMenu__ingCol cafeMenuItemPage__ingCompactField">
                  <label className="cafeMenu__label cafeMenu__label--sm">Ед. изм.</label>
                  <select
                    className="cafeMenu__input"
                    value={newIngredient.unit}
                    onChange={(e) =>
                      setNewIngredient((prev) => ({ ...prev, unit: e.target.value }))
                    }
                  >
                    <option value="kg">кг</option>
                    <option value="g">г</option>
                    <option value="l">л</option>
                    <option value="ml">мл</option>
                    <option value="pcs">шт</option>
                  </select>
                </div>
              </div>

              <div className="cafeMenuItemPage__ingredientModalActions">
                <button
                  type="button"
                  className="cafeMenu__btn cafeMenu__btn--secondary"
                  onClick={() => setIngredientCreateOpen(false)}
                  disabled={ingredientSaving}
                >
                  Отмена
                </button>
                <button
                  type="button"
                  className="cafeMenu__btn cafeMenu__btn--primary"
                  onClick={addIngredientRow}
                  disabled={ingredientSaving}
                >
                  <FaPlus /> {ingredientSaving ? "Добавляем..." : "Добавить"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
