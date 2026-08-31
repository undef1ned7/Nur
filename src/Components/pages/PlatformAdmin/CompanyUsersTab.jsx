import { useCallback, useEffect, useState } from "react";
import {
  FaEdit,
  FaKey,
  FaPlus,
  FaTrash,
  FaUserSecret,
} from "react-icons/fa";
import {
  createPlatformCompanyUser,
  deletePlatformUser,
  fetchPlatformCompanyUsers,
  impersonatePlatformUser,
  isPlatformAdminUnavailable,
  patchPlatformUser,
  pickPlatformAdminError,
  resetPlatformUserPassword,
} from "../../../api/platformAdmin";
import { useConfirm } from "../../../hooks/useDialog";
import { startImpersonation } from "./impersonation";
import UserEditModal from "./UserEditModal";
import "./PlatformAdmin.scss";

const asArray = (data) =>
  Array.isArray(data?.results) ? data.results : Array.isArray(data) ? data : [];

const fullName = (u) =>
  [u?.last_name, u?.first_name].filter(Boolean).join(" ").trim() || "—";

const CompanyUsersTab = ({
  companyId,
  companyName,
  branches = [],
  customRoles = [],
}) => {
  const confirmDialog = useConfirm();
  const askConfirm = useCallback(
    (message) =>
      new Promise((resolve) => {
        confirmDialog(message, (ok) => resolve(Boolean(ok)));
      }),
    [confirmDialog],
  );
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);
  const [error, setError] = useState("");
  const [modal, setModal] = useState({ open: false, mode: "create", user: null });
  const [saving, setSaving] = useState(false);
  const [modalError, setModalError] = useState("");
  const [passwordModal, setPasswordModal] = useState(null);
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    setUnavailable(false);
    try {
      const data = await fetchPlatformCompanyUsers(companyId, {
        page_size: 200,
      });
      setUsers(asArray(data));
    } catch (err) {
      if (isPlatformAdminUnavailable(err)) {
        setUnavailable(true);
        setUsers([]);
      } else {
        setError(pickPlatformAdminError(err, "Не удалось загрузить пользователей"));
      }
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void load();
    }, 0);
    return () => clearTimeout(timer);
  }, [load]);

  const openCreate = () => {
    setModalError("");
    setModal({ open: true, mode: "create", user: null });
  };

  const openEdit = (user) => {
    setModalError("");
    setModal({ open: true, mode: "edit", user });
  };

  const handleSubmit = async (payload) => {
    setSaving(true);
    setModalError("");
    try {
      if (modal.mode === "create") {
        const created = await createPlatformCompanyUser(companyId, payload);
        setModal({ open: false, mode: "create", user: null });
        if (created?.generated_password) {
          setPasswordModal({
            email: created.email || payload.email,
            password: created.generated_password,
            title: "Пользователь создан",
          });
        }
        await load();
      } else if (modal.user?.id) {
        await patchPlatformUser(modal.user.id, payload);
        setModal({ open: false, mode: "edit", user: null });
        await load();
      }
    } catch (err) {
      setModalError(pickPlatformAdminError(err, "Не удалось сохранить"));
    } finally {
      setSaving(false);
    }
  };

  const handleResetPassword = async (user) => {
    const ok = await askConfirm(
      `Сгенерировать новый пароль для ${user.email}?`,
    );
    if (!ok) return;
    setBusyId(user.id);
    try {
      const data = await resetPlatformUserPassword(user.id);
      setPasswordModal({
        email: user.email,
        password: data?.generated_password || "—",
        title: "Новый пароль",
      });
    } catch (err) {
      setError(pickPlatformAdminError(err, "Не удалось сбросить пароль"));
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (user) => {
    const isOwner = String(user.role || "").toLowerCase() === "owner";
    const ok = await askConfirm(
      isOwner
        ? `Внимание: это владелец компании. Удалить ${user.email}?`
        : `Удалить пользователя ${user.email}?`,
    );
    if (!ok) return;
    setBusyId(user.id);
    try {
      await deletePlatformUser(user.id);
      await load();
    } catch (err) {
      setError(pickPlatformAdminError(err, "Не удалось удалить"));
    } finally {
      setBusyId(null);
    }
  };

  const handleImpersonate = async (user) => {
    const ok = await askConfirm(
      `Войти в CRM как ${user.email}? Ваша сессия админа будет сохранена.`,
    );
    if (!ok) return;
    setBusyId(user.id);
    try {
      const data = await impersonatePlatformUser(user.id);
      const access = data?.access || data?.accessToken;
      const refresh = data?.refresh || data?.refreshToken;
      if (!access) {
        throw new Error("Бэкенд не вернул access-токен");
      }
      startImpersonation({
        access,
        refresh,
        userMeta: {
          userId: user.id,
          email: user.email,
          name: fullName(user),
        },
        returnPath: `/platform-admin/companies/${companyId}`,
      });
    } catch (err) {
      setError(
        pickPlatformAdminError(err, err?.message || "Не удалось войти от имени"),
      );
      setBusyId(null);
    }
  };

  if (unavailable) {
    return (
      <div className="platform-admin__stub platform-admin__stub--inline">
        <p>API пользователей ещё не доступен. См. docs/platform-admin/</p>
      </div>
    );
  }

  return (
    <div className="platform-admin__users">
      <div className="platform-admin__section-head">
        <h3>Пользователи{companyName ? `: ${companyName}` : ""}</h3>
        <button
          type="button"
          className="platform-admin__btn platform-admin__btn--primary"
          onClick={openCreate}
        >
          <FaPlus /> Создать
        </button>
      </div>

      {error && <div className="platform-admin__alert">{error}</div>}

      <div className="platform-admin__table-wrap">
        <table className="platform-admin__table">
          <thead>
            <tr>
              <th>ФИО</th>
              <th>Email</th>
              <th>Роль</th>
              <th>Статус</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5}>Загрузка…</td>
              </tr>
            ) : users.length === 0 ? (
              <tr>
                <td colSpan={5}>Нет пользователей</td>
              </tr>
            ) : (
              users.map((u) => (
                <tr key={u.id}>
                  <td>{fullName(u)}</td>
                  <td>{u.email}</td>
                  <td>{u.role_display || u.role || u.custom_role_name || "—"}</td>
                  <td>
                    {u.is_active === false ? (
                      <span className="platform-admin__badge platform-admin__badge--danger">
                        Неактивен
                      </span>
                    ) : (
                      <span className="platform-admin__badge platform-admin__badge--ok">
                        Активен
                      </span>
                    )}
                  </td>
                  <td className="platform-admin__row-actions">
                    <button
                      type="button"
                      title="Редактировать"
                      className="platform-admin__icon-btn"
                      disabled={busyId === u.id}
                      onClick={() => openEdit(u)}
                    >
                      <FaEdit />
                    </button>
                    <button
                      type="button"
                      title="Сбросить пароль"
                      className="platform-admin__icon-btn"
                      disabled={busyId === u.id}
                      onClick={() => handleResetPassword(u)}
                    >
                      <FaKey />
                    </button>
                    <button
                      type="button"
                      title="Войти от имени"
                      className="platform-admin__icon-btn"
                      disabled={busyId === u.id}
                      onClick={() => handleImpersonate(u)}
                    >
                      <FaUserSecret />
                    </button>
                    <button
                      type="button"
                      title="Удалить"
                      className="platform-admin__icon-btn platform-admin__icon-btn--danger"
                      disabled={busyId === u.id}
                      onClick={() => handleDelete(u)}
                    >
                      <FaTrash />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <UserEditModal
        open={modal.open}
        mode={modal.mode}
        user={modal.user}
        branches={branches}
        customRoles={customRoles}
        saving={saving}
        error={modalError}
        onClose={() => setModal({ open: false, mode: "create", user: null })}
        onSubmit={handleSubmit}
      />

      {passwordModal && (
        <div
          className="platform-admin__overlay"
          onClick={() => setPasswordModal(null)}
        >
          <div
            className="platform-admin__modal platform-admin__modal--sm"
            onClick={(e) => e.stopPropagation()}
          >
            <h3>{passwordModal.title}</h3>
            <p>
              Email: <strong>{passwordModal.email}</strong>
            </p>
            <p>
              Пароль (показывается один раз):{" "}
              <code className="platform-admin__password">
                {passwordModal.password}
              </code>
            </p>
            <button
              type="button"
              className="platform-admin__btn platform-admin__btn--primary"
              onClick={() => setPasswordModal(null)}
            >
              Закрыть
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default CompanyUsersTab;
