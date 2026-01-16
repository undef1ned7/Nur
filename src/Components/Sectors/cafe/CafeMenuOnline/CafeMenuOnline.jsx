import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { FaSearch, FaUtensils } from "react-icons/fa";
import api from "../../../../api";
import "./CafeMenuOnline.scss";

/* ===== helpers ===== */
const asArray = (d) => (Array.isArray(d?.results) ? d.results : Array.isArray(d) ? d : []);
const toNum = (v) => {
  if (v == null) return 0;
  const n = Number(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};

const fmtPrice = (v) =>
  new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 }).format(toNum(v)) + " ₽";

const normStr = (s) => String(s || "").trim();

const PLACEHOLDER_IMG =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(`
  <svg xmlns="http://www.w3.org/2000/svg" width="1200" height="700">
    <defs>
      <linearGradient id="g" x1="0" x2="1">
        <stop stop-color="#f3f4f6" offset="0"/>
        <stop stop-color="#e5e7eb" offset="1"/>
      </linearGradient>
    </defs>
    <rect width="1200" height="700" fill="url(#g)"/>
    <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle"
      font-family="Arial" font-size="40" fill="#6b7280">
      Старое фото недоступно
    </text>
  </svg>
`);

/* DRF pagination fetch-all */
async function fetchAll(url0) {
  const out = [];
  let url = url0;

  for (let guard = 0; guard < 30 && url; guard += 1) {
    // eslint-disable-next-line no-await-in-loop
    const r = await api.get(url);
    const data = r?.data;
    const chunk = Array.isArray(data?.results) ? data.results : Array.isArray(data) ? data : [];
    out.push(...chunk);
    url = data?.next || null;
  }

  return out;
}

