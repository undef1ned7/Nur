import React, { useEffect, useState } from "react";
import { useDispatch } from "react-redux";
import api from "../../../../../api";
import { useAlert } from "@/hooks/useDialog";
import { getEmployees } from "@/store/creators/departmentCreators";
import { useDepartments } from "@/store/slices/departmentSlice";
import { validateResErrors } from "../../../../../../tools/validateResErrors";

export default function ProjectEmployeesTab({ residentialId }) {
  const dispatch = useDispatch();
  const alert = useAlert();
  const { employees = [] } = useDepartments();

  const [members, setMembers] = useState([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [membersError, setMembersError] = useState(null);
  const [addingMemberId, setAddingMemberId] = useState("");

  const memberUserIds = React.useMemo(
    () => new Set((members || []).map((m) => String(m.user))),
    [members],
  );
  const availableEmployees = React.useMemo(
    () =>
      (employees || []).filter(
        (e) => !memberUserIds.has(String(e.id ?? e.uuid)),
      ),
    [employees, memberUserIds],
  );

  useEffect(() => {
    if (!employees?.length) dispatch(getEmployees());
  }, [dispatch, employees?.length]);

  useEffect(() => {
    if (!residentialId) return;
    let cancelled = false;
    setMembersLoading(true);
    setMembersError(null);
    api
      .get(`/building/objects/${residentialId}/members/`)
      .then(({ data }) => {
        if (!cancelled) setMembers(Array.isArray(data) ? data : []);
      })
      .catch((err) => {
        if (!cancelled) {
          setMembersError(
            err?.response?.data ||
              err?.message ||
              "Не удалось загрузить сотрудников ЖК",
          );
        }
      })
      .finally(() => {
        if (!cancelled) setMembersLoading(false);
      });
    return () => { cancelled = true; };
  }, [residentialId]);

  const handleRemove = async (m) => {
    if (!residentialId) return;
    try {
      await api.delete(
        `/building/objects/${residentialId}/members/${m.user}/`,
      );
      setMembers((prev) =>
        prev.filter((x) => String(x.user) !== String(m.user)),
      );
    } catch (err) {
      alert(
        validateResErrors(err, "Не удалось снять сотрудника"),
        true,
      );
    }
  };

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!residentialId || !addingMemberId) return;
    try {
      await api.post(
        `/building/objects/${residentialId}/members/`,
        { user: addingMemberId, is_active: true },
      );
      setMembers((prev) => [
        ...prev,
        { user: addingMemberId, is_active: true },
      ]);
      setAddingMemberId("");
    } catch (err) {
      alert(
        validateResErrors(err, "Не удалось назначить сотрудника"),
        true,
      );
    }
  };

  if (!residentialId) {
    return (
      <div className="building-page__card">
        <div className="building-page__muted">ЖК не выбран.</div>
      </div>
    );
  }

  return (
    <div className="building-page__card">
      <h3 className="building-page__cardTitle">
        Сотрудники, назначенные на ЖК
      </h3>
      {membersLoading && (
        <div className="building-page__muted">
          Загрузка сотрудников ЖК...
        </div>
      )}
      {membersError && (
        <div className="building-page__error">
          {String(
            validateResErrors(
              membersError,
              "Не удалось загрузить сотрудников ЖК",
            ),
          )}
        </div>
      )}
      {!membersLoading && !membersError && (
        <>
          <div className="building-project-employees">
            {members.length === 0 ? (
              <div className="building-project-employees__empty">
                Пока никто не назначен на этот ЖК.
              </div>
            ) : (
              <ul className="building-project-employees__list">
                {members.map((m) => {
                  const emp =
                    employees.find(
                      (e) => String(e.id ?? e.uuid) === String(m.user),
                    ) || {};
                  const fullName =
                    [emp.first_name, emp.last_name]
                      .filter(Boolean)
                      .join(" ") ||
                    emp.display ||
                    emp.name ||
                    emp.email ||
                    m.user_display ||
                    "Сотрудник";
                  return (
                    <li key={m.user} className="building-project-employees__item">
                      <span className="building-project-employees__name">
                        {fullName}
                      </span>
                      <button
                        type="button"
                        className="building-project-employees__remove"
                        onClick={() => handleRemove(m)}
                      >
                        Снять
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
          <form className="building-page building-project-employees__form" onSubmit={handleAdd}>
            <label>
              <div className="building-page__label">
                Назначить сотрудника на ЖК
              </div>
              <select
                className="building-page__select"
                value={addingMemberId}
                onChange={(e) => setAddingMemberId(e.target.value)}
              >
                <option value="">Выберите сотрудника</option>
                {availableEmployees.map((e) => {
                  const fullName =
                    [e.first_name, e.last_name]
                      .filter(Boolean)
                      .join(" ") ||
                    e.display ||
                    e.name ||
                    e.email ||
                    "—";
                  return (
                    <option key={e.id ?? e.uuid} value={e.id ?? e.uuid}>
                      {fullName}
                    </option>
                  );
                })}
              </select>
            </label>
            <div className="building-project-employees__form-actions">
              <button
                type="submit"
                className="building-btn building-btn--primary"
                disabled={!addingMemberId}
              >
                Назначить
              </button>
            </div>
          </form>
        </>
      )}
    </div>
  );
}
