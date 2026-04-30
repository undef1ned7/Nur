import React, { useCallback, useEffect, useId, useRef, useState } from "react";
import { FaSearch, FaTimes, FaTrash, FaUpload } from "react-icons/fa";
import api from "../../../../api";
import ConfirmModal from "../../../common/ConfirmModal/ConfirmModal";
import { parseApiError } from "../Clients/barberClientUtils";
import "./BarberClientDocuments.scss";

const asResults = (data) => ({
  results: Array.isArray(data?.results)
    ? data.results
    : Array.isArray(data)
      ? data
      : [],
  next: data?.next ?? null,
  previous: data?.previous ?? null,
  count: typeof data?.count === "number" ? data.count : null,
});

export const resolveBarberMediaUrl = (path) => {
  if (!path) return "";
  if (/^https?:\/\//i.test(path)) return path;
  const apiBase = import.meta.env.VITE_API_URL || "https://app.nurcrm.kg/api";
  const origin = String(apiBase).replace(/\/api\/?$/i, "");
  return `${origin}${path.startsWith("/") ? path : `/${path}`}`;
};

const fmtDt = (iso) => {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const dd = `${d.getDate()}`.padStart(2, "0");
  const mm = `${d.getMonth() + 1}`.padStart(2, "0");
  const yyyy = d.getFullYear();
  const hh = `${d.getHours()}`.padStart(2, "0");
  const mi = `${d.getMinutes()}`.padStart(2, "0");
  return `${dd}.${mm}.${yyyy} ${hh}:${mi}`;
};

const BarberClientDocuments = () => {
  const uploadFileInputId = useId();
  const editFileInputId = useId();

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [clients, setClients] = useState([]);
  const [count, setCount] = useState(null);
  const [next, setNext] = useState(null);
  const [previous, setPrevious] = useState(null);
  const [listLoading, setListLoading] = useState(false);
  const [listErr, setListErr] = useState("");

  const [selected, setSelected] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailErr, setDetailErr] = useState("");

  const [uploadFile, setUploadFile] = useState(null);
  const [uploadComment, setUploadComment] = useState("");
  const [uploadBusy, setUploadBusy] = useState(false);

  const [editDoc, setEditDoc] = useState(null);
  const [editComment, setEditComment] = useState("");
  const [editFile, setEditFile] = useState(null);
  const [editBusy, setEditBusy] = useState(false);

  const [deleteDoc, setDeleteDoc] = useState(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const debounceRef = useRef(null);
  const listAbort = useRef(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDebouncedSearch(search), 400);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch]);

  const loadClientDetail = useCallback(async (clientId) => {
    if (!clientId) return;
    setDetailLoading(true);
    setDetailErr("");
    try {
      const { data } = await api.get(`/barbershop/clients/${clientId}/`);
      setSelected({
        id: data.id,
        full_name: data.full_name || "—",
        phone: data.phone || "",
      });
      setDocuments(Array.isArray(data.documents) ? data.documents : []);
    } catch (e) {
      setDetailErr(parseApiError(e, "Не удалось загрузить клиента."));
      setDocuments([]);
    } finally {
      setDetailLoading(false);
    }
  }, []);

  useEffect(() => {
    if (listAbort.current) listAbort.current.abort();
    const ac = new AbortController();
    listAbort.current = ac;

    const params = {
      ordering: "-created_at",
      page,
      page_size: 25,
    };
    if (debouncedSearch.trim()) params.search = debouncedSearch.trim();

    setListLoading(true);
    setListErr("");

    api
      .get("/barbershop/clients/", { params, signal: ac.signal })
      .then(({ data }) => {
        const n = asResults(data);
        setClients(n.results);
        setNext(n.next);
        setPrevious(n.previous);
        setCount(n.count);
      })
      .catch((e) => {
        if (e?.name === "CanceledError" || e?.code === "ERR_CANCELED") return;
        setListErr(parseApiError(e, "Не удалось загрузить клиентов."));
        setClients([]);
      })
      .finally(() => {
        if (!ac.signal.aborted) setListLoading(false);
      });

    return () => ac.abort();
  }, [debouncedSearch, page]);

  const onSelectClient = (row) => {
    setSelected({ id: row.id, full_name: row.full_name, phone: row.phone });
    loadClientDetail(row.id);
  };

  const refreshDocuments = () => {
    if (selected?.id) loadClientDetail(selected.id);
  };

  const submitUpload = async (e) => {
    e.preventDefault();
    if (!selected?.id || !uploadFile) return;
    setUploadBusy(true);
    setDetailErr("");
    try {
      const fd = new FormData();
      fd.append("file", uploadFile);
      if (uploadComment.trim()) fd.append("file_comment", uploadComment.trim());
      await api.post(`/barbershop/clients/${selected.id}/documents/`, fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setUploadFile(null);
      setUploadComment("");
      refreshDocuments();
    } catch (e) {
      setDetailErr(parseApiError(e, "Не удалось загрузить файл."));
    } finally {
      setUploadBusy(false);
    }
  };

  const openEdit = (doc) => {
    setEditDoc(doc);
    setEditComment(doc.file_comment || "");
    setEditFile(null);
  };

  const submitEdit = async (e) => {
    e.preventDefault();
    if (!selected?.id || !editDoc) return;
    setEditBusy(true);
    setDetailErr("");
    try {
      if (editFile) {
        const fd = new FormData();
        fd.append("file", editFile);
        if (editComment.trim()) fd.append("file_comment", editComment.trim());
        await api.patch(
          `/barbershop/clients/${selected.id}/documents/${editDoc.id}/`,
          fd,
          {
            headers: { "Content-Type": "multipart/form-data" },
          },
        );
      } else {
        await api.patch(
          `/barbershop/clients/${selected.id}/documents/${editDoc.id}/`,
          {
            file_comment: editComment.trim() || null,
          },
        );
      }
      setEditDoc(null);
      refreshDocuments();
    } catch (e) {
      setDetailErr(parseApiError(e, "Не удалось обновить документ."));
    } finally {
      setEditBusy(false);
    }
  };

  const confirmDelete = async () => {
    if (!selected?.id || !deleteDoc || deleteBusy) return;
    setDeleteBusy(true);
    setDetailErr("");
    try {
      await api.delete(
        `/barbershop/clients/${selected.id}/documents/${deleteDoc.id}/`,
      );
      setDeleteDoc(null);
      refreshDocuments();
    } catch (e) {
      setDetailErr(parseApiError(e, "Не удалось удалить документ."));
    } finally {
      setDeleteBusy(false);
    }
  };

  return (
    <div className="barber-client-docs">
      <header className="barber-client-docs__head">
        <h1 className="barber-client-docs__title">Документы клиентов</h1>
        <p className="barber-client-docs__subtitle">
          Файлы в карточке клиента: загрузка, комментарий, замена и удаление.
        </p>
      </header>

      <div className="barber-client-docs__layout">
        <div className="barber-client-docs__panel">
          <h2 className="barber-client-docs__panelTitle">Клиенты</h2>
          <div className="barber-client-docs__search">
            <FaSearch className="barber-client-docs__searchIcon" />
            <input
              className="barber-client-docs__searchInput"
              placeholder="Поиск по имени или телефону…"
              value={search}
              onChange={(ev) => setSearch(ev.target.value)}
              aria-label="Поиск клиентов"
            />
          </div>
          {listErr ? (
            <div className="barber-client-docs__alert">{listErr}</div>
          ) : null}
          {listLoading ? (
            <div className="barber-client-docs__empty">Загрузка…</div>
          ) : (
            <div className="barber-client-docs__clientList">
              {clients.length === 0 ? (
                <div className="barber-client-docs__empty">
                  Клиенты не найдены.
                </div>
              ) : (
                clients.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    className={`barber-client-docs__clientBtn${
                      selected?.id === c.id
                        ? " barber-client-docs__clientBtn--active"
                        : ""
                    }`}
                    onClick={() => onSelectClient(c)}
                  >
                    <span className="barber-client-docs__clientName">
                      {c.full_name || "—"}
                    </span>
                    {c.phone ? (
                      <span className="barber-client-docs__clientPhone">
                        {c.phone}
                      </span>
                    ) : null}
                  </button>
                ))
              )}
            </div>
          )}
          <div className="barber-client-docs__pager">
            <button
              type="button"
              className="barber-client-docs__pagerBtn"
              disabled={!previous || listLoading}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Назад
            </button>
            <span className="barber-client-docs__pagerInfo">
              Стр. {page}
              {count != null ? ` · ${count} всего` : ""}
            </span>
            <button
              type="button"
              className="barber-client-docs__pagerBtn"
              disabled={!next || listLoading}
              onClick={() => setPage((p) => p + 1)}
            >
              Далее
            </button>
          </div>
        </div>

        <div
          className="barber-client-docs__panel"
          style={{ background: "#fff" }}
        >
          {!selected?.id ? (
            <div className="barber-client-docs__empty">
              Выберите клиента слева, чтобы увидеть и добавить документы.
            </div>
          ) : (
            <>
              <div className="barber-client-docs__detailHead">
                <div>
                  <h2 className="barber-client-docs__detailTitle">
                    {selected.full_name}
                  </h2>
                  {selected.phone ? (
                    <p className="barber-client-docs__detailMeta">
                      {selected.phone}
                    </p>
                  ) : null}
                </div>
              </div>

              {detailErr ? (
                <div className="barber-client-docs__alert">{detailErr}</div>
              ) : null}

              <form
                className="barber-client-docs__upload"
                onSubmit={submitUpload}
              >
                <div className="barber-client-docs__field">
                  <span className="barber-client-docs__label">Файл</span>
                  <div className="barber-client-docs__fileWrap">
                    <input
                      id={uploadFileInputId}
                      type="file"
                      className="barber-client-docs__fileInputNative"
                      aria-label="Выбрать файл для загрузки"
                      onChange={(ev) =>
                        setUploadFile(ev.target.files?.[0] || null)
                      }
                      disabled={uploadBusy || detailLoading}
                    />
                    <label
                      htmlFor={uploadFileInputId}
                      className={`barber-client-docs__filePick${
                        uploadBusy || detailLoading
                          ? " barber-client-docs__filePick--disabled"
                          : ""
                      }`}
                    >
                      {uploadFile ? (
                        <span className="barber-client-docs__filePickName">
                          {uploadFile.name}
                        </span>
                      ) : (
                        <span className="barber-client-docs__filePickCta">
                          <FaUpload
                            className="barber-client-docs__filePickIcon"
                            aria-hidden
                          />
                          Нажмите, чтобы выбрать файл
                        </span>
                      )}
                    </label>
                  </div>
                  <span className="barber-client-docs__filePickHint">
                    PDF, изображения, офисные форматы
                  </span>
                </div>
                <div className="barber-client-docs__field">
                  <span className="barber-client-docs__label">
                    Комментарий (необязательно)
                  </span>
                  <input
                    className="barber-client-docs__input"
                    value={uploadComment}
                    onChange={(ev) => setUploadComment(ev.target.value)}
                    placeholder="Например: паспорт, согласие…"
                    disabled={uploadBusy || detailLoading}
                  />
                </div>
                <button
                  type="submit"
                  className="barber-client-docs__btn barber-client-docs__btn--primary"
                  disabled={!uploadFile || uploadBusy || detailLoading}
                >
                  <FaUpload /> Загрузить
                </button>
              </form>

              {detailLoading ? (
                <div className="barber-client-docs__empty">
                  Загрузка документов…
                </div>
              ) : (
                <div className="barber-client-docs__tableWrap">
                  <table className="barber-client-docs__table">
                    <thead>
                      <tr>
                        <th>Файл</th>
                        <th>Комментарий</th>
                        <th>Дата</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {documents.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="barber-client-docs__empty">
                            Пока нет документов.
                          </td>
                        </tr>
                      ) : (
                        documents.map((d) => (
                          <tr key={d.id}>
                            <td>
                              <a
                                className="barber-client-docs__fileLink"
                                href={resolveBarberMediaUrl(d.file)}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                {String(d.file || "")
                                  .split("/")
                                  .pop() || "файл"}
                              </a>
                            </td>
                            <td>{d.file_comment || "—"}</td>
                            <td>{fmtDt(d.file_create_date)}</td>
                            <td>
                              <div className="barber-client-docs__actions">
                                <button
                                  type="button"
                                  className="barber-client-docs__btn barber-client-docs__btn--secondary"
                                  onClick={() => openEdit(d)}
                                >
                                  Изменить
                                </button>
                                <button
                                  type="button"
                                  className="barber-client-docs__btn barber-client-docs__btn--danger"
                                  onClick={() => setDeleteDoc(d)}
                                >
                                  <FaTrash /> Удалить
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {editDoc ? (
        <div
          className="barber-client-docs__modalOverlay"
          role="presentation"
          onClick={() => !editBusy && setEditDoc(null)}
        >
          <div
            className="barber-client-docs__modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="barber-doc-edit-title"
            onClick={(ev) => ev.stopPropagation()}
          >
            <div className="barber-client-docs__modalHead">
              <h3
                id="barber-doc-edit-title"
                className="barber-client-docs__modalTitle"
              >
                Редактировать документ
              </h3>
              <button
                type="button"
                className="barber-client-docs__iconBtn"
                aria-label="Закрыть"
                onClick={() => !editBusy && setEditDoc(null)}
              >
                <FaTimes />
              </button>
            </div>
            <form onSubmit={submitEdit}>
              <div
                className="barber-client-docs__field"
                style={{ marginBottom: 12 }}
              >
                <span className="barber-client-docs__label">
                  Новый файл (необязательно)
                </span>
                <div className="barber-client-docs__fileWrap">
                  <input
                    id={editFileInputId}
                    type="file"
                    className="barber-client-docs__fileInputNative"
                    aria-label="Выбрать новый файл"
                    onChange={(ev) => setEditFile(ev.target.files?.[0] || null)}
                    disabled={editBusy}
                  />
                  <label
                    htmlFor={editFileInputId}
                    className={`barber-client-docs__filePick barber-client-docs__filePick--compact${
                      editBusy ? " barber-client-docs__filePick--disabled" : ""
                    }`}
                  >
                    {editFile ? (
                      <span className="barber-client-docs__filePickName">
                        {editFile.name}
                      </span>
                    ) : (
                      <span className="barber-client-docs__filePickCta">
                        <FaUpload
                          className="barber-client-docs__filePickIcon"
                          aria-hidden
                        />
                        Заменить файл…
                      </span>
                    )}
                  </label>
                </div>
              </div>
              <div className="barber-client-docs__field">
                <span className="barber-client-docs__label">Комментарий</span>
                <textarea
                  className="barber-client-docs__textarea"
                  value={editComment}
                  onChange={(ev) => setEditComment(ev.target.value)}
                  disabled={editBusy}
                />
              </div>
              <div className="barber-client-docs__modalFooter">
                <button
                  type="button"
                  className="barber-client-docs__btn barber-client-docs__btn--secondary"
                  onClick={() => !editBusy && setEditDoc(null)}
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  className="barber-client-docs__btn barber-client-docs__btn--primary"
                  disabled={editBusy}
                >
                  Сохранить
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      <ConfirmModal
        isOpen={!!deleteDoc}
        message={
          deleteDoc
            ? `Удалить документ «${
                String(deleteDoc.file || "")
                  .split("/")
                  .pop() || "файл"
              }»?`
            : ""
        }
        onCancel={() => setDeleteDoc(null)}
        onConfirm={confirmDelete}
      />
    </div>
  );
};

export default BarberClientDocuments;
