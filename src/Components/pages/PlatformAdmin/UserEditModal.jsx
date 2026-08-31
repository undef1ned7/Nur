import { useMemo, useState } from "react";
import { FaTimes } from "react-icons/fa";
import "./PlatformAdmin.scss";

const SYSTEM_ROLES = [
  { value: "owner", label: "Владелец" },
  { value: "admin", label: "Администратор" },
];

/** Типичные доступы — полный список хранится на бэке; фронт шлёт флаги как есть. */
const COMMON_ACCESS_KEYS = [
  "can_view_dashboard",
  "can_view_cashbox",
  "can_view_employees",
  "can_view_settings",
  "can_view_sale",
  "can_view_products",
  "can_view_analytics",
  "can_view_clients",
  "can_view_branch",
  "can_view_departments",
  "can_view_orders",
  "can_view_booking",
  "can_view_debts",
  "can_view_showcase",
];

const emptyForm = () => ({
  email: "",
  first_name: "",
  last_name: "",
  phone_number: "",
  role: "admin",
  custom_role: null,
  branches: [],
  is_active: true,
});

const collectAccessFlags = (user) => {
  const flags = {};
  if (!user || typeof user !== "object") return flags;
  Object.keys(user).forEach((key) => {
    if (key.startsWith("can_view_") && typeof user[key] === "boolean") {
      flags[key] = user[key];
    }
  });
  COMMON_ACCESS_KEYS.forEach((key) => {
    if (!(key in flags)) flags[key] = false;
  });
  return flags;
};

const buildInitial = (mode, user) => {
  if (mode === "create" || !user) {
    const defaults = {};
    COMMON_ACCESS_KEYS.forEach((k) => {
      defaults[k] = false;
    });
    return { form: emptyForm(), access: defaults };
  }
  return {
    form: {
      email: user.email || "",
      first_name: user.first_name || "",
      last_name: user.last_name || "",
      phone_number: user.phone_number || "",
      role: user.role || (user.custom_role ? "" : "admin"),
      custom_role: user.custom_role || null,
      branches: Array.isArray(user.branches)
        ? user.branches.map((b) => (typeof b === "object" ? b.id : b))
        : user.branch
          ? [user.branch]
          : [],
      is_active: user.is_active !== false,
    },
    access: collectAccessFlags(user),
  };
};

