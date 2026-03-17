import React, { useEffect, useState, useCallback } from "react";
import DataContainer from "@/Components/common/DataContainer/DataContainer";
import { getBuildingCashboxes, getBuildingCashFlows } from "@/api/building";
import { validateResErrors } from "../../../../../tools/validateResErrors";
import { asDateTime } from "../shared/constants";

const FLOW_TYPE_LABELS = { income: "Приход", expense: "Расход" };
const FLOW_STATUS_LABELS = {
  pending: "На согласовании",
  approved: "Проведено",
  rejected: "Отклонено",
};

export default function CashHistoryTab({ selectedProjectId }) {
  const [flows, setFlows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchFlows = useCallback(async () => {
    if (!selectedProjectId) {
      setFlows([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const cashboxes = await getBuildingCashboxes({
        residential_complex: selectedProjectId,
      });
      const list = Array.isArray(cashboxes) ? cashboxes : [];
      const boxIds = list
        .map((b) => b?.id ?? b?.uuid)
        .filter(Boolean);

      if (boxIds.length === 0) {
        setFlows([]);
        setLoading(false);
        return;
      }

      const results = await Promise.all(
        boxIds.map((cashboxId) =>
          getBuildingCashFlows({ cashbox: cashboxId }).then((data) => {
            const items = data?.results ?? (Array.isArray(data) ? data : []);
            const box = list.find(
              (b) => (b?.id ?? b?.uuid) === cashboxId,
            );
            const boxName =
              box?.name ?? box?.title ?? box?.display ?? cashboxId;
            return (Array.isArray(items) ? items : []).map((f) => ({
              ...f,
              _cashbox_name: boxName,
            }));
          }),
        ),
      );

      const merged = results.flat();
      merged.sort((a, b) => {
        const da = a?.created_at ?? a?.paid_at ?? a?.date ?? "";
        const db = b?.created_at ?? b?.paid_at ?? b?.date ?? "";
        return new Date(db) - new Date(da);
      });
      setFlows(merged);
    } catch (err) {
      setError(
        validateResErrors(
          err?.response?.data ?? err,
          "Не удалось загрузить движения по кассе",
        ),
      );
      setFlows([]);
    } finally {
      setLoading(false);
    }
  }, [selectedProjectId]);

  useEffect(() => {
    fetchFlows();
  }, [fetchFlows]);

  return (
    <DataContainer>
      <div className="warehouse-table-container w-full">
        {!selectedProjectId ? (
          <div
            className="warehouse-table__empty"
            style={{ padding: 24, textAlign: "center" }}
          >
            Выберите жилой комплекс в шапке раздела, чтобы увидеть историю
            движений по кассам этого ЖК.
          </div>
        ) : loading && flows.length === 0 ? (
          <div
            className="warehouse-table__loading"
            style={{ padding: 24, textAlign: "center" }}
          >
            Загрузка движений...
          </div>
        ) : error ? (
          <div className="mt-2 text-sm text-red-500" style={{ padding: 24 }}>
            {String(error)}
          </div>
        ) : flows.length === 0 ? (
          <div
            className="warehouse-table__empty"
            style={{ padding: 24, textAlign: "center" }}
          >
            Нет движений по кассам выбранного ЖК.
          </div>
        ) : (
          <>
            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                marginBottom: 12,
              }}
            >
              <button
                type="button"
                className="warehouse-view-btn bg-white text-slate-700 border-slate-200"
                style={{
                  padding: "6px 12px",
                  borderRadius: 6,
                  border: "1px solid",
                  fontSize: 13,
                }}
                onClick={fetchFlows}
                disabled={loading}
              >
                Обновить
              </button>
            </div>
            <table className="warehouse-table w-full">
              <thead>
                <tr>
                  <th>Дата</th>
                  <th>Касса</th>
                  <th>Тип</th>
                  <th>Сумма</th>
                  <th>Статус</th>
                  <th>Описание / источник</th>
                </tr>
              </thead>
              <tbody>
                {flows.map((flow) => {
                  const id = flow?.id ?? flow?.uuid;
                  const typeLabel =
                    FLOW_TYPE_LABELS[flow?.type] ?? flow?.type ?? "—";
                  const statusLabel =
                    FLOW_STATUS_LABELS[flow?.status] ?? flow?.status ?? "—";
                  const amount = flow?.amount ?? flow?.sum ?? "—";
                  const desc =
                    flow?.name ??
                    flow?.title ??
                    flow?.comment ??
                    flow?.description ??
                    flow?.source_display ??
                    "—";
                  return (
                    <tr key={id}>
                      <td>
                        {asDateTime(
                          flow?.created_at ??
                            flow?.paid_at ??
                            flow?.date,
                        )}
                      </td>
                      <td>{flow?._cashbox_name ?? flow?.cashbox_display ?? "—"}</td>
                      <td>{typeLabel}</td>
                      <td
                        style={{
                          fontWeight: 500,
                          color:
                            flow?.type === "expense"
                              ? "var(--danger, #b91c1c)"
                              : undefined,
                        }}
                      >
                        {flow?.type === "expense" && amount !== "—" ? `−${amount}` : amount}
                      </td>
                      <td>{statusLabel}</td>
                      <td>{desc}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </>
        )}
      </div>
    </DataContainer>
  );
}
