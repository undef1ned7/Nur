/**
 * Окно «Новый лид» — ручное заведение обращения, пришедшего не из мессенджера
 * (звонок, визит, рекомендация).
 *
 * Набор полей повторяет форму создания лида на доске воронки
 * (`Funnel/Funnel.jsx` → LeadCreateForm): название, воронка, стадия, услуга,
 * сотрудники воронки, вероятность, источник, контакты, оценочная сумма,
 * срочность, описание.
 *
 * Создаётся `InboundLead` (очередь «Лиды») + параллельная карточка в выбранной
 * воронке через `ensureFunnelLeadForInbound` — с переданными вручную полями.
 */
import { useEffect, useMemo, useState } from "react";
import { FaTimes } from "react-icons/fa";
import api from "../../../../../api";
import {
  createInboundLead,
  ensureFunnelLeadForInbound,
} from "../../../../../api/consultingLeads";
import { useUser } from "../../../../../store/slices/userSlice";
import { filterFunnelsForUser } from "../../../../../utils/consultingFunnelAccess";
import {
  getFunnelDisplayName,
  isMainFunnel,
} from "../../../../../utils/consultingFunnelDefaults";
import FunnelEmployeesPicker from "../../Funnel/FunnelEmployeesPicker";
import useConsultingRegions from "../../common/useConsultingRegions";

const FUNNEL_V2 = import.meta.env.VITE_FUNNEL_V2 === "true";

const URGENCY = [
  { value: "low", label: "Низкая" },
  { value: "medium", label: "Средняя" },
  { value: "high", label: "Высокая" },
];

const asArray = (d) =>
  Array.isArray(d?.results) ? d.results : Array.isArray(d) ? d : [];

