// src/components/consalting/services/services.jsx
import React, { useEffect, useMemo, useState } from "react";
import "./services.scss";
import api from "../../../../api";
import { FaPlus, FaSearch, FaTimes, FaEdit, FaTrash } from "react-icons/fa";

/* ====== ЛОКАЛЬНОЕ ХРАНИЛИЩЕ (без бэка) ====== */
const LS_KEY = "services_v1";

/** безопасный парсер */
function readLS() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}
function writeLS(rows) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(rows || []));
  } catch {
    /* ignore */
  }
}

/* ===== helpers ===== */
const clean = (s) =>
  String(s || "")
    .replace(/\s+/g, " ")
    .trim();
const num = (v) => {
  const n = typeof v === "string" ? Number(v.replace(",", ".")) : Number(v);
  return Number.isFinite(n) ? n : 0;
};
const money = (v) => (Number(v) || 0).toLocaleString() + " с";

/* нормализация (на случай старых данных) */
const normalize = (s = {}) => ({
  id: s.id || (crypto?.randomUUID ? crypto.randomUUID() : String(Date.now())),
  title: s.title ?? "",
  price: num(s.price ?? 0),
  description: s.description ?? "",
  created_at: s.created_at || new Date().toISOString(),
  updated_at: s.updated_at || new Date().toISOString(),
});

/* ===== подготовка начального состояния из LS (чтобы не затирать пустотой) ===== */
function initRows() {
  const initial = readLS().map(normalize);
  initial.sort(
    (a, b) =>
      new Date(b.updated_at || b.created_at || 0) -
      new Date(a.updated_at || a.created_at || 0)
  );
  return initial;
}

