import { useState } from "react";
import { FaTimes } from "react-icons/fa";
import AccessList from "../../../../DepartmentDetails/AccessList";
import EmployeeFunnelGrantsEditor from "./EmployeeFunnelGrantsEditor";
import { getEmployeeRoleFunnelId } from "../../../../../utils/consultingFunnelAccess";

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
  funnels = [],
  funnelGrants = [],
  onFunnelGrantsChange,
}) => {
  const [accessTab, setAccessTab] = useState("menu");

  if (!accessModalOpen || !accessModalEmployee) return null;

  const roleFunnelId = getEmployeeRoleFunnelId(accessModalEmployee, funnels);

  return (
    <div
      className="Schoolteachers__modalOverlay"
      role="dialog"
      aria-modal="true"
      onClick={() => !empSaving && setAccessModalOpen(false)}
    >
      <div
        className="Schoolteachers__modal Schoolteachers__modal--access"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="Schoolteachers__modalHeader">
          <h3 className="Schoolteachers__modalTitle">
            Доступы:{" "}
            {accessModalEmployee.first_name && accessModalEmployee.last_name
              ? `${accessModalEmployee.first_name} ${accessModalEmployee.last_name}`
              : accessModalEmployee.email || "Сотрудник"}
          </h3>
          <button
            type="button"
            className="Schoolteachers__iconBtn"
            onClick={() => !empSaving && setAccessModalOpen(false)}
            aria-label="Закрыть"
          >
            <FaTimes />
          </button>
        </div>

        <div className="Schoolteachers__accessTabs">
          <button
            type="button"
            className={`Schoolteachers__accessTab${
              accessTab === "menu" ? " Schoolteachers__accessTab--active" : ""
            }`}
            onClick={() => setAccessTab("menu")}
          >
            Разделы CRM
          </button>
          <button
            type="button"
            className={`Schoolteachers__accessTab${
              accessTab === "funnels" ? " Schoolteachers__accessTab--active" : ""
            }`}
            onClick={() => setAccessTab("funnels")}
          >
            Воронки
          </button>
        </div>

        <div className="Schoolteachers__accessBody">
          {accessTab === "menu" ? (
            <AccessList
              employeeAccesses={accessModalAccesses}
              onSaveAccesses={handleSaveEmployeeAccesses}
              role={accessModalEmployee.role}
              sectorName={company?.sector?.name}
              profile={profile}
              tariff={tariff || company?.subscription_plan?.name}
              company={company}
              isModalMode
            />
          ) : (
            <div className="Schoolteachers__funnelGrantsPanel">
              <EmployeeFunnelGrantsEditor
                funnels={funnels}
                grants={funnelGrants}
                onChange={onFunnelGrantsChange}
                employeeRoleFunnelId={roleFunnelId}
              />
              <div className="Schoolteachers__funnelGrantsActions">
                <button
                  type="button"
                  className="Schoolteachers__btn Schoolteachers__btn--primary"
                  disabled={empSaving}
                  onClick={() => handleSaveEmployeeAccesses({})}
                >
                  {empSaving ? "Сохранение…" : "Сохранить доступы к воронкам"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default EmployeeAccessModal;
