import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { BarChart3, Plus, RefreshCw } from "lucide-react";
import { useUser } from "../../../../../store/slices/userSlice";
import { useAlert, useConfirm } from "../../../../../hooks/useDialog";
import {
  acceptStockPartnershipRequest,
  cancelStockPartnershipRequest,
  createStockPartnershipRequest,
  listActiveStockPartners,
  listStockPartnershipRequests,
  rejectStockPartnershipRequest,
} from "../../../../../api/warehouse";
import {
  approvePartnerOperation,
  cancelPartnerOperation,
  listPartnerOperations,
  rejectPartnerOperation,
  terminateStockPartnership,
  updateStockPartnershipSettings,
} from "../../../../../api/warehousePartnership";
import {
  extractPartnershipError,
  isOwnerOrAdmin as checkOwnerOrAdmin,
} from "../partnership/partnershipHelpers";
import PartnershipRequestsTable from "../partnership/PartnershipRequestsTable";
import PartnerOperationsTable from "../partnership/PartnerOperationsTable";
import PartnersTable from "../partnership/PartnersTable";
import PartnershipInviteModal from "../partnership/PartnershipInviteModal";
import "../Warehouses.scss";

const SUB_TABS = {
  PARTNERS: "partners",
  INCOMING: "incoming",
  OUTGOING: "outgoing",
  OPERATIONS: "operations",
};

const SUB_TAB_VALUES = new Set(Object.values(SUB_TABS));

const isPending = (row) => row?.status === "PENDING";

