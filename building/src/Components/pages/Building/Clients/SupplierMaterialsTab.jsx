import React, { useMemo, useState } from "react";
import { useDispatch } from "react-redux";
import { useAlert, useConfirm } from "@/hooks/useDialog";
import { updateBuildingSupplier } from "@/store/creators/building/suppliersCreators";
import { validateResErrors } from "../../../../../tools/validateResErrors";
import Modal from "@/Components/common/Modal/Modal";
import { LayoutGrid, Table2 } from "lucide-react";

const buildStateFromSupplier = (supplier) => ({
  supplied_materials: Array.isArray(supplier.supplied_materials)
    ? supplier.supplied_materials.map((m) => ({ ...m }))
    : [],
  delivery: {
    delivery_available: supplier.delivery?.delivery_available ?? false,
    delivery_regions: Array.isArray(supplier.delivery?.delivery_regions)
      ? [...supplier.delivery.delivery_regions]
      : [],
    delivery_time_days: supplier.delivery?.delivery_time_days ?? "",
  },
});

export default function SupplierMaterialsTab({ supplier }) {
  const alert = useAlert();
  const dispatch = useDispatch();
  const confirm = useConfirm();

  if (!supplier) return null;

  const supplierId = supplier.id ?? supplier.uuid;
  const [state, setState] = useState(() => buildStateFromSupplier(supplier));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [materialModalOpen, setMaterialModalOpen] = useState(false);
  const [regionModalOpen, setRegionModalOpen] = useState(false);
  const [editingIndex, setEditingIndex] = useState(null);
  const [newMaterial, setNewMaterial] = useState({
    name: "",
    brand: "",
    unit: "",
    price: "",
  });
  const [newRegion, setNewRegion] = useState("");

  const materials = useMemo(
    () => (Array.isArray(state.supplied_materials) ? state.supplied_materials : []),
    [state.supplied_materials],
  );
  const [viewMode, setViewMode] = useState("table"); // "table" | "list"

  const buildPayloadFromDraft = (draft) => ({
    supplied_materials: (draft.supplied_materials || [])
      .filter((m) => (m.name || "").trim())
      .map((m) => ({
        ...m,
        price:
          m.price && !Number.isNaN(Number(m.price)) ? Number(m.price) : null,
        currency: "KGS",
      })),
    delivery: {
      ...(draft.delivery || {}),
      delivery_time_days:
        draft.delivery?.delivery_time_days &&
        !Number.isNaN(Number(draft.delivery.delivery_time_days))
          ? Number(draft.delivery.delivery_time_days)
          : null,
    },
  });

  const saveDraft = async (nextState, successMessage) => {
    if (!supplierId) return;
    try {
      setSaving(true);
      setError(null);
      const res = await dispatch(
        updateBuildingSupplier({
          id: supplierId,
          data: buildPayloadFromDraft(nextState),
        }),
      );
      if (res.meta.requestStatus === "fulfilled") {
        setState(nextState);
        if (successMessage) {
          alert(successMessage);
        }
      } else {
        setError(
          validateResErrors(
            res.payload || res.error,
            "Не удалось сохранить данные",
          ),
        );
      }
    } catch (err) {
      setError(
        validateResErrors(err, "Не удалось сохранить данные поставщика"),
      );
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveMaterial = (index) => () => {
    const mat = materials[index];
    const label = mat?.name || "материал";
    confirm(`Удалить «${label}» из списка материалов поставщика?`, (ok) => {
      if (!ok) return;
      const nextMaterials = (materials || []).filter((_, i) => i !== index);
      const nextState = { ...state, supplied_materials: nextMaterials };
      saveDraft(nextState, "Материал удалён");
    });
  };

  const handleDeliveryFieldChange = (field) => (e) => {
    const value =
      field === "delivery_available" ? e.target.checked : e.target.value;
    const nextDelivery = { ...(state.delivery || {}), [field]: value };
    const nextState = { ...state, delivery: nextDelivery };
    saveDraft(nextState);
  };

  const handleDeliveryRegionChange = (index) => (e) => {
    const value = e.target.value;
    setState((prev) => {
      const list = Array.isArray(prev.delivery?.delivery_regions)
        ? [...prev.delivery.delivery_regions]
        : [];
      list[index] = value;
      return {
        ...prev,
        delivery: { ...(prev.delivery || {}), delivery_regions: list },
      };
    });
  };

  const handleRemoveDeliveryRegion = (index) => () => {
    const currentList = Array.isArray(state.delivery?.delivery_regions)
      ? state.delivery.delivery_regions
      : [];
    const label = currentList[index] || "регион";
    confirm(`Удалить регион «${label}» из списка доставки?`, (ok) => {
      if (!ok) return;
      const list = [...currentList];
      list.splice(index, 1);
      const nextState = {
        ...state,
        delivery: { ...(state.delivery || {}), delivery_regions: list },
      };
      saveDraft(nextState, "Регион удалён");
    });
  };

  const handleAddRegionFromModal = async (e) => {
    e.preventDefault();
    const value = (newRegion || "").trim();
    if (!value) {
      alert("Укажите регион доставки", true);
      return;
    }
    const currentList = Array.isArray(state.delivery?.delivery_regions)
      ? state.delivery.delivery_regions
      : [];
    const list = [...currentList, value];
    const nextState = {
      ...state,
      delivery: { ...(state.delivery || {}), delivery_regions: list },
    };
    await saveDraft(nextState, "Регион добавлен");
    setNewRegion("");
    setRegionModalOpen(false);
  };

  const handleAddMaterialFromModal = async (e) => {
    e.preventDefault();
    if (!(newMaterial.name || "").trim()) {
      alert("Укажите наименование материала", true);
      return;
    }
    const current = {
      ...newMaterial,
      currency: "KGS",
    };
    const list = Array.isArray(state.supplied_materials)
      ? [...state.supplied_materials]
      : [];
    if (
      editingIndex != null &&
      editingIndex >= 0 &&
      editingIndex < list.length
    ) {
      list[editingIndex] = { ...list[editingIndex], ...current };
    } else {
      list.push(current);
    }
    const nextState = { ...state, supplied_materials: list };
    await saveDraft(
      nextState,
      editingIndex != null ? "Материал обновлён" : "Материал добавлен",
    );
    setNewMaterial({ name: "", brand: "", unit: "", price: "" });
    setEditingIndex(null);
    setMaterialModalOpen(false);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!supplierId) return;

    const payload = {
      supplied_materials: (state.supplied_materials || [])
        .filter((m) => (m.name || "").trim())
        .map((m) => ({
          ...m,
          price:
            m.price && !Number.isNaN(Number(m.price))
              ? Number(m.price)
              : null,
          currency: "KGS",
        })),
      delivery: {
        ...(state.delivery || {}),
        delivery_time_days:
          state.delivery?.delivery_time_days &&
          !Number.isNaN(Number(state.delivery.delivery_time_days))
            ? Number(state.delivery.delivery_time_days)
            : null,
      },
    };

    try {
      setSaving(true);
      setError(null);
      const res = await dispatch(
        updateBuildingSupplier({ id: supplierId, data: payload }),
      );
      if (res.meta.requestStatus === "fulfilled") {
        alert("Данные по материалам и доставке сохранены");
      } else {
        setError(
          validateResErrors(
            res.payload || res.error,
            "Не удалось сохранить данные",
          ),
        );
      }
    } catch (err) {
      setError(
        validateResErrors(err, "Не удалось сохранить данные поставщика"),
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className="sell-form client-detail__form" onSubmit={handleSave}>
      <section className="sell-form__section">
        <div className="clients-toolbar__view" style={{ marginBottom: 8 }}>
          <button
            type="button"
            className={`clients-toolbar__viewBtn${
              viewMode === "table"
                ? " clients-toolbar__viewBtn--active"
                : ""
            }`}
            onClick={() => setViewMode("table")}
          >
            <Table2 size={16} style={{ marginRight: 6 }} />
            Таблица
          </button>
          <button
            type="button"
            className={`clients-toolbar__viewBtn${
              viewMode === "list"
                ? " clients-toolbar__viewBtn--active"
                : ""
            }`}
            onClick={() => setViewMode("list")}
          >
            <LayoutGrid size={16} style={{ marginRight: 6 }} />
            Карточки
          </button>
        </div>
      </section>

      <section className="sell-form__section">
        <div
          className="client-detail__row"
          style={{
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 8,
          }}
        >
          <h4
            className="sell-form__sectionTitle"
            style={{ fontSize: 16, fontWeight: 600 }}
          >
            Поставляемые материалы
          </h4>
          <button
            type="button"
            className="add-product-page__submit-btn"
            onClick={() => {
              setNewMaterial({ name: "", brand: "", unit: "", price: "" });
              setMaterialModalOpen(true);
            }}
          >
            Добавить материал
          </button>
        </div>
        {(!materials || materials.length === 0) && (
          <div className="client-detail__row">
            <span className="sell-form__label" />
            <span>Материалы не указаны.</span>
          </div>
        )}
        {viewMode === "table" && materials.length > 0 && (
          <div className="client-detail__row" style={{ alignItems: "stretch" }}>
            <div style={{ width: "100%", overflowX: "auto" }}>
              <table
                className="client-detail__table"
                style={{ width: "100%", minWidth: 600 }}
              >
                <thead>
                  <tr>
                    <th>Наименование</th>
                    <th>Бренд</th>
                    <th>Ед. изм.</th>
                    <th>Цена</th>
                    <th>Валюта</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {materials.map((m, idx) => (
                    <tr key={idx}>
                      <td>
                        <span>{m.name || "—"}</span>
                      </td>
                      <td>
                        <span>{m.brand || "—"}</span>
                      </td>
                      <td>
                        <span>{m.unit || "—"}</span>
                      </td>
                      <td>
                        <span>
                          {m.price != null && !Number.isNaN(m.price)
                            ? m.price
                            : "—"}
                        </span>
                      </td>
                      <td>KGS</td>
                      <td style={{ whiteSpace: "nowrap" }}>
                        <button
                          type="button"
                          className="add-product-page__submit-btn"
                          style={{ marginRight: 4 }}
                          onClick={() => {
                            setNewMaterial({
                              name: m.name || "",
                              brand: m.brand || "",
                              unit: m.unit || "",
                              price:
                                m.price != null && !Number.isNaN(m.price)
                                  ? String(m.price)
                                  : "",
                            });
                            setEditingIndex(idx);
                            setMaterialModalOpen(true);
                          }}
                        >
                          Редактировать
                        </button>
                        <button
                          type="button"
                          className="add-product-page__cancel-btn"
                          onClick={handleRemoveMaterial(idx)}
                        >
                          Удалить
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
        {viewMode === "list" && materials.length > 0 && (
          <div className="client-detail__row" style={{ alignItems: "stretch" }}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
                gap: 16,
                width: "100%",
              }}
            >
              {materials.map((m, idx) => (
                <div
                  key={idx}
                  className="sell-card"
                  style={{
                    padding: 16,
                    borderRadius: 12,
                    border: "1px solid #e2e8f0",
                    background:
                      "linear-gradient(135deg, #ffffff 0%, #f9fafb 100%)",
                    display: "flex",
                    flexDirection: "column",
                    gap: 12,
                    boxShadow: "0 4px 10px rgba(15, 23, 42, 0.06)",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "baseline",
                      gap: 8,
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: 11,
                          textTransform: "uppercase",
                          letterSpacing: 0.04,
                          color: "#64748b",
                          marginBottom: 2,
                        }}
                      >
                        Наименование
                      </div>
                      <div
                        style={{
                          fontSize: 14,
                          fontWeight: 600,
                          color: "#0f172a",
                          wordBreak: "break-word",
                        }}
                      >
                        {m.name || "—"}
                      </div>
                    </div>
                    <div
                      style={{
                        fontSize: 11,
                        padding: "2px 8px",
                        borderRadius: 999,
                        background: "#e0f2fe",
                        color: "#0369a1",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {m.unit || "Ед. изм. не указана"}
                    </div>
                  </div>

                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "minmax(0, 2fr) minmax(0, 1.5fr)",
                      gap: 12,
                    }}
                  >
                    <div>
                      <div
                        style={{
                          fontSize: 11,
                          textTransform: "uppercase",
                          letterSpacing: 0.04,
                          color: "#64748b",
                          marginBottom: 2,
                        }}
                      >
                        Бренд
                      </div>
                      <div
                        style={{
                          fontSize: 13,
                          color: "#0f172a",
                          minHeight: 18,
                          wordBreak: "break-word",
                        }}
                      >
                        {m.brand || "—"}
                      </div>
                    </div>
                    <div>
                      <div
                        style={{
                          fontSize: 11,
                          textTransform: "uppercase",
                          letterSpacing: 0.04,
                          color: "#64748b",
                          marginBottom: 2,
                        }}
                      >
                        Цена
                      </div>
                      <div
                        style={{
                          fontSize: 14,
                          fontWeight: 600,
                          color: "#16a34a",
                        }}
                      >
                        {m.price != null && !Number.isNaN(m.price)
                          ? `${m.price} KGS`
                          : "—"}
                      </div>
                    </div>
                  </div>

                  <div
                    style={{
                      display: "flex",
                      gap: 8,
                      marginTop: 4,
                      flexWrap: "wrap",
                      justifyContent: "flex-end",
                    }}
                  >
                    <button
                      type="button"
                      className="add-product-page__submit-btn"
                      style={{ minWidth: 100 }}
                      onClick={() => {
                        setNewMaterial({
                          name: m.name || "",
                          brand: m.brand || "",
                          unit: m.unit || "",
                          price:
                            m.price != null && !Number.isNaN(m.price)
                              ? String(m.price)
                              : "",
                        });
                        setEditingIndex(idx);
                        setMaterialModalOpen(true);
                      }}
                    >
                      Редактировать
                    </button>
                    <button
                      type="button"
                      className="add-product-page__cancel-btn"
                      style={{ minWidth: 100 }}
                      onClick={handleRemoveMaterial(idx)}
                    >
                      Удалить
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      <section className="sell-form__section">
        <div
          className="client-detail__row"
          style={{
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 8,
          }}
        >
          <h4
            className="sell-form__sectionTitle"
            style={{ fontSize: 16, fontWeight: 600 }}
          >
            Доставка
          </h4>
          <button
            type="button"
            className="add-product-page__submit-btn"
            onClick={() => {
              setNewRegion("");
              setRegionModalOpen(true);
            }}
          >
            Добавить регион
          </button>
        </div>
          <div className="client-detail__row">
            <span className="sell-form__label">Доставка доступна</span>
            <label className="clients-toolbar__check">
              <input
                type="checkbox"
                checked={!!state.delivery.delivery_available}
                onChange={handleDeliveryFieldChange("delivery_available")}
              />
              <span />
            </label>
          </div>
          <div className="client-detail__row">
            <span className="sell-form__label">Регионы доставки</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              {(!state.delivery.delivery_regions ||
                state.delivery.delivery_regions.length === 0) && (
                <div className="client-detail__row">
                  <span>Регионы не указаны.</span>
                </div>
              )}
              {Array.isArray(state.delivery.delivery_regions) &&
                state.delivery.delivery_regions.map((r, idx) => (
                  <div
                    key={idx}
                    style={{
                      display: "flex",
                      gap: 8,
                      alignItems: "center",
                      marginBottom: 4,
                    }}
                  >
                    <span style={{ flex: 1, minWidth: 120 }}>{r || "—"}</span>
                    <button
                      type="button"
                      className="add-product-page__cancel-btn"
                      onClick={handleRemoveDeliveryRegion(idx)}
                    >
                      ×
                    </button>
                  </div>
                ))}
            </div>
          </div>
          <div className="client-detail__row">
            <span className="sell-form__label">Срок доставки (дней)</span>
            <input
              className="add-product-page__input"
              type="number"
              min={0}
              value={state.delivery.delivery_time_days}
              onChange={handleDeliveryFieldChange("delivery_time_days")}
            />
          </div>
      </section>

      {error && (
        <div className="building-page__error" style={{ marginTop: 8 }}>
          {String(error)}
        </div>
      )}

      <Modal
        open={materialModalOpen}
        onClose={() => {
          if (saving) return;
          setMaterialModalOpen(false);
          setEditingIndex(null);
          setNewMaterial({ name: "", brand: "", unit: "", price: "" });
        }}
        title={editingIndex != null ? "Редактировать материал поставщика" : "Новый материал поставщика"}
      >
        <form className="sell-form" onSubmit={handleAddMaterialFromModal}>
          <section className="sell-form__section">
            <div className="sell-form__row">
              <label className="sell-form__label">
                Наименование<span style={{ color: "red" }}>*</span>
              </label>
              <input
                className="add-product-page__input"
                value={newMaterial.name}
                onChange={(e) =>
                  setNewMaterial((prev) => ({
                    ...prev,
                    name: e.target.value,
                  }))
                }
                placeholder="Например, Цемент"
              />
            </div>
            <div className="sell-form__row">
              <label className="sell-form__label">Бренд</label>
              <input
                className="add-product-page__input"
                value={newMaterial.brand}
                onChange={(e) =>
                  setNewMaterial((prev) => ({
                    ...prev,
                    brand: e.target.value,
                  }))
                }
                placeholder="Kant Cement"
              />
            </div>
            <div className="sell-form__row">
              <label className="sell-form__label">Ед. изм.</label>
              <input
                className="add-product-page__input"
                value={newMaterial.unit}
                onChange={(e) =>
                  setNewMaterial((prev) => ({
                    ...prev,
                    unit: e.target.value,
                  }))
                }
                placeholder="мешок"
              />
            </div>
            <div className="sell-form__row">
              <label className="sell-form__label">Цена</label>
              <input
                className="add-product-page__input"
                type="number"
                min={0}
                step="0.01"
                value={newMaterial.price}
                onChange={(e) =>
                  setNewMaterial((prev) => ({
                    ...prev,
                    price: e.target.value,
                  }))
                }
                placeholder="450"
              />
            </div>
          </section>
          <div className="sell-form__actions" style={{ marginTop: 12 }}>
            <button
              type="button"
              className="add-product-page__cancel-btn"
              onClick={() => {
                if (saving) return;
                setMaterialModalOpen(false);
                setEditingIndex(null);
                setNewMaterial({ name: "", brand: "", unit: "", price: "" });
              }}
            >
              Отмена
            </button>
            <button type="submit" className="add-product-page__submit-btn">
              {editingIndex != null ? "Сохранить" : "Добавить"}
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        open={regionModalOpen}
        onClose={() => {
          if (saving) return;
          setRegionModalOpen(false);
          setNewRegion("");
        }}
        title="Новый регион доставки"
      >
        <form className="sell-form" onSubmit={handleAddRegionFromModal}>
          <section className="sell-form__section">
            <div className="sell-form__row">
              <label className="sell-form__label">
                Регион<span style={{ color: "red" }}>*</span>
              </label>
              <input
                className="add-product-page__input"
                value={newRegion}
                onChange={(e) => setNewRegion(e.target.value)}
                placeholder="Например, Бишкек и Чуйская область"
              />
            </div>
          </section>
          <div className="sell-form__actions" style={{ marginTop: 12 }}>
            <button
              type="button"
              className="add-product-page__cancel-btn"
              onClick={() => {
                if (saving) return;
                setRegionModalOpen(false);
                setNewRegion("");
              }}
            >
              Отмена
            </button>
            <button type="submit" className="add-product-page__submit-btn">
              Добавить
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        open={regionModalOpen}
        onClose={() => {
          if (saving) return;
          setRegionModalOpen(false);
          setNewRegion("");
        }}
        title="Новый регион доставки"
      >
        <form className="sell-form" onSubmit={handleAddRegionFromModal}>
          <section className="sell-form__section">
            <div className="sell-form__row">
              <label className="sell-form__label">
                Регион<span style={{ color: "red" }}>*</span>
              </label>
              <input
                className="add-product-page__input"
                value={newRegion}
                onChange={(e) => setNewRegion(e.target.value)}
                placeholder="Например, Бишкек и Чуйская область"
              />
            </div>
          </section>
          <div className="sell-form__actions" style={{ marginTop: 12 }}>
            <button
              type="button"
              className="add-product-page__cancel-btn"
              onClick={() => {
                if (saving) return;
                setRegionModalOpen(false);
                setNewRegion("");
              }}
            >
              Отмена
            </button>
            <button type="submit" className="add-product-page__submit-btn">
              Добавить
            </button>
          </div>
        </form>
      </Modal>
    </form>
  );
}

