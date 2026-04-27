import React, { useEffect, useMemo, useState } from "react";
import { Trash2, X } from "lucide-react";
import api from "../../../../api";
import DataContainer from "../../../common/DataContainer/DataContainer";
import { useAlert } from "../../../../hooks/useDialog";
import { validateResErrors } from "../../../../../tools/validateResErrors";
import "./Costing.scss";

const listFrom = (res) => res?.data?.results || res?.data || [];
const processingChargeTypeLabel = (value) => {
  if (value === "per_unit") return "За единицу";
  if (value === "fixed") return "Фиксированно";
  return "—";
};

const emptyPreparation = {
  name: "",
  source_product: "",
  input_quantity: "",
  input_unit: "kg",
  output_quantity: "",
  output_unit: "kg",
  processing_cost: "",
  stock_quantity: "0",
  is_active: true,
};
const emptyReceiveForm = {
  input_quantity: "",
  output_quantity: "",
  processing_cost: "",
};

const emptyProcessing = {
  name: "",
  cost: "",
  charge_type: "fixed",
  unit: "",
  is_active: true,
};

const emptyPreviewIngredient = {
  ingredient_type: "product",
  product: "",
  preparation: "",
  quantity: "",
  unit: "g",
  processing_type_ids: [],
};

export default function CafeCosting() {
  const alert = useAlert();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [warehouseProducts, setWarehouseProducts] = useState([]);
  const [preparations, setPreparations] = useState([]);
  const [processingTypes, setProcessingTypes] = useState([]);

  const [dishId, setDishId] = useState("");
  const [dishCost, setDishCost] = useState(null);
  const [dishIngredients, setDishIngredients] = useState([]);
  const [ingredientForm, setIngredientForm] = useState({
    ingredient_type: "product",
    product: "",
    preparation: "",
    quantity: "",
    unit: "g",
  });

  const [prepModalOpen, setPrepModalOpen] = useState(false);
  const [prepEditingId, setPrepEditingId] = useState("");
  const [prepForm, setPrepForm] = useState(emptyPreparation);

  const [procModalOpen, setProcModalOpen] = useState(false);
  const [procEditingId, setProcEditingId] = useState("");
  const [procForm, setProcForm] = useState(emptyProcessing);
  const [receiveModalOpen, setReceiveModalOpen] = useState(false);
  const [receivePreparationId, setReceivePreparationId] = useState("");
  const [receivePreparationName, setReceivePreparationName] = useState("");
  const [receiveForm, setReceiveForm] = useState(emptyReceiveForm);

  const [previewForm, setPreviewForm] = useState({
    sale_price: "",
    other_expenses: "0",
    ingredients: [emptyPreviewIngredient],
  });
  const [previewResult, setPreviewResult] = useState(null);
  const [activeTab, setActiveTab] = useState("preparations");

  const loadAll = async () => {
    try {
      setLoading(true);
      const [productsRes, prepRes, procRes] = await Promise.all([
        api.get("/cafe/warehouse/"),
        api.get("/cafe/preparations/"),
        api.get("/cafe/processing-types/"),
      ]);
      setWarehouseProducts(Array.isArray(listFrom(productsRes)) ? listFrom(productsRes) : []);
      setPreparations(Array.isArray(listFrom(prepRes)) ? listFrom(prepRes) : []);
      setProcessingTypes(Array.isArray(listFrom(procRes)) ? listFrom(procRes) : []);
    } catch (error) {
      alert(validateResErrors(error, "Ошибка загрузки данных себестоимости"), true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadAll();
  }, []);

  const productOptions = useMemo(
    () =>
      warehouseProducts.map((p) => ({
        id: String(p.id || ""),
        label: p.title || p.name || p.code || "Товар",
      })),
    [warehouseProducts],
  );

  const preparationOptions = useMemo(
    () =>
      preparations.map((p) => ({
        id: String(p.id || ""),
        label: p.name || "Заготовка",
      })),
    [preparations],
  );

  const handleLoadDishCost = async () => {
    const id = String(dishId || "").trim();
    if (!id) {
      alert("Введите dish_id", true);
      return;
    }
    try {
      const { data } = await api.get(`/cafe/dishes/${encodeURIComponent(id)}/cost/`);
      setDishCost(data || null);
    } catch (error) {
      setDishCost(null);
      alert(validateResErrors(error, "Ошибка получения себестоимости блюда"), true);
    }
  };

  const loadDishIngredients = async () => {
    const id = String(dishId || "").trim();
    if (!id) return;
    try {
      // Most compatible strategy: try dedicated list endpoint first
      let rows = [];
      try {
        const res = await api.get("/cafe/dish-ingredients/", { params: { dish: id } });
        rows = Array.isArray(listFrom(res)) ? listFrom(res) : [];
      } catch {
        const res = await api.get(`/cafe/menu-items/${encodeURIComponent(id)}/`);
        const data = res?.data || {};
        rows = Array.isArray(data?.dish_ingredients)
          ? data.dish_ingredients
          : Array.isArray(data?.ingredients)
            ? data.ingredients
            : [];
      }
      setDishIngredients(rows);
    } catch (error) {
      setDishIngredients([]);
      alert(validateResErrors(error, "Ошибка загрузки ингредиентов блюда"), true);
    }
  };

  const handleAddDishIngredient = async () => {
    const id = String(dishId || "").trim();
    if (!id) {
      alert("Введите dish_id", true);
      return;
    }
    try {
      const payload = {
        ingredient_type: ingredientForm.ingredient_type,
        quantity: ingredientForm.quantity || "0",
        unit: ingredientForm.unit || "g",
        ...(ingredientForm.ingredient_type === "product"
          ? { product: ingredientForm.product || null }
          : { preparation: ingredientForm.preparation || null }),
      };
      await api.post(`/cafe/dishes/${encodeURIComponent(id)}/ingredients/`, payload);
      setIngredientForm({
        ingredient_type: "product",
        product: "",
        preparation: "",
        quantity: "",
        unit: "g",
      });
      await loadDishIngredients();
      await handleLoadDishCost();
    } catch (error) {
      alert(validateResErrors(error, "Ошибка добавления ингредиента"), true);
    }
  };

  const handleDeleteDishIngredient = async (id) => {
    if (!window.confirm("Удалить ингредиент?")) return;
    try {
      await api.delete(`/cafe/dish-ingredients/${encodeURIComponent(id)}/`);
      await loadDishIngredients();
      await handleLoadDishCost();
    } catch (error) {
      alert(validateResErrors(error, "Ошибка удаления ингредиента"), true);
    }
  };

  const openCreatePreparation = () => {
    setPrepEditingId("");
    setPrepForm(emptyPreparation);
    setPrepModalOpen(true);
  };

  const openEditPreparation = (row) => {
    setPrepEditingId(String(row?.id || ""));
    setPrepForm({
      name: row?.name || "",
      source_product: String(row?.source_product || ""),
      input_quantity: String(row?.input_quantity || ""),
      input_unit: row?.input_unit || "kg",
      output_quantity: String(row?.output_quantity || ""),
      output_unit: row?.output_unit || "kg",
      processing_cost: String(row?.processing_cost || "0"),
      stock_quantity: String(row?.stock_quantity || "0"),
      is_active: Boolean(row?.is_active),
    });
    setPrepModalOpen(true);
  };

  const handleSavePreparation = async (e) => {
    e.preventDefault();
    try {
      setSaving(true);
      const payload = {
        ...prepForm,
        source_product: prepForm.source_product || null,
      };
      if (prepEditingId) {
        await api.patch(`/cafe/preparations/${encodeURIComponent(prepEditingId)}/`, payload);
      } else {
        await api.post("/cafe/preparations/", payload);
      }
      setPrepModalOpen(false);
      await loadAll();
    } catch (error) {
      alert(validateResErrors(error, "Ошибка сохранения заготовки"), true);
    } finally {
      setSaving(false);
    }
  };

  const handleDeletePreparation = async (id) => {
    if (!window.confirm("Удалить заготовку?")) return;
    try {
      await api.delete(`/cafe/preparations/${encodeURIComponent(id)}/`);
      await loadAll();
    } catch (error) {
      alert(validateResErrors(error, "Ошибка удаления заготовки"), true);
    }
  };

  const openReceivePreparation = (row) => {
    setReceivePreparationId(String(row?.id || ""));
    setReceivePreparationName(String(row?.name || "Заготовка"));
    setReceiveForm({
      input_quantity: "",
      output_quantity: "",
      processing_cost: String(row?.processing_cost ?? ""),
    });
    setReceiveModalOpen(true);
  };

  const handleReceivePreparation = async (e) => {
    e.preventDefault();
    const preparationId = String(receivePreparationId || "");
    if (!preparationId) return;

    const inputQ = Number(String(receiveForm.input_quantity || "").replace(",", "."));
    const outputQ = Number(String(receiveForm.output_quantity || "").replace(",", "."));
    const processingCostRaw = String(receiveForm.processing_cost || "").trim();
    const processingCostNum =
      processingCostRaw === "" ? null : Number(processingCostRaw.replace(",", "."));

    if (!Number.isFinite(inputQ) || inputQ <= 0) {
      alert("Входное количество должно быть больше 0", true);
      return;
    }
    if (!Number.isFinite(outputQ) || outputQ <= 0) {
      alert("Выходное количество должно быть больше 0", true);
      return;
    }
    if (outputQ > inputQ) {
      alert("Выходное количество не может быть больше входного", true);
      return;
    }
    if (processingCostNum !== null && (!Number.isFinite(processingCostNum) || processingCostNum < 0)) {
      alert("Стоимость обработки не может быть отрицательной", true);
      return;
    }

    const payload = {
      input_quantity: String(inputQ),
      output_quantity: String(outputQ),
      ...(processingCostNum !== null
        ? { processing_cost: String(processingCostNum) }
        : {}),
    };

    try {
      setSaving(true);
      await api.post(
        `/cafe/preparations/${encodeURIComponent(preparationId)}/receive/`,
        payload,
      );
      setReceiveModalOpen(false);
      await loadAll();
      alert("Приход заготовки успешно выполнен");
    } catch (error) {
      alert(validateResErrors(error, "Ошибка при оприходовании заготовки"), true);
    } finally {
      setSaving(false);
    }
  };

  const openCreateProcessing = () => {
    setProcEditingId("");
    setProcForm(emptyProcessing);
    setProcModalOpen(true);
  };

  const openEditProcessing = (row) => {
    setProcEditingId(String(row?.id || ""));
    setProcForm({
      name: row?.name || "",
      cost: String(row?.cost || ""),
      charge_type: row?.charge_type || "fixed",
      unit: row?.unit || "",
      is_active: Boolean(row?.is_active),
    });
    setProcModalOpen(true);
  };

  const handleSaveProcessing = async (e) => {
    e.preventDefault();
    try {
      setSaving(true);
      if (procEditingId) {
        await api.patch(`/cafe/processing-types/${encodeURIComponent(procEditingId)}/`, procForm);
      } else {
        await api.post("/cafe/processing-types/", procForm);
      }
      setProcModalOpen(false);
      await loadAll();
    } catch (error) {
      alert(validateResErrors(error, "Ошибка сохранения типа обработки"), true);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteProcessing = async (id) => {
    if (!window.confirm("Удалить тип обработки?")) return;
    try {
      await api.delete(`/cafe/processing-types/${encodeURIComponent(id)}/`);
      await loadAll();
    } catch (error) {
      alert(validateResErrors(error, "Ошибка удаления типа обработки"), true);
    }
  };

  const updatePreviewIngredient = (idx, patch) => {
    setPreviewForm((prev) => ({
      ...prev,
      ingredients: prev.ingredients.map((it, i) => (i === idx ? { ...it, ...patch } : it)),
    }));
  };

  const addPreviewIngredient = () => {
    setPreviewForm((prev) => ({ ...prev, ingredients: [...prev.ingredients, emptyPreviewIngredient] }));
  };

  const removePreviewIngredient = (idx) => {
    setPreviewForm((prev) => ({
      ...prev,
      ingredients: prev.ingredients.filter((_, i) => i !== idx),
    }));
  };

  const handlePreview = async () => {
    try {
      const payload = {
        sale_price: previewForm.sale_price || "0",
        other_expenses: previewForm.other_expenses || "0",
        ingredients: previewForm.ingredients
          .map((it) => ({
            ingredient_type: it.ingredient_type,
            ...(it.ingredient_type === "product"
              ? { product: it.product || null }
              : { preparation: it.preparation || null }),
            quantity: it.quantity || "0",
            unit: it.unit || "g",
            processing_type_ids: Array.isArray(it.processing_type_ids) ? it.processing_type_ids : [],
          }))
          .filter((it) => Number(it.quantity) > 0),
      };
      const { data } = await api.post("/cafe/dishes/calculate-preview/", payload);
      setPreviewResult(data || null);
    } catch (error) {
      setPreviewResult(null);
      alert(validateResErrors(error, "Ошибка расчета предпросмотра"), true);
    }
  };

  return (
    <div className="cafe-costing-page">
      <DataContainer>
        <div className="cafe-costing-page__card">
          <h1 className="cafe-costing-page__title">Заготовки</h1>
          <p className="cafe-costing-page__subtitle">
            Управление заготовками, обработками и расчетом себестоимости по новой схеме.
          </p>
          <div className="cafe-costing-page__tabs">
            <button
              type="button"
              className={`cafe-costing-page__tab ${activeTab === "preparations" ? "cafe-costing-page__tab--active" : ""}`}
              onClick={() => setActiveTab("preparations")}
            >
              Заготовки
            </button>
            <button
              type="button"
              className={`cafe-costing-page__tab ${activeTab === "processing" ? "cafe-costing-page__tab--active" : ""}`}
              onClick={() => setActiveTab("processing")}
            >
              Обработки
            </button>
            <button
              type="button"
              className={`cafe-costing-page__tab ${activeTab === "preview" ? "cafe-costing-page__tab--active" : ""}`}
              onClick={() => setActiveTab("preview")}
            >
              Предпросмотр
            </button>
          </div>

          {loading ? (
            <div className="cafe-costing-page__empty">Загрузка...</div>
          ) : (
            <>
              {activeTab === "preparations" && (
                <section className="cafe-costing-page__section">
                <div className="cafe-costing-page__row cafe-costing-page__row--between">
                  <h2>Заготовки</h2>
                  <button className="cafe-costing-page__btn" onClick={openCreatePreparation} type="button">
                    + Заготовка
                  </button>
                </div>
                <div className="cafe-costing-page__table-wrap">
                  <table className="cafe-costing-page__table">
                    <thead>
                      <tr>
                        <th>Название</th>
                        <th>Выход</th>
                        <th>Себестоимость ед.</th>
                        <th>Остаток</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {preparations.map((p) => (
                        <tr key={p.id}>
                          <td>{p.name}</td>
                          <td>{p.output_quantity} {p.output_unit}</td>
                          <td>{p.unit_cost}</td>
                          <td>{p.stock_quantity}</td>
                          <td className="cafe-costing-page__actions">
                            <button type="button" onClick={() => openReceivePreparation(p)}>
                              Приход
                            </button>
                            <button type="button" onClick={() => openEditPreparation(p)}>Изм.</button>
                            <button
                              type="button"
                              className="cafe-costing-page__danger-btn"
                              onClick={() => handleDeletePreparation(p.id)}
                              title="Удалить"
                              aria-label="Удалить"
                            >
                              <Trash2 size={14} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                </section>
              )}

              {activeTab === "processing" && (
                <section className="cafe-costing-page__section">
                <div className="cafe-costing-page__row cafe-costing-page__row--between">
                  <h2>Типы обработки</h2>
                  <button className="cafe-costing-page__btn" onClick={openCreateProcessing} type="button">
                    + Тип обработки
                  </button>
                </div>
                <div className="cafe-costing-page__table-wrap">
                  <table className="cafe-costing-page__table">
                    <thead>
                      <tr>
                        <th>Название</th>
                        <th>Стоимость</th>
                        <th>Тип</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {processingTypes.map((p) => (
                        <tr key={p.id}>
                          <td>{p.name}</td>
                          <td>{p.cost}</td>
                          <td>{processingChargeTypeLabel(p.charge_type)}</td>
                          <td className="cafe-costing-page__actions">
                            <button type="button" onClick={() => openEditProcessing(p)}>Изм.</button>
                            <button
                              type="button"
                              className="cafe-costing-page__danger-btn"
                              onClick={() => handleDeleteProcessing(p.id)}
                              title="Удалить"
                              aria-label="Удалить"
                            >
                              <Trash2 size={14} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                </section>
              )}

              {activeTab === "preview" && (
                <section className="cafe-costing-page__section">
                <h2>Предпросмотр расчета</h2>
                <div className="cafe-costing-page__row">
                  <label className="cafe-costing-page__field">
                    <span className="cafe-costing-page__field-label">Цена продажи блюда</span>
                  <input
                    className="cafe-costing-page__input"
                    value={previewForm.sale_price}
                    onChange={(e) => setPreviewForm((prev) => ({ ...prev, sale_price: e.target.value }))}
                    placeholder="Например: 350"
                  />
                  </label>
                  <label className="cafe-costing-page__field">
                    <span className="cafe-costing-page__field-label">Прочие расходы</span>
                  <input
                    className="cafe-costing-page__input"
                    value={previewForm.other_expenses}
                    onChange={(e) =>
                      setPreviewForm((prev) => ({ ...prev, other_expenses: e.target.value }))
                    }
                    placeholder="Например: 25"
                  />
                  </label>
                  <button
                    className="cafe-costing-page__btn cafe-costing-page__btn--small"
                    onClick={addPreviewIngredient}
                    type="button"
                  >
                    + Ингредиент
                  </button>
                </div>
                <div className="cafe-costing-page__ingredients-list">
                  {previewForm.ingredients.map((it, idx) => (
                  <div key={`ing-${idx}`} className="cafe-costing-page__row cafe-costing-page__ingredient-row">
                    <label className="cafe-costing-page__field">
                      <span className="cafe-costing-page__field-label">Тип ингредиента</span>
                      <select
                      className="cafe-costing-page__input"
                      value={it.ingredient_type}
                      onChange={(e) =>
                        updatePreviewIngredient(idx, {
                          ingredient_type: e.target.value,
                          product: "",
                          preparation: "",
                        })
                      }
                    >
                      <option value="product">Товар</option>
                      <option value="preparation">Заготовка</option>
                      </select>
                    </label>
                    {it.ingredient_type === "product" ? (
                      <label className="cafe-costing-page__field">
                        <span className="cafe-costing-page__field-label">Товар со склада</span>
                        <select
                        className="cafe-costing-page__input"
                        value={it.product}
                        onChange={(e) => updatePreviewIngredient(idx, { product: e.target.value })}
                      >
                        <option value="">Товар</option>
                        {productOptions.map((opt) => (
                          <option key={opt.id} value={opt.id}>
                            {opt.label}
                          </option>
                        ))}
                        </select>
                      </label>
                    ) : (
                      <label className="cafe-costing-page__field">
                        <span className="cafe-costing-page__field-label">Заготовка</span>
                        <select
                        className="cafe-costing-page__input"
                        value={it.preparation}
                        onChange={(e) => updatePreviewIngredient(idx, { preparation: e.target.value })}
                      >
                        <option value="">Заготовка</option>
                        {preparationOptions.map((opt) => (
                          <option key={opt.id} value={opt.id}>
                            {opt.label}
                          </option>
                        ))}
                        </select>
                      </label>
                    )}
                    <div className="cafe-costing-page__qty-unit">
                      <label className="cafe-costing-page__field cafe-costing-page__field--qty">
                        <span className="cafe-costing-page__field-label">Количество</span>
                        <input
                          className="cafe-costing-page__input"
                          value={it.quantity}
                          onChange={(e) => updatePreviewIngredient(idx, { quantity: e.target.value })}
                          placeholder="Например: 150"
                        />
                      </label>
                      <label className="cafe-costing-page__field cafe-costing-page__field--unit">
                        <span className="cafe-costing-page__field-label">Ед. изм.</span>
                        <select
                          className="cafe-costing-page__input"
                          value={it.unit}
                          onChange={(e) => updatePreviewIngredient(idx, { unit: e.target.value })}
                        >
                          <option value="kg">кг</option>
                          <option value="g">г</option>
                          <option value="l">л</option>
                          <option value="ml">мл</option>
                          <option value="pcs">шт</option>
                        </select>
                      </label>
                    </div>
                    <button
                      type="button"
                      className="cafe-costing-page__danger-btn cafe-costing-page__ingredient-remove"
                      onClick={() => removePreviewIngredient(idx)}
                      title="Удалить ингредиент"
                      aria-label="Удалить ингредиент"
                    >
                      <X size={12} />
                    </button>
                  </div>
                ))}
                </div>
                <div className="cafe-costing-page__row">
                  <button className="cafe-costing-page__btn" onClick={handlePreview} type="button">
                    Рассчитать предпросмотр
                  </button>
                </div>
                {previewResult && (
                  <div className="cafe-costing-page__stats">
                    <span>Себестоимость: {previewResult.cost_price}</span>
                    <span>Сумма маржи: {previewResult.margin_amount}</span>
                    <span>Маржа (%): {previewResult.margin_percent}</span>
                  </div>
                )}
                </section>
              )}
            </>
          )}
        </div>
      </DataContainer>

      {prepModalOpen && (
        <div className="cafe-costing-page__overlay" onClick={() => setPrepModalOpen(false)}>
          <form className="cafe-costing-page__modal" onClick={(e) => e.stopPropagation()} onSubmit={handleSavePreparation}>
            <h3>{prepEditingId ? "Изменить заготовку" : "Новая заготовка"}</h3>
            <label className="cafe-costing-page__field">
              <span className="cafe-costing-page__field-label">Название заготовки *</span>
              <input
              className="cafe-costing-page__input"
              value={prepForm.name}
              onChange={(e) => setPrepForm((prev) => ({ ...prev, name: e.target.value }))}
              placeholder="Например: Очищенная картошка"
              required
            />
            </label>
            <label className="cafe-costing-page__field">
              <span className="cafe-costing-page__field-label">Исходный товар *</span>
              <select
              className="cafe-costing-page__input"
              value={prepForm.source_product}
              onChange={(e) => setPrepForm((prev) => ({ ...prev, source_product: e.target.value }))}
              required
            >
              <option value="">Исходный товар</option>
              {productOptions.map((opt) => (
                <option key={opt.id} value={opt.id}>
                  {opt.label}
                </option>
              ))}
              </select>
            </label>
            <div className="cafe-costing-page__row">
              <label className="cafe-costing-page__field cafe-costing-page__field--qty">
                <span className="cafe-costing-page__field-label">Входное количество *</span>
                <input
                className="cafe-costing-page__input"
                value={prepForm.input_quantity}
                onChange={(e) => setPrepForm((prev) => ({ ...prev, input_quantity: e.target.value }))}
                placeholder="Например: 1"
                required
              />
              </label>
              <label className="cafe-costing-page__field cafe-costing-page__field--unit">
                <span className="cafe-costing-page__field-label">Ед. входа</span>
                <select
                className="cafe-costing-page__input"
                value={prepForm.input_unit}
                onChange={(e) => setPrepForm((prev) => ({ ...prev, input_unit: e.target.value }))}
              >
                <option value="kg">кг</option>
                <option value="g">г</option>
                <option value="l">л</option>
                <option value="ml">мл</option>
                <option value="pcs">шт</option>
                </select>
              </label>
            </div>
            <div className="cafe-costing-page__row">
              <label className="cafe-costing-page__field cafe-costing-page__field--qty">
                <span className="cafe-costing-page__field-label">Выходное количество *</span>
                <input
                className="cafe-costing-page__input"
                value={prepForm.output_quantity}
                onChange={(e) => setPrepForm((prev) => ({ ...prev, output_quantity: e.target.value }))}
                placeholder="Например: 0.8"
                required
              />
              </label>
              <label className="cafe-costing-page__field cafe-costing-page__field--unit">
                <span className="cafe-costing-page__field-label">Ед. выхода</span>
                <select
                className="cafe-costing-page__input"
                value={prepForm.output_unit}
                onChange={(e) => setPrepForm((prev) => ({ ...prev, output_unit: e.target.value }))}
              >
                <option value="kg">кг</option>
                <option value="g">г</option>
                <option value="l">л</option>
                <option value="ml">мл</option>
                <option value="pcs">шт</option>
                </select>
              </label>
            </div>
            <label className="cafe-costing-page__field">
              <span className="cafe-costing-page__field-label">Стоимость обработки</span>
              <input
              className="cafe-costing-page__input"
              value={prepForm.processing_cost}
              onChange={(e) => setPrepForm((prev) => ({ ...prev, processing_cost: e.target.value }))}
              placeholder="Например: 10"
            />
            </label>
            <label className="cafe-costing-page__field">
              <span className="cafe-costing-page__field-label">Остаток заготовки</span>
              <input
              className="cafe-costing-page__input"
              value={prepForm.stock_quantity}
              onChange={(e) => setPrepForm((prev) => ({ ...prev, stock_quantity: e.target.value }))}
              placeholder="Например: 0"
            />
            </label>
            <div className="cafe-costing-page__row">
              <button type="button" onClick={() => setPrepModalOpen(false)}>
                Отмена
              </button>
              <button type="submit" disabled={saving}>
                {saving ? "Сохранение..." : "Сохранить"}
              </button>
            </div>
          </form>
        </div>
      )}

      {procModalOpen && (
        <div className="cafe-costing-page__overlay" onClick={() => setProcModalOpen(false)}>
          <form className="cafe-costing-page__modal" onClick={(e) => e.stopPropagation()} onSubmit={handleSaveProcessing}>
            <h3>{procEditingId ? "Изменить обработку" : "Новая обработка"}</h3>
            <label className="cafe-costing-page__field">
              <span className="cafe-costing-page__field-label">Название обработки *</span>
              <input
              className="cafe-costing-page__input"
              value={procForm.name}
              onChange={(e) => setProcForm((prev) => ({ ...prev, name: e.target.value }))}
              placeholder="Например: Жарка"
              required
            />
            </label>
            <label className="cafe-costing-page__field">
              <span className="cafe-costing-page__field-label">Стоимость *</span>
              <input
              className="cafe-costing-page__input"
              value={procForm.cost}
              onChange={(e) => setProcForm((prev) => ({ ...prev, cost: e.target.value }))}
              placeholder="Например: 15"
              required
            />
            </label>
            <label className="cafe-costing-page__field">
              <span className="cafe-costing-page__field-label">Тип начисления</span>
              <select
              className="cafe-costing-page__input"
              value={procForm.charge_type}
              onChange={(e) => setProcForm((prev) => ({ ...prev, charge_type: e.target.value }))}
            >
              <option value="fixed">Фиксированно</option>
              <option value="per_unit">За единицу</option>
            </select>
            </label>
            <label className="cafe-costing-page__field">
              <span className="cafe-costing-page__field-label">Единица (необязательно)</span>
              <input
              className="cafe-costing-page__input"
              value={procForm.unit}
              onChange={(e) => setProcForm((prev) => ({ ...prev, unit: e.target.value }))}
              placeholder="Например: g или pcs"
            />
            </label>
            <div className="cafe-costing-page__row">
              <button type="button" onClick={() => setProcModalOpen(false)}>
                Отмена
              </button>
              <button type="submit" disabled={saving}>
                {saving ? "Сохранение..." : "Сохранить"}
              </button>
            </div>
          </form>
        </div>
      )}

      {receiveModalOpen && (
        <div className="cafe-costing-page__overlay" onClick={() => setReceiveModalOpen(false)}>
          <form
            className="cafe-costing-page__modal"
            onClick={(e) => e.stopPropagation()}
            onSubmit={handleReceivePreparation}
          >
            <h3>Приход заготовки</h3>
            <p className="cafe-costing-page__subtitle" style={{ margin: 0 }}>
              {receivePreparationName}
            </p>
            <label className="cafe-costing-page__field">
              <span className="cafe-costing-page__field-label">Входное количество *</span>
              <input
                className="cafe-costing-page__input"
                value={receiveForm.input_quantity}
                onChange={(e) =>
                  setReceiveForm((prev) => ({ ...prev, input_quantity: e.target.value }))
                }
                placeholder="Например: 5.0"
                required
              />
            </label>
            <label className="cafe-costing-page__field">
              <span className="cafe-costing-page__field-label">Выходное количество *</span>
              <input
                className="cafe-costing-page__input"
                value={receiveForm.output_quantity}
                onChange={(e) =>
                  setReceiveForm((prev) => ({ ...prev, output_quantity: e.target.value }))
                }
                placeholder="Например: 4.7"
                required
              />
            </label>
            <label className="cafe-costing-page__field">
              <span className="cafe-costing-page__field-label">Стоимость обработки</span>
              <input
                className="cafe-costing-page__input"
                value={receiveForm.processing_cost}
                onChange={(e) =>
                  setReceiveForm((prev) => ({ ...prev, processing_cost: e.target.value }))
                }
                placeholder="Например: 10.00"
              />
            </label>
            <div className="cafe-costing-page__row">
              <button type="button" onClick={() => setReceiveModalOpen(false)}>
                Отмена
              </button>
              <button type="submit" disabled={saving}>
                {saving ? "Сохранение..." : "Сделать приход"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

