import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import {
  X,
  Wallet,
  Calendar,
  DollarSign,
  ShoppingCart,
  Store,
  TrendingUp,
  TrendingDown,
  RefreshCw,
  CheckCircle,
  XCircle,
  ChevronDown,
  FileText,
  HelpCircle,
  User,
  Banknote,
  CreditCard,
  AlertCircle,
} from "lucide-react";
import AlertModal from "../../common/AlertModal/AlertModal";
import {
  fetchShiftByIdAsync,
  fetchShiftSalesAsync,
} from "../../../store/creators/shiftThunk";
import "./ShiftDetail.scss";

const ShiftDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { currentShift, loading } = useSelector((state) => state.shifts);
  const [activeTab, setActiveTab] = useState("products");
  const [alertModal, setAlertModal] = useState({
    open: false,
    type: "error",
    title: "",
    message: "",
    onConfirm: null,
  });
  const [salesHistory, setSalesHistory] = useState([]);
  const [salesLoading, setSalesLoading] = useState(false);
  const [salesError, setSalesError] = useState(null);
  const [moneyMovements, setMoneyMovements] = useState([]);
  const [moneyLoading, setMoneyLoading] = useState(false);
  const [moneyError, setMoneyError] = useState(null);
  const [filters, setFilters] = useState({
    status: "",
    payment_method: "",
    q: "",
  });
  const [moneyFilters, setMoneyFilters] = useState({
    status: "",
    payment_method: "",
    q: "",
  });

  const shift = currentShift;

  useEffect(() => {
    if (id) {
      dispatch(fetchShiftByIdAsync(id));
    }
  }, [id, dispatch]);

  // Загрузка истории продаж
  useEffect(() => {
    const loadSalesHistory = async () => {
      if (!id) return;

      setSalesLoading(true);
      setSalesError(null);

      try {
        const searchParams = {};

        if (filters.status) {
          searchParams.status = filters.status;
        }

        if (filters.payment_method) {
          searchParams.payment_method = filters.payment_method;
        }

        if (filters.q) {
          searchParams.q = filters.q;
        }

        const result = await dispatch(
          fetchShiftSalesAsync({
            shiftId: id,
            params: searchParams,
          })
        ).unwrap();
        setSalesHistory(result?.results || []);
      } catch (error) {
        console.error("Ошибка при загрузке истории продаж:", error);
        setSalesError("Не удалось загрузить историю продаж");
        setSalesHistory([]);
      } finally {
        setSalesLoading(false);
      }
    };

    // Debounce для поиска
    const timeoutId = setTimeout(
      () => {
        loadSalesHistory();
      },
      filters.q ? 500 : 0
    );

    return () => clearTimeout(timeoutId);
  }, [id, dispatch, filters.status, filters.payment_method, filters.q]);

  // Загрузка движения денег
  useEffect(() => {
    const loadMoneyMovements = async () => {
      if (!id) return;

      setMoneyLoading(true);
      setMoneyError(null);

      try {
        const searchParams = {};

        if (moneyFilters.status) {
          searchParams.status = moneyFilters.status;
        }

        if (moneyFilters.payment_method) {
          searchParams.payment_method = moneyFilters.payment_method;
        }

        if (moneyFilters.q) {
          searchParams.q = moneyFilters.q;
        }

        const result = await dispatch(
          fetchShiftSalesAsync({
            shiftId: id,
            params: searchParams,
          })
        ).unwrap();

        // Преобразуем продажи в движение денег
        const movements = (result?.results || []).map((sale) => ({
          id: sale.id,
          type: "income",
          date: sale.created_at || sale.paid_at,
          counterparty: sale.client_name || "—",
          account: shift?.cashbox_name || "Касса",
          tag: "Оплата от клиента",
          amount: parseFloat(sale.total || 0),
          payment_method: sale.payment_method || "—",
          cashier: sale.cashier_display || "—",
        }));

        setMoneyMovements(movements);
      } catch (error) {
        console.error("Ошибка при загрузке движения денег:", error);
        setMoneyError("Не удалось загрузить движение денег");
        setMoneyMovements([]);
      } finally {
        setMoneyLoading(false);
      }
    };

    // Debounce для поиска
    const timeoutId = setTimeout(
      () => {
        loadMoneyMovements();
      },
      moneyFilters.q ? 500 : 0
    );

    return () => clearTimeout(timeoutId);
  }, [
    id,
    dispatch,
    moneyFilters.status,
    moneyFilters.payment_method,
    moneyFilters.q,
    shift?.cashbox_name,
  ]);

  const formatDate = (dateString) => {
    if (!dateString) return "-";
    try {
      const date = new Date(dateString);
      const day = date.getDate();
      const month = date.toLocaleDateString("ru-RU", { month: "long" });
      const hours = String(date.getHours()).padStart(2, "0");
      const minutes = String(date.getMinutes()).padStart(2, "0");
      return `${day} ${month} ${hours}:${minutes}`;
    } catch {
      return dateString;
    }
  };

  const closeAlert = () => {
    setAlertModal((prev) => ({ ...prev, open: false, onConfirm: null }));
  };

  const handleConfirm = () => {
    if (alertModal.onConfirm) {
      alertModal.onConfirm();
    }
    closeAlert();
  };

  // Преобразование данных продаж для отображения
  const productMovements = salesHistory.map((sale) => ({
    id: sale.id,
    docNumber: sale.doc_number,
    type: "sale",
    date: sale.created_at || sale.paid_at,
    store: sale.branch || shift?.branch || "—",
    client: sale.client_name || "—",
    cashier: sale.cashier_display || "—",
    status: sale.status || "paid",
    positions: sale.items?.length || 0,
    amount: parseFloat(sale.total || 0),
  }));

  const productList = [
    { name: "Дрож кова 80г", quantity: 2.0, salesAmount: 70.0, profit: 70.0 },
    { name: "Кар туз", quantity: 1.0, salesAmount: 25.0, profit: 25.0 },
    { name: "Кок пияз", quantity: 1.0, salesAmount: 22.0, profit: 22.0 },
    {
      name: "Колбаса Тойбосс",
      quantity: 2.0,
      salesAmount: 940.0,
      profit: 940.0,
    },
    {
      name: 'Минеральная вода "Жалал-Абад 27 источник"',
      quantity: 2.0,
      salesAmount: 0.0,
      profit: 0.0,
    },
    {
      name: "Мойенез 10кг",
      quantity: 1.0,
      salesAmount: 1500.0,
      profit: 1500.0,
    },
    {
      name: "Огурцы SONUN 3л",
      quantity: 1.0,
      salesAmount: 290.0,
      profit: 290.0,
    },
  ];

  if (loading) {
    return (
      <div className="shift-detail-page">
        <div className="shift-detail-page__loading">Загрузка...</div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="shift-detail-page">
        <div className="shift-detail-page__loading">Загрузка...</div>
      </div>
    );
  }

  if (!shift) {
    return (
      <div className="shift-detail-page">
        <div className="shift-detail-page__error">Смена не найдена</div>
      </div>
    );
  }

  return (
    <div className="shift-detail-page">
      <div className="shift-detail-page__header">
        <button
          className="shift-detail-page__close"
          onClick={() => navigate("/crm/shifts")}
        >
          <X size={24} />
        </button>
        <div className="shift-detail-page__header-content">
          <div className="shift-detail-page__title-section">
            <Wallet size={32} style={{ color: "#f7d617" }} />
            <div>
              <h1 className="shift-detail-page__title">
                Смена #
                {shift?.code ||
                  (() => {
                    const idStr = shift.id?.toString() || "";
                    // Извлекаем только цифры из ID
                    const digitsOnly = idStr.replace(/\D/g, "");
                    // Если есть достаточно цифр (минимум 4), используем последние 8, иначе используем последние 8 символов без дефисов
                    return digitsOnly.length >= 4
                      ? digitsOnly.slice(-8)
                      : idStr.replace(/-/g, "").slice(-8).toUpperCase();
                  })() ||
                  "—"}
              </h1>
              <div className="shift-detail-page__date">
                <Calendar size={16} />
                <span>Открыта {formatDate(shift.opened_at)}</span>
              </div>
              {shift.closed_at && (
                <div className="shift-detail-page__date">
                  <Calendar size={16} />
                  <span>Закрыта {formatDate(shift.closed_at)}</span>
                </div>
              )}
              <div className="shift-detail-page__date">
                <User size={16} />
                <span>
                  Кассир: {shift.cashier_display || "—"}
                  {shift.cashier && (
                    <span className="shift-detail-page__cashier-id">
                      {" "}
                      (ID: {shift.cashier.slice(0, 8)}...)
                    </span>
                  )}
                </span>
              </div>
            </div>
          </div>
          <div
            className={`shift-detail-page__status shift-detail-page__status--${shift.status}`}
          >
            {shift.status === "open" ? (
              <>
                <CheckCircle size={20} />
                <span>Открыта</span>
              </>
            ) : (
              <>
                <XCircle size={20} />
                <span>Закрыта</span>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="shift-detail-page__metrics">
        <div className="shift-detail-page__metric-card">
          <DollarSign size={24} style={{ color: "#10b981" }} />
          <div className="shift-detail-page__metric-content">
            <div className="shift-detail-page__metric-label">Выручка</div>
            <div className="shift-detail-page__metric-value">
              {parseFloat(shift.sales_total || 0).toFixed(2)} сом
            </div>
          </div>
        </div>
        <div className="shift-detail-page__metric-card">
          <ShoppingCart size={24} style={{ color: "#f7d617" }} />
          <div className="shift-detail-page__metric-content">
            <div className="shift-detail-page__metric-label">Продажи</div>
            <div className="shift-detail-page__metric-value">
              {shift.sales_count || 0}
            </div>
          </div>
        </div>
        <div className="shift-detail-page__metric-card">
          <Wallet size={24} style={{ color: "#8b5cf6" }} />
          <div className="shift-detail-page__metric-content">
            <div className="shift-detail-page__metric-label">Касса</div>
            <div className="shift-detail-page__metric-value">
              {shift.cashbox_name || "—"}
            </div>
          </div>
        </div>
        <div className="shift-detail-page__metric-card">
          <Store size={24} style={{ color: "#f59e0b" }} />
          <div className="shift-detail-page__metric-content">
            <div className="shift-detail-page__metric-label">Магазин</div>
            <div className="shift-detail-page__metric-value">
              {shift.branch || "—"}
            </div>
          </div>
        </div>
      </div>

      <div className="shift-detail-page__details">
        <div className="shift-detail-page__detail-card">
          <div className="shift-detail-page__detail-header">
            <TrendingUp size={20} style={{ color: "#10b981" }} />
            <h3 className="shift-detail-page__detail-title">Выручка</h3>
          </div>
          <div className="shift-detail-page__detail-content">
            <div className="shift-detail-page__detail-row">
              <div className="shift-detail-page__detail-item">
                <div className="shift-detail-page__detail-label">
                  Кол-во продаж
                </div>
                <div className="shift-detail-page__detail-value">
                  {shift.sales_count || 0}
                </div>
              </div>
              <div className="shift-detail-page__detail-item">
                <div className="shift-detail-page__detail-label">
                  Общая сумма продаж
                </div>
                <div className="shift-detail-page__detail-value">
                  {parseFloat(shift.sales_total || 0).toFixed(2)} сом
                </div>
              </div>
            </div>
            <div className="shift-detail-page__detail-row">
              <div className="shift-detail-page__detail-item">
                <div className="shift-detail-page__detail-label">
                  <Banknote
                    size={14}
                    style={{ display: "inline", marginRight: "4px" }}
                  />
                  Наличными
                </div>
                <div className="shift-detail-page__detail-value shift-detail-page__detail-value--green">
                  {parseFloat(shift.cash_sales_total || 0).toFixed(2)} сом
                </div>
              </div>
              <div className="shift-detail-page__detail-item">
                <div className="shift-detail-page__detail-label">
                  <CreditCard
                    size={14}
                    style={{ display: "inline", marginRight: "4px" }}
                  />
                  Безналичные
                </div>
                <div className="shift-detail-page__detail-value">
                  {parseFloat(shift.noncash_sales_total || 0).toFixed(2)} сом
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="shift-detail-page__detail-card">
          <div className="shift-detail-page__detail-header">
            <RefreshCw size={20} style={{ color: "#f59e0b" }} />
            <h3 className="shift-detail-page__detail-title">Возвраты</h3>
          </div>
          <div className="shift-detail-page__detail-content">
            <div className="shift-detail-page__detail-row">
              <div className="shift-detail-page__detail-item">
                <div className="shift-detail-page__detail-label">
                  Количество возвратов
                </div>
                <div className="shift-detail-page__detail-value">0</div>
              </div>
              <div className="shift-detail-page__detail-item">
                <div className="shift-detail-page__detail-label">Наличные</div>
                <div className="shift-detail-page__detail-value">0.00 сом</div>
              </div>
            </div>
            <div className="shift-detail-page__detail-row">
              <div className="shift-detail-page__detail-item">
                <div className="shift-detail-page__detail-label">
                  Сумма возвратов
                </div>
                <div className="shift-detail-page__detail-value">0.00 сом</div>
              </div>
              <div className="shift-detail-page__detail-item">
                <div className="shift-detail-page__detail-label">
                  Безналичные
                </div>
                <div className="shift-detail-page__detail-value">0.00 сом</div>
              </div>
            </div>
          </div>
        </div>

        <div className="shift-detail-page__detail-card">
          <div className="shift-detail-page__detail-header">
            <Wallet size={20} style={{ color: "#3b82f6" }} />
            <h3 className="shift-detail-page__detail-title">
              Наличные в кассе
            </h3>
          </div>
          <div className="shift-detail-page__detail-content">
            <div className="shift-detail-page__detail-row">
              <div className="shift-detail-page__detail-item">
                <div className="shift-detail-page__detail-label">
                  На начало смены
                </div>
                <div className="shift-detail-page__detail-value">
                  {parseFloat(shift.opening_cash || 0).toFixed(2)} сом
                </div>
              </div>
              {shift.closed_at && shift.closing_cash !== null && (
                <div className="shift-detail-page__detail-item">
                  <div className="shift-detail-page__detail-label">
                    Фактическая сумма
                  </div>
                  <div className="shift-detail-page__detail-value">
                    {parseFloat(shift.closing_cash || 0).toFixed(2)} сом
                  </div>
                </div>
              )}
            </div>
            <div className="shift-detail-page__detail-row">
              <div className="shift-detail-page__detail-item">
                <div className="shift-detail-page__detail-label">
                  Ожидаемая сумма
                </div>
                <div className="shift-detail-page__detail-value">
                  {parseFloat(shift.expected_cash || 0).toFixed(2)} сом
                </div>
              </div>
              {shift.closed_at && shift.cash_diff !== null && (
                <div className="shift-detail-page__detail-item">
                  <div className="shift-detail-page__detail-label">
                    <AlertCircle
                      size={14}
                      style={{ display: "inline", marginRight: "4px" }}
                    />
                    Расхождение
                  </div>
                  <div
                    className={`shift-detail-page__detail-value ${
                      parseFloat(shift.cash_diff || 0) === 0
                        ? "shift-detail-page__detail-value--green"
                        : parseFloat(shift.cash_diff || 0) > 0
                        ? "shift-detail-page__detail-value--green"
                        : "shift-detail-page__detail-value--red"
                    }`}
                  >
                    {parseFloat(shift.cash_diff || 0) === 0 ? (
                      <>
                        ✓{" "}
                        {parseFloat(Math.abs(shift.cash_diff || 0)).toFixed(2)}{" "}
                        сом
                      </>
                    ) : parseFloat(shift.cash_diff || 0) > 0 ? (
                      <>+{parseFloat(shift.cash_diff || 0).toFixed(2)} сом</>
                    ) : (
                      <>{parseFloat(shift.cash_diff || 0).toFixed(2)} сом</>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="shift-detail-page__detail-card">
          <div className="shift-detail-page__detail-header">
            <TrendingUp size={20} style={{ color: "#10b981" }} />
            <h3 className="shift-detail-page__detail-title">
              Приходы и расходы
            </h3>
          </div>
          <div className="shift-detail-page__detail-content">
            <div className="shift-detail-page__detail-row">
              <div className="shift-detail-page__detail-item">
                <div className="shift-detail-page__detail-label">
                  <TrendingUp
                    size={14}
                    style={{ display: "inline", marginRight: "4px" }}
                  />
                  Прочие приходы
                </div>
                <div className="shift-detail-page__detail-value shift-detail-page__detail-value--green">
                  {parseFloat(shift.income_total || 0).toFixed(2)} сом
                </div>
              </div>
              <div className="shift-detail-page__detail-item">
                <div className="shift-detail-page__detail-label">
                  <TrendingDown
                    size={14}
                    style={{ display: "inline", marginRight: "4px" }}
                  />
                  Расходы
                </div>
                <div className="shift-detail-page__detail-value shift-detail-page__detail-value--red">
                  {parseFloat(shift.expense_total || 0).toFixed(2)} сом
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="shift-detail-page__total">
        <DollarSign size={24} style={{ color: "white" }} />
        <span className="shift-detail-page__total-label">Итоговая выручка</span>
        <span className="shift-detail-page__total-value">
          {parseFloat(shift.sales_total || 0).toFixed(2)} сом
        </span>
      </div>

      <div className="shift-detail-page__operations">
        <h2 className="shift-detail-page__operations-title">
          ПОСЛЕДНИЕ ОПЕРАЦИИ
        </h2>
        <div className="shift-detail-page__tabs">
          <button
            className={`shift-detail-page__tab ${
              activeTab === "products" ? "shift-detail-page__tab--active" : ""
            }`}
            onClick={() => setActiveTab("products")}
          >
            Движение товара
          </button>
          <button
            className={`shift-detail-page__tab ${
              activeTab === "money" ? "shift-detail-page__tab--active" : ""
            }`}
            onClick={() => setActiveTab("money")}
          >
            Движение денег
          </button>
          {/* <button
            className={`shift-detail-page__tab ${
              activeTab === "list" ? "shift-detail-page__tab--active" : ""
            }`}
            onClick={() => setActiveTab("list")}
          >
            Список товара
          </button> */}
        </div>

        {activeTab === "products" && (
          <div className="shift-detail-page__operations-list">
            {/* Фильтры */}
            <div className="shift-detail-page__filters">
              <div className="shift-detail-page__filter-group">
                <label className="shift-detail-page__filter-label">
                  Статус:
                </label>
                <select
                  className="shift-detail-page__filter-select"
                  value={filters.status}
                  onChange={(e) =>
                    setFilters({ ...filters, status: e.target.value })
                  }
                >
                  <option value="">Все</option>
                  <option value="paid">Оплаченные</option>
                  <option value="unpaid">Неоплаченные</option>
                </select>
              </div>
              <div className="shift-detail-page__filter-group">
                <label className="shift-detail-page__filter-label">
                  Способ оплаты:
                </label>
                <select
                  className="shift-detail-page__filter-select"
                  value={filters.payment_method}
                  onChange={(e) =>
                    setFilters({ ...filters, payment_method: e.target.value })
                  }
                >
                  <option value="">Все</option>
                  <option value="cash">Наличные</option>
                  <option value="transfer">Безнал</option>
                </select>
              </div>
              <div className="shift-detail-page__filter-group">
                <label className="shift-detail-page__filter-label">
                  Поиск:
                </label>
                <input
                  type="text"
                  className="shift-detail-page__filter-input"
                  placeholder="Поиск по номеру чека"
                  value={filters.q}
                  onChange={(e) =>
                    setFilters({ ...filters, q: e.target.value })
                  }
                />
              </div>
            </div>

            {/* Индикатор загрузки */}
            {salesLoading && (
              <div className="shift-detail-page__loading-message">
                Загрузка истории продаж...
              </div>
            )}

            {/* Ошибка */}
            {salesError && (
              <div className="shift-detail-page__error-message">
                {salesError}
              </div>
            )}

            {/* Список продаж */}
            {!salesLoading && !salesError && (
              <>
                {productMovements.length === 0 ? (
                  <div className="shift-detail-page__empty-message">
                    Продажи не найдены
                  </div>
                ) : (
                  productMovements.map((movement, idx) => (
                    <div
                      key={movement.id}
                      className="shift-detail-page__operation"
                    >
                      <div className="shift-detail-page__operation-indicator shift-detail-page__operation-indicator--blue" />
                      <div className="shift-detail-page__operation-content">
                        <div className="shift-detail-page__operation-title">
                          Продажа #{idx + 1}
                          {movement.docNumber || movement.id.slice(0, 8)}
                        </div>
                        <div className="shift-detail-page__operation-info">
                          Магазин {movement.store} &gt; клиент {movement.client}
                        </div>
                        <div className="shift-detail-page__operation-info">
                          {movement.cashier}, {formatDate(movement.date)}
                        </div>
                        <div
                          className={`shift-detail-page__operation-status shift-detail-page__operation-status--${
                            movement.status === "paid" ? "paid" : "unpaid"
                          }`}
                        >
                          {movement.status === "paid" ? (
                            <>
                              <CheckCircle size={16} />
                              <span>Документ оплачен</span>
                            </>
                          ) : (
                            <>
                              <XCircle size={16} />
                              <span>Документ не оплачен</span>
                            </>
                          )}
                        </div>
                        <div className="shift-detail-page__operation-positions">
                          {movement.positions} позиции
                        </div>
                      </div>
                      <div className="shift-detail-page__operation-amount">
                        {movement.amount.toFixed(2)} сом
                      </div>
                      <ChevronDown
                        size={20}
                        className="shift-detail-page__operation-expand"
                      />
                    </div>
                  ))
                )}
              </>
            )}
          </div>
        )}

        {activeTab === "money" && (
          <div className="shift-detail-page__operations-list">
            {/* Фильтры для движения денег */}
            <div className="shift-detail-page__filters">
              <div className="shift-detail-page__filter-group">
                <label className="shift-detail-page__filter-label">
                  Статус:
                </label>
                <select
                  className="shift-detail-page__filter-select"
                  value={moneyFilters.status}
                  onChange={(e) =>
                    setMoneyFilters({
                      ...moneyFilters,
                      status: e.target.value,
                    })
                  }
                >
                  <option value="">Все</option>
                  <option value="paid">Оплаченные</option>
                  <option value="unpaid">Неоплаченные</option>
                </select>
              </div>
              <div className="shift-detail-page__filter-group">
                <label className="shift-detail-page__filter-label">
                  Способ оплаты:
                </label>
                <select
                  className="shift-detail-page__filter-select"
                  value={moneyFilters.payment_method}
                  onChange={(e) =>
                    setMoneyFilters({
                      ...moneyFilters,
                      payment_method: e.target.value,
                    })
                  }
                >
                  <option value="">Все</option>
                  <option value="cash">Наличные</option>
                  <option value="transfer">Безнал</option>
                </select>
              </div>
              <div className="shift-detail-page__filter-group">
                <label className="shift-detail-page__filter-label">
                  Поиск:
                </label>
                <input
                  type="text"
                  className="shift-detail-page__filter-input"
                  placeholder="Поиск по номеру чека"
                  value={moneyFilters.q}
                  onChange={(e) =>
                    setMoneyFilters({ ...moneyFilters, q: e.target.value })
                  }
                />
              </div>
            </div>

            {/* Индикатор загрузки */}
            {moneyLoading && (
              <div className="shift-detail-page__loading-message">
                Загрузка движения денег...
              </div>
            )}

            {/* Ошибка */}
            {moneyError && (
              <div className="shift-detail-page__error-message">
                {moneyError}
              </div>
            )}

            {/* Список движения денег */}
            {!moneyLoading && !moneyError && (
              <>
                {moneyMovements.length === 0 ? (
                  <div className="shift-detail-page__empty-message">
                    Движение денег не найдено
                  </div>
                ) : (
                  moneyMovements.map((movement, idx) => (
                    <div
                      key={movement.id}
                      className="shift-detail-page__operation"
                    >
                      <div className="shift-detail-page__operation-indicator shift-detail-page__operation-indicator--blue" />
                      <div className="shift-detail-page__operation-content">
                        <div className="shift-detail-page__operation-title">
                          <FileText size={16} />
                          Приход #{idx + 1}
                        </div>
                        <div className="shift-detail-page__operation-info">
                          Контрагент: {movement.counterparty}
                        </div>
                        <div className="shift-detail-page__operation-info">
                          Счёт: {movement.account}
                        </div>
                        <div className="shift-detail-page__operation-tag">
                          {movement.tag}
                        </div>
                        <div className="shift-detail-page__operation-info">
                          {formatDate(movement.date)}
                        </div>
                        <div className="shift-detail-page__operation-info">
                          Кассир: {movement.cashier}
                        </div>
                        {movement.payment_method && (
                          <div className="shift-detail-page__operation-info">
                            Способ оплаты: {movement.payment_method}
                          </div>
                        )}
                      </div>
                      <div className="shift-detail-page__operation-amount shift-detail-page__operation-amount--green">
                        +{movement.amount.toFixed(2)} сом
                      </div>
                    </div>
                  ))
                )}
              </>
            )}
          </div>
        )}

        {activeTab === "list" && (
          <div className="shift-detail-page__product-list">
            <h3 className="shift-detail-page__product-list-title">
              Продажа товара
            </h3>
            <table className="shift-detail-page__product-table">
              <thead>
                <tr>
                  <th>Товар</th>
                  <th>Кол-во товара</th>
                  <th>Сумма продаж</th>
                  <th>Прибыль</th>
                </tr>
              </thead>
              <tbody>
                {productList.map((product, index) => (
                  <tr key={index}>
                    <td>{product.name}</td>
                    <td>{product.quantity.toFixed(2)}</td>
                    <td>{product.salesAmount.toFixed(2)}</td>
                    <td>{product.profit.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <AlertModal
        open={alertModal.open}
        type={alertModal.type}
        title={alertModal.title}
        message={alertModal.message}
        okText={alertModal.type === "warning" ? "Да" : "ОК"}
        onClose={closeAlert}
        onConfirm={handleConfirm}
      />
    </div>
  );
};

export default ShiftDetail;
