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
  ingredients: Array.isArray(detail?.ingredients)
    ? detail.ingredients.map((ing) => ({
        id: ing.id ?? "",
        product: ing.product,
        product_title: ing.product_title ?? "",
        product_unit: ing.product_unit ?? "",
        product_unit_price: ing.product_unit_price ?? null,
        amount: String(ing.amount ?? "").replace(",", "."),
        ingredient_cost: ing.ingredient_cost ?? null,
        quantity_in_package: String(ing.quantity_in_package ?? "").replace(
          ",",
          ".",
        ),
        cold_loss_percent: String(ing.cold_loss_percent ?? "").replace(
          ",",
          ".",
        ),
        hot_loss_percent: String(ing.hot_loss_percent ?? "").replace(",", "."),
        unit: ing.unit ?? "",
        gross_unit: ing.gross_unit ?? "",
        gross_kg: ing.gross_kg ?? null,
        net_kg: ing.net_kg ?? null,
        output_ready_kg: ing.output_ready_kg ?? null,
        cost_price_rub: ing.cost_price_rub ?? null,
        cost_per_unit_rub: ing.cost_per_unit_rub ?? null,
        cost_per_unit_weight_rub: ing.cost_per_unit_weight_rub ?? null,
      }))
    : [],
});

const EMPTY_FORM = {
  title: "",
  category: "",
  kitchen: "",
  price: "0",
  is_active: true,
  ingredients: [],
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
        const [categoriesData, kitchensData, warehouseData, detail] =
          await Promise.all([
            fetchCategories(),
            fetchKitchens(),
            fetchWarehouse(),
            isEditing ? fetchMenuItemDetail(id) : Promise.resolve(null),
          ]);

        if (!mounted) return;

        setCategories(Array.isArray(categoriesData) ? categoriesData : []);
        setKitchens(Array.isArray(kitchensData) ? kitchensData : []);
        setWarehouse(Array.isArray(warehouseData) ? warehouseData : []);

        if (detail) {
          setForm(
            buildFormFromDetail(detail, String(categoriesData?.[0]?.id || "")),
          );
          setImagePreview(detail.image_url || "");
        } else {
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

  const addIngredientRow = useCallback(
    () =>
      setForm((prev) => ({
        ...prev,
        ingredients: [
          ...(prev.ingredients || []),
          {
            product: "",
            amount: "1",
            quantity_in_package: "1",
            cold_loss_percent: "0",
            hot_loss_percent: "0",
          },
        ],
      })),
    [],
  );

  const updateIngredientRow = useCallback((idx, field, value) => {
    setForm((prev) => {
      const rows = [...(prev.ingredients || [])];
      const row = { ...(rows[idx] || {}) };
      const clearComputedFields = () => {
        row.gross_unit = "";
        row.gross_kg = null;
        row.net_kg = null;
        row.output_ready_kg = null;
        row.ingredient_cost = null;
        row.cost_price_rub = null;
        row.cost_per_unit_weight_rub = null;
      };

      if (field === "product") {
        clearComputedFields();
        row.product = value;
        const product = warehouseMap.get(String(value || ""));
        if (product) {
          row.product_title = product.title || "";
          row.product_unit = product.unit || "";
          row.product_unit_price = product.unit_price ?? null;
          row.unit = product.unit || row.unit || "";
          row.cost_per_unit_rub = product.unit_price ?? null;
          if (!String(row.quantity_in_package || "").trim()) {
            row.quantity_in_package = String(
              product.quantity_in_package ?? "1",
            ).replace(",", ".");
          }
        } else {
          row.product_title = "";
          row.product_unit = "";
          row.product_unit_price = null;
          row.unit = "";
          row.cost_per_unit_rub = null;
        }
      }

      if (
        field === "amount" ||
        field === "quantity_in_package" ||
        field === "cold_loss_percent" ||
        field === "hot_loss_percent"
      ) {
        const normalized = normalizeDecimalValue(value);
        if (normalized !== null) {
          row[field] = normalized;
          clearComputedFields();
        }
      }

      rows[idx] = row;
      return { ...prev, ingredients: rows };
    });
  }, [warehouseMap]);

  const removeIngredientRow = useCallback((idx) => {
    setForm((prev) => ({
      ...prev,
      ingredients: (prev.ingredients || []).filter((_, i) => i !== idx),
    }));
  }, []);

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
      ingredients: (form.ingredients || [])
        .filter(
          (row) => row && row.product && String(row.amount || "").trim() !== "",
        )
        .map((row) => ({
          product: row.product,
          amount: numberToString(
            Math.max(0, Number(String(row.amount).replace(",", ".")) || 0),
          ),
          quantity_in_package: numberToString(
            Math.max(
              0,
              Number(String(row.quantity_in_package || "1").replace(",", ".")) ||
                0,
            ),
          ),
          cold_loss_percent: numberToString(
            Math.max(
              0,
              Number(String(row.cold_loss_percent || "0").replace(",", ".")) ||
                0,
            ),
          ),
          hot_loss_percent: numberToString(
            Math.max(
              0,
              Number(String(row.hot_loss_percent || "0").replace(",", ".")) ||
                0,
            ),
          ),
        })),
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
        formData2.append("ingredients", JSON.stringify(payload.ingredients));
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
                  onClick={addIngredientRow}
                >
                  <FaPlus /> Добавить ингредиент
                </button>
              </div>

              <div className="cafeMenu__ingList">
                {(form?.ingredients || []).length > 0 ? (
                  (form?.ingredients || []).map((row, idx) => {
                    const ingredientUnit = getIngredientUnitLabel(
                      row,
                      warehouseMap,
                    );

                    return (
                    <div
                      key={`${row?.product || "new"}-${idx}`}
                      className="cafeMenu__ingRow"
                    >
                      <div className="cafeMenu__ingCol">
                        <label className="cafeMenu__label cafeMenu__label--sm">
                          Товар
                        </label>
                        <SearchableCombobox
                          value={String(row?.product ?? "")}
                          onChange={(val) =>
                            updateIngredientRow(idx, "product", String(val))
                          }
                          options={productOptions}
                          placeholder="Поиск товара…"
                          classNamePrefix="cafeMenuCombo"
                        />
                      </div>

                      <div className="cafeMenu__ingCol cafeMenu__ingCol--amount">
                        <label className="cafeMenu__label cafeMenu__label--sm">
                          Норма, {ingredientUnit}
                        </label>
                        <input
                          className="cafeMenu__input"
                          value={formatDecimalInput(row?.amount)}
                          onChange={(e) =>
                            updateIngredientRow(
                              idx,
                              "amount",
                              formatDecimalInput(e.target.value),
                            )
                          }
                          placeholder="1"
                          type="text"
                          inputMode="decimal"
                          autoComplete="off"
                          required
                        />
                      </div>

                      <div className="cafeMenu__ingCol cafeMenuItemPage__ingCompactField">
                        <label className="cafeMenu__label cafeMenu__label--sm">
                          Кол-во в фасовке, {ingredientUnit}
                        </label>
                        <input
                          className="cafeMenu__input"
                          value={formatDecimalInput(row?.quantity_in_package)}
                          onChange={(e) =>
                            updateIngredientRow(
                              idx,
                              "quantity_in_package",
                              formatDecimalInput(e.target.value),
                            )
                          }
                          placeholder="1"
                          type="text"
                          inputMode="decimal"
                          autoComplete="off"
                        />
                      </div>

                      <div className="cafeMenu__ingCol cafeMenuItemPage__ingCompactField">
                        <label className="cafeMenu__label cafeMenu__label--sm">
                          Холодная обр., %
                        </label>
                        <input
                          className="cafeMenu__input"
                          value={formatDecimalInput(row?.cold_loss_percent)}
                          onChange={(e) =>
                            updateIngredientRow(
                              idx,
                              "cold_loss_percent",
                              formatDecimalInput(e.target.value),
                            )
                          }
                          placeholder="0"
                          type="text"
                          inputMode="decimal"
                          autoComplete="off"
                        />
                      </div>

                      <div className="cafeMenu__ingCol cafeMenuItemPage__ingCompactField">
                        <label className="cafeMenu__label cafeMenu__label--sm">
                          Горячая обр., %
                        </label>
                        <input
                          className="cafeMenu__input"
                          value={formatDecimalInput(row?.hot_loss_percent)}
                          onChange={(e) =>
                            updateIngredientRow(
                              idx,
                              "hot_loss_percent",
                              formatDecimalInput(e.target.value),
                            )
                          }
                          placeholder="0"
                          type="text"
                          inputMode="decimal"
                          autoComplete="off"
                        />
                      </div>

                      <div className="cafeMenuItemPage__ingredientMetrics">
                        <div className="cafeMenuItemPage__ingredientMetric cafeMenuItemPage__ingredientMetric--wide">
                          <span>Товар</span>
                          <strong>
                            {row?.product_title ||
                              warehouseMap.get(String(row?.product || ""))?.title ||
                              "—"}
                          </strong>
                        </div>
                        <div className="cafeMenuItemPage__ingredientMetric">
                          <span>Ед. изм. товара</span>
                          <strong>
                            {row?.product_unit ||
                              warehouseMap.get(String(row?.product || ""))?.unit ||
                              "—"}
                          </strong>
                        </div>
                        <div className="cafeMenuItemPage__ingredientMetric">
                          <span>Цена товара</span>
                          <strong>
                            {formatMetricValue(
                              row?.product_unit_price ??
                                warehouseMap.get(String(row?.product || ""))?.unit_price,
                              ingredientUnit,
                            )}
                          </strong>
                        </div>
                        <div className="cafeMenuItemPage__ingredientMetric">
                          <span>Стоимость ингредиента</span>
                          <strong>
                            {formatMetricValue(
                              row?.ingredient_cost ?? row?.cost_price_rub,
                            )}
                          </strong>
                        </div>
                        <div className="cafeMenuItemPage__ingredientMetric">
                          <span>Ед. изм. ингредиента</span>
                          <strong>
                            {ingredientUnit}
                          </strong>
                        </div>
                        <div className="cafeMenuItemPage__ingredientMetric">
                          <span>Брутто, {ingredientUnit}</span>
                          <strong>
                            {formatMetricValue(row?.gross_unit, ingredientUnit)}
                          </strong>
                        </div>
                        <div className="cafeMenuItemPage__ingredientMetric">
                          <span>Брутто, кг</span>
                          <strong>{formatMetricValue(row?.gross_kg)}</strong>
                        </div>
                        <div className="cafeMenuItemPage__ingredientMetric">
                          <span>Нетто, кг</span>
                          <strong>{formatMetricValue(row?.net_kg)}</strong>
                        </div>
                        <div className="cafeMenuItemPage__ingredientMetric">
                          <span>Выход готового, кг</span>
                          <strong>
                            {formatMetricValue(row?.output_ready_kg)}
                          </strong>
                        </div>
                        <div className="cafeMenuItemPage__ingredientMetric">
                          <span>Себестоимость</span>
                          <strong>
                            {formatMetricValue(row?.cost_price_rub)}
                          </strong>
                        </div>
                        <div className="cafeMenuItemPage__ingredientMetric">
                          <span>Стоимость за ед.</span>
                          <strong>
                            {formatMetricValue(
                              row?.cost_per_unit_rub ??
                                warehouseMap.get(String(row?.product || ""))?.unit_price,
                              ingredientUnit,
                            )}
                          </strong>
                        </div>
                        <div className="cafeMenuItemPage__ingredientMetric">
                          <span>Стоимость за ед. веса</span>
                          <strong>
                            {formatMetricValue(row?.cost_per_unit_weight_rub)}
                          </strong>
                        </div>
                      </div>

                      <div className="cafeMenu__ingCol cafeMenu__ingCol--trash">
                        <label className="cafeMenu__label cafeMenu__label--sm">
                          &nbsp;
                        </label>
                        <button
                          type="button"
                          className="cafeMenu__iconBtn cafeMenu__iconBtn--danger"
                          onClick={() => removeIngredientRow(idx)}
                          aria-label="Удалить"
                          title="Удалить ингредиент"
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
    </section>
  );
}
