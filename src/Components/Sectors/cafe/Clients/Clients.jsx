// src/Components/Sectors/cafe/Clients/CafeClients.jsx
import React, { useEffect, useMemo, useState, useCallback } from "react";
import { FaSearch } from "react-icons/fa";
import api from "../../../../api";
import {
  getAll,
  createClient,
  updateClient,
  removeClient,
  getOrdersByClient,
  getOrdersStatsByClient,
} from "./clientStore";
import "./cafeclients.scss";
import SearchableCombobox from "../../../common/SearchableCombobox/SearchableCombobox";

import { ClientForm, ClientCard, ConfirmDeleteModal } from "./components/ClientsModals";
import DataContainer from "../../../common/DataContainer/DataContainer";

/* ===== helpers ===== */
const fmtMoney = (v) =>
  new Intl.NumberFormat("ru-RU", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(v) || 0) + " с";

const phoneNorm = (p) => (p || "").replace(/[^\d+]/g, "");
const asArray = (data) =>
  Array.isArray(data?.results) ? data.results : Array.isArray(data) ? data : [];

const toNum = (v) => {
  const n = typeof v === "string" ? Number(v.replace(",", ".")) : Number(v);
  return Number.isFinite(n) ? n : 0;
};

/* DRF fetch-all */
async function fetchAll(url0) {
  let url = url0;
  const acc = [];
  let guard = 0;

  while (url && guard < 80) {
    const { data } = await api.get(url);
    acc.push(...asArray(data));
    url = data?.next || null;
    guard += 1;
  }

  return acc;
}

/* Блокировка скролла без «прыжков» при открытии модалок */
function useBodyScrollLock(active) {
  useEffect(() => {
    if (!active) return;

    const scrollY =
      window.scrollY ||
      window.pageYOffset ||
      document.documentElement.scrollTop ||
      0;

    const original = {
      position: document.body.style.position,
      top: document.body.style.top,
      left: document.body.style.left,
      right: document.body.style.right,
      width: document.body.style.width,
      overflow: document.body.style.overflow,
      paddingRight: document.body.style.paddingRight,
    };

    const scrollbarW = window.innerWidth - document.documentElement.clientWidth;

    document.body.style.position = "fixed";
    document.body.style.top = `-${scrollY}px`;
    document.body.style.left = "0";
    document.body.style.right = "0";
    document.body.style.width = "100%";
    document.body.style.overflow = "hidden";
    if (scrollbarW > 0) document.body.style.paddingRight = `${scrollbarW}px`;

    return () => {
      const y = Math.abs(parseInt(document.body.style.top || "0", 10)) || 0;

      document.body.style.position = original.position;
      document.body.style.top = original.top;
      document.body.style.left = original.left;
      document.body.style.right = original.right;
      document.body.style.width = original.width;
      document.body.style.overflow = original.overflow;
      document.body.style.paddingRight = original.paddingRight;

      window.scrollTo(0, y);
    };
  }, [active]);
}

function useMediaQuery(query) {
  const getMatch = () =>
    typeof window !== "undefined" && window.matchMedia
      ? window.matchMedia(query).matches
      : false;

  const [matches, setMatches] = useState(getMatch);

  useEffect(() => {
    if (!window.matchMedia) return;
    const mql = window.matchMedia(query);

    const onChange = () => setMatches(mql.matches);
    onChange();

    if (mql.addEventListener) mql.addEventListener("change", onChange);
    else mql.addListener(onChange);

    return () => {
      if (mql.removeEventListener) mql.removeEventListener("change", onChange);
      else mql.removeListener(onChange);
    };
  }, [query]);

  return matches;
}

