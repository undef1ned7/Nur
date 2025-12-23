import { MoreVertical, Plus } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useDispatch } from "react-redux";

import {
  fetchBrandsAsync,
  fetchCategoriesAsync,
  fetchProductsAsync,
  fetchAgentProductsAsync,
  getItemsMake,
} from "../../../../store/creators/productCreators";

import { getCashBoxes, useCash } from "../../../../store/slices/cashSlice";

import { useProducts } from "../../../../store/slices/productSlice";

import { X } from "lucide-react";
import { useSelector } from "react-redux";
import { fetchClientsAsync } from "../../../../store/creators/clientCreators";
import {
  getCashFlows,
  updateCashFlows,
} from "../../../../store/slices/cashSlice";
import { getProfile, useUser } from "../../../../store/slices/userSlice";
import {
  createReturnAsync,
  fetchTransfersAsync,
  createAcceptanceAsync,
  approveReturnAsync,
} from "../../../../store/creators/transferCreators";
import { useClient } from "../../../../store/slices/ClientSlice";
import { useDepartments } from "../../../../store/slices/departmentSlice";
import { getEmployees } from "../../../../store/creators/departmentCreators";
import { useTransfer } from "../../../../store/slices/transferSlice";
import SellModal from "../../../pages/Sell/SellModal";
import { useSale } from "../../../../store/slices/saleSlice";
import { startSale } from "../../../../store/creators/saleThunk";
import SellStart from "./SellStart/SellStart";
import { startSaleInAgent } from "../../../../store/creators/agentCreators";
import { useAgent } from "../../../../store/slices/agentSlice";
import api from "../../../../api";
import AddCashFlowsModal from "../../../Deposits/Kassa/AddCashFlowsModal/AddCashFlowsModal";
import {
  historySellProduct,
  historySellProductDetail,
  getProductCheckout,
  getProductInvoice,
} from "../../../../store/creators/saleThunk";

