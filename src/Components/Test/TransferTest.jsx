// src/Components/Test/TransferTest.jsx
import React, { useEffect, useState } from "react";
import { useDispatch } from "react-redux";
import { useTransfers, useAcceptances } from "../../hooks/useTransfers";
import {
  fetchTransfersAsync,
  createTransferAsync,
  fetchAcceptancesAsync,
  acceptInlineAsync,
} from "../../store/creators/transferCreators";
import { fetchClientsAsync } from "../../store/creators/clientCreators";
import { useClient } from "../../store/slices/ClientSlice";
import { getProfile } from "../../store/slices/userSlice";

const TransferTest = () => {
  const dispatch = useDispatch();
  const transfers = useTransfers();
  const acceptances = useAcceptances();
  const { list: clients } = useClient();
  const { profile } = useUser();

  const [transferForm, setTransferForm] = useState({
    agent: "",
    product: "",
    qty_transferred: "",
  });

  const [acceptForm, setAcceptForm] = useState({
    agent_id: "",
    product_id: "",
    qty: "",
  });

  useEffect(() => {
    dispatch(getProfile());
    dispatch(
      fetchTransfersAsync(
        profile?.role === "owner" ? {} : { agent: profile?.id }
      )
    );
    dispatch(fetchAcceptancesAsync());
    dispatch(fetchClientsAsync());
  }, [dispatch]);

  const handleTransferSubmit = async (e) => {
    e.preventDefault();
    try {
      await dispatch(createTransferAsync(transferForm)).unwrap();
      setTransferForm({ agent: "", product: "", qty_transferred: "" });
      dispatch(
        fetchTransfersAsync(
          profile?.role === "owner" ? {} : { agent: profile?.id }
        )
      );
    } catch (error) {
      console.error("Transfer creation failed:", error);
    }
  };

  const handleAcceptSubmit = async (e) => {
    e.preventDefault();
    try {
      const result = await dispatch(acceptInlineAsync(acceptForm)).unwrap();
      alert(
        `Приёмка успешно создана!\nАгент: ${result.agent}\nТовар: ${result.product}\nПринято: ${result.qty_accept}\nОстаток: ${result.qty_remaining_after}`
      );
      setAcceptForm({ agent_id: "", product_id: "", qty: "" });
      dispatch(
        fetchTransfersAsync(
          profile?.role === "owner" ? {} : { agent: profile?.id }
        )
      );
      dispatch(fetchAcceptancesAsync());
    } catch (error) {
      console.error("Accept creation failed:", error);
    }
  };

  const implementers = clients.filter((c) => c.type === "implementers");

  return (
    <div style={{ padding: "20px", maxWidth: "1200px", margin: "0 auto" }}>
      <h1>Тестирование передач и приёмок</h1>

      <div
        style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}
      >
        {/* Создание передачи */}
        <div
          style={{
            border: "1px solid #ccc",
            padding: "20px",
            borderRadius: "8px",
          }}
        >
          <h2>Создать передачу</h2>
          <form onSubmit={handleTransferSubmit}>
            <div style={{ marginBottom: "10px" }}>
              <label>Агент:</label>
              <select
                value={transferForm.agent}
                onChange={(e) =>
                  setTransferForm({ ...transferForm, agent: e.target.value })
                }
                style={{ width: "100%", padding: "8px" }}
                required
              >
                <option value="">Выберите агента</option>
                {implementers.map((agent) => (
                  <option key={agent.id} value={agent.id}>
                    {agent.full_name}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ marginBottom: "10px" }}>
              <label>ID товара:</label>
              <input
                type="text"
                value={transferForm.product}
                onChange={(e) =>
                  setTransferForm({ ...transferForm, product: e.target.value })
                }
                style={{ width: "100%", padding: "8px" }}
                placeholder="UUID товара"
                required
              />
            </div>

            <div style={{ marginBottom: "10px" }}>
              <label>Количество:</label>
              <input
                type="number"
                value={transferForm.qty_transferred}
                onChange={(e) =>
                  setTransferForm({
                    ...transferForm,
                    qty_transferred: e.target.value,
                  })
                }
                style={{ width: "100%", padding: "8px" }}
                min="1"
                required
              />
            </div>

            <button type="submit" disabled={transfers.creating}>
              {transfers.creating ? "Создание..." : "Создать передачу"}
            </button>
          </form>
        </div>

        {/* Inline приёмка */}
        <div
          style={{
            border: "1px solid #ccc",
            padding: "20px",
            borderRadius: "8px",
          }}
        >
          <h2>Принять товар (Inline)</h2>
          <form onSubmit={handleAcceptSubmit}>
            <div style={{ marginBottom: "10px" }}>
              <label>Агент:</label>
              <select
                value={acceptForm.agent_id}
                onChange={(e) =>
                  setAcceptForm({ ...acceptForm, agent_id: e.target.value })
                }
                style={{ width: "100%", padding: "8px" }}
                required
              >
                <option value="">Выберите агента</option>
                {implementers.map((agent) => (
                  <option key={agent.id} value={agent.id}>
                    {agent.full_name}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ marginBottom: "10px" }}>
              <label>ID товара:</label>
              <input
                type="text"
                value={acceptForm.product_id}
                onChange={(e) =>
                  setAcceptForm({ ...acceptForm, product_id: e.target.value })
                }
                style={{ width: "100%", padding: "8px" }}
                placeholder="UUID товара"
                required
              />
            </div>

            <div style={{ marginBottom: "10px" }}>
              <label>Количество:</label>
              <input
                type="number"
                value={acceptForm.qty}
                onChange={(e) =>
                  setAcceptForm({ ...acceptForm, qty: e.target.value })
                }
                style={{ width: "100%", padding: "8px" }}
                min="1"
                required
              />
            </div>

            <button type="submit" disabled={acceptances.acceptingInline}>
              {acceptances.acceptingInline ? "Приёмка..." : "Принять товар"}
            </button>
          </form>
        </div>
      </div>

      {/* Список передач */}
      <div style={{ marginTop: "20px" }}>
        <h2>Передачи ({transfers.list?.length || 0})</h2>
        {transfers.loading ? (
          <p>Загрузка...</p>
        ) : (
          <div style={{ maxHeight: "300px", overflow: "auto" }}>
            {transfers.list?.map((transfer) => (
              <div
                key={transfer.id}
                style={{
                  border: "1px solid #eee",
                  padding: "10px",
                  margin: "5px 0",
                }}
              >
                <strong>ID:</strong> {transfer.id}
                <br />
                <strong>Агент:</strong> {transfer.agent_name}
                <br />
                <strong>Товар:</strong> {transfer.product_name}
                <br />
                <strong>Передано:</strong> {transfer.qty_transferred}
                <br />
                <strong>Принято:</strong> {transfer.qty_accepted}
                <br />
                <strong>Остаток:</strong> {transfer.qty_remaining}
                <br />
                <strong>Статус:</strong> {transfer.status}
                <br />
                <strong>Создано:</strong>{" "}
                {new Date(transfer.created_at).toLocaleString()}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Список приёмок */}
      <div style={{ marginTop: "20px" }}>
        <h2>Приёмки ({acceptances.list?.length || 0})</h2>
        {acceptances.loading ? (
          <p>Загрузка...</p>
        ) : (
          <div style={{ maxHeight: "300px", overflow: "auto" }}>
            {acceptances.list?.map((acceptance) => (
              <div
                key={acceptance.id}
                style={{
                  border: "1px solid #eee",
                  padding: "10px",
                  margin: "5px 0",
                }}
              >
                <strong>ID:</strong> {acceptance.id}
                <br />
                <strong>Передача:</strong> {acceptance.subreal}
                <br />
                <strong>Принято:</strong> {acceptance.qty}
                <br />
                <strong>Принято в:</strong>{" "}
                {new Date(acceptance.accepted_at).toLocaleString()}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default TransferTest;
