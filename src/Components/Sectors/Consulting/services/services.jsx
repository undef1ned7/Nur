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
import { normalizeTariffsForApi } from "../../../../utils/consultingSalePricing";
import {
  usePersistedViewMode,
  VIEW_MODES,
} from "../../../../utils/consultingViewMode";
import ViewModeToggle from "../common/ViewModeToggle";
import { useAlert, useConfirm } from "../../../../hooks/useDialog";
import api from "../../../../api";
import "./services.scss";

const SERVICES_VIEW_STORAGE_KEY = "consulting_services_view_mode";
const ROLES_LIST_URL = "/users/roles/"; // кастомные роли [{id, name}]

const emptyServiceForm = () => ({
  name: "",
  price: "0",
  installation_price: "",
  description: "",
  tariffs: [],
  custom_role: "", // роль, к которой относится услуга ("" = общая, видна везде)
});

function TariffEditor({ tariffs, onChange, disabled }) {
  const rows = tariffs?.length
    ? tariffs
    : [{ name: "", price: "", subscription_amount: "", subscription_period: "month" }];

  const setRow = (idx, patch) => {
    const next = rows.map((r, i) => (i === idx ? { ...r, ...patch } : r));
    onChange(next);
  };

  const addRow = () => onChange([...rows, { name: "", price: "" }]);

  const removeRow = (idx) => {
    const next = rows.filter((_, i) => i !== idx);
    onChange(next.length ? next : [{ name: "", price: "" }]);
  };

  return (
    <div className="services__tariffs">
      <div className="services__tariffsHead">
        <span className="services__label">Тарифы</span>
        <button
          type="button"
          className="services__btn services__btn--secondary"
          onClick={addRow}
          disabled={disabled}
        >
          <FaPlus /> Тариф
        </button>
      </div>
      {rows.map((row, idx) => (
        <div key={idx} className="services__tariffRow">
          <input
            className="services__input"
            placeholder="Название тарифа"
            value={row.name}
            onChange={(e) => setRow(idx, { name: e.target.value })}
            disabled={disabled}
          />
          <input
            className="services__input"
            type="number"
            min="0"
            step="0.01"
            placeholder="Цена"
            value={row.price}
            onChange={(e) => setRow(idx, { price: e.target.value })}
            disabled={disabled}
          />
          <input
            className="services__input services__input--sub"
            type="number"
            min="0"
            step="0.01"
            placeholder="Абон. плата"
            title="Абонентская плата (опционально)"
            value={row.subscription_amount ?? ""}
            onChange={(e) =>
              setRow(idx, { subscription_amount: e.target.value })
            }
            disabled={disabled}
          />
          <select
            className="services__input services__input--subPeriod"
            value={row.subscription_period || "month"}
            onChange={(e) =>
              setRow(idx, { subscription_period: e.target.value })
            }
            disabled={disabled || !row.subscription_amount}
            title="Период абонентской платы"
          >
            <option value="month">/ мес.</option>
            <option value="year">/ год</option>
          </select>
          <button
            type="button"
            className="services__iconBtn"
            onClick={() => removeRow(idx)}
            disabled={disabled || rows.length <= 1}
            aria-label="Удалить тариф"
          >
            <FaTrash />
          </button>
        </div>
      ))}
      <p className="services__hint">
        При сохранении тарифы заменяются целиком. Пустые строки не отправляются.
      </p>
    </div>
  );
}

