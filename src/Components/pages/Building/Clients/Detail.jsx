import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import api from "../../../../api";
import { validateResErrors } from "../../../../../tools/validateResErrors";
import { useBuildingClients } from "@/store/slices/building/clientsSlice";
import ClientInfoTab from "./ClientInfoTab";
import ClientTreatiesTab from "./ClientTreatiesTab";

export default function BuildingClientDetail() {
  const { id } = useParams();
  const clientId = id ? String(id) : null;
  const navigate = useNavigate();

  const { list: clientsList } = useBuildingClients();
  const [searchParams, setSearchParams] = useSearchParams();

  const initialClient = useMemo(() => {
    if (!clientId) return null;
    const arr = Array.isArray(clientsList) ? clientsList : [];
    return (
      arr.find((c) => String(c?.id ?? c?.uuid) === String(clientId)) || null
    );
  }, [clientsList, clientId]);

  const [client, setClient] = useState(initialClient);
  const [clientLoading, setClientLoading] = useState(false);
  const [clientError, setClientError] = useState(null);
  const initialTab = (() => {
    const fromUrl = searchParams.get("tab");
    return fromUrl === "treaties" ? "treaties" : "info";
  })();
  const [activeTab, setActiveTab] = useState(initialTab);

  const handleTabChange = (nextTab) => {
    setActiveTab(nextTab);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (nextTab === "info") {
        next.delete("tab");
      } else {
        next.set("tab", nextTab);
      }
      return next;
    }, { replace: true });
  };

  const loadClient = async () => {
    if (!clientId) return;
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
    if (clientId) {
      loadClient();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId]);

  const handleBack = () => {
    navigate("/crm/building/clients");
  };

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

      <div className="client-detail__tabs">
        <button
          type="button"
          className={
            activeTab === "info"
              ? "client-detail__tab client-detail__tab--active"
              : "client-detail__tab"
          }
          onClick={() => handleTabChange("info")}
        >
          Информация о клиенте
        </button>
        <button
          type="button"
          className={
            activeTab === "treaties"
              ? "client-detail__tab client-detail__tab--active"
              : "client-detail__tab"
          }
          onClick={() => handleTabChange("treaties")}
        >
          Договора
        </button>
      </div>

      {activeTab === "info" && (
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
          {client && !clientLoading && <ClientInfoTab client={client} />}
        </div>
      )}

      {activeTab === "treaties" && (
        <div className="sell-card client-detail__section">
          <ClientTreatiesTab clientId={clientId} />
        </div>
      )}
    </div>
  );
}

