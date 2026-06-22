import React, { useState } from "react";
import { useDispatch } from "react-redux";
import { useAlert, useConfirm } from "@/hooks/useDialog";
import { updateBuildingContractor } from "@/store/creators/building/contractorsCreators";
import { validateResErrors } from "../../../../../tools/validateResErrors";
import Modal from "@/Components/common/Modal/Modal";

const buildFormFromContractor = (contractor) => ({
  specializations: Array.isArray(contractor.specializations)
    ? [...contractor.specializations]
    : [],
  equipment: Array.isArray(contractor.equipment)
    ? contractor.equipment.map((eq) => ({ ...eq }))
    : [],
});

const buildPayloadFromState = (state) => ({
  specializations: (state.specializations || [])
    .map((s) => String(s || "").trim())
    .filter((s) => s.length > 0),
  equipment: (state.equipment || [])
    .map((eq) => ({
      name: String(eq.name || "").trim(),
      model: String(eq.model || "").trim(),
      quantity:
        eq.quantity != null &&
        eq.quantity !== "" &&
        !Number.isNaN(Number(eq.quantity))
          ? Number(eq.quantity)
          : null,
      condition: String(eq.condition || "").trim(),
    }))
    .filter(
      (eq) =>
        (eq.name && eq.name.length > 0) ||
        (eq.model && eq.model.length > 0) ||
        eq.quantity != null ||
        (eq.condition && eq.condition.length > 0),
    ),
});

const emptyEquipment = () => ({
  name: "",
  model: "",
  quantity: "",
  condition: "",
});