export default function ConsultingServices({
  loading = false,
  error = "",
  disabled = false,
}) {
  const dispatch = useDispatch();
  const confirm = useConfirm();
  const alert = useAlert();
  const {
    services: rows,
    loading: loadingFromSlice,
    error: errorFromSlice,
  } = useConsulting();

  const effLoading = loading || loadingFromSlice;
  const effError = error || errorFromSlice;

  /* поиск */
  const [q, setQ] = useState("");
  const [viewMode, setViewMode] = usePersistedViewMode(SERVICES_VIEW_STORAGE_KEY);

  /* создание */
  const [createOpen, setCreateOpen] = useState(false);
  const [createSaving, setCreateSaving] = useState(false);
  const [createErr, setCreateErr] = useState("");
  const [createForm, setCreateForm] = useState(emptyServiceForm);

  /* редактирование */
  const [editOpen, setEditOpen] = useState(false);
  const [editSaving, setEditSaving] = useState(false);
  const [editErr, setEditErr] = useState("");
  const [editForm, setEditForm] = useState(emptyServiceForm);

  /* удаление */
  const [deletingIds, setDeletingIds] = useState(new Set());

  /* кастомные роли — для привязки услуги к роли */
  const [roles, setRoles] = useState([]);
  const roleNameById = useMemo(() => {
    const m = new Map();
    roles.forEach((r) => m.set(String(r.id), r.name));
    return m;
  }, [roles]);

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

  /* загрузка ролей (для выбора роли услуги) */
  useEffect(() => {
    let cancelled = false;
    api
      .get(ROLES_LIST_URL)
      .then((res) => {
        if (cancelled) return;
        const list = Array.isArray(res.data)
          ? res.data
          : res.data?.results || [];
        setRoles(list.map((r) => ({ id: r.id, name: r.name || "" })));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

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

  /* группировка услуг по ролям: каждая роль — отдельный блок,
     услуги без роли уходят в «Общие услуги» (всегда внизу) */
  const NO_ROLE = "__none__";
  const groupedByRole = useMemo(() => {
    const groups = new Map();
    filtered.forEach((s) => {
      const rid = s.custom_role ? String(s.custom_role) : NO_ROLE;
      if (!groups.has(rid)) {
        groups.set(rid, {
          id: rid,
          name:
            rid === NO_ROLE
              ? "Общие услуги"
              : roleNameById.get(rid) || "Без названия роли",
          items: [],
        });
      }
      groups.get(rid).items.push(s);
    });
    return [...groups.values()].sort((a, b) => {
      if (a.id === NO_ROLE) return 1;
      if (b.id === NO_ROLE) return -1;
      return a.name.localeCompare(b.name, "ru");
    });
  }, [filtered, roleNameById]);

  /* валидация */
  const validate = (f, setErrState) => {
    const title = clean(f.name);
    const price = num(f.price);
    const installation = num(f.installation_price);
    const tariffs = normalizeTariffsForApi(f.tariffs);

    if (!title) return setErrState("Укажите название услуги."), false;
    if (title.length < 2 || title.length > 120)
      return setErrState("Название: 2–120 символов."), false;
    if (installation < 0)
      return setErrState("Стоимость установки не может быть отрицательной."), false;
    if (!tariffs.length && !(price > 0))
      return setErrState("Укажите цену или добавьте хотя бы один тариф."), false;
    if (tariffs.some((t) => !t.name || t.price < 0))
      return setErrState("У каждого тарифа должны быть название и цена ≥ 0."), false;
    if (String(f.description || "").length > 800)
      return setErrState("Описание: максимум 800 символов."), false;
    setErrState("");
    return true;
  };

  const buildServiceDto = (f) => ({
    name: clean(f.name),
    price: num(f.price),
    installation_price: num(f.installation_price),
    description: f.description || "",
    tariffs: normalizeTariffsForApi(f.tariffs),
    // "" → null: услуга без роли считается общей (видна во всех воронках)
    custom_role: f.custom_role || null,
  });

  /* СОЗДАНИЕ */
  const submitCreate = async (e) => {
    e.preventDefault();
    if (createSaving) return;

    const dto = buildServiceDto(createForm);
    if (!validate(dto, setCreateErr)) return;

    setCreateSaving(true);
    try {
      await dispatch(createConsultingService(dto)).unwrap();
      setCreateOpen(false);
      setCreateForm(emptyServiceForm());
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
      price: String(s.price ?? "0"),
      installation_price:
        s.installation_price != null ? String(s.installation_price) : "",
      description: s.description ?? "",
      custom_role: s.custom_role ? String(s.custom_role) : "",
      tariffs: (s.tariffs || []).map((t) => ({
        name: t.name || "",
        price: String(t.price ?? ""),
        subscription_amount:
          t.subscription_amount != null ? String(t.subscription_amount) : "",
        subscription_period: t.subscription_period || "month",
      })),
    });
    setEditErr("");
    setEditOpen(true);
  };

  /* РЕДАКТИРОВАНИЕ */
  const submitEdit = async (e) => {
    e.preventDefault();
    if (!editForm.id || editSaving) return;

    const dto = buildServiceDto(editForm);
    if (!validate(dto, setEditErr)) return;

    setEditSaving(true);
    try {
      await dispatch(
        editConsultingService({ id: editForm.id, data: dto })
      ).unwrap();
      setEditOpen(false);
      setEditForm(emptyServiceForm());
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
  const removeService = (s) => {
    if (!s?.id) return;
    confirm(
      `Удалить услугу «${s.title ?? s.name ?? "—"}»?`,
      async (result) => {
        if (!result) return;
        setDeletingIds((prev) => new Set(prev).add(s.id));
        try {
          await dispatch(deleteConsultingService(s.id)).unwrap();
          dispatch(getConsultingServices());
        } catch (err) {
          alert(
            (typeof err === "string" ? err : err?.detail) ||
              "Не удалось удалить услугу.",
            true
          );
        } finally {
          setDeletingIds((prev) => {
            const next = new Set(prev);
            next.delete(s.id);
            return next;
          });
        }
      }
    );
  };

  const renderServiceActions = (s) => (
    <>
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
        <FaTrash /> {deletingIds.has(s.id) ? "Удаление…" : "Удалить"}
      </button>
    </>
  );

  const formatTariffs = (s) =>
    (s.tariffs || []).length
      ? (s.tariffs || [])
          .map((t) => {
            const sub =
              Number(t.subscription_amount) > 0
                ? `; абон. ${Number(t.subscription_amount).toLocaleString()} с/${
                    t.subscription_period === "year" ? "год" : "мес"
                  }`
                : "";
            return `${t.name}: ${money(t.price)}${sub}`;
          })
          .join("; ")
      : "—";

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

          <ViewModeToggle
            viewMode={viewMode}
            onChange={setViewMode}
            disabled={disabled || effLoading}
          />

          <button
            className="services__btn services__btn--primary"
            onClick={() => setCreateOpen(true)}
            disabled={disabled}
          >
            <FaPlus /> Добавить услугу
          </button>
        </div>
      </header>

      <div className="services__meta">
        <span>Найдено: {filtered.length}</span>
      </div>

      {effLoading && <div className="services__alert">Загрузка…</div>}
      {!!effError && <div className="services__alert">{String(effError)}</div>}

      {!effLoading && viewMode === VIEW_MODES.TABLE && (
        !filtered.length ? (
          <div className="services__empty">Ничего не найдено</div>
        ) : (
          groupedByRole.map((group) => (
            <div className="services__group" key={group.id}>
              <h3 className="services__groupTitle">
                {group.name}
                <span className="services__groupCount">{group.items.length}</span>
              </h3>
              <div className="services__tableWrap">
                <table className="services__table">
                  <thead>
                    <tr>
                      <th>Название</th>
                      <th>Базовая цена</th>
                      <th>Установка</th>
                      <th>Тарифы</th>
                      <th>Описание</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {group.items.map((s) => (
                      <tr key={s.id}>
                        <td
                          className="services__ellipsis"
                          title={s.title ?? s.name}
                        >
                          {s.title ?? s.name ?? "—"}
                        </td>
                        <td>{money(s.price)}</td>
                        <td>{money(s.installation_price)}</td>
                        <td
                          className="services__ellipsis"
                          title={formatTariffs(s)}
                        >
                          {formatTariffs(s)}
                        </td>
                        <td className="services__ellipsis" title={s.description}>
                          {s.description || "—"}
                        </td>
                        <td className="services__rowActions">
                          {renderServiceActions(s)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))
        )
      )}

      {!effLoading && viewMode === VIEW_MODES.CARDS && (
        !filtered.length ? (
          <div className="services__cardsEmpty">Ничего не найдено</div>
        ) : (
          groupedByRole.map((group) => (
            <div className="services__group" key={group.id}>
              <h3 className="services__groupTitle">
                {group.name}
                <span className="services__groupCount">{group.items.length}</span>
              </h3>
              <div className="services__cards">
                {group.items.map((s) => (
                  <article key={s.id} className="services__card">
                    <h3 className="services__cardTitle" title={s.title ?? s.name}>
                      {s.title ?? s.name ?? "—"}
                    </h3>
                    <dl className="services__cardMeta">
                      <div>
                        <dt>Базовая цена</dt>
                        <dd>{money(s.price)}</dd>
                      </div>
                      <div>
                        <dt>Установка</dt>
                        <dd>{money(s.installation_price)}</dd>
                      </div>
                      <div className="services__cardMetaRow--full">
                        <dt>Тарифы</dt>
                        <dd>
                          {(s.tariffs || []).length ? (
                            <ul className="services__tariffList">
                              {(s.tariffs || []).map((t) => (
                                <li key={t.id || t.name}>
                                  {t.name} — {money(t.price)}
                                </li>
                              ))}
                            </ul>
                          ) : (
                            "—"
                          )}
                        </dd>
                      </div>
                      {s.description ? (
                        <div className="services__cardMetaRow--full">
                          <dt>Описание</dt>
                          <dd>{s.description}</dd>
                        </div>
                      ) : null}
                    </dl>
                    <div className="services__cardActions">
                      {renderServiceActions(s)}
                    </div>
                  </article>
                ))}
              </div>
            </div>
          ))
        )
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
                  <label className="services__label">Базовая цена, с</label>
                  <input
                    className="services__input"
                    type="number"
                    step="0.01"
                    min="0"
                    value={createForm.price}
                    onChange={(e) =>
                      setCreateForm((p) => ({ ...p, price: e.target.value }))
                    }
                    disabled={createSaving || disabled}
                  />
                </div>

                <div className="services__field">
                  <label className="services__label">Стоимость установки, с</label>
                  <input
                    className="services__input"
                    type="number"
                    step="0.01"
                    min="0"
                    value={createForm.installation_price}
                    onChange={(e) =>
                      setCreateForm((p) => ({
                        ...p,
                        installation_price: e.target.value,
                      }))
                    }
                    disabled={createSaving || disabled}
                  />
                </div>

                <div className="services__field">
                  <label className="services__label">Роль</label>
                  <select
                    className="services__input"
                    value={createForm.custom_role}
                    onChange={(e) =>
                      setCreateForm((p) => ({
                        ...p,
                        custom_role: e.target.value,
                      }))
                    }
                    disabled={createSaving || disabled}
                  >
                    <option value="">Общая (видна во всех воронках)</option>
                    {roles.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name || "—"}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="services__field services__field--full">
                  <TariffEditor
                    tariffs={createForm.tariffs}
                    onChange={(tariffs) =>
                      setCreateForm((p) => ({ ...p, tariffs }))
                    }
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
                  <label className="services__label">Базовая цена, с</label>
                  <input
                    className="services__input"
                    type="number"
                    step="0.01"
                    min="0"
                    value={editForm.price}
                    onChange={(e) =>
                      setEditForm((p) => ({ ...p, price: e.target.value }))
                    }
                    disabled={editSaving || disabled}
                  />
                </div>

                <div className="services__field">
                  <label className="services__label">Стоимость установки, с</label>
                  <input
                    className="services__input"
                    type="number"
                    step="0.01"
                    min="0"
                    value={editForm.installation_price}
                    onChange={(e) =>
                      setEditForm((p) => ({
                        ...p,
                        installation_price: e.target.value,
                      }))
                    }
                    disabled={editSaving || disabled}
                  />
                </div>

                <div className="services__field">
                  <label className="services__label">Роль</label>
                  <select
                    className="services__input"
                    value={editForm.custom_role}
                    onChange={(e) =>
                      setEditForm((p) => ({
                        ...p,
                        custom_role: e.target.value,
                      }))
                    }
                    disabled={editSaving || disabled}
                  >
                    <option value="">Общая (видна во всех воронках)</option>
                    {roles.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name || "—"}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="services__field services__field--full">
                  <TariffEditor
                    tariffs={editForm.tariffs}
                    onChange={(tariffs) =>
                      setEditForm((p) => ({ ...p, tariffs }))
                    }
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
