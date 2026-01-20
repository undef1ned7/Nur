// src/.../TablesHall.jsx
import React, { useMemo, useState, useCallback } from "react";
import { FaSearch, FaPlus, FaTimes, FaEdit, FaTrash, FaChair, FaChevronDown, FaChevronUp } from "react-icons/fa";
import SearchableCombobox from "../../../../common/SearchableCombobox/SearchableCombobox";

const asKey = (v) => (v === null || v === undefined ? "" : String(v));

const toId = (v) => {
  if (v === "" || v === undefined || v === null) return null;
  const s = String(v);
  return /^\d+$/.test(s) ? Number(s) : s;
};

const pickItemTitle = (it) =>
  String(
    it?.menu_item_title ??
      it?.menu_title ??
      it?.menu_item?.title ??
      it?.menu_item?.name ??
      it?.title ??
      it?.name ??
      ""
  ).trim();

const formatHallDate = (dateStr) => {
  if (!dateStr) return "";
  try {
    const d = new Date(dateStr);
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const yy = String(d.getFullYear()).slice(-2);
    const hh = String(d.getHours()).padStart(2, "0");
    const mi = String(d.getMinutes()).padStart(2, "0");
    return `${dd}.${mm}.${yy} ${hh}:${mi}`;
  } catch {
    return String(dateStr);
  }
};

const STATUSES = [
  { value: "free", label: "Свободен" },
  { value: "busy", label: "Занят" },
];

const COLLAPSED_LIMIT = 4;

