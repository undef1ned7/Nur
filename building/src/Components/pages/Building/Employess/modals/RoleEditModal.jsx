import { FaTimes } from "react-icons/fa";

const RoleEditModal = ({
  roleEditOpen,
  roleEditSaving,
  setRoleEditOpen,
  submitRoleEdit,
  roleEditName,
  setRoleEditName,
  roleEditErr,
}) => {
  if (!roleEditOpen) return null;

  return (
    <div
      className="barbermasters__overlay"
      onClick={() => !roleEditSaving && setRoleEditOpen(false)}
    >
      <div
        className="barbermasters__modal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="barbermasters__modalHeader">
          <h3 className="barbermasters__modalTitle">Изменить роль</h3>
          <button
            className="barbermasters__iconBtn"
            onClick={() => !roleEditSaving && setRoleEditOpen(false)}
            aria-label="Закрыть"
          >
            <FaTimes />
          </button>
        </div>

        {!!roleEditErr && (
          <div className="barbermasters__alert barbermasters__alert--inModal">
            {roleEditErr}
          </div>
        )}

        <form
          className="barbermasters__form"
          onSubmit={submitRoleEdit}
          noValidate
        >
          <div className="barbermasters__grid">
            <label className="barbermasters__field barbermasters__field--full">
              <span className="barbermasters__label">
                Название роли <b className="barbermasters__req">*</b>
              </span>
              <input
                className="barbermasters__input"
                placeholder="Название роли"
                value={roleEditName}
                onChange={(e) => setRoleEditName(e.target.value)}
                required
              />
            </label>
          </div>

          <div className="barbermasters__footer">
            <span className="barbermasters__spacer" />
            <div className="barbermasters__footerRight">
              <button
                type="button"
                className="barbermasters__btn barbermasters__btn--secondary"
                onClick={() => setRoleEditOpen(false)}
                disabled={roleEditSaving}
              >
                Отмена
              </button>
              <button
                type="submit"
                className="barbermasters__btn barbermasters__btn--primary"
                disabled={roleEditSaving}
              >
                {roleEditSaving ? "Сохранение…" : "Сохранить изменения"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default RoleEditModal;
