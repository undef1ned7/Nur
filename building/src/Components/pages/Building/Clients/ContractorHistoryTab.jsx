import React, { useEffect, useState } from "react";
import api from "../../../../api";
import { validateResErrors } from "../../../../../tools/validateResErrors";
import { asDateTime } from "../shared/constants";
import { useBuildingProjects } from "@/store/slices/building/projectsSlice";

const WORK_STATUS_LABELS = {
  planned: "Запланировано",
  in_progress: "В работе",
  paused: "Приостановлено",
  completed: "Завершено",
  cancelled: "Отменено",
};

const CATEGORY_LABELS = {
  note: "Заметка",
  treaty: "По договору",
  defect: "Дефект",
  report: "Отчёт",
  other: "Другое",
};

export default function ContractorHistoryTab({ contractorId }) {
  const { selectedProjectId } = useBuildingProjects();

  const [state, setState] = useState({
    loading: false,
    loaded: false,
    error: null,
    items: [],
  });

  const [statusFilter, setStatusFilter] = useState("");

  useEffect(() => {
    if (!contractorId) return;
    const load = async () => {
      setState((prev) => ({ ...prev, loading: true, error: null }));
      try {
        const { data } = await api.get(
          `/building/contractors/${contractorId}/work-history/`,
          {
            params: {
              residential_complex: selectedProjectId || undefined,
              work_status: statusFilter || undefined,
            },
          },
        );
        const items = Array.isArray(data?.results)
          ? data.results
          : Array.isArray(data)
          ? data
          : [];
        setState({
          loading: false,
          loaded: true,
          error: null,
          items,
        });
      } catch (err) {
        setState({
          loading: false,
          loaded: false,
          error: err,
          items: [],
        });
      }
    };

    load();
  }, [contractorId, selectedProjectId, statusFilter]);

  const { loading, error, items } = state;

  if (!contractorId) return null;

  return (
    <div className="client-detail__section">
      <div
        className="client-detail__row"
        style={{
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 12,
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <h4 className="sell-form__sectionTitle" style={{ margin: 0 }}>
          История процессов работ
        </h4>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <span className="sell-form__label">Статус:</span>
          <select
            className="warehouse-filter-modal__select-small"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="">Все</option>
            {Object.entries(WORK_STATUS_LABELS).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {loading && (
        <div className="sell-loading">
          <div className="sell-loading__spinner" />
          <p className="sell-loading__text">
            Загрузка истории работ подрядчика...
          </p>
        </div>
      )}
      {error && (
        <div className="building-page__error">
          {String(
            validateResErrors(
              error,
              "Не удалось загрузить историю работ подрядчика",
            ),
          )}
        </div>
      )}
      {!loading && !error && items.length === 0 && (
        <div className="client-detail__empty">
          История работ для этого подрядчика пока отсутствует.
        </div>
      )}
      {!loading && !error && items.length > 0 && (
        <div className="client-detail__tableWrap">
          <table className="client-detail__table">
            <thead>
              <tr>
                <th>Дата</th>
                <th>ЖК</th>
                <th>Категория</th>
                <th>Статус</th>
                <th>Название</th>
                <th>Клиент / договор</th>
              </tr>
            </thead>
            <tbody>
              {items.map((row) => {
                const id = row.id ?? row.uuid;
                return (
                  <tr key={id || Math.random()}>
                    <td>{asDateTime(row.occurred_at || row.created_at)}</td>
                    <td>{row.residential_complex_name || "—"}</td>
                    <td>
                      {CATEGORY_LABELS[row.category] ||
                        row.category ||
                        "—"}
                    </td>
                    <td>
                      {WORK_STATUS_LABELS[row.work_status] ||
                        row.work_status ||
                        "—"}
                    </td>
                    <td>{row.title || "—"}</td>
                    <td>
                      {row.client_name || "—"}
                      {row.treaty_number
                        ? `, договор ${row.treaty_number}`
                        : ""}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

