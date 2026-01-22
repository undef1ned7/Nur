import React, { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { X, CheckCircle, Clock, AlertCircle } from "lucide-react";
import {
  fetchTransfersAsync,
  fetchAcceptancesAsync,
  fetchReturnsAsync,
} from "../../../../store/creators/transferCreators";
import { getProfile, useUser } from "../../../../store/slices/userSlice";


const TransferStatusModal = ({ onClose, onChanged }) => {
  const { profile } = useUser();
  const dispatch = useDispatch();
  const { list: transfers, loading: transfersLoading } = useSelector(
    (state) => state.transfer || { list: [], loading: false }
  );
  const { list: acceptances, loading: acceptancesLoading } = useSelector(
    (state) => state.acceptance || { list: [], loading: false }
  );
  const { list: returns, loading: returnsLoading } = useSelector(
    (state) => state.return || { list: [], loading: false }
  );

  const [selectedTransfer, setSelectedTransfer] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  useEffect(() => {
    dispatch(
      fetchTransfersAsync(
        profile?.role === "owner" ? {} : { agent: profile?.id }
      )
    );
    dispatch(fetchAcceptancesAsync());
    dispatch(fetchReturnsAsync());
    dispatch(getProfile());
  }, [dispatch]);

  const filteredTransfers =
    transfers?.filter((transfer) => {
      const matchesSearch =
        !searchQuery ||
        transfer.product_name
          ?.toLowerCase()
          .includes(searchQuery.toLowerCase()) ||
        transfer.agent_name?.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesStatus =
        statusFilter === "all" || transfer.status === statusFilter;

      return matchesSearch && matchesStatus;
    }) || [];

  const getTransferStatus = (transfer) => {
    if (transfer.status === "closed") return "completed";
    if (transfer.qty_accepted > 0) return "partially_accepted";
    return "pending";
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case "completed":
        return <CheckCircle className="text-green-500" size={20} />;
      case "partially_accepted":
        return <Clock className="text-yellow-500" size={20} />;
      case "pending":
        return <AlertCircle className="text-red-500" size={20} />;
      default:
        return <Clock className="text-gray-500" size={20} />;
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case "completed":
        return "Завершена";
      case "partially_accepted":
        return "Частично принята";
      case "pending":
        return "В ожидании";
      default:
        return "Неизвестно";
    }
  };

  const getTransferDetails = (transfer) => {
    const acceptancesForTransfer =
      acceptances?.filter((acc) => acc.subreal === transfer.id) || [];

    const returnsForTransfer =
      returns?.filter((ret) => ret.subreal === transfer.id) || [];

    return {
      acceptances: acceptancesForTransfer,
      returns: returnsForTransfer,
      totalAccepted: acceptancesForTransfer.reduce(
        (sum, acc) => sum + acc.qty,
        0
      ),
      totalReturned: returnsForTransfer.reduce((sum, ret) => sum + ret.qty, 0),
    };
  };

  return (
    <div className="add-modal">
      <div className="add-modal__overlay" onClick={onClose} />
      <div
        className="add-modal__content"
        style={{ height: "auto", maxHeight: "80vh" }}
      >
        <div className="add-modal__header">
          <h3>Статус передач</h3>
          <X className="add-modal__close-icon" size={20} onClick={onClose} />
        </div>

        {/* Filters */}
        <div
          className="add-modal__section"
          style={{ display: "flex", gap: "10px", marginBottom: "15px" }}
        >
          <input
            type="text"
            placeholder="Поиск по товару или агенту"
            className="add-modal__input"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ flex: 1 }}
          />
          <select
            className="add-modal__input"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{ width: "200px" }}
          >
            <option value="all">Все статусы</option>
            <option value="open">Открытые</option>
            <option value="closed">Закрытые</option>
          </select>
        </div>

        {transfersLoading ? (
          <div className="add-modal__section">Загрузка передач...</div>
        ) : filteredTransfers.length === 0 ? (
          <div className="add-modal__section">Нет передач для отображения</div>
        ) : (
          <div
            className="table-wrapper"
            style={{ maxHeight: "400px", overflow: "auto" }}
          >
            <table className="sklad__table">
              <thead>
                <tr>
                  <th>Статус</th>
                  <th>Товар</th>
                  <th>Агент</th>
                  <th>Передано</th>
                  <th>Принято</th>
                  <th>Возвращено</th>
                  <th>У агента</th>
                  <th>Дата</th>
                  <th>Действия</th>
                </tr>
              </thead>
              <tbody>
                {filteredTransfers.map((transfer) => {
                  const status = getTransferStatus(transfer);
                  const details = getTransferDetails(transfer);

                  return (
                    <tr key={transfer.id}>
                      <td>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "5px",
                          }}
                        >
                          {getStatusIcon(status)}
                          <span>{getStatusText(status)}</span>
                        </div>
                      </td>
                      <td>{transfer.product_name || "—"}</td>
                      <td>{transfer.agent_name || "—"}</td>
                      <td>{transfer.qty_transferred || 0}</td>
                      <td>{details.totalAccepted}</td>
                      <td>{details.totalReturned}</td>
                      <td>{transfer.qty_on_agent || 0}</td>
                      <td>
                        {new Date(transfer.created_at).toLocaleDateString()}
                      </td>
                      <td>
                        <button
                          className="btn edit-btn"
                          onClick={() => setSelectedTransfer(transfer)}
                          style={{ padding: "5px 10px", fontSize: "12px" }}
                        >
                          Детали
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Transfer Details Modal */}
        {selectedTransfer && (
          <div
            className="add-modal"
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: 1000,
            }}
          >
            <div
              className="add-modal__overlay"
              onClick={() => setSelectedTransfer(null)}
            />
            <div
              className="add-modal__content"
              style={{ height: "auto", maxHeight: "70vh" }}
            >
              <div className="add-modal__header">
                <h3>Детали передачи: {selectedTransfer.product_name}</h3>
                <X
                  className="add-modal__close-icon"
                  size={20}
                  onClick={() => setSelectedTransfer(null)}
                />
              </div>

              <div className="add-modal__section">
                <h4>Информация о передаче</h4>
                <p>
                  <strong>Агент:</strong> {selectedTransfer.agent_name}
                </p>
                <p>
                  <strong>Товар:</strong> {selectedTransfer.product_name}
                </p>
                <p>
                  <strong>Передано:</strong> {selectedTransfer.qty_transferred}
                </p>
                <p>
                  <strong>Статус:</strong>{" "}
                  {getStatusText(getTransferStatus(selectedTransfer))}
                </p>
                <p>
                  <strong>Дата создания:</strong>{" "}
                  {new Date(selectedTransfer.created_at).toLocaleString()}
                </p>
              </div>

              {(() => {
                const details = getTransferDetails(selectedTransfer);
                return (
                  <>
                    <div className="add-modal__section">
                      <h4>Приёмки ({details.acceptances.length})</h4>
                      {details.acceptances.length > 0 ? (
                        <div
                          className="table-wrapper"
                          style={{ maxHeight: "200px", overflow: "auto" }}
                        >
                          <table className="sklad__table">
                            <thead>
                              <tr>
                                <th>Дата</th>
                                <th>Количество</th>
                                <th>Статус</th>
                              </tr>
                            </thead>
                            <tbody>
                              {details.acceptances.map((acceptance) => (
                                <tr key={acceptance.id}>
                                  <td>
                                    {new Date(
                                      acceptance.created_at
                                    ).toLocaleDateString()}
                                  </td>
                                  <td>{acceptance.qty}</td>
                                  <td>Принято</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <p>Нет приёмок</p>
                      )}
                    </div>

                    <div className="add-modal__section">
                      <h4>Возвраты ({details.returns.length})</h4>
                      {details.returns.length > 0 ? (
                        <div
                          className="table-wrapper"
                          style={{ maxHeight: "200px", overflow: "auto" }}
                        >
                          <table className="sklad__table">
                            <thead>
                              <tr>
                                <th>Дата</th>
                                <th>Количество</th>
                                <th>Статус</th>
                              </tr>
                            </thead>
                            <tbody>
                              {details.returns.map((returnItem) => (
                                <tr key={returnItem.id}>
                                  <td>
                                    {new Date(
                                      returnItem.created_at
                                    ).toLocaleDateString()}
                                  </td>
                                  <td>{returnItem.qty}</td>
                                  <td>Возвращено</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <p>Нет возвратов</p>
                      )}
                    </div>
                  </>
                );
              })()}

              <div className="add-modal__footer">
                <button
                  className="add-modal__cancel"
                  onClick={() => setSelectedTransfer(null)}
                >
                  Закрыть
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="add-modal__footer">
          <button className="add-modal__cancel" onClick={onClose}>
            Закрыть
          </button>
          <button
            className="add-modal__save"
            onClick={() => {
              dispatch(
                fetchTransfersAsync(
                  profile?.role === "owner" ? {} : { agent: profile?.id }
                )
              );
              dispatch(fetchAcceptancesAsync());
              dispatch(fetchReturnsAsync());
              onChanged?.();
            }}
          >
            Обновить
          </button>
        </div>
      </div>
    </div>
  );
};

export default TransferStatusModal;
