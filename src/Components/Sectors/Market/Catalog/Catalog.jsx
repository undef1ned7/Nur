import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { FaSearch, FaShoppingCart, FaTimes, FaTrash, FaMinus, FaPlus, FaStar, FaTag, FaInfoCircle, FaChevronLeft, FaChevronRight } from "react-icons/fa";
import api from "../../../../api";
import "./Catalog.scss";

/* =======================
   helpers
======================= */
const listFrom = (res) => res?.data?.results || res?.data || [];

const toNum = (v) => {
  const n = typeof v === "string" ? Number(v.replace(",", ".")) : Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
};

const money = (v) => {
  const n = Number(v);
  if (!Number.isFinite(n)) return "0";
  return n.toLocaleString("ru-RU");
};

const normalizePhoneForWa = (raw) => String(raw || "").trim().replace(/[^\d]/g, "");

const buildWaLink = (phoneDigits, text) => {
  const p = String(phoneDigits || "").trim();
  if (!p) return "";
  return `https://wa.me/${p}?text=${encodeURIComponent(text)}`;
};

const getShowcasePhoneRaw = (company) => {
  if (!company || typeof company !== "object") return "";
  return (
    company.phones_howcase ||
    company.phone_showcase ||
    company.phones_showcase ||
    company.phoneShowcase ||
    ""
  );
};

const getQuery = (search) => {
  const sp = new URLSearchParams(search);
  return {
    q: sp.get("q") || "",
    category: sp.get("category") || "",
    page: sp.get("page") || "1",
  };
};

const PAGE_SIZE = 100;

const setQuery = (locationSearch, patch) => {
  const sp = new URLSearchParams(locationSearch);
  Object.entries(patch || {}).forEach(([k, v]) => {
    if (v === null || v === undefined || v === "") sp.delete(k);
    else sp.set(k, String(v));
  });
  const q = sp.toString();
  return q ? `?${q}` : "";
};

const fallbackSvg = encodeURIComponent(`
  <svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800">
    <rect width="100%" height="100%" fill="#f3f4f6"/>
    <rect x="60" y="60" width="1080" height="680" rx="28" fill="#ffffff" stroke="#e5e7eb"/>
    <text x="50%" y="50%" font-family="Arial" font-size="54" fill="#6b7280" text-anchor="middle" dominant-baseline="middle">
      Фото нет
    </text>
  </svg>
`);
const FALLBACK_IMG = `data:image/svg+xml;charset=utf-8,${fallbackSvg}`;

/* =======================
   UI: QtyStepper
======================= */
const QtyStepper = ({ value, onMinus, onPlus, disabled = false }) => {
  return (
    <div className={`qty ${disabled ? "qty--disabled" : ""}`}>
      <button type="button" className="qty__btn" onClick={onMinus} disabled={disabled} aria-label="Minus">
        <FaMinus />
      </button>
      <div className="qty__val">{value}</div>
      <button type="button" className="qty__btn" onClick={onPlus} disabled={disabled} aria-label="Plus">
        <FaPlus />
      </button>
    </div>
  );
};

