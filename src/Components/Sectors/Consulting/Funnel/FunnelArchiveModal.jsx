import { useEffect, useMemo, useState } from "react";
import { useDispatch } from "react-redux";
import { getArchivedLeads } from "../../../../store/creators/funnelThunk";
import { getFunnelDisplayName } from "../../../../utils/consultingFunnelDefaults";
import {
  filterFunnelsForUser,
  isConsultingFunnelManager,
} from "../../../../utils/consultingFunnelAccess";
import { employeeDisplayName } from "../../../../utils/consultingFunnelLeadUtils";

const fmtMoney = (v) =>
  v == null || v === "" ? "—" : Number(v).toLocaleString() + " с";

function groupLabel(lead, funnels) {
  const fid = lead.funnel || lead.funnel_id;
  const funnel = funnels.find((f) => String(f.id) === String(fid));
  if (funnel) return getFunnelDisplayName(funnel);
  return lead.funnel_name || lead.custom_role_name || "Без воронки";
}

export default function FunnelArchiveModal({
  funnels = [],
  profile,
  onClose,
  onOpenLead,
}) {
  const dispatch = useDispatch();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const isManager = isConsultingFunnelManager(profile);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    dispatch(getArchivedLeads())
      .unwrap()
      .then((data) => {
        if (!cancelled) setRows(data || []);
      })
      .catch(() => {
        if (!cancelled) setErr("Не удалось загрузить архив.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [dispatch]);

  const visibleFunnels = useMemo(
    () => filterFunnelsForUser(funnels, profile),
    [funnels, profile],
  );

  const visibleFunnelIds = useMemo(
    () => new Set(visibleFunnels.map((f) => String(f.id))),
    [visibleFunnels],
  );

  const filtered = useMemo(() => {
    let list = rows || [];
    if (!isManager) {
      list = list.filter((l) =>
        visibleFunnelIds.has(String(l.funnel || l.funnel_id)),
      );
    }
    return list;
  }, [rows, isManager, visibleFunnelIds]);

  const groups = useMemo(() => {
    const map = new Map();
    for (const lead of filtered) {
      const key = groupLabel(lead, funnels);
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(lead);
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0], "ru"));
  }, [filtered, funnels]);

  return (
    <div
      className="funnel__overlay"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="funnel__modal funnel__modal--wide"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="funnel__modalHead">
          <div className="funnel__modalTitle">Архив завершённых лидов</div>
          <button
            type="button"
            className="funnel__iconBtn"
            onClick={onClose}
            aria-label="Закрыть"
          >
            ×
          </button>
        </div>

        <div className="funnel__archiveBody">
          {loading && <div className="funnel__placeholder funnel__placeholder--sm">Загрузка…</div>}
          {!!err && <div className="funnel__error">{err}</div>}

          {!loading && !err && !groups.length && (
            <div className="funnel__placeholder funnel__placeholder--sm">
              Архив пуст.
            </div>
          )}

          {!loading && !err && !!groups.length && (
            <div className="funnel__archive">
              {groups.map(([title, leads]) => (
                <section key={title} className="funnel__archiveGroup">
                  <h4 className="funnel__archiveGroupTitle">{title}</h4>
                  <div className="funnel__archiveTableWrap">
                    <table className="funnel__archiveTable">
                      <thead>
                        <tr>
                          <th>Лид</th>
                          <th>Контакт</th>
                          <th>Сумма</th>
                          <th>Ответственный</th>
                          <th>Дата</th>
                        </tr>
                      </thead>
                      <tbody>
                        {leads.map((lead) => (
                          <tr
                            key={lead.id}
                            className="funnel__archiveRow"
                            onClick={() =>
                              onOpenLead?.(lead.funnel || lead.funnel_id, lead.id)
                            }
                          >
                            <td>{lead.title || "—"}</td>
                            <td>{lead.full_name || lead.phone || "—"}</td>
                            <td>{fmtMoney(lead.estimated_value)}</td>
                            <td>
                              {lead.owner_display ||
                                employeeDisplayName({ name: lead.owner_name }) ||
                                "—"}
                            </td>
                            <td>
                              {lead.archived_at || lead.closed_at || lead.updated_at
                                ? new Date(
                                    lead.archived_at ||
                                      lead.closed_at ||
                                      lead.updated_at,
                                  ).toLocaleDateString()
                                : "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
