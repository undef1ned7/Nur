import React, { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useDispatch } from "react-redux";
import { fetchBuildingTreatyById } from "@/store/creators/building/treatiesCreators";
import { validateResErrors } from "../../../../../tools/validateResErrors";
import ClientInfoTab from "./ClientInfoTab";
import InstallmentsListTab from "./InstallmentsListTab";

const TAB_CLIENT = "client";
const TAB_INSTALLMENTS = "installments";

export default function CashRegisterTreatyDetail() {
  const { treatyId } = useParams();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const id = treatyId ? String(treatyId) : null;

  const [treaty, setTreaty] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const initialTabFromUrl = searchParams.get("tab");
  const [activeTab, setActiveTab] = useState(
    initialTabFromUrl === TAB_INSTALLMENTS ? TAB_INSTALLMENTS : TAB_CLIENT,
  );

  const handleTabChange = (nextTab) => {
    setActiveTab(nextTab);
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (nextTab === TAB_CLIENT) {
          next.delete("tab");
        } else {
          next.set("tab", nextTab);
        }
        return next;
      },
      { replace: true },
    );
  };

  const fetchTreaty = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const res = await dispatch(fetchBuildingTreatyById(id));
      if (res.meta?.requestStatus === "fulfilled" && res.payload) {
        setTreaty(res.payload);
      } else {
        setError(res.payload || res.error || "Договор не найден");
        setTreaty(null);
      }
    } catch (err) {
      setError(validateResErrors(err, "Не удалось загрузить договор"));
      setTreaty(null);
    } finally {
      setLoading(false);
    }
  }, [id, dispatch]);

  useEffect(() => {
    fetchTreaty();
  }, [fetchTreaty]);

  const handlePaymentSuccess = () => {
    fetchTreaty();
  };

  if (!id) {
    return (
      <div className="building-page__card" style={{ padding: 24 }}>
        <div className="building-page__muted">Не указан договор.</div>
        <button
          type="button"
          className="building-btn"
          style={{ marginTop: 12 }}
          onClick={() => navigate("/crm/building/cash-register")}
        >
          ← К кассе
        </button>
      </div>
    );
  }

  if (loading && !treaty) {
    return (
      <div className="building-page__card" style={{ padding: 24 }}>
        <div className="building-page__muted">Загрузка договора...</div>
      </div>
    );
  }

  if (error && !treaty) {
    return (
      <div className="building-page__card" style={{ padding: 24 }}>
        <div className="building-page__error">{String(error)}</div>
        <button
          type="button"
          className="building-btn"
          style={{ marginTop: 12 }}
          onClick={() => navigate("/crm/building/cash-register")}
        >
          ← К кассе
        </button>
      </div>
    );
  }

  return (
    <div className="warehouse-page">
      <div className="warehouse-header">
        <div className="warehouse-header__left">
          <div className="warehouse-header__title-section">
            <h1 className="warehouse-header__title">
              Договор: {treaty?.number ?? treaty?.title ?? "—"}
            </h1>
            <p className="warehouse-header__subtitle">
              Выплаты по рассрочке · {treaty?.client_display ?? treaty?.client_name ?? "Клиент"}
            </p>
          </div>
        </div>
        <button
          type="button"
          className="warehouse-header__create-btn"
          style={{ padding: "8px 16px", borderRadius: 8 }}
          onClick={() => navigate("/crm/building/cash-register")}
        >
          ← К кассе
        </button>
      </div>

      <div
        className="cash-register-tabs"
        style={{ display: "flex", gap: 8, marginBottom: 16 }}
      >
        <button
          type="button"
          onClick={() => handleTabChange(TAB_CLIENT)}
          className={
            activeTab === TAB_CLIENT
              ? "warehouse-view-btn bg-slate-900 text-white border-slate-900"
              : "warehouse-view-btn bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
          }
          style={{
            padding: "8px 16px",
            borderRadius: 8,
            border: "1px solid",
            fontWeight: 500,
          }}
        >
          Информация о клиенте
        </button>
        <button
          type="button"
          onClick={() => handleTabChange(TAB_INSTALLMENTS)}
          className={
            activeTab === TAB_INSTALLMENTS
              ? "warehouse-view-btn bg-slate-900 text-white border-slate-900"
              : "warehouse-view-btn bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
          }
          style={{
            padding: "8px 16px",
            borderRadius: 8,
            border: "1px solid",
            fontWeight: 500,
          }}
        >
          Список рассрочки
        </button>
      </div>

      {activeTab === TAB_CLIENT && <ClientInfoTab treaty={treaty} />}
      {activeTab === TAB_INSTALLMENTS && (
        <InstallmentsListTab
          treaty={treaty}
          onPaymentSuccess={handlePaymentSuccess}
        />
      )}
    </div>
  );
}
