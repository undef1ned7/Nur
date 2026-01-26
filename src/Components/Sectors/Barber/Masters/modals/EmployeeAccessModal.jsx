import { FaTimes } from "react-icons/fa";
import AccessList from "../../../../DepartmentDetails/AccessList";

const EmployeeAccessModal = ({
  accessModalOpen,
  setAccessModalOpen,
  accessModalEmployee,
  accessModalAccesses,
  handleSaveEmployeeAccesses,
  profile,
  tariff,
  company,
  empSaving,
}) => {
  if (!accessModalOpen || !accessModalEmployee) return null;

  return (
    <div
      className="barbermasters__overlay"
      onClick={() => !empSaving && setAccessModalOpen(false)}
      style={{ zIndex: 1000 }}
    >
      <div
        className="barbermasters__modal barbermasters__modal--taller"
        onClick={(e) => e.stopPropagation()}
        style={{
          zIndex: 1001,
          maxWidth: "800px",
          width: "90%",
          maxHeight: "90vh",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div
          className="barbermasters__modalHeader"
          style={{
            borderBottom: "1px solid #e0e0e0",
            paddingBottom: "16px",
            marginBottom: "0",
          }}
        >
          <h3
            className="barbermasters__modalTitle"
            style={{ margin: 0, fontSize: "20px", fontWeight: "600" }}
          >
            Управление доступами:{" "}
            {accessModalEmployee.first_name && accessModalEmployee.last_name
              ? `${accessModalEmployee.first_name} ${accessModalEmployee.last_name}`
              : accessModalEmployee.email || "Сотрудник"}
          </h3>
          <button
            className="barbermasters__iconBtn"
            onClick={() => !empSaving && setAccessModalOpen(false)}
            aria-label="Закрыть"
            style={{
              position: "absolute",
              top: "16px",
              right: "16px",
            }}
          >
            <FaTimes />
          </button>
        </div>

        <div
          className="barbermasters__form"
          style={{
            padding: "24px",
            maxHeight: "70vh",
            overflowY: "auto",
          }}
        >
          <AccessList
            employeeAccesses={accessModalAccesses}
            onSaveAccesses={handleSaveEmployeeAccesses}
            role={accessModalEmployee.role}
            sectorName={company?.sector?.name}
            profile={profile}
            tariff={tariff || company?.subscription_plan?.name}
            company={company}
            isModalMode={true}
          />
        </div>
      </div>
    </div>
  );
};

export default EmployeeAccessModal;
