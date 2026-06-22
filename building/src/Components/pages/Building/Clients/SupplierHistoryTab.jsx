import React, { useEffect, useState } from "react";
import api from "../../../../api";
import { validateResErrors } from "../../../../../tools/validateResErrors";
import { asCurrency, asDateTime } from "../shared/constants";
import { useBuildingProjects } from "@/store/slices/building/projectsSlice";

export default function SupplierHistoryTab({ supplierId }) {
  const { selectedProjectId } = useBuildingProjects();

  const [state, setState] = useState({
    loading: false,
    loaded: false,
    error: null,
    items: [],
  });

  useEffect(() => {
    if (!supplierId) return;
    const load = async () => {
      setState((prev) => ({ ...prev, loading: true, error: null }));
      try {
        const { data } = await api.get(
          `/building/suppliers/${supplierId}/purchase-history/`,
          {
            params: {
              residential_complex: selectedProjectId || undefined,
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
  }, [supplierId, selectedProjectId]);

  const { loading, error, items } = state;

  if (!supplierId) return null;

  return (
    <div className="client-detail__section">
      {loading && (
        <div className="sell-loading">
          <div className="sell-loading__spinner" />
          <p className="sell-loading__text">Загрузка истории поставок...</p>
        </div>
      )}
      {error && (
        <div className="building-page__error">
          {String(
            validateResErrors(error, "Не удалось загрузить историю поставок"),
          )}
        </div>
      )}
      {!loading && !error && items.length === 0 && (
        <div className="client-detail__empty">
          История поставок для этого поставщика пока отсутствует.
        </div>
      )}
      {!loading && !error && items.length > 0 && (
        <div className="client-detail__tableWrap">
          <table className="client-detail__table">
            <thead>
              <tr>
                <th>Дата</th>
                <th>Закупка</th>
                <th>ЖК / склад</th>
                <th>Сумма</th>
                <th>Статус</th>
              </tr>
            </thead>
            <tbody>
              {items.map((row) => {
                const id = row.id ?? row.uuid ?? row.procurement_id;
                return (
                  <tr key={id || Math.random()} className="client-detail__tableRow">
                    <td>{asDateTime(row.created_at || row.date)}</td>
                    <td>{row.procurement_number || row.code || row.name || "—"}</td>
                    <td>
                      {row.residential_complex_name ||
                        row.warehouse_name ||
                        "—"}
                    </td>
                    <td>{asCurrency(row.total_amount || row.amount)}</td>
                    <td>{row.status || "—"}</td>
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

