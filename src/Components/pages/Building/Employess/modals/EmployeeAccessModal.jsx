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
  residentialComplexes = [],
  residentialComplexIds = [],
  onResidentialComplexIdsChange,
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
          {residentialComplexes?.length > 0 && typeof onResidentialComplexIdsChange === "function" && (
            <div style={{ marginBottom: "24px" }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: "12px",
                  paddingBottom: "8px",
                  borderBottom: "2px solid #e0e0e0",
                }}
              >
                <h4
                  style={{
                    margin: 0,
                    fontSize: "16px",
                    fontWeight: "600",
                    color: "#333",
                  }}
                >
                 Доступы к ЖК
                </h4>
                <div style={{ display: "flex", gap: "8px" }}>
                  <button
                    type="button"
                    onClick={() => onResidentialComplexIdsChange(residentialComplexes.map((rc) => rc?.id ?? rc?.uuid).filter(Boolean))}
                    style={{
                      padding: "4px 8px",
                      fontSize: "12px",
                      border: "1px solid #ddd",
                      borderRadius: "4px",
                      background: "white",
                      cursor: "pointer",
                    }}
                  >
                    Выбрать все
                  </button>
                  <button
                    type="button"
                    onClick={() => onResidentialComplexIdsChange([])}
                    style={{
                      padding: "4px 8px",
                      fontSize: "12px",
                      border: "1px solid #ddd",
                      borderRadius: "4px",
                      background: "white",
                      cursor: "pointer",
                    }}
                  >
                    Снять все
                  </button>
                </div>
              </div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "8px",
                  padding: "12px",
                  background: "#f9f9f9",
                  borderRadius: "6px",
                }}
              >
                {residentialComplexes.map((rc) => {
                  const rcId = rc?.id ?? rc?.uuid;
                  const label = rc?.name || "Без названия";
                  const checked = (residentialComplexIds || []).includes(rcId);
                  return (
                    <label
                      key={rcId}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        padding: "8px 12px",
                        cursor: "pointer",
                        borderRadius: "4px",
                        background: checked ? "#e3f2fd" : "white",
                        border: `1px solid ${checked ? "#2196f3" : "#ddd"}`,
                        transition: "all 0.2s",
                      }}
                      onMouseEnter={(e) => {
                        if (!checked) e.currentTarget.style.background = "#f5f5f5";
                      }}
                      onMouseLeave={(e) => {
                        if (!checked) e.currentTarget.style.background = "white";
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={!!checked}
                        onChange={() => {
                          const ids = Array.isArray(residentialComplexIds) ? residentialComplexIds : [];
                          const next = checked
                            ? ids.filter((id) => id !== rcId)
                            : [...ids, rcId];
                          onResidentialComplexIdsChange(next);
                        }}
                        style={{
                          width: "18px",
                          height: "18px",
                          cursor: "pointer",
                        }}
                      />
                      <span
                        style={{
                          fontSize: "14px",
                          color: "#333",
                          userSelect: "none",
                        }}
                      >
                        {label}
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
          )}
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
