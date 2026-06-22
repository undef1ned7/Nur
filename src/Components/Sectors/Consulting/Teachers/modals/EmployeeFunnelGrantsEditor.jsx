import { funnelProtectionLabel, getFunnelDisplayName } from "../../../../../utils/consultingFunnelDefaults";
import {
  isGrantChecked,
  isGrantManageChecked,
  isGrantStagesChecked,
  toggleFunnelGrant,
} from "../../../../../utils/consultingFunnelAccess";

const EmployeeFunnelGrantsEditor = ({
  funnels = [],
  grants = [],
  onChange,
  employeeRoleFunnelId,
}) => {
  const rows = funnels.filter((f) => f.id !== employeeRoleFunnelId);

  if (!rows.length) {
    return (
      <p className="Schoolteachers__funnelGrantsEmpty">
        Нет других воронок для выдачи доступа.
      </p>
    );
  }

  return (
    <div className="Schoolteachers__funnelGrants">
      <p className="Schoolteachers__funnelGrantsLead">
        Дополнительный доступ к воронкам (кроме воронки роли сотрудника).
        Воронка роли назначается автоматически.
      </p>
      <div className="Schoolteachers__funnelGrantsTable">
        <div className="Schoolteachers__funnelGrantsHead">
          <span>Воронка</span>
          <span>Просмотр</span>
          <span>Лиды</span>
          <span>Стадии</span>
        </div>
        {rows.map((f) => {
          const tag = funnelProtectionLabel(f);
          const viewOn = isGrantChecked(grants, f.id);
          const manageOn = isGrantManageChecked(grants, f.id);
          const stagesOn = isGrantStagesChecked(grants, f.id);

          return (
            <div key={f.id} className="Schoolteachers__funnelGrantsRow">
              <span className="Schoolteachers__funnelGrantsName">
                {getFunnelDisplayName(f)}
                {tag && (
                  <span className="Schoolteachers__funnelGrantsTag">{tag}</span>
                )}
              </span>
              <label className="Schoolteachers__funnelGrantsCheck">
                <input
                  type="checkbox"
                  checked={viewOn}
                  onChange={(e) =>
                    onChange(toggleFunnelGrant(grants, f.id, "view", e.target.checked))
                  }
                />
              </label>
              <label className="Schoolteachers__funnelGrantsCheck">
                <input
                  type="checkbox"
                  checked={manageOn}
                  disabled={!viewOn && !manageOn}
                  onChange={(e) =>
                    onChange(
                      toggleFunnelGrant(grants, f.id, "manage", e.target.checked),
                    )
                  }
                />
              </label>
              <label className="Schoolteachers__funnelGrantsCheck">
                <input
                  type="checkbox"
                  checked={stagesOn}
                  disabled={!viewOn && !stagesOn}
                  onChange={(e) =>
                    onChange(
                      toggleFunnelGrant(
                        grants,
                        f.id,
                        "manage_stages",
                        e.target.checked,
                      ),
                    )
                  }
                />
              </label>
            </div>
          );
        })}
      </div>
      <p className="Schoolteachers__funnelGrantsHint">
        Основная воронка и воронки ролей нельзя удалить. «Лиды» — создание и
        перемещение карточек. «Стадии» — добавление и изменение несистемных
        стадий (системные стадии защищены).
      </p>
    </div>
  );
};

export default EmployeeFunnelGrantsEditor;
