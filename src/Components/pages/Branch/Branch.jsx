import React, { useEffect, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import {
  FaSearch,
  FaPlus,
  FaTimes,
  FaBuilding,
  FaMapMarkerAlt,
  FaPhone,
  FaEdit,
  FaTrash,
  FaEnvelope,
  FaClock,
  FaCheckCircle,
  FaTimesCircle,
  FaEye,
  FaCalendarAlt,
} from "react-icons/fa";
import {
  fetchBranchesAsync,
  createBranchAsync,
  updateBranchAsync,
  deleteBranchAsync,
  toggleBranchActiveAsync,
} from "../../../store/creators/branchCreators";
import { clearErrors } from "../../../store/slices/branchSlice";
import AlertModal from "../../common/AlertModal/AlertModal";
import "./Branch.scss";
import { validateResErrors } from "../../../../tools/validateResErrors";
import { useConfirm } from "@/hooks/useDialog";

// Список популярных часовых поясов
const TIMEZONES = [
  { value: "Asia/Bishkek", label: "Азия/Бишкек (UTC+6)" },
  { value: "Asia/Almaty", label: "Азия/Алматы (UTC+6)" },
  { value: "Asia/Tashkent", label: "Азия/Ташкент (UTC+5)" },
  { value: "Europe/Moscow", label: "Европа/Москва (UTC+3)" },
  { value: "Asia/Dubai", label: "Азия/Дубай (UTC+4)" },
  { value: "UTC", label: "UTC (UTC+0)" },
];

const Branch = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const {
    list: branches,
    loading,
    error,
    creating,
    updating,
    deleting,
    toggling,
    createError,
    updateError,
    deleteError,
    toggleError,
  } = useSelector((state) => state.branches);

  const confirm = useConfirm();

  // Поиск
  const [query, setQuery] = useState("");

  // Модалка формы
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formError, setFormError] = useState("");

  // Модалка детального просмотра
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [selectedBranch, setSelectedBranch] = useState(null);
  const [form, setForm] = useState({
    name: "",
    code: "",
    address: "",
    phone: "",
    email: "",
    timezone: "Asia/Bishkek",
    is_active: true,
  });

  // AlertModal состояние
  const [alertModal, setAlertModal] = useState({
    open: false,
    type: "success",
    title: "",
    message: "",
  });

  // Предыдущие состояния для отслеживания изменений
  const [prevCreating, setPrevCreating] = useState(false);
  const [prevUpdating, setPrevUpdating] = useState(false);
  const [prevDeleting, setPrevDeleting] = useState(false);
  const [prevToggling, setPrevToggling] = useState(false);
  const [prevCreateError, setPrevCreateError] = useState(null);
  const [prevUpdateError, setPrevUpdateError] = useState(null);
  const [prevDeleteError, setPrevDeleteError] = useState(null);
  const [prevToggleError, setPrevToggleError] = useState(null);

  // Загрузка филиалов
  useEffect(() => {
    dispatch(fetchBranchesAsync());
  }, [dispatch]);

  // Отслеживание успешного создания
  useEffect(() => {
    if (prevCreating && !creating && !createError) {
      setAlertModal({
        open: true,
        type: "success",
        title: "Успешно",
        message: "Филиал успешно создан",
      });
      // Закрываем форму после успешного создания
      setModalOpen(false);
      setForm({
        name: "",
        code: "",
        address: "",
        phone: "",
        email: "",
        timezone: "Asia/Bishkek",
        is_active: true,
      });
      setFormError("");
      dispatch(clearErrors());
    }
    setPrevCreating(creating);
  }, [creating, createError, prevCreating, dispatch]);

  // Отслеживание успешного обновления
  useEffect(() => {
    if (prevUpdating && !updating && !updateError) {
      setAlertModal({
        open: true,
        type: "success",
        title: "Успешно",
        message: "Филиал успешно обновлен",
      });
      // Закрываем форму после успешного обновления
      setModalOpen(false);
      setForm({
        name: "",
        code: "",
        address: "",
        phone: "",
        email: "",
        timezone: "Asia/Bishkek",
        is_active: true,
      });
      setFormError("");
      dispatch(clearErrors());
    }
    setPrevUpdating(updating);
  }, [updating, updateError, prevUpdating, dispatch]);

  // Отслеживание успешного удаления
  useEffect(() => {
    if (prevDeleting && !deleting && !deleteError) {
      setAlertModal({
        open: true,
        type: "success",
        title: "Успешно",
        message: "Филиал успешно удален",
      });
    }
    setPrevDeleting(deleting);
  }, [deleting, deleteError, prevDeleting]);

  // Отслеживание успешного переключения статуса
  useEffect(() => {
    if (prevToggling && !toggling && !toggleError) {
      setAlertModal({
        open: true,
        type: "success",
        title: "Успешно",
        message: "Статус филиала успешно изменен",
      });
    }
    setPrevToggling(toggling);
  }, [toggling, toggleError, prevToggling]);

  // Отслеживание ошибок создания
  useEffect(() => {
    if (createError && createError !== prevCreateError) {
      const errorMessage = validateResErrors(createError, "Ошибка при создании филиала. ")
      setAlertModal({
        open: true,
        type: "error",
        title: "Ошибка",
        message: errorMessage,
      });
    }
    setPrevCreateError(createError);
  }, [createError, prevCreateError]);

  // Отслеживание ошибок обновления
  useEffect(() => {
    if (updateError && updateError !== prevUpdateError) {
      const errorMessage = validateResErrors(updateError, "Ошибка при обновлении филиала. ")
      setAlertModal({
        open: true,
        type: "error",
        title: "Ошибка",
        message: errorMessage,
      });
    }
    setPrevUpdateError(updateError);
  }, [updateError, prevUpdateError]);

  // Отслеживание ошибок удаления
  useEffect(() => {
    if (deleteError && deleteError !== prevDeleteError) {
      const errorMessage = validateResErrors(deleteError, "Ошибка при удалении филиала. ")
      setAlertModal({
        open: true,
        type: "error",
        title: "Ошибка",
        message: errorMessage,
      });
    }
    setPrevDeleteError(deleteError);
  }, [deleteError, prevDeleteError]);

  // Отслеживание ошибок переключения статуса
  useEffect(() => {
    if (toggleError && toggleError !== prevToggleError) {
      const errorMessage = validateResErrors(toggleError, "Ошибка при изменении статуса филиала. ")
      setAlertModal({
        open: true,
        type: "error",
        title: "Ошибка",
        message: errorMessage,
      });
    }
    setPrevToggleError(toggleError);
  }, [toggleError, prevToggleError]);

  // Поиск
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return branches;
    return branches.filter((b) => {
      const name = (b.name || "").toLowerCase();
      const code = (b.code || "").toLowerCase();
      const address = (b.address || "").toLowerCase();
      const phone = (b.phone || "").toLowerCase();
      const email = (b.email || "").toLowerCase();
      return (
        name.includes(q) ||
        code.includes(q) ||
        address.includes(q) ||
        phone.includes(q) ||
        email.includes(q)
      );
    });
  }, [branches, query]);

  // CRUD операции
  const openCreate = () => {
    // Проверка на максимальное количество филиалов
    if (branches.length >= 3) {
      setAlertModal({
        open: true,
        type: "error",
        title: "Ошибка",
        message: "Можно создать максимум 3 филиала",
      });
      return;
    }
    setEditingId(null);
    setForm({
      name: "",
      code: "",
      address: "",
      phone: "",
      email: "",
      timezone: "Asia/Bishkek",
      is_active: true,
    });
    setModalOpen(true);
  };

  const openDetail = (branch) => {
    setSelectedBranch(branch);
    setDetailModalOpen(true);
  };

  const openEdit = (branch) => {
    setEditingId(branch.id);
    setForm({
      name: branch.name || "",
      code: branch.code || "",
      address: branch.address || "",
      phone: branch.phone || "",
      email: branch.email || "",
      timezone: branch.timezone || "Asia/Bishkek",
      is_active: branch.is_active !== undefined ? branch.is_active : true,
    });
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setForm({
      name: "",
      code: "",
      address: "",
      phone: "",
      email: "",
      timezone: "Asia/Bishkek",
      is_active: true,
    });
    setFormError("");
    dispatch(clearErrors());
  };

  const saveBranch = async (e) => {
    e.preventDefault();
    if (creating || updating) return;

    // Валидация code (slug pattern)
    const codeValue = (form.code || "").trim();
    if (codeValue && !/^[-a-zA-Z0-9_]+$/.test(codeValue)) {
      setFormError(
        "Код филиала может содержать только латинские буквы, цифры, дефисы и подчеркивания"
      );
      return;
    }

    const payload = {
      name: (form.name || "").trim(),
      code: codeValue || null,
      address: (form.address || "").trim() || null,
      phone: (form.phone || "").trim() || null,
      email: (form.email || "").trim() || null,
      timezone: (form.timezone || "").trim(),
      is_active: form.is_active,
    };

    if (!payload.name || payload.name.length < 1) {
      setFormError("Название филиала обязательно (минимум 1 символ)");
      return;
    }

    if (payload.name.length > 128) {
      setFormError("Название филиала не должно превышать 128 символов");
      return;
    }

    if (!payload.timezone || payload.timezone.length < 1) {
      setFormError("Часовой пояс обязателен");
      return;
    }

    setFormError("");
    dispatch(clearErrors());

    try {
      if (editingId == null) {
        // Создание
        await dispatch(createBranchAsync(payload));
        // AlertModal и закрытие формы произойдут автоматически через useEffect
      } else {
        // Обновление
        await dispatch(
          updateBranchAsync({ branchId: editingId, updatedData: payload })
        );
        // AlertModal и закрытие формы произойдут автоматически через useEffect
      }
    } catch (err) {
      console.error("Ошибка сохранения филиала:", err);
      const errorMessage = validateResErrors(err, "Ошибка при сохранении филиала. ")
      setFormError(errorMessage);
    }
  };

  const toggleActive = async (branch) => {
    try {
      await dispatch(
        toggleBranchActiveAsync({
          branchId: branch.id,
          isActive: !branch.is_active,
        })
      );
    } catch (err) {
      console.error("Ошибка изменения статуса филиала:", err);
      const errorMessage = validateResErrors(err, "Ошибка при изменении статуса филиала. ")
      setAlertModal({
        open: true,
        type: "error",
        title: "Ошибка",
        message: errorMessage,
      });
    }
  };

  const handleDelete = async (id) => {
    confirm(
      "Вы уверены, что хотите удалить этот филиал?",
      async (ok) => {
        if (ok) {
          try {
            await dispatch(deleteBranchAsync(id));
          } catch (err) {
            console.error("Ошибка удаления филиала:", err);
            const errorMessage = validateResErrors(err, "Ошибка при удалении филиала. ")
            setAlertModal({
              open: true,
              type: "error",
              title: "Ошибка",
              message: errorMessage,
            });
          }
        }
      }
    )
  };

  return (
    <section className="branch">
      <div className="branch__header">
        <div>
          <h2 className="branch__title">Филиалы</h2>
          <div className="branch__subtitle">Управление филиалами компании</div>
        </div>

        <div className="branch__actions">
          <div className="branch__search">
            <FaSearch className="branch__search-icon" />
            <input
              className="branch__search-input"
              placeholder="Поиск: название, адрес, телефон, email…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>

          <button
            className="branch__btn branch__btn--primary"
            onClick={openCreate}
          >
            <FaPlus /> Новый филиал
          </button>
        </div>
      </div>

      {error && !loading && (
        <div className="branch__alert branch__alert--error">
          {error?.detail || error?.message || String(error)}
        </div>
      )}

      <div className="branch__list">
        {loading && (
          <div className="branch__alert branch__alert--info">Загрузка…</div>
        )}

        {!loading &&
          filtered.map((branch) => (
            <article key={branch.id} className="branch__card">
              <div className="branch__card-left">
                <div className="branch__avatar">
                  <FaBuilding />
                </div>
                <div className="branch__content">
                  <div className="branch__name-row">
                    <h3 className="branch__name">
                      {branch.name || "Без названия"}
                    </h3>
                    <span
                      className={`branch__status branch__status--${branch.is_active ? "active" : "inactive"
                        }`}
                    >
                      {branch.is_active ? (
                        <>
                          <FaCheckCircle /> Активен
                        </>
                      ) : (
                        <>
                          <FaTimesCircle /> Неактивен
                        </>
                      )}
                    </span>
                  </div>
                  <div className="branch__meta">
                    {branch.address && (
                      <span className="branch__muted">
                        <FaMapMarkerAlt />
                        &nbsp;{branch.address}
                      </span>
                    )}
                    {branch.phone && (
                      <span className="branch__muted">
                        <FaPhone />
                        &nbsp;{branch.phone}
                      </span>
                    )}
                    {branch.email && (
                      <span className="branch__muted">
                        <FaEnvelope />
                        &nbsp;{branch.email}
                      </span>
                    )}
                    {branch.timezone && (
                      <span className="branch__muted">
                        <FaClock />
                        &nbsp;{branch.timezone}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="branch__rowActions">
                <button
                  className="branch__btn branch__btn--secondary"
                  onClick={() => navigate(`/crm/branch/${branch.id}`)}
                  title="Просмотр деталей"
                >
                  <FaEye /> Просмотр
                </button>
                <button
                  className={`branch__btn branch__btn--${branch.is_active ? "warning" : "success"
                    }`}
                  onClick={() => toggleActive(branch)}
                  title={branch.is_active ? "Деактивировать" : "Активировать"}
                >
                  {branch.is_active ? (
                    <>
                      <FaTimesCircle /> Деактивировать
                    </>
                  ) : (
                    <>
                      <FaCheckCircle /> Активировать
                    </>
                  )}
                </button>
                <button
                  className="branch__btn branch__btn--secondary"
                  onClick={() => openEdit(branch)}
                >
                  <FaEdit /> Изменить
                </button>
                <button
                  className="branch__btn branch__btn--danger"
                  onClick={() => handleDelete(branch.id)}
                >
                  <FaTrash /> Удалить
                </button>
              </div>
            </article>
          ))}

        {!loading && !filtered.length && branches.length === 0 && (
          <div className="branch__alert branch__alert--info">
            Филиалы не найдены. Создайте первый филиал.
          </div>
        )}

        {!loading && !filtered.length && branches.length > 0 && (
          <div className="branch__alert branch__alert--info">
            Ничего не найдено по запросу «{query}».
          </div>
        )}
      </div>

      {/* Модалка: создать/редактировать */}
      {modalOpen && (
        <div className="branch__modal-overlay" onClick={closeModal}>
          <div className="branch__modal" onClick={(e) => e.stopPropagation()}>
            <div className="branch__modal-header">
              <h3 className="branch__modal-title">
                {editingId == null ? "Новый филиал" : "Изменить филиал"}
              </h3>
              <button
                className="branch__icon-btn"
                onClick={closeModal}
                disabled={creating || updating}
              >
                <FaTimes />
              </button>
            </div>

            <form className="branch__form" onSubmit={saveBranch}>
              {(formError || createError || updateError) && (
                <div className="branch__alert branch__alert--error">
                  {formError ||
                    createError?.detail ||
                    createError?.message ||
                    updateError?.detail ||
                    updateError?.message ||
                    String(createError || updateError || "")}
                </div>
              )}

              <div className="branch__form-grid">
                <div className="branch__field branch__field--full">
                  <label className="branch__label">
                    Название филиала <span className="branch__required">*</span>
                  </label>
                  <input
                    className="branch__input"
                    value={form.name}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, name: e.target.value }))
                    }
                    required
                    minLength={1}
                    maxLength={128}
                    placeholder="Например: Филиал на ул. Ленина"
                  />
                </div>

                <div className="branch__field">
                  <label className="branch__label">Код филиала (slug)</label>
                  <input
                    className="branch__input"
                    value={form.code}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, code: e.target.value }))
                    }
                    maxLength={64}
                    pattern="^[-a-zA-Z0-9_]+$"
                    placeholder="spb, moscow, online"
                  />
                  <small className="branch__hint">
                    Только латинские буквы, цифры, дефисы и подчеркивания
                  </small>
                </div>

                <div className="branch__field">
                  <label className="branch__label">
                    Часовой пояс <span className="branch__required">*</span>
                  </label>
                  <select
                    className="branch__input branch__select"
                    value={form.timezone}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, timezone: e.target.value }))
                    }
                    required
                  >
                    {TIMEZONES.map((tz) => (
                      <option key={tz.value} value={tz.value}>
                        {tz.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="branch__field branch__field--full">
                  <label className="branch__label">Адрес</label>
                  <input
                    className="branch__input"
                    value={form.address}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, address: e.target.value }))
                    }
                    maxLength={255}
                    placeholder="Полный адрес филиала"
                  />
                </div>

                <div className="branch__field">
                  <label className="branch__label">Телефон</label>
                  <input
                    className="branch__input"
                    type="tel"
                    value={form.phone}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, phone: e.target.value }))
                    }
                    maxLength={32}
                    placeholder="+996 XXX XXX XXX"
                  />
                </div>

                <div className="branch__field">
                  <label className="branch__label">Email</label>
                  <input
                    className="branch__input"
                    type="email"
                    value={form.email}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, email: e.target.value }))
                    }
                    maxLength={254}
                    placeholder="branch@example.com"
                  />
                </div>

                <div className="branch__field branch__field--full">
                  <label className="branch__label branch__label--checkbox">
                    <input
                      type="checkbox"
                      checked={form.is_active}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, is_active: e.target.checked }))
                      }
                      className="branch__checkbox"
                    />
                    <span>Филиал активен</span>
                  </label>
                </div>
              </div>

              <div className="branch__form-actions">
                <button
                  type="button"
                  className="branch__btn branch__btn--secondary"
                  onClick={closeModal}
                  disabled={creating || updating}
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  className="branch__btn branch__btn--primary"
                  disabled={creating || updating}
                >
                  {creating || updating
                    ? "Сохранение…"
                    : editingId == null
                      ? "Создать"
                      : "Сохранить"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Модалка детального просмотра */}
      {detailModalOpen && selectedBranch && (
        <div
          className="branch__modal-overlay"
          onClick={() => setDetailModalOpen(false)}
        >
          <div
            className="branch__modal branch__modal--detail"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="branch__modal-header">
              <h3 className="branch__modal-title">Детали филиала</h3>
              <button
                className="branch__icon-btn"
                onClick={() => setDetailModalOpen(false)}
              >
                <FaTimes />
              </button>
            </div>

            <div className="branch__detail-content">
              <div className="branch__detail-section">
                <div className="branch__detail-item">
                  <span className="branch__detail-label">Название:</span>
                  <span className="branch__detail-value">
                    {selectedBranch.name || "—"}
                  </span>
                </div>

                <div className="branch__detail-item">
                  <span className="branch__detail-label">Статус:</span>
                  <span
                    className={`branch__status branch__status--${selectedBranch.is_active ? "active" : "inactive"
                      }`}
                  >
                    {selectedBranch.is_active ? (
                      <>
                        <FaCheckCircle /> Активен
                      </>
                    ) : (
                      <>
                        <FaTimesCircle /> Неактивен
                      </>
                    )}
                  </span>
                </div>

                {selectedBranch.address && (
                  <div className="branch__detail-item">
                    <span className="branch__detail-label">
                      <FaMapMarkerAlt /> Адрес:
                    </span>
                    <span className="branch__detail-value">
                      {selectedBranch.address}
                    </span>
                  </div>
                )}

                {selectedBranch.phone && (
                  <div className="branch__detail-item">
                    <span className="branch__detail-label">
                      <FaPhone /> Телефон:
                    </span>
                    <span className="branch__detail-value">
                      {selectedBranch.phone}
                    </span>
                  </div>
                )}

                {selectedBranch.email && (
                  <div className="branch__detail-item">
                    <span className="branch__detail-label">
                      <FaEnvelope /> Email:
                    </span>
                    <span className="branch__detail-value">
                      {selectedBranch.email}
                    </span>
                  </div>
                )}

                {selectedBranch.timezone && (
                  <div className="branch__detail-item">
                    <span className="branch__detail-label">
                      <FaClock /> Часовой пояс:
                    </span>
                    <span className="branch__detail-value">
                      {selectedBranch.timezone}
                    </span>
                  </div>
                )}

                {selectedBranch.created_at && (
                  <div className="branch__detail-item">
                    <span className="branch__detail-label">
                      <FaCalendarAlt /> Дата создания:
                    </span>
                    <span className="branch__detail-value">
                      {new Date(selectedBranch.created_at).toLocaleString(
                        "ru-RU",
                        {
                          year: "numeric",
                          month: "long",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        }
                      )}
                    </span>
                  </div>
                )}

                {selectedBranch.updated_at && (
                  <div className="branch__detail-item">
                    <span className="branch__detail-label">
                      <FaCalendarAlt /> Дата обновления:
                    </span>
                    <span className="branch__detail-value">
                      {new Date(selectedBranch.updated_at).toLocaleString(
                        "ru-RU",
                        {
                          year: "numeric",
                          month: "long",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        }
                      )}
                    </span>
                  </div>
                )}
              </div>
            </div>

            <div className="branch__form-actions">
              <button
                type="button"
                className="branch__btn branch__btn--secondary"
                onClick={() => setDetailModalOpen(false)}
              >
                Закрыть
              </button>
              <button
                type="button"
                className="branch__btn branch__btn--primary"
                onClick={() => {
                  setDetailModalOpen(false);
                  openEdit(selectedBranch);
                }}
              >
                <FaEdit /> Редактировать
              </button>
            </div>
          </div>
        </div>
      )}

      {/* AlertModal для уведомлений */}
      <AlertModal
        open={alertModal.open}
        type={alertModal.type}
        title={alertModal.title}
        message={alertModal.message}
        onClose={() => setAlertModal({ ...alertModal, open: false })}
      />
    </section>
  );
};

export default Branch;
