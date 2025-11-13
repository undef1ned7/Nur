// src/components/consalting/services/services.jsx
import { useEffect, useMemo, useState } from "react";
import { FaEdit, FaPlus, FaSearch, FaTimes, FaTrash } from "react-icons/fa";
import { useDispatch } from "react-redux";
import {
  createConsultingService,
  deleteConsultingService,
  editConsultingService,
  getConsultingServices,
} from "../../../../store/creators/consultingThunk";
import { useConsulting } from "../../../../store/slices/consultingSlice";
import "./services.scss";

export default function ConsultingServices({
  loading = false,
  error = "",
  disabled = false,
}) {
  const dispatch = useDispatch();
  const {
    services: rows,
    loading: loadingFromSlice,
    error: errorFromSlice,
  } = useConsulting();

  const effLoading = loading || loadingFromSlice;
  const effError = error || errorFromSlice;

  /* поиск */
  const [q, setQ] = useState("");

  /* создание */
  const [createOpen, setCreateOpen] = useState(false);
  const [createSaving, setCreateSaving] = useState(false);
  const [createErr, setCreateErr] = useState("");
  const emptyCreate = { name: "", price: "", description: "" };
  const [createForm, setCreateForm] = useState(emptyCreate);

  /* редактирование */
  const [editOpen, setEditOpen] = useState(false);
  const [editSaving, setEditSaving] = useState(false);
  const [editErr, setEditErr] = useState("");
  const emptyEdit = { id: null, name: "", price: "", description: "" };
  const [editForm, setEditForm] = useState(emptyEdit);

  /* удаление */
  const [deletingIds, setDeletingIds] = useState(new Set());

  /* helpers */
  const clean = (s) =>
    String(s || "")
      .replace(/\s+/g, " ")
      .trim();
  const num = (v) => {
    const n = typeof v === "string" ? Number(v.replace(",", ".")) : Number(v);
    return Number.isFinite(n) ? n : 0;
  };
  const money = (v) => (Number(v) || 0).toLocaleString() + " с";

  /* загрузка услуг */
  useEffect(() => {
    dispatch(getConsultingServices());
  }, [dispatch]);

  /* фильтр */
  const filtered = useMemo(() => {
    const text = q.trim().toLowerCase();
    let base = (rows || []).slice();
    if (text) {
      base = base.filter((r) =>
        [r.title ?? r.name, r.description].some((v) =>
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

  /* валидация */
  const validate = (f, setErrState) => {
    const title = clean(f.name);
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
      // Бэк ожидает name? В earlier-коде ты маппил на title.
      // Отправим оба, а на UI валидируем по title:
      // title: clean(createForm.name),
      name: clean(createForm.name),
      price: num(createForm.price),
      description: createForm.description || "",
    };
    if (!validate(dto, setCreateErr)) return;

    setCreateSaving(true);
    try {
      await dispatch(createConsultingService(dto)).unwrap();
      setCreateOpen(false);
      setCreateForm(emptyCreate);
      dispatch(getConsultingServices());
      // либо доверяем редьюсеру, либо рефетчим:
      // dispatch(getConsultingServices());
    } catch (err) {
      setCreateErr(
        (typeof err === "string" ? err : err?.detail) ||
          "Не удалось создать услугу. Попробуйте ещё раз."
      );
    } finally {
      setCreateSaving(false);
    }
  };

  /* ОТКРЫТЬ РЕДАКТИРОВАНИЕ */
  const openEdit = (s) => {
    setEditForm({
      id: s.id,
      name: s.title ?? s.name ?? "",
      price: String(s.price ?? ""),
      description: s.description ?? "",
    });
    setEditErr("");
    setEditOpen(true);
  };

  /* РЕДАКТИРОВАНИЕ */
  const submitEdit = async (e) => {
    e.preventDefault();
    if (!editForm.id || editSaving) return;

    const dto = {
      // title: clean(editForm.name),
      name: clean(editForm.name), // на всякий случай
      price: num(editForm.price),
      description: editForm.description || "",
    };
    if (!validate(dto, setEditErr)) return;

    setEditSaving(true);
    try {
      await dispatch(
        editConsultingService({ id: editForm.id, data: dto })
      ).unwrap();
      setEditOpen(false);
      setEditForm(emptyEdit);
      dispatch(getConsultingServices());
    } catch (err) {
      setEditErr(
        (typeof err === "string" ? err : err?.detail) ||
          "Не удалось сохранить изменения. Попробуйте ещё раз."
      );
    } finally {
      setEditSaving(false);
    }
  };

  /* УДАЛЕНИЕ */
  const removeService = async (s) => {
    if (!s?.id) return;
    if (!window.confirm(`Удалить услугу «${s.title ?? s.name ?? "—"}»?`))
      return;
    setDeletingIds((prev) => new Set(prev).add(s.id));
    try {
      await dispatch(deleteConsultingService(s.id)).unwrap();
      dispatch(getConsultingServices());
    } catch (err) {
      alert(
        (typeof err === "string" ? err : err?.detail) ||
          "Не удалось удалить услугу."
      );
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
          <p className="services__subtitle">Справочник услуг (сервер)</p>
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
              disabled={disabled}
            />
          </div>

          <button
            className="services__btn services__btn--primary"
            onClick={() => setCreateOpen(true)}
            disabled={disabled}
          >
            <FaPlus /> Добавить услугу
          </button>
        </div>
      </header>

      {effLoading && <div className="services__alert">Загрузка…</div>}
      {!!effError && <div className="services__alert">{String(effError)}</div>}

      {!effLoading && (
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
                    <td
                      className="services__ellipsis"
                      title={s.title ?? s.name}
                    >
                      {s.title ?? s.name ?? "—"}
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
                        disabled={disabled}
                      >
                        <FaEdit /> Изм.
                      </button>
                      <button
                        className="services__btn services__btn--danger"
                        onClick={() => removeService(s)}
                        disabled={disabled || deletingIds.has(s.id)}
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
                    value={createForm.name}
                    onChange={(e) =>
                      setCreateForm((p) => ({ ...p, name: e.target.value }))
                    }
                    maxLength={120}
                    required
                    disabled={createSaving || disabled}
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
                    disabled={createSaving || disabled}
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
                    disabled={createSaving || disabled}
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
                  disabled={createSaving || disabled}
                >
                  {createSaving ? "Сохранение…" : "Создать"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ====== EDIT MODAL ====== */}
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
                    value={editForm.name}
                    onChange={(e) =>
                      setEditForm((p) => ({ ...p, name: e.target.value }))
                    }
                    maxLength={120}
                    required
                    disabled={editSaving || disabled}
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
                    disabled={editSaving || disabled}
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
                    disabled={editSaving || disabled}
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
                  disabled={editSaving || disabled}
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
