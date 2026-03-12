import React from "react";
import { validateResErrors } from "../../../../../tools/validateResErrors";

export default function StockBalancesTab({
  items,
  loading,
  error,
  onRefresh,
}) {
  return (
    <div className="building-page__card">
      <div className="building-page__card-header">
        <h3 className="building-page__cardTitle">Остатки склада</h3>
        <button
          type="button"
          className="building-btn"
          onClick={onRefresh}
          disabled={loading}
        >
          Обновить
        </button>
      </div>
      {loading && (
        <div className="building-page__muted">Загрузка остатков...</div>
      )}
      {error && (
        <div className="building-page__error">
          {String(validateResErrors(error, "Не удалось загрузить остатки"))}
        </div>
      )}
      {!loading && !error && items.length === 0 && (
        <div className="building-page__muted">Нет данных по остаткам.</div>
      )}
      {!loading && !error && items.length > 0 && (
        <div className="building-table building-table--shadow">
          <table>
            <thead>
              <tr>
                <th>Наименование</th>
                <th>Склад</th>
                <th>Количество</th>
                <th>Ед. изм.</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item?.id ?? item?.uuid}>
                  <td>{item?.name || "Товар"}</td>
                  <td>{item?.warehouse_name || "Склад"}</td>
                  <td>{item?.quantity || item?.qty || "0"}</td>
                  <td>{item?.unit || ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

