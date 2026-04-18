// ClientDetails.jsx
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  useLocation,
  useNavigate,
  useOutletContext,
  useParams,
} from "react-router-dom";

import api from "../../../../api";
import { productSearchHaystackLower } from "../../../../../tools/productBarcode";
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
  const [detailsView, setDetailsView] = useState(null);

  const [deals, setDeals] = useState([]);
  const [dealsLoading, setDealsLoading] = useState(false);
  const [dealsErr, setDealsErr] = useState("");
  const [clientErr, setClientErr] = useState("");
  const [supplierProducts, setSupplierProducts] = useState([]);
  const [supplierProductsLoading, setSupplierProductsLoading] = useState(false);
  const [supplierProductsErr, setSupplierProductsErr] = useState("");
  const [supplierProductSearch, setSupplierProductSearch] = useState("");

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

  const loadSupplierProducts = useCallback(async (supplierId) => {
    const normalizedSupplierId = String(supplierId || "").trim();
    if (!normalizedSupplierId) {
      setSupplierProducts([]);
      return;
    }

    try {
      setSupplierProductsLoading(true);
      setSupplierProductsErr("");
      const res = await api.get(
        `/main/suppliers/${encodeURIComponent(normalizedSupplierId)}/products/`,
      );
      const nextProducts = Array.isArray(listFrom(res)) ? listFrom(res) : [];
      setSupplierProducts(nextProducts);
    } catch (e) {
      console.error(e);
      setSupplierProducts([]);
      setSupplierProductsErr(
        msgFromError(e, "Не удалось загрузить товары поставщика"),
      );
    } finally {
      setSupplierProductsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (client?.id) loadDeals(client.id);
  }, [client?.id]);

  useEffect(() => {
    const isSupplier = String(client?.type || "").toLowerCase() === "suppliers";
    setSupplierProductSearch("");
    if (!isSupplier || !client?.id) {
      setSupplierProducts([]);
      setSupplierProductsErr("");
      setSupplierProductsLoading(false);
      return;
    }
    void loadSupplierProducts(client.id);
  }, [client?.id, client?.type, loadSupplierProducts]);

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

  const detailRows = useMemo(() => {
    if (!detailsView) return [];

    const resolveType = (deal) => {
      if (detailsView === "debt") return deal.kind === "debt";
      if (detailsView === "prepayment") {
        return deal.kind === "prepayment" || Number(deal.prepayment || 0) > 0;
      }
      return deal.kind === "sale";
    };

    return deals
      .filter(resolveType)
      .map((deal) => {
        const date = toIsoDate10(deal.date || deal.created_at || deal.updated_at) || "—";
        let amount = Number(deal.amount || 0);

        if (detailsView === "debt") amount = Number(deal.remaining_debt || 0);
        if (detailsView === "prepayment") {
          amount =
            deal.kind === "prepayment"
              ? Number(deal.amount || 0)
              : Number(deal.prepayment || 0);
        }

        return {
          id: deal.id,
          title: deal.title || "Без названия",
          date,
          amount,
        };
      })
      .sort((a, b) => (a.date < b.date ? 1 : -1));
  }, [deals, detailsView]);

  const detailsMeta = useMemo(() => {
    if (detailsView === "debt") {
      return {
        title: sectorName === "Строительная компания" ? "Сумма договора" : "Долг",
        total:
          sectorName === "Строительная компания"
            ? Number(totals.sale || 0)
            : Number(totals.debt || 0),
      };
    }
    if (detailsView === "prepayment") {
      return { title: sectorName === "Строительная компания" ? "Предоплата" : "Аванс", total: Number(totals.prepayment || 0) };
    }
    return {
      title: sectorName === "Строительная компания" ? "Остаток долга" : "Продажа",
      total:
        sectorName === "Строительная компания"
          ? Number(totals.debt || 0)
          : Number(totals.sale || 0),
    };
  }, [detailsView, sectorName, totals.debt, totals.prepayment, totals.sale]);

  const clamp = (n, min, max) => Math.min(max, Math.max(min, n));

  const getDebtProgress = (deal) => {
    const total = Number(deal?.debt_amount ?? deal?.amount ?? 0);
    const remainingRaw = deal?.remaining_debt;
    const remaining = remainingRaw === "" || remainingRaw == null ? NaN : Number(remainingRaw);

    let paid = 0;
    if (Number.isFinite(remaining)) {
      paid = total - remaining;
    } else if (deal?.prepayment != null && deal?.prepayment !== "") {
      paid = Number(deal.prepayment) || 0;
    }

    if (!Number.isFinite(total) || total <= 0) {
      return { percent: 0, paid: 0, total: 0, remaining: 0 };
    }

    const safePaid = clamp(Number.isFinite(paid) ? paid : 0, 0, total);
    const safeRemaining = clamp(total - safePaid, 0, total);
    const percent = clamp(Math.round((safePaid / total) * 100), 0, 100);

    // Цвет: красный(0%) -> зелёный(100%)
    const hue = (percent / 100) * 120;
    const fill = `hsl(${hue}deg, 85%, 45%)`;
    const bg = `hsl(${hue}deg, 85%, 94%)`;
    const border = `hsl(${hue}deg, 65%, 75%)`;
    const glow = `0 0 0 3px hsla(${hue}deg, 85%, 55%, 0.22)`;

    return {
      percent,
      paid: safePaid,
      total,
      remaining: safeRemaining,
      fill,
      bg,
      border,
      glow,
    };
  };

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
  const isSupplierClient =
    String(client?.type || "").toLowerCase() === "suppliers";

  const filteredSupplierProducts = useMemo(() => {
    const query = String(supplierProductSearch || "")
      .trim()
      .toLowerCase();
    if (!query) return supplierProducts;
    return supplierProducts.filter((product) => {
      const haystack = productSearchHaystackLower(product);
      return haystack.includes(query);
    });
  }, [supplierProductSearch, supplierProducts]);

  const supplierProductsCountLabel = useMemo(
    () => filteredSupplierProducts.length,
    [filteredSupplierProducts.length],
  );

  return (
    <div className="client-details">
      {/* Header */}
      <div className="client-details__header details-top">
        <button
          onClick={() =>
            navigate(
              company?.sector?.name === "Консалтинг"
                ? "/crm/consulting/client"
                : "/crm/clients"
            )
          }
          className="client-details__back-btn btn btn--ghost"
        >
          ← Назад
        </button>
        <div className="client-details__header-actions">
          <button
            className="client-details__btn client-details__btn--primary primary"
            onClick={() => openDealForm()}
          >
            Быстрое добавление сделки
          </button>
          <button
            className="client-details__btn client-details__btn--secondary btn btn--secondary"
            onClick={() => setShowReconciliation(true)}
          >
            Акт сверки
          </button>
        </div>
      </div>

      {/* Client Info Panel */}
      <div className="client-details__panel panel">
        <div className="client-details__panel-header">
          <h2 className="client-details__title title">{clientName}</h2>
        </div>
        {clientErr && (
          <div className="client-details__alert alert alert--error">
            {clientErr}
          </div>
        )}
        <div className="client-details__divider divider"></div>

        <div className="client-details__content content-wrapper">
          <div className="client-details__info-grid">
            <div className="client-details__info-item">
              <div className="client-details__info-label">ФИО</div>
              <div className="client-details__info-value">{clientName}</div>
            </div>

            <div className="client-details__info-item">
              <div className="client-details__info-label">Телефон</div>
              <div className="client-details__info-value">
                {client?.phone ? (
                  <a href={`tel:${String(client.phone).replace(/\D/g, "")}`}>
                    {client.phone}
                  </a>
                ) : (
                  "—"
                )}
              </div>
            </div>

            <div className="client-details__info-item">
              <div className="client-details__info-label">Тип</div>
              <div className="client-details__info-value">
                {clientTypeLabel}
              </div>
            </div>

            <div className="client-details__info-item">
              <div className="client-details__info-label">Email</div>
              <div className="client-details__info-value">
                {client?.email || "—"}
              </div>
            </div>

            <div className="client-details__info-item">
              <div className="client-details__info-label">Дата</div>
              <div className="client-details__info-value">
                {toIsoDate10(client?.date) || "—"}
              </div>
            </div>

            <div className="client-details__info-item">
              <div className="client-details__info-label">Статус</div>
              <div className="client-details__info-value">
                {kindTranslate[client?.status] || client?.status || "—"}
              </div>
              <button
                className="client-details__edit-btn btn edit-btn"
                onClick={openClientForm}
              >
                Редактировать
              </button>
            </div>

            <div className="client-details__info-item">
              <div className="client-details__info-label">ОсОО</div>
              <div className="client-details__info-value">
                {client?.llc || "—"}
              </div>
            </div>

            <div className="client-details__info-item">
              <div className="client-details__info-label">ИНН</div>
              <div className="client-details__info-value">
                {client?.inn || "—"}
              </div>
            </div>

            <div className="client-details__info-item">
              <div className="client-details__info-label">ОКПО</div>
              <div className="client-details__info-value">
                {client?.okpo || "—"}
              </div>
            </div>

            <div className="client-details__info-item">
              <div className="client-details__info-label">Счет</div>
              <div className="client-details__info-value">
                {client?.score || "—"}
              </div>
            </div>

            <div className="client-details__info-item">
              <div className="client-details__info-label">БИК</div>
              <div className="client-details__info-value">
                {client?.bik || "—"}
              </div>
            </div>

            <div className="client-details__info-item">
              <div className="client-details__info-label">Адрес</div>
              <div className="client-details__info-value">
                {client?.address || "—"}
              </div>
            </div>
          </div>

          <div className="client-details__stats debts-wrapper">
            <button
              type="button"
              className="client-details__stat-card client-details__stat-card--red debts debts--red client-details__stat-card--clickable"
              onClick={() => setDetailsView("debt")}
            >
              <div className="client-details__stat-title debts-title">
                {sectorName === "Строительная компания"
                  ? "Сумма договора"
                  : "Долг"}
              </div>
              <div className="client-details__stat-amount debts-amount">
                {sectorName === "Строительная компания"
                  ? (totals.sale ?? 0).toFixed(2)
                  : (totals.debt ?? 0).toFixed(2)}
                <span className="client-details__stat-currency">сом</span>
              </div>
            </button>

            <button
              type="button"
              className="client-details__stat-card client-details__stat-card--green debts debts--green client-details__stat-card--clickable"
              onClick={() => setDetailsView("prepayment")}
            >
              <div className="client-details__stat-title debts-title">
                {sectorName === "Строительная компания"
                  ? "Предоплата"
                  : "Аванс"}
              </div>
              <div className="client-details__stat-amount debts-amount">
                {(totals.prepayment ?? 0).toFixed(2)}
                <span className="client-details__stat-currency">сом</span>
              </div>
            </button>

            <button
              type="button"
              className="client-details__stat-card client-details__stat-card--orange debts debts--orange client-details__stat-card--clickable"
              onClick={() => setDetailsView("sale")}
            >
              <div className="client-details__stat-title debts-title">
                {sectorName === "Строительная компания"
                  ? "Остаток долга"
                  : "Продажа"}
              </div>
              <div className="client-details__stat-amount debts-amount">
                {sectorName === "Строительная компания"
                  ? (totals.debt ?? 0).toFixed(2)
                  : (totals.sale ?? 0).toFixed(2)}
                <span className="client-details__stat-currency">сом</span>
              </div>
            </button>
          </div>
        </div>
      </div>

  

      {/* Filters Panel */}
      <div className="client-details__filters filters panel">
        <div className="client-details__filters-grid">
          <div className="client-details__filter-item">
            <label className="client-details__filter-label">Дата с</label>
            <input
              className="client-details__filter-input analytics-sales__input"
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
            />
          </div>
          <div className="client-details__filter-item">
            <label className="client-details__filter-label">Дата по</label>
            <input
              className="client-details__filter-input analytics-sales__input"
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
            />
          </div>
        </div>
        <div className="client-details__quick-filters">
          <button
            className="client-details__quick-filter-btn btn btn--ghost"
            onClick={() => applyPreset("today")}
          >
            Сегодня
          </button>
          <button
            className="client-details__quick-filter-btn btn btn--ghost"
            onClick={() => applyPreset("week")}
          >
            Неделя
          </button>
          <button
            className="client-details__quick-filter-btn btn btn--ghost"
            onClick={() => applyPreset("month")}
          >
            Месяц
          </button>
          <button
            className="client-details__clear-btn btn"
            onClick={() => applyPreset("clear")}
          >
            Очистить
          </button>
        </div>
        <div className="client-details__filter-info muted">
          Показано: <b>{filteredDeals.length}</b> из {deals.length}
        </div>
      </div>

      {/* Deals List */}
      <div className="client-details__deals deals-list">
        <div className="client-details__deals-header">
          <h3 className="client-details__deals-title">Сделки</h3>
        </div>
        {dealsLoading && (
          <div className="client-details__deals-loading muted">Загрузка…</div>
        )}
        {dealsErr && (
          <div className="client-details__alert alert alert--error">
            {dealsErr}
          </div>
        )}
        {!dealsLoading && filteredDeals.length === 0 && (
          <div className="client-details__deals-empty muted">Сделок нет</div>
        )}

        {filteredDeals.map((deal) => (
          (() => {
            const isDebt = deal.kind === "debt";
            const debtProgress = isDebt ? getDebtProgress(deal) : null;
            const debtStatusLabel =
              isDebt && Number(deal.prepayment || 0) !== 0 ? "Предоплата" : "Долг";

            return (
          <div
            key={deal.id}
            onClick={() => {
              deal.kind === "debt" && dataTransmission(deal.id);
            }}
            className="client-details__deal-item deal-item"
          >
            <span className="client-details__deal-name deal-name">
              {deal.title}
            </span>
            <span className="client-details__deal-amount deal-budget">
              {Number(deal.amount || 0).toFixed(2)}
            </span>
            <span
              className={`client-details__deal-status deal-status ${isDebt ? "is-debt" : ""}`}
              style={
                isDebt
                  ? {
                      background: debtProgress.bg,
                      border: `1px solid ${debtProgress.border}`,
                      color: "var(--text)",
                      boxShadow: debtProgress.glow,
                    }
                  : undefined
              }
              title={
                isDebt
                  ? `Оплачено ${debtProgress.paid.toFixed(2)} из ${debtProgress.total.toFixed(
                      2
                    )} (${debtProgress.percent}%)`
                  : undefined
              }
            >
              {isDebt ? (
                <span className="client-details__debtProgress">
                  <span className="client-details__debtText">
                    {debtStatusLabel} •{" "}
                    <span className="client-details__debtPercent">
                      {debtProgress.percent}%
                    </span>
                  </span>
                  <span className="client-details__battery" aria-hidden="true">
                    <span
                      className="client-details__batteryFill"
                      style={{
                        width: `${debtProgress.percent}%`,
                        backgroundColor: debtProgress.fill,
                      }}
                    />
                  </span>
                </span>
              ) : (
                kindLabel(deal.kind)
              )}
            </span>
            <span className="client-details__deal-tasks deal-tasks">
              Нет задач
            </span>
            <div onClick={(e) => e.stopPropagation()}>
              <button
                onClick={() => openDealForm(deal)}
                className="client-details__edit-btn btn edit-btn"
              >
                Редактировать
              </button>
            </div>
          </div>
            );
          })()
        ))}
      </div>
      {isSupplierClient && company?.sector?.name === "Магазин" && (
        <div className="client-details__supplier-products panel">
          <div className="client-details__supplier-products-head">
            <div>
              <h3 className="client-details__deals-title">
                Товары поставщика
              </h3>
              <div className="client-details__supplier-products-subtitle">
                Список товаров, которые этот поставщик привозит
              </div>
            </div>

            <div className="client-details__supplier-products-actions">
              <input
                type="text"
                className="client-details__filter-input"
                placeholder="Поиск по названию, коду, артикулу, штрихкоду"
                value={supplierProductSearch}
                onChange={(e) => setSupplierProductSearch(e.target.value)}
              />
              <button
                type="button"
                className="client-details__btn client-details__btn--secondary"
                onClick={() => loadSupplierProducts(client?.id)}
                disabled={!client?.id || supplierProductsLoading}
              >
                {supplierProductsLoading ? "Обновляем..." : "Обновить товары"}
              </button>
            </div>
          </div>

          <div className="client-details__supplier-products-summary">
            <div className="client-details__supplier-products-chip">
              Всего товаров: <b>{supplierProducts.length}</b>
            </div>
            <div className="client-details__supplier-products-chip">
              Показано: <b>{supplierProductsCountLabel}</b>
            </div>
          </div>

          {supplierProductsErr && (
            <div className="client-details__alert alert alert--error">
              {supplierProductsErr}
            </div>
          )}

          {supplierProductsLoading ? (
            <div className="client-details__deals-loading muted">Загрузка…</div>
          ) : filteredSupplierProducts.length === 0 ? (
            <div className="client-details__deals-empty muted">
              {supplierProductSearch.trim()
                ? "По вашему запросу товары не найдены"
                : "У этого поставщика пока нет товаров"}
            </div>
          ) : (
            <>
              <div className="client-details__supplier-products-table-wrap">
                <table className="client-details__supplier-products-table">
                  <thead>
                    <tr>
                      <th>Товар</th>
                      <th>Код</th>
                      <th>Артикул</th>
                      <th>Штрихкод</th>
                      <th>Остаток</th>
                      <th>Ед. изм.</th>
                      <th>Закупочная цена</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredSupplierProducts.map((product) => (
                      <tr key={product?.id || product?.code || product?.barcode}>
                        <td>
                          {product?.name || product?.title || "Без названия"}
                        </td>
                        <td>{product?.code || "—"}</td>
                        <td>{product?.article || "—"}</td>
                        <td>{product?.barcode || "—"}</td>
                        <td>{product?.quantity ?? 0}</td>
                        <td>{product?.unit || "—"}</td>
                        <td>
                          {product?.purchase_price ?? product?.price ?? "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="client-details__supplier-products-cards">
                {filteredSupplierProducts.map((product) => (
                  <div
                    key={`card-${product?.id || product?.code || product?.barcode}`}
                    className="client-details__supplier-product-card"
                  >
                    <div className="client-details__supplier-product-name">
                      {product?.name || product?.title || "Без названия"}
                    </div>
                    <div className="client-details__supplier-product-meta">
                      <span>Код</span>
                      <strong>{product?.code || "—"}</strong>
                    </div>
                    <div className="client-details__supplier-product-meta">
                      <span>Артикул</span>
                      <strong>{product?.article || "—"}</strong>
                    </div>
                    <div className="client-details__supplier-product-meta">
                      <span>Штрихкод</span>
                      <strong>{product?.barcode || "—"}</strong>
                    </div>
                    <div className="client-details__supplier-product-meta">
                      <span>Остаток</span>
                      <strong>{product?.quantity ?? 0}</strong>
                    </div>
                    <div className="client-details__supplier-product-meta">
                      <span>Ед. изм.</span>
                      <strong>{product?.unit || "—"}</strong>
                    </div>
                    <div className="client-details__supplier-product-meta">
                      <span>Закупочная цена</span>
                      <strong>{product?.purchase_price ?? product?.price ?? "—"}</strong>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}
      {showDebtModal && (
        <DebtModal
          id={selectedRowId}
          clientType={client?.type}
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

      {detailsView && (
        <div className="client-details__details-modal-overlay" onClick={() => setDetailsView(null)}>
          <div className="client-details__details-modal" onClick={(e) => e.stopPropagation()}>
            <div className="client-details__details-modal-header">
              <h3 className="client-details__details-modal-title">{detailsMeta.title}</h3>
              <button
                type="button"
                className="client-details__details-modal-close"
                onClick={() => setDetailsView(null)}
              >
                ×
              </button>
            </div>
            <div className="client-details__details-modal-total">
              Итого: <b>{detailsMeta.total.toFixed(2)} сом</b>
            </div>
            <div className="client-details__details-modal-list">
              {detailRows.length === 0 && (
                <div className="client-details__details-modal-empty">Нет данных по выбранной категории</div>
              )}
              {detailRows.map((row) => (
                <div key={row.id} className="client-details__details-modal-row">
                  <div className="client-details__details-modal-what">{row.title}</div>
                  <div className="client-details__details-modal-when">{row.date}</div>
                  <div className="client-details__details-modal-howmuch">{row.amount.toFixed(2)} сом</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

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
