import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import {
  FaSearch,
  FaUtensils,
  FaShoppingCart,
  FaTimes,
  FaTrash,
  FaMinus,
  FaPlus,
} from "react-icons/fa";
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

const money = (v) => {
  const n = Number(v);
  if (!Number.isFinite(n)) return "0";
  return n.toLocaleString("ru-RU");
};

const fmtPrice = (v) => `${money(v)} c`;

const normStr = (s) => String(s || "").trim();

const normalizePhoneForWa = (raw) =>
  String(raw || "")
    .trim()
    .replace(/[^\d]/g, "");

const buildWaLink = (phoneDigits, text) => {
  const p = String(phoneDigits || "").trim();
  if (!p) return "";
  return `https://wa.me/${p}?text=${encodeURIComponent(text)}`;
};

const getShowcasePhoneRaw = (company, cafe) => {
  const sources = [company, cafe].filter(Boolean);
  for (const src of sources) {
    const phone =
      src.phones_howcase ||
      src.phone_showcase ||
      src.phones_showcase ||
      src.phoneShowcase ||
      "";
    if (String(phone || "").trim()) return phone;
  }
  return "";
};

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

const QtyStepper = ({ value, onMinus, onPlus, disabled = false }) => (
  <div className={`cafemenueonline__qty ${disabled ? "cafemenueonline__qty--disabled" : ""}`}>
    <button
      type="button"
      className="cafemenueonline__qtyBtn"
      onClick={onMinus}
      disabled={disabled}
      aria-label="Уменьшить"
    >
      <FaMinus />
    </button>
    <div className="cafemenueonline__qtyVal">{value}</div>
    <button
      type="button"
      className="cafemenueonline__qtyBtn"
      onClick={onPlus}
      disabled={disabled}
      aria-label="Увеличить"
    >
      <FaPlus />
    </button>
  </div>
);