/* ===== Component ===== */
export default function ConsultingServices() {
  // ВАЖНО: читаем из LS сразу здесь, а не в эффекте
  const [rows, setRows] = useState(initRows);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  /* поиск */
  const [q, setQ] = useState("");

  /* создание */
  const [createOpen, setCreateOpen] = useState(false);
  const [createSaving, setCreateSaving] = useState(false);
  const [createErr, setCreateErr] = useState("");
  const emptyCreate = { title: "", price: "", description: "" };
  const [createForm, setCreateForm] = useState(emptyCreate);

  /* редактирование */
  const [editOpen, setEditOpen] = useState(false);
  const [editSaving, setEditSaving] = useState(false);
  const [editErr, setEditErr] = useState("");
  const emptyEdit = { id: null, title: "", price: "", description: "" };
  const [editForm, setEditForm] = useState(emptyEdit);

  /* удаление */
  const [deletingIds, setDeletingIds] = useState(new Set());

  /* автосохранение в localStorage при изменении rows */
  useEffect(() => {
    writeLS(rows);
  }, [rows]);

  /* подхватываем изменения из других вкладок */
  useEffect(() => {
    const onStorage = (e) => {
      if (e.key === LS_KEY) {
        try {
          setRows(initRows());
        } catch (e2) {
          console.error(e2);
          setErr("Не удалось обновить данные из localStorage.");
        }
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  /* фильтр */
  const filtered = useMemo(() => {
    const text = q.trim().toLowerCase();
    let base = rows.slice();
    if (text) {
      base = base.filter((r) =>
        [r.title, r.description].some((v) =>
          String(v || "")
            .toLowerCase()
            .includes(text)
        )
      );
    }
    return base.sort(
      (a, b) =>
        new Date(b.updated_at || b.created_at || 0) -
        new Date(a.updated_at || a.created_at || 0)
    );
  }, [rows, q]);

  /* ВАЛИДАЦИЯ */
  const validate = (f, setErrState) => {
    const title = clean(f.title);
    const price = num(f.price);
    if (!title) return setErrState("Укажите название услуги."), false;
    if (title.length < 2 || title.length > 120)
      return setErrState("Название: 2–120 символов."), false;
    if (!(price > 0)) return setErrState("Цена должна быть больше 0."), false;
    if (String(f.description || "").length > 800)
      return setErrState("Описание: максимум 800 символов."), false;
    setErrState("");
    return true;
  };

  /* СОЗДАНИЕ */
  const submitCreate = async (e) => {
    e.preventDefault();
    if (createSaving) return;

    const dto = {
      id: crypto?.randomUUID ? crypto.randomUUID() : String(Date.now()),
      title: clean(createForm.title),
      price: num(createForm.price),
      description: createForm.description || "",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    if (!validate(dto, setCreateErr)) return;

    setCreateSaving(true);
    try {
      setRows((prev) => [dto, ...prev]);
      setCreateOpen(false);
      setCreateForm(emptyCreate);
    } finally {
      setCreateSaving(false);
    }
  };

  /* РЕДАКТИРОВАНИЕ */
  const openEdit = (s) => {
    setEditForm({
      id: s.id,
      title: s.title || "",
      price: String(s.price || ""),
      description: s.description || "",
    });
    setEditErr("");
    setEditOpen(true);
  };

  const submitEdit = async (e) => {
    e.preventDefault();
    if (!editForm.id || editSaving) return;

    const dto = {
      id: editForm.id,
      title: clean(editForm.title),
      price: num(editForm.price),
      description: editForm.description || "",
    };
    if (!validate(dto, setEditErr)) return;

    setEditSaving(true);
    try {
      const updated_at = new Date().toISOString();
      setRows((prev) =>
        prev.map((r) => (r.id === dto.id ? { ...r, ...dto, updated_at } : r))
      );
      setEditOpen(false);
      setEditForm(emptyEdit);
    } finally {
      setEditSaving(false);
    }
  };

  /* УДАЛЕНИЕ */
  const removeService = (s) => {
    if (!s?.id) return;
    if (!window.confirm(`Удалить услугу «${s.title || "—"}»?`)) return;
    setDeletingIds((prev) => new Set(prev).add(s.id));
    try {
      setRows((prev) => prev.filter((r) => r.id !== s.id));
    } finally {
      setDeletingIds((prev) => {
        const next = new Set(prev);
        next.delete(s.id);
        return next;
      });
    }
  };

  return (
    <section className="services">
      <header className="services__header">
        <div>
          <h2 className="services__title">Услуги</h2>
          <p className="services__subtitle">
            Локальный справочник услуг (без бэка)
          </p>
        </div>

        <div className="services__toolbar">
          <div className="services__search">
            <FaSearch className="services__mutedIcon" aria-hidden />
            <input
              className="services__input"
              placeholder="Поиск по названию и описанию…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              aria-label="Поиск услуг"
            />
          </div>

          <button
            className="services__btn services__btn--primary"
            onClick={() => setCreateOpen(true)}
          >
            <FaPlus /> Добавить услугу
          </button>
        </div>
      </header>

      {loading && <div className="services__alert">Загрузка…</div>}
      {!!err && <div className="services__alert">{err}</div>}

      {!loading && (
        <div className="services__tableWrap">
          <table className="services__table">
            <thead>
              <tr>
                <th>Название</th>
                <th>Цена</th>
                <th>Описание</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {filtered.length ? (
                filtered.map((s) => (
                  <tr key={s.id}>
                    <td className="services__ellipsis" title={s.title}>
                      {s.title || "—"}
                    </td>
                    <td>{money(s.price)}</td>
                    <td className="services__ellipsis" title={s.description}>
                      {s.description || "—"}
                    </td>
                    <td className="services__rowActions">
                      <button
                        className="services__btn services__btn--secondary"
                        onClick={() => openEdit(s)}
                        title="Изменить"
                      >
                        <FaEdit /> Изм.
                      </button>
                      <button
                        className="services__btn services__btn--danger"
                        onClick={() => removeService(s)}
                        disabled={deletingIds.has(s.id)}
                        title="Удалить"
                      >
                        <FaTrash />{" "}
                        {deletingIds.has(s.id) ? "Удаление…" : "Удалить"}
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td className="services__empty" colSpan={4}>
                    Ничего не найдено
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* ====== CREATE MODAL ====== */}
      {createOpen && (
        <div
          className="services__overlay"
          role="dialog"
          aria-modal="true"
          onClick={() => !createSaving && setCreateOpen(false)}
        >
          <div className="services__modal" onClick={(e) => e.stopPropagation()}>
            <div className="services__modalHeader">
              <h3 className="services__modalTitle">Новая услуга</h3>
              <button
                className="services__iconBtn"
                onClick={() => !createSaving && setCreateOpen(false)}
                aria-label="Закрыть"
              >
                <FaTimes />
              </button>
            </div>

            {!!createErr && <div className="services__alert">{createErr}</div>}

            <form className="services__form" onSubmit={submitCreate} noValidate>
              <div className="services__formGrid">
                <div className="services__field">
                  <label className="services__label">Название *</label>
                  <input
                    className="services__input"
                    value={createForm.title}
                    onChange={(e) =>
                      setCreateForm((p) => ({ ...p, title: e.target.value }))
                    }
                    maxLength={120}
                    required
                  />
                </div>

                <div className="services__field">
                  <label className="services__label">Цена, с *</label>
                  <input
                    className="services__input"
                    type="number"
                    step="0.01"
                    min="0"
                    value={createForm.price}
                    onChange={(e) =>
                      setCreateForm((p) => ({ ...p, price: e.target.value }))
                    }
                    required
                  />
                </div>

                <div className="services__field services__field--full">
                  <label className="services__label">Описание</label>
                  <textarea
                    className="services__input"
                    rows={3}
                    maxLength={800}
                    placeholder="Краткое описание услуги"
                    value={createForm.description}
                    onChange={(e) =>
                      setCreateForm((p) => ({
                        ...p,
                        description: e.target.value,
                      }))
                    }
                  />
                </div>
              </div>

              <div className="services__formActions">
                <button
                  type="button"
                  className="services__btn"
                  onClick={() => setCreateOpen(false)}
                  disabled={createSaving}
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  className="services__btn services__btn--primary"
                  disabled={createSaving}
                >
                  {createSaving ? "Сохранение…" : "Создать"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ====== EDIT MODАЛ ====== */}
      {editOpen && (
        <div
          className="services__overlay"
          role="dialog"
          aria-modal="true"
          onClick={() => !editSaving && setEditOpen(false)}
        >
          <div className="services__modal" onClick={(e) => e.stopPropagation()}>
            <div className="services__modalHeader">
              <h3 className="services__modalTitle">Изменить услугу</h3>
              <button
                className="services__iconBtn"
                onClick={() => !editSaving && setEditOpen(false)}
                aria-label="Закрыть"
              >
                <FaTimes />
              </button>
            </div>

            {!!editErr && <div className="services__alert">{editErr}</div>}

            <form className="services__form" onSubmit={submitEdit} noValidate>
              <div className="services__formGrid">
                <div className="services__field">
                  <label className="services__label">Название *</label>
                  <input
                    className="services__input"
                    value={editForm.title}
                    onChange={(e) =>
                      setEditForm((p) => ({ ...p, title: e.target.value }))
                    }
                    maxLength={120}
                    required
                  />
                </div>

                <div className="services__field">
                  <label className="services__label">Цена, с *</label>
                  <input
                    className="services__input"
                    type="number"
                    step="0.01"
                    min="0"
                    value={editForm.price}
                    onChange={(e) =>
                      setEditForm((p) => ({ ...p, price: e.target.value }))
                    }
                    required
                  />
                </div>

                <div className="services__field services__field--full">
                  <label className="services__label">Описание</label>
                  <textarea
                    className="services__input"
                    rows={3}
                    maxLength={800}
                    placeholder="Краткое описание услуги"
                    value={editForm.description}
                    onChange={(e) =>
                      setEditForm((p) => ({
                        ...p,
                        description: e.target.value,
                      }))
                    }
                  />
                </div>
              </div>

              <div className="services__formActions">
                <button
                  type="button"
                  className="services__btn"
                  onClick={() => setEditOpen(false)}
                  disabled={editSaving}
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  className="services__btn services__btn--primary"
                  disabled={editSaving}
                >
                  {editSaving ? "Сохранение…" : "Сохранить"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}
