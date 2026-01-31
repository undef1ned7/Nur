import React, { useState, useEffect } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import {
  Search,
  Plus,
  SlidersHorizontal,
  X,
  ChevronRight,
  ChevronDown,
  MoreVertical,
  Table2,
  LayoutGrid,
} from "lucide-react";
import "../Kassa/kassa.scss";
import "./Vitrina.scss";
import { useUser } from "../../../store/slices/userSlice";
import PendingModal from "../Kassa/PendingModal/PendingModal";
import Pending from "../../pages/Pending/Pending";

const KassaDet = () => {
  const { id } = useParams();
  const cashboxId = id;
  const { company } = useUser();
  const navigate = useNavigate();

  const [cashboxDetails, setCashboxDetails] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showPending, setShowPending] = useState(false);

  // НОВОЕ СОСТОЯНИЕ ДЛЯ ФИЛЬТРАЦИИ ПОТОКОВ
  const [activeFlowType, setActiveFlowType] = useState("all"); // 'all', 'income', 'expense', "pending", "reports"
  const [reportType, setReportType] = useState("monthly"); // 'monthly', 'daily'
  const [reportData, setReportData] = useState(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(
    new Date().toISOString().slice(0, 7)
  ); // YYYY-MM
  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().slice(0, 10)
  ); // YYYY-MM-DD

  const [showFilter, setShowFilter] = useState(false);
  const [showAddCashboxModal, setShowAddCashboxModal] = useState(false);
  const [selectedCashbox, setSelectedCashbox] = useState(null);
  const [showEditCashboxModal, setShowEditCashboxModal] = useState(false);
  const [newCashbox, setNewCashbox] = useState({
    name: "",
    amount: 0,
    type: "expense", // Дефолтный тип для новой операции
  });

  const VIEW_STORAGE_KEY = "kassa-worker-det-view-mode";
  const getInitialViewMode = () => {
    if (typeof window === "undefined") return "table";
    const saved = localStorage.getItem(VIEW_STORAGE_KEY);
    if (saved === "table" || saved === "cards") return saved;
    return "table";
  };
  const [viewMode, setViewMode] = useState(getInitialViewMode);
  useEffect(() => {
    localStorage.setItem(VIEW_STORAGE_KEY, viewMode);
  }, [viewMode]);

  const [filterSearch, setFilterSearch] = useState("");
  const [debouncedFilterSearch, setDebouncedFilterSearch] = useState("");
  const [flowsList, setFlowsList] = useState(null); // null = из cashboxDetails, иначе результат API
  const [flowsLoading, setFlowsLoading] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedFilterSearch(filterSearch), 400);
    return () => clearTimeout(t);
  }, [filterSearch]);

  const fetchCashboxDetails = async (idToFetch) => {
    if (!idToFetch) {
      setError("ID кассы не указан в URL.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const response = await fetch(
        company?.subscription_plan?.name === "Старт"
          ? `https://app.nurcrm.kg/api/construction/cashboxes/${idToFetch}/`
          : `https://app.nurcrm.kg/api/construction/cashboxes/${idToFetch}/detail/owner/`,
        {
          headers: {
            Authorization: "Bearer " + localStorage.getItem("accessToken"),
          },
        }
      );
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error("Касса с указанным ID не найдена.");
        }
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      // console.log("Fetched cashbox details:", data);
      setCashboxDetails(data);
      setSelectedCashbox(data);
    } catch (err) {
      console.error(
        `Failed to fetch cashbox details for ID ${idToFetch}:`,
        err
      );
      setError(
        `Не удалось загрузить данные кассы: ${err.message}. Пожалуйста, попробуйте еще раз.`
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (cashboxId) {
      fetchCashboxDetails(cashboxId);
    } else {
      setError("ID кассы не указан в URL.");
      setLoading(false);
    }
  }, [cashboxId]);

  // --- Загрузка потоков через API (поиск и тип через бэк) ---
  const fetchCashflowsFromApi = async (search, type) => {
    if (!cashboxId) return;
    setFlowsLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("cashbox", cashboxId);
      params.set("page_size", "1000");
      if (search && search.trim()) params.set("search", search.trim());
      if (type && type !== "all") params.set("type", type);
      const baseUrl = `https://app.nurcrm.kg/api/construction/cashflows/?${params.toString()}`;
      const allFlows = [];
      let currentUrl = baseUrl;
      let guard = 0;
      while (currentUrl && guard < 100) {
        const response = await fetch(currentUrl, {
          headers: {
            Authorization: "Bearer " + localStorage.getItem("accessToken"),
          },
        });
        if (!response.ok)
          throw new Error(`HTTP error! status: ${response.status}`);
        const data = await response.json();
        const flows = Array.isArray(data) ? data : data.results || [];
        allFlows.push(...flows);
        currentUrl = data.next || null;
        guard += 1;
      }
      setFlowsList(allFlows);
    } catch (err) {
      console.error("Failed to fetch cashflows:", err);
      setFlowsList([]);
    } finally {
      setFlowsLoading(false);
    }
  };

  useEffect(() => {
    if (!cashboxId) return;
    const search = (debouncedFilterSearch || "").trim();
    if (!search && activeFlowType === "all") {
      setFlowsList(null);
      return;
    }
    fetchCashflowsFromApi(search, activeFlowType);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cashboxId, debouncedFilterSearch, activeFlowType]);

  const handleAddCashbox = async () => {
    try {
      const response = await fetch(
        "https://app.nurcrm.kg/api/construction/cashflows/",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer " + localStorage.getItem("accessToken"),
          },
          body: JSON.stringify({
            name: newCashbox.name,
            amount: newCashbox.amount,
            cashbox: cashboxId, // Важно: привязываем новую операцию к текущей кассе
            type: newCashbox.type,
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        console.error("Error adding cashflow:", errorData);
        throw new Error(
          `HTTP error! status: ${response.status} - ${JSON.stringify(
            errorData
          )}`
        );
      }

      // После добавления операции, повторно получаем детали кассы, чтобы обновить список потоков
      setFlowsList(null);
      fetchCashboxDetails(cashboxId);
      setShowAddCashboxModal(false);
      setNewCashbox({ name: "", amount: 0, type: "expense" }); // Сброс формы
    } catch (err) {
      console.error("Failed to add cashflow:", err);
      setError(
        "Не удалось добавить операцию по кассе. Пожалуйста, проверьте данные и попробуйте еще раз."
      );
    }
  };

  const handleEditCashbox = async () => {
    if (!selectedCashbox || !cashboxId) return;

    try {
      const response = await fetch(
        `https://app.nurcrm.kg/api/construction/cashboxes/${cashboxId}/`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer " + localStorage.getItem("accessToken"),
          },
          body: JSON.stringify({
            title: selectedCashbox.title,
            department: selectedCashbox.department,
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        console.error("Error updating cashbox:", errorData);
        throw new Error(
          `HTTP error! status: ${response.status} - ${JSON.stringify(
            errorData
          )}`
        );
      }

      const updatedCashbox = await response.json();
      setCashboxDetails(updatedCashbox);
      setShowEditCashboxModal(false);
      setSelectedCashbox(updatedCashbox);
      fetchCashboxDetails(cashboxId);
    } catch (err) {
      console.error("Failed to edit cashbox:", err);
      setError(
        "Не удалось обновить кассу. Пожалуйста, проверьте данные и попробуйте еще раз."
      );
    }
  };

  const handleDeleteCashbox = async () => {
    if (!cashboxId) return;

    try {
      const response = await fetch(
        `https://app.nurcrm.kg/api/construction/cashflows/${cashboxId}/`,
        {
          method: "DELETE",
          headers: {
            Authorization: "Bearer " + localStorage.getItem("accessToken"),
          },
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        console.error("Error deleting cashbox:", errorData);
        throw new Error(
          `HTTP error! status: ${response.status} - ${JSON.stringify(
            errorData
          )}`
        );
      }

      setCashboxDetails(null);
      setError("Касса успешно удалена.");
      // Возможно, здесь вы захотите перенаправить пользователя на страницу списка касс
      // history.push('/cashboxes');
    } catch (err) {
      console.error("Failed to delete cashbox:", err);
      setError("Не удалось удалить кассу. Пожалуйста, попробуйте еще раз.");
    }
  };

  // --- ЛОГИКА ФИЛЬТРАЦИИ ---
  // flowsList !== null — данные пришли с бэка по поиску/типу; иначе — из cashboxDetails
  // Всегда фильтруем по типу таба (все / приход / расход) и по статусу
  const rawFlows =
    flowsList !== null ? flowsList : cashboxDetails?.cashflows || [];
  const filteredCashflows = rawFlows.filter(
    (flow) =>
      (activeFlowType === "all" || flow.type === activeFlowType) &&
      (flow.status === "true" ||
        flow.status === "approved" ||
        flow.status === true)
  );

  const handleResetFilters = () => {
    setFilterSearch("");
    setDebouncedFilterSearch("");
    setActiveFlowType("all");
    setFlowsList(null);
    setShowFilter(false);
  };

  // --- ФУНКЦИИ ДЛЯ ЗАГРУЗКИ ОТЧЕТОВ ---
  // Вспомогательная функция для загрузки всех страниц с пагинацией
  const fetchAllPages = async (url) => {
    const allFlows = [];
    let currentUrl = url;
    let guard = 0; // Защита от бесконечного цикла
    const maxPages = 100;

    while (currentUrl && guard < maxPages) {
      const response = await fetch(currentUrl, {
        headers: {
          Authorization: "Bearer " + localStorage.getItem("accessToken"),
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      const flows = Array.isArray(data) ? data : data.results || [];
      allFlows.push(...flows);

      // Переходим на следующую страницу, если она есть
      currentUrl = data.next || null;
      guard += 1;
    }

    return allFlows;
  };

  const fetchMonthlyReport = async () => {
    if (!cashboxId) return;
    setReportLoading(true);
    try {
      const [year, month] = selectedMonth.split("-");
      // Вычисляем начало и конец месяца для фильтрации на фронтенде
      const startDate = new Date(parseInt(year), parseInt(month) - 1, 1);
      startDate.setHours(0, 0, 0, 0);
      const endDate = new Date(parseInt(year), parseInt(month), 0);
      endDate.setHours(23, 59, 59, 999);

      // Загружаем все страницы без фильтрации по дате (бэкенд не поддерживает)
      const initialUrl = `https://app.nurcrm.kg/api/construction/cashflows/?cashbox=${cashboxId}&page_size=1000`;
      let flows = await fetchAllPages(initialUrl);

      // Фильтруем по дате на фронтенде
      flows = flows.filter((flow) => {
        if (!flow.created_at) return false;
        const flowDate = new Date(flow.created_at);
        return flowDate >= startDate && flowDate <= endDate;
      });

      // Фильтруем только approved операции
      flows = flows.filter(
        (flow) =>
          flow.status === "approved" ||
          flow.status === "true" ||
          flow.status === true
      );

      // Группировка по дням
      const dailyGroups = {};
      flows.forEach((flow) => {
        const date = new Date(flow.created_at).toISOString().split("T")[0];
        if (!dailyGroups[date]) {
          dailyGroups[date] = { income: 0, expense: 0, flows: [] };
        }
        if (flow.type === "income") {
          dailyGroups[date].income += parseFloat(flow.amount) || 0;
        } else {
          dailyGroups[date].expense += parseFloat(flow.amount) || 0;
        }
        dailyGroups[date].flows.push(flow);
      });

      const totalIncome = flows
        .filter((f) => f.type === "income")
        .reduce((sum, f) => sum + (parseFloat(f.amount) || 0), 0);
      const totalExpense = flows
        .filter((f) => f.type === "expense")
        .reduce((sum, f) => sum + (parseFloat(f.amount) || 0), 0);

      setReportData({
        type: "monthly",
        month: selectedMonth,
        totalIncome,
        totalExpense,
        net: totalIncome - totalExpense,
        dailyGroups,
        flows,
      });
    } catch (err) {
      console.error("Failed to fetch monthly report:", err);
      setError(`Не удалось загрузить ежемесячный отчет: ${err.message}`);
    } finally {
      setReportLoading(false);
    }
  };

  const fetchDailyReport = async () => {
    if (!cashboxId) return;
    setReportLoading(true);
    try {
      // Вычисляем начало и конец дня для фильтрации на фронтенде
      const startDate = new Date(selectedDate);
      startDate.setHours(0, 0, 0, 0);
      const endDate = new Date(selectedDate);
      endDate.setHours(23, 59, 59, 999);

      // Загружаем все страницы без фильтрации по дате (бэкенд не поддерживает)
      const initialUrl = `https://app.nurcrm.kg/api/construction/cashflows/?cashbox=${cashboxId}&page_size=1000`;
      let flows = await fetchAllPages(initialUrl);

      // Фильтруем по дате на фронтенде
      flows = flows.filter((flow) => {
        if (!flow.created_at) return false;
        const flowDate = new Date(flow.created_at);
        return flowDate >= startDate && flowDate <= endDate;
      });

      // Фильтруем только approved операции
      flows = flows.filter(
        (flow) =>
          flow.status === "approved" ||
          flow.status === "true" ||
          flow.status === true
      );

      const totalIncome = flows
        .filter((f) => f.type === "income")
        .reduce((sum, f) => sum + (parseFloat(f.amount) || 0), 0);
      const totalExpense = flows
        .filter((f) => f.type === "expense")
        .reduce((sum, f) => sum + (parseFloat(f.amount) || 0), 0);

      setReportData({
        type: "daily",
        date: selectedDate,
        totalIncome,
        totalExpense,
        net: totalIncome - totalExpense,
        flows,
      });
    } catch (err) {
      console.error("Failed to fetch daily report:", err);
      setError(`Не удалось загрузить дневной отчет: ${err.message}`);
    } finally {
      setReportLoading(false);
    }
  };

  useEffect(() => {
    if (activeFlowType === "reports" && cashboxId) {
      if (reportType === "monthly") {
        fetchMonthlyReport();
      } else {
        fetchDailyReport();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeFlowType, reportType, selectedMonth, selectedDate, cashboxId]);

  if (loading) {
    return (
      <div className="kassa-page">
        <div className="kassa-table__loading" style={{ padding: 40 }}>
          Загрузка данных...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="kassa-page">
        <div
          className="kassa__alert kassa__alert--error"
          style={{ padding: 16 }}
        >
          {error}
        </div>
      </div>
    );
  }

  if (!cashboxDetails) {
    return (
      <div className="kassa-page">
        <div className="kassa-table__empty" style={{ padding: 40 }}>
          Данные о кассе не доступны.
        </div>
      </div>
    );
  }

  return (
    <div className="kassa-page">
      <div className="kassa-header">
        <div className="kassa-header__left">
          <div className="kassa-header__icon-box">💰</div>
          <div className="kassa-header__title-section">
            <h2 className="kassa-header__title">
              {cashboxDetails.department_name ?? cashboxDetails.name ?? "Касса"}
            </h2>
            <p className="kassa-header__subtitle">Движения по кассе</p>
          </div>
        </div>
        <nav className="kassa-header__nav-tabs">
          <Link className="kassa-header__nav-tab" to="/crm/kassa/">
            ← Назад
          </Link>
          <button
            type="button"
            className={`kassa-header__nav-tab ${
              activeFlowType === "all" ? "kassa-header__nav-tab--active" : ""
            }`}
            onClick={() => setActiveFlowType("all")}
          >
            Все
          </button>
          <button
            type="button"
            className={`kassa-header__nav-tab ${
              activeFlowType === "expense"
                ? "kassa-header__nav-tab--active"
                : ""
            }`}
            onClick={() => setActiveFlowType("expense")}
          >
            Расход
          </button>
          <button
            type="button"
            className={`kassa-header__nav-tab ${
              activeFlowType === "income" ? "kassa-header__nav-tab--active" : ""
            }`}
            onClick={() => setActiveFlowType("income")}
          >
            Приход
          </button>
          {company?.subscription_plan?.name !== "Старт" && (
            <button
              type="button"
              className={`kassa-header__nav-tab ${
                activeFlowType === "pending"
                  ? "kassa-header__nav-tab--active"
                  : ""
              }`}
              onClick={() => setActiveFlowType("pending")}
            >
              Запросы
            </button>
          )}
          <button
            type="button"
            className={`kassa-header__nav-tab ${
              activeFlowType === "reports"
                ? "kassa-header__nav-tab--active"
                : ""
            }`}
            onClick={() => setActiveFlowType("reports")}
          >
            Отчеты
          </button>
        </nav>
        {activeFlowType !== "reports" && (
          <button
            className="kassa-header__create-btn"
            onClick={() => setShowAddCashboxModal(true)}
          >
            <Plus size={16} />
            Добавить расход
          </button>
        )}
      </div>

      {activeFlowType === "pending" ? (
        <Pending />
      ) : activeFlowType === "reports" ? (
        <div className="cashbox-reports">
          <div className="cashbox-reports__tabs">
            <button
              className={`cashbox-reports__tab ${
                reportType === "monthly" ? "cashbox-reports__tab--active" : ""
              }`}
              onClick={() => setReportType("monthly")}
            >
              Ежемесячный отчет
            </button>
            <button
              className={`cashbox-reports__tab ${
                reportType === "daily" ? "cashbox-reports__tab--active" : ""
              }`}
              onClick={() => setReportType("daily")}
            >
              Дневной отчет
            </button>
          </div>

          <div className="cashbox-reports__filters">
            {reportType === "monthly" ? (
              <div className="cashbox-reports__filter-group">
                <label htmlFor="month-select">Выберите месяц:</label>
                <input
                  id="month-select"
                  type="month"
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="cashbox-reports__date-input"
                />
              </div>
            ) : (
              <div className="cashbox-reports__filter-group">
                <label htmlFor="date-select">Выберите дату:</label>
                <input
                  id="date-select"
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="cashbox-reports__date-input"
                />
              </div>
            )}
          </div>

          {reportLoading ? (
            <div style={{ padding: "20px", textAlign: "center" }}>
              Загрузка отчета...
            </div>
          ) : reportData ? (
            <div className="cashbox-reports__content">
              <div className="cashbox-reports__summary">
                <div className="cashbox-reports__summary-item">
                  <span className="cashbox-reports__summary-label">
                    Приход:
                  </span>
                  <span className="cashbox-reports__summary-value cashbox-reports__summary-value--income">
                    {reportData.totalIncome.toFixed(2)} сом
                  </span>
                </div>
                <div className="cashbox-reports__summary-item">
                  <span className="cashbox-reports__summary-label">
                    Расход:
                  </span>
                  <span className="cashbox-reports__summary-value cashbox-reports__summary-value--expense">
                    {reportData.totalExpense.toFixed(2)} сом
                  </span>
                </div>
                <div className="cashbox-reports__summary-item">
                  <span className="cashbox-reports__summary-label">Итого:</span>
                  <span
                    className={`cashbox-reports__summary-value ${
                      reportData.net >= 0
                        ? "cashbox-reports__summary-value--income"
                        : "cashbox-reports__summary-value--expense"
                    }`}
                  >
                    {reportData.net.toFixed(2)} сом
                  </span>
                </div>
              </div>

              {reportType === "monthly" && reportData.dailyGroups ? (
                <div className="cashbox-reports__monthly">
                  {Object.entries(reportData.dailyGroups)
                    .sort(([a], [b]) => new Date(b) - new Date(a))
                    .map(([date, data]) => (
                      <div key={date} className="cashbox-reports__day-group">
                        <div className="cashbox-reports__day-header">
                          <h4>
                            {new Date(date).toLocaleDateString("ru-RU", {
                              day: "numeric",
                              month: "long",
                              year: "numeric",
                            })}
                          </h4>
                          <div className="cashbox-reports__day-totals">
                            <span>Приход: {data.income.toFixed(2)} сом</span>
                            <span>Расход: {data.expense.toFixed(2)} сом</span>
                            <span>
                              Итого: {(data.income - data.expense).toFixed(2)}{" "}
                              сом
                            </span>
                          </div>
                        </div>
                        <table className="kassa-table">
                          <thead>
                            <tr>
                              <th>Тип</th>
                              <th>Наименование</th>
                              <th>Сумма</th>
                              <th>Время</th>
                            </tr>
                          </thead>
                          <tbody>
                            {data.flows.map((flow) => (
                              <tr key={flow.id}>
                                <td data-label="Тип">
                                  {flow.type === "income" ? "Приход" : "Расход"}
                                </td>
                                <td data-label="Наименование">
                                  {flow.name || flow.title}
                                </td>
                                <td data-label="Сумма">{flow.amount}</td>
                                <td data-label="Время">
                                  {new Date(flow.created_at).toLocaleTimeString(
                                    "ru-RU",
                                    {
                                      hour: "2-digit",
                                      minute: "2-digit",
                                    }
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ))}
                </div>
              ) : (
                <div className="cashbox-reports__daily">
                  {reportData.flows && reportData.flows.length > 0 ? (
                    <table className="kassa-table">
                      <thead>
                        <tr>
                          <th>Тип</th>
                          <th>Наименование</th>
                          <th>Сумма</th>
                          <th>Время</th>
                        </tr>
                      </thead>
                      <tbody>
                        {reportData.flows.map((flow) => (
                          <tr key={flow.id}>
                            <td data-label="Тип">
                              {flow.type === "income" ? "Приход" : "Расход"}
                            </td>
                            <td data-label="Наименование">
                              {flow.name || flow.title}
                            </td>
                            <td data-label="Сумма">{flow.amount}</td>
                            <td data-label="Время">
                              {new Date(flow.created_at).toLocaleTimeString(
                                "ru-RU",
                                {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                }
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <p style={{ padding: "20px", textAlign: "center" }}>
                      Нет операций за выбранную дату
                    </p>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div style={{ padding: "20px", textAlign: "center" }}>
              Выберите период для просмотра отчета
            </div>
          )}
        </div>
      ) : (
        <>
          <div className="kassa-search-section">
            <div className="kassa-search">
              <Search className="kassa-search__icon" size={18} />
              <input
                type="text"
                className="kassa-search__input"
                placeholder="Поиск потоков"
                value={filterSearch}
                onChange={(e) => setFilterSearch(e.target.value)}
              />
            </div>
            <div className="kassa-search__meta">
              <div className="kassa-search__view-toggle">
                <button
                  type="button"
                  onClick={() => setViewMode("table")}
                  className={`kassa-view-btn ${
                    viewMode === "table" ? "kassa-view-btn--active" : ""
                  }`}
                  title="Таблица"
                >
                  <Table2 size={16} />
                  Таблица
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode("cards")}
                  className={`kassa-view-btn ${
                    viewMode === "cards" ? "kassa-view-btn--active" : ""
                  }`}
                  title="Карточки"
                >
                  <LayoutGrid size={16} />
                  Карточки
                </button>
              </div>
              <button
                className="kassa-search__filter-btn"
                onClick={() => setShowFilter(true)}
              >
                <SlidersHorizontal size={18} />
                Фильтры
              </button>
            </div>
          </div>

          <div className="kassa-table-container">
            {flowsLoading ? (
              <div className="kassa-table__loading" style={{ padding: 40 }}>
                Загрузка…
              </div>
            ) : !filteredCashflows || filteredCashflows.length === 0 ? (
              <div className="kassa-table__empty" style={{ padding: 40 }}>
                Нет движений денежных средств для этой кассы
                {activeFlowType === "income"
                  ? " (Приходы)."
                  : activeFlowType === "expense"
                  ? " (Расходы)."
                  : "."}
              </div>
            ) : viewMode === "table" ? (
              <table className="kassa-table">
                <thead>
                  <tr>
                    <th>Тип</th>
                    <th>Наименование</th>
                    <th>Сумма</th>
                    <th>Дата создания</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCashflows.map((flow) => (
                    <tr key={flow.id}>
                      <td>{flow.type === "income" ? "Приход" : "Расход"}</td>
                      <td>{flow.name}</td>
                      <td>{flow.amount}</td>
                      <td>{new Date(flow.created_at).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="kassa-cards-wrapper">
                <div className="kassa-cards">
                  {filteredCashflows.map((flow) => (
                    <div key={flow.id} className="kassa-card">
                      <div className="kassa-card__header">
                        <span
                          className={`kassa-card__num ${
                            flow.type === "income"
                              ? "kassa-card__num--income"
                              : "kassa-card__num--expense"
                          }`}
                        >
                          {flow.type === "income" ? "Приход" : "Расход"}
                        </span>
                        <h3 className="kassa-card__title">
                          {flow.name || "—"}
                        </h3>
                      </div>
                      <div className="kassa-card__fields">
                        <div className="kassa-card__field">
                          <span className="kassa-card__label">Сумма</span>
                          <span
                            className={`kassa-card__value ${
                              flow.type === "income"
                                ? "kassa-card__value--income"
                                : "kassa-card__value--expense"
                            }`}
                          >
                            {flow.amount} с
                          </span>
                        </div>
                        <div className="kassa-card__field">
                          <span className="kassa-card__label">Дата</span>
                          <span className="kassa-card__value">
                            {flow.created_at
                              ? new Date(flow.created_at).toLocaleDateString(
                                  "ru-RU"
                                )
                              : "—"}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {showFilter && (
        <div className="kassa-modal block" style={{ display: "block" }}>
          <div
            className="kassa-modal__overlay"
            onClick={() => setShowFilter(false)}
            aria-hidden="true"
          />
          <div className="kassa-modal__card kassa-filter-modal">
            <div className="kassa-filter-modal__header">
              <h3 className="kassa-filter-modal__title">Фильтры потоков</h3>
              <button
                type="button"
                className="kassa-modal__close"
                onClick={() => setShowFilter(false)}
                aria-label="Закрыть"
              >
                <X size={20} />
              </button>
            </div>
            <div className="kassa-filter-modal__body">
              <div className="kassa-filter-modal__field">
                <label className="kassa-filter-modal__label">Поиск</label>
                <div className="kassa-filter-modal__search">
                  <Search
                    className="kassa-filter-modal__search-icon"
                    size={18}
                  />
                  <input
                    type="text"
                    placeholder="Поиск потоков"
                    className="kassa-filter-modal__search-input"
                    value={filterSearch}
                    onChange={(e) => setFilterSearch(e.target.value)}
                  />
                </div>
              </div>
              <div className="kassa-filter-modal__field">
                <label className="kassa-filter-modal__label">Тип потока</label>
                <select
                  className="kassa-filter-modal__select-native"
                  value={activeFlowType}
                  onChange={(e) => setActiveFlowType(e.target.value)}
                >
                  <option value="all">Все</option>
                  <option value="income">Приход</option>
                  <option value="expense">Расход</option>
                </select>
              </div>
            </div>
            <div className="kassa-filter-modal__footer">
              <button
                type="button"
                className="kassa-filter-modal__reset"
                onClick={handleResetFilters}
              >
                Сбросить фильтры
              </button>
            </div>
          </div>
        </div>
      )}

      {showAddCashboxModal && (
        <div className="vitrina__overlay">
          <div className="vitrina__modal vitrina__modal--add">
            <div className="vitrina__modal-header">
              <h3>Добавление расхода</h3>
              <X
                className="vitrina__close-icon"
                size={20}
                onClick={() => setShowAddCashboxModal(false)}
              />
            </div>
            <div className="vitrina__modal-section">
              <label>Наименование</label>
              <input
                type="text"
                placeholder="Например, Закупка материалов"
                className="vitrina__modal-input"
                value={newCashbox.name}
                onChange={(e) =>
                  setNewCashbox({ ...newCashbox, name: e.target.value })
                }
              />
            </div>
            <div className="vitrina__modal-section">
              <label>Сумма</label>
              <input
                type="text"
                placeholder="Например, 10000"
                className="vitrina__modal-input"
                value={newCashbox.amount}
                onChange={(e) =>
                  setNewCashbox({
                    ...newCashbox,
                    amount: parseFloat(e.target.value) || 0,
                  })
                }
              />
            </div>
            {/* <div className="vitrina__modal-section">
              <label>Тип операции</label>
              <select
                className="vitrina__modal-input"
                value={newCashbox.type} // Теперь используем newCashbox.type
                onChange={(e) =>
                  setNewCashbox({ ...newCashbox, type: e.target.value })
                }
              >
                <option value="expense">Расход</option>
                <option value="income">Приход</option>
              </select>
            </div> */}
            <div className="vitrina__modal-footer">
              <button
                className="vitrina__button vitrina__button--cancel"
                onClick={() => setShowAddCashboxModal(false)}
              >
                Отмена
              </button>
              <button
                className="vitrina__button vitrina__button--save"
                onClick={handleAddCashbox}
              >
                Добавить
              </button>
            </div>
          </div>
        </div>
      )}

      {showEditCashboxModal && selectedCashbox && (
        <div className="vitrina__overlay">
          <div className="vitrina__modal vitrina__modal--edit">
            <div className="vitrina__modal-header">
              <h3>Редактирование кассы</h3>
              <X
                className="vitrina__close-icon"
                size={20}
                onClick={() => setShowEditCashboxModal(false)}
              />
            </div>
            <div className="vitrina__modal-section">
              <label>ID</label>
              <input
                type="text"
                value={selectedCashbox.id || ""}
                readOnly
                className="vitrina__modal-input"
              />
            </div>
            <div className="vitrina__modal-section">
              <label>Название</label>
              <input
                type="text"
                value={selectedCashbox.title || ""}
                onChange={(e) =>
                  setSelectedCashbox({
                    ...selectedCashbox,
                    title: e.target.value,
                  })
                }
                className="vitrina__modal-input"
              />
            </div>
            <div className="vitrina__modal-footer">
              {/* <button className="vitrina__button vitrina__button--reset" onClick={handleDeleteCashbox}>Удалить кассу</button> */}
              <button
                className="vitrina__button vitrina__button--save"
                onClick={handleEditCashbox}
              >
                Сохранить изменения
              </button>
            </div>
          </div>
        </div>
      )}
      {showPending && (
        <PendingModal
          onClose={() => setShowPending(false)}
          cashName={cashboxDetails.department_name ?? cashboxDetails.name}
          onChanged={() => fetchCashboxDetails(id)}
        />
      )}
    </div>
  );
};

export default KassaDet;
