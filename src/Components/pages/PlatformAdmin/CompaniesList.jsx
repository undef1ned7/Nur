import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { FaSearch } from "react-icons/fa";
import {
  fetchPlatformCompanies,
  fetchPlatformAdminMeta,
  isPlatformAdminUnavailable,
  pickPlatformAdminError,
} from "../../../api/platformAdmin";
import { getCompanySubscriptionStatus } from "../../../utils/companySubscription";
import "./PlatformAdmin.scss";

const asArray = (data) =>
  Array.isArray(data?.results) ? data.results : Array.isArray(data) ? data : [];

const statusLabel = (company) => {
  if (company?.is_active === false) return { text: "Заблокирована", tone: "danger" };
  const sub = getCompanySubscriptionStatus(company);
  if (sub.reason === "expired") return { text: "Истекла", tone: "warn" };
  if (sub.reason === "missing") return { text: "Без даты", tone: "muted" };
  if (sub.ok) return { text: "Активна", tone: "ok" };
  return { text: "—", tone: "muted" };
};

const CompaniesList = () => {
  const [items, setItems] = useState([]);
  const [count, setCount] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [sector, setSector] = useState("");
  const [plan, setPlan] = useState("");
  const [status, setStatus] = useState("");
  const [meta, setMeta] = useState({ sectors: [], plans: [] });
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);
  const [error, setError] = useState("");
  const pageSize = 20;

  const loadMeta = useCallback(async () => {
    try {
      const data = await fetchPlatformAdminMeta();
      setMeta({
        sectors: asArray(data?.sectors ?? data?.industries),
        plans: asArray(data?.plans ?? data?.subscription_plans),
      });
    } catch {
      /* meta optional until backend ready */
    }
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    setUnavailable(false);
    try {
      const params = {
        page,
        page_size: pageSize,
      };
      if (search) params.search = search;
      if (sector) params.sector = sector;
      if (plan) params.plan = plan;
      if (status) params.status = status;

      const data = await fetchPlatformCompanies(params);
      const list = asArray(data);
      setItems(list);
      setCount(typeof data?.count === "number" ? data.count : list.length);
    } catch (err) {
      if (isPlatformAdminUnavailable(err)) {
        setUnavailable(true);
        setItems([]);
        setCount(0);
      } else {
        setError(pickPlatformAdminError(err, "Не удалось загрузить компании"));
      }
    } finally {
      setLoading(false);
    }
  }, [page, search, sector, plan, status]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadMeta();
    }, 0);
    return () => clearTimeout(timer);
  }, [loadMeta]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void load();
    }, 0);
    return () => clearTimeout(timer);
  }, [load]);

  const totalPages = Math.max(1, Math.ceil(count / pageSize));

  const onSearchSubmit = (e) => {
    e.preventDefault();
    setPage(1);
    setSearch(searchInput.trim());
  };

  if (unavailable) {
    return (
      <div className="platform-admin__stub">
        <h2>Раздел подключается</h2>
        <p>
          API платформенной админки ещё не доступен на бэкенде. Как только
          эндпоинты появятся — список компаний подхватится автоматически.
        </p>
        <p className="platform-admin__hint">
          См. документацию: docs/platform-admin/
        </p>
      </div>
    );
  }

  return (
    <div className="platform-admin__page">
      <div className="platform-admin__toolbar">
        <form className="platform-admin__search" onSubmit={onSearchSubmit}>
          <FaSearch aria-hidden />
          <input
            type="search"
            placeholder="Поиск: название, ИНН, slug, email…"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
          <button type="submit" className="platform-admin__btn">
            Найти
          </button>
        </form>

        <div className="platform-admin__filters">
          <select
            value={sector}
            onChange={(e) => {
              setPage(1);
              setSector(e.target.value);
            }}
          >
            <option value="">Все секторы</option>
            {meta.sectors.map((s) => (
              <option key={s.id ?? s.slug ?? s.name} value={s.id ?? s.slug}>
                {s.name || s.title || s.slug}
              </option>
            ))}
          </select>
          <select
            value={plan}
            onChange={(e) => {
              setPage(1);
              setPlan(e.target.value);
            }}
          >
            <option value="">Все тарифы</option>
            {meta.plans.map((p) => (
              <option key={p.id ?? p.name} value={p.id ?? p.name}>
                {p.name || p.title}
              </option>
            ))}
          </select>
          <select
            value={status}
            onChange={(e) => {
              setPage(1);
              setStatus(e.target.value);
            }}
          >
            <option value="">Любой статус</option>
            <option value="active">Активна</option>
            <option value="expired">Истекла</option>
            <option value="blocked">Заблокирована</option>
            <option value="missing_date">Без даты</option>
          </select>
        </div>
      </div>

      {error && <div className="platform-admin__alert">{error}</div>}

      <div className="platform-admin__table-wrap">
        <table className="platform-admin__table">
          <thead>
            <tr>
              <th>Компания</th>
              <th>Slug</th>
              <th>ИНН</th>
              <th>Сектор</th>
              <th>Тариф</th>
              <th>До</th>
              <th>Статус</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7}>Загрузка…</td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={7}>Компании не найдены</td>
              </tr>
            ) : (
              items.map((c) => {
                const st = statusLabel(c);
                return (
                  <tr key={c.id}>
                    <td>
                      <Link
                        to={`/platform-admin/companies/${c.id}`}
                        className="platform-admin__link"
                      >
                        {c.name || `Компания #${c.id}`}
                      </Link>
                    </td>
                    <td>
                      <code>{c.slug || "—"}</code>
                    </td>
                    <td>{c.inn || "—"}</td>
                    <td>{c.sector?.name || c.sector_name || "—"}</td>
                    <td>
                      {c.subscription_plan?.name ||
                        c.subscription_plan_name ||
                        "—"}
                    </td>
                    <td>{c.end_date || "—"}</td>
                    <td>
                      <span
                        className={`platform-admin__badge platform-admin__badge--${st.tone}`}
                      >
                        {st.text}
                      </span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {count > pageSize && (
        <div className="platform-admin__pager">
          <button
            type="button"
            className="platform-admin__btn platform-admin__btn--ghost"
            disabled={page <= 1 || loading}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            Назад
          </button>
          <span>
            Стр. {page} / {totalPages} ({count})
          </span>
          <button
            type="button"
            className="platform-admin__btn platform-admin__btn--ghost"
            disabled={page >= totalPages || loading}
            onClick={() => setPage((p) => p + 1)}
          >
            Вперёд
          </button>
        </div>
      )}
    </div>
  );
};

export default CompaniesList;