const CafeMenuOnline = () => {
  const { company_slug } = useParams();

  const [cafe, setCafe] = useState(null);
  const [categories, setCategories] = useState([]);
  const [items, setItems] = useState([]);

  const [activeCatId, setActiveCatId] = useState("all");
  const [q, setQ] = useState("");

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setErr("");

    try {
      const slug = normStr(company_slug);
      if (!slug) {
        setErr("Не указан slug компании.");
        setLoading(false);
        return;
      }

      const cafeUrl = `/cafe/public/cafe/${slug}/`;
      const menuUrl = `/cafe/public/cafe/${slug}/menu/`;
      const itemsUrl = `/cafe/public/cafe/${slug}/menu-items/`;

      const [cafeRes, menuRes] = await Promise.all([api.get(cafeUrl), api.get(menuUrl)]);

      const catList = asArray(menuRes?.data);
      setCafe(cafeRes?.data || null);
      setCategories(catList || []);

      const allItems = await fetchAll(itemsUrl);
      setItems(Array.isArray(allItems) ? allItems : []);
    } catch (e) {
      console.error("Ошибка загрузки публичного меню:", e);
      setErr("Не удалось загрузить меню. Проверь slug и доступность API.");
      setCafe(null);
      setCategories([]);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [company_slug]);

  useEffect(() => {
    load();
  }, [load]);

  // If /menu/ already contains items array inside categories — we can use it as richer source
  const itemsFromMenu = useMemo(() => {
    const out = [];
    for (const c of categories || []) {
      if (Array.isArray(c?.items)) out.push(...c.items);
    }
    const seen = new Set();
    return out.filter((x) => {
      const id = x?.id;
      if (!id || seen.has(id)) return false;
      seen.add(id);
      return true;
    });
  }, [categories]);

  const effectiveItems = useMemo(() => {
    return itemsFromMenu.length ? itemsFromMenu : items;
  }, [itemsFromMenu, items]);

  const normalizedQuery = useMemo(() => normStr(q).toLowerCase(), [q]);

  const filtered = useMemo(() => {
    const list = Array.isArray(effectiveItems) ? effectiveItems : [];

    return list
      .filter((it) => (it?.is_active === false ? false : true))
      .filter((it) => {
        if (activeCatId === "all") return true;
        const cid = it?.category?.id ?? it?.category;
        return String(cid || "") === String(activeCatId);
      })
      .filter((it) => {
        if (!normalizedQuery) return true;
        const title = String(it?.title || "").toLowerCase();
        const cat = String(it?.category_title || "").toLowerCase();
        const kitchen = String(it?.kitchen_title || "").toLowerCase();
        return title.includes(normalizedQuery) || cat.includes(normalizedQuery) || kitchen.includes(normalizedQuery);
      });
  }, [effectiveItems, activeCatId, normalizedQuery]);

  const activeTitle = useMemo(() => {
    if (activeCatId === "all") return "Все блюда";
    const c = (categories || []).find((x) => String(x?.id) === String(activeCatId));
    return c?.title || "Категория";
  }, [activeCatId, categories]);

  return (
    <section className="cafemenueonline">
      <div className="cafemenueonline__wrap">
        <header className="cafemenueonline__header">
          <div className="cafemenueonline__titleRow">
            <div className="cafemenueonline__titleLeft">
              <div className="cafemenueonline__icon" aria-hidden="true">
                <FaUtensils />
              </div>
              <div>
                <h1 className="cafemenueonline__title">Меню</h1>
                {cafe?.name ? <div className="cafemenueonline__subtitle">{cafe.name}</div> : null}
              </div>
            </div>
          </div>

          <div className="cafemenueonline__search">
            <FaSearch className="cafemenueonline__searchIcon" aria-hidden="true" />
            <input
              className="cafemenueonline__searchInput"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Поиск блюд..."
              autoComplete="off"
            />
          </div>
        </header>

        <div className="cafemenueonline__divider" />

        <nav className="cafemenueonline__tabs" aria-label="Категории меню">
          <button
            type="button"
            className={`cafemenueonline__tab ${activeCatId === "all" ? "cafemenueonline__tab--active" : ""}`}
            onClick={() => setActiveCatId("all")}
          >
            Все блюда
          </button>

          {(categories || []).map((c) => (
            <button
              key={c?.id}
              type="button"
              className={`cafemenueonline__tab ${String(activeCatId) === String(c?.id) ? "cafemenueonline__tab--active" : ""}`}
              onClick={() => setActiveCatId(c?.id)}
              title={c?.title || ""}
            >
              {c?.title || "—"}
            </button>
          ))}
        </nav>

        {err ? (
          <div className="cafemenueonline__error">
            <div className="cafemenueonline__errorTitle">Ошибка</div>
            <div className="cafemenueonline__errorText">{err}</div>
          </div>
        ) : null}

        <div className="cafemenueonline__content">
          <div className="cafemenueonline__hint">
            <span className="cafemenueonline__hintTitle">{activeTitle}</span>
            <span className="cafemenueonline__hintCount">{filtered.length} поз.</span>
          </div>

          {loading ? (
            <div className="cafemenueonline__grid">
              {Array.from({ length: 6 }).map((_, i) => (
                <div className="cafemenueonline__card cafemenueonline__card--skeleton" key={i}>
                  <div className="cafemenueonline__img cafemenueonline__img--skeleton" />
                  <div className="cafemenueonline__cardBody">
                    <div className="cafemenueonline__skLine cafemenueonline__skLine--w60" />
                    <div className="cafemenueonline__skLine cafemenueonline__skLine--w40" />
                    <div className="cafemenueonline__skLine cafemenueonline__skLine--w30" />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="cafemenueonline__grid">
              {filtered.map((it) => {
                const cid = it?.category?.id ?? it?.category;
                const catTitle =
                  it?.category_title ||
                  (categories || []).find((x) => String(x?.id) === String(cid))?.title ||
                  "";
                const img = it?.image_url || it?.image || PLACEHOLDER_IMG;

                return (
                  <article key={it?.id} className="cafemenueonline__card" title={it?.title || ""}>
                    <div className="cafemenueonline__imgWrap">
                      <img
                        className="cafemenueonline__img"
                        src={img}
                        alt={it?.title ? `Фото: ${it.title}` : "Фото блюда"}
                        loading="lazy"
                        onError={(e) => {
                          e.currentTarget.src = PLACEHOLDER_IMG;
                        }}
                      />
                    </div>

                    <div className="cafemenueonline__cardBody">
                      <div className="cafemenueonline__rowTop">
                        <div className="cafemenueonline__name">{it?.title || "—"}</div>
                        {catTitle ? <span className="cafemenueonline__badge">{catTitle}</span> : null}
                      </div>

                      <div className="cafemenueonline__priceRow">
                        <div className="cafemenueonline__price">{fmtPrice(it?.price)}</div>
                      </div>
                    </div>
                  </article>
                );
              })}

              {!filtered.length && !err ? (
                <div className="cafemenueonline__empty">
                  <div className="cafemenueonline__emptyTitle">Ничего не найдено</div>
                  <div className="cafemenueonline__emptyText">Поменяй категорию или очисти поиск.</div>
                </div>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </section>
  );
};

export default CafeMenuOnline;
