import { Plus, Search, Trash } from "lucide-react";
import { useEffect, useState } from "react";
import { useDispatch } from "react-redux";
// import "./Sklad.scss";

import api from "../../../api";
import { useDebounce } from "../../../hooks/useDebounce";
import {
  historySellObjects,
  historySellProduct,
  startSale,
} from "../../../store/creators/saleThunk";
import {
  addCashFlows,
  getCashBoxes,
  useCash,
} from "../../../store/slices/cashSlice";
import { useSale } from "../../../store/slices/saleSlice";
import { useUser } from "../../../store/slices/userSlice";
import AddCashFlowsModal from "../../Deposits/Kassa/AddCashFlowsModal/AddCashFlowsModal";
import RefundPurchase from "./RefundPurchase";
import SellBuildingModal from "./SellBuildingModal";
import SellDetail from "./SellDetail";
import SellModal from "./SellModal";
import SellMainStart from "./SellMainStart";
import "./sell.scss";

export async function createDebt(payload) {
  const res = await api.post("/main/debts/", payload);
  return res.data;
}

const STATUSES = [
  { value: "new", label: "Новая" },
  { value: "paid", label: "Оплачена" },
  { value: "canceled", label: "Отменена" },
];

// Для select сделки
export const DEAL_STATUS_RU = ["Продажа", "Долги", "Предоплата"];

