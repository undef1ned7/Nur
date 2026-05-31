// src/components/Documents/Documents.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import "./Documents.scss";
import api from "../../../../api";
import BarberSelect from "../common/BarberSelect";
import ConfirmModal from "../../../common/ConfirmModal/ConfirmModal";

/* ===== helpers ===== */
const normalizeResp = (data) =>
  Array.isArray(data)
    ? { results: data, next: null, previous: null, count: data.length }
    : {
        results: data?.results || [],
        next: data?.next || null,
        previous: data?.previous || null,
        count: typeof data?.count === "number" ? data.count : null,
      };

const extFromUrl = (u = "") => {
  try {
    const p = new URL(u, window.location.origin);
    const last = p.pathname.split("/").filter(Boolean).pop() || "";
    return last.split(".").pop()?.toLowerCase() || "";
  } catch {
    const last = (u || "").split("/").filter(Boolean).pop() || "";
    return last.split(".").pop()?.toLowerCase() || "";
  }
};
const guessMime = (url = "") => {
  const ext = extFromUrl(url);
  if (["png", "jpg", "jpeg", "gif", "webp", "bmp"].includes(ext))
    return `image/${ext === "jpg" ? "jpeg" : ext}`;
  if (ext === "pdf") return "application/pdf";
  if (["doc", "docx"].includes(ext)) return "application/msword";
  if (["xls", "xlsx"].includes(ext)) return "application/vnd.ms-excel";
  if (["ppt", "pptx"].includes(ext)) return "application/vnd.ms-powerpoint";
  if (["txt", "md"].includes(ext)) return "text/plain";
  return "";
};
const fileEmoji = (type, url) => {
  const t = type || guessMime(url) || "";
  if (t.startsWith("image/")) return "🖼️";
  if (t === "application/pdf") return "📕";
  if (t.includes("sheet") || t.includes("excel") || /\.xlsx?$/i.test(url))
    return "📊";
  if (t.includes("word") || /\.docx?$/i.test(url)) return "📃";
  if (t.includes("presentation") || /\.pptx?$/i.test(url)) return "🖥️";
  if (/\.zip|\.rar|\.7z/i.test(url)) return "🗜️";
  return "📄";
};
const fmtISO = (iso) => {
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

/* ===== main component ===== */
export default function BarberDocuments() {
  const [tab, setTab] = useState("folders"); // "folders" | "docs"

  /* ---------- CONFIRM MODAL ---------- */
  const [confirmModal, setConfirmModal] = useState({
    open: false,
    title: "",
    message: "",
    onConfirm: null,
  });

  /* ---------- FOLDERS ---------- */
  const [foldRows, setFoldRows] = useState([]);
  const [foldLoading, setFoldLoading] = useState(false);
  const [foldErr, setFoldErr] = useState("");
  const [foldNext, setFoldNext] = useState(null);
  const [foldPrev, setFoldPrev] = useState(null);

  const [folderQ, setFolderQ] = useState("");
  const [selectedFolderId, setSelectedFolderId] = useState("");
  const [folderDetail, setFolderDetail] = useState(null);
  const [folderDetailLoading, setFolderDetailLoading] = useState(false);

  const [createFolderOpen, setCreateFolderOpen] = useState(false);
  const [createFolderName, setCreateFolderName] = useState("");
  const [createFolderBusy, setCreateFolderBusy] = useState(false);

  const [editFolderOpen, setEditFolderOpen] = useState(false);
  const [editFolderId, setEditFolderId] = useState("");
  const [editFolderName, setEditFolderName] = useState("");
  const [editFolderBusy, setEditFolderBusy] = useState(false);

  const [allFoldersForSelect, setAllFoldersForSelect] = useState([]); // для выпадашек в документах
  const nameRef = useRef(null);

  const loadFolders = async (url = "/barbershop/folders/") => {
    setFoldLoading(true);
    setFoldErr("");
    try {
      const { data } = await api.get(url);
      const n = normalizeResp(data);
      setFoldRows(n.results);
      setFoldNext(n.next);
      setFoldPrev(n.previous);
      if (n.results?.[0]) {
        setSelectedFolderId((prev) => prev || n.results[0].id);
      } else {
        setSelectedFolderId("");
        setFolderDetail(null);
      }
    } catch (e) {
      setFoldErr(e?.response?.data?.detail || "Не удалось загрузить папки");
    } finally {
      setFoldLoading(false);
    }
  };

  const loadFolderDetail = async (id) => {
    if (!id) {
      setFolderDetail(null);
      return;
    }
    setFolderDetailLoading(true);
    try {
      const { data } = await api.get(`/barbershop/folders/${id}/`);
      setFolderDetail(data);
      setFoldRows((prev) => prev.map((x) => (x.id === id ? data : x)));
    } catch {
    } finally {
      setFolderDetailLoading(false);
    }
  };

  const fetchAllFoldersForSelect = async () => {
    const acc = [];
    let next = "/barbershop/folders/";
    try {
      while (next) {
        const { data } = await api.get(next);
        const n = normalizeResp(data);
        acc.push(...n.results);
        next = n.next;
      }
      acc.sort((a, b) => (a.name || "").localeCompare(b.name || "", "ru"));
      setAllFoldersForSelect(acc);
    } catch {
      setAllFoldersForSelect([]);
    }
  };

  const onCreateFolder = async (e) => {
    e.preventDefault();
    const name = (createFolderName || "").trim();
    if (!name) {
      alert("Название папки обязательно");
      return;
    }
    if (name.length > 255) {
      alert("Макс. длина названия — 255");
      return;
    }
    setCreateFolderBusy(true);
    setFoldErr("");
    try {
      const payload = { name }; // без родителя
      const { data } = await api.post("/barbershop/folders/", payload);
      await loadFolders();
      if (data?.id) setSelectedFolderId(data.id);
      setCreateFolderOpen(false);
      setCreateFolderName("");
    } catch (e2) {
      setFoldErr(e2?.response?.data?.detail || "Не удалось создать папку");
    } finally {
      setCreateFolderBusy(false);
    }
  };

  const openEditFolder = (f) => {
    setEditFolderId(f.id);
    setEditFolderName(f.name || "");
    setEditFolderOpen(true);
    setTimeout(() => nameRef.current?.focus(), 0);
  };

  const onEditFolder = async (e) => {
    e.preventDefault();
    const name = (editFolderName || "").trim();
    if (!name) {
      alert("Название папки обязательно");
      return;
    }
    setEditFolderBusy(true);
    setFoldErr("");
    try {
      await api.patch(`/barbershop/folders/${editFolderId}/`, { name });
      await loadFolders();
      setEditFolderOpen(false);
      if (selectedFolderId === editFolderId) loadFolderDetail(editFolderId);
    } catch (e2) {
      setFoldErr(e2?.response?.data?.detail || "Не удалось изменить папку");
    } finally {
      setEditFolderBusy(false);
    }
  };

  const onDeleteFolder = async (f) => {
    setConfirmModal({
      open: true,
      title: "Удаление папки",
      message: `Удалить папку «${f.name || "Без названия"}»?`,
      onConfirm: async () => {
        setFoldErr("");
        try {
          await api.delete(`/barbershop/folders/${f.id}/`);
          await loadFolders();
          if (selectedFolderId === f.id) {
            setSelectedFolderId("");
            setFolderDetail(null);
          }
        } catch (err) {
          setFoldErr(err?.response?.data?.detail || "Ошибка удаления папки");
        }
        setConfirmModal({ open: false, title: "", message: "", onConfirm: null });
      },
    });
  };

  const onDeleteFolderLegacy = async (f) => {
    setFoldErr("");
    try {
      await api.delete(`/barbershop/folders/${f.id}/`);
      await loadFolders();
      if (selectedFolderId === f.id) {
        setSelectedFolderId("");
        setFolderDetail(null);
      }
    } catch (e2) {
      setFoldErr(
        e2?.response?.data?.detail ||
          "Не удалось удалить папку. Убедитесь, что в папке нет документов."
      );
    }
  };

  useEffect(() => {
    loadFolders();
  }, []);
  useEffect(() => {
    if (selectedFolderId) loadFolderDetail(selectedFolderId);
  }, [selectedFolderId]);

  const foldFiltered = useMemo(() => {
    const s = folderQ.trim().toLowerCase();
    if (!s) return foldRows;
    return foldRows.filter((r) => `${r.name || ""}`.toLowerCase().includes(s));
  }, [foldRows, folderQ]);

  /* ---------- DOCUMENTS ---------- */
  const [docRows, setDocRows] = useState([]);
  const [docLoading, setDocLoading] = useState(false);
  const [docErr, setDocErr] = useState("");
  const [docNext, setDocNext] = useState(null);
  const [docPrev, setDocPrev] = useState(null);

  const [docQ, setDocQ] = useState("");
  const [docFolderFilter, setDocFolderFilter] = useState(""); // '' = все, иначе UUID
  const [selectedDocId, setSelectedDocId] = useState("");
  const [docViewerUrl, setDocViewerUrl] = useState("");

  const [createDocOpen, setCreateDocOpen] = useState(false);
  const [createDocName, setCreateDocName] = useState("");
  const [createDocFolder, setCreateDocFolder] = useState("");
  const [createDocFile, setCreateDocFile] = useState(null);
  const [createDocBusy, setCreateDocBusy] = useState(false);

  const [editDocOpen, setEditDocOpen] = useState(false);
  const [editDocId, setEditDocId] = useState("");
  const [editDocName, setEditDocName] = useState("");
  const [editDocFolder, setEditDocFolder] = useState("");
  const [editDocFile, setEditDocFile] = useState(null);
  const [editDocBusy, setEditDocBusy] = useState(false);

  const loadDocs = async (url = "/barbershop/documents/") => {
    setDocLoading(true);
    setDocErr("");
    try {
      const { data } = await api.get(url);
      const n = normalizeResp(data);
      setDocRows(n.results);
      setDocNext(n.next);
      setDocPrev(n.previous);
      if (n.results?.[0]) {
        setSelectedDocId((prev) => prev || n.results[0].id);
        setDocViewerUrl(n.results[0].file || "");
      } else {
        setSelectedDocId("");
        setDocViewerUrl("");
      }
    } catch (e) {
      setDocErr(e?.response?.data?.detail || "Не удалось загрузить документы");
    } finally {
      setDocLoading(false);
    }
  };

  const loadDocDetail = async (id) => {
    if (!id) return;
    try {
      const { data } = await api.get(`/barbershop/documents/${id}/`);
      setDocRows((prev) => prev.map((x) => (x.id === id ? data : x)));
      setDocViewerUrl(data.file || "");
    } catch {}
  };

  const onCreateDoc = async (e) => {
    e.preventDefault();
    if (!createDocFolder.trim()) {
      alert("Выберите папку");
      return;
    }

    setCreateDocBusy(true);
    setDocErr("");
    try {
      let data;
      if (createDocFile) {
        const fd = new FormData();
        fd.append("folder", createDocFolder.trim());
        if (createDocName.trim()) fd.append("name", createDocName.trim());
        fd.append("file", createDocFile);
        ({ data } = await api.post("/barbershop/documents/", fd, {
          headers: { "Content-Type": "multipart/form-data" },
        }));
      } else {
        ({ data } = await api.post("/barbershop/documents/", {
          folder: createDocFolder.trim(),
          ...(createDocName.trim() ? { name: createDocName.trim() } : {}),
        }));
      }

      await loadDocs();
      if (data?.id) {
        setSelectedDocId(data.id);
        setDocViewerUrl(data.file || "");
      }
      setCreateDocOpen(false);
      setCreateDocName("");
      setCreateDocFolder(docFolderFilter || selectedFolderId || "");
      setCreateDocFile(null);
    } catch (e2) {
      setDocErr(e2?.response?.data?.detail || "Не удалось создать документ");
    } finally {
      setCreateDocBusy(false);
    }
  };

  const openEditDoc = (d) => {
    setEditDocId(d.id);
    setEditDocName(d.name || "");
    setEditDocFolder(d.folder || "");
    setEditDocFile(null);
    setEditDocOpen(true);
    if (!allFoldersForSelect.length) fetchAllFoldersForSelect();
  };

  const onEditDoc = async (e) => {
    e.preventDefault();
    if (!editDocFolder.trim()) {
      alert("Выберите папку");
      return;
    }

    setEditDocBusy(true);
    setDocErr("");
    try {
      if (editDocFile) {
        // Меняем файл/метаданные: multipart PATCH
        const fd = new FormData();
        fd.append("folder", editDocFolder.trim());
        fd.append("name", (editDocName || "").trim());
        fd.append("file", editDocFile);
        await api.patch(`/barbershop/documents/${editDocId}/`, fd, {
          headers: { "Content-Type": "multipart/form-data" },
        });
      } else {
        // Только имя/папка
        await api.patch(`/barbershop/documents/${editDocId}/`, {
          name: (editDocName || "").trim(),
          folder: editDocFolder.trim(),
        });
      }

      await loadDocs();
      setEditDocOpen(false);
      if (selectedDocId === editDocId) loadDocDetail(editDocId);
    } catch (e2) {
      setDocErr(e2?.response?.data?.detail || "Не удалось изменить документ");
    } finally {
      setEditDocBusy(false);
    }
  };

  const onDeleteDoc = async (d) => {
    setConfirmModal({
      open: true,
      title: "Удаление документа",
      message: `Удалить документ «${d.name || "Без названия"}»?`,
      onConfirm: async () => {
        setDocErr("");
        try {
          await api.delete(`/barbershop/documents/${d.id}/`);
          await loadDocs();
          if (selectedDocId === d.id) {
            setSelectedDocId("");
            setDocViewerUrl("");
          }
        } catch (err) {
          setDocErr(err?.response?.data?.detail || "Ошибка удаления документа");
        }
        setConfirmModal({ open: false, title: "", message: "", onConfirm: null });
      },
    });
  };

  const onDeleteDocLegacy = async (d) => {
    setDocErr("");
    try {
      await api.delete(`/barbershop/documents/${d.id}/`);
      await loadDocs();
      if (selectedDocId === d.id) {
        setSelectedDocId("");
        setDocViewerUrl("");
      }
    } catch (e2) {
      setDocErr(e2?.response?.data?.detail || "Не удалось удалить документ");
    }
  };

  useEffect(() => {
    if (tab === "docs") {
      loadDocs();
      fetchAllFoldersForSelect();
      if (selectedFolderId) setDocFolderFilter(selectedFolderId);
    }
  }, [tab]);

  useEffect(() => {
    if (tab === "docs" && selectedFolderId) {
      setDocFolderFilter(selectedFolderId);
    }
  }, [tab, selectedFolderId]);

  const docFiltered = useMemo(() => {
    const s = docQ.trim().toLowerCase();
    return docRows.filter((r) => {
      const okFolder = docFolderFilter ? r.folder === docFolderFilter : true;
      if (!okFolder) return false;
      if (!s) return true;
      const fname = (r.file || "").split("/").pop() || "";
      const hay = `${r.name || ""} ${
        r.folder_name || ""
      } ${fname}`.toLowerCase();
      return hay.includes(s);
    });
  }, [docRows, docQ, docFolderFilter]);

  const currentDoc = useMemo(
    () => docFiltered.find((r) => r.id === selectedDocId) || null,
    [docFiltered, selectedDocId]
  );

  const onSelectDoc = async (row) => {
    setSelectedDocId(row.id);
    setDocViewerUrl(row.file || "");
    await loadDocDetail(row.id);
  };

  /* ===== RENDER ===== */
  return (
    <div className="docs">
      {/* Header */}
      <div className="docs__header">
        <div>
          <h3 className="docs__title">Документы и папки</h3>
          <div className="docs__subtitle">Управляйте папками и файлами</div>
        </div>

        <div className="docs__actions">
          <div className="docs__tabs">
            <button
              className={`tab ${tab === "folders" ? "tab--active" : ""}`}
              onClick={() => setTab("folders")}
            >
              Папки
            </button>
            <button
              className={`tab ${tab === "docs" ? "tab--active" : ""}`}
              onClick={() => setTab("docs")}
            >
              Документы
            </button>
          </div>
        </div>
      </div>

      {/* ===== FOLDERS TAB ===== */}
      {tab === "folders" && (
        <>
          <div className="docs__serverBar">
            <div className="docs__search">
              <span className="docs__searchIcon">🔎</span>
              <input
                className="docs__searchInput"
                placeholder="Поиск по папкам…"
                value={folderQ}
                onChange={(e) => setFolderQ(e.target.value)}
              />
            </div>
            {foldErr ? <span className="docs__error">{foldErr}</span> : null}
            <div className="docs__barActions">
              <button
                className="btn"
                disabled={foldLoading}
                onClick={() => loadFolders()}
              >
                Обновить
              </button>
              <button
                className="btn btn--primary"
                onClick={() => {
                  setCreateFolderOpen(true);
                  setTimeout(() => nameRef.current?.focus(), 0);
                }}
              >
                + Папка
              </button>
            </div>
          </div>

          <div className="docs__grid">
            {/* List */}
            <section className="docs__list">
              {foldFiltered.length === 0 ? (
                <div className="docs__empty">
                  {foldLoading ? "Загрузка…" : "Ничего не найдено"}
                </div>
              ) : (
                <>
                  <ul className="docs__cards">
                    {foldFiltered.map((f) => (
                      <li
                        key={f.id}
                        className={`docs__card ${
                          f.id === selectedFolderId ? "docs__card--active" : ""
                        }`}
                        onDoubleClick={() => setSelectedFolderId(f.id)}
                      >
                        <div className="docs__cardMain">
                          <div className="docs__name">
                            📁 {f.name || "Без названия"}
                          </div>
                        </div>
                        <div className="docs__cardActions">
                          <button
                            className="btn btn--secondary"
                            onClick={() => setSelectedFolderId(f.id)}
                          >
                            Открыть
                          </button>
                          <button
                            className="btn"
                            onClick={() => openEditFolder(f)}
                          >
                            Изменить
                          </button>
                          <button
                            className="btn btn--danger"
                            onClick={() => onDeleteFolder(f)}
                          >
                            Удалить
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>

                  <div className="docs__pager">
                    <button
                      className="btn"
                      disabled={!foldPrev || foldLoading}
                      onClick={() => loadFolders(foldPrev)}
                    >
                      ← Назад
                    </button>
                    <button
                      className="btn"
                      disabled={!foldNext || foldLoading}
                      onClick={() => loadFolders(foldNext)}
                    >
                      Вперёд →
                    </button>
                  </div>
                </>
              )}
            </section>

            {/* Viewer */}
            <section className="docs__viewer">
              {!selectedFolderId ? (
                <div className="docs__placeholder">Выберите папку</div>
              ) : folderDetailLoading ? (
                <div className="docs__placeholder">Загрузка…</div>
              ) : !folderDetail ? (
                <div className="docs__placeholder">Данные недоступны</div>
              ) : (
                <div className="docs__previewWrap">
                  <div className="docs__previewHeader">
                    <div className="docs__previewTitle">
                      📁 {folderDetail.name || "Без названия"}
                    </div>
                  </div>
                </div>
              )}
            </section>
          </div>

          {/* Create Folder Modal */}
          {createFolderOpen && (
            <div className="docs__modalOverlay">
              <div className="docs__modal">
                <div className="docs__modalHeader">
                  <div className="docs__modalTitle">Новая папка</div>
                  <button
                    className="docs__iconBtn"
                    onClick={() => setCreateFolderOpen(false)}
                    aria-label="Закрыть"
                  >
                    ×
                  </button>
                </div>

                <form className="docs__form" onSubmit={onCreateFolder}>
                  <div className="docs__formGrid">
                    <div className="docs__field">
                      <label className="docs__label">
                        Название <span className="docs__req">*</span>
                      </label>
                      <input
                        ref={nameRef}
                        className="docs__input"
                        value={createFolderName}
                        onChange={(e) => setCreateFolderName(e.target.value)}
                        placeholder="Например: Договоры"
                        maxLength={255}
                        required
                      />
                    </div>
                  </div>

                  <div className="docs__formActions">
                    <button
                      type="button"
                      className="btn"
                      onClick={() => setCreateFolderOpen(false)}
                      disabled={createFolderBusy}
                    >
                      Отмена
                    </button>
                    <button
                      type="submit"
                      className="btn btn--primary"
                      disabled={createFolderBusy || !createFolderName.trim()}
                    >
                      Создать
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Edit Folder Modal */}
          {editFolderOpen && (
            <div className="docs__modalOverlay">
              <div className="docs__modal">
                <div className="docs__modalHeader">
                  <div className="docs__modalTitle">Изменить папку</div>
                  <button
                    className="docs__iconBtn"
                    onClick={() => setEditFolderOpen(false)}
                    aria-label="Закрыть"
                  >
                    ×
                  </button>
                </div>

                <form className="docs__form" onSubmit={onEditFolder}>
                  <div className="docs__formGrid">
                    <div className="docs__field">
                      <label className="docs__label">
                        Название <span className="docs__req">*</span>
                      </label>
                      <input
                        ref={nameRef}
                        className="docs__input"
                        value={editFolderName}
                        onChange={(e) => setEditFolderName(e.target.value)}
                        placeholder="Например: Договоры"
                        maxLength={255}
                        required
                      />
                    </div>
                  </div>

                  <div className="docs__formActions">
                    <button
                      type="button"
                      className="btn"
                      onClick={() => setEditFolderOpen(false)}
                      disabled={editFolderBusy}
                    >
                      Отмена
                    </button>
                    <button
                      type="submit"
                      className="btn btn--primary"
                      disabled={editFolderBusy || !editFolderName.trim()}
                    >
                      Сохранить
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </>
      )}

      {/* ===== DOCUMENTS TAB ===== */}
      {tab === "docs" && (
        <>
          <div className="docs__serverBar">
            <div className="docs__search">
              <span className="docs__searchIcon">🔎</span>
              <input
                className="docs__searchInput"
                placeholder="Поиск по документам…"
                value={docQ}
                onChange={(e) => setDocQ(e.target.value)}
              />
            </div>

            <div className="docs__filter">
              <label className="docs__filterLabel">Папка</label>
              <BarberSelect
                value={docFolderFilter}
                onChange={setDocFolderFilter}
                options={[
                  { value: "", label: "Все" },
                  ...allFoldersForSelect.map((f) => ({
                    value: String(f.id),
                    label: f.name || "Без названия",
                  })),
                ]}
                placeholder="Все"
              />
            </div>

            {docErr ? <span className="docs__error">{docErr}</span> : null}

            <div className="docs__barActions">
              <button
                className="btn"
                disabled={docLoading}
                onClick={() => loadDocs()}
              >
                Обновить
              </button>
              <button
                className="btn btn--primary"
                onClick={() => {
                  setCreateDocOpen(true);
                  setCreateDocFolder(docFolderFilter || selectedFolderId || "");
                  setCreateDocFile(null);
                  if (!allFoldersForSelect.length) fetchAllFoldersForSelect();
                }}
              >
                + Документ
              </button>
            </div>
          </div>

          <div className="docs__grid">
            {/* List */}
            <section className="docs__list">
              {docFiltered.length === 0 ? (
                <div className="docs__empty">
                  {docLoading ? "Загрузка…" : "Ничего не найдено"}
                </div>
              ) : (
                <>
                  <ul className="docs__cards">
                    {docFiltered.map((d) => {
                      const fileName = (d.file || "").split("/").pop() || "";
                      const mime = guessMime(d.file);
                      return (
                        <li
                          key={d.id}
                          className={`docs__card ${
                            d.id === selectedDocId ? "docs__card--active" : ""
                          }`}
                          onDoubleClick={() => onSelectDoc(d)}
                        >
                          <div className="docs__cardMain">
                            <div className="docs__name">
                              <span className="docs__emoji">
                                {fileEmoji(mime, d.file)}
                              </span>
                              {d.name || "Без названия"}
                            </div>

                            <div className="docs__meta">
                              <span className="docs__filename" title={fileName}>
                                {fileName || "—"}
                              </span>
                              <span>•</span>
                              <span>{d.folder_name || "—"}</span>
                            </div>

                            <div className="docs__meta">
                              <span>Создан: {fmtISO(d.created_at)}</span>
                              <span>•</span>
                              <span>Изменён: {fmtISO(d.updated_at)}</span>
                            </div>
                          </div>

                          <div className="docs__cardActions">
                            <button
                              className="btn btn--secondary"
                              onClick={() => onSelectDoc(d)}
                            >
                              Открыть
                            </button>
                            <button
                              className="btn"
                              onClick={() => openEditDoc(d)}
                            >
                              Изменить
                            </button>
                            <button
                              className="btn btn--danger"
                              onClick={() => onDeleteDoc(d)}
                            >
                              Удалить
                            </button>
                            {d.file ? (
                              <a
                                className="btn btn--secondary"
                                href={d.file}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                Скачать
                              </a>
                            ) : null}
                          </div>
                        </li>
                      );
                    })}
                  </ul>

                  <div className="docs__pager">
                    <button
                      className="btn"
                      disabled={!docPrev || docLoading}
                      onClick={() => loadDocs(docPrev)}
                    >
                      ← Назад
                    </button>
                    <button
                      className="btn"
                      disabled={!docNext || docLoading}
                      onClick={() => loadDocs(docNext)}
                    >
                      Вперёд →
                    </button>
                  </div>
                </>
              )}
            </section>

            {/* Viewer */}
            <section className="docs__viewer">
              {!currentDoc ? (
                <div className="docs__placeholder">Выберите документ</div>
              ) : docViewerUrl ? (
                <Preview
                  url={docViewerUrl}
                  name={currentDoc.name}
                  folderName={currentDoc.folder_name}
                />
              ) : (
                <div className="docs__placeholder">Файл не прикреплён</div>
              )}
            </section>
          </div>

          {/* Create Document Modal */}
          {createDocOpen && (
            <div className="docs__modalOverlay">
              <div className="docs__modal">
                <div className="docs__modalHeader">
                  <div className="docs__modalTitle">Новый документ</div>
                  <button
                    className="docs__iconBtn"
                    onClick={() => setCreateDocOpen(false)}
                    aria-label="Закрыть"
                  >
                    ×
                  </button>
                </div>

                <form className="docs__form" onSubmit={onCreateDoc}>
                  <div className="docs__formGrid">
                    <div className="docs__field">
                      <label className="docs__label">Название</label>
                      <input
                        className="docs__input"
                        value={createDocName}
                        onChange={(e) => setCreateDocName(e.target.value)}
                        placeholder="Например: Договор №12"
                        maxLength={255}
                      />
                    </div>

                    <div className="docs__field">
                      <label className="docs__label">
                        Папка <span className="docs__req">*</span>
                      </label>
                      <BarberSelect
                        value={createDocFolder}
                        onChange={setCreateDocFolder}
                        options={[
                          { value: "", label: "Выберите папку" },
                          ...allFoldersForSelect.map((f) => ({
                            value: String(f.id),
                            label: f.name || "Без названия",
                          })),
                        ]}
                        placeholder="Выберите папку"
                        hideClear
                      />
                    </div>

                    <div className="docs__field">
                      <label className="docs__label">
                        Файл (необязательно)
                      </label>
                      <input
                        className="docs__input"
                        type="file"
                        onChange={(e) =>
                          setCreateDocFile(e.target.files?.[0] || null)
                        }
                      />
                    </div>
                  </div>

                  <div className="docs__formActions">
                    <button
                      type="button"
                      className="btn"
                      onClick={() => setCreateDocOpen(false)}
                      disabled={createDocBusy}
                    >
                      Отмена
                    </button>
                    <button
                      type="submit"
                      className="btn btn--primary"
                      disabled={createDocBusy || !createDocFolder.trim()}
                    >
                      Создать
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Edit Document Modal */}
          {editDocOpen && (
            <div className="docs__modalOverlay">
              <div className="docs__modal">
                <div className="docs__modalHeader">
                  <div className="docs__modalTitle">Изменить документ</div>
                  <button
                    className="docs__iconBtn"
                    onClick={() => setEditDocOpen(false)}
                    aria-label="Закрыть"
                  >
                    ×
                  </button>
                </div>

                <form className="docs__form" onSubmit={onEditDoc}>
                  <div className="docs__formGrid">
                    <div className="docs__field">
                      <label className="docs__label">Название</label>
                      <input
                        className="docs__input"
                        value={editDocName}
                        onChange={(e) => setEditDocName(e.target.value)}
                        placeholder="Например: Договор №12"
                        maxLength={255}
                      />
                    </div>

                    <div className="docs__field">
                      <label className="docs__label">
                        Папка <span className="docs__req">*</span>
                      </label>
                      <BarberSelect
                        value={editDocFolder}
                        onChange={setEditDocFolder}
                        options={[
                          { value: "", label: "Выберите папку" },
                          ...allFoldersForSelect.map((f) => ({
                            value: String(f.id),
                            label: f.name || "Без названия",
                          })),
                        ]}
                        placeholder="Выберите папку"
                        hideClear
                      />
                    </div>

                    <div className="docs__field">
                      <label className="docs__label">
                        Заменить файл (необязательно)
                      </label>
                      <input
                        className="docs__input"
                        type="file"
                        onChange={(e) =>
                          setEditDocFile(e.target.files?.[0] || null)
                        }
                      />
                    </div>
                  </div>

                  <div className="docs__formActions">
                    <button
                      type="button"
                      className="btn"
                      onClick={() => setEditDocOpen(false)}
                      disabled={editDocBusy}
                    >
                      Отмена
                    </button>
                    <button
                      type="submit"
                      className="btn btn--primary"
                      disabled={editDocBusy || !editDocFolder.trim()}
                    >
                      Сохранить
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </>
      )}

      <ConfirmModal
        isOpen={confirmModal.open}
        onClose={() =>
          setConfirmModal({ open: false, title: "", message: "", onConfirm: null })
        }
        onConfirm={confirmModal.onConfirm}
        title={confirmModal.title}
        message={confirmModal.message}
      />
    </div>
  );
}

/* ===== file preview ===== */
function Preview({ url, name, folderName }) {
  const mime = guessMime(url);
  const isImg = mime.startsWith("image/");
  const isPdf = mime === "application/pdf";

  return (
    <div className="docs__previewWrap">
      <div className="docs__previewHeader">
        <div className="docs__previewTitle">{name || "Без названия"}</div>
        <div className="docs__previewSub">
          {folderName || "—"} • {mime || "—"}
        </div>
      </div>

      {isImg ? (
        <img src={url} alt="" className="docs__previewMedia" />
      ) : isPdf ? (
        <iframe src={url} title="preview" className="docs__previewFrame" />
      ) : url ? (
        <div className="docs__placeholder">
          Предпросмотр недоступен.{" "}
          <a href={url} target="_blank" rel="noreferrer">
            Открыть в новой вкладке
          </a>
        </div>
      ) : (
        <div className="docs__placeholder">Нет файла для предпросмотра</div>
      )}
    </div>
  );
}
