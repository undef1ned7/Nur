import React, { useCallback, useEffect, useState } from "react";
import api from "../../../../../api";
import { validateResErrors } from "../../../../../../tools/validateResErrors";

const listFrom = (data) =>
  Array.isArray(data?.results) ? data.results : Array.isArray(data) ? data : [];

async function fetchProfilesForUser(userId) {
  let url = `/cafe/waiter-pay-profiles/?user=${encodeURIComponent(userId)}`;
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
  /* fallback, если фильтр user не поддержан */
  url = "/cafe/waiter-pay-profiles/";
  guard = 0;
  while (url && guard < 40) {
    // eslint-disable-next-line no-await-in-loop
    const { data } = await api.get(url);
    const chunk = listFrom(data);
    acc.push(
      ...chunk.filter(
        (p) =>
          String(p?.user ?? p?.user_id ?? "") === String(userId)
      )
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

/**
 * Модалка: POST/PATCH/DELETE /cafe/waiter-pay-profiles/
 */
const CafeWaiterPayProfileModal = ({
  open,
  employee,
  onClose,
  employeeDisplayName,
}) => {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [profiles, setProfiles] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [monthlyBase, setMonthlyBase] = useState("");
  const [revenuePercent, setRevenuePercent] = useState("");
  const [error, setError] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  const applyProfile = useCallback((p) => {
    if (!p) {
      setSelectedId(null);
      setMonthlyBase("");
      setRevenuePercent("");
      return;
    }
    setSelectedId(p.id);
    setMonthlyBase(
      p.monthly_base_salary != null && p.monthly_base_salary !== ""
        ? String(p.monthly_base_salary).replace(",", ".")
        : ""
    );
    setRevenuePercent(
      p.revenue_percent != null && p.revenue_percent !== ""
        ? String(p.revenue_percent).replace(",", ".")
        : ""
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
      if (list.length) {
        applyProfile(list[0]);
      } else {
        applyProfile(null);
      }
    } catch (e) {
      setError(validateResErrors(e, "Не удалось загрузить профиль"));
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
      setMonthlyBase("");
      setRevenuePercent("");
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
      const monthly_base_salary = monthlyBase.trim().replace(",", ".") || "0";
      const revenue_percent = revenuePercent.trim().replace(",", ".") || "0";

      if (selectedId) {
        await api.patch(`/cafe/waiter-pay-profiles/${selectedId}/`, {
          monthly_base_salary,
          revenue_percent,
        });
      } else {
        await api.post("/cafe/waiter-pay-profiles/", {
          user: String(employee.id),
          monthly_base_salary,
          revenue_percent,
        });
      }
      await load();
    } catch (err) {
      setError(validateResErrors(err, "Не удалось сохранить"));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedId) return;
    setSaving(true);
    setError("");
    try {
      await api.delete(`/cafe/waiter-pay-profiles/${selectedId}/`);
      setDeleteConfirm(false);
      await load();
    } catch (err) {
      setError(validateResErrors(err, "Не удалось удалить"));
    } finally {
      setSaving(false);
    }
  };

  if (!open || !employee) return null;

  return (
    <div className="barbermasters__overlay" role="presentation" onClick={onClose}>
      <div
        className="barbermasters__modal barbermasters__modal--cafeWaiterPay"
        role="dialog"
        aria-modal="true"
        aria-labelledby="cafe-waiter-pay-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="barbermasters__modalHeader">
          <h3 id="cafe-waiter-pay-title" className="barbermasters__modalTitle">
            Зарплата официанта (кафе)
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

            {loading ? (
              <div className="barbermasters__help">Загрузка…</div>
            ) : null}

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
                Оклад в месяц <span className="barbermasters__req">*</span>
              </label>
              <input
                className="barbermasters__input"
                type="text"
                inputMode="decimal"
                value={monthlyBase}
                onChange={(e) => setMonthlyBase(e.target.value)}
                placeholder="0"
                disabled={saving || loading}
              />
            </div>

            <div className="barbermasters__field barbermasters__field--full">
              <label className="barbermasters__label">
                Процент от личной выручки <span className="barbermasters__req">*</span>
              </label>
              <input
                className="barbermasters__input"
                type="text"
                inputMode="decimal"
                value={revenuePercent}
                onChange={(e) => setRevenuePercent(e.target.value)}
                placeholder="0"
                disabled={saving || loading}
              />
              <div className="barbermasters__help">
                Учитывается в отчёте аналитики зарплаты официантов (оклад × дни/30 + % от
                выручки).
              </div>
            </div>

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

export default CafeWaiterPayProfileModal;
