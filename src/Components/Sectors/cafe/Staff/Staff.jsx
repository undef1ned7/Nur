import React, { useEffect, useMemo, useState, useCallback } from "react";
import { FaPlus, FaSearch, FaTimes, FaEdit, FaTrash } from "react-icons/fa";
import api from "../../../../api";
import "./Staff.scss";

/* ===== API ===== */
const EMPLOYEES_LIST_URL = "/users/employees/";            // GET
const EMPLOYEES_CREATE_URL = "/users/employees/create/";   // POST
const ROLES_LIST_URL = "/users/roles/";                    // GET (кастомные роли)
const ROLE_CREATE_URL = "/users/roles/custom/";            // POST
const ROLE_ITEM_URL = (id) => `/users/roles/custom/${id}/`; // PUT / DELETE

/* ===== Системные роли из swagger enum ===== */
const SYSTEM_ROLES = ["owner", "admin"];

/* ===== utils ===== */
const asArray = (data) =>
  Array.isArray(data?.results) ? data.results : Array.isArray(data) ? data : [];

const normalizeEmployee = (e = {}) => ({
  id: e.id,
  email: e.email ?? "",
  first_name: e.first_name ?? "",
  last_name: e.last_name ?? "",
  role: e.role ?? null,               // 'admin' | 'owner' | null
  custom_role: e.custom_role ?? null, // uuid | null
  role_display: e.role_display ?? "",
});

const fullName = (e) =>
  [e?.last_name || "", e?.first_name || ""].filter(Boolean).join(" ").trim();

const ruLabelSys = (code) => {
  const c = String(code || "").toLowerCase();
  if (c === "owner") return "Владелец";
  if (c === "admin") return "Администратор";
  return code || "";
};

/* распознаём попытки назвать кастомную роль как системную */
const sysCodeFromName = (name) => {
  const l = String(name || "").trim().toLowerCase();
  if (["admin", "administrator", "админ", "администратор"].includes(l)) return "admin";
  if (["owner", "владелец"].includes(l)) return "owner";
  return null;
};

const pickApiError = (e, fallback) => {
  const data = e?.response?.data;
  if (!data) return fallback;
  if (typeof data === "string") return data;
  if (typeof data === "object") {
    try {
      const k = Object.keys(data)[0];
      const v = Array.isArray(data[k]) ? data[k][0] : data[k];
      return String(v || fallback);
    } catch {
      return fallback;
    }
  }
  return fallback;
};

