import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { FaArrowLeft } from "react-icons/fa";
import {
  fetchPlatformAdminMeta,
  fetchPlatformCompany,
  isPlatformAdminUnavailable,
  patchPlatformCompany,
  pickPlatformAdminError,
} from "../../../api/platformAdmin";
import SubscriptionPanel from "./SubscriptionPanel";
import CompanyUsersTab from "./CompanyUsersTab";
import "./PlatformAdmin.scss";

const asArray = (data) =>
  Array.isArray(data?.results) ? data.results : Array.isArray(data) ? data : [];

const emptyForm = () => ({
  name: "",
  llc: "",
  inn: "",
  okpo: "",
  score: "",
  bik: "",
  address: "",
  phones_howcase: "",
  slug: "",
  sector_id: "",
  is_active: true,
});

const CompanyDetail = () => {
  const { id } = useParams();
  const [company, setCompany] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [sectors, setSectors] = useState([]);
  const [customRoles, setCustomRoles] = useState([]);
  const [tab, setTab] = useState("company");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const applyCompany = useCallback((data) => {
    setCompany(data);
    setForm({
      name: data?.name || "",
      llc: data?.llc || "",
      inn: data?.inn || "",
      okpo: data?.okpo || "",
      score: data?.score || "",
      bik: data?.bik || "",
      address: data?.address || "",
      phones_howcase: data?.phones_howcase || "",
      slug: data?.slug || "",
      sector_id: data?.sector?.id ?? data?.sector_id ?? "",
      is_active: data?.is_active !== false,
    });
    if (Array.isArray(data?.custom_roles)) {
      setCustomRoles(data.custom_roles);
    }
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    setUnavailable(false);
    try {
      const data = await fetchPlatformCompany(id);
      applyCompany(data);
    } catch (err) {
      if (isPlatformAdminUnavailable(err)) {
        setUnavailable(true);
      } else {
        setError(pickPlatformAdminError(err, "Не удалось загрузить компанию"));
      }
    } finally {
      setLoading(false);
    }
  }, [id, applyCompany]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void load();
    }, 0);
    return () => clearTimeout(timer);
  }, [load]);

  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(() => {
      (async () => {
        try {
          const meta = await fetchPlatformAdminMeta();
          if (cancelled) return;
          setSectors(asArray(meta?.sectors ?? meta?.industries));
          if (Array.isArray(meta?.roles)) {
            setCustomRoles(meta.roles);
          }
        } catch {
          /* ignore */
        }
      })();
    }, 0);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, []);

  const onChange = (key) => (e) => {
    const value =
      key === "is_active" ? e.target.checked : e.target.value;
    setForm((p) => ({ ...p, [key]: value }));
  };

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const payload = {
        name: form.name.trim(),
        llc: form.llc.trim() || null,
        inn: form.inn.trim() || null,
        okpo: form.okpo.trim() || null,
        score: form.score.trim() || null,
        bik: form.bik.trim() || null,
        address: form.address.trim() || null,
        phones_howcase: form.phones_howcase.trim() || null,
        slug: form.slug.trim() || null,
        sector_id: form.sector_id || null,
        is_active: form.is_active,
      };
      const updated = await patchPlatformCompany(id, payload);
      applyCompany(updated);
      setMessage("Компания сохранена");
    } catch (err) {
      setError(pickPlatformAdminError(err, "Не удалось сохранить компанию"));
    } finally {
      setSaving(false);
    }
  };

  if (unavailable) {
    return (
      <div className="platform-admin__stub">
        <h2>Раздел подключается</h2>
        <p>Карточка компании станет доступна после реализации API.</p>
        <Link to="/platform-admin" className="platform-admin__link">
          ← К списку
        </Link>
      </div>
    );
  }

  if (loading) {
    return <div className="platform-admin__page">Загрузка…</div>;
  }

  if (!company && error) {
    return (
      <div className="platform-admin__page">
        <div className="platform-admin__alert">{error}</div>
        <Link to="/platform-admin" className="platform-admin__link">
          ← К списку
        </Link>
      </div>
    );
  }

  const branches = asArray(company?.branches);

  return (
    <div className="platform-admin__page">
      <div className="platform-admin__detail-head">
        <Link to="/platform-admin" className="platform-admin__back">
          <FaArrowLeft /> Компании
        </Link>
        <h2>{company?.name || `Компания #${id}`}</h2>
      </div>

      <div className="platform-admin__tabs">
        <button
          type="button"
          className={
            tab === "company"
              ? "platform-admin__tab platform-admin__tab--active"
              : "platform-admin__tab"
          }
          onClick={() => setTab("company")}
        >
          Реквизиты
        </button>
        <button
          type="button"
          className={
            tab === "subscription"
              ? "platform-admin__tab platform-admin__tab--active"
              : "platform-admin__tab"
          }
          onClick={() => setTab("subscription")}
        >
          Подписка
        </button>
        <button
          type="button"
          className={
            tab === "users"
              ? "platform-admin__tab platform-admin__tab--active"
              : "platform-admin__tab"
          }
          onClick={() => setTab("users")}
        >
          Пользователи
        </button>
      </div>

      {tab === "company" && (
        <form className="platform-admin__card" onSubmit={save}>
          {error && <div className="platform-admin__alert">{error}</div>}
          {message && (
            <div className="platform-admin__alert platform-admin__alert--ok">
              {message}
            </div>
          )}
          <div className="platform-admin__grid">
            <label className="platform-admin__field">
              <span>Название *</span>
              <input
                required
                value={form.name}
                onChange={onChange("name")}
                disabled={saving}
              />
            </label>
            <label className="platform-admin__field">
              <span>Slug</span>
              <input
                value={form.slug}
                onChange={onChange("slug")}
                disabled={saving}
              />
            </label>
            <label className="platform-admin__field">
              <span>Сектор</span>
              <select
                value={form.sector_id}
                onChange={onChange("sector_id")}
                disabled={saving}
              >
                <option value="">—</option>
                {sectors.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
                {!sectors.length && company?.sector?.id && (
                  <option value={company.sector.id}>
                    {company.sector.name}
                  </option>
                )}
              </select>
            </label>
            <label className="platform-admin__field">
              <span>ООО / юр. название</span>
              <input
                value={form.llc}
                onChange={onChange("llc")}
                disabled={saving}
              />
            </label>
            <label className="platform-admin__field">
              <span>ИНН</span>
              <input
                value={form.inn}
                onChange={onChange("inn")}
                disabled={saving}
              />
            </label>
            <label className="platform-admin__field">
              <span>ОКПО</span>
              <input
                value={form.okpo}
                onChange={onChange("okpo")}
                disabled={saving}
              />
            </label>
            <label className="platform-admin__field">
              <span>Расчётный счёт</span>
              <input
                value={form.score}
                onChange={onChange("score")}
                disabled={saving}
              />
            </label>
            <label className="platform-admin__field">
              <span>БИК</span>
              <input
                value={form.bik}
                onChange={onChange("bik")}
                disabled={saving}
              />
            </label>
            <label className="platform-admin__field platform-admin__field--full">
              <span>Адрес</span>
              <input
                value={form.address}
                onChange={onChange("address")}
                disabled={saving}
              />
            </label>
            <label className="platform-admin__field platform-admin__field--full">
              <span>Телефоны витрины</span>
              <input
                value={form.phones_howcase}
                onChange={onChange("phones_howcase")}
                disabled={saving}
              />
            </label>
            <label className="platform-admin__field platform-admin__field--check">
              <input
                type="checkbox"
                checked={form.is_active}
                onChange={onChange("is_active")}
                disabled={saving}
              />
              <span>Компания активна (снятие — блокировка входа)</span>
            </label>
          </div>
          <div className="platform-admin__actions">
            <button
              type="submit"
              className="platform-admin__btn platform-admin__btn--primary"
              disabled={saving}
            >
              {saving ? "Сохранение…" : "Сохранить"}
            </button>
          </div>
        </form>
      )}

      {tab === "subscription" && (
        <SubscriptionPanel
          companyId={id}
          company={company}
          onUpdated={applyCompany}
        />
      )}

      {tab === "users" && (
        <CompanyUsersTab
          companyId={id}
          companyName={company?.name}
          branches={branches}
          customRoles={customRoles}
        />
      )}
    </div>
  );
};

export default CompanyDetail;
