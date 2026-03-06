import React, { useState, useEffect, useCallback } from "react";
import { useDispatch, useSelector } from "react-redux";
import { ArrowLeft, Search, MoreVertical, X } from "lucide-react";
import {
  fetchShiftsAsync,
  fetchShiftByIdAsync,
  closeShiftAsync,
} from "../../../../store/creators/shiftThunk";
import { historySellProduct } from "../../../../store/creators/saleThunk";
import { getCashFlows } from "../../../../store/slices/cashSlice";
import { useShifts } from "../../../../store/slices/shiftSlice";
import api from "../../../../api";
import AlertModal from "../../../common/AlertModal/AlertModal";
import "./ShiftPage.scss";
import DataContainer from "../../../common/DataContainer/DataContainer";

const ShiftPage = ({ onBack }) => {
  const dispatch = useDispatch();
  const { shifts, currentShift, loading } = useShifts();
  const [activeTab, setActiveTab] = useState("sales");
  const [searchTerm, setSearchTerm] = useState("");
  const [salesData, setSalesData] = useState([]);
  const [salesPagination, setSalesPagination] = useState({
    next: null,
    previous: null,
    count: 0,
  });
  const [moneyMovements, setMoneyMovements] = useState([]);
  const [moneyPagination, setMoneyPagination] = useState({
    next: null,
    previous: null,
    count: 0,
  });
  const [loadingSales, setLoadingSales] = useState(false);
  const [alertModal, setAlertModal] = useState({
    open: false,
    type: "error",
    title: "",
    message: "",
  });
  const [showCloseShiftModal, setShowCloseShiftModal] = useState(false);
  const [closingCash, setClosingCash] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10); // Размер страницы с бэкенда

  // Получаем текущую открытую смену
  const openShift = React.useMemo(
    () => shifts.find((s) => s.status === "open") || currentShift,
    [shifts, currentShift]
  );
  const openShiftId = openShift?.id;

  useEffect(() => {
    // Загружаем список смен, если его еще нет
    if (shifts.length === 0) {
      dispatch(fetchShiftsAsync());
    }
  }, [dispatch, shifts.length]);

  useEffect(() => {
    // Если есть открытая смена, загружаем её детали
    if (openShiftId && !currentShift?.id) {
      dispatch(fetchShiftByIdAsync(openShiftId));
    }
  }, [dispatch, openShiftId, currentShift?.id]);

  // Загружаем продажи для текущей смены
  const loadSales = useCallback(
    async (url = null) => {
      if (!openShiftId) return;

      setLoadingSales(true);
      try {
        // Используем переданный URL или формируем новый запрос
        const requestUrl = url || "/main/pos/sales/";
        const params = url ? {} : { shift: openShiftId, page: currentPage };

        const response = await api.get(requestUrl, { params });
        const data = response.data;

        const sales = (data?.results || []).map((sale) => ({
          id: `#${String(sale.id || sale.code || "").padStart(6, "0")}`,
          date: formatDateTime(sale.created_at || sale.date),
          buyer:
            sale.client?.full_name ||
            sale.client_name ||
            sale.client ||
            "Без клиента",
          paymentMethod: getPaymentMethodLabel(sale.payment_method),
          amount: parseFloat(sale.total || sale.amount || 0),
          status: sale.status === "paid" ? "Оплачен" : "Долг",
          statusType: sale.status === "paid" ? "paid" : "debt",
          saleId: sale.id,
        }));

        setSalesData(sales);

        // Определяем размер страницы из количества результатов
        // Используем максимальное значение, так как последняя страница может быть меньше
        if (data?.results?.length > 0) {
          setPageSize((prev) => Math.max(prev, data.results.length));
        }

        // Извлекаем номер текущей страницы из URL
        let pageNum = currentPage;
        if (url) {
          try {
            // Если URL полный, используем URL конструктор
            if (url.startsWith("http")) {
              const urlObj = new URL(url);
              const pageParam = urlObj.searchParams.get("page");
              if (pageParam) {
                pageNum = parseInt(pageParam, 10) || 1;
              }
            } else {
              // Если URL относительный, парсим вручную
              const match = url.match(/[?&]page=(\d+)/);
              if (match) {
                pageNum = parseInt(match[1], 10) || 1;
              }
            }
          } catch (e) {
            // Если не удалось распарсить, используем текущую страницу
            pageNum = currentPage;
          }
        }

        setSalesPagination({
          next: data?.next || null,
          previous: data?.previous || null,
          count: data?.count || 0,
          currentPage: pageNum,
        });

        // Обновляем текущую страницу, если она изменилась
        if (pageNum !== currentPage) {
          setCurrentPage(pageNum);
        }
      } catch (error) {
        console.error("Ошибка при загрузке продаж:", error);
      } finally {
        setLoadingSales(false);
      }
    },
    [openShiftId, currentPage]
  );

  useEffect(() => {
    if (activeTab === "sales") {
      loadSales();
    }
  }, [loadSales, activeTab]);

  // Загружаем движение денег (CashFlow) для текущей смены
  const loadMoneyMovements = useCallback(
    async (url = null) => {
      if (!openShiftId) return;

      try {
        // Используем переданный URL или формируем новый запрос
        const requestUrl = url || "/construction/cashflows/";
        const params = url
          ? {}
          : {
            shift: openShiftId,
            page: currentPage,
          };

        const response = await api.get(requestUrl, { params });
        const data = response.data;

        const flows = (data?.results || []).map((flow) => ({
          id: `#${String(flow.id || flow.code || "").padStart(6, "0")}`,
          date: formatDateTime(flow.created_at || flow.date),
          description:
            flow.name || flow.title || flow.description || "Операция",
          paymentMethod: "Наличные", // TODO: определить из flow
          amount: Math.abs(parseFloat(flow.amount || 0)),
          type: flow.type === "income" ? "income" : "expense",
        }));

        setMoneyMovements(flows);

        // Определяем размер страницы из количества результатов
        // Используем максимальное значение, так как последняя страница может быть меньше
        if (data?.results?.length > 0) {
          setPageSize((prev) => Math.max(prev, data.results.length));
        }

        // Извлекаем номер текущей страницы из URL
        let pageNum = currentPage;
        if (url) {
          try {
            // Если URL полный, используем URL конструктор
            if (url.startsWith("http")) {
              const urlObj = new URL(url);
              const pageParam = urlObj.searchParams.get("page");
              if (pageParam) {
                pageNum = parseInt(pageParam, 10) || 1;
              }
            } else {
              // Если URL относительный, парсим вручную
              const match = url.match(/[?&]page=(\d+)/);
              if (match) {
                pageNum = parseInt(match[1], 10) || 1;
              }
            }
          } catch (e) {
            // Если не удалось распарсить, используем текущую страницу
            pageNum = currentPage;
          }
        }

        setMoneyPagination({
          next: data?.next || null,
          previous: data?.previous || null,
          count: data?.count || 0,
          currentPage: pageNum,
        });

        // Обновляем текущую страницу, если она изменилась
        if (pageNum !== currentPage) {
          setCurrentPage(pageNum);
        }
      } catch (error) {
        console.error("Ошибка при загрузке движения денег:", error);
      }
    },
    [openShiftId, currentPage]
  );

  useEffect(() => {
    if (activeTab === "money") {
      loadMoneyMovements();
    }
  }, [loadMoneyMovements, activeTab]);

  const formatDateTime = (dateString) => {
    if (!dateString) return "-";
    try {
      const date = new Date(dateString);
      const day = String(date.getDate()).padStart(2, "0");
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const year = date.getFullYear();
      const hours = String(date.getHours()).padStart(2, "0");
      const minutes = String(date.getMinutes()).padStart(2, "0");
      return `${day}.${month}.${year} ${hours}:${minutes}`;
    } catch {
      return dateString;
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return "-";
    try {
      const date = new Date(dateString);
      const day = date.getDate();
      const month = date.toLocaleDateString("ru-RU", { month: "long" });
      const hours = String(date.getHours()).padStart(2, "0");
      const minutes = String(date.getMinutes()).padStart(2, "0");
      return `${day} ${month} в ${hours}:${minutes}`;
    } catch {
      return dateString;
    }
  };

  const getPaymentMethodLabel = (method) => {
    const labels = {
      cash: "Наличные",
      transfer: "Безналичные",
      card: "Безналичные",
      deferred: "Отсрочка",
      debt: "Долг",
    };
    return labels[method] || "Наличные";
  };

  // Вычисляем статистику продаж
  const salesSummary = React.useMemo(() => {
    const total = salesData.reduce((sum, sale) => sum + sale.amount, 0);
    const cash = salesData
      .filter((s) => s.paymentMethod === "Наличные")
      .reduce((sum, sale) => sum + sale.amount, 0);
    const cashless = salesData
      .filter((s) => s.paymentMethod === "Безналичные")
      .reduce((sum, sale) => sum + sale.amount, 0);
    const deferred = salesData
      .filter(
        (s) => s.paymentMethod === "Отсрочка" || s.paymentMethod === "Долг"
      )
      .reduce((sum, sale) => sum + sale.amount, 0);

    return {
      total,
      checks: salesData.length,
      cash,
      cashChecks: salesData.filter((s) => s.paymentMethod === "Наличные")
        .length,
      cashless,
      cashlessChecks: salesData.filter((s) => s.paymentMethod === "Безналичные")
        .length,
      deferred,
      deferredChecks: salesData.filter(
        (s) => s.paymentMethod === "Отсрочка" || s.paymentMethod === "Долг"
      ).length,
    };
  }, [salesData]);

  const handleCloseShift = () => {
    if (!openShift?.id) return;
    // Показываем модальное окно для ввода суммы
    setClosingCash("");
    setShowCloseShiftModal(true);
  };

  const confirmCloseShift = async () => {
    if (!openShift?.id) return;

    // Валидация суммы
    const cashAmount = parseFloat(closingCash);
    if (isNaN(cashAmount) || cashAmount < 0) {
      setAlertModal({
        open: true,
        type: "error",
        title: "Ошибка",
        message: "Пожалуйста, введите корректную сумму",
        onConfirm: null,
      });
      return;
    }

    setShowCloseShiftModal(false);

    try {
      await dispatch(
        closeShiftAsync({
          shiftId: openShift.id,
          closingCash: cashAmount,
        })
      ).unwrap();
      setAlertModal({
        open: true,
        type: "success",
        title: "Успех",
        message: "Смена успешно закрыта",
        onConfirm: null,
      });
      // Обновляем список смен
      dispatch(fetchShiftsAsync());
      // Закрываем страницу смены
      setTimeout(() => {
        onBack();
      }, 1500);
    } catch (error) {
      setAlertModal({
        open: true,
        type: "error",
        title: "Ошибка",
        message:
          error?.data?.detail ||
          error?.data?.closing_cash?.[0] ||
          error?.message ||
          "Не удалось закрыть смену",
        onConfirm: null,
      });
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

  // Фильтруем данные на клиенте (если нужно)
  const filteredSales = React.useMemo(() => {
    if (!searchTerm.trim()) return salesData;
    const searchLower = searchTerm.toLowerCase();
    return salesData.filter(
      (sale) =>
        sale.id.toLowerCase().includes(searchLower) ||
        sale.buyer.toLowerCase().includes(searchLower)
    );
  }, [salesData, searchTerm]);

  const filteredMovements = React.useMemo(() => {
    if (!searchTerm.trim()) return moneyMovements;
    const searchLower = searchTerm.toLowerCase();
    return moneyMovements.filter(
      (movement) =>
        movement.id?.toLowerCase().includes(searchLower) ||
        movement.description?.toLowerCase().includes(searchLower)
    );
  }, [moneyMovements, searchTerm]);

  // Сбрасываем страницу при изменении поиска или вкладки
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, activeTab]);

  // Вычисляем общее количество страниц на основе count и реального размера страницы
  const salesTotalPages = React.useMemo(() => {
    if (!salesPagination.count || !pageSize) return 1;
    return Math.max(1, Math.ceil(salesPagination.count / pageSize));
  }, [salesPagination.count, pageSize]);

  const movementsTotalPages = React.useMemo(() => {
    if (!moneyPagination.count || !pageSize) return 1;
    return Math.max(1, Math.ceil(moneyPagination.count / pageSize));
  }, [moneyPagination.count, pageSize]);

  // Получаем текущую страницу из пагинации или из состояния
  const currentSalesPage = salesPagination.currentPage || currentPage;
  const currentMovementsPage = moneyPagination.currentPage || currentPage;

  const handlePageChange = (direction) => {
    if (activeTab === "sales") {
      if (direction === "next" && salesPagination.next) {
        loadSales(salesPagination.next);
      } else if (direction === "previous" && salesPagination.previous) {
        loadSales(salesPagination.previous);
      } else if (direction === "next") {
        setCurrentPage((prev) => Math.min(prev + 1, salesTotalPages));
      } else if (direction === "previous") {
        setCurrentPage((prev) => Math.max(prev - 1, 1));
      }
    } else if (activeTab === "money") {
      if (direction === "next" && moneyPagination.next) {
        loadMoneyMovements(moneyPagination.next);
      } else if (direction === "previous" && moneyPagination.previous) {
        loadMoneyMovements(moneyPagination.previous);
      } else if (direction === "next") {
        setCurrentPage((prev) => Math.min(prev + 1, movementsTotalPages));
      } else if (direction === "previous") {
        setCurrentPage((prev) => Math.max(prev - 1, 1));
      }
    }
  };

  if (loading && !openShift) {
    return (
      <div className="shift-page">
        <div className="shift-page__loading">Загрузка...</div>
      </div>
    );
  }

  if (!openShift) {
    return (
      <div className="shift-page">
        <div className="shift-page__error">Нет открытой смены</div>
        <button className="shift-page__back-btn" onClick={onBack}>
          <ArrowLeft size={20} />
          Назад
        </button>
      </div>
    );
  }

  const shift = openShift;

  return (
    <div className="shift-page">
      <div className="shift-page__header">
        <div className="shift-page__header-left">
          <button className="shift-page__back-btn" onClick={onBack}>
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="shift-page__title">
              Смена #{shift.id?.slice(0, 8) || "—"}
            </h1>
            <p className="shift-page__subtitle">
              Открыта {formatDate(shift.opened_at)} Кассир:{" "}
              {shift.cashier_display || "—"}
            </p>
          </div>
        </div>
        {shift.status === "open" && (
          <button className="shift-page__close-btn" onClick={handleCloseShift}>
            ЗАКРЫТЬ СМЕНУ
          </button>
        )}
      </div>

      <div className="shift-page__summary">
        <div className="shift-page__summary-card">
          <div className="shift-page__summary-icon">🛒</div>
          <div className="shift-page__summary-content">
            <div className="shift-page__summary-label">ПРОДАЖИ</div>
            <div className="shift-page__summary-value">
              {salesSummary.total.toFixed(2)} сом
            </div>
            <div className="shift-page__summary-count">
              {salesSummary.checks} чеков
            </div>
          </div>
        </div>
        <div className="shift-page__summary-card">
          <div className="shift-page__summary-icon">💰</div>
          <div className="shift-page__summary-content">
            <div className="shift-page__summary-label">НАЛИЧНЫЕ</div>
            <div className="shift-page__summary-value">
              {salesSummary.cash.toFixed(2)} сом
            </div>
            <div className="shift-page__summary-count">
              {salesSummary.cashChecks} чеков
            </div>
          </div>
        </div>
        <div className="shift-page__summary-card">
          <div className="shift-page__summary-icon">💳</div>
          <div className="shift-page__summary-content">
            <div className="shift-page__summary-label">БЕЗНАЛ</div>
            <div className="shift-page__summary-value">
              {salesSummary.cashless.toFixed(2)} сом
            </div>
            <div className="shift-page__summary-count">
              {salesSummary.cashlessChecks} чеков
            </div>
          </div>
        </div>
        <div className="shift-page__summary-card">
          <div className="shift-page__summary-icon">⏰</div>
          <div className="shift-page__summary-content">
            <div className="shift-page__summary-label">ОТСРОЧКА</div>
            <div className="shift-page__summary-value">
              {salesSummary.deferred.toFixed(2)} сом
            </div>
            <div className="shift-page__summary-count">
              {salesSummary.deferredChecks} чеков
            </div>
          </div>
        </div>
      </div>

      <div className="shift-page__tabs">
        <button
          className={`shift-page__tab ${activeTab === "sales" ? "shift-page__tab--active" : ""
            }`}
          onClick={() => setActiveTab("sales")}
        >
          Продажи
        </button>
        <button
          className={`shift-page__tab ${activeTab === "money" ? "shift-page__tab--active" : ""
            }`}
          onClick={() => setActiveTab("money")}
        >
          Движение денег
        </button>
        <div className="shift-page__search">
          <Search size={18} />
          <input
            type="text"
            placeholder="Поиск..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="shift-page__search-input"
          />
        </div>
      </div>

      <div className="shift-page__content">
        {loadingSales ? (
          <div className="shift-page__loading">Загрузка данных...</div>
        ) : activeTab === "sales" ? (
          <DataContainer>

            <table className="shift-page__table">
              <thead>
                <tr>
                  <th scope="col">НОМЕР</th>
                  <th scope="col">ДАТА/ВРЕМЯ</th>
                  <th scope="col">ПОКУПАТЕЛЬ</th>
                  <th scope="col">СПОСОБ ОПЛАТЫ</th>
                  <th scope="col">СУММА</th>
                  <th scope="col">СТАТУС</th>
                  <th scope="col" aria-label="Действия"></th>
                </tr>
              </thead>
              <tbody>
                {filteredSales.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="shift-page__empty">
                      Продажи не найдены
                    </td>
                  </tr>
                ) : (
                  filteredSales.map((sale, idx) => (
                    <tr key={sale.saleId || sale.id}>
                      <td>{(currentSalesPage - 1) * pageSize + idx + 1}</td>
                      <td>{sale.date}</td>
                      <td>{sale.buyer}</td>
                      <td>{sale.paymentMethod}</td>
                      <td>{sale.amount.toFixed(2)} сом</td>
                      <td>
                        <span
                          className={`shift-page__status shift-page__status--${sale.statusType}`}
                        >
                          {sale.status}
                        </span>
                      </td>
                      <td>
                        <button
                          className="shift-page__more-btn"
                          aria-label="Дополнительные действия"
                        >
                          <MoreVertical size={18} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </DataContainer>
        ) : (
          <DataContainer>
            <table className="shift-page__table">
              <thead>
                <tr>
                  <th scope="col">НОМЕР</th>
                  <th scope="col">ДАТА/ВРЕМЯ</th>
                  <th scope="col">ОПИСАНИЕ</th>
                  <th scope="col">СПОСОБ ОПЛАТЫ</th>
                  <th scope="col">СУММА</th>
                  <th scope="col">ТИП</th>
                  <th scope="col" aria-label="Действия"></th>
                </tr>
              </thead>
              <tbody>
                {filteredMovements.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="shift-page__empty">
                      Движение денег не найдено
                    </td>
                  </tr>
                ) : (
                  filteredMovements.map((movement, idx) => (
                    <tr key={movement.id}>
                      <td>{movement.id}</td>
                      <td>{movement.date}</td>
                      <td>{movement.description}</td>
                      <td>{movement.paymentMethod}</td>
                      <td>{movement.amount.toFixed(2)} сом</td>
                      <td>
                        <span
                          className={`shift-page__type shift-page__type--${movement.type}`}
                        >
                          {movement.type === "income" ? "Приход" : "Расход"}
                        </span>
                      </td>
                      <td>
                        <button
                          className="shift-page__more-btn"
                          aria-label="Дополнительные действия"
                        >
                          <MoreVertical size={18} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </DataContainer>

        )}

        {/* Пагинация */}
        {activeTab === "sales" && salesPagination.count > pageSize && (
          <div className="shift-page__pagination">
            <button
              className="shift-page__pagination-btn"
              onClick={() => handlePageChange("previous")}
              disabled={!salesPagination.previous && currentSalesPage <= 1}
              aria-label="Предыдущая страница"
            >
              ←
            </button>
            <span className="shift-page__pagination-info">
              Страница {currentPage} из {salesTotalPages} (
              {salesPagination.count} записей)
            </span>
            <button
              className="shift-page__pagination-btn"
              onClick={() => handlePageChange("next")}
              disabled={
                !salesPagination.next && currentSalesPage >= salesTotalPages
              }
              aria-label="Следующая страница"
            >
              →
            </button>
          </div>
        )}

        {activeTab === "money" && moneyPagination.count > pageSize && (
          <div className="shift-page__pagination">
            <button
              className="shift-page__pagination-btn"
              onClick={() => handlePageChange("previous")}
              disabled={!moneyPagination.previous && currentMovementsPage <= 1}
              aria-label="Предыдущая страница"
            >
              ←
            </button>
            <span className="shift-page__pagination-info">
              Страница {currentPage} из {movementsTotalPages} (
              {moneyPagination.count} записей)
            </span>
            <button
              className="shift-page__pagination-btn"
              onClick={() => handlePageChange("next")}
              disabled={
                !moneyPagination.next && currentPage >= movementsTotalPages
              }
              aria-label="Следующая страница"
            >
              →
            </button>
          </div>
        )}
      </div>

      {/* Модальное окно для ввода суммы закрытия смены */}
      {showCloseShiftModal && (
        <div
          className="shift-page__close-modal-overlay"
          onClick={() => setShowCloseShiftModal(false)}
        >
          <div
            className="shift-page__close-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="shift-page__close-modal-header">
              <h2 className="shift-page__close-modal-title">Закрыть смену</h2>
              <button
                className="shift-page__close-modal-close"
                onClick={() => setShowCloseShiftModal(false)}
              >
                <X size={24} />
              </button>
            </div>
            <div className="shift-page__close-modal-content">
              <div className="shift-page__close-modal-info">
                <div className="shift-page__close-modal-info-item">
                  <span>Ожидаемая сумма:</span>
                  <span>
                    {openShift?.expected_cash
                      ? parseFloat(openShift.expected_cash).toFixed(2)
                      : "0.00"}{" "}
                    сом
                  </span>
                </div>
              </div>
              <div className="shift-page__close-modal-input-wrapper">
                <label className="shift-page__close-modal-label">
                  Фактическая сумма на кассе (сом)
                </label>
                <input
                  type="number"
                  className="shift-page__close-modal-input"
                  value={closingCash}
                  onChange={(e) => setClosingCash(e.target.value)}
                  placeholder="0.00"
                  step="0.01"
                  min="0"
                  autoFocus
                />
              </div>
            </div>
            <div className="shift-page__close-modal-actions">
              <button
                className="shift-page__close-modal-cancel"
                onClick={() => setShowCloseShiftModal(false)}
              >
                Отмена
              </button>
              <button
                className="shift-page__close-modal-confirm"
                onClick={confirmCloseShift}
              >
                Закрыть смену
              </button>
            </div>
          </div>
        </div>
      )}

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

export default ShiftPage;