const Sell = () => {
  const dispatch = useDispatch();
  const { company } = useUser();
  const { list: cashBoxes } = useCash();
  const { history, start, historyObjects } = useSale();

  const [showDetailSell, setShowDetailSell] = useState(false);
  const [showSellModal, setShowSellModal] = useState(false);
  const [showSellMainStart, setShowSellMainStart] = useState(false);
  const [showAddCashboxModal, setShowAddCashboxModal] = useState(false);
  const [showBuilding, setShowBuilding] = useState(false);
  const [sellId, setSellId] = useState("");
  const [selectCashBox, setSelectCashBox] = useState("");
  const [selectCashBox1, setSelectCashBox1] = useState("");
  const [clearing, setClearing] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [itemId, setItemId] = useState({});
  const [showRefundModal, setShowRefundModal] = useState(false);
  const [error, setError] = useState(null);

  const [newCashbox, setNewCashbox] = useState({
    name: "",
    amount: 0,
    cashbox: selectCashBox1,
    type: "expense", // Дефолтный тип для новой операции
  });

  // выбор строк
  const [selectedIds, setSelectedIds] = useState(new Set());
  const isSelected = (id) => selectedIds.has(id);
  const toggleRow = (id) =>
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  const toggleSelectAllOnPage = (items) =>
    setSelectedIds((prev) => {
      const next = new Set(prev);
      const all = items.length > 0 && items.every((i) => next.has(i.id));
      items.forEach((i) => (all ? next.delete(i.id) : next.add(i.id)));
      return next;
    });
  const clearSelection = () => setSelectedIds(new Set());

  const sectorName = company?.sector?.name?.trim().toLowerCase() ?? "";
  const planName = company?.subscription_plan?.name?.trim().toLowerCase() ?? "";
  const isBuildingCompany = sectorName === "строительная компания";
  const isStartPlan = planName === "старт";

  const filterSell = history.filter((item) => item.status !== "canceled");

  const filterField = isBuildingCompany ? historyObjects : filterSell;

  // поиск по истории (дебаунс)
  const debouncedSearch = useDebounce((v) => {
    dispatch(historySellProduct({ search: v }));
    dispatch(historySellObjects({ search: v }));
  }, 600);
  const onChange = (e) => debouncedSearch(e.target.value);

  useEffect(() => {
    dispatch(historySellProduct({ search: "" }));
    dispatch(historySellObjects({ search: "" }));
  }, [dispatch]);

  useEffect(() => {
    if (showSellModal) dispatch(startSale());
    if (showSellMainStart) dispatch(startSale());
  }, [showSellModal, showSellMainStart, dispatch]);

  useEffect(() => {
    const onEsc = (e) => {
      if (e.key === "Escape") {
        setShowSellModal(false);
        setShowSellMainStart(false);
        setShowDetailSell(false);
        setShowBuilding(false);
      }
    };
    window.addEventListener("keydown", onEsc);
    return () => window.removeEventListener("keydown", onEsc);
  }, []);

  useEffect(() => {
    dispatch(getCashBoxes());
  }, [dispatch]);

  // Автоматически выбираем первую кассу по индексу
  useEffect(() => {
    if (cashBoxes && cashBoxes.length > 0 && !selectCashBox) {
      const firstCashBox = cashBoxes[0];
      const firstCashBoxId = firstCashBox?.id || firstCashBox?.uuid || "";
      if (firstCashBoxId) {
        setSelectCashBox(firstCashBoxId);
      }
    }
  }, [cashBoxes, selectCashBox]);

  const handleSellModal = (id) => {
    setSellId(id);
    setShowDetailSell(true);
  };
  const handleOpen = (id) => {
    setItemId(id);
    setShowRefundModal(true);
  };

  const kindTranslate = {
    new: "Новый",
    paid: "Оплаченный",
    canceled: "Отмененный",
  };

  const handleAddCashbox = async () => {
    try {
      dispatch(addCashFlows({ ...newCashbox, cashbox: selectCashBox1 }));

      setShowAddCashboxModal(false);
      setNewCashbox({ name: "", amount: 0, type: "expense" }); // Сброс формы
    } catch (err) {
      console.error("Failed to add cashflow:", err);
      setError(
        "Не удалось добавить операцию по кассе. Пожалуйста, проверьте данные и попробуйте еще раз."
      );
    }
  };

  // массовое удаление выбранных
  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    if (!window.confirm(`Удалить выбранные ${selectedIds.size} запись(и)?`))
      return;
    try {
      setBulkDeleting(true);
      const res = await fetch(
        "https://app.nurcrm.kg/api/main/sales/bulk-delete/",
        {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
            Authorization: `Bearer ${localStorage.getItem("accessToken")}`,
          },
          credentials: "include",
          body: JSON.stringify({
            ids: Array.from(selectedIds),
            allow_paid: false,
          }),
        }
      );
      if (!res.ok) throw new Error((await res.text()) || `HTTP ${res.status}`);
      clearSelection();
      alert("Выбранные записи удалены");
      dispatch(historySellProduct({ search: "" }));
      dispatch(historySellObjects({ search: "" }));
    } catch (e) {
      alert("Не удалось удалить: " + e.message);
    } finally {
      setBulkDeleting(false);
    }
  };

  // очистить ВСЮ историю
  const handleClearAllHistory = async () => {
    if (!window.confirm("Удалить ВСЮ историю? Действие необратимо.")) return;
    try {
      setClearing(true);
      const list = Array.isArray(filterField) ? filterField : [];
      const ids = list.map((i) => i.id);
      if (ids.length === 0) throw new Error("Нечего удалять");
      const res = await fetch(
        "https://app.nurcrm.kg/api/main/sales/bulk-delete/",
        {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
            Authorization: `Bearer ${localStorage.getItem("accessToken")}`,
          },
          credentials: "include",
          body: JSON.stringify({ ids, allow_paid: false }),
        }
      );
      if (!res.ok) throw new Error((await res.text()) || `HTTP ${res.status}`);
      clearSelection();
      alert("История удалена");
      dispatch(historySellProduct({ search: "" }));
      dispatch(historySellObjects({ search: "" }));
    } catch (e) {
      alert("Не удалось очистить историю: " + e.message);
    } finally {
      setClearing(false);
    }
  };

  const SelectionActions = ({ pageItems }) => {
    const allOnPageChecked =
      pageItems.length > 0 && pageItems.every((i) => selectedIds.has(i.id));
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
        }}
      >
        <>
          {/* <span style={{ opacity: 0.75 }}>Выбрано: {selectedIds.size}</span> */}
          <button
            className="sell__delete"
            // style={{ background: "#e53935" }}
            onClick={handleBulkDelete}
            disabled={bulkDeleting}
            title="Массовое удаление выбранных"
          >
            {bulkDeleting ? "Удаляем..." : "Удалить"}
          </button>
          <button
            className="sell__reset"
            onClick={clearSelection}
            style={{ cursor: "pointer" }}
            title="Снять выбор"
          >
            Очистить
          </button>
        </>
      </div>
    );
  };

  return (
    <div>
      {start && showSellMainStart ? (
        <SellMainStart
          show={showSellMainStart}
          setShow={setShowSellMainStart}
        />
      ) : (
        <>
          <div className="sell__header">
            <div className="sell__header-left">
              <div className="sell__header-input">
                <input onChange={onChange} type="text" placeholder="Поиск" />
                <span>
                  <Search size={15} color="#91929E" />
                </span>
              </div>
            </div>
            <div className="sell__header-left">
              {selectedIds.size > 0 ? (
                <SelectionActions pageItems={filterField} />
              ) : (
                <>
                  {isBuildingCompany ? (
                    <button
                      className="sklad__add"
                      onClick={() => setShowBuilding(true)}
                    >
                      <Plus size={16} style={{ marginRight: 4 }} /> Продать
                      квартиру
                    </button>
                  ) : (
                    <>
                      <button
                        className="sell__header-btn"
                        onClick={() => {
                          dispatch(startSale());
                          setShowSellMainStart(true);
                        }}
                      >
                        Продать
                      </button>
                      <button
                        className="sell__header-btn"
                        onClick={() => setShowAddCashboxModal(true)}
                      >
                        Прочие расходы
                      </button>
                    </>
                  )}
                </>
              )}
            </div>
          </div>
          <div className="sell__wrappper">
            <table className="sell__table">
              <thead>
                <tr>
                  <th>
                    <input
                      type="checkbox"
                      checked={
                        filterField.length > 0 &&
                        filterField.every((i) => selectedIds.has(i.id))
                      }
                      onChange={() => toggleSelectAllOnPage(filterField)}
                    />
                  </th>
                  <th>№</th>
                  <th>Клиент</th>
                  <th>Цена</th>
                  <th>Статус</th>
                  <th>Дата</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {history.map((item, idx) => {
                  return (
                    <tr
                      onClick={() => {
                        setSellId(item.id);
                        setShowDetailSell(true);
                      }}
                    >
                      <td onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={isSelected(item.id)}
                          onChange={() => toggleRow(item.id)}
                        />
                      </td>
                      <td>{idx + 1}</td>
                      <td>{item.client_name || "-"}</td>
                      <td>{item.total}</td>
                      <td>{kindTranslate[item.status] || item.status}</td>
                      <td>{new Date(item.created_at).toLocaleString()}</td>
                      <td onClick={(e) => e.stopPropagation()}>
                        {company.sector.name === "Магазин" && (
                          <button
                            className="sell__table-refund"
                            onClick={() => handleOpen(item)}
                          >
                            Возврат
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
      {/* <div className="sklad__header">
        <div className="sklad__left">
          <input
            type="text"
            placeholder="Поиск по истории"
            className="sklad__search"
            onChange={onChange}
          />
          <div className="sklad__center">
            <span>Найдено: {filterField?.length ?? 0}</span>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 20,
            flexWrap: "wrap",
          }}
        >
          {!isBuildingCompany && filterField?.length > 0 && (
            <button
              className="barbermasters__btn barbermasters__btn--secondary"
              onClick={handleClearAllHistory}
              disabled={clearing}
              title="Удалить всю историю"
            >
              <Trash /> {clearing ? "Очищаем..." : "Очистить историю"}
            </button>
          )}

          {isBuildingCompany ? (
            <button
              className="sklad__add"
              onClick={() => setShowBuilding(true)}
            >
              <Plus size={16} style={{ marginRight: 4 }} /> Продать квартиру
            </button>
          ) : (
            <>
              <button
                className="sklad__add"
                onClick={() => setShowSellModal(true)}
              >
                <Plus size={16} style={{ marginRight: 4 }} /> Продать товар
              </button>

              <button
                className="sklad__add"
                onClick={() => setShowAddCashboxModal(true)}
              >
                Прочие расходы
              </button>
            </>
          )}
        </div>
      </div>

      {!!filterField?.length && <SelectionActions pageItems={filterField} />}

      {(filterField?.length ?? 0) === 0 ? (
        <p className="sklad__no-products-message">Нет записей.</p>
      ) : (
        <div className="table-wrapper" style={{ marginBottom: 20 }}>
          <table className="sklad__table">
            <thead>
              <tr>
                <th>
                  <input
                    type="checkbox"
                    checked={
                      filterField.length > 0 &&
                      filterField.every((i) => selectedIds.has(i.id))
                    }
                    onChange={() => toggleSelectAllOnPage(filterField)}
                  />
                </th>
                <th>№</th>
                <th>Клиент</th>
                <th>Цена</th>
                <th>Статус</th>
                <th>Дата</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filterField.map((item, index) => (
                <tr
                  key={item.id}
                  style={{ cursor: "pointer" }}
                  onClick={() => {
                    setSellId(item.id);
                    setShowDetailSell(true);
                  }}
                >
                  <td onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={isSelected(item.id)}
                      onChange={() => toggleRow(item.id)}
                    />
                  </td>
                  <td>{index + 1}</td>
                  <td>{item.client_name || "Нет имени"}</td>
                  <td>{item.total ?? item.subtotal}</td>
                  <td>{kindTranslate[item.status] || item.status}</td>
                  <td>{new Date(item.created_at).toLocaleString()}</td>
                  <td onClick={(e) => e.stopPropagation()}>
                    {company.sector.name === "Магазин" && (
                      <button
                        className="btn edit-btn"
                        onClick={() => handleOpen(item)}
                      >
                        Возврат
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )} */}

      {showAddCashboxModal && (
        <AddCashFlowsModal onClose={() => setShowAddCashboxModal(false)} />
      )}

      {showSellModal && (
        <SellModal
          id={start?.id}
          selectCashBox={selectCashBox}
          onClose={() => setShowSellModal(false)}
        />
      )}
      {showRefundModal && (
        <RefundPurchase
          item={itemId}
          onClose={() => setShowRefundModal(false)}
          onChanged={() => dispatch(historySellProduct())}
        />
      )}
      {showBuilding && (
        <SellBuildingModal onClose={() => setShowBuilding(false)} />
      )}
      {showDetailSell && (
        <SellDetail onClose={() => setShowDetailSell(false)} id={sellId} />
      )}
    </div>
  );
};

export default Sell;