export default function ContractorEquipmentTab({ contractor }) {
  if (!contractor) return null;

  const dispatch = useDispatch();
  const alert = useAlert();
  const confirm = useConfirm();

  const [form, setForm] = useState(() => buildFormFromContractor(contractor));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const [specModalOpen, setSpecModalOpen] = useState(false);
  const [editingSpecIndex, setEditingSpecIndex] = useState(null);
  const [newSpec, setNewSpec] = useState("");

  const [equipmentModalOpen, setEquipmentModalOpen] = useState(false);
  const [editingEquipmentIndex, setEditingEquipmentIndex] = useState(null);
  const [newEquipment, setNewEquipment] = useState(emptyEquipment);

  const contractorId = contractor.id ?? contractor.uuid;
  const specializations = Array.isArray(form.specializations)
    ? form.specializations
    : [];
  const equipment = Array.isArray(form.equipment) ? form.equipment : [];

  const saveDraft = async (nextState, successMessage) => {
    if (!contractorId) return;
    try {
      setSaving(true);
      setError(null);
      const payload = buildPayloadFromState(nextState);
      const res = await dispatch(
        updateBuildingContractor({ id: contractorId, data: payload }),
      );
      if (res.meta.requestStatus === "fulfilled") {
        setForm(nextState);
        if (successMessage) alert(successMessage);
      } else {
        setError(
          validateResErrors(
            res.payload || res.error,
            "Не удалось сохранить данные подрядчика",
          ),
        );
      }
    } catch (err) {
      setError(
        validateResErrors(
          err,
          "Не удалось сохранить данные подрядчика",
        ),
      );
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveSpecialization = (index) => () => {
    const label = specializations[index] || "специализацию";
    confirm(`Удалить «${label}» из списка специализаций?`, (ok) => {
      if (!ok) return;
      const list = specializations.filter((_, i) => i !== index);
      saveDraft({ ...form, specializations: list }, "Специализация удалена");
    });
  };

  const handleRemoveEquipment = (index) => () => {
    const eq = equipment[index];
    const label =
      (eq?.name || eq?.model || "").trim() || "запись об оборудовании";
    confirm(`Удалить «${label}» из списка оборудования?`, (ok) => {
      if (!ok) return;
      const list = equipment.filter((_, i) => i !== index);
      saveDraft({ ...form, equipment: list }, "Оборудование удалено");
    });
  };

  const openSpecModal = (index = null) => {
    if (index != null && index >= 0 && index < specializations.length) {
      setEditingSpecIndex(index);
      setNewSpec(specializations[index] || "");
    } else {
      setEditingSpecIndex(null);
      setNewSpec("");
    }
    setSpecModalOpen(true);
  };

  const openEquipmentModal = (index = null) => {
    if (index != null && index >= 0 && index < equipment.length) {
      setEditingEquipmentIndex(index);
      const eq = equipment[index];
      setNewEquipment({
        name: eq?.name ?? "",
        model: eq?.model ?? "",
        quantity: eq?.quantity != null ? String(eq.quantity) : "",
        condition: eq?.condition ?? "",
      });
    } else {
      setEditingEquipmentIndex(null);
      setNewEquipment(emptyEquipment());
    }
    setEquipmentModalOpen(true);
  };

  const handleSpecModalSubmit = async (e) => {
    e.preventDefault();
    const value = (newSpec || "").trim();
    if (!value) {
      alert("Укажите специализацию", true);
      return;
    }
    const list = [...specializations];
    if (
      editingSpecIndex != null &&
      editingSpecIndex >= 0 &&
      editingSpecIndex < list.length
    ) {
      list[editingSpecIndex] = value;
    } else {
      list.push(value);
    }
    await saveDraft(
      { ...form, specializations: list },
      editingSpecIndex != null ? "Специализация обновлена" : "Специализация добавлена",
    );
    setNewSpec("");
    setEditingSpecIndex(null);
    setSpecModalOpen(false);
  };

  const handleEquipmentModalSubmit = async (e) => {
    e.preventDefault();
    const name = String(newEquipment.name || "").trim();
    const model = String(newEquipment.model || "").trim();
    const condition = String(newEquipment.condition || "").trim();
    const quantity =
      newEquipment.quantity != null &&
      newEquipment.quantity !== "" &&
      !Number.isNaN(Number(newEquipment.quantity))
        ? Number(newEquipment.quantity)
        : null;
    if (!name && !model && quantity == null && !condition) {
      alert("Укажите хотя бы одно поле оборудования", true);
      return;
    }
    const item = { name, model, quantity, condition };
    const list = [...equipment];
    if (
      editingEquipmentIndex != null &&
      editingEquipmentIndex >= 0 &&
      editingEquipmentIndex < list.length
    ) {
      list[editingEquipmentIndex] = item;
    } else {
      list.push(item);
    }
    await saveDraft(
      { ...form, equipment: list },
      editingEquipmentIndex != null ? "Оборудование обновлено" : "Оборудование добавлено",
    );
    setNewEquipment(emptyEquipment());
    setEditingEquipmentIndex(null);
    setEquipmentModalOpen(false);
  };

  const closeSpecModal = () => {
    if (saving) return;
    setSpecModalOpen(false);
    setEditingSpecIndex(null);
    setNewSpec("");
  };

  const closeEquipmentModal = () => {
    if (saving) return;
    setEquipmentModalOpen(false);
    setEditingEquipmentIndex(null);
    setNewEquipment(emptyEquipment());
  };

  return (
    <div className="sell-form client-detail__form">
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
            Специализации
          </h4>
          <button
            type="button"
            className="add-product-page__submit-btn"
            onClick={() => openSpecModal()}
          >
            Добавить специализацию
          </button>
        </div>
        {specializations.length === 0 && (
          <div className="client-detail__row">
            <span className="sell-form__label" />
            <span>Специализации не указаны.</span>
          </div>
        )}
        {specializations.length > 0 && (
          <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {specializations.map((spec, idx) => (
              <li
                key={idx}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  marginBottom: 8,
                  padding: "8px 0",
                  borderBottom: "1px solid #e2e8f0",
                }}
              >
                <span style={{ flex: 1 }}>{spec || "—"}</span>
                <button
                  type="button"
                  className="add-product-page__submit-btn"
                  style={{ marginRight: 4 }}
                  onClick={() => openSpecModal(idx)}
                >
                  Изменить
                </button>
                <button
                  type="button"
                  className="add-product-page__cancel-btn"
                  onClick={handleRemoveSpecialization(idx)}
                >
                  Удалить
                </button>
              </li>
            ))}
          </ul>
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
            Оборудование
          </h4>
          <button
            type="button"
            className="add-product-page__submit-btn"
            onClick={() => openEquipmentModal()}
          >
            Добавить оборудование
          </button>
        </div>
        {equipment.length === 0 && (
          <div className="client-detail__row">
            <span className="sell-form__label" />
            <span>Оборудование не указано.</span>
          </div>
        )}
        {equipment.length > 0 && (
          <div style={{ width: "100%", overflowX: "auto" }}>
            <table
              className="client-detail__table"
              style={{ width: "100%", tableLayout: "auto" }}
            >
              <thead>
                <tr>
                  <th>Наименование</th>
                  <th>Модель</th>
                  <th>Кол-во</th>
                  <th>Состояние</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {equipment.map((eq, idx) => (
                  <tr key={idx}>
                    <td>{eq.name || "—"}</td>
                    <td>{eq.model || "—"}</td>
                    <td>
                      {eq.quantity != null && !Number.isNaN(Number(eq.quantity))
                        ? eq.quantity
                        : "—"}
                    </td>
                    <td>{eq.condition || "—"}</td>
                    <td style={{ whiteSpace: "nowrap" }}>
                      <button
                        type="button"
                        className="add-product-page__submit-btn"
                        style={{ marginRight: 4 }}
                        onClick={() => openEquipmentModal(idx)}
                      >
                        Изменить
                      </button>
                      <button
                        type="button"
                        className="add-product-page__cancel-btn"
                        onClick={handleRemoveEquipment(idx)}
                      >
                        Удалить
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {error && (
        <div className="building-page__error" style={{ marginTop: 8 }}>
          {String(error)}
        </div>
      )}

      <Modal
        open={specModalOpen}
        onClose={closeSpecModal}
        title={
          editingSpecIndex != null
            ? "Редактировать специализацию"
            : "Новая специализация"
        }
      >
        <form className="sell-form" onSubmit={handleSpecModalSubmit}>
          <section className="sell-form__section">
            <div className="sell-form__row">
              <label className="sell-form__label">
                Специализация<span style={{ color: "red" }}>*</span>
              </label>
              <input
                className="add-product-page__input"
                value={newSpec}
                onChange={(e) => setNewSpec(e.target.value)}
                placeholder="Например, Монолитные работы"
              />
            </div>
          </section>
          <div className="sell-form__actions" style={{ marginTop: 12 }}>
            <button
              type="button"
              className="add-product-page__cancel-btn"
              onClick={closeSpecModal}
            >
              Отмена
            </button>
            <button
              type="submit"
              className="add-product-page__submit-btn"
              disabled={saving}
            >
              {editingSpecIndex != null ? "Сохранить" : "Добавить"}
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        open={equipmentModalOpen}
        onClose={closeEquipmentModal}
        title={
          editingEquipmentIndex != null
            ? "Редактировать оборудование"
            : "Новое оборудование"
        }
      >
        <form className="sell-form" onSubmit={handleEquipmentModalSubmit}>
          <section className="sell-form__section">
            <div className="sell-form__row">
              <label className="sell-form__label">Наименование</label>
              <input
                className="add-product-page__input"
                value={newEquipment.name}
                onChange={(e) =>
                  setNewEquipment((prev) => ({ ...prev, name: e.target.value }))
                }
                placeholder="Экскаватор"
              />
            </div>
            <div className="sell-form__row">
              <label className="sell-form__label">Модель</label>
              <input
                className="add-product-page__input"
                value={newEquipment.model}
                onChange={(e) =>
                  setNewEquipment((prev) => ({ ...prev, model: e.target.value }))
                }
                placeholder="CAT 320D"
              />
            </div>
            <div className="sell-form__row">
              <label className="sell-form__label">Кол-во</label>
              <input
                className="add-product-page__input"
                type="number"
                min={0}
                value={newEquipment.quantity}
                onChange={(e) =>
                  setNewEquipment((prev) => ({
                    ...prev,
                    quantity: e.target.value,
                  }))
                }
              />
            </div>
            <div className="sell-form__row">
              <label className="sell-form__label">Состояние</label>
              <input
                className="add-product-page__input"
                value={newEquipment.condition}
                onChange={(e) =>
                  setNewEquipment((prev) => ({
                    ...prev,
                    condition: e.target.value,
                  }))
                }
                placeholder="good / excellent"
              />
            </div>
          </section>
          <div className="sell-form__actions" style={{ marginTop: 12 }}>
            <button
              type="button"
              className="add-product-page__cancel-btn"
              onClick={closeEquipmentModal}
            >
              Отмена
            </button>
            <button
              type="submit"
              className="add-product-page__submit-btn"
              disabled={saving}
            >
              {editingEquipmentIndex != null ? "Сохранить" : "Добавить"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
