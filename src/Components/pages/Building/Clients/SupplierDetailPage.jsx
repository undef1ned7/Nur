import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import api from "../../../../api";
import { validateResErrors } from "../../../../../tools/validateResErrors";
import { useBuildingSuppliers } from "@/store/slices/building/suppliersSlice";
import SupplierInfoTab from "./SupplierInfoTab";
import SupplierHistoryTab from "./SupplierHistoryTab";
import SupplierMaterialsTab from "./SupplierMaterialsTab";

export default function SupplierDetailPage() {
  const { id } = useParams();
  const supplierId = id ? String(id) : null;
  const navigate = useNavigate();

  const { list: suppliersList } = useBuildingSuppliers();
  const [searchParams, setSearchParams] = useSearchParams();

  const initialSupplier = useMemo(() => {
    if (!supplierId) return null;
    const arr = Array.isArray(suppliersList) ? suppliersList : [];
    return (
      arr.find((s) => String(s?.id ?? s?.uuid) === String(supplierId)) || null
    );
  }, [suppliersList, supplierId]);

  const [supplier, setSupplier] = useState(initialSupplier);
  const [loading, setLoading] = useState(!initialSupplier);
  const [error, setError] = useState(null);
  const initialTab = (() => {
    const fromUrl = searchParams.get("tab");
    if (fromUrl === "history" || fromUrl === "materials") return fromUrl;
    return "info";
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

  useEffect(() => {
    const loadSupplier = async () => {
      if (!supplierId || supplier) return;
      setLoading(true);
      setError(null);
      try {
        const { data } = await api.get(`/building/suppliers/${supplierId}/`);
        setSupplier(data || null);
      } catch (err) {
        setError(err);
      } finally {
        setLoading(false);
      }
    };

    loadSupplier();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supplierId]);

  const handleBack = () => {
    navigate("/crm/building/clients?tab=suppliers");
  };

  return (
    <div className="building-page building-page--clients-detail">
      <header className="sell-header">
        <div className="sell-header__content">
          <h1 className="sell-header__title">
            {supplier?.company_name || "Поставщик"}
          </h1>
          <p className="sell-header__subtitle">
            Детальная информация о поставщике
          </p>
        </div>
        <button
          type="button"
          className="sell-header__btn sell-header__btn--secondary"
          onClick={handleBack}
        >
          ← К списку поставщиков
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
          Информация о поставщике
        </button>
        <button
          type="button"
          className={
            activeTab === "history"
              ? "client-detail__tab client-detail__tab--active"
              : "client-detail__tab"
          }
          onClick={() => handleTabChange("history")}
        >
          История поставок
        </button>
        <button
          type="button"
          className={
            activeTab === "materials"
              ? "client-detail__tab client-detail__tab--active"
              : "client-detail__tab"
          }
          onClick={() => handleTabChange("materials")}
        >
          Материалы и доставка
        </button>
      </div>

      {activeTab === "info" && (
        <div className="sell-card client-detail__card">
          {loading && (
            <div className="sell-loading">
              <div className="sell-loading__spinner" />
              <p className="sell-loading__text">
                Загрузка информации о поставщике...
              </p>
            </div>
          )}
          {error && (
            <div className="building-page__error">
              {String(
                validateResErrors(error, "Не удалось загрузить поставщика"),
              )}
            </div>
          )}
          {supplier && !loading && <SupplierInfoTab supplier={supplier} />}
        </div>
      )}

      {activeTab === "history" && supplierId && (
        <div className="sell-card client-detail__section">
          <SupplierHistoryTab supplierId={supplierId} />
        </div>
      )}

      {activeTab === "materials" && supplier && (
        <div className="sell-card client-detail__card">
          <SupplierMaterialsTab supplier={supplier} />
        </div>
      )}
    </div>
  );
}

