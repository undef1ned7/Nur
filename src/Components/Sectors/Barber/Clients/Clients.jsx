// Clients.jsx
import React, { useState, lazy, Suspense } from "react";
import "./Clients.scss";
import BarberClients from "./BarberClients";

const MarketClients = lazy(() => import("../../Market/Clients/Clients"));

export const Clients = () => {
  const [activeTab, setActiveTab] = useState("barber");

  return (
    <div className="barberclient">
      <nav className="barberclient__tabs" aria-label="Секции">
        <button
          type="button"
          onClick={() => setActiveTab("barber")}
          className={`barberclient__tab ${
            activeTab === "barber" ? "barberclient__tab--active" : ""
          }`}
        >
          Клиенты барбершоп
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("market")}
          className={`barberclient__tab ${
            activeTab === "market" ? "barberclient__tab--active" : ""
          }`}
        >
          Клиенты Продаж
        </button>
      </nav>

      {activeTab === "barber" ? (
        <BarberClients />
      ) : (
        <Suspense
          fallback={
            <div className="barberclient__loading">Загрузка…</div>
          }
        >
          <MarketClients />
        </Suspense>
      )}
    </div>
  );
};

export default Clients;
