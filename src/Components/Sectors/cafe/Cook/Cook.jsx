import React, { useEffect, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { FaSearch, FaCheckCircle, FaClock } from "react-icons/fa";
import {
  fetchKitchenTasksAsync,
  claimKitchenTaskAsync,
  readyKitchenTaskAsync,
} from "../../../../store/creators/cafeOrdersCreators";
import "./Cook.scss";

/* ==== helpers ==== */
const toNum = (x) => {
  if (x === null || x === undefined) return 0;
  const n = Number(String(x).replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};

const formatReceiptDate = (dateStr) => {
  if (!dateStr) return "";
  try {
    const d = new Date(dateStr);
    const day = String(d.getDate()).padStart(2, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const year = String(d.getFullYear()).slice(-2);
    const hours = String(d.getHours()).padStart(2, "0");
    const minutes = String(d.getMinutes()).padStart(2, "0");
    return `${day}.${month}.${year} ${hours}:${minutes}`;
  } catch {
    return dateStr;
  }
};

const Cook = () => {
  const dispatch = useDispatch();
  const { tasks, loading, error, updatingStatus } = useSelector(
    (state) => state.cafeOrders
  );

  const [activeTab, setActiveTab] = useState("current"); // "current" или "history"
  const [query, setQuery] = useState("");

  // Загрузка данных при монтировании и при смене таба
  useEffect(() => {
    if (activeTab === "current") {
      // Текущие задачи: pending и in_progress (по умолчанию API возвращает их)
      dispatch(fetchKitchenTasksAsync({}));
    } else {
      // История: ready и cancelled
      dispatch(fetchKitchenTasksAsync({ status: "ready" }));
    }
  }, [dispatch, activeTab]);

  // Рефреш по событию
  useEffect(() => {
    const handler = () => {
      if (activeTab === "current") {
        dispatch(fetchKitchenTasksAsync({}));
      } else {
        dispatch(fetchKitchenTasksAsync({ status: "ready" }));
      }
    };
    window.addEventListener("orders:refresh", handler);
    return () => window.removeEventListener("orders:refresh", handler);
  }, [dispatch, activeTab]);

  // Фильтрация задач (фильтрация по статусу уже сделана на сервере, здесь только поиск)
  const filteredTasks = useMemo(() => {
    let filtered = Array.isArray(tasks) ? tasks : [];

    // Поиск
    const q = query.trim().toLowerCase();
    if (q) {
      filtered = filtered.filter((t) => {
        if (!t) return false;

        // Поиск по номеру стола
        const tableNum = String(t.table_number ?? "").toLowerCase();
        if (tableNum.includes(q)) return true;

        // Поиск по имени клиента/гостя
        const guest = String(t.guest ?? "").toLowerCase();
        if (guest.includes(q)) return true;

        // Поиск по официанту
        const waiter = String(t.waiter_label ?? "").toLowerCase();
        if (waiter.includes(q)) return true;

        // Поиск по названию блюда
        const menuItem = String(t.menu_item_title ?? "").toLowerCase();
        if (menuItem.includes(q)) return true;

        // Поиск по статусу
        const status = String(t.status ?? "").toLowerCase();
        const statusLabels = {
          pending: "ожидает",
          in_progress: "в работе",
          ready: "готов",
          cancelled: "отменен",
        };
        if (status.includes(q) || statusLabels[status]?.includes(q))
          return true;

        // Поиск по цене
        const price = String(t.price ?? "").toLowerCase();
        if (price.includes(q)) return true;

        // Поиск по номеру порции
        const unitIndex = String(t.unit_index ?? "").toLowerCase();
        if (unitIndex.includes(q)) return true;

        return false;
      });
    }

    // Сортировка по дате создания (новые сверху)
    return [...filtered].sort((a, b) => {
      const dateA = new Date(a.created_at || 0).getTime();
      const dateB = new Date(b.created_at || 0).getTime();
      return dateB - dateA;
    });
  }, [tasks, query]);

  // Взять задачу в работу
  const handleClaimTask = async (task) => {
    try {
      await dispatch(claimKitchenTaskAsync(task.id)).unwrap();
      // Обновляем список задач с учетом текущего таба
      if (activeTab === "current") {
        dispatch(fetchKitchenTasksAsync({}));
      } else {
        dispatch(fetchKitchenTasksAsync({ status: "ready" }));
      }
    } catch (err) {
      const errorMsg =
        err?.message || err?.detail || err?.error || "Неизвестная ошибка";
      alert(`Не удалось взять задачу: ${errorMsg}`);
    }
  };

  // Отметить задачу как готово
  const handleReadyTask = async (task) => {
    try {
      await dispatch(readyKitchenTaskAsync(task.id)).unwrap();
      // Обновляем список задач с учетом текущего таба
      if (activeTab === "current") {
        dispatch(fetchKitchenTasksAsync({}));
      } else {
        dispatch(fetchKitchenTasksAsync({ status: "ready" }));
      }
      // Отправляем событие для обновления других компонентов
      try {
        window.dispatchEvent(new CustomEvent("orders:refresh"));
      } catch {}
    } catch (err) {
      const errorMsg =
        err?.message || err?.detail || err?.error || "Неизвестная ошибка";
      alert(`Не удалось отметить задачу как готово: ${errorMsg}`);
    }
  };

  const isUpdating = (taskId) => {
    return updatingStatus[taskId] === true;
  };

  const getStatusLabel = (status) => {
    const labels = {
      pending: "Ожидает",
      in_progress: "В работе",
      ready: "Готов",
      cancelled: "Отменен",
    };
    return labels[status] || status;
  };

  return (
    <section className="cook">
      {/* Header */}
      <div className="cook__header">
        <div>
          <h2 className="cook__title">Заказы повара</h2>
          <div className="cook__subtitle">
            Управление текущими задачами и просмотр истории
          </div>
        </div>

        <div className="cook__search">
          <FaSearch className="cook__searchIcon" />
          <input
            className="cook__searchInput"
            placeholder="Поиск: стол, клиент, блюдо, статус…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            type="text"
            autoComplete="off"
          />
          {query && (
            <button
              className="cook__searchClear"
              onClick={() => setQuery("")}
              title="Очистить поиск"
              type="button"
            >
              ×
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="cook__tabs">
        <button
          className={`cook__tab ${
            activeTab === "current" ? "cook__tab--active" : ""
          }`}
          onClick={() => setActiveTab("current")}
        >
          <FaClock /> Текущие задачи
        </button>
        <button
          className={`cook__tab ${
            activeTab === "history" ? "cook__tab--active" : ""
          }`}
          onClick={() => setActiveTab("history")}
        >
          <FaCheckCircle /> История
        </button>
      </div>

      {/* List */}
      <div className="cook__list">
        {loading && <div className="cook__alert">Загрузка…</div>}

        {error && (
          <div
            className="cook__alert"
            style={{ background: "rgba(231, 76, 60, 0.12)", color: "#e74c3c" }}
          >
            Ошибка: {error?.message || error?.detail || String(error)}
          </div>
        )}

        {!loading && !error && filteredTasks.length === 0 && (
          <div className="cook__alert">
            {query.trim()
              ? `Ничего не найдено по запросу «${query}»`
              : activeTab === "current"
              ? "Нет текущих задач"
              : "История пуста"}
          </div>
        )}

        {!loading &&
          !error &&
          filteredTasks.map((task) => {
            const taskDate = formatReceiptDate(task.created_at);
            const isPending = task.status === "pending";
            const isInProgress = task.status === "in_progress";
            const isReady = task.status === "ready";
            const isUpdatingTask = isUpdating(task.id);

            return (
              <article key={task.id} className="cook__receipt">
                {/* Header */}
                <div className="cook__receiptHeader">
                  <div>
                    <div className="cook__receiptTable">
                      СТОЛ {task.table_number || "—"}
                    </div>
                    {task.guest && (
                      <div className="cook__receiptClient">{task.guest}</div>
                    )}
                    {task.waiter_label && (
                      <div className="cook__receiptWaiter">
                        Официант: {task.waiter_label}
                      </div>
                    )}
                  </div>
                  {taskDate && (
                    <div className="cook__receiptDate">{taskDate}</div>
                  )}
                </div>

                {/* Divider */}
                <div className="cook__receiptDivider"></div>

                {/* Task Info */}
                <div className="cook__receiptItems">
                  <div className="cook__receiptItem">
                    <span className="cook__receiptItemName">
                      {task.menu_item_title || "Блюдо"}
                    </span>
                    <span className="cook__receiptItemQty">
                      Порция {task.unit_index || 1}
                    </span>
                    <span className="cook__receiptItemPrice">
                      {toNum(task.price)}
                    </span>
                  </div>
                </div>

                {/* Status Info */}
                {isInProgress && task.started_at && (
                  <div className="cook__receiptStatusInfo">
                    Начато: {formatReceiptDate(task.started_at)}
                  </div>
                )}
                {isReady && task.finished_at && (
                  <div className="cook__receiptStatusInfo">
                    Готово: {formatReceiptDate(task.finished_at)}
                  </div>
                )}

                {/* Dashed Divider */}
                <div className="cook__receiptDivider cook__receiptDivider--dashed"></div>

                {/* Status Badge */}
                <div className="cook__receiptTotal">
                  <span className="cook__receiptTotalLabel">Статус</span>
                  <span
                    className={`cook__receiptStatusBadge cook__receiptStatusBadge--${task.status}`}
                  >
                    {getStatusLabel(task.status)}
                  </span>
                </div>

                {/* Actions */}
                {activeTab === "current" && (
                  <div className="cook__receiptActions">
                    {isPending && (
                      <button
                        className="cook__btn cook__btn--inProgress"
                        onClick={() => handleClaimTask(task)}
                        disabled={isUpdatingTask}
                        title="Взять задачу в работу"
                      >
                        {isUpdatingTask ? "Обновление…" : "В РАБОТУ"}
                      </button>
                    )}
                    {isInProgress && (
                      <button
                        className="cook__btn cook__btn--ready"
                        onClick={() => handleReadyTask(task)}
                        disabled={isUpdatingTask}
                        title="Отметить задачу как готово"
                      >
                        {isUpdatingTask ? "Обновление…" : "ГОТОВ"}
                      </button>
                    )}
                    {isReady && (
                      <button
                        className="cook__btn cook__btn--ready"
                        disabled={true}
                        title="Задача выполнена"
                      >
                        ГОТОВ
                      </button>
                    )}
                  </div>
                )}

                {activeTab === "history" && isReady && (
                  <div className="cook__receiptPaid">
                    <span className="cook__receiptPaidBadge">ГОТОВ</span>
                  </div>
                )}
              </article>
            );
          })}
      </div>
    </section>
  );
};

export default Cook;
