// ClientDetails.jsx
import { useEffect, useMemo, useState } from "react";
import {
  useLocation,
  useNavigate,
  useOutletContext,
  useParams,
} from "react-router-dom";

import api from "../../../../api";
import "./ClientDetails.scss";

import { useUser } from "../../../../store/slices/userSlice";
import AlertModal from "../../../common/AlertModal/AlertModal";


import {
  listFrom,
  toDecimalString,
  kindLabel,
  ruStatusToKind,
  kindToRu,
  typeLabel,
  normalizeDealFromApi,
  msgFromError,
  toIsoDate10,
} from "./clientDetails.helpers";
import DebtModal from "./components/DebtModal";
import ClientEditModal from "./components/ClientEditModal";
import DealFormModal from "./components/DealFormModal";
import ReconciliationModal from "./components/ReconciliationModal";

export default function MarketClientDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { state } = useLocation();
  const { company } = useUser();
  const { clients = [], setClients = () => {} } = useOutletContext() || {};

  const initialClient = useMemo(() => {
    return (
      clients.find((c) => String(c.id) === String(id)) ||
      (state && String(state?.id) === String(id) ? state : null)
    );
  }, [clients, state, id]);

  const [client, setClient] = useState(initialClient);

  const [isDealFormOpen, setIsDealFormOpen] = useState(false);
  const [isClientFormOpen, setIsClientFormOpen] = useState(false);
  const [editingDeal, setEditingDeal] = useState(null);
  const [showDebtModal, setShowDebtModal] = useState(false);
  const [showReconciliation, setShowReconciliation] = useState(false);
  const [selectedRowId, setSelectedRowId] = useState(null);

  const [deals, setDeals] = useState([]);
  const [dealsLoading, setDealsLoading] = useState(false);
  const [dealsErr, setDealsErr] = useState("");
  const [clientErr, setClientErr] = useState("");

  const [alert, setAlert] = useState({
    open: false,
    type: "error",
    message: "",
  });

  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  useEffect(() => {
    setClient(initialClient);
  }, [initialClient]);

  useEffect(() => {
    const fetchClient = async () => {
      if (client || !id) return;
      try {
        setClientErr("");
        const res = await api.get(`/main/clients/${id}/`);
        const loaded = res?.data || null;
        if (loaded) {
          setClient(loaded);
          setClients((prev) => {
            const arr = Array.isArray(prev) ? prev : [];
            const exists = arr.some((c) => String(c.id) === String(id));
            return exists
              ? arr.map((c) => (String(c.id) === String(id) ? loaded : c))
              : [loaded, ...arr];
          });
        }
      } catch (e) {
        console.error(e);
        setClientErr("Не удалось загрузить клиента");
      }
    };
    fetchClient();
  }, [client, id, setClients]);

  const loadDeals = async (clientId) => {
    setDealsLoading(true);
    setDealsErr("");
    try {
      const res = await api.get(`/main/clients/${clientId}/deals/`);
      const list = listFrom(res).map(normalizeDealFromApi);
      setDeals(list);
    } catch (e) {
      console.error(e);
      setDealsErr(msgFromError(e, "Не удалось загрузить сделки"));
    } finally {
      setDealsLoading(false);
    }
  };

  useEffect(() => {
    if (client?.id) loadDeals(client.id);
  }, [client?.id]);

  const persistClient = (next) => {
    if (!next) return;
    setClient(next);
    setClients((prev) =>
      Array.isArray(prev)
        ? prev.map((c) => (c.id === next.id ? next : c))
        : prev
    );
  };

  const openDealForm = (deal = null) => {
    setEditingDeal(deal);
    setIsDealFormOpen(true);
  };

  const openClientForm = () => {
    setIsClientFormOpen(true);
  };

  const getDealDateISO = (deal) => {
    const raw = deal?.date || deal?.created_at || deal?.updated_at || null;
    if (!raw) return null;

    try {
      const d = new Date(raw);
      if (!Number.isNaN(d.getTime())) {
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, "0");
        const dd = String(d.getDate()).padStart(2, "0");
        return `${yyyy}-${mm}-${dd}`;
      }
    } catch {}
    const m = String(raw).match(/^(\d{4}-\d{2}-\d{2})/);
    return m ? m[1] : null;
  };

  const inRange = (iso, fromISO, toISO) => {
    if (!iso) return false;
    if (fromISO && iso < fromISO) return false;
    if (toISO && iso > toISO) return false;
    return true;
  };

  const filteredDeals = useMemo(() => {
    if (!dateFrom && !dateTo) return deals;
    return deals.filter((d) => inRange(getDealDateISO(d), dateFrom, dateTo));
  }, [deals, dateFrom, dateTo]);

  const applyPreset = (preset) => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    const d = String(now.getDate()).padStart(2, "0");
    const today = `${y}-${m}-${d}`;

    if (preset === "today") {
      setDateFrom(today);
      setDateTo(today);
      return;
    }
    if (preset === "week") {
      const start = new Date(now);
      start.setDate(now.getDate() - 6);
      const y1 = start.getFullYear();
      const m1 = String(start.getMonth() + 1).padStart(2, "0");
      const d1 = String(start.getDate()).padStart(2, "0");
      setDateFrom(`${y1}-${m1}-${d1}`);
      setDateTo(today);
      return;
    }
    if (preset === "month") {
      const start = new Date(now);
      start.setMonth(now.getMonth() - 1);
      const y1 = start.getFullYear();
      const m1 = String(start.getMonth() + 1).padStart(2, "0");
      const d1 = String(start.getDate()).padStart(2, "0");
      setDateFrom(`${y1}-${m1}-${d1}`);
      setDateTo(today);
      return;
    }
    if (preset === "clear") {
      setDateFrom("");
      setDateTo("");
      return;
    }
  };

  const dataTransmission = (dealId) => {
    setSelectedRowId(dealId);
    setShowDebtModal(true);
  };

  const sectorName = company?.sector?.name;
  const kindTranslate = { new: "Новый" };
  const clientName = client?.fio || client?.full_name || "—";

  const totals = useMemo(() => {
    const agg = { debt: 0, prepayment: 0, sale: 0 };
    for (const d of deals) {
      const kind = d.kind || "sale";
      if (kind === "debt") {
        agg.debt += Number(d.remaining_debt || 0);
        agg.prepayment += Number(d.prepayment || 0);
      } else if (kind === "prepayment") {
        agg.prepayment += Number(d.amount || 0);
      } else {
        agg.sale += Number(d.amount || 0);
      }
    }
    return { ...agg, amount: agg.sale };
  }, [deals]);

  const handleClientUpdated = (updatedClient) => {
    persistClient(updatedClient);
  };

  const handleClientDeleted = (clientId) => {
    setClients((prev) =>
      Array.isArray(prev) ? prev.filter((c) => c.id !== clientId) : prev
    );
    navigate("/crm/clients", { replace: true });
  };

  const handleDealSaved = (deal) => {
    setDeals((prev) => {
      const exists = prev.some((d) => d.id === deal.id);
      return exists
        ? prev.map((d) => (d.id === deal.id ? deal : d))
        : [deal, ...prev];
    });
  };

  const handleDealDeleted = (dealId) => {
    setDeals((prev) => prev.filter((d) => d.id !== dealId));
  };

  const handleDealError = (message) => {
    setAlert({ open: true, type: "error", message });
  };

  const clientTypeLabel = typeLabel(client?.type);

  return (
    <div className="client-details">
      <div className="details-top">
        <button
          onClick={() =>
            navigate(
              company?.sector?.name === "Консалтинг"
                ? "/crm/consulting/client"
                : "/crm/clients"
            )
          }
          className="btn btn--ghost"
        >
          ← Назад
        </button>
        <div>
          <button className="primary" onClick={() => openDealForm()}>
            Быстрое добавление сделки
          </button>
          <button
            className="btn btn--secondary"
            onClick={() => setShowReconciliation(true)}
            style={{ marginLeft: 10 }}
          >
            Акт сверки
          </button>
        </div>
      </div>

      <div className="panel">
        <h2 className="title">{clientName}</h2>
        {clientErr && (
          <div className="alert alert--error" style={{ marginTop: 8 }}>
            {clientErr}
          </div>
        )}
        <div className="divider"></div>

        <div className="content-wrapper">
          <div className="rows">
            <div className="row">
              <div className="label">ФИО</div>
              <div className="value">{clientName}</div>
            </div>

            <div className="row">
              <div className="label">Телефон</div>
              <div className="value">
                {client?.phone ? (
                  <a href={`tel:${String(client.phone).replace(/\D/g, "")}`}>
                    {client.phone}
                  </a>
                ) : (
                  "—"
                )}
              </div>
            </div>

            <div className="row">
              <div className="label">Тип</div>
              <div className="value">{clientTypeLabel}</div>
            </div>

            <div className="row">
              <div className="label">Статус</div>
              <div className="value">
                {kindTranslate[client?.status] || client?.status}
              </div>
              <button className="btn edit-btn" onClick={openClientForm}>
                Редактировать
              </button>
            </div>
          </div>

          <div className="debts-wrapper">
            <div className="debts debts--red">
              <div className="debts-title">
                {sectorName === "Строительная компания"
                  ? "Сумма договора"
                  : "Долг"}
              </div>
              <div className="debts-amount">
                {sectorName === "Строительная компания"
                  ? (totals.sale ?? 0).toFixed(2)
                  : (totals.debt ?? 0).toFixed(2)}{" "}
                сом
              </div>
            </div>

            <div className="debts debts--green">
              <div className="debts-title">
                {sectorName === "Строительная компания"
                  ? "Предоплата"
                  : "Аванс"}
              </div>
              <div className="debts-amount">
                {(totals.prepayment ?? 0).toFixed(2)} сом
              </div>
            </div>

            <div className="debts debts--orange">
              <div className="debts-title">
                {sectorName === "Строительная компания"
                  ? "Остаток долга"
                  : "Продажа"}
              </div>
              <div className="debts-amount">
                {sectorName === "Строительная компания"
                  ? (totals.debt ?? 0).toFixed(2)
                  : (totals.sale ?? 0).toFixed(2)}{" "}
                сом
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="filters panel" style={{ marginTop: 12 }}>
        <div className="rows">
          <div className="row">
            <div className="label">Дата с</div>
            <div className="value">
              <input
                className="analytics-sales__input"
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
              />
            </div>
          </div>
          <div className="row">
            <div className="label">Дата по</div>
            <div className="value">
              <input
                className="analytics-sales__input"
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
              />
            </div>
          </div>
          <div className="row">
            <div className="label">Быстрый выбор</div>
            <div
              className="value"
              style={{ display: "flex", gap: 10, flexWrap: "wrap" }}
            >
              <button
                className="btn btn--ghost"
                onClick={() => applyPreset("today")}
              >
                Сегодня
              </button>
              <button
                className="btn btn--ghost"
                onClick={() => applyPreset("week")}
              >
                Неделя
              </button>
              <button
                className="btn btn--ghost"
                onClick={() => applyPreset("month")}
              >
                Месяц
              </button>
              <button className="btn" onClick={() => applyPreset("clear")}>
                Очистить
              </button>
            </div>
          </div>
        </div>
        <div className="muted">
          Показано: <b>{filteredDeals.length}</b> из {deals.length}
        </div>
      </div>

      <div className="deals-list">
        <h3>Сделки</h3>
        {dealsLoading && (
          <div className="muted" style={{ padding: "8px 0" }}>
            Загрузка…
          </div>
        )}
        {dealsErr && (
          <div className="alert alert--error" style={{ marginBottom: 8 }}>
            {dealsErr}
          </div>
        )}
        {!dealsLoading && filteredDeals.length === 0 && (
          <div className="muted">Сделок нет</div>
        )}

        {filteredDeals.map((deal) => (
          <div
            key={deal.id}
            onClick={() => {
              deal.kind === "debt" && dataTransmission(deal.id);
            }}
            className="deal-item"
          >
            <span className="deal-name">{deal.title}</span>
            <span className="deal-budget">
              {Number(deal.amount || 0).toFixed(2)}
            </span>
            <span className="deal-status">
              {deal.kind === "debt" && Number(deal.prepayment || 0) !== 0
                ? "Предоплата"
                : kindLabel(deal.kind)}
            </span>
            <span className="deal-tasks">Нет задач</span>
            <div onClick={(e) => e.stopPropagation()}>
              <button
                onClick={() => openDealForm(deal)}
                className="btn edit-btn"
              >
                Редактировать
              </button>
            </div>
          </div>
        ))}
      </div>

      {showDebtModal && (
        <DebtModal
          id={selectedRowId}
          onClose={() => setShowDebtModal(false)}
          onChanged={() => client?.id && loadDeals(client.id)}
        />
      )}

      <ClientEditModal
        open={isClientFormOpen}
        client={client}
        onClose={() => setIsClientFormOpen(false)}
        onUpdated={handleClientUpdated}
        onDeleted={handleClientDeleted}
      />

      <DealFormModal
        open={isDealFormOpen}
        clientId={client?.id}
        editingDeal={editingDeal}
        onClose={() => {
          setIsDealFormOpen(false);
          setEditingDeal(null);
        }}
        onSaved={handleDealSaved}
        onDeleted={handleDealDeleted}
        onError={handleDealError}
      />

      <ReconciliationModal
        open={showReconciliation}
        clientId={client?.id}
        onClose={() => setShowReconciliation(false)}
      />

      <AlertModal
        open={alert.open}
        type={alert.type}
        message={alert.message}
        okText="Ok"
        onClose={() => setAlert((a) => ({ ...a, open: false }))}
      />
    </div>
  );
}
