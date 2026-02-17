import React, { useMemo, useState } from "react";
import Modal from "@/Components/common/Modal";
import { useDispatch } from "react-redux";
import { createBuildingProject } from "@/store/creators/building/projectsCreators";
import { useBuildingProjects } from "@/store/slices/building/projectsSlice";
import "./Create.scss";
import { PROJECT } from "@/constants/building";
import { validateResErrors } from "../../../../../../tools/validateResErrors";

export default function Create({ open, onClose, onCreated }) {
    const [error, setError] = useState(null);
    const [form, setForm] = useState(PROJECT.CREATE);
    const dispatch = useDispatch();
    const { creating: submitting } = useBuildingProjects();
    const canSubmit = useMemo(() => {
        return String(form.name || "").trim().length > 0;
    }, [form.name]);

    const handleChange = (key) => (e) => {
        const value =
            key === "is_active" ? Boolean(e.target.checked) : e.target.value;
        setForm((prev) => ({ ...prev, [key]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!canSubmit || submitting) return;

        setError(null);
        try {
            const payload = {
                name: String(form.name || "").trim(),
                address: String(form.address || "").trim(),
                description: String(form.description || "").trim(),
                is_active: Boolean(form.is_active),
            };
            const res = await dispatch(createBuildingProject(payload));
            if (res.meta.requestStatus === "fulfilled") {
            onCreated?.(res.payload);
                setForm(PROJECT.CREATE);
                onClose?.();
            } else {
                const errorMessage = validateResErrors(res.error, "Ошибка создания проекта");
                setError(errorMessage);
            }
        } catch (err) { 
            const errorMessage = validateResErrors(err, "Ошибка создания проекта");
            setError(errorMessage);
        }
    };

    return (
        <Modal open={open} onClose={onClose} title="Добавить проект">
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
                        className="building-btn"
                        onClick={onClose}
                        disabled={submitting}
                    >
                        Отмена
                    </button>
                    <button
                        type="submit"
                        className="building-btn building-btn--primary"
                        disabled={!canSubmit || submitting}
                    >
                        {submitting ? "Сохранение..." : "Добавить"}
                    </button>
                </div>
            </form>
        </Modal>
    );
}