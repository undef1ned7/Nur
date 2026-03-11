import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../../../api";
import { validateResErrors } from "../../../../../tools/validateResErrors";
import { useDebouncedValue } from "@/hooks/useDebounce";
import { asDateTime } from "../shared/constants";
import { LayoutGrid, Table2 } from "lucide-react";

const OPERATION_TYPE_LABELS = {
  sale: "Покупка",
  booking: "Бронирование",
};

const PAYMENT_TYPE_LABELS = {
  full: "Полная оплата",
  installment: "Рассрочка",
};

const STATUS_LABELS = {
  draft: "Черновик",
  active: "Активен",
  signed: "Подписан",
  cancelled: "Отменён",
};

export default function ClientTreatiesTab({ clientId }) {
  const navigate = useNavigate();

  const [state, setState] = useState({
    loading: false,
    loaded: false,
    error: null,
    items: [],
  });

  const [search, setSearch] = useState("");
  const [operationFilter, setOperationFilter] = useState("all");
  const [paymentFilter, setPaymentFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [viewMode, setViewMode] = useState("table"); // table | cards

  const debouncedSearch = useDebouncedValue(search, 400);

  useEffect(() => {
    if (!clientId) return;
    const load = async () => {
      setState((prev) => ({ ...prev, loading: true, error: null }));
      try {
        const params = {
          client: clientId,
          page_size: 200,
        };

        if (operationFilter !== "all") {
          params.operation_type = operationFilter;
        }
        if (paymentFilter !== "all") {
          params.payment_type = paymentFilter;
        }
        if (statusFilter !== "all") {
          params.status = statusFilter;
        }
        if (debouncedSearch && debouncedSearch.trim()) {
          params.search = debouncedSearch.trim();
        }

        const { data } = await api.get("/building/treaties/", {
          params,
        });
        const items = Array.isArray(data?.results)
          ? data.results
          : Array.isArray(data)
          ? data
          : [];
        setState((prev) => ({
          ...prev,
          loading: false,
          loaded: true,
          error: null,
          items,
        }));
      } catch (err) {
        setState((prev) => ({
          ...prev,
          loading: false,
          loaded: false,
          error: err,
          items: [],
        }));
      }
    };
    load();
  }, [
    clientId,
    operationFilter,
    paymentFilter,
    statusFilter,
    debouncedSearch,
  ]);

  if (!clientId) {
    return (
      <div className="client-detail__empty">
        Клиент не найден.
      </div>
    );
  }

  return (
    <div className="client-detail__treaties">
      <div className="client-detail__treatiesToolbar">
        <input
          type="text"
          className="clients-toolbar__search"
          placeholder="Поиск по номеру, ЖК или квартире"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="client-detail__treatiesFilters">
          <select
            className="building-page__input"
            value={operationFilter}
            onChange={(e) => setOperationFilter(e.target.value)}
          >
            <option value="all">Все операции</option>
            <option value="sale">Покупка</option>
            <option value="booking">Бронирование</option>
          </select>
          <select
            className="building-page__input"
            value={paymentFilter}
            onChange={(e) => setPaymentFilter(e.target.value)}
          >
            <option value="all">Все типы оплаты</option>
            <option value="full">Полная оплата</option>
            <option value="installment">Рассрочка</option>
          </select>
          <select
            className="building-page__input"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">Все статусы</option>
            <option value="draft">Черновик</option>
            <option value="active">Активен</option>
            <option value="signed">Подписан</option>
            <option value="cancelled">Отменён</option>
          </select>
        </div>
      </div>

      {state.loading && !state.loaded && (
        <div className="sell-loading">
          <div className="sell-loading__spinner" />
          <p className="sell-loading__text">Загрузка договоров...</p>
        </div>
      )}

      {state.error && (
        <div className="building-page__error" style={{ marginTop: 12 }}>
          {String(
            validateResErrors(
              state.error,
              "Не удалось загрузить договоры",
            ),
          )}
        </div>
      )}

      {!state.loading && !state.error && (!state.items || state.items.length === 0) && (
        <div className="client-detail__empty" style={{ marginTop: 12 }}>
          Договоров по заданным условиям нет.
        </div>
      )}

      {!state.loading && state.items && state.items.length > 0 && (
        <>
          <div className="salary-view-toggle" style={{ marginTop: 12, marginBottom: 8 }}>
            <button
              type="button"
              className={
                viewMode === "table"
                  ? "salary-tab salary-tab--active"
                  : "salary-tab"
              }
              onClick={() => setViewMode("table")}
            >
              <Table2 size={14} style={{ marginRight: 6 }} />
              Таблица
            </button>
            <button
              type="button"
              className={
                viewMode === "cards"
                  ? "salary-tab salary-tab--active"
                  : "salary-tab"
              }
              onClick={() => setViewMode("cards")}
            >
              <LayoutGrid size={14} style={{ marginRight: 6 }} />
              Список
            </button>
          </div>

          {viewMode === "table" && (
            <div className="client-detail__tableWrap" style={{ marginTop: 4 }}>
              <table className="client-detail__table">
                <thead>
                  <tr>
                    <th>Номер</th>
                    <th>ЖК</th>
                    <th>Квартира</th>
                    <th>Тип операции</th>
                    <th>Тип оплаты</th>
                    <th>Сумма</th>
                    <th>Статус</th>
                    <th>Дата</th>
                  </tr>
                </thead>
                <tbody>
                  {state.items.map((treaty) => {
                    const tid = treaty.id ?? treaty.uuid;
                    const rcName =
                      treaty.residential_complex_display ||
                      treaty.residential_complex_name ||
                      "—";
                    const aptDisplay =
                      treaty.apartment_display ||
                      (treaty.apartment_number != null
                        ? `Кв. ${treaty.apartment_number}${
                            treaty.apartment_floor != null
                              ? `, этаж ${treaty.apartment_floor}`
                              : ""
                          }`
                        : "—");
                    const amount = treaty.total_amount || treaty.amount || "—";
                    return (
                      <tr
                        key={tid}
                        className="client-detail__tableRow"
                        onClick={() =>
                          tid && navigate(`/crm/building/treaty/${tid}`)
                        }
                      >
                        <td>{treaty.number || "—"}</td>
                        <td>{rcName}</td>
                        <td>{aptDisplay}</td>
                        <td>
                          {OPERATION_TYPE_LABELS[treaty.operation_type] ||
                            treaty.operation_type ||
                            "—"}
                        </td>
                        <td>
                          {PAYMENT_TYPE_LABELS[treaty.payment_type] ||
                            treaty.payment_type ||
                            "—"}
                        </td>
                        <td>{amount}</td>
                        <td>
                          {STATUS_LABELS[treaty.status] ||
                            treaty.status ||
                            "—"}
                        </td>
                        <td>{asDateTime(treaty.created_at)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {viewMode === "cards" && (
            <div className="salary-lines-cards" style={{ marginTop: 4 }}>
              {state.items.map((treaty) => {
                const tid = treaty.id ?? treaty.uuid;
                const rcName =
                  treaty.residential_complex_display ||
                  treaty.residential_complex_name ||
                  "—";
                const aptDisplay =
                  treaty.apartment_display ||
                  (treaty.apartment_number != null
                    ? `Кв. ${treaty.apartment_number}${
                        treaty.apartment_floor != null
                          ? `, этаж ${treaty.apartment_floor}`
                          : ""
                      }`
                    : "—");
                const amount = treaty.total_amount || treaty.amount || "—";
                const statusLabel =
                  STATUS_LABELS[treaty.status] || treaty.status || "—";

                return (
                  <div
                    key={tid}
                    className="salary-line-card"
                    onClick={() =>
                      tid && navigate(`/crm/building/treaty/${tid}`)
                    }
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        tid && navigate(`/crm/building/treaty/${tid}`);
                      }
                    }}
                  >
                    <div className="salary-line-card__main">
                      <div className="salary-line-card__title">
                        {treaty.number || "Без номера"}
                      </div>
                      <div className="salary-line-card__row">
                        <span className="salary-line-card__label">ЖК:</span>
                        <span>{rcName}</span>
                      </div>
                      <div className="salary-line-card__row">
                        <span className="salary-line-card__label">Квартира:</span>
                        <span>{aptDisplay}</span>
                      </div>
                      <div className="salary-line-card__row">
                        <span className="salary-line-card__label">Сумма:</span>
                        <span>{amount}</span>
                      </div>
                      <div className="salary-line-card__row">
                        <span className="salary-line-card__label">Статус:</span>
                        <span>{statusLabel}</span>
                      </div>
                      <div className="salary-line-card__row">
                        <span className="salary-line-card__label">Дата:</span>
                        <span>{asDateTime(treaty.created_at)}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}

