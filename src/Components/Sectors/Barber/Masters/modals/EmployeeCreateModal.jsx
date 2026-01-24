import { FaTimes } from "react-icons/fa";

const EmployeeCreateModal = ({
  empCreateOpen,
  empSaving,
  setEmpCreateOpen,
  empAlerts,
  empFieldErrors,
  empForm,
  setEmpForm,
  submitEmployeeCreate,
  company,
  roleOptions,
  showBranchSelect,
  branches,
  RoleSelect,
}) => {
  if (!empCreateOpen) return null;

  return (
    <div
      className="barbermasters__overlay"
      onClick={() => !empSaving && setEmpCreateOpen(false)}
    >
      <div
        className="barbermasters__modal barbermasters__modal--taller"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="barbermasters__modalHeader">
          <h3 className="barbermasters__modalTitle">Новый сотрудник</h3>
          <button
            className="barbermasters__iconBtn"
            onClick={() => !empSaving && setEmpCreateOpen(false)}
            aria-label="Закрыть"
          >
            <FaTimes />
          </button>
        </div>

        {empAlerts.length > 0 && (
          <div className="barbermasters__alert barbermasters__alert--inModal">
            {empAlerts.length === 1 ? (
              empAlerts[0]
            ) : (
              <ul style={{ margin: 0, paddingLeft: 18 }}>
                {empAlerts.map((m, i) => (
                  <li key={i}>{m}</li>
                ))}
              </ul>
            )}
          </div>
        )}

        <form
          className="barbermasters__form"
          onSubmit={submitEmployeeCreate}
          noValidate
        >
          <div className="barbermasters__grid">
            <label
              className={`barbermasters__field ${
                empFieldErrors.email ? "barbermasters__field--invalid" : ""
              }`}
            >
              <span className="barbermasters__label">
                Email <b className="barbermasters__req">*</b>
              </span>
              <input
                name="email"
                type="email"
                className={`barbermasters__input ${
                  empFieldErrors.email ? "barbermasters__input--invalid" : ""
                }`}
                placeholder="user@mail.com"
                value={empForm.email}
                onChange={(e) =>
                  setEmpForm((p) => ({ ...p, email: e.target.value }))
                }
                required
              />
            </label>

            <label
              className={`barbermasters__field ${
                empFieldErrors.first_name ? "barbermasters__field--invalid" : ""
              }`}
            >
              <span className="barbermasters__label">
                Имя <b className="barbermasters__req">*</b>
              </span>
              <input
                name="first_name"
                className={`barbermasters__input ${
                  empFieldErrors.first_name
                    ? "barbermasters__input--invalid"
                    : ""
                }`}
                placeholder="Имя"
                value={empForm.first_name}
                onChange={(e) =>
                  setEmpForm((p) => ({ ...p, first_name: e.target.value }))
                }
                required
              />
            </label>

            <label
              className={`barbermasters__field ${
                empFieldErrors.last_name ? "barbermasters__field--invalid" : ""
              }`}
            >
              <span className="barbermasters__label">
                Фамилия <b className="barbermasters__req">*</b>
              </span>
              <input
                name="last_name"
                className={`barbermasters__input ${
                  empFieldErrors.last_name
                    ? "barbermasters__input--invalid"
                    : ""
                }`}
                placeholder="Фамилия"
                value={empForm.last_name}
                onChange={(e) =>
                  setEmpForm((p) => ({ ...p, last_name: e.target.value }))
                }
                required
              />
            </label>

            {company?.sector?.name === "Пилорама" && (
              <>
                <label
                  className={`barbermasters__field ${
                    empFieldErrors.track_number
                      ? "barbermasters__field--invalid"
                      : ""
                  }`}
                >
                  <span className="barbermasters__label">
                    Номер машины <b className="barbermasters__req">*</b>
                  </span>
                  <input
                    className={`barbermasters__input ${
                      empFieldErrors.track_number
                        ? "barbermasters__input--invalid"
                        : ""
                    }`}
                    placeholder="Номер машины"
                    value={empForm.track_number}
                    onChange={(e) =>
                      setEmpForm((p) => ({
                        ...p,
                        track_number: e.target.value,
                      }))
                    }
                    required
                  />
                </label>
                <label
                  className={`barbermasters__field barbermasters__field--full ${
                    empFieldErrors.phone_number
                      ? "barbermasters__field--invalid"
                      : ""
                  }`}
                >
                  <span className="barbermasters__label">
                    Номер телефона <b className="barbermasters__req">*</b>
                  </span>
                  <input
                    className={`barbermasters__input ${
                      empFieldErrors.phone_number
                        ? "barbermasters__input--invalid"
                        : ""
                    }`}
                    placeholder="Номер телефона"
                    value={empForm.phone_number}
                    onChange={(e) =>
                      setEmpForm((p) => ({
                        ...p,
                        phone_number: e.target.value,
                      }))
                    }
                    required
                  />
                </label>
              </>
            )}

            <div
              className={`barbermasters__field barbermasters__field--full ${
                empFieldErrors.roleChoice ? "barbermasters__field--invalid" : ""
              }`}
            >
              <span className="barbermasters__label">
                Роль <b className="barbermasters__req">*</b>
              </span>
              <RoleSelect
                options={roleOptions}
                value={empForm.roleChoice}
                onChange={(key) =>
                  setEmpForm((p) => ({ ...p, roleChoice: key }))
                }
                placeholder="Выберите роль"
                className="barbermasters__roleSelect"
              />
              <input
                name="roleChoice"
                value={empForm.roleChoice}
                hidden
                readOnly
              />
            </div>

            {showBranchSelect && (
              <div
                className={`barbermasters__field barbermasters__field--full ${
                  empFieldErrors.branch ? "barbermasters__field--invalid" : ""
                }`}
              >
                <span className="barbermasters__label">Филиал</span>
                <RoleSelect
                  options={[
                    { key: "", label: "Не выбран" },
                    ...branches.map((b) => ({
                      key: b.id,
                      label: b.name || "Без названия",
                    })),
                  ]}
                  value={empForm.branch || ""}
                  onChange={(key) =>
                    setEmpForm((p) => ({ ...p, branch: key }))
                  }
                  placeholder="Выберите филиал"
                  className="barbermasters__roleSelect"
                />
              </div>
            )}
          </div>

          <div className="barbermasters__footer">
            <span className="barbermasters__spacer" />
            <div className="barbermasters__footerRight">
              <button
                type="button"
                className="barbermasters__btn barbermasters__btn--secondary"
                onClick={() => setEmpCreateOpen(false)}
                disabled={empSaving}
              >
                Отмена
              </button>
              <button
                type="submit"
                className="barbermasters__btn barbermasters__btn--primary"
                disabled={empSaving}
              >
                {empSaving ? "Сохранение…" : "Создать сотрудника"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EmployeeCreateModal;
