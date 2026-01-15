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
      <div className="tables__actions tables__actions--sub">
        <div className="tables__search">
          <FaSearch className="tables__searchIcon" />
          <input
            className="tables__searchInput"
            placeholder="Поиск по зонам: название, количество, пустая…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </div>

      <div className="tables__zoneGrid tables__scroll">
        {zonesWithCounts.map((z) => {
          const isEmpty = z.count === 0; // ✅ красная/зелёная как у столов
          return (
            <article key={z.id} className={`tables__zoneCard ${isEmpty ? "tables__zoneCard--danger" : "tables__zoneCard--success"}`}>
              <div className="tables__zoneHead">
                <div className="tables__zoneTitle">{z.title || "—"}</div>
                <div className="tables__zoneCount">Столов: {z.count}</div>
              </div>

              <div className="tables__zoneBody">
                <div className="tables__zoneLine">
                  <span className="tables__zoneLabel">Название:</span>
                  <span className="tables__zoneValue">{z.title || "—"}</span>
                </div>
                <div className="tables__zoneLine">
                  <span className="tables__zoneLabel">Количество столов:</span>
                  <span className="tables__zoneValue">{z.count}</span>
                </div>
              </div>

              {/* ✅ цветная полоса снизу, как у столов */}
              <div className={`tables__zoneStatus ${isEmpty ? "tables__zoneStatus--danger" : "tables__zoneStatus--success"}`}>
                {isEmpty ? "ПУСТАЯ ЗОНА" : "ЕСТЬ СТОЛЫ"}
              </div>

              <div className="tables__zoneFooter">
                <button type="button" className="tables__btn tables__btn--secondary" onClick={() => openEdit(z)}>
                  <FaEdit /> Изменить
                </button>
                <button type="button" className="tables__btn tables__btn--danger" onClick={() => openConfirm("zone", z.id)}>
                  <FaTrash /> Удалить
                </button>
              </div>
            </article>
          );
        })}

        {!zonesWithCounts.length && <div className="tables__alert">Ничего не найдено по запросу «{query}».</div>}
      </div>

      {/* Zone modal */}
      {zoneModalOpen && (
        <div className="tables__modalOverlay" onClick={closeModal}>
          <div className="tables__modal" onClick={(e) => e.stopPropagation()}>
            <div className="tables__modalHeader">
              <h3 className="tables__modalTitle">{zoneEditId ? "Редактировать зону" : "Новая зона"}</h3>
              <button className="tables__iconBtn" type="button" onClick={closeModal} aria-label="Закрыть" disabled={zoneSaving}>
                <FaTimes />
              </button>
            </div>

            <form className="tables__form" onSubmit={saveZone}>
              <div className="tables__field tables__field--full">
                <label className="tables__label">Название зоны</label>
                <input
                  className="tables__input"
                  value={zoneTitle}
                  onChange={(e) => setZoneTitle(e.target.value)}
                  placeholder="Например: 1-этаж, VIP, Терраса"
                  required
                  maxLength={255}
                />
              </div>

              <div className="tables__formActions">
                <button type="button" className="tables__btn tables__btn--secondary" onClick={closeModal} disabled={zoneSaving}>
                  Отмена
                </button>
                <button type="submit" className="tables__btn tables__btn--primary" disabled={zoneSaving}>
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
