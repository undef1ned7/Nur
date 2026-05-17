import React, { useCallback, useEffect, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Check, Plus, RefreshCw, Send, X } from "lucide-react";
import { useUser } from "../../../../../store/slices/userSlice";
import {
  acceptStockPartnershipRequest,
  cancelStockPartnershipRequest,
  createStockPartnershipRequest,
  getStockPartnerCatalog,
  listActiveStockPartners,
  listStockPartnershipRequests,
  rejectStockPartnershipRequest,
  searchAgentCompanies,
} from "../../../../../api/warehouse";
import { fetchWarehousesAsync } from "../../../../../store/creators/warehouseCreators";
import StockPartnershipTransferModal from "./StockPartnershipTransferModal";
import "../Warehouses.scss";

const fmtDateTime = (iso) => {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("ru-RU");
  } catch {
    return String(iso);
  }
};

const statusLabel = (status) => {
  switch (status) {
    case "PENDING":
      return "Ожидает";
    case "ACCEPTED":
      return "Принята";
    case "REJECTED":
      return "Отклонена";
    case "CANCELLED":
      return "Отозвана";
    default:
      return status || "—";
  }
};

const statusClass = (status) => {
  switch (status) {
    case "PENDING":
      return "badge--pending";
    case "ACCEPTED":
      return "badge--approved";
    case "REJECTED":
      return "badge--rejected";
    case "CANCELLED":
      return "badge--removed";
    default:
      return "badge--draft";
  }
};

const extractError = (err) => {
  if (!err) return "Неизвестная ошибка";
  if (typeof err === "string") return err;
  if (err.detail) return String(err.detail);
  const parts = Object.entries(err).map(([k, v]) => {
    if (typeof v === "object") return `${k}: ${JSON.stringify(v)}`;
    return `${k}: ${v}`;
  });
  return parts.length ? parts.join("; ") : JSON.stringify(err);
};

const normalizeCompanies = (data) => {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.results)) return data.results;
  return [];
};

const RequestTable = ({
  rows,
  loading,
  colSpan,
  showActions,
  isOwnerOrAdmin,
  actionBusyId,
  onAccept,
  onReject,
  onCancel,
  mode,
}) => (
  <div className="warehouse-table-container w-full">
    <div className="warehouse-table-scroll warehouse-table-scroll--requests">
      <table className="warehouse-table warehouse-partnership-table">
      <thead>
        <tr>
          <th>№</th>
          <th>От кого</th>
          <th>Кому</th>
          <th>Статус</th>
          <th>Примечание</th>
          <th>Создана</th>
          <th>Решение</th>
          {showActions && <th>Действия</th>}
        </tr>
      </thead>
      <tbody>
        {loading ? (
          <tr>
            <td colSpan={colSpan} className="warehouse-table__loading">
              Загрузка…
            </td>
          </tr>
        ) : rows.length === 0 ? (
          <tr>
            <td colSpan={colSpan} className="warehouse-table__empty">
              {mode === "incoming" ? "Нет входящих заявок" : "Нет исходящих заявок"}
            </td>
          </tr>
        ) : (
          rows.map((r, idx) => (
            <tr key={r.id}>
              <td>{idx + 1}</td>
              <td>{r.from_company_name || "—"}</td>
              <td>{r.to_company_name || "—"}</td>
              <td>
                <span className={`warehouse-partnership-badge ${statusClass(r.status)}`}>
                  {statusLabel(r.status)}
                </span>
              </td>
              <td className="warehouse-partnership-note">{r.note || "—"}</td>
              <td>{fmtDateTime(r.created_at)}</td>
              <td>{fmtDateTime(r.decided_at)}</td>
              {showActions && (
                <td>
                  {mode === "incoming" && isOwnerOrAdmin && (
                    <div className="warehouse-partnership-row-actions">
                      <button
                        type="button"
                        className="warehouse-partnership-btn warehouse-partnership-btn--approve"
                        onClick={() => onAccept(r.id)}
                        disabled={actionBusyId === r.id}
                      >
                        <Check size={16} />
                        Принять
                      </button>
                      <button
                        type="button"
                        className="warehouse-partnership-btn warehouse-partnership-btn--reject"
                        onClick={() => onReject(r.id)}
                        disabled={actionBusyId === r.id}
                      >
                        <X size={16} />
                        Отклонить
                      </button>
                    </div>
                  )}
                  {mode === "outgoing" && r.status === "PENDING" && (
                    <button
                      type="button"
                      className="warehouse-partnership-btn warehouse-partnership-btn--reject"
                      onClick={() => onCancel(r.id)}
                      disabled={actionBusyId === r.id}
                    >
                      Отозвать
                    </button>
                  )}
                  {mode === "outgoing" && r.status !== "PENDING" && "—"}
                  {mode === "incoming" && !isOwnerOrAdmin && "—"}
                </td>
              )}
            </tr>
          ))
        )}
      </tbody>
      </table>
    </div>
  </div>
);

