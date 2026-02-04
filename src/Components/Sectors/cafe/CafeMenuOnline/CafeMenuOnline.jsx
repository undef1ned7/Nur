import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { FaSearch, FaUtensils } from "react-icons/fa";
import api from "../../../../api";
import { useDebouncedValue } from "../../../../hooks/useDebounce";
import "./CafeMenuOnline.scss";

/* ===== helpers ===== */
const asArray = (d) =>
  Array.isArray(d?.results) ? d.results : Array.isArray(d) ? d : [];
const toNum = (v) => {
  if (v == null) return 0;
  const n = Number(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};

const fmtPrice = (v) =>
  new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 }).format(
    toNum(v)
  ) + " ₽";

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

const PAGE_SIZE = 12;

const CafeMenuOnline = () => {
  const { company_slug } = useParams();

  const [cafe, setCafe] = useState(null);
  const [categories, setCategories] = useState([]);
  const [items, setItems] = useState([]);
  const [totalCount, setTotalCount] = useState(0);

  const [activeCatId, setActiveCatId] = useState("all");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);

  const debouncedSearch = useDebouncedValue(normStr(q), 400);

  const [loading, setLoading] = useState(true);
  const [loadingItems, setLoadingItems] = useState(false);
  const [err, setErr] = useState("");

  const slug = normStr(company_slug);

  const loadCafeAndCategories = useCallback(async () => {
    setLoading(true);
    setErr("");
    try {
      if (!slug) {
        setErr("Не указан slug компании.");
        setLoading(false);
        return;
      }
      const cafeUrl = `/cafe/public/cafe/${slug}/`;
      const menuUrl = `/cafe/public/cafe/${slug}/menu/`;
      const [cafeRes, menuRes] = await Promise.all([
        api.get(cafeUrl),
        api.get(menuUrl),
      ]);
      const catList = asArray(menuRes?.data);
      setCafe(cafeRes?.data || null);
      setCategories(catList || []);
    } catch (e) {
      console.error("Ошибка загрузки публичного меню:", e);
      setErr("Не удалось загрузить меню. Проверь slug и доступность API.");
      setCafe(null);
      setCategories([]);
    } finally {
      setLoading(false);
    }
  }, [slug]);

  const loadItems = useCallback(
    async (searchTerm, categoryId, pageNum) => {
      if (!slug) return;
      setLoadingItems(true);
      try {
        const params = {
          page: pageNum,
          page_size: PAGE_SIZE,
          ...(searchTerm ? { search: searchTerm } : {}),
          ...(categoryId && categoryId !== "all" ? { category: categoryId } : {}),
        };
        const itemsUrl = `/cafe/public/cafe/${slug}/menu-items/`;
        const r = await api.get(itemsUrl, { params });
        const data = r?.data || {};
        const list = Array.isArray(data?.results) ? data.results : Array.isArray(data) ? data : [];
        setItems(list);
        const count =
          typeof data?.count === "number"
            ? data.count
            : Array.isArray(data?.results)
            ? (data?.count ?? list.length)
            : list.length;
        setTotalCount(count);
      } catch (e) {
        console.error("Ошибка загрузки пунктов меню:", e);
        setItems([]);
        setTotalCount(0);
      } finally {
        setLoadingItems(false);
      }
    },
    [slug]
  );

  useEffect(() => {
    loadCafeAndCategories();
  }, [loadCafeAndCategories]);

  useEffect(() => {
    if (!slug) return;
    setPage(1);
    loadItems(debouncedSearch, activeCatId, 1);
  }, [slug, debouncedSearch, activeCatId, loadItems]);

  useEffect(() => {
    if (!slug || page === 1) return;
    loadItems(debouncedSearch, activeCatId, page);
  }, [page, slug, debouncedSearch, activeCatId, loadItems]);

  const pageCount = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount) || 1;
  const pageItems = items;

  const activeTitle = useMemo(() => {
    if (activeCatId === "all") return "Все блюда";
    const c = (categories || []).find(
      (x) => String(x?.id) === String(activeCatId)
    );
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
                {cafe?.name ? (
                  <div className="cafemenueonline__subtitle">{cafe.name}</div>
                ) : null}
              </div>
            </div>
          </div>

          <div className="cafemenueonline__search">
            <FaSearch
              className="cafemenueonline__searchIcon"
              aria-hidden="true"
            />
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
            className={`cafemenueonline__tab ${
              activeCatId === "all" ? "cafemenueonline__tab--active" : ""
            }`}
            onClick={() => setActiveCatId("all")}
          >
            Все блюда
          </button>

          {(categories || []).map((c) => (
            <button
              key={c?.id}
              type="button"
              className={`cafemenueonline__tab ${
                String(activeCatId) === String(c?.id)
                  ? "cafemenueonline__tab--active"
                  : ""
              }`}
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
            <span className="cafemenueonline__hintCount">
              {totalCount} поз.
            </span>
          </div>

          {loading || loadingItems ? (
            <div className="cafemenueonline__grid">
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  className="cafemenueonline__card cafemenueonline__card--skeleton"
                  key={i}
                >
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
            <>
              <div className="cafemenueonline__grid">
                {pageItems.map((it) => {
                  const cid = it?.category?.id ?? it?.category;
                  const catTitle =
                    it?.category_title ||
                    (categories || []).find(
                      (x) => String(x?.id) === String(cid)
                    )?.title ||
                    "";
                  const img = it?.image_url || it?.image || PLACEHOLDER_IMG;

                  return (
                    <article
                      key={it?.id}
                      className="cafemenueonline__card"
                      title={it?.title || ""}
                    >
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
                          <div className="cafemenueonline__name">
                            {it?.title || "—"}
                          </div>
                          {catTitle ? (
                            <span className="cafemenueonline__badge">
                              {catTitle}
                            </span>
                          ) : null}
                        </div>

                        <div className="cafemenueonline__priceRow">
                          <div className="cafemenueonline__price">
                            {fmtPrice(it?.price)}
                          </div>
                        </div>
                      </div>
                    </article>
                  );
                })}

                {!items.length && !err && !loadingItems ? (
                  <div className="cafemenueonline__empty">
                    <div className="cafemenueonline__emptyTitle">
                      Ничего не найдено
                    </div>
                    <div className="cafemenueonline__emptyText">
                      Поменяй категорию или очисти поиск.
                    </div>
                  </div>
                ) : null}
              </div>

              {pageCount > 1 && (
                <div
                  className="cafemenueonline__pagination"
                  aria-label="Пагинация меню"
                >
                  <button
                    type="button"
                    className="cafemenueonline__pageBtn"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                  >
                    Назад
                  </button>
                  <span className="cafemenueonline__pageInfo">
                    Страница {currentPage} из {pageCount}
                  </span>
                  <button
                    type="button"
                    className="cafemenueonline__pageBtn"
                    onClick={() => setPage((p) => (p < pageCount ? p + 1 : p))}
                    disabled={currentPage === pageCount}
                  >
                    Вперёд
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </section>
  );
};

export default CafeMenuOnline;