/* =======================
   Product Card
======================= */
const ShowcaseCard = ({ item, onAdd, onOpen }) => {
  const title = String(item?.name || item?.title || "Без названия");
  const cat = String(item?.category_title || "").toUpperCase();
  const price = toNum(item?.final_price ?? item?.price);
  const hasDiscount = item?.discount_percent && Number(item.discount_percent) > 0;
  const originalPrice = item?.price && item?.final_price && Number(item.price) !== Number(item.final_price) ? toNum(item.price) : null;

  return (
    <article className="sfcard">
      <button type="button" className="sfcard__media" onClick={() => onOpen?.(item?.id)} aria-label="Open product">
        <img
          className="sfcard__img"
          src={item?.image_url || FALLBACK_IMG}
          alt={title}
          loading="lazy"
          onError={(e) => {
            if (e?.currentTarget?.src !== FALLBACK_IMG) e.currentTarget.src = FALLBACK_IMG;
          }}
        />
        <div className="sfcard__priceTag">
          {money(price)} сом
        </div>
        {hasDiscount && (
          <div className="sfcard__discount">
            <FaTag /> -{Math.round(Number(item.discount_percent) || 0)}%
          </div>
        )}
        {item?.is_new && (
          <div className="sfcard__badge">
            <FaStar /> Новинка
          </div>
        )}
      </button>

      <div className="sfcard__body">
        {cat ? (
          <div className="sfcard__meta">
            <FaTag /> {cat}
          </div>
        ) : (
          <div className="sfcard__meta">{"\u00A0"}</div>
        )}
        <div className="sfcard__title" title={title}>
          {title}
        </div>
        {originalPrice && originalPrice > price && (
          <div className="sfcard__oldPrice">
            <span className="sfcard__oldPriceValue">{money(originalPrice)} сом</span>
          </div>
        )}

        <button type="button" className="sfcard__cta" onClick={() => onAdd?.(item, 1)}>
          <span className="sfcard__ctaPlus">+</span>
          <span>В корзину</span>
        </button>
      </div>
    </article>
  );
};

