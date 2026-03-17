import { Plus, Search, LayoutGrid, Table2 } from "lucide-react";
import { useEffect, useMemo, useState, useCallback } from "react";
import { useDispatch } from "react-redux";

import {
  fetchBrandsAsync,
  // fetchCategoriesAsync,
  fetchProductsAsync,
  fetchAgentProductsAsync,
  getItemsMake,
} from "../../../../store/creators/productCreators";

// import { getCashBoxes, useCash } from "../../../../store/slices/cashSlice";

import { useProducts } from "../../../../store/slices/productSlice";

import { X } from "lucide-react";
import { useSelector } from "react-redux";
import { fetchClientsAsync } from "../../../../store/creators/clientCreators";
import { useUser } from "../../../../store/slices/userSlice";
import {
  createReturnAsync,
  fetchTransfersAsync,
  createAcceptanceAsync,
} from "../../../../store/creators/transferCreators";
// import { useClient } from "../../../../store/slices/ClientSlice";
// import { useDepartments } from "../../../../store/slices/departmentSlice";
// import { getEmployees } from "../../../../store/creators/departmentCreators";
import SellModal from "../../../pages/Sell/SellModal";
import { useSale } from "../../../../store/slices/saleSlice";
import { startSale } from "../../../../store/creators/saleThunk";
import SellStart from "./SellStart/SellStart";
import { useAgent } from "../../../../store/slices/agentSlice";
import api from "../../../../api";
import AddCashFlowsModal from "../../../Deposits/Kassa/AddCashFlowsModal/AddCashFlowsModal";
import {
  historySellProduct,
  historySellProductDetail,
  getProductCheckout,
  getProductInvoice,
} from "../../../../store/creators/saleThunk";
import "../../Market/Warehouse/Warehouse.scss";
import "./productionAgents.scss";
import { useAlert } from "@/hooks/useDialog";
import { useDebouncedValue } from "../../../../hooks/useDebounce";
import useResize from "../../../../hooks/useResize";
import DataContainer from "../../../common/DataContainer/DataContainer";
import { validateResErrors } from "../../../../../tools/validateResErrors";

// Компонент для детального просмотра продажи
const SaleDetailModal = ({ onClose, saleId }) => {
  const alert = useAlert();
  const dispatch = useDispatch();
  const { historyDetail: saleDetail } = useSale();

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
        getProductCheckout(saleDetail?.id),
      ).unwrap();
      const url = window.URL.createObjectURL(pdfBlob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "receipt.pdf";
      link.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      const errorMessage = validateResErrors(err, "Ошибка при печати чека");
      alert(errorMessage, true);
    }
  };

  const handlePrintInvoice = async () => {
    try {
      const pdfInvoiceBlob = await dispatch(
        getProductInvoice(saleDetail?.id),
      ).unwrap();
      const url1 = window.URL.createObjectURL(pdfInvoiceBlob);
      const link1 = document.createElement("a");
      link1.href = url1;
      link1.download = "invoice.pdf";
      link1.click();
      window.URL.revokeObjectURL(url1);
    } catch (err) {
      const errorMessage = validateResErrors(
        err,
        "Ошибка при печати накладной",
      );
      alert(errorMessage, true);
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
  const alert = useAlert();
  const dispatch = useDispatch();
  const { list: transfers, loading: transfersLoading } = useSelector(
    (state) => state.transfer || { list: [], loading: false },
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
          transfer.status?.toLowerCase?.() !== "closed",
      );
    }
    // Если это владелец — показываем все передачи (включая closed)

    if (searchQuery) {
      const query = String(searchQuery).toLowerCase();
      filtered = filtered.filter(
        (transfer) =>
          transfer.product_name?.toLowerCase?.().includes(query) ||
          transfer.agent_name?.toLowerCase?.().includes(query),
      );
    }

    return filtered;
  }, [transfers, profile?.id, profile?.role, searchQuery]);

  useEffect(() => {
    dispatch(
      fetchTransfersAsync(
        profile?.role === "owner" ? {} : { agent: profile?.id },
      ),
    );
  }, [dispatch]);

  const handleAcceptTransfer = async (transfer) => {
    try {
      await dispatch(
        createAcceptanceAsync({
          subreal: transfer.id,
          qty: transfer.qty_transferred,
        }),
      ).unwrap();

      alert(`Передача "${transfer.product_name}" успешно принята!`, () => {
        onChanged?.();
        onClose?.();
      });
    } catch (error) {
      const errorMessage = validateResErrors(
        error,
        "Ошибка при принятии передачи",
      );
      alert(errorMessage, true);
    }
  };

  return (
    <div className="add-modal accept">
      <div className="add-modal__overlay z-100!" onClick={onClose} />
      <div
        className="add-modal__content z-100!"
        role="dialog"
        aria-modal="true"
      >
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
          <DataContainer>
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
                    <tr key={transfer.id + idx}>
                      <td data-label="№">{idx + 1}</td>
                      <td data-label="Товар">{transfer.product_name || "—"}</td>
                      {profile?.role === "owner" && (
                        <td data-label="Агент">{transfer.agent_name || "—"}</td>
                      )}
                      <td data-label="Количество">
                        {transfer.qty_transferred || 0}
                      </td>
                      <td data-label="Статус">
                        <span
                          className={`sell__badge--${
                            transfer.status === "open" ? "warning" : "success"
                          }`}
                        >
                          {transfer.status === "open" ? "Открыта" : "Закрыта"}
                        </span>
                      </td>
                      <td data-label="Дата">
                        {new Date(transfer.created_at).toLocaleDateString()}
                      </td>
                      <td data-label="Действия">
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
          </DataContainer>
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
                  profile?.role === "owner" ? {} : { agent: profile?.id },
                ),
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

