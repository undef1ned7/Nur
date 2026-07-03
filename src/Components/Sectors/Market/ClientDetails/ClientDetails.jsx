// ClientDetails.jsx
import { useCallback, useContext, useEffect, useMemo, useState } from "react";
import {
  useLocation,
  useNavigate,
  useOutletContext,
  useParams,
} from "react-router-dom";

import {
  ArrowLeft,
  Plus,
  FileSpreadsheet,
  Pencil,
  Phone,
  Mail,
  User as UserIcon,
  IdCard,
  CalendarDays,
  Wallet,
  TrendingDown,
  TrendingUp,
  ReceiptText,
  Layers,
  Package,
  RefreshCw,
} from "lucide-react";

import api from "../../../../api";
import { productSearchHaystackLower } from "../../../../../tools/productBarcode";
import "./ClientDetails.scss";
import "./ClientDetails.redesign.scss";

import { useUser } from "../../../../store/slices/userSlice";
import { ThemeModeContext } from "../../../../theme/ThemeModeProvider";
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
  const { mode } = useContext(ThemeModeContext);
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

  // История продаж клиента (POS)
  const [clientSales, setClientSales] = useState([]);
  const [clientSalesLoading, setClientSalesLoading] = useState(false);
  const [clientSalesErr, setClientSalesErr] = useState("");

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

  // История POS-продаж клиента. Пробуем серверную фильтрацию (?client=<id>),
  // и на всякий случай дофильтровываем на фронте (если бэк параметр игнорирует).
  // Контракт: docs/market-pos-sales-client-filter-backend.md
  const loadClientSales = useCallback(async (clientId) => {
    const cid = String(clientId || "").trim();
    if (!cid) {
      setClientSales([]);
      return;
    }
    setClientSalesLoading(true);
    setClientSalesErr("");
    try {
      const res = await api.get("/main/pos/sales/", {
        params: { client: cid, page: 1, limit: 100 },
      });
      const list = Array.isArray(res.data?.results)
        ? res.data.results
        : Array.isArray(res.data)
          ? res.data
          : [];
      const own = list.filter((s) => {
        const c = s?.client;
        const sid =
          c && typeof c === "object" ? (c.id ?? c.uuid ?? "") : (c ?? "");
        return String(sid) === cid;
      });
      own.sort(
        (a, b) =>
          new Date(b.created_at || b.paid_at || 0) -
          new Date(a.created_at || a.paid_at || 0),
      );
      setClientSales(own);
    } catch (e) {
      console.error(e);
      setClientSales([]);
      setClientSalesErr(msgFromError(e, "Не удалось загрузить историю продаж"));
    } finally {
      setClientSalesLoading(false);
    }
  }, []);

  useEffect(() => {
    if (client?.id) loadDeals(client.id);
  }, [client?.id]);

  useEffect(() => {
    if (client?.id) void loadClientSales(client.id);
  }, [client?.id, loadClientSales]);

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

  // История продаж клиента с учётом фильтра дат из тулбара
  const filteredClientSales = useMemo(() => {
    if (!dateFrom && !dateTo) return clientSales;
    return clientSales.filter((s) =>
      inRange(
        String(s?.created_at || s?.paid_at || "").slice(0, 10),
        dateFrom,
        dateTo,
      ),
    );
  }, [clientSales, dateFrom, dateTo]);

  const saleStatusRu = (s) => {
    const v = String(s || "").toLowerCase();
    if (["canceled", "cancelled", "refunded", "returned"].includes(v))
      return { label: "Отменена", mod: "debt" };
    if (v === "paid") return { label: "Оплачена", mod: "status" };
    return { label: s || "—", mod: "neutral" };
  };

  const fmtSaleDate = (v) => {
    if (!v) return "—";
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) return String(v).slice(0, 10);
    return d.toLocaleString("ru-RU", {
      day: "2-digit",
      month: "2-digit",
      year: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

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

  // ---- UI-only derived values (no API / no data-model changes) ----
  const dealKindCounts = useMemo(() => {
    const acc = { debt: 0, prepayment: 0, sale: 0 };
    for (const d of deals) {
      const kind = d.kind || "sale";
      if (kind === "debt") acc.debt += 1;
      else if (kind === "prepayment") acc.prepayment += 1;
      else acc.sale += 1;
    }
    return acc;
  }, [deals]);

  const clientInitials = useMemo(() => {
    const parts = String(clientName || "")
      .trim()
      .split(/\s+/)
      .filter(Boolean);
    if (!parts.length) return "—";
    return (parts[0][0] + (parts[1]?.[0] || "")).toUpperCase();
  }, [clientName]);

  const statusText = kindTranslate[client?.status] || client?.status || "—";
  const isBuildingSector = sectorName === "Строительная компания";

  const kpis = [
    {
      key: "debt",
      modifier: "cdx__kpi--debt",
      icon: <TrendingDown />,
      label: isBuildingSector ? "Сумма договора" : "Общий долг",
      value: isBuildingSector ? totals.sale ?? 0 : totals.debt ?? 0,
      count: dealKindCounts.debt,
      onClick: () => setDetailsView("debt"),
    },
    {
      key: "prepayment",
      modifier: "cdx__kpi--prepay",
      icon: <Wallet />,
      label: isBuildingSector ? "Предоплата" : "Аванс",
      value: totals.prepayment ?? 0,
      count: dealKindCounts.prepayment,
      onClick: () => setDetailsView("prepayment"),
    },
    {
      key: "sale",
      modifier: "cdx__kpi--sale",
      icon: <TrendingUp />,
      label: isBuildingSector ? "Остаток долга" : "Продажи",
      value: isBuildingSector ? totals.debt ?? 0 : totals.sale ?? 0,
      count: dealKindCounts.sale,
      onClick: () => setDetailsView("sale"),
    },
  ];

  const requisites = [
    { label: "ОсОО", value: client?.llc },
    { label: "ИНН", value: client?.inn },
    { label: "ОКПО", value: client?.okpo },
    { label: "Счет", value: client?.score },
    { label: "БИК", value: client?.bik },
    { label: "Адрес", value: client?.address, full: true },
  ];

  return (
    <div className="cdx" data-theme={mode}>
      {/* ===== Topbar ===== */}
      <div className="cdx__topbar">
        <div className="cdx__topbar-left">
          <button
            type="button"
            onClick={() =>
              navigate(
                company?.sector?.name === "Консалтинг"
                  ? "/crm/consulting/client"
                  : "/crm/clients"
              )
            }
            className="cdx__btn cdx__btn--ghost"
          >
            <ArrowLeft /> Назад
          </button>

          <div className="cdx__identity">
            <div className="cdx__avatar" aria-hidden="true">
              {clientInitials}
            </div>
            <div className="cdx__identity-text">
              <h1 className="cdx__name" title={clientName}>
                {clientName}
              </h1>
              <div className="cdx__identity-meta">
                <span className="cdx__badge cdx__badge--status">
                  {statusText}
                </span>
                <span className="cdx__identity-type">{clientTypeLabel}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="cdx__topbar-actions">
          <button
            type="button"
            className="cdx__btn cdx__btn--primary"
            onClick={() => openDealForm()}
          >
            <Plus /> Добавить сделку
          </button>
          <button
            type="button"
            className="cdx__btn cdx__btn--secondary"
            onClick={() => setShowReconciliation(true)}
          >
            <FileSpreadsheet /> Акт сверки
          </button>
          <button
            type="button"
            className="cdx__btn cdx__btn--secondary"
            onClick={openClientForm}
          >
            <Pencil /> Редактировать клиента
          </button>
        </div>
      </div>

      {clientErr && <div className="cdx__alert">{clientErr}</div>}

      {/* ===== KPI Row ===== */}
      <div className="cdx__kpis">
        {kpis.map((kpi) => (
          <button
            key={kpi.key}
            type="button"
            className={`cdx__kpi ${kpi.modifier}`}
            onClick={kpi.onClick}
          >
            <div className="cdx__kpi-top">
              <span className="cdx__kpi-icon">{kpi.icon}</span>
              <span className="cdx__kpi-label">{kpi.label}</span>
            </div>
            <div className="cdx__kpi-value">
              {Number(kpi.value).toFixed(2)}
              <span className="cdx__kpi-cur">сом</span>
            </div>
            <div className="cdx__kpi-foot">
              <span className="cdx__kpi-pill">
                <Layers />
                {kpi.count}
              </span>
              {kpi.count === 1 ? "сделка" : "сделок"}
            </div>
          </button>
        ))}
      </div>

      {/* ===== Profile + Requisites ===== */}
      <div className="cdx__grid">
        <div className="cdx__card">
          <div className="cdx__card-head">
            <h2 className="cdx__card-title">
              <UserIcon /> Информация о клиенте
            </h2>
          </div>
          <div className="cdx__card-body">
            <div className="cdx__profile">
              <div className="cdx__profile-avatar" aria-hidden="true">
                {clientInitials}
              </div>
              <div className="cdx__profile-info">
                <div className="cdx__profile-name">{clientName}</div>
                <div className="cdx__profile-badges">
                  <span className="cdx__badge cdx__badge--status">
                    {statusText}
                  </span>
                  <span className="cdx__badge cdx__badge--type">
                    {clientTypeLabel}
                  </span>
                </div>
              </div>
            </div>

            <div className="cdx__contacts">
              <div className="cdx__contact">
                <span className="cdx__contact-ico">
                  <Phone />
                </span>
                <div className="cdx__contact-body">
                  <div className="cdx__contact-label">Телефон</div>
                  <div className="cdx__contact-value">
                    {client?.phone ? (
                      <a href={`tel:${String(client.phone).replace(/\D/g, "")}`}>
                        {client.phone}
                      </a>
                    ) : (
                      "—"
                    )}
                  </div>
                </div>
              </div>

              <div className="cdx__contact">
                <span className="cdx__contact-ico">
                  <Mail />
                </span>
                <div className="cdx__contact-body">
                  <div className="cdx__contact-label">Email</div>
                  <div className="cdx__contact-value">
                    {client?.email || "—"}
                  </div>
                </div>
              </div>

              <div className="cdx__contact">
                <span className="cdx__contact-ico">
                  <IdCard />
                </span>
                <div className="cdx__contact-body">
                  <div className="cdx__contact-label">Тип клиента</div>
                  <div className="cdx__contact-value">{clientTypeLabel}</div>
                </div>
              </div>

              <div className="cdx__contact">
                <span className="cdx__contact-ico">
                  <CalendarDays />
                </span>
                <div className="cdx__contact-body">
                  <div className="cdx__contact-label">Дата регистрации</div>
                  <div className="cdx__contact-value">
                    {toIsoDate10(client?.date) || "—"}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="cdx__card">
          <div className="cdx__card-head">
            <h2 className="cdx__card-title">
              <ReceiptText /> Реквизиты
            </h2>
          </div>
          <div className="cdx__card-body">
            <div className="cdx__req-grid">
              {requisites.map((r) => (
                <div
                  key={r.label}
                  className={`cdx__req-item${
                    r.full ? " cdx__req-item--full" : ""
                  }`}
                >
                  <div className="cdx__req-label">{r.label}</div>
                  <div className="cdx__req-value">{r.value || "—"}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ===== Filters toolbar ===== */}
      <div className="cdx__toolbar">
        <div className="cdx__toolbar-dates">
          <div className="cdx__field">
            <label className="cdx__field-label">Дата с</label>
            <input
              className="cdx__input"
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
            />
          </div>
          <div className="cdx__field">
            <label className="cdx__field-label">Дата по</label>
            <input
              className="cdx__input"
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
            />
          </div>
        </div>

        <div className="cdx__toolbar-presets">
          <button
            type="button"
            className="cdx__chip"
            onClick={() => applyPreset("today")}
          >
            Сегодня
          </button>
          <button
            type="button"
            className="cdx__chip"
            onClick={() => applyPreset("week")}
          >
            Неделя
          </button>
          <button
            type="button"
            className="cdx__chip"
            onClick={() => applyPreset("month")}
          >
            Месяц
          </button>
          <button
            type="button"
            className="cdx__chip cdx__chip--clear"
            onClick={() => applyPreset("clear")}
          >
            Очистить
          </button>
        </div>

        <div className="cdx__toolbar-info">
          Показано: <b>{filteredDeals.length}</b> из {deals.length}
        </div>
      </div>

      {/* ===== Deals ===== */}
      <div className="cdx__deals">
        <div className="cdx__deals-head">
          <h3 className="cdx__deals-title">
            <ReceiptText /> Сделки
          </h3>
          <span className="cdx__deals-count">{filteredDeals.length}</span>
        </div>

        <div className="cdx__deals-body">
          {dealsLoading && <div className="cdx__state">Загрузка…</div>}
          {dealsErr && <div className="cdx__alert">{dealsErr}</div>}
          {!dealsLoading && !dealsErr && filteredDeals.length === 0 && (
            <div className="cdx__state">Сделок нет</div>
          )}

          {filteredDeals.map((deal) => {
            const isDebt = deal.kind === "debt";
            const debtProgress = isDebt ? getDebtProgress(deal) : null;
            const debtStatusLabel =
              isDebt && Number(deal.prepayment || 0) !== 0
                ? "Предоплата"
                : "Долг";
            const dealDate = getDealDateISO(deal);

            return (
              <div
                key={deal.id}
                onClick={() => {
                  if (deal.kind === "debt") dataTransmission(deal.id);
                }}
                className={`cdx__deal${
                  isDebt ? " cdx__deal--clickable" : ""
                }`}
              >
                <div className="cdx__deal-main">
                  <span className="cdx__deal-name">{deal.title}</span>
                  <div className="cdx__deal-meta">
                    {isDebt ? (
                      <span className="cdx__badge cdx__badge--debt">
                        {debtStatusLabel}
                      </span>
                    ) : (
                      <span className="cdx__badge cdx__badge--neutral">
                        {kindLabel(deal.kind)}
                      </span>
                    )}
                    {dealDate && (
                      <span className="cdx__deal-meta-item">
                        <CalendarDays />
                        {dealDate}
                      </span>
                    )}
                    <span className="cdx__deal-meta-item">Нет задач</span>
                  </div>
                </div>

                <div className="cdx__deal-money">
                  <div className="cdx__deal-amount">
                    {Number(deal.amount || 0).toFixed(2)}
                    <span className="cdx__deal-amount-cur">сом</span>
                  </div>
                  {isDebt && (
                    <div className="cdx__deal-remaining">
                      Остаток: {Number(deal.remaining_debt || 0).toFixed(2)} сом
                    </div>
                  )}
                </div>

                <div className="cdx__progress">
                  {isDebt ? (
                    <>
                      <div className="cdx__progress-top">
                        <span className="cdx__progress-label">
                          Оплачено {debtProgress.paid.toFixed(2)} из{" "}
                          {debtProgress.total.toFixed(2)}
                        </span>
                        <span className="cdx__progress-pct">
                          {debtProgress.percent}%
                        </span>
                      </div>
                      <div className="cdx__progress-track">
                        <div
                          className="cdx__progress-fill"
                          style={{
                            width: `${debtProgress.percent}%`,
                            backgroundColor: debtProgress.fill,
                          }}
                        />
                      </div>
                    </>
                  ) : (
                    <span className="cdx__deal-meta-item">
                      {kindLabel(deal.kind)}
                    </span>
                  )}
                </div>

                <div
                  className="cdx__deal-actions"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    type="button"
                    onClick={() => openDealForm(deal)}
                    className="cdx__btn cdx__btn--secondary"
                  >
                    <Pencil /> Редактировать
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ===== История продаж (POS) ===== */}
      <div className="cdx__deals">
        <div className="cdx__deals-head">
          <h3 className="cdx__deals-title">
            <ReceiptText /> История продаж
          </h3>
          <span className="cdx__deals-count">{filteredClientSales.length}</span>
        </div>

        <div className="cdx__deals-body">
          {clientSalesLoading && <div className="cdx__state">Загрузка…</div>}
          {clientSalesErr && <div className="cdx__alert">{clientSalesErr}</div>}
          {!clientSalesLoading &&
            !clientSalesErr &&
            filteredClientSales.length === 0 && (
              <div className="cdx__state">Продаж нет</div>
            )}

          {filteredClientSales.map((sale, idx) => {
            const st = saleStatusRu(sale.status);
            const items = Array.isArray(sale.items) ? sale.items : [];
            const itemsLabel = items
              .slice(0, 3)
              .map(
                (it) =>
                  `${it.product_name || it.name_snapshot || "Товар"} ×${Number(
                    it.quantity || 0,
                  )}`,
              )
              .join(", ");
            const moreCount = Math.max(0, items.length - 3);
            return (
              <div key={sale.id || idx} className="cdx__deal">
                <div className="cdx__deal-main">
                  <span className="cdx__deal-name">
                    Продажа №{filteredClientSales.length - idx}
                  </span>
                  <div className="cdx__deal-meta">
                    <span className={`cdx__badge cdx__badge--${st.mod}`}>
                      {st.label}
                    </span>
                    <span className="cdx__deal-meta-item">
                      <CalendarDays />
                      {fmtSaleDate(sale.created_at || sale.paid_at)}
                    </span>
                    {itemsLabel && (
                      <span className="cdx__deal-meta-item" title={itemsLabel}>
                        {itemsLabel}
                        {moreCount > 0 ? ` +${moreCount}` : ""}
                      </span>
                    )}
                  </div>
                </div>

                <div className="cdx__deal-money">
                  <div className="cdx__deal-amount">
                    {Number(sale.total || 0).toFixed(2)}
                    <span className="cdx__deal-amount-cur">сом</span>
                  </div>
                  {Number(sale.discount_total || 0) > 0 && (
                    <div className="cdx__deal-remaining">
                      Скидка: {Number(sale.discount_total).toFixed(2)} сом
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {isSupplierClient && company?.sector?.name === "Магазин" && (
        <div className="cdx__card">
          <div className="cdx__supplier-head">
            <div>
              <h3 className="cdx__card-title">
                <Package /> Товары поставщика
              </h3>
              <div className="cdx__supplier-subtitle">
                Список товаров, которые этот поставщик привозит
              </div>
            </div>

            <div className="cdx__supplier-actions">
              <input
                type="text"
                className="cdx__input"
                placeholder="Поиск по названию, коду, артикулу, штрихкоду"
                value={supplierProductSearch}
                onChange={(e) => setSupplierProductSearch(e.target.value)}
              />
              <button
                type="button"
                className="cdx__btn cdx__btn--secondary"
                onClick={() => loadSupplierProducts(client?.id)}
                disabled={!client?.id || supplierProductsLoading}
              >
                <RefreshCw />
                {supplierProductsLoading ? "Обновляем..." : "Обновить товары"}
              </button>
            </div>
          </div>

          <div className="cdx__supplier-summary">
            <div className="cdx__supplier-chip">
              Всего товаров: <b>{supplierProducts.length}</b>
            </div>
            <div className="cdx__supplier-chip">
              Показано: <b>{supplierProductsCountLabel}</b>
            </div>
          </div>

          {supplierProductsErr && (
            <div style={{ padding: "16px 22px 0" }}>
              <div className="cdx__alert">{supplierProductsErr}</div>
            </div>
          )}

          {supplierProductsLoading ? (
            <div className="cdx__state">Загрузка…</div>
          ) : filteredSupplierProducts.length === 0 ? (
            <div className="cdx__state">
              {supplierProductSearch.trim()
                ? "По вашему запросу товары не найдены"
                : "У этого поставщика пока нет товаров"}
            </div>
          ) : (
            <>
              <div className="cdx__supplier-table-wrap">
                <table className="cdx__supplier-table">
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

              <div className="cdx__supplier-cards">
                {filteredSupplierProducts.map((product) => (
                  <div
                    key={`card-${product?.id || product?.code || product?.barcode}`}
                    className="cdx__supplier-card"
                  >
                    <div className="cdx__supplier-card-name">
                      {product?.name || product?.title || "Без названия"}
                    </div>
                    <div className="cdx__supplier-card-row">
                      <span>Код</span>
                      <strong>{product?.code || "—"}</strong>
                    </div>
                    <div className="cdx__supplier-card-row">
                      <span>Артикул</span>
                      <strong>{product?.article || "—"}</strong>
                    </div>
                    <div className="cdx__supplier-card-row">
                      <span>Штрихкод</span>
                      <strong>{product?.barcode || "—"}</strong>
                    </div>
                    <div className="cdx__supplier-card-row">
                      <span>Остаток</span>
                      <strong>{product?.quantity ?? 0}</strong>
                    </div>
                    <div className="cdx__supplier-card-row">
                      <span>Ед. изм.</span>
                      <strong>{product?.unit || "—"}</strong>
                    </div>
                    <div className="cdx__supplier-card-row">
                      <span>Закупочная цена</span>
                      <strong>
                        {product?.purchase_price ?? product?.price ?? "—"}
                      </strong>
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
        <div
          className="cdx__modal-overlay"
          onClick={() => setDetailsView(null)}
        >
          <div className="cdx__modal" onClick={(e) => e.stopPropagation()}>
            <div className="cdx__modal-head">
              <h3 className="cdx__modal-title">{detailsMeta.title}</h3>
              <button
                type="button"
                className="cdx__modal-close"
                onClick={() => setDetailsView(null)}
                aria-label="Закрыть"
              >
                ×
              </button>
            </div>
            <div className="cdx__modal-total">
              Итого: <b>{detailsMeta.total.toFixed(2)} сом</b>
            </div>
            <div className="cdx__modal-list">
              {detailRows.length === 0 && (
                <div className="cdx__modal-empty">
                  Нет данных по выбранной категории
                </div>
              )}
              {detailRows.map((row) => (
                <div key={row.id} className="cdx__modal-row">
                  <div className="cdx__modal-what">{row.title}</div>
                  <div className="cdx__modal-when">{row.date}</div>
                  <div className="cdx__modal-howmuch">
                    {row.amount.toFixed(2)} сом
                  </div>
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
