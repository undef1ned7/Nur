/**
 * Массовая передача выбранных лидов сотруднику.
 *
 * Если у сотрудника уже есть своя подворонка (funnel_kind: "employee",
 * owner_user === он) — лиды физически переезжают в неё (POST
 * /leads/{id}/transfer/ с owner в теле, см. backend-main-funnel-inbound.md §5:
 * transfer меняет Lead.funnel и может сразу проставить owner).
 * Если своей подворонки нет — просто переназначаем ответственного
 * (POST /leads/{id}/assign/), лид остаётся в текущей воронке, но становится
 * «его» для руководителя (доска фильтруется по owner).
 *
 * Контракт и обоснование: docs/consulting/backend-money-tenant/22-bulk-lead-transfer.md
 */
import { useEffect, useMemo, useState } from "react";
import { useDispatch } from "react-redux";
import api from "../../../../api";
import {
  assignLead,
  transferLeadToFunnel,
} from "../../../../store/creators/funnelThunk";
import {
  getFunnelDisplayName,
  getFunnelOwnerUserId,
} from "../../../../utils/consultingFunnelDefaults";
import { employeeDisplayName } from "../../../../utils/consultingFunnelLeadUtils";
import { runWithConcurrency } from "./bulkLeadOps";

const asArray = (d) => (Array.isArray(d?.results) ? d.results : Array.isArray(d) ? d : []);

export default function BulkAssignLeadsModal({
  leadIds = [],
  sourceFunnelId,
  funnels = [],
  profile,
  onClose,
  onDone,
}) {
  const dispatch = useDispatch();
  const [employees, setEmployees] = useState([]);
  const [loadingEmployees, setLoadingEmployees] = useState(true);
  const [employeesErr, setEmployeesErr] = useState("");
  const [search, setSearch] = useState("");
  const [targetEmployeeId, setTargetEmployeeId] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [result, setResult] = useState(null); // { ok, fail } после отправки

  useEffect(() => {
    let cancelled = false;
    setLoadingEmployees(true);
    setEmployeesErr("");
    api
      .get("/users/employees/")
      .then((res) => {
        if (cancelled) return;
        const rows = asArray(res.data).filter(
          (e) => String(e.id) !== String(profile?.id),
        );
        setEmployees(rows);
      })
      .catch(() => {
        if (!cancelled) setEmployeesErr("Не удалось загрузить список сотрудников.");
      })
      .finally(() => {
        if (!cancelled) setLoadingEmployees(false);
      });
    return () => {
      cancelled = true;
    };
  }, [profile?.id]);

  // Своя подворонка сотрудника (funnel.owner_user === employee.id), если есть.
  const funnelByOwner = useMemo(() => {
    const map = new Map();
    funnels.forEach((f) => {
      const ownerId = getFunnelOwnerUserId(f);
      if (ownerId) map.set(String(ownerId), f);
    });
    return map;
  }, [funnels]);

  const filteredEmployees = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return employees;
    return employees.filter((e) =>
      employeeDisplayName(e).toLowerCase().includes(q) ||
      String(e.email || "").toLowerCase().includes(q),
    );
  }, [employees, search]);

  const targetEmployee = employees.find(
    (e) => String(e.id) === String(targetEmployeeId),
  );
  const targetFunnel = targetEmployeeId
    ? funnelByOwner.get(String(targetEmployeeId))
    : null;

  const submit = async (e) => {
    e.preventDefault();
    if (!targetEmployeeId || saving) return;
    setSaving(true);
    setErr("");
    setResult(null);

    const movedFunnelIds = new Set();
    if (sourceFunnelId) movedFunnelIds.add(String(sourceFunnelId));

    const results = await runWithConcurrency(leadIds, 4, async (leadId) => {
      if (targetFunnel) {
        return dispatch(
          transferLeadToFunnel({
            id: leadId,
            target_funnel: targetFunnel.id,
            target_stage: null,
            owner: targetEmployeeId,
          }),
        ).unwrap();
      }
      return dispatch(
        assignLead({ id: leadId, owner: targetEmployeeId }),
      ).unwrap();
    });

    if (targetFunnel) movedFunnelIds.add(String(targetFunnel.id));

    const ok = results.filter((r) => r.ok).length;
    const fail = results.length - ok;
    setResult({ ok, fail });
    setSaving(false);

    if (fail === 0) {
      onDone?.({ movedFunnelIds: [...movedFunnelIds] });
      return;
    }
    // Есть ошибки — даём посмотреть на результат, доски всё равно обновим
    // под уже перенесённые лиды, закрытие — по кнопке пользователя.
    onDone?.({ movedFunnelIds: [...movedFunnelIds], keepOpenOnError: true });
  };

  return (
    <div
      className="funnel__overlay"
      role="dialog"
      aria-modal="true"
      onClick={() => !saving && onClose()}
    >
      <div className="funnel__modal" onClick={(e) => e.stopPropagation()}>
        <div className="funnel__modalHead">
          <h3 className="funnel__modalTitle">
            Передать {leadIds.length} {leadIds.length === 1 ? "лид" : "лидов"} сотруднику
          </h3>
          <button
            type="button"
            className="funnel__iconBtn"
            onClick={() => !saving && onClose()}
            aria-label="Закрыть"
          >
            ×
          </button>
        </div>

        {!!err && <div className="funnel__error">{err}</div>}

        {result && (
          <div className={result.fail ? "funnel__error" : "funnel__notice"}>
            Готово: {result.ok} передано{result.fail ? `, ${result.fail} с ошибкой — проверьте права на этих лидов` : ""}.
          </div>
        )}

        {loadingEmployees ? (
          <p className="funnel__hint">Загрузка сотрудников…</p>
        ) : employeesErr ? (
          <p className="funnel__error funnel__error--inline">{employeesErr}</p>
        ) : (
          <form className="funnel__form" onSubmit={submit}>
            <div className="funnel__field">
              <label className="funnel__label">Сотрудник *</label>
              <input
                className="funnel__input"
                placeholder="Поиск по имени или почте…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <select
                className="funnel__input"
                size={Math.min(8, Math.max(4, filteredEmployees.length))}
                value={targetEmployeeId}
                onChange={(e) => setTargetEmployeeId(e.target.value)}
                required
                style={{ marginTop: 6 }}
              >
                {filteredEmployees.map((e) => {
                  const own = funnelByOwner.get(String(e.id));
                  return (
                    <option key={e.id} value={e.id}>
                      {employeeDisplayName(e)}
                      {e.role_display ? ` — ${e.role_display}` : ""}
                      {own ? ` (своя воронка: ${getFunnelDisplayName(own)})` : ""}
                    </option>
                  );
                })}
              </select>
            </div>

            <p className="funnel__hint">
              {targetEmployee
                ? targetFunnel
                  ? `Лиды переедут в воронку «${getFunnelDisplayName(targetFunnel)}» и станут закреплены за ${employeeDisplayName(targetEmployee)}.`
                  : `У ${employeeDisplayName(targetEmployee)} нет своей воронки — лиды останутся в текущей воронке, но будут закреплены за ним/ней (руководитель увидит их как его лиды).`
                : "Выберите сотрудника, которому передать выбранные лиды."}
            </p>

            <div className="funnel__formActions">
              <button
                type="button"
                className="funnel__btn"
                onClick={onClose}
                disabled={saving}
              >
                {result ? "Закрыть" : "Отмена"}
              </button>
              <button
                type="submit"
                className="funnel__btn funnel__btn--primary"
                disabled={saving || !targetEmployeeId}
              >
                {saving ? "Передаём…" : "Передать"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