const UserEditForm = ({
  mode,
  user,
  branches,
  customRoles,
  saving,
  error,
  onClose,
  onSubmit,
}) => {
  const initial = useMemo(() => buildInitial(mode, user), [mode, user]);
  const [form, setForm] = useState(initial.form);
  const [access, setAccess] = useState(initial.access);

  const roleSelectValue = useMemo(() => {
    if (form.custom_role) return `cus:${form.custom_role}`;
    if (form.role) return `sys:${form.role}`;
    return "";
  }, [form.role, form.custom_role]);

  const handleRoleChange = (value) => {
    if (value.startsWith("sys:")) {
      setForm((p) => ({
        ...p,
        role: value.slice(4),
        custom_role: null,
      }));
    } else if (value.startsWith("cus:")) {
      setForm((p) => ({
        ...p,
        role: null,
        custom_role: Number(value.slice(4)) || value.slice(4),
      }));
    }
  };

  const toggleBranch = (id) => {
    setForm((p) => {
      const set = new Set(p.branches.map(String));
      const key = String(id);
      if (set.has(key)) set.delete(key);
      else set.add(key);
      return { ...p, branches: Array.from(set) };
    });
  };

  const submit = (e) => {
    e.preventDefault();
    const payload = {
      email: form.email.trim(),
      first_name: form.first_name.trim(),
      last_name: form.last_name.trim(),
      phone_number: form.phone_number.trim() || null,
      is_active: form.is_active,
      branches: form.branches,
      ...access,
    };
    if (form.custom_role) {
      payload.custom_role = form.custom_role;
      payload.role = null;
    } else {
      payload.role = form.role || "admin";
      payload.custom_role = null;
    }
    onSubmit?.(payload);
  };

  return (
    <div
      className="platform-admin__modal"
      onClick={(e) => e.stopPropagation()}
      role="dialog"
      aria-modal="true"
    >
      <div className="platform-admin__modal-header">
        <h3>
          {mode === "create"
            ? "Новый пользователь"
            : "Редактировать пользователя"}
        </h3>
        <button
          type="button"
          className="platform-admin__icon-btn"
          onClick={() => !saving && onClose?.()}
          aria-label="Закрыть"
        >
          <FaTimes />
        </button>
      </div>

      {error && <div className="platform-admin__alert">{error}</div>}

      <form className="platform-admin__form" onSubmit={submit}>
        <div className="platform-admin__grid">
          <label className="platform-admin__field">
            <span>Email *</span>
            <input
              type="email"
              required
              value={form.email}
              disabled={saving}
              onChange={(e) =>
                setForm((p) => ({ ...p, email: e.target.value }))
              }
            />
          </label>
          <label className="platform-admin__field">
            <span>Телефон</span>
            <input
              value={form.phone_number}
              disabled={saving}
              onChange={(e) =>
                setForm((p) => ({ ...p, phone_number: e.target.value }))
              }
            />
          </label>
          <label className="platform-admin__field">
            <span>Имя *</span>
            <input
              required
              value={form.first_name}
              disabled={saving}
              onChange={(e) =>
                setForm((p) => ({ ...p, first_name: e.target.value }))
              }
            />
          </label>
          <label className="platform-admin__field">
            <span>Фамилия *</span>
            <input
              required
              value={form.last_name}
              disabled={saving}
              onChange={(e) =>
                setForm((p) => ({ ...p, last_name: e.target.value }))
              }
            />
          </label>
          <label className="platform-admin__field">
            <span>Роль</span>
            <select
              value={roleSelectValue}
              disabled={saving}
              onChange={(e) => handleRoleChange(e.target.value)}
            >
              {SYSTEM_ROLES.map((r) => (
                <option key={r.value} value={`sys:${r.value}`}>
                  {r.label}
                </option>
              ))}
              {customRoles.map((r) => (
                <option key={r.id} value={`cus:${r.id}`}>
                  {r.name || r.title}
                </option>
              ))}
            </select>
          </label>
          <label className="platform-admin__field platform-admin__field--check">
            <input
              type="checkbox"
              checked={form.is_active}
              disabled={saving}
              onChange={(e) =>
                setForm((p) => ({ ...p, is_active: e.target.checked }))
              }
            />
            <span>Аккаунт активен</span>
          </label>
        </div>

        {branches.length > 0 && (
          <fieldset className="platform-admin__fieldset">
            <legend>Филиалы</legend>
            <div className="platform-admin__checks">
              {branches.map((b) => {
                const id = b.id ?? b;
                const checked = form.branches.map(String).includes(String(id));
                return (
                  <label key={id} className="platform-admin__check">
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={saving}
                      onChange={() => toggleBranch(id)}
                    />
                    {b.name || `Филиал #${id}`}
                  </label>
                );
              })}
            </div>
          </fieldset>
        )}

        <fieldset className="platform-admin__fieldset">
          <legend>Доступы (can_view_*)</legend>
          <div className="platform-admin__checks">
            {Object.keys(access)
              .sort()
              .map((key) => (
                <label key={key} className="platform-admin__check">
                  <input
                    type="checkbox"
                    checked={Boolean(access[key])}
                    disabled={saving}
                    onChange={(e) =>
                      setAccess((p) => ({ ...p, [key]: e.target.checked }))
                    }
                  />
                  {key.replace(/^can_view_/, "")}
                </label>
              ))}
          </div>
        </fieldset>

        <div className="platform-admin__actions">
          <button
            type="button"
            className="platform-admin__btn platform-admin__btn--ghost"
            disabled={saving}
            onClick={onClose}
          >
            Отмена
          </button>
          <button
            type="submit"
            className="platform-admin__btn platform-admin__btn--primary"
            disabled={saving}
          >
            {saving ? "Сохранение…" : "Сохранить"}
          </button>
        </div>
      </form>
    </div>
  );
};

const UserEditModal = ({
  open,
  mode = "edit",
  user = null,
  branches = [],
  customRoles = [],
  saving = false,
  error = "",
  onClose,
  onSubmit,
}) => {
  if (!open) return null;

  const formKey = `${mode}-${user?.id ?? "new"}`;

  return (
    <div
      className="platform-admin__overlay"
      onClick={() => !saving && onClose?.()}
    >
      <UserEditForm
        key={formKey}
        mode={mode}
        user={user}
        branches={branches}
        customRoles={customRoles}
        saving={saving}
        error={error}
        onClose={onClose}
        onSubmit={onSubmit}
      />
    </div>
  );
};

export default UserEditModal;
