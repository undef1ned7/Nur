// BarberClientsList.jsx
import React from "react";
import { FaEdit, FaUserPlus, FaCheck, FaEye } from "react-icons/fa";
import { UI_TO_API_STATUS, PAGE_SIZE } from "./barberClientConstants";
import { getInitials } from "./barberClientUtils";

const BarberClientsList = ({
  pageError,
  loading,
  pageSlice,
  filteredCount,
  pageSafe,
  totalPages,
  apptsByClient,
  creatingClientIds,
  crmCreatedIds,
  onOpenHistory,
  onOpenModal,
  onMakeMarketClient,
  onPrevPage,
  onNextPage,
}) => {
  if (pageError) {
    return <div className="barberclient__alert">{pageError}</div>;
  }

  if (loading) {
    return (
      <div className="barberclient__skeleton-list">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="barberclient__skeleton-card" />
        ))}
      </div>
    );
  }

  return (
    <>
      <div className="barberclient__list">
        {pageSlice.map((client) => {
          const appts = apptsByClient.get(client.id) || [];
          const making = creatingClientIds.has(client.id);
          const alreadyMade = crmCreatedIds.has(client.id);
          const statusCode = UI_TO_API_STATUS[client.status] || "active";

          return (
            <article key={client.id} className="barberclient__card">
              <div className="barberclient__card-left">
                <div className="barberclient__avatar">
                  {getInitials(client.fullName) ||
                    client.fullName?.[0] ||
                    "?"}
                </div>
                <div className="barberclient__info">
                  <h4 className="barberclient__name">
                    {client.fullName || "—"}
                  </h4>
                  <div className="barberclient__meta">
                    <span
                      className={`barberclient__badge barberclient__badge--${statusCode}`}
                    >
                      {client.status}
                    </span>
                    <span>{client.phone || "—"}</span>
                    <span>•</span>
                    <span>Записей: {appts.length}</span>
                  </div>
                </div>
              </div>

              <div className="barberclient__card-actions">
                <button
                  className="barberclient__icon-btn"
                  onClick={() => onOpenHistory(client)}
                  aria-label="История"
                  title="История записей"
                  type="button"
                >
                  <FaEye />
                </button>

                <button
                  className="barberclient__icon-btn"
                  onClick={() => onOpenModal(client)}
                  aria-label="Редактировать"
                  title="Редактировать клиента"
                  type="button"
                >
                  <FaEdit />
                </button>

                <button
                  className="barberclient__icon-btn barberclient__icon-btn--primary"
                  onClick={() => onMakeMarketClient(client)}
                  disabled={making || alreadyMade}
                  aria-label={
                    making
                      ? "Создание клиента в CRM…"
                      : alreadyMade
                      ? "Клиент уже создан в CRM"
                      : "Создать клиента в CRM"
                  }
                  title={
                    making
                      ? "Создание клиента в CRM…"
                      : alreadyMade
                      ? "Клиент уже создан в CRM"
                      : "Создать клиента в CRM"
                  }
                  type="button"
                >
                  {alreadyMade ? (
                    <FaCheck />
                  ) : (
                    <FaUserPlus
                      className={`barberclient__btn-icon ${
                        making ? "is-spinning" : ""
                      }`}
                    />
                  )}
                </button>
              </div>
            </article>
          );
        })}

        {!pageSlice.length && (
          <div
            className="barberclient__loading"
            style={{ textAlign: "center" }}
          >
            Ничего не найдено
          </div>
        )}
      </div>

      {filteredCount > PAGE_SIZE && (
        <nav className="barberclient__pager" aria-label="Пагинация">
          <button
            type="button"
            className="barberclient__pager-btn"
            disabled={pageSafe <= 1}
            onClick={onPrevPage}
          >
            Назад
          </button>
          <span className="barberclient__pager-info">
            Страница {pageSafe} из {totalPages}
          </span>
          <button
            type="button"
            className="barberclient__pager-btn"
            disabled={pageSafe >= totalPages}
            onClick={onNextPage}
          >
            Вперёд
          </button>
        </nav>
      )}
    </>
  );
};

export default BarberClientsList;