export default function CreateLeadModal({ funnels = [], onClose, onCreated, onError }) {
  const { profile } = useUser();
  const regionCtl = useConsultingRegions(profile);

  // Бэкенд region_code на самой воронке пока не отдаёт (только у лидов) —
  // см. docs/consulting/backend-money-tenant/15-regional-routing-integration.md §0.
  const funnelRegionFallback = useMemo(() => {
    const map = new Map();
    (regionCtl.regions || []).forEach((r) => {
      if (r.funnel_id) map.set(String(r.funnel_id), r.code);
    });
    return map;
  }, [regionCtl.regions]);

  const visibleFunnels = useMemo(
    () => filterFunnelsForUser(funnels, profile, funnelRegionFallback),
    [funnels, profile, funnelRegionFallback],
  );

  const defaultFunnelId = useMemo(() => {
    const main = visibleFunnels.find((f) => isMainFunnel(f));
    return String(main?.id || visibleFunnels[0]?.id || "");
  }, [visibleFunnels]);

  const [form, setForm] = useState({
    title: "",
    funnel: "",
    stage: "",
    service: "",
    probability: "",
    source: "",
    full_name: "",
    phone: "",
    email: "",
    address: "",
    estimated_value: "",
    urgency: "medium",
    description: "",
  });
  const [participants, setParticipants] = useState([]);
  const [stages, setStages] = useState([]);
  const [services, setServices] = useState([]);
  const [saving, setSaving] = useState(false);
  const [fieldError, setFieldError] = useState("");

  // Пока пользователь явно не выбрал воронку — работаем с дефолтной.
  const funnelId = form.funnel || defaultFunnelId;
  const selectedFunnel = visibleFunnels.find(
    (f) => String(f.id) === String(funnelId),
  );

  // Услуги — один раз.
  useEffect(() => {
    const controller = new AbortController();
    api
      .get("/consalting/services/", { signal: controller.signal })
      .then((res) => setServices(asArray(res.data)))
      .catch(() => {});
    return () => controller.abort();
  }, []);

  // Стадии выбранной воронки.
  useEffect(() => {
    if (!funnelId) return undefined;
    const controller = new AbortController();
    api
      .get("/consalting/funnel-stages/", {
        params: { funnel: funnelId },
        signal: controller.signal,
      })
      .then((res) => {
        const rows = asArray(res.data)
          .slice()
          .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
        setStages(rows);
        setForm((f) => ({ ...f, stage: "" }));
      })
      .catch(() => setStages([]));
    return () => controller.abort();
  }, [funnelId]);

  const funnelRoleId = selectedFunnel?.custom_role
    ? String(selectedFunnel.custom_role)
    : null;
  const visibleServices = useMemo(() => {
    if (!funnelRoleId) return services;
    return services.filter((s) => {
      const sr = s.custom_role ? String(s.custom_role) : null;
      return !sr || sr === funnelRoleId;
    });
  }, [services, funnelRoleId]);

  const set = (k) => (e) => {
    setForm((f) => ({ ...f, [k]: e.target.value }));
    if (fieldError) setFieldError("");
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) {
      setFieldError("Введите название лида.");
      return;
    }
    if (!form.full_name.trim() && !form.phone.trim()) {
      setFieldError("Укажите имя или телефон лида.");
      return;
    }
    setFieldError("");
    setSaving(true);
    try {
      const inbound = await createInboundLead({
        full_name: form.full_name.trim(),
        phone: form.phone.trim(),
        source: form.source.trim() || "manual",
        message: form.description.trim(),
        // Ручной лид не из мессенджера — внешнего чата нет. Бэк требует
        // external_id и дедуплицирует по нему, поэтому шлём уникальный
        // синтетический id, а не пустую строку.
        external_id: `manual:${
          globalThis.crypto?.randomUUID?.() ?? Date.now().toString(36)
        }`,
      });
      // Пока бэк не создаёт параллельную карточку в воронке для ручного лида —
      // делаем это с фронта, чтобы лид попал в /crm/consulting/funnel.
      await ensureFunnelLeadForInbound(inbound, {
        funnel: funnelId || undefined,
        stage: form.stage || undefined,
        title: form.title.trim(),
        email: form.email.trim(),
        address: form.address.trim(),
        source: form.source.trim() || undefined,
        description: form.description.trim(),
        estimated_value:
          form.estimated_value === "" ? 0 : Number(form.estimated_value) || 0,
        probability:
          form.probability === "" ? 0 : Number(form.probability) || 0,
        service: form.service || undefined,
        urgency: FUNNEL_V2 ? form.urgency : undefined,
        participant_ids: participants,
      });
      onCreated?.();
    } catch (e2) {
      onError?.(e2?.detail || "Не удалось создать лид.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="leads__overlay" onClick={() => !saving && onClose()}>
      <div
        className="leads__modal leads__modal--wide"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-lead-title"
      >
        <div className="leads__modalHead">
          <h3 className="leads__modalTitle" id="create-lead-title">
            Новый лид
          </h3>
          <button
            type="button"
            className="leads__iconBtn"
            onClick={onClose}
            aria-label="Закрыть"
          >
            <FaTimes />
          </button>
        </div>

        <form className="leads__form" onSubmit={submit}>
          {!!fieldError && <div className="leads__warn">{fieldError}</div>}

          <div className="leads__field">
            <label className="leads__label">Название *</label>
            <input
              className="cList__input"
              value={form.title}
              onChange={set("title")}
              autoFocus
            />
          </div>

          <div className="leads__field">
            <label className="leads__label">Воронка</label>
            <select
              className="cList__input"
              value={funnelId}
              onChange={set("funnel")}
            >
              {!visibleFunnels.length && <option value="">—</option>}
              {visibleFunnels.map((f) => (
                <option key={f.id} value={f.id}>
                  {getFunnelDisplayName(f)}
                </option>
              ))}
            </select>
          </div>

          <div className="leads__field">
            <label className="leads__label">Сотрудники воронки</label>
            <FunnelEmployeesPicker
              funnelId={funnelId}
              value={participants}
              onChange={setParticipants}
              disabled={saving}
            />
          </div>

          <div className="leads__grid2">
            <div className="leads__field">
              <label className="leads__label">Услуга (опционально)</label>
              <select
                className="cList__input"
                value={form.service}
                onChange={set("service")}
              >
                <option value="">Не выбрана</option>
                {visibleServices.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="leads__field">
              <label className="leads__label">Стадия</label>
              <select
                className="cList__input"
                value={form.stage}
                onChange={set("stage")}
              >
                <option value="">Без стадии</option>
                {stages.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="leads__grid2">
            <div className="leads__field">
              <label className="leads__label">Вероятность, %</label>
              <input
                className="cList__input"
                type="number"
                min="0"
                max="100"
                value={form.probability}
                onChange={set("probability")}
              />
            </div>
            <div className="leads__field">
              <label className="leads__label">Источник</label>
              <input
                className="cList__input"
                value={form.source}
                onChange={set("source")}
                placeholder="Сайт, Instagram…"
              />
            </div>
          </div>

          <div className="leads__grid2">
            <div className="leads__field">
              <label className="leads__label">Контактное лицо</label>
              <input
                className="cList__input"
                value={form.full_name}
                onChange={set("full_name")}
              />
            </div>
            <div className="leads__field">
              <label className="leads__label">Телефон</label>
              <input
                className="cList__input"
                value={form.phone}
                onChange={set("phone")}
                placeholder="+996700000000"
                inputMode="tel"
              />
            </div>
          </div>

          <div className="leads__grid2">
            <div className="leads__field">
              <label className="leads__label">Email</label>
              <input
                className="cList__input"
                type="email"
                value={form.email}
                onChange={set("email")}
              />
            </div>
            <div className="leads__field">
              <label className="leads__label">Оценочная сумма, с</label>
              <input
                className="cList__input"
                type="number"
                min="0"
                step="0.01"
                value={form.estimated_value}
                onChange={set("estimated_value")}
              />
            </div>
          </div>

          <div className="leads__field">
            <label className="leads__label">Адрес</label>
            <input
              className="cList__input"
              value={form.address}
              onChange={set("address")}
              placeholder="Город, улица, дом…"
            />
          </div>

          {FUNNEL_V2 && (
            <div className="leads__field">
              <label className="leads__label">Срочность</label>
              <select
                className="cList__input"
                value={form.urgency}
                onChange={set("urgency")}
              >
                {URGENCY.map((u) => (
                  <option key={u.value} value={u.value}>
                    {u.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="leads__field">
            <label className="leads__label">Описание</label>
            <textarea
              className="cList__input"
              rows={3}
              value={form.description}
              onChange={set("description")}
            />
          </div>

          <div className="leads__formActions">
            <button
              type="button"
              className="leads__btn"
              onClick={onClose}
              disabled={saving}
            >
              Отмена
            </button>
            <button
              type="submit"
              className="leads__btn leads__btn--primary"
              disabled={saving}
            >
              {saving ? "Сохранение…" : "Создать"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