const TablesHall = ({
  zones,
  tables,
  activeByTable,
  zoneTitleByAny,
  tablesView, // hall | manage
  createTable,
  updateTable,
  openConfirm,
}) => {
  const [query, setQuery] = useState("");
  const [zoneFilter, setZoneFilter] = useState("");

  // ✅ раскрытие блюд по столам: key = tableId (string)
  const [expandedByTable, setExpandedByTable] = useState(() => ({}));

  const toggleExpanded = useCallback((tableId) => {
    const key = asKey(tableId);
    if (!key) return;
    setExpandedByTable((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  const [tableModalOpen, setTableModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState({
    number: "",
    zone: "",
    places: 2,
    status: "free",
  });

  const filteredTables = useMemo(() => {
    let filtered = [...(tables || [])];

    // Фильтр по зоне
    if (zoneFilter) {
      const zoneKey = asKey(zoneFilter);
      filtered = filtered.filter((t) => {
        const tZoneKey = asKey(t.zone?.id || t.zone);
        return tZoneKey === zoneKey;
      });
    }

    // Фильтр по поисковому запросу
    const q = query.trim().toLowerCase();
    if (q) {
      filtered = filtered.filter((t) => {
        const num = String(t.number || "").toLowerCase();
        const zoneTxt = String(zoneTitleByAny(t.zone) || "").toLowerCase();
        const st = String(t.status || "").toLowerCase();
        return num.includes(q) || zoneTxt.includes(q) || st.includes(q);
      });
    }

    // Сортировка
    return filtered.sort((a, b) => {
      const an = Number(a?.number) || 0;
      const bn = Number(b?.number) || 0;
      if (an !== bn) return an - bn;
      return asKey(a?.id).localeCompare(asKey(b?.id));
    });
  }, [tables, query, zoneFilter, zoneTitleByAny]);

  const openCreate = () => {
    setEditId(null);
    setForm({
      number: "",
      zone: zones?.[0]?.id || "",
      places: 2,
      status: "free",
    });
    setTableModalOpen(true);
  };

  const openEdit = (row) => {
    setEditId(row.id);
    setForm({
      number: row.number ?? "",
      zone: row.zone?.id || row.zone || "",
      places: row.places ?? 1,
      status: row.status || "free",
    });
    setTableModalOpen(true);
  };

  const closeModal = () => {
    if (saving) return;
    setTableModalOpen(false);
    setEditId(null);
  };

  const save = async (e) => {
    e.preventDefault();
    if (saving) return;

    const payload = {
      number: Number(form.number) || 0,
      zone: toId(form.zone),
      places: Math.max(1, Number(form.places) || 1),
      status: ["free", "busy"].includes(form.status) ? form.status : "free",
    };

    if (!payload.number || !payload.zone) return;

    setSaving(true);
    try {
      const ok = editId ? await updateTable(editId, payload) : await createTable(payload);
      if (ok) closeModal();
    } finally {
      setSaving(false);
    }
  };

  const renderManageList = () => (
    <div className="cafeTables__list cafeTables__scroll">
      {filteredTables.map((t) => {
        const tKey = asKey(t?.id);
        const hasActive = tKey ? activeByTable.has(tKey) : false;

        return (
          <article key={t.id} className={`cafeTables__card ${hasActive ? "cafeTables__card--busy" : ""}`}>
            <div className="cafeTables__cardLeft">
              <div className="cafeTables__avatar" aria-hidden>
                <FaChair />
              </div>

              <div className="cafeTables__cardBody">
                <h3 className="cafeTables__name">Стол {t.number}</h3>
                <div className="cafeTables__meta">
                  <span className="cafeTables__muted">Зона: {zoneTitleByAny(t.zone) || "—"}</span>
                  <span className="cafeTables__muted">Мест: {t.places}</span>
                  <span className={`cafeTables__pill ${hasActive ? "cafeTables__pill--busy" : "cafeTables__pill--free"}`}>
                    {hasActive ? "ЗАНЯТ" : "СВОБОДЕН"}
                  </span>
                </div>
              </div>
            </div>

            <div className="cafeTables__rowActions">
              <button className="cafeTables__btn cafeTables__btn--secondary" onClick={() => openEdit(t)} type="button">
                <FaEdit /> Изменить
              </button>
              <button className="cafeTables__btn cafeTables__btn--danger" onClick={() => openConfirm("table", t.id)} type="button">
                <FaTrash /> Удалить
              </button>
            </div>
          </article>
        );
      })}

      {!filteredTables.length && <div className="cafeTables__alert">Ничего не найдено по запросу «{query}».</div>}
    </div>
  );

  const renderHall = () => (
    <div className="cafeTables__hallGrid cafeTables__scroll">
      {filteredTables.map((t) => {
        const tKey = asKey(t?.id);
        const group = tKey ? activeByTable.get(tKey) : null;
        const latest = group?.orders?.[0] || null;

        const rawItems = group?.orders?.flatMap((o) => (Array.isArray(o.items) ? o.items : [])) || [];

        const agg = new Map();
        for (const it of rawItems) {
          const title = pickItemTitle(it);
          if (!title) continue;
          const qty = Math.max(1, Number(it?.quantity) || 1);
          agg.set(title, (agg.get(title) || 0) + qty);
        }

        const dishes = Array.from(agg.entries())
          .sort((a, b) => a[0].localeCompare(b[0], "ru"))
          .map(([title, qty]) => (qty > 1 ? `${title} x${qty}` : title));

        const isBusy = !!group;
        const date = formatHallDate(latest?.created_at || latest?.created || latest?.date);

        const isExpanded = !!expandedByTable[tKey];
        const hasMore = dishes.length > COLLAPSED_LIMIT;
        const visibleDishes = isExpanded ? dishes : dishes.slice(0, COLLAPSED_LIMIT);
        const moreCount = Math.max(0, dishes.length - COLLAPSED_LIMIT);

        return (
          <article key={t.id} className="cafeTables__hallCard">
            <div className="cafeTables__hallHead">
              <div className="cafeTables__hallTitle">СТОЛ {t.number}</div>
              {date ? <div className="cafeTables__hallDate">{date}</div> : null}
            </div>

            <div className="cafeTables__hallBody">
              {isBusy ? (
                dishes.length ? (
                  <div className="cafeTables__dishes">
                    {visibleDishes.map((name, idx) => (
                      <div key={`${t.id}-${idx}`} className="cafeTables__dish" title={name}>
                        {name}
                      </div>
                    ))}

                    {/* ✅ вместо "+ ещё 4" — рабочая кнопка */}
                    {hasMore && (
                      <button
                        type="button"
                        className="cafeTables__moreBtn"
                        onClick={() => toggleExpanded(t.id)}
                        aria-expanded={isExpanded}
                      >
                        {isExpanded ? (
                          <>
                            <FaChevronUp /> Скрыть
                          </>
                        ) : (
                          <>
                            <FaChevronDown /> Показать ещё {moreCount}
                          </>
                        )}
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="cafeTables__hallEmpty">Заказ в работе</div>
                )
              ) : (
                <div className="cafeTables__hallEmpty">Нет активного заказа</div>
              )}
            </div>

            <div className={`cafeTables__hallStatus ${isBusy ? "cafeTables__hallStatus--busy" : "cafeTables__hallStatus--free"}`}>
              {isBusy ? "ЗАНЯТ" : "СВОБОДЕН"}
            </div>
          </article>
        );
      })}
    </div>
  );

  return (
    <>
      <div className="cafeTables__actions cafeTables__actions--sub">
        <div className="cafeTables__filters">
          <div className="cafeTables__search">
            <FaSearch className="cafeTables__searchIcon" />
            <input
              className="cafeTables__searchInput"
              placeholder="Поиск по столам: номер, зона, статус…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>

          <div className="cafeTables__filterZone">
            <SearchableCombobox
              value={zoneFilter}
              onChange={setZoneFilter}
              options={[
                { value: "", label: "Все зоны" },
                ...(zones || []).map((z) => ({ value: z.id, label: z.title })),
              ]}
              placeholder="Фильтр по зоне"
              classNamePrefix="cafeTablesCombo"
            />
          </div>
        </div>

        <button
          type="button"
          className="cafeTables__btn cafeTables__btn--primary"
          onClick={openCreate}
          disabled={!zones?.length}
          title={!zones?.length ? "Сначала добавьте зону" : ""}
        >
          <FaPlus /> Добавить стол
        </button>
      </div>

      {tablesView === "manage" ? renderManageList() : renderHall()}

      {tableModalOpen && (
        <div className="cafeTables__modalOverlay" onClick={closeModal}>
          <div className="cafeTables__modal" onClick={(e) => e.stopPropagation()}>
            <div className="cafeTables__modalHeader">
              <h3 className="cafeTables__modalTitle">{editId ? "Редактировать стол" : "Новый стол"}</h3>
              <button className="cafeTables__iconBtn" type="button" onClick={closeModal} aria-label="Закрыть" disabled={saving}>
                <FaTimes />
              </button>
            </div>

            <form className="cafeTables__form" onSubmit={save}>
              <div className="cafeTables__formGrid">
                <div className="cafeTables__field">
                  <label className="cafeTables__label">Номер</label>
                  <input
                    type="number"
                    className="cafeTables__input"
                    value={form.number}
                    onChange={(e) => setForm((f) => ({ ...f, number: e.target.value }))}
                    required
                  />
                </div>

                <div className="cafeTables__field">
                  <label className="cafeTables__label">Зона</label>
                  <SearchableCombobox
                    value={form.zone}
                    onChange={(v) => setForm((f) => ({ ...f, zone: v }))}
                    options={(zones || []).map((z) => ({ value: z.id, label: z.title }))}
                    placeholder="Выберите зону…"
                    disabled={saving}
                    classNamePrefix="cafeTablesCombo"
                  />
                </div>

                <div className="cafeTables__field">
                  <label className="cafeTables__label">Мест</label>
                  <input
                    type="number"
                    min="1"
                    className="cafeTables__input"
                    value={form.places}
                    onChange={(e) => setForm((f) => ({ ...f, places: e.target.value }))}
                    required
                  />
                </div>

                <div className="cafeTables__field">
                  <label className="cafeTables__label">Статус</label>
                  <SearchableCombobox
                    value={form.status}
                    onChange={(v) => setForm((f) => ({ ...f, status: v }))}
                    options={STATUSES}
                    placeholder="Выберите статус…"
                    disabled={saving}
                    classNamePrefix="cafeTablesCombo"
                  />
                </div>
              </div>

              <div className="cafeTables__formActions">
                <button type="button" className="cafeTables__btn cafeTables__btn--secondary" onClick={closeModal} disabled={saving}>
                  Отмена
                </button>
                <button type="submit" className="cafeTables__btn cafeTables__btn--primary" disabled={saving}>
                  {saving ? "Сохранение…" : "Сохранить"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};

export default TablesHall;
