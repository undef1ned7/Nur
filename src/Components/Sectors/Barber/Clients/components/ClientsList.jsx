// ClientsList.jsx
import React from "react";
import { FaHistory } from "react-icons/fa";
import { UI_TO_API_STATUS } from "../barberClientConstants";
import { getInitials } from "../barberClientUtils";
import Loading from "../../../../common/Loading/Loading";
import Pager from "./Pager";

const formatDate = (dateStr) => {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric" });
};

const ClientsList = ({
  pageError,
  loading,
  clients,
  count,
  page,
  next,
  previous,
  totalPages,
  viewMode,
  onOpenModal,
  onPageChange,
  onOpenHistory,
}) => {
  if (pageError) {
    return <div className="barberclient__alert">{pageError}</div>;
  }

  if (loading) {
    return <Loading message="Загрузка клиентов..." />;
  }

  if (!clients || clients.length === 0) {
    return (
      <div className="barberclient__empty">
        Ничего не найдено
      </div>
    );
  }

  const renderCard = (client) => {
    const statusCode = UI_TO_API_STATUS[client.status] || "active";

    const cardClass = `barberclient__card ${
      statusCode === "vip" ? "barberclient__card--vip" : 
      statusCode === "blacklist" ? "barberclient__card--blacklist" : ""
    }`;

    return (
      <article 
        key={client.id} 
        className={cardClass}
        onClick={() => onOpenModal(client)}
      >
        <div className="barberclient__cardLeft">
          <div className="barberclient__avatar">
            {getInitials(client.fullName) || client.fullName?.[0] || "?"}
          </div>
          <div className="barberclient__cardInfo">
            <h4 className="barberclient__cardName">{client.fullName || "—"}</h4>
            <div className="barberclient__cardMeta">
              <span className="barberclient__cardPhone">{client.phone || "—"}</span>
            </div>
          </div>
        </div>

        <div className="barberclient__cardActions" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            className="barberclient__historyBtn"
            onClick={() => onOpenHistory(client)}
            title="История записей"
            aria-label="История записей"
          >
            <FaHistory />
          </button>
        </div>
      </article>
    );
  };

  const renderTable = () => (
    <div className="barberclient__tableWrap">
      <table className="barberclient__table">
        <thead>
          <tr>
            <th>Клиент</th>
            <th>Телефон</th>
            <th>История</th>
          </tr>
        </thead>
        <tbody>
          {clients.map((client) => {
            const statusCode = UI_TO_API_STATUS[client.status] || "active";

            const rowClass = `barberclient__row ${
              statusCode === "vip" ? "barberclient__row--vip" : 
              statusCode === "blacklist" ? "barberclient__row--blacklist" : ""
            }`;

            return (
              <tr 
                key={client.id} 
                className={rowClass}
                onClick={() => onOpenModal(client)}
              >
                <td className="barberclient__cellName">
                  <div className="barberclient__cellNameWrap">
                    <div className="barberclient__avatarSmall">
                      {getInitials(client.fullName) || client.fullName?.[0] || "?"}
                    </div>
                    <span>{client.fullName || "—"}</span>
                  </div>
                </td>
                <td>{client.phone || "—"}</td>
                <td onClick={(e) => e.stopPropagation()}>
                  <button
                    type="button"
                    className="barberclient__historyBtn"
                    onClick={() => onOpenHistory(client)}
                    title="История записей"
                    aria-label="История записей"
                  >
                    <FaHistory />
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );

  return (
    <>
      {viewMode === "cards" ? (
        <div className="barberclient__list">
          {clients.map(renderCard)}
        </div>
      ) : (
        renderTable()
      )}
      <Pager
        count={count}
        page={page}
        totalPages={totalPages}
        next={next}
        previous={previous}
        onChange={onPageChange}
      />
    </>
  );
};

export default ClientsList;