const Staff = () => {
  /* ===== tabs ===== */
  const [tab, setTab] = useState("employees"); // 'employees' | 'roles'

  /* ===== data ===== */
  const [employees, setEmployees] = useState([]);
  const [roles, setRoles] = useState([]); // кастомные роли [{id,name}]
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  /* ===== search ===== */
  const [q, setQ] = useState("");

  /* ===== role: create/edit/delete ===== */
  const [roleCreateOpen, setRoleCreateOpen] = useState(false);
  const [roleCreateName, setRoleCreateName] = useState("");
  const [roleCreateSaving, setRoleCreateSaving] = useState(false);
  const [roleCreateErr, setRoleCreateErr] = useState("");

  const [roleEditOpen, setRoleEditOpen] = useState(false);
  const [roleEditId, setRoleEditId] = useState(null);
  const [roleEditName, setRoleEditName] = useState("");
  const [roleEditSaving, setRoleEditSaving] = useState(false);

  const [roleDeletingIds, setRoleDeletingIds] = useState(new Set());

  /* ===== employee: create ===== */
  const [empCreateOpen, setEmpCreateOpen] = useState(false);
  const [empSaving, setEmpSaving] = useState(false);
  const [empErr, setEmpErr] = useState("");
  const emptyEmp = { email: "", first_name: "", last_name: "", roleChoice: "" };
  // roleChoice = "sys:admin" | "sys:owner" | "cus:<uuid>"
  const [empForm, setEmpForm] = useState(emptyEmp);

  /* ===== fetch ===== */
  const fetchEmployees = useCallback(async () => {
    const res = await api.get(EMPLOYEES_LIST_URL);
    setEmployees(asArray(res.data).map(normalizeEmployee));
  }, []);

  const fetchRoles = useCallback(async () => {
    const res = await api.get(ROLES_LIST_URL);
    setRoles(asArray(res.data).map((r) => ({ id: r.id, name: r.name || "" })));
  }, []);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        setError("");
        await Promise.all([fetchEmployees(), fetchRoles()]);
      } catch (e) {
        console.error(e);
        setError("Не удалось загрузить данные.");
      } finally {
        setLoading(false);
      }
    })();
  }, [fetchEmployees, fetchRoles]);

  /* map для быстрого доступа */
  const roleById = useMemo(() => {
    const m = new Map();
    roles.forEach((r) => m.set(r.id, r));
    return m;
  }, [roles]);

  /* ===== Роли для селекта сотрудника (без дублей admin/owner) ===== */
  const roleOptions = useMemo(() => {
    const sys = SYSTEM_ROLES.map((code) => ({
      key: `sys:${code}`,
      label: ruLabelSys(code),
    }));

    // кастомные, исключая названия, совпадающие с системными
    const cus = roles
      .filter((r) => !sysCodeFromName(r.name))
      .map((r) => ({ key: `cus:${r.id}`, label: String(r.name || "").trim() }));

    // устранение дублей по видимому названию
    const seen = new Set();
    const out = [];
    for (const o of [...sys, ...cus]) {
      const k = o.label.trim().toLowerCase();
      if (!seen.has(k)) {
        seen.add(k);
        out.push(o);
      }
    }
    return out.sort((a, b) => a.label.localeCompare(b.label, "ru"));
  }, [roles]);

  /* ===== Фильтрация сотрудников ===== */
  const filteredEmployees = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return employees;
    return employees.filter((e) =>
      [fullName(e), e.email, e.role_display, ruLabelSys(e.role)]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(t))
    );
  }, [employees, q]);

  /* ===== Список ролей для вкладки "Роли" ===== */
  const filteredRoles = useMemo(() => {
    // 1) только кастомные, исключая названия системных
    const base = roles.filter((r) => !sysCodeFromName(r.name));

    // 2) устраняем повторы по названию
    const seen = new Set();
    const dedup = [];
    for (const r of base) {
      const key = String(r.name || "").trim().toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        dedup.push(r);
      }
    }

    // 3) поиск
    const t = q.trim().toLowerCase();
    if (!t) return dedup;
    return dedup.filter((r) => String(r.name || "").toLowerCase().includes(t));
  }, [roles, q]);

  /* ===== ROLE: create ===== */
  const submitRoleCreate = async (e) => {
    e.preventDefault();
    const name = roleCreateName.trim();
    if (!name) return setRoleCreateErr("Укажите название роли");
    if (sysCodeFromName(name)) {
      setRoleCreateErr("Такое имя зарезервировано для системной роли.");
      return;
    }

    setRoleCreateSaving(true);
    setRoleCreateErr("");
    try {
      await api.post(ROLE_CREATE_URL, { name });
      await fetchRoles();
      setRoleCreateOpen(false);
      setRoleCreateName("");
    } catch (err) {
      console.error(err);
      setRoleCreateErr(pickApiError(err, "Не удалось создать роль"));
    } finally {
      setRoleCreateSaving(false);
    }
  };

  /* ===== ROLE: edit ===== */
  const openRoleEdit = (r) => {
    setRoleEditId(r.id);
    setRoleEditName(r.name || "");
    setRoleEditOpen(true);
  };
  const submitRoleEdit = async (e) => {
    e.preventDefault();
    if (!roleEditId) return;
    const name = roleEditName.trim();
    if (!name) return;
    if (sysCodeFromName(name)) {
      alert("Такое имя зарезервировано для системной роли.");
      return;
    }

    setRoleEditSaving(true);
    try {
      await api.put(ROLE_ITEM_URL(roleEditId), { name });
      await fetchRoles();
      setRoleEditOpen(false);
      setRoleEditId(null);
      setRoleEditName("");
    } catch (err) {
      console.error(err);
      alert(pickApiError(err, "Не удалось обновить роль"));
    } finally {
      setRoleEditSaving(false);
    }
  };

  /* ===== ROLE: delete ===== */
  const removeRole = async (r) => {
    if (!r?.id) return;
    if (!window.confirm(`Удалить роль «${r.name || "—"}»? Действие необратимо.`)) return;
    setRoleDeletingIds((prev) => new Set(prev).add(r.id));
    try {
      await api.delete(ROLE_ITEM_URL(r.id));
      await fetchRoles();
    } catch (err) {
      console.error(err);
      alert(pickApiError(err, "Не удалось удалить роль"));
    } finally {
      setRoleDeletingIds((prev) => {
        const next = new Set(prev);
        next.delete(r.id);
        return next;
      });
    }
  };

  /* ===== EMPLOYEE: create ===== */
  const submitEmployeeCreate = async (e) => {
    e.preventDefault();
    const email = empForm.email.trim();
    const first_name = empForm.first_name.trim();
    const last_name = empForm.last_name.trim();
    const roleChoice = empForm.roleChoice;

    if (!email || !first_name || !last_name || !roleChoice) {
      setEmpErr("Заполните Email, Имя, Фамилию и выберите роль.");
      return;
    }

    const payload = { email, first_name, last_name };
    if (roleChoice.startsWith("sys:")) {
      payload.role = roleChoice.slice(4); // 'admin' | 'owner'
    } else if (roleChoice.startsWith("cus:")) {
      payload.custom_role = roleChoice.slice(4); // uuid
    }

    setEmpSaving(true);
    setEmpErr("");
    try {
      await api.post(EMPLOYEES_CREATE_URL, payload);
      await fetchEmployees();
      setEmpCreateOpen(false);
      setEmpForm(emptyEmp);
    } catch (err) {
      console.error(err);
      setEmpErr(pickApiError(err, "Не удалось создать сотрудника"));
    } finally {
      setEmpSaving(false);
    }
  };

  /* ===== RENDER ===== */
  return (
    <section className="staff">
      {/* Header */}
      <div className="staff__header">
        <div>
          <h2 className="staff__title">Сотрудники</h2>
          <p className="staff__subtitle">Роли и сотрудники</p>
        </div>

        <div className="staff__actions">
          <button
            type="button"
            className="staff__btn staff__btn--secondary"
            onClick={() => setTab("roles")}
            style={{ opacity: tab === "roles" ? 1 : 0.85 }}
          >
            Роли
          </button>
          <button
            type="button"
            className="staff__btn staff__btn--secondary"
            onClick={() => setTab("employees")}
            style={{ opacity: tab === "employees" ? 1 : 0.85 }}
          >
            Сотрудники
          </button>

          <div className="staff__search">
            <FaSearch className="staff__search-icon" aria-hidden />
            <input
              className="staff__search-input"
              placeholder={tab === "roles" ? "Поиск ролей…" : "Поиск по сотрудникам…"}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              aria-label="Поиск"
            />
          </div>

          {tab === "roles" ? (
            <button
              type="button"
              className="staff__btn staff__btn--primary"
              onClick={() => setRoleCreateOpen(true)}
            >
              <FaPlus /> Создать роль
            </button>
          ) : (
            <button
              type="button"
              className="staff__btn staff__btn--primary"
              onClick={() => setEmpCreateOpen(true)}
            >
              <FaPlus /> Создать сотрудника
            </button>
          )}
        </div>
      </div>

      {loading && <div className="staff__alert">Загрузка…</div>}
      {!!error && <div className="staff__alert">{error}</div>}

      {/* ===== ROLES TAB ===== */}
      {!loading && tab === "roles" && (
        <div className="staff__list">
          {/* системные роли (read-only) */}
          {SYSTEM_ROLES.map((code) => (
            <div className="staff__card" key={`sys:${code}`}>
              <div className="staff__card-left">
                <div className="staff__avatar" aria-hidden>
                  {ruLabelSys(code).charAt(0)}
                </div>
                <div>
                  <p className="staff__name">{ruLabelSys(code)}</p>
                  <div className="staff__meta">
                    <span className="staff__muted">Системная роль</span>
                  </div>
                </div>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  type="button"
                  className="staff__btn staff__btn--secondary"
                  disabled
                  title="Системные роли нельзя изменять"
                >
                  <FaEdit /> Изменить
                </button>
                <button
                  type="button"
                  className="staff__btn staff__btn--danger"
                  disabled
                  title="Системные роли нельзя удалять"
                >
                  <FaTrash /> Удалить
                </button>
              </div>
            </div>
          ))}

          {/* кастомные роли — без дублей admin/owner */}
          {filteredRoles.map((r) => (
            <div className="staff__card" key={r.id}>
              <div className="staff__card-left">
                <div className="staff__avatar" aria-hidden>
                  {(r.name || "•").trim().charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="staff__name">{r.name || "Без названия"}</p>
                  <div className="staff__meta">
                    <span className="staff__muted">Пользовательская роль</span>
                  </div>
                </div>
              </div>

              <div style={{ display: "flex", gap: 8 }}>
                <button
                  type="button"
                  className="staff__btn staff__btn--secondary"
                  onClick={() => openRoleEdit(r)}
                  title="Изменить"
                >
                  <FaEdit /> Изменить
                </button>
                <button
                  type="button"
                  className="staff__btn staff__btn--danger"
                  onClick={() => removeRole(r)}
                  disabled={roleDeletingIds.has(r.id)}
                  title="Удалить"
                >
                  <FaTrash /> {roleDeletingIds.has(r.id) ? "Удаление…" : "Удалить"}
                </button>
              </div>
            </div>
          ))}

          {filteredRoles.length === 0 && roles.length > 0 && (
            <div className="staff__alert">Роли по запросу не найдены.</div>
          )}
          {!loading && roles.length === 0 && (
            <div className="staff__alert">Пока нет пользовательских ролей.</div>
          )}
        </div>
      )}

      {/* ===== EMPLOYEES TAB ===== */}
      {!loading && tab === "employees" && (
        <div className="staff__list">
          {filteredEmployees.map((u) => {
            const initial =
              (fullName(u) || u.email || "•").trim().charAt(0).toUpperCase() || "•";
            const roleLabel = u.role
              ? ruLabelSys(u.role) // системная
              : roles.length
              ? (roleById.get(u.custom_role)?.name || u.role_display || "—")
              : (u.role_display || "—");

            return (
              <div key={u.id} className="staff__card">
                <div className="staff__card-left">
                  <div className="staff__avatar" aria-hidden>
                    {initial}
                  </div>
                  <div>
                    <p className="staff__name">{fullName(u) || "Без имени"}</p>
                    <div className="staff__meta">
                      <span className="staff__muted">{u.email || "—"}</span>
                      <span className="staff__muted">•</span>
                      <span className="staff__muted">{roleLabel}</span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}

          {filteredEmployees.length === 0 && employees.length > 0 && (
            <div className="staff__alert">Сотрудники по запросу не найдены.</div>
          )}
          {!loading && employees.length === 0 && (
            <div className="staff__alert">Пока нет сотрудников.</div>
          )}
        </div>
      )}

      {/* ===== MODALS ===== */}

      {/* Role: Create */}
      {roleCreateOpen && (
        <div
          className="staff__modal-overlay"
          role="dialog"
          aria-modal="true"
          onClick={() => !roleCreateSaving && setRoleCreateOpen(false)}
        >
          <div className="staff__modal" onClick={(e) => e.stopPropagation()}>
            <div className="staff__modal-header">
              <h3 className="staff__modal-title">Новая роль</h3>
              <button
                type="button"
                className="staff__icon-btn"
                onClick={() => !roleCreateSaving && setRoleCreateOpen(false)}
                aria-label="Закрыть"
              >
                <FaTimes />
              </button>
            </div>

            <form className="staff__form" onSubmit={submitRoleCreate}>
              <div className="staff__form-grid">
                <div className="staff__field staff__field--full">
                  <label className="staff__label">
                    Название роли <span className="staff__req">*</span>
                  </label>
                  <input
                    className="staff__input"
                    placeholder="Например: Контент-менеджер"
                    value={roleCreateName}
                    onChange={(e) => setRoleCreateName(e.target.value)}
                    required
                  />
                </div>
              </div>

              {!!roleCreateErr && <div className="staff__alert">{roleCreateErr}</div>}

              <div className="staff__form-actions">
                <button
                  type="button"
                  className="staff__btn staff__btn--secondary"
                  onClick={() => setRoleCreateOpen(false)}
                  disabled={roleCreateSaving}
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  className="staff__btn staff__btn--primary"
                  disabled={roleCreateSaving}
                >
                  {roleCreateSaving ? "Сохранение…" : "Создать роль"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Role: Edit */}
      {roleEditOpen && (
        <div
          className="staff__modal-overlay"
          role="dialog"
          aria-modal="true"
          onClick={() => !roleEditSaving && setRoleEditOpen(false)}
        >
          <div className="staff__modal" onClick={(e) => e.stopPropagation()}>
            <div className="staff__modal-header">
              <h3 className="staff__modal-title">Изменить роль</h3>
              <button
                type="button"
                className="staff__icon-btn"
                onClick={() => !roleEditSaving && setRoleEditOpen(false)}
                aria-label="Закрыть"
              >
                <FaTimes />
              </button>
            </div>

            <form className="staff__form" onSubmit={submitRoleEdit}>
              <div className="staff__form-grid">
                <div className="staff__field staff__field--full">
                  <label className="staff__label">
                    Название роли <span className="staff__req">*</span>
                  </label>
                  <input
                    className="staff__input"
                    placeholder="Название роли"
                    value={roleEditName}
                    onChange={(e) => setRoleEditName(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="staff__form-actions">
                <button
                  type="button"
                  className="staff__btn staff__btn--secondary"
                  onClick={() => setRoleEditOpen(false)}
                  disabled={roleEditSaving}
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  className="staff__btn staff__btn--primary"
                  disabled={roleEditSaving}
                >
                  {roleEditSaving ? "Сохранение…" : "Сохранить изменения"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Employee: Create */}
      {empCreateOpen && (
        <div
          className="staff__modal-overlay"
          role="dialog"
          aria-modal="true"
          onClick={() => !empSaving && setEmpCreateOpen(false)}
        >
          <div className="staff__modal" onClick={(e) => e.stopPropagation()}>
            <div className="staff__modal-header">
              <h3 className="staff__modal-title">Новый сотрудник</h3>
              <button
                type="button"
                className="staff__icon-btn"
                onClick={() => !empSaving && setEmpCreateOpen(false)}
                aria-label="Закрыть"
              >
                <FaTimes />
              </button>
            </div>

            <form className="staff__form" onSubmit={submitEmployeeCreate}>
              <div className="staff__form-grid">
                <div className="staff__field">
                  <label className="staff__label">
                    Email <span className="staff__req">*</span>
                  </label>
                  <input
                    type="email"
                    className="staff__input"
                    placeholder="user@mail.com"
                    value={empForm.email}
                    onChange={(e) => setEmpForm((p) => ({ ...p, email: e.target.value }))}
                    required
                  />
                </div>

                <div className="staff__field">
                  <label className="staff__label">
                    Имя <span className="staff__req">*</span>
                  </label>
                  <input
                    className="staff__input"
                    placeholder="Алия"
                    value={empForm.first_name}
                    onChange={(e) => setEmpForm((p) => ({ ...p, first_name: e.target.value }))}
                    required
                  />
                </div>

                <div className="staff__field">
                  <label className="staff__label">
                    Фамилия <span className="staff__req">*</span>
                  </label>
                  <input
                    className="staff__input"
                    placeholder="Жумалиева"
                    value={empForm.last_name}
                    onChange={(e) => setEmpForm((p) => ({ ...p, last_name: e.target.value }))}
                    required
                  />
                </div>

                <div className="staff__field staff__field--full">
                  <label className="staff__label">
                    Роль <span className="staff__req">*</span>
                  </label>
                  <select
                    className="staff__input"
                    value={empForm.roleChoice}
                    onChange={(e) => setEmpForm((p) => ({ ...p, roleChoice: e.target.value }))}
                    required
                  >
                    <option value="">Выберите роль</option>
                    {roleOptions.map((o) => (
                      <option key={o.key} value={o.key}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {!!empErr && <div className="staff__alert">{empErr}</div>}

              <div className="staff__form-actions">
                <button
                  type="button"
                  className="staff__btn staff__btn--secondary"
                  onClick={() => setEmpCreateOpen(false)}
                  disabled={empSaving}
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  className="staff__btn staff__btn--primary"
                  disabled={empSaving}
                >
                  {empSaving ? "Сохранение…" : "Создать сотрудника"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
};

export default Staff;
