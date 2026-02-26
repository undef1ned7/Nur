import React, { useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useDispatch } from "react-redux";
import { useAlert } from "@/hooks/useDialog";
import { validateResErrors } from "../../../../../tools/validateResErrors";
import { fetchBuildingWarehouseTransferById } from "@/store/creators/building/transfersCreators";
import { fetchBuildingWarehouseStockMoves } from "@/store/creators/building/stockCreators";
import { useBuildingTransfers } from "@/store/slices/building/transfersSlice";
import { useBuildingStock } from "@/store/slices/building/stockSlice";
import { asDateTime, TRANSFER_STATUS_LABELS, statusLabel } from "../shared/constants";

export default function BuildingStockTransferDetail() {
  const { warehouseId, id } = useParams();
  const transferId = id ? String(id) : null;
  const alert = useAlert();
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const {
    current: transfer,
    currentLoading,
    currentError,
  } = useBuildingTransfers();

  const {
    moves: stockMoves,
    movesLoading,
    movesError,
  } = useBuildingStock();

  useEffect(() => {
    if (!transferId) return;
    dispatch(fetchBuildingWarehouseTransferById(transferId));
  }, [dispatch, transferId]);

  useEffect(() => {
    if (!warehouseId || !transferId) return;
    dispatch(
      fetchBuildingWarehouseStockMoves({
        warehouse: warehouseId,
        transfer: transferId,
        page: 1,
        page_size: 50,
      })
    );
  }, [dispatch, warehouseId, transferId]);

  const handleBack = () => {
    if (warehouseId) {
      navigate(`/crm/building/stock/${warehouseId}`);
    } else {
      navigate(-1);
    }
  };

  const statusText = transfer
    ? statusLabel(transfer.status, TRANSFER_STATUS_LABELS)
    : "";

  return (
    <div className="building-page">
      <div className="building-page__header">
        <div>
          <h1 className="building-page__title">
            Передача на склад
          </h1>
          <p className="building-page__subtitle">
            Закупка: {transfer?.procurement_title || "—"} · Склад:{" "}
            {transfer?.warehouse_name || "—"}
          </p>
          {currentLoading && (
            <div className="building-page__muted">Загрузка передачи...</div>
          )}
          {currentError && (
            <div className="building-page__error">
              {String(
                validateResErrors(
                  currentError,
                  "Не удалось загрузить данные передачи"
                )
              )}
            </div>
          )}
        </div>
        <button
          type="button"
          className="building-btn"
          onClick={handleBack}
        >
          Назад к складу
        </button>
      </div>

      {transfer && (
        <div className="building-page__card">
          <h3 className="building-page__cardTitle">Общая информация</h3>
          <div className="building-page__row">
            <div>
              <div className="building-page__label">Статус</div>
              <div>{statusText || "—"}</div>
            </div>
            <div>
              <div className="building-page__label">Создана</div>
              <div>{asDateTime(transfer.created_at)}</div>
            </div>
            <div>
              <div className="building-page__label">Комментарий</div>
              <div>{transfer.note || "—"}</div>
            </div>
          </div>
        </div>
      )}

      <div className="building-page__card">
        <h3 className="building-page__cardTitle">
          Движения по этой передаче
        </h3>
        {movesLoading && (
          <div className="building-page__muted">Загрузка движений...</div>
        )}
        {movesError && (
          <div className="building-page__error">
            {String(
              validateResErrors(movesError, "Не удалось загрузить движения")
            )}
          </div>
        )}
        {!movesLoading && !movesError && stockMoves.length === 0 && (
          <div className="building-page__muted">Нет движений.</div>
        )}
        {!movesLoading &&
          !movesError &&
          stockMoves.map((move) => (
            <div className="building-page__row" key={move?.id ?? move?.uuid}>
              <div>
                <div>
                  {move?.stock_item_name ||
                    move?.stock_item_display ||
                    "Движение"}
                </div>
                <div className="building-page__label">
                  {asDateTime(move?.created_at)}
                </div>
              </div>
              <div className="building-page__value">
                {move?.quantity || move?.qty || ""}
              </div>
            </div>
          ))}
      </div>
    </div>
  );
}