const MyReturnsModal = ({
  onClose,
  onRefresh,
  loading,
  summary,
  returnsList,
}) => {
  const [searchQuery, setSearchQuery] = useState("");

  const filtered = useMemo(() => {
    const list = Array.isArray(returnsList) ? returnsList : [];
    const q = String(searchQuery || "")
      .toLowerCase()
      .trim();
    if (!q) return list;
    return list.filter((r) => {
      const p = String(
        r?.product || r?.product_name || r?.name || "",
      ).toLowerCase();
      const s = String(r?.status_display || r?.status || "").toLowerCase();
      return p.includes(q) || s.includes(q);
    });
  }, [returnsList, searchQuery]);

  return (
    <div className="add-modal accept my-returns-modal">
      <div className="add-modal__overlay z-100!" onClick={onClose} />
      <div
        className="add-modal__content z-100!"
        role="dialog"
        aria-modal="true"
      >
        <div className="add-modal__header">
          <h3>Мои возвраты</h3>
          <X className="add-modal__close-icon" size={20} onClick={onClose} />
        </div>

        <div className="my-returns-modal__summary">
          Ожидают приёма: <b>{summary?.pending_count ?? 0}</b> возвратов,{" "}
          <b>{summary?.pending_qty ?? 0}</b> шт.
        </div>

        <div className="add-modal__section" style={{ marginBottom: 12 }}>
          <input
            type="text"
            placeholder="Поиск по товару или статусу"
            className="add-modal__input"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ width: "100%" }}
          />
        </div>

        {loading ? (
          <div className="add-modal__section">Загрузка возвратов…</div>
        ) : filtered.length === 0 ? (
          <div className="add-modal__section">Возвратов нет.</div>
        ) : (
          <DataContainer>
            <div
              className="table-wrapper"
              style={{ maxHeight: 420, overflow: "auto" }}
            >
              <table className="sklad__table">
                <thead>
                  <tr>
                    <th>№</th>
                    <th>Товар</th>
                    <th>Количество</th>
                    <th>Статус</th>
                    <th>Дата</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r, idx) => (
                    <tr key={r?.id ?? idx}>
                      <td data-label="№">{idx + 1}</td>
                      <td data-label="Товар">
                        {r?.product || r?.product_name || r?.name || "—"}
                      </td>
                      <td data-label="Количество">{r?.qty ?? 0}</td>
                      <td data-label="Статус">
                        {r?.status_display || r?.status || "—"}
                      </td>
                      <td data-label="Дата">
                        {r?.returned_at
                          ? new Date(r.returned_at).toLocaleDateString()
                          : r?.created_at
                            ? new Date(r.created_at).toLocaleDateString()
                            : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </DataContainer>
        )}

        <div className="add-modal__footer">
          <button className="add-modal__cancel" onClick={onClose}>
            Закрыть
          </button>
          <button
            className="add-modal__save"
            onClick={onRefresh}
            disabled={loading}
          >
            Обновить
          </button>
        </div>
      </div>
    </div>
  );
};

