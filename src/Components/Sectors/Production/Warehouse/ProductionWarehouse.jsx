import React, { useEffect, useMemo, useState } from "react";
import FinishedGoods from "../FinishedGoods/FinishedGoods";
import RawMaterialsWarehouse from "../RawMaterialsWarehouse/RawMaterialsWarehouse";
import TransferStatusModal from "../TransferStatus/TransferStatus";
import { useDispatch, useSelector } from "react-redux";
import {
  getCashFlows,
  updateCashFlows,
  useCash,
} from "../../../../store/slices/cashSlice";
import { fetchProductsAsync } from "../../../../store/creators/productCreators";
import { X } from "lucide-react";
import { useProducts } from "../../../../store/slices/productSlice";
import {
  fetchTransfersAsync,
  createAcceptanceAsync,
  fetchReturnsAsync,
  approveReturnAsync,
} from "../../../../store/creators/transferCreators";
import { useDepartments } from "../../../../store/slices/departmentSlice";
import { getEmployees } from "../../../../store/creators/departmentCreators";
import { useTransfer } from "../../../../store/slices/transferSlice";
import { getProfile, useUser } from "../../../../store/slices/userSlice";

/**
 * Склеивает возвраты (returns) с передачами (transfers).
 * @param {Array} transfers  Массив передач [{ id, agent, agent_name, product, product_name, ... }]
 * @param {Array} returnsArr Массив возвратов [{ subreal, qty }]
 * @param {Object} [opts]
 * @param {string} [opts.agentId]  фильтр по id агента
 * @param {string} [opts.query]    поиск по product_name / agent_name
 * @param {boolean} [opts.group]   агрегировать по subreal (по умолчанию true)
 * @returns {Array} массив для таблицы
 */
export function buildReturnRowsFromArrays(
  transfers,
  returnsArr,
  { agentId = "", query = "", group = true } = {}
) {
  const tById = new Map((transfers || []).map((t) => [t.id, t]));

  let rows = (returnsArr || [])
    .map((r) => {
      const t = tById.get(r.subreal);
      if (!t) return null;
      return {
        // ключи
        id: `${r.subreal}__${Math.random().toString(36).slice(2, 8)}`,
        subreal: r.subreal,

        // данные возврата
        qty: Number(r.qty) || 0,

        // данные передачи
        agent: t.agent,
        agent_name: t.agent_name,
        product: t.product,
        product_name: t.product_name,
        created_at: t.created_at,
        status: t.status,

        // доп. поля из передачи (по желанию)
        qty_transferred: t.qty_transferred,
        qty_accepted: t.qty_accepted,
        qty_returned: t.qty_returned,
        qty_remaining: t.qty_remaining,
        qty_on_agent: t.qty_on_agent,
      };
    })
    .filter(Boolean);

  if (group) {
    const bySubreal = new Map();
    for (const x of rows) {
      const prev = bySubreal.get(x.subreal);
      if (prev) prev.qty += x.qty;
      else bySubreal.set(x.subreal, { ...x });
    }
    rows = Array.from(bySubreal.values());
  }

  if (agentId) rows = rows.filter((x) => x.agent === agentId);

  if (query) {
    const q = String(query).toLowerCase();
    rows = rows.filter(
      (x) =>
        String(x.product_name || "")
          .toLowerCase()
          .includes(q) ||
        String(x.agent_name || "")
          .toLowerCase()
          .includes(q)
    );
  }

  rows.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  return rows;
}

