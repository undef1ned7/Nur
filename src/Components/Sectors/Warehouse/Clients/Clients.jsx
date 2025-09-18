import React, { useMemo, useState, useEffect } from "react";
import { FaUsers, FaPlus, FaTimes } from "react-icons/fa";
import "./Clients.scss";

/* BEM-блок: .sklad-clients — чистый UI без бэкенда */
const WarehouseClients = () => {
  // демо (>15 для проверки пагинации)
  const demo = useMemo(
    () => [
      { name: "ООО «Альфа»", phone: "+996 555 123-456", note: "" },
      { name: "ИП «Бета»", phone: "+996 700 222-333", note: "" },
      { name: "ТОО «Гамма»", phone: "+996 770 444-555", note: "" },
      { name: "ФЛ Иванов И.И.", phone: "+996 500 777-888", note: "" },
      { name: "ООО «Дельта»", phone: "+996 777 101-010", note: "" },
      { name: "ИП «Омега»", phone: "+996 555 202-020", note: "" },
      { name: "ФЛ Петров П.П.", phone: "+996 700 303-030", note: "" },
      { name: "ООО «Вектор»", phone: "+996 770 404-040", note: "" },
      { name: "ИП «Сапфир»", phone: "+996 500 505-050", note: "" },
      { name: "ФЛ Сидоров С.С.", phone: "+996 777 606-060", note: "" },
      { name: "ООО «Симба»", phone: "+996 555 707-070", note: "" },
      { name: "ИП «Арго»", phone: "+996 700 808-080", note: "" },
      { name: "ФЛ Смирнов А.А.", phone: "+996 770 909-090", note: "" },
      { name: "ООО «Неон»", phone: "+996 500 111-222", note: "" },
      { name: "ИП «Вега»", phone: "+996 777 333-444", note: "" },
      { name: "ФЛ Ким Д.Д.", phone: "+996 555 999-888", note: "" },
      { name: "ООО «Лайм»", phone: "+996 700 121-314", note: "" },
      { name: "ИП «Кварц»", phone: "+996 770 151-617", note: "" },
    ],
    []
  );

  const [data, setData] = useState(demo);

  // поиск + пагинация
  const [q, setQ] = useState("");
  const PER_PAGE = 15;
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return data;
    return data.filter(
      (c) =>
        c.name.toLowerCase().includes(query) ||
        (c.phone && c.phone.toLowerCase().includes(query)) ||
        (c.note && c.note.toLowerCase().includes(query))
    );
  }, [q, data]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  useEffect(() => setPage(1), [q]);
  useEffect(() => { if (page > totalPages) setPage(totalPages); }, [page, totalPages]);

  const start = (page - 1) * PER_PAGE;
  const paginated = filtered.slice(start, start + PER_PAGE);

  // модалка
  const [open, setOpen] = useState(false);
  const [editIndex, setEditIndex] = useState(null);

  // форма
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [note, setNote] = useState("");
  const [errors, setErrors] = useState({});

  const normalize = (s) => s.trim().toLowerCase();

  const openCreate = () => {
    setEditIndex(null);
    setName("");
    setPhone("");
    setNote("");
    setErrors({});
    setOpen(true);
  };

  const openEdit = (item) => {
    const idx = data.indexOf(item);
    if (idx === -1) return;
    setEditIndex(idx);
    setName(data[idx].name);
    setPhone(data[idx].phone || "");
    setNote(data[idx].note || "");
    setErrors({});
    setOpen(true);
  };

  const closeModal = () => setOpen(false);

  const validate = () => {
    const e = {};
    const nameTrim = name.trim();
    if (!nameTrim) e.name = "Укажите наименование.";

    const duplicate = data.some(
      (c, i) => normalize(c.name) === normalize(nameTrim) && i !== (editIndex ?? -1)
    );
    if (!e.name && duplicate) e.name = "Клиент с таким названием уже существует.";

    const phoneTrim = phone.trim();
    if (phoneTrim) {
      const validChars = /^[0-9+()\-\s]+$/.test(phoneTrim);
      const onlyDigits = phoneTrim.replace(/\D/g, "");
      if (!validChars || onlyDigits.length < 6) e.phone = "Некорректный телефон.";
    }

    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const onSave = () => {
    if (!validate()) return;
    const item = { name: name.trim(), phone: phone.trim(), note: note.trim() };
    if (editIndex === null) {
      setData((prev) => [item, ...prev]);
      setPage(1);
    } else {
      setData((prev) => prev.map((it, i) => (i === editIndex ? item : it)));
    }
    setOpen(false);
  };

  return (
    <div className="sklad-clients">
      {/* header */}
      <div className="sklad-clients__header">
        <div className="sklad-clients__titleWrap">
          <h2 className="sklad-clients__title">
            <FaUsers aria-hidden /> Клиенты
          </h2>
          <div className="sklad-clients__subtitle">Справочник клиентов компании</div>
        </div>

        <div className="sklad-clients__actions">
          <div className="sklad-clients__search">
            <input
              className="sklad-clients__searchInput"
              type="text"
              placeholder="Поиск: название или телефон…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              aria-label="Поиск по клиентам"
            />
          </div>

          <button
            className="sklad-clients__btn sklad-clients__btn--primary"
            type="button"
            onClick={openCreate}
          >
            <FaPlus aria-hidden />
            <span className="sklad-clients__btnText">Новый клиент</span>
          </button>
        </div>
      </div>

      {/* таблица */}
      <div className="sklad-clients-table__wrap">
        <div className="sklad-clients-table" role="table" aria-label="Клиенты (таблица)">
          <div className="sklad-clients-table__head" role="row">
            <div className="sklad-clients-table__col" role="columnheader">Наименование</div>
            <div className="sklad-clients-table__col" role="columnheader">Телефон</div>
            <div className="sklad-clients-table__col" role="columnheader">Комментарий</div>
            <div className="sklad-clients-table__col sklad-clients-table__col--actions" role="columnheader">Действия</div>
          </div>

          {paginated.map((c, i) => (
            <div key={`${c.name}-${i}`} className="sklad-clients-table__row" role="row">
              <div className="sklad-clients-table__col" role="cell">{c.name}</div>
              <div className="sklad-clients-table__col" role="cell">{c.phone || "—"}</div>
              <div className="sklad-clients-table__col" role="cell">{c.note || "—"}</div>
              <div className="sklad-clients-table__col sklad-clients-table__col--actions" role="cell">
                <button
                  type="button"
                  className="sklad-clients__btn sklad-clients__btn--secondary"
                  onClick={() => openEdit(paginated[i])}
                  aria-label={`Изменить клиента ${c.name}`}
                >
                  Открыть
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {!paginated.length && <div className="sklad-clients__empty">Ничего не найдено.</div>}

      {/* пагинация */}
      {totalPages > 1 && (
        <div className="sklad-clients__pager" role="navigation" aria-label="Навигация по страницам">
          <button
            className="sklad-clients__pageBtn"
            type="button"
            disabled={page === 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            Назад
          </button>

          <ul className="sklad-clients__pageList">
            {Array.from({ length: totalPages }, (_, idx) => {
              const p = idx + 1;
              return (
                <li key={p}>
                  <button
                    className={`sklad-clients__pageBtn ${p === page ? "is-active" : ""}`}
                    type="button"
                    onClick={() => setPage(p)}
                    aria-current={p === page ? "page" : undefined}
                  >
                    {p}
                  </button>
                </li>
              );
            })}
          </ul>

          <button
            className="sklad-clients__pageBtn"
            type="button"
            disabled={page === totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          >
            Вперёд
          </button>
        </div>
      )}

      {/* модалка */}
      {open && (
        <div className="sklad-clients__overlay" role="presentation" onClick={closeModal}>
          <div
            className="sklad-clients__modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="sklad-clients-modal-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sklad-clients__modalHeader">
              <h3 id="sklad-clients-modal-title" className="sklad-clients__modalTitle">
                {editIndex === null ? "Новый клиент" : "Редактирование клиента"}
              </h3>
              <button
                className="sklad-clients__iconBtn"
                type="button"
                onClick={closeModal}
                aria-label="Закрыть"
              >
                <FaTimes />
              </button>
            </div>

            <div className="sklad-clients__form">
              <div className="sklad-clients__grid">
                <div className={`sklad-clients__field ${errors.name ? "sklad-clients__field--invalid" : ""}`}>
                  <label className="sklad-clients__label" htmlFor="cli-name">
                    Наименование <span className="sklad-clients__req">*</span>
                  </label>
                  <input
                    id="cli-name"
                    className={`sklad-clients__input ${errors.name ? "sklad-clients__input--invalid" : ""}`}
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder='Например: ООО «Альфа»'
                  />
                  {errors.name && <div className="sklad-clients__alert sklad-clients__alert--inModal">{errors.name}</div>}
                </div>

                <div className={`sklad-clients__field ${errors.phone ? "sklad-clients__field--invalid" : ""}`}>
                  <label className="sklad-clients__label" htmlFor="cli-phone">Телефон</label>
                  <input
                    id="cli-phone"
                    className={`sklad-clients__input ${errors.phone ? "sklad-clients__input--invalid" : ""}`}
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+996 ___ ___-___"
                  />
                  {errors.phone && <div className="sklad-clients__alert sklad-clients__alert--inModal">{errors.phone}</div>}
                </div>

                <div className="sklad-clients__field sklad-clients__field--full">
                  <label className="sklad-clients__label" htmlFor="cli-note">Комментарий</label>
                  <textarea
                    id="cli-note"
                    className="sklad-clients__input"
                    rows={3}
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Опционально"
                  />
                </div>
              </div>

              <div className="sklad-clients__footer">
                <div className="sklad-clients__spacer" />
                <div className="sklad-clients__footerRight">
                  <button className="sklad-clients__btn" type="button" onClick={closeModal}>Отмена</button>
                  <button className="sklad-clients__btn sklad-clients__btn--primary" type="button" onClick={onSave}>
                    Сохранить
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WarehouseClients;