const ReturnProductModal = ({ onClose, onChanged, item }) => {
  const alert = useAlert();
  const { creating, createError } = useSelector(
    (state) => state.return || { creating: false, createError: null },
  );
  const [state, setState] = useState({
    subreal: item?.subreals?.[0]?.id || "",
    qty: "",
  });
  const [validationError, setValidationError] = useState("");

  const dispatch = useDispatch();

  // useEffect(() => {
  // dispatch(fetchClientsAsync());
  // dispatch(getEmployees());
  // }, [dispatch]);

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

  const pendingReturnQty = Number(item?._pending_return_qty || 0) || 0;
  const effectiveOnHand = Math.max(
    0,
    Number(item?.qty_on_hand || 0) - pendingReturnQty,
  );

  const onChange = useCallback((e) => {
    const { name, value } = e.target;
    setState((prev) => ({ ...prev, [name]: value }));
    setValidationError("");
  }, []);

  const validateForm = useCallback(() => {
    if (!state.qty || Number(state.qty) <= 0) {
      setValidationError("Введите корректное количество");
      return false;
    }
    return true;
  }, [state]);

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
        }),
      ).unwrap();

      alert(`Возврат успешно создан!\nКоличество: ${state.qty}`, () => {
        onChanged?.();
        onClose();
      });
    } catch (error) {
      const errorMessage = validateResErrors(
        error,
        "Ошибка при создании возврата",
      );
      alert(errorMessage, true);
    }
  };

  return (
    <div className="add-modal">
      <div className="add-modal__overlay z-100!" onClick={onClose} />
      <div className="add-modal__content z-100!" style={{ height: "auto" }}>
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
              Доступно для возврата: <strong>{effectiveOnHand}</strong>
              {pendingReturnQty > 0 && (
                <span style={{ marginLeft: 8, color: "#6b7280" }}>
                  (в ожидании приёма: {pendingReturnQty})
                </span>
              )}
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
              max={effectiveOnHand}
              step={1}
              required
            />
            <small style={{ opacity: 0.7, marginTop: 5, display: "block" }}>
              Максимум: {effectiveOnHand}
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

const ProductionAgents = () => {
  const alert = useAlert();
  const dispatch = useDispatch();
  const { profile } = useUser();
  const { list: transfers } = useSelector(
    (state) => state.transfer || { list: [] },
  );
  const {
    // list: products,
    loading,
    error,
    agentProducts,
    agentProductsLoading,
    agentProductsError,
  } = useProducts();

  const { start: startInAgent } = useAgent();
  const { isMobile } = useResize((media) => {
    const { isMobile } = media;
    if (isMobile) {
      setViewMode("cards");
    }
  });

  const [agents, setAgents] = useState([]);
  const [showAddCashboxModal, setShowAddCashboxModal] = useState(false);
  const [activeTab, setActiveTab] = useState(0);
  const [salesHistory, setSalesHistory] = useState([]);
  const [salesHistoryLoading, setSalesHistoryLoading] = useState(false);
  const [showSaleDetail, setShowSaleDetail] = useState(false);
  const [selectedSaleId, setSelectedSaleId] = useState(null);

  // const [cashboxId, setCashboxId] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [showStart, setShowStart] = useState(false);

  // состояние для редактирования
  const [showEdit, setShowEdit] = useState(false);
  const [showMarriageModal, setShowMarriageModal] = useState(false);
  const [showPendingModal, setShowPendingModal] = useState(false);
  const [showMyReturnsModal, setShowMyReturnsModal] = useState(false);
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

  const [myReturnsLoading, setMyReturnsLoading] = useState(false);
  const [myReturns, setMyReturns] = useState([]);
  const [myReturnsSummary, setMyReturnsSummary] = useState({
    pending_count: 0,
    pending_qty: 0,
  });

  const [search, setSearch] = useState("");
  // Debounce для поиска
  const debouncedSearch = useDebouncedValue(search, 400);
  const [categoryFilter, setCategoryFilter] = useState("");

  // Фильтр по дате
  const [dateFrom, setDateFrom] = useState(""); // YYYY-MM-DD
  const [dateTo, setDateTo] = useState(""); // YYYY-MM-DD

  const agentProductsParams = useMemo(() => {
    const params = {};
    if (debouncedSearch) params.search = debouncedSearch;
    if (dateFrom) params.date_from = dateFrom;
    if (dateTo) params.date_to = dateTo;
    return params;
  }, [debouncedSearch, dateFrom, dateTo]);

  // Обновление списка передач (для агента — только свои)
  const refreshTransfers = useCallback(() => {
    dispatch(
      fetchTransfersAsync(
        profile?.role === "owner" ? {} : { agent: profile?.id },
      ),
    );
  }, [dispatch, profile?.id, profile?.role]);

  const loadMyReturns = useCallback(async () => {
    if (profile?.role === "owner") return;
    setMyReturnsLoading(true);
    try {
      const { data } = await api.get("/main/agents/me/returns/");
      const list = Array.isArray(data) ? data : data?.results || [];
      setMyReturns(list);
      setMyReturnsSummary(
        data?.returns_summary || { pending_count: 0, pending_qty: 0 },
      );
    } catch (e) {
      const errorMessage = validateResErrors(
        e,
        "Ошибка при загрузке моих возвратов",
      );
      alert(errorMessage, true);
      setMyReturns([]);
      setMyReturnsSummary({ pending_count: 0, pending_qty: 0 });
    } finally {
      setMyReturnsLoading(false);
    }
  }, [profile?.role]);

  // Обновление списка товаров у агентов для owner (локальный state `agents`)
  const loadAgentsProducts = useCallback(() => {
    if (profile?.role !== "owner") return;
    const params = {};
    if (dateFrom) params.date_from = dateFrom;
    if (dateTo) params.date_to = dateTo;
    api
      .get("/main/owners/agents/products/", { params })
      .then(({ data }) => {
        setAgents(data);
      })
      .catch((e) => console.log(e));
  }, [profile?.role, dateFrom, dateTo]);

  // Обновление основного списка товаров на странице
  const refreshProductsList = useCallback(() => {
    if (profile?.role === "owner") {
      loadAgentsProducts();
    } else {
      // Важно: сохраняем текущие фильтры/поиск/дату
      dispatch(fetchAgentProductsAsync(agentProductsParams));
    }
  }, [dispatch, profile?.role, agentProductsParams, loadAgentsProducts]);

  // После "Принять" и "Вернуть" — обновляем и товары, и передачи
  const refreshAfterAcceptOrReturn = useCallback(() => {
    refreshTransfers();
    refreshProductsList();
    loadMyReturns();
  }, [refreshTransfers, refreshProductsList, loadMyReturns]);

  // View mode (table/cards)
  const STORAGE_KEY = "production_agents_view_mode";
  const getInitialViewMode = () => {
    if (typeof window === "undefined") return "table";
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === "table" || saved === "cards") return saved;
    const isSmall = window.matchMedia("(max-width: 1199px)").matches;
    return isSmall ? "cards" : "table";
  };
  const [viewMode, setViewMode] = useState(getInitialViewMode);
  // Сохраняем режим просмотра в localStorage
  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY, viewMode);
    }
  }, [viewMode]);

  useEffect(() => {
    if (profile?.role === "owner") {
      dispatch(fetchProductsAsync());
    } else {
      dispatch(fetchAgentProductsAsync(agentProductsParams));
    }
  }, [agentProductsParams, dispatch, profile?.role]);
  useEffect(() => {
    // dispatch(fetchCategoriesAsync());
    // dispatch(getCashBoxes());
    dispatch(getItemsMake()); // сырьё для модалки
    dispatch(fetchBrandsAsync());
    // чтобы EditModal сразу имел список поставщиков:
    dispatch(fetchClientsAsync());
  }, [dispatch]);

  const onSaveSuccess = () => {
    setShowAdd(false);
    if (profile?.role === "owner") {
      dispatch(fetchProductsAsync());
    } else {
      dispatch(fetchAgentProductsAsync(agentProductsParams));
    }
    dispatch(getItemsMake());
  };

  const onEditSaved = () => {
    setShowEdit(false);
    setSelectedItem(null);
    if (profile?.role === "owner") {
      dispatch(fetchProductsAsync());
    } else {
      dispatch(fetchAgentProductsAsync(agentProductsParams));
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
    // прокидываем количество, которое уже в "ожидает приёма" (чтобы вычиталось из доступного)
    const pendingQty = getPendingReturnQtyForItem(item);
    setItemId3({ ...item, _pending_return_qty: pendingQty });
  };

  const onEditDeleted = () => {
    setShowEdit(false);
    setSelectedItem(null);
    if (profile?.role === "owner") {
      dispatch(fetchProductsAsync());
    } else {
      dispatch(fetchAgentProductsAsync(agentProductsParams));
    }
  };

  const resetFilters = useCallback(() => {
    setSearch("");
    setCategoryFilter("");
    setDateFrom("");
    setDateTo("");
  }, []);

  useEffect(() => {
    // dispatch(getProfile());
    refreshTransfers();
    loadMyReturns();
  }, [refreshTransfers, loadMyReturns]);
  useEffect(() => {
    if (showSellModal) dispatch(startSale());
  }, [showSellModal, dispatch]);

  useEffect(() => {
    loadAgentsProducts();
  }, [loadAgentsProducts]);

  // Обработчик для кнопки "Продать товар"
  const handleStartSale = async () => {
    try {
      await dispatch(startSaleInAgent()).unwrap();
      setShowStart(true);
    } catch (error) {
      const errorMessage = validateResErrors(
        error,
        "Ошибка при инициализации продажи",
      );
      alert(errorMessage, true);
    }
  };

  // Функция для загрузки истории продаж
  const loadSalesHistory = useCallback(async () => {
    setSalesHistoryLoading(true);
    try {
      const result = await dispatch(historySellProduct({})).unwrap();
      setSalesHistory(result);
    } catch (error) {
      const errorMessage = validateResErrors(
        error,
        "Ошибка загрузки истории продаж",
      );
      alert(errorMessage, true);
    } finally {
      setSalesHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 1 && company.sector.name === "Пилорама") {
      loadSalesHistory();
    }
  }, [activeTab, company.sector.name]);

  // Функция для открытия детального просмотра продажи
  const handleShowSaleDetail = useCallback((saleId) => {
    setSelectedSaleId(saleId);
    setShowSaleDetail(true);
    dispatch(historySellProductDetail(saleId));
  }, []);

  // Фильтрация по названию, категории и ДАТЕ created_at
  const pendingReturnQtyBySubrealId = useMemo(() => {
    const map = new Map();
    (Array.isArray(myReturns) ? myReturns : []).forEach((r) => {
      const status = String(r?.status || "").toLowerCase();
      if (status !== "pending") return;
      const sid = r?.subreal || r?.subreal_id || r?.subreal?.id;
      if (!sid) return;
      const qty = Number(r?.qty || 0) || 0;
      if (qty <= 0) return;
      map.set(String(sid), (map.get(String(sid)) || 0) + qty);
    });
    return map;
  }, [myReturns]);

  const getPendingReturnQtyForItem = useCallback(
    (item) => {
      const subreals = Array.isArray(item?.subreals) ? item.subreals : [];
      if (subreals.length === 0) return 0;
      let sum = 0;
      subreals.forEach((sr) => {
        const sid = sr?.id ?? sr;
        if (!sid) return;
        sum += pendingReturnQtyBySubrealId.get(String(sid)) || 0;
      });
      return sum;
    },
    [pendingReturnQtyBySubrealId],
  );

  const viewProducts = useMemo(() => {
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
        })),
      );
    } else {
      // Для агента используем agentProducts
      dataSource = agentProducts;
    }

    let filteredProducts = (dataSource || []).filter(() => true);

    // Если это агент, показываем только товары с qty_on_hand > 0 (товары на руках)
    if (profile?.role !== "owner") {
      filteredProducts = filteredProducts
        .map((p) => {
          const pendingQty = getPendingReturnQtyForItem(p);
          const effective = Math.max(
            0,
            Number(p?.qty_on_hand || 0) - Number(pendingQty || 0),
          );
          return {
            ...p,
            qty_on_hand_effective: effective,
            _pending_return_qty: pendingQty,
          };
        })
        .filter((p) => (p.qty_on_hand_effective || 0) > 0);
    }

    return filteredProducts.sort((a, b) => {
      // Для агентов сортируем по названию, для владельца по дате
      if (profile?.role === "agent") {
        return (a.product_name || a.name || "").localeCompare(
          b.product_name || b.name || "",
        );
      }
      return new Date(b.created_at) - new Date(a.created_at);
    });
  }, [
    agents,
    agentProducts,
    categoryFilter,
    profile?.role,
    getPendingReturnQtyForItem,
  ]);

  const pendingTransfersSummary = useMemo(() => {
    if (profile?.role === "owner") return { count: 0, qty: 0 };
    const list = Array.isArray(transfers) ? transfers : [];
    const mine = list.filter((t) => t.agent === profile?.id);
    const open = mine.filter(
      (t) => String(t?.status || "").toLowerCase() === "open",
    );
    const count = open.length;
    const qty = open.reduce(
      (acc, t) => acc + (Number(t?.qty_transferred || 0) || 0),
      0,
    );
    return { count, qty };
  }, [transfers, profile?.id, profile?.role]);

  const formatPrice = useCallback(
    (price) => parseFloat(price || 0).toFixed(2),
    [],
  );

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
            <div className="warehouse-page">
              {/* Header */}
              <div className="warehouse-header">
                <div className="warehouse-header__left">
                  <div className="warehouse-header__icon">
                    <div className="warehouse-header__icon-box">👤</div>
                  </div>
                  <div className="warehouse-header__title-section">
                    <h1 className="warehouse-header__title">
                      {profile?.role === "owner"
                        ? "Товары агентов"
                        : "Мои товары"}
                    </h1>
                    <p className="warehouse-header__subtitle">
                      {profile?.role === "owner"
                        ? "Управление товарами у агентов"
                        : "Товары на руках"}
                    </p>
                  </div>
                </div>
                <div className="flex mx-auto gap-3 lg:mr-0 flex-wrap justify-center">
                  {profile?.role !== "owner" ? (
                    <div className="flex gap-2 align-middle">
                      {" "}
                      <button
                        className="warehouse-header__create-btn"
                        onClick={() => setShowPendingModal(true)}
                      >
                        <Plus size={16} />
                        Мои передачи
                        {pendingTransfersSummary.count > 0 && (
                          <span className="pa-badge">
                            {pendingTransfersSummary.count}
                          </span>
                        )}
                      </button>
                      <button
                        className="warehouse-header__create-btn"
                        onClick={() => setShowMyReturnsModal(true)}
                      >
                        Мои возвраты
                        {(myReturnsSummary?.pending_count || 0) > 0 && (
                          <span className="pa-badge pa-badge--warning">
                            {myReturnsSummary.pending_count}
                          </span>
                        )}
                      </button>
                      {/* <button className="warehouse-header__create-btn" onClick={handleStartSale}>
                  <Plus size={16} />
                  Продать товар
                </button> */}
                    </div>
                  ) : (
                    <button
                      className="warehouse-header__create-btn"
                      onClick={() => setShowPendingModal(true)}
                    >
                      <Plus size={16} />
                      Все передачи
                    </button>
                  )}

                  {company.sector.name === "Пилорама" && (
                    <button
                      className="warehouse-header__create-btn"
                      onClick={() => setShowAddCashboxModal(true)}
                    >
                      Прочие расходы
                    </button>
                  )}
                </div>
              </div>

              {/* Search and Filters */}
              <div className="warehouse-search-section">
                <div className="warehouse-search">
                  <Search className="warehouse-search__icon" size={18} />
                  <input
                    type="text"
                    className="warehouse-search__input"
                    placeholder="Поиск по названию товара..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>

                <div className="warehouse-search__info flex flex-wrap items-center gap-2">
                  <span className="">
                    Всего: {viewProducts?.length || 0} • Найдено:{" "}
                    {viewProducts?.length || 0}
                  </span>

                  {/* Date filters */}
                  <div className="flex w-full justify-center md:w-auto items-center gap-2 flex-wrap">
                    <div className="flex-1 md:flex-none flex items-center justify-between gap-2">
                      <label className="text-sm text-slate-600">От:</label>
                      <input
                        type="date"
                        className="warehouse-search__input flex-1 min-w-35"
                        style={{ minWidth: "140px" }}
                        value={dateFrom}
                        onChange={(e) => setDateFrom(e.target.value)}
                      />
                    </div>
                    <div className="flex-1 md:flex-none flex items-center justify-between gap-2">
                      <label className="text-sm text-slate-600">До:</label>
                      <input
                        type="date"
                        className="warehouse-search__input flex-1 min-w-35"
                        value={dateTo}
                        onChange={(e) => setDateTo(e.target.value)}
                      />
                    </div>
                    {(dateFrom || dateTo || search || categoryFilter) && (
                      <button
                        type="button"
                        className="warehouse-search__filter-btn"
                        onClick={resetFilters}
                      >
                        Сбросить
                      </button>
                    )}
                  </div>

                  {/* View toggle */}
                  {!isMobile && (
                    <div className="flex items-center justify-center gap-2">
                      <button
                        type="button"
                        onClick={() => setViewMode("table")}
                        className={`warehouse-view-btn inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm transition ${
                          viewMode === "table"
                            ? "bg-slate-900 text-white border-slate-900"
                            : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                        }`}
                      >
                        <Table2 size={16} />
                        Таблица
                      </button>

                      <button
                        type="button"
                        onClick={() => setViewMode("cards")}
                        className={`warehouse-view-btn inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm transition ${
                          viewMode === "cards"
                            ? "bg-slate-900 text-white border-slate-900"
                            : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                        }`}
                      >
                        <LayoutGrid size={16} />
                        Карточки
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Products */}
              <DataContainer>
                <div className="warehouse-table-container w-full">
                  {/* ===== TABLE ===== */}
                  {viewMode === "table" && (
                    <div
                      key={"table"}
                      className="overflow-auto rounded-2xl border border-slate-200 bg-white shadow-sm"
                    >
                      <table className="warehouse-table w-full min-w-225">
                        <thead>
                          <tr>
                            <th>№</th>
                            <th>Название</th>
                            {profile?.role === "owner" && <th>Агент</th>}
                            <th>Дата</th>
                            <th>
                              {profile?.role !== "owner"
                                ? "На руках"
                                : "Количество / У агентов"}
                            </th>
                            {profile?.role !== "owner" && <th>Действия</th>}
                          </tr>
                        </thead>

                        <tbody>
                          {(
                            profile?.role === "owner"
                              ? loading
                              : agentProductsLoading
                          ) ? (
                            <tr>
                              <td
                                colSpan={profile?.role === "owner" ? 6 : 5}
                                className="warehouse-table__loading"
                              >
                                Загрузка...
                              </td>
                            </tr>
                          ) : (
                              profile?.role === "owner"
                                ? error
                                : agentProductsError
                            ) ? (
                            <tr>
                              <td
                                colSpan={profile?.role === "owner" ? 6 : 5}
                                className="warehouse-table__empty"
                              >
                                Ошибка загрузки
                              </td>
                            </tr>
                          ) : viewProducts?.length === 0 ? (
                            <tr>
                              <td
                                colSpan={profile?.role === "owner" ? 6 : 5}
                                className="warehouse-table__empty"
                              >
                                Товары не найдены
                              </td>
                            </tr>
                          ) : (
                            viewProducts?.map((item, idx) => (
                              <tr
                                key={item.id}
                                className="warehouse-table__row"
                              >
                                <td>{idx + 1}</td>
                                <td className="warehouse-table__name">
                                  <div className="warehouse-table__name-cell">
                                    <span>
                                      {item.product_name || item.name || "—"}
                                    </span>
                                  </div>
                                </td>
                                {profile?.role === "owner" && (
                                  <td>
                                    {`${item.agent_last_name || ""} ${
                                      item.agent_first_name || ""
                                    } ${
                                      company.sector.name === "Пилорама"
                                        ? `/ номер машины: ${
                                            item.agent_track_number || ""
                                          }`
                                        : ""
                                    }`}
                                  </td>
                                )}
                                <td>
                                  {profile?.role === "owner"
                                    ? new Date(
                                        item.created_at ||
                                          item.last_movement_at,
                                      ).toLocaleDateString()
                                    : new Date(
                                        item.last_movement_at,
                                      ).toLocaleDateString()}
                                </td>
                                <td>
                                  {profile?.role !== "owner" ? (
                                    (item.qty_on_hand_effective ??
                                      item.qty_on_hand) > 0 ? (
                                      <span
                                        style={{
                                          padding: "4px 8px",
                                          background: "#d1fae5",
                                          color: "#059669",
                                          borderRadius: "6px",
                                          fontSize: "12px",
                                          fontWeight: "600",
                                        }}
                                      >
                                        {item.qty_on_hand_effective ??
                                          item.qty_on_hand}
                                      </span>
                                    ) : (
                                      <span
                                        style={{
                                          padding: "4px 8px",
                                          background: "#fee2e2",
                                          color: "#dc2626",
                                          borderRadius: "6px",
                                          fontSize: "12px",
                                          fontWeight: "600",
                                        }}
                                      >
                                        Нет на руках
                                      </span>
                                    )
                                  ) : (
                                    <div
                                      style={{
                                        display: "flex",
                                        flexDirection: "column",
                                        gap: "4px",
                                      }}
                                    >
                                      <div>
                                        У агента: {item.qty_on_hand || 0}
                                      </div>
                                      {item.subreals &&
                                        item.subreals.length > 0 && (
                                          <div
                                            style={{
                                              fontSize: "12px",
                                              color: "#666",
                                            }}
                                          >
                                            Передач: {item.subreals.length}
                                          </div>
                                        )}
                                    </div>
                                  )}
                                </td>
                                {profile?.role !== "owner" && (
                                  <td onClick={(e) => e.stopPropagation()}>
                                    <button
                                      className="warehouse-header__create-btn"
                                      style={{
                                        padding: "6px 12px",
                                        fontSize: "12px",
                                        background: "#ef4444",
                                        color: "white",
                                      }}
                                      onClick={() => handleOpen3(item)}
                                      disabled={
                                        !(
                                          item.qty_on_hand_effective ??
                                          item.qty_on_hand
                                        ) ||
                                        (item.qty_on_hand_effective ??
                                          item.qty_on_hand) <= 0
                                      }
                                      title={
                                        !(
                                          item.qty_on_hand_effective ??
                                          item.qty_on_hand
                                        ) ||
                                        (item.qty_on_hand_effective ??
                                          item.qty_on_hand) <= 0
                                          ? "Нет товара для возврата"
                                          : "Вернуть товар"
                                      }
                                    >
                                      Вернуть
                                    </button>
                                  </td>
                                )}
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* ===== CARDS ===== */}
                  {viewMode === "cards" && (
                    <div key={"cards"} className="block">
                      {(
                        profile?.role === "owner"
                          ? loading
                          : agentProductsLoading
                      ) ? (
                        <div className="warehouse-table__loading rounded-2xl border border-slate-200 bg-white p-6 text-center text-slate-600">
                          Загрузка...
                        </div>
                      ) : (
                          profile?.role === "owner" ? error : agentProductsError
                        ) ? (
                        <div className="warehouse-table__empty rounded-2xl border border-slate-200 bg-white p-6 text-center text-slate-600">
                          Ошибка загрузки
                        </div>
                      ) : viewProducts?.length === 0 ? (
                        <div className="warehouse-table__empty rounded-2xl border border-slate-200 bg-white p-6 text-center text-slate-600">
                          Товары не найдены
                        </div>
                      ) : (
                        <div className="warehouse-cards grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                          {viewProducts?.map((item, idx) => (
                            <div
                              key={item.id}
                              className="warehouse-table__row warehouse-card cursor-pointer rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-px hover:shadow-md"
                            >
                              <div className="min-w-0 flex-1">
                                <div className="text-xs text-slate-500">
                                  #{idx + 1}
                                </div>
                                <div className="warehouse-table__name mt-0.5 truncate text-sm font-semibold text-slate-900">
                                  {item.product_name || item.name || "—"}
                                </div>

                                {profile?.role === "owner" && (
                                  <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-600">
                                    <span className="whitespace-nowrap">
                                      Агент:{" "}
                                      <span className="font-medium">
                                        {`${item.agent_last_name || ""} ${
                                          item.agent_first_name || ""
                                        }`}
                                      </span>
                                    </span>
                                    {company.sector.name === "Пилорама" && (
                                      <span className="whitespace-nowrap">
                                        Машина:{" "}
                                        <span className="font-medium">
                                          {item.agent_track_number || "—"}
                                        </span>
                                      </span>
                                    )}
                                  </div>
                                )}
                              </div>

                              <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                                <div className="rounded-xl bg-slate-50 p-2">
                                  <div className="text-slate-500">Дата</div>
                                  <div className="mt-0.5 font-semibold text-slate-900">
                                    {profile?.role === "owner"
                                      ? new Date(
                                          item.created_at ||
                                            item.last_movement_at,
                                        ).toLocaleDateString()
                                      : new Date(
                                          item.last_movement_at,
                                        ).toLocaleDateString()}
                                  </div>
                                </div>

                                <div className="rounded-xl bg-slate-50 p-2">
                                  <div className="text-slate-500">
                                    {profile?.role !== "owner"
                                      ? "На руках"
                                      : "У агента"}
                                  </div>
                                  <div className="mt-0.5 font-semibold text-slate-900">
                                    {(item.qty_on_hand_effective ??
                                      item.qty_on_hand) > 0 ? (
                                      <span
                                        style={{
                                          padding: "2px 6px",
                                          background: "#d1fae5",
                                          color: "#059669",
                                          borderRadius: "4px",
                                          fontSize: "11px",
                                        }}
                                      >
                                        {item.qty_on_hand_effective ??
                                          item.qty_on_hand}
                                      </span>
                                    ) : (
                                      <span
                                        style={{
                                          padding: "2px 6px",
                                          background: "#fee2e2",
                                          color: "#dc2626",
                                          borderRadius: "4px",
                                          fontSize: "11px",
                                        }}
                                      >
                                        Нет на руках
                                      </span>
                                    )}
                                  </div>
                                </div>

                                {profile?.role === "owner" &&
                                  item.subreals &&
                                  item.subreals.length > 0 && (
                                    <div className="col-span-2 rounded-xl bg-slate-50 p-2">
                                      <div className="text-slate-500">
                                        Передач
                                      </div>
                                      <div className="mt-0.5 font-semibold text-slate-900">
                                        {item.subreals.length}
                                      </div>
                                    </div>
                                  )}
                              </div>

                              {profile?.role !== "owner" && (
                                <div
                                  className="mt-4 flex flex-wrap gap-2"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <button
                                    className="warehouse-header__create-btn"
                                    style={{
                                      padding: "6px 12px",
                                      fontSize: "12px",
                                      background: "#ef4444",
                                      color: "white",
                                      flex: "1",
                                      minWidth: "80px",
                                    }}
                                    onClick={() => handleOpen3(item)}
                                    disabled={
                                      !(
                                        item.qty_on_hand_effective ??
                                        item.qty_on_hand
                                      ) ||
                                      (item.qty_on_hand_effective ??
                                        item.qty_on_hand) <= 0
                                    }
                                  >
                                    Вернуть
                                  </button>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </DataContainer>
            </div>
          )}

          {/* Второй таб - История продаж */}
          {company.sector.name === "Пилорама" && activeTab === 1 && (
            <div className="warehouse-page">
              {/* Header */}
              <div className="warehouse-header">
                <div className="warehouse-header__left">
                  <div className="warehouse-header__icon">
                    <div className="warehouse-header__icon-box">📊</div>
                  </div>
                  <div className="warehouse-header__title-section">
                    <h1 className="warehouse-header__title">История продаж</h1>
                    <p className="warehouse-header__subtitle">
                      Просмотр истории продаж
                    </p>
                  </div>
                </div>
                <button
                  className="warehouse-header__create-btn"
                  onClick={loadSalesHistory}
                  disabled={salesHistoryLoading}
                >
                  {salesHistoryLoading ? "Загрузка..." : "Обновить"}
                </button>
              </div>

              {/* Sales History Table */}
              <div className="warehouse-table-container w-full">
                <div className="overflow-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
                  <table className="warehouse-table w-full min-w-[800px]">
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
                      {salesHistoryLoading ? (
                        <tr>
                          <td colSpan={6} className="warehouse-table__loading">
                            Загрузка истории продаж...
                          </td>
                        </tr>
                      ) : salesHistory.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="warehouse-table__empty">
                            Нет данных о продажах
                          </td>
                        </tr>
                      ) : (
                        salesHistory.map((sale, idx) => (
                          <tr
                            key={sale.id || idx}
                            className="warehouse-table__row"
                          >
                            <td>{idx + 1}</td>
                            <td>
                              {sale.created_at
                                ? new Date(sale.created_at).toLocaleString()
                                : "—"}
                            </td>
                            <td>{sale.client_name || "—"}</td>
                            <td>{formatPrice(sale.total)}</td>
                            <td>
                              <span
                                style={{
                                  padding: "4px 8px",
                                  background:
                                    sale.status === "paid"
                                      ? "#d1fae5"
                                      : sale.status === "canceled"
                                        ? "#fee2e2"
                                        : "#fef3c7",
                                  color:
                                    sale.status === "paid"
                                      ? "#059669"
                                      : sale.status === "canceled"
                                        ? "#dc2626"
                                        : "#d97706",
                                  borderRadius: "6px",
                                  fontSize: "12px",
                                  fontWeight: "600",
                                }}
                              >
                                {kindTranslate[sale.status] || sale.status}
                              </span>
                            </td>
                            <td onClick={(e) => e.stopPropagation()}>
                              <button
                                className="warehouse-header__create-btn"
                                style={{
                                  padding: "6px 12px",
                                  fontSize: "12px",
                                  background: "#3b82f6",
                                  color: "white",
                                }}
                                onClick={() => handleShowSaleDetail(sale.id)}
                              >
                                Детали
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {showPendingModal && (
        <PendingModal
          onClose={() => setShowPendingModal(false)}
          onChanged={() => {
            refreshAfterAcceptOrReturn();
          }}
        />
      )}
      {showReturnProductModal && (
        <ReturnProductModal
          onClose={() => setShowReturnProductModal(false)}
          onChanged={() => {
            refreshAfterAcceptOrReturn();
          }}
          item={itemId3}
        />
      )}
      {showMyReturnsModal && (
        <MyReturnsModal
          onClose={() => setShowMyReturnsModal(false)}
          onRefresh={loadMyReturns}
          loading={myReturnsLoading}
          summary={myReturnsSummary}
          returnsList={myReturns}
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