const PendingModal = ({ onClose, onChanged }) => {
  const dispatch = useDispatch();

  const { list: returns, loading: returnsLoading } = useSelector(
    (state) => state.return || { list: [], loading: false }
  );
  const { list: transfers } = useTransfer(); // если не нужно — можно удалить
  const { employees } = useDepartments();
  const { profile } = useUser();

  const [selectedAgent, setSelectedAgent] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [acceptingReturn, setAcceptingReturn] = useState(null);

  // ---------------- ФИЛЬТРАЦИЯ ТОЛЬКО PENDING ----------------
  const filterReturns = returns.filter((item) => item.status === "pending");
  // -----------------------------------------------------------

  useEffect(() => {
    dispatch(getProfile());
    dispatch(fetchReturnsAsync());
    // если владелец — тянем все передачи, иначе только по агенту
    dispatch(
      fetchTransfersAsync(
        profile?.role === "owner" ? {} : { agent: profile?.id }
      )
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dispatch]);

  const handleAcceptReturn = async (returnItem) => {
    setAcceptingReturn(returnItem.id);
    try {
      await dispatch(approveReturnAsync(returnItem.id)).unwrap();
      alert(
        `Возврат "${returnItem.product}" успешно принят!\nКоличество: ${returnItem.qty}`
      );
      onChanged?.();
      onClose?.();
    } catch (error) {
      console.error("Accept return failed:", error);
      alert(
        `Ошибка при принятии возврата: ${
          error?.message || "неизвестная ошибка"
        }`
      );
    } finally {
      setAcceptingReturn(null);
    }
  };

  return (
    <div className="add-modal accept">
      <div className="add-modal__overlay" onClick={onClose} />
      <div
        className="add-modal__content"
        role="dialog"
        aria-modal="true"
        style={{ height: "500px", overflow: "auto" }}
      >
        <div className="add-modal__header">
          <h3>Возвращенные товары (ожидают принятия)</h3>
          <X className="add-modal__close-icon" size={20} onClick={onClose} />
        </div>

        {/* Фильтры */}
        <div
          className="add-modal__section"
          style={{ display: "flex", gap: "10px", marginBottom: "15px" }}
        >
          <select
            className="add-modal__input"
            value={selectedAgent}
            onChange={(e) => setSelectedAgent(e.target.value)}
            style={{ width: "240px" }}
          >
            <option value="">Все агенты</option>
            {employees?.map((employee) => (
              <option key={employee.id} value={employee.id}>
                {employee.first_name} {employee.last_name}
              </option>
            ))}
          </select>

          <input
            type="text"
            placeholder="Поиск по товару или агенту"
            className="add-modal__input"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ flex: 1 }}
          />
        </div>

        {returnsLoading ? (
          <div className="add-modal__section">Загрузка возвратов…</div>
        ) : filterReturns.length === 0 ? (
          <div className="add-modal__section">
            Нет возвратов в статусе “pending”.
          </div>
        ) : (
          <div
            className="table-wrapper"
            style={{ maxHeight: 400, overflow: "auto" }}
          >
            <table className="sklad__table">
              <thead>
                <tr>
                  <th>№</th>
                  <th>Товар</th>
                  <th>Агент</th>
                  <th>Кол-во</th>
                  <th>Дата возврата</th>
                  <th>Действия</th>
                </tr>
              </thead>
              <tbody>
                {filterReturns.map((returnItem, idx) => (
                  <tr key={returnItem.id}>
                    <td>{idx + 1}</td>
                    <td>{returnItem.product || "—"}</td>
                    <td>{returnItem.agent || "—"}</td>
                    <td>{returnItem.qty || 0}</td>
                    <td>
                      {returnItem.returned_at
                        ? new Date(returnItem.returned_at).toLocaleString(
                            "ru-RU",
                            {
                              timeZone: "Asia/Bishkek",
                              day: "2-digit",
                              month: "2-digit",
                              year: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            }
                          )
                        : "—"}
                    </td>
                    <td>
                      <button
                        className="add-modal__save"
                        style={{ marginRight: 8 }}
                        title="Принять возврат"
                        onClick={() => handleAcceptReturn(returnItem)}
                        disabled={acceptingReturn === returnItem.id}
                      >
                        {acceptingReturn === returnItem.id
                          ? "Принятие..."
                          : "Принять"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="add-modal__footer">
          <button className="add-modal__cancel" onClick={onClose}>
            Закрыть
          </button>
          <button
            className="add-modal__save"
            onClick={() => {
              dispatch(fetchReturnsAsync());
              onChanged?.();
            }}
          >
            Обновить список
          </button>
        </div>
      </div>
    </div>
  );
};

const ProductionWarehouse = () => {
  const [activeTab, setActiveTab] = useState(0);
  const dispatch = useDispatch();
  const { list: products } = useProducts();

  const [showPendingModal, setShowPendingModal] = useState(false);
  const [showTransferStatusModal, setShowTransferStatusModal] = useState(false);

  const tabs = [
    {
      label: "Склад готовой продукции",
      content: (
        <FinishedGoods
          products={products}
          onChanged={() => dispatch(fetchProductsAsync())}
        />
      ),
    },
    {
      label: "Склад сырья",
      content: <RawMaterialsWarehouse />,
    },
  ];
  useEffect(() => {
    dispatch(fetchProductsAsync());
  }, []);

  return (
    <section className="warehouseP sklad">
      <div className="vitrina__header" style={{ margin: "15px 0" }}>
        <div className="vitrina__tabs">
          {tabs.map((tab, index) => {
            return (
              <span
                key={index}
                className={`vitrina__tab ${
                  index === activeTab && "vitrina__tab--active"
                }`}
                style={{ cursor: "pointer" }}
                onClick={() => setActiveTab(index)}
              >
                {tab.label}
              </span>
            );
          })}
          {activeTab === 0 && (
            <>
              <span
                onClick={() => setShowPendingModal(true)}
                className={`vitrina__tab`}
                style={{ cursor: "pointer" }}
              >
                Запросы
              </span>
              {/* <span
                onClick={() => setShowTransferStatusModal(true)}
                className={`vitrina__tab`}
                style={{ cursor: "pointer" }}
              >
                Статус передач
              </span> */}
            </>
          )}
        </div>
      </div>
      <>{tabs[activeTab].content}</>
      {showPendingModal && (
        <PendingModal onClose={() => setShowPendingModal(false)} />
      )}
      {showTransferStatusModal && (
        <TransferStatusModal
          onClose={() => setShowTransferStatusModal(false)}
          onChanged={() => dispatch(fetchProductsAsync())}
        />
      )}
    </section>
  );
};

export default ProductionWarehouse;
