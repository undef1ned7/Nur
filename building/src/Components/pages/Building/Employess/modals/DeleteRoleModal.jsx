import { FaTimes } from "react-icons/fa";

const DeleteRoleModal = ({
  roleToDelete,
  setRoleToDelete,
  doRemoveRole,
  roleDeletingIds,
}) => {
  if (!roleToDelete) return null;

  return (
    <div
      className="barbermasters__overlay"
      onClick={() => setRoleToDelete(null)}
    >
      <div className="barbermasters__modal" onClick={(e) => e.stopPropagation()}>
        <div className="barbermasters__modalHeader">
          <h3 className="barbermasters__modalTitle">Удалить роль</h3>
          <button
            className="barbermasters__iconBtn"
            onClick={() => setRoleToDelete(null)}
            aria-label="Закрыть"
          >
            <FaTimes />
          </button>
        </div>
        <div className="barbermasters__content">
          Вы действительно хотите удалить роль «{roleToDelete.name || "—"}»?
          Действие необратимо.
        </div>
        <div className="barbermasters__footer">
          <span className="barbermasters__spacer" />
          <div className="barbermasters__footerRight">
            <button
              className="barbermasters__btn barbermasters__btn--secondary"
              onClick={() => setRoleToDelete(null)}
            >
              Отмена
            </button>
            <button
              className="barbermasters__btn barbermasters__btn--danger"
              onClick={doRemoveRole}
              disabled={roleDeletingIds.has(roleToDelete.id)}
            >
              {roleDeletingIds.has(roleToDelete.id) ? "Удаление…" : "Удалить"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DeleteRoleModal;
