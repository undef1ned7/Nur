// Services.jsx
import React, { useEffect, useMemo, useState } from "react";
import "./Services.scss";
import { FaPlus, FaEdit, FaTimes, FaTrash, FaSearch } from "react-icons/fa";
import api from "../../../../api";

const normalizeName = (s) => String(s || "").trim().replace(/\s+/g, " ").toLowerCase();
const PAGE_SIZE = 12;

// Категории, общие для барбершопа и салона
const CATEGORIES = [
  { value: "hair", label: "Волосы" },
  { value: "beard", label: "Борода" },
  { value: "color_style", label: "Окрашивание/Укладка" },
  { value: "care", label: "Уход" },
];
const CATEGORY_LABELS = CATEGORIES.reduce((acc, c) => { acc[c.value] = c.label; return acc; }, {});

const Services = () => {
  const [services, setServices] = useState([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [categoryTab, setCategoryTab] = useState("all");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [pageError, setPageError] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [currentService, setCurrentService] = useState(null);
  const [modalAlerts, setModalAlerts] = useState([]);
  const [fieldErrors, setFieldErrors] = useState({});
  const [confirmDelete, setConfirmDelete] = useState(false);

  const [page, setPage] = useState(1);

  // для размещения только что созданной услуги наверху
  const [lastAddedId, setLastAddedId] = useState(null);

  const fmtMoney = (v) => {
    const n = Number(v);
    return Number.isFinite(n) ? `${n.toLocaleString("ru-RU")} сом` : "—";
  };

  const mapService = (s) => ({
    id: s.id,
    name: s.name ?? "",
    price: s.price ?? 0,
    active: Boolean(s.is_active ?? true),
    time: s.time ?? "",
    category: s.category ?? "", // ожидаем одно из значений CATEGORIES.value
    createdAt: s.created_at || s.createdAt || null,
    updatedAt: s.updated_at || s.updatedAt || null,
  });

  const fetchServices = async () => {
    try {
      setLoading(true);
      setPageError("");
      const { data } = await api.get("/barbershop/services/");
      const listRaw = Array.isArray(data?.results) ? data.results : Array.isArray(data) ? data : [];
      setServices(listRaw.map(mapService));
    } catch (e) {
      setPageError(e?.response?.data?.detail || "Не удалось загрузить услуги.");
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchServices();
  }, []);

  useEffect(() => {
    setPage(1);
  }, [search, services.length, modalOpen, statusFilter, categoryTab]);

  const parseMoney = (raw) => {
    const cleaned = String(raw).replace(/\s/g, "").replace(",", ".");
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : NaN;
  };

  const focusFirstError = (errs) => {
    const order = ["name", "price", "category"];
    const key = order.find((k) => errs[k]);
    if (key) {
      const el = document.getElementsByName(key)[0];
      if (el?.focus) el.focus();
    }
  };

  const validateService = ({ name, price, category }) => {
    const alerts = [];
    const errs = {};
    const nn = normalizeName(name);

    if (!nn) {
      errs.name = true;
      alerts.push("Укажите название услуги.");
    } else {
      const duplicate = services.some(
        (s) =>
          normalizeName(s.name) === nn &&
          (!currentService?.id || s.id !== currentService.id)
      );
      if (duplicate) {
        errs.name = true;
        alerts.push("Услуга с таким названием уже существует.");
      }
    }

    if (String(price).trim() === "") {
      errs.price = true;
      alerts.push("Укажите цену.");
    }
    const priceNum = parseMoney(price);
    if (!Number.isFinite(priceNum) || priceNum < 0) {
      errs.price = true;
      alerts.push("Цена должна быть неотрицательным числом.");
    }

    const catValid = CATEGORIES.some((c) => c.value === category);
    if (!catValid) {
      errs.category = true;
      alerts.push("Выберите категорию.");
    }

    return {
      errs,
      alerts,
      priceNum: Number.isFinite(priceNum) ? priceNum : 0,
    };
  };

  // сортировка: активные выше, только что добавленная — самая первая, потом по дате, затем по имени
  const sorter = (a, b) => {
    if (a.active !== b.active) return a.active ? -1 : 1;
    if (lastAddedId && (a.id === lastAddedId || b.id === lastAddedId)) {
      if (a.id === lastAddedId && b.id !== lastAddedId) return -1;
      if (b.id === lastAddedId && a.id !== lastAddedId) return 1;
    }
    if (a.createdAt && b.createdAt) {
      const ad = new Date(a.createdAt).getTime() || 0;
      const bd = new Date(b.createdAt).getTime() || 0;
      if (ad !== bd) return bd - ad; // новее выше
    }
    return String(a.name || "").localeCompare(String(b.name || ""), "ru", { sensitivity: "base" });
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let base = services;

    if (statusFilter === "active") base = base.filter((s) => s.active);
    if (statusFilter === "inactive") base = base.filter((s) => !s.active);

    if (categoryTab !== "all") base = base.filter((s) => (s.category || "") === categoryTab);

    const arr = q
      ? base.filter((s) => {
          const catLabel = CATEGORY_LABELS[s.category || ""] || "";
          return (
            (s.name || "").toLowerCase().includes(q) ||
            String(s.price).toLowerCase().includes(q) ||
            (s.time || "").toLowerCase().includes(q) ||
            catLabel.toLowerCase().includes(q)
          );
        })
      : base.slice();

    arr.sort(sorter);
    return arr;
  }, [services, search, statusFilter, categoryTab, lastAddedId]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageSafe = Math.min(page, totalPages);
  const startIdx = (pageSafe - 1) * PAGE_SIZE;
  const pageSlice = filtered.slice(startIdx, startIdx + PAGE_SIZE);

  const openModal = (service = null) => {
    setCurrentService(service);
    setModalOpen(true);
    setModalAlerts([]);
    setFieldErrors({});
    setConfirmDelete(false);
  };
  const closeModal = () => {
    if (!saving && !deleting) {
      setModalOpen(false);
      setCurrentService(null);
      setModalAlerts([]);
      setFieldErrors({});
      setConfirmDelete(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const name = (fd.get("name") || "").toString().trim();
    const priceStr = (fd.get("price") || "").toString().trim();
    const active = fd.get("active") === "on";
    const time = (fd.get("time") || "").toString().trim(); // строка, не обязательна
    const category = (fd.get("category") || "").toString();

    const { errs, alerts, priceNum } = validateService({ name, price: priceStr, category });
    if (alerts.length) {
      setFieldErrors(errs);
      setModalAlerts(["Исправьте ошибки в форме.", ...alerts]);
      focusFirstError(errs);
      return;
    }

    try {
      setSaving(true);
      setModalAlerts([]);
      const payload = {
        name,
        price: priceNum,
        is_active: active,
        time: time || null,
        category,
        company: localStorage.getItem("company"),
      };

      if (currentService?.id) {
        await api.patch(`/barbershop/services/${encodeURIComponent(currentService.id)}/`, payload);
      } else {
        const { data: created } = await api.post("/barbershop/services/", payload);
        setLastAddedId(created?.id || null);
      }
      await fetchServices();
      closeModal();
    } catch (e2) {
      const data = e2?.response?.data;
      const msgs = [];
      if (typeof data === "string") msgs.push(data);
      else if (data && typeof data === "object") {
        Object.values(data).forEach((v) => msgs.push(String(Array.isArray(v) ? v[0] : v)));
      }
      if (!msgs.length) msgs.push("Не удалось сохранить услугу.");
      setModalAlerts(msgs);
      console.error(e2);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!currentService?.id) return;
    const id = encodeURIComponent(currentService.id);
    try {
      setDeleting(true);
      setModalAlerts([]);

      try {
        await api.delete(`/barbershop/services/${id}/`);
      } catch (err) {
        const st = err?.response?.status;
        if (st === 404 || st === 405 || st === 301 || st === 302) {
          await api.delete(`/barbershop/services/${id}`);
        } else {
          throw err;
        }
      }

      setServices((prev) => prev.filter((s) => s.id !== currentService.id));
      closeModal();
      await fetchServices();
    } catch (e) {
      const data = e?.response?.data;
      const msg = typeof data === "string" ? data : data?.detail || "Не удалось удалить услугу.";
      setModalAlerts([msg]);
      console.error(e);
    } finally {
      setDeleting(false);
    }
  };

  const Pager = () => {
    if (filtered.length <= PAGE_SIZE) return null;
    const onPrev = () => setPage((p) => Math.max(1, p - 1));
    const onNext = () => setPage((p) => Math.min(totalPages, p + 1));
    const pages = new Set([1, pageSafe - 1, pageSafe, pageSafe + 1, totalPages]);
    const list = [...pages].filter((n) => n >= 1 && n <= totalPages).sort((a, b) => a - b);
    return (
      <nav className="barberservices__pager" aria-label="Пагинация">
        <button className="barberservices__pageBtn" onClick={onPrev} disabled={pageSafe === 1}>Назад</button>
        <ul className="barberservices__pageList">
          {list.map((n, i) => {
            const prev = list[i - 1];
            const needDots = prev && n - prev > 1;
            return (
              <React.Fragment key={n}>
                {needDots && <li className="barberservices__dots">…</li>}
                <li>
                  <button
                    className={`barberservices__pageBtn ${n === pageSafe ? "is-active" : ""}`}
                    aria-current={n === pageSafe ? "page" : undefined}
                    onClick={() => setPage(n)}
                  >
                    {n}
                  </button>
                </li>
              </React.Fragment>
            );
          })}
        </ul>
        <button className="barberservices__pageBtn" onClick={onNext} disabled={pageSafe === totalPages}>Далее</button>
      </nav>
    );
  };

  return (
    <div className="barberservices">
      <div className="barberservices__header">
        <div className="barberservices__titleWrap">
          <h2 className="barberservices__title">Услуги</h2>
          <span className="barberservices__subtitle" aria-live="polite">
            {loading ? "Загрузка…" : `${filtered.length} услуг${filtered.length > PAGE_SIZE ? ` · страница ${pageSafe}/${totalPages}` : ""}`}
          </span>
        </div>

        <div className="barberservices__actions">
          <div className="barberservices__search">
            <FaSearch className="barberservices__searchIcon" />
            <input
              className="barberservices__searchInput"
              placeholder="Поиск по названию, цене, длительности, категории"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Поиск"
            />
          </div>

          <label className="barberservices__filter" aria-label="Фильтр по активности">
            <select
              className="barberservices__select"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="all">Все статусы</option>
              <option value="active">Активные</option>
              <option value="inactive">Неактивные</option>
            </select>
          </label>

          <button
            className="barberservices__btn barberservices__btn--primary barberservices__btn--icon"
            onClick={() => openModal()}
            aria-label="Добавить услугу"
            title="Добавить"
          >
            <FaPlus />
          </button>
        </div>
      </div>

      {/* Табы категорий */}
      <div className="barberservices__tabs" role="tablist" aria-label="Категории">
        <button
          className={`barberservices__tab ${categoryTab === "all" ? "is-active" : ""}`}
          role="tab"
          aria-selected={categoryTab === "all"}
          onClick={() => setCategoryTab("all")}
        >
          Все
        </button>
        {CATEGORIES.map((c) => (
          <button
            key={c.value}
            className={`barberservices__tab ${categoryTab === c.value ? "is-active" : ""}`}
            role="tab"
            aria-selected={categoryTab === c.value}
            onClick={() => setCategoryTab(c.value)}
          >
            {c.label}
          </button>
        ))}
      </div>

      {pageError && !modalOpen && <div className="barberservices__alert">{pageError}</div>}

      {loading ? (
        <div className="barberservices__skeletonList" aria-hidden="true">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="barberservices__skeletonCard" />
          ))}
        </div>
      ) : (
        <>
          <div className="barberservices__list">
            {pageSlice.map((s) => (
              <article
                key={s.id}
                className={`barberservices__card ${s.active ? "barberservices__card--active" : "barberservices__card--inactive"}`}
              >
                <div className="barberservices__info">
                  <h4 className="barberservices__name">{s.name}</h4>
                  <div className="barberservices__meta">
                    <span className="barberservices__price">{fmtMoney(s.price)}</span>
                    {s.time ? <span className="barberservices__tag">⏱ {s.time}</span> : null}
                    <span className={`barberservices__cat barberservices__cat--${s.category || "other"}`}>
                      {CATEGORY_LABELS[s.category || ""] || "Другое"}
                    </span>
                    <span className={`barberservices__badge ${s.active ? "barberservices__badge--active" : "barberservices__badge--inactive"}`}>
                      {s.active ? "Активна" : "Неактивна"}
                    </span>
                  </div>
                </div>

                <div className="barberservices__cardActions">
                  <button
                    className="barberservices__btn barberservices__btn--secondary"
                    onClick={() => openModal(s)}
                    title="Редактировать"
                    aria-label="Редактировать"
                  >
                    <FaEdit />
                    <span className="barberservices__btnText">Редактировать</span>
                  </button>
                </div>
              </article>
            ))}
          </div>
          <Pager />
        </>
      )}

      {modalOpen && (
        <div className="barberservices__overlay" onClick={closeModal}>
          <div
            className="barberservices__modal"
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="barberservices__modalHeader">
              <h3 className="barberservices__modalTitle">
                {currentService ? "Редактировать услугу" : "Новая услуга"}
              </h3>
              <button
                className="barberservices__iconBtn"
                onClick={closeModal}
                aria-label="Закрыть"
                title="Закрыть"
              >
                <FaTimes />
              </button>
            </div>

            {modalAlerts.length > 0 && (
              <div className="barberservices__alert barberservices__alert--inModal">
                {modalAlerts.length === 1 ? modalAlerts[0] : (
                  <ul className="barberservices__alertList">
                    {modalAlerts.map((m, i) => (<li key={i}>{m}</li>))}
                  </ul>
                )}
              </div>
            )}

            <form className="barberservices__form" onSubmit={handleSubmit} noValidate>
              <div className="barberservices__grid">
                <label className={`${fieldErrors.name ? "barberservices__field barberservices__field--invalid" : "barberservices__field"}`}>
                  <span className="barberservices__label">Название <b className="barberservices__req">*</b></span>
                  <input
                    name="name"
                    defaultValue={currentService?.name || ""}
                    className={`${fieldErrors.name ? "barberservices__input barberservices__input--invalid" : "barberservices__input"}`}
                    placeholder="Например: Стрижка"
                    autoFocus
                    required
                  />
                </label>

                <label className={`${fieldErrors.price ? "barberservices__field barberservices__field--invalid" : "barberservices__field"}`}>
                  <span className="barberservices__label">Цена <b className="barberservices__req">*</b></span>
                  <input
                    name="price"
                    defaultValue={currentService?.price !== undefined ? String(currentService.price) : ""}
                    className={`${fieldErrors.price ? "barberservices__input barberservices__input--invalid" : "barberservices__input"}`}
                    placeholder="0"
                    inputMode="decimal"
                  />
                </label>

                <label className="barberservices__field">
                  <span className="barberservices__label">Длительность</span>
                  <input
                    name="time"
                    defaultValue={currentService?.time || ""}
                    className="barberservices__input"
                    placeholder="45 мин"
                    list="durationSuggestions"
                  />
                  <datalist id="durationSuggestions">
                    <option value="15 мин" />
                    <option value="30 мин" />
                    <option value="45 мин" />
                    <option value="1 час" />
                    <option value="1 час 30 мин" />
                    <option value="2 часа" />
                  </datalist>
                </label>

                <label className={`${fieldErrors.category ? "barberservices__field barberservices__field--invalid" : "barberservices__field"}`}>
                  <span className="barberservices__label">Категория <b className="barberservices__req">*</b></span>
                  <select
                    name="category"
                    defaultValue={currentService?.category || CATEGORIES[0].value}
                    className={`${fieldErrors.category ? "barberservices__input barberservices__input--invalid barberservices__input--select" : "barberservices__input barberservices__input--select"}`}
                    required
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c.value} value={c.value}>{c.label}</option>
                    ))}
                  </select>
                </label>

                <div className="barberservices__field barberservices__field--switch">
                  <span className="barberservices__label">Активна</span>
                  <label className="barberservices__switch" title="Активность услуги">
                    <input type="checkbox" name="active" defaultChecked={currentService?.active ?? true} />
                    <span className="barberservices__slider" />
                  </label>
                </div>
              </div>

              <div className="barberservices__footer">
                {currentService?.id ? (
                  confirmDelete ? (
                    <div className="barberservices__confirm">
                      <span className="barberservices__confirmText">Удалить «{currentService.name}» безвозвратно?</span>
                      <div className="barberservices__confirmActions">
                        <button type="button" className="barberservices__btn barberservices__btn--secondary" onClick={() => setConfirmDelete(false)} disabled={deleting}>Отмена</button>
                        <button type="button" className="barberservices__btn barberservices__btn--danger" onClick={handleDelete} disabled={deleting} title="Удалить навсегда">
                          <FaTrash />
                          <span className="barberservices__btnText">{deleting ? "Удаление…" : "Удалить"}</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button type="button" className="barberservices__btn barberservices__btn--danger" onClick={() => setConfirmDelete(true)} disabled={deleting || saving} title="Удалить услугу">
                      <FaTrash />
                      <span className="barberservices__btnText">Удалить</span>
                    </button>
                  )
                ) : (
                  <span className="barberservices__spacer" />
                )}

                <div className="barberservices__footerRight">
                  <button type="button" className="barberservices__btn barberservices__btn--secondary" onClick={closeModal} disabled={saving || deleting}>Отмена</button>
                  <button type="submit" className="barberservices__btn barberservices__btn--primary" disabled={saving || deleting}>
                    {saving ? "Сохранение…" : "Сохранить"}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Services;
