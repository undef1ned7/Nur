import { FaTimes } from "react-icons/fa";

const DeleteEmployeeModal = ({
  empToDelete,
  setEmpToDelete,
  doRemoveEmployee,
  empDeletingIds,
  fullName,
}) => {
  if (!empToDelete) return null;

  return (
    <div
      className="barbermasters__overlay"
      onClick={() => setEmpToDelete(null)}
    >
      <div className="barbermasters__modal" onClick={(e) => e.stopPropagation()}>
        <div className="barbermasters__modalHeader">
          <h3 className="barbermasters__modalTitle">Удалить сотрудника</h3>
          <button
            className="barbermasters__iconBtn"
            onClick={() => setEmpToDelete(null)}
            aria-label="Закрыть"
          >
            <FaTimes />
          </button>
        </div>
        <div className="barbermasters__content">
          Удалить «{fullName(empToDelete) || empToDelete.email || "—"}»?
          Действие необратимо.
        </div>
        <div className="barbermasters__footer">
          <span className="barbermasters__spacer" />
          <div className="barbermasters__footerRight">
            <button
              className="barbermasters__btn barbermasters__btn--secondary"
              onClick={() => setEmpToDelete(null)}
            >
              Отмена
            </button>
            <button
              className="barbermasters__btn barbermasters__btn--danger"
              onClick={doRemoveEmployee}
              disabled={empDeletingIds.has(empToDelete.id)}
            >
              {empDeletingIds.has(empToDelete.id) ? "Удаление…" : "Удалить"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DeleteEmployeeModal;
