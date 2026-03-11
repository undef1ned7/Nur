import React from "react";

export default function ClientInfoTab({ client }) {
  if (!client) return null;

  return (
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
  );
}

