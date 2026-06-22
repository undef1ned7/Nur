import { FaTimes } from "react-icons/fa";

const RoleCreateModal = ({
  roleCreateOpen,
  roleCreateSaving,
  setRoleCreateOpen,
  submitRoleCreate,
  roleCreateName,
  setRoleCreateName,
  roleCreateErr,
}) => {
  if (!roleCreateOpen) return null;

  return (
    <div
      className="barbermasters__overlay"
      onClick={() => !roleCreateSaving && setRoleCreateOpen(false)}
    >
      <div
        className="barbermasters__modal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="barbermasters__modalHeader">
          <h3 className="barbermasters__modalTitle">Новая роль</h3>
          <button
            className="barbermasters__iconBtn"
            onClick={() => !roleCreateSaving && setRoleCreateOpen(false)}
            aria-label="Закрыть"
          >
            <FaTimes />
          </button>
        </div>

        <form
          className="barbermasters__form"
          onSubmit={submitRoleCreate}
          noValidate
        >
          <div className="barbermasters__grid">
            <label className="barbermasters__field barbermasters__field--full">
              <span className="barbermasters__label">
                Название роли <b className="barbermasters__req">*</b>
              </span>
              <input
                className="barbermasters__input"
                placeholder="Например: Контент-менеджер"
                value={roleCreateName}
                onChange={(e) => setRoleCreateName(e.target.value)}
                required
              />
            </label>
          </div>

          {!!roleCreateErr && (
            <div className="barbermasters__alert barbermasters__alert--inModal">
              {roleCreateErr}
            </div>
          )}

          <div className="barbermasters__footer">
            <span className="barbermasters__spacer" />
            <div className="barbermasters__footerRight">
              <button
                type="button"
                className="barbermasters__btn barbermasters__btn--secondary"
                onClick={() => setRoleCreateOpen(false)}
                disabled={roleCreateSaving}
              >
                Отмена
              </button>
              <button
                type="submit"
                className="barbermasters__btn barbermasters__btn--primary"
                disabled={roleCreateSaving}
              >
                {roleCreateSaving ? "Сохранение…" : "Создать роль"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default RoleCreateModal;