/* =======================
   Product Modal
======================= */
const ShowcaseModal = ({ open, slug, productId, onClose, onAdd }) => {
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [data, setData] = useState(null);

  useEffect(() => {
    if (!open || !slug || !productId) return;

    let alive = true;
    setLoading(true);
    setErr("");
    setData(null);

    api
      .get(`/main/public/companies/${encodeURIComponent(slug)}/showcase/${encodeURIComponent(productId)}/`)
      .then((res) => {
        if (!alive) return;
        setData(res?.data || null);
      })
      .catch((e) => {
        if (!alive) return;
        console.error(e);
        setErr("Не удалось загрузить товар.");
      })
      .finally(() => {
        if (!alive) return;
        setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [open, slug, productId]);

  const title = String(data?.name || data?.title || "Товар");
  const price = toNum(data?.final_price ?? data?.price);
  const cat = String(data?.category_title || "").toUpperCase();

  const charsRu = useMemo(() => {
    const c = data?.characteristics;
    const out = [];

    const pushIf = (label, value) => {
      const s = String(value ?? "").trim();
      if (!s) return;
      out.push(`${label}: ${s}`);
    };

    if (c && typeof c === "object" && !Array.isArray(c)) {
      pushIf("Высота, см", c.height_cm);
      pushIf("Ширина, см", c.width_cm);
      pushIf("Глубина, см", c.depth_cm);
      pushIf("Вес, кг", c.factual_weight_kg);
      pushIf("Примечание", c.description);
    }

    return out;
  }, [data]);

  if (!open) return null;

  return (
    <div className="sfmodal" role="dialog" aria-modal="true">
      <button type="button" className="sfmodal__backdrop" onClick={onClose} aria-label="Close" />

      <div className="sfmodal__panel">
        <div className="sfmodal__top">
          <div className="sfmodal__ghost" />
          <button type="button" className="sfmodal__x" onClick={onClose} aria-label="Close">
            <FaTimes />
          </button>
        </div>

        <div className="sfmodal__body">
          {loading && <div className="sfmodal__info">Загрузка...</div>}
          {!loading && err && <div className="sfmodal__error">{err}</div>}

          {!loading && !err && data && (
            <div className="sfmodal__grid">
              <div className="sfmodal__left">
                <div className="sfmodal__imgBox">
                  <img
                    className="sfmodal__img"
                    src={data?.image_url || FALLBACK_IMG}
                    alt={title}
                    loading="lazy"
                    onError={(e) => {
                      if (e?.currentTarget?.src !== FALLBACK_IMG) e.currentTarget.src = FALLBACK_IMG;
                    }}
                  />
                </div>
              </div>

              <div className="sfmodal__right">
                <div className="sfmodal__header">
                  {cat ? (
                    <div className="sfmodal__pill">
                      <FaTag /> {cat}
                    </div>
                  ) : null}
                  {data?.is_new && (
                    <div className="sfmodal__newBadge">
                      <FaStar /> Новинка
                    </div>
                  )}
                </div>
                <div className="sfmodal__title">{title}</div>
                <div className="sfmodal__priceRow">
                  <div className="sfmodal__price">{money(price)} сом</div>
                  {data?.price && data?.final_price && Number(data.price) !== Number(data.final_price) && (
                    <div className="sfmodal__oldPrice">{money(toNum(data.price))} сом</div>
                  )}
                </div>

                {data?.description ? (
                  <div className="sfmodal__desc">
                    <FaInfoCircle /> {String(data.description)}
                  </div>
                ) : null}

                {charsRu.length > 0 ? (
                  <div className="sfmodal__block">
                    <div className="sfmodal__blockTitle">
                      <FaInfoCircle /> Характеристики:
                    </div>
                    <ul className="sfmodal__list">
                      {charsRu.map((b, i) => (
                        <li key={`${b}-${i}`}>{b}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                <button type="button" className="sfmodal__cta" onClick={() => onAdd?.(data, 1)}>
                  <span className="sfmodal__ctaPlus">+</span>
                  <span>Добавить в корзину</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

/* =======================
   Cart Drawer (right)
======================= */
const SideCart = ({
  open,
  onClose,
  lines,
  total,
  clientPhone,
  onChangeClientPhone,
  onInc,
  onDec,
  onRemove,
  onCheckout,
  canCheckout,
  checkoutHint,
}) => {
  if (!open) return null;

  return (
    <div className="sfdrawer" role="dialog" aria-modal="true">
      <button type="button" className="sfdrawer__backdrop" onClick={onClose} aria-label="Close" />

      <div className="sfdrawer__panel">
        <div className="sfdrawer__head">
          <div className="sfdrawer__title">
            <FaShoppingCart />
            <span>Корзина</span>
            <span className="sfdrawer__badge">{lines.length}</span>
          </div>

          <button type="button" className="sfdrawer__close" onClick={onClose} aria-label="Close">
            <FaTimes />
          </button>
        </div>

        <div className="sfdrawer__body">
          {lines.length === 0 ? (
            <div className="sfdrawer__empty">Корзина пустая.</div>
          ) : (
            <div className="sfdrawer__list">
              {lines.map((ln) => (
                <div key={ln.id} className="sfdrawer__item">
                  <img
                    className="sfdrawer__thumb"
                    src={ln.image_url || FALLBACK_IMG}
                    alt={ln.name}
                    loading="lazy"
                    onError={(e) => {
                      if (e?.currentTarget?.src !== FALLBACK_IMG) e.currentTarget.src = FALLBACK_IMG;
                    }}
                  />

                  <div className="sfdrawer__info">
                    <div className="sfdrawer__name" title={ln.name}>
                      {ln.name}
                    </div>

                    <div className="sfdrawer__price">{money(ln.price)} сом</div>

                    <div className="sfdrawer__controls">
                      <QtyStepper value={ln.qty} onMinus={() => onDec(ln.id)} onPlus={() => onInc(ln.id)} />
                      <button type="button" className="sfdrawer__trash" onClick={() => onRemove(ln.id)} aria-label="Remove">
                        <FaTrash />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="sfdrawer__foot">
          <div className="sfdrawer__field">
            <div className="sfdrawer__label">Номер клиента</div>
            <input
              className="sfdrawer__input"
              value={clientPhone}
              onChange={(e) => onChangeClientPhone(e.target.value)}
              placeholder="+996..."
              inputMode="tel"
            />
          </div>

          <div className="sfdrawer__total">
            <div className="sfdrawer__totalKey">Итого:</div>
            <div className="sfdrawer__totalVal">{money(total)} сом</div>
          </div>

          {checkoutHint ? <div className="sfdrawer__hint">{checkoutHint}</div> : null}

          <button
            type="button"
            className="sfdrawer__btn"
            onClick={onCheckout}
            disabled={!canCheckout}
            title={!canCheckout ? "Заполни номер клиента и проверь номер витрины" : "Открыть WhatsApp"}
          >
            Оформить заказ
          </button>
        </div>
      </div>
    </div>
  );
};

/* =======================
   Page: Catalog
======================= */
const Catalog = () => {
  const { slug = "" } = useParams();
  const location = useLocation();
  const navigate = useNavigate();

  const qState = useMemo(() => getQuery(location.search), [location.search]);

  const [company, setCompany] = useState(null);
  const [companyErr, setCompanyErr] = useState("");
  const [companyLoading, setCompanyLoading] = useState(false);

  const [items, setItems] = useState([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const [cartOpen, setCartOpen] = useState(false);
  const [productOpen, setProductOpen] = useState(false);
  const [activeProductId, setActiveProductId] = useState("");

  const storageKey = useMemo(() => `public_cart_${String(slug || "").trim()}`, [slug]);
  const [cart, setCart] = useState({});
  const [clientPhone, setClientPhone] = useState("");

  /* restore cart */
  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") {
        setCart(parsed.cart && typeof parsed.cart === "object" ? parsed.cart : {});
        setClientPhone(typeof parsed.clientPhone === "string" ? parsed.clientPhone : "");
      }
    } catch {
      // ignore
    }
  }, [storageKey]);

  /* persist cart */
  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify({ cart, clientPhone }));
    } catch {
      // ignore
    }
  }, [storageKey, cart, clientPhone]);

  const lines = useMemo(() => Object.values(cart || {}).filter((x) => toNum(x.qty) > 0), [cart]);
  const total = useMemo(() => lines.reduce((s, x) => s + toNum(x.qty) * toNum(x.price), 0), [lines]);
  const cartCount = useMemo(() => lines.reduce((s, x) => s + toNum(x.qty), 0), [lines]);

  const setQS = useCallback(
    (patch) => {
      const next = setQuery(location.search, patch);
      navigate({ pathname: location.pathname, search: next }, { replace: true });
    },
    [location.pathname, location.search, navigate]
  );

  /* load company + phones_howcase */
  useEffect(() => {
    if (!slug) return;

    let alive = true;
    setCompanyLoading(true);
    setCompanyErr("");

    api
      .get(`/main/public/companies/${encodeURIComponent(slug)}/`)
      .then((res) => {
        if (!alive) return;
        setCompany(res?.data || null);
      })
      .catch((e) => {
        if (!alive) return;
        console.error(e);
        const status = e?.response?.status;
        if (status === 404) setCompanyErr("Компания не найдена (404). Проверь slug.");
        else if (status) setCompanyErr(`Ошибка загрузки компании (${status}).`);
        else setCompanyErr("Ошибка загрузки компании (проверь baseURL / CORS).");
        setCompany(null);
      })
      .finally(() => {
        if (!alive) return;
        setCompanyLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [slug]);

  /* fetch showcase */
  useEffect(() => {
    if (!slug) return;

    let alive = true;
    setLoading(true);
    setErr("");

    const paramsQ = { page_size: PAGE_SIZE };
    const pageNum = Math.max(1, parseInt(qState.page, 10) || 1);
    paramsQ.page = pageNum;
    if (qState.category) paramsQ.category = qState.category;
    if (qState.q) paramsQ.search = qState.q;

    api
      .get(`/main/public/companies/${encodeURIComponent(slug)}/showcase/`, { params: paramsQ })
      .then((res) => {
        if (!alive) return;
        const data = res?.data || {};
        const arr = listFrom(res);
        const safeArr = Array.isArray(arr) ? arr : [];
        setItems(safeArr);
        setCount(Number.isFinite(Number(data.count)) ? Number(data.count) : safeArr.length);
      })
      .catch((e) => {
        if (!alive) return;
        console.error(e);
        setItems([]);
        setCount(0);
        const status = e?.response?.status;
        if (status === 404) setErr("Витрина не найдена (404). Проверь путь API.");
        else if (status) setErr(`Не удалось загрузить витрину (${status}).`);
        else setErr("Не удалось загрузить витрину (проверь baseURL / CORS).");
      })
      .finally(() => {
        if (!alive) return;
        setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [slug, qState.category, qState.q, qState.page]);

  /* categories: из текущих items (для пустого фильтра — полный список) */
  const categoriesFromItems = useMemo(() => {
    const map = new Map();
    (items || []).forEach((p) => {
      if (!p?.category || !p?.category_title) return;
      map.set(String(p.category), { id: String(p.category), title: String(p.category_title) });
    });
    return Array.from(map.values()).sort((a, b) => a.title.localeCompare(b.title));
  }, [items]);

  /* храним полный список категорий, чтобы при выборе одной остальные не пропадали */
  const [allCategories, setAllCategories] = useState([]);
  useEffect(() => {
    if (!qState.category && !qState.q && categoriesFromItems.length > 0) {
      setAllCategories(categoriesFromItems);
    }
  }, [qState.category, qState.q, categoriesFromItems]);

  const categories = allCategories.length > 0 ? allCategories : categoriesFromItems;

  const totalPages = Math.max(1, Math.ceil(count / PAGE_SIZE));
  const currentPage = Math.max(1, Math.min(parseInt(qState.page, 10) || 1, totalPages));

  const goToPage = useCallback(
    (pageNum) => {
      const p = Math.max(1, Math.min(Number(pageNum), totalPages));
      setQS({ page: p === 1 ? "" : String(p) });
    },
    [totalPages, setQS]
  );

  const brandTitle = company?.name || (companyLoading ? "Загрузка..." : "TechStore");

  /* cart ops */
  const addToCart = useCallback((item, delta = 1) => {
    const id = String(item?.id || "");
    if (!id) return;

    const title = String(item?.name || item?.title || "Без названия");
    const price = toNum(item?.final_price ?? item?.price);

    setCart((prev) => {
      const next = { ...(prev || {}) };
      const prevQty = toNum(next[id]?.qty);
      const qty = Math.max(0, prevQty + toNum(delta));

      if (qty <= 0) {
        delete next[id];
        return next;
      }

      next[id] = {
        id,
        name: title,
        price,
        qty,
        image_url: item?.image_url || "",
      };
      return next;
    });
  }, []);

  const inc = useCallback((id) => {
    setCart((prev) => {
      const key = String(id || "");
      const next = { ...(prev || {}) };
      if (!next[key]) return next;
      next[key] = { ...next[key], qty: Math.min(999, toNum(next[key].qty) + 1) };
      return next;
    });
  }, []);

  const dec = useCallback((id) => {
    setCart((prev) => {
      const key = String(id || "");
      const next = { ...(prev || {}) };
      if (!next[key]) return next;

      const qty = toNum(next[key].qty) - 1;
      if (qty <= 0) {
        delete next[key];
        return next;
      }

      next[key] = { ...next[key], qty };
      return next;
    });
  }, []);

  const remove = useCallback((id) => {
    setCart((prev) => {
      const key = String(id || "");
      const next = { ...(prev || {}) };
      delete next[key];
      return next;
    });
  }, []);

  /* modal open/close */
  const openProduct = useCallback((id) => {
    setActiveProductId(String(id || ""));
    setProductOpen(true);
  }, []);

  const closeProduct = useCallback(() => {
    setProductOpen(false);
    setActiveProductId("");
  }, []);

  /* WhatsApp checkout */
  const showcasePhoneRaw = useMemo(() => getShowcasePhoneRaw(company), [company]);
  const phoneShowcaseDigits = useMemo(() => normalizePhoneForWa(showcasePhoneRaw), [showcasePhoneRaw]);

  const checkoutHint = useMemo(() => {
    if (lines.length === 0) return "";
    if (!showcasePhoneRaw) return "WhatsApp недоступен: у компании нет phones_howcase.";
    if (!phoneShowcaseDigits) return "WhatsApp недоступен: неверный номер витрины.";
    if (!String(clientPhone || "").trim()) return "Укажи номер клиента.";
    return "";
  }, [lines.length, showcasePhoneRaw, phoneShowcaseDigits, clientPhone]);

  const canCheckout = useMemo(() => {
    if (lines.length === 0) return false;
    if (!phoneShowcaseDigits) return false;
    if (!String(clientPhone || "").trim()) return false;
    return true;
  }, [lines.length, phoneShowcaseDigits, clientPhone]);

  const checkout = useCallback(() => {
    if (!canCheckout) return;

    const linesText = lines
      .map((ln, idx) => {
        const sub = toNum(ln.qty) * toNum(ln.price);
        return `${idx + 1}) ${ln.name} — ${ln.qty} x ${money(ln.price)} сом = ${money(sub)} сом`;
      })
      .join("\n");

    const text =
      `Заказ с витрины: ${company?.name || ""}\n` +
      `Номер клиента: ${String(clientPhone).trim()}\n\n` +
      `Товары:\n${linesText}\n\n` +
      `Итого: ${money(total)} сом`;

    const url = buildWaLink(phoneShowcaseDigits, text);
    if (!url) return;

    window.open(url, "_blank", "noopener,noreferrer");
    setCart({});
    setCartOpen(false);
  }, [canCheckout, company?.name, lines, phoneShowcaseDigits, total, clientPhone]);

  if (!slug) {
    return (
      <section className="shopfront">
        <div className="shopfront__shell">
          <div className="shopfront__empty">
            <div className="shopfront__emptyTitle">Slug компании не найден</div>
            <div className="shopfront__emptyText">
              Проверь роут: <b>/catalog/:slug</b>. Сейчас URL: <b>{location.pathname}</b>
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="shopfront">
      {/* Top Bar */}
      <header className="sfbar">
        <div className="sfbar__inner">
          <div className="sfbar__left">
            <div className="sfbar__logo" aria-hidden="true">
              <FaShoppingCart />
            </div>
            <div className="sfbar__brand">{brandTitle}</div>
          </div>

          <div className="sfbar__search">
            <FaSearch className="sfbar__searchIcon" />
            <input
              className="sfbar__searchInput"
              value={qState.q}
              onChange={(e) => setQS({ q: e.target.value, page: "" })}
              placeholder="Поиск товаров..."
            />
            {qState.q ? (
              <button type="button" className="sfbar__clear" onClick={() => setQS({ q: "", page: "" })} aria-label="Clear">
                <FaTimes />
              </button>
            ) : null}
          </div>

          <div className="sfbar__right">
            <button type="button" className="sfbar__cartBtn" onClick={() => setCartOpen(true)} aria-label="Open cart">
              <FaShoppingCart />
              <span>Корзина</span>
              {cartCount > 0 ? <span className="sfbar__cartBadge">{cartCount}</span> : null}
            </button>
          </div>
        </div>
      </header>

      <div className="shopfront__shell">
        {/* Hero Section */}
        {company && !companyLoading && (
          <div className="shopfront__hero">
            <div className="shopfront__heroContent">
              <h1 className="shopfront__heroTitle">{company.name || "Добро пожаловать"}</h1>
              {company.description && (
                <p className="shopfront__heroDesc">{company.description}</p>
              )}
            </div>
          </div>
        )}

        {/* Categories */}
        {categories.length > 0 && (
          <div className="sfcats">
            <div className="sfcats__header">
              <div className="sfcats__title">
                <FaTag /> Категории
              </div>
              <div className="sfcats__count">{categories.length} категорий</div>
            </div>

            <div className="sfcats__row" aria-label="Categories">
              <button
                type="button"
                className={`sfchip ${qState.category ? "" : "sfchip--active"}`}
                onClick={() => setQS({ category: "", page: "" })}
              >
                <FaStar /> Все
              </button>

              {categories.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  className={`sfchip ${String(qState.category) === String(c.id) ? "sfchip--active" : ""}`}
                  onClick={() => setQS({ category: c.id, page: "" })}
                  title={c.title}
                >
                  {c.title}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Products header */}
        <div className="sfhead">
          <div className="sfhead__left">
            <div className="sfhead__title">
              <FaShoppingCart /> Все товары
            </div>
            {qState.q && (
              <div className="sfhead__searchInfo">
                Результаты поиска: "{qState.q}"
              </div>
            )}
          </div>
          <div className="sfhead__count">
            {companyErr ? (
              <span className="sfhead__err">{companyErr}</span>
            ) : loading ? (
              "Загрузка..."
            ) : (
              `${count} ${count === 1 ? "товар" : count < 5 ? "товара" : "товаров"}`
            )}
          </div>
        </div>

        {err ? (
          <div className="sfalert">
            <FaInfoCircle /> {err}
          </div>
        ) : null}

        {/* Grid */}
        <div className="sfgrid">
          {loading ? (
            <div className="sfgrid__info">
              <div className="sfgrid__loader">
                <div className="sfgrid__loaderSpinner"></div>
                <div>Загрузка товаров...</div>
              </div>
            </div>
          ) : null}
          {!loading && items.length === 0 && !err ? (
            <div className="sfgrid__info">
              <div className="sfgrid__empty">
                <FaShoppingCart />
                <div className="sfgrid__emptyTitle">Товары не найдены</div>
                <div className="sfgrid__emptyText">
                  {qState.q || qState.category
                    ? "Попробуйте изменить параметры поиска или выберите другую категорию"
                    : "В каталоге пока нет товаров"}
                </div>
              </div>
            </div>
          ) : null}

          {!loading &&
            items.map((p) => (
              <ShowcaseCard key={p.id} item={p} onAdd={addToCart} onOpen={openProduct} />
            ))}
        </div>

        {/* Pagination */}
        {!loading && !err && totalPages > 1 && (
          <nav className="sfpager" aria-label="Пагинация">
            <button
              type="button"
              className="sfpager__btn sfpager__btn--prev"
              onClick={() => goToPage(currentPage - 1)}
              disabled={currentPage <= 1}
              aria-label="Предыдущая страница"
            >
              <FaChevronLeft /> Назад
            </button>
            <ul className="sfpager__list">
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter((p) => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1)
                .reduce((acc, p, i, arr) => {
                  if (i > 0 && p - arr[i - 1] > 1) acc.push("…");
                  acc.push(p);
                  return acc;
                }, [])
                .map((p, i) =>
                  p === "…" ? (
                    <li key={`ellipsis-${i}`} className="sfpager__ellipsis" aria-hidden="true">
                      …
                    </li>
                  ) : (
                    <li key={p}>
                      <button
                        type="button"
                        className={`sfpager__btn sfpager__btn--num ${p === currentPage ? "sfpager__btn--active" : ""}`}
                        onClick={() => goToPage(p)}
                        aria-current={p === currentPage ? "page" : undefined}
                        aria-label={`Страница ${p}`}
                      >
                        {p}
                      </button>
                    </li>
                  )
                )}
            </ul>
            <button
              type="button"
              className="sfpager__btn sfpager__btn--next"
              onClick={() => goToPage(currentPage + 1)}
              disabled={currentPage >= totalPages}
              aria-label="Следующая страница"
            >
              Вперёд <FaChevronRight />
            </button>
          </nav>
        )}
      </div>

      <ShowcaseModal
        open={productOpen}
        slug={slug}
        productId={activeProductId}
        onClose={closeProduct}
        onAdd={addToCart}
      />

      <SideCart
        open={cartOpen}
        onClose={() => setCartOpen(false)}
        lines={lines}
        total={total}
        clientPhone={clientPhone}
        onChangeClientPhone={setClientPhone}
        onInc={inc}
        onDec={dec}
        onRemove={remove}
        onCheckout={checkout}
        canCheckout={canCheckout}
        checkoutHint={checkoutHint}
      />
    </section>
  );
};

export default Catalog;
