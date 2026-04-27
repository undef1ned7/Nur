import React, { useEffect, useMemo, useState } from "react";
import { Trash2, X } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import api from "../../../../api";
import DataContainer from "../../../common/DataContainer/DataContainer";
import { useAlert, useConfirm } from "../../../../hooks/useDialog";
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
const emptyPreparationProcessing = {
  id: "",
  name: "",
  cost: "",
  charge_type: "fixed",
  unit: "",
};
const emptyReceiveForm = {
  input_quantity: "",
  output_quantity: "",
  processing_cost: "",
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
  const navigate = useNavigate();
  const { preparationId } = useParams();
  const alert = useAlert();
  const confirm = useConfirm();
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
  const [prepProcessings, setPrepProcessings] = useState([]);
  const [prepProcessingModalOpen, setPrepProcessingModalOpen] = useState(false);
  const [prepProcessingEditIdx, setPrepProcessingEditIdx] = useState(-1);
  const [prepProcessingForm, setPrepProcessingForm] = useState({
    name: "",
    cost: "",
    charge_type: "fixed",
    unit: "",
  });
  const [detailPreparation, setDetailPreparation] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailProcessingModalOpen, setDetailProcessingModalOpen] = useState(false);
  const [detailProcessingEditIdx, setDetailProcessingEditIdx] = useState(-1);
  const [detailProcessingForm, setDetailProcessingForm] = useState({
    name: "",
    cost: "",
    charge_type: "fixed",
    unit: "",
  });
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
  const [preparationsViewMode, setPreparationsViewMode] = useState("cards");

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

  useEffect(() => {
    if (!preparationId) {
      setDetailPreparation(null);
      return;
    }
    let mounted = true;
    (async () => {
      try {
        setDetailLoading(true);
        const res = await api.get(`/cafe/preparations/${encodeURIComponent(preparationId)}/`);
        if (mounted) setDetailPreparation(res?.data || null);
      } catch (error) {
        if (mounted) {
          setDetailPreparation(null);
          alert(validateResErrors(error, "Ошибка загрузки заготовки"), true);
        }
      } finally {
        if (mounted) setDetailLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [preparationId]);

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
    setPrepProcessings([]);
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
    setPrepProcessings(
      (Array.isArray(row?.processings) ? row.processings : []).map((it) => ({
        id: String(it?.id || ""),
        name: String(it?.name || ""),
        cost: String(it?.cost || ""),
        charge_type: it?.charge_type === "per_unit" ? "per_unit" : "fixed",
        unit: String(it?.unit || ""),
      })),
    );
    setPrepModalOpen(true);
  };

  const openCreatePrepProcessingModal = () => {
    setPrepProcessingEditIdx(-1);
    setPrepProcessingForm({ name: "", cost: "", charge_type: "fixed", unit: "" });
    setPrepProcessingModalOpen(true);
  };

  const openEditPrepProcessingModal = (idx, row) => {
    setPrepProcessingEditIdx(idx);
    setPrepProcessingForm({
      name: String(row?.name || ""),
      cost: String(row?.cost || ""),
      charge_type: row?.charge_type === "per_unit" ? "per_unit" : "fixed",
      unit: String(row?.unit || ""),
    });
    setPrepProcessingModalOpen(true);
  };

  const savePrepProcessingModal = (e) => {
    e.preventDefault();
    if (!String(prepProcessingForm.name || "").trim()) {
      alert("Введите название обработки", true);
      return;
    }
    const costNum = Number(String(prepProcessingForm.cost || "").replace(",", "."));
    if (!Number.isFinite(costNum) || costNum < 0) {
      alert("Стоимость обработки должна быть >= 0", true);
      return;
    }
    setPrepProcessings((prev) => {
      if (prepProcessingEditIdx >= 0) {
        return prev.map((it, idx) =>
          idx === prepProcessingEditIdx ? { ...it, ...prepProcessingForm } : it,
        );
      }
      return [...prev, { ...emptyPreparationProcessing, ...prepProcessingForm }];
    });
    setPrepProcessingModalOpen(false);
  };

  const removePrepProcessingRow = (idx) => {
    setPrepProcessings((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSavePreparation = async (e) => {
    e.preventDefault();
    try {
      setSaving(true);
      const normalizedProcessings = prepProcessings
        .map((it) => ({
          name: String(it?.name || "").trim(),
          cost: String(it?.cost || "").trim(),
          charge_type: it?.charge_type === "per_unit" ? "per_unit" : "fixed",
          unit: String(it?.unit || "").trim(),
        }))
        .filter((it) => it.name && it.cost !== "");
      const invalidProcessing = normalizedProcessings.some((it) => Number(it.cost) < 0);
      if (invalidProcessing) {
        alert("Стоимость обработки не может быть отрицательной", true);
        setSaving(false);
        return;
      }
      const payload = {
        ...prepForm,
        source_product: prepForm.source_product || null,
        processings: normalizedProcessings,
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
    confirm("Удалить заготовку?", async (ok) => {
      if (!ok) return;
      try {
        await api.delete(`/cafe/preparations/${encodeURIComponent(id)}/`);
        await loadAll();
      } catch (error) {
        alert(validateResErrors(error, "Ошибка удаления заготовки"), true);
      }
    });
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

  const openCreateDetailProcessing = () => {
    setDetailProcessingEditIdx(-1);
    setDetailProcessingForm({ name: "", cost: "", charge_type: "fixed", unit: "" });
    setDetailProcessingModalOpen(true);
  };

  const openEditDetailProcessing = (idx, row) => {
    setDetailProcessingEditIdx(idx);
    setDetailProcessingForm({
      name: String(row?.name || ""),
      cost: String(row?.cost || ""),
      charge_type: row?.charge_type === "per_unit" ? "per_unit" : "fixed",
      unit: String(row?.unit || ""),
    });
    setDetailProcessingModalOpen(true);
  };

  const saveDetailProcessings = async (nextRows) => {
    if (!preparationId) return;
    const normalized = (Array.isArray(nextRows) ? nextRows : [])
      .map((it) => ({
        name: String(it?.name || "").trim(),
        cost: String(it?.cost || "").trim(),
        charge_type: it?.charge_type === "per_unit" ? "per_unit" : "fixed",
        unit: String(it?.unit || "").trim(),
      }))
      .filter((it) => it.name && it.cost !== "");
    const invalid = normalized.some((it) => Number(it.cost) < 0);
    if (invalid) {
      alert("Стоимость обработки не может быть отрицательной", true);
      return;
    }
    const { data } = await api.patch(
      `/cafe/preparations/${encodeURIComponent(preparationId)}/`,
      { processings: normalized },
    );
    setDetailPreparation(data || null);
    await loadAll();
  };

  const handleSaveDetailProcessing = async (e) => {
    e.preventDefault();
    if (!detailPreparation) return;
    const currentRows = Array.isArray(detailPreparation?.processings)
      ? detailPreparation.processings
      : [];
    const nextRows =
      detailProcessingEditIdx >= 0
        ? currentRows.map((it, idx) =>
            idx === detailProcessingEditIdx ? { ...it, ...detailProcessingForm } : it,
          )
        : [...currentRows, detailProcessingForm];
    try {
      setSaving(true);
      await saveDetailProcessings(nextRows);
      setDetailProcessingModalOpen(false);
    } catch (error) {
      alert(validateResErrors(error, "Ошибка сохранения обработки заготовки"), true);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteDetailProcessing = async (idx) => {
    if (!detailPreparation) return;
    if (!window.confirm("Удалить обработку?")) return;
    try {
      setSaving(true);
      const currentRows = Array.isArray(detailPreparation?.processings)
        ? detailPreparation.processings
        : [];
      const nextRows = currentRows.filter((_, i) => i !== idx);
      await saveDetailProcessings(nextRows);
    } catch (error) {
      alert(validateResErrors(error, "Ошибка удаления обработки заготовки"), true);
    } finally {
      setSaving(false);
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
              {preparationId ? (
                <section className="cafe-costing-page__section">
                  <div className="cafe-costing-page__row cafe-costing-page__row--between">
                    <h2>
                      {detailLoading
                        ? "Загрузка..."
                        : `Заготовка: ${detailPreparation?.name || "—"}`}
                    </h2>
                    <button
                      className="cafe-costing-page__btn"
                      type="button"
                      onClick={() => navigate("/crm/cafe/costing")}
                    >
                      Назад к списку
                    </button>
                  </div>
                  <div className="cafe-costing-page__table-wrap">
                    <table className="cafe-costing-page__table">
                      <thead>
                        <tr>
                          <th>Название</th>
                          <th>Ставка</th>
                          <th>Тип</th>
                          <th>Ед.</th>
                          <th />
                        </tr>
                      </thead>
                      <tbody>
                        {(Array.isArray(detailPreparation?.processings)
                          ? detailPreparation.processings
                          : []
                        ).map((p, idx) => (
                          <tr key={String(p?.id || idx)}>
                            <td>{p?.name || "—"}</td>
                            <td>{p?.cost || "0"}</td>
                            <td>{processingChargeTypeLabel(p?.charge_type)}</td>
                            <td>{p?.unit || "—"}</td>
                            <td className="cafe-costing-page__actions">
                              <button
                                type="button"
                                onClick={() => openEditDetailProcessing(idx, p)}
                              >
                                Изм.
                              </button>
                              <button
                                type="button"
                                className="cafe-costing-page__danger-btn"
                                onClick={() => handleDeleteDetailProcessing(idx)}
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
                  <div className="cafe-costing-page__row">
                    <button
                      className="cafe-costing-page__btn"
                      type="button"
                      onClick={openCreateDetailProcessing}
                    >
                      + Добавить обработку
                    </button>
                  </div>
                </section>
              ) : activeTab === "preparations" && (
                <section className="cafe-costing-page__section">
                <div className="cafe-costing-page__row cafe-costing-page__row--between">
                  <h2>Заготовки</h2>
                  <div className="cafe-costing-page__row" style={{ marginTop: 0 }}>
                    <div className="cafe-costing-page__view-toggle">
                      <button
                        type="button"
                        className={`cafe-costing-page__view-btn ${
                          preparationsViewMode === "cards"
                            ? "cafe-costing-page__view-btn--active"
                            : ""
                        }`}
                        onClick={() => setPreparationsViewMode("cards")}
                      >
                        Карточки
                      </button>
                      <button
                        type="button"
                        className={`cafe-costing-page__view-btn ${
                          preparationsViewMode === "list"
                            ? "cafe-costing-page__view-btn--active"
                            : ""
                        }`}
                        onClick={() => setPreparationsViewMode("list")}
                      >
                        Список
                      </button>
                    </div>
                    <button
                      className="cafe-costing-page__btn"
                      onClick={openCreatePreparation}
                      type="button"
                    >
                      + Заготовка
                    </button>
                  </div>
                </div>
                {preparationsViewMode === "cards" ? (
                  <div className="cafe-costing-page__prep-grid">
                    {preparations.map((p) => (
                      <article key={p.id} className="cafe-costing-page__prep-card">
                        <h3 className="cafe-costing-page__prep-title">{p.name}</h3>
                        <div className="cafe-costing-page__prep-stats">
                          <span>Выход: {p.output_quantity} {p.output_unit}</span>
                          <span>Себестоимость ед.: {p.unit_cost}</span>
                          <span>Остаток: {p.stock_quantity}</span>
                        </div>
                        <div className="cafe-costing-page__actions">
                          <button
                            type="button"
                            onClick={() =>
                              navigate(`/crm/cafe/costing/preparations/${encodeURIComponent(p.id)}`)
                            }
                          >
                            Детали
                          </button>
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
                        </div>
                      </article>
                    ))}
                  </div>
                ) : (
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
                              <button
                                type="button"
                                onClick={() =>
                                  navigate(`/crm/cafe/costing/preparations/${encodeURIComponent(p.id)}`)
                                }
                              >
                                Детали
                              </button>
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
                )}
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
            <div className="cafe-costing-page__row cafe-costing-page__row--between">
              <h4 style={{ margin: 0 }}>Обработки заготовки</h4>
              <button
                type="button"
                className="cafe-costing-page__btn cafe-costing-page__btn--small"
                onClick={openCreatePrepProcessingModal}
              >
                + Обработка
              </button>
            </div>
            <div className="cafe-costing-page__table-wrap">
              {prepProcessings.length === 0 ? (
                <div className="cafe-costing-page__empty">Обработки не добавлены</div>
              ) : (
                <table className="cafe-costing-page__table">
                  <thead>
                    <tr>
                      <th>Название</th>
                      <th>Ставка</th>
                      <th>Тип</th>
                      <th>Ед.</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {prepProcessings.map((pr, idx) => (
                      <tr key={`prep-proc-${pr.id || "new"}-${idx}`}>
                        <td>{pr.name || "—"}</td>
                        <td>{pr.cost || "0"}</td>
                        <td>{processingChargeTypeLabel(pr.charge_type)}</td>
                        <td>{pr.unit || "—"}</td>
                        <td className="cafe-costing-page__actions">
                          <button
                            type="button"
                            onClick={() => openEditPrepProcessingModal(idx, pr)}
                          >
                            Изм.
                          </button>
                          <button
                            type="button"
                            className="cafe-costing-page__danger-btn"
                            onClick={() => removePrepProcessingRow(idx)}
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
              )}
            </div>
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

      {detailProcessingModalOpen && (
        <div
          className="cafe-costing-page__overlay"
          onClick={() => setDetailProcessingModalOpen(false)}
        >
          <form
            className="cafe-costing-page__modal"
            onClick={(e) => e.stopPropagation()}
            onSubmit={handleSaveDetailProcessing}
          >
            <h3>{detailProcessingEditIdx >= 0 ? "Изменить обработку" : "Новая обработка"}</h3>
            <label className="cafe-costing-page__field">
              <span className="cafe-costing-page__field-label">Название обработки *</span>
              <input
              className="cafe-costing-page__input"
              value={detailProcessingForm.name}
              onChange={(e) =>
                setDetailProcessingForm((prev) => ({ ...prev, name: e.target.value }))
              }
              placeholder="Например: Жарка"
              required
            />
            </label>
            <label className="cafe-costing-page__field">
              <span className="cafe-costing-page__field-label">Стоимость *</span>
              <input
              className="cafe-costing-page__input"
              value={detailProcessingForm.cost}
              onChange={(e) =>
                setDetailProcessingForm((prev) => ({ ...prev, cost: e.target.value }))
              }
              placeholder="Например: 15"
              required
            />
            </label>
            <label className="cafe-costing-page__field">
              <span className="cafe-costing-page__field-label">Тип начисления</span>
              <select
              className="cafe-costing-page__input"
              value={detailProcessingForm.charge_type}
              onChange={(e) =>
                setDetailProcessingForm((prev) => ({ ...prev, charge_type: e.target.value }))
              }
            >
              <option value="fixed">Фиксированно</option>
              <option value="per_unit">За единицу</option>
            </select>
            </label>
            <label className="cafe-costing-page__field">
              <span className="cafe-costing-page__field-label">Единица (необязательно)</span>
              <input
              className="cafe-costing-page__input"
              value={detailProcessingForm.unit}
              onChange={(e) =>
                setDetailProcessingForm((prev) => ({ ...prev, unit: e.target.value }))
              }
              placeholder="Например: g или pcs"
            />
            </label>
            <div className="cafe-costing-page__row">
              <button type="button" onClick={() => setDetailProcessingModalOpen(false)}>
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

      {prepProcessingModalOpen && (
        <div
          className="cafe-costing-page__overlay"
          onClick={() => setPrepProcessingModalOpen(false)}
        >
          <form
            className="cafe-costing-page__modal"
            onClick={(e) => e.stopPropagation()}
            onSubmit={savePrepProcessingModal}
          >
            <h3>{prepProcessingEditIdx >= 0 ? "Изменить обработку" : "Новая обработка"}</h3>
            <label className="cafe-costing-page__field">
              <span className="cafe-costing-page__field-label">Название обработки *</span>
              <input
                className="cafe-costing-page__input"
                value={prepProcessingForm.name}
                onChange={(e) =>
                  setPrepProcessingForm((prev) => ({ ...prev, name: e.target.value }))
                }
                placeholder="Например: Перемол"
                required
              />
            </label>
            <label className="cafe-costing-page__field">
              <span className="cafe-costing-page__field-label">Ставка *</span>
              <input
                className="cafe-costing-page__input"
                value={prepProcessingForm.cost}
                onChange={(e) =>
                  setPrepProcessingForm((prev) => ({ ...prev, cost: e.target.value }))
                }
                placeholder="Например: 100"
                required
              />
            </label>
            <label className="cafe-costing-page__field">
              <span className="cafe-costing-page__field-label">Тип начисления</span>
              <select
                className="cafe-costing-page__input"
                value={prepProcessingForm.charge_type}
                onChange={(e) =>
                  setPrepProcessingForm((prev) => ({ ...prev, charge_type: e.target.value }))
                }
              >
                <option value="fixed">Фиксированно</option>
                <option value="per_unit">За единицу</option>
              </select>
            </label>
            <label className="cafe-costing-page__field">
              <span className="cafe-costing-page__field-label">Единица (необязательно)</span>
              <input
                className="cafe-costing-page__input"
                value={prepProcessingForm.unit}
                onChange={(e) =>
                  setPrepProcessingForm((prev) => ({ ...prev, unit: e.target.value }))
                }
                placeholder="Например: kg"
              />
            </label>
            <div className="cafe-costing-page__row">
              <button type="button" onClick={() => setPrepProcessingModalOpen(false)}>
                Отмена
              </button>
              <button type="submit">Сохранить</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

