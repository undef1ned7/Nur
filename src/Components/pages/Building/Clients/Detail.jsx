import React, { useEffect, useMemo, useState } from "react";
import { useDispatch } from "react-redux";
import { useNavigate, useParams } from "react-router-dom";
import { useAlert } from "@/hooks/useDialog";
import api from "../../../../api";
import { validateResErrors } from "../../../../../tools/validateResErrors";
import { useBuildingClients } from "@/store/slices/building/clientsSlice";

const OPERATION_TYPE_LABELS = {
  sale: "Покупка",
  booking: "Бронирование",
};

const PAYMENT_TYPE_LABELS = {
  cash: "Полная оплата",
  installment: "Рассрочка",
};

const STATUS_LABELS = {
  draft: "Черновик",
  active: "Активен",
  cancelled: "Отменён",
  completed: "Завершён",
};

export default function BuildingClientDetail() {
  const { id } = useParams();
  const clientId = id ? String(id) : null;
  const dispatch = useDispatch(); // на будущее, если захотим рефрешить списки
  const navigate = useNavigate();
  const alert = useAlert();

  const { list: clientsList } = useBuildingClients();

  const initialClient = useMemo(() => {
    if (!clientId) return null;
    const arr = Array.isArray(clientsList) ? clientsList : [];
    return (
      arr.find((c) => String(c?.id ?? c?.uuid) === String(clientId)) || null
    );
  }, [clientsList, clientId]);

  const [client, setClient] = useState(initialClient);
  const [clientLoading, setClientLoading] = useState(!initialClient);
  const [clientError, setClientError] = useState(null);

  const [allTreaties, setAllTreaties] = useState({
    loading: false,
    loaded: false,
    error: null,
    items: [],
  });

  const loadClient = async () => {
    if (!clientId || client) return;
    setClientLoading(true);
    setClientError(null);
    try {
      const { data } = await api.get(`/building/clients/${clientId}/`);
      setClient(data || null);
    } catch (err) {
      setClientError(err);
    } finally {
      setClientLoading(false);
    }
  };

  const loadTreatiesForClient = async () => {
    if (!clientId || allTreaties.loaded || allTreaties.loading) return;
    setAllTreaties((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const { data } = await api.get("/building/treaties/", {
        params: { client: clientId, page_size: 200 },
      });
      const items = Array.isArray(data?.results)
        ? data.results
        : Array.isArray(data)
        ? data
        : [];
      setAllTreaties({
        loading: false,
        loaded: true,
        error: null,
        items,
      });
    } catch (err) {
      setAllTreaties({
        loading: false,
        loaded: false,
        error: err,
        items: [],
      });
    }
  };

  useEffect(() => {
    if (!client && clientId) {
      loadClient();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId]);

  const handleBack = () => {
    navigate("/crm/building/clients");
  };

  const treatiesByCategory = useMemo(() => {
    const arr = Array.isArray(allTreaties.items) ? allTreaties.items : [];
    const purchases = arr.filter((t) => t.operation_type === "sale");
    const bookings = arr.filter((t) => t.operation_type === "booking");
    const installments = arr.filter((t) => t.payment_type === "installment");
    return { all: arr, purchases, bookings, installments };
  }, [allTreaties.items]);

  const renderTreatiesTable = (items) => {
    if (!items || items.length === 0) {
      return (
        <div className="client-detail__empty">
          Договоров пока нет.
        </div>
      );
    }
    return (
      <div className="client-detail__tableWrap">
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
            {items.map((treaty) => {
              const tid = treaty.id ?? treaty.uuid;
              return (
                <tr
                  key={tid}
                  className="client-detail__tableRow"
                  onClick={() =>
                    tid && navigate(`/crm/building/treaty/${tid}`)
                  }
                >
                  <td>{treaty.number || "—"}</td>
                  <td>{treaty.residential_complex_display || "—"}</td>
                  <td>{treaty.apartment_display || "—"}</td>
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
                  <td>{treaty.total_amount || "—"}</td>
                  <td>
                    {STATUS_LABELS[treaty.status] ||
                      treaty.status ||
                      "—"}
                  </td>
                  <td>{treaty.created_at || "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  };

  const renderTreatiesLoading = () => (
    <div className="sell-loading">
      <div className="sell-loading__spinner" />
      <p className="sell-loading__text">Загрузка договоров...</p>
    </div>
  );

  return (
    <div className="building-page building-page--clients-detail">
      <header className="sell-header">
        <div className="sell-header__content">
          <h1 className="sell-header__title">
            {client?.name || "Клиент"}
          </h1>
          <p className="sell-header__subtitle">
            Детальная информация по клиенту и его договорам
          </p>
        </div>
        <button
          type="button"
          className="sell-header__btn sell-header__btn--secondary"
          onClick={handleBack}
        >
          ← К списку клиентов
        </button>
      </header>

      <div className="sell-card client-detail__card">
        {clientLoading && (
          <div className="sell-loading">
            <div className="sell-loading__spinner" />
            <p className="sell-loading__text">Загрузка информации о клиенте...</p>
          </div>
        )}
        {clientError && (
          <div className="building-page__error">
            {String(
              validateResErrors(
                clientError,
                "Не удалось загрузить клиента",
              ),
            )}
          </div>
        )}
        {client && !clientLoading && (
          <div className="sell-form client-detail__form">
            <section className="sell-form__section">
              <h4 className="sell-form__sectionTitle">Контакты</h4>
              <div className="client-detail__row">
                <span className="sell-form__label">Имя / название</span>
                <span>{client.name || "—"}</span>
              </div>
              <div className="client-detail__row">
                <span className="sell-form__label">Телефон</span>
                <span>{client.phone || "—"}</span>
              </div>
              <div className="client-detail__row">
                <span className="sell-form__label">Email</span>
                <span>{client.email || "—"}</span>
              </div>
            </section>
            <section className="sell-form__section">
              <h4 className="sell-form__sectionTitle">Реквизиты</h4>
              <div className="client-detail__row">
                <span className="sell-form__label">ИНН</span>
                <span>{client.inn || "—"}</span>
              </div>
              <div className="client-detail__row">
                <span className="sell-form__label">Адрес</span>
                <span>{client.address || "—"}</span>
              </div>
            </section>
            <section className="sell-form__section">
              <h4 className="sell-form__sectionTitle">Прочее</h4>
              <div className="client-detail__row">
                <span className="sell-form__label">Заметки</span>
                <span>{client.notes || "—"}</span>
              </div>
              <div className="client-detail__row">
                <span className="sell-form__label">Статус</span>
                <span>
                  {client.is_active ? (
                    <span className="clients-table__status clients-table__status--active">
                      Активен
                    </span>
                  ) : (
                    <span className="clients-table__status clients-table__status--inactive">
                      Отключён
                    </span>
                  )}
                </span>
              </div>
            </section>
          </div>
        )}
      </div>

      <div className="sell-card client-detail__section">
        <details
          className="client-detail__details"
          onToggle={(e) => {
            if (e.currentTarget.open) loadTreatiesForClient();
          }}
        >
          <summary className="client-detail__summary">
            Все договоры клиента
          </summary>
          {allTreaties.loading && renderTreatiesLoading()}
          {allTreaties.error && (
            <div className="building-page__error">
              {String(
                validateResErrors(
                  allTreaties.error,
                  "Не удалось загрузить договоры",
                ),
              )}
            </div>
          )}
          {!allTreaties.loading && !allTreaties.error &&
            renderTreatiesTable(treatiesByCategory.all)}
        </details>
      </div>

      <div className="sell-card client-detail__section">
        <details
          className="client-detail__details"
          onToggle={(e) => {
            if (e.currentTarget.open && !allTreaties.loaded) {
              loadTreatiesForClient();
            }
          }}
        >
          <summary className="client-detail__summary">
            Покупки (продажи)
          </summary>
          {allTreaties.loading && !allTreaties.loaded && renderTreatiesLoading()}
          {allTreaties.loaded &&
            renderTreatiesTable(treatiesByCategory.purchases)}
        </details>
      </div>

      <div className="sell-card client-detail__section">
        <details
          className="client-detail__details"
          onToggle={(e) => {
            if (e.currentTarget.open && !allTreaties.loaded) {
              loadTreatiesForClient();
            }
          }}
        >
          <summary className="client-detail__summary">
            Бронирования
          </summary>
          {allTreaties.loading && !allTreaties.loaded && renderTreatiesLoading()}
          {allTreaties.loaded &&
            renderTreatiesTable(treatiesByCategory.bookings)}
        </details>
      </div>

      <div className="sell-card client-detail__section">
        <details
          className="client-detail__details"
          onToggle={(e) => {
            if (e.currentTarget.open && !allTreaties.loaded) {
              loadTreatiesForClient();
            }
          }}
        >
          <summary className="client-detail__summary">
            Рассрочки
          </summary>
          {allTreaties.loading && !allTreaties.loaded && renderTreatiesLoading()}
          {allTreaties.loaded &&
            renderTreatiesTable(treatiesByCategory.installments)}
        </details>
      </div>
    </div>
  );
}

