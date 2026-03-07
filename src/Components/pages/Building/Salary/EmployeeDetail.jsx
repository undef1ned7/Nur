import React, { useEffect, useMemo, useState } from "react";
import { useDispatch } from "react-redux";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, User } from "lucide-react";
import { useAlert } from "@/hooks/useDialog";
import { validateResErrors } from "../../../../../tools/validateResErrors";
import { useBuildingSalary } from "../../../../store/slices/building/salarySlice";
import {
  fetchBuildingSalaryEmployees,
  updateBuildingSalaryEmployeeCompensation,
} from "../../../../store/creators/building/salaryCreators";
import "./Detail.scss";

export default function BuildingSalaryEmployeeDetail() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const alert = useAlert();
  const { id } = useParams();

  const { employees, employeesLoading, employeesUpdatingId } =
    useBuildingSalary();

  useEffect(() => {
    if (!Array.isArray(employees) || employees.length === 0) {
      dispatch(fetchBuildingSalaryEmployees());
    }
  }, [dispatch]);

  const employee = useMemo(() => {
    if (!id || !Array.isArray(employees)) return null;
    return employees.find((e) => String(e.id ?? e.uuid) === String(id)) || null;
  }, [employees, id]);

  const comp = employee?.compensation || employee || {};

  const [salaryType, setSalaryType] = useState(comp.salary_type || "monthly");
  const [baseSalary, setBaseSalary] = useState(
    comp.base_salary != null ? String(comp.base_salary) : "",
  );
  const [isActive, setIsActive] = useState(Boolean(comp.is_active));
  const [notes, setNotes] = useState(comp.notes || "");
  const [formError, setFormError] = useState(null);

  const SALARY_TYPE_LABELS = {
    monthly: "Месячный оклад",
    daily: "Дневная ставка",
    hourly: "Почасовая ставка",
  };

  useEffect(() => {
    if (!employee) return;
    const nextComp = employee.compensation || {};
    setSalaryType(nextComp.salary_type || "monthly");
    setBaseSalary(
      nextComp.base_salary != null ? String(nextComp.base_salary) : "",
    );
    setIsActive(Boolean(nextComp.is_active));
    setNotes(nextComp.notes || "");
  }, [employee]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!id) return;
    setFormError(null);
    const payload = {
      salary_type: salaryType || "monthly",
      base_salary: baseSalary ? String(baseSalary) : null,
      is_active: isActive,
      notes: notes || "",
    };
    try {
      const res = await dispatch(
        updateBuildingSalaryEmployeeCompensation({
          userId: id,
          payload,
        }),
      );
      if (res.meta.requestStatus === "fulfilled") {
        alert("Настройки оклада сохранены");
      } else {
        const msg = validateResErrors(
          res.payload || res.error,
          "Не удалось сохранить настройки оклада",
        );
        setFormError(String(msg));
        alert(msg, true);
      }
    } catch (err) {
      const msg = validateResErrors(
        err,
        "Не удалось сохранить настройки оклада",
      );
      setFormError(String(msg));
      alert(msg, true);
    }
  };

  const isSaving =
    employeesUpdatingId != null && String(employeesUpdatingId) === String(id);

  const title =
    employee?.display || employee?.name || employee?.email || "Сотрудник";

  return (
    <div className="add-product-page salary-detail">
      <div className="add-product-page__header">
        <button
          type="button"
          className="add-product-page__back"
          onClick={() => navigate("/crm/building/salary")}
        >
          <ArrowLeft size={18} />К списку зарплаты
        </button>
        <div className="add-product-page__title-section">
          <div className="add-product-page__icon">
            <User size={24} />
          </div>
          <div>
            <h1 className="add-product-page__title">
              Настройки оклада: {title}
            </h1>
            <p className="add-product-page__subtitle">
              Управление типом оклада, базовой суммой и активностью для
              сотрудника.
            </p>
          </div>
        </div>
      </div>

      <div className="add-product-page__content">
        {employeesLoading && !employee && (
          <div className="salary-detail__muted">
            Загрузка информации о сотруднике...
          </div>
        )}
        {!employeesLoading && !employee && (
          <div className="add-product-page__error">
            Не удалось найти сотрудника.
          </div>
        )}

        {employee && (
          <div className="add-product-page__section">
            <div className="add-product-page__section-header">
              <div className="add-product-page__section-number">1</div>
              <h3 className="add-product-page__section-title">
                Настройки оклада
              </h3>
            </div>
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div className="add-product-page__form-group">
                <label className="add-product-page__label">Сотрудник</label>
                <input
                  className="add-product-page__input"
                  value={title}
                  disabled
                />
              </div>
              <div className="add-product-page__form-group">
                <label className="add-product-page__label">Тип оклада</label>
                <select
                  className="add-product-page__input"
                  value={salaryType}
                  onChange={(e) => setSalaryType(e.target.value)}
                >
                  <option value="monthly">{SALARY_TYPE_LABELS.monthly}</option>
                  <option value="daily">{SALARY_TYPE_LABELS.daily}</option>
                  <option value="hourly">{SALARY_TYPE_LABELS.hourly}</option>
                </select>
              </div>
              <div className="add-product-page__form-group">
                <label className="add-product-page__label">
                  Базовый оклад (сумма)
                </label>
                <input
                  className="add-product-page__input"
                  type="number"
                  min="0"
                  step="0.01"
                  value={baseSalary}
                  onChange={(e) => setBaseSalary(e.target.value)}
                  placeholder="Например: 45000.00"
                />
              </div>
              <div className="add-product-page__form-group">
                <label
                  className="add-product-page__label"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    cursor: "pointer",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={isActive}
                    onChange={(e) => setIsActive(e.target.checked)}
                  />
                  <span>Активен</span>
                </label>
              </div>
              <div className="add-product-page__form-group">
                <label className="add-product-page__label">Заметки</label>
                <textarea
                  className="add-product-page__input"
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Дополнительная информация по окладу или договоренностям..."
                  style={{ resize: "vertical" }}
                />
              </div>
              {formError && (
                <div
                  className="add-product-page__error"
                  style={{ marginBottom: 8 }}
                >
                  {formError}
                </div>
              )}
              <div className="add-product-page__actions">
                <button
                  type="button"
                  className="add-product-page__cancel-btn"
                  onClick={() => navigate("/crm/building/salary")}
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  className="add-product-page__submit-btn"
                  disabled={isSaving}
                >
                  {isSaving ? "Сохранение..." : "Сохранить"}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