const StockPartnershipPanel = () => {
  const navigate = useNavigate();
  const alert = useAlert();
  const confirm = useConfirm();
  const { profile, company } = useUser();
  const isOwnerOrAdmin = checkOwnerOrAdmin(profile);

  // Вложенный таб — в URL (?sub=), чтобы «Назад» со страниц партнёра возвращал туда же
  const [searchParams, setSearchParams] = useSearchParams();
  const subFromUrl = searchParams.get("sub");
  const subTab = SUB_TAB_VALUES.has(subFromUrl) ? subFromUrl : SUB_TABS.PARTNERS;
  const setSubTab = useCallback(
    (key) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (key === SUB_TABS.PARTNERS) next.delete("sub");
          else next.set("sub", key);
          return next;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [incoming, setIncoming] = useState([]);
  const [outgoing, setOutgoing] = useState([]);
  const [partners, setPartners] = useState([]);
  // null — бэк ещё не поддерживает операции с подтверждением (вкладку не показываем)
  const [operations, setOperations] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [showInvite, setShowInvite] = useState(false);
  const [inviteBusy, setInviteBusy] = useState(false);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [requestsData, partnersData, operationsData] = await Promise.all([
        listStockPartnershipRequests(),
        listActiveStockPartners(),
        // Ошибка операций не должна ломать заявки и партнёров
        listPartnerOperations().catch((e) => {
          console.error(e);
          return null;
        }),
      ]);
      setIncoming(requestsData?.incoming || []);
      setOutgoing(requestsData?.outgoing || []);
      setPartners(partnersData?.partners || []);
      setOperations(
        operationsData
          ? {
              incoming: operationsData.incoming || [],
              outgoing: operationsData.outgoing || [],
            }
          : null,
      );
    } catch (e) {
      console.error(e);
      setError(extractPartnershipError(e));
      setIncoming([]);
      setOutgoing([]);
      setPartners([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  // Если бэк перестал отдавать операции (или ещё не умеет) — вкладки нет
  const activeTab =
    subTab === SUB_TABS.OPERATIONS && operations === null
      ? SUB_TABS.INCOMING
      : subTab;

  const incomingPending = useMemo(() => incoming.filter(isPending), [incoming]);
  const operationsIncomingPending = useMemo(
    () => (operations?.incoming || []).filter(isPending).length,
    [operations],
  );

  const partnerIds = useMemo(
    () => new Set(partners.map((p) => String(p.id))),
    [partners],
  );
  const outgoingPendingIds = useMemo(
    () => new Set(outgoing.filter(isPending).map((r) => String(r.to_company))),
    [outgoing],
  );
  const incomingPendingIds = useMemo(
    () => new Set(incomingPending.map((r) => String(r.from_company))),
    [incomingPending],
  );

  const runAction = async (id, action, successMessage) => {
    if (!id || busyId) return;
    setBusyId(id);
    try {
      await action();
      if (successMessage) alert(successMessage);
      await loadAll();
    } catch (e) {
      alert(extractPartnershipError(e), true);
    } finally {
      setBusyId(null);
    }
  };

  const ask = (message) =>
    new Promise((resolve) => confirm(message, (ok) => resolve(Boolean(ok))));

  const handleAccept = async (r) => {
    const ok = await ask(
      `Принять заявку от «${r.from_company_name || "компании"}»? Партнёр получит доступ к вашим складам, остаткам, кассам, аналитике и истории продаж.`,
    );
    if (ok) runAction(r.id, () => acceptStockPartnershipRequest(r.id));
  };

  const handleReject = async (r) => {
    const ok = await ask(`Отклонить заявку от «${r.from_company_name || "компании"}»?`);
    if (ok) runAction(r.id, () => rejectStockPartnershipRequest(r.id));
  };

  const handleCancel = (r) =>
    runAction(r.id, () => cancelStockPartnershipRequest(r.id));

  const handleInvite = async (target, note) => {
    if (!target?.id || inviteBusy) return;
    setInviteBusy(true);
    try {
      await createStockPartnershipRequest({
        to_company: target.id,
        note: note || undefined,
      });
      setShowInvite(false);
      await loadAll();
      setSubTab(SUB_TABS.OUTGOING);
    } catch (e) {
      alert(extractPartnershipError(e), true);
    } finally {
      setInviteBusy(false);
    }
  };

  const handleTerminate = async (p) => {
    const ok = await ask(
      `Разорвать партнёрство с «${p.name || "компанией"}»? Обмен товаром, инкассация и аналитика станут недоступны обеим компаниям, ожидающие запросы будут отменены. Проведённые документы и история сохранятся.`,
    );
    if (ok) {
      runAction(
        p.id,
        () => terminateStockPartnership(p.id),
        "Партнёрство разорвано",
      );
    }
  };

  // Подтверждаем только расширение доступа партнёра; сужение — сразу
  const SETTINGS_CONFIRM = {
    allow_direct_pull: (name) =>
      `Разрешить «${name}» забирать товар с ваших складов и деньги из ваших касс без вашего подтверждения?`,
    share_sales_history: (name) =>
      `Показать «${name}» историю ваших продаж и возвратов (документы, покупатели, суммы)?`,
  };

  const handleUpdateSettings = async (p, patch) => {
    const [field, enabled] = Object.entries(patch)[0] || [];
    if (enabled && SETTINGS_CONFIRM[field]) {
      const ok = await ask(SETTINGS_CONFIRM[field](p.name || "партнёру"));
      if (!ok) return;
    }
    runAction(p.id, () => updateStockPartnershipSettings(p.id, patch));
  };

  const handleApproveOperation = async (op) => {
    const what =
      op.kind === "INCASSATION"
        ? "Деньги спишутся из вашей кассы"
        : "Товар спишется с вашего склада";
    const ok = await ask(
      `Подтвердить запрос «${op.initiator_company_name || "партнёра"}»? ${what} и поступят партнёру.`,
    );
    if (ok) runAction(op.id, () => approvePartnerOperation(op.id), "Операция проведена");
  };

  const handleRejectOperation = async (op) => {
    const ok = await ask(`Отклонить запрос «${op.initiator_company_name || "партнёра"}»?`);
    if (ok) runAction(op.id, () => rejectPartnerOperation(op.id));
  };

  const handleCancelOperation = (op) =>
    runAction(op.id, () => cancelPartnerOperation(op.id));

  const openSales = (p) => {
    if (p?.id) {
      navigate(`/crm/warehouse/partners/${p.id}/sales`, {
        state: { partnerName: p.name },
      });
    }
  };

  const openCatalog = (p) => {
    if (p?.id) navigate(`/crm/warehouse/partners/${p.id}`);
  };

  const openAnalytics = (p) => {
    if (p?.id) {
      navigate(`/crm/warehouse/partners/${p.id}/analytics`, {
        state: { partnerName: p.name },
      });
    }
  };

  // count — сколько всего; attention — сколько ждут вашего решения (выделяется цветом)
  const tabButton = (key, label, { count = 0, attention = 0 } = {}) => {
    const badge = attention || count;
    return (
      <button
        type="button"
        role="tab"
        aria-selected={activeTab === key}
        className={`warehouse-partnership-tab ${activeTab === key ? "active" : ""}`}
        onClick={() => setSubTab(key)}
      >
        {label}
        {badge > 0 && (
          <span
            className={`warehouse-partnership-tab__count ${attention ? "warehouse-partnership-tab__count--attention" : ""}`}
            aria-label={attention ? `ждут решения: ${attention}` : undefined}
          >
            {badge}
          </span>
        )}
      </button>
    );
  };

  return (
    <section className="warehouse-partnership">
      <div className="warehouse-partnership__toolbar">
        <div className="warehouse-partnership-tabs" role="tablist" aria-label="Партнёрство">
          {tabButton(SUB_TABS.PARTNERS, "Активные", { count: partners.length })}
          {tabButton(SUB_TABS.INCOMING, "Входящие заявки", {
            attention: incomingPending.length,
          })}
          {tabButton(SUB_TABS.OUTGOING, "Исходящие заявки")}
          {operations !== null &&
            tabButton(SUB_TABS.OPERATIONS, "Запросы на товар и деньги", {
              attention: operationsIncomingPending,
            })}
        </div>
        <div className="warehouse-partnership__actions">
          {isOwnerOrAdmin && activeTab === SUB_TABS.PARTNERS && (
            <button
              type="button"
              className="warehouse-partnership-action warehouse-partnership-action--secondary"
              onClick={() => navigate("/crm/warehouse/partners/analytics")}
            >
              <BarChart3 size={16} aria-hidden="true" />
              Аналитика партнёров
            </button>
          )}
          {isOwnerOrAdmin && (
            <button
              type="button"
              className="warehouse-header__create-btn"
              onClick={() => setShowInvite(true)}
            >
              <Plus size={16} /> Пригласить
            </button>
          )}
          <button
            type="button"
            className="warehouse-partnership-refresh"
            onClick={loadAll}
            disabled={loading}
            aria-label="Обновить"
          >
            <RefreshCw size={18} />
          </button>
        </div>
      </div>

      {error && <div className="warehouse-partnership-error">{error}</div>}

      {activeTab === SUB_TABS.INCOMING && (
        <PartnershipRequestsTable
          mode="incoming"
          rows={incoming}
          loading={loading}
          canDecide={isOwnerOrAdmin}
          busyId={busyId}
          onAccept={handleAccept}
          onReject={handleReject}
          onCancel={handleCancel}
        />
      )}
      {activeTab === SUB_TABS.OUTGOING && (
        <PartnershipRequestsTable
          mode="outgoing"
          rows={outgoing}
          loading={loading}
          canDecide={isOwnerOrAdmin}
          busyId={busyId}
          onAccept={handleAccept}
          onReject={handleReject}
          onCancel={handleCancel}
        />
      )}
      {activeTab === SUB_TABS.OPERATIONS && (
        <>
          <h4 className="warehouse-partnership-subtitle">Партнёры запрашивают у вас</h4>
          <PartnerOperationsTable
            mode="incoming"
            rows={operations.incoming}
            loading={loading}
            busyId={busyId}
            onApprove={handleApproveOperation}
            onReject={handleRejectOperation}
            onCancel={handleCancelOperation}
          />
          <h4 className="warehouse-partnership-subtitle">Вы запросили у партнёров</h4>
          <PartnerOperationsTable
            mode="outgoing"
            rows={operations.outgoing}
            loading={loading}
            busyId={busyId}
            onApprove={handleApproveOperation}
            onReject={handleRejectOperation}
            onCancel={handleCancelOperation}
          />
        </>
      )}
      {activeTab === SUB_TABS.PARTNERS && (
        <PartnersTable
          rows={partners}
          loading={loading}
          busyId={busyId}
          onOpenCatalog={openCatalog}
          onOpenAnalytics={openAnalytics}
          onOpenSales={openSales}
          onTerminate={handleTerminate}
          onUpdateSettings={handleUpdateSettings}
        />
      )}

      {showInvite && (
        <PartnershipInviteModal
          ownCompanyId={company?.id}
          partnerIds={partnerIds}
          outgoingPendingIds={outgoingPendingIds}
          incomingPendingIds={incomingPendingIds}
          busy={inviteBusy}
          onInvite={handleInvite}
          onClose={() => setShowInvite(false)}
        />
      )}
    </section>
  );
};

export default StockPartnershipPanel;