// Компонент для детального просмотра продажи
const SaleDetailModal = ({ onClose, saleId }) => {
  const dispatch = useDispatch();
  const { historyDetail: saleDetail } = useSale();
  const { company } = useUser();

  useEffect(() => {
    if (saleId) {
      dispatch(historySellProductDetail(saleId));
    }
  }, [saleId, dispatch]);

  const kindTranslate = {
    new: "Новый",
    paid: "Оплаченный",
    canceled: "Отмененный",
  };

  const handlePrintReceipt = async () => {
    try {
      const pdfBlob = await dispatch(
        getProductCheckout(saleDetail?.id)
      ).unwrap();
      const url = window.URL.createObjectURL(pdfBlob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "receipt.pdf";
      link.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert(err.detail);
    }
  };

  const handlePrintInvoice = async () => {
    try {
      const pdfInvoiceBlob = await dispatch(
        getProductInvoice(saleDetail?.id)
      ).unwrap();
      const url1 = window.URL.createObjectURL(pdfInvoiceBlob);
      const link1 = document.createElement("a");
      link1.href = url1;
      link1.download = "invoice.pdf";
      link1.click();
      window.URL.revokeObjectURL(url1);
    } catch (err) {
      alert(err.detail);
    }
  };

  return (
    <div className="sellDetail add-modal">
      <div className="add-modal__overlay" onClick={onClose} />
      <div className="add-modal__content" style={{ width: "500px" }}>
        <div className="add-modal__header">
          <h3>Детали продажи</h3>
          <X className="add-modal__close-icon" size={20} onClick={onClose} />
        </div>
        <div className="sellDetail__content">
          <div className="sell__box">
            <p className="receipt__title">
              Клиент: {saleDetail?.client_name || "—"}
            </p>
            <p className="receipt__title">
              Статус:{" "}
              {kindTranslate[saleDetail?.status] || saleDetail?.status || "—"}
            </p>
            <p className="receipt__title">
              Дата:{" "}
              {saleDetail?.created_at
                ? new Date(saleDetail.created_at).toLocaleString()
                : "—"}
            </p>
          </div>
          <div className="receipt">
            {saleDetail?.items?.map((product, idx) => (
              <div className="receipt__item" key={idx}>
                <p className="receipt__item-name">
                  {idx + 1}.{" "}
                  {product.product_name || product.object_name || "—"}
                </p>
                <div>
                  <p>{product.tax_total || 0}</p>
                  <p className="receipt__item-price">
                    {product.quantity || 0} x {product.unit_price || 0} ≡{" "}
                    {(product.quantity || 0) * (product.unit_price || 0)}
                  </p>
                </div>
              </div>
            ))}
            <div className="receipt__total">
              <b>ИТОГО</b>
              <div
                style={{ gap: "10px", display: "flex", alignItems: "center" }}
              >
                <p>Общая скидка {saleDetail?.discount_total || 0}</p>
                <p>Налог {saleDetail?.tax_total || 0}</p>
                <b>≡ {saleDetail?.total || 0}</b>
              </div>
            </div>
            <div className="receipt__row">
              <button className="receipt__row-btn" onClick={handlePrintReceipt}>
                Чек
              </button>
              <button className="receipt__row-btn" onClick={handlePrintInvoice}>
                Накладной
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const PendingModal = ({ onClose, onChanged }) => {
  const dispatch = useDispatch();
  const { list: transfers, loading: transfersLoading } = useSelector(
    (state) => state.transfer || { list: [], loading: false }
  );
  const { profile } = useUser();
  const [searchQuery, setSearchQuery] = useState("");

  // Фильтруем передачи в зависимости от роли
  const filteredTransfers = useMemo(() => {
    let filtered = transfers || [];

    // Если это агент — показываем только его передачи и скрываем закрытые
    if (profile?.role !== "owner" && profile?.id) {
      filtered = filtered.filter(
        (transfer) =>
          transfer.agent === profile.id &&
          transfer.status?.toLowerCase?.() !== "closed"
      );
    }
    // Если это владелец — показываем все передачи (включая closed)

    if (searchQuery) {
      const query = String(searchQuery).toLowerCase();
      filtered = filtered.filter(
        (transfer) =>
          transfer.product_name?.toLowerCase?.().includes(query) ||
          transfer.agent_name?.toLowerCase?.().includes(query)
      );
    }

    return filtered;
  }, [transfers, profile?.id, profile?.role, searchQuery]);

  useEffect(() => {
    dispatch(
      fetchTransfersAsync(
        profile?.role === "owner" ? {} : { agent: profile?.id }
      )
    );
  }, [dispatch]);

  const handleAcceptTransfer = async (transfer) => {
    try {
      await dispatch(
        createAcceptanceAsync({
          subreal: transfer.id,
          qty: transfer.qty_transferred,
        })
      ).unwrap();

      alert(`Передача "${transfer.product_name}" успешно принята!`);
      onChanged?.();
      onClose?.();
    } catch (error) {
      console.error("Accept transfer failed:", error);
      alert(
        `Ошибка при принятии передачи: ${
          error?.message || "неизвестная ошибка"
        }`
      );
    }
  };

  return (
    <div className="add-modal accept">
      <div className="add-modal__overlay" onClick={onClose} />
      <div className="add-modal__content" role="dialog" aria-modal="true">
        <div className="add-modal__header">
          <h3>
            {profile?.role !== "owner"
              ? "Мои передачи для принятия"
              : "Все передачи"}
          </h3>
          <X className="add-modal__close-icon" size={20} onClick={onClose} />
        </div>

        {/* Поиск */}
        <div className="add-modal__section" style={{ marginBottom: "15px" }}>
          <input
            type="text"
            placeholder={
              profile?.role !== "owner"
                ? "Поиск по товару"
                : "Поиск по товару или агенту"
            }
            className="add-modal__input"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ width: "100%" }}
          />
        </div>

        {transfersLoading ? (
          <div className="add-modal__section">Загрузка передач…</div>
        ) : filteredTransfers.length === 0 ? (
          <div className="add-modal__section">Нет передач для принятия.</div>
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
                  {profile?.role === "owner" && <th>Агент</th>}
                  <th>Количество</th>
                  <th>Статус</th>
                  <th>Дата</th>
                  <th>Действия</th>
                </tr>
              </thead>
              <tbody>
                {filteredTransfers.map((transfer, idx) => (
                  <tr key={transfer.id}>
                    <td>{idx + 1}</td>
                    <td>{transfer.product_name || "—"}</td>
                    {profile?.role === "owner" && (
                      <td>{transfer.agent_name || "—"}</td>
                    )}
                    <td>{transfer.qty_transferred || 0}</td>
                    <td>
                      <span
                        className={`sell__badge--${
                          transfer.status === "open" ? "warning" : "success"
                        }`}
                      >
                        {transfer.status === "open" ? "Открыта" : "Закрыта"}
                      </span>
                    </td>
                    <td>
                      {new Date(transfer.created_at).toLocaleDateString()}
                    </td>
                    <td>
                      {profile?.role !== "owner" ? (
                        <button
                          className="add-modal__save"
                          style={{ marginRight: 8 }}
                          title="Принять передачу"
                          onClick={() => handleAcceptTransfer(transfer)}
                          disabled={transfer.status !== "open"}
                        >
                          Принять
                        </button>
                      ) : (
                        <span style={{ opacity: 0.7 }}>Просмотр</span>
                      )}
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
              dispatch(
                fetchTransfersAsync(
                  profile?.role === "owner" ? {} : { agent: profile?.id }
                )
              );
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

const ReturnProductModal = ({ onClose, onChanged, item }) => {
  const { list: clients } = useClient();
  const { employees } = useDepartments();
  const { creating, createError } = useSelector(
    (state) => state.return || { creating: false, createError: null }
  );
  const [state, setState] = useState({
    subreal: item?.subreals?.[0]?.id || "",
    qty: "",
  });
  const [validationError, setValidationError] = useState("");

  const dispatch = useDispatch();

  useEffect(() => {
    dispatch(fetchClientsAsync());
    dispatch(getEmployees());
  }, [dispatch]);

  // Проверяем, что товар существует и есть передачи
  if (!item || !item.subreals || item.subreals.length === 0) {
    return (
      <div className="add-modal">
        <div className="add-modal__overlay" onClick={onClose} />
        <div className="add-modal__content" style={{ height: "auto" }}>
          <div className="add-modal__header">
            <h3>Ошибка</h3>
            <X className="add-modal__close-icon" size={20} onClick={onClose} />
          </div>
          <p className="add-modal__error-message">
            Товар не найден или нет передач для возврата
          </p>
        </div>
      </div>
    );
  }

  const onChange = (e) => {
    const { name, value } = e.target;
    setState((prev) => ({ ...prev, [name]: value }));
    setValidationError("");
  };

  const validateForm = () => {
    if (!state.qty || Number(state.qty) <= 0) {
      setValidationError("Введите корректное количество");
      return false;
    }
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    try {
      await dispatch(
        createReturnAsync({
          subreal: state.subreal,
          qty: Number(state.qty),
        })
      ).unwrap();

      alert(`Возврат успешно создан!\nКоличество: ${state.qty}`);

      onChanged?.();
      onClose();
    } catch (error) {
      console.error("Return creation failed:", error);
      alert(
        `Ошибка при создании возврата: ${
          error?.message || "неизвестная ошибка"
        }`
      );
    }
  };

  return (
    <div className="add-modal">
      <div className="add-modal__overlay" onClick={onClose} />
      <div className="add-modal__content" style={{ height: "auto" }}>
        <div className="add-modal__header">
          <h3>Вернуть товар</h3>
          <X className="add-modal__close-icon" size={20} onClick={onClose} />
        </div>

        {createError && (
          <p className="add-modal__error-message">
            Ошибка создания возврата: {createError?.message || "ошибка"}
          </p>
        )}

        {validationError && (
          <p className="add-modal__error-message">{validationError}</p>
        )}

        <form onSubmit={handleSubmit}>
          <div className="add-modal__section">
            <h4>Товар: {item?.product_name || item?.name}</h4>
            <p style={{ opacity: 0.7, margin: "5px 0" }}>
              Текущее количество у агента:{" "}
              <strong>{item?.qty_on_hand || 0}</strong>
            </p>
            <p style={{ opacity: 0.7, margin: "5px 0" }}>
              Доступно для возврата: <strong>{item?.qty_on_hand || 0}</strong>
            </p>
          </div>
          <div className="add-modal__section">
            <label>Количество для возврата *</label>
            <input
              style={{ marginTop: 15, width: "100%" }}
              type="number"
              name="qty"
              placeholder="Количество"
              className="debt__input"
              value={state.qty}
              onChange={onChange}
              min={1}
              max={item?.qty_on_hand || 0}
              step={1}
              required
            />
            <small style={{ opacity: 0.7, marginTop: 5, display: "block" }}>
              Максимум: {item?.qty_on_hand || 0}
            </small>
          </div>

          <button
            style={{
              marginTop: 15,
              width: "100%",
              justifyContent: "center",
            }}
            className="btn edit-btn"
            type="submit"
            disabled={creating}
          >
            {creating ? "Возврат..." : "Вернуть"}
          </button>
        </form>
      </div>
    </div>
  );
};

/* ---- UI ---- */
const toStartOfDay = (d) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
};
const toEndOfDay = (d) => {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
};
const safeDate = (s) => {
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
};

const ProductionAgents = () => {
  const dispatch = useDispatch();
  const {
    list: products,
    categories,
    loading,
    error,
    agentProducts,
    agentProductsLoading,
    agentProductsError,
  } = useProducts();
  const { start: startInAgent } = useAgent();
  // const {}
  const { list: cashBoxes } = useCash();
  const [agents, setAgents] = useState([]);
  const [showAddCashboxModal, setShowAddCashboxModal] = useState(false);
  const [activeTab, setActiveTab] = useState(0);
  const [salesHistory, setSalesHistory] = useState([]);
  const [salesHistoryLoading, setSalesHistoryLoading] = useState(false);
  const [showSaleDetail, setShowSaleDetail] = useState(false);
  const [selectedSaleId, setSelectedSaleId] = useState(null);

  const [cashboxId, setCashboxId] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [showStart, setShowStart] = useState(false);

  // состояние для редактирования
  const [showEdit, setShowEdit] = useState(false);
  const [showMarriageModal, setShowMarriageModal] = useState(false);
  const [showPendingModal, setShowPendingModal] = useState(false);
  const [selectCashBox, setSelectCashBox] = useState("");
  const [showTransferProductModal, setShowTransferProductModal] =
    useState(false);
  const [showAcceptProductModal, setShowAcceptProductModal] = useState(false);
  const [showReturnProductModal, setShowReturnProductModal] = useState(false);
  const [showSellModal, setShowSellModal] = useState(false);
  const { history, start, historyObjects } = useSale();

  const [itemId, setItemId] = useState({});
  const [itemId1, setItemId1] = useState({});
  const [itemId2, setItemId2] = useState({});
  const [itemId3, setItemId3] = useState({});
  const [selectedItem, setSelectedItem] = useState(null);

  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");

  // Фильтр по дате
  const [dateFrom, setDateFrom] = useState(""); // YYYY-MM-DD
  const [dateTo, setDateTo] = useState(""); // YYYY-MM-DD

  const { profile } = useUser();

  useEffect(() => {
    // Загружаем данные в зависимости от роли пользователя
    if (profile?.role === "owner") {
      dispatch(fetchProductsAsync());
    } else {
      dispatch(fetchAgentProductsAsync());
    }

    dispatch(fetchCategoriesAsync());
    dispatch(getCashBoxes());
    dispatch(getItemsMake()); // сырьё для модалки
    dispatch(fetchBrandsAsync());
    // чтобы EditModal сразу имел список поставщиков:
    dispatch(fetchClientsAsync());
  }, [dispatch, profile?.role]);

  const onSaveSuccess = () => {
    setShowAdd(false);
    if (profile?.role === "owner") {
      dispatch(fetchProductsAsync());
    } else {
      dispatch(fetchAgentProductsAsync());
    }
    dispatch(getItemsMake());
  };

  const onEditSaved = () => {
    setShowEdit(false);
    setSelectedItem(null);
    if (profile?.role === "owner") {
      dispatch(fetchProductsAsync());
    } else {
      dispatch(fetchAgentProductsAsync());
    }
  };
  const handleOpen = (id) => {
    setShowMarriageModal(true);
    setItemId(id);
  };
  const handleOpen1 = (item) => {
    setShowTransferProductModal(true);
    setItemId1(item);
  };
  const { company } = useUser();
  const handleOpen2 = (item) => {
    setShowAcceptProductModal(true);
    setItemId2(item);
  };
  const handleOpen3 = (item) => {
    setShowReturnProductModal(true);
    setItemId3(item);
  };

  const onEditDeleted = () => {
    setShowEdit(false);
    setSelectedItem(null);
    if (profile?.role === "owner") {
      dispatch(fetchProductsAsync());
    } else {
      dispatch(fetchAgentProductsAsync());
    }
  };

  const resetFilters = () => {
    setSearch("");
    setCategoryFilter("");
    setDateFrom("");
    setDateTo("");
  };

  useEffect(() => {
    dispatch(getProfile());
    dispatch(
      fetchTransfersAsync(
        profile?.role === "owner" ? {} : { agent: profile?.id }
      )
    );
  }, [dispatch, profile?.role, profile?.id]);
  useEffect(() => {
    if (showSellModal) dispatch(startSale());
  }, [showSellModal, dispatch]);

  useEffect(() => {
    api
      .get("/main/owners/agents/products/")
      .then(({ data }) => {
        setAgents(data);
      })
      .catch((e) => console.log(e));
  }, []);

  // Функция для загрузки истории продаж
  const loadSalesHistory = async () => {
    setSalesHistoryLoading(true);
    try {
      const result = await dispatch(historySellProduct({})).unwrap();
      setSalesHistory(result);
    } catch (error) {
      console.error("Ошибка загрузки истории продаж:", error);
    } finally {
      setSalesHistoryLoading(false);
    }
  };

  // Загружаем историю продаж при переключении на второй таб
  useEffect(() => {
    if (activeTab === 1 && company.sector.name === "Пилорама") {
      loadSalesHistory();
    }
  }, [activeTab, company.sector.name]);

  // Функция для открытия детального просмотра продажи
  const handleShowSaleDetail = (saleId) => {
    setSelectedSaleId(saleId);
    setShowSaleDetail(true);
    dispatch(historySellProductDetail(saleId));
  };

  // Фильтрация по названию, категории и ДАТЕ created_at
  const viewProducts = useMemo(() => {
    const q = search.trim().toLowerCase();
    const from = dateFrom ? toStartOfDay(dateFrom) : null;
    const to = dateTo ? toEndOfDay(dateTo) : null;

    // Выбираем источник данных в зависимости от роли
    let dataSource;
    if (profile?.role === "owner") {
      // Для владельца используем данные агентов
      dataSource = agents.flatMap((agentData) =>
        agentData.products.map((product) => ({
          ...product,
          agent_first_name: agentData.agent.first_name,
          agent_last_name: agentData.agent.last_name,
          agent_track_number: agentData.agent.track_number,
          created_at: product.last_movement_at,
        }))
      );
    } else {
      // Для агента используем agentProducts
      dataSource = agentProducts;
    }

    let filteredProducts = (dataSource || []).filter((p) => {
      const okName =
        !q || (p.name || p.product_name || "").toLowerCase().includes(q);
      const okCat =
        !categoryFilter ||
        String(p.category_id || p.category)?.toLowerCase() ===
          String(categoryFilter).toLowerCase();

      // фильтр по дате (только для владельца, у агентов может не быть created_at)
      if (profile?.role === "owner") {
        const created = safeDate(p.created_at);
        if (!created) return false;
        if (from && created < from) return false;
        if (to && created > to) return false;
      }

      return okName && okCat;
    });

    // Если это агент, показываем только товары с qty_on_hand > 0 (товары на руках)
    if (profile?.role === "agent") {
      filteredProducts = filteredProducts.filter((p) => p.qty_on_hand > 0);
    }

    return filteredProducts.sort((a, b) => {
      // Для агентов сортируем по названию, для владельца по дате
      if (profile?.role === "agent") {
        return (a.product_name || a.name || "").localeCompare(
          b.product_name || b.name || ""
        );
      }
      return new Date(b.created_at) - new Date(a.created_at);
    });
  }, [
    agents,
    agentProducts,
    search,
    categoryFilter,
    dateFrom,
    dateTo,
    profile?.role,
  ]);

  const kindTranslate = {
    new: "Новый",
    paid: "Оплаченный",
    canceled: "Отмененный",
  };
  return (
    <div>
      {/* Табы для сектора Пилорама */}
      {company.sector.name === "Пилорама" && (
        <div className="vitrina__header" style={{ margin: "15px 0" }}>
          <div className="vitrina__tabs">
            <span
              className={`vitrina__tab ${activeTab === 0 ? "active" : ""}`}
              onClick={() => setActiveTab(0)}
              style={{
                cursor: "pointer",
                padding: "8px 16px",
                border: "1px solid #ddd",
                borderRadius: "4px 4px 0 0",
                backgroundColor: activeTab === 0 ? "#ffd400" : "transparent",
                color: activeTab === 0 ? "#000" : "#333",
                marginRight: "4px",
              }}
            >
              Товары агентов
            </span>
            <span
              className={`vitrina__tab ${activeTab === 1 ? "active" : ""}`}
              onClick={() => setActiveTab(1)}
              style={{
                cursor: "pointer",
                padding: "8px 16px",
                border: "1px solid #ddd",
                borderRadius: "4px 4px 0 0",
                backgroundColor: activeTab === 1 ? "#ffd400" : "transparent",
                color: activeTab === 1 ? "#000" : "#333",
              }}
            >
              История продаж
            </span>
          </div>
        </div>
      )}

      {startInAgent && showStart ? (
        <SellStart show={showStart} setShow={setShowStart} />
      ) : (
        <>
          {/* Первый таб - Товары агентов */}
          {(!company.sector.name === "Пилорама" || activeTab === 0) && (
            <div className="sklad__warehouse" style={{ marginTop: "15px" }}>
              <div className="sklad__header">
                <div
                  className="sklad__left"
                  style={{
                    display: "flex",
                    gap: 12,
                    flexWrap: "wrap",
                    alignItems: "center",
                  }}
                >
                  <input
                    type="text"
                    placeholder="Поиск по названию товара"
                    className="sklad__search"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />

                  <div
                    style={{
                      display: "flex",
                      gap: 8,
                      alignItems: "center",
                      flexWrap: "wrap",
                    }}
                  >
                    <label style={{ opacity: 0.7 }}>От</label>
                    <input
                      type="date"
                      className="employee__search-wrapper"
                      value={dateFrom}
                      onChange={(e) => setDateFrom(e.target.value)}
                    />
                    <label style={{ opacity: 0.7 }}>До</label>
                    <input
                      type="date"
                      className="employee__search-wrapper"
                      value={dateTo}
                      onChange={(e) => setDateTo(e.target.value)}
                    />
                    <button
                      type="button"
                      className="sklad__add"
                      style={{ padding: "6px 10px" }}
                      onClick={resetFilters}
                    >
                      Сбросить
                    </button>
                  </div>
                </div>

                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 20,
                    flexWrap: "wrap-reverse",
                    justifyContent: "end",
                  }}
                >
                  {profile?.role !== "owner" ? (
                    <button
                      className="btn edit-btn"
                      onClick={() => setShowPendingModal(true)}
                    >
                      <Plus size={16} style={{ marginRight: 4 }} />
                      Мои передачи
                    </button>
                  ) : (
                    <button
                      className="btn edit-btn"
                      onClick={() => setShowPendingModal(true)}
                    >
                      <Plus size={16} style={{ marginRight: 4 }} />
                      Все передачи
                    </button>
                  )}

                  {company.sector.name === "Пилорама" && (
                    <button
                      className="sklad__add"
                      onClick={() => setShowAddCashboxModal(true)}
                    >
                      Прочие расходы
                    </button>
                  )}

                  {/* <button
                    className="sklad__add"
                    onClick={() => {
                      dispatch(startSaleInAgent());
                      setShowStart(true);
                    }}
                  >
                    <Plus size={16} style={{ marginRight: 4 }} />
                    Продажа товара
                  </button> */}
                </div>
              </div>

              <div style={{ margin: "8px 0", opacity: 0.8 }}>
                Найдено: {viewProducts?.length}
                {viewProducts?.length ? ` из ${viewProducts?.length}` : ""}
              </div>

              {(profile?.role === "owner" ? loading : agentProductsLoading) ? (
                <p className="sklad__loading-message">Загрузка товаров...</p>
              ) : (profile?.role === "owner" ? error : agentProductsError) ? (
                <p className="sklad__error-message">Ошибка загрузки</p>
              ) : viewProducts?.length === 0 ? (
                <p className="sklad__no-products-message">
                  Нет доступных товаров.
                </p>
              ) : (
                <div className="table-wrapper">
                  <table className="sklad__table">
                    <thead>
                      <tr>
                        <th>
                          <input type="checkbox" />
                        </th>
                        <th>№</th>
                        <th>Название</th>
                        {profile?.role === "owner" && <th>Агент</th>}
                        <th>Дата</th>
                        <th>
                          {profile?.role !== "owner"
                            ? "На руках"
                            : "Количество / У агентов"}
                        </th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {console.log(viewProducts)}
                      {viewProducts?.map((item, idx) => (
                        <tr key={item.id || item.product}>
                          <td>
                            <input type="checkbox" />
                          </td>
                          <td>{idx + 1}</td>
                          <td>
                            <strong>{item.product_name || item.name}</strong>
                          </td>
                          {profile?.role === "owner" && (
                            <td>{`${item.agent_last_name} ${
                              item.agent_first_name
                            } ${
                              company.sector.name === "Пилорама"
                                ? `/ номер машины: ${item.agent_track_number}`
                                : ""
                            }`}</td>
                          )}
                          <td>
                            {profile?.role === "owner"
                              ? new Date(
                                  item.created_at || item.last_movement_at
                                ).toLocaleString()
                              : new Date(
                                  item.last_movement_at
                                ).toLocaleString()}
                          </td>
                          <td>
                            {profile?.role !== "owner" ? (
                              item.qty_on_hand > 0 ? (
                                <span className="sell__badge--success">
                                  {item.qty_on_hand}
                                </span>
                              ) : (
                                <span className="sell__badge--danger">
                                  Нет на руках
                                </span>
                              )
                            ) : (
                              <div>
                                <div>У агента: {item.qty_on_hand}</div>
                                {item.subreals && item.subreals.length > 0 && (
                                  <div
                                    style={{ fontSize: "12px", color: "#666" }}
                                  >
                                    Передач: {item.subreals.length}
                                  </div>
                                )}
                              </div>
                            )}
                          </td>
                          <td>
                            {profile?.role !== "owner" && (
                              <button
                                className="btn edit-btn"
                                onClick={() => handleOpen3(item)}
                                disabled={
                                  !item.qty_on_hand || item.qty_on_hand <= 0
                                }
                                title={
                                  !item.qty_on_hand || item.qty_on_hand <= 0
                                    ? "Нет товара для возврата"
                                    : "Вернуть товар"
                                }
                              >
                                Вернуть
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Второй таб - История продаж */}
          {company.sector.name === "Пилорама" && activeTab === 1 && (
            <div className="sklad__warehouse" style={{ marginTop: "15px" }}>
              <div className="sklad__header">
                <h3>История продаж</h3>
                <button
                  className="sklad__add"
                  onClick={loadSalesHistory}
                  disabled={salesHistoryLoading}
                >
                  {salesHistoryLoading ? "Загрузка..." : "Обновить"}
                </button>
              </div>

              {salesHistoryLoading ? (
                <p className="sklad__loading-message">
                  Загрузка истории продаж...
                </p>
              ) : salesHistory.length === 0 ? (
                <p className="sklad__no-products-message">
                  Нет данных о продажах.
                </p>
              ) : (
                <div className="table-wrapper">
                  <table className="sklad__table">
                    <thead>
                      <tr>
                        <th>№</th>
                        <th>Дата</th>
                        <th>Клиент</th>
                        <th>Сумма</th>
                        <th>Статус</th>
                        <th>Действия</th>
                      </tr>
                    </thead>
                    <tbody>
                      {salesHistory.map((sale, idx) => (
                        <tr key={sale.id || idx}>
                          <td>{idx + 1}</td>
                          <td>
                            {sale.created_at
                              ? new Date(sale.created_at).toLocaleString()
                              : "—"}
                          </td>
                          <td>{sale.client_name || "—"}</td>
                          <td>{sale.total || 0}</td>
                          <td>
                            <span
                              className={`sell__badge--${
                                kindTranslate[sale.status] || sale.status
                              }`}
                            >
                              {kindTranslate[sale.status] || sale.status}
                            </span>
                          </td>
                          <td>
                            <button
                              className="btn edit-btn"
                              onClick={() => handleShowSaleDetail(sale.id)}
                              style={{ padding: "4px 8px", fontSize: "12px" }}
                            >
                              Детали
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {showPendingModal && (
        <PendingModal
          onClose={() => setShowPendingModal(false)}
          onChanged={() => {
            if (profile?.role === "owner") {
              dispatch(fetchTransfersAsync());
            } else {
              dispatch(fetchAgentProductsAsync());
            }
          }}
        />
      )}
      {showReturnProductModal && (
        <ReturnProductModal
          onClose={() => setShowReturnProductModal(false)}
          onChanged={() => {
            if (profile?.role === "owner") {
              dispatch(fetchTransfersAsync());
            } else {
              dispatch(fetchAgentProductsAsync());
            }
          }}
          item={itemId3}
        />
      )}
      {showSellModal && (
        <SellModal
          id={start?.id}
          selectCashBox={selectCashBox}
          onClose={() => setShowSellModal(false)}
        />
      )}
      {showAddCashboxModal && (
        <AddCashFlowsModal onClose={() => setShowAddCashboxModal(false)} />
      )}

      {/* Модал детального просмотра продажи */}
      {showSaleDetail && (
        <SaleDetailModal
          onClose={() => {
            setShowSaleDetail(false);
            setSelectedSaleId(null);
          }}
          saleId={selectedSaleId}
        />
      )}
    </div>
  );
};

export default ProductionAgents;
