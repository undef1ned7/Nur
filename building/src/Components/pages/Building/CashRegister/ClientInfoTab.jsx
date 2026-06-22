import React from "react";
import { asCurrency } from "../shared/constants";

/**
 * Вкладка «Информация о клиенте» на странице договора рассрочки (касса).
 * Принимает объект договора (treaty) и отображает данные клиента и договора.
 */
export default function ClientInfoTab({ treaty }) {
  if (!treaty) {
    return (
      <div className="building-page__muted" style={{ padding: 24 }}>
        Нет данных о договоре.
      </div>
    );
  }

  const clientName =
    treaty.client_display ??
    treaty.client_name ??
    (typeof treaty.client === "object" && treaty.client
      ? treaty.client.name ?? treaty.client.display ?? "—"
      : "—");
  const clientPhone =
    treaty.client_phone ??
    (typeof treaty.client === "object" && treaty.client
      ? treaty.client.phone ?? treaty.client.phone_number
      : null) ??
    "—";
  const clientEmail =
    treaty.client_email ??
    (typeof treaty.client === "object" && treaty.client
      ? treaty.client.email
      : null) ??
    "—";
  const rcName =
    treaty.residential_complex_name ??
    treaty.residential_complex_display ??
    "—";
  const treatyNumber = treaty.number ?? treaty.title ?? "—";
  const amount = treaty.amount ?? treaty.total ?? null;

  return (
    <div className="building-page__card" style={{ padding: 24 }}>
      <h3 className="building-page__cardTitle" style={{ marginBottom: 16 }}>
        Информация о клиенте
      </h3>
      <dl
        style={{
          display: "grid",
          gap: "12px 24px",
          gridTemplateColumns: "auto 1fr",
          margin: 0,
        }}
      >
        <dt style={{ margin: 0, color: "#64748b", fontWeight: 500 }}>
          Клиент
        </dt>
        <dd style={{ margin: 0 }}>{clientName}</dd>

        {clientPhone && clientPhone !== "—" && (
          <>
            <dt style={{ margin: 0, color: "#64748b", fontWeight: 500 }}>
              Телефон
            </dt>
            <dd style={{ margin: 0 }}>{clientPhone}</dd>
          </>
        )}

        {clientEmail && clientEmail !== "—" && (
          <>
            <dt style={{ margin: 0, color: "#64748b", fontWeight: 500 }}>
              Email
            </dt>
            <dd style={{ margin: 0 }}>{clientEmail}</dd>
          </>
        )}

        <dt style={{ margin: 0, color: "#64748b", fontWeight: 500 }}>ЖК</dt>
        <dd style={{ margin: 0 }}>{rcName}</dd>

        <dt style={{ margin: 0, color: "#64748b", fontWeight: 500 }}>
          Договор
        </dt>
        <dd style={{ margin: 0 }}>{treatyNumber}</dd>

        {amount != null && (
          <>
            <dt style={{ margin: 0, color: "#64748b", fontWeight: 500 }}>
              Сумма договора
            </dt>
            <dd style={{ margin: 0, fontWeight: 600 }}>
              {asCurrency(amount)}
            </dd>
          </>
        )}
      </dl>
    </div>
  );
}