/* ===== основной компонент ===== */
const CafeClients = () => {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const [q, setQ] = useState("");
  const [filterOrders, setFilterOrders] = useState("");
  const [filterDate, setFilterDate] = useState("");

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editId, setEditId] = useState(null);

  const [openId, setOpenId] = useState(null);
  const [tablesMap, setTablesMap] = useState(new Map());

  // confirm delete modal
  const [confirmId, setConfirmId] = useState(null);
  const [confirmBusy, setConfirmBusy] = useState(false);

  const isNarrow = useMediaQuery("(max-width: 640px)");
  const anyModalOpen = isFormOpen || !!openId || confirmId != null;
  useBodyScrollLock(anyModalOpen);

  const hydrateStats = useCallback(async (clientsList) => {
    const ids = clientsList.map((c) => c.id);
    let idx = 0;
    const POOL = 4;

    const worker = async () => {
      while (true) {
        const i = idx++;
        if (i >= ids.length) break;

        const id = ids[i];
        try {
          const stats = await getOrdersStatsByClient(id);
          setRows((prev) => {
            const next = prev.map((c) =>
              String(c.id) === String(id)
                ? {
                  ...c,
                  orders_count: stats.orders_count,
                  updated_at_derived: stats.updated_at_derived,
                }
                : c
            );
            return next.sort(
              (a, b) =>
                new Date(b.updated_at_derived || b.updated_at || 0) -
                new Date(a.updated_at_derived || a.updated_at || 0)
            );
          });
        } catch {
          // ignore
        }
      }
    };

    await Promise.all(
      Array.from({ length: Math.min(POOL, ids.length) }, worker)
    );
  }, []);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setErr("");

      const [clients, tables] = await Promise.all([
        getAll(),
        fetchAll("/cafe/tables/"),
      ]);

      const tablesM = new Map(
        tables.map((t) => [
          String(t.id),
          { id: t.id, number: t.number, places: t.places },
        ])
      );
      setTablesMap(tablesM);

      const augmented = clients.map((c) => {
        const arr = Array.isArray(c.orders) ? c.orders : [];
        const updated_at_derived = arr.length
          ? arr
            .map((o) => o.created_at)
            .filter(Boolean)
            .sort()
            .slice(-1)[0]
          : null;

        return {
          ...c,
          orders_count: arr.length || 0,
          updated_at_derived,
        };
      });

      setRows(
        augmented.sort(
          (a, b) =>
            new Date(b.updated_at_derived || b.updated_at || 0) -
            new Date(a.updated_at_derived || a.updated_at || 0)
        )
      );

      hydrateStats(augmented);
    } catch (e) {
      console.error(e);
      setErr("Не удалось загрузить гостей");
    } finally {
      setLoading(false);
    }
  }, [hydrateStats]);

  useEffect(() => {
    load();
  }, [load]);

  // клиент создан из Orders -> добавить сразу
  useEffect(() => {
    const onClientsRefresh = (e) => {
      const c = e?.detail?.client;
      if (!c) return;

      setRows((prev) => {
        const exists = prev.some((x) => String(x.id) === String(c.id));
        const row = {
          ...c,
          orders_count: 0,
          updated_at_derived: c.updated_at || null,
        };

        const next = exists
          ? prev.map((x) => (String(x.id) === String(c.id) ? row : x))
          : [row, ...prev];

        return next.sort(
          (a, b) =>
            new Date(b.updated_at_derived || b.updated_at || 0) -
            new Date(a.updated_at_derived || a.updated_at || 0)
        );
      });

      getOrdersStatsByClient(c.id)
        .then((stats) =>
          setRows((prev) =>
            prev.map((x) =>
              String(x.id) === String(c.id)
                ? {
                  ...x,
                  orders_count: stats.orders_count,
                  updated_at_derived: stats.updated_at_derived,
                }
                : x
            )
          )
        )
        .catch(() => { });
    };

    window.addEventListener("clients:refresh", onClientsRefresh);
    return () =>
      window.removeEventListener("clients:refresh", onClientsRefresh);
  }, []);

  // заказ создан -> увеличить счётчик и время обновления
  useEffect(() => {
    const onOrderCreated = (e) => {
      const o = e?.detail?.order;
      if (!o?.client) return;

      setRows((prev) =>
        prev.map((c) =>
          String(c.id) === String(o.client)
            ? {
              ...c,
              orders_count: (Number(c.orders_count) || 0) + 1,
              updated_at_derived: new Date().toISOString(),
            }
            : c
        )
      );
    };

    window.addEventListener("clients:order-created", onOrderCreated);
    return () =>
      window.removeEventListener("clients:order-created", onOrderCreated);
  }, []);

  // ESC для confirm delete
  useEffect(() => {
    if (confirmId == null) return;

    const onKey = (e) => {
      if (e.key === "Escape") setConfirmId(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [confirmId]);

  /* ===== CRUD ===== */
  const onCreate = () => {
    setEditId(null);
    setIsFormOpen(true);
  };

  const onEdit = (id) => {
    setEditId(id);
    setIsFormOpen(true);
  };

  const askDelete = (id) => setConfirmId(id);

  const confirmDelete = async () => {
    if (confirmId == null || confirmBusy) return;
    setConfirmBusy(true);
    try {
      await removeClient(confirmId);
      setConfirmId(null);
      await load();
    } catch (e) {
      console.error(e);
      setErr("Ошибка удаления гостя");
    } finally {
      setConfirmBusy(false);
    }
  };

  const onOpenCard = (id) => setOpenId(id);
  const onCloseCard = () => setOpenId(null);

  /* ===== фильтры ===== */
  const ordersFilterOptions = [
    { value: "", label: "Все заказы" },
    { value: "0", label: "Без заказов" },
    { value: "1-5", label: "1-5 заказов" },
    { value: "6-10", label: "6-10 заказов" },
    { value: "10+", label: "10+ заказов" },
  ];

  const dateFilterOptions = [
    { value: "", label: "Все даты" },
    { value: "today", label: "За сегодня" },
    { value: "week", label: "За неделю" },
    { value: "month", label: "За месяц" },
    { value: "old", label: "Старые" },
  ];

  const filtered = useMemo(() => {
    let result = rows;

    // Поиск по имени и телефону
    const searchQuery = q.trim().toLowerCase();
    if (searchQuery) {
      result = result.filter((r) =>
        `${r.full_name || ""} ${r.phone || ""}`.toLowerCase().includes(searchQuery)
      );
    }

    // Фильтр по количеству заказов
    if (filterOrders) {
      const count = (r) => Number(r.orders_count) || 0;
      if (filterOrders === "0") {
        result = result.filter((r) => count(r) === 0);
      } else if (filterOrders === "1-5") {
        result = result.filter((r) => {
          const c = count(r);
          return c >= 1 && c <= 5;
        });
      } else if (filterOrders === "6-10") {
        result = result.filter((r) => {
          const c = count(r);
          return c >= 6 && c <= 10;
        });
      } else if (filterOrders === "10+") {
        result = result.filter((r) => count(r) >= 10);
      }
    }

    // Фильтр по дате обновления
    if (filterDate) {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const weekAgo = new Date(today);
      weekAgo.setDate(weekAgo.getDate() - 7);
      const monthAgo = new Date(today);
      monthAgo.setMonth(monthAgo.getMonth() - 1);

      result = result.filter((r) => {
        const updatedStr = r.updated_at_derived || r.updated_at;
        if (!updatedStr) return filterDate === "old";

        const updated = new Date(updatedStr);

        if (filterDate === "today") {
          return updated >= today;
        } else if (filterDate === "week") {
          return updated >= weekAgo;
        } else if (filterDate === "month") {
          return updated >= monthAgo;
        } else if (filterDate === "old") {
          return updated < monthAgo;
        }
        return true;
      });
    }

    return result;
  }, [rows, q, filterOrders, filterDate]);

  return (
    <section className="cafeclients">
      <header className="cafeclients__header">
        <div>
          <h2 className="cafeclients__title">Гости</h2>
        </div>

        <div className="cafeclients__actions">
          <div className="cafeclients__filters">
            <div className="cafeclients__search">
              <span className="cafeclients__searchIcon" aria-hidden="true">
                <FaSearch />
              </span>
              <input
                className="cafeclients__searchInput"
                placeholder="Поиск по имени и телефону…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                inputMode="search"
                aria-label="Поиск гостей"
              />
            </div>

            <div className="cafeclients__filter">
              <SearchableCombobox
                value={filterOrders}
                onChange={setFilterOrders}
                options={ordersFilterOptions}
                placeholder="Фильтр по заказам…"
                classNamePrefix="cafeclients__combo"
              />
            </div>

            <div className="cafeclients__filter">
              <SearchableCombobox
                value={filterDate}
                onChange={setFilterDate}
                options={dateFilterOptions}
                placeholder="Фильтр по дате…"
                classNamePrefix="cafeclients__combo"
              />
            </div>
          </div>

          <button
            className="cafeclients__btn cafeclients__btn--primary"
            onClick={onCreate}
            type="button"
          >
            + Гость
          </button>
        </div>
      </header>

      {err && <div className="cafeclients__error">{err}</div>}

      {/* Desktop: table, Mobile: cards */}
      <DataContainer>

      {!isNarrow ? (
        <div className="cafeclients__tableWrap">
          <table className="cafeclients__table">
            <thead>
              <tr>
                <th>Имя</th>
                <th>Телефон</th>
                <th>Заказы</th>
                <th>Обновлён</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td className="cafeclients__empty" colSpan={5}>
                    Загрузка…
                  </td>
                </tr>
              ) : filtered.length ? (
                filtered.map((c) => {
                  const updated = c.updated_at_derived || c.updated_at;
                  return (
                    <tr key={c.id}>
                      <td className="cafeclients__ellipsis" title={c.full_name}>
                        {c.full_name || "—"}
                      </td>
                      <td>{c.phone || "—"}</td>
                      <td>{c.orders_count ?? 0}</td>
                      <td>
                        {updated ? new Date(updated).toLocaleString() : "—"}
                      </td>
                      <td className="cafeclients__rowActions">
                        <button
                          className="cafeclients__btn"
                          onClick={() => onOpenCard(c.id)}
                          type="button"
                        >
                          Открыть
                        </button>
                        <button
                          className="cafeclients__btn"
                          onClick={() => onEdit(c.id)}
                          type="button"
                        >
                          Изм.
                        </button>
                        <button
                          className="cafeclients__btn cafeclients__btn--secondary"
                          onClick={() => askDelete(c.id)}
                          type="button"
                        >
                          Удалить
                        </button>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td className="cafeclients__empty" colSpan={5}>
                    Ничего не найдено
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      ) : (

          <div className="cafeclients__list">
            {loading ? (
              <div className="cafeclients__empty">Загрузка…</div>
            ) : filtered.length ? (
              filtered.map((c) => {
                const updated = c.updated_at_derived || c.updated_at;
                return (
                  <div key={c.id} className="cafeclients__listCard">
                    <div className="cafeclients__listTop">
                      <div className="cafeclients__listName" title={c.full_name}>
                        {c.full_name || "—"}
                      </div>
                      <div className="cafeclients__listBadge">
                        {c.orders_count ?? 0} заказ(ов)
                      </div>
                    </div>

                    <div className="cafeclients__listMeta">
                      <div>
                        <span className="cafeclients__muted">Телефон:</span>{" "}
                        {c.phone || "—"}
                      </div>
                      <div>
                        <span className="cafeclients__muted">Обновлён:</span>{" "}
                        {updated ? new Date(updated).toLocaleString() : "—"}
                      </div>
                    </div>

                    <div className="cafeclients__rowActions">
                      <button
                        className="cafeclients__btn"
                        onClick={() => onOpenCard(c.id)}
                        type="button"
                      >
                        Открыть
                      </button>
                      <button
                        className="cafeclients__btn"
                        onClick={() => onEdit(c.id)}
                        type="button"
                      >
                        Изм.
                      </button>
                      <button
                        className="cafeclients__btn cafeclients__btn--secondary"
                        onClick={() => askDelete(c.id)}
                        type="button"
                      >
                        Удалить
                      </button>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="cafeclients__empty">Ничего не найдено</div>
            )}
          </div>

      )}
        </DataContainer>


      {isFormOpen && (
        <ClientForm
          id={editId}
          onClose={() => setIsFormOpen(false)}
          afterSave={load}
          rows={rows}
          phoneNorm={phoneNorm}
          createClient={createClient}
          updateClient={updateClient}
        />
      )}

      {openId && (
        <ClientCard
          id={openId}
          onClose={onCloseCard}
          tablesMap={tablesMap}
          useMediaQuery={useMediaQuery}
          fetchAll={fetchAll}
          getAll={getAll}
          getOrdersByClient={getOrdersByClient}
          toNum={toNum}
          fmtMoney={fmtMoney}
        />
      )}

      {confirmId != null && (
        <ConfirmDeleteModal
          busy={confirmBusy}
          onClose={() => setConfirmId(null)}
          onConfirm={confirmDelete}
        />
      )}
    </section>
  );
};

export default CafeClients;