// src/.../TablesZones.jsx
import React, { useEffect, useMemo, useState } from "react";
import { FaSearch, FaTimes, FaEdit, FaTrash } from "react-icons/fa";

const TablesZones = ({ zones, tables, createZone, updateZone, openConfirm, createPing }) => {
  const [query, setQuery] = useState("");

  const [zoneModalOpen, setZoneModalOpen] = useState(false);
  const [zoneSaving, setZoneSaving] = useState(false);
  const [zoneEditId, setZoneEditId] = useState(null);
  const [zoneTitle, setZoneTitle] = useState("");

  // ✅ открыть модалку создания зоны по нажатию "Новая зона" в header
  useEffect(() => {
    if (!createPing) return;
    setZoneEditId(null);
    setZoneTitle("");
    setZoneModalOpen(true);
  }, [createPing]);

  const zonesWithCounts = useMemo(() => {
    const all = Array.isArray(zones) ? zones : [];
    const mapped = all.map((z) => ({
      ...z,
      count: (tables || []).filter((t) => (t.zone?.id || t.zone) === z.id).length,
    }));

    const q = query.trim().toLowerCase();
    if (!q) return mapped;

    return mapped.filter((z) => {
      const name = String(z.title || "").toLowerCase();
      const cnt = String(z.count);
      const isEmpty = z.count === 0;
      const emptyTxt = isEmpty ? "пустая" : "не пустая";
      return name.includes(q) || cnt.includes(q) || emptyTxt.includes(q);
    });
  }, [zones, tables, query]);

  const openEdit = (z) => {
    setZoneEditId(z.id);
    setZoneTitle(z.title || "");
    setZoneModalOpen(true);
  };

  const closeModal = () => {
    if (zoneSaving) return;
    setZoneModalOpen(false);
    setZoneEditId(null);
    setZoneTitle("");
  };

  const saveZone = async (e) => {
    e.preventDefault();
    if (zoneSaving) return;

    const title = zoneTitle.trim();
    if (!title) return;

    setZoneSaving(true);
    try {
      if (zoneEditId) {
        const ok = await updateZone(zoneEditId, title);
        if (ok) closeModal();
      } else {
        const ok = await createZone(title);
        if (ok) closeModal();
      }
    } finally {
      setZoneSaving(false);
    }
  };

  return (
    <>
      {/* ✅ Фильтр как у столов */}
      <div className="cafeTables__actions cafeTables__actions--sub">
        <div className="cafeTables__search">
          <FaSearch className="cafeTables__searchIcon" />
          <input
            className="cafeTables__searchInput"
            placeholder="Поиск по зонам: название, количество, пустая…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </div>

      <div className="cafeTables__zoneGrid cafeTables__scroll">
        {zonesWithCounts.map((z) => {
          const isEmpty = z.count === 0; // ✅ красная/зелёная как у столов
          return (
            <article key={z.id} className={`cafeTables__zoneCard ${isEmpty ? "cafeTables__zoneCard--danger" : "cafeTables__zoneCard--success"}`}>
              <div className="cafeTables__zoneHead">
                <div className="cafeTables__zoneTitle">{z.title || "—"}</div>
                <div className="cafeTables__zoneCount">Столов: {z.count}</div>
              </div>

              <div className="cafeTables__zoneBody">
                <div className="cafeTables__zoneLine">
                  <span className="cafeTables__zoneLabel">Название:</span>
                  <span className="cafeTables__zoneValue">{z.title || "—"}</span>
                </div>
                <div className="cafeTables__zoneLine">
                  <span className="cafeTables__zoneLabel">Количество столов:</span>
                  <span className="cafeTables__zoneValue">{z.count}</span>
                </div>
              </div>

              {/* ✅ цветная полоса снизу, как у столов */}
              <div className={`cafeTables__zoneStatus ${isEmpty ? "cafeTables__zoneStatus--danger" : "cafeTables__zoneStatus--success"}`}>
                {isEmpty ? "ПУСТАЯ ЗОНА" : "ЕСТЬ СТОЛЫ"}
              </div>

              <div className="cafeTables__zoneFooter">
                <button type="button" className="cafeTables__btn cafeTables__btn--secondary" onClick={() => openEdit(z)}>
                  <FaEdit /> Изменить
                </button>
                <button type="button" className="cafeTables__btn cafeTables__btn--danger" onClick={() => openConfirm("zone", z.id)}>
                  <FaTrash /> Удалить
                </button>
              </div>
            </article>
          );
        })}

        {!zonesWithCounts.length && <div className="cafeTables__alert">Ничего не найдено по запросу «{query}».</div>}
      </div>

      {/* Zone modal */}
      {zoneModalOpen && (
        <div className="cafeTables__modalOverlay" onClick={closeModal}>
          <div className="cafeTables__modal" onClick={(e) => e.stopPropagation()}>
            <div className="cafeTables__modalHeader">
              <h3 className="cafeTables__modalTitle">{zoneEditId ? "Редактировать зону" : "Новая зона"}</h3>
              <button className="cafeTables__iconBtn" type="button" onClick={closeModal} aria-label="Закрыть" disabled={zoneSaving}>
                <FaTimes />
              </button>
            </div>

            <form className="cafeTables__form" onSubmit={saveZone}>
              <div className="cafeTables__field cafeTables__field--full">
                <label className="cafeTables__label">Название зоны</label>
                <input
                  className="cafeTables__input"
                  value={zoneTitle}
                  onChange={(e) => setZoneTitle(e.target.value)}
                  placeholder="Например: 1-этаж, VIP, Терраса"
                  required
                  maxLength={255}
                />
              </div>

              <div className="cafeTables__formActions">
                <button type="button" className="cafeTables__btn cafeTables__btn--secondary" onClick={closeModal} disabled={zoneSaving}>
                  Отмена
                </button>
                <button type="submit" className="cafeTables__btn cafeTables__btn--primary" disabled={zoneSaving}>
                  {zoneSaving ? "Сохранение…" : "Сохранить"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};

export default TablesZones;
