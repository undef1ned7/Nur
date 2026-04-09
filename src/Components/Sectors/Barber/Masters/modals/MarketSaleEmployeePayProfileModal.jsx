import React, { useCallback, useEffect, useState } from "react";
import api from "../../../../../api";
import { validateResErrors } from "../../../../../../tools/validateResErrors";

const listFrom = (data) =>
  Array.isArray(data?.results) ? data.results : Array.isArray(data) ? data : [];

const PAY_SCHEMES = [
  { value: "salary", label: "Оклад" },
  { value: "percent", label: "Процент от продаж" },
  { value: "salary_plus_percent", label: "Оклад + процент от продаж" },
];

const parseNum = (v) => {
  const n = Number(String(v || "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};

async function fetchProfilesForUser(userId) {
  let url = `/main/market-sale-employee-pay-profiles/?user=${encodeURIComponent(userId)}`;
  const acc = [];
  let guard = 0;
  while (url && guard < 40) {
    // eslint-disable-next-line no-await-in-loop
    const { data } = await api.get(url);
    acc.push(...listFrom(data));
    url = data?.next || null;
    guard += 1;
  }
  if (acc.length) return acc;
  url = "/main/market-sale-employee-pay-profiles/";
  guard = 0;
  while (url && guard < 40) {
    // eslint-disable-next-line no-await-in-loop
    const { data } = await api.get(url);
    const chunk = listFrom(data);
    acc.push(
      ...chunk.filter((p) => String(p?.user ?? p?.user_id ?? "") === String(userId)),
    );
    url = data?.next || null;
    guard += 1;
  }
  return acc;
}

const branchLabel = (p) => {
  if (p?.branch == null && p?.branch_name == null) return "Общий (все филиалы)";
  return p?.branch_name || p?.branch?.name || String(p.branch || "—");
};

const MarketSaleEmployeePayProfileModal = ({
  open,
  employee,
  onClose,
  employeeDisplayName,
}) => {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [profiles, setProfiles] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [payScheme, setPayScheme] = useState("salary_plus_percent");
  const [monthlyBaseSalary, setMonthlyBaseSalary] = useState("");
  const [salesPercent, setSalesPercent] = useState("");
  const [error, setError] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  const applyProfile = useCallback((p) => {
    if (!p) {
      setSelectedId(null);
      setPayScheme("salary_plus_percent");
      setMonthlyBaseSalary("");
      setSalesPercent("");
      return;
    }
    setSelectedId(p.id);
    setPayScheme(String(p.pay_scheme || "salary_plus_percent"));
    setMonthlyBaseSalary(
      p.monthly_base_salary != null && p.monthly_base_salary !== ""
        ? String(p.monthly_base_salary).replace(",", ".")
        : "",
    );
    setSalesPercent(
      p.sales_percent != null && p.sales_percent !== ""
        ? String(p.sales_percent).replace(",", ".")
        : "",
    );
  }, []);

  const load = useCallback(async () => {
    if (!employee?.id) return;
    setLoading(true);
    setError("");
    setDeleteConfirm(false);
    try {
      const list = await fetchProfilesForUser(employee.id);
      setProfiles(list);
      if (list.length) applyProfile(list[0]);
      else applyProfile(null);
    } catch (e) {
      setError(validateResErrors(e, "Не удалось загрузить профиль ЗП"));
      setProfiles([]);
      applyProfile(null);
    } finally {
      setLoading(false);
    }
  }, [employee?.id, applyProfile]);

  useEffect(() => {
    if (open && employee?.id) load();
  }, [open, employee?.id, load]);

  useEffect(() => {
    if (!open) {
      setProfiles([]);
      setSelectedId(null);
      setPayScheme("salary_plus_percent");
      setMonthlyBaseSalary("");
      setSalesPercent("");
      setError("");
      setDeleteConfirm(false);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const onSelectProfile = (e) => {
    const id = e.target.value;
    const p = profiles.find((x) => String(x.id) === String(id));
    applyProfile(p || null);
    setDeleteConfirm(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!employee?.id) return;
    setSaving(true);
    setError("");
    try {
      const monthlyRaw = monthlyBaseSalary.trim().replace(",", ".");
      const percentRaw = salesPercent.trim().replace(",", ".");
      const monthlyNum = parseNum(monthlyRaw);
      const percentNum = parseNum(percentRaw);

      if (payScheme === "salary" && monthlyNum <= 0) {
        setError("Для схемы «Оклад» укажите monthly_base_salary > 0.");
        setSaving(false);
        return;
      }
      if (payScheme === "percent" && percentNum <= 0) {
        setError("Для схемы «Процент от продаж» укажите sales_percent > 0.");
        setSaving(false);
        return;
      }
      if (payScheme === "salary_plus_percent" && (monthlyNum <= 0 || percentNum <= 0)) {
        setError("Для схемы «Оклад + процент» заполните оба поля больше 0.");
        setSaving(false);
        return;
      }
      if (percentNum > 100) {
        setError("Процент от продаж не может быть больше 100.");
        setSaving(false);
        return;
      }

      const monthly =
        payScheme === "percent" ? "0" : String(monthlyNum);
      const percent =
        payScheme === "salary" ? "0" : String(percentNum);

      const payload = {
        user: String(employee.id),
        pay_scheme: payScheme,
        monthly_base_salary: monthly,
        sales_percent: percent,
      };
      if (selectedId) {
        await api.patch(`/main/market-sale-employee-pay-profiles/${selectedId}/`, payload);
      } else {
        await api.post("/main/market-sale-employee-pay-profiles/", payload);
      }
      await load();
    } catch (err) {
      setError(validateResErrors(err, "Не удалось сохранить профиль ЗП"));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedId) return;
    setSaving(true);
    setError("");
    try {
      await api.delete(`/main/market-sale-employee-pay-profiles/${selectedId}/`);
      setDeleteConfirm(false);
      await load();
    } catch (err) {
      setError(validateResErrors(err, "Не удалось удалить профиль"));
    } finally {
      setSaving(false);
    }
  };

  if (!open || !employee) return null;

  const salaryOnly = payScheme === "salary";
  const percentOnly = payScheme === "percent";

  return (
    <div className="barbermasters__overlay" role="presentation" onClick={onClose}>
      <div
        className="barbermasters__modal barbermasters__modal--cafeWaiterPay"
        role="dialog"
        aria-modal="true"
        aria-labelledby="market-employee-pay-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="barbermasters__modalHeader">
          <h3 id="market-employee-pay-title" className="barbermasters__modalTitle">
            Зарплата сотрудника (маркет)
          </h3>
          <button
            type="button"
            className="barbermasters__iconBtn"
            onClick={onClose}
            aria-label="Закрыть"
          >
            ×
          </button>
        </header>

        <form className="barbermasters__form" onSubmit={handleSubmit}>
          <div className="barbermasters__content">
            <div className="barbermasters__field barbermasters__field--full">
              <div className="barbermasters__employeeCard">
                <div className="barbermasters__employeeInfo">
                  <div className="barbermasters__employeeName">
                    {employeeDisplayName || "Сотрудник"}
                  </div>
                  <div className="barbermasters__employeeMeta">
                    {employee.email || employee.id}
                  </div>
                </div>
              </div>
            </div>

            {loading ? <div className="barbermasters__help">Загрузка…</div> : null}

            {profiles.length > 1 ? (
              <div className="barbermasters__field barbermasters__field--full">
                <label className="barbermasters__label">Профиль</label>
                <select
                  className="barbermasters__input"
                  value={selectedId || ""}
                  onChange={onSelectProfile}
                  disabled={saving}
                >
                  {profiles.map((p) => (
                    <option key={p.id} value={p.id}>
                      {branchLabel(p)}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}

            <div className="barbermasters__field barbermasters__field--full">
              <label className="barbermasters__label">
                Схема начисления <span className="barbermasters__req">*</span>
              </label>
              <select
                className="barbermasters__input"
                value={payScheme}
                onChange={(e) => setPayScheme(e.target.value)}
                disabled={saving || loading}
              >
                {PAY_SCHEMES.map((x) => (
                  <option key={x.value} value={x.value}>
                    {x.label}
                  </option>
                ))}
              </select>
            </div>

            {!percentOnly ? (
              <div className="barbermasters__field barbermasters__field--full">
                <label className="barbermasters__label">
                  Оклад в месяц <span className="barbermasters__req">*</span>
                </label>
                <input
                  className="barbermasters__input"
                  type="text"
                  inputMode="decimal"
                  value={monthlyBaseSalary}
                  onChange={(e) => setMonthlyBaseSalary(e.target.value)}
                  placeholder="0"
                  disabled={saving || loading}
                />
              </div>
            ) : null}

            {!salaryOnly ? (
              <div className="barbermasters__field barbermasters__field--full">
                <label className="barbermasters__label">
                  Процент от личных продаж <span className="barbermasters__req">*</span>
                </label>
                <input
                  className="barbermasters__input"
                  type="text"
                  inputMode="decimal"
                  value={salesPercent}
                  onChange={(e) => setSalesPercent(e.target.value)}
                  placeholder="0"
                  disabled={saving || loading}
                />
                <div className="barbermasters__help">
                  Для отчета используется период из аналитики (tab=salary).
                </div>
              </div>
            ) : null}

            {error ? (
              <div className="barbermasters__alert barbermasters__alert--inModal">{error}</div>
            ) : null}
          </div>

          <div className="barbermasters__modalFooter pl-5 pb-5 flex gap-3">
            <button
              type="submit"
              className="barbermasters__btn barbermasters__btn--primary"
              disabled={saving || loading}
            >
              {saving ? "Сохранение…" : selectedId ? "Сохранить" : "Создать профиль"}
            </button>
            {selectedId ? (
              deleteConfirm ? (
                <>
                  <button
                    type="button"
                    className="barbermasters__btn barbermasters__btn--danger"
                    onClick={handleDelete}
                    disabled={saving}
                  >
                    {saving ? "Удаление…" : "Подтвердить удаление"}
                  </button>
                  <button
                    type="button"
                    className="barbermasters__btn barbermasters__btn--secondary"
                    onClick={() => setDeleteConfirm(false)}
                    disabled={saving}
                  >
                    Отмена
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  className="barbermasters__btn barbermasters__btn--danger"
                  onClick={() => setDeleteConfirm(true)}
                  disabled={saving}
                >
                  Удалить профиль
                </button>
              )
            ) : null}
            <button
              type="button"
              className="barbermasters__btn barbermasters__btn--secondary"
              onClick={onClose}
              disabled={saving}
            >
              Закрыть
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default MarketSaleEmployeePayProfileModal;
