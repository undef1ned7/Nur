import React from "react";
import { asDateTime } from "../shared/constants";
import { validateResErrors } from "../../../../../tools/validateResErrors";

const MOVE_TYPE_LABELS = {
  transfer_to_work_entry: "В процесс работ",
  transfer_to_contractor: "Подрядчику",
  write_off: "Списание",
};

export default function StockHistoryTab({
  moves,
  loading,
  error,
  onRefresh,
}) {
  return (
    <div className="building-page__card">
      <div className="building-page__card-header">
        <h3 className="building-page__cardTitle">История движений</h3>
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
        <div className="building-page__muted">Загрузка истории движений...</div>
      )}
      {error && (
        <div className="building-page__error">
          {String(validateResErrors(error, "Не удалось загрузить движения"))}
        </div>
      )}
      {!loading && !error && moves.length === 0 && (
        <div className="building-page__muted">Нет данных по движениям.</div>
      )}
      {!loading && !error && moves.length > 0 && (
        <div className="building-table building-table--shadow">
          <table>
            <thead>
              <tr>
                <th>Товар</th>
                <th>Тип</th>
                <th>Количество</th>
                <th>Цена</th>
                <th>Дата</th>
              </tr>
            </thead>
            <tbody>
              {moves.map((move) => (
                <tr key={move?.id ?? move?.uuid}>
                  <td>
                    {move?.stock_item_name ||
                      move?.stock_item_display ||
                      "Движение"}
                  </td>
                  <td>
                    {MOVE_TYPE_LABELS[move?.move_type] || move?.move_type || "—"}
                  </td>
                  <td>{move?.quantity_delta || move?.quantity || move?.qty || ""}</td>
                  <td>{move?.price || "—"}</td>
                  <td>{asDateTime(move?.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

