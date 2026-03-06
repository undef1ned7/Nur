import React, { useEffect, useMemo, useState } from "react";
import { useDispatch } from "react-redux";
import Modal from "../../../../common/Modal";
import { useConfirm } from "../../../../../hooks/useDialog";
import {
  deleteBuildingProject,
  updateBuildingProject,
} from "../../../../../store/creators/building/projectsCreators";
import { useBuildingProjects } from "../../../../../store/slices/building/projectsSlice";
import { validateResErrors } from "../../../../../../tools/validateResErrors";

const toStr = (v) => (v == null ? "" : String(v));

export default function Edit({ open, onClose, project }) {
  const dispatch = useDispatch();
  const confirm = useConfirm();
  const { updating, deletingIds } = useBuildingProjects();

  const projectId = project?.id ?? project?.uuid ?? null;
  const deleting = projectId != null ? deletingIds?.[projectId] === true : false;

  const [error, setError] = useState(null);
  const [form, setForm] = useState({
    name: "",
    address: "",
    description: "",
    is_active: true,
  });

  useEffect(() => {
    if (!open) return;
    setError(null);
    setForm({
      name: toStr(project?.name),
      address: toStr(project?.address),
      description: toStr(project?.description),
      is_active: Boolean(project?.is_active),
    });
  }, [open, project]);

  const canSubmit = useMemo(() => {
    return toStr(form.name).trim().length > 0;
  }, [form.name]);

  const handleChange = (key) => (e) => {
    const value =
      key === "is_active" ? Boolean(e.target.checked) : e.target.value;
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!projectId) return;
    if (!canSubmit || updating) return;

    setError(null);
    const payload = {
      name: toStr(form.name).trim(),
      address: toStr(form.address).trim(),
      description: toStr(form.description).trim(),
      is_active: Boolean(form.is_active),
    };

    const res = await dispatch(updateBuildingProject({ id: projectId, data: payload }));
    if (res.meta.requestStatus === "fulfilled") {
      onClose?.();
      return;
    }
    const errorMessage = validateResErrors(res.error, "Ошибка обновления проекта");
    setError(errorMessage);
  };

  const handleDelete = () => {
    if (!projectId) return;
    const name = project?.name ? `«${project.name}»` : "";
    confirm(`Удалить проект ${name}?`, async (ok) => {
      if (!ok) return;
      setError(null);
      const res = await dispatch(deleteBuildingProject(projectId));
      if (res.meta.requestStatus === "fulfilled") {
        onClose?.();
        return;
      }
      const errorMessage = validateResErrors(res.error, "Ошибка удаления проекта");
      setError(errorMessage);
    });
  };

  return (
    <Modal open={open} onClose={onClose} title="Изменить проект">
      <form className="building-project-create" onSubmit={handleSubmit}>
        <div className="building-project-create__fields">
          <label className="building-project-create__field">
            <span className="building-project-create__label">Название</span>
            <input
              className="building-project-create__input"
              value={form.name}
              onChange={handleChange("name")}
              placeholder="Например: ЖК Нур"
              required
            />
          </label>

          <label className="building-project-create__field">
            <span className="building-project-create__label">Адрес</span>
            <input
              className="building-project-create__input"
              value={form.address}
              onChange={handleChange("address")}
              placeholder="Город, улица, дом"
            />
          </label>

          <label className="building-project-create__field">
            <span className="building-project-create__label">Описание</span>
            <textarea
              className="building-project-create__textarea"
              value={form.description}
              onChange={handleChange("description")}
              placeholder="Коротко о проекте"
              rows={4}
            />
          </label>

          <label className="building-project-create__checkbox">
            <input
              type="checkbox"
              checked={form.is_active}
              onChange={handleChange("is_active")}
            />
            <span>Активный</span>
          </label>
        </div>

        {error && (
          <div className="building-project-create__error">
            {typeof error === "string" ? error : JSON.stringify(error)}
          </div>
        )}

        <div className="building-project-create__actions">
          <button
            type="button"
            className="building-btn building-btn--danger"
            onClick={handleDelete}
            disabled={updating || deleting || !projectId}
          >
            {deleting ? "Удаление..." : "Удалить"}
          </button>
          <button
            type="button"
            className="building-btn"
            onClick={onClose}
            disabled={updating || deleting}
          >
            Отмена
          </button>
          <button
            type="submit"
            className="building-btn building-btn--primary"
            disabled={!canSubmit || updating || deleting || !projectId}
          >
            {updating ? "Сохранение..." : "Сохранить"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