const MenuItemModal = ({ open, item, onClose, onAdd }) => {
  if (!open || !item) return null;

  const title = String(item?.title || "Блюдо");
  const price = toNum(item?.price);
  const img = item?.image_url || item?.image || PLACEHOLDER_IMG;
  const catTitle = item?.category_title || "";

  return (
    <div className="cafemenueonline__modal" role="dialog" aria-modal="true">
      <button
        type="button"
        className="cafemenueonline__modalBackdrop"
        onClick={onClose}
        aria-label="Закрыть"
      />
      <div className="cafemenueonline__modalPanel">
        <button
          type="button"
          className="cafemenueonline__modalClose"
          onClick={onClose}
          aria-label="Закрыть"
        >
          <FaTimes />
        </button>
        <div className="cafemenueonline__modalImgWrap">
          <img
            className="cafemenueonline__modalImg"
            src={img}
            alt={title}
            onError={(e) => {
              e.currentTarget.src = PLACEHOLDER_IMG;
            }}
          />
        </div>
        <div className="cafemenueonline__modalBody">
          {catTitle ? (
            <div className="cafemenueonline__modalCat">{catTitle}</div>
          ) : null}
          <h2 className="cafemenueonline__modalTitle">{title}</h2>
          <div className="cafemenueonline__modalPrice">{fmtPrice(price)}</div>
          {item?.description ? (
            <p className="cafemenueonline__modalDesc">{item.description}</p>
          ) : null}
          <button
            type="button"
            className="cafemenueonline__cta"
            onClick={() => {
              onAdd?.(item, 1);
              onClose?.();
            }}
          >
            <span className="cafemenueonline__ctaPlus">+</span>
            <span>В корзину</span>
          </button>
        </div>
      </div>
    </div>
  );
};

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
    <div className="cafemenueonline__drawer" role="dialog" aria-modal="true">
      <button
        type="button"
        className="cafemenueonline__drawerBackdrop"
        onClick={onClose}
        aria-label="Закрыть"
      />
      <div className="cafemenueonline__drawerPanel">
        <div className="cafemenueonline__drawerHead">
          <div className="cafemenueonline__drawerTitle">
            <FaShoppingCart />
            <span>Корзина</span>
            <span className="cafemenueonline__drawerBadge">{lines.length}</span>
          </div>
          <button
            type="button"
            className="cafemenueonline__drawerClose"
            onClick={onClose}
            aria-label="Закрыть"
          >
            <FaTimes />
          </button>
        </div>

        <div className="cafemenueonline__drawerBody">
          {lines.length === 0 ? (
            <div className="cafemenueonline__drawerEmpty">Корзина пустая.</div>
          ) : (
            <div className="cafemenueonline__drawerList">
              {lines.map((ln) => (
                <div key={ln.id} className="cafemenueonline__drawerItem">
                  <img
                    className="cafemenueonline__drawerThumb"
                    src={ln.image_url || PLACEHOLDER_IMG}
                    alt={ln.name}
                    loading="lazy"
                    onError={(e) => {
                      e.currentTarget.src = PLACEHOLDER_IMG;
                    }}
                  />
                  <div className="cafemenueonline__drawerInfo">
                    <div className="cafemenueonline__drawerName" title={ln.name}>
                      {ln.name}
                    </div>
                    <div className="cafemenueonline__drawerPrice">
                      {money(ln.price)} c
                    </div>
                    <div className="cafemenueonline__drawerControls">
                      <QtyStepper
                        value={ln.qty}
                        onMinus={() => onDec(ln.id)}
                        onPlus={() => onInc(ln.id)}
                      />
                      <button
                        type="button"
                        className="cafemenueonline__drawerTrash"
                        onClick={() => onRemove(ln.id)}
                        aria-label="Удалить"
                      >
                        <FaTrash />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="cafemenueonline__drawerFoot">
          <div className="cafemenueonline__drawerField">
            <div className="cafemenueonline__drawerLabel">Номер клиента</div>
            <input
              className="cafemenueonline__drawerInput"
              value={clientPhone}
              onChange={(e) => onChangeClientPhone(e.target.value)}
              placeholder="+996..."
              inputMode="tel"
            />
          </div>

          <div className="cafemenueonline__drawerTotal">
            <span>Итого:</span>
            <strong>{money(total)} c</strong>
          </div>

          {checkoutHint ? (
            <div className="cafemenueonline__drawerHint">{checkoutHint}</div>
          ) : null}

          <button
            type="button"
            className="cafemenueonline__drawerBtn"
            onClick={onCheckout}
            disabled={!canCheckout}
          >
            Оформить заказ в WhatsApp
          </button>
        </div>
      </div>
    </div>
  );
};

const CafeMenuOnline = () => {
  const { company_slug } = useParams();

  const [cafe, setCafe] = useState(null);
  const [company, setCompany] = useState(null);
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

  const [cartOpen, setCartOpen] = useState(false);
  const [modalItem, setModalItem] = useState(null);

  const slug = normStr(company_slug);
  const storageKey = useMemo(
    () => `public_cafe_cart_${slug}`,
    [slug],
  );
  const [cart, setCart] = useState({});
  const [clientPhone, setClientPhone] = useState("");

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") {
        setCart(
          parsed.cart && typeof parsed.cart === "object" ? parsed.cart : {},
        );
        setClientPhone(
          typeof parsed.clientPhone === "string" ? parsed.clientPhone : "",
        );
      }
    } catch {
      // ignore
    }
  }, [storageKey]);

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify({ cart, clientPhone }));
    } catch {
      // ignore
    }
  }, [storageKey, cart, clientPhone]);

  const lines = useMemo(
    () => Object.values(cart || {}).filter((x) => toNum(x.qty) > 0),
    [cart],
  );
  const total = useMemo(
    () => lines.reduce((s, x) => s + toNum(x.qty) * toNum(x.price), 0),
    [lines],
  );
  const cartCount = useMemo(
    () => lines.reduce((s, x) => s + toNum(x.qty), 0),
    [lines],
  );

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
      const companyUrl = `/main/public/companies/${encodeURIComponent(slug)}/`;
      const [cafeRes, menuRes, companyRes] = await Promise.allSettled([
        api.get(cafeUrl),
        api.get(menuUrl),
        api.get(companyUrl),
      ]);
      if (cafeRes.status !== "fulfilled") {
        throw cafeRes.reason;
      }
      const catList = asArray(
        menuRes.status === "fulfilled" ? menuRes.value?.data : [],
      );
      setCafe(cafeRes.value?.data || null);
      setCategories(catList || []);
      setCompany(
        companyRes.status === "fulfilled" ? companyRes.value?.data || null : null,
      );
    } catch (e) {
      console.error("Ошибка загрузки публичного меню:", e);
      setErr("Не удалось загрузить меню. Проверь slug и доступность API.");
      setCafe(null);
      setCompany(null);
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
        const list = Array.isArray(data?.results)
          ? data.results
          : Array.isArray(data)
            ? data
            : [];
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
    [slug],
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

  const addToCart = useCallback((item, delta = 1) => {
    const id = String(item?.id || "");
    if (!id) return;

    const title = String(item?.title || item?.name || "Блюдо");
    const price = toNum(item?.price);
    const image_url = item?.image_url || item?.image || "";

    setCart((prev) => {
      const next = { ...(prev || {}) };
      const prevQty = toNum(next[id]?.qty);
      const qty = Math.max(0, prevQty + toNum(delta));

      if (qty <= 0) {
        delete next[id];
        return next;
      }

      next[id] = { id, name: title, price, qty, image_url };
      return next;
    });
  }, []);

  const inc = useCallback((id) => {
    setCart((prev) => {
      const key = String(id || "");
      const next = { ...(prev || {}) };
      if (!next[key]) return next;
      next[key] = {
        ...next[key],
        qty: Math.min(999, toNum(next[key].qty) + 1),
      };
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

  const showcasePhoneRaw = useMemo(
    () => getShowcasePhoneRaw(company, cafe),
    [company, cafe],
  );
  const phoneShowcaseDigits = useMemo(
    () => normalizePhoneForWa(showcasePhoneRaw),
    [showcasePhoneRaw],
  );

  const checkoutHint = useMemo(() => {
    if (lines.length === 0) return "";
    if (!showcasePhoneRaw) {
      return "WhatsApp недоступен: укажите номер витрины в настройках «Моя компания» (поле phones_howcase).";
    }
    if (!phoneShowcaseDigits) return "WhatsApp недоступен: неверный номер витрины.";
    if (!String(clientPhone || "").trim()) return "Укажите номер клиента.";
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
        return `${idx + 1}) ${ln.name} — ${ln.qty} x ${money(ln.price)} c = ${money(sub)} c`;
      })
      .join("\n");

    const cafeName = cafe?.name || company?.name || "";
    const text =
      `Заказ из онлайн-меню: ${cafeName}\n` +
      `Номер клиента: ${String(clientPhone).trim()}\n\n` +
      `Блюда:\n${linesText}\n\n` +
      `Итого: ${money(total)} c`;

    const url = buildWaLink(phoneShowcaseDigits, text);
    if (!url) return;

    window.open(url, "_blank", "noopener,noreferrer");
    setCart({});
    setCartOpen(false);
  }, [
    canCheckout,
    cafe?.name,
    company?.name,
    lines,
    phoneShowcaseDigits,
    total,
    clientPhone,
  ]);

  const pageCount = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount) || 1;
  const pageItems = items;

  const activeTitle = useMemo(() => {
    if (activeCatId === "all") return "Все блюда";
    const c = (categories || []).find(
      (x) => String(x?.id) === String(activeCatId),
    );
    return c?.title || "Категория";
  }, [activeCatId, categories]);

  const openItemModal = useCallback((item) => {
    const cid = item?.category?.id ?? item?.category;
    const catTitle =
      item?.category_title ||
      (categories || []).find((x) => String(x?.id) === String(cid))?.title ||
      "";
    setModalItem({ ...item, category_title: catTitle });
  }, [categories]);

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

            <button
              type="button"
              className="cafemenueonline__cartBtn"
              onClick={() => setCartOpen(true)}
              aria-label="Открыть корзину"
            >
              <FaShoppingCart />
              <span>Корзина</span>
              {cartCount > 0 ? (
                <span className="cafemenueonline__cartBadge">{cartCount}</span>
              ) : null}
            </button>
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
                      (x) => String(x?.id) === String(cid),
                    )?.title ||
                    "";
                  const img = it?.image_url || it?.image || PLACEHOLDER_IMG;
                  const cartQty = toNum(cart[String(it?.id)]?.qty);

                  return (
                    <article
                      key={it?.id}
                      className="cafemenueonline__card"
                      title={it?.title || ""}
                    >
                      <div className="cafemenueonline__imgWrap">
                        <button
                          type="button"
                          className="cafemenueonline__imgBtn"
                          onClick={() => openItemModal(it)}
                          aria-label={`Открыть: ${it?.title || "блюдо"}`}
                        >
                          <img
                            className="cafemenueonline__img"
                            src={img}
                            alt={it?.title ? `Фото: ${it.title}` : "Фото блюда"}
                            loading="lazy"
                            onError={(e) => {
                              e.currentTarget.src = PLACEHOLDER_IMG;
                            }}
                          />
                        </button>
                        {cartQty > 0 ? (
                          <span
                            className="cafemenueonline__cardQty"
                            aria-label={`В корзине: ${cartQty}`}
                          >
                            {cartQty}
                          </span>
                        ) : null}
                      </div>

                      <div className="cafemenueonline__cardBody">
                        <div className="cafemenueonline__rowTop">
                          <button
                            type="button"
                            className="cafemenueonline__nameBtn"
                            onClick={() => openItemModal(it)}
                          >
                            <div className="cafemenueonline__name">
                              {it?.title || "—"}
                            </div>
                          </button>
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
                          <button
                            type="button"
                            className="cafemenueonline__cta cafemenueonline__cta--compact"
                            onClick={(e) => {
                              e.stopPropagation();
                              addToCart(it, 1);
                            }}
                          >
                            <span className="cafemenueonline__ctaPlus">+</span>
                            <span>В корзину</span>
                          </button>
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

      <MenuItemModal
        open={Boolean(modalItem)}
        item={modalItem}
        onClose={() => setModalItem(null)}
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

export default CafeMenuOnline;
