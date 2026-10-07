import { Check, X } from "lucide-react";
import {
  PARTNER_OPERATION_STATUS,
  describePartnerOperation,
  fmtDateTime,
  statusMeta,
} from "./partnershipHelpers";

const KIND_LABEL = {
  TRANSFER: "Товар",
  INCASSATION: "Деньги",
};

/**
 * Операции, ожидающие подтверждения партнёра: партнёр хочет забрать товар
 * с вашего склада или деньги из вашей кассы (incoming) и ваши такие запросы
 * к партнёрам (outgoing).
 */
const PartnerOperationsTable = ({
  mode,
  rows,
  loading,
  busyId,
  onApprove,
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
              <th>Тип</th>
              <th>{mode === "incoming" ? "Кто запросил" : "У кого"}</th>
              <th>Что</th>
              <th>Статус</th>
              <th>Комментарий</th>
              <th>Создана</th>
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
                    ? "Нет запросов от партнёров"
                    : "Нет ваших запросов к партнёрам"}
                </td>
              </tr>
            ) : (
              rows.map((op, idx) => {
                const meta = statusMeta(PARTNER_OPERATION_STATUS, op.status);
                const isPending = op.status === "PENDING";
                const busy = busyId === op.id;
                const counterpart =
                  mode === "incoming"
                    ? op.initiator_company_name
                    : op.source_company_name;
                const note = op.status === "FAILED" ? op.error : op.comment;
                return (
                  <tr key={op.id}>
                    <td>{idx + 1}</td>
                    <td>{KIND_LABEL[op.kind] || op.kind || "—"}</td>
                    <td>{counterpart || "—"}</td>
                    <td>{describePartnerOperation(op)}</td>
                    <td>
                      <span className={`warehouse-partnership-badge ${meta.className}`}>
                        {meta.label}
                      </span>
                    </td>
                    <td className="warehouse-partnership-note" title={note || ""}>
                      {note || "—"}
                    </td>
                    <td>{fmtDateTime(op.created_at)}</td>
                    <td>
                      {mode === "incoming" && isPending ? (
                        <div className="warehouse-partnership-row-actions">
                          <button
                            type="button"
                            className="warehouse-partnership-btn warehouse-partnership-btn--approve"
                            onClick={() => onApprove(op)}
                            disabled={busy}
                          >
                            <Check size={16} />
                            Подтвердить
                          </button>
                          <button
                            type="button"
                            className="warehouse-partnership-btn warehouse-partnership-btn--reject"
                            onClick={() => onReject(op)}
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
                          onClick={() => onCancel(op)}
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

export default PartnerOperationsTable;
