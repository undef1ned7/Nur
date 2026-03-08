import React, { useEffect, useState } from "react";
import DataContainer from "@/Components/common/DataContainer/DataContainer";
import { useConfirm } from "@/hooks/useDialog";
import { validateResErrors } from "../../../../../tools/validateResErrors";
import {
  getBuildingAdvanceRequests,
  approveBuildingAdvanceRequest,
  rejectBuildingAdvanceRequest,
} from "@/api/building";

export default function AdvanceRequestsTab({ selectedProjectId }) {
  const confirm = useConfirm();
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [actionId, setActionId] = useState(null);

  const fetchList = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = {};
      if (selectedProjectId) params.residential_complex = selectedProjectId;
      const data = await getBuildingAdvanceRequests(params);
      setList(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(
        validateResErrors(
          err?.response?.data ?? err,
          "Не удалось загрузить заявки на аванс",
        ),
      );
      setList([]);
    } finally {
      setLoading(false);
    }
  }, [selectedProjectId]);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  const handleApprove = (item) => {
    const id = item?.id ?? item?.uuid;
    if (!id) return;
    confirm("Одобрить заявку на аванс? Сумма будет снята с начисления и проведена по кассе.", async (ok) => {
      if (!ok) return;
      setActionId(id);
      try {
        await approveBuildingAdvanceRequest(id, {
          paid_at: new Date().toISOString(),
        });
        await fetchList();
      } catch (err) {
        setError(
          validateResErrors(
            err?.response?.data ?? err,
            "Не удалось одобрить заявку",
          ),
        );
      } finally {
        setActionId(null);
      }
    });
  };

  const handleReject = (item) => {
    const id = item?.id ?? item?.uuid;
    if (!id) return;
    confirm("Отклонить заявку на аванс?", async (ok) => {
      if (!ok) return;
      setActionId(id);
      try {
        await rejectBuildingAdvanceRequest(id);
        await fetchList();
      } catch (err) {
        setError(
          validateResErrors(
            err?.response?.data ?? err,
            "Не удалось отклонить заявку",
          ),
        );
      } finally {
        setActionId(null);
      }
    });
  };

  return (
    <DataContainer>
      <div className="warehouse-table-container w-full">
        {!selectedProjectId ? (
          <div
            className="warehouse-table__empty"
            style={{ padding: 24, textAlign: "center" }}
          >
            Выберите жилой комплекс в шапке раздела, чтобы увидеть заявки на
            аванс.
          </div>
        ) : loading && list.length === 0 ? (
          <div
            className="warehouse-table__loading"
            style={{ padding: 24, textAlign: "center" }}
          >
            Загрузка заявок...
          </div>
        ) : error ? (
          <div className="mt-2 text-sm text-red-500" style={{ padding: 24 }}>
            {String(error)}
          </div>
        ) : list.length === 0 ? (
          <div
            className="warehouse-table__empty"
            style={{ padding: 24, textAlign: "center" }}
          >
            Нет заявок на аванс со статусом «ожидает» по выбранному ЖК.
          </div>
        ) : (
          <table className="warehouse-table w-full">
            <thead>
              <tr>
                <th>Сотрудник</th>
                <th>Сумма</th>
                <th>Период / строка</th>
                <th>Дата</th>
                <th style={{ width: 200 }}>Действия</th>
              </tr>
            </thead>
            <tbody>
              {list.map((item) => {
                const id = item?.id ?? item?.uuid;
                const isBusy = actionId === id;
                return (
                  <tr key={id}>
                    <td>
                      {item?.employee_display ??
                        item?.payroll_line_employee_display ??
                        item?.employee_name ??
                        "—"}
                    </td>
                    <td>{item?.amount ?? "—"}</td>
                    <td>
                      {item?.payroll_title ?? item?.payroll_line_display ?? "—"}
                    </td>
                    <td>
                      {item?.created_at
                        ? new Date(item.created_at).toLocaleString()
                        : "—"}
                    </td>
                    <td>
                      <div
                        style={{
                          display: "flex",
                          gap: 8,
                          flexWrap: "wrap",
                        }}
                      >
                        <button
                          type="button"
                          className="warehouse-view-btn bg-slate-900 text-white border-slate-900"
                          style={{
                            padding: "6px 12px",
                            borderRadius: 6,
                            border: "1px solid",
                            fontSize: 13,
                            fontWeight: 500,
                          }}
                          disabled={isBusy}
                          onClick={() => handleApprove(item)}
                        >
                          Одобрить
                        </button>
                        <button
                          type="button"
                          className="warehouse-view-btn bg-white text-slate-700 border-slate-200"
                          style={{
                            padding: "6px 12px",
                            borderRadius: 6,
                            border: "1px solid",
                            fontSize: 13,
                          }}
                          disabled={isBusy}
                          onClick={() => handleReject(item)}
                        >
                          Отклонить
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </DataContainer>
  );
}
