import { Check, X } from "lucide-react";
import {
  PARTNERSHIP_REQUEST_STATUS,
  fmtDateTime,
  statusMeta,
} from "./partnershipHelpers";

/**
 * Входящие / исходящие заявки на партнёрство.
 * Действия только для заявок в статусе PENDING.
 */
const PartnershipRequestsTable = ({
  mode,
  rows,
  loading,
  canDecide,
  busyId,
  onAccept,
  onReject,
  onCancel,
}) => {
  const colSpan = 8;
  return (
    <div className="warehouse-table-container w-full">
      <div className="warehouse-table-scroll warehouse-table-scroll--requests">
        <table className="warehouse-table warehouse-partnership-table">
          <thead>
            <tr>
              <th>№</th>
              <th>От кого</th>
              <th>Кому</th>
              <th>Статус</th>
              <th>Примечание</th>
              <th>Создана</th>
              <th>Решение</th>
              <th>Действия</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={colSpan} className="warehouse-table__loading">
                  Загрузка…
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={colSpan} className="warehouse-table__empty">
                  {mode === "incoming"
                    ? "Нет входящих заявок"
                    : "Нет исходящих заявок"}
                </td>
              </tr>
            ) : (
              rows.map((r, idx) => {
                const meta = statusMeta(PARTNERSHIP_REQUEST_STATUS, r.status);
                const isPending = r.status === "PENDING";
                const busy = busyId === r.id;
                return (
                  <tr key={r.id}>
                    <td>{idx + 1}</td>
                    <td>{r.from_company_name || "—"}</td>
                    <td>{r.to_company_name || "—"}</td>
                    <td>
                      <span className={`warehouse-partnership-badge ${meta.className}`}>
                        {meta.label}
                      </span>
                    </td>
                    <td className="warehouse-partnership-note" title={r.note || ""}>
                      {r.note || "—"}
                    </td>
                    <td>{fmtDateTime(r.created_at)}</td>
                    <td>{fmtDateTime(r.decided_at)}</td>
                    <td>
                      {mode === "incoming" && isPending && canDecide ? (
                        <div className="warehouse-partnership-row-actions">
                          <button
                            type="button"
                            className="warehouse-partnership-btn warehouse-partnership-btn--approve"
                            onClick={() => onAccept(r)}
                            disabled={busy}
                          >
                            <Check size={16} />
                            Принять
                          </button>
                          <button
                            type="button"
                            className="warehouse-partnership-btn warehouse-partnership-btn--reject"
                            onClick={() => onReject(r)}
                            disabled={busy}
                          >
                            <X size={16} />
                            Отклонить
                          </button>
                        </div>
                      ) : mode === "outgoing" && isPending ? (
                        <button
                          type="button"
                          className="warehouse-partnership-btn warehouse-partnership-btn--reject"
                          onClick={() => onCancel(r)}
                          disabled={busy}
                        >
                          Отозвать
                        </button>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default PartnershipRequestsTable;
