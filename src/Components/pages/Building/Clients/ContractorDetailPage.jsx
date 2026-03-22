import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import api from "../../../../api";
import { validateResErrors } from "../../../../../tools/validateResErrors";
import { useBuildingContractors } from "@/store/slices/building/contractorsSlice";
import ContractorInfoTab from "./ContractorInfoTab";
import ContractorEquipmentTab from "./ContractorEquipmentTab";
import ContractorHistoryTab from "./ContractorHistoryTab";
import CounterpartySettlementsTab from "./CounterpartySettlementsTab";

export default function ContractorDetailPage() {
  const { id } = useParams();
  const contractorId = id ? String(id) : null;
  const navigate = useNavigate();

  const { list: contractorsList } = useBuildingContractors();
  const [searchParams, setSearchParams] = useSearchParams();

  const initialContractor = useMemo(() => {
    if (!contractorId) return null;
    const arr = Array.isArray(contractorsList) ? contractorsList : [];
    return (
      arr.find((c) => String(c?.id ?? c?.uuid) === String(contractorId)) || null
    );
  }, [contractorsList, contractorId]);

  const [contractor, setContractor] = useState(initialContractor);
  const [loading, setLoading] = useState(!initialContractor);
  const [error, setError] = useState(null);

  const initialTab = (() => {
    const fromUrl = searchParams.get("tab");
    if (
      fromUrl === "work-history" ||
      fromUrl === "equipment" ||
      fromUrl === "settlements"
    ) {
      return fromUrl;
    }
    return "info";
  })();
  const [activeTab, setActiveTab] = useState(initialTab);

  const handleTabChange = (nextTab) => {
    setActiveTab(nextTab);
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (nextTab === "info") {
          next.delete("tab");
        } else {
          next.set("tab", nextTab);
        }
        return next;
      },
      { replace: true },
    );
  };

  useEffect(() => {
    const loadContractor = async () => {
      if (!contractorId || contractor) return;
      setLoading(true);
      setError(null);
      try {
        const { data } = await api.get(`/building/contractors/${contractorId}/`);
        setContractor(data || null);
      } catch (err) {
        setError(err);
      } finally {
        setLoading(false);
      }
    };

    loadContractor();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contractorId]);

  const handleBack = () => {
    navigate("/crm/building/clients?tab=contractors");
  };

  return (
    <div className="building-page building-page--clients-detail">
      <header className="sell-header">
        <div className="sell-header__content">
          <h1 className="sell-header__title">
            {contractor?.company_name || "Подрядчик"}
          </h1>
          <p className="sell-header__subtitle">
            Детальная информация о подрядчике
          </p>
        </div>
        <button
          type="button"
          className="sell-header__btn sell-header__btn--secondary"
          onClick={handleBack}
        >
          ← К списку подрядчиков
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
          Информация о подрядчике
        </button>
        {/* Заглушки для будущих вкладок истории и оборудования */}
        <button
          type="button"
          className={
            activeTab === "work-history"
              ? "client-detail__tab client-detail__tab--active"
              : "client-detail__tab"
          }
          onClick={() => handleTabChange("work-history")}
        >
          История работ
        </button>
        <button
          type="button"
          className={
            activeTab === "equipment"
              ? "client-detail__tab client-detail__tab--active"
              : "client-detail__tab"
          }
          onClick={() => handleTabChange("equipment")}
        >
          Оборудование и специализации
        </button>
        <button
          type="button"
          className={
            activeTab === "settlements"
              ? "client-detail__tab client-detail__tab--active"
              : "client-detail__tab"
          }
          onClick={() => handleTabChange("settlements")}
        >
          Взаиморасчёты
        </button>
      </div>

      {activeTab === "info" && (
        <div className="sell-card client-detail__card">
          {loading && (
            <div className="sell-loading">
              <div className="sell-loading__spinner" />
              <p className="sell-loading__text">
                Загрузка информации о подрядчике...
              </p>
            </div>
          )}
          {error && (
            <div className="building-page__error">
              {String(
                validateResErrors(error, "Не удалось загрузить подрядчика"),
              )}
            </div>
          )}
          {contractor && !loading && (
            <ContractorInfoTab contractor={contractor} />
          )}
        </div>
      )}

      {activeTab === "work-history" && (
        <div className="sell-card client-detail__card">
          <ContractorHistoryTab contractorId={contractorId} />
        </div>
      )}

      {activeTab === "equipment" && contractor && (
        <div className="sell-card client-detail__card">
          <ContractorEquipmentTab contractor={contractor} />
        </div>
      )}

      {activeTab === "settlements" && contractorId && (
        <div className="sell-card client-detail__card">
          <CounterpartySettlementsTab
            counterpartyType="contractor"
            counterpartyId={contractorId}
          />
        </div>
      )}
    </div>
  );
}