const StockPartnershipPanel = () => {
  const dispatch = useDispatch();
  const { profile } = useUser();
  const isOwnerOrAdmin =
    profile?.role === "owner" || profile?.role === "admin";

  const ownWarehouses = useSelector((state) => state.warehouse.list || []);

  const [subTab, setSubTab] = useState("incoming");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [incoming, setIncoming] = useState([]);
  const [outgoing, setOutgoing] = useState([]);
  const [partners, setPartners] = useState([]);
  const [actionBusyId, setActionBusyId] = useState(null);

  const [showInvite, setShowInvite] = useState(false);
  const [companySearch, setCompanySearch] = useState("");
  const [companySearchLoading, setCompanySearchLoading] = useState(false);
  const [companySearchResults, setCompanySearchResults] = useState([]);
  const [inviteNote, setInviteNote] = useState("");
  const [inviteBusy, setInviteBusy] = useState(false);
  const companySearchTimerRef = useRef(null);

  const [catalogPartner, setCatalogPartner] = useState(null);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [catalogError, setCatalogError] = useState("");
  const [catalogData, setCatalogData] = useState(null);

  const [transferState, setTransferState] = useState({
    open: false,
    product: null,
    warehouseFromId: null,
    partnerName: "",
  });

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [requestsData, partnersData] = await Promise.all([
        listStockPartnershipRequests(),
        listActiveStockPartners(),
      ]);
      setIncoming(requestsData?.incoming || []);
      setOutgoing(requestsData?.outgoing || []);
      setPartners(partnersData?.partners || []);
    } catch (e) {
      console.error(e);
      setError(extractError(e));
      setIncoming([]);
      setOutgoing([]);
      setPartners([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAll();
    dispatch(fetchWarehousesAsync({ page_size: 1000 }));
  }, [loadAll, dispatch]);

  useEffect(() => {
    if (!showInvite) return undefined;
    if (companySearchTimerRef.current) {
      clearTimeout(companySearchTimerRef.current);
    }
    if (!companySearch.trim()) {
      setCompanySearchResults([]);
      return undefined;
    }
    companySearchTimerRef.current = setTimeout(async () => {
      setCompanySearchLoading(true);
      try {
        const data = await searchAgentCompanies({ search: companySearch.trim() });
        setCompanySearchResults(normalizeCompanies(data));
      } catch (e) {
        console.error(e);
        setCompanySearchResults([]);
      } finally {
        setCompanySearchLoading(false);
      }
    }, 300);
    return () => {
      if (companySearchTimerRef.current) {
        clearTimeout(companySearchTimerRef.current);
      }
    };
  }, [showInvite, companySearch]);

  const handleAccept = async (id) => {
    if (!id || actionBusyId) return;
    setActionBusyId(id);
    try {
      await acceptStockPartnershipRequest(id);
      await loadAll();
    } catch (e) {
      alert(extractError(e));
    } finally {
      setActionBusyId(null);
    }
  };

  const handleReject = async (id) => {
    if (!id || actionBusyId) return;
    setActionBusyId(id);
    try {
      await rejectStockPartnershipRequest(id);
      await loadAll();
    } catch (e) {
      alert(extractError(e));
    } finally {
      setActionBusyId(null);
    }
  };

  const handleCancel = async (id) => {
    if (!id || actionBusyId) return;
    setActionBusyId(id);
    try {
      await cancelStockPartnershipRequest(id);
      await loadAll();
    } catch (e) {
      alert(extractError(e));
    } finally {
      setActionBusyId(null);
    }
  };

  const handleInvite = async (company) => {
    if (!company?.id || inviteBusy) return;
    setInviteBusy(true);
    try {
      await createStockPartnershipRequest({
        to_company: company.id,
        note: inviteNote.trim() || undefined,
      });
      setShowInvite(false);
      setCompanySearch("");
      setInviteNote("");
      setCompanySearchResults([]);
      await loadAll();
      setSubTab("outgoing");
    } catch (e) {
      alert(extractError(e));
    } finally {
      setInviteBusy(false);
    }
  };

  const openCatalog = async (partner) => {
    if (!partner?.id) return;
    setCatalogPartner(partner);
    setCatalogLoading(true);
    setCatalogError("");
    setCatalogData(null);
    try {
      const data = await getStockPartnerCatalog(partner.id);
      setCatalogData(data);
    } catch (e) {
      setCatalogError(extractError(e));
    } finally {
      setCatalogLoading(false);
    }
  };

  const closeCatalog = () => {
    setCatalogPartner(null);
    setCatalogData(null);
    setCatalogError("");
  };

  const openTransfer = (product, warehouseFromId) => {
    setTransferState({
      open: true,
      product,
      warehouseFromId,
      partnerName:
        catalogData?.partner_company?.name || catalogPartner?.name || "",
    });
  };

  const closeTransfer = () => {
    setTransferState({
      open: false,
      product: null,
      warehouseFromId: null,
      partnerName: "",
    });
  };


  return (
    <section className="warehouse-partnership">
      <div className="warehouse-partnership__toolbar">
        <div className="warehouse-partnership-tabs">
          <button type="button" className={`warehouse-partnership-tab ${subTab === "incoming" ? "active" : ""}`} onClick={() => setSubTab("incoming")}>
            Входящие
            {incoming.length > 0 && <span className="warehouse-partnership-tab__count">{incoming.length}</span>}
          </button>
          <button type="button" className={`warehouse-partnership-tab ${subTab === "outgoing" ? "active" : ""}`} onClick={() => setSubTab("outgoing")}>Исходящие</button>
          <button type="button" className={`warehouse-partnership-tab ${subTab === "partners" ? "active" : ""}`} onClick={() => setSubTab("partners")}>Партнёры</button>
        </div>
        <div className="warehouse-partnership__actions">
          <button type="button" className="warehouse-header__create-btn" onClick={() => setShowInvite(true)}><Plus size={16} /> Пригласить</button>
          <button type="button" className="warehouse-partnership-refresh" onClick={loadAll} disabled={loading}><RefreshCw size={18} /></button>
        </div>
      </div>
      {error && <div className="warehouse-partnership-error">{error}</div>}
      {subTab === "incoming" && <RequestTable rows={incoming} loading={loading} colSpan={isOwnerOrAdmin ? 8 : 7} showActions={isOwnerOrAdmin} isOwnerOrAdmin={isOwnerOrAdmin} actionBusyId={actionBusyId} onAccept={handleAccept} onReject={handleReject} onCancel={handleCancel} mode="incoming" />}
      {subTab === "outgoing" && <RequestTable rows={outgoing} loading={loading} colSpan={8} showActions isOwnerOrAdmin={isOwnerOrAdmin} actionBusyId={actionBusyId} onAccept={handleAccept} onReject={handleReject} onCancel={handleCancel} mode="outgoing" />}
      {subTab === "partners" && (
        <div className="warehouse-table-container w-full warehouse-partnership-partners-table">
          <table className="warehouse-table">
            <thead><tr><th>№</th><th>Компания</th><th>Действия</th></tr></thead>
            <tbody>
              {loading ? <tr><td colSpan={3} className="warehouse-table__loading">Загрузка…</td></tr> : partners.length === 0 ? (
                <tr><td colSpan={3} className="warehouse-table__empty">Нет активных партнёров</td></tr>
              ) : partners.map((p, idx) => (
                <tr key={p.id}><td>{idx + 1}</td><td className="warehouse-table__name">{p.name || "—"}</td><td><button type="button" className="warehouse-table__action-btn" onClick={() => openCatalog(p)}>Каталог</button></td></tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {showInvite && (
        <div className="warehouse-filter-overlay" onClick={() => !inviteBusy && setShowInvite(false)}>
          <div className="warehouse-filter-modal" onClick={(e) => e.stopPropagation()}>
            <div className="warehouse-filter-modal__header">
              <h3 className="warehouse-filter-modal__title">Заявка на партнёрство</h3>
              <button type="button" className="warehouse-filter-modal__close" onClick={() => setShowInvite(false)} disabled={inviteBusy}><X size={20} /></button>
            </div>
            <div className="warehouse-filter-modal__content">
              <div className="warehouse-filter-modal__section">
                <label className="warehouse-filter-modal__label">Поиск компании</label>
                <input className="warehouse-filter-modal__select" value={companySearch} onChange={(e) => setCompanySearch(e.target.value)} disabled={inviteBusy} />
                <ul className="warehouse-partnership-search-list">
                  {companySearchResults.map((c) => (
                    <li key={c.id}><span>{c.name}</span><button type="button" className="warehouse-partnership-btn warehouse-partnership-btn--approve" onClick={() => handleInvite(c)} disabled={inviteBusy}><Send size={14} /> Отправить</button></li>
                  ))}
                </ul>
              </div>
              <div className="warehouse-filter-modal__section">
                <label className="warehouse-filter-modal__label">Примечание</label>
                <input className="warehouse-filter-modal__select" value={inviteNote} onChange={(e) => setInviteNote(e.target.value)} maxLength={512} disabled={inviteBusy} />
              </div>
            </div>
          </div>
        </div>
      )}
      {catalogPartner && (
        <div className="warehouse-filter-overlay" onClick={closeCatalog}>
          <div className="warehouse-filter-modal warehouse-partnership-catalog-modal" onClick={(e) => e.stopPropagation()}>
            <div className="warehouse-filter-modal__header">
              <h3 className="warehouse-filter-modal__title">Каталог: {catalogData?.partner_company?.name || catalogPartner.name}</h3>
              <button type="button" className="warehouse-filter-modal__close" onClick={closeCatalog}><X size={20} /></button>
            </div>
            {catalogLoading && <p className="warehouse-filter-modal__subtitle">Загрузка…</p>}
            {catalogError && <div className="warehouse-partnership-error">{catalogError}</div>}
            {!catalogLoading && !catalogError && (
              <div className="warehouse-partnership-catalog">
                {(catalogData?.warehouses || []).map((wh) => (
                  <details key={wh.id} className="warehouse-partnership-warehouse" open>
                    <summary>{wh.name}{wh.branch_name ? ` (${wh.branch_name})` : ""}</summary>
                    <div className="warehouse-table-scroll warehouse-table-scroll--catalog">
                    <table className="warehouse-table warehouse-partnership-products">
                      <thead><tr><th>Товар</th><th>Артикул</th><th>Остаток</th><th></th></tr></thead>
                      <tbody>
                        {(wh.products || []).map((p) => (
                          <tr key={p.id}>
                            <td>{p.name}</td>
                            <td>{p.article || "—"}</td>
                            <td>{p.qty} {p.unit || ""}</td>
                            <td>
                              <button type="button" className="warehouse-table__action-btn" onClick={() => openTransfer(p, wh.id)} disabled={Number(p.qty) <= 0}>К нам</button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    </div>
                  </details>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
      <StockPartnershipTransferModal open={transferState.open} onClose={closeTransfer} product={transferState.product} warehouseFromId={transferState.warehouseFromId} partnerCompanyName={transferState.partnerName} ownWarehouses={ownWarehouses} onTransferred={loadAll} />
    </section>
  );
};

export default StockPartnershipPanel;
